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

// Session and CSRF permissions are enforced by SportsTrainingRoutes.
final class AttendanceController
{
    private static function rejectUnknownFields(array $data, array $allowed, string $kind): void
    {
        $unknown = array_diff(array_keys($data), $allowed);
        if ($unknown !== []) {
            throw new InvalidArgumentException('Unsupported ' . $kind . ': ' . reset($unknown) . '.');
        }
    }

    private static function logFailure(Throwable $exception): void
    {
        error_log($exception::class . ': ' . $exception->getMessage());
    }

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
            throw new InvalidArgumentException('Field value is too long.');
        }

        return $trimmed;
    }

    private static function normalizePositiveInt(mixed $value, string $fieldName, int $maxValue = PHP_INT_MAX): int
    {
        if ($value === null || $value === '') {
            throw new InvalidArgumentException("Field '{$fieldName}' is required.");
        }

        if (!is_string($value) && !is_int($value)) {
            throw new InvalidArgumentException("Field '{$fieldName}' must be a positive integer.");
        }

        if (!ctype_digit((string) $value)) {
            throw new InvalidArgumentException("Field '{$fieldName}' must be a positive integer.");
        }

        $number = filter_var((string) $value, FILTER_VALIDATE_INT);
        if ($number === false || $number <= 0 || $number > $maxValue) {
            throw new InvalidArgumentException("Field '{$fieldName}' is out of range.");
        }

        return $number;
    }

    private static function fetchAttendance(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM training_attendance WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        return is_array($row) ? $row : null;
    }

    public static function list(): void
    {
        try {
            self::rejectUnknownFields($_GET, ['session_id', 'participant_id', 'status'], 'query parameter');
            $pdo = Database::get();

            if (!self::tableExists($pdo, 'training_attendance')) {
                Response::json(500, ['success' => false, 'message' => 'The training_attendance table is not available in the configured database.']);
                return;
            }

            $sessionId = isset($_GET['session_id']) ? self::normalizePositiveInt($_GET['session_id'], 'session_id') : null;
            $participantId = isset($_GET['participant_id']) ? self::normalizePositiveInt($_GET['participant_id'], 'participant_id') : null;
            $status = self::normalizeText($_GET['status'] ?? null, 50);

            $sql = 'SELECT * FROM training_attendance WHERE 1 = 1';
            $params = [];
            $actor = Session::requireUser();
            if ($actor['role'] !== 'admin') {
                $sql .= ' AND (participant_id = :actor OR session_id IN (SELECT t.id FROM training_sessions t JOIN club_coaches cc ON cc.club_id = t.club_id WHERE cc.user_id = :coach AND cc.ended_at IS NULL))';
                $params[':actor'] = $actor['id'];
                $params[':coach'] = $actor['id'];
            }

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
            self::logFailure($exception);
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
            $input = Http::body();
            self::rejectUnknownFields($input, ['session_id', 'participant_id', 'status', 'notes'], 'field');

            $sessionId = self::normalizePositiveInt($input['session_id'] ?? '', 'session_id');
            $participantId = self::normalizePositiveInt($input['participant_id'] ?? '', 'participant_id');
            $status = array_key_exists('status', $input)
                ? self::normalizeText($input['status'], 50)
                : 'present';
            if (!in_array($status, ['present', 'absent', 'late', 'excused'], true)) {
                throw new InvalidArgumentException("Field 'status' must be a non-empty string.");
            }
            $notes = self::normalizeText($input['notes'] ?? '', 2000) ?? '';

            $pdo = Database::get();

            if (!self::tableExists($pdo, 'training_attendance')) {
                Response::json(500, ['success' => false, 'message' => 'The training_attendance table is not available in the configured database.']);
                return;
            }

            if (!self::tableExists($pdo, 'training_sessions')) {
                Response::json(500, ['success' => false, 'message' => 'The training_sessions table is not available in the configured database.']);
                return;
            }

            $sessionExists = $pdo->prepare("SELECT id FROM training_sessions WHERE id = :id AND status <> 'cancelled' LIMIT 1");
            $sessionExists->execute([':id' => $sessionId]);
            if (!$sessionExists->fetch()) {
                Response::json(400, ['success' => false, 'message' => 'Invalid training session reference.']);
                return;
            }

            $duplicate = $pdo->prepare('SELECT 1 FROM training_attendance WHERE session_id = :session_id AND participant_id = :participant_id LIMIT 1');
            $duplicate->execute([':session_id' => $sessionId, ':participant_id' => $participantId]);
            if ($duplicate->fetchColumn() !== false) {
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
            self::logFailure($exception);
            Response::json(500, ['success' => false, 'message' => 'Failed to record attendance.']);
        }
    }

    public static function details(int $id): void
    {
        try {
            $pdo = Database::get();
            if (!self::tableExists($pdo, 'training_attendance')) {
                Response::json(500, ['success' => false, 'message' => 'The training_attendance table is not available in the configured database.']);
                return;
            }

            $attendance = self::fetchAttendance($pdo, $id);

            if ($attendance === null) {
                Response::json(404, ['success' => false, 'message' => 'Attendance record not found.']);
                return;
            }

            Response::json(200, ['success' => true, 'data' => $attendance]);
        } catch (Throwable $exception) {
            self::logFailure($exception);
            Response::json(500, ['success' => false, 'message' => 'Failed to load attendance record.']);
        }
    }
}
