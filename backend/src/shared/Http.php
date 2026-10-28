<?php
declare(strict_types=1);

namespace SportsHub;

final class ApiException extends \RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $fields = [],
    ) {
        parent::__construct($message);
    }
}

final class Http
{
    public static function headers(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: no-referrer');
    }

    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        echo json_encode(['data' => $data, 'error' => null], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(ApiException $exception): never
    {
        http_response_code($exception->status);
        echo json_encode([
            'data' => null,
            'error' => [
                'code' => $exception->errorCode,
                'message' => $exception->getMessage(),
                'fields' => (object) $exception->fields,
            ],
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function body(): array
    {
        $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
        if ($type !== 'application/json') {
            throw new ApiException(415, 'unsupported_media_type', 'Send an application/json request body.');
        }
        $maximum = 16384;
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $maximum) {
            throw new ApiException(413, 'request_too_large', 'The request body is too large.');
        }
        $stream = fopen('php://input', 'rb');
        $body = $stream === false ? false : stream_get_contents($stream, $maximum + 1);
        if (is_resource($stream)) {
            fclose($stream);
        }
        if ($body === false || strlen($body) > $maximum) {
            throw new ApiException(413, 'request_too_large', 'The request body is too large.');
        }
        try {
            $decoded = json_decode($body, false, 16, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new ApiException(400, 'invalid_json', 'The request body must contain valid JSON.');
        }
        if (!$decoded instanceof \stdClass) {
            throw new ApiException(400, 'invalid_json', 'The request body must be a JSON object.');
        }
        return (array) $decoded;
    }

    public static function requireMethod(string $method, array $allowed): void
    {
        if (!in_array($method, $allowed, true)) {
            header('Allow: ' . implode(', ', $allowed));
            throw new ApiException(405, 'method_not_allowed', 'This request method is not supported.');
        }
    }
}

