<?php
declare(strict_types=1);

function sendJson(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if ($status !== 204) {
        echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        sendJson(['error' => 'Request body must be valid JSON.'], 400);
    }

    if (!is_array($decoded) || array_is_list($decoded)) {
        sendJson(['error' => 'Request body must be a JSON object.'], 400);
    }

    return $decoded;
}

function rejectUnknownFields(array $data, array $allowed): void
{
    $unknown = array_diff(array_keys($data), $allowed);
    if ($unknown !== []) {
        sendJson([
            'error' => 'Request contains unsupported fields.',
            'fields' => array_values($unknown),
        ], 422);
    }
}

function requireFields(array $data, array $fields): void
{
    $missing = [];
    foreach ($fields as $field) {
        if (!array_key_exists($field, $data)) {
            $missing[] = $field;
        }
    }

    if ($missing !== []) {
        sendJson(['error' => 'Required fields are missing.', 'fields' => $missing], 422);
    }
}

function positiveInteger(mixed $value, string $field): int
{
    $parsed = filter_var($value, FILTER_VALIDATE_INT);
    if ($parsed === false || $parsed < 1) {
        sendJson(['error' => "{$field} must be a positive integer."], 422);
    }

    return $parsed;
}

function stringField(mixed $value, string $field, int $maxLength, bool $nullable = false): ?string
{
    if ($nullable && $value === null) {
        return null;
    }
    if (!is_string($value)) {
        sendJson(['error' => "{$field} must be a string."], 422);
    }

    $value = trim($value);
    if ($value === '' || mb_strlen($value) > $maxLength) {
        sendJson(['error' => "{$field} must contain 1 to {$maxLength} characters."], 422);
    }

    return $value;
}

function optionalDescription(array $data): ?string
{
    if (!array_key_exists('description', $data) || $data['description'] === null) {
        return null;
    }
    if (!is_string($data['description']) || mb_strlen(trim($data['description'])) > 2000) {
        sendJson(['error' => 'description must be a string of at most 2000 characters.'], 422);
    }

    $description = trim($data['description']);
    return $description === '' ? null : $description;
}

function currentUser(): array
{
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user) || !isset($user['id'], $user['role'])) {
        sendJson(['error' => 'Authentication is required.'], 401);
    }

    $id = filter_var($user['id'], FILTER_VALIDATE_INT);
    if ($id === false || $id < 1 || !in_array($user['role'], ['Student', 'Admin'], true)) {
        sendJson(['error' => 'The authenticated account is invalid.'], 401);
    }

    return ['id' => $id, 'role' => $user['role']];
}

function requireAdmin(array $user): void
{
    if ($user['role'] !== 'Admin') {
        sendJson(['error' => 'Administrator permission is required.'], 403);
    }
}

function requireCsrfToken(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if (!is_string($provided) || !is_string($expected) || $expected === '' || !hash_equals($expected, $provided)) {
        sendJson(['error' => 'A valid CSRF token is required.'], 403);
    }
}

function parseUtcDateTime(mixed $value, string $field): string
{
    if (!is_string($value)
        || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/', $value) !== 1) {
        sendJson(['error' => "{$field} must be an ISO-8601 date-time."], 422);
    }

    $normalized = str_ends_with($value, 'Z')
        ? substr($value, 0, -1) . '+00:00'
        : $value;
    $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:sP', $normalized);
    $errors = DateTimeImmutable::getLastErrors();
    if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
        sendJson(['error' => "{$field} must be an ISO-8601 date-time."], 422);
    }

    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

function routeNotFound(): never
{
    sendJson(['error' => 'Endpoint not found.'], 404);
}
