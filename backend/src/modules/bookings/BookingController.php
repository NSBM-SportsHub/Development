<?php
declare(strict_types=1);

namespace SportsHub;

use PDO;
use RuntimeException;
use Throwable;

final class BookingController
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function dispatch(string $method, ?int $id, array $user): never
    {
        if ($method === 'GET') {
            $this->listOrRead($id, $user);
        }

        if ($method === 'POST' && $id === null) {
            $this->create($user);
        }
        if (in_array($method, ['PUT', 'PATCH'], true) && $id !== null) {
            $this->update($id, $user);
        }
        if ($method === 'DELETE' && $id !== null) {
            $this->cancel($id, $user);
        }

        sendJson(['error' => 'Method not allowed.'], 405);
    }

    private function listOrRead(?int $id, array $user): never
    {
        $query = 'SELECT b.*, COALESCE(f.name, e.name) AS resource_name,
                         CASE WHEN b.facility_id IS NOT NULL THEN \'facility\' ELSE \'equipment\' END AS resource_type
                  FROM bookings b
                  LEFT JOIN facilities f ON f.id = b.facility_id
                  LEFT JOIN equipment e ON e.id = b.equipment_id';
        $parameters = [];
        if ($id !== null) {
            $query .= ' WHERE b.id = :id';
            $parameters['id'] = $id;
            if ($user['role'] !== 'admin') {
                $query .= ' AND b.requested_by = :user_id';
                $parameters['user_id'] = $user['id'];
            }
        } elseif ($user['role'] !== 'admin') {
            $query .= ' WHERE b.requested_by = :user_id';
            $parameters['user_id'] = $user['id'];
        }
        $query .= ' ORDER BY b.created_at DESC, b.id DESC';

        $statement = $this->db->prepare($query);
        $statement->execute($parameters);
        $bookings = $statement->fetchAll();
        if ($id !== null && $bookings === []) {
            sendJson(['error' => 'Booking not found.'], 404);
        }
        sendJson(['data' => $id === null ? $bookings : $bookings[0]]);
    }

    private function create(array $user): never
    {
        $data = Http::body();
        rejectUnknownFields($data, ['resource_type', 'resource_id', 'starts_at', 'ends_at', 'quantity', 'notes']);
        requireFields($data, ['resource_type', 'resource_id', 'starts_at', 'ends_at']);

        if (!in_array($data['resource_type'], ['facility', 'equipment'], true)) {
            sendJson(['error' => 'resource_type must be facility or equipment.'], 422);
        }
        $resourceId = positiveInteger($data['resource_id'], 'resource_id');
        $start = parseUtcDateTime($data['starts_at'], 'starts_at');
        $end = parseUtcDateTime($data['ends_at'], 'ends_at');
        if ($end <= $start) {
            sendJson(['error' => 'ends_at must be later than starts_at.'], 422);
        }
        $quantity = $data['resource_type'] === 'equipment'
            ? (array_key_exists('quantity', $data) ? positiveInteger($data['quantity'], 'quantity') : 1)
            : 1;
        if ($data['resource_type'] === 'facility' && array_key_exists('quantity', $data)) {
            sendJson(['error' => 'quantity is only valid for equipment bookings.'], 422);
        }
        $notes = $data['notes'] ?? null;
        if ($notes !== null && (!is_string($notes) || mb_strlen(trim($notes)) > 1000)) {
            sendJson(['error' => 'notes must be a string of at most 1000 characters.'], 422);
        }

        $this->db->beginTransaction();
        try {
            $this->lockResourceAndCheckAvailability($data['resource_type'], $resourceId, $start, $end, $quantity);
            $facilityId = $data['resource_type'] === 'facility' ? $resourceId : null;
            $equipmentId = $data['resource_type'] === 'equipment' ? $resourceId : null;
            $statement = $this->db->prepare(
                'INSERT INTO bookings
                    (facility_id, equipment_id, requested_by, starts_at, ends_at, quantity, notes, status)
                 VALUES (:facility_id, :equipment_id, :requested_by, :starts_at, :ends_at, :quantity, :notes, \'pending\')'
            );
            $statement->execute([
                'facility_id' => $facilityId,
                'equipment_id' => $equipmentId,
                'requested_by' => $user['id'],
                'starts_at' => $start,
                'ends_at' => $end,
                'quantity' => $quantity,
                'notes' => $notes === null ? null : trim($notes),
            ]);
            $id = (int) $this->db->lastInsertId();
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        $this->readCreated($id, 201);
    }

    private function update(int $id, array $user): never
    {
        $data = Http::body();
        if ($user['role'] === 'admin') {
            rejectUnknownFields($data, ['status']);
            requireFields($data, ['status']);
            if (!in_array($data['status'], ['approved', 'rejected', 'cancelled'], true)) {
                sendJson(['error' => 'Admin may set status to approved, rejected, or cancelled.'], 422);
            }
            $this->db->beginTransaction();
            try {
                if ($data['status'] === 'approved') {
                    $bookingStatement = $this->db->prepare(
                        'SELECT facility_id, equipment_id, starts_at, ends_at, quantity
                         FROM bookings WHERE id = :id AND status = \'pending\' FOR UPDATE'
                    );
                    $bookingStatement->execute(['id' => $id]);
                    $booking = $bookingStatement->fetch();
                    if ($booking === false) {
                        $this->ensurePending($id);
                    }
                    $type = $booking['facility_id'] !== null ? 'facility' : 'equipment';
                    $resourceId = (int) ($booking['facility_id'] ?? $booking['equipment_id']);
                    $this->lockResourceAndCheckAvailability(
                        $type,
                        $resourceId,
                        $booking['starts_at'],
                        $booking['ends_at'],
                        (int) $booking['quantity'],
                        $id
                    );
                }
                $statement = $this->db->prepare(
                    'UPDATE bookings SET status = :status, reviewed_by = :reviewed_by, updated_at = CURRENT_TIMESTAMP
                     WHERE id = :id AND status = \'pending\''
                );
                $statement->execute(['status' => $data['status'], 'reviewed_by' => $user['id'], 'id' => $id]);
                if ($statement->rowCount() === 0) {
                    $this->ensurePending($id);
                }
                $this->db->commit();
            } catch (Throwable $exception) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                throw $exception;
            }
            $this->readCreated($id);
        }

        rejectUnknownFields($data, ['starts_at', 'ends_at', 'quantity', 'notes']);
        if ($data === []) {
            sendJson(['error' => 'At least one booking field is required.'], 422);
        }
        $this->db->beginTransaction();
        try {
            $booking = $this->findOwnedPending($id, $user['id'], true);
            $start = array_key_exists('starts_at', $data)
                ? parseUtcDateTime($data['starts_at'], 'starts_at')
                : $booking['starts_at'];
            $end = array_key_exists('ends_at', $data)
                ? parseUtcDateTime($data['ends_at'], 'ends_at')
                : $booking['ends_at'];
            if ($end <= $start) {
                sendJson(['error' => 'ends_at must be later than starts_at.'], 422);
            }
            $quantity = array_key_exists('quantity', $data)
                ? positiveInteger($data['quantity'], 'quantity')
                : (int) $booking['quantity'];
            if ($booking['equipment_id'] === null && array_key_exists('quantity', $data)) {
                sendJson(['error' => 'quantity is only valid for equipment bookings.'], 422);
            }
            $notes = $booking['notes'];
            if (array_key_exists('notes', $data)) {
                $notes = $data['notes'];
                if ($notes !== null && (!is_string($notes) || mb_strlen(trim($notes)) > 1000)) {
                    sendJson(['error' => 'notes must be a string of at most 1000 characters.'], 422);
                }
                $notes = $notes === null ? null : trim($notes);
            }

            $resourceType = $booking['facility_id'] !== null ? 'facility' : 'equipment';
            $resourceId = (int) ($booking['facility_id'] ?? $booking['equipment_id']);
            $this->lockResourceAndCheckAvailability($resourceType, $resourceId, $start, $end, $quantity, $id);
            $statement = $this->db->prepare(
                'UPDATE bookings SET starts_at = :starts_at, ends_at = :ends_at, quantity = :quantity,
                    notes = :notes, updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id AND requested_by = :requested_by AND status = \'pending\''
            );
            $statement->execute([
                'starts_at' => $start,
                'ends_at' => $end,
                'quantity' => $quantity,
                'notes' => $notes,
                'id' => $id,
                'requested_by' => $user['id'],
            ]);
            if ($statement->rowCount() === 0) {
                $this->ensurePending($id, $user['id']);
            }
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        $this->readCreated($id);
    }

    private function cancel(int $id, array $user): never
    {
        if ($user['role'] === 'admin') {
            $statement = $this->db->prepare(
                'UPDATE bookings SET status = \'cancelled\', reviewed_by = :reviewed_by, updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id AND status IN (\'pending\', \'approved\')'
            );
            $statement->execute(['reviewed_by' => $user['id'], 'id' => $id]);
        } else {
            $statement = $this->db->prepare(
                'UPDATE bookings SET status = \'cancelled\', updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id AND requested_by = :requested_by AND status = \'pending\''
            );
            $statement->execute(['id' => $id, 'requested_by' => $user['id']]);
        }
        if ($statement->rowCount() === 0) {
            $this->ensurePending($id, $user['role'] === 'admin' ? null : $user['id']);
        }
        sendJson(null, 204);
    }

    private function lockResourceAndCheckAvailability(
        string $type,
        int $resourceId,
        string $start,
        string $end,
        int $quantity,
        ?int $excludeBookingId = null
    ): void {
        $table = $type === 'facility' ? 'facilities' : 'equipment';
        $resourceStatement = $this->db->prepare(
            "SELECT id, is_active" . ($type === 'equipment' ? ', total_quantity' : '') .
            " FROM {$table} WHERE id = :id FOR UPDATE"
        );
        $resourceStatement->execute(['id' => $resourceId]);
        $resource = $resourceStatement->fetch();
        if ($resource === false || (int) $resource['is_active'] !== 1) {
            sendJson(['error' => 'Resource not found or inactive.'], 404);
        }

        $resourceColumn = $type === 'facility' ? 'facility_id' : 'equipment_id';
        $query = "SELECT starts_at, ends_at, quantity
                  FROM bookings
                  WHERE {$resourceColumn} = :resource_id
                    AND status IN ('pending', 'approved')
                    AND starts_at < :ends_at AND ends_at > :starts_at";
        $parameters = ['resource_id' => $resourceId, 'starts_at' => $start, 'ends_at' => $end];
        if ($excludeBookingId !== null) {
            $query .= ' AND id <> :exclude_id';
            $parameters['exclude_id'] = $excludeBookingId;
        }
        $statement = $this->db->prepare($query);
        $statement->execute($parameters);
        $events = [];
        foreach ($statement->fetchAll() as $booking) {
            $events[] = ['time' => $booking['starts_at'], 'delta' => (int) $booking['quantity']];
            $events[] = ['time' => $booking['ends_at'], 'delta' => -(int) $booking['quantity']];
        }
        usort($events, static function (array $left, array $right): int {
            $timeOrder = strcmp($left['time'], $right['time']);
            return $timeOrder !== 0 ? $timeOrder : ($left['delta'] <=> $right['delta']);
        });
        $reserved = 0;
        $maximumReserved = 0;
        foreach ($events as $event) {
            $reserved += $event['delta'];
            $maximumReserved = max($maximumReserved, $reserved);
        }

        $available = $type === 'facility'
            ? $maximumReserved === 0
            : $maximumReserved + $quantity <= (int) $resource['total_quantity'];
        if (!$available) {
            sendJson(['error' => 'The requested time or quantity is unavailable.'], 409);
        }
    }

    private function findOwnedPending(int $id, int $userId, bool $forUpdate = false): array
    {
        $statement = $this->db->prepare(
            'SELECT * FROM bookings WHERE id = :id AND requested_by = :requested_by AND status = \'pending\''
                . ($forUpdate ? ' FOR UPDATE' : '')
        );
        $statement->execute(['id' => $id, 'requested_by' => $userId]);
        $booking = $statement->fetch();
        if ($booking === false) {
            $this->ensurePending($id, $userId);
        }

        return $booking;
    }

    private function ensurePending(int $id, ?int $ownerId = null): void
    {
        $query = 'SELECT id FROM bookings WHERE id = :id AND status = \'pending\'';
        $parameters = ['id' => $id];
        if ($ownerId !== null) {
            $query .= ' AND requested_by = :owner_id';
            $parameters['owner_id'] = $ownerId;
        }
        $statement = $this->db->prepare($query);
        $statement->execute($parameters);
        if ($statement->fetch() === false) {
            sendJson(['error' => 'Booking not found or is no longer editable.'], 404);
        }
    }

    private function readCreated(int $id, int $status = 200): never
    {
        $statement = $this->db->prepare(
            'SELECT b.*, COALESCE(f.name, e.name) AS resource_name,
                    CASE WHEN b.facility_id IS NOT NULL THEN \'facility\' ELSE \'equipment\' END AS resource_type
             FROM bookings b
             LEFT JOIN facilities f ON f.id = b.facility_id
             LEFT JOIN equipment e ON e.id = b.equipment_id
             WHERE b.id = :id'
        );
        $statement->execute(['id' => $id]);
        $booking = $statement->fetch();
        if ($booking === false) {
            throw new RuntimeException('Saved booking could not be read back.');
        }
        sendJson(['data' => $booking], $status);
    }
}
