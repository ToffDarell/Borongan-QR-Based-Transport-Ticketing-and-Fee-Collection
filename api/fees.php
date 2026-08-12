<?php
// api/fees.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireAuthenticatedUser();
    $stmt = $pdo->query('SELECT vehicle_type, amount FROM fee_settings');
    $fees = [];
    foreach ($stmt->fetchAll() as $row) {
        $fees[$row['vehicle_type']] = (float)$row['amount'];
    }
    respond(['success' => true, 'fees' => $fees]);
}

if ($method === 'POST') {
    requireAdmin();
    $body = json_decode(file_get_contents('php://input'), true);
    $allowedTypes = ['Tricycle', 'Jeepney', 'Multicab', 'Bus'];

    if (!is_array($body)) {
        respond(['success' => false, 'error' => 'Invalid fee data.'], 400);
    }

    $fees = [];
    foreach ($allowedTypes as $type) {
        if (!array_key_exists($type, $body) || !is_numeric($body[$type])) {
            respond(['success' => false, 'error' => "A valid {$type} fee is required."], 422);
        }
        $amount = (float)$body[$type];
        if ($amount <= 0 || $amount > 100000) {
            respond(['success' => false, 'error' => "The {$type} fee must be greater than zero."], 422);
        }
        $fees[$type] = round($amount, 2);
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('UPDATE fee_settings SET amount = ? WHERE vehicle_type = ?');
        foreach ($fees as $type => $amount) {
            $stmt->execute([$amount, $type]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond(['success' => false, 'error' => 'Unable to save fee settings.'], 500);
    }

    respond(['success' => true, 'fees' => $fees]);
}

respond(['success' => false, 'error' => 'Method not allowed.'], 405);
?>
