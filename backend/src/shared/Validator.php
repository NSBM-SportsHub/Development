<?php

declare(strict_types=1);

final class Validator
{
    public static function decodeJsonObject(string $json): array
    {
        $value = json_decode($json);
        if (!$value instanceof stdClass) {
            throw new InvalidArgumentException('Request body must be a JSON object.');
        }

        return get_object_vars($value);
    }

    public static function requireString(array $data, string $key, int $minLength = 1, ?int $maxLength = null): string
    {
        if (!array_key_exists($key, $data) || !is_string($data[$key])) {
            throw new InvalidArgumentException("Field '{$key}' is required and must be a string.");
        }

        $value = trim($data[$key]);
        if (mb_strlen($value) < $minLength) {
            throw new InvalidArgumentException("Field '{$key}' is too short.");
        }

        if ($maxLength !== null && mb_strlen($value) > $maxLength) {
            throw new InvalidArgumentException("Field '{$key}' is too long.");
        }

        return $value;
    }

    public static function requireInt(array $data, string $key): int
    {
        if (!array_key_exists($key, $data) || !is_numeric($data[$key])) {
            throw new InvalidArgumentException("Field '{$key}' is required and must be an integer.");
        }

        $value = (int) $data[$key];
        if ((string) $value !== trim((string) $data[$key])) {
            throw new InvalidArgumentException("Field '{$key}' must be a valid integer.");
        }

        return $value;
    }

    public static function requireDate(array $data, string $key): string
    {
        $value = self::requireString($data, $key, 1, 255);
        $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new InvalidArgumentException("Field '{$key}' must be a valid date in YYYY-MM-DD format.");
        }

        return $value;
    }

    public static function optionalString(array $data, string $key, ?int $maxLength = null): ?string
    {
        if (!array_key_exists($key, $data) || $data[$key] === null || $data[$key] === '') {
            return null;
        }

        if (!is_string($data[$key])) {
            throw new InvalidArgumentException("Field '{$key}' must be a string.");
        }

        $value = trim($data[$key]);
        if ($maxLength !== null && mb_strlen($value) > $maxLength) {
            throw new InvalidArgumentException("Field '{$key}' is too long.");
        }

        return $value;
    }
}
