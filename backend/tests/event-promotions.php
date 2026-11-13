<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/shared/bootstrap.php';

use SportsHub\ApiException;
use SportsHub\CloudinaryClient;
use SportsHub\Database;
use SportsHub\EventPromotionService;
use SportsHub\UserRepository;

$database = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($database) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $database)) exit(1);
$db = Database::get();
function eventCheck(bool $value): void { if (!$value) throw new RuntimeException('Event promotion assertion failed.'); }
function eventReject(callable $operation, int $status): void {
    try { $operation(); } catch (ApiException $e) { eventCheck($e->status === $status); return; }
    throw new RuntimeException('Expected event operation to fail.');
}
if (($argv[1] ?? '') === '--seed-banner') {
    $id = filter_var($argv[2] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]); if (!$id) exit(1);
    $db->prepare("UPDATE event_promotions SET cloud_name='fixture', public_id='fixture/events/banner', version='1', banner_url='https://res.cloudinary.com/fixture/image/upload/v1/fixture/events/banner.webp' WHERE id=? AND deleted_at IS NULL")->execute([$id]);
    echo json_encode(['seeded' => $id]); exit;
}
$actor = $db->query("SELECT * FROM users WHERE role='admin' AND status='active' AND deleted_at IS NULL ORDER BY id LIMIT 1")->fetch(); eventCheck(is_array($actor));
$originalVersion = $actor['auth_version'];
$student = UserRepository::create(['name' => 'Event Test Student', 'email' => bin2hex(random_bytes(8)) . '@example.test'], bin2hex(random_bytes(20)));
$event = EventPromotionService::save($actor, null, ['title'=>'Banner provider fixture','description'=>'Synthetic test only','category'=>'camp','venue'=>'Test ground','starts_at'=>'2090-01-01T09:00:00Z','ends_at'=>'2090-01-01T11:00:00Z']);
$settings = ['cloud_name'=>'fixture','api_key'=>'12345','api_secret'=>'event-fixture-secret','folder'=>'fixture/profiles'];
$mode = 'ok'; $uploads = 0; $destroyed = [];
$cloud = new CloudinaryClient($settings, function(string $url, array $parameters, ?array $file) use (&$mode, &$uploads, &$destroyed, $actor, $settings, $db): array {
    $signature = $parameters['signature']; unset($parameters['signature'], $parameters['api_key']);
    eventCheck(hash_equals(CloudinaryClient::signature($parameters, $settings['api_secret']), $signature));
    if (str_ends_with($url, '/destroy')) { $destroyed[]=$parameters['public_id']; return ['result'=>'ok']; }
    $uploads++; eventCheck($parameters['transformation']==='c_limit,h_1200,w_2000');
    eventCheck(str_contains($parameters['public_id'], '/events/')); eventCheck($file['mime']==='image/png');
    if ($mode === 'revoke') $db->prepare('UPDATE users SET auth_version=auth_version+1 WHERE id=?')->execute([$actor['id']]);
    if ($mode === 'invalid') return ['signature'=>'invalid'];
    return ['public_id'=>$parameters['public_id'],'version'=>'123','signature'=>CloudinaryClient::signature(['public_id'=>$parameters['public_id'],'version'=>'123'],$settings['api_secret']),'resource_type'=>'image','format'=>'webp'];
});
$service = new EventPromotionService($cloud);
$image = tempnam(sys_get_temp_dir(), 'event');
file_put_contents($image, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='));
try {
    $first = $service->banner($actor,$event['id'],$image); eventCheck(str_starts_with($first['banner_url'],'https://res.cloudinary.com/fixture/'));
    $statement=$db->prepare('SELECT banner_url FROM event_promotions WHERE id=?');$statement->execute([$event['id']]);eventCheck($statement->fetchColumn()===$first['banner_url']);
    $second=$service->banner($actor,$event['id'],$image);eventCheck($second['banner_url']!==$first['banner_url']);eventCheck(count($destroyed)===1);
    $mode='invalid';eventReject(fn()=>$service->banner($actor,$event['id'],$image),502);eventCheck(EventPromotionService::listing(true,$event['id'])['banner_url']===$second['banner_url']);
    $before=$uploads;eventReject(fn()=>$service->banner($student,$event['id'],$image),403);eventCheck($uploads===$before);
    $mode='revoke';eventReject(fn()=>$service->banner($actor,$event['id'],$image),401);eventCheck(count($destroyed)===2);eventCheck(EventPromotionService::listing(true,$event['id'])['banner_url']===$second['banner_url']);
    $actor=UserRepository::find((int)$actor['id']);$mode='ok';eventCheck($service->banner($actor,$event['id'],null)['banner_url']===null);
    $db->prepare("UPDATE users SET role='student' WHERE id=?")->execute([$actor['id']]);
    eventReject(fn()=>EventPromotionService::save($actor,$event['id'],['published'=>true]),403);
    $db->prepare("UPDATE users SET role='admin' WHERE id=?")->execute([$actor['id']]);
    EventPromotionService::remove($actor,$event['id']);
    echo json_encode(['status'=>'passed','checks'=>['signed wide-image upload','independent PDO persistence','replacement cleanup','provider failure preserves banner','student denied before provider','session revoked during upload rolls back and cleans new asset','banner removal','role revalidated under lock','soft deletion']]);
} finally {
    $db->prepare("UPDATE users SET role='admin', auth_version=? WHERE id=?")->execute([$originalVersion,$actor['id']]);
    unlink($image);
}
