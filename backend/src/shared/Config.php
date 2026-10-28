<?php
declare(strict_types=1);

namespace SportsHub;

final class Config
{
    private static ?array $settings = null;

    public static function all(): array
    {
        if (self::$settings !== null) {
            return self::$settings;
        }

        $directory = dirname(__DIR__, 2) . '/config';
        $settings = require $directory . '/config.example.php';
        if (is_file($directory . '/local.php')) {
            $local = require $directory . '/local.php';
            if (!is_array($local)) {
                throw new \RuntimeException('The local configuration must return an array.');
            }
            $settings = array_replace_recursive($settings, $local);
        }

        // Resolve from the backend directory, regardless of the terminal's working directory.
        // Real process variables keep priority, including explicitly empty values.
        $fileVariables = Environment::fromFile(dirname($directory) . '/.env');

        $variables = [
            'SPORTSHUB_ENV' => ['environment'],
            'SPORTSHUB_APP_KEY' => ['app_key'],
            'SPORTSHUB_DB_HOST' => ['database', 'host'],
            'SPORTSHUB_DB_PORT' => ['database', 'port'],
            'SPORTSHUB_DB_NAME' => ['database', 'name'],
            'SPORTSHUB_DB_USER' => ['database', 'user'],
            'SPORTSHUB_DB_PASSWORD' => ['database', 'password'],
            'SPORTSHUB_SESSION_PATH' => ['session', 'path'],
        ];
        foreach ($variables as $variable => $keys) {
            $value = getenv($variable);
            if ($value === false) {
                $value = $fileVariables[$variable] ?? false;
            }
            if ($value === false) {
                continue;
            }
            if (count($keys) === 1) {
                $settings[$keys[0]] = $value;
            } else {
                $settings[$keys[0]][$keys[1]] = $value;
            }
        }
        $secure = getenv('SPORTSHUB_SESSION_SECURE');
        if ($secure === false) {
            $secure = $fileVariables['SPORTSHUB_SESSION_SECURE'] ?? false;
        }
        if ($secure !== false) {
            if (!in_array($secure, ['0', '1'], true)) {
                throw new \RuntimeException('SPORTSHUB_SESSION_SECURE must be 0 or 1.');
            }
            $settings['session']['secure'] = $secure === '1';
        }

        if (!in_array($settings['environment'], ['development', 'production'], true)) {
            throw new \RuntimeException('Invalid application environment.');
        }
        if ($settings['environment'] === 'production' && $settings['session']['secure'] !== true) {
            throw new \RuntimeException('Production requires secure session cookies.');
        }
        $database = $settings['database'];
        if (!is_string($database['host']) || !preg_match('/\A[a-zA-Z0-9.:-]+\z/', $database['host'])) {
            throw new \RuntimeException('Invalid database host.');
        }
        if (!preg_match('/\A[a-zA-Z][a-zA-Z0-9_]{0,63}\z/', (string) $database['name'])) {
            throw new \RuntimeException('Database names must start with a letter and contain only letters, numbers, or underscores.');
        }
        if (filter_var($database['port'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]) === false) {
            throw new \RuntimeException('Invalid database port.');
        }
        if (!is_string($database['user']) || trim($database['user']) === '') {
            throw new \RuntimeException('Set the database user in private configuration or SPORTSHUB_DB_USER.');
        }
        $settings['database']['port'] = (int) $database['port'];
        self::$settings = $settings;
        return $settings;
    }

    public static function requireAppKey(): string
    {
        $key = self::all()['app_key'];
        if (!is_string($key) || strlen($key) < 32) {
            throw new \RuntimeException('Set a random application key of at least 32 characters.');
        }
        return $key;
    }
}

