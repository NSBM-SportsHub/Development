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
    private const MAX_LIMIT = 500;

    private static function tableExists(PDO $pdo, string $tableName): bool
    {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $tableName]);

        return $stmt->fetchColumn() !== false;
    }

    private static function rejectUnknownFilters(array $filters): void
    {
        $unknown = array_diff(array_keys($filters), ['search', 'is_active', 'limit']);
        if ($unknown !== []) {
            throw new InvalidArgumentException('Unsupported query parameter: ' . reset($unknown) . '.');
        }
    }

    private static function normalizeActiveFilter(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (!is_string($value) || ($value !== '0' && $value !== '1')) {
            throw new InvalidArgumentException("Field 'is_active' must be 0 or 1.");
        }

        return (int) $value;
    }

    private static function normalizeLimit(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if ((!is_string($value) && !is_int($value)) || !ctype_digit((string) $value)) {
            throw new InvalidArgumentException("Field 'limit' must be a positive integer.");
        }

        $limit = filter_var((string) $value, FILTER_VALIDATE_INT);
        if ($limit === false || $limit < 1 || $limit > self::MAX_LIMIT) {
            throw new InvalidArgumentException("Field 'limit' must be between 1 and " . self::MAX_LIMIT . '.');
        }

        return $limit;
    }

    private static function logFailure(Throwable $exception): void
    {
        error_log($exception::class . ': ' . $exception->getMessage());
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

        if (isset($filters['is_active']) && $filters['is_active'] !== null) {
            $sql .= ' AND is_active = :is_active';
            $params[':is_active'] = $filters['is_active'];
        }

        $sql .= ' ORDER BY name ASC';

        if (isset($filters['limit']) && $filters['limit'] !== null) {
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
            self::rejectUnknownFilters($_GET);
            $pdo = Database::getConnection();

            if (!self::tableExists($pdo, 'sports')) {
                Response::json(500, ['success' => false, 'message' => 'The sports table is not available in the configured database.']);
                return;
            }

            $search = self::normalizeText($_GET['search'] ?? null, 100);
            $isActive = self::normalizeActiveFilter($_GET['is_active'] ?? null);
            $limit = self::normalizeLimit($_GET['limit'] ?? null);

            [$sql, $params] = self::buildListQuery([
                'search' => $search,
                'is_active' => $isActive,
                'limit' => $limit,
            ]);

            $stmt = $pdo->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }

            if ($limit !== null) {
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            }

            $stmt->execute();
            $sports = $stmt->fetchAll();

            Response::json(200, ['success' => true, 'data' => $sports]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            self::logFailure($exception);
            Response::json(500, ['success' => false, 'message' => 'Failed to load sports.']);
        }
    }

    public static function details(int $sportId): void
    {
        try {
            $pdo = Database::getConnection();
            if (!self::tableExists($pdo, 'sports')) {
                Response::json(500, ['success' => false, 'message' => 'The sports table is not available in the configured database.']);
                return;
            }

            $sport = self::getSport($pdo, $sportId);

            if ($sport === null) {
                Response::json(404, ['success' => false, 'message' => 'Sport not found.']);
                return;
            }

            Response::json(200, ['success' => true, 'data' => $sport]);
        } catch (Throwable $exception) {
            self::logFailure($exception);
            Response::json(500, ['success' => false, 'message' => 'Failed to load sport details.']);
        }
    }
}
