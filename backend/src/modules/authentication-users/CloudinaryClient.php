<?php
declare(strict_types=1);

namespace SportsHub;

// A fixed HTTPS Upload API endpoint; credentials and transport stay on the server.
final class CloudinaryClient
{
    private array $settings;
    private ?\Closure $transport;

    public function __construct(?array $settings = null, ?\Closure $transport = null)
    {
        $this->settings = $settings ?? Config::all()['cloudinary'];
        $this->transport = $transport;
    }

    public function upload(string $path, string $mime, int $userId): array
    {
        return $this->uploadImage($path, $mime, (string) $userId, 'c_fill,g_auto,h_512,w_512');
    }

    public function uploadLogo(string $path, string $mime): array
    {
        // Preserve the full logo and its transparency, without a profile-photo crop.
        return $this->uploadImage($path, $mime, 'university-logo', 'c_limit,h_512,w_1024');
    }

    public function uploadBanner(string $path, string $mime, int $promotionId): array
    {
        return $this->uploadImage($path, $mime, 'events/' . $promotionId, 'c_limit,h_1200,w_2000');
    }

    private function uploadImage(string $path, string $mime, string $scope, string $transformation): array
    {
        $settings = $this->configured();
        $publicId = $settings['folder'] . '/' . $scope . '/' . bin2hex(random_bytes(16));
        $parameters = ['public_id' => $publicId, 'overwrite' => 'false', 'timestamp' => (string) time(),
            'transformation' => $transformation, 'format' => 'webp', 'context' => 'application=nsbm_sportshub'];
        $response = $this->send('upload', $parameters, ['path' => $path, 'mime' => $mime]);
        $version = $response['version'] ?? null;
        $signature = $response['signature'] ?? null;
        if (($response['public_id'] ?? null) !== $publicId || !is_scalar($version) || !preg_match('/\A[0-9]{1,30}\z/', (string) $version)
            || !is_string($signature) || !hash_equals(self::signature(['public_id' => $publicId, 'version' => (string) $version], $settings['api_secret']), $signature)
            || ($response['resource_type'] ?? null) !== 'image' || ($response['format'] ?? null) !== 'webp') {
            throw new ApiException(502, 'photo_upload_failed', 'The image service returned an invalid response. Please try again.');
        }
        // Construct the delivery URL from verified fields, never a client-supplied URL.
        return ['cloud_name' => $settings['cloud_name'], 'public_id' => $publicId, 'version' => (string) $version,
            'photo_url' => 'https://res.cloudinary.com/' . $settings['cloud_name'] . '/image/upload/v' . $version . '/' . $publicId . '.webp'];
    }

    public function destroy(array $photo): void
    {
        $settings = $this->configured();
        if ($photo['cloud_name'] !== $settings['cloud_name']) throw new ApiException(503, 'photo_cleanup_failed', 'The previous photo belongs to a different Cloudinary environment.');
        $response = $this->send('destroy', ['public_id' => $photo['public_id'], 'invalidate' => 'true', 'timestamp' => (string) time()]);
        if (!in_array($response['result'] ?? null, ['ok', 'not found'], true)) {
            throw new ApiException(502, 'photo_cleanup_failed', 'The image service could not remove the photo.');
        }
    }

    public static function signature(array $parameters, string $secret): string
    {
        ksort($parameters);
        $pairs = [];
        foreach ($parameters as $key => $value) $pairs[] = $key . '=' . $value;
        return hash('sha1', implode('&', $pairs) . $secret);
    }

    private function configured(): array
    {
        $settings = $this->settings;
        if (!preg_match('/\A[a-zA-Z0-9_-]{1,100}\z/', (string) ($settings['cloud_name'] ?? ''))
            || !preg_match('/\A[0-9]+\z/', (string) ($settings['api_key'] ?? '')) || !is_string($settings['api_secret'] ?? null) || $settings['api_secret'] === ''
            || !preg_match('~\A[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*\z~', (string) ($settings['folder'] ?? '')) || strlen($settings['folder']) > 160) {
            throw new ApiException(503, 'photo_service_unavailable', 'Image uploads are not configured. Contact your administrator.');
        }
        return $settings;
    }

    private function send(string $action, array $parameters, ?array $file = null): array
    {
        $settings = $this->configured();
        $parameters['signature'] = self::signature($parameters, $settings['api_secret']);
        $parameters['api_key'] = $settings['api_key'];
        $url = 'https://api.cloudinary.com/v1_1/' . $settings['cloud_name'] . '/image/' . $action;
        if ($this->transport !== null) return ($this->transport)($url, $parameters, $file);
        if (!function_exists('curl_init')) throw new ApiException(503, 'photo_service_unavailable', 'The image service requires PHP cURL. Contact your administrator.');
        if ($file !== null) $parameters['file'] = new \CURLFile($file['path'], $file['mime'], 'profile-photo');
        $curl = curl_init($url);
        curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $parameters, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 30, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2]);
        $body = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $failed = $body === false;
        curl_close($curl);
        if ($failed || $status < 200 || $status >= 300) {
            // Provider responses can contain credentials or request details. Never echo or log them.
            throw new ApiException(502, 'photo_upload_failed', 'The image service could not complete the request. Please try again.');
        }
        $response = json_decode($body, true);
        if (!is_array($response)) throw new ApiException(502, 'photo_upload_failed', 'The image service returned an invalid response. Please try again.');
        return $response;
    }
}
