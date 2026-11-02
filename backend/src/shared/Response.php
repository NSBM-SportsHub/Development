<?php

declare(strict_types=1);

namespace SportsHub;

// Adapt the sports/training controllers to the common API envelope.
final class Response
{
    public static function json(int $statusCode, array $payload): never
    {
        if ($statusCode >= 400) {
            Http::error(new ApiException($statusCode, match ($statusCode) {
                400, 422 => 'validation_failed',
                403 => 'forbidden',
                404 => 'not_found',
                409 => 'conflict',
                default => 'request_failed',
            }, $payload['message'] ?? 'The request could not be completed.'));
        }
        Http::json($payload['data'] ?? null, $statusCode);
    }
}
