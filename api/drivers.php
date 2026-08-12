<?php
// api/drivers.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$vehicleTypes = ['Tricycle', 'Jeepney', 'Multicab', 'Bus'];

function getDriverRecord($pdo, $driverId) {
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
        LIMIT 1
    ");
    $stmt->execute([$driverId]);
    return $stmt->fetch();
}

function requireDriverOwner($pdo, $actor, $driverId) {
    if ($actor['role'] === 'admin') {
        return;
    }
    if ($actor['role'] !== 'driver') {
        respond(['success' => false, 'error' => 'Access denied.'], 403);
    }

    $ownedDriverId = $actor['driverId'];
    if ($ownedDriverId === '') {
        $stmt = $pdo->prepare('SELECT driver_id FROM drivers WHERE user_id = ? LIMIT 1');
        $stmt->execute([$actor['id']]);
        $ownedDriverId = (string)$stmt->fetchColumn();
    }

    if ($ownedDriverId !== $driverId) {
        respond(['success' => false, 'error' => 'You can only access your own driver record.'], 403);
    }
}

if ($method === 'GET') {
    $actor = requireAuthenticatedUser();
    $id = trim((string)($_GET['id'] ?? ''));

    if ($actor['role'] === 'driver') {
        $id = $id !== '' ? $id : $actor['driverId'];
        requireDriverOwner($pdo, $actor, $id);
    } elseif ($actor['role'] !== 'admin') {
        respond(['success' => false, 'error' => 'Access denied.'], 403);
    }

    if ($id !== '') {
        $driver = getDriverRecord($pdo, $id);
        if (!$driver) {
            respond(['success' => false, 'error' => 'Driver not found.'], 404);
        }
        respond(['success' => true, 'driver' => $driver]);
    }

    $stmt = $pdo->query("
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
        ORDER BY d.created_at DESC
    ");
    respond(['success' => true, 'drivers' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = trim((string)($_GET['id'] ?? ($body['driverId'] ?? '')));

    // Updating a record needs an authenticated admin or the matching driver.
    if ($id !== '') {
        $actor = requireAuthenticatedUser();
        requireDriverOwner($pdo, $actor, $id);
        $existing = getDriverRecord($pdo, $id);
        if (!$existing) {
            respond(['success' => false, 'error' => 'Driver not found.'], 404);
        }

        $fullName = trim((string)($body['fullName'] ?? $existing['fullName']));
        $address = trim((string)($body['address'] ?? $existing['address']));
        $contact = trim((string)($body['contact'] ?? $existing['contact']));
        $birthdate = $body['birthdate'] ?? $existing['birthdate'];
        $gender = $body['gender'] ?? $existing['gender'];
        $vehicleType = $body['vehicleType'] ?? $existing['vehicleType'];
        $plateNumber = strtoupper(trim((string)($body['plateNumber'] ?? $existing['plateNumber'])));
        $licenseNo = strtoupper(trim((string)($body['licenseNo'] ?? $existing['licenseNo'])));
        $photo = array_key_exists('photo', $body) ? $body['photo'] : $existing['photo'];
        $licenseExpiration = $body['licenseExpiration'] ?? $existing['licenseExpiration'];
        $username = trim((string)($body['username'] ?? $existing['username']));
        $newPassword = (string)($body['password'] ?? '');

        if ($fullName === '' || $username === '' || !in_array($vehicleType, $vehicleTypes, true) || $plateNumber === '') {
            respond(['success' => false, 'error' => 'Please provide a name, username, vehicle type, and plate number.'], 422);
        }

        $duplicateUser = $pdo->prepare('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1');
        $duplicateUser->execute([$username, $existing['userId']]);
        if ($duplicateUser->fetch()) {
            respond(['success' => false, 'error' => 'Username is already registered.'], 409);
        }

        $duplicatePlate = $pdo->prepare("SELECT 1 FROM drivers WHERE plate_number = ? AND driver_id <> ? UNION SELECT 1 FROM vehicles WHERE plate_number = ? AND (driver_id IS NULL OR driver_id <> ?) LIMIT 1");
        $duplicatePlate->execute([$plateNumber, $id, $plateNumber, $id]);
        if ($duplicatePlate->fetch()) {
            respond(['success' => false, 'error' => 'Plate number is already registered.'], 409);
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare("
                UPDATE drivers SET
                    full_name = ?, address = ?, contact = ?, birthdate = ?, gender = ?,
                    vehicle_type = ?, plate_number = ?, license_no = ?, photo = ?, license_expiration = ?
                WHERE driver_id = ?
            ")->execute([$fullName, $address, $contact, $birthdate ?: null, $gender, $vehicleType, $plateNumber, $licenseNo, $photo, $licenseExpiration ?: null, $id]);

            if ($newPassword !== '' && $newPassword !== 'default123') {
                if (strlen($newPassword) < 4) {
                    throw new InvalidArgumentException('Password must be at least 4 characters.');
                }
                $pdo->prepare('UPDATE users SET username = ?, password = ? WHERE id = ?')
                    ->execute([$username, password_hash($newPassword, PASSWORD_DEFAULT), $existing['userId']]);
            } else {
                $pdo->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$username, $existing['userId']]);
            }

            // The driver record and its active vehicle must describe the same vehicle.
            $vehicleStmt = $pdo->prepare('SELECT vehicle_id FROM vehicles WHERE driver_id = ? ORDER BY vehicle_id DESC LIMIT 1');
            $vehicleStmt->execute([$id]);
            $vehicleId = $vehicleStmt->fetchColumn();
            if ($vehicleId) {
                $pdo->prepare('UPDATE vehicles SET plate_number = ?, vehicle_type = ?, status = \'Active\' WHERE vehicle_id = ?')
                    ->execute([$plateNumber, $vehicleType, $vehicleId]);
            } else {
                $pdo->prepare("INSERT INTO vehicles (plate_number, vehicle_type, driver_id, status) VALUES (?, ?, ?, 'Active')")
                    ->execute([$plateNumber, $vehicleType, $id]);
            }

            // Regenerate the stored QR payload whenever identifying vehicle data changes.
            $pdo->prepare('UPDATE qr_codes SET qr_data = ? WHERE driver_id = ?')
                ->execute([buildQrPayload($id, $plateNumber, $vehicleType), $id]);
            $pdo->prepare("INSERT INTO activities (action, details, badge_class) VALUES ('Updated Driver', ?, 'updated')")
                ->execute([$fullName]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            respond(['success' => false, 'error' => $error instanceof InvalidArgumentException ? $error->getMessage() : 'Unable to update driver.'], 422);
        }

        respond(['success' => true]);
    }

    // Public registration is allowed, but every duplicate and required field is
    // checked on the server rather than exposing the driver directory publicly.
    $fullName = trim((string)($body['fullName'] ?? ''));
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $vehicleType = (string)($body['vehicleType'] ?? '');
    $plateNumber = strtoupper(trim((string)($body['plateNumber'] ?? '')));
    $licenseNo = strtoupper(trim((string)($body['licenseNo'] ?? '')));

    if ($fullName === '' || $username === '' || strlen($password) < 4 || !in_array($vehicleType, $vehicleTypes, true) || $plateNumber === '' || $licenseNo === '') {
        respond(['success' => false, 'error' => 'Please complete all required registration fields.'], 422);
    }

    $duplicate = $pdo->prepare('SELECT 1 FROM users WHERE username = ? UNION SELECT 1 FROM drivers WHERE plate_number = ? UNION SELECT 1 FROM vehicles WHERE plate_number = ? UNION SELECT 1 FROM drivers WHERE license_no = ? LIMIT 1');
    $duplicate->execute([$username, $plateNumber, $plateNumber, $licenseNo]);
    if ($duplicate->fetch()) {
        respond(['success' => false, 'error' => 'The username, plate number, or license number is already registered.'], 409);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, 'driver')")
            ->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
        $userId = $pdo->lastInsertId();

        $lastNumber = (int)$pdo->query("SELECT COALESCE(MAX(CAST(SUBSTRING(driver_id, 4) AS UNSIGNED)), 0) FROM drivers")->fetchColumn();
        $driverId = 'DR-' . str_pad((string)($lastNumber + 1), 4, '0', STR_PAD_LEFT);

        $pdo->prepare("
            INSERT INTO drivers (driver_id, user_id, full_name, address, contact, birthdate, gender, vehicle_type, plate_number, license_no, photo, status, license_expiration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        ")->execute([
            $driverId, $userId, $fullName,
            trim((string)($body['address'] ?? '')), trim((string)($body['contact'] ?? '')),
            ($body['birthdate'] ?? '') ?: null, (string)($body['gender'] ?? ''), $vehicleType,
            $plateNumber, $licenseNo, (string)($body['photo'] ?? ''), ($body['licenseExpiration'] ?? '') ?: null
        ]);

        $pdo->prepare("INSERT INTO vehicles (plate_number, vehicle_type, driver_id, status) VALUES (?, ?, ?, 'Active')")
            ->execute([$plateNumber, $vehicleType, $driverId]);
        $vehicleId = $pdo->lastInsertId();

        $pdo->prepare("INSERT INTO qr_codes (driver_id, vehicle_id, qr_data, status) VALUES (?, ?, ?, 'Active')")
            ->execute([$driverId, $vehicleId, buildQrPayload($driverId, $plateNumber, $vehicleType)]);
        $pdo->prepare("INSERT INTO activities (action, details, badge_class) VALUES ('Added Driver', ?, 'added')")
            ->execute([$fullName]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond(['success' => false, 'error' => 'Unable to complete registration. Please verify the entered details.'], 422);
    }

    respond(['success' => true, 'driverId' => $driverId]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = trim((string)($_GET['id'] ?? ''));
    if ($id === '') respond(['success' => false, 'error' => 'Driver ID is required.'], 400);

    $driver = getDriverRecord($pdo, $id);
    if (!$driver) respond(['success' => false, 'error' => 'Driver not found.'], 404);

    $pdo->prepare('DELETE FROM qr_codes WHERE driver_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM vehicles WHERE driver_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM drivers WHERE driver_id = ?')->execute([$id]);
    if ($driver['userId']) $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$driver['userId']]);
    respond(['success' => true]);
}

respond(['success' => false, 'error' => 'Method not allowed'], 405);
?>
