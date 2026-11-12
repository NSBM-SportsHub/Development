<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/shared/bootstrap.php';

use SportsHub\Database;

$name = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($name) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $name)) {
    exit(1);
}

if (($argv[1] ?? '') !== '--seed') {
    exit(1);
}

$db = Database::get();
$publicId = 'fixture-university-logo-' . bin2hex(random_bytes(8));
$url = 'https://res.cloudinary.com/fixture/image/upload/v123/' . $publicId . '.webp';
$admin = $db->query("SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY id LIMIT 1")->fetchColumn();

if (!$admin) {
    exit(1);
}

$db->prepare('UPDATE site_branding SET cloud_name = ?, public_id = ?, version = ?, logo_url = ?, updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = 1')
    ->execute(['fixture', $publicId, '123', $url, (int) $admin]);

echo json_encode(['logo_url' => $url], JSON_THROW_ON_ERROR);
