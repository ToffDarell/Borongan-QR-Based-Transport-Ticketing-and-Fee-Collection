<?php
// api/qr_codes.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// GET all QR codes (with driver & vehicle info)
if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT q.*, d.full_name, d.vehicle_type, d.plate_number
        FROM qr_codes q
        LEFT JOIN drivers d ON q.driver_id = d.driver_id
        ORDER BY q.created_at DESC
    ");
    respond(['success' => true, 'qr_codes' => $stmt->fetchAll()]);
}

// POST = generate/update QR for a driver
if ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);
    $driverId  = $b['driverId']  ?? '';
    $vehicleId = $b['vehicleId'] ?? null;
    $status    = $b['status']    ?? 'Active';

    if (!$driverId) {
        respond(['success' => false, 'error' => 'driverId is required'], 400);
    }

    $qrData = json_encode([
        'driverId'  => $driverId,
        'vehicleId' => $vehicleId,
        'generated' => date('Y-m-d H:i:s')
    ]);

    // Upsert: update if exists, insert if not
    $existing = $pdo->prepare("SELECT qr_id FROM qr_codes WHERE driver_id = ?");
    $existing->execute([$driverId]);
    $row = $existing->fetch();

    if ($row) {
        $pdo->prepare("
            UPDATE qr_codes
            SET vehicle_id = ?, qr_data = ?, status = ?
            WHERE driver_id = ?
        ")->execute([$vehicleId, $qrData, $status, $driverId]);
        respond(['success' => true, 'qrId' => $row['qr_id'], 'qrData' => $qrData]);
    } else {
        $pdo->prepare("
            INSERT INTO qr_codes (driver_id, vehicle_id, qr_data, status)
            VALUES (?, ?, ?, ?)
        ")->execute([$driverId, $vehicleId, $qrData, $status]);
        respond(['success' => true, 'qrId' => $pdo->lastInsertId(), 'qrData' => $qrData]);
    }
}

// PATCH ?id=1&action=toggle  → toggle Active/Inactive
if ($method === 'PATCH') {
    $id     = $_GET['id']     ?? 0;
    $action = $_GET['action'] ?? 'toggle';

    if ($action === 'toggle') {
        $curr = $pdo->prepare("SELECT status FROM qr_codes WHERE qr_id = ?");
        $curr->execute([$id]);
        $row = $curr->fetch();
        $newStatus = ($row && $row['status'] === 'Active') ? 'Inactive' : 'Active';
        $pdo->prepare("UPDATE qr_codes SET status = ? WHERE qr_id = ?")->execute([$newStatus, $id]);
        respond(['success' => true, 'status' => $newStatus]);
    }

    if ($action === 'scan') {
        $pdo->prepare("
            UPDATE qr_codes
            SET times_used = times_used + 1, last_scanned = NOW()
            WHERE qr_id = ?
        ")->execute([$id]);
        respond(['success' => true]);
    }
}

// DELETE ?id=1
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? 0;
    $pdo->prepare("DELETE FROM qr_codes WHERE qr_id = ?")->execute([$id]);
    respond(['success' => true]);
}
?>
