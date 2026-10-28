<?php
declare(strict_types=1);

namespace SportsHub;

final class UserController
{
    public static function me(): array
    {
        return UserRepository::publicUser(Session::requireUser());
    }

    public static function updateMe(array $body): array
    {
        $actor = Session::requireUser();
        Validation::allowed($body, ['name', 'email', 'phone', 'student_id', 'current_password']);
        $currentPassword = $body['current_password'] ?? null;
        unset($body['current_password']);
        $changes = Validation::profile($body, true);
        self::requireChanges($changes);
        $emailChanged = false;
        $user = UserRepository::transaction(function () use ($actor, $changes, $currentPassword, &$emailChanged): array {
            $user = self::lockCurrent($actor);
            $emailChanged = isset($changes['email']) && $changes['email'] !== $user['email'];
            if ($emailChanged) {
                $password = Validation::currentPassword($currentPassword);
                if (!password_verify($password, $user['password_hash'])) {
                    throw new ApiException(422, 'validation_failed', 'The current password is incorrect.', ['current_password' => 'The current password is incorrect.']);
                }
            }
            return UserRepository::update((int) $user['id'], $changes, $emailChanged);
        });
        if ($emailChanged) {
            Session::refreshAfterSecurityChange($user);
        } else {
            Session::updateCurrent($user);
        }
        return UserRepository::publicUser($user);
    }

    public static function password(array $body): array
    {
        $actor = Session::requireUser();
        Validation::allowed($body, ['current_password', 'new_password']);
        $currentPassword = Validation::currentPassword($body['current_password'] ?? null);
        $newPassword = Validation::password($body['new_password'] ?? null, 'new_password');
        $user = UserRepository::transaction(function () use ($actor, $currentPassword, $newPassword): array {
            $user = self::lockCurrent($actor);
            if (!password_verify($currentPassword, $user['password_hash'])) {
                throw new ApiException(422, 'validation_failed', 'The current password is incorrect.', ['current_password' => 'The current password is incorrect.']);
            }
            return UserRepository::update((int) $user['id'], ['password_hash' => password_hash($newPassword, PASSWORD_DEFAULT)], true);
        });
        Session::refreshAfterSecurityChange($user);
        return ['message' => 'Password changed. Other sessions have been signed out.'];
    }

    private static function lockCurrent(array $actor): array
    {
        $user = UserRepository::find((int) $actor['id'], true);
        if ($user === null || $user['status'] !== 'active' || (int) $user['auth_version'] !== (int) $actor['auth_version']) {
            throw new ApiException(401, 'unauthenticated', 'Your session has expired. Sign in again.');
        }
        return $user;
    }

    public static function listing(array $query): array
    {
        Session::requireAdmin();
        Validation::allowed($query, ['page', 'per_page', 'search', 'role', 'status']);
        $page = Validation::positiveInteger($query['page'] ?? null, 'page', 1, 1000000);
        $perPage = Validation::positiveInteger($query['per_page'] ?? null, 'per_page', 10, 100);
        $clauses = ['deleted_at IS NULL'];
        $parameters = [];
        foreach (['role' => ['student', 'admin'], 'status' => ['active', 'inactive']] as $field => $values) {
            if (!isset($query[$field]) || $query[$field] === '') {
                continue;
            }
            if (!is_string($query[$field]) || !in_array($query[$field], $values, true)) {
                throw new ApiException(422, 'validation_failed', 'Check the query parameters.', [$field => 'Choose a valid ' . $field . '.']);
            }
            $clauses[] = $field . ' = ?';
            $parameters[] = $query[$field];
        }
        if (isset($query['search']) && $query['search'] !== '') {
            if (!is_string($query['search']) || strlen($query['search']) > 100) {
                throw new ApiException(422, 'validation_failed', 'Check the query parameters.', ['search' => 'Search with no more than 100 characters.']);
            }
            $search = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], trim($query['search'])) . '%';
            $clauses[] = "(name LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR student_id LIKE ? ESCAPE '!')";
            array_push($parameters, $search, $search, $search);
        }
        $where = implode(' AND ', $clauses);
        $count = Database::get()->prepare('SELECT COUNT(*) FROM users WHERE ' . $where);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        $offset = ($page - 1) * $perPage;
        // Limits are validated integers, never raw request strings.
        $statement = Database::get()->prepare('SELECT * FROM users WHERE ' . $where . ' ORDER BY id DESC LIMIT ' . $perPage . ' OFFSET ' . $offset);
        $statement->execute($parameters);
        return [
            'users' => array_map([UserRepository::class, 'publicUser'], $statement->fetchAll()),
            'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int) ceil($total / $perPage)],
        ];
    }

    public static function show(int $id): array
    {
        Session::requireAdmin();
        return UserRepository::publicUser(self::requireTarget($id));
    }

    public static function create(array $body): array
    {
        $actor = Session::requireAdmin();
        Validation::allowed($body, ['name', 'email', 'password', 'role', 'status', 'phone', 'student_id']);
        $password = Validation::password($body['password'] ?? null);
        unset($body['password']);
        $profile = Validation::profile($body, false, true);
        $user = UserRepository::transaction(function () use ($actor, $profile, $password): array {
            UserRepository::lockActiveAdmins((int) $actor['id']);
            self::lockCurrent($actor);
            return UserRepository::create($profile, $password);
        });
        return UserRepository::publicUser($user);
    }

    public static function update(int $id, array $body): array
    {
        $actor = Session::requireAdmin();
        $changes = Validation::profile($body, true, true);
        self::requireChanges($changes);
        $user = UserRepository::transaction(function () use ($actor, $id, $changes): array {
            $adminIds = UserRepository::lockActiveAdmins((int) $actor['id']);
            self::lockCurrent($actor);
            $user = self::requireTarget($id, true);
            $nextRole = $changes['role'] ?? $user['role'];
            $nextStatus = $changes['status'] ?? $user['status'];
            if ($id === (int) $actor['id'] && ($nextRole !== 'admin' || $nextStatus !== 'active')) {
                throw new ApiException(409, 'self_protection', 'You cannot demote or deactivate your own administrator account.');
            }
            if (in_array($id, $adminIds, true) && ($nextRole !== 'admin' || $nextStatus !== 'active') && count($adminIds) <= 1) {
                throw new ApiException(409, 'last_admin', 'At least one active administrator must remain.');
            }
            $securityChanged = $nextRole !== $user['role'] || $nextStatus !== $user['status'] ||
                (isset($changes['email']) && $changes['email'] !== $user['email']);
            return UserRepository::update($id, $changes, $securityChanged);
        });
        if ($id === (int) $actor['id']) {
            if ((int) $user['auth_version'] !== (int) $actor['auth_version']) {
                Session::refreshAfterSecurityChange($user);
            } else {
                Session::updateCurrent($user);
            }
        }
        return UserRepository::publicUser($user);
    }

    public static function delete(int $id, array $body): array
    {
        $actor = Session::requireAdmin();
        Validation::allowed($body, []);
        UserRepository::transaction(function () use ($actor, $id): void {
            $adminIds = UserRepository::lockActiveAdmins((int) $actor['id']);
            self::lockCurrent($actor);
            $user = self::requireTarget($id, true);
            if ($id === (int) $actor['id']) {
                throw new ApiException(409, 'self_protection', 'You cannot archive your own administrator account.');
            }
            if (in_array($id, $adminIds, true) && count($adminIds) <= 1) {
                throw new ApiException(409, 'last_admin', 'At least one active administrator must remain.');
            }
            UserRepository::update($id, ['deleted_at' => gmdate('Y-m-d H:i:s'), 'status' => 'inactive'], true);
        });
        return ['message' => 'User archived.'];
    }

    private static function requireTarget(int $id, bool $lock = false): array
    {
        return UserRepository::find($id, $lock) ?? throw new ApiException(404, 'user_not_found', 'This user could not be found.');
    }

    private static function requireChanges(array $changes): void
    {
        if ($changes === []) {
            throw new ApiException(422, 'validation_failed', 'Submit at least one field to update.');
        }
    }
}

