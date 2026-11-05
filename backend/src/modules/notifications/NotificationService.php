<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

final class NotificationService
{
    // Call from the source transaction. The unique key makes repeated delivery harmless.
    public static function deliver(PDO $db, array $recipients, string $key, string $type, string $title, string $message, string $link): void
    {
        $insert = $db->prepare('INSERT INTO notifications (recipient_id, event_key, type, title, message, link)
            VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id');
        foreach (array_unique($recipients) as $recipient) {
            $insert->execute([(int) $recipient, $key, $type, $title, $message, $link]);
        }
    }

    public static function booking(PDO $db, int $id, string $status): void
    {
        $query = $db->prepare('SELECT requested_by FROM bookings WHERE id = ?');
        $query->execute([$id]);
        self::deliver($db, [(int) $query->fetchColumn()], "booking:$id:$status", 'booking',
            'Booking ' . $status, "Your booking request #$id is $status.", '/bookings/mine');
    }

    public static function announcement(PDO $db, string $id, array $data): void
    {
        // Announcement reads already allow every signed-in user, including club-tagged posts.
        $recipients = $db->query("SELECT id FROM users WHERE status = 'active' AND deleted_at IS NULL ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
        self::deliver($db, $recipients, "announcement:$id", 'announcement', 'New announcement', $data['title'], '/announcements');
    }

    public static function listing(int $userId, array $query): array
    {
        $page = Validation::positiveInteger($query['page'] ?? null, 'page', 1, 1000000);
        $perPage = Validation::positiveInteger($query['per_page'] ?? null, 'per_page', 20, 100);
        $state = Validation::queryChoice($query, 'state', ['read', 'unread']);
        $where = ' WHERE recipient_id = ?' . ($state === null ? '' : ($state === 'read' ? ' AND read_at IS NOT NULL' : ' AND read_at IS NULL'));
        $db = Database::get();
        $count = $db->prepare('SELECT COUNT(*) FROM notifications' . $where);
        $count->execute([$userId]);
        $total = (int) $count->fetchColumn();
        $unread = $db->prepare('SELECT COUNT(*) FROM notifications WHERE recipient_id = ? AND read_at IS NULL');
        $unread->execute([$userId]);
        $rows = $db->prepare('SELECT * FROM notifications' . $where . ' ORDER BY id DESC LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage));
        $rows->execute([$userId]);
        return ['notifications' => array_map([self::class, 'publicRow'], $rows->fetchAll()), 'unread_count' => (int) $unread->fetchColumn(),
            'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int) ceil($total / $perPage)]];
    }

    public static function markRead(int $userId, int $id): array
    {
        $db = Database::get();
        $db->prepare('UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE id = ? AND recipient_id = ?')->execute([$id, $userId]);
        $statement = $db->prepare('SELECT * FROM notifications WHERE id = ? AND recipient_id = ?');
        $statement->execute([$id, $userId]);
        $row = $statement->fetch();
        if ($row === false) throw new ApiException(404, 'not_found', 'This notification could not be found.');
        return self::publicRow($row);
    }

    private static function publicRow(array $row): array
    {
        return ['id' => (int) $row['id'], 'type' => $row['type'], 'title' => $row['title'], 'message' => $row['message'],
            'link' => $row['link'], 'read_at' => Http::timestamp($row['read_at']), 'created_at' => Http::timestamp($row['created_at'])];
    }
}
