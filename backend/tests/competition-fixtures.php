<?php
declare(strict_types=1);

// Seeds the integration runner's random database and prints sport/club ids as JSON.
// Clubs have no API on main yet, so tests read ids and add edge-case clubs through this script.
require dirname(__DIR__) . '/src/shared/bootstrap.php';

$name = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($name) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $name)) {
    fwrite(STDERR, "Refusing to add fixtures outside the isolated test namespace.\n");
    exit(1);
}
$db = SportsHub\Database::get();
$db->exec("INSERT IGNORE INTO clubs (sport_id, name, status, is_archived)
    SELECT id, 'Archived Chess Society', 'active', 1 FROM sports WHERE name = 'Chess'");
$db->exec("INSERT IGNORE INTO clubs (sport_id, name, status)
    SELECT id, 'Second Badminton Club', 'recruiting' FROM sports WHERE name = 'Badminton'");
$output = ['sports' => [], 'clubs' => []];
foreach ($db->query('SELECT id, name FROM sports') as $row) {
    $output['sports'][$row['name']] = (int) $row['id'];
}
foreach ($db->query('SELECT id, name, sport_id FROM clubs') as $row) {
    $output['clubs'][$row['name']] = ['id' => (int) $row['id'], 'sport_id' => (int) $row['sport_id']];
}
echo json_encode($output, JSON_THROW_ON_ERROR);
