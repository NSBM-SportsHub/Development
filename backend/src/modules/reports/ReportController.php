<?php
declare(strict_types=1);

namespace SportsHub;

final class ReportController
{
    public static function listing(bool $admin, array $query, array $actor): array
    {
        if ($admin) Session::requireAdmin();
        Validation::allowed($query, $admin
            ? ['page', 'per_page', 'type', 'status', 'from', 'to', 'sport_id', 'user_id']
            : ['page', 'per_page', 'type', 'status', 'from', 'to', 'sport_id']);
        $filters = [
            'type' => Validation::queryChoice($query, 'type', ['training', 'tournament', 'match']),
            'status' => Validation::queryChoice($query, 'status', ['present', 'late', 'absent', 'excused', 'pending', 'approved', 'rejected', 'withdrawn', 'win', 'draw', 'loss']),
            'sport_id' => Validation::queryId($query, 'sport_id'),
            'user_id' => $admin ? Validation::queryId($query, 'user_id') : (int) $actor['id'],
        ];
        foreach (['from', 'to'] as $field) {
            $filters[$field] = !isset($query[$field]) || $query[$field] === '' ? null : Validation::date($query[$field], $field);
        }
        if ($filters['from'] !== null && $filters['to'] !== null && $filters['from'] > $filters['to']) {
            Validation::fail('to', 'The end date must be on or after the start date.');
        }
        $page = Validation::positiveInteger($query['page'] ?? null, 'page', 1, 1000000);
        $perPage = Validation::positiveInteger($query['per_page'] ?? null, 'per_page', 20, 100);
        return ReportService::listing($filters, $page, $perPage);
    }
}
