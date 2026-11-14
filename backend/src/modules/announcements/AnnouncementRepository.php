<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

final class AnnouncementRepository
{
    private const SELECT = 'SELECT a.announcement_id, a.club_id, a.title, a.body, a.is_pinned, a.is_deleted, i.image_url FROM announcements a LEFT JOIN announcement_images i ON i.announcement_id = a.announcement_id';

    public static function listing(bool $includeDeleted = false): array
    {
        $where = $includeDeleted ? '' : ' WHERE a.is_deleted = 0';
        $statement = Database::get()->query(
            self::SELECT . $where . ' ORDER BY a.is_pinned DESC, a.announcement_id DESC'
        );
        return array_map([self::class, 'publicAnnouncement'], $statement->fetchAll());
    }

    public static function find(string $id, bool $includeDeleted = false): ?array
    {
        $statement = Database::get()->prepare(
            self::SELECT . ' WHERE a.announcement_id = ?' . ($includeDeleted ? '' : ' AND a.is_deleted = 0')
        );
        $statement->execute([$id]);
        $announcement = $statement->fetch();
        return $announcement === false ? null : self::publicAnnouncement($announcement);
    }

    public static function create(array $data): array
    {
        $id = sprintf(
            '%08x-%04x-4%03x-%04x-%012x',
            random_int(0, 0xffffffff),
            random_int(0, 0xffff),
            random_int(0, 0x0fff),
            random_int(0x8000, 0xbfff),
            random_int(0, 0xffffffffffff)
        );
        Database::transaction(function (PDO $db) use ($id, $data): void {
            $statement = $db->prepare(
                'INSERT INTO announcements (announcement_id, club_id, title, body, is_pinned, is_deleted) VALUES (?, ?, ?, ?, ?, 0)'
            );
            $statement->execute([$id, $data['club_id'], $data['title'], $data['body'], $data['is_pinned']]);
            NotificationService::announcement($db, $id, $data);
        });
        return self::find($id) ?? throw new \RuntimeException('The created announcement could not be loaded.');
    }

    public static function featured(?string $id = null): array
    {
        $statement = Database::get()->prepare(self::SELECT . ' WHERE a.is_deleted = 0 AND i.image_url IS NOT NULL' .
            ($id === null ? ' ORDER BY a.is_pinned DESC, i.updated_at DESC, a.announcement_id DESC' : ' AND a.announcement_id = ?'));
        $statement->execute($id === null ? [] : [$id]);
        $rows = array_map([self::class, 'publicAnnouncement'], $statement->fetchAll());
        if ($id !== null) return $rows[0] ?? throw new ApiException(404, 'not_found', 'This announcement is no longer available.');
        return ['announcements' => $rows];
    }

    public static function update(string $id, array $changes): ?array
    {
        $assignments = [];
        $values = [];
        foreach (['club_id', 'title', 'body', 'is_pinned'] as $field) {
            if (array_key_exists($field, $changes)) {
                $assignments[] = $field . ' = ?';
                $values[] = $changes[$field];
            }
        }
        if ($assignments !== []) {
            $values[] = $id;
            $statement = Database::get()->prepare(
                'UPDATE announcements SET ' . implode(', ', $assignments) . ' WHERE announcement_id = ? AND is_deleted = 0'
            );
            $statement->execute($values);
        }
        return self::find($id);
    }

    public static function softDelete(string $id): bool
    {
        $statement = Database::get()->prepare(
            'UPDATE announcements SET is_deleted = 1 WHERE announcement_id = ? AND is_deleted = 0'
        );
        $statement->execute([$id]);
        return $statement->rowCount() === 1;
    }

    public static function clubExists(int $clubId): bool
    {
        $statement = Database::get()->prepare('SELECT 1 FROM clubs WHERE id = ? AND is_archived = 0');
        $statement->execute([$clubId]);
        return $statement->fetchColumn() !== false;
    }

    private static function publicAnnouncement(array $announcement): array
    {
        return [
            'announcement_id' => $announcement['announcement_id'],
            'club_id' => $announcement['club_id'] === null ? null : (int) $announcement['club_id'],
            'title' => $announcement['title'],
            'body' => $announcement['body'],
            'image_url' => $announcement['image_url'] ?? null,
            'is_pinned' => (bool) $announcement['is_pinned'],
            'is_deleted' => (bool) $announcement['is_deleted'],
        ];
    }
}
