<?php
declare(strict_types=1);

namespace SportsHub;

// Routes: tournaments/{id}/matches, tournaments/{id}/fixtures, tournaments/{id}/standings,
// matches/{id}, matches/{id}/result. See docs/competitions-api.md.
final class MatchController
{
    public static function handle(string $route, string $method, ?int $id, array $body, array $query, array $actor): mixed
    {
        return match ($method . ' ' . $route) {
            'GET tournaments/{id}/matches' => self::list($id, $query, $actor),
            'POST tournaments/{id}/matches' => self::create($id, $body),
            'POST tournaments/{id}/fixtures' => ResultService::generateFixtures(Session::requireAdmin(), $id),
            'GET tournaments/{id}/standings' => ResultService::standings($actor, $id),
            'GET matches/{id}' => ResultService::findMatch($actor, $id),
            'PATCH matches/{id}' => self::update($id, $body),
            'DELETE matches/{id}' => ResultService::cancelMatch(Session::requireAdmin(), $id),
            'PUT matches/{id}/result' => self::result($id, $body),
        };
    }

    private static function list(int $tournamentId, array $query, array $actor): array
    {
        Validation::allowed($query, ['status', 'round_no']);
        return ResultService::listMatches($actor, $tournamentId, $query);
    }

    private static function create(int $tournamentId, array $body): array
    {
        $actor = Session::requireAdmin();
        Validation::allowed($body, ['home_entry_id', 'away_entry_id', 'round_no', 'scheduled_at', 'facility_id', 'venue']);
        $fields = self::schedule($body);
        $fields['home_entry_id'] = Validation::id($body['home_entry_id'] ?? null, 'home_entry_id');
        $fields['away_entry_id'] = Validation::id($body['away_entry_id'] ?? null, 'away_entry_id');
        return ResultService::createMatch($actor, $tournamentId, $fields);
    }

    private static function update(int $id, array $body): array
    {
        $actor = Session::requireAdmin();
        Validation::allowed($body, ['round_no', 'scheduled_at', 'facility_id', 'venue', 'status']);
        $changes = self::schedule($body);
        if (array_key_exists('status', $body)) {
            $changes['status'] = Validation::choice($body['status'], 'status', ['scheduled', 'postponed', 'cancelled']);
        }
        if ($changes === []) {
            throw new ApiException(422, 'validation_failed', 'Send at least one field to change.');
        }
        return ResultService::updateMatch($actor, $id, $changes);
    }

    private static function result(int $id, array $body): array
    {
        $actor = Session::requireAdmin();
        Validation::allowed($body, ['home_score', 'away_score', 'winner_entry_id', 'result_notes']);
        return ResultService::recordResult(
            $actor,
            $id,
            Validation::integer($body['home_score'] ?? null, 'home_score', 0, 999),
            Validation::integer($body['away_score'] ?? null, 'away_score', 0, 999),
            ($body['winner_entry_id'] ?? null) === null ? null : Validation::id($body['winner_entry_id'], 'winner_entry_id'),
            Validation::text($body, 'result_notes', 500, false),
        );
    }

    // Validates the submitted subset of schedule fields; absent fields are left out.
    private static function schedule(array $body): array
    {
        $fields = [];
        if (array_key_exists('round_no', $body)) {
            $fields['round_no'] = Validation::integer($body['round_no'], 'round_no', 1, 1000);
        }
        if (array_key_exists('scheduled_at', $body)) {
            $fields['scheduled_at'] = $body['scheduled_at'] === null ? null : Validation::dateTime($body['scheduled_at'], 'scheduled_at');
        }
        if (array_key_exists('facility_id', $body)) {
            $fields['facility_id'] = $body['facility_id'] === null ? null : Validation::id($body['facility_id'], 'facility_id');
        }
        if (array_key_exists('venue', $body)) {
            $fields['venue'] = Validation::text($body, 'venue', 160, false);
        }
        return $fields;
    }
}
