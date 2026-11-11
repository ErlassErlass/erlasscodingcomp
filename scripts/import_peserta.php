<?php
/**
 * CLI Tool: Import Manual Peserta Lomba (Excel / CSV)
 * Erlass Competition 2026
 *
 * Penggunaan:
 *   php import_peserta.php <path-ke-file.xlsx-atau-.csv> [--dry-run]
 */

if (php_sapi_name() !== 'cli') {
    die("Script ini hanya dapat dijalankan melalui CLI (Command Line Interface).\n");
}

require_once __DIR__ . '/../api/db.php';

$args = array_slice($argv, 1);
if (empty($args)) {
    echo "===============================================================\n";
    echo "  IMPORT MANUAL PESERTA LOMBA - ERLASS COMPETITION 2026\n";
    echo "===============================================================\n";
    echo "Penggunaan:\n";
    echo "  php import_peserta.php <file_path.xlsx|csv> [--dry-run]\n\n";
    echo "Opsi:\n";
    echo "  --dry-run   Cek validitas data tanpa menyimpan ke database\n\n";
    echo "Contoh:\n";
    echo "  php import_peserta.php /var/www/erlass-competition/template_import_peserta.xlsx\n";
    echo "===============================================================\n";
    exit(1);
}

$filePath = null;
$dryRun = false;

foreach ($args as $arg) {
    if ($arg === '--dry-run') {
        $dryRun = true;
    } else {
        $filePath = $arg;
    }
}

if (!$filePath || !file_exists($filePath)) {
    die("Error: Berkas '{$filePath}' tidak ditemukan.\n");
}

$ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
if (!in_array($ext, ['xlsx', 'csv'])) {
    die("Error: Format berkas harus .xlsx atau .csv.\n");
}

echo "Memuat berkas: {$filePath} " . ($dryRun ? "[MODE SIMULASI / DRY-RUN]" : "") . "\n";

$rows = [];

if ($ext === 'xlsx') {
    // Gunakan helper python openpyxl untuk membaca sheet 'DATA PESERTA' atau sheet pertama
    $pyScript = <<<'PY'
import sys, json, openpyxl

file_path = sys.argv[1]
wb = openpyxl.load_workbook(file_path, data_only=True)
if 'DATA PESERTA' in wb.sheetnames:
    ws = wb['DATA PESERTA']
else:
    ws = wb.active

data = []
# Cari baris header (biasanya baris ke-4 atau baris pertama yang ada 'Nama')
header_row_idx = None
headers = []

for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
    vals = [str(c).strip() if c is not None else '' for c in row]
    if any('nama' in v.lower() for v in vals):
        header_row_idx = r_idx
        headers = vals
        break

if not header_row_idx:
    header_row_idx = 1
    headers = [str(c).strip() if c is not None else '' for c in next(ws.iter_rows(values_only=True))]

for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
    if r_idx <= header_row_idx:
        continue
    vals = [str(c).strip() if c is not None else '' for c in row]
    if not any(vals):
        continue
    # Baris contoh (baris 5-7) diabaikan jika nama adalah contoh bawaan
    nama = vals[1] if len(vals) > 1 else ''
    if nama in ['Ganendra Alkhalifi', 'Azka Arkananta', 'Clarissa Putri']:
        # Jika file adalah template murni, ini tetap bisa di-parse atau diabaikan jika argumen tertentu
        pass
    data.append(vals)

print(json.dumps({'headers': headers, 'rows': data}))
PY;

    $cmd = 'python3 -c ' . escapeshellarg($pyScript) . ' ' . escapeshellarg($filePath);
    $output = shell_exec($cmd);
    $res = json_decode($output, true);
    if (!$res || !isset($res['rows'])) {
        die("Error: Gagal membaca data dari berkas Excel.\n");
    }
    $rows = $res['rows'];
} else {
    // Parse CSV
    $handle = fopen($filePath, 'r');
    $headerFound = false;
    while (($data = fgetcsv($handle, 4096, ',')) !== false) {
        $vals = array_map('trim', $data);
        if (!$headerFound) {
            foreach ($vals as $v) {
                if (stripos($v, 'nama') !== false) {
                    $headerFound = true;
                    break;
                }
            }
            continue;
        }
        if (!array_filter($vals)) continue;
        $rows[] = $vals;
    }
    fclose($handle);
}

if (empty($rows)) {
    die("Tidak ada baris data peserta yang ditemukan dalam berkas ini.\n");
}

echo "Ditemukan " . count($rows) . " baris data untuk diproses.\n\n";

// Dapatkan kompetisi aktif (default id 1)
$compStmt = $pdo->query("SELECT id, title FROM competitions ORDER BY id ASC LIMIT 1");
$comp = $compStmt->fetch();
$compId = $comp ? $comp['id'] : 1;

// Siapkan penomoran reg_code berurutan
$monthYear = date('my'); // e.g. 1126
$codePrefix = 'E-' . $monthYear;

$stmtMax = $pdo->prepare("SELECT MAX(CAST(SUBSTRING_INDEX(reg_code, '-', -1) AS UNSIGNED)) AS max_seq FROM registrations WHERE reg_code LIKE ?");
$stmtMax->execute([$codePrefix . '-%']);
$maxSeq = (int)($stmtMax->fetch()['max_seq'] ?? 0);
$nextSeq = $maxSeq + 1;

$successCount = 0;
$skippedCount = 0;
$importedList = [];

foreach ($rows as $idx => $r) {
    $rowNum = $idx + 5; // Mengacu pada nomor baris di excel
    
    // Mapping kolom:
    // 0: No
    // 1: Nama Lengkap
    // 2: Jenis Kelamin
    // 3: Tanggal Lahir (YYYY-MM-DD)
    // 4: Usia
    // 5: No WhatsApp / HP
    // 6: Alamat Domisili
    // 7: Nama Sekolah
    // 8: NPSN
    // 9: Wilayah / Kota Sekolah
    // 10: Kelas
    // 11: Kategori Jenjang
    // 12: Cabang Lomba
    // 13: Status Kemitraan
    // 14: Judul Proyek (Opsional)
    // 15: Deskripsi Proyek
    // 16: Link Video Demo
    // 17: Nama Berkas Karya

    $nama = trim($r[1] ?? '');
    $gender = trim($r[2] ?? '');
    $tglLahir = trim($r[3] ?? '');
    $usia = (int)($r[4] ?? 0);
    $phone = trim($r[5] ?? '');
    $alamat = trim($r[6] ?? '');
    $sekolah = trim($r[7] ?? '');
    $npsn = trim($r[8] ?? '');
    $wilayah = trim($r[9] ?? '');
    $kelas = trim($r[10] ?? '');
    $gradeCategory = trim($r[11] ?? '');
    $cabang = trim($r[12] ?? '');
    $kemitraan = trim($r[13] ?? '');
    
    // Proyek (opsional)
    $judulProyek = trim($r[14] ?? '');
    $descProyek = trim($r[15] ?? '');
    $videoUrl = trim($r[16] ?? '');
    $fileKarya = trim($r[17] ?? '');

    // Lewati baris jika nama kosong
    if (empty($nama)) {
        continue;
    }

    // Normalisasi Gender
    if (stripos($gender, 'perempuan') !== false || stripos($gender, 'p') === 0 || stripos($gender, 'wanita') !== false) {
        $gender = 'Perempuan';
    } else {
        $gender = 'Laki-laki';
    }

    // Normalisasi Tanggal Lahir (YYYY-MM-DD)
    $tglParsed = date_create($tglLahir);
    if ($tglParsed) {
        $tglLahir = date_format($tglParsed, 'Y-m-d');
        if ($usia <= 0) {
            $now = new DateTime();
            $diff = $now->diff($tglParsed);
            $usia = $diff->y;
        }
    } else {
        $tglLahir = '2014-01-01'; // Fallback aman
        if ($usia <= 0) $usia = 12;
    }

    // Normalisasi Kelas & Grade Category
    if (empty($gradeCategory)) {
        if (preg_match('/[1-3]/', $kelas)) {
            $gradeCategory = 'Kelas 1-3';
        } elseif (preg_match('/[7-9]/', $kelas) || stripos($kelas, 'smp') !== false) {
            $gradeCategory = 'SMP 7-9';
        } else {
            $gradeCategory = 'Kelas 4-6';
        }
    }

    // Normalisasi Cabang
    if (stripos($cabang, 'micro') !== false) {
        $cabang = 'Micro:bit';
    } elseif (stripos($cabang, 'erboblox') !== false || stripos($cabang, 'robot') !== false || stripos($cabang, 'jimu') !== false) {
        $cabang = 'Erboblox Robotics';
    } else {
        $cabang = 'Scratch Coding';
    }

    // Cek Kemitraan Sekolah
    $isPartner = 0;
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
        if ($chkRow && ((int)$chkRow['is_partner'] === 1 || !empty($chkRow['partner_id']))) {
            $isPartner = 1;
            if (empty($wilayah) && !empty($chkRow['city'])) $wilayah = $chkRow['city'];
        }
    }

    if (!$isPartner && !empty($sekolah)) {
        $cleanSchool = trim(preg_replace('/[^\p{L}\p{N}]+/u', ' ', $sekolah));
        $chkNameStmt = $pdo->prepare("SELECT id FROM partner_schools WHERE (school_name LIKE ? OR ? LIKE CONCAT('%', school_name, '%')) AND is_active = 1 LIMIT 1");
        $chkNameStmt->execute(['%' . $cleanSchool . '%', $sekolah]);
        if ($chkNameStmt->fetch()) {
            $isPartner = 1;
        }
    }

    if (!$isPartner && stripos($kemitraan, 'mitra') !== false) {
        $isPartner = 1;
    }

    $paymentAmount = $isPartner ? 0.00 : 75000.00;
    $paymentStatus = 'verified'; // Admin manual import otomatis terverifikasi

    $regCode = sprintf("%s-%04d", $codePrefix, $nextSeq);

    echo sprintf("-> [%s] %s | %s (%s) | %s\n", $regCode, $nama, $sekolah, $cabang, $isPartner ? "MITRA" : "UMUM");

    if (!$dryRun) {
        // 1. Simpan ke tabel registrations
        $sqlReg = "INSERT INTO registrations (
            competition_id, reg_code, participant_name, gender, birth_date, age, grade,
            phone, address, student_status, partnership_status, is_partner,
            branch, grade_category, region, school_name, npsn, payment_amount, payment_proof, payment_status,
            admin_notes, created_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, 'Siswa Baru (Manual Import)', ?, ?,
            ?, ?, ?, ?, ?, ?, NULL, ?,
            'Diimport secara manual melalui Excel', NOW()
        )";
        
        $stmtReg = $pdo->prepare($sqlReg);
        $stmtReg->execute([
            $compId, $regCode, $nama, $gender, $tglLahir, $usia, $kelas,
            $phone, $alamat, $isPartner ? 'Sekolah Mitra' : 'Umum', $isPartner,
            $cabang, $gradeCategory, $wilayah, $sekolah, $npsn, $paymentAmount, $paymentStatus
        ]);
        $newRegId = $pdo->lastInsertId();

        // 2. Jika ada informasi karya/video, simpan ke project_submissions agar langsung bisa dinilai
        if (!empty($judulProyek) || !empty($videoUrl) || !empty($fileKarya)) {
            $maxSubId = (int)$pdo->query("SELECT MAX(id) FROM project_submissions")->fetchColumn();
            $assignedGroup = ($maxSubId % 4) + 1; // 1, 2, 3, 4 round-robin

            $sqlSub = "INSERT INTO project_submissions (
                registration_id, reg_code, participant_name, school_name, branch, grade_category, judge_group,
                project_title, project_description, project_file_name, project_file_path, video_url,
                statement_originality, agree_disqualification, agree_video_active, confirm_completeness, agree_documentation,
                status, submitted_at, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                1, 1, 1, 1, 1,
                'submitted', NOW(), NOW()
            )";
            $stmtSub = $pdo->prepare($sqlSub);
            $stmtSub->execute([
                $newRegId, $regCode, $nama, $sekolah, $cabang, $gradeCategory, $assignedGroup,
                !empty($judulProyek) ? $judulProyek : 'Karya Peserta ' . $nama,
                !empty($descProyek) ? $descProyek : 'Deskripsi proyek peserta',
                !empty($fileKarya) ? $fileKarya : null,
                !empty($fileKarya) ? 'uploads/projects/' . $fileKarya : null,
                !empty($videoUrl) ? $videoUrl : 'https://youtube.com'
            ]);
            echo "   * Proyek berhasil ditambahkan ke antrean Portal Penjurian (Kelompok Juri {$assignedGroup}).\n";
        }
    }

    $importedList[] = ['code' => $regCode, 'name' => $nama, 'school' => $sekolah, 'branch' => $cabang];
    $nextSeq++;
    $successCount++;
}

echo "\n===============================================================\n";
echo "RINGKASAN " . ($dryRun ? "[SIMULASI / DRY-RUN]" : "IMPORT SELESAI") . ":\n";
echo "Total Peserta Berhasil: {$successCount}\n";
echo "===============================================================\n";
if ($dryRun) {
    echo "Catatan: Ini adalah mode simulasi. Data belum disimpan ke database.\n";
    echo "Jalankan tanpa flag --dry-run untuk menyimpan data permanen.\n";
}

