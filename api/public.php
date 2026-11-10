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
        $comp = $stmt->fetch();
    } elseif ($slug !== '') {
        $stmt = $pdo->prepare("SELECT * FROM competitions WHERE slug = ? LIMIT 1");
        $stmt->execute([$slug]);
        $comp = $stmt->fetch();
    } else {
        // Prioritaskan kompetisi utama 2026 atau yang sedang dibuka
        $stmt = $pdo->query("SELECT * FROM competitions WHERE slug = 'erlass-competition-2026' LIMIT 1");
        $comp = $stmt->fetch();
        if (!$comp) {
            $stmt = $pdo->query("SELECT * FROM competitions WHERE status = 'open' ORDER BY id ASC LIMIT 1");
            $comp = $stmt->fetch();
        }
    }

    if (!$comp) {
        // Fallback to competition id 1 or the latest competition
        $comp = $pdo->query("SELECT * FROM competitions WHERE id = 1 LIMIT 1")->fetch();
        if (!$comp) {
            $comp = $pdo->query("SELECT * FROM competitions ORDER BY id DESC LIMIT 1")->fetch();
        }
    }

    if (!$comp) {
        send_json(['status' => 'error', 'message' => 'Kompetisi tidak ditemukan.'], 404);
    }

    // Evaluasi penutupan pendaftaran otomatis (5 November 2026 pukul 23:59:59 WIB)
    $now = time();
    $regEndTimestamp = $comp['registration_end'] ? strtotime($comp['registration_end'] . ' 23:59:59') : 0;
    $isRegClosed = ($comp['status'] === 'closed') || ($regEndTimestamp > 0 && $now > $regEndTimestamp);

    $comp['is_registration_closed'] = $isRegClosed;
    $comp['registration_end_timestamp'] = $regEndTimestamp;
    $comp['current_server_time'] = date('Y-m-d H:i:s');

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
        'is_registration_closed' => $isRegClosed,
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
    $results = [];
    $seenNpsn = [];

    // Jika pencarian angka murni (NPSN)
    if (ctype_digit($term)) {
        $prefix = $term . '%';
        $stmt = $pdo->prepare("
            SELECT id, npsn, school_name, jenjang, city, province, is_partner
            FROM national_schools
            WHERE npsn LIKE ?
            ORDER BY (npsn = ?) DESC, is_partner DESC, school_name ASC
            LIMIT 15
        ");
        $stmt->execute([$prefix, $term]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Normalisasi kata kunci:
        // 1. Pisahkan gabungan singkatan seperti SMPIT -> SMP IT, SDN -> SD N, dsb.
        $normTerm = preg_replace('/\b(SD|SMP|SMA)IT\b/iu', '$1 IT', $term);
        $normTerm = preg_replace('/\b(SD|SMP|SMA)N\b/iu', '$1 N', $normTerm);
        $normTerm = preg_replace('/\b(SD|SMP|SMA)S\b/iu', '$1 S', $normTerm);
        // Hapus karakter non-alphanumeric
        $cleanTerm = trim(preg_replace('/[^\p{L}\p{N}]+/u', ' ', $normTerm));
        $words = array_values(array_filter(explode(' ', $cleanTerm)));

        // 1. Prioritaskan pencarian di partner_schools (Sekolah Mitra)
        $partnerSql = "
            SELECT p.school_code AS npsn, p.school_name, p.jenjang, p.region AS city, '' AS province, 1 AS is_partner
            FROM partner_schools p
            WHERE p.is_active = 1 AND (
                p.school_name LIKE ?
        ";
        $partnerParams = ['%' . $cleanTerm . '%'];

        // Kata-kata inti/signifikan
        $meaningfulWords = array_values(array_filter($words, function($w) {
            return mb_strlen($w) >= 3 && !in_array(mb_strtoupper($w, 'UTF-8'), ['SD', 'SMP', 'SDS', 'SDN', 'SMPN', 'SMPS', 'SMA', 'SMAS', 'SMAN', 'IT', 'ISLAM', 'PLUS', 'NEGERI', 'SWASTA']);
        }));

        if (!empty($meaningfulWords)) {
            $wordLikes = [];
            foreach ($meaningfulWords as $mw) {
                $wordLikes[] = "p.school_name LIKE ?";
                $partnerParams[] = '%' . $mw . '%';
            }
            $partnerSql .= " OR (" . implode(' AND ', $wordLikes) . ")";
        }
        $partnerSql .= ") LIMIT 10";

        $stmtP = $pdo->prepare($partnerSql);
        $stmtP->execute($partnerParams);
        $partnerRows = $stmtP->fetchAll(PDO::FETCH_ASSOC);

        foreach ($partnerRows as $prow) {
            // Sinkronkan detail resmi dari national_schools jika ada
            $stmtN = $pdo->prepare("SELECT id, npsn, school_name, jenjang, city, province, 1 AS is_partner FROM national_schools WHERE npsn = ? LIMIT 1");
            $stmtN->execute([$prow['npsn']]);
            $natRow = $stmtN->fetch(PDO::FETCH_ASSOC);

            if ($natRow) {
                $seenNpsn[$natRow['npsn']] = true;
                $results[] = $natRow;
            } else {
                $seenNpsn[$prow['npsn']] = true;
                $prow['id'] = 0;
                $results[] = $prow;
            }
        }

        // 2. Pencarian di national_schools menggunakan FULLTEXT Index (Boolean Mode)
        $ftParts = [];
        $wordsToSearch = !empty($meaningfulWords) ? $meaningfulWords : $words;
        foreach ($wordsToSearch as $w) {
            if (mb_strlen($w) >= 2) {
                $ftParts[] = '+' . $w . '*';
            }
        }

        if (!empty($ftParts)) {
            $ftTerm = implode(' ', $ftParts);
            $stmtFT = $pdo->prepare("
                SELECT id, npsn, school_name, jenjang, city, province, is_partner
                FROM national_schools
                WHERE MATCH(school_name) AGAINST(? IN BOOLEAN MODE)
                ORDER BY is_partner DESC, school_name ASC
                LIMIT 20
            ");
            $stmtFT->execute([$ftTerm]);
            $ftRows = $stmtFT->fetchAll(PDO::FETCH_ASSOC);

            foreach ($ftRows as $row) {
                if (!isset($seenNpsn[$row['npsn']])) {
                    $seenNpsn[$row['npsn']] = true;
                    $results[] = $row;
                }
            }
        }

        // 3. Fallback bila hasil masih sedikit (< 5): gunakan NATURAL LANGUAGE MODE
        // Menangani jika user menyertakan nama yayasan atau kata ekstra (misal: 'Strada Santo Petrus')
        if (count($results) < 5 && mb_strlen($cleanTerm) >= 3) {
            $stmtNL = $pdo->prepare("
                SELECT id, npsn, school_name, jenjang, city, province, is_partner,
                       MATCH(school_name) AGAINST(? IN NATURAL LANGUAGE MODE) AS rel
                FROM national_schools
                WHERE MATCH(school_name) AGAINST(? IN NATURAL LANGUAGE MODE)
                ORDER BY is_partner DESC, rel DESC
                LIMIT 15
            ");
            $stmtNL->execute([$cleanTerm, $cleanTerm]);
            $nlRows = $stmtNL->fetchAll(PDO::FETCH_ASSOC);
            foreach ($nlRows as $row) {
                if (!isset($seenNpsn[$row['npsn']])) {
                    $seenNpsn[$row['npsn']] = true;
                    $results[] = $row;
                }
            }
        }

        // 4. Fallback bila hasil masih sedikit (< 5) dan ada kata kunci spesifik
        if (count($results) < 5 && !empty($meaningfulWords)) {
            $likeConds = [];
            $likeBinds = [];
            foreach ($meaningfulWords as $mw) {
                $likeConds[] = "school_name LIKE ?";
                $likeBinds[] = '%' . $mw . '%';
            }
            $stmtLike = $pdo->prepare("
                SELECT id, npsn, school_name, jenjang, city, province, is_partner
                FROM national_schools
                WHERE (" . implode(' AND ', $likeConds) . ")
                ORDER BY is_partner DESC, school_name ASC
                LIMIT 15
            ");
            $stmtLike->execute($likeBinds);
            $likeRows = $stmtLike->fetchAll(PDO::FETCH_ASSOC);
            foreach ($likeRows as $row) {
                if (!isset($seenNpsn[$row['npsn']])) {
                    $seenNpsn[$row['npsn']] = true;
                    $results[] = $row;
                }
            }
        }

        $results = array_slice($results, 0, 15);
    }

    send_json([
        'status' => 'ok',
        'query' => $q,
        'count' => count($results),
        'schools' => $results
    ]);
}

// 2. Registrasi Peserta Baru
if ($action === 'register') {
    $comp_id = (int)($_POST['competition_id'] ?? 1);

    // Verifikasi ketersediaan kompetisi dan batas penutupan pendaftaran
    $compStmt = $pdo->prepare("SELECT id, title, status, registration_end, general_fee FROM competitions WHERE id = ? LIMIT 1");
    $compStmt->execute([$comp_id]);
    $compRow = $compStmt->fetch();

    if (!$compRow) {
        send_json(['status' => 'error', 'message' => 'Data kompetisi tidak ditemukan.'], 404);
    }

    // Validasi penutupan otomatis (5 November 2026 pukul 23:59:59 WIB)
    $now = time();
    $regEndTimestamp = $compRow['registration_end'] ? strtotime($compRow['registration_end'] . ' 23:59:59') : 0;
    if ($compRow['status'] === 'closed' || ($regEndTimestamp > 0 && $now > $regEndTimestamp)) {
        send_json([
            'status' => 'error',
            'message' => 'Mohon maaf, periode pendaftaran Erlass Competition 2026 telah resmi berakhir pada 5 November 2026 pukul 23:59 WIB.'
        ], 403);
    }
    
    $nama_lengkap    = trim($_POST['nama_lengkap'] ?? '');
    $jenis_kelamin   = trim($_POST['jenis_kelamin'] ?? '');
    $tanggal_lahir   = trim($_POST['tanggal_lahir'] ?? '');
    $usia            = (int)($_POST['usia'] ?? 0);
    $kelas           = trim($_POST['kelas'] ?? '');
    $grade_category  = trim($_POST['grade_category'] ?? '');
    $nomor_telepon   = trim($_POST['nomor_telepon'] ?? '');
    $alamat          = trim($_POST['alamat'] ?? '');
    $status_siswa    = trim($_POST['status_siswa'] ?? '');
    $status_kemitraan= trim($_POST['status_kemitraan'] ?? '');
    $cabang          = trim($_POST['cabang_kompetisi'] ?? '');
    $wilayah         = trim($_POST['wilayah'] ?? '');
    $nama_sekolah    = trim($_POST['nama_sekolah'] ?? '');
    $npsn            = trim($_POST['npsn'] ?? '');

    // Fallback otomatis grade_category bila kosong
    if (empty($grade_category)) {
        if (in_array($kelas, ['Kelas 1', 'Kelas 2', 'Kelas 3'])) {
            $grade_category = 'Kelas 1-3';
        } elseif (in_array($kelas, ['Kelas 4', 'Kelas 5', 'Kelas 6'])) {
            $grade_category = 'Kelas 4-6';
        } elseif (in_array($kelas, ['Kelas 7', 'Kelas 8', 'Kelas 9'])) {
            $grade_category = 'SMP 7-9';
        } else {
            $grade_category = 'Kelas 4-6';
        }
    }

    // Validasi input penting
    if (!$nama_lengkap || !$jenis_kelamin || !$tanggal_lahir || !$kelas || !$nomor_telepon || !$cabang || !$nama_sekolah) {
        send_json(['status' => 'error', 'message' => 'Mohon lengkapi seluruh field pendaftaran yang bertanda wajib.'], 422);
    }

    // Tentukan apakah pelanggan Erlass (Gratis) atau Umum
    // Verifikasi otomatis fail-safe dari national_schools DAN partner_schools
    $is_partner = 0;
    if ($npsn !== '') {
        $chkStmt = $pdo->prepare("
            SELECT n.is_partner, n.city, p.id AS partner_id
            FROM national_schools n
            LEFT JOIN partner_schools p ON (p.school_code = n.npsn AND p.is_active = 1)
            WHERE n.npsn = ? OR p.school_code = ?
            LIMIT 1
        ");
        $chkStmt->execute([$npsn, $npsn]);
        $chkRow = $chkStmt->fetch();
        if ($chkRow) {
            if ((int)$chkRow['is_partner'] === 1 || !empty($chkRow['partner_id'])) {
                $is_partner = 1;
            }
            if (!empty($chkRow['city'])) {
                $wilayah = $chkRow['city'];
            }
        }
    }

    // Fallback cek langsung dari nama sekolah di partner_schools jika NPSN kosong
    if (!$is_partner && $nama_sekolah !== '') {
        $cleanSchool = trim(preg_replace('/[^\p{L}\p{N}]+/u', ' ', $nama_sekolah));
        $chkNameStmt = $pdo->prepare("SELECT id FROM partner_schools WHERE (school_name LIKE ? OR ? LIKE CONCAT('%', school_name, '%')) AND is_active = 1 LIMIT 1");
        $chkNameStmt->execute(['%' . $cleanSchool . '%', $nama_sekolah]);
        if ($chkNameStmt->fetch()) {
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
    $fee = isset($compRow['general_fee']) ? (float)$compRow['general_fee'] : 75000.00;

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

    // Ambil sequence tertinggi yang pernah ada (bukan COUNT agar tidak bentrok jika ada data yang dihapus)
    $stmtMax = $pdo->prepare("SELECT MAX(CAST(SUBSTRING_INDEX(reg_code, '-', -1) AS UNSIGNED)) AS max_seq FROM registrations WHERE reg_code LIKE ?");
    $stmtMax->execute([$codePrefix . '-%']);
    $maxSeq = (int)($stmtMax->fetch()['max_seq'] ?? 0);
    $nextSeq = $maxSeq + 1;

    $maxAttempts = 10;
    $inserted = false;
    $finalRegCode = '';

    for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
        $finalRegCode = sprintf("%s-%04d", $codePrefix, $nextSeq + $attempt);

        $sql = "INSERT INTO registrations (
            competition_id, reg_code, participant_name, gender, birth_date, age, grade,
            phone, address, student_status, partnership_status, is_partner,
            branch, grade_category, region, school_name, npsn, payment_amount, payment_proof, payment_status,
            created_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            NOW()
        )";

        try {
            $stmtInsert = $pdo->prepare($sql);
            $stmtInsert->execute([
                $comp_id, $finalRegCode, $nama_lengkap, $jenis_kelamin, $tanggal_lahir, $usia, $kelas,
                $nomor_telepon, $alamat, $status_siswa, $status_kemitraan, $is_partner,
                $cabang, $grade_category, $wilayah, $nama_sekolah, $npsn, $payment_amount, $payment_proof_filename, $payment_status
            ]);
            $inserted = true;
            break;
        } catch (PDOException $e) {
            // Jika bentrok unique key pada reg_code (1062), coba nomor sequence berikutnya
            if ($e->getCode() == 23000 || (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1062)) {
                continue;
            }
            send_json(['status' => 'error', 'message' => 'Terjadi kendala saat menyimpan pendaftaran: ' . $e->getMessage()], 500);
        }
    }

    if (!$inserted) {
        send_json(['status' => 'error', 'message' => 'Gagal membuat nomor pendaftaran unik. Silakan coba kembali beberapa saat lagi.'], 500);
    }

    send_json([
        'status' => 'ok',
        'message' => 'Pendaftaran berhasil dikirim!',
        'data' => [
            'reg_code' => $finalRegCode,
            'participant_name' => $nama_lengkap,
            'school_name' => $nama_sekolah,
            'npsn' => $npsn,
            'branch' => $cabang,
            'is_partner' => (bool)$is_partner,
            'payment_status' => $payment_status,
            'phone' => $nomor_telepon
        ]
    ]);
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

// 3b. Verifikasi & Pemulihan ID Peserta (Privat & Multi-Faktor)
if ($action === 'recover_participant_id') {
    $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    if (strpos($clientIp, ',') !== false) {
        $parts = explode(',', $clientIp);
        $clientIp = trim($parts[0]);
    }

    $rateLimitKey = 'rl:recover_id:' . hash('sha256', $clientIp);
    $maxAttempts = 5;
    $windowSeconds = 900; // 15 menit

    $redis = null;
    $attempts = 0;
    try {
        $redis = new Redis();
        if (@$redis->connect('127.0.0.1', 6379, 0.5)) {
            $attempts = (int)$redis->get($rateLimitKey);
            if ($attempts >= $maxAttempts) {
                $ttl = $redis->ttl($rateLimitKey);
                $minutes = max(1, ceil($ttl / 60));
                send_json([
                    'status' => 'error',
                    'code' => 'RATE_LIMITED',
                    'message' => "Terlalu banyak percobaan verifikasi identitas yang gagal dari perangkat Anda. Demi menjaga privasi data peserta, silakan tunggu {$minutes} menit lagi atau hubungi panitia melalui WhatsApp."
                ], 429);
            }
        } else {
            $redis = null;
        }
    } catch (Exception $e) {
        $redis = null;
    }

    $nama = trim($_POST['participant_name'] ?? $_GET['participant_name'] ?? '');
    $tglLahir = trim($_POST['birth_date'] ?? $_GET['birth_date'] ?? '');
    $phone = trim($_POST['phone'] ?? $_GET['phone'] ?? '');

    if (empty($nama) || empty($tglLahir) || empty($phone)) {
        send_json([
            'status' => 'error',
            'message' => 'Mohon lengkapi seluruh field verifikasi: Nama Lengkap, Tanggal Lahir, dan Nomor WhatsApp.'
        ], 422);
    }

    // Normalisasi input
    $cleanNameInput = preg_replace('/[^a-z0-9]/', '', strtolower($nama));
    
    // Normalisasi tanggal lahir (dukung YYYY-MM-DD)
    $tglParsed = date_create($tglLahir);
    if (!$tglParsed) {
        send_json([
            'status' => 'error',
            'message' => 'Format tanggal lahir tidak valid. Gunakan format YYYY-MM-DD.'
        ], 422);
    }
    $birthDateDb = date_format($tglParsed, 'Y-m-d');

    // Normalisasi nomor telepon
    $cleanPhoneDigits = preg_replace('/[^0-9]/', '', $phone);
    if (strpos($cleanPhoneDigits, '62') === 0) {
        $cleanPhoneDigits = '0' . substr($cleanPhoneDigits, 2);
    }

    // Cari kandidat peserta berdasarkan tanggal lahir
    $stmt = $pdo->prepare("SELECT id, reg_code, participant_name, school_name, branch, grade_category, phone, birth_date, payment_status, is_partner 
                           FROM registrations 
                           WHERE birth_date = ? 
                           ORDER BY id DESC");
    $stmt->execute([$birthDateDb]);
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $matched = null;
    foreach ($candidates as $cand) {
        $dbPhoneDigits = preg_replace('/[^0-9]/', '', $cand['phone']);
        if (strpos($dbPhoneDigits, '62') === 0) {
            $dbPhoneDigits = '0' . substr($dbPhoneDigits, 2);
        }

        // Pencocokan nomor telepon (persis atau 8 digit terakhir cocok)
        $phoneMatch = ($dbPhoneDigits === $cleanPhoneDigits) || 
                      (strlen($cleanPhoneDigits) >= 8 && strlen($dbPhoneDigits) >= 8 && substr($dbPhoneDigits, -8) === substr($cleanPhoneDigits, -8));

        // Pencocokan nama (case-insensitive, abaikan spasi & tanda baca)
        $cleanDbName = preg_replace('/[^a-z0-9]/', '', strtolower($cand['participant_name']));
        $nameMatch = (strpos($cleanDbName, $cleanNameInput) !== false || strpos($cleanNameInput, $cleanDbName) !== false);

        if ($phoneMatch && $nameMatch) {
            $matched = $cand;
            break;
        }
    }

    if (!$matched) {
        // Catat kegagalan ke rate limiter
        if ($redis) {
            $redis->incr($rateLimitKey);
            if ($attempts === 0) {
                $redis->expire($rateLimitKey, $windowSeconds);
            }
        }

        send_json([
            'status' => 'error',
            'message' => 'Data identitas tidak cocok dengan pendaftaran mana pun. Pastikan Nama Lengkap, Tanggal Lahir, dan Nomor WhatsApp sesuai persis dengan saat Anda mendaftar.'
        ], 404);
    }

    // Jika berhasil, reset rate limiter IP
    if ($redis) {
        $redis->del($rateLimitKey);
    }

    // Buat nomor telepon tersamar (masked) untuk keamanan
    $rawPhone = $matched['phone'];
    $phoneLen = strlen($rawPhone);
    if ($phoneLen >= 8) {
        $maskedPhone = substr($rawPhone, 0, 4) . '****' . substr($rawPhone, -4);
    } else {
        $maskedPhone = substr($rawPhone, 0, 2) . '****';
    }

    send_json([
        'status' => 'ok',
        'message' => 'Identitas peserta berhasil diverifikasi.',
        'data' => [
            'reg_code' => $matched['reg_code'],
            'participant_name' => $matched['participant_name'],
            'school_name' => $matched['school_name'],
            'branch' => $matched['branch'],
            'grade_category' => $matched['grade_category'] ?: 'Kelas 4-6',
            'payment_status' => $matched['payment_status'],
            'is_partner' => (bool)$matched['is_partner'],
            'masked_phone' => $maskedPhone
        ]
    ]);
}

// 4. Lookup Peserta untuk Form Pengumpulan Proyek
if ($action === 'lookup_project_participant') {
    $reg_code = strtoupper(trim($_POST['reg_code'] ?? $_GET['reg_code'] ?? ''));
    $nama = trim($_POST['participant_name'] ?? $_GET['participant_name'] ?? '');

    if (empty($reg_code)) {
        send_json(['status' => 'error', 'message' => 'Masukkan ID Peserta (Nomor Registrasi).'], 422);
    }

    $stmt = $pdo->prepare("SELECT id, reg_code, participant_name, gender, grade, grade_category, phone, branch, school_name, npsn, payment_status, is_partner FROM registrations WHERE UPPER(TRIM(reg_code)) = ? LIMIT 1");
    $stmt->execute([$reg_code]);
    $participant = $stmt->fetch();

    if (!$participant) {
        send_json(['status' => 'error', 'message' => "ID Peserta '{$reg_code}' tidak ditemukan. Mohon periksa kembali nomor registrasi Anda."], 404);
    }

    // Jika nama dimasukkan, verifikasi kecocokan nama (case-insensitive)
    if (!empty($nama)) {
        $cleanInput = preg_replace('/[^a-zA-Z0-9]/', '', strtolower($nama));
        $cleanDb = preg_replace('/[^a-zA-Z0-9]/', '', strtolower($participant['participant_name']));
        if (strpos($cleanDb, $cleanInput) === false && strpos($cleanInput, $cleanDb) === false) {
            send_json(['status' => 'error', 'message' => 'Nama peserta tidak cocok dengan data pendaftaran untuk ID tersebut.'], 422);
        }
    }

    // Verifikasi status pembayaran: harus verified atau is_partner = 1
    if ($participant['payment_status'] !== 'verified' && (int)$participant['is_partner'] !== 1) {
        send_json([
            'status' => 'error',
            'code' => 'PAYMENT_PENDING',
            'message' => 'Status pendaftaran Anda saat ini masih Menunggu Verifikasi Pembayaran. Pengumpulan proyek hanya dapat dilakukan setelah pendaftaran Anda diverifikasi oleh panitia.',
            'participant' => [
                'reg_code' => $participant['reg_code'],
                'participant_name' => $participant['participant_name'],
                'school_name' => $participant['school_name'],
                'branch' => $participant['branch'],
                'payment_status' => $participant['payment_status']
            ]
        ], 403);
    }

    // Cek apakah sudah pernah mengumpulkan proyek
    $stmtSub = $pdo->prepare("SELECT * FROM project_submissions WHERE UPPER(TRIM(reg_code)) = ? LIMIT 1");
    $stmtSub->execute([$reg_code]);
    $submission = $stmtSub->fetch();

    send_json([
        'status' => 'ok',
        'participant' => [
            'id' => $participant['id'],
            'reg_code' => $participant['reg_code'],
            'participant_name' => $participant['participant_name'],
            'school_name' => $participant['school_name'],
            'branch' => $participant['branch'],
            'grade' => $participant['grade'],
            'grade_category' => $participant['grade_category'] ?: 'Kelas 1-3'
        ],
        'has_submitted' => !empty($submission),
        'submission' => $submission ?: null,
        'allow_revision' => $submission ? (int)$submission['allow_revision'] : 0
    ]);
}

// 5. Submit atau Revisi Proyek Peserta
if ($action === 'submit_project') {
    date_default_timezone_set('Asia/Jakarta');
    $deadline = strtotime('2026-11-21 23:59:59');
    $now = time();

    $reg_code = strtoupper(trim($_POST['reg_code'] ?? ''));
    $nama = trim($_POST['participant_name'] ?? '');
    $grade_category = trim($_POST['grade_category'] ?? '');
    $project_title = trim($_POST['project_title'] ?? '');
    $project_description = trim($_POST['project_description'] ?? '');
    $video_url = trim($_POST['video_url'] ?? '');
    $backup_video_url = trim($_POST['backup_video_url'] ?? '');

    $statement_originality = !empty($_POST['statement_originality']) ? 1 : 0;
    $agree_disqualification = !empty($_POST['agree_disqualification']) ? 1 : 0;
    $agree_video_active = !empty($_POST['agree_video_active']) ? 1 : 0;
    $confirm_completeness = !empty($_POST['confirm_completeness']) ? 1 : 0;
    $agree_documentation = !empty($_POST['agree_documentation']) ? 1 : 0;

    if (empty($reg_code) || empty($project_title) || empty($project_description) || empty($video_url) || empty($grade_category)) {
        send_json(['status' => 'error', 'message' => 'Mohon lengkapi seluruh field wajib pengumpulan proyek.'], 422);
    }

    // Validasi 5 checkbox wajib
    if (!$statement_originality || !$agree_disqualification || !$agree_video_active || !$confirm_completeness || !$agree_documentation) {
        send_json(['status' => 'error', 'message' => 'Anda wajib menyetujui seluruh 5 poin pernyataan dan konfirmasi sebelum mengirim proyek.'], 422);
    }

    // Cari pendaftar
    $stmt = $pdo->prepare("SELECT * FROM registrations WHERE UPPER(TRIM(reg_code)) = ? LIMIT 1");
    $stmt->execute([$reg_code]);
    $participant = $stmt->fetch();

    if (!$participant) {
        send_json(['status' => 'error', 'message' => 'Data pendaftar tidak ditemukan.'], 404);
    }

    if ($participant['payment_status'] !== 'verified' && (int)$participant['is_partner'] !== 1) {
        send_json(['status' => 'error', 'message' => 'Pengumpulan proyek hanya dapat dilakukan setelah pembayaran pendaftaran terverifikasi.'], 403);
    }

    // Cek apakah sudah pernah submit
    $stmtSub = $pdo->prepare("SELECT * FROM project_submissions WHERE UPPER(TRIM(reg_code)) = ? LIMIT 1");
    $stmtSub->execute([$reg_code]);
    $existing = $stmtSub->fetch();

    if ($existing) {
        // Jika sudah pernah submit, periksa apakah izin revisi aktif
        if ((int)$existing['allow_revision'] !== 1) {
            send_json(['status' => 'error', 'message' => 'Proyek Anda sudah berhasil dikumpulkan dan terkunci. Untuk melakukan perbaikan/revisi, silakan hubungi panitia untuk mengaktifkan izin revisi.'], 403);
        }
    } else {
        // Jika submission baru dan sudah lewat deadline
        if ($now > $deadline) {
            send_json(['status' => 'error', 'message' => 'Batas waktu pengumpulan proyek telah berakhir pada 21 November 2026.'], 403);
        }
    }

    $branch = $participant['branch'];
    $isScratch = (stripos($branch, 'Scratch') !== false);
    $isMicrobit = (stripos($branch, 'Micro') !== false);
    $isErboblox = (stripos($branch, 'Erboblox') !== false);

    // Clean participant name for file naming
    $cleanName = preg_replace('/[^a-zA-Z0-9]+/', '_', trim($participant['participant_name']));
    $cleanName = trim($cleanName, '_');

    // Tentukan prefix kategori untuk nama file
    $catPrefix = 'Scratch';
    if ($isMicrobit) $catPrefix = 'Microbit';
    if ($isErboblox) $catPrefix = 'Erboblox';

    $project_file_path = $existing ? $existing['project_file_path'] : null;
    $project_file_name = $existing ? $existing['project_file_name'] : null;
    $project_file_size = $existing ? $existing['project_file_size'] : null;

    // Handle Upload File (Wajib untuk Scratch & Microbit, tidak untuk Erboblox)
    if ($isScratch || $isMicrobit) {
        $hasUpload = isset($_FILES['project_file']) && $_FILES['project_file']['error'] === UPLOAD_ERR_OK;
        
        if (!$hasUpload && !$existing) {
            $expectedExt = $isScratch ? '.sb3' : '.hex';
            send_json(['status' => 'error', 'message' => "Berkas proyek wajib diunggah dengan format {$expectedExt}."], 422);
        }

        if ($hasUpload) {
            $file = $_FILES['project_file'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

            if ($isScratch && $ext !== 'sb3') {
                send_json(['status' => 'error', 'message' => 'Untuk cabang Scratch Coding/PictoBlox, berkas wajib berekstensi .sb3.'], 422);
            }
            if ($isMicrobit && $ext !== 'hex') {
                send_json(['status' => 'error', 'message' => 'Untuk cabang Micro:bit, berkas wajib berekstensi .hex.'], 422);
            }

            $maxBytes = 50 * 1024 * 1024; // 50MB
            if ($file['size'] > $maxBytes) {
                send_json(['status' => 'error', 'message' => 'Ukuran berkas melebihi batas maksimal 50 MB.'], 422);
            }

            // Standar penamaan proyek otomatis: [Kategori]_[IDPeserta]_[NamaPeserta].[ext]
            $uniqueTargetName = sprintf("%s_%s_%s.%s", $catPrefix, $reg_code, $cleanName, $ext);
            $upload_dir = __DIR__ . '/../uploads/projects';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0775, true);
            }

            $destPath = $upload_dir . '/' . $uniqueTargetName;
            if (!move_uploaded_file($file['tmp_name'], $destPath)) {
                send_json(['status' => 'error', 'message' => 'Gagal menyimpan berkas proyek di server.'], 500);
            }

            $project_file_path = 'uploads/projects/' . $uniqueTargetName;
            $project_file_name = $file['name'];
            $project_file_size = (int)$file['size'];
        }
    }

    if ($existing) {
        // Mode Revisi (Versi Baru)
        $newVersion = ((int)$existing['version']) + 1;
        $stmtUp = $pdo->prepare("
            UPDATE project_submissions SET
                grade_category = ?,
                project_title = ?,
                project_description = ?,
                project_file_path = ?,
                project_file_name = ?,
                project_file_size = ?,
                video_url = ?,
                backup_video_url = ?,
                statement_originality = ?,
                agree_disqualification = ?,
                agree_video_active = ?,
                confirm_completeness = ?,
                agree_documentation = ?,
                status = 'revised',
                allow_revision = 0,
                version = ?,
                last_revised_at = NOW()
            WHERE id = ?
        ");
        $stmtUp->execute([
            $grade_category, $project_title, $project_description,
            $project_file_path, $project_file_name, $project_file_size,
            $video_url, $backup_video_url,
            $statement_originality, $agree_disqualification, $agree_video_active, $confirm_completeness, $agree_documentation,
            $newVersion, $existing['id']
        ]);

        send_json([
            'status' => 'ok',
            'action' => 'revised',
            'version' => $newVersion,
            'message' => 'Revisi proyek Anda berhasil dikirim dan tersimpan di sistem.',
            'reg_code' => $reg_code,
            'submitted_at' => date('Y-m-d H:i:s')
        ]);
    } else {
        // Mode Submit Pertama Kali
        $stmtIns = $pdo->prepare("
            INSERT INTO project_submissions (
                registration_id, reg_code, participant_name, school_name, branch,
                grade_category, project_title, project_description,
                project_file_path, project_file_name, project_file_size,
                video_url, backup_video_url,
                statement_originality, agree_disqualification, agree_video_active,
                confirm_completeness, agree_documentation,
                status, allow_revision, version, submitted_at, created_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?,
                'submitted', 0, 1, NOW(), NOW()
            )
        ");
        $stmtIns->execute([
            $participant['id'], $reg_code, $participant['participant_name'], $participant['school_name'], $branch,
            $grade_category, $project_title, $project_description,
            $project_file_path, $project_file_name, $project_file_size,
            $video_url, $backup_video_url,
            $statement_originality, $agree_disqualification, $agree_video_active,
            $confirm_completeness, $agree_documentation
        ]);

        send_json([
            'status' => 'ok',
            'action' => 'submitted',
            'version' => 1,
            'message' => 'Proyek Anda berhasil dikumpulkan! Tanda terima resmi telah dibuat.',
            'reg_code' => $reg_code,
            'submitted_at' => date('Y-m-d H:i:s')
        ]);
    }
}

send_json(['status' => 'error', 'message' => 'Aksi tidak valid.'], 400);
