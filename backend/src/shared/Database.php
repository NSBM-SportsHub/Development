<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

final class Database
{
    private static ?PDO $connection = null;

    public static function connect(bool $selectDatabase = true): PDO
    {
        $settings = Config::all()['database'];
        $dsn = 'mysql:host=' . $settings['host'] . ';port=' . $settings['port'] . ';charset=utf8mb4';
        if ($selectDatabase) {
            $dsn .= ';dbname=' . $settings['name'];
        }
        $connection = new PDO($dsn, $settings['user'], $settings['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
            PDO::ATTR_TIMEOUT => 5,
            PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
        ]);
        $connection->exec("SET time_zone = '+00:00'");
        return $connection;
    }

    public static function get(): PDO
    {
        return self::$connection ??= self::connect();
    }
}

