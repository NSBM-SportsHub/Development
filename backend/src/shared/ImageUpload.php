<?php
declare(strict_types=1);

namespace SportsHub;

final class ImageUpload
{
    public const MAX_BYTES = 5 * 1024 * 1024;

    public static function receive(string $field): string
    {
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 6 * 1024 * 1024) throw new ApiException(413, 'request_too_large', 'Choose an image no larger than 5 MB.');
        if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data;')) throw new ApiException(415, 'unsupported_media_type', 'Send the image as multipart/form-data.');
        Validation::allowed($_POST, []);
        Validation::allowed($_FILES, [$field]);
        $file = $_FILES[$field] ?? null;
        if (!is_array($file) || !is_int($file['error'] ?? null)) Validation::fail($field, 'Choose an image to upload.');
        if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) throw new ApiException(413, 'request_too_large', 'Choose an image no larger than 5 MB and check the PHP upload limit.');
        if ($file['error'] !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) Validation::fail($field, 'The image could not be received. Please choose it again.');
        return $file['tmp_name'];
    }

    public static function validate(string $path, string $field = 'photo'): string
    {
        if (!is_file($path) || !is_readable($path)) Validation::fail($field, 'The image could not be read. Please choose it again.');
        clearstatcache(true, $path);
        $size = filesize($path);
        if ($size === false || $size === 0 || $size > self::MAX_BYTES) Validation::fail($field, 'Choose an image no larger than 5 MB.');
        $image = @getimagesize($path);
        if ($image === false || !in_array($image['mime'] ?? null, ['image/jpeg', 'image/png', 'image/webp'], true)) Validation::fail($field, 'Choose a JPEG, PNG or WebP image.');
        if ($image[0] < 1 || $image[1] < 1 || $image[0] > 8000 || $image[1] > 8000 || $image[0] * $image[1] > 16000000) Validation::fail($field, 'Choose an image with no more than 16 million pixels and 8000 pixels per side.');
        return $image['mime'];
    }
}
