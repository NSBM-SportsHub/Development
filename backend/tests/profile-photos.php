<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/shared/bootstrap.php';

use SportsHub\ApiException;
use SportsHub\CloudinaryClient;
use SportsHub\Database;
use SportsHub\ProfilePhotoService;
use SportsHub\UserRepository;

$name = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($name) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $name)) exit(1);
$db = Database::get();
if (str_starts_with($argv[1] ?? '', '--seed-user=')) {
    $id = filter_var(substr($argv[1], 12), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$id || UserRepository::find($id) === null) exit(1);
    $publicId = 'fixture-photo-' . $id . '-' . bin2hex(random_bytes(8));
    $url = 'https://res.cloudinary.com/fixture/image/upload/v123/' . $publicId . '.webp';
    $db->prepare('INSERT INTO user_profile_photos (user_id, cloud_name, public_id, version, photo_url) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE public_id = VALUES(public_id), photo_url = VALUES(photo_url)')
        ->execute([$id, 'fixture', $publicId, '123', $url]);
    echo json_encode(['photo_url' => $url], JSON_THROW_ON_ERROR);
    exit;
}

function ensure(bool $condition): void { if (!$condition) throw new RuntimeException('Profile photo fixture assertion failed.'); }
function rejects(callable $operation, int $status): void {
    try { $operation(); } catch (ApiException $error) { ensure($error->status === $status); return; }
    throw new RuntimeException('Expected a photo failure.');
}

$config = ['cloud_name' => 'fixture', 'api_key' => '123456', 'api_secret' => 'fixture-secret', 'folder' => 'fixture/profiles'];
$requests = [];
$mode = 'success';
$client = new CloudinaryClient($config, function (string $url, array $parameters, ?array $file) use (&$requests, &$mode): array {
    $requests[] = ['url' => $url, 'public_id' => $parameters['public_id']];
    ensure(str_starts_with($url, 'https://api.cloudinary.com/v1_1/fixture/image/'));
    ensure(!str_contains($url, 'fixture-secret'));
    if (str_ends_with($url, '/destroy')) {
        if ($mode === 'cleanup_failure') throw new ApiException(502, 'fixture', 'Synthetic provider outage');
        return ['result' => 'ok'];
    }
    ensure($file !== null && $file['mime'] === 'image/png');
    $signed = 'context=application=nsbm_sportshub&format=webp&overwrite=false&public_id=' . $parameters['public_id'] . '&timestamp=' . $parameters['timestamp'] . '&transformation=c_fill,g_auto,h_512,w_512fixture-secret';
    ensure(hash_equals(hash('sha1', $signed), $parameters['signature']));
    if ($mode === 'outage') throw new ApiException(502, 'fixture', 'Synthetic provider outage');
    return ['public_id' => $parameters['public_id'], 'version' => 123, 'resource_type' => 'image', 'format' => 'webp',
        'secure_url' => 'https://untrusted.example/photo.svg',
        'signature' => $mode === 'bad_signature' ? 'invalid' : hash('sha1', 'public_id=' . $parameters['public_id'] . '&version=123fixture-secret')];
});
$service = new ProfilePhotoService($client);
$actor = UserRepository::create(['name' => 'Photo Fixture', 'email' => bin2hex(random_bytes(8)) . '@example.test'], bin2hex(random_bytes(20)));
$other = UserRepository::create(['name' => 'Other Photo Fixture', 'email' => bin2hex(random_bytes(8)) . '@example.test'], bin2hex(random_bytes(20)));
$file = tempnam(sys_get_temp_dir(), 'sportshub-photo-');
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
try {
    file_put_contents($file, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    rejects(fn () => $service->upload($actor, $file), 422);
    file_put_contents($file, str_repeat('a', ProfilePhotoService::MAX_BYTES + 1));
    rejects(fn () => $service->upload($actor, $file), 422);
    ensure($requests === []);
    $oversized = substr_replace($png, pack('N', 9000), 16, 4);
    file_put_contents($file, $oversized);
    rejects(fn () => $service->upload($actor, $file), 422);
    ensure($requests === []);
    file_put_contents($file, $png);
    ensure(ProfilePhotoService::imageFile($file) === 'image/png');
    $empty = new ProfilePhotoService(new CloudinaryClient(['cloud_name' => '', 'api_key' => '', 'api_secret' => '', 'folder' => 'profiles']));
    rejects(fn () => $empty->upload($actor, $file), 503);
    $first = $service->upload($actor, $file);
    ensure(str_starts_with($first['photo_url'], 'https://res.cloudinary.com/fixture/image/upload/v123/fixture/profiles/' . $actor['id'] . '/'));
    ensure(UserRepository::publicUser(UserRepository::find((int) $actor['id']))['photo_url'] === $first['photo_url']);
    ensure(UserRepository::publicUser($other)['photo_url'] === null);
    $second = $service->upload($actor, $file);
    ensure($second['photo_url'] !== $first['photo_url']);
    ensure(str_ends_with($requests[count($requests) - 1]['url'], '/destroy'));
    $count = $db->prepare('SELECT COUNT(*) FROM user_profile_photos WHERE user_id = ?');
    $count->execute([$actor['id']]); ensure((int) $count->fetchColumn() === 1);
    foreach (['bad_signature', 'outage'] as $mode) {
        rejects(fn () => $service->upload($actor, $file), 502);
        ensure(UserRepository::publicUser($actor)['photo_url'] === $second['photo_url']);
    }
    $mode = 'success';
    $stale = $actor; $stale['auth_version']++;
    rejects(fn () => $service->upload($stale, $file), 401);
    ensure(str_ends_with($requests[count($requests) - 1]['url'], '/destroy'));
    ensure(UserRepository::publicUser($actor)['photo_url'] === $second['photo_url']);
    $mode = 'cleanup_failure';
    ensure($service->remove($actor)['photo_url'] === null);
    ensure($service->remove($actor)['photo_url'] === null);
    $count->execute([$actor['id']]); ensure((int) $count->fetchColumn() === 0);
    echo json_encode(['status' => 'passed', 'transport' => 'Cloudinary test double; no external requests',
        'verified' => ['real PDO persistence', 'replacement and old asset cleanup', 'owner scoping', 'MIME and size validation', 'signed requests and responses',
            'untrusted provider URL ignored', 'missing configuration', 'provider failures preserve previous photo', 'stale session rollback/cleanup', 'idempotent removal', 'cleanup outage after commit']], JSON_THROW_ON_ERROR);
} finally { if (is_file($file)) unlink($file); }
