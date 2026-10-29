<?php
declare(strict_types=1);

namespace SportsHub;

use DateTimeImmutable;
use DateTimeZone;

// Preserve the module's validators while sharing the application's response contract.
function sendJson(mixed $payload, int $status = 200): never
{
    if ($status >= 400) {
        $code = match ($status) {
            400 => 'invalid_request',
            401 => 'unauthenticated',
            403 => 'forbidden',
            404 => 'not_found',
            405 => 'method_not_allowed',
            409 => 'conflict',
            422 => 'validation_failed',
            default => 'internal_error',
        };
        $fields = [];
        foreach ($payload['fields'] ?? [] as $field) {
            $fields[$field] = $payload['error'];
        }
        // Throw so controller transactions roll back before the common error handler runs.
        throw new ApiException($status, $code, $payload['error'], $fields);
    }
    if ($status === 204) {
        http_response_code(204);
        exit;
    }
    Http::json($payload['data'] ?? null, $status);
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
