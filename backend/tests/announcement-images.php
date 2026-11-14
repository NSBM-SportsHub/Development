<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/shared/bootstrap.php';

use SportsHub\{ApiException, AnnouncementImageService, AnnouncementRepository, CloudinaryClient, Database, UserRepository};

$name = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($name) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $name)) exit(1);
$db = Database::get();
if (($argv[1] ?? '') === '--seed-image') {
    $id = $argv[2] ?? '';
    if (!preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/', $id) || AnnouncementRepository::find($id) === null) exit(1);
    $db->prepare("INSERT INTO announcement_images (announcement_id, cloud_name, public_id, version, image_url) VALUES (?, 'fixture', ?, '1', ?)
        ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)")
        ->execute([$id, 'fixture/announcements/' . $id, 'https://res.cloudinary.com/fixture/image/upload/v1/fixture/announcements/' . $id . '.webp']);
    echo json_encode(['seeded' => $id]); exit;
}
function announcementCheck(bool $value): void { if (!$value) throw new RuntimeException('Announcement image assertion failed.'); }
function announcementReject(callable $operation, int $status): void {
    try { $operation(); } catch (ApiException $error) { announcementCheck($error->status === $status); return; }
    throw new RuntimeException('Expected announcement image operation to fail.');
}
$actor = $db->query("SELECT * FROM users WHERE role='admin' AND status='active' AND deleted_at IS NULL ORDER BY id LIMIT 1")->fetch();
announcementCheck(is_array($actor));
$authVersion = $actor['auth_version'];
$student = UserRepository::create(['name' => 'Announcement image student', 'email' => bin2hex(random_bytes(8)) . '@example.test'], bin2hex(random_bytes(20)));
$data = ['club_id' => null, 'title' => 'Announcement image fixture', 'body' => 'Public fixture announcement body.', 'is_pinned' => 0];
$plain = AnnouncementRepository::create($data);
$record = AnnouncementRepository::create($data);
$settings = ['cloud_name' => 'fixture', 'api_key' => '12345', 'api_secret' => 'announcement-fixture-secret', 'folder' => 'fixture/profiles'];
$mode = 'ok'; $uploads = 0; $destroyed = [];
$cloud = new CloudinaryClient($settings, function (string $url, array $parameters, ?array $file) use (&$mode, &$uploads, &$destroyed, $settings, $db, $actor): array {
    $signature = $parameters['signature']; unset($parameters['signature'], $parameters['api_key']);
    announcementCheck(hash_equals(CloudinaryClient::signature($parameters, $settings['api_secret']), $signature));
    if (str_ends_with($url, '/destroy')) { $destroyed[] = $parameters['public_id']; return ['result' => 'ok']; }
    $uploads++;
    announcementCheck($parameters['transformation'] === 'c_limit,h_1200,w_2000' && str_contains($parameters['public_id'], '/announcements/'));
    announcementCheck($file['mime'] === 'image/png');
    if ($mode === 'revoke') $db->prepare('UPDATE users SET auth_version = auth_version + 1 WHERE id = ?')->execute([$actor['id']]);
    return ['public_id' => $parameters['public_id'], 'version' => '123', 'resource_type' => 'image', 'format' => 'webp',
        'signature' => $mode === 'invalid' ? 'invalid' : CloudinaryClient::signature(['public_id' => $parameters['public_id'], 'version' => '123'], $settings['api_secret'])];
});
$service = new AnnouncementImageService($cloud);
$image = tempnam(sys_get_temp_dir(), 'announcement');
try {
    announcementCheck($plain['image_url'] === null);
    announcementReject(fn() => AnnouncementRepository::featured($plain['announcement_id']), 404);
    file_put_contents($image, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    announcementReject(fn() => $service->save($actor, $record['announcement_id'], $image), 422);
    announcementCheck($uploads === 0);
    file_put_contents($image, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='));
    $first = $service->save($actor, $record['announcement_id'], $image);
    announcementCheck(AnnouncementRepository::featured($record['announcement_id'])['image_url'] === $first['image_url']);
    $statement = $db->prepare('SELECT image_url FROM announcement_images WHERE announcement_id = ?');
    $statement->execute([$record['announcement_id']]); announcementCheck($statement->fetchColumn() === $first['image_url']);
    $second = $service->save($actor, $record['announcement_id'], $image);
    announcementCheck($second['image_url'] !== $first['image_url'] && count($destroyed) === 1);
    $mode = 'invalid'; announcementReject(fn() => $service->save($actor, $record['announcement_id'], $image), 502);
    announcementCheck(AnnouncementRepository::find($record['announcement_id'])['image_url'] === $second['image_url']);
    $before = $uploads; announcementReject(fn() => $service->save($student, $record['announcement_id'], $image), 403); announcementCheck($before === $uploads);
    $mode = 'revoke'; announcementReject(fn() => $service->save($actor, $record['announcement_id'], $image), 401);
    announcementCheck(count($destroyed) === 2 && AnnouncementRepository::find($record['announcement_id'])['image_url'] === $second['image_url']);
    $db->prepare('UPDATE users SET auth_version = ? WHERE id = ?')->execute([$authVersion, $actor['id']]);
    $mode = 'ok';
    announcementCheck($service->save($actor, $record['announcement_id'], null)['image_url'] === null);
    announcementReject(fn() => AnnouncementRepository::featured($record['announcement_id']), 404);
    $service->save($actor, $record['announcement_id'], $image);
    AnnouncementRepository::softDelete($record['announcement_id']);
    announcementReject(fn() => AnnouncementRepository::featured($record['announcement_id']), 404);
    $before = $uploads; announcementReject(fn() => $service->save($actor, $record['announcement_id'], $image), 404); announcementCheck($before === $uploads);
    $pinned = AnnouncementRepository::create([...$data, 'title' => 'Pinned hero fixture', 'is_pinned' => 1]);
    $service->save($actor, $pinned['announcement_id'], $image);
    $live = AnnouncementRepository::create($data); $service->save($actor, $live['announcement_id'], $image);
    $ids = array_column(AnnouncementRepository::featured()['announcements'], 'announcement_id');
    announcementCheck(array_search($pinned['announcement_id'], $ids, true) < array_search($live['announcement_id'], $ids, true));
    echo json_encode(['status' => 'passed', 'image_id' => $live['announcement_id'], 'checks' => ['optional image', 'text-only is private', 'image validation', 'signed wide upload', 'PDO persistence', 'replacement cleanup', 'provider failure preserves old image', 'student denied before upload', 'revoked session cleanup', 'image removal', 'deleted announcements hidden', 'pin ordering']]);
} finally {
    $db->prepare('UPDATE users SET auth_version = ? WHERE id = ?')->execute([$authVersion, $actor['id']]);
    unlink($image);
}
