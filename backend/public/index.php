<?php
declare(strict_types=1);

use SportsHub\ApiException;
use SportsHub\AuthController;
use SportsHub\BookingController;
use SportsHub\Config;
use SportsHub\Database;
use SportsHub\Http;
use SportsHub\MembershipController;
use SportsHub\ResourceController;
use SportsHub\Session;
use SportsHub\UserController;

require dirname(__DIR__) . '/src/shared/bootstrap.php';
Http::headers();

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (!is_string($path)) {
        throw new ApiException(400, 'invalid_request', 'The request URL is invalid.');
    }
    $routes = [
        '/api/health' => ['GET'],
        '/api/auth/session' => ['GET'],
        '/api/auth/register' => ['POST'],
        '/api/auth/login' => ['POST'],
        '/api/auth/logout' => ['POST'],
        '/api/users/me' => ['GET', 'PATCH'],
        '/api/users/me/password' => ['PATCH'],
        '/api/users' => ['GET', 'POST'],
    ];
    $userId = null;
    $moduleRoute = null;
    $moduleId = null;
    if (preg_match('~\A/api/(facilities|equipment|bookings)(?:/([1-9][0-9]{0,18}))?\z~', $path, $match)) {
        $moduleRoute = $match[1];
        if (isset($match[2])) {
            $moduleId = filter_var($match[2], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($moduleId === false) {
                throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
            }
        }
        $routes[$path] = $moduleId === null ? ['GET', 'POST'] : ['GET', 'PUT', 'PATCH', 'DELETE'];
    }
    // Membership routes: /api/{collection}[/{id}].
    $competitionRoute = null;
    $competitionId = null;
    if (preg_match('~\A/api/(memberships|club-coaches)(?:/([1-9][0-9]{0,18}))?\z~', $path, $match)) {
        if (isset($match[2])) {
            $competitionId = filter_var($match[2], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($competitionId === false) {
                throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
            }
        }
        $competitionRoute = $match[1] . (isset($match[2]) ? '/{id}' : '');
        $routes[$path] = [
            'memberships' => ['GET', 'POST'],
            'memberships/{id}' => ['GET', 'PATCH'],
            'club-coaches' => ['GET', 'POST'],
            'club-coaches/{id}' => ['DELETE'],
        ][$competitionRoute] ?? throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
    }
    if (!isset($routes[$path]) && preg_match('~\A/api/users/([1-9][0-9]{0,18})\z~', $path, $match)) {
        $userId = filter_var($match[1], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($userId === false) {
            throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
        }
        $routes[$path] = ['GET', 'PATCH', 'DELETE'];
    }
    if (!isset($routes[$path])) {
        throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
    }
    Http::requireMethod($method, $routes[$path]);
    Config::requireAppKey();
    if ($path === '/api/health') {
        Database::get()->query('SELECT 1');
        Http::json(['status' => 'ok', 'database' => 'connected']);
    }
    Session::start();
    Session::currentUser(); // Refresh the account status and session version on every request.
    if ($moduleRoute !== null) {
        $actor = Session::requireUser();
        if ($method !== 'GET') {
            Session::verifyCsrf();
        }
        if ($moduleRoute === 'bookings') {
            (new BookingController(Database::get()))->dispatch($method, $moduleId, $actor);
        }
        $type = $moduleRoute === 'facilities' ? 'facility' : 'equipment';
        (new ResourceController(Database::get(), $type, $moduleRoute))->dispatch($method, $moduleId, $actor);
    }
    if ($competitionRoute !== null) {
        $actor = Session::requireUser();
        $body = in_array($method, ['POST', 'PATCH', 'PUT'], true) ? Http::body() : [];
        if ($method !== 'GET') {
            Session::verifyCsrf();
        }
        $data = MembershipController::handle($competitionRoute, $method, $competitionId, $body, $_GET, $actor);
        if ($method === 'DELETE') {
            Http::noContent();
        }
        Http::json($data, $method === 'POST' ? 201 : 200);
    }
    $body = [];
    if (in_array($method, ['POST', 'PATCH', 'DELETE'], true)) {
        $body = Http::body();
        Session::verifyCsrf();
    }
    $data = match (true) {
        $path === '/api/auth/session' => Session::payload(),
        $path === '/api/auth/register' => AuthController::register($body),
        $path === '/api/auth/login' => AuthController::login($body),
        $path === '/api/auth/logout' => AuthController::logout($body),
        $path === '/api/users/me' && $method === 'GET' => UserController::me(),
        $path === '/api/users/me' => UserController::updateMe($body),
        $path === '/api/users/me/password' => UserController::password($body),
        $path === '/api/users' && $method === 'GET' => UserController::listing($_GET),
        $path === '/api/users' => UserController::create($body),
        $userId !== null && $method === 'GET' => UserController::show($userId),
        $userId !== null && $method === 'PATCH' => UserController::update($userId, $body),
        $userId !== null && $method === 'DELETE' => UserController::delete($userId, $body),
        default => throw new ApiException(404, 'not_found', 'This endpoint could not be found.'),
    };
    Http::json($data, $method === 'POST' && in_array($path, ['/api/auth/register', '/api/users'], true) ? 201 : 200);
} catch (ApiException $exception) {
    Http::error($exception);
} catch (PDOException $exception) {
    error_log('SportsHub database failure [' . $exception->getCode() . ']: ' . $exception->getMessage());
    Http::error(new ApiException(503, 'service_unavailable', 'The service is temporarily unavailable. Please try again later.'));
} catch (Throwable $exception) {
    error_log('SportsHub application failure: ' . $exception::class . ': ' . $exception->getMessage());
    Http::error(new ApiException(500, 'internal_error', 'The request could not be completed. Please try again later.'));
}
