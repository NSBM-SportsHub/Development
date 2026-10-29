<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;
use PDOException;

final class UserRepository
{
    public static function find(int $id, bool $lock = false): ?array
    {
        $statement = Database::get()->prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute([$id]);
        return $statement->fetch() ?: null;
    }

    public static function byEmail(string $email): ?array
    {
        $statement = Database::get()->prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL');
        $statement->execute([$email]);
        return $statement->fetch() ?: null;
    }

    public static function publicUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'status' => $user['status'],
            'phone' => $user['phone'],
            'student_id' => $user['student_id'],
            'created_at' => self::timestamp($user['created_at']),
            'updated_at' => self::timestamp($user['updated_at']),
        ];
    }

    private static function timestamp(string $value): string
    {
        return str_replace(' ', 'T', $value) . 'Z';
    }

    public static function create(array $profile, string $password): array
    {
        $statement = Database::get()->prepare(
            'INSERT INTO users (name, email, password_hash, role, status, phone, student_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        try {
            $statement->execute([
                $profile['name'], $profile['email'], password_hash($password, PASSWORD_DEFAULT),
                $profile['role'] ?? 'student', $profile['status'] ?? 'active',
                $profile['phone'] ?? null, $profile['student_id'] ?? null,
            ]);
        } catch (PDOException $exception) {
            self::handleDuplicate($exception);
        }
        $user = self::find((int) Database::get()->lastInsertId());
        if ($user === null) {
            throw new \RuntimeException('The created user could not be loaded.');
        }
        return $user;
    }

    public static function update(int $id, array $changes, bool $revokeSessions = false): array
    {
        $allowed = ['name', 'email', 'phone', 'student_id', 'role', 'status', 'password_hash', 'deleted_at'];
        $assignments = [];
        $values = [];
        foreach ($changes as $field => $value) {
            if (!in_array($field, $allowed, true)) {
                throw new \LogicException('Unsupported internal user update.');
            }
            $assignments[] = $field . ' = ?';
            $values[] = $value;
        }
        if ($revokeSessions) {
            $assignments[] = 'auth_version = auth_version + 1';
        }
        if ($assignments !== []) {
            $assignments[] = 'updated_at = UTC_TIMESTAMP()';
            $values[] = $id;
            $statement = Database::get()->prepare('UPDATE users SET ' . implode(', ', $assignments) . ' WHERE id = ? AND deleted_at IS NULL');
            try {
                $statement->execute($values);
            } catch (PDOException $exception) {
                self::handleDuplicate($exception);
            }
        }
        return self::find($id) ?? [];
    }

    private static function handleDuplicate(PDOException $exception): void
    {
        if (($exception->errorInfo[1] ?? null) === 1062) {
            $field = str_contains($exception->getMessage(), 'uq_users_student_id') ? 'student_id' : 'email';
            throw new ApiException(409, 'duplicate_user', 'A user with these details already exists.', [
                $field => $field === 'email' ? 'This email is already in use.' : 'This student ID is already in use.',
            ]);
        }
        throw $exception;
    }

    public static function transaction(callable $callback): mixed
    {
        $connection = Database::get();
        $connection->beginTransaction();
        try {
            $result = $callback($connection);
            $connection->commit();
            return $result;
        } catch (\Throwable $exception) {
            if ($connection->inTransaction()) {
                $connection->rollBack();
            }
            throw $exception;
        }
    }

    // Every administrative mutation takes these locks in the same order. This also
    // serializes concurrent last-admin checks across different PHP sessions.
    public static function lockActiveAdmins(int $actorId): array
    {
        $admins = Database::get()->query(
            "SELECT id FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL ORDER BY id FOR UPDATE"
        )->fetchAll(PDO::FETCH_COLUMN);
        $ids = array_map('intval', $admins);
        if (!in_array($actorId, $ids, true)) {
            throw new ApiException(403, 'forbidden', 'An active administrator account is required.');
        }
        return $ids;
    }
}
