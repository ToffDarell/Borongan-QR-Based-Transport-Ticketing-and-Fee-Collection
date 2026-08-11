<?php
// api/fees.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT vehicle_type, amount FROM fee_settings");
    $fees = [];
    foreach ($stmt->fetchAll() as $row) { $fees[$row['vehicle_type']] = (float)$row['amount']; }
    respond(['success' => true, 'fees' => $fees]);
}

if ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare("UPDATE fee_settings SET amount = ? WHERE vehicle_type = ?");
    foreach ($b as $type => $amount) { $stmt->execute([$amount, $type]); }
    respond(['success' => true]);
}
?>
