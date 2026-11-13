<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/shared/bootstrap.php';

$name = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($name) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $name)) {
    fwrite(STDERR, "Snapshot fixtures require an isolated test database.\n");
    exit(1);
}
$db = SportsHub\Database::get();
if (($argv[1] ?? '') === 'seed') {
    $statement = $db->prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)");
    $statement->execute(['Backup Test Student', 'backup@example.test', password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT)]);
    $user = (int) $db->lastInsertId();
    $db->prepare("INSERT INTO event_promotions (title,description,category,venue,starts_at,ends_at,created_by) VALUES ('Backup Test Camp','Synthetic fixture','camp','Test ground','2090-01-01 09:00:00','2090-01-01 11:00:00',?)")->execute([$user]);
    $db->prepare("INSERT INTO user_profile_photos (user_id, cloud_name, public_id, version, photo_url) VALUES (?, 'fixture', 'backup/photo', '1', 'https://res.cloudinary.com/fixture/image/upload/v1/backup/photo.webp')")->execute([$user]);
    $db->prepare("UPDATE site_branding SET cloud_name = 'fixture', public_id = 'backup/university-logo', version = '1', logo_url = 'https://res.cloudinary.com/fixture/image/upload/v1/backup/university-logo.webp', updated_by = ? WHERE id = 1")->execute([$user]);
    $db->exec("INSERT INTO facilities (name, location) VALUES ('Backup Test Court', 'Synthetic fixture')");
    $facility = (int) $db->lastInsertId();
    $statement = $db->prepare("INSERT INTO bookings (facility_id, requested_by, starts_at, ends_at, quantity, status) VALUES (?, ?, '2032-05-11 15:00:00', '2032-05-11 16:00:00', 1, 'pending')");
    $statement->execute([$facility, $user]);
    exit(0);
}
if (($argv[1] ?? '') !== 'snapshot') {
    fwrite(STDERR, "Usage: database-snapshot.php seed|snapshot\n");
    exit(1);
}
$snapshot = [];
foreach ($db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
    if (!preg_match('/\A[a-z_]+\z/', $table)) throw new RuntimeException('Unexpected fixture table name.');
    $rows = array_map(static fn(array $row): string => json_encode($row, JSON_THROW_ON_ERROR), $db->query('SELECT * FROM `' . $table . '`')->fetchAll());
    sort($rows, SORT_STRING);
    $snapshot[$table] = ['rows' => count($rows), 'sha256' => hash('sha256', implode("\n", $rows))];
}
ksort($snapshot);
echo json_encode($snapshot, JSON_THROW_ON_ERROR);
