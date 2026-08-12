<?php
// api/qr_codes.php
require 'config.php';

requireAdmin();
$method = $_SERVER['REQUEST_METHOD'];

function getQrDriverData($pdo, $driverId) {
    $stmt = $pdo->prepare("
        SELECT d.driver_id, d.plate_number, d.vehicle_type, v.vehicle_id
        FROM drivers d
        LEFT JOIN vehicles v ON v.driver_id = d.driver_id
        WHERE d.driver_id = ?
        ORDER BY v.vehicle_id DESC
        LIMIT 1
    ");
    $stmt->execute([$driverId]);
    return $stmt->fetch();
}

if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT
            q.qr_id AS qrId,
            q.driver_id AS driverId,
            q.vehicle_id AS vehicleId,
            q.qr_data AS qrData,
            q.status,
            q.last_scanned AS lastScanned,
            q.times_used AS timesUsed,
            q.created_at AS createdAt,
            d.full_name AS fullName,
            d.vehicle_type AS vehicleType,
            d.plate_number AS plateNumber
        FROM qr_codes q
        LEFT JOIN drivers d ON q.driver_id = d.driver_id
        ORDER BY q.created_at DESC
    ");
    respond(['success' => true, 'qrCodes' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $driverId = trim((string)($body['driverId'] ?? ''));
    $status = ($body['status'] ?? 'Active') === 'Inactive' ? 'Inactive' : 'Active';
    if ($driverId === '') {
        respond(['success' => false, 'error' => 'Driver ID is required.'], 400);
    }

    // Build every QR payload from the registered driver data. Never accept a
    // plate number or vehicle type supplied by the browser as QR identity data.
    $driver = getQrDriverData($pdo, $driverId);
    if (!$driver) {
        respond(['success' => false, 'error' => 'Driver not found.'], 404);
    }

    $payload = buildQrPayload($driver['driver_id'], $driver['plate_number'], $driver['vehicle_type']);
    $existing = $pdo->prepare('SELECT qr_id FROM qr_codes WHERE driver_id = ? ORDER BY qr_id DESC LIMIT 1');
    $existing->execute([$driverId]);
    $qrId = $existing->fetchColumn();

    if ($qrId) {
        $pdo->prepare('UPDATE qr_codes SET vehicle_id = ?, qr_data = ?, status = ? WHERE qr_id = ?')
            ->execute([$driver['vehicle_id'] ?: null, $payload, $status, $qrId]);
    } else {
        $pdo->prepare("INSERT INTO qr_codes (driver_id, vehicle_id, qr_data, status) VALUES (?, ?, ?, ?)")
            ->execute([$driverId, $driver['vehicle_id'] ?: null, $payload, $status]);
        $qrId = $pdo->lastInsertId();
    }

    respond(['success' => true, 'qrId' => $qrId, 'qrData' => $payload]);
}

if ($method === 'PATCH') {
    $id = (int)($_GET['id'] ?? 0);
    $action = $_GET['action'] ?? 'toggle';
    if ($id <= 0) respond(['success' => false, 'error' => 'QR code ID is required.'], 400);

    if ($action === 'toggle') {
        $current = $pdo->prepare('SELECT status FROM qr_codes WHERE qr_id = ?');
        $current->execute([$id]);
        $row = $current->fetch();
        if (!$row) respond(['success' => false, 'error' => 'QR code not found.'], 404);
        $status = $row['status'] === 'Active' ? 'Inactive' : 'Active';
        $pdo->prepare('UPDATE qr_codes SET status = ? WHERE qr_id = ?')->execute([$status, $id]);
        respond(['success' => true, 'status' => $status]);
    }

    if ($action === 'scan') {
        $stmt = $pdo->prepare('UPDATE qr_codes SET times_used = times_used + 1, last_scanned = NOW() WHERE qr_id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) respond(['success' => false, 'error' => 'QR code not found.'], 404);
        respond(['success' => true]);
    }

    respond(['success' => false, 'error' => 'Unknown QR action.'], 400);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) respond(['success' => false, 'error' => 'QR code ID is required.'], 400);
    $stmt = $pdo->prepare('DELETE FROM qr_codes WHERE qr_id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) respond(['success' => false, 'error' => 'QR code not found.'], 404);
    respond(['success' => true]);
}

respond(['success' => false, 'error' => 'Method not allowed.'], 405);
?>
