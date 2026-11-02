<?php
declare(strict_types=1);

namespace SportsHub;

final class LoginRateLimiter
{
    private const WINDOW_SECONDS = 900;

    private static function keys(string $email): array
    {
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
        $secret = Config::requireAppKey();
        return [
            hash_hmac('sha256', 'ip:' . $ip, $secret) => 100,
            hash_hmac('sha256', 'email:' . $email, $secret) => 30,
            hash_hmac('sha256', 'pair:' . $ip . ':' . $email, $secret) => 10,
        ];
    }

    public static function consume(string $email): void
    {
        $keys = self::keys($email);
        // Check the address before creating any account-specific counters, so a
        // throttled source cannot grow the table by sending arbitrary new emails.
        $ipKey = array_key_first($keys);
        $blocked = self::consumeKeys([$ipKey => $keys[$ipKey]]);
        unset($keys[$ipKey]);
        if (!$blocked) {
            $blocked = self::consumeKeys($keys);
        }
        // Expired counters retain neither addresses nor email; cleanup is bounded.
        Database::get()->exec('DELETE FROM auth_rate_limits WHERE expires_at < UTC_TIMESTAMP() LIMIT 100');
        if ($blocked) {
            header('Retry-After: ' . self::WINDOW_SECONDS);
            throw new ApiException(429, 'rate_limited', 'Too many sign-in attempts. Try again in 15 minutes.');
        }
    }

    private static function consumeKeys(array $keys): bool
    {
        ksort($keys);
        return UserRepository::transaction(function ($connection) use ($keys): bool {
            $insert = $connection->prepare('INSERT INTO auth_rate_limits (key_hash, attempts, expires_at) VALUES (?, 0, ?) ON DUPLICATE KEY UPDATE key_hash = VALUES(key_hash)');
            $read = $connection->prepare('SELECT attempts, expires_at FROM auth_rate_limits WHERE key_hash = ? FOR UPDATE');
            $update = $connection->prepare('UPDATE auth_rate_limits SET attempts = ?, expires_at = ? WHERE key_hash = ?');
            $now = time();
            $blocked = false;
            foreach ($keys as $key => $maximum) {
                $expires = gmdate('Y-m-d H:i:s', $now + self::WINDOW_SECONDS);
                $insert->execute([$key, $expires]);
                $read->execute([$key]);
                $row = $read->fetch();
                $attempts = (int) $row['attempts'];
                if ($row['expires_at'] <= gmdate('Y-m-d H:i:s', $now)) {
                    $attempts = 0;
                } else {
                    $expires = $row['expires_at'];
                }
                $attempts = min($attempts + 1, $maximum + 1);
                $update->execute([$attempts, $expires, $key]);
                $blocked = $blocked || $attempts > $maximum;
            }
            return $blocked;
        });
    }

    public static function succeeded(string $email): void
    {
        $keys = array_keys(self::keys($email));
        // Retain the per-IP ceiling, but clear the account and IP/account failure counters.
        $statement = Database::get()->prepare('DELETE FROM auth_rate_limits WHERE key_hash IN (?, ?)');
        $statement->execute([$keys[1], $keys[2]]);
    }
}
