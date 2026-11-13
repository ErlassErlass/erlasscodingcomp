<?php
/**
 * Admin & Reporting API Endpoint
 * Erlass Competition Portal
 */

require_once __DIR__ . '/db.php';

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token = '';
if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    $token = $matches[1];
} elseif (isset($_GET['token'])) {
    $token = $_GET['token'];
} elseif (isset($_POST['token'])) {
    $token = $_POST['token'];
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
if (!$action && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = json_decode(file_get_contents('php://input'), true);
    if (isset($rawInput['action'])) {
        $action = $rawInput['action'];
    }
}

// 0. Backward Compatibility untuk Passcode Login
if ($action === 'verify_passcode') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $passcode = trim($input['passcode'] ?? $_GET['passcode'] ?? '');
    
    if (in_array($passcode, ['DB_PASSWORD_HERE', 'Erlass101.', 'Erlass101', 'erlass101', 'Erlass@2026', 'erlass2026', 'admincompetition', 'competition-auth-2026'], true) || strtolower(rtrim($passcode, '.')) === 'erlass101') {
        $sessionToken = bin2hex(random_bytes(32));
        $expires_at = date('Y-m-d H:i:s', time() + (7 * 24 * 3600));
        $stmtS = $pdo->prepare("INSERT INTO admin_sessions (user_id, token, expires_at) VALUES (1, ?, ?)");
        $stmtS->execute([$sessionToken, $expires_at]);
        send_json([
            'status' => 'ok',
            'token' => $sessionToken,
            'user' => [
                'id' => 1,
                'username' => 'admin',
                'full_name' => 'Panitia Erlass',
                'role' => 'superadmin'
            ],
            'message' => 'Login berhasil!'
        ]);
    } else {
        send_json(['status' => 'error', 'message' => 'Passcode panitia salah.'], 401);
    }
}

// 1. Login Secure Berbasis Username & Password
if ($action === 'login') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');

    if (!$username || !$password) {
        send_json(['status' => 'error', 'message' => 'Username dan password wajib diisi.'], 422);
    }

    $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_active']) {
        send_json(['status' => 'error', 'message' => 'Username atau password salah.'], 401);
    }

    // Cek apakah akun sedang terkunci karena brute force
    if ($user['locked_until'] && strtotime($user['locked_until']) > time()) {
        $remaining = ceil((strtotime($user['locked_until']) - time()) / 60);
        send_json([
            'status' => 'error',
            'message' => "Akun terkunci sementara karena 5x percobaan salah. Silakan coba kembali dalam $remaining menit."
        ], 429);
    }

    // Verifikasi password dengan BCRYPT
    if (!password_verify($password, $user['password_hash'])) {
        $failed = (int)$user['failed_attempts'] + 1;
        if ($failed >= 5) {
            $lockTime = date('Y-m-d H:i:s', time() + (15 * 60)); // lock 15 menit
            $stmtLock = $pdo->prepare("UPDATE admin_users SET failed_attempts = ?, locked_until = ? WHERE id = ?");
            $stmtLock->execute([$failed, $lockTime, $user['id']]);
            send_json([
                'status' => 'error',
                'message' => 'Terlalu banyak percobaan gagal. Akun dikunci sementara selama 15 menit demi keamanan.'
            ], 429);
        } else {
            $stmtFail = $pdo->prepare("UPDATE admin_users SET failed_attempts = ? WHERE id = ?");
            $stmtFail->execute([$failed, $user['id']]);
            send_json([
                'status' => 'error',
                'message' => "Username atau password salah. (Percobaan ke-$failed dari 5)"
            ], 401);
        }
    }

    // Reset failed attempts jika sukses login
    $stmtReset = $pdo->prepare("UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = ?");
    $stmtReset->execute([$user['id']]);

    // Generate cryptographic session token 64 chars
    $sessionToken = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', time() + (7 * 24 * 3600)); // 7 hari
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);

    $stmtSession = $pdo->prepare("INSERT INTO admin_sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)");
    $stmtSession->execute([$user['id'], $sessionToken, $ip, $ua, $expires_at]);

    send_json([
        'status' => 'ok',
        'token' => $sessionToken,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
            'judge_group' => $user['judge_group'] !== null ? (int)$user['judge_group'] : null
        ],
        'message' => 'Login berhasil!'
    ]);
}

// 2. Logout Admin
if ($action === 'logout') {
    if ($token) {
        $stmt = $pdo->prepare("DELETE FROM admin_sessions WHERE token = ?");
        $stmt->execute([$token]);
    }
    send_json(['status' => 'ok', 'message' => 'Berhasil logout.']);
}

// Verifikasi Sesi Token
$currentAdmin = verify_admin_token($token);
if (!$currentAdmin) {
    send_json(['status' => 'error', 'message' => 'Sesi login tidak valid atau telah berakhir. Harap login kembali.'], 401);
}

// Batasi akses akun Juri hanya ke aksi-aksi penjurian (Confidential & Blind Review)
if (($currentAdmin['role'] ?? '') === 'juri') {
    $allowedJudgeActions = [
        'get_judging_submissions',
        'save_project_score',
        'get_judging_leaderboard',
        'export_judging_csv',
        'stream_project_file',
        'change_password',
        'logout'
    ];
    if (!in_array($action, $allowedJudgeActions, true)) {
        send_json(['status' => 'error', 'message' => 'Akses ditolak. Akun juri hanya memiliki izin untuk modul penjurian karya.'], 403);
    }
}

// 3. Ganti Password Mandiri
if ($action === 'change_password') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $oldPass = trim($input['old_password'] ?? '');
    $newPass = trim($input['new_password'] ?? '');

    if (!$oldPass || !$newPass) {
        send_json(['status' => 'error', 'message' => 'Password lama dan password baru wajib diisi.'], 422);
    }
    if (strlen($newPass) < 6) {
        send_json(['status' => 'error', 'message' => 'Password baru minimal 6 karakter.'], 422);
    }

    $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE id = ? LIMIT 1");
    $stmt->execute([$currentAdmin['id']]);
    $user = $stmt->fetch();

    if (!password_verify($oldPass, $user['password_hash'])) {
        send_json(['status' => 'error', 'message' => 'Password lama tidak sesuai.'], 422);
    }

    $newHash = password_hash($newPass, PASSWORD_BCRYPT);
    $stmtUp = $pdo->prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?");
    $stmtUp->execute([$newHash, $currentAdmin['id']]);

    send_json(['status' => 'ok', 'message' => 'Password berhasil diubah.']);
}

// 4. Modul Manajemen User Panitia (User Management)
if ($action === 'get_users') {
    $stmt = $pdo->query("SELECT id, username, full_name, role, is_active, failed_attempts, created_at FROM admin_users ORDER BY id ASC");
    $users = $stmt->fetchAll();
    send_json([
        'status' => 'ok',
        'users' => $users,
        'current_user_id' => $currentAdmin['id']
    ]);
}

if ($action === 'create_user') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $username = strtolower(trim($input['username'] ?? ''));
    $password = trim($input['password'] ?? '');
    $fullName = trim($input['full_name'] ?? '');
    $role = trim($input['role'] ?? 'panitia');

    if (!$username || !$password) {
        send_json(['status' => 'error', 'message' => 'Username dan password wajib diisi.'], 422);
    }

    if (!preg_match('/^[a-z0-9_\-\.]{3,30}$/', $username)) {
        send_json(['status' => 'error', 'message' => 'Username hanya boleh huruf, angka, titik, atau strip (3-30 karakter, tanpa spasi).'], 422);
    }

    if (strlen($password) < 6) {
        send_json(['status' => 'error', 'message' => 'Password minimal 6 karakter.'], 422);
    }

    if (!in_array($role, ['panitia', 'superadmin'], true)) {
        $role = 'panitia';
    }

    if (!$fullName) {
        $fullName = ucfirst($username);
    }

    // Cek apakah username sudah dipakai
    $stmtCheck = $pdo->prepare("SELECT id FROM admin_users WHERE username = ? LIMIT 1");
    $stmtCheck->execute([$username]);
    if ($stmtCheck->fetch()) {
        send_json(['status' => 'error', 'message' => "Username '$username' sudah terdaftar. Silakan pilih username lain."], 422);
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $stmtIns = $pdo->prepare("INSERT INTO admin_users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)");
    $stmtIns->execute([$username, $passwordHash, $fullName, $role]);

    send_json([
        'status' => 'ok',
        'message' => "User panitia '$username' berhasil ditambahkan.",
        'user' => [
            'id' => (int)$pdo->lastInsertId(),
            'username' => $username,
            'full_name' => $fullName,
            'role' => $role
        ]
    ]);
}

if ($action === 'toggle_user_status') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $userId = (int)($input['user_id'] ?? 0);

    if ($userId <= 0) {
        send_json(['status' => 'error', 'message' => 'ID user tidak valid.'], 422);
    }

    if ($userId === (int)$currentAdmin['id']) {
        send_json(['status' => 'error', 'message' => 'Anda tidak dapat menonaktifkan akun sendiri yang sedang aktif.'], 422);
    }

    $stmt = $pdo->prepare("SELECT id, username, is_active FROM admin_users WHERE id = ?");
    $stmt->execute([$userId]);
    $targetUser = $stmt->fetch();

    if (!$targetUser) {
        send_json(['status' => 'error', 'message' => 'User tidak ditemukan.'], 404);
    }

    $newStatus = $targetUser['is_active'] ? 0 : 1;
    $stmtUp = $pdo->prepare("UPDATE admin_users SET is_active = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?");
    $stmtUp->execute([$newStatus, $userId]);

    if ($newStatus === 0) {
        $stmtDelSes = $pdo->prepare("DELETE FROM admin_sessions WHERE user_id = ?");
        $stmtDelSes->execute([$userId]);
    }

    $msg = $newStatus ? "Akun '{$targetUser['username']}' berhasil diaktifkan." : "Akun '{$targetUser['username']}' dinonaktifkan.";
    send_json(['status' => 'ok', 'message' => $msg, 'is_active' => $newStatus]);
}

if ($action === 'delete_user') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $userId = (int)($input['user_id'] ?? 0);

    if ($userId <= 0) {
        send_json(['status' => 'error', 'message' => 'ID user tidak valid.'], 422);
    }

    if ($userId === (int)$currentAdmin['id']) {
        send_json(['status' => 'error', 'message' => 'Anda tidak dapat menghapus akun sendiri.'], 422);
    }

    if ($userId === 1) {
        send_json(['status' => 'error', 'message' => 'Akun administrator utama tidak dapat dihapus.'], 422);
    }

    $stmtDelSes = $pdo->prepare("DELETE FROM admin_sessions WHERE user_id = ?");
    $stmtDelSes->execute([$userId]);

    $stmtDel = $pdo->prepare("DELETE FROM admin_users WHERE id = ?");
    $stmtDel->execute([$userId]);

    send_json(['status' => 'ok', 'message' => 'Akun panitia berhasil dihapus.']);
}

if ($action === 'reset_user_password') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $userId = (int)($input['user_id'] ?? 0);
    $newPass = trim($input['new_password'] ?? '');

    if ($userId <= 0 || strlen($newPass) < 6) {
        send_json(['status' => 'error', 'message' => 'Password baru minimal 6 karakter.'], 422);
    }

    $newHash = password_hash($newPass, PASSWORD_BCRYPT);
    $stmtUp = $pdo->prepare("UPDATE admin_users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?");
    $stmtUp->execute([$newHash, $userId]);

    send_json(['status' => 'ok', 'message' => 'Password panitia berhasil direset.']);
}

// 5. Modul Laporan Eksekutif & Statistik Lengkap (Executive Report & Analytics)
if ($action === 'get_reports') {
    $comp_id = (int)($_GET['competition_id'] ?? 1);

    // Summary Card Metrics
    $stmtMetrics = $pdo->prepare("SELECT
        COUNT(*) AS total_registered,
        SUM(CASE WHEN payment_status = 'verified' THEN 1 ELSE 0 END) AS total_verified,
        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS total_pending,
        SUM(CASE WHEN payment_status = 'rejected' THEN 1 ELSE 0 END) AS total_rejected,
        SUM(CASE WHEN is_partner = 1 THEN 1 ELSE 0 END) AS total_partner,
        SUM(CASE WHEN is_partner = 0 THEN 1 ELSE 0 END) AS total_public,
        SUM(CASE WHEN payment_status = 'verified' AND is_partner = 0 THEN payment_amount ELSE 0 END) AS total_revenue
        FROM registrations
        WHERE competition_id = ?");
    $stmtMetrics->execute([$comp_id]);
    $metrics = $stmtMetrics->fetch();

    // Breakdown per Cabang Lomba
    $stmtBranch = $pdo->prepare("SELECT branch, COUNT(*) AS count,
        SUM(CASE WHEN payment_status = 'verified' THEN 1 ELSE 0 END) AS verified_count
        FROM registrations
        WHERE competition_id = ?
        GROUP BY branch
        ORDER BY count DESC");
    $stmtBranch->execute([$comp_id]);
    $byBranch = $stmtBranch->fetchAll();

    // Breakdown per Wilayah
    $stmtRegion = $pdo->prepare("SELECT region, COUNT(*) AS count
        FROM registrations
        WHERE competition_id = ?
        GROUP BY region
        ORDER BY count DESC");
    $stmtRegion->execute([$comp_id]);
    $byRegion = $stmtRegion->fetchAll();

    // Breakdown per Jenjang Kelas
    $stmtGrade = $pdo->prepare("SELECT grade, COUNT(*) AS count
        FROM registrations
        WHERE competition_id = ?
        GROUP BY grade
        ORDER BY grade ASC");
    $stmtGrade->execute([$comp_id]);
    $byGrade = $stmtGrade->fetchAll();

    // Top 10 Sekolah Berdasarkan Jumlah Peserta
    $stmtTopSchools = $pdo->prepare("SELECT school_name, region, is_partner, COUNT(*) AS count
        FROM registrations
        WHERE competition_id = ?
        GROUP BY school_name, region, is_partner
        ORDER BY count DESC LIMIT 10");
    $stmtTopSchools->execute([$comp_id]);
    $topSchools = $stmtTopSchools->fetchAll();

    // Tren Pendaftaran Harian (7 hari terakhir atau seluruhnya)
    $stmtDaily = $pdo->prepare("SELECT DATE(created_at) AS reg_date, COUNT(*) AS count
        FROM registrations
        WHERE competition_id = ?
        GROUP BY DATE(created_at)
        ORDER BY reg_date ASC LIMIT 30");
    $stmtDaily->execute([$comp_id]);
    $dailyTrend = $stmtDaily->fetchAll();

    send_json([
        'status' => 'ok',
        'metrics' => [
            'total_registered' => (int)$metrics['total_registered'],
            'total_verified'   => (int)$metrics['total_verified'],
            'total_pending'    => (int)$metrics['total_pending'],
            'total_rejected'   => (int)$metrics['total_rejected'],
            'total_partner'    => (int)$metrics['total_partner'],
            'total_public'     => (int)$metrics['total_public'],
            'total_revenue'    => (float)$metrics['total_revenue']
        ],
        'by_branch'   => $byBranch,
        'by_region'   => $byRegion,
        'by_grade'    => $byGrade,
        'top_schools' => $topSchools,
        'daily_trend' => $dailyTrend
    ]);
}

// 3. Ambil Daftar Registrasi (dengan Filter & Pencarian Lengkap)
if ($action === 'get_registrations') {
    $comp_id = (int)($_GET['competition_id'] ?? 1);
    $branch  = trim($_GET['branch'] ?? '');
    $status  = trim($_GET['status'] ?? '');
    $partner = trim($_GET['partner'] ?? '');
    $search  = trim($_GET['search'] ?? '');

    $sql = "SELECT * FROM registrations WHERE competition_id = ?";
    $params = [$comp_id];

    if ($branch !== '') {
        $sql .= " AND branch = ?";
        $params[] = $branch;
    }
    if ($status !== '') {
        $sql .= " AND payment_status = ?";
        $params[] = $status;
    }
    if ($partner !== '') {
        $sql .= " AND is_partner = ?";
        $params[] = ($partner === '1' ? 1 : 0);
    }
    if ($search !== '') {
        $sql .= " AND (participant_name LIKE ? OR school_name LIKE ? OR phone LIKE ? OR reg_code LIKE ? OR region LIKE ? OR npsn LIKE ?)";
        $searchParam = "%$search%";
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
    }

    $sql .= " ORDER BY id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    send_json([
        'status' => 'ok',
        'total' => count($rows),
        'registrations' => $rows
    ]);
}

// 4. Update Status Verifikasi Pendaftar & Catatan Panitia
if ($action === 'update_status') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = (int)($_POST['id'] ?? $input['id'] ?? 0);
    $new_status = trim($_POST['status'] ?? $input['status'] ?? '');
    $notes = trim($_POST['admin_notes'] ?? $input['admin_notes'] ?? '');

    if (!$id || !in_array($new_status, ['pending', 'verified', 'rejected'], true)) {
        send_json(['status' => 'error', 'message' => 'Data update tidak valid.'], 422);
    }

    $stmt = $pdo->prepare("UPDATE registrations SET payment_status = ?, admin_notes = ?, verified_at = NOW(), verified_by = 'Panitia' WHERE id = ?");
    $stmt->execute([$new_status, $notes, $id]);

    send_json([
        'status' => 'ok',
        'message' => 'Status pendaftaran berhasil diperbarui.'
    ]);
}

// 4.1. Hapus Pendaftar Satuan (Manual Delete)
if ($action === 'delete_registration') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $id = (int)($input['id'] ?? $_GET['id'] ?? 0);

    if ($id <= 0) {
        send_json(['status' => 'error', 'message' => 'ID pendaftaran tidak valid.'], 422);
    }

    $stmtCheck = $pdo->prepare("SELECT id, reg_code, participant_name, payment_proof FROM registrations WHERE id = ? LIMIT 1");
    $stmtCheck->execute([$id]);
    $reg = $stmtCheck->fetch();

    if (!$reg) {
        send_json(['status' => 'error', 'message' => 'Data pendaftaran tidak ditemukan.'], 404);
    }

    // Hapus berkas bukti transfer dari disk jika ada
    if (!empty($reg['payment_proof'])) {
        $proofPath = __DIR__ . '/../uploads/bukti_transfer/' . $reg['payment_proof'];
        if (file_exists($proofPath) && is_file($proofPath)) {
            @unlink($proofPath);
        }
    }

    $stmtDel = $pdo->prepare("DELETE FROM registrations WHERE id = ?");
    $stmtDel->execute([$id]);

    send_json([
        'status' => 'ok',
        'message' => "Data pendaftar {$reg['participant_name']} ({$reg['reg_code']}) berhasil dihapus."
    ]);
}

// 4.2. Hapus Banyak Pendaftar Sekaligus (Bulk Delete Checklist)
if ($action === 'bulk_delete_registrations') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $ids = $input['ids'] ?? [];

    if (!is_array($ids) || empty($ids)) {
        send_json(['status' => 'error', 'message' => 'Tidak ada pendaftar yang dipilih untuk dihapus.'], 422);
    }

    $cleanIds = array_filter(array_map('intval', $ids), function($v) { return $v > 0; });
    if (empty($cleanIds)) {
        send_json(['status' => 'error', 'message' => 'ID pendaftaran tidak valid.'], 422);
    }

    $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));

    // Ambil bukti bayar untuk dihapus dari disk
    $stmtProofs = $pdo->prepare("SELECT payment_proof FROM registrations WHERE id IN ($placeholders) AND payment_proof IS NOT NULL");
    $stmtProofs->execute($cleanIds);
    $proofs = $stmtProofs->fetchAll(PDO::FETCH_COLUMN);

    foreach ($proofs as $proofFile) {
        if (!empty($proofFile)) {
            $proofPath = __DIR__ . '/../uploads/bukti_transfer/' . $proofFile;
            if (file_exists($proofPath) && is_file($proofPath)) {
                @unlink($proofPath);
            }
        }
    }

    $stmtDel = $pdo->prepare("DELETE FROM registrations WHERE id IN ($placeholders)");
    $stmtDel->execute($cleanIds);
    $deletedCount = $stmtDel->rowCount();

    send_json([
        'status' => 'ok',
        'message' => "Berhasil menghapus {$deletedCount} data pendaftar.",
        'deleted_count' => $deletedCount
    ]);
}

// 5. Ekspor Laporan Peserta (Format Excel .xlsx & CSV)
if ($action === 'export_excel' || $action === 'export_csv') {
    $comp_id = (int)($_GET['competition_id'] ?? 1);
    $branch  = trim($_GET['branch'] ?? '');
    $status  = trim($_GET['status'] ?? '');
    // Default format: excel (.xlsx) kecuali parameter ?format=csv diminta secara eksplisit
    $requestedFormat = strtolower(trim($_GET['format'] ?? ''));
    $format = ($action === 'export_csv' && $requestedFormat === 'csv') ? 'csv' : 'excel';

    $sql = "SELECT * FROM registrations WHERE competition_id = ?";
    $params = [$comp_id];

    if ($branch !== '') {
        $sql .= " AND branch = ?";
        $params[] = $branch;
    }
    if ($status !== '') {
        $sql .= " AND payment_status = ?";
        $params[] = $status;
    }
    $sql .= " ORDER BY id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Base URL steril untuk tautan langsung bukti bayar
    $customHost = $_SERVER['HTTP_HOST'] ?? '';
    if (!empty($customHost) && !in_array($customHost, ['localhost', '127.0.0.1']) && strpos($customHost, 'erlass') !== false) {
        $baseUrl = 'https://' . $customHost;
    } else {
        $baseUrl = 'https://erlasscompetition.erlass.academy';
    }

    $timestamp = date('Ymd_His');

    // 5A. Format Excel (.xlsx) dengan Tautan Hyperlink Aktif & Penataan Gaya Rapi
    if ($format === 'excel') {
        $exportRows = [];
        $no = 1;
        foreach ($rows as $r) {
            $proofLink = '-';
            if (!empty($r['payment_proof'])) {
                $cleanProof = basename(trim($r['payment_proof']));
                $proofLink = $baseUrl . '/uploads/bukti_transfer/' . rawurlencode($cleanProof);
            } elseif (!empty($r['is_partner']) || (isset($r['payment_amount']) && (float)$r['payment_amount'] <= 0)) {
                $proofLink = 'Sekolah Mitra (Bebas Biaya)';
            } else {
                $proofLink = 'Belum Unggah Bukti';
            }

            $exportRows[] = [
                'no' => $no++,
                'reg_code' => $r['reg_code'],
                'participant_name' => $r['participant_name'],
                'gender' => $r['gender'],
                'birth_date' => $r['birth_date'],
                'age' => $r['age'],
                'grade' => $r['grade'],
                'phone' => $r['phone'],
                'address' => $r['address'],
                'student_status' => $r['student_status'],
                'partnership_status' => $r['partnership_status'],
                'category' => $r['is_partner'] ? 'Pelanggan Erlass' : 'Umum',
                'branch' => $r['branch'],
                'region' => $r['region'],
                'school_name' => $r['school_name'],
                'npsn' => $r['npsn'] ?: '-',
                'payment_amount' => $r['payment_amount'],
                'payment_status' => $r['payment_status'],
                'payment_proof' => $r['payment_proof'] ?: '-',
                'proof_link' => $proofLink,
                'admin_notes' => $r['admin_notes'] ?: '-',
                'created_at' => $r['created_at']
            ];
        }

        $tmpIn = tempnam(sys_get_temp_dir(), 'erlass_exp_in_');
        $tmpOut = tempnam(sys_get_temp_dir(), 'erlass_exp_out_') . '.xlsx';
        file_put_contents($tmpIn, json_encode([
            'sheet_title' => 'Peserta Lomba',
            'rows' => $exportRows
        ], JSON_UNESCAPED_UNICODE));

        $pyScript = __DIR__ . '/../scripts/export_excel.py';
        $cmd = 'python3 ' . escapeshellarg($pyScript) . ' ' . escapeshellarg($tmpIn) . ' ' . escapeshellarg($tmpOut) . ' 2>&1';
        $pyOutput = [];
        $pyReturn = 0;
        exec($cmd, $pyOutput, $pyReturn);

        @unlink($tmpIn);

        if ($pyReturn === 0 && file_exists($tmpOut) && filesize($tmpOut) > 0) {
            $filename = "Laporan_Peserta_Erlass_Competition_" . $timestamp . ".xlsx";
            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . filesize($tmpOut));
            header('Cache-Control: max-age=0, no-cache, no-store, must-revalidate');
            header('Pragma: no-cache');
            header('Expires: 0');
            readfile($tmpOut);
            @unlink($tmpOut);
            exit;
        }

        // Jika script Python menghasilkan kendala, fallback ke CSV di bawah
        if (file_exists($tmpOut)) {
            @unlink($tmpOut);
        }
    }

    // 5B. Format CSV (Fallback atau Permintaan Eksplisit ?format=csv)
    $filename = "Laporan_Peserta_Erlass_Competition_" . $timestamp . ".csv";

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Pragma: no-cache');
    header('Expires: 0');

    $output = fopen('php://output', 'w');

    // UTF-8 BOM untuk Excel agar aksen & teks Indonesia terbaca dengan sempurna
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    // Header Kolom
    fputcsv($output, [
        'No',
        'Kode Registrasi',
        'Nama Peserta',
        'Jenis Kelamin',
        'Tanggal Lahir',
        'Usia',
        'Kelas',
        'No. WhatsApp',
        'Alamat Lengkap',
        'Status Siswa',
        'Status Kemitraan',
        'Kategori',
        'Cabang Kompetisi',
        'Wilayah Sekolah',
        'Nama Sekolah',
        'NPSN',
        'Biaya Pendaftaran',
        'Status Pembayaran',
        'Nama Berkas Bukti Transfer',
        'Link Bukti Pembayaran',
        'Catatan Panitia',
        'Waktu Pendaftaran'
    ]);

    $no = 1;
    foreach ($rows as $r) {
        $proofLink = '-';
        if (!empty($r['payment_proof'])) {
            $cleanProof = basename(trim($r['payment_proof']));
            $proofLink = $baseUrl . '/uploads/bukti_transfer/' . rawurlencode($cleanProof);
        } elseif (!empty($r['is_partner']) || (isset($r['payment_amount']) && (float)$r['payment_amount'] <= 0)) {
            $proofLink = 'Sekolah Mitra (Bebas Biaya)';
        } else {
            $proofLink = 'Belum Unggah Bukti';
        }

        fputcsv($output, [
            $no++,
            $r['reg_code'],
            $r['participant_name'],
            $r['gender'],
            $r['birth_date'],
            $r['age'],
            $r['grade'],
            $r['phone'],
            $r['address'],
            $r['student_status'],
            $r['partnership_status'],
            $r['is_partner'] ? 'Pelanggan Erlass' : 'Umum',
            $r['branch'],
            $r['region'],
            $r['school_name'],
            $r['npsn'] ?: '-',
            $r['payment_amount'],
            strtoupper($r['payment_status']),
            $r['payment_proof'] ?: '-',
            $proofLink,
            $r['admin_notes'] ?: '-',
            $r['created_at']
        ]);
    }

    fclose($output);
    exit;
}

// 6. Ambil Seluruh Daftar Kompetisi (Untuk Switcher & Manajemen Event Jangka Panjang)
if ($action === 'get_competitions') {
    $stmt = $pdo->query("SELECT c.*, 
        (SELECT COUNT(*) FROM registrations r WHERE r.competition_id = c.id) AS total_participants,
        (SELECT COUNT(*) FROM competition_branches b WHERE b.competition_id = c.id) AS total_branches
        FROM competitions c
        ORDER BY c.id DESC");
    $comps = $stmt->fetchAll();

    send_json([
        'status' => 'ok',
        'competitions' => $comps
    ]);
}

// 7. Simpan / Buat Kompetisi Baru (Untuk 2027 atau Event Lain di 2026)
if ($action === 'save_competition') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    
    $id = (int)($input['id'] ?? 0);
    $title = trim($input['title'] ?? '');
    $slug = trim($input['slug'] ?? '');
    $tagline = trim($input['tagline'] ?? '');
    $theme = trim($input['theme'] ?? '');
    $subtheme = trim($input['subtheme'] ?? '');
    $reg_start = trim($input['registration_start'] ?? date('Y-m-d'));
    $reg_end = trim($input['registration_end'] ?? date('Y-m-d', strtotime('+30 days')));
    $comp_date = trim($input['competition_date'] ?? date('Y-m-d', strtotime('+40 days')));
    $ann_date = trim($input['announcement_date'] ?? date('Y-m-d', strtotime('+45 days')));
    $general_fee = (float)($input['general_fee'] ?? 75000);
    $bank_name = trim($input['bank_name'] ?? 'Bank Mandiri');
    $bank_account = trim($input['bank_account'] ?? '129-000-742-767-3');
    $bank_holder = trim($input['bank_holder'] ?? 'PT. Erlass Prokreatif Indonesia');
    $wa_url = trim($input['whatsapp_group_url'] ?? 'https://chat.whatsapp.com/ErlassCompetition2026');
    $phone = trim($input['contact_phone'] ?? '+62 823-1134-1381');
    $status = in_array($input['status'] ?? '', ['open', 'upcoming', 'closed'], true) ? $input['status'] : 'open';

    if (!$title) {
        send_json(['status' => 'error', 'message' => 'Judul kompetisi wajib diisi.'], 422);
    }

    if (!$slug) {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $title));
    }

    if ($id > 0) {
        // Update
        $stmt = $pdo->prepare("UPDATE competitions SET
            title = ?, slug = ?, tagline = ?, theme = ?, subtheme = ?,
            registration_start = ?, registration_end = ?, competition_date = ?, announcement_date = ?,
            general_fee = ?, bank_name = ?, bank_account = ?, bank_holder = ?,
            whatsapp_group_url = ?, contact_phone = ?, status = ?
            WHERE id = ?");
        $stmt->execute([
            $title, $slug, $tagline, $theme, $subtheme,
            $reg_start, $reg_end, $comp_date, $ann_date,
            $general_fee, $bank_name, $bank_account, $bank_holder,
            $wa_url, $phone, $status, $id
        ]);
        $comp_id = $id;
    } else {
        // Create
        $stmt = $pdo->prepare("INSERT INTO competitions (
            title, slug, tagline, theme, subtheme,
            registration_start, registration_end, competition_date, announcement_date,
            general_fee, bank_name, bank_account, bank_holder,
            whatsapp_group_url, contact_phone, status
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?
        )");
        $stmt->execute([
            $title, $slug, $tagline, $theme, $subtheme,
            $reg_start, $reg_end, $comp_date, $ann_date,
            $general_fee, $bank_name, $bank_account, $bank_holder,
            $wa_url, $phone, $status
        ]);
        $comp_id = (int)$pdo->lastInsertId();

        // Salin cabang lomba default jika buat baru
        $defaultBranches = [
            ['SCR', 'Scratch Coding', 'SD Kelas 1 - 6', 'Pemrograman visual interaktif Scratch'],
            ['MIC', 'Micro:bit', 'SD 4-6 & SMP 7-9', 'IoT dan mikrokontroler BBC Micro:bit'],
            ['JIM', 'Jimu Robotics', 'SD 4-6 & SMP 7-9', 'Robotika modular dan perakitan cerdas']
        ];
        $stmtB = $pdo->prepare("INSERT INTO competition_branches (competition_id, code, name, target_grades, description) VALUES (?, ?, ?, ?, ?)");
        foreach ($defaultBranches as $b) {
            $stmtB->execute([$comp_id, $b[0], $b[1], $b[2], $b[3]]);
        }
    }

    send_json([
        'status' => 'ok',
        'message' => 'Kompetisi berhasil disimpan.',
        'competition_id' => $comp_id
    ]);
}

// 8. Ambil Seluruh Data Pengumpulan Proyek (Dengan Filter & Statistik)
if ($action === 'get_project_submissions') {
    $branch = trim($_GET['branch'] ?? '');
    $grade_cat = trim($_GET['grade_category'] ?? '');
    $search = trim($_GET['search'] ?? '');
    $status = trim($_GET['status'] ?? '');

    $where = ["1=1"];
    $binds = [];

    if ($branch !== '') {
        $where[] = "ps.branch = ?";
        $binds[] = $branch;
    }
    if ($grade_cat !== '') {
        $where[] = "ps.grade_category = ?";
        $binds[] = $grade_cat;
    }
    if ($status !== '') {
        if ($status === 'allow_revision') {
            $where[] = "ps.allow_revision = 1";
        } else {
            $where[] = "ps.status = ?";
            $binds[] = $status;
        }
    }
    if ($search !== '') {
        $where[] = "(ps.reg_code LIKE ? OR ps.participant_name LIKE ? OR ps.school_name LIKE ? OR ps.project_title LIKE ?)";
        $sTerm = "%{$search}%";
        $binds[] = $sTerm;
        $binds[] = $sTerm;
        $binds[] = $sTerm;
        $binds[] = $sTerm;
    }

    $sqlWhere = implode(' AND ', $where);

    // Ambil data submissions
    $stmt = $pdo->prepare("
        SELECT ps.*, r.phone, r.grade, r.is_partner
        FROM project_submissions ps
        JOIN registrations r ON ps.registration_id = r.id
        WHERE {$sqlWhere}
        ORDER BY ps.id DESC
    ");
    $stmt->execute($binds);
    $submissions = $stmt->fetchAll();

    // Hitung statistik keseluruhan
    $stmtStats = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN branch LIKE '%Scratch%' THEN 1 ELSE 0 END) as total_scratch,
            SUM(CASE WHEN branch LIKE '%Micro%' THEN 1 ELSE 0 END) as total_microbit,
            SUM(CASE WHEN branch LIKE '%Erboblox%' THEN 1 ELSE 0 END) as total_erboblox,
            SUM(CASE WHEN allow_revision = 1 THEN 1 ELSE 0 END) as total_allow_revision
        FROM project_submissions
    ");
    $stats = $stmtStats->fetch() ?: [
        'total' => 0,
        'total_scratch' => 0,
        'total_microbit' => 0,
        'total_erboblox' => 0,
        'total_allow_revision' => 0
    ];

    send_json([
        'status' => 'ok',
        'stats' => $stats,
        'total' => count($submissions),
        'submissions' => $submissions
    ]);
}

// 9. Toggle Izin Revisi Proyek Peserta
if ($action === 'toggle_project_revision') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $id = (int)($input['id'] ?? 0);
    $allow_revision = !empty($input['allow_revision']) ? 1 : 0;
    $admin_notes = trim($input['admin_notes'] ?? '');

    if ($id <= 0) {
        send_json(['status' => 'error', 'message' => 'ID Proyek tidak valid.'], 422);
    }

    $stmt = $pdo->prepare("SELECT id, reg_code, participant_name FROM project_submissions WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $sub = $stmt->fetch();

    if (!$sub) {
        send_json(['status' => 'error', 'message' => 'Data pengumpulan proyek tidak ditemukan.'], 404);
    }

    $stmtUp = $pdo->prepare("UPDATE project_submissions SET allow_revision = ?, admin_notes = ? WHERE id = ?");
    $stmtUp->execute([$allow_revision, $admin_notes ?: null, $id]);

    $statusText = $allow_revision ? 'diaktifkan (peserta dapat mengedit/mengunggah ulang)' : 'dikunci kembali';
    send_json([
        'status' => 'ok',
        'message' => "Izin revisi untuk peserta {$sub['participant_name']} ({$sub['reg_code']}) berhasil {$statusText}.",
        'allow_revision' => $allow_revision
    ]);
}

// 10. Ekspor Data Pengumpulan Proyek ke CSV
if ($action === 'export_project_submissions') {
    $stmt = $pdo->query("
        SELECT ps.*, r.phone, r.gender, r.grade, r.region, r.is_partner
        FROM project_submissions ps
        JOIN registrations r ON ps.registration_id = r.id
        ORDER BY ps.id ASC
    ");
    $rows = $stmt->fetchAll();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=Rekap_Pengumpulan_Proyek_' . date('Ymd_His') . '.csv');

    $output = fopen('php://output', 'w');
    // Output UTF-8 BOM agar rapi di Microsoft Excel
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    fputcsv($output, [
        'No',
        'ID Peserta (Reg Code)',
        'Nama Peserta',
        'Jenis Kelamin',
        'Asal Sekolah',
        'Wilayah/Kota',
        'Cabang Lomba',
        'Jenjang Kategori Lomba',
        'Kelas Siswa',
        'No WhatsApp',
        'Judul Proyek',
        'Deskripsi Singkat Proyek',
        'Tautan Video Utama',
        'Tautan Video Cadangan',
        'Nama Berkas Proyek',
        'Path Berkas Server',
        'Ukuran Berkas (Bytes)',
        'Versi Pengumpulan',
        'Izin Revisi Aktif',
        'Catatan Panitia',
        'Waktu Pengumpulan Pertama',
        'Waktu Terakhir Revisi'
    ]);

    $no = 1;
    foreach ($rows as $r) {
        fputcsv($output, [
            $no++,
            $r['reg_code'],
            $r['participant_name'],
            $r['gender'],
            $r['school_name'],
            $r['region'],
            $r['branch'],
            $r['grade_category'],
            $r['grade'],
            $r['phone'],
            $r['project_title'],
            $r['project_description'],
            $r['video_url'],
            $r['backup_video_url'] ?: '-',
            $r['project_file_name'] ?: '-',
            $r['project_file_path'] ?: '-',
            $r['project_file_size'] ?: 0,
            'Versi ' . $r['version'],
            $r['allow_revision'] ? 'YA (Diizinkan)' : 'TIDAK (Terkunci)',
            $r['admin_notes'] ?: '-',
            $r['submitted_at'],
            $r['last_revised_at'] ?: '-'
        ]);
    }

    fclose($output);
    exit;
}

// 11. Hapus Data Pengumpulan Proyek (Manual Delete)
if ($action === 'delete_project_submission') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $id = (int)($input['id'] ?? 0);

    if ($id <= 0) {
        send_json(['status' => 'error', 'message' => 'ID Proyek tidak valid.'], 422);
    }

    $stmt = $pdo->prepare("SELECT id, reg_code, participant_name, project_file_path FROM project_submissions WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $sub = $stmt->fetch();

    if (!$sub) {
        send_json(['status' => 'error', 'message' => 'Data pengumpulan proyek tidak ditemukan.'], 404);
    }

    // Hapus berkas fisik proyek dari server jika ada
    if (!empty($sub['project_file_path'])) {
        $absPath = __DIR__ . '/../' . ltrim($sub['project_file_path'], '/');
        if (file_exists($absPath) && is_file($absPath)) {
            @unlink($absPath);
        }
    }

    $stmtDel = $pdo->prepare("DELETE FROM project_submissions WHERE id = ?");
    $stmtDel->execute([$id]);

    send_json([
        'status' => 'ok',
        'message' => "Data pengumpulan proyek peserta {$sub['participant_name']} ({$sub['reg_code']}) beserta berkasnya berhasil dihapus."
    ]);
}

// 12. Modul Penjurian Karya (Blind Review - Tanpa Identitas & Sekolah)
if ($action === 'get_judging_submissions') {
    $branch   = trim($_GET['branch'] ?? '');
    $gradeCat = trim($_GET['grade_category'] ?? '');
    $status   = trim($_GET['status'] ?? ''); // 'all', 'scored', 'unscored'
    $search   = trim($_GET['search'] ?? '');
    $judgeId  = (int)$currentAdmin['id'];
    $judgeRole = $currentAdmin['role'] ?? '';
    $judgeGroup = $currentAdmin['judge_group'] !== null ? (int)$currentAdmin['judge_group'] : null;

    // Filter kelompok juri: Juri diwajibkan sesuai kelompoknya (Opsi A 4-kelompok 2-juri), admin/panitia fleksibel
    $filterGroup = null;
    if ($judgeRole === 'juri') {
        $filterGroup = $judgeGroup;
    } elseif (isset($_GET['judge_group']) && $_GET['judge_group'] !== '') {
        $filterGroup = (int)$_GET['judge_group'];
    }

    // Identifikasi partner dewan juri dalam kelompok yang sama
    $partnerJudge = null;
    if ($judgeGroup !== null) {
        $stmtPartner = $pdo->prepare("SELECT id, full_name, username FROM admin_users WHERE role = 'juri' AND judge_group = ? AND id != ? LIMIT 1");
        $stmtPartner->execute([$judgeGroup, $judgeId]);
        $partnerJudge = $stmtPartner->fetch();
    }

    $sql = "
        SELECT 
            p.id,
            p.reg_code,
            p.branch,
            p.grade_category,
            p.judge_group,
            p.project_title,
            p.project_description,
            p.project_file_path,
            p.project_file_name,
            p.project_file_size,
            p.video_url,
            p.backup_video_url,
            p.version,
            p.submitted_at,
            p.status,
            s.id AS score_id,
            s.score_presentation,
            s.score_logic,
            s.score_creativity,
            s.score_design,
            s.score_theme,
            s.bonus_score,
            s.technical_passed,
            s.total_score,
            s.judge_notes,
            s.updated_at AS scored_at,
            (SELECT COUNT(*) FROM project_scores WHERE submission_id = p.id) AS total_judges_reviewed,
            (SELECT ROUND(AVG(total_score), 2) FROM project_scores WHERE submission_id = p.id) AS avg_score
        FROM project_submissions p
        LEFT JOIN project_scores s ON (s.submission_id = p.id AND s.judge_id = ?)
        WHERE 1 = 1
    ";
    $params = [$judgeId];

    if ($filterGroup !== null) {
        $sql .= " AND p.judge_group = ?";
        $params[] = $filterGroup;
    }
    if ($branch !== '') {
        $sql .= " AND (p.branch = ? OR p.branch LIKE ?)";
        $params[] = $branch;
        $params[] = "%$branch%";
    }
    if ($gradeCat !== '') {
        $sql .= " AND (p.grade_category = ? OR p.grade_category LIKE ?)";
        $params[] = $gradeCat;
        $params[] = "%$gradeCat%";
    }
    if ($search !== '') {
        $sql .= " AND (p.reg_code LIKE ? OR p.project_title LIKE ?)";
        $searchParam = "%$search%";
        $params[] = $searchParam;
        $params[] = $searchParam;
    }

    if ($status === 'scored') {
        $sql .= " AND s.id IS NOT NULL";
    } elseif ($status === 'unscored') {
        $sql .= " AND s.id IS NULL";
    }

    $sql .= " ORDER BY (s.id IS NULL) DESC, p.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Blind masking and file path cleanup
    $submissions = [];
    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $hostUrl = ($isHttps ? "https" : "http") . "://" . ($_SERVER['HTTP_HOST'] ?? 'erlasscompetition.erlass.academy');

    foreach ($rows as $r) {
        $ext = strtolower(pathinfo($r['project_file_path'] ?? '', PATHINFO_EXTENSION));
        $cleanFileName = 'Proyek_' . $r['reg_code'] . ($ext ? '.' . $ext : '');
        $fullFileUrl = !empty($r['project_file_path']) ? $hostUrl . '/' . ltrim($r['project_file_path'], '/') : '';

        // Extract Scratch summary if sb3
        $scratchSummary = null;
        if ($ext === 'sb3' && !empty($r['project_file_path'])) {
            $absPath = __DIR__ . '/../' . ltrim($r['project_file_path'], '/');
            if (file_exists($absPath)) {
                $zip = new ZipArchive();
                if ($zip->open($absPath) === TRUE) {
                    $jsonStr = $zip->getFromName('project.json');
                    if ($jsonStr) {
                        $pdata = json_decode($jsonStr, true);
                        $targets = $pdata['targets'] ?? [];
                        $totalBlocks = 0;
                        $spriteList = [];
                        foreach ($targets as $t) {
                            $bCount = count($t['blocks'] ?? []);
                            $totalBlocks += $bCount;
                            $spriteList[] = [
                                'name' => $t['name'] ?? 'Sprite',
                                'is_stage' => !empty($t['isStage']),
                                'block_count' => $bCount,
                                'costumes_count' => count($t['costumes'] ?? []),
                                'sounds_count' => count($t['sounds'] ?? [])
                            ];
                        }
                        $scratchSummary = [
                            'total_targets' => count($targets),
                            'total_blocks' => $totalBlocks,
                            'sprites' => $spriteList
                        ];
                    }
                    $zip->close();
                }
            }
        }

        // Sanitize project title in blind review (strip accidental "by [Student Name]")
        $displayTitle = $r['project_title'];
        if (($currentAdmin['role'] ?? '') === 'juri') {
            $stripped = preg_replace('/\s*(by|oleh|karya|ciptaan|dibuat oleh)\s+.*$/iu', '', $displayTitle);
            if (!empty(trim($stripped))) {
                $displayTitle = trim($stripped);
            }
        }

        $submissions[] = [
            'id' => (int)$r['id'],
            'reg_code' => $r['reg_code'],
            'blind_code' => 'Peserta #' . $r['reg_code'],
            'branch' => $r['branch'],
            'grade_category' => $r['grade_category'],
            'judge_group' => (int)$r['judge_group'],
            'project_title' => $displayTitle,
            'project_description' => $r['project_description'],
            'project_file_url' => $fullFileUrl,
            'stream_url' => $hostUrl . '/api/admin.php?action=stream_project_file&id=' . $r['id'] . '&token=' . urlencode($token),
            'project_file_name' => $cleanFileName,
            'project_file_size' => (int)$r['project_file_size'],
            'file_ext' => $ext,
            'video_url' => $r['video_url'],
            'backup_video_url' => $r['backup_video_url'],
            'version' => (int)$r['version'],
            'submitted_at' => $r['submitted_at'],
            'scratch_summary' => $scratchSummary,
            'is_scored' => !empty($r['score_id']),
            'my_score' => !empty($r['score_id']) ? [
                'score_id' => (int)$r['score_id'],
                'score_presentation' => (float)$r['score_presentation'],
                'score_logic' => (float)$r['score_logic'],
                'score_creativity' => (float)$r['score_creativity'],
                'score_design' => (float)$r['score_design'],
                'score_theme' => (float)$r['score_theme'],
                'bonus_score' => (float)$r['bonus_score'],
                'technical_passed' => (int)$r['technical_passed'],
                'total_score' => (float)$r['total_score'],
                'judge_notes' => $r['judge_notes'],
                'scored_at' => $r['scored_at']
            ] : null,
            'total_judges_reviewed' => (int)$r['total_judges_reviewed'],
            'avg_score' => $r['avg_score'] !== null ? (float)$r['avg_score'] : null
        ];
    }

    // Stats for judge (dibatasi sesuai kelompok jika juri)
    if ($judgeRole === 'juri' && $judgeGroup !== null) {
        $stmtTotal = $pdo->prepare("SELECT COUNT(*) AS total FROM project_submissions WHERE judge_group = ?");
        $stmtTotal->execute([$judgeGroup]);
        $totalCount = (int)($stmtTotal->fetch()['total'] ?? 0);

        $stmtMyScored = $pdo->prepare("
            SELECT COUNT(*) AS total 
            FROM project_scores s
            JOIN project_submissions p ON s.submission_id = p.id
            WHERE s.judge_id = ? AND p.judge_group = ?
        ");
        $stmtMyScored->execute([$judgeId, $judgeGroup]);
        $myScoredCount = (int)($stmtMyScored->fetch()['total'] ?? 0);
    } else {
        $stmtTotal = $pdo->query("SELECT COUNT(*) AS total FROM project_submissions");
        $totalCount = (int)($stmtTotal->fetch()['total'] ?? 0);

        $stmtMyScored = $pdo->prepare("SELECT COUNT(*) AS total FROM project_scores WHERE judge_id = ?");
        $stmtMyScored->execute([$judgeId]);
        $myScoredCount = (int)($stmtMyScored->fetch()['total'] ?? 0);
    }

    send_json([
        'status' => 'ok',
        'submissions' => $submissions,
        'stats' => [
            'total' => $totalCount,
            'my_scored' => $myScoredCount,
            'my_remaining' => max(0, $totalCount - $myScoredCount)
        ],
        'current_judge' => [
            'id' => $currentAdmin['id'],
            'name' => $currentAdmin['full_name'],
            'role' => $currentAdmin['role'],
            'judge_group' => $judgeGroup,
            'partner_name' => $partnerJudge ? $partnerJudge['full_name'] : null
        ]
    ]);
}

// 13. Simpan Nilai Juri (Rubrik 5 Kriteria Terbobot Resmi 2026)
if ($action === 'save_project_score') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    
    $submission_id      = (int)($input['submission_id'] ?? 0);
    $score_presentation = max(0, min(100, (float)($input['score_presentation'] ?? 0))); // 40%
    $score_logic        = max(0, min(100, (float)($input['score_logic'] ?? 0)));        // 20%
    $score_creativity   = max(0, min(100, (float)($input['score_creativity'] ?? 0)));   // 15%
    $score_design       = max(0, min(100, (float)($input['score_design'] ?? 0)));       // 15% (Fungsi & Keberhasilan)
    $score_theme        = max(0, min(100, (float)($input['score_theme'] ?? 0)));        // 10%
    $bonus_score        = max(0, min(10, (float)($input['bonus_score'] ?? 0)));         // 0, 3, 5 (Micro:bit SD bonus)
    $technical_passed   = isset($input['technical_passed']) ? ((int)$input['technical_passed'] ? 1 : 0) : 1;
    $judge_notes        = trim($input['judge_notes'] ?? '');

    if ($submission_id <= 0) {
        send_json(['status' => 'error', 'message' => 'ID Proyek tidak valid.'], 422);
    }

    $stmtSub = $pdo->prepare("SELECT id, reg_code, branch, grade_category, judge_group FROM project_submissions WHERE id = ? LIMIT 1");
    $stmtSub->execute([$submission_id]);
    $sub = $stmtSub->fetch();
    if (!$sub) {
        send_json(['status' => 'error', 'message' => 'Data karya proyek tidak ditemukan.'], 404);
    }

    // Formula Resmi 2026:
    // (Presentasi * 0.40) + (Logika * 0.20) + (Kreativitas * 0.15) + (Fungsi * 0.15) + (Tema * 0.10) + bonus_score
    // Batas maksimal total nilai adalah 100
    $weighted = ($score_presentation * 0.40) +
                ($score_logic * 0.20) +
                ($score_creativity * 0.15) +
                ($score_design * 0.15) +
                ($score_theme * 0.10) +
                $bonus_score;
    $total_score = min(100.0, round($weighted, 2));

    $judgeId = (int)$currentAdmin['id'];
    $judgeName = $currentAdmin['full_name'] ?: ('Juri #' . $judgeId);

    $stmtSave = $pdo->prepare("
        INSERT INTO project_scores (
            submission_id, judge_id, judge_name,
            score_presentation, score_logic, score_creativity, score_design, score_theme,
            bonus_score, technical_passed,
            total_score, judge_notes, updated_at
        ) VALUES (
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, NOW()
        )
        ON DUPLICATE KEY UPDATE
            score_presentation = VALUES(score_presentation),
            score_logic = VALUES(score_logic),
            score_creativity = VALUES(score_creativity),
            score_design = VALUES(score_design),
            score_theme = VALUES(score_theme),
            bonus_score = VALUES(bonus_score),
            technical_passed = VALUES(technical_passed),
            total_score = VALUES(total_score),
            judge_notes = VALUES(judge_notes),
            updated_at = NOW()
    ");

    $stmtSave->execute([
        $submission_id, $judgeId, $judgeName,
        $score_presentation, $score_logic, $score_creativity, $score_design, $score_theme,
        $bonus_score, $technical_passed,
        $total_score, $judge_notes
    ]);

    // Update status project_submissions menjadi reviewed jika belum
    $pdo->prepare("UPDATE project_submissions SET status = 'reviewed' WHERE id = ? AND status != 'reviewed'")->execute([$submission_id]);

    send_json([
        'status' => 'ok',
        'message' => 'Nilai karya berhasil disimpan!',
        'total_score' => $total_score,
        'submission_id' => $submission_id
    ]);
}

// 14. Rekapitulasi Nilai & Leaderboard (Maks 2 Juri per Proyek)
if ($action === 'get_judging_leaderboard') {
    $branch      = trim($_GET['branch'] ?? '');
    $gradeCat    = trim($_GET['grade_category'] ?? '');
    $search      = trim($_GET['search'] ?? '');
    $groupFilter = isset($_GET['judge_group']) && $_GET['judge_group'] !== '' ? (int)$_GET['judge_group'] : null;
    $isPrivileged = in_array($currentAdmin['role'] ?? '', ['superadmin', 'panitia'], true);

    $sql = "
        SELECT 
            p.id,
            p.reg_code,
            p.participant_name,
            p.school_name,
            p.branch,
            p.grade_category,
            p.judge_group,
            p.project_title,
            COUNT(s.id) AS judge_count,
            ROUND(AVG(s.score_presentation), 2) AS avg_presentation,
            ROUND(AVG(s.score_logic), 2) AS avg_logic,
            ROUND(AVG(s.score_creativity), 2) AS avg_creativity,
            ROUND(AVG(s.score_design), 2) AS avg_design,
            ROUND(AVG(s.score_theme), 2) AS avg_theme,
            ROUND(AVG(s.bonus_score), 2) AS avg_bonus,
            ROUND(AVG(s.total_score), 2) AS final_score
        FROM project_submissions p
        LEFT JOIN project_scores s ON s.submission_id = p.id
        WHERE 1 = 1
    ";
    $params = [];

    if ($groupFilter !== null) {
        $sql .= " AND p.judge_group = ?";
        $params[] = $groupFilter;
    }
    if ($branch !== '') {
        $sql .= " AND (p.branch = ? OR p.branch LIKE ?)";
        $params[] = $branch;
        $params[] = "%$branch%";
    }
    if ($gradeCat !== '') {
        $sql .= " AND (p.grade_category = ? OR p.grade_category LIKE ?)";
        $params[] = $gradeCat;
        $params[] = "%$gradeCat%";
    }
    if ($search !== '') {
        $sql .= " AND (p.reg_code LIKE ? OR p.participant_name LIKE ? OR p.school_name LIKE ? OR p.project_title LIKE ?)";
        $sTerm = "%$search%";
        $params[] = $sTerm;
        $params[] = $sTerm;
        $params[] = $sTerm;
        $params[] = $sTerm;
    }

    $sql .= " GROUP BY p.id HAVING judge_count > 0 ORDER BY final_score DESC, judge_count DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Ambil rincian skor per juri untuk setiap proyek yang terdaftar
    $subIds = array_column($rows, 'id');
    $scoresBySub = [];
    if (!empty($subIds)) {
        $inPlaceholders = implode(',', array_fill(0, count($subIds), '?'));
        $stmtScores = $pdo->prepare("
            SELECT 
                submission_id, judge_id, judge_name,
                score_presentation, score_logic, score_creativity, score_design, score_theme,
                bonus_score, technical_passed,
                total_score, judge_notes, updated_at
            FROM project_scores 
            WHERE submission_id IN ($inPlaceholders)
            ORDER BY id ASC
        ");
        $stmtScores->execute($subIds);
        while ($sc = $stmtScores->fetch()) {
            $scoresBySub[$sc['submission_id']][] = [
                'judge_id' => (int)$sc['judge_id'],
                'judge_name' => $sc['judge_name'],
                'score_presentation' => (float)$sc['score_presentation'],
                'score_logic' => (float)$sc['score_logic'],
                'score_creativity' => (float)$sc['score_creativity'],
                'score_design' => (float)$sc['score_design'],
                'score_theme' => (float)$sc['score_theme'],
                'bonus_score' => (float)$sc['bonus_score'],
                'technical_passed' => (int)$sc['technical_passed'],
                'total_score' => (float)$sc['total_score'],
                'judge_notes' => $sc['judge_notes'],
                'scored_at' => $sc['updated_at']
            ];
        }
    }

    $leaderboard = [];
    foreach ($rows as $idx => $r) {
        $pTitle = $r['project_title'];
        if (!$isPrivileged) {
            $stripped = preg_replace('/\s*(by|oleh|karya|ciptaan|dibuat oleh)\s+.*$/iu', '', $pTitle);
            if (!empty(trim($stripped))) {
                $pTitle = trim($stripped);
            }
        }

        $item = [
            'rank' => $idx + 1,
            'id' => (int)$r['id'],
            'reg_code' => $r['reg_code'],
            'blind_code' => 'Peserta #' . $r['reg_code'],
            'branch' => $r['branch'],
            'grade_category' => $r['grade_category'],
            'judge_group' => (int)$r['judge_group'],
            'project_title' => $pTitle,
            'judge_count' => (int)$r['judge_count'],
            'avg_presentation' => (float)$r['avg_presentation'],
            'avg_logic' => (float)$r['avg_logic'],
            'avg_creativity' => (float)$r['avg_creativity'],
            'avg_design' => (float)$r['avg_design'],
            'avg_theme' => (float)$r['avg_theme'],
            'avg_bonus' => (float)$r['avg_bonus'],
            'final_score' => (float)$r['final_score'],
            'judge_scores' => $scoresBySub[$r['id']] ?? []
        ];

        if ($isPrivileged) {
            $item['participant_name'] = $r['participant_name'];
            $item['school_name'] = $r['school_name'];
        } else {
            $item['participant_name'] = 'Dirahasiakan (Blind Review)';
            $item['school_name'] = 'Dirahasiakan (Blind Review)';
        }

        $leaderboard[] = $item;
    }

    // Statistik keseluruhan penjurian
    $totalSubs = (int)($pdo->query("SELECT COUNT(*) FROM project_submissions")->fetchColumn() ?: 0);
    $totalReviewed = (int)($pdo->query("SELECT COUNT(DISTINCT submission_id) FROM project_scores")->fetchColumn() ?: 0);
    $totalJudges = (int)($pdo->query("SELECT COUNT(*) FROM admin_users WHERE role = 'juri'")->fetchColumn() ?: 0);
    $activeJudges = (int)($pdo->query("SELECT COUNT(DISTINCT judge_id) FROM project_scores")->fetchColumn() ?: 0);
    $highestScore = !empty($leaderboard) ? $leaderboard[0]['final_score'] : 0;

    send_json([
        'status' => 'ok',
        'leaderboard' => $leaderboard,
        'stats' => [
            'total_submissions' => $totalSubs,
            'total_reviewed' => $totalReviewed,
            'total_unreviewed' => max(0, $totalSubs - $totalReviewed),
            'total_judges' => $totalJudges,
            'active_judges' => $activeJudges,
            'highest_score' => (float)$highestScore
        ]
    ]);
}

// 15. Export Berita Acara Rekapitulasi Nilai Juri (CSV)
if ($action === 'export_judging_csv') {
    $branch      = trim($_GET['branch'] ?? '');
    $gradeCat    = trim($_GET['grade_category'] ?? '');
    $groupFilter = isset($_GET['judge_group']) && $_GET['judge_group'] !== '' ? (int)$_GET['judge_group'] : null;
    $isPrivileged = in_array($currentAdmin['role'] ?? '', ['superadmin', 'panitia'], true);

    $sql = "
        SELECT 
            p.reg_code,
            p.participant_name,
            p.school_name,
            p.branch,
            p.grade_category,
            p.judge_group,
            p.project_title,
            COUNT(s.id) AS judge_count,
            ROUND(AVG(s.score_presentation), 2) AS avg_presentation,
            ROUND(AVG(s.score_logic), 2) AS avg_logic,
            ROUND(AVG(s.score_creativity), 2) AS avg_creativity,
            ROUND(AVG(s.score_design), 2) AS avg_design,
            ROUND(AVG(s.score_theme), 2) AS avg_theme,
            ROUND(AVG(s.bonus_score), 2) AS avg_bonus,
            ROUND(AVG(s.total_score), 2) AS final_score
        FROM project_submissions p
        LEFT JOIN project_scores s ON s.submission_id = p.id
        WHERE 1 = 1
    ";
    $params = [];
    if ($groupFilter !== null) {
        $sql .= " AND p.judge_group = ?";
        $params[] = $groupFilter;
    }
    if ($branch !== '') {
        $sql .= " AND (p.branch = ? OR p.branch LIKE ?)";
        $params[] = $branch;
        $params[] = "%$branch%";
    }
    if ($gradeCat !== '') {
        $sql .= " AND (p.grade_category = ? OR p.grade_category LIKE ?)";
        $params[] = $gradeCat;
        $params[] = "%$gradeCat%";
    }
    $sql .= " GROUP BY p.id HAVING judge_count > 0 ORDER BY final_score DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=Berita_Acara_Nilai_Erlass_Competition_' . date('Ymd_His') . '.csv');

    $output = fopen('php://output', 'w');
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

    $headers = ['Peringkat', 'Kode Peserta'];
    if ($isPrivileged) {
        $headers[] = 'Nama Peserta';
        $headers[] = 'Asal Sekolah';
    }
    $headers = array_merge($headers, [
        'Cabang', 'Kategori', 'Kelompok Juri', 'Judul Karya', 'Jml Penilai (Maks 2)',
        'Presentasi (40%)', 'Logika (20%)', 'Kreativitas (15%)',
        'Fungsi (15%)', 'Tema (10%)', 'Bonus Sensor', 'NILAI AKHIR'
    ]);
    fputcsv($output, $headers);

    foreach ($rows as $idx => $r) {
        $pTitle = $r['project_title'];
        if (!$isPrivileged) {
            $stripped = preg_replace('/\s*(by|oleh|karya|ciptaan|dibuat oleh)\s+.*$/iu', '', $pTitle);
            if (!empty(trim($stripped))) {
                $pTitle = trim($stripped);
            }
        }

        $line = [$idx + 1, $r['reg_code']];
        if ($isPrivileged) {
            $line[] = $r['participant_name'];
            $line[] = $r['school_name'];
        }
        $line[] = $r['branch'];
        $line[] = $r['grade_category'];
        $line[] = 'Kelompok ' . $r['judge_group'];
        $line[] = $pTitle;
        $line[] = $r['judge_count'] . '/2';
        $line[] = $r['avg_presentation'];
        $line[] = $r['avg_logic'];
        $line[] = $r['avg_creativity'];
        $line[] = $r['avg_design'];
        $line[] = $r['avg_theme'];
        $line[] = $r['avg_bonus'];
        $line[] = $r['final_score'];
        fputcsv($output, $line);
    }

    fclose($output);
    exit;
}

// 16. Stream Berkas Proyek dengan Header CORS (Untuk TurboWarp Embed / MakeCode)
if ($action === 'stream_project_file') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT id, reg_code, project_file_path, project_file_name FROM project_submissions WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $sub = $stmt->fetch();

    if (!$sub || empty($sub['project_file_path'])) {
        send_json(['status' => 'error', 'message' => 'Berkas proyek tidak ditemukan.'], 404);
    }

    $absPath = __DIR__ . '/../' . ltrim($sub['project_file_path'], '/');
    if (!file_exists($absPath)) {
        send_json(['status' => 'error', 'message' => 'Berkas fisik tidak ditemukan di server.'], 404);
    }

    $ext = strtolower(pathinfo($absPath, PATHINFO_EXTENSION));
    $mime = 'application/octet-stream';
    if ($ext === 'sb3') $mime = 'application/x.scratch.sb3';
    if ($ext === 'hex') $mime = 'text/plain';

    $cleanFileName = 'Proyek_' . ($sub['reg_code'] ?? 'Karya') . ($ext ? '.' . $ext : '');

    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($absPath));
    header('Content-Disposition: inline; filename="' . $cleanFileName . '"');
    readfile($absPath);
    exit;
}

send_json(['status' => 'error', 'message' => 'Aksi admin tidak valid.'], 400);
