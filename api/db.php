<?php
/**
 * Database & Helper Configuration
 * Erlass Competition Portal
 */

ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);

date_default_timezone_set('Asia/Jakarta');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Muat konfigurasi database dari berkas lokal jika tersedia
$localConfigFile = __DIR__ . '/../config.local.php';
if (file_exists($localConfigFile)) {
    $dbConfig = require $localConfigFile;
} else {
    $dbConfig = [
        'db_host' => getenv('DB_HOST') ?: 'localhost',
        'db_name' => getenv('DB_NAME') ?: 'erlass_competition',
        'db_user' => getenv('DB_USER') ?: 'DB_USER',
        'db_pass' => getenv('DB_PASS') ?: 'DB_PASS',
        'fallback_tokens' => []
    ];
}

$db_host = $dbConfig['db_host'] ?? 'localhost';
$db_name = $dbConfig['db_name'] ?? 'erlass_competition';
$db_user = $dbConfig['db_user'] ?? '';
$db_pass = $dbConfig['db_pass'] ?? '';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, time_zone = '+07:00'"
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Gagal koneksi ke database kompetisi.']);
    exit;
}

function send_json($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function verify_admin_token($token) {
    global $pdo, $dbConfig;
    if (empty($token) || strlen($token) < 8) return false;
    
    // Fallback key if explicitly configured in config.local.php
    $validFallbacks = $dbConfig['fallback_tokens'] ?? [];
    if (!empty($validFallbacks) && in_array($token, $validFallbacks, true)) {
        return [
            'id' => 1,
            'username' => 'admin',
            'full_name' => 'Panitia Erlass',
            'role' => 'superadmin'
        ];
    }

    try {
        $stmt = $pdo->prepare("SELECT u.id, u.username, u.full_name, u.role, s.expires_at 
                               FROM admin_sessions s
                               JOIN admin_users u ON s.user_id = u.id
                               WHERE s.token = ? AND s.expires_at > NOW() AND u.is_active = 1
                               LIMIT 1");
        $stmt->execute([$token]);
        $user = $stmt->fetch();
        return $user ?: false;
    } catch (PDOException $e) {
        return false;
    }
}
