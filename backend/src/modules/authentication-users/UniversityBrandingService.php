<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

final class UniversityBrandingService
{
    private CloudinaryClient $cloudinary;

    public function __construct(?CloudinaryClient $cloudinary = null)
    {
        $this->cloudinary = $cloudinary ?? new CloudinaryClient();
    }

    public static function publicBranding(): array
    {
        $record = Database::get()->query('SELECT logo_url, updated_at FROM site_branding WHERE id = 1')->fetch();
        return ['university_logo_url' => $record['logo_url'] ?? null, 'updated_at' => isset($record['updated_at']) ? Http::timestamp($record['updated_at']) : null];
    }

    public function upload(array $actor, string $path): array
    {
        self::requireAdmin($actor);
        $mime = ImageUpload::validate($path, 'logo');
        $logo = $this->cloudinary->uploadLogo($path, $mime);
        $previous = null;
        try {
            Database::transaction(function (PDO $db) use ($actor, $logo, &$previous): void {
                self::lockAdmin($actor);
                $previous = self::lockBranding($db);
                $db->prepare('UPDATE site_branding SET cloud_name = ?, public_id = ?, version = ?, logo_url = ?, updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = 1')
                    ->execute([$logo['cloud_name'], $logo['public_id'], $logo['version'], $logo['photo_url'], (int) $actor['id']]);
            });
        } catch (\Throwable $error) {
            $this->cleanup($logo);
            throw $error;
        }
        if ($previous['public_id'] !== null) $this->cleanup($previous);
        return self::publicBranding();
    }

    public function remove(array $actor): array
    {
        self::requireAdmin($actor);
        $previous = Database::transaction(function (PDO $db) use ($actor): array {
            self::lockAdmin($actor);
            $previous = self::lockBranding($db);
            $db->prepare('UPDATE site_branding SET cloud_name = NULL, public_id = NULL, version = NULL, logo_url = NULL, updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = 1')->execute([(int) $actor['id']]);
            return $previous;
        });
        if ($previous['public_id'] !== null) $this->cleanup($previous);
        return self::publicBranding();
    }

    private static function requireAdmin(array $actor): void
    {
        if (($actor['role'] ?? null) !== 'admin') throw new ApiException(403, 'forbidden', 'Only Admins can change the university logo.');
    }

    private static function lockAdmin(array $actor): void
    {
        $current = UserRepository::find((int) $actor['id'], true);
        if ($current === null || $current['status'] !== 'active' || (int) $current['auth_version'] !== (int) $actor['auth_version']) throw new ApiException(401, 'unauthenticated', 'Your session has expired. Sign in again.');
        self::requireAdmin($current);
    }

    private static function lockBranding(PDO $db): array
    {
        return $db->query('SELECT cloud_name, public_id, version, logo_url FROM site_branding WHERE id = 1 FOR UPDATE')->fetch()
            ?: throw new ApiException(503, 'branding_unavailable', 'University branding is not ready. Contact your administrator.');
    }

    private function cleanup(array $logo): void
    {
        try { $this->cloudinary->destroy($logo); }
        catch (\Throwable) { error_log('SportsHub university logo cleanup pending: ' . $logo['cloud_name'] . '/' . $logo['public_id']); }
    }
}
