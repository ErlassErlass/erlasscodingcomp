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
    
    if (in_array($passcode, ['Erlass101.', 'Erlass101', 'erlass101', 'Erlass@2026', 'erlass2026', 'admincompetition', 'competition-auth-2026'], true) || strtolower(rtrim($passcode, '.')) === 'erlass101') {
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
            'role' => $user['role']
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
        $sql .= " AND (participant_name LIKE ? OR school_name LIKE ? OR phone LIKE ? OR reg_code LIKE ?)";
        $searchParam = "%$search%";
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

// 5. Ekspor Laporan ke CSV (Langsung dibuka rapi di Excel)
if ($action === 'export_csv') {
    $comp_id = (int)($_GET['competition_id'] ?? 1);
    $branch  = trim($_GET['branch'] ?? '');
    $status  = trim($_GET['status'] ?? '');

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

    $filename = "Laporan_Peserta_Erlass_Competition_" . date('Ymd_His') . ".csv";

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
        'Catatan Panitia',
        'Waktu Pendaftaran'
    ]);

    $no = 1;
    foreach ($rows as $r) {
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

send_json(['status' => 'error', 'message' => 'Aksi admin tidak valid.'], 400);
