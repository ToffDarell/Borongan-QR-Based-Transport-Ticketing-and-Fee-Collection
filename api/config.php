<?php
// api/config.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

// Browser storage is only used for display convenience. The server session is
// the source of truth for every protected API request.
if (session_status() !== PHP_SESSION_ACTIVE) {
    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $isHttps
    ]);
    session_start();
}

$host = 'localhost';
$db   = 'borongan_db';
$user = 'root';      // XAMPP default
$pass = '';          // XAMPP default (blank)
$port = 3307;        // xampp8.2 uses port 3307

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['success' => false, 'error' => 'DB connection failed: ' . $e->getMessage()]));
}

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function currentAuthenticatedUser() {
    if (empty($_SESSION['user_id']) || empty($_SESSION['role'])) {
        return null;
    }

    return [
        'id' => (int)$_SESSION['user_id'],
        'username' => (string)($_SESSION['username'] ?? ''),
        'role' => (string)$_SESSION['role'],
        'driverId' => (string)($_SESSION['driver_id'] ?? '')
    ];
}

function requireAuthenticatedUser() {
    $user = currentAuthenticatedUser();
    if (!$user) {
        respond(['success' => false, 'error' => 'Your session has expired. Please log in again.'], 401);
    }
    return $user;
}

function requireAdmin() {
    $user = requireAuthenticatedUser();
    if ($user['role'] !== 'admin') {
        respond(['success' => false, 'error' => 'Administrator access is required.'], 403);
    }
    return $user;
}

function startAuthenticatedSession($user, $driverId = null) {
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['username'] = (string)$user['username'];
    $_SESSION['role'] = (string)$user['role'];

    if ($driverId !== null) {
        $_SESSION['driver_id'] = (string)$driverId;
    } else {
        unset($_SESSION['driver_id']);
    }
}

function endAuthenticatedSession() {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

// Existing development accounts used SHA-256. Keep them usable once, then
// replace the stored value with PHP's stronger password_hash format.
function verifyPasswordAndUpgrade($pdo, $user, $password) {
    $storedHash = (string)($user['password'] ?? '');
    if (password_verify($password, $storedHash)) {
        return true;
    }

    $legacyHash = hash('sha256', $password);
    if ($storedHash !== '' && hash_equals($storedHash, $legacyHash)) {
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([$newHash, $user['id']]);
        return true;
    }

    return false;
}

function buildQrPayload($driverId, $plateNumber, $vehicleType) {
    return json_encode([
        'version' => 1,
        'driverId' => (string)$driverId,
        'plateNumber' => (string)$plateNumber,
        'vehicleType' => (string)$vehicleType
    ], JSON_UNESCAPED_SLASHES);
}
?>
