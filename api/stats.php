<?php
// api/stats.php
// Live system and database health check diagnostic endpoint
require 'config.php';

try {
    $driverCount   = (int)$pdo->query("SELECT COUNT(*) FROM drivers")->fetchColumn();
    $vehicleCount  = (int)$pdo->query("SELECT COUNT(*) FROM vehicles")->fetchColumn();
    $paymentCount  = (int)$pdo->query("SELECT COUNT(*) FROM payments")->fetchColumn();
    $qrCount       = (int)$pdo->query("SELECT COUNT(*) FROM qr_codes")->fetchColumn();
    $userCount     = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();

    respond([
        'success' => true,
        'status' => 'healthy',
        'database' => (strtolower(DB_DRIVER) === 'pgsql') ? 'Supabase PostgreSQL' : 'Local MySQL',
        'counts' => [
            'drivers'  => $driverCount,
            'vehicles' => $vehicleCount,
            'payments' => $paymentCount,
            'qrCodes'  => $qrCount,
            'users'    => $userCount
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ]);
} catch (Throwable $e) {
    respond([
        'success' => false,
        'status' => 'error',
        'error' => $e->getMessage()
    ], 500);
}
?>
