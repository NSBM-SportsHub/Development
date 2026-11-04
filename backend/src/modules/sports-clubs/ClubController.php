<?php

declare(strict_types=1);

namespace SportsHub;

use PDO;
use PDOException;
use Throwable;
use InvalidArgumentException;
use RuntimeException;
use DateTimeImmutable;

require_once __DIR__ . '/../../shared/Database.php';
require_once __DIR__ . '/../../shared/Response.php';
require_once __DIR__ . '/../../shared/Validator.php';

final class ClubController
{
    private const STATUSES = ['active', 'recruiting', 'full', 'inactive'];

    private static function tableExists(PDO $pdo, string $tableName): bool
    {
        $query = $pdo->prepare(
            'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table_name LIMIT 1'
        );
        $query->execute([':table_name' => $tableName]);

        return $query->fetchColumn() !== false;
    }

    private static function rejectUnknownFields(array $data, array $allowed): void
    {
        $unknown = array_diff(array_keys($data), $allowed);
        if ($unknown !== []) {
            throw new InvalidArgumentException('Unsupported field: ' . reset($unknown) . '.');
        }
    }

    private static function requireSportId(array $data): int
    {
        $sportId = Validator::requireInt($data, 'sport_id');
        if ($sportId <= 0) {
            throw new InvalidArgumentException("Field 'sport_id' must be a positive integer.");
        }

        return $sportId;
    }

    private static function requireStatus(array $data, string $key, string $default): string
    {
        $status = array_key_exists($key, $data)
            ? Validator::requireString($data, $key, 1, 50)
            : $default;

        if (!in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException("Field '{$key}' must be one of: " . implode(', ', self::STATUSES) . '.');
        }

        return $status;
    }

    private static function logFailure(Throwable $exception): void
    {
        error_log($exception::class . ': ' . $exception->getMessage());
    }

    private static function respondWriteFailure(PDOException $exception, string $message): void
    {
        self::logFailure($exception);

        if ((int) ($exception->errorInfo[1] ?? 0) === 1062) {
            Response::json(409, ['success' => false, 'message' => 'A club with this name already exists.']);
            return;
        }

        Response::json(500, ['success' => false, 'message' => $message]);
    }

    private static function getClub(PDO $pdo, int $clubId): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM clubs WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $clubId]);
        $club = $stmt->fetch();

        return is_array($club) ? $club : null;
    }

    public static function list(): void
    {
        try {
            $pdo = Database::get();
            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            $query = 'SELECT * FROM clubs WHERE is_archived = 0 ORDER BY name ASC';
            $stmt = $pdo->query($query);
            $clubs = $stmt->fetchAll();

            Response::json(200, ['success' => true, 'data' => $clubs]);
        } catch (Throwable $exception) {
            self::logFailure($exception);
            Response::json(500, ['success' => false, 'message' => 'Failed to load clubs.']);
        }
    }

    public static function details(int $clubId): void
    {
        try {
            $pdo = Database::get();
            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            $club = self::getClub($pdo, $clubId);

            if ($club === null || (int) $club['is_archived'] === 1) {
                Response::json(404, ['success' => false, 'message' => 'Club not found.']);
                return;
            }

            Response::json(200, ['success' => true, 'data' => $club]);
        } catch (Throwable $exception) {
            self::logFailure($exception);
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
            $input = Http::body();
            self::rejectUnknownFields($input, ['name', 'description', 'sport_id', 'status']);

            $name = Validator::requireString($input, 'name', 2, 120);
            $description = Validator::optionalString($input, 'description', 2000) ?? '';
            $sportId = self::requireSportId($input);
            $status = self::requireStatus($input, 'status', 'active');

            $pdo = Database::get();
            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            if (!self::tableExists($pdo, 'sports')) {
                Response::json(500, ['success' => false, 'message' => 'The sports table is not available in the configured database.']);
                return;
            }

            $sportExists = $pdo->prepare('SELECT id FROM sports WHERE id = :id AND is_active = 1 LIMIT 1');
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
            $createdClub = $created->fetch();
            if (!is_array($createdClub)) {
                throw new RuntimeException('The created club could not be loaded.');
            }

            Response::json(201, ['success' => true, 'message' => 'Club created successfully.', 'data' => $createdClub]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (PDOException $exception) {
            self::respondWriteFailure($exception, 'Failed to create club.');
        } catch (Throwable $exception) {
            self::logFailure($exception);
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
            $input = Http::body();
            self::rejectUnknownFields($input, ['name', 'description', 'sport_id', 'status']);
            if ($input === []) {
                throw new InvalidArgumentException('At least one field must be provided for update.');
            }

            $pdo = Database::get();
            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            $club = self::getClub($pdo, $clubId);

            if ($club === null || (int) $club['is_archived'] === 1) {
                Response::json(404, ['success' => false, 'message' => 'Club not found.']);
                return;
            }

            if (!self::tableExists($pdo, 'sports')) {
                Response::json(500, ['success' => false, 'message' => 'The sports table is not available in the configured database.']);
                return;
            }

            $name = array_key_exists('name', $input) ? Validator::requireString($input, 'name', 2, 120) : (string) $club['name'];
            $description = array_key_exists('description', $input) ? (Validator::optionalString($input, 'description', 2000) ?? '') : (string) ($club['description'] ?? '');
            $sportId = array_key_exists('sport_id', $input) ? self::requireSportId($input) : (int) $club['sport_id'];
            $status = self::requireStatus($input, 'status', (string) ($club['status'] ?? 'active'));

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
            $updatedClub = $updated->fetch();
            if (!is_array($updatedClub)) {
                Response::json(404, ['success' => false, 'message' => 'Club not found.']);
                return;
            }

            Response::json(200, ['success' => true, 'message' => 'Club updated successfully.', 'data' => $updatedClub]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (PDOException $exception) {
            self::respondWriteFailure($exception, 'Failed to update club.');
        } catch (Throwable $exception) {
            self::logFailure($exception);
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
            $pdo = Database::get();
            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            $club = self::getClub($pdo, $clubId);
            if ($club === null || (int) $club['is_archived'] === 1) {
                Response::json(404, ['success' => false, 'message' => 'Club not found.']);
                return;
            }

            $archive = $pdo->prepare('UPDATE clubs SET is_archived = 1, updated_at = NOW() WHERE id = :id');
            $archive->execute([':id' => $clubId]);

            Response::json(200, ['success' => true, 'message' => 'Club archived successfully.']);
        } catch (Throwable $exception) {
            self::logFailure($exception);
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
