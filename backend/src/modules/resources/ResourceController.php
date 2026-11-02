<?php
declare(strict_types=1);

namespace SportsHub;

use InvalidArgumentException;
use PDO;
use RuntimeException;
use Throwable;

final class ResourceController
{
    public function __construct(
        private readonly PDO $db,
        private readonly string $type,
        private readonly string $table
    ) {
        if (!in_array($type, ['facility', 'equipment'], true)
            || !in_array($table, ['facilities', 'equipment'], true)) {
            throw new InvalidArgumentException('Unsupported resource configuration.');
        }
    }

    public function dispatch(string $method, ?int $id, array $user): never
    {
        if ($method === 'GET') {
            $this->listOrRead($id, $user);
        }

        Session::requireAdmin();

        if ($method === 'POST' && $id === null) {
            $this->create();
        }
        if (in_array($method, ['PUT', 'PATCH'], true) && $id !== null) {
            $this->update($id);
        }
        if ($method === 'DELETE' && $id !== null) {
            $this->archive($id);
        }

        sendJson(['error' => 'Method not allowed.'], 405);
    }

    private function listOrRead(?int $id, array $user): never
    {
        if ($id !== null) {
            $query = "SELECT * FROM {$this->table} WHERE id = :id";
            if ($user['role'] !== 'admin') {
                $query .= ' AND is_active = 1';
            }
            $statement = $this->db->prepare($query);
            $statement->execute(['id' => $id]);
            $resource = $statement->fetch();
            if ($resource === false) {
                sendJson(['error' => 'Resource not found.'], 404);
            }
            sendJson(['data' => $resource]);
        }

        $query = "SELECT * FROM {$this->table}";
        if ($user['role'] !== 'admin') {
            $query .= ' WHERE is_active = 1';
        }
        $query .= ' ORDER BY name, id';
        sendJson(['data' => $this->db->query($query)->fetchAll()]);
    }

    private function create(): never
    {
        $data = Http::body();
        rejectUnknownFields($data, $this->allowedFields());
        requireFields($data, ['name']);
        $values = $this->validatedValues($data, false);

        $columns = array_keys($values);
        $placeholders = array_map(static fn(string $column): string => ':' . $column, $columns);
        $query = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $this->table,
            implode(', ', $columns),
            implode(', ', $placeholders)
        );
        $statement = $this->db->prepare($query);
        $statement->execute($values);

        $this->readCreated((int) $this->db->lastInsertId(), 201);
    }

    private function update(int $id): never
    {
        $data = Http::body();
        rejectUnknownFields($data, $this->allowedFields());
        if ($data === []) {
            sendJson(['error' => 'At least one field is required.'], 422);
        }

        $values = $this->validatedValues($data, true);
        $sets = array_map(static fn(string $column): string => "{$column} = :{$column}", array_keys($values));
        $values['id'] = $id;
        $this->db->beginTransaction();
        try {
            if ($this->type === 'equipment' && array_key_exists('total_quantity', $values)) {
                $this->ensureStockCoversExistingBookings($id, $values['total_quantity']);
            }
            $statement = $this->db->prepare(
                "UPDATE {$this->table} SET " . implode(', ', $sets) . ', updated_at = CURRENT_TIMESTAMP WHERE id = :id AND is_active = 1'
            );
            $statement->execute($values);
            if ($statement->rowCount() === 0) {
                $this->ensureActiveExists($id);
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

    private function ensureStockCoversExistingBookings(int $id, int $newQuantity): void
    {
        $resource = $this->db->prepare(
            'SELECT id FROM equipment WHERE id = :id AND is_active = 1 FOR UPDATE'
        );
        $resource->execute(['id' => $id]);
        if ($resource->fetch() === false) {
            sendJson(['error' => 'Resource not found.'], 404);
        }

        $statement = $this->db->prepare(
            'SELECT starts_at, ends_at, quantity
             FROM bookings
             WHERE equipment_id = :id AND status IN (\'pending\', \'approved\')
             ORDER BY starts_at, ends_at'
        );
        $statement->execute(['id' => $id]);
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
        if ($newQuantity < $maximumReserved) {
            sendJson([
                'error' => 'total_quantity cannot be lower than the quantity already reserved for an overlapping period.',
            ], 409);
        }
    }

    private function archive(int $id): never
    {
        $statement = $this->db->prepare(
            "UPDATE {$this->table} SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = :id AND is_active = 1"
        );
        $statement->execute(['id' => $id]);
        if ($statement->rowCount() === 0) {
            $this->ensureExists($id);
        }
        sendJson(null, 204);
    }

    private function allowedFields(): array
    {
        return $this->type === 'facility'
            ? ['name', 'description', 'location', 'capacity']
            : ['name', 'description', 'total_quantity'];
    }

    private function validatedValues(array $data, bool $partial): array
    {
        $values = [];
        if (array_key_exists('name', $data)) {
            $values['name'] = stringField($data['name'], 'name', 120);
        } elseif (!$partial) {
            sendJson(['error' => 'name is required.'], 422);
        }

        if (array_key_exists('description', $data)) {
            $values['description'] = optionalDescription($data);
        } elseif (!$partial) {
            $values['description'] = null;
        }

        if ($this->type === 'facility') {
            if (array_key_exists('location', $data)) {
                $values['location'] = stringField($data['location'], 'location', 160, true);
            } elseif (!$partial) {
                $values['location'] = null;
            }
            if (array_key_exists('capacity', $data)) {
                $values['capacity'] = $data['capacity'] === null
                    ? null
                    : positiveInteger($data['capacity'], 'capacity');
            } elseif (!$partial) {
                $values['capacity'] = null;
            }
        } else {
            if (array_key_exists('total_quantity', $data)) {
                $values['total_quantity'] = positiveInteger($data['total_quantity'], 'total_quantity');
            } elseif (!$partial) {
                sendJson(['error' => 'total_quantity is required for equipment.'], 422);
            }
        }

        return $values;
    }

    private function ensureExists(int $id): void
    {
        $statement = $this->db->prepare("SELECT id FROM {$this->table} WHERE id = :id");
        $statement->execute(['id' => $id]);
        if ($statement->fetch() === false) {
            sendJson(['error' => 'Resource not found.'], 404);
        }
    }

    private function ensureActiveExists(int $id): void
    {
        $statement = $this->db->prepare(
            "SELECT id FROM {$this->table} WHERE id = :id AND is_active = 1"
        );
        $statement->execute(['id' => $id]);
        if ($statement->fetch() === false) {
            sendJson(['error' => 'Resource not found or inactive.'], 404);
        }
    }

    private function readCreated(int $id, int $status = 200): never
    {
        $statement = $this->db->prepare("SELECT * FROM {$this->table} WHERE id = :id");
        $statement->execute(['id' => $id]);
        $resource = $statement->fetch();
        if ($resource === false) {
            throw new RuntimeException('Saved resource could not be read back.');
        }
        sendJson(['data' => $resource], $status);
    }
}
