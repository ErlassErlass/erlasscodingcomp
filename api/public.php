<?php
/**
 * Public API Endpoint
 * Erlass Competition Portal
 */

require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// 1. Ambil Info Kompetisi Aktif, Cabang, dan Sekolah Rekanan
if ($action === 'get_competition') {
    $slug = trim($_GET['slug'] ?? '');
    $comp_id = (int)($_GET['id'] ?? 0);
    
    if ($comp_id > 0) {
        $stmt = $pdo->prepare("SELECT * FROM competitions WHERE id = ? LIMIT 1");
        $stmt->execute([$comp_id]);
    } elseif ($slug !== '') {
        $stmt = $pdo->prepare("SELECT * FROM competitions WHERE slug = ? LIMIT 1");
        $stmt->execute([$slug]);
    } else {
        $stmt = $pdo->query("SELECT * FROM competitions WHERE status = 'open' ORDER BY id DESC LIMIT 1");
    }
    $comp = $stmt->fetch();

    if (!$comp) {
        // Fallback to the latest competition
        $comp = $pdo->query("SELECT * FROM competitions ORDER BY id DESC LIMIT 1")->fetch();
    }

    if (!$comp) {
        send_json(['status' => 'error', 'message' => 'Kompetisi tidak ditemukan.'], 404);
    }

    // Cabang Lomba
    $stmtBranches = $pdo->prepare("SELECT * FROM competition_branches WHERE competition_id = ? ORDER BY id ASC");
    $stmtBranches->execute([$comp['id']]);
    $branches = $stmtBranches->fetchAll();

    // Sekolah Rekanan (Hierarki: Jenjang -> Wilayah -> Sekolah + Kode)
    $stmtSchools = $pdo->query("SELECT school_code, jenjang, region, school_name FROM partner_schools WHERE is_active = 1 ORDER BY jenjang ASC, region ASC, school_name ASC");
    $schoolsRaw = $stmtSchools->fetchAll();
    
    $schoolsHierarchy = [];
    $schoolsByRegion = [];
    foreach ($schoolsRaw as $row) {
        $j = $row['jenjang'] ?: 'SD';
        $r = $row['region'];
        $code = $row['school_code'];
        $name = $row['school_name'];
        $displayName = '[' . $code . '] ' . $name;

        if (!isset($schoolsHierarchy[$j])) {
            $schoolsHierarchy[$j] = [];
        }
        if (!isset($schoolsHierarchy[$j][$r])) {
            $schoolsHierarchy[$j][$r] = [];
        }
        $schoolsHierarchy[$j][$r][] = [
            'code' => $code,
            'name' => $name,
            'display' => $displayName
        ];

        // Backwards compatibility
        if (!isset($schoolsByRegion[$r])) {
            $schoolsByRegion[$r] = [];
        }
        $schoolsByRegion[$r][] = $displayName;
    }

    send_json([
        'status' => 'ok',
        'competition' => $comp,
        'branches' => $branches,
        'schools_hierarchy' => $schoolsHierarchy,
        'schools_by_region' => $schoolsByRegion
    ]);
}

// 1.5. Pencarian Sekolah Nasional Instan (NPSN & Nama Sekolah)
if ($action === 'search_schools') {
    $q = trim($_GET['q'] ?? $_POST['q'] ?? '');
    if (mb_strlen($q) < 2) {
        send_json(['status' => 'ok', 'schools' => []]);
    }

    $term = $q;
    $prefix = $term . '%';
    $contain = '%' . $term . '%';

    if (ctype_digit($term)) {
        // Pencarian berdasarkan NPSN
        $stmt = $pdo->prepare("
            SELECT id, npsn, school_name, jenjang, city, province, is_partner
            FROM national_schools
            WHERE npsn LIKE ?
            ORDER BY (npsn = ?) DESC, is_partner DESC, school_name ASC
            LIMIT 15
        ");
        $stmt->execute([$prefix, $term]);
    } else {
        // Pencarian berdasarkan Nama Sekolah
        $words = array_filter(preg_split('/\s+/', $term));
        $ftParts = [];
        foreach ($words as $w) {
            if (mb_strlen($w) >= 2) {
                $ftParts[] = '+' . $w . '*';
            }
        }
        $ftTerm = implode(' ', $ftParts);

        if (!empty($ftTerm)) {
            $stmt = $pdo->prepare("
                SELECT id, npsn, school_name, jenjang, city, province, is_partner
                FROM national_schools
                WHERE MATCH(school_name) AGAINST(? IN BOOLEAN MODE) OR school_name LIKE ?
                ORDER BY (school_name LIKE ?) DESC, is_partner DESC, school_name ASC
                LIMIT 15
            ");
            $stmt->execute([$ftTerm, $contain, $prefix]);
        } else {
            $stmt = $pdo->prepare("
                SELECT id, npsn, school_name, jenjang, city, province, is_partner
                FROM national_schools
                WHERE school_name LIKE ?
                ORDER BY is_partner DESC, school_name ASC
                LIMIT 15
            ");
            $stmt->execute([$contain]);
        }
    }

    $schools = $stmt->fetchAll(PDO::FETCH_ASSOC);
    send_json([
        'status' => 'ok',
        'query' => $q,
        'count' => count($schools),
        'schools' => $schools
    ]);
}

// 2. Registrasi Peserta Baru
if ($action === 'register') {
    $comp_id = (int)($_POST['competition_id'] ?? 1);
    
    $nama_lengkap    = trim($_POST['nama_lengkap'] ?? '');
    $jenis_kelamin   = trim($_POST['jenis_kelamin'] ?? '');
    $tanggal_lahir   = trim($_POST['tanggal_lahir'] ?? '');
    $usia            = (int)($_POST['usia'] ?? 0);
    $kelas           = trim($_POST['kelas'] ?? '');
    $nomor_telepon   = trim($_POST['nomor_telepon'] ?? '');
    $alamat          = trim($_POST['alamat'] ?? '');
    $status_siswa    = trim($_POST['status_siswa'] ?? '');
    $status_kemitraan= trim($_POST['status_kemitraan'] ?? '');
    $cabang          = trim($_POST['cabang_kompetisi'] ?? '');
    $wilayah         = trim($_POST['wilayah'] ?? '');
    $nama_sekolah    = trim($_POST['nama_sekolah'] ?? '');
    $npsn            = trim($_POST['npsn'] ?? '');

    // Validasi input penting
    if (!$nama_lengkap || !$jenis_kelamin || !$tanggal_lahir || !$kelas || !$nomor_telepon || !$cabang || !$nama_sekolah) {
        send_json(['status' => 'error', 'message' => 'Mohon lengkapi seluruh field pendaftaran yang bertanda wajib.'], 422);
    }

    // Tentukan apakah pelanggan Erlass (Gratis) atau Umum
    // Verifikasi otomatis dari tabel national_schools bila ada NPSN
    $is_partner = 0;
    if ($npsn !== '') {
        $chkStmt = $pdo->prepare("SELECT is_partner FROM national_schools WHERE npsn = ? LIMIT 1");
        $chkStmt->execute([$npsn]);
        $chkRow = $chkStmt->fetch();
        if ($chkRow && (int)$chkRow['is_partner'] === 1) {
            $is_partner = 1;
        }
    }
    
    if (!$is_partner && !empty($status_kemitraan)) {
        if (stripos($status_kemitraan, 'Non-Pelanggan') === false && stripos($status_kemitraan, 'UMUM') === false && (stripos($status_kemitraan, 'Pelanggan') !== false || stripos($status_kemitraan, 'Siswa Aktif') !== false)) {
            $is_partner = 1;
        }
    }

    // Normalisasi Capslock untuk peserta umum (non-pelanggan)
    if (!$is_partner) {
        $wilayah = mb_strtoupper($wilayah, 'UTF-8');
        $nama_sekolah = mb_strtoupper($nama_sekolah, 'UTF-8');
    }
    
    // Ambil fee dari kompetisi (default 75000)
    $compStmt = $pdo->prepare("SELECT general_fee FROM competitions WHERE id = ? LIMIT 1");
    $compStmt->execute([$comp_id]);
    $compRow = $compStmt->fetch();
    $fee = $compRow ? (float)$compRow['general_fee'] : 75000.00;

    $payment_amount = $is_partner ? 0.00 : $fee;
    $payment_status = $is_partner ? 'verified' : 'pending';
    $payment_proof_filename = null;

    // Handle Upload Bukti Transfer jika bukan pelanggan
    if (!$is_partner) {
        if (!isset($_FILES['bukti_transfer']) || $_FILES['bukti_transfer']['error'] !== UPLOAD_ERR_OK) {
            send_json(['status' => 'error', 'message' => 'Bukti transfer wajib diunggah untuk pendaftar umum.'], 422);
        }

        $file = $_FILES['bukti_transfer'];
        $max_size = 8 * 1024 * 1024; // 8MB
        if ($file['size'] > $max_size) {
            send_json(['status' => 'error', 'message' => 'Ukuran berkas bukti transfer melebihi batas 8MB.'], 422);
        }

        $allowed_exts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed_exts, true)) {
            send_json(['status' => 'error', 'message' => 'Format berkas tidak didukung. Harap upload gambar JPG, PNG, WEBP atau PDF.'], 422);
        }

        $upload_dir = __DIR__ . '/../uploads/bukti_transfer';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0775, true);
        }

        $unique_name = 'tf_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
        $target_path = $upload_dir . '/' . $unique_name;

        if (!move_uploaded_file($file['tmp_name'], $target_path)) {
            send_json(['status' => 'error', 'message' => 'Gagal menyimpan berkas bukti transfer di server.'], 500);
        }

        $payment_proof_filename = $unique_name;
    }

    // Generate Kode Registrasi Unik
    // Format: E-[MM][YY]-[XXXX], Contoh: E-1026-0001 (Erlass, Bulan 10, Tahun 2026, Peserta 0001)
    $monthYear = date('my'); // e.g. 1026
    $codePrefix = 'E-' . $monthYear;

    // Cari sequence terakhir untuk bulan & tahun ini
    $stmtSeq = $pdo->prepare("SELECT COUNT(*) AS total FROM registrations WHERE reg_code LIKE ?");
    $stmtSeq->execute([$codePrefix . '-%']);
    $totalReg = (int)($stmtSeq->fetch()['total'] ?? 0) + 1;
    $reg_code = sprintf("%s-%04d", $codePrefix, $totalReg);

    // Simpan ke database
    $sql = "INSERT INTO registrations (
        competition_id, reg_code, participant_name, gender, birth_date, age, grade,
        phone, address, student_status, partnership_status, is_partner,
        branch, region, school_name, npsn, payment_amount, payment_proof, payment_status,
        created_at
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        NOW()
    )";

    try {
        $stmtInsert = $pdo->prepare($sql);
        $stmtInsert->execute([
            $comp_id, $reg_code, $nama_lengkap, $jenis_kelamin, $tanggal_lahir, $usia, $kelas,
            $nomor_telepon, $alamat, $status_siswa, $status_kemitraan, $is_partner,
            $cabang, $wilayah, $nama_sekolah, $npsn, $payment_amount, $payment_proof_filename, $payment_status
        ]);

        send_json([
            'status' => 'ok',
            'message' => 'Pendaftaran berhasil dikirim!',
            'data' => [
                'reg_code' => $reg_code,
                'participant_name' => $nama_lengkap,
                'school_name' => $nama_sekolah,
                'npsn' => $npsn,
                'branch' => $cabang,
                'is_partner' => (bool)$is_partner,
                'payment_status' => $payment_status,
                'phone' => $nomor_telepon
            ]
        ]);
    } catch (PDOException $e) {
        send_json(['status' => 'error', 'message' => 'Terjadi kesalahan database: ' . $e->getMessage()], 500);
    }
}

// 3. Cek Status Pendaftaran Mandiri (HANYA menggunakan Kode Registrasi, no WhatsApp dihapus)
if ($action === 'check_status') {
    $query = strtoupper(trim($_GET['query'] ?? $_POST['query'] ?? ''));
    if (!$query) {
        send_json(['status' => 'error', 'message' => 'Harap masukkan Kode Registrasi Peserta resmi Anda (Contoh: E-1026-0001).'], 422);
    }

    $stmt = $pdo->prepare("SELECT r.*, c.title AS competition_title, c.whatsapp_group_url, c.contact_phone
                           FROM registrations r
                           LEFT JOIN competitions c ON r.competition_id = c.id
                           WHERE UPPER(TRIM(r.reg_code)) = ?
                           ORDER BY r.id DESC LIMIT 1");
    $stmt->execute([$query]);
    $results = $stmt->fetchAll();

    if (!$results) {
        send_json(['status' => 'error', 'message' => 'Kode registrasi tidak ditemukan. Pastikan Anda memasukkan kode dengan benar (contoh: E-1026-0001).'], 404);
    }

    send_json([
        'status' => 'ok',
        'total' => count($results),
        'results' => $results
    ]);
}

send_json(['status' => 'error', 'message' => 'Aksi tidak valid.'], 400);
