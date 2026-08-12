<?php
// api/driver_login.php
require 'config.php';

function getDriverLoginRecord($pdo, $where, $value) {
    $stmt = $pdo->prepare("
        SELECT
            u.id AS userId,
            u.username,
            u.password,
            u.role,
            d.driver_id AS driverId,
            d.full_name AS fullName,
            d.vehicle_type AS vehicleType,
            d.plate_number AS plateNumber,
            d.photo,
            d.contact,
            d.address,
            d.birthdate,
            d.gender,
            d.license_no AS licenseNo,
            d.status,
            d.created_at AS registrationDate,
            d.license_expiration AS licenseExpiration
        FROM users u
        JOIN drivers d ON d.user_id = u.id
        WHERE $where AND u.role = 'driver'
        LIMIT 1
    ");
    $stmt->execute([$value]);
    return $stmt->fetch();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sessionUser = currentAuthenticatedUser();
    if (!$sessionUser || $sessionUser['role'] !== 'driver') {
        respond(['success' => false, 'error' => 'Not authenticated'], 401);
    }

    $driver = getDriverLoginRecord($pdo, 'u.id = ?', $sessionUser['id']);
    if (!$driver || $driver['status'] === 'Inactive') {
        endAuthenticatedSession();
        respond(['success' => false, 'error' => 'Account is inactive or unavailable'], 403);
    }

    unset($driver['password']);
    respond(['success' => true, 'driver' => $driver]);
}

if ($method !== 'POST') {
    respond(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
    respond(['success' => false, 'error' => 'Missing credentials'], 400);
}

$driver = getDriverLoginRecord($pdo, 'u.username = ?', $username);
if (!$driver || !verifyPasswordAndUpgrade($pdo, ['id' => $driver['userId'], 'password' => $driver['password']], $password)) {
    respond(['success' => false, 'error' => 'Invalid username or password'], 401);
}

if ($driver['status'] === 'Inactive') {
    respond(['success' => false, 'error' => 'Account is inactive'], 403);
}

startAuthenticatedSession([
    'id' => $driver['userId'],
    'username' => $driver['username'],
    'role' => 'driver'
], $driver['driverId']);

unset($driver['password']);
respond(['success' => true, 'driver' => $driver]);
?>
