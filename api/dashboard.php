<?php
// api/dashboard.php
// one round trip that returns everything the admin dashboard needs, instead of
// the browser firing five separate requests (each one its own connection to
// supabase). runs on a single connection so the whole load is one trip.
require 'config.php';

requireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    respond(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$drivers = $pdo->query("
    SELECT
        d.driver_id AS \"driverId\",
        d.user_id AS \"userId\",
        d.full_name AS \"fullName\",
        d.address,
        d.contact,
        d.birthdate,
        d.gender,
        d.vehicle_type AS \"vehicleType\",
        d.plate_number AS \"plateNumber\",
        d.license_no AS \"licenseNo\",
        -- photo is a large base64 blob; it is loaded per-driver on edit, not in the list
        CASE WHEN d.photo IS NOT NULL AND d.photo <> '' THEN 1 ELSE 0 END AS \"hasPhoto\",
        d.status,
        d.created_at AS \"registrationDate\",
        d.license_expiration AS \"licenseExpiration\",
        u.username
    FROM drivers d
    LEFT JOIN users u ON d.user_id = u.id
    ORDER BY d.created_at DESC
")->fetchAll();

$vehicles = $pdo->query("
    SELECT
        v.vehicle_id AS \"vehicleId\",
        v.plate_number AS \"plateNumber\",
        v.vehicle_type AS \"vehicleType\",
        v.driver_id AS \"driverId\",
        v.status,
        d.full_name AS \"driver_name\"
    FROM vehicles v
    LEFT JOIN drivers d ON v.driver_id = d.driver_id
    ORDER BY v.created_at DESC
")->fetchAll();

$qrCodes = $pdo->query("
    SELECT
        q.qr_id AS \"qrId\",
        q.driver_id AS \"driverId\",
        q.vehicle_id AS \"vehicleId\",
        q.qr_data AS \"qrData\",
        q.status,
        q.last_scanned AS \"lastScanned\",
        q.times_used AS \"timesUsed\",
        q.created_at AS \"createdAt\",
        d.full_name AS \"fullName\",
        d.vehicle_type AS \"vehicleType\",
        d.plate_number AS \"plateNumber\"
    FROM qr_codes q
    LEFT JOIN drivers d ON q.driver_id = d.driver_id
    ORDER BY q.created_at DESC
")->fetchAll();

$payments = $pdo->query("
    SELECT
        p.receipt_no AS \"id\",
        p.transaction_date AS \"date\",
        p.transaction_time AS \"time\",
        p.amount,
        p.driver_id AS \"driverId\",
        p.vehicle_id AS \"vehicleId\",
        d.full_name AS \"driverName\",
        COALESCE(v.vehicle_type, d.vehicle_type) AS \"vehicleType\",
        COALESCE(v.plate_number, d.plate_number) AS \"plateNumber\"
    FROM payments p
    LEFT JOIN drivers d ON p.driver_id = d.driver_id
    LEFT JOIN vehicles v ON p.vehicle_id = v.vehicle_id
    ORDER BY p.created_at DESC
")->fetchAll();

// pdo_pgsql hands integers back as strings, so make hasPhoto a real boolean
foreach ($drivers as &$driverRow) {
    $driverRow['hasPhoto'] = (bool)(int)($driverRow['hasPhoto'] ?? 0);
}
unset($driverRow);

$fees = [];
foreach ($pdo->query('SELECT vehicle_type, amount FROM fee_settings')->fetchAll() as $row) {
    $fees[$row['vehicle_type']] = (float)$row['amount'];
}

respond([
    'success'  => true,
    'drivers'  => $drivers,
    'vehicles' => $vehicles,
    'qrCodes'  => $qrCodes,
    'payments' => $payments,
    'fees'     => $fees,
]);
?>
