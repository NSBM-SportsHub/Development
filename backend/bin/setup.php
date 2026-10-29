<?php
declare(strict_types=1);

use SportsHub\Config;
use SportsHub\Database;

require dirname(__DIR__) . '/src/shared/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
if (in_array('--help', $argv, true)) {
    fwrite(STDOUT, "Usage: php backend/bin/setup.php\nConfigure SPORTSHUB_DB_* first. Creates the database and missing authentication, resource and booking tables; never alters or replaces existing tables.\n");
    exit(0);
}

try {
    $database = Config::all()['database']['name'];
    $connection = Database::connect(false);
    // Config already enforces a safe, bounded SQL identifier; values use prepared statements.
    $connection->exec('CREATE DATABASE IF NOT EXISTS `' . $database . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $connection->exec('USE `' . $database . '`');
    $expected = [
        'users' => [
            'id' => 'bigint unsigned', 'name' => 'varchar(100)', 'email' => 'varchar(190)',
            'password_hash' => 'varchar(255)', 'role' => "enum('student','admin')",
            'status' => "enum('active','inactive')", 'phone' => 'varchar(30)',
            'student_id' => 'varchar(50)', 'auth_version' => 'int unsigned',
            'created_at' => 'datetime', 'updated_at' => 'datetime', 'deleted_at' => 'datetime',
        ],
        'auth_rate_limits' => ['key_hash' => 'char(64)', 'attempts' => 'int unsigned', 'expires_at' => 'datetime'],
        'facilities' => [
            'id' => 'bigint unsigned', 'name' => 'varchar(120)', 'description' => 'text',
            'location' => 'varchar(160)', 'capacity' => 'int unsigned', 'is_active' => 'tinyint(1)',
            'created_at' => 'timestamp', 'updated_at' => 'timestamp',
        ],
        'equipment' => [
            'id' => 'bigint unsigned', 'name' => 'varchar(120)', 'description' => 'text',
            'total_quantity' => 'int unsigned', 'is_active' => 'tinyint(1)',
            'created_at' => 'timestamp', 'updated_at' => 'timestamp',
        ],
        'bookings' => [
            'id' => 'bigint unsigned', 'facility_id' => 'bigint unsigned', 'equipment_id' => 'bigint unsigned',
            'requested_by' => 'bigint unsigned', 'reviewed_by' => 'bigint unsigned',
            'starts_at' => 'datetime', 'ends_at' => 'datetime', 'quantity' => 'int unsigned',
            'notes' => 'varchar(1000)', 'status' => 'varchar(16)',
            'created_at' => 'timestamp', 'updated_at' => 'timestamp',
        ],
    ];
    foreach ($expected as $table => $columns) {
        $statement = $connection->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?');
        $statement->execute([$database, $table]);
        $engine = $statement->fetchColumn();
        if ($engine === false) {
            continue;
        }
        if (strtolower((string) $engine) !== 'innodb') {
            throw new RuntimeException('Existing table ' . $table . ' must use InnoDB. Review its schema manually; no changes were applied to it.');
        }
        $actual = [];
        foreach ($connection->query('SHOW COLUMNS FROM `' . $table . '`')->fetchAll() as $column) {
            $actual[$column['Field']] = strtolower($column['Type']);
        }
        foreach ($columns as $field => $type) {
            $actualType = $actual[$field] ?? null;
            if ($actualType !== null) {
                $actualType = preg_replace('/\b(bigint|int)\([0-9]+\)/', '$1', $actualType);
            }
            if ($actualType !== $type) {
                throw new RuntimeException('Existing table ' . $table . ' has an incompatible ' . $field . ' column. Review it manually; no changes were applied to it.');
            }
        }
        $indexes = $connection->query('SHOW INDEX FROM `' . $table . '`')->fetchAll();
        $uniqueColumns = [];
        foreach ($indexes as $index) {
            if ((int) $index['Non_unique'] === 0) {
                $uniqueColumns[$index['Key_name']][] = $index['Column_name'];
            }
        }
        $requiredUnique = match ($table) {
            'users' => ['id', 'email', 'student_id'],
            'auth_rate_limits' => ['key_hash'],
            default => ['id'],
        };
        foreach ($requiredUnique as $field) {
            if (!in_array([$field], $uniqueColumns, true)) {
                throw new RuntimeException('Existing table ' . $table . ' requires a unique ' . $field . ' index. Review it manually; no changes were applied to it.');
            }
        }
    }

    foreach (['001_authentication_users.sql', '002_resources_and_bookings.sql'] as $migration) {
        $sql = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/' . $migration);
        if ($sql === false) {
            throw new RuntimeException('The migration ' . $migration . ' could not be read.');
        }
        foreach (preg_split('/;\s*(?:\r?\n|$)/', $sql) as $statement) {
            if (trim($statement) !== '') {
                $connection->exec($statement);
            }
        }
    }
    fwrite(STDOUT, 'Database ' . $database . " is ready. Existing records were preserved.\n");
    fwrite(STDOUT, "Provision the first administrator with php backend/bin/create-admin.php.\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'Setup failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}

