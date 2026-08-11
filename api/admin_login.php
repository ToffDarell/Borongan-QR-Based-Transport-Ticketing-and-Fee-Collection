<?php
// api/admin_login.php
require 'config.php';

$body = json_decode(file_get_contents('php://input'), true);
$username = trim($body['username'] ?? '');
$password = trim($body['password'] ?? '');

if (!$username || !$password) {
    respond(['success' => false, 'error' => 'Missing credentials'], 400);
}

$stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND role = 'admin'");
$stmt->execute([$username]);
$user = $stmt->fetch();

if ($user && $user['password'] === hash('sha256', $password)) {
    respond(['success' => true, 'username' => $user['username']]);
} else {
    respond(['success' => false, 'error' => 'Invalid credentials'], 401);
}
?>
