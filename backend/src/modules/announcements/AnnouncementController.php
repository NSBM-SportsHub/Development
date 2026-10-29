<?php
declare(strict_types=1);

namespace SportsHub;

final class AnnouncementController
{
    public static function listing(array $query): array
    {
        $user = Session::requireUser();
        Validation::allowed($query, ['include_deleted']);
        $includeDeleted = ($query['include_deleted'] ?? '0') === '1';
        if (isset($query['include_deleted']) && !in_array($query['include_deleted'], ['0', '1'], true)) {
            throw new ApiException(422, 'validation_failed', 'Check the query parameters.', [
                'include_deleted' => 'Choose 0 or 1.',
            ]);
        }
        if ($includeDeleted && $user['role'] !== 'admin') {
            throw new ApiException(403, 'forbidden', 'Administrator access is required.');
        }
        return ['announcements' => AnnouncementRepository::listing($includeDeleted)];
    }

    public static function show(string $id): array
    {
        $user = Session::requireUser();
        $announcement = AnnouncementRepository::find($id, $user['role'] === 'admin');
        return $announcement ?? throw new ApiException(404, 'not_found', 'This announcement could not be found.');
    }

    public static function create(array $body): array
    {
        Session::requireAdmin();
        Validation::allowed($body, ['club_id', 'title', 'body', 'is_pinned']);
        $data = self::validate($body, false);
        self::validateClub($data['club_id']);
        return AnnouncementRepository::create($data);
    }

    public static function update(string $id, array $body): array
    {
        Session::requireAdmin();
        Validation::allowed($body, ['club_id', 'title', 'body', 'is_pinned']);
        $changes = self::validate($body, true);
        if ($changes === []) {
            throw new ApiException(422, 'validation_failed', 'Provide at least one announcement field to update.');
        }
        if (array_key_exists('club_id', $changes)) {
            self::validateClub($changes['club_id']);
        }
        return AnnouncementRepository::update($id, $changes)
            ?? throw new ApiException(404, 'not_found', 'This announcement could not be found.');
    }

    public static function delete(string $id, array $body): array
    {
        Session::requireAdmin();
        Validation::allowed($body, []);
        if (!AnnouncementRepository::softDelete($id)) {
            throw new ApiException(404, 'not_found', 'This announcement could not be found.');
        }
        return ['message' => 'Announcement deleted.'];
    }

    private static function validate(array $body, bool $partial): array
    {
        $data = [];
        $errors = [];
        foreach (['title' => 255, 'body' => 65535] as $field => $maximum) {
            if ($partial && !array_key_exists($field, $body)) {
                continue;
            }
            $value = $body[$field] ?? null;
            $value = is_string($value) ? trim($value) : $value;
            $length = is_string($value) && preg_match('//u', $value) === 1
                ? (function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value))
                : 0;
            $minimum = $field === 'title' ? 3 : 10;
            if (!is_string($value) || $length < $minimum || $length > $maximum ||
                ($field === 'body' && strlen($value) > 65535) ||
                preg_match('/[\x00-\x1F\x7F]/', $field === 'title' ? $value : str_replace(["\r", "\n", "\t"], '', (string) $value))) {
                $errors[$field] = 'Enter ' . $minimum . '–' . $maximum . ' valid characters.';
                continue;
            }
            $data[$field] = $value;
        }
        if (!$partial || array_key_exists('club_id', $body)) {
            $value = $body['club_id'] ?? null;
            if ($value !== null && (!is_int($value) || $value < 1 || $value > 2147483647)) {
                $errors['club_id'] = 'Choose a valid club ID or leave it empty.';
            } else {
                $data['club_id'] = $value;
            }
        }
        if (!$partial || array_key_exists('is_pinned', $body)) {
            $value = $body['is_pinned'] ?? false;
            if (!is_bool($value)) {
                $errors['is_pinned'] = 'Choose true or false.';
            } else {
                $data['is_pinned'] = $value ? 1 : 0;
            }
        }
        if ($errors !== []) {
            throw new ApiException(422, 'validation_failed', 'Check the submitted fields.', $errors);
        }
        return $data;
    }

    private static function validateClub(?int $clubId): void
    {
        if ($clubId !== null && !AnnouncementRepository::clubExists($clubId)) {
            throw new ApiException(422, 'validation_failed', 'Check the submitted fields.', [
                'club_id' => 'Choose an existing club.',
            ]);
        }
    }
}
