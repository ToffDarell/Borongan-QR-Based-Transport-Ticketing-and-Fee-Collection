<?php
// api/admin_profile.php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$admin = requireAdmin();

if ($method === 'GET') {
    respond([
        'success' => true,
        'username' => $admin['username']
    ]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $newUsername = trim((string)($body['username'] ?? ''));
    $newPassword = (string)($body['newPassword'] ?? '');
    $confirmPassword = (string)($body['confirmPassword'] ?? '');

    if ($newUsername === '') {
        respond(['success' => false, 'error' => 'Username cannot be empty.'], 400);
    }

    // check if new username is already taken by another user
    if ($newUsername !== $admin['username']) {
        $checkStmt = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1");
        $checkStmt->execute([$newUsername, $admin['id']]);
        if ($checkStmt->fetch()) {
            respond(['success' => false, 'error' => 'Username is already taken.'], 400);
        }
    }

    $updatePassword = false;
    $hashedPassword = null;

    if ($newPassword !== '' || $confirmPassword !== '') {
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

        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        $updatePassword = true;
    }

    // update in database
    if ($updatePassword) {
        $updateStmt = $pdo->prepare("UPDATE users SET username = ?, password = ? WHERE id = ?");
        $updateStmt->execute([$newUsername, $hashedPassword, $admin['id']]);
    } else {
        $updateStmt = $pdo->prepare("UPDATE users SET username = ? WHERE id = ?");
        $updateStmt->execute([$newUsername, $admin['id']]);
    }

    // update active session
    $_SESSION['username'] = $newUsername;

    // log to activity
    try {
        $actionDetails = "Admin profile updated for '$newUsername'";
        if ($updatePassword) {
            $actionDetails .= " (password changed)";
        }
        $pdo->prepare("INSERT INTO activities (action, details, badge_class) VALUES ('Profile Updated', ?, 'updated')")
            ->execute([$actionDetails]);
    } catch (Throwable $e) {
        // ignore if log fails
    }

    respond([
        'success' => true,
        'message' => 'Admin profile updated successfully!',
        'username' => $newUsername
    ]);
}

respond(['success' => false, 'error' => 'Method not allowed.'], 405);
?>
