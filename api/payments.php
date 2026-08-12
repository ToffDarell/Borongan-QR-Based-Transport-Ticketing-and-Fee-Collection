<?php
// api/payments.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $actor = requireAuthenticatedUser();
    $driverId = trim((string)($_GET['driverId'] ?? ''));
    $where = '';
    $params = [];

    // Drivers may view only their own receipts. Administrators can review all
    // records or filter the list by a specific driver.
    if ($actor['role'] === 'driver') {
        if ($actor['driverId'] === '') {
            respond(['success' => false, 'error' => 'Driver session is incomplete. Please log in again.'], 401);
        }
        if ($driverId !== '' && $driverId !== $actor['driverId']) {
            respond(['success' => false, 'error' => 'You can only view your own payment history.'], 403);
        }
        $driverId = $actor['driverId'];
    } elseif ($actor['role'] !== 'admin') {
        respond(['success' => false, 'error' => 'Access denied.'], 403);
    }

    if ($driverId !== '') {
        $where = 'WHERE p.driver_id = ?';
        $params[] = $driverId;
    }

    $stmt = $pdo->prepare("
        SELECT 
            p.receipt_no AS id, 
            p.transaction_date AS date, 
            p.transaction_time AS time, 
            p.amount, 
            p.driver_id AS driverId, 
            p.vehicle_id AS vehicleId,
            d.full_name AS driverName,
            COALESCE(v.vehicle_type, d.vehicle_type) AS vehicleType,
            COALESCE(v.plate_number, d.plate_number) AS plateNumber
        FROM payments p 
        LEFT JOIN drivers d ON p.driver_id = d.driver_id 
        LEFT JOIN vehicles v ON p.vehicle_id = v.vehicle_id 
        $where
        ORDER BY p.created_at DESC
    ");
    $stmt->execute($params);
    respond(['success' => true, 'payments' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    requireAdmin();
    /*
     * TERMINAL FEE POLICY
     * -------------------
     * One successful POST represents one new terminal entry. A driver may
     * therefore have more than one payment on the same date when the driver
     * enters the terminal again. Searching a driver never creates a payment;
     * the operator must explicitly press Collect Terminal Fee.
     *
     * The receipt number, amount, and timestamp are generated/validated on
     * the server so every collection has an auditable receipt. If the client
     * later requires an exception, add a server-validated supervisor ID and
     * reason here, then record both in an audit log. Do not trust a
     * supervisor-override flag sent only by the browser.
     */
    $b = json_decode(file_get_contents('php://input'), true);
    $driverId = trim((string)($b['driverId'] ?? ''));
    if ($driverId === '') {
        respond(['success' => false, 'error' => 'A valid driver is required.'], 400);
    }

    // Resolve the vehicle on the server so a missing/forged client vehicleId
    // cannot create a transaction with an unrelated vehicle.
    $driverStmt = $pdo->prepare("
        SELECT
            d.full_name AS driverName,
            d.vehicle_type AS vehicleType,
            d.plate_number AS plateNumber,
            v.vehicle_id AS vehicleId
        FROM drivers d
        LEFT JOIN vehicles v ON v.driver_id = d.driver_id
        WHERE d.driver_id = ?
        ORDER BY v.vehicle_id DESC
        LIMIT 1
    ");
    $driverStmt->execute([$driverId]);
    $driver = $driverStmt->fetch();

    if (!$driver) {
        respond(['success' => false, 'error' => 'Driver not found.'], 404);
    }

    $vehicleId = $driver['vehicleId'] ?? null;

    // Older registrations may not have a row in vehicles yet. Create the
    // linked vehicle on first collection so future transactions are relational.
    if (!$vehicleId && !empty($driver['plateNumber']) && !empty($driver['vehicleType'])) {
        $vehicleInsert = $pdo->prepare(
            "INSERT INTO vehicles (plate_number, vehicle_type, driver_id, status) VALUES (?, ?, ?, 'Active')"
        );
        try {
            $vehicleInsert->execute([$driver['plateNumber'], $driver['vehicleType'], $driverId]);
            $vehicleId = $pdo->lastInsertId();
        } catch (PDOException $e) {
            // If the plate already exists, reuse the existing linked row.
            $vehicleLookup = $pdo->prepare(
                "SELECT vehicle_id FROM vehicles WHERE plate_number = ? LIMIT 1"
            );
            $vehicleLookup->execute([$driver['plateNumber']]);
            $vehicleId = $vehicleLookup->fetchColumn() ?: null;
        }
    }

    // Fees are determined by the configured vehicle type, never trusted from
    // the browser payload.
    $feeStmt = $pdo->prepare("SELECT amount FROM fee_settings WHERE vehicle_type = ? LIMIT 1");
    $feeStmt->execute([$driver['vehicleType']]);
    $amount = (float)$feeStmt->fetchColumn();
    if ($amount <= 0) {
        respond(['success' => false, 'error' => 'No fee is configured for this vehicle type.'], 400);
    }

    // Generate a new receipt for every confirmed terminal entry.
    $receiptNo = 'TR-' . rand(100000, 999999);
    $now = new DateTime();

    $stmt = $pdo->prepare("INSERT INTO payments (receipt_no, driver_id, vehicle_id, amount, transaction_date, transaction_time) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$receiptNo, $driverId, $vehicleId, $amount, $now->format('Y-m-d'), $now->format('H:i:s')]);

    // Update QR usage
    $pdo->prepare("UPDATE qr_codes SET times_used = times_used + 1, last_scanned = NOW() WHERE driver_id = ?")->execute([$driverId]);

    $pdo->prepare("INSERT INTO activities (action, details, badge_class) VALUES ('Payment Collected', ?, 'payment')")->execute([$driver['driverName'] . ' - ₱' . $amount]);

    respond([
        'success' => true,
        'receiptNo' => $receiptNo,
        'payment' => [
            'id' => $receiptNo,
            'driverId' => $driverId,
            'driverName' => $driver['driverName'],
            'vehicleId' => $vehicleId,
            'vehicleType' => $driver['vehicleType'],
            'plateNumber' => $driver['plateNumber'],
            'amount' => $amount,
            'date' => $now->format('Y-m-d'),
            'time' => $now->format('H:i:s'),
            'status' => 'Paid'
        ]
    ]);
}

respond(['success' => false, 'error' => 'Method not allowed.'], 405);
?>
