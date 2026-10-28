<?php

declare(strict_types=1);

final class Database
{
    public static function getConnection(): PDO
    {
        $dsn = getenv('DB_DSN') ?: 'mysql:host=127.0.0.1;dbname=sports_hub;charset=utf8mb4';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS') ?: '';

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        try {
            return new PDO($dsn, $user, $pass, $options);
        } catch (PDOException $exception) {
            throw new RuntimeException('Database connection failed. Configure DB_DSN, DB_USER, and DB_PASS first.', 0, $exception);
        }
    }
}
