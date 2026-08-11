<?php
// api/driver_login.php
require 'config.php';

$body = json_decode(file_get_contents('php://input'), true);
$username = trim($body['username'] ?? '');
$password = trim($body['password'] ?? '');

if (!$username || !$password) {
    respond(['success' => false, 'error' => 'Missing credentials'], 400);
}

$stmt = $pdo->prepare("
    SELECT 
        u.username, 
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
        d.license_expiration AS licenseExpiration,
        u.password
    FROM users u
    JOIN drivers d ON d.user_id = u.id
    WHERE u.username = ? AND u.role = 'driver'
");
$stmt->execute([$username]);
$user = $stmt->fetch();

if ($user && $user['password'] === hash('sha256', $password)) {
    if ($user['status'] === 'Inactive') {
        respond(['success' => false, 'error' => 'Account is inactive'], 403);
    }
    unset($user['password']);
    respond(['success' => true, 'driver' => $user]);
} else {
    respond(['success' => false, 'error' => 'Invalid username or password'], 401);
}
?>
