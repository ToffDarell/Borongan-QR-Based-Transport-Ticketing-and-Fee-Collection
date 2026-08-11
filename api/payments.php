<?php
// api/payments.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT 
            p.receipt_no AS id, 
            p.transaction_date AS date, 
            p.transaction_time AS time, 
            p.amount, 
            p.driver_id AS driverId, 
            d.full_name AS driverName, 
            v.vehicle_type AS vehicleType, 
            v.plate_number AS plateNumber 
        FROM payments p 
        LEFT JOIN drivers d ON p.driver_id = d.driver_id 
        LEFT JOIN vehicles v ON p.vehicle_id = v.vehicle_id 
        ORDER BY p.created_at DESC
    ");
    respond(['success' => true, 'payments' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);
    $receiptNo = 'TR-' . rand(100000, 999999);
    $now = new DateTime();

    $stmt = $pdo->prepare("INSERT INTO payments (receipt_no, driver_id, vehicle_id, amount, transaction_date, transaction_time) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$receiptNo, $b['driverId'], $b['vehicleId'] ?? null, $b['amount'], $now->format('Y-m-d'), $now->format('H:i:s')]);

    // Update QR usage
    $pdo->prepare("UPDATE qr_codes SET times_used = times_used + 1, last_scanned = NOW() WHERE driver_id = ?")->execute([$b['driverId']]);

    $pdo->prepare("INSERT INTO activities (action, details, badge_class) VALUES ('Payment Collected', ?, 'payment')")->execute([$b['driverName'] . ' - ₱' . $b['amount']]);

    respond(['success' => true, 'receiptNo' => $receiptNo]);
}
?>
