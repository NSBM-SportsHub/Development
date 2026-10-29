<?php
declare(strict_types=1);

namespace SportsHub;

// Routes: tournaments, tournaments/{id}, tournaments/{id}/entries, tournaments/{id}/eligible-members,
// tournament-entries/{id}. See docs/competitions-api.md.
final class TournamentController
{
    private const FIELDS = [
        'sport_id', 'name', 'description', 'format', 'starts_on', 'ends_on', 'registration_closes_at',
        'max_entries', 'min_team_size', 'max_team_size', 'points_win', 'points_draw', 'points_loss',
    ];

    public static function handle(string $route, string $method, ?int $id, array $body, array $query, array $actor): mixed
    {
        return match ($method . ' ' . $route) {
            'GET tournaments' => self::list($query, $actor),
            'POST tournaments' => self::create($body),
            'GET tournaments/{id}' => TournamentService::find($actor, $id),
            'PATCH tournaments/{id}' => self::update($id, $body),
            'DELETE tournaments/{id}' => TournamentService::cancel(Session::requireAdmin(), $id),
            'GET tournaments/{id}/entries' => TournamentService::listEntries($actor, $id),
            'POST tournaments/{id}/entries' => self::createEntry($id, $body, $actor),
            'GET tournaments/{id}/eligible-members' => TournamentService::eligibleMembers($actor, $id),
            'GET tournament-entries/{id}' => TournamentService::findEntry($actor, $id),
            'PATCH tournament-entries/{id}' => self::changeEntry($id, $body, $actor),
        };
    }

    private static function list(array $query, array $actor): array
    {
        Validation::allowed($query, ['status', 'format', 'sport_id']);
        return TournamentService::list($actor, $query);
    }

    private static function create(array $body): array
    {
        $actor = Session::requireAdmin();
        Validation::allowed($body, self::FIELDS);
        foreach (['sport_id', 'name', 'format', 'starts_on', 'ends_on'] as $field) {
            if (!array_key_exists($field, $body)) {
                Validation::fail($field, 'This field is required.');
            }
        }
        return TournamentService::create($actor, self::fields($body));
    }

    private static function update(int $id, array $body): array
    {
        $actor = Session::requireAdmin();
        Validation::allowed($body, [...self::FIELDS, 'status']);
        $changes = self::fields($body);
        if (array_key_exists('status', $body)) {
            $changes['status'] = Validation::choice($body['status'], 'status', TournamentService::STATUSES);
        }
        if ($changes === []) {
            throw new ApiException(422, 'validation_failed', 'Send at least one field to change.');
        }
        return TournamentService::update($actor, $id, $changes);
    }

    // Validates the submitted subset of tournament fields; absent fields are left out.
    private static function fields(array $body): array
    {
        $fields = [];
        foreach ($body as $field => $value) {
            $fields[$field] = match ($field) {
                'sport_id' => Validation::id($value, $field),
                'name' => Validation::text($body, $field, 150),
                'description' => Validation::text($body, $field, 5000, false),
                'format' => Validation::choice($value, $field, TournamentService::FORMATS),
                'starts_on', 'ends_on' => Validation::date($value, $field),
                'registration_closes_at' => $value === null ? null : Validation::dateTime($value, $field),
                'max_entries' => $value === null ? null : Validation::integer($value, $field, 2, 1000),
                'min_team_size', 'max_team_size' => Validation::integer($value, $field, 1, 100),
                'points_win', 'points_draw', 'points_loss' => Validation::integer($value, $field, 0, 20),
                default => null,
            };
        }
        unset($fields['status']);
        return $fields;
    }

    private static function createEntry(int $tournamentId, array $body, array $actor): array
    {
        Validation::allowed($body, ['name', 'member_ids']);
        $name = Validation::text($body, 'name', 120);
        // Without member_ids the captain enters alone (individual events).
        $memberIds = $body['member_ids'] ?? [(int) $actor['id']];
        if (!is_array($memberIds) || !array_is_list($memberIds) || $memberIds === [] || count($memberIds) > 100) {
            Validation::fail('member_ids', 'Send a list of 1–100 user ids.');
        }
        foreach ($memberIds as $memberId) {
            Validation::id($memberId, 'member_ids');
        }
        if (count(array_unique($memberIds)) !== count($memberIds)) {
            Validation::fail('member_ids', 'List each member only once.');
        }
        return TournamentService::createEntry($actor, $tournamentId, $name, $memberIds);
    }

    private static function changeEntry(int $entryId, array $body, array $actor): array
    {
        Validation::allowed($body, ['status', 'review_note']);
        return TournamentService::changeEntryStatus(
            $actor,
            $entryId,
            Validation::choice($body['status'] ?? null, 'status', ['approved', 'rejected', 'withdrawn']),
            Validation::text($body, 'review_note', 1000, false),
        );
    }
}
