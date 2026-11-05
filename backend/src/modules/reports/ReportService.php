<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

final class ReportService
{
    // One row per attendance record, entry member, or completed match/entry member.
    // Entry approval is registration, not proof that a person attended a match.
    private const SOURCE = <<<'SQL'
        SELECT 'training' AS type, a.id AS source_id, a.participant_id AS user_id,
            c.sport_id, s.title AS activity, c.name AS context, s.session_date AS activity_date,
            a.status, s.status AS activity_status
        FROM training_attendance a JOIN training_sessions s ON s.id = a.session_id JOIN clubs c ON c.id = s.club_id
        UNION ALL
        SELECT 'tournament', e.id, em.user_id, t.sport_id, t.name, e.name, t.starts_on, e.status, t.status
        FROM tournament_entry_members em JOIN tournament_entries e ON e.id = em.entry_id JOIN tournaments t ON t.id = e.tournament_id
        UNION ALL
        SELECT 'match', m.id, em.user_id, t.sport_id, t.name, CONCAT(h.name, ' vs ', aw.name),
            DATE(COALESCE(m.scheduled_at, m.result_recorded_at)),
            CASE WHEN m.winner_entry_id IS NULL THEN 'draw' WHEN m.winner_entry_id = em.entry_id THEN 'win' ELSE 'loss' END,
            m.status
        FROM matches m JOIN tournaments t ON t.id = m.tournament_id
        JOIN tournament_entries h ON h.id = m.home_entry_id JOIN tournament_entries aw ON aw.id = m.away_entry_id
        JOIN tournament_entry_members em ON em.entry_id IN (m.home_entry_id, m.away_entry_id)
        WHERE m.status = 'completed'
        SQL;

    public static function listing(array $filters, int $page, int $perPage): array
    {
        $clauses = [];
        $parameters = [];
        foreach (['type', 'status', 'sport_id', 'user_id'] as $field) {
            if ($filters[$field] !== null) {
                $clauses[] = "r.$field = ?";
                $parameters[] = $filters[$field];
            }
        }
        foreach (['from' => '>=', 'to' => '<='] as $field => $operator) {
            if ($filters[$field] !== null) {
                $clauses[] = "r.activity_date $operator ?";
                $parameters[] = $filters[$field];
            }
        }
        $from = ' FROM (' . self::SOURCE . ') r JOIN users u ON u.id = r.user_id JOIN sports sp ON sp.id = r.sport_id'
            . ($clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses));
        // Same snapshot for rows and totals, even if results change during the request.
        return Database::transaction(function (PDO $db) use ($from, $parameters, $filters, $page, $perPage): array {
            $totals = $db->prepare("SELECT COUNT(*) AS total_records, COUNT(DISTINCT r.user_id) AS participants,
                COALESCE(SUM(r.type = 'training' AND r.status IN ('present', 'late') AND r.activity_status <> 'cancelled'), 0) AS training_attended,
                COALESCE(SUM(r.type = 'tournament' AND r.status = 'approved' AND r.activity_status <> 'cancelled'), 0) AS approved_entries,
                COALESCE(SUM(r.type = 'match'), 0) AS matches_played,
                COALESCE(SUM(r.type = 'match' AND r.status = 'win'), 0) AS wins,
                COALESCE(SUM(r.type = 'match' AND r.status = 'draw'), 0) AS draws,
                COALESCE(SUM(r.type = 'match' AND r.status = 'loss'), 0) AS losses" . $from);
            $totals->execute($parameters);
            $summary = array_map('intval', $totals->fetch());
            $rows = $db->prepare('SELECT r.*, u.name AS user_name, sp.name AS sport_name' . $from
                . ' ORDER BY r.activity_date DESC, r.type, r.source_id DESC, r.user_id LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage));
            $rows->execute($parameters);
            $records = array_map(static function (array $row): array {
                foreach (['source_id', 'user_id', 'sport_id'] as $field) $row[$field] = (int) $row[$field];
                return $row;
            }, $rows->fetchAll());
            return ['records' => $records, 'summary' => $summary, 'filters' => $filters,
                'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $summary['total_records'],
                    'total_pages' => (int) ceil($summary['total_records'] / $perPage)]];
        });
    }
}
