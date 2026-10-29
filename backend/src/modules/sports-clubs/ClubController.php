<?php

declare(strict_types=1);

require_once __DIR__ . '/../../shared/Database.php';
require_once __DIR__ . '/../../shared/Response.php';
require_once __DIR__ . '/../../shared/Validator.php';

final class ClubController
{
    private static function tableExists(PDO $pdo, string $tableName): bool
    {
        $query = $pdo->prepare(
            'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table_name LIMIT 1'
        );
        $query->execute([':table_name' => $tableName]);

        return $query->fetchColumn() !== false;
    }

    private static function getClub(PDO $pdo, int $clubId): ?array
    {
        if (!self::tableExists($pdo, 'clubs')) {
            return null;
        }

        $stmt = $pdo->prepare('SELECT * FROM clubs WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $clubId]);
        $club = $stmt->fetch();

        return is_array($club) ? $club : null;
    }

    public static function list(): void
    {
        try {
            $pdo = Database::getConnection();
            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            $query = 'SELECT * FROM clubs WHERE is_archived = 0 ORDER BY name ASC';
            $stmt = $pdo->query($query);
            $clubs = $stmt->fetchAll();

            Response::json(200, ['success' => true, 'data' => $clubs]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load clubs.']);
        }
    }

    public static function details(int $clubId): void
    {
        try {
            $pdo = Database::getConnection();
            $club = self::getClub($pdo, $clubId);

            if ($club === null) {
                Response::json(404, ['success' => false, 'message' => 'Club not found or the clubs table is unavailable.']);
                return;
            }

            Response::json(200, ['success' => true, 'data' => $club]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load club details.']);
        }
    }

    public static function create(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            Response::json(405, ['success' => false, 'message' => 'Method not allowed.']);
            return;
        }

        try {
            $input = Validator::decodeJsonObject((string) file_get_contents('php://input'));

            $name = Validator::requireString($input, 'name', 2, 255);
            $description = Validator::optionalString($input, 'description', 2000) ?? '';
            $sportId = Validator::requireInt($input, 'sport_id');
            $status = Validator::optionalString($input, 'status', 50) ?? 'active';

            $pdo = Database::getConnection();
            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            if (!self::tableExists($pdo, 'sports')) {
                Response::json(500, ['success' => false, 'message' => 'The sports table is not available in the configured database.']);
                return;
            }

            $sportExists = $pdo->prepare('SELECT id FROM sports WHERE id = :id LIMIT 1');
            $sportExists->execute([':id' => $sportId]);
            if (!$sportExists->fetch()) {
                Response::json(400, ['success' => false, 'message' => 'Invalid sport reference.']);
                return;
            }

            $insert = $pdo->prepare('INSERT INTO clubs (name, description, sport_id, status, is_archived, created_at, updated_at) VALUES (:name, :description, :sport_id, :status, 0, NOW(), NOW())');
            $insert->execute([
                ':name' => $name,
                ':description' => $description,
                ':sport_id' => $sportId,
                ':status' => $status,
            ]);

            $clubId = (int) $pdo->lastInsertId();
            $created = $pdo->prepare('SELECT * FROM clubs WHERE id = :id LIMIT 1');
            $created->execute([':id' => $clubId]);

            Response::json(201, ['success' => true, 'message' => 'Club created successfully.', 'data' => $created->fetch()]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to create club.']);
        }
    }

    public static function update(int $clubId): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
            Response::json(405, ['success' => false, 'message' => 'Method not allowed.']);
            return;
        }

        try {
            $input = Validator::decodeJsonObject((string) file_get_contents('php://input'));

            $pdo = Database::getConnection();
            $club = self::getClub($pdo, $clubId);

            if ($club === null) {
                Response::json(404, ['success' => false, 'message' => 'Club not found or the clubs table is unavailable.']);
                return;
            }

            if (!self::tableExists($pdo, 'sports')) {
                Response::json(500, ['success' => false, 'message' => 'The sports table is not available in the configured database.']);
                return;
            }

            $name = array_key_exists('name', $input) ? Validator::requireString($input, 'name', 2, 255) : (string) $club['name'];
            $description = array_key_exists('description', $input) ? (Validator::optionalString($input, 'description', 2000) ?? '') : (string) ($club['description'] ?? '');
            $sportId = array_key_exists('sport_id', $input) ? Validator::requireInt($input, 'sport_id') : (int) $club['sport_id'];
            $status = array_key_exists('status', $input) ? Validator::optionalString($input, 'status', 50) ?? 'active' : (string) ($club['status'] ?? 'active');

            $sportExists = $pdo->prepare('SELECT id FROM sports WHERE id = :id LIMIT 1');
            $sportExists->execute([':id' => $sportId]);
            if (!$sportExists->fetch()) {
                Response::json(400, ['success' => false, 'message' => 'Invalid sport reference.']);
                return;
            }

            $update = $pdo->prepare('UPDATE clubs SET name = :name, description = :description, sport_id = :sport_id, status = :status, updated_at = NOW() WHERE id = :id');
            $update->execute([
                ':name' => $name,
                ':description' => $description,
                ':sport_id' => $sportId,
                ':status' => $status,
                ':id' => $clubId,
            ]);

            $updated = $pdo->prepare('SELECT * FROM clubs WHERE id = :id LIMIT 1');
            $updated->execute([':id' => $clubId]);

            Response::json(200, ['success' => true, 'message' => 'Club updated successfully.', 'data' => $updated->fetch()]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to update club.']);
        }
    }

    public static function archive(int $clubId): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'PATCH' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
            Response::json(405, ['success' => false, 'message' => 'Method not allowed.']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $club = self::getClub($pdo, $clubId);
            if ($club === null) {
                Response::json(404, ['success' => false, 'message' => 'Club not found or the clubs table is unavailable.']);
                return;
            }

            $archive = $pdo->prepare('UPDATE clubs SET is_archived = 1, status = :status, updated_at = NOW() WHERE id = :id');
            $archive->execute([':status' => 'archived', ':id' => $clubId]);

            Response::json(200, ['success' => true, 'message' => 'Club archived successfully.']);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to archive club.']);
        }
    }

    public static function delete(int $clubId): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
            Response::json(405, ['success' => false, 'message' => 'Method not allowed.']);
            return;
        }

        Response::json(409, [
            'success' => false,
            'message' => 'Club deletion is disabled until historical-record retention rules are confirmed.',
        ]);
    }
}
