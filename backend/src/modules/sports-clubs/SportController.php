<?php

declare(strict_types=1);

require_once __DIR__ . '/../../shared/Database.php';
require_once __DIR__ . '/../../shared/Response.php';

/**
 * Sport API controller.
 *
 * This module is intentionally designed around a small set of database query helpers so the
 * project can swap to the real schema later without rewriting the public controller logic.
 * Authentication and authorization are not implemented here because the project does not yet
 * expose a working auth layer or role policy for reads/writes.
 */
final class SportController
{
    private static function tableExists(PDO $pdo, string $tableName): bool
    {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $tableName]);

        return $stmt->fetchColumn() !== false;
    }

    private static function normalizeText(mixed $value, int $maxLength = 255): ?string
    {
        if ($value === null) {
            return null;
        }

        if (!is_string($value)) {
            throw new InvalidArgumentException('Filter value must be a string.');
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (mb_strlen($trimmed) > $maxLength) {
            throw new InvalidArgumentException('Filter value is too long.');
        }

        return $trimmed;
    }

    private static function normalizePositiveInt(mixed $value, string $fieldName, int $maxValue = 1000): int
    {
        if ($value === null || $value === '') {
            return 0;
        }

        if (!is_string($value) && !is_int($value)) {
            throw new InvalidArgumentException("Field '{$fieldName}' must be an integer.");
        }

        if (!ctype_digit((string) $value)) {
            throw new InvalidArgumentException("Field '{$fieldName}' must be a non-negative integer.");
        }

        $number = (int) $value;
        if ($number > $maxValue) {
            throw new InvalidArgumentException("Field '{$fieldName}' is too large.");
        }

        return $number;
    }

    private static function buildListQuery(array $filters): array
    {
        $sql = 'SELECT * FROM sports WHERE 1 = 1';
        $params = [];

        if (isset($filters['search']) && $filters['search'] !== null) {
            $sql .= ' AND (name LIKE :name_search OR description LIKE :description_search)';
            $search = '%' . $filters['search'] . '%';
            $params[':name_search'] = $search;
            $params[':description_search'] = $search;
        }

        if (isset($filters['status']) && $filters['status'] !== null) {
            $sql .= ' AND status = :status';
            $params[':status'] = $filters['status'];
        }

        $sql .= ' ORDER BY name ASC';

        if (isset($filters['limit']) && $filters['limit'] > 0) {
            $sql .= ' LIMIT :limit';
        }

        return [$sql, $params];
    }

    private static function getSport(PDO $pdo, int $sportId): ?array
    {
        if (!self::tableExists($pdo, 'sports')) {
            return null;
        }

        $stmt = $pdo->prepare('SELECT * FROM sports WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $sportId]);
        $sport = $stmt->fetch();

        return is_array($sport) ? $sport : null;
    }

    public static function list(): void
    {
        try {
            $pdo = Database::getConnection();

            if (!self::tableExists($pdo, 'sports')) {
                Response::json(500, ['success' => false, 'message' => 'The sports table is not available in the configured database.']);
                return;
            }

            $search = self::normalizeText($_GET['search'] ?? null, 100);
            $status = self::normalizeText($_GET['status'] ?? null, 50);
            $limit = self::normalizePositiveInt($_GET['limit'] ?? null, 'limit', 500);

            [$sql, $params] = self::buildListQuery([
                'search' => $search,
                'status' => $status,
                'limit' => $limit,
            ]);

            $stmt = $pdo->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }

            if ($limit > 0) {
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            }

            $stmt->execute();
            $sports = $stmt->fetchAll();

            Response::json(200, ['success' => true, 'data' => $sports]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load sports.']);
        }
    }

    public static function details(int $sportId): void
    {
        try {
            $pdo = Database::getConnection();
            $sport = self::getSport($pdo, $sportId);

            if ($sport === null) {
                Response::json(404, ['success' => false, 'message' => 'Sport not found or the sports table is unavailable.']);
                return;
            }

            Response::json(200, ['success' => true, 'data' => $sport]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load sport details.']);
        }
    }
}
