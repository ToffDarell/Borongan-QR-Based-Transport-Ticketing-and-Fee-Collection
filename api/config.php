<?php
// api/config.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { exit(0); }

// start session for api checks
if (session_status() !== PHP_SESSION_ACTIVE && !headers_sent()) {
    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $isHttps
    ]);
    session_start();
}

require_once __DIR__ . '/db_config.php';

$driver = strtolower(DB_DRIVER);

try {
    if ($driver === 'pgsql') {
        if (!empty(SUPABASE_URI)) {
            $uriParts = parse_url(SUPABASE_URI);
            $host = $uriParts['host'] ?? '';
            $port = $uriParts['port'] ?? 5432;
            $user = isset($uriParts['user']) ? urldecode($uriParts['user']) : 'postgres';
            $pass = isset($uriParts['pass']) ? urldecode($uriParts['pass']) : '';
            $db   = isset($uriParts['path']) ? ltrim($uriParts['path'], '/') : 'postgres';
            $ssl  = 'require';
        } else {
            $host = SUPABASE_HOST;
            $port = SUPABASE_PORT;
            $db   = SUPABASE_DB;
            $user = SUPABASE_USER;
            $pass = SUPABASE_PASS;
            $ssl  = SUPABASE_SSLMODE;
        }

        if ((empty(SUPABASE_URI) && (strpos($host, 'your-project-ref') !== false || $pass === 'YOUR_SUPABASE_DB_PASSWORD')) || empty($host) || empty($pass)) {
            http_response_code(500);
            die(json_encode([
                'success' => false,
                'error' => 'Supabase connection credentials not configured. Please enter your Supabase URI or credentials in api/db_config.php'
            ]));
        }

        $dsn = "pgsql:host={$host};port={$port};dbname={$db};sslmode={$ssl}";
        // keep the connection alive between requests so we don't pay the
        // tls + auth round trip to supabase on every single api call
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_CASE => PDO::CASE_NATURAL,
            PDO::ATTR_PERSISTENT => true,
            PDO::ATTR_TIMEOUT => 8
        ]);
    } else {
        $host = MYSQL_HOST;
        $port = MYSQL_PORT;
        $db   = MYSQL_DB;
        $user = MYSQL_USER;
        $pass = MYSQL_PASS;

        $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    $msg = 'DB connection failed: ' . $e->getMessage();
    if ($driver === 'pgsql') {
        $msg .= '. TIP: If using Supabase on local network, use the Supabase Connection Pooler host (port 6543) in api/db_config.php';
    }
    die(json_encode(['success' => false, 'error' => $msg]));
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

// check password and update old hash if needed
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
