<?php
declare(strict_types=1);

use SportsHub\ApiException;
use SportsHub\AnnouncementController;
use SportsHub\AuthController;
use SportsHub\BookingController;
use SportsHub\Config;
use SportsHub\Database;
use SportsHub\Http;
use SportsHub\MatchController;
use SportsHub\MembershipController;
use SportsHub\ResourceController;
use SportsHub\TournamentController;
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
        '/api/branding' => ['GET'],
        '/api/branding/logo' => ['POST', 'DELETE'],
        '/api/auth/session' => ['GET'],
        '/api/auth/register' => ['POST'],
        '/api/auth/login' => ['POST'],
        '/api/auth/logout' => ['POST'],
        '/api/users/me' => ['GET', 'PATCH'],
        '/api/users/me/password' => ['PATCH'],
        '/api/users/me/photo' => ['POST', 'DELETE'],
        '/api/users' => ['GET', 'POST'],
        '/api/announcements' => ['GET', 'POST'],
        '/api/notifications' => ['GET'],
        '/api/participation/me' => ['GET'],
        '/api/reports/participation' => ['GET'],
    ];
    $eventPublic = false;
    $eventRoute = false;
    $eventId = null;
    $eventBanner = false;
    if (preg_match('~\A/api/(public/events|event-promotions)(?:/([1-9][0-9]{0,17})(/banner)?)?\z~', $path, $match)) {
        $eventRoute = true;
        $eventPublic = $match[1] === 'public/events';
        $eventId = isset($match[2]) ? (int) $match[2] : null;
        $eventBanner = isset($match[3]);
        if ($eventPublic && $eventBanner) throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
        $routes[$path] = $eventPublic ? ['GET'] : ($eventId === null ? ['GET', 'POST'] : ($eventBanner ? ['POST', 'DELETE'] : ['PATCH', 'DELETE']));
    }
    $notificationId = null;
    if (preg_match('~\A/api/notifications/([1-9][0-9]{0,17})\z~', $path, $match)) {
        $notificationId = (int) $match[1];
        $routes[$path] = ['PATCH'];
    }
    $sportsRoute = \SportsHub\SportsTrainingRoutes::match($path);
    if ($sportsRoute !== null) {
        $routes[$path] = $sportsRoute['methods'];
    }
    $announcementId = null;
    $announcementImage = false;
    $publicAnnouncements = false;
    if (preg_match('~\A/api/(announcements|public/announcements)(?:/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(/image)?)?\z~i', $path, $match)) {
        $publicAnnouncements = $match[1] === 'public/announcements';
        $announcementId = isset($match[2]) ? strtolower($match[2]) : null;
        $announcementImage = isset($match[3]);
        if ($publicAnnouncements && $announcementImage) throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
        $routes[$path] = $publicAnnouncements ? ['GET'] : ($announcementId === null ? ['GET', 'POST'] : ($announcementImage ? ['POST', 'DELETE'] : ['GET', 'PATCH', 'DELETE']));
    }
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
    // Membership and competition routes: /api/{collection}[/{id}[/{action}]].
    $competitionRoute = null;
    $competitionId = null;
    if (preg_match('~\A/api/(memberships|club-coaches|tournaments|tournament-entries|matches)(?:/([1-9][0-9]{0,18})(?:/(entries|eligible-members|matches|fixtures|standings|result))?)?\z~', $path, $match)) {
        if (isset($match[2])) {
            $competitionId = filter_var($match[2], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($competitionId === false) {
                throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
            }
        }
        $competitionRoute = $match[1] . (isset($match[2]) ? '/{id}' : '') . (isset($match[3]) ? '/' . $match[3] : '');
        $routes[$path] = [
            'memberships' => ['GET', 'POST'],
            'memberships/{id}' => ['GET', 'PATCH'],
            'club-coaches' => ['GET', 'POST'],
            'club-coaches/{id}' => ['DELETE'],
            'tournaments' => ['GET', 'POST'],
            'tournaments/{id}' => ['GET', 'PATCH', 'DELETE'],
            'tournaments/{id}/entries' => ['GET', 'POST'],
            'tournaments/{id}/eligible-members' => ['GET'],
            'tournaments/{id}/matches' => ['GET', 'POST'],
            'tournaments/{id}/fixtures' => ['POST'],
            'tournaments/{id}/standings' => ['GET'],
            'tournament-entries/{id}' => ['GET', 'PATCH'],
            'matches/{id}' => ['GET', 'PATCH', 'DELETE'],
            'matches/{id}/result' => ['PUT'],
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
    if ($path === '/api/branding') {
        \SportsHub\Validation::allowed($_GET, []);
        Http::json(\SportsHub\UniversityBrandingService::publicBranding());
    }
    if ($eventPublic) {
        \SportsHub\Validation::allowed($_GET, []);
        Http::json(\SportsHub\EventPromotionService::listing(false, $eventId));
    }
    if ($publicAnnouncements) {
        \SportsHub\Validation::allowed($_GET, []);
        Http::json(\SportsHub\AnnouncementRepository::featured($announcementId));
    }
    Session::start();
    Session::currentUser(); // Refresh the account status and session version on every request.
    if ($announcementImage) {
        $actor = Session::requireAdmin();
        Session::verifyCsrf();
        \SportsHub\Validation::allowed($_GET, []);
        if ($method === 'DELETE') \SportsHub\Validation::allowed(Http::body(), []);
        Http::json((new \SportsHub\AnnouncementImageService())->save($actor, $announcementId, $method === 'POST' ? \SportsHub\ImageUpload::receive('image') : null), $method === 'POST' ? 201 : 200);
    }
    if ($eventRoute) {
        $actor = Session::requireAdmin();
        \SportsHub\Validation::allowed($_GET, []);
        if ($method === 'GET') Http::json(\SportsHub\EventPromotionService::listing(true));
        Session::verifyCsrf();
        if ($eventBanner) {
            if ($method === 'DELETE') \SportsHub\Validation::allowed(Http::body(), []);
            Http::json((new \SportsHub\EventPromotionService())->banner($actor, $eventId, $method === 'POST' ? \SportsHub\ImageUpload::receive('banner') : null), $method === 'POST' ? 201 : 200);
        }
        $eventBody = Http::body();
        if ($method === 'DELETE') {
            \SportsHub\Validation::allowed($eventBody, []);
            \SportsHub\EventPromotionService::remove($actor, $eventId);
            Http::noContent();
        }
        Http::json(\SportsHub\EventPromotionService::save($actor, $eventId, $eventBody), $method === 'POST' ? 201 : 200);
    }
    if ($path === '/api/branding/logo') {
        $actor = Session::requireAdmin();
        Session::verifyCsrf();
        $branding = new \SportsHub\UniversityBrandingService();
        if ($method === 'DELETE') {
            \SportsHub\Validation::allowed(Http::body(), []);
            Http::json($branding->remove($actor));
        }
        Http::json($branding->upload($actor, \SportsHub\ImageUpload::receive('logo')), 201);
    }
    if ($path === '/api/users/me/photo') {
        $actor = Session::requireUser();
        Session::verifyCsrf();
        $photos = new \SportsHub\ProfilePhotoService();
        if ($method === 'DELETE') {
            \SportsHub\Validation::allowed(Http::body(), []);
            Http::json($photos->remove($actor));
        }
        Http::json($photos->upload($actor, \SportsHub\ImageUpload::receive('photo')), 201);
    }
    if ($path === '/api/notifications' || $notificationId !== null) {
        $actor = Session::requireUser();
        $body = [];
        if ($method === 'PATCH') {
            Session::verifyCsrf();
            $body = Http::body();
        }
        Http::json(\SportsHub\NotificationController::handle($method, $notificationId, $body, $_GET, $actor));
    }
    if (in_array($path, ['/api/participation/me', '/api/reports/participation'], true)) {
        $actor = Session::requireUser();
        Http::json(\SportsHub\ReportController::listing($path === '/api/reports/participation', $_GET, $actor));
    }
    if ($sportsRoute !== null) {
        \SportsHub\SportsTrainingRoutes::dispatch($sportsRoute, $method);
    }
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
        $controller = match (true) {
            in_array(strtok($competitionRoute, '/'), ['memberships', 'club-coaches'], true) => MembershipController::class,
            str_starts_with($competitionRoute, 'matches') || preg_match('~/(matches|fixtures|standings)\z~', $competitionRoute) === 1 => MatchController::class,
            default => TournamentController::class,
        };
        $data = $controller::handle($competitionRoute, $method, $competitionId, $body, $_GET, $actor);
        if ($method === 'DELETE') {
            Http::noContent();
        }
        Http::json($data, $method === 'POST' ? 201 : 200);
    }
    $body = [];
    if (in_array($method, ['POST', 'PATCH', 'DELETE'], true)) {
        $body = Http::body(str_starts_with($path, '/api/announcements') ? 70000 : 16384);
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
        $path === '/api/announcements' && $method === 'GET' => AnnouncementController::listing($_GET),
        $path === '/api/announcements' => AnnouncementController::create($body),
        $announcementId !== null && $method === 'GET' => AnnouncementController::show($announcementId),
        $announcementId !== null && $method === 'PATCH' => AnnouncementController::update($announcementId, $body),
        $announcementId !== null && $method === 'DELETE' => AnnouncementController::delete($announcementId, $body),
        $userId !== null && $method === 'GET' => UserController::show($userId),
        $userId !== null && $method === 'PATCH' => UserController::update($userId, $body),
        $userId !== null && $method === 'DELETE' => UserController::delete($userId, $body),
        default => throw new ApiException(404, 'not_found', 'This endpoint could not be found.'),
    };
    Http::json($data, $method === 'POST' && in_array($path, ['/api/auth/register', '/api/users', '/api/announcements'], true) ? 201 : 200);
} catch (ApiException $exception) {
    Http::error($exception);
} catch (PDOException $exception) {
    error_log('SportsHub database failure [' . $exception->getCode() . ']: ' . $exception->getMessage());
    Http::error(new ApiException(503, 'service_unavailable', 'The service is temporarily unavailable. Please try again later.'));
} catch (Throwable $exception) {
    error_log('SportsHub application failure: ' . $exception::class . ': ' . $exception->getMessage());
    Http::error(new ApiException(500, 'internal_error', 'The request could not be completed. Please try again later.'));
}
