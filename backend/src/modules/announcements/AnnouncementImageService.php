<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

final class AnnouncementImageService
{
    public function __construct(private ?CloudinaryClient $cloudinary = null) { $this->cloudinary ??= new CloudinaryClient(); }

    public function save(array $actor, string $id, ?string $path): array
    {
        if (($actor['role'] ?? '') !== 'admin') throw new ApiException(403, 'forbidden', 'Administrator access is required.');
        if (AnnouncementRepository::find($id) === null) throw new ApiException(404, 'not_found', 'This announcement could not be found.');
        $asset = $path === null ? null : $this->cloudinary->uploadAnnouncementImage($path, ImageUpload::validate($path, 'image'), $id);
        try {
            $previous = Database::transaction(function (PDO $db) use ($actor, $id, $asset): ?array {
                $current = UserRepository::find((int) $actor['id'], true);
                if (!$current || $current['status'] !== 'active' || (int) $current['auth_version'] !== (int) $actor['auth_version']) throw new ApiException(401, 'unauthenticated', 'Your session has expired. Sign in again.');
                if ($current['role'] !== 'admin') throw new ApiException(403, 'forbidden', 'Administrator access is required.');
                $statement = $db->prepare('SELECT announcement_id FROM announcements WHERE announcement_id = ? AND is_deleted = 0 FOR UPDATE');
                $statement->execute([$id]);
                if (!$statement->fetch()) throw new ApiException(404, 'not_found', 'This announcement could not be found.');
                $statement = $db->prepare('SELECT cloud_name, public_id FROM announcement_images WHERE announcement_id = ?');
                $statement->execute([$id]);
                $previous = $statement->fetch() ?: null;
                if ($asset === null) {
                    $db->prepare('DELETE FROM announcement_images WHERE announcement_id = ?')->execute([$id]);
                } else {
                    $db->prepare('INSERT INTO announcement_images (announcement_id, cloud_name, public_id, version, image_url) VALUES (?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE cloud_name = VALUES(cloud_name), public_id = VALUES(public_id), version = VALUES(version), image_url = VALUES(image_url), updated_at = UTC_TIMESTAMP()')
                        ->execute([$id, $asset['cloud_name'], $asset['public_id'], $asset['version'], $asset['photo_url']]);
                }
                return $previous;
            });
        } catch (\Throwable $error) {
            if ($asset !== null) $this->cleanup($asset);
            throw $error;
        }
        if ($previous !== null) $this->cleanup($previous);
        return AnnouncementRepository::find($id) ?? throw new ApiException(404, 'not_found', 'This announcement could not be found.');
    }

    private function cleanup(array $asset): void
    {
        try { $this->cloudinary->destroy($asset); }
        catch (\Throwable) { error_log('SportsHub announcement image cleanup pending: ' . $asset['public_id']); }
    }
}
