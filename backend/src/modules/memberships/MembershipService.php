<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;

// Membership applications, member records and club coach assignments.
// An approved membership is the member record; ended/rejected/withdrawn rows are kept as history.
final class MembershipService
{
    public const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn', 'ended'];
    private const OPEN_CLUB_STATUSES = ['active', 'recruiting'];
    private const SELECT = 'SELECT m.*, c.name AS club_name, c.sport_id, u.name AS user_name, u.email AS user_email
        FROM memberships m
        JOIN clubs c ON c.id = m.club_id
        JOIN users u ON u.id = m.user_id';

    public static function isAdmin(array $actor): bool
    {
        return $actor['role'] === 'admin';
    }

    public static function isCoach(int $userId, int $clubId): bool
    {
        $statement = Database::get()->prepare('SELECT 1 FROM club_coaches WHERE user_id = ? AND club_id = ? AND ended_at IS NULL');
        $statement->execute([$userId, $clubId]);
        return $statement->fetchColumn() !== false;
    }

    public static function coachedClubIds(int $userId): array
    {
        $statement = Database::get()->prepare('SELECT club_id FROM club_coaches WHERE user_id = ? AND ended_at IS NULL');
        $statement->execute([$userId]);
        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    // Sports of the non-archived clubs a user coaches; coaches review tournament entries for these sports.
    public static function coachedSportIds(int $userId): array
    {
        $statement = Database::get()->prepare(
            'SELECT DISTINCT c.sport_id FROM club_coaches cc JOIN clubs c ON c.id = cc.club_id
             WHERE cc.user_id = ? AND cc.ended_at IS NULL AND c.is_archived = 0'
        );
        $statement->execute([$userId]);
        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    public static function list(array $actor, array $query): array
    {
        $page = Validation::positiveInteger($query['page'] ?? null, 'page', 1, 1000000);
        $perPage = Validation::positiveInteger($query['per_page'] ?? null, 'per_page', 20, 100);
        $clauses = [];
        $parameters = [];
        if (!self::isAdmin($actor)) {
            // Students see their own records; coaches also see their clubs' records.
            $scope = ['m.user_id = ?'];
            $parameters[] = (int) $actor['id'];
            $clubs = self::coachedClubIds((int) $actor['id']);
            if ($clubs !== []) {
                $scope[] = 'm.club_id IN (' . implode(',', array_fill(0, count($clubs), '?')) . ')';
                array_push($parameters, ...$clubs);
            }
            $clauses[] = '(' . implode(' OR ', $scope) . ')';
        }
        foreach (['club_id' => 'm.club_id', 'user_id' => 'm.user_id'] as $field => $column) {
            $value = Validation::queryId($query, $field);
            if ($value !== null) {
                $clauses[] = $column . ' = ?';
                $parameters[] = $value;
            }
        }
        $status = Validation::queryChoice($query, 'status', self::STATUSES);
        if ($status !== null) {
            $clauses[] = 'm.status = ?';
            $parameters[] = $status;
        }
        $where = $clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses);
        $count = Database::get()->prepare('SELECT COUNT(*) FROM memberships m' . $where);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        // Limits are validated integers, never raw request strings.
        $statement = Database::get()->prepare(self::SELECT . $where . ' ORDER BY m.created_at DESC, m.id DESC LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage));
        $statement->execute($parameters);
        return [
            'memberships' => array_map([self::class, 'publicMembership'], $statement->fetchAll()),
            'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int) ceil($total / $perPage)],
        ];
    }

    public static function find(array $actor, int $id): array
    {
        return self::publicMembership(self::visible($actor, $id));
    }

    public static function apply(array $actor, int $clubId, ?string $message): array
    {
        $userId = (int) $actor['id'];
        try {
            $id = Database::transaction(function (PDO $db) use ($clubId, $userId, $message): int {
                // Locking the club serializes concurrent applications to it.
                $club = $db->prepare('SELECT id, status, is_archived FROM clubs WHERE id = ? FOR UPDATE');
                $club->execute([$clubId]);
                $club = $club->fetch();
                if ($club === false || (int) $club['is_archived'] === 1) {
                    Validation::fail('club_id', 'Choose a club that exists.');
                }
                if (!in_array($club['status'], self::OPEN_CLUB_STATUSES, true)) {
                    throw new ApiException(409, 'club_not_accepting', 'This club is not accepting membership applications.');
                }
                $existing = $db->prepare('SELECT status FROM memberships WHERE club_id = ? AND user_id = ? AND active_flag = 1');
                $existing->execute([$clubId, $userId]);
                if ($existing->fetchColumn() !== false) {
                    throw self::duplicate();
                }
                $db->prepare('INSERT INTO memberships (club_id, user_id, message) VALUES (?, ?, ?)')->execute([$clubId, $userId, $message]);
                return (int) $db->lastInsertId();
            });
        } catch (\PDOException $exception) {
            // The unique active-membership index is the final guard against simultaneous requests.
            throw Database::isDuplicateKey($exception) ? self::duplicate() : $exception;
        }
        return self::publicMembership(self::load($id));
    }

    public static function changeStatus(array $actor, int $id, string $status, ?string $note): array
    {
        $actorId = (int) $actor['id'];
        Database::transaction(function (PDO $db) use ($actor, $actorId, $id, $status, $note): void {
            $membership = self::visible($actor, $id, true);
            $own = (int) $membership['user_id'] === $actorId;
            $reviewer = self::isAdmin($actor) || self::isCoach($actorId, (int) $membership['club_id']);
            $from = $membership['status'];
            if ($status === 'withdrawn') {
                if (!$own) {
                    throw new ApiException(403, 'forbidden', 'Only the applicant can withdraw an application.');
                }
                self::requireFrom($from, ['pending'], $status);
                $db->prepare("UPDATE memberships SET status = 'withdrawn' WHERE id = ?")->execute([$id]);
                return;
            }
            if ($status === 'ended') {
                if (!$own && !$reviewer) {
                    throw new ApiException(403, 'forbidden', 'Only the member, a coach of this club or an Admin can end a membership.');
                }
                self::requireFrom($from, ['approved'], $status);
                $db->prepare("UPDATE memberships SET status = 'ended', ended_by = ?, ended_at = UTC_TIMESTAMP(), review_note = COALESCE(?, review_note) WHERE id = ?")
                    ->execute([$actorId, $note, $id]);
                return;
            }
            if (!$reviewer) {
                throw new ApiException(403, 'forbidden', 'Only an Admin or a coach of this club can review applications.');
            }
            if ($own) {
                throw new ApiException(403, 'self_review', 'You cannot review your own application.');
            }
            self::requireFrom($from, ['pending'], $status);
            if ($status === 'approved') {
                $state = $db->prepare('SELECT c.is_archived, u.status, u.deleted_at FROM clubs c, users u WHERE c.id = ? AND u.id = ?');
                $state->execute([$membership['club_id'], $membership['user_id']]);
                $state = $state->fetch();
                if ((int) $state['is_archived'] === 1 || $state['status'] !== 'active' || $state['deleted_at'] !== null) {
                    throw new ApiException(409, 'not_eligible', 'The club is archived or the applicant account is no longer active.');
                }
            }
            $db->prepare('UPDATE memberships SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?')
                ->execute([$status, $note, $actorId, $id]);
        });
        return self::publicMembership(self::load($id));
    }

    public static function listCoaches(array $query): array
    {
        $clauses = ['cc.ended_at IS NULL'];
        $parameters = [];
        foreach (['club_id' => 'cc.club_id', 'user_id' => 'cc.user_id'] as $field => $column) {
            $value = Validation::queryId($query, $field);
            if ($value !== null) {
                $clauses[] = $column . ' = ?';
                $parameters[] = $value;
            }
        }
        $statement = Database::get()->prepare(
            'SELECT cc.id, cc.club_id, c.name AS club_name, cc.user_id, u.name AS user_name, cc.created_at
             FROM club_coaches cc JOIN clubs c ON c.id = cc.club_id JOIN users u ON u.id = cc.user_id
             WHERE ' . implode(' AND ', $clauses) . ' ORDER BY c.name, u.name'
        );
        $statement->execute($parameters);
        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'club_id' => (int) $row['club_id'],
            'club_name' => $row['club_name'],
            'user_id' => (int) $row['user_id'],
            'user_name' => $row['user_name'],
            'assigned_at' => Http::timestamp($row['created_at']),
        ], $statement->fetchAll());
    }

    public static function assignCoach(array $actor, int $clubId, int $userId): array
    {
        try {
            $id = Database::transaction(function (PDO $db) use ($actor, $clubId, $userId): int {
                $club = $db->prepare('SELECT is_archived FROM clubs WHERE id = ? FOR UPDATE');
                $club->execute([$clubId]);
                $archived = $club->fetchColumn();
                if ($archived === false || (int) $archived === 1) {
                    Validation::fail('club_id', 'Choose a club that exists.');
                }
                $user = $db->prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active' AND deleted_at IS NULL");
                $user->execute([$userId]);
                if ($user->fetchColumn() === false) {
                    Validation::fail('user_id', 'Choose an active user.');
                }
                if (self::isCoach($userId, $clubId)) {
                    throw self::duplicateCoach();
                }
                $db->prepare('INSERT INTO club_coaches (club_id, user_id, assigned_by) VALUES (?, ?, ?)')->execute([$clubId, $userId, (int) $actor['id']]);
                return (int) $db->lastInsertId();
            });
        } catch (\PDOException $exception) {
            throw Database::isDuplicateKey($exception) ? self::duplicateCoach() : $exception;
        }
        foreach (self::listCoaches(['club_id' => (string) $clubId]) as $coach) {
            if ($coach['id'] === $id) {
                return $coach;
            }
        }
        throw new \RuntimeException('The coach assignment could not be reloaded.');
    }

    public static function endCoach(array $actor, int $id): void
    {
        $statement = Database::get()->prepare('UPDATE club_coaches SET ended_at = UTC_TIMESTAMP(), ended_by = ? WHERE id = ? AND ended_at IS NULL');
        $statement->execute([(int) $actor['id'], $id]);
        if ($statement->rowCount() === 0) {
            throw new ApiException(404, 'not_found', 'This coach assignment could not be found.');
        }
    }

    public static function publicMembership(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'club_id' => (int) $row['club_id'],
            'club_name' => $row['club_name'],
            'user_id' => (int) $row['user_id'],
            'user_name' => $row['user_name'],
            'user_email' => $row['user_email'],
            'status' => $row['status'],
            'message' => $row['message'],
            'review_note' => $row['review_note'],
            'reviewed_by' => $row['reviewed_by'] === null ? null : (int) $row['reviewed_by'],
            'reviewed_at' => Http::timestamp($row['reviewed_at']),
            'ended_by' => $row['ended_by'] === null ? null : (int) $row['ended_by'],
            'ended_at' => Http::timestamp($row['ended_at']),
            'applied_at' => Http::timestamp($row['created_at']),
            'updated_at' => Http::timestamp($row['updated_at']),
        ];
    }

    // Records outside the caller's scope are reported as missing rather than forbidden.
    private static function visible(array $actor, int $id, bool $lock = false): array
    {
        $statement = Database::get()->prepare(self::SELECT . ' WHERE m.id = ?' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute([$id]);
        $row = $statement->fetch();
        if ($row === false || !(self::isAdmin($actor) || (int) $row['user_id'] === (int) $actor['id'] || self::isCoach((int) $actor['id'], (int) $row['club_id']))) {
            throw new ApiException(404, 'not_found', 'This membership could not be found.');
        }
        return $row;
    }

    private static function load(int $id): array
    {
        $statement = Database::get()->prepare(self::SELECT . ' WHERE m.id = ?');
        $statement->execute([$id]);
        return $statement->fetch();
    }

    private static function requireFrom(string $from, array $allowed, string $to): void
    {
        if (!in_array($from, $allowed, true)) {
            throw new ApiException(409, 'invalid_transition', 'A ' . $from . ' membership cannot become ' . $to . '.');
        }
    }

    private static function duplicate(): ApiException
    {
        return new ApiException(409, 'duplicate_application', 'You already have a pending or approved membership for this club.');
    }

    private static function duplicateCoach(): ApiException
    {
        return new ApiException(409, 'duplicate_coach', 'This user already coaches this club.');
    }
}
