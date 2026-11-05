<?php
declare(strict_types=1);

namespace SportsHub;

final class NotificationController
{
    public static function handle(string $method, ?int $id, array $body, array $query, array $actor): array
    {
        if ($method === 'GET') {
            Validation::allowed($query, ['page', 'per_page', 'state']);
            return NotificationService::listing((int) $actor['id'], $query);
        }
        Validation::allowed($query, []);
        Validation::allowed($body, ['read']);
        if (($body['read'] ?? null) !== true) Validation::fail('read', 'Send true to mark this notification as read.');
        return NotificationService::markRead((int) $actor['id'], $id);
    }
}
