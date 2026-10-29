<?php

declare(strict_types=1);

require_once __DIR__ . '/../../shared/Database.php';
require_once __DIR__ . '/../../shared/Response.php';
require_once __DIR__ . '/../../shared/Validator.php';

/**
 * Training session controller placeholder.
 *
 * The project does not yet define a real database schema or auth layer for training sessions.
 * This controller keeps the logic isolated and compatible with future schema integration by
 * validating input and using a small set of query helpers rather than hard-coding details.
 */
final class TrainingController
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
            throw new InvalidArgumentException('Field value is too long.');
        }

        return $trimmed;
    }

    private static function normalizeDate(?string $value, string $fieldName): string
    {
        if ($value === null || trim($value) === '') {
            throw new InvalidArgumentException("Field '{$fieldName}' is required.");
        }

        $date = DateTimeImmutable::createFromFormat('Y-m-d', trim($value));
        if ($date === false || $date->format('Y-m-d') !== trim($value)) {
            throw new InvalidArgumentException("Field '{$fieldName}' must be a valid date in YYYY-MM-DD format.");
        }

        return $date->format('Y-m-d');
    }

    private static function normalizeTime(?string $value, string $fieldName): string
    {
        if ($value === null || trim($value) === '') {
            throw new InvalidArgumentException("Field '{$fieldName}' is required.");
        }

        $time = DateTimeImmutable::createFromFormat('H:i', trim($value));
        if ($time === false || $time->format('H:i') !== trim($value)) {
            throw new InvalidArgumentException("Field '{$fieldName}' must be a valid time in HH:MM format.");
        }

        return $time->format('H:i');
    }

    private static function normalizePositiveInt(?string $value, string $fieldName, int $maxValue = 2147483647): int
    {
        if ($value === null || trim((string) $value) === '') {
            throw new InvalidArgumentException("Field '{$fieldName}' is required.");
        }

        if (!ctype_digit((string) $value)) {
            throw new InvalidArgumentException("Field '{$fieldName}' must be a positive integer.");
        }

        $number = (int) $value;
        if ($number <= 0 || $number > $maxValue) {
            throw new InvalidArgumentException("Field '{$fieldName}' is out of range.");
        }

        return $number;
    }

    private static function fetchSession(PDO $pdo, int $sessionId): ?array
    {
        if (!self::tableExists($pdo, 'training_sessions')) {
            return null;
        }

        $stmt = $pdo->prepare('SELECT * FROM training_sessions WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $sessionId]);
        $session = $stmt->fetch();

        return is_array($session) ? $session : null;
    }

    public static function list(): void
    {
        try {
            $pdo = Database::getConnection();

            if (!self::tableExists($pdo, 'training_sessions')) {
                Response::json(500, ['success' => false, 'message' => 'The training_sessions table is not available in the configured database.']);
                return;
            }

            $search = self::normalizeText($_GET['search'] ?? null, 100);
            $status = self::normalizeText($_GET['status'] ?? null, 50);
            $date = self::normalizeText($_GET['date'] ?? null, 10);
            $clubId = isset($_GET['club_id']) ? self::normalizePositiveInt((string) $_GET['club_id'], 'club_id', 2147483647) : null;

            $sql = 'SELECT * FROM training_sessions WHERE 1 = 1';
            $params = [];

            if ($search !== null) {
                $sql .= ' AND (title LIKE :title_search OR notes LIKE :notes_search)';
                $searchPattern = '%' . $search . '%';
                $params[':title_search'] = $searchPattern;
                $params[':notes_search'] = $searchPattern;
            }

            if ($status !== null) {
                $sql .= ' AND status = :status';
                $params[':status'] = $status;
            }

            if ($date !== null) {
                $sql .= ' AND session_date = :date';
                $params[':date'] = self::normalizeDate($date, 'date');
            }

            if ($clubId !== null) {
                $sql .= ' AND club_id = :club_id';
                $params[':club_id'] = $clubId;
            }

            $sql .= ' ORDER BY session_date ASC, start_time ASC';

            $stmt = $pdo->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }

            $stmt->execute();
            $sessions = $stmt->fetchAll();

            Response::json(200, ['success' => true, 'data' => $sessions]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load training sessions.']);
        }
    }

    public static function details(int $sessionId): void
    {
        try {
            $pdo = Database::getConnection();
            $session = self::fetchSession($pdo, $sessionId);

            if ($session === null) {
                Response::json(404, ['success' => false, 'message' => 'Training session not found or the training_sessions table is unavailable.']);
                return;
            }

            Response::json(200, ['success' => true, 'data' => $session]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load training session details.']);
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

            $title = self::normalizeText($input['title'] ?? null, 150);
            if ($title === null) {
                throw new InvalidArgumentException("Field 'title' is required.");
            }

            $status = self::normalizeText($input['status'] ?? 'scheduled', 50) ?? 'scheduled';
            $sessionDate = self::normalizeDate($input['session_date'] ?? null, 'session_date');
            $startTime = self::normalizeTime($input['start_time'] ?? null, 'start_time');
            $endTime = self::normalizeTime($input['end_time'] ?? null, 'end_time');
            $clubId = self::normalizePositiveInt((string) ($input['club_id'] ?? ''), 'club_id');
            $notes = self::normalizeText($input['notes'] ?? '', 2000) ?? '';

            if (strtotime($endTime) <= strtotime($startTime)) {
                throw new InvalidArgumentException("Field 'end_time' must be later than 'start_time'.");
            }

            $pdo = Database::getConnection();
            if (!self::tableExists($pdo, 'training_sessions')) {
                Response::json(500, ['success' => false, 'message' => 'The training_sessions table is not available in the configured database.']);
                return;
            }

            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            $clubExists = $pdo->prepare('SELECT id FROM clubs WHERE id = :id LIMIT 1');
            $clubExists->execute([':id' => $clubId]);
            if (!$clubExists->fetch()) {
                Response::json(400, ['success' => false, 'message' => 'Invalid club reference.']);
                return;
            }

            $insert = $pdo->prepare('INSERT INTO training_sessions (title, status, session_date, start_time, end_time, club_id, notes, created_at, updated_at) VALUES (:title, :status, :session_date, :start_time, :end_time, :club_id, :notes, NOW(), NOW())');
            $insert->execute([
                ':title' => $title,
                ':status' => $status,
                ':session_date' => $sessionDate,
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':club_id' => $clubId,
                ':notes' => $notes,
            ]);

            $sessionId = (int) $pdo->lastInsertId();
            $created = $pdo->prepare('SELECT * FROM training_sessions WHERE id = :id LIMIT 1');
            $created->execute([':id' => $sessionId]);

            Response::json(201, ['success' => true, 'message' => 'Training session created successfully.', 'data' => $created->fetch()]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to create training session.']);
        }
    }

    public static function update(int $sessionId): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
            Response::json(405, ['success' => false, 'message' => 'Method not allowed.']);
            return;
        }

        try {
            $input = Validator::decodeJsonObject((string) file_get_contents('php://input'));

            $pdo = Database::getConnection();
            $session = self::fetchSession($pdo, $sessionId);
            if ($session === null) {
                Response::json(404, ['success' => false, 'message' => 'Training session not found or the training_sessions table is unavailable.']);
                return;
            }

            $title = array_key_exists('title', $input) ? (self::normalizeText($input['title'] ?? null, 150) ?? $session['title']) : (string) ($session['title'] ?? '');
            $status = array_key_exists('status', $input) ? (self::normalizeText($input['status'] ?? null, 50) ?? 'scheduled') : (string) ($session['status'] ?? 'scheduled');
            $sessionDate = array_key_exists('session_date', $input) ? self::normalizeDate($input['session_date'] ?? null, 'session_date') : (string) ($session['session_date'] ?? '');
            $startTime = array_key_exists('start_time', $input) ? self::normalizeTime($input['start_time'] ?? null, 'start_time') : (string) ($session['start_time'] ?? '');
            $endTime = array_key_exists('end_time', $input) ? self::normalizeTime($input['end_time'] ?? null, 'end_time') : (string) ($session['end_time'] ?? '');
            $clubId = array_key_exists('club_id', $input) ? self::normalizePositiveInt((string) $input['club_id'], 'club_id') : (int) ($session['club_id'] ?? 0);
            $notes = array_key_exists('notes', $input) ? (self::normalizeText($input['notes'] ?? '', 2000) ?? '') : (string) ($session['notes'] ?? '');

            if (strtotime($endTime) <= strtotime($startTime)) {
                throw new InvalidArgumentException("Field 'end_time' must be later than 'start_time'.");
            }

            if (!self::tableExists($pdo, 'clubs')) {
                Response::json(500, ['success' => false, 'message' => 'The clubs table is not available in the configured database.']);
                return;
            }

            $clubExists = $pdo->prepare('SELECT id FROM clubs WHERE id = :id LIMIT 1');
            $clubExists->execute([':id' => $clubId]);
            if (!$clubExists->fetch()) {
                Response::json(400, ['success' => false, 'message' => 'Invalid club reference.']);
                return;
            }

            $update = $pdo->prepare('UPDATE training_sessions SET title = :title, status = :status, session_date = :session_date, start_time = :start_time, end_time = :end_time, club_id = :club_id, notes = :notes, updated_at = NOW() WHERE id = :id');
            $update->execute([
                ':title' => $title,
                ':status' => $status,
                ':session_date' => $sessionDate,
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':club_id' => $clubId,
                ':notes' => $notes,
                ':id' => $sessionId,
            ]);

            $updated = $pdo->prepare('SELECT * FROM training_sessions WHERE id = :id LIMIT 1');
            $updated->execute([':id' => $sessionId]);

            Response::json(200, ['success' => true, 'message' => 'Training session updated successfully.', 'data' => $updated->fetch()]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to update training session.']);
        }
    }

    public static function cancel(int $sessionId): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'PATCH' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
            Response::json(405, ['success' => false, 'message' => 'Method not allowed.']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $session = self::fetchSession($pdo, $sessionId);
            if ($session === null) {
                Response::json(404, ['success' => false, 'message' => 'Training session not found or the training_sessions table is unavailable.']);
                return;
            }

            $stmt = $pdo->prepare('UPDATE training_sessions SET status = :status, updated_at = NOW() WHERE id = :id');
            $stmt->execute([':status' => 'cancelled', ':id' => $sessionId]);

            Response::json(200, ['success' => true, 'message' => 'Training session cancelled successfully.']);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to cancel training session.']);
        }
    }
}
