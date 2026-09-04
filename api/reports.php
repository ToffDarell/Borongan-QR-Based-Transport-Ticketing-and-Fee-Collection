<?php
// api/reports.php
require 'config.php';

requireAdmin();
$type = $_GET['type'] ?? 'daily';
$isPg = (strtolower(DB_DRIVER) === 'pgsql');

if ($isPg) {
    $query = match($type) {
        'daily'   => "SELECT transaction_date::text as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE transaction_date = CURRENT_DATE GROUP BY transaction_date",
        'weekly'  => "SELECT transaction_date::text as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE to_char(transaction_date, 'IYYY-IW') = to_char(CURRENT_DATE, 'IYYY-IW') GROUP BY transaction_date ORDER BY transaction_date",
        'monthly' => "SELECT to_char(transaction_date, 'YYYY-MM') as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE) GROUP BY to_char(transaction_date, 'YYYY-MM')",
        'yearly'  => "SELECT to_char(transaction_date, 'YYYY') as period, SUM(amount) as total, COUNT(*) as count FROM payments GROUP BY to_char(transaction_date, 'YYYY') ORDER BY period DESC",
        default   => "SELECT transaction_date::text as period, SUM(amount) as total, COUNT(*) as count FROM payments GROUP BY transaction_date ORDER BY transaction_date DESC LIMIT 30"
    };
} else {
    $query = match($type) {
        'daily'   => "SELECT transaction_date as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE transaction_date = CURDATE() GROUP BY transaction_date",
        'weekly'  => "SELECT transaction_date as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE YEARWEEK(transaction_date) = YEARWEEK(NOW()) GROUP BY transaction_date ORDER BY transaction_date",
        'monthly' => "SELECT DATE_FORMAT(transaction_date, '%Y-%m') as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE YEAR(transaction_date) = YEAR(NOW()) AND MONTH(transaction_date) = MONTH(NOW()) GROUP BY period",
        'yearly'  => "SELECT YEAR(transaction_date) as period, SUM(amount) as total, COUNT(*) as count FROM payments GROUP BY period ORDER BY period DESC",
        default   => "SELECT transaction_date as period, SUM(amount) as total, COUNT(*) as count FROM payments GROUP BY transaction_date ORDER BY transaction_date DESC LIMIT 30"
    };
}

$stmt = $pdo->query($query);
respond(['success' => true, 'data' => $stmt->fetchAll(), 'type' => $type]);
?>
