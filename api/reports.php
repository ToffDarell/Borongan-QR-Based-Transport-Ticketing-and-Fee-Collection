<?php
// api/reports.php
require 'config.php';

$type = $_GET['type'] ?? 'daily';

$query = match($type) {
    'daily'   => "SELECT transaction_date as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE transaction_date = CURDATE() GROUP BY transaction_date",
    'weekly'  => "SELECT transaction_date as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE YEARWEEK(transaction_date) = YEARWEEK(NOW()) GROUP BY transaction_date ORDER BY transaction_date",
    'monthly' => "SELECT DATE_FORMAT(transaction_date, '%Y-%m') as period, SUM(amount) as total, COUNT(*) as count FROM payments WHERE YEAR(transaction_date) = YEAR(NOW()) AND MONTH(transaction_date) = MONTH(NOW()) GROUP BY period",
    'yearly'  => "SELECT YEAR(transaction_date) as period, SUM(amount) as total, COUNT(*) as count FROM payments GROUP BY period ORDER BY period DESC",
    default   => "SELECT transaction_date as period, SUM(amount) as total, COUNT(*) as count FROM payments GROUP BY transaction_date ORDER BY transaction_date DESC LIMIT 30"
};

$stmt = $pdo->query($query);
respond(['success' => true, 'data' => $stmt->fetchAll(), 'type' => $type]);
?>
