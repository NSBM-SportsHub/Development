<?php
declare(strict_types=1);

namespace SportsHub;

final class Session
{
    private static ?array $currentUser = null;
    private static bool $loaded = false;

    public static function start(): void
    {
        $settings = Config::all()['session'];
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.gc_maxlifetime', (string) $settings['absolute_seconds']);
        if ($settings['path'] !== '') {
            if (!is_dir($settings['path']) || !is_writable($settings['path'])) {
                throw new \RuntimeException('The configured session directory is not writable.');
            }
            session_save_path($settings['path']);
        }
        session_name($settings['name']);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => (bool) $settings['secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        if (!session_start()) {
            throw new \RuntimeException('The session could not be started.');
        }
        $now = time();
        if (isset($_SESSION['user_id']) && (
            $now - (int) ($_SESSION['last_seen'] ?? 0) > $settings['idle_seconds'] ||
            $now - (int) ($_SESSION['authenticated_at'] ?? 0) > $settings['absolute_seconds']
        )) {
            self::clear();
        }
        if (!isset($_SESSION['csrf_token'])) {
            self::rotateCsrf();
        }
        $_SESSION['last_seen'] = $now;
    }

    public static function csrf(): string
    {
        return $_SESSION['csrf_token'];
    }

    public static function rotateCsrf(): void
    {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    public static function verifyCsrf(): void
    {
        $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($provided) || !hash_equals(self::csrf(), $provided)) {
            throw new ApiException(403, 'csrf_mismatch', 'Your session token has changed. Refresh your session and try again.');
        }
    }

    public static function currentUser(): ?array
    {
        if (!self::$loaded) {
            self::$loaded = true;
            $id = $_SESSION['user_id'] ?? null;
            if (is_int($id) && $id > 0) {
                $user = UserRepository::find($id);
                if ($user !== null && $user['status'] === 'active' && (int) $user['auth_version'] === ($_SESSION['auth_version'] ?? null)) {
                    self::$currentUser = $user;
                } else {
                    self::clear();
                }
            }
        }
        return self::$currentUser;
    }

    public static function requireUser(): array
    {
        return self::currentUser() ?? throw new ApiException(401, 'unauthenticated', 'Sign in to continue.');
    }

    public static function requireAdmin(): array
    {
        $user = self::requireUser();
        if ($user['role'] !== 'admin') {
            throw new ApiException(403, 'forbidden', 'Administrator access is required.');
        }
        return $user;
    }

    public static function login(array $user): void
    {
        $_SESSION = [];
        if (!session_regenerate_id(true)) {
            throw new \RuntimeException('The session ID could not be regenerated.');
        }
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['auth_version'] = (int) $user['auth_version'];
        $_SESSION['authenticated_at'] = time();
        $_SESSION['last_seen'] = time();
        self::rotateCsrf();
        self::$currentUser = $user;
        self::$loaded = true;
    }

    public static function refreshAfterSecurityChange(array $user): void
    {
        self::login($user);
    }

    public static function updateCurrent(array $user): void
    {
        self::$currentUser = $user;
        self::$loaded = true;
    }

    public static function clear(): void
    {
        $_SESSION = [];
        if (!session_regenerate_id(true)) {
            throw new \RuntimeException('The session ID could not be regenerated.');
        }
        self::rotateCsrf();
        self::$currentUser = null;
        self::$loaded = true;
    }

    public static function payload(): array
    {
        $user = self::currentUser();
        return ['user' => $user === null ? null : UserRepository::publicUser($user), 'csrf_token' => self::csrf()];
    }
}

