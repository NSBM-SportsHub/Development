<?php

declare(strict_types=1);

require_once __DIR__ . '/../../shared/Database.php';
require_once __DIR__ . '/../../shared/Response.php';

/**
 * Attendance controller.
 *
 * The project does not yet expose a confirmed attendance schema or auth layer. This controller
 * keeps its queries isolated and validation explicit so the real schema can be dropped in later
 * without rewriting the module's public behavior.
 */
final class AttendanceController
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

    private static function fetchAttendance(PDO $pdo, int $id): ?array
    {
        if (!self::tableExists($pdo, 'training_attendance')) {
            return null;
        }

        $stmt = $pdo->prepare('SELECT * FROM training_attendance WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        return is_array($row) ? $row : null;
    }

    public static function list(): void
    {
        try {
            $pdo = Database::getConnection();

            if (!self::tableExists($pdo, 'training_attendance')) {
                Response::json(500, ['success' => false, 'message' => 'The training_attendance table is not available in the configured database.']);
                return;
            }

            $sessionId = isset($_GET['session_id']) ? self::normalizePositiveInt((string) $_GET['session_id'], 'session_id') : null;
            $participantId = isset($_GET['participant_id']) ? self::normalizePositiveInt((string) $_GET['participant_id'], 'participant_id') : null;
            $status = self::normalizeText($_GET['status'] ?? null, 50);

            $sql = 'SELECT * FROM training_attendance WHERE 1 = 1';
            $params = [];

            if ($sessionId !== null) {
                $sql .= ' AND session_id = :session_id';
                $params[':session_id'] = $sessionId;
            }

            if ($participantId !== null) {
                $sql .= ' AND participant_id = :participant_id';
                $params[':participant_id'] = $participantId;
            }

            if ($status !== null) {
                $sql .= ' AND status = :status';
                $params[':status'] = $status;
            }

            $sql .= ' ORDER BY recorded_at DESC';

            $stmt = $pdo->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }

            $stmt->execute();
            $rows = $stmt->fetchAll();

            Response::json(200, ['success' => true, 'data' => $rows]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load attendance records.']);
        }
    }

    public static function create(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            Response::json(405, ['success' => false, 'message' => 'Method not allowed.']);
            return;
        }

        try {
            $input = json_decode((string) file_get_contents('php://input') ?: '[]', true);
            if (!is_array($input)) {
                throw new InvalidArgumentException('Request body must be a JSON object.');
            }

            $sessionId = self::normalizePositiveInt((string) ($input['session_id'] ?? ''), 'session_id');
            $participantId = self::normalizePositiveInt((string) ($input['participant_id'] ?? ''), 'participant_id');
            $status = self::normalizeText($input['status'] ?? 'present', 50) ?? 'present';
            $notes = self::normalizeText($input['notes'] ?? '', 2000) ?? '';

            $pdo = Database::getConnection();

            if (!self::tableExists($pdo, 'training_attendance')) {
                Response::json(500, ['success' => false, 'message' => 'The training_attendance table is not available in the configured database.']);
                return;
            }

            if (!self::tableExists($pdo, 'training_sessions')) {
                Response::json(500, ['success' => false, 'message' => 'The training_sessions table is not available in the configured database.']);
                return;
            }

            $sessionExists = $pdo->prepare('SELECT id FROM training_sessions WHERE id = :id LIMIT 1');
            $sessionExists->execute([':id' => $sessionId]);
            if (!$sessionExists->fetch()) {
                Response::json(400, ['success' => false, 'message' => 'Invalid training session reference.']);
                return;
            }

            $duplicate = $pdo->prepare('SELECT id FROM training_attendance WHERE session_id = :session_id AND participant_id = :participant_id LIMIT 1');
            $duplicate->execute([':session_id' => $sessionId, ':participant_id' => $participantId]);
            if ($duplicate->fetch()) {
                Response::json(409, ['success' => false, 'message' => 'Attendance for this participant and session already exists.']);
                return;
            }

            $insert = $pdo->prepare('INSERT INTO training_attendance (session_id, participant_id, status, notes, recorded_at) VALUES (:session_id, :participant_id, :status, :notes, NOW())');
            $insert->execute([
                ':session_id' => $sessionId,
                ':participant_id' => $participantId,
                ':status' => $status,
                ':notes' => $notes,
            ]);

            $id = (int) $pdo->lastInsertId();
            $saved = $pdo->prepare('SELECT * FROM training_attendance WHERE id = :id LIMIT 1');
            $saved->execute([':id' => $id]);

            Response::json(201, ['success' => true, 'message' => 'Attendance recorded successfully.', 'data' => $saved->fetch()]);
        } catch (InvalidArgumentException $exception) {
            Response::json(400, ['success' => false, 'message' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to record attendance.']);
        }
    }

    public static function details(int $id): void
    {
        try {
            $pdo = Database::getConnection();
            $attendance = self::fetchAttendance($pdo, $id);

            if ($attendance === null) {
                Response::json(404, ['success' => false, 'message' => 'Attendance record not found or the training_attendance table is unavailable.']);
                return;
            }

            Response::json(200, ['success' => true, 'data' => $attendance]);
        } catch (Throwable $exception) {
            Response::json(500, ['success' => false, 'message' => 'Failed to load attendance record.']);
        }
    }
}
