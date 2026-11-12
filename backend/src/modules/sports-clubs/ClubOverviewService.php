<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

// Admin-only, read-only views over existing club records. No inferred coach authorship.
final class ClubOverviewService
{
    private const ACTIVITY = <<<'SQL'
        SELECT m.club_id, 'application' AS type, m.id AS source_id, m.user_id, m.user_id AS actor_id,
            'Membership application' AS title, 'submitted' AS status, m.created_at AS occurred_at, NULL AS session_id
        FROM memberships m
        UNION ALL
        SELECT m.club_id, 'review', m.id, m.user_id, m.reviewed_by,
            'Membership review', IF(m.status = 'ended', 'approved', m.status), m.reviewed_at, NULL
        FROM memberships m WHERE m.reviewed_at IS NOT NULL
        UNION ALL
        SELECT m.club_id, 'membership_ended', m.id, m.user_id, m.ended_by,
            'Membership ended', 'ended', m.ended_at, NULL
        FROM memberships m WHERE m.ended_at IS NOT NULL
        UNION ALL
        SELECT m.club_id, 'withdrawn', m.id, m.user_id, m.user_id,
            'Application withdrawn', 'withdrawn', m.updated_at, NULL
        FROM memberships m WHERE m.status = 'withdrawn'
        UNION ALL
        SELECT cc.club_id, 'coach_assigned', cc.id, cc.user_id, cc.assigned_by,
            'Coach assigned', 'assigned', cc.created_at, NULL
        FROM club_coaches cc
        UNION ALL
        SELECT cc.club_id, 'coach_ended', cc.id, cc.user_id, cc.ended_by,
            'Coach assignment ended', 'ended', cc.ended_at, NULL
        FROM club_coaches cc WHERE cc.ended_at IS NOT NULL
        UNION ALL
        SELECT t.club_id, 'training', t.id, NULL, NULL,
            t.title, t.status, t.updated_at, t.id
        FROM training_sessions t
        UNION ALL
        SELECT t.club_id, 'attendance', a.id, a.participant_id, NULL,
            CONCAT('Attendance: ', t.title), a.status, a.recorded_at, t.id
        FROM training_attendance a JOIN training_sessions t ON t.id = a.session_id
        SQL;

    public static function overview(int $clubId, array $query): array
    {
        Validation::allowed($query, ['members_page', 'coaches_page', 'activity_page', 'per_page', 'activity_user_id']);
        $perPage = Validation::positiveInteger($query['per_page'] ?? null, 'per_page', 20, 100);
        $pages = [];
        foreach (['members', 'coaches', 'activity'] as $section) {
            $pages[$section] = Validation::positiveInteger($query[$section . '_page'] ?? null, $section . '_page', 1, 1000000);
        }
        $activityUserId = Validation::queryId($query, 'activity_user_id');

        return Database::transaction(function (PDO $db) use ($clubId, $perPage, $pages, $activityUserId): array {
            $club = self::rows($db, 'SELECT c.id, c.name, c.description, c.status, s.name AS sport_name
                FROM clubs c JOIN sports s ON s.id = c.sport_id WHERE c.id = ? AND c.is_archived = 0', [$clubId])[0] ?? null;
            if ($club === null) throw new ApiException(404, 'not_found', 'Club not found.');
            $club['id'] = (int) $club['id'];
            $summary = [
                'members' => self::count($db, "SELECT COUNT(*) FROM memberships WHERE club_id = ? AND status = 'approved'", [$clubId]),
                'coaches' => self::count($db, 'SELECT COUNT(*) FROM club_coaches WHERE club_id = ? AND ended_at IS NULL', [$clubId]),
                'pending_applications' => self::count($db, "SELECT COUNT(*) FROM memberships WHERE club_id = ? AND status = 'pending'", [$clubId]),
                'training_sessions' => self::count($db, 'SELECT COUNT(*) FROM training_sessions WHERE club_id = ?', [$clubId]),
                'training_completed' => self::count($db, "SELECT COUNT(*) FROM training_sessions WHERE club_id = ? AND status = 'completed'", [$clubId]),
                'attendance_recorded' => self::count($db, 'SELECT COUNT(*) FROM training_attendance a JOIN training_sessions t ON t.id = a.session_id WHERE t.club_id = ?', [$clubId]),
            ];
            $members = self::rows($db, "SELECT m.id, m.user_id, u.name, u.email, u.student_id, u.phone, u.status AS account_status,
                    m.reviewed_at AS joined_at,
                    COALESCE(a.present, 0) AS present, COALESCE(a.late, 0) AS late,
                    COALESCE(a.absent, 0) AS absent, COALESCE(a.excused, 0) AS excused, a.last_session_date
                FROM memberships m JOIN users u ON u.id = m.user_id
                LEFT JOIN (
                    SELECT a.participant_id, SUM(a.status = 'present') AS present, SUM(a.status = 'late') AS late,
                        SUM(a.status = 'absent') AS absent, SUM(a.status = 'excused') AS excused,
                        MAX(t.session_date) AS last_session_date
                    FROM training_attendance a JOIN training_sessions t ON t.id = a.session_id
                    WHERE t.club_id = ? AND t.status <> 'cancelled' GROUP BY a.participant_id
                ) a ON a.participant_id = m.user_id
                WHERE m.club_id = ? AND m.status = 'approved' ORDER BY u.name, m.id" . self::limit($pages['members'], $perPage), [$clubId, $clubId]);
            foreach ($members as &$member) {
                foreach (['id', 'user_id', 'present', 'late', 'absent', 'excused'] as $field) $member[$field] = (int) $member[$field];
                $member['joined_at'] = Http::timestamp($member['joined_at']);
            }
            unset($member);
            $coaches = self::rows($db, 'SELECT cc.id, cc.user_id, u.name, u.email, u.student_id, u.phone, u.status AS account_status,
                    cc.created_at AS assigned_at, COALESCE(r.reviews, 0) AS membership_reviews, r.last_review_at
                FROM club_coaches cc JOIN users u ON u.id = cc.user_id
                LEFT JOIN (
                    SELECT reviewed_by, COUNT(*) AS reviews, MAX(reviewed_at) AS last_review_at
                    FROM memberships WHERE club_id = ? AND reviewed_by IS NOT NULL GROUP BY reviewed_by
                ) r ON r.reviewed_by = cc.user_id
                WHERE cc.club_id = ? AND cc.ended_at IS NULL ORDER BY u.name, cc.id' . self::limit($pages['coaches'], $perPage), [$clubId, $clubId]);
            foreach ($coaches as &$coach) {
                foreach (['id', 'user_id', 'membership_reviews'] as $field) $coach[$field] = (int) $coach[$field];
                foreach (['assigned_at', 'last_review_at'] as $field) $coach[$field] = Http::timestamp($coach[$field]);
            }
            unset($coach);

            $activityWhere = ' WHERE a.club_id = ?';
            $parameters = [$clubId];
            $activityUser = null;
            if ($activityUserId !== null) {
                $activityWhere .= ' AND (a.user_id = ? OR a.actor_id = ?)';
                array_push($parameters, $activityUserId, $activityUserId);
                $activityUser = self::rows($db, 'SELECT id, name FROM users WHERE id = ?', [$activityUserId])[0] ?? null;
                if ($activityUser !== null) $activityUser['id'] = (int) $activityUser['id'];
            }
            $activityFrom = ' FROM (' . self::ACTIVITY . ') a';
            $activityTotal = self::count($db, 'SELECT COUNT(*)' . $activityFrom . $activityWhere, $parameters);
            $activity = self::rows($db, 'SELECT a.type, a.source_id, a.user_id, subject.name AS user_name,
                    a.actor_id, actor.name AS actor_name, a.title, a.status, a.occurred_at, a.session_id,
                    t.session_date, t.status AS session_status' . $activityFrom . '
                LEFT JOIN users subject ON subject.id = a.user_id LEFT JOIN users actor ON actor.id = a.actor_id
                LEFT JOIN training_sessions t ON t.id = a.session_id' . $activityWhere . '
                ORDER BY a.occurred_at DESC, a.type, a.source_id DESC' . self::limit($pages['activity'], $perPage), $parameters);
            foreach ($activity as &$record) {
                foreach (['source_id', 'user_id', 'actor_id', 'session_id'] as $field) $record[$field] = $record[$field] === null ? null : (int) $record[$field];
                $record['occurred_at'] = Http::timestamp($record['occurred_at']);
            }
            unset($record);
            return ['club' => $club, 'summary' => $summary,
                'members' => ['records' => $members, 'pagination' => self::pagination($pages['members'], $perPage, $summary['members'])],
                'coaches' => ['records' => $coaches, 'pagination' => self::pagination($pages['coaches'], $perPage, $summary['coaches'])],
                'activity' => ['records' => $activity, 'pagination' => self::pagination($pages['activity'], $perPage, $activityTotal),
                    'user_id' => $activityUserId, 'user_name' => $activityUser['name'] ?? null]];
        });
    }

    private static function rows(PDO $db, string $sql, array $parameters): array
    {
        $statement = $db->prepare($sql);
        $statement->execute($parameters);
        return $statement->fetchAll();
    }

    private static function count(PDO $db, string $sql, array $parameters): int
    {
        $statement = $db->prepare($sql);
        $statement->execute($parameters);
        return (int) $statement->fetchColumn();
    }

    private static function limit(int $page, int $perPage): string
    {
        return ' LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage);
    }

    private static function pagination(int $page, int $perPage, int $total): array
    {
        return ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int) ceil($total / $perPage)];
    }
}
