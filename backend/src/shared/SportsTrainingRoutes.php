<?php
declare(strict_types=1);

namespace SportsHub;

final class SportsTrainingRoutes
{
    private static bool $writeTransaction = false;

    public static function match(string $path): ?array
    {
        if (!preg_match('~\A/api/(sports|clubs|training-sessions|attendance)(?:/([1-9][0-9]{0,18})(?:/(archive|cancel|overview))?)?\z~', $path, $parts)) return null;
        $type = $parts[1];
        $id = isset($parts[2]) ? filter_var($parts[2], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
        if ($id === false) throw new ApiException(404, 'not_found', 'This endpoint could not be found.');
        $action = $parts[3] ?? null;
        if ($action !== null && !(($type === 'clubs' && in_array($action, ['archive', 'overview'], true)) || ($type === 'training-sessions' && $action === 'cancel'))) return null;
        $methods = $action !== null ? ($action === 'overview' ? ['GET'] : ['PATCH']) : match ($type) {
            'sports' => ['GET'],
            'clubs' => $id === null ? ['GET', 'POST'] : ['GET', 'PUT', 'PATCH', 'DELETE'],
            'training-sessions' => $id === null ? ['GET', 'POST'] : ['GET', 'PUT', 'PATCH'],
            'attendance' => $id === null ? ['GET', 'POST'] : ['GET'],
        };
        return compact('type', 'id', 'action', 'methods');
    }

    public static function dispatch(array $route, string $method): never
    {
        $actor = Session::requireUser();
        if ($method !== 'GET' && in_array($route['type'], ['training-sessions', 'attendance'], true)) {
            Database::get()->beginTransaction();
            self::$writeTransaction = true;
        }
        try {
            self::dispatchController($route, $method, $actor);
        } catch (\Throwable $exception) {
            self::finishWrite(false);
            throw $exception;
        }
    }

    // Legacy controllers end the request inside Response::json. That adapter
    // finishes only this route's transaction before sending its response.
    public static function finishWrite(bool $success): void
    {
        if (!self::$writeTransaction) return;
        $db = Database::get();
        if ($db->inTransaction()) {
            if ($success) $db->commit();
            else $db->rollBack();
        }
        self::$writeTransaction = false;
    }

    private static function dispatchController(array $route, string $method, array $actor): never
    {
        ['type' => $type, 'id' => $id, 'action' => $action] = $route;
        if ($type === 'clubs' && $action === 'overview') {
            if ($actor['role'] !== 'admin') throw new ApiException(403, 'forbidden', 'Only Admins can view club oversight.');
            Http::json(ClubOverviewService::overview($id, $_GET));
        }
        if ($method !== 'GET') {
            Session::verifyCsrf();
            $body = in_array($method, ['POST', 'PUT', 'PATCH'], true) ? Http::body() : [];
            if ($type === 'clubs' && $actor['role'] !== 'admin') throw new ApiException(403, 'forbidden', 'Only Admins can manage clubs.');
            if ($type === 'training-sessions' || $type === 'attendance') {
                $session = null;
                if ($type === 'attendance') {
                    $sessionId = Validation::id($body['session_id'] ?? null, 'session_id');
                    $session = self::session($sessionId);
                    $clubId = (int) $session['club_id'];
                    self::requireManager($actor, $clubId);
                    $participantId = Validation::id($body['participant_id'] ?? null, 'participant_id');
                    $member = Database::get()->prepare("SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.club_id = ? AND m.user_id = ? AND m.status = 'approved' AND u.status = 'active' AND u.deleted_at IS NULL");
                    $member->execute([$clubId, $participantId]);
                    if (!$member->fetchColumn()) throw new ApiException(422, 'validation_failed', 'The participant must have an approved club membership.');
                } else {
                    if ($id !== null) $session = self::session($id);
                    $clubId = isset($body['club_id']) ? Validation::id($body['club_id'], 'club_id') : (int) ($session['club_id'] ?? 0);
                    if ($session !== null) self::requireManager($actor, (int) $session['club_id']);
                }
                self::requireManager($actor, $clubId);
            }
        }
        if ($type === 'attendance' && $method === 'GET' && $id !== null && $actor['role'] !== 'admin') {
            $statement = Database::get()->prepare('SELECT a.participant_id, t.club_id FROM training_attendance a JOIN training_sessions t ON t.id = a.session_id WHERE a.id = ?');
            $statement->execute([$id]);
            $record = $statement->fetch();
            if (!$record || ((int) $record['participant_id'] !== (int) $actor['id'] && !MembershipService::isCoach((int) $actor['id'], (int) $record['club_id']))) throw new ApiException(404, 'not_found', 'Attendance record not found.');
        }
        $controller = match ($type) {
            'sports' => SportController::class,
            'clubs' => ClubController::class,
            'training-sessions' => TrainingController::class,
            'attendance' => AttendanceController::class,
        };
        if ($action !== null) $controller::$action($id);
        elseif ($method === 'GET') $id === null ? $controller::list() : $controller::details($id);
        elseif ($method === 'POST') $controller::create();
        elseif ($method === 'DELETE') $controller::delete($id);
        else $controller::update($id);
        throw new ApiException(500, 'internal_error', 'The controller did not return a response.');
    }

    private static function session(int $id): array
    {
        $statement = Database::get()->prepare('SELECT * FROM training_sessions WHERE id = ? FOR UPDATE');
        $statement->execute([$id]);
        return $statement->fetch() ?: throw new ApiException(404, 'not_found', 'Training session not found.');
    }

    private static function requireManager(array $actor, int $clubId): void
    {
        if ($actor['role'] !== 'admin' && !MembershipService::isCoach((int) $actor['id'], $clubId)) throw new ApiException(403, 'forbidden', 'Only Admins and assigned club coaches can manage training and attendance.');
    }
}
