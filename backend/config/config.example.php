<?php
declare(strict_types=1);

// Defaults. Prefer backend/.env; local.php and real SPORTSHUB_* process variables also work.
// Never put this directory under the web server document root.
return [
    'environment' => 'development',
    'app_key' => '', // Generate: php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    'database' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'nsbm_sportshub',
        'user' => '',
        'password' => '',
    ],
    'session' => [
        'name' => 'SPORTSHUBSESSID',
        'secure' => false, // Set true behind HTTPS in production.
        'path' => '', // Optional private PHP session storage directory, outside public/.
        'idle_seconds' => 7200,
        'absolute_seconds' => 43200,
    ],
];

