<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/shared/bootstrap.php';

use SportsHub\ApiException;
use SportsHub\CloudinaryClient;
use SportsHub\Database;
use SportsHub\UniversityBrandingService;
use SportsHub\UserRepository;

$database = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($database) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $database)) exit(1);
function brandingCheck(bool $condition): void { if (!$condition) throw new RuntimeException('University branding fixture assertion failed.'); }
function brandingRejects(callable $operation, int $status): void {
    try { $operation(); } catch (ApiException $error) { brandingCheck($error->status === $status); return; }
    throw new RuntimeException('Expected branding operation to be rejected.');
}
$db = Database::get();
$admin = $db->query("SELECT * FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL ORDER BY id LIMIT 1")->fetch();
brandingCheck(is_array($admin));
$student = UserRepository::create(['name' => 'Branding Fixture Student', 'email' => bin2hex(random_bytes(8)) . '@example.test'], bin2hex(random_bytes(20)));
$config = ['cloud_name' => 'fixture', 'api_key' => '12345', 'api_secret' => 'branding-fixture-secret', 'folder' => 'fixture/profiles'];
$mode = 'success'; $requests = [];
$client = new CloudinaryClient($config, function (string $url, array $parameters, ?array $file) use (&$mode, &$requests): array {
    $requests[] = ['url' => $url, 'public_id' => $parameters['public_id']];
    brandingCheck(str_starts_with($url, 'https://api.cloudinary.com/v1_1/fixture/image/'));
    if (str_ends_with($url, '/destroy')) {
        if ($mode === 'cleanup_failure') throw new ApiException(502, 'fixture', 'Synthetic cleanup failure');
        return ['result' => 'ok'];
    }
    brandingCheck($parameters['transformation'] === 'c_limit,h_512,w_1024');
    brandingCheck(str_starts_with($parameters['public_id'], 'fixture/profiles/university-logo/'));
    brandingCheck($file !== null && $file['mime'] === 'image/png');
    $signed = 'context=application=nsbm_sportshub&format=webp&overwrite=false&public_id=' . $parameters['public_id'] . '&timestamp=' . $parameters['timestamp'] . '&transformation=c_limit,h_512,w_1024branding-fixture-secret';
    brandingCheck(hash_equals(hash('sha1', $signed), $parameters['signature']));
    if ($mode === 'outage') throw new ApiException(502, 'fixture', 'Synthetic provider failure');
    return ['public_id' => $parameters['public_id'], 'version' => 123, 'resource_type' => 'image', 'format' => 'webp',
        'secure_url' => 'https://untrusted.example/logo.svg',
        'signature' => $mode === 'bad_signature' ? 'invalid' : hash('sha1', 'public_id=' . $parameters['public_id'] . '&version=123branding-fixture-secret')];
});
$service = new UniversityBrandingService($client);
$file = tempnam(sys_get_temp_dir(), 'sportshub-brand-');
try {
    file_put_contents($file, '<svg></svg>');
    brandingRejects(fn () => $service->upload($admin, $file), 422);
    brandingRejects(fn () => $service->upload($student, $file), 403);
    brandingRejects(fn () => $service->remove($student), 403);
    brandingCheck($requests === []);
    file_put_contents($file, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='));
    $first = $service->upload($admin, $file);
    brandingCheck(str_starts_with($first['university_logo_url'], 'https://res.cloudinary.com/fixture/image/upload/v123/fixture/profiles/university-logo/'));
    brandingCheck(array_keys($first) === ['university_logo_url', 'updated_at']);
    brandingCheck(UniversityBrandingService::publicBranding() === $first);
    brandingCheck((int) $db->query('SELECT updated_by FROM site_branding WHERE id = 1')->fetchColumn() === (int) $admin['id']);
    $second = $service->upload($admin, $file);
    brandingCheck($first['university_logo_url'] !== $second['university_logo_url']);
    brandingCheck(str_ends_with($requests[count($requests) - 1]['url'], '/destroy'));
    foreach (['bad_signature', 'outage'] as $mode) {
        brandingRejects(fn () => $service->upload($admin, $file), 502);
        brandingCheck(UniversityBrandingService::publicBranding()['university_logo_url'] === $second['university_logo_url']);
    }
    $mode = 'success'; $stale = $admin; $stale['auth_version']++;
    brandingRejects(fn () => $service->upload($stale, $file), 401);
    brandingCheck(str_ends_with($requests[count($requests) - 1]['url'], '/destroy'));
    $forged = $student; $forged['role'] = 'admin';
    brandingRejects(fn () => $service->upload($forged, $file), 403);
    brandingRejects(fn () => $service->remove($forged), 403);
    brandingCheck(UniversityBrandingService::publicBranding()['university_logo_url'] === $second['university_logo_url']);
    foreach (preg_split('/;\s*(?:\r?\n|$)/', file_get_contents(dirname(__DIR__, 2) . '/database/migrations/011_site_branding.sql')) as $sql) {
        if (trim($sql) !== '') $db->exec($sql);
    }
    brandingCheck(UniversityBrandingService::publicBranding()['university_logo_url'] === $second['university_logo_url']);
    $mode = 'cleanup_failure';
    brandingCheck($service->remove($admin)['university_logo_url'] === null);
    brandingCheck($service->remove($admin)['university_logo_url'] === null);
    echo json_encode(['status' => 'passed', 'provider' => 'Injected Cloudinary transport double; no external requests',
        'checks' => ['Admin-only changes', 'real MySQL persistence', 'signed requests/responses', 'full logo aspect ratio', 'replacement cleanup',
            'provider failure preserves logo', 'stale session cleanup', 'actual-role revalidation', 'migration preserves configured logo', 'public field whitelist', 'idempotent removal']], JSON_THROW_ON_ERROR);
} finally { if (is_file($file)) unlink($file); }
