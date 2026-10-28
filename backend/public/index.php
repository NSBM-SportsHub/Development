<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/shared/http.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/modules/resources/ResourceController.php';
require_once __DIR__ . '/../src/modules/bookings/BookingController.php';

ini_set('display_errors', '0');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
error_reporting(E_ALL);

session_set_cookie_params([
    'httponly' => true,
    'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/',
]);
session_start();

set_exception_handler(static function (Throwable $exception): void {
    error_log((string) $exception);
    sendJson(['error' => 'An unexpected server error occurred.'], 500);
});

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (!is_string($path)) {
    routeNotFound();
}

if ($path === '/api/session' && $method === 'GET') {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    $sessionUser = $_SESSION['user'] ?? null;
    $publicUser = null;
    if (is_array($sessionUser) && isset($sessionUser['id'], $sessionUser['role'])) {
        $sessionUserId = filter_var($sessionUser['id'], FILTER_VALIDATE_INT);
        if ($sessionUserId !== false
            && $sessionUserId > 0
            && in_array($sessionUser['role'], ['Student', 'Admin'], true)) {
            $publicUser = ['id' => $sessionUserId, 'role' => $sessionUser['role']];
        }
    }
    sendJson([
        'data' => [
            'user' => $publicUser,
            'csrf_token' => $_SESSION['csrf_token'],
        ],
    ]);
}

$user = currentUser();
$routeDefinitions = [
    'facilities' => ['type' => 'facility', 'table' => 'facilities'],
    'equipment' => ['type' => 'equipment', 'table' => 'equipment'],
];

foreach ($routeDefinitions as $route => $definition) {
    if (preg_match('#^/api/' . $route . '(?:/([1-9][0-9]*))?$#', $path, $matches) === 1) {
        $id = isset($matches[1]) ? filter_var($matches[1], FILTER_VALIDATE_INT) : null;
        if (isset($matches[1]) && ($id === false || $id < 1)) {
            sendJson(['error' => 'Identifier is invalid.'], 400);
        }
        $controller = new ResourceController(
            database(),
            $definition['type'],
            $definition['table']
        );
        $controller->dispatch($method, $id, $user);
    }
}

if (preg_match('#^/api/bookings(?:/([1-9][0-9]*))?$#', $path, $matches) === 1) {
    $id = isset($matches[1]) ? filter_var($matches[1], FILTER_VALIDATE_INT) : null;
    if (isset($matches[1]) && ($id === false || $id < 1)) {
        sendJson(['error' => 'Identifier is invalid.'], 400);
    }
    (new BookingController(database()))->dispatch($method, $id, $user);
}

routeNotFound();
