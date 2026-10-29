<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

// Fixtures, results and standings. Standings are always calculated from completed matches.
final class ResultService
{
    public const MATCH_STATUSES = ['scheduled', 'postponed', 'completed', 'cancelled'];
    // Fixtures can be arranged once registration closes and until the tournament finishes.
    private const FIXTURE_STATES = ['registration_closed', 'in_progress'];
    private const SELECT = 'SELECT m.*, h.name AS home_name, a.name AS away_name, w.name AS winner_name, f.name AS facility_name
        FROM matches m
        JOIN tournament_entries h ON h.id = m.home_entry_id
        JOIN tournament_entries a ON a.id = m.away_entry_id
        LEFT JOIN tournament_entries w ON w.id = m.winner_entry_id
        LEFT JOIN facilities f ON f.id = m.facility_id';

    public static function listMatches(array $actor, int $tournamentId, array $query): array
    {
        TournamentService::visible($actor, $tournamentId);
        $clauses = ['m.tournament_id = ?'];
        $parameters = [$tournamentId];
        $status = Validation::queryChoice($query, 'status', self::MATCH_STATUSES);
        if ($status !== null) {
            $clauses[] = 'm.status = ?';
            $parameters[] = $status;
        }
        if (isset($query['round_no']) && $query['round_no'] !== '') {
            $clauses[] = 'm.round_no = ?';
            $parameters[] = Validation::positiveInteger($query['round_no'], 'round_no', 1, 1000);
        }
        $statement = Database::get()->prepare(self::SELECT . ' WHERE ' . implode(' AND ', $clauses) . ' ORDER BY m.round_no, m.scheduled_at IS NULL, m.scheduled_at, m.id');
        $statement->execute($parameters);
        return array_map([self::class, 'publicMatch'], $statement->fetchAll());
    }

    public static function findMatch(array $actor, int $id): array
    {
        $match = self::load($id);
        TournamentService::visible($actor, (int) $match['tournament_id']);
        return self::publicMatch($match);
    }

    public static function createMatch(array $actor, int $tournamentId, array $fields): array
    {
        $id = Database::transaction(function (PDO $db) use ($actor, $tournamentId, $fields): int {
            $tournament = TournamentService::visible($actor, $tournamentId, true);
            self::requireFixtureState($tournament);
            $fields += ['round_no' => 1, 'scheduled_at' => null, 'facility_id' => null, 'venue' => null];
            if ($fields['home_entry_id'] === $fields['away_entry_id']) {
                Validation::fail('away_entry_id', 'An entry cannot play itself.');
            }
            foreach (['home_entry_id', 'away_entry_id'] as $field) {
                self::requireApprovedEntry($db, $tournamentId, $fields[$field], $field);
            }
            self::requireFacility($fields['facility_id']);
            self::requireFreeInRound($db, $tournamentId, (int) $fields['round_no'], [$fields['home_entry_id'], $fields['away_entry_id']], null);
            $db->prepare('INSERT INTO matches (tournament_id, round_no, home_entry_id, away_entry_id, scheduled_at, facility_id, venue, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$tournamentId, $fields['round_no'], $fields['home_entry_id'], $fields['away_entry_id'], $fields['scheduled_at'], $fields['facility_id'], $fields['venue'], (int) $actor['id']]);
            return (int) $db->lastInsertId();
        });
        return self::publicMatch(self::load($id));
    }

    // Schedule changes and scheduled/postponed/cancelled status changes; results use recordResult.
    public static function updateMatch(array $actor, int $id, array $changes): array
    {
        Database::transaction(function (PDO $db) use ($actor, $id, $changes): void {
            [$tournament, $match] = self::lock($actor, $id);
            self::requireFixtureState($tournament);
            if (in_array($match['status'], ['completed', 'cancelled'], true)) {
                throw new ApiException(409, 'match_closed', 'A ' . $match['status'] . ' match cannot be changed.');
            }
            if (array_key_exists('facility_id', $changes)) {
                self::requireFacility($changes['facility_id']);
            }
            if (isset($changes['round_no']) && $changes['round_no'] !== (int) $match['round_no']) {
                self::requireFreeInRound($db, (int) $match['tournament_id'], $changes['round_no'], [(int) $match['home_entry_id'], (int) $match['away_entry_id']], $id);
            }
            $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($changes)));
            $db->prepare('UPDATE matches SET ' . $assignments . ' WHERE id = ?')->execute([...array_values($changes), $id]);
        });
        return self::publicMatch(self::load($id));
    }

    public static function cancelMatch(array $actor, int $id): void
    {
        self::updateMatch($actor, $id, ['status' => 'cancelled']);
    }

    public static function recordResult(array $actor, int $id, int $homeScore, int $awayScore, ?int $winnerId, ?string $notes): array
    {
        Database::transaction(function (PDO $db) use ($actor, $id, $homeScore, $awayScore, $winnerId, $notes): void {
            [$tournament, $match] = self::lock($actor, $id);
            if ($tournament['status'] !== 'in_progress') {
                throw new ApiException(409, 'tournament_not_in_progress', 'Results can only be recorded while the tournament is in progress.');
            }
            if ($match['status'] === 'cancelled') {
                throw new ApiException(409, 'match_closed', 'A cancelled match cannot have a result.');
            }
            $home = (int) $match['home_entry_id'];
            $away = (int) $match['away_entry_id'];
            if ($winnerId !== null && $winnerId !== $home && $winnerId !== $away) {
                Validation::fail('winner_entry_id', 'The winner must be one of the two entries in this match.');
            }
            $byScore = $homeScore === $awayScore ? null : ($homeScore > $awayScore ? $home : $away);
            if ($byScore !== null && $winnerId !== null && $winnerId !== $byScore) {
                Validation::fail('winner_entry_id', 'The winner must be the entry with the higher score.');
            }
            if ($tournament['format'] === 'knockout') {
                $winner = $byScore ?? $winnerId;
                if ($winner === null) {
                    Validation::fail('winner_entry_id', 'Knockout matches need a winner. For a level score, send the winner_entry_id decided by the tie-break.');
                }
                if ($match['status'] === 'completed') {
                    // A corrected winner would invalidate fixtures already drawn from this round.
                    $later = $db->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = ? AND round_no > ? AND status <> 'cancelled'");
                    $later->execute([$match['tournament_id'], $match['round_no']]);
                    if ((int) $later->fetchColumn() > 0 && $winner !== (int) $match['winner_entry_id']) {
                        throw new ApiException(409, 'result_locked', 'A later round has been drawn from this result. Cancel those fixtures before changing the winner.');
                    }
                }
            } else {
                if ($winnerId !== null && $byScore === null) {
                    Validation::fail('winner_entry_id', 'A level league match is a draw and has no winner.');
                }
                $winner = $byScore;
            }
            $db->prepare("UPDATE matches SET status = 'completed', home_score = ?, away_score = ?, winner_entry_id = ?, result_notes = ?, result_recorded_by = ?, result_recorded_at = UTC_TIMESTAMP() WHERE id = ?")
                ->execute([$homeScore, $awayScore, $winner, $notes, (int) $actor['id'], $id]);
        });
        return self::publicMatch(self::load($id));
    }

    // League: a full single round-robin. Knockout: the next round from the entries still in the competition.
    public static function generateFixtures(array $actor, int $tournamentId): array
    {
        $ids = Database::transaction(function (PDO $db) use ($actor, $tournamentId): array {
            $tournament = TournamentService::visible($actor, $tournamentId, true);
            self::requireFixtureState($tournament);
            $entries = self::approvedEntryIds($db, $tournamentId);
            if (count($entries) < 2) {
                throw new ApiException(409, 'not_enough_entries', 'At least two approved entries are needed to generate fixtures.');
            }
            $pairs = $tournament['format'] === 'league'
                ? self::roundRobin($db, $tournamentId, $entries)
                : self::nextKnockoutRound($db, $tournamentId, $entries);
            $insert = $db->prepare('INSERT INTO matches (tournament_id, round_no, home_entry_id, away_entry_id, created_by) VALUES (?, ?, ?, ?, ?)');
            $created = [];
            foreach ($pairs as [$round, $home, $away]) {
                $insert->execute([$tournamentId, $round, $home, $away, (int) $actor['id']]);
                $created[] = (int) $db->lastInsertId();
            }
            return $created;
        });
        $statement = Database::get()->prepare(self::SELECT . ' WHERE m.id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY m.round_no, m.id');
        $statement->execute($ids);
        return array_map([self::class, 'publicMatch'], $statement->fetchAll());
    }

    public static function standings(array $actor, int $tournamentId): array
    {
        $tournament = TournamentService::visible($actor, $tournamentId);
        $db = Database::get();
        $entries = $db->prepare("SELECT id, name FROM tournament_entries WHERE tournament_id = ? AND status = 'approved' ORDER BY id");
        $entries->execute([$tournamentId]);
        $entries = $entries->fetchAll();
        if ($tournament['format'] === 'knockout') {
            return self::knockoutStandings($db, $tournament, $entries);
        }
        $table = [];
        foreach ($entries as $entry) {
            $table[(int) $entry['id']] = [
                'entry_id' => (int) $entry['id'], 'name' => $entry['name'], 'played' => 0, 'won' => 0, 'drawn' => 0, 'lost' => 0,
                'score_for' => 0, 'score_against' => 0, 'score_difference' => 0, 'points' => 0,
            ];
        }
        $matches = $db->prepare("SELECT home_entry_id, away_entry_id, home_score, away_score FROM matches WHERE tournament_id = ? AND status = 'completed'");
        $matches->execute([$tournamentId]);
        foreach ($matches->fetchAll() as $match) {
            foreach ([['home', 'away'], ['away', 'home']] as [$side, $other]) {
                $id = (int) $match[$side . '_entry_id'];
                if (!isset($table[$id])) {
                    continue;
                }
                $for = (int) $match[$side . '_score'];
                $against = (int) $match[$other . '_score'];
                $outcome = $for <=> $against;
                $table[$id]['played']++;
                $table[$id][match ($outcome) { 1 => 'won', 0 => 'drawn', -1 => 'lost' }]++;
                $table[$id]['score_for'] += $for;
                $table[$id]['score_against'] += $against;
                $table[$id]['points'] += (int) $tournament[match ($outcome) { 1 => 'points_win', 0 => 'points_draw', -1 => 'points_loss' }];
            }
        }
        foreach ($table as &$row) {
            $row['score_difference'] = $row['score_for'] - $row['score_against'];
        }
        unset($row);
        $table = array_values($table);
        usort($table, static fn (array $a, array $b): int => [$b['points'], $b['score_difference'], $b['score_for'], $a['name']]
            <=> [$a['points'], $a['score_difference'], $a['score_for'], $b['name']]);
        foreach ($table as $index => &$row) {
            $row = ['position' => $index + 1] + $row;
        }
        unset($row);
        return ['format' => 'league', 'tournament_status' => $tournament['status'], 'standings' => $table];
    }

    public static function publicMatch(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'tournament_id' => (int) $row['tournament_id'],
            'round_no' => (int) $row['round_no'],
            'home_entry_id' => (int) $row['home_entry_id'],
            'home_name' => $row['home_name'],
            'away_entry_id' => (int) $row['away_entry_id'],
            'away_name' => $row['away_name'],
            'scheduled_at' => Http::timestamp($row['scheduled_at']),
            'facility_id' => $row['facility_id'] === null ? null : (int) $row['facility_id'],
            'facility_name' => $row['facility_name'],
            'venue' => $row['venue'],
            'status' => $row['status'],
            'home_score' => $row['home_score'] === null ? null : (int) $row['home_score'],
            'away_score' => $row['away_score'] === null ? null : (int) $row['away_score'],
            'winner_entry_id' => $row['winner_entry_id'] === null ? null : (int) $row['winner_entry_id'],
            'winner_name' => $row['winner_name'],
            'result_notes' => $row['result_notes'],
            'result_recorded_by' => $row['result_recorded_by'] === null ? null : (int) $row['result_recorded_by'],
            'result_recorded_at' => Http::timestamp($row['result_recorded_at']),
            'created_at' => Http::timestamp($row['created_at']),
            'updated_at' => Http::timestamp($row['updated_at']),
        ];
    }

    private static function knockoutStandings(PDO $db, array $tournament, array $entries): array
    {
        $statement = $db->prepare(self::SELECT . " WHERE m.tournament_id = ? AND m.status <> 'cancelled' ORDER BY m.round_no, m.id");
        $statement->execute([$tournament['id']]);
        $rounds = [];
        $open = false;
        foreach ($statement->fetchAll() as $match) {
            $rounds[(int) $match['round_no']][] = self::publicMatch($match);
            $open = $open || $match['status'] !== 'completed';
        }
        $remaining = self::remainingEntryIds($db, (int) $tournament['id'], array_map(static fn (array $entry): int => (int) $entry['id'], $entries));
        $champion = null;
        if ($rounds !== [] && !$open && count($remaining) === 1) {
            foreach ($entries as $entry) {
                if ((int) $entry['id'] === $remaining[0]) {
                    $champion = ['entry_id' => (int) $entry['id'], 'name' => $entry['name']];
                }
            }
        }
        return [
            'format' => 'knockout',
            'tournament_status' => $tournament['status'],
            'rounds' => array_map(static fn (int $round, array $matches): array => ['round_no' => $round, 'matches' => $matches], array_keys($rounds), $rounds),
            'remaining_entry_ids' => $remaining,
            'champion' => $champion,
        ];
    }

    // Circle method: one entry stays fixed while the rest rotate; an odd field gets a bye slot each round.
    private static function roundRobin(PDO $db, int $tournamentId, array $entries): array
    {
        $existing = $db->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = ? AND status <> 'cancelled'");
        $existing->execute([$tournamentId]);
        if ((int) $existing->fetchColumn() > 0) {
            throw new ApiException(409, 'fixtures_exist', 'This league already has fixtures. Cancel them before generating a new schedule.');
        }
        if (count($entries) % 2 === 1) {
            $entries[] = null;
        }
        $count = count($entries);
        $pairs = [];
        for ($round = 1; $round < $count; $round++) {
            for ($index = 0; $index < $count / 2; $index++) {
                $home = $entries[$index];
                $away = $entries[$count - 1 - $index];
                if ($home === null || $away === null) {
                    continue;
                }
                // Alternate the fixed entry between home and away.
                $pairs[] = $index === 0 && $round % 2 === 0 ? [$round, $away, $home] : [$round, $home, $away];
            }
            $entries = [$entries[0], $entries[$count - 1], ...array_slice($entries, 1, $count - 2)];
        }
        return $pairs;
    }

    // Byes bring the field down to a power of two, so only the first generated round can contain byes.
    private static function nextKnockoutRound(PDO $db, int $tournamentId, array $entries): array
    {
        $latest = $db->prepare("SELECT MAX(round_no) FROM matches WHERE tournament_id = ? AND status <> 'cancelled'");
        $latest->execute([$tournamentId]);
        $latest = (int) $latest->fetchColumn();
        if ($latest > 0) {
            $open = $db->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = ? AND round_no = ? AND status IN ('scheduled', 'postponed')");
            $open->execute([$tournamentId, $latest]);
            if ((int) $open->fetchColumn() > 0) {
                throw new ApiException(409, 'round_incomplete', 'Record every result in round ' . $latest . ' before drawing the next round.');
            }
        }
        $remaining = self::remainingEntryIds($db, $tournamentId, $entries);
        if (count($remaining) < 2) {
            throw new ApiException(409, 'tournament_decided', 'The knockout already has a winner.');
        }
        $size = 1;
        while ($size < count($remaining)) {
            $size *= 2;
        }
        $playing = array_slice($remaining, $size - count($remaining));
        $pairs = [];
        for ($index = 0; $index < count($playing); $index += 2) {
            $pairs[] = [$latest + 1, $playing[$index], $playing[$index + 1]];
        }
        return $pairs;
    }

    // Approved entries that have not lost a completed match.
    private static function remainingEntryIds(PDO $db, int $tournamentId, array $entries): array
    {
        $losers = $db->prepare(
            "SELECT CASE WHEN winner_entry_id = home_entry_id THEN away_entry_id ELSE home_entry_id END
             FROM matches WHERE tournament_id = ? AND status = 'completed' AND winner_entry_id IS NOT NULL"
        );
        $losers->execute([$tournamentId]);
        return array_values(array_diff($entries, array_map('intval', $losers->fetchAll(PDO::FETCH_COLUMN))));
    }

    private static function approvedEntryIds(PDO $db, int $tournamentId): array
    {
        $statement = $db->prepare("SELECT id FROM tournament_entries WHERE tournament_id = ? AND status = 'approved' ORDER BY id");
        $statement->execute([$tournamentId]);
        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    // Locks the match's tournament, then the match, matching the order used by every fixture write.
    private static function lock(array $actor, int $id): array
    {
        $lookup = Database::get()->prepare('SELECT tournament_id FROM matches WHERE id = ?');
        $lookup->execute([$id]);
        $tournamentId = $lookup->fetchColumn();
        if ($tournamentId === false) {
            throw new ApiException(404, 'not_found', 'This match could not be found.');
        }
        $tournament = TournamentService::visible($actor, (int) $tournamentId, true);
        $match = Database::get()->prepare('SELECT * FROM matches WHERE id = ? FOR UPDATE');
        $match->execute([$id]);
        return [$tournament, $match->fetch()];
    }

    private static function load(int $id): array
    {
        $statement = Database::get()->prepare(self::SELECT . ' WHERE m.id = ?');
        $statement->execute([$id]);
        return $statement->fetch() ?: throw new ApiException(404, 'not_found', 'This match could not be found.');
    }

    private static function requireFixtureState(array $tournament): void
    {
        if (!in_array($tournament['status'], self::FIXTURE_STATES, true)) {
            throw new ApiException(409, 'fixtures_locked', 'Fixtures can only be arranged after registration closes and before the tournament ends.');
        }
    }

    private static function requireApprovedEntry(PDO $db, int $tournamentId, int $entryId, string $field): void
    {
        $statement = $db->prepare("SELECT 1 FROM tournament_entries WHERE id = ? AND tournament_id = ? AND status = 'approved'");
        $statement->execute([$entryId, $tournamentId]);
        if ($statement->fetchColumn() === false) {
            Validation::fail($field, 'Choose an approved entry of this tournament.');
        }
    }

    private static function requireFacility(?int $facilityId): void
    {
        if ($facilityId === null) {
            return;
        }
        $statement = Database::get()->prepare('SELECT 1 FROM facilities WHERE id = ? AND is_active = 1');
        $statement->execute([$facilityId]);
        if ($statement->fetchColumn() === false) {
            Validation::fail('facility_id', 'Choose an active facility.');
        }
    }

    // An entry plays at most one live match per round.
    private static function requireFreeInRound(PDO $db, int $tournamentId, int $round, array $entryIds, ?int $exceptMatchId): void
    {
        $statement = $db->prepare(
            "SELECT COUNT(*) FROM matches WHERE tournament_id = ? AND round_no = ? AND status <> 'cancelled' AND id <> ?
             AND (home_entry_id IN (?, ?) OR away_entry_id IN (?, ?))"
        );
        $statement->execute([$tournamentId, $round, $exceptMatchId ?? 0, ...$entryIds, ...$entryIds]);
        if ((int) $statement->fetchColumn() > 0) {
            throw new ApiException(409, 'entry_already_scheduled', 'One of these entries already has a match in round ' . $round . '.');
        }
    }
}
