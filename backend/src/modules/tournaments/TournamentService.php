<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

// Tournaments and their entries. An entry is a team (or an individual when the team size is 1)
// whose members all hold approved memberships in a club of the tournament's sport.
final class TournamentService
{
    public const STATUSES = ['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled'];
    public const FORMATS = ['league', 'knockout'];
    public const ENTRY_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];
    private const TRANSITIONS = [
        'draft' => ['registration_open', 'cancelled'],
        'registration_open' => ['registration_closed', 'cancelled'],
        'registration_closed' => ['registration_open', 'in_progress', 'cancelled'],
        'in_progress' => ['completed', 'cancelled'],
        'completed' => [],
        'cancelled' => [],
    ];
    // Fields that shape entries and fixtures cannot change once registration has opened.
    private const DRAFT_ONLY = ['sport_id', 'format', 'min_team_size', 'max_team_size'];
    private const REVIEWABLE = ['registration_open', 'registration_closed'];
    private const SELECT = 'SELECT t.*, s.name AS sport_name,
            (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id AND e.status = \'approved\') AS approved_entries
        FROM tournaments t JOIN sports s ON s.id = t.sport_id';

    public static function list(array $actor, array $query): array
    {
        $clauses = [];
        $parameters = [];
        if (!MembershipService::isAdmin($actor)) {
            $clauses[] = "t.status <> 'draft'";
        }
        foreach (['status' => self::STATUSES, 'format' => self::FORMATS] as $field => $choices) {
            $value = Validation::queryChoice($query, $field, $choices);
            if ($value !== null) {
                $clauses[] = 't.' . $field . ' = ?';
                $parameters[] = $value;
            }
        }
        $sport = Validation::queryId($query, 'sport_id');
        if ($sport !== null) {
            $clauses[] = 't.sport_id = ?';
            $parameters[] = $sport;
        }
        $where = $clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses);
        $statement = Database::get()->prepare(self::SELECT . $where . ' ORDER BY t.starts_on DESC, t.id DESC');
        $statement->execute($parameters);
        return array_map([self::class, 'publicTournament'], $statement->fetchAll());
    }

    public static function find(array $actor, int $id): array
    {
        return self::publicTournament(self::visible($actor, $id));
    }

    // Drafts are visible to Admins only; everything else is visible to any signed-in user.
    public static function visible(array $actor, int $id, bool $lock = false): array
    {
        if ($lock) {
            // Lock the tournament row alone; the joined sport row stays unlocked.
            Database::get()->prepare('SELECT id FROM tournaments WHERE id = ? FOR UPDATE')->execute([$id]);
        }
        $statement = Database::get()->prepare(self::SELECT . ' WHERE t.id = ?');
        $statement->execute([$id]);
        $row = $statement->fetch();
        if ($row === false || ($row['status'] === 'draft' && !MembershipService::isAdmin($actor))) {
            throw new ApiException(404, 'not_found', 'This tournament could not be found.');
        }
        return $row;
    }

    public static function create(array $actor, array $fields): array
    {
        $fields += ['min_team_size' => 1, 'max_team_size' => 1, 'points_win' => 3, 'points_draw' => 1, 'points_loss' => 0];
        self::checkConsistency($fields);
        self::requireActiveSport($fields['sport_id']);
        $fields['created_by'] = (int) $actor['id'];
        $columns = array_keys($fields);
        try {
            $db = Database::get();
            $db->prepare('INSERT INTO tournaments (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')')
                ->execute(array_values($fields));
        } catch (\PDOException $exception) {
            throw Database::isDuplicateKey($exception) ? self::duplicateName() : $exception;
        }
        return self::find($actor, (int) $db->lastInsertId());
    }

    public static function update(array $actor, int $id, array $changes): array
    {
        try {
            Database::transaction(function (PDO $db) use ($actor, $id, $changes): void {
                $tournament = self::visible($actor, $id, true);
                $from = $tournament['status'];
                if (self::TRANSITIONS[$from] === []) {
                    throw new ApiException(409, 'tournament_closed', 'A ' . $from . ' tournament cannot be changed.');
                }
                if ($from !== 'draft' && array_intersect(array_keys($changes), self::DRAFT_ONLY) !== []) {
                    throw new ApiException(409, 'tournament_locked', 'Sport, format and team sizes can only change while the tournament is a draft.');
                }
                $merged = array_merge($tournament, $changes);
                self::checkConsistency($merged);
                if (isset($changes['sport_id'])) {
                    self::requireActiveSport($changes['sport_id']);
                }
                if ($merged['max_entries'] !== null && (int) $merged['max_entries'] < (int) $tournament['approved_entries']) {
                    throw new ApiException(409, 'tournament_full', 'max_entries cannot be below the number of approved entries.');
                }
                if (isset($changes['status']) && $changes['status'] !== $from) {
                    self::checkTransition($db, $tournament, $changes['status']);
                }
                if ($changes !== []) {
                    $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($changes)));
                    $db->prepare('UPDATE tournaments SET ' . $assignments . ' WHERE id = ?')->execute([...array_values($changes), $id]);
                }
            });
        } catch (\PDOException $exception) {
            throw Database::isDuplicateKey($exception) ? self::duplicateName() : $exception;
        }
        return self::find($actor, $id);
    }

    public static function cancel(array $actor, int $id): void
    {
        self::update($actor, $id, ['status' => 'cancelled']);
    }

    public static function listEntries(array $actor, int $tournamentId): array
    {
        $tournament = self::visible($actor, $tournamentId);
        $entries = self::entries('e.tournament_id = ?', [$tournamentId]);
        if (!self::canReviewEntries($actor, $tournament)) {
            // Other users see approved entries plus the entries they belong to.
            $actorId = (int) $actor['id'];
            $entries = array_values(array_filter($entries, static fn (array $entry): bool => $entry['status'] === 'approved'
                || $entry['captain_user_id'] === $actorId
                || in_array($actorId, array_column($entry['members'], 'user_id'), true)));
        }
        return $entries;
    }

    public static function findEntry(array $actor, int $entryId): array
    {
        $entries = self::entries('e.id = ?', [$entryId]);
        if ($entries === []) {
            throw new ApiException(404, 'not_found', 'This entry could not be found.');
        }
        $entry = $entries[0];
        $tournament = self::visible($actor, $entry['tournament_id']);
        $actorId = (int) $actor['id'];
        if ($entry['status'] !== 'approved' && !self::canReviewEntries($actor, $tournament)
            && !in_array($actorId, array_column($entry['members'], 'user_id'), true)) {
            throw new ApiException(404, 'not_found', 'This entry could not be found.');
        }
        return $entry;
    }

    // Users who could be named as entry members: approved members of a club in the tournament's sport
    // who are not already in a pending or approved entry of this tournament.
    public static function eligibleMembers(array $actor, int $tournamentId): array
    {
        $tournament = self::visible($actor, $tournamentId);
        $statement = Database::get()->prepare(
            "SELECT u.id, u.name, GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') AS clubs
             FROM users u
             JOIN memberships m ON m.user_id = u.id AND m.status = 'approved'
             JOIN clubs c ON c.id = m.club_id AND c.is_archived = 0 AND c.sport_id = ?
             WHERE u.status = 'active' AND u.deleted_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM tournament_entry_members tm WHERE tm.tournament_id = ? AND tm.user_id = u.id AND tm.active_flag = 1)
             GROUP BY u.id, u.name ORDER BY u.name"
        );
        $statement->execute([$tournament['sport_id'], $tournamentId]);
        return array_map(static fn (array $row): array => ['user_id' => (int) $row['id'], 'name' => $row['name'], 'clubs' => $row['clubs']], $statement->fetchAll());
    }

    public static function createEntry(array $actor, int $tournamentId, string $name, array $memberIds): array
    {
        $actorId = (int) $actor['id'];
        if (!in_array($actorId, $memberIds, true)) {
            Validation::fail('member_ids', 'The captain must be one of the entry members.');
        }
        try {
            $id = Database::transaction(function (PDO $db) use ($actor, $actorId, $tournamentId, $name, $memberIds): int {
                $tournament = self::visible($actor, $tournamentId, true);
                if ($tournament['status'] !== 'registration_open') {
                    throw new ApiException(409, 'registration_closed', 'This tournament is not open for registration.');
                }
                if ($tournament['registration_closes_at'] !== null && $tournament['registration_closes_at'] <= gmdate('Y-m-d H:i:s')) {
                    throw new ApiException(409, 'registration_closed', 'The registration deadline for this tournament has passed.');
                }
                if ($tournament['max_entries'] !== null && (int) $tournament['approved_entries'] >= (int) $tournament['max_entries']) {
                    throw new ApiException(409, 'tournament_full', 'This tournament has no remaining entry places.');
                }
                $count = count($memberIds);
                if ($count < (int) $tournament['min_team_size'] || $count > (int) $tournament['max_team_size']) {
                    Validation::fail('member_ids', 'Name ' . $tournament['min_team_size'] . '–' . $tournament['max_team_size'] . ' members.');
                }
                $ineligible = array_diff($memberIds, self::eligibleUserIds($db, (int) $tournament['sport_id'], $memberIds));
                if ($ineligible !== []) {
                    Validation::fail('member_ids', 'Every member must be an active user with an approved membership in a ' . $tournament['sport_name'] . ' club. Ineligible user ids: ' . implode(', ', $ineligible) . '.');
                }
                $placeholders = implode(',', array_fill(0, $count, '?'));
                $taken = $db->prepare('SELECT user_id FROM tournament_entry_members WHERE tournament_id = ? AND active_flag = 1 AND user_id IN (' . $placeholders . ')');
                $taken->execute([$tournamentId, ...$memberIds]);
                $taken = $taken->fetchAll(PDO::FETCH_COLUMN);
                if ($taken !== []) {
                    throw new ApiException(409, 'already_entered', 'These users are already in another entry of this tournament: ' . implode(', ', $taken) . '.');
                }
                $db->prepare('INSERT INTO tournament_entries (tournament_id, name, captain_user_id) VALUES (?, ?, ?)')->execute([$tournamentId, $name, $actorId]);
                $entryId = (int) $db->lastInsertId();
                $insert = $db->prepare('INSERT INTO tournament_entry_members (tournament_id, entry_id, user_id) VALUES (?, ?, ?)');
                foreach ($memberIds as $memberId) {
                    $insert->execute([$tournamentId, $entryId, $memberId]);
                }
                return $entryId;
            });
        } catch (\PDOException $exception) {
            if (Database::isDuplicateKey($exception)) {
                throw new ApiException(409, 'duplicate_entry', 'An active entry with this name exists, or a member is already entered.');
            }
            throw $exception;
        }
        return self::findEntry($actor, $id);
    }

    public static function changeEntryStatus(array $actor, int $entryId, string $status, ?string $note): array
    {
        $actorId = (int) $actor['id'];
        $lookup = Database::get()->prepare('SELECT tournament_id FROM tournament_entries WHERE id = ?');
        $lookup->execute([$entryId]);
        $tournamentId = $lookup->fetchColumn();
        if ($tournamentId === false) {
            throw new ApiException(404, 'not_found', 'This entry could not be found.');
        }
        Database::transaction(function (PDO $db) use ($actor, $actorId, $entryId, $tournamentId, $status, $note): void {
            // Same lock order as createEntry: tournament first, then the entry.
            $tournament = self::visible($actor, (int) $tournamentId, true);
            $db->prepare('SELECT id FROM tournament_entries WHERE id = ? FOR UPDATE')->execute([$entryId]);
            $entry = self::findEntry($actor, $entryId);
            $from = $entry['status'];
            if (!in_array($tournament['status'], self::REVIEWABLE, true)) {
                throw new ApiException(409, 'registration_closed', 'Entries can only change before the tournament starts.');
            }
            if ($status === 'withdrawn') {
                if ($entry['captain_user_id'] !== $actorId) {
                    throw new ApiException(403, 'forbidden', 'Only the captain can withdraw an entry.');
                }
                self::requireEntryFrom($from, ['pending', 'approved'], $status);
                $scheduled = $db->prepare("SELECT COUNT(*) FROM matches WHERE status <> 'cancelled' AND (home_entry_id = ? OR away_entry_id = ?)");
                $scheduled->execute([$entryId, $entryId]);
                if ((int) $scheduled->fetchColumn() > 0) {
                    throw new ApiException(409, 'entry_scheduled', 'This entry has fixtures. Ask an Admin to cancel them first.');
                }
                $db->prepare("UPDATE tournament_entries SET status = 'withdrawn' WHERE id = ?")->execute([$entryId]);
            } else {
                if (!self::canReviewEntries($actor, $tournament)) {
                    throw new ApiException(403, 'forbidden', 'Only an Admin or a coach of this sport can review entries.');
                }
                if (in_array($actorId, array_column($entry['members'], 'user_id'), true)) {
                    throw new ApiException(403, 'self_review', 'You cannot review an entry you belong to.');
                }
                self::requireEntryFrom($from, ['pending'], $status);
                if ($status === 'approved') {
                    if ($tournament['max_entries'] !== null && (int) $tournament['approved_entries'] >= (int) $tournament['max_entries']) {
                        throw new ApiException(409, 'tournament_full', 'This tournament has no remaining entry places.');
                    }
                    $memberIds = array_column($entry['members'], 'user_id');
                    if (array_diff($memberIds, self::eligibleUserIds($db, (int) $tournament['sport_id'], $memberIds)) !== []) {
                        throw new ApiException(409, 'member_ineligible', 'A member of this entry no longer holds an approved membership in a club of this sport.');
                    }
                }
                $db->prepare('UPDATE tournament_entries SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?')
                    ->execute([$status, $note, $actorId, $entryId]);
            }
            if ($status !== 'approved') {
                // Release the members so they can join another entry of this tournament.
                $db->prepare('UPDATE tournament_entry_members SET active_flag = NULL WHERE entry_id = ?')->execute([$entryId]);
            }
        });
        return self::findEntry($actor, $entryId);
    }

    public static function publicTournament(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'sport_id' => (int) $row['sport_id'],
            'sport_name' => $row['sport_name'],
            'name' => $row['name'],
            'description' => $row['description'],
            'format' => $row['format'],
            'status' => $row['status'],
            'starts_on' => $row['starts_on'],
            'ends_on' => $row['ends_on'],
            'registration_closes_at' => Http::timestamp($row['registration_closes_at']),
            'max_entries' => $row['max_entries'] === null ? null : (int) $row['max_entries'],
            'min_team_size' => (int) $row['min_team_size'],
            'max_team_size' => (int) $row['max_team_size'],
            'points_win' => (int) $row['points_win'],
            'points_draw' => (int) $row['points_draw'],
            'points_loss' => (int) $row['points_loss'],
            'approved_entries' => (int) $row['approved_entries'],
            'created_by' => (int) $row['created_by'],
            'created_at' => Http::timestamp($row['created_at']),
            'updated_at' => Http::timestamp($row['updated_at']),
        ];
    }

    // Admins review every entry; coaches review entries for the sports of the clubs they coach.
    public static function canReviewEntries(array $actor, array $tournament): bool
    {
        return MembershipService::isAdmin($actor)
            || in_array((int) $tournament['sport_id'], MembershipService::coachedSportIds((int) $actor['id']), true);
    }

    private static function entries(string $where, array $parameters): array
    {
        $statement = Database::get()->prepare(
            'SELECT e.*, u.name AS captain_name FROM tournament_entries e JOIN users u ON u.id = e.captain_user_id
             WHERE ' . $where . ' ORDER BY e.created_at, e.id'
        );
        $statement->execute($parameters);
        $rows = $statement->fetchAll();
        if ($rows === []) {
            return [];
        }
        $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
        $members = Database::get()->prepare(
            'SELECT tm.entry_id, tm.user_id, u.name FROM tournament_entry_members tm JOIN users u ON u.id = tm.user_id
             WHERE tm.entry_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY u.name'
        );
        $members->execute($ids);
        $byEntry = [];
        foreach ($members->fetchAll() as $member) {
            $byEntry[(int) $member['entry_id']][] = ['user_id' => (int) $member['user_id'], 'name' => $member['name']];
        }
        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'tournament_id' => (int) $row['tournament_id'],
            'name' => $row['name'],
            'captain_user_id' => (int) $row['captain_user_id'],
            'captain_name' => $row['captain_name'],
            'status' => $row['status'],
            'review_note' => $row['review_note'],
            'reviewed_by' => $row['reviewed_by'] === null ? null : (int) $row['reviewed_by'],
            'reviewed_at' => Http::timestamp($row['reviewed_at']),
            'members' => $byEntry[(int) $row['id']] ?? [],
            'created_at' => Http::timestamp($row['created_at']),
            'updated_at' => Http::timestamp($row['updated_at']),
        ], $rows);
    }

    // Subset of $userIds that are active users with an approved membership in a non-archived club of the sport.
    private static function eligibleUserIds(PDO $db, int $sportId, array $userIds): array
    {
        $statement = $db->prepare(
            "SELECT DISTINCT u.id FROM users u
             JOIN memberships m ON m.user_id = u.id AND m.status = 'approved'
             JOIN clubs c ON c.id = m.club_id AND c.is_archived = 0 AND c.sport_id = ?
             WHERE u.status = 'active' AND u.deleted_at IS NULL AND u.id IN (" . implode(',', array_fill(0, count($userIds), '?')) . ')'
        );
        $statement->execute([$sportId, ...$userIds]);
        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    private static function checkConsistency(array $fields): void
    {
        if ($fields['ends_on'] < $fields['starts_on']) {
            Validation::fail('ends_on', 'The end date must be on or after the start date.');
        }
        if ((int) $fields['max_team_size'] < (int) $fields['min_team_size']) {
            Validation::fail('max_team_size', 'The maximum team size must be at least the minimum team size.');
        }
        if (!((int) $fields['points_win'] >= (int) $fields['points_draw'] && (int) $fields['points_draw'] >= (int) $fields['points_loss'])) {
            Validation::fail('points_win', 'Points must satisfy win ≥ draw ≥ loss.');
        }
    }

    private static function checkTransition(PDO $db, array $tournament, string $to): void
    {
        $from = $tournament['status'];
        if (!in_array($to, self::TRANSITIONS[$from], true)) {
            throw new ApiException(409, 'invalid_transition', 'A ' . $from . ' tournament cannot become ' . $to . '.');
        }
        if ($to === 'in_progress' && (int) $tournament['approved_entries'] < 2) {
            throw new ApiException(409, 'not_enough_entries', 'At least two approved entries are needed to start the tournament.');
        }
        if ($to === 'completed') {
            $open = $db->prepare("SELECT COUNT(*) FROM matches WHERE tournament_id = ? AND status IN ('scheduled', 'postponed')");
            $open->execute([$tournament['id']]);
            if ((int) $open->fetchColumn() > 0) {
                throw new ApiException(409, 'matches_outstanding', 'Complete or cancel every scheduled match before completing the tournament.');
            }
        }
    }

    private static function requireEntryFrom(string $from, array $allowed, string $to): void
    {
        if (!in_array($from, $allowed, true)) {
            throw new ApiException(409, 'invalid_transition', 'A ' . $from . ' entry cannot become ' . $to . '.');
        }
    }

    private static function requireActiveSport(int $sportId): void
    {
        $statement = Database::get()->prepare('SELECT 1 FROM sports WHERE id = ? AND is_active = 1');
        $statement->execute([$sportId]);
        if ($statement->fetchColumn() === false) {
            Validation::fail('sport_id', 'Choose an active sport.');
        }
    }

    private static function duplicateName(): ApiException
    {
        return new ApiException(409, 'duplicate_name', 'A tournament with this name already exists.');
    }
}
