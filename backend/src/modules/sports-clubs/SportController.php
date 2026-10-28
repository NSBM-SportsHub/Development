<?php

declare(strict_types=1);

require_once __DIR__ . '/../../shared/Database.php';
require_once __DIR__ . '/../../shared/Response.php';

final class SportController
{
    private static function tableExists(PDO $pdo, string $tableName): bool
    {
        try {
            $stmt = $pdo->query("SHOW TABLES LIKE '{$tableName}'");
            return $stmt !== false && $stmt->fetch() !== false;
        } catch (Throwable $exception) {
            return false;
        }
    }

    private static function normalizeText(?string $value, int $maxLength = 255): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (mb_strlen($trimmed) > $maxLength) {
            throw new InvalidArgumentException("Filter value is too long.");
        }

        return $trimmed;
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
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 0;

            if ($limit < 0) {
                throw new InvalidArgumentException('Limit must be zero or greater.');
            }

            $sql = 'SELECT * FROM sports WHERE 1 = 1';
            $params = [];

            if ($search !== null) {
                $sql .= ' AND (name LIKE :search OR description LIKE :search)';
                $params[':search'] = '%' . $search . '%';
            }

            if ($status !== null) {
                $sql .= ' AND status = :status';
                $params[':status'] = $status;
            }

            $sql .= ' ORDER BY name ASC';

            if ($limit > 0) {
                $sql .= ' LIMIT :limit';
            }

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

            if (!self::tableExists($pdo, 'sports')) {
                Response::json(500, ['success' => false, 'message' => 'The sports table is not available in the configured database.']);
                return;
            }

            $stmt = $pdo->prepare('SELECT * FROM sports WHERE id = :id LIMIT 1');
            $stmt->execute([':id' => $sportId]);
            $sport = $stmt->fetch();

            if (!$sport) {
                Response::json(404, ['success' => false, 'message' => 'Sport not found.']);
                return;
            }

            Response::json(200, ['success' => true, 'data' => $sport]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load sport details.']);
        }
    }
}
