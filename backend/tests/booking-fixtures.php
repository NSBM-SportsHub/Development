<?php
declare(strict_types=1);

// Stages conflicting pending requests that the public API correctly refuses to create.
require dirname(__DIR__) . '/src/shared/bootstrap.php';

$name = getenv('SPORTSHUB_DB_NAME');
if (PHP_SAPI !== 'cli' || !is_string($name) || !preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', $name)) {
    fwrite(STDERR, "Refusing to add fixtures outside the isolated test namespace.\n");
    exit(1);
}
if ($argc !== 9 || !in_array($argv[1], ['facility', 'equipment'], true)) {
    fwrite(STDERR, "Usage: php booking-fixtures.php <facility|equipment> <resource-id> <requester-id> <requester-id> <quantity> <quantity> <starts-at> <ends-at>\n");
    exit(1);
}

$resourceType = $argv[1];
$resourceId = filter_var($argv[2], FILTER_VALIDATE_INT);
$requesterIds = [filter_var($argv[3], FILTER_VALIDATE_INT), filter_var($argv[4], FILTER_VALIDATE_INT)];
$quantities = [filter_var($argv[5], FILTER_VALIDATE_INT), filter_var($argv[6], FILTER_VALIDATE_INT)];
$start = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $argv[7], new DateTimeZone('UTC'));
$end = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $argv[8], new DateTimeZone('UTC'));
$dateErrors = DateTimeImmutable::getLastErrors();
if ($resourceId === false || $resourceId < 1
    || in_array(false, $requesterIds, true) || min($requesterIds) < 1
    || in_array(false, $quantities, true) || min($quantities) < 1
    || $start === false || $end === false || $end <= $start
    || ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0))) {
    fwrite(STDERR, "Booking fixture arguments are invalid.\n");
    exit(1);
}

$db = SportsHub\Database::get();
$resourceColumn = $resourceType === 'facility' ? 'facility_id' : 'equipment_id';
$otherColumn = $resourceType === 'facility' ? 'equipment_id' : 'facility_id';
$statement = $db->prepare(
    "INSERT INTO bookings ({$resourceColumn}, {$otherColumn}, requested_by, starts_at, ends_at, quantity, status)
     VALUES (:resource_id, NULL, :requested_by, :starts_at, :ends_at, :quantity, 'pending')"
);
$bookingIds = [];
foreach ([0, 1] as $index) {
    $statement->execute([
        'resource_id' => $resourceId,
        'requested_by' => $requesterIds[$index],
        'starts_at' => $start->format('Y-m-d H:i:s'),
        'ends_at' => $end->format('Y-m-d H:i:s'),
        'quantity' => $quantities[$index],
    ]);
    $bookingIds[] = (int) $db->lastInsertId();
}

echo json_encode($bookingIds, JSON_THROW_ON_ERROR);
