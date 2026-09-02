<?php
// api/reset_password.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    respond(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$username = trim((string)($body['username'] ?? ''));
$role = trim((string)($body['role'] ?? ''));
$newPassword = (string)($body['newPassword'] ?? '');
$confirmPassword = (string)($body['confirmPassword'] ?? '');

if (!in_array($role, ['admin', 'driver'], true)) {
    respond(['success' => false, 'error' => 'Invalid role specified.'], 400);
}

if ($username === '') {
    respond(['success' => false, 'error' => 'Please enter your username.'], 400);
}

if (strlen($newPassword) < 12) {
    respond(['success' => false, 'error' => 'Password must be at least 12 characters.'], 400);
}

if (!preg_match('/[A-Z]/', $newPassword)) {
    respond(['success' => false, 'error' => 'Password must contain at least one uppercase letter.'], 400);
}

if (!preg_match('/[a-z]/', $newPassword)) {
    respond(['success' => false, 'error' => 'Password must contain at least one lowercase letter.'], 400);
}

if (!preg_match('/\d/', $newPassword)) {
    respond(['success' => false, 'error' => 'Password must contain at least one number.'], 400);
}

if (!preg_match('/[!@#$%^&*(),.?":{}|<>]/', $newPassword)) {
    respond(['success' => false, 'error' => 'Password must contain at least one special symbol.'], 400);
}

if ($newPassword !== $confirmPassword) {
    respond(['success' => false, 'error' => 'Passwords do not match.'], 400);
}

// find user with matching role
$stmt = $pdo->prepare("SELECT id, username, role FROM users WHERE username = ? AND role = ? LIMIT 1");
$stmt->execute([$username, $role]);
$user = $stmt->fetch();

if (!$user) {
    $roleLabel = ($role === 'admin') ? 'admin' : 'driver';
    respond(['success' => false, 'error' => "No $roleLabel account found with that username."], 404);
}

// check if driver account is inactive
if ($role === 'driver') {
    $driverStmt = $pdo->prepare("SELECT status FROM drivers WHERE user_id = ? LIMIT 1");
    $driverStmt->execute([$user['id']]);
    $driver = $driverStmt->fetch();
    if ($driver && $driver['status'] === 'Inactive') {
        respond(['success' => false, 'error' => 'This account is inactive. Please contact your system administrator.'], 403);
    }
}

// hash new password
$hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

$updateStmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
$updateStmt->execute([$hashedPassword, $user['id']]);

// save to activity log
try {
    $actionDetails = ($role === 'admin')
        ? "Admin password reset for '{$user['username']}'"
        : "Driver password reset for '{$user['username']}'";
    $pdo->prepare("INSERT INTO activities (action, details, badge_class) VALUES ('Password Reset', ?, 'updated')")
        ->execute([$actionDetails]);
} catch (Throwable $e) {
    // ignore if log fails
}

respond([
    'success' => true,
    'message' => 'Password has been reset successfully! You can now log in.',
    'username' => $user['username']
]);
?>
