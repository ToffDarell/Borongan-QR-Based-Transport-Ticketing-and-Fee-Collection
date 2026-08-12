<?php
// api/admin_login.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Lets the dashboard verify that its server-side session is still valid.
if ($method === 'GET') {
    $sessionUser = currentAuthenticatedUser();
    if (!$sessionUser || $sessionUser['role'] !== 'admin') {
        respond(['success' => false, 'error' => 'Not authenticated'], 401);
    }
    respond(['success' => true, 'username' => $sessionUser['username']]);
}

if ($method !== 'POST') {
    respond(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
    respond(['success' => false, 'error' => 'Missing credentials'], 400);
}

$stmt = $pdo->prepare("SELECT id, username, password, role FROM users WHERE username = ? AND role = 'admin'");
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !verifyPasswordAndUpgrade($pdo, $user, $password)) {
    respond(['success' => false, 'error' => 'Invalid credentials'], 401);
}

startAuthenticatedSession($user);
respond(['success' => true, 'username' => $user['username']]);
?>
