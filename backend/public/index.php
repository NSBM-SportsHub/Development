<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/shared/Response.php';
require_once __DIR__ . '/../src/modules/sports-clubs/ClubController.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rawPath = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($rawPath, PHP_URL_PATH) ?: '/';
$path = preg_replace('#/+#', '/', $path);
$segments = array_values(array_filter(explode('/', trim($path, '/')), 'strlen'));

if ($segments === [] || $segments[0] !== 'api') {
    Response::json(404, ['success' => false, 'message' => 'API endpoint not found.']);
    exit;
}

if (count($segments) >= 2 && $segments[1] === 'clubs') {
    $clubId = null;
    $archiveMode = false;

    if (count($segments) >= 3 && is_numeric($segments[2])) {
        $clubId = (int) $segments[2];
    }

    if (count($segments) >= 4 && $segments[3] === 'archive') {
        $archiveMode = true;
    }

    if ($method === 'GET' && count($segments) === 2) {
        ClubController::list();
        exit;
    }

    if ($method === 'GET' && count($segments) === 3 && $clubId !== null) {
        ClubController::details($clubId);
        exit;
    }

    if ($method === 'POST' && count($segments) === 2) {
        ClubController::create();
        exit;
    }

    if (($method === 'PUT' || $method === 'PATCH') && count($segments) === 3 && $clubId !== null && !$archiveMode) {
        ClubController::update($clubId);
        exit;
    }

    if ($method === 'PATCH' && count($segments) === 4 && $clubId !== null && $archiveMode) {
        ClubController::archive($clubId);
        exit;
    }

    if ($method === 'DELETE' && count($segments) === 3 && $clubId !== null) {
        ClubController::delete($clubId);
        exit;
    }

    Response::json(404, ['success' => false, 'message' => 'Club route not found.']);
    exit;
}

Response::json(404, ['success' => false, 'message' => 'API endpoint not found.']);
