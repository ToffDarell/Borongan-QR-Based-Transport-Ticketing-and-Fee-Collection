<?php
// api/drivers.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// GET all drivers or a single driver if ?id=... is present
if ($method === 'GET') {
    $id = $_GET['id'] ?? '';
    if (!empty($id)) {
        $stmt = $pdo->prepare("
            SELECT 
                d.driver_id AS driverId, 
                d.user_id AS userId, 
                d.full_name AS fullName, 
                d.address, 
                d.contact, 
                d.birthdate, 
                d.gender, 
                d.vehicle_type AS vehicleType, 
                d.plate_number AS plateNumber, 
                d.license_no AS licenseNo, 
                d.photo, 
                d.status,
                d.created_at AS registrationDate,
                d.license_expiration AS licenseExpiration,
                u.username
            FROM drivers d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.driver_id = ?
        ");
        $stmt->execute([$id]);
        $driver = $stmt->fetch();
        if ($driver) {
            respond(['success' => true, 'driver' => $driver]);
        } else {
            respond(['success' => false, 'message' => 'Driver not found']);
        }
    } else {
        $stmt = $pdo->query("
            SELECT 
                driver_id AS driverId, 
                user_id AS userId, 
                full_name AS fullName, 
                address, 
                contact, 
                birthdate, 
                gender, 
                vehicle_type AS vehicleType, 
                plate_number AS plateNumber, 
                license_no AS licenseNo, 
                photo, 
                status,
                created_at AS registrationDate,
                license_expiration AS licenseExpiration
            FROM drivers 
            ORDER BY created_at DESC
        ");
        respond(['success' => true, 'drivers' => $stmt->fetchAll()]);
    }
}

// POST = add or update driver
if ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);
    $id = $_GET['id'] ?? $b['driverId'] ?? '';

    if (!empty($id)) {
        // Update logic
        $stmt = $pdo->prepare("
            UPDATE drivers SET 
                full_name = ?, address = ?, contact = ?, birthdate = ?, 
                gender = ?, vehicle_type = ?, plate_number = ?, license_no = ?, photo = ?,
                license_expiration = ?
            WHERE driver_id = ?
        ");
        $stmt->execute([
            $b['fullName'] ?? '', $b['address'] ?? '', $b['contact'] ?? '',
            $b['birthdate'] ?? null, $b['gender'] ?? '',
            $b['vehicleType'] ?? '', $b['plateNumber'] ?? '', $b['licenseNo'] ?? '',
            $b['photo'] ?? '', $b['licenseExpiration'] ?? null, $id
        ]);
        
        // Update user account details if user exists
        $driverStmt = $pdo->prepare("SELECT user_id FROM drivers WHERE driver_id = ?");
        $driverStmt->execute([$id]);
        $userId = $driverStmt->fetchColumn();
        if ($userId) {
            if (!empty($b['password']) && $b['password'] !== 'default123') {
                $pdo->prepare("UPDATE users SET username = ?, password = ? WHERE id = ?")
                    ->execute([$b['username'], hash('sha256', $b['password']), $userId]);
            } else {
                $pdo->prepare("UPDATE users SET username = ? WHERE id = ?")
                    ->execute([$b['username'], $userId]);
            }
        }
        
        $pdo->prepare("INSERT INTO activities (action, details, badge_class) VALUES ('Updated Driver', ?, 'updated')")->execute([$b['fullName']]);
        respond(['success' => true]);
    } else {
        // Create user account first
        $stmt = $pdo->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, 'driver')");
        $stmt->execute([$b['username'], hash('sha256', $b['password'])]);
        $userId = $pdo->lastInsertId();
 
        // Generate driver ID
        $count = $pdo->query("SELECT COUNT(*) FROM drivers")->fetchColumn();
        $driverId = 'DR-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

        $stmt = $pdo->prepare("
            INSERT INTO drivers (driver_id, user_id, full_name, address, contact, birthdate, gender, vehicle_type, plate_number, license_no, photo, status, license_expiration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        ");
        $stmt->execute([
            $driverId, $userId,
            $b['fullName'] ?? '', $b['address'] ?? '', $b['contact'] ?? '',
            $b['birthdate'] ?? null, $b['gender'] ?? '',
            $b['vehicleType'], $b['plateNumber'] ?? '', $b['licenseNo'] ?? '',
            $b['photo'] ?? '', $b['licenseExpiration'] ?? null
        ]);

        // Auto-create QR code
        $qrData = json_encode(['driverId' => $driverId, 'plate' => $b['plateNumber'] ?? '', 'type' => $b['vehicleType']]);
        $pdo->prepare("INSERT INTO qr_codes (driver_id, qr_data, status) VALUES (?, ?, 'Active')")->execute([$driverId, $qrData]);

        $pdo->prepare("INSERT INTO activities (action, details, badge_class) VALUES ('Added Driver', ?, 'added')")->execute([$b['fullName']]);

        respond(['success' => true, 'driverId' => $driverId]);
    }
}

// DELETE ?id=DR-0001
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    // Also delete user account associated
    $driverStmt = $pdo->prepare("SELECT user_id FROM drivers WHERE driver_id = ?");
    $driverStmt->execute([$id]);
    $userId = $driverStmt->fetchColumn();
    
    $pdo->prepare("DELETE FROM drivers WHERE driver_id = ?")->execute([$id]);
    if ($userId) {
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$userId]);
    }
    respond(['success' => true]);
}
?>
