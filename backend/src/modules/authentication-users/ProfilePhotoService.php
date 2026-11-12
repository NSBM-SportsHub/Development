<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

final class ProfilePhotoService
{
    public const MAX_BYTES = ImageUpload::MAX_BYTES;
    private CloudinaryClient $cloudinary;

    public function __construct(?CloudinaryClient $cloudinary = null)
    {
        $this->cloudinary = $cloudinary ?? new CloudinaryClient();
    }

    public static function imageFile(string $path): string
    {
        return ImageUpload::validate($path);
    }

    public function upload(array $actor, string $path): array
    {
        $mime = self::imageFile($path);
        $photo = $this->cloudinary->upload($path, $mime, (int) $actor['id']);
        $previous = null;
        try {
            Database::transaction(function (PDO $db) use ($actor, $photo, &$previous): void {
                self::lockActor($actor);
                $previous = self::current($db, (int) $actor['id']);
                $db->prepare('INSERT INTO user_profile_photos (user_id, cloud_name, public_id, version, photo_url) VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE cloud_name = VALUES(cloud_name), public_id = VALUES(public_id), version = VALUES(version), photo_url = VALUES(photo_url), updated_at = UTC_TIMESTAMP()')
                    ->execute([(int) $actor['id'], $photo['cloud_name'], $photo['public_id'], $photo['version'], $photo['photo_url']]);
            });
        } catch (\Throwable $error) {
            $this->cleanup($photo);
            throw $error;
        }
        if ($previous !== null) $this->cleanup($previous);
        return UserRepository::publicUser(UserRepository::find((int) $actor['id']));
    }

    public function remove(array $actor): array
    {
        $previous = Database::transaction(function (PDO $db) use ($actor): ?array {
            self::lockActor($actor);
            $photo = self::current($db, (int) $actor['id']);
            $db->prepare('DELETE FROM user_profile_photos WHERE user_id = ?')->execute([(int) $actor['id']]);
            return $photo;
        });
        if ($previous !== null) $this->cleanup($previous);
        return UserRepository::publicUser(UserRepository::find((int) $actor['id']));
    }

    private function cleanup(array $photo): void
    {
        try { $this->cloudinary->destroy($photo); }
        catch (\Throwable) {
            // Saving/removing a reference already committed. Report only the orphan's public ID.
            error_log('SportsHub profile photo cleanup pending: ' . $photo['cloud_name'] . '/' . $photo['public_id']);
        }
    }

    private static function current(PDO $db, int $userId): ?array
    {
        $statement = $db->prepare('SELECT cloud_name, public_id, version, photo_url FROM user_profile_photos WHERE user_id = ?');
        $statement->execute([$userId]);
        return $statement->fetch() ?: null;
    }

    private static function lockActor(array $actor): void
    {
        $user = UserRepository::find((int) $actor['id'], true);
        if ($user === null || $user['status'] !== 'active' || (int) $user['auth_version'] !== (int) $actor['auth_version']) throw new ApiException(401, 'unauthenticated', 'Your session has expired. Sign in again.');
    }
}
