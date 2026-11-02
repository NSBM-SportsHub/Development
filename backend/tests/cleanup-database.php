<?php
declare(strict_types=1);

// Only the integration runner's randomly named database can be removed here.
require dirname(__DIR__) . '/src/shared/bootstrap.php';

$name = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($name) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $name)) {
    fwrite(STDERR, "Refusing to remove a database outside the isolated test namespace.\n");
    exit(1);
}
SportsHub\Database::connect(false)->exec('DROP DATABASE IF EXISTS `' . $name . '`');
