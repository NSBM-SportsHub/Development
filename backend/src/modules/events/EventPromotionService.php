<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

final class EventPromotionService
{
    private const FIELDS = ['title', 'description', 'category', 'tournament_id', 'venue', 'starts_at', 'ends_at', 'published', 'featured', 'display_order'];
    private const SELECT = 'SELECT p.*, t.status AS tournament_status FROM event_promotions p LEFT JOIN tournaments t ON t.id = p.tournament_id';
    private const PUBLIC_WHERE = "p.deleted_at IS NULL AND p.published = 1 AND p.ends_at > UTC_TIMESTAMP() AND (p.tournament_id IS NULL OR t.status NOT IN ('draft','cancelled','completed'))";

    public static function listing(bool $admin = false, ?int $id = null): array
    {
        $query = self::SELECT . ' WHERE ' . ($admin ? 'p.deleted_at IS NULL' : self::PUBLIC_WHERE);
        $query .= $id === null ? ' ORDER BY p.display_order, p.starts_at, p.id' : ' AND p.id = ?';
        $statement = Database::get()->prepare($query);
        $statement->execute($id === null ? [] : [$id]);
        $rows = $statement->fetchAll();
        if ($id !== null) return self::dto($rows[0] ?? throw new ApiException(404, 'not_found', 'This event is no longer available.'), $admin);
        return ['events' => array_map(fn(array $row): array => self::dto($row, $admin), $rows)];
    }

    public static function save(array $actor, ?int $id, array $data): array
    {
        Validation::allowed($data, self::FIELDS);
        if ($data === []) Validation::fail('title', 'Submit at least one change.');
        $id = Database::transaction(function (PDO $db) use ($actor, $id, $data): int {
            self::lockAdmin($actor);
            $existing = $id === null ? [] : self::lockRecord($db, $id);
            $values = array_replace($existing, $data);
            // Existing DATETIME values are normalized before partial-update validation.
            foreach (['starts_at', 'ends_at'] as $field) if (!array_key_exists($field, $data) && isset($existing[$field])) $values[$field] = Http::timestamp($existing[$field]);
            $clean = [Validation::text($values, 'title', 150), Validation::text($values, 'description', 6000),
                Validation::choice($values['category'] ?? null, 'category', ['tournament','trial','camp','sports_day','other']),
                ($values['tournament_id'] ?? null) === null ? null : Validation::id(is_numeric($values['tournament_id']) && !array_key_exists('tournament_id', $data) ? (int) $values['tournament_id'] : $values['tournament_id'], 'tournament_id'),
                Validation::text($values, 'venue', 160), Validation::dateTime($values['starts_at'] ?? null, 'starts_at'), Validation::dateTime($values['ends_at'] ?? null, 'ends_at')];
            if ($clean[6] <= $clean[5]) Validation::fail('ends_at', 'End time must be after the start time.');
            if (($clean[2] === 'tournament') !== ($clean[3] !== null)) Validation::fail('tournament_id', 'Select a tournament only for tournament promotions.');
            if ($clean[3] !== null) {
                $statement = $db->prepare('SELECT id FROM tournaments WHERE id = ? FOR UPDATE');
                $statement->execute([$clean[3]]);
                if (!$statement->fetch()) Validation::fail('tournament_id', 'Choose an existing tournament.');
            }
            foreach (['published' => false, 'featured' => true] as $field => $default) {
                $value = $values[$field] ?? $default;
                if (!array_key_exists($field, $data) && isset($existing[$field])) $value = (bool) $value;
                if (!is_bool($value)) Validation::fail($field, 'Choose true or false.');
                $clean[] = (int) $value;
            }
            $order = $values['display_order'] ?? 0;
            if (!array_key_exists('display_order', $data)) $order = (int) $order;
            $clean[] = Validation::integer($order, 'display_order', 0, 999);
            if ($id === null) {
                $db->prepare('INSERT INTO event_promotions (' . implode(',', self::FIELDS) . ',created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute([...$clean, (int) $actor['id']]);
                return (int) $db->lastInsertId();
            }
            $db->prepare('UPDATE event_promotions SET ' . implode(',', array_map(fn($field) => "$field = ?", self::FIELDS)) . ',updated_at = UTC_TIMESTAMP() WHERE id = ?')->execute([...$clean, $id]);
            return $id;
        });
        return self::listing(true, $id);
    }

    public static function remove(array $actor, int $id): void
    {
        Database::transaction(function (PDO $db) use ($actor, $id): void {
            self::lockAdmin($actor);
            self::lockRecord($db, $id);
            // Preserve the record and its image for recovery; public reads exclude it immediately.
            $db->prepare('UPDATE event_promotions SET published = 0, deleted_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$id]);
        });
    }

    public function __construct(private ?CloudinaryClient $cloudinary = null) { $this->cloudinary ??= new CloudinaryClient(); }

    public function banner(array $actor, int $id, ?string $path): array
    {
        // Check access and existence before sending a file to the provider; revalidate under lock below.
        if (($actor['role'] ?? '') !== 'admin') throw new ApiException(403, 'forbidden', 'Only Admins can manage event promotions.');
        self::listing(true, $id);
        $asset = $path === null ? null : $this->cloudinary->uploadBanner($path, ImageUpload::validate($path, 'banner'), $id);
        try {
            $previous = Database::transaction(function (PDO $db) use ($actor, $id, $asset): array {
                self::lockAdmin($actor);
                $previous = self::lockRecord($db, $id);
                $db->prepare('UPDATE event_promotions SET cloud_name = ?, public_id = ?, version = ?, banner_url = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?')
                    ->execute([$asset['cloud_name'] ?? null, $asset['public_id'] ?? null, $asset['version'] ?? null, $asset['photo_url'] ?? null, $id]);
                return $previous;
            });
        } catch (\Throwable $error) { if ($asset !== null) $this->cleanup($asset); throw $error; }
        if ($previous['public_id'] !== null) $this->cleanup($previous);
        return self::listing(true, $id);
    }

    private function cleanup(array $asset): void
    {
        try { $this->cloudinary->destroy($asset); }
        catch (\Throwable) { error_log('SportsHub event banner cleanup pending: ' . $asset['public_id']); }
    }

    private static function lockAdmin(array $actor): void
    {
        $current = UserRepository::find((int) $actor['id'], true);
        if (!$current || $current['status'] !== 'active' || (int) $current['auth_version'] !== (int) $actor['auth_version']) throw new ApiException(401, 'unauthenticated', 'Your session has expired. Sign in again.');
        if ($current['role'] !== 'admin') throw new ApiException(403, 'forbidden', 'Only Admins can manage event promotions.');
    }

    private static function lockRecord(PDO $db, int $id): array
    {
        $statement = $db->prepare('SELECT * FROM event_promotions WHERE id = ? AND deleted_at IS NULL FOR UPDATE');
        $statement->execute([$id]);
        return $statement->fetch() ?: throw new ApiException(404, 'not_found', 'This event is no longer available.');
    }

    private static function dto(array $row, bool $admin): array
    {
        $out = array_intersect_key($row, array_flip(['title','description','category','venue','banner_url']));
        $out['id'] = (int) $row['id'];
        $out['tournament_id'] = $row['tournament_id'] === null ? null : (int) $row['tournament_id'];
        $out['starts_at'] = Http::timestamp($row['starts_at']);
        $out['ends_at'] = Http::timestamp($row['ends_at']);
        $out['featured'] = (bool) $row['featured'];
        $out['display_order'] = (int) $row['display_order'];
        if ($admin) { $out['published'] = (bool) $row['published']; $out['tournament_status'] = $row['tournament_status']; }
        return $out;
    }
}
