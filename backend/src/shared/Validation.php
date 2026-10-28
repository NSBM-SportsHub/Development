<?php
declare(strict_types=1);

namespace SportsHub;

final class Validation
{
    public static function allowed(array $data, array $allowed): void
    {
        $unknown = array_diff(array_keys($data), $allowed);
        if ($unknown !== []) {
            $fields = [];
            foreach ($unknown as $field) {
                $fields[(string) $field] = 'This field is not allowed.';
            }
            throw new ApiException(422, 'validation_failed', 'Check the submitted fields.', $fields);
        }
    }

    public static function profile(array $data, bool $partial = false, bool $admin = false): array
    {
        $allowed = ['name', 'email', 'phone', 'student_id'];
        if ($admin) {
            $allowed = [...$allowed, 'role', 'status'];
        }
        self::allowed($data, $allowed);
        $output = [];
        $errors = [];
        foreach (['name' => 100, 'email' => 190] as $key => $maximum) {
            if ($partial && !array_key_exists($key, $data)) {
                continue;
            }
            $value = $data[$key] ?? null;
            if (!is_string($value) || trim($value) === '' || strlen(trim($value)) > $maximum || preg_match('/[\x00-\x1F\x7F]/', $value)) {
                $errors[$key] = 'Enter a ' . $key . ' of 1–' . $maximum . ' characters.';
                continue;
            }
            $value = trim($value);
            if ($key === 'email') {
                $value = strtolower($value);
                if (filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
                    $errors[$key] = 'Enter a valid email address.';
                    continue;
                }
            }
            $output[$key] = $value;
        }
        foreach (['phone' => 30, 'student_id' => 50] as $key => $maximum) {
            if (!array_key_exists($key, $data)) {
                if (!$partial) {
                    $output[$key] = null;
                }
                continue;
            }
            $value = $data[$key];
            if ($value === null || $value === '') {
                $output[$key] = null;
            } elseif (!is_string($value) || strlen(trim($value)) > $maximum || preg_match('/[\x00-\x1F\x7F]/', $value)) {
                $errors[$key] = 'Enter no more than ' . $maximum . ' characters.';
            } else {
                $output[$key] = trim($value) === '' ? null : trim($value);
            }
        }
        if ($admin) {
            foreach (['role' => ['student', 'admin'], 'status' => ['active', 'inactive']] as $key => $values) {
                if ($partial && !array_key_exists($key, $data)) {
                    continue;
                }
                $value = $data[$key] ?? ($key === 'role' ? 'student' : 'active');
                if (!is_string($value) || !in_array($value, $values, true)) {
                    $errors[$key] = 'Choose a valid ' . $key . '.';
                } else {
                    $output[$key] = $value;
                }
            }
        }
        if ($errors !== []) {
            throw new ApiException(422, 'validation_failed', 'Check the submitted fields.', $errors);
        }
        return $output;
    }

    public static function password(mixed $value, string $field = 'password'): string
    {
        if (!is_string($value) || strlen($value) > 72 || str_contains($value, "\0") || preg_match('//u', $value) !== 1 ||
            (function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : preg_match_all('/./us', $value)) < 12) {
            throw new ApiException(422, 'validation_failed', 'Check the submitted fields.', [
                $field => 'Use at least 12 characters and no more than 72 UTF-8 bytes, without null characters.',
            ]);
        }
        return $value;
    }

    public static function currentPassword(mixed $value): string
    {
        if (!is_string($value) || $value === '' || strlen($value) > 72 || str_contains($value, "\0")) {
            throw new ApiException(422, 'validation_failed', 'Enter your current password.', ['current_password' => 'Enter your current password.']);
        }
        return $value;
    }

    public static function positiveInteger(mixed $value, string $field, int $default, int $maximum): int
    {
        if ($value === null) {
            return $default;
        }
        if (!is_string($value) || !preg_match('/\A[1-9][0-9]{0,8}\z/', $value) || (int) $value > $maximum) {
            throw new ApiException(422, 'validation_failed', 'Check the query parameters.', [$field => 'Enter a valid positive integer up to ' . $maximum . '.']);
        }
        return (int) $value;
    }
}

