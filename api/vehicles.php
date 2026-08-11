<?php
// api/vehicles.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT 
            v.plate_number AS plateNumber, 
            v.vehicle_type AS vehicleType, 
            v.driver_id AS driverId, 
            v.status, 
            d.full_name as driver_name 
        FROM vehicles v 
        LEFT JOIN drivers d ON v.driver_id = d.driver_id 
        ORDER BY v.created_at DESC
    ");
    respond(['success' => true, 'vehicles' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare("INSERT INTO vehicles (plate_number, vehicle_type, driver_id, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE vehicle_type=VALUES(vehicle_type), driver_id=VALUES(driver_id), status=VALUES(status)");
    $stmt->execute([$b['plateNumber'], $b['vehicleType'], $b['driverId'] ?: null, $b['status'] ?? 'Active']);
    respond(['success' => true]);
}

if ($method === 'DELETE') {
    $plate = $_GET['plate'] ?? '';
    $pdo->prepare("DELETE FROM vehicles WHERE plate_number = ?")->execute([$plate]);
    respond(['success' => true]);
}
?>
