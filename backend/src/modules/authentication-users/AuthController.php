<?php
declare(strict_types=1);

namespace SportsHub;

final class AuthController
{
    public static function register(array $body): array
    {
        Validation::allowed($body, ['name', 'email', 'password', 'phone', 'student_id']);
        $password = Validation::password($body['password'] ?? null);
        unset($body['password']);
        $profile = Validation::profile($body);
        $user = UserRepository::create($profile, $password);
        Session::login($user);
        return Session::payload();
    }

    public static function login(array $body): array
    {
        Validation::allowed($body, ['email', 'password']);
        $email = $body['email'] ?? null;
        $password = $body['password'] ?? null;
        if (!is_string($email) || strlen($email) > 190 || filter_var(trim($email), FILTER_VALIDATE_EMAIL) === false) {
            throw new ApiException(422, 'validation_failed', 'Enter a valid email address.', ['email' => 'Enter a valid email address.']);
        }
        if (!is_string($password) || $password === '' || strlen($password) > 72 || str_contains($password, "\0")) {
            throw new ApiException(422, 'validation_failed', 'Enter your password.', ['password' => 'Enter a password of no more than 72 bytes.']);
        }
        $email = strtolower(trim($email));
        LoginRateLimiter::consume($email);
        $user = UserRepository::byEmail($email);
        // Use a valid dummy bcrypt hash so unknown accounts still do password work.
        $dummyHash = (PHP_VERSION_ID >= 80400 ? '$2y$12$' : '$2y$10$') . '92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi.';
        $hash = $user['password_hash'] ?? $dummyHash;
        $verified = password_verify($password, $hash);
        if ($user === null || !$verified || $user['status'] !== 'active') {
            throw new ApiException(401, 'invalid_credentials', 'The email or password is incorrect.');
        }
        $user = UserRepository::transaction(function ($connection) use ($user, $password): array {
            // Verification is expensive, so do it before taking the lock, then confirm
            // that neither the credential nor account status changed while it ran.
            $latest = UserRepository::find((int) $user['id'], true);
            if ($latest === null || $latest['status'] !== 'active' ||
                $latest['password_hash'] !== $user['password_hash'] ||
                (int) $latest['auth_version'] !== (int) $user['auth_version']) {
                throw new ApiException(401, 'invalid_credentials', 'The email or password is incorrect.');
            }
            if (password_needs_rehash($latest['password_hash'], PASSWORD_DEFAULT)) {
                $latest = UserRepository::update((int) $latest['id'], ['password_hash' => password_hash($password, PASSWORD_DEFAULT)]);
            }
            return $latest;
        });
        LoginRateLimiter::succeeded($email);
        Session::login($user);
        return Session::payload();
    }

    public static function logout(array $body): array
    {
        Validation::allowed($body, []);
        Session::clear();
        return Session::payload();
    }
}

