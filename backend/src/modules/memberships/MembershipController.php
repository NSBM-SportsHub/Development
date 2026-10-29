<?php
declare(strict_types=1);

namespace SportsHub;

// Routes: memberships, memberships/{id}, club-coaches, club-coaches/{id}. See docs/memberships-api.md.
final class MembershipController
{
    public static function handle(string $route, string $method, ?int $id, array $body, array $query, array $actor): mixed
    {
        return match ($method . ' ' . $route) {
            'GET memberships' => self::list($query, $actor),
            'POST memberships' => self::apply($body, $actor),
            'GET memberships/{id}' => MembershipService::find($actor, $id),
            'PATCH memberships/{id}' => self::review($id, $body, $actor),
            'GET club-coaches' => self::listCoaches($query),
            'POST club-coaches' => self::assignCoach($body),
            'DELETE club-coaches/{id}' => MembershipService::endCoach(Session::requireAdmin(), $id),
        };
    }

    private static function list(array $query, array $actor): array
    {
        Validation::allowed($query, ['page', 'per_page', 'club_id', 'user_id', 'status']);
        return MembershipService::list($actor, $query);
    }

    private static function apply(array $body, array $actor): array
    {
        Validation::allowed($body, ['club_id', 'message']);
        return MembershipService::apply(
            $actor,
            Validation::id($body['club_id'] ?? null, 'club_id'),
            Validation::text($body, 'message', 1000, false),
        );
    }

    private static function review(int $id, array $body, array $actor): array
    {
        Validation::allowed($body, ['status', 'review_note']);
        return MembershipService::changeStatus(
            $actor,
            $id,
            Validation::choice($body['status'] ?? null, 'status', ['approved', 'rejected', 'withdrawn', 'ended']),
            Validation::text($body, 'review_note', 1000, false),
        );
    }

    private static function listCoaches(array $query): array
    {
        Validation::allowed($query, ['club_id', 'user_id']);
        return MembershipService::listCoaches($query);
    }

    private static function assignCoach(array $body): array
    {
        $actor = Session::requireAdmin();
        Validation::allowed($body, ['club_id', 'user_id']);
        return MembershipService::assignCoach(
            $actor,
            Validation::id($body['club_id'] ?? null, 'club_id'),
            Validation::id($body['user_id'] ?? null, 'user_id'),
        );
    }
}
