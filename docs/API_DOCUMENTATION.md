# Dokumentasi API - Erlass Competition 2026

Seluruh komunikasi data klien dan server menggunakan antarmuka JSON berbasis HTTP/HTTPS.

---

## 1. Endpoint Publik (`api/public.php`)

Endpoint ini dapat diakses oleh publik tanpa memerlukan token autentikasi.

### `GET ?action=get_competition`
Mengambil konfigurasi aktif kompetisi, daftar cabang lomba (`branches`), status penutupan pendaftaran otomatis (`is_registration_closed`), dan daftar sekolah rekanan terstruktur (`schools_hierarchy`).
- **Parameter Opsional**: `slug`, `id`.
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "competition": {
      "id": 1,
      "slug": "erlass-competition-2026",
      "title": "Erlass Competition 2026",
      "registration_end": "2026-11-05",
      "is_registration_closed": true
    },
    "branches": [],
    "is_registration_closed": true,
    "schools_hierarchy": {}
  }
  ```

### `GET ?action=search_schools&q={query}`
Mencari data sekolah nasional (`national_schools`) maupun sekolah mitra (`partner_schools`) berdasarkan NPSN (angka) atau nama sekolah (minimal 2 karakter).
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "schools": [
      {
        "npsn": "20105028",
        "school_name": "SDS FAJAR INDAH",
        "jenjang": "SD",
        "city": "KOTA ADM. JAKARTA UTARA",
        "province": "DKI JAKARTA",
        "is_partner": 1
      }
    ]
  }
  ```

### `POST ?action=register` (`multipart/form-data`)
Mengirimkan data formulir pendaftaran peserta baru beserta bukti transfer pembayaran (otomatis terblokir dengan HTTP 403 setelah tanggal cutoff `registration_end`).
- **Fields**: `competition_id`, `nama_lengkap`, `jenis_kelamin`, `tanggal_lahir`, `usia`, `kelas`, `grade_category`, `nomor_telepon`, `alamat`, `status_siswa`, `status_kemitraan`, `cabang_kompetisi`, `wilayah`, `nama_sekolah`, `npsn`, `payment_proof` (File).
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "message": "Pendaftaran berhasil dikirim!",
    "reg_code": "E-1026-0605"
  }
  ```

### `GET ?action=check_status&query={reg_code}`
Mengecek status verifikasi pendaftaran peserta berdasarkan kode registrasi resmi (`E-XXXX-XXXX`).

### `POST ?action=recover_participant_id`
Pemulihan ID Peserta secara privat (*Lupa ID Peserta*) dengan memverifikasi 3 identitas rahasia peserta. Dilindungi **Rate Limiting Redis** (maksimal 5 percobaan gagal per IP dalam 15 menit; mengembalikan HTTP 429 `RATE_LIMITED` bila melebihi batas).
- **Fields**: `participant_name`, `birth_date` (`YYYY-MM-DD`), `phone`.
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "message": "Identitas peserta berhasil diverifikasi.",
    "data": {
      "reg_code": "E-1026-0605",
      "participant_name": "Azel Marcello",
      "school_name": "SD BINTANG KEJORA",
      "branch": "Scratch Coding",
      "grade_category": "Kelas 4-6",
      "payment_status": "verified",
      "is_partner": true,
      "masked_phone": "0812****1234"
    }
  }
  ```

### `GET ?action=lookup_project_participant&reg_code={reg_code}`
Memvalidasi kode registrasi peserta (harus `payment_status = 'verified'` atau `is_partner = 1`) dan mengecek apakah karya proyek sudah pernah dikirimkan sebelumnya sebelum membuka formulir `kumpul-proyek.html`.
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "participant": {
      "id": 944,
      "reg_code": "E-1126-0134",
      "participant_name": "Antoni",
      "school_name": "SDS FAJAR INDAH",
      "branch": "Scratch Coding",
      "grade": "Kelas 5",
      "grade_category": "Kelas 4-6"
    },
    "has_submitted": false,
    "submission": null,
    "allow_revision": 0
  }
  ```

### `POST ?action=submit_project` (`multipart/form-data`)
Mengirimkan (atau merevisi jika `allow_revision = 1`) karya proyek peserta. Pengumpulan baru dibatasi hingga **21 November 2026 pukul 23:59:59 WIB** dan otomatis menugaskan `judge_group` (1-4) secara *round-robin* untuk penjurian.
- **Fields**: `reg_code`, `participant_name`, `grade_category`, `project_title`, `project_description`, `video_url`, `backup_video_url` (opsional), `statement_originality`, `agree_disqualification`, `agree_video_active`, `confirm_completeness`, `agree_documentation`, `project_file` (Wajib `.sb3` untuk Scratch Coding / `.hex` untuk Micro:bit, maksimal 50 MB; tidak wajib untuk Erboblox Robotics).

---

## 2. Endpoint Administratif & Penjurian (`api/admin.php`)

Endpoint administratif memerlukan token sesi (`?token=...` atau header `Authorization: Bearer <token>`). Akun dengan role `juri` dibatasi hanya ke endpoint penjurian dan manajemen sandi mandiri.

### A. Autentikasi & Manajemen Akun
- **`POST ?action=login`**: Masuk menggunakan `username` dan `password` (`superadmin`, `panitia`, atau `juri`). Mengembalikan token sesi 64 karakter serta objek `user` (`id`, `username`, `full_name`, `role`, `judge_group`). Dilindungi proteksi *lockout* 15 menit setelah 5x gagal login.
- **`GET/POST ?action=logout`**: Menghapus token sesi aktif dari tabel `admin_sessions`.
- **`POST ?action=change_password`**: Mengubah kata sandi mandiri pengguna yang sedang login.
- **`GET ?action=get_users`**, **`POST ?action=create_user`**, **`POST ?action=toggle_user_status`**, **`POST ?action=delete_user`**, **`POST ?action=reset_user_password`** *(Khusus `superadmin`)*.

### B. Modul Panitia (`role: superadmin, panitia`)
- **`GET ?action=get_reports`**: Statistik ringkas pendaftar per cabang dan wilayah.
- **`GET ?action=get_registrations`**: Mengambil daftar seluruh pendaftar beserta filter & pencarian.
- **`POST ?action=update_status`**: Memperbarui status verifikasi peserta (`id`, `status` [`pending` | `verified` | `rejected`], `admin_notes`).
- **`POST ?action=delete_registration`**: Menghapus satu data pendaftar beserta berkas bukti pembayarannya.
- **`POST ?action=bulk_delete_registrations`**: Menghapus beberapa pendaftar sekaligus (`ids`: array integer).
- **`GET ?action=export_excel`** (atau **`GET ?action=export_csv`**): Mengunduh data seluruh peserta dalam format Microsoft Excel asli (`.xlsx`) dengan penataan tabel profesional (freeze panes baris header, auto-filter, auto-fit lebar kolom, dan tautan aktif / native hyperlink pada kolom `Link Bukti Pembayaran`). Mendukung parameter opsional `&format=csv` jika membutuhkan format teks mentah CSV (UTF-8 BOM).
- **`GET ?action=get_competitions`** & **`POST ?action=save_competition`**: Pengaturan event kompetisi multi-tahun.
- **`GET ?action=get_project_submissions`**: Mengambil daftar seluruh karya proyek yang terkumpul.
- **`POST ?action=toggle_project_revision`**: Membuka atau menutup izin revisi karya (`id`, `allow_revision`, `admin_notes`).
- **`GET ?action=export_project_submissions`**: Ekspor daftar karya terkumpul dalam format CSV.
- **`POST ?action=delete_project_submission`**: Menghapus data karya proyek peserta beserta berkas fisiknya.

### C. Modul Dewan Juri (`role: juri, panitia, superadmin`)
- **`GET ?action=get_judging_submissions`**:
  Mengambil antrian karya proyek dalam mode **Blind Review** (tanpa nama peserta, sekolah, HP, maupun wilayah).
  - **Isolasi Kelompok Juri (Opsi A)**: Jika role adalah `juri`, sistem otomatis memfilter hanya proyek dengan `p.judge_group` yang sesuai dengan kelompok juri yang login (Kelompok 1-4), dan menyertakan info `partner_name` pada `current_judge`. Untuk `superadmin`/`panitia`, tersedia parameter opsional `?judge_group=1..4`.
  - Parameter filter opsional: `branch`, `grade_category`, `status` (`all`, `scored`, `unscored`), `search`.
  - Berkas `.sb3` otomatis dianalisis struktur bloknya menggunakan `ZipArchive` (`scratch_summary`: `total_targets`, `total_blocks`, `sprites`).

- **`POST ?action=save_project_score`**:
  Menyimpan atau memperbarui penilaian karya peserta (maksimal 2 juri per proyek sesuai kelompok).
  - **Payload JSON**:
    ```json
    {
      "submission_id": 5,
      "score_presentation": 90,
      "score_logic": 85,
      "score_creativity": 80,
      "score_design": 85,
      "score_theme": 90,
      "bonus_score": 0,
      "technical_passed": 1,
      "judge_notes": "Presentasi jelas dan struktur program rapi."
    }
    ```
  - **Perhitungan Terbobot Resmi 2026 (Total 100%)**:
    - Presentasi & Pemahaman Proyek (`score_presentation`): **40%**
    - Logika & Cara Kerja Program (`score_logic`): **20%**
    - Kreativitas & Pengembangan Ide (`score_creativity`): **15%**
    - Fungsi & Keberhasilan Proyek (`score_design`): **15%**
    - Kesesuaian dengan Tema (`score_theme`): **10%**
    - Bonus Sensor Eksternal (`bonus_score`): **+0**, **+3**, atau **+5** poin *(khusus Micro:bit SD)*.
    - Verifikasi Wajib Sensor Eksternal (`technical_passed`): `1` / `0` *(khusus Micro:bit SMP)*.
    - **Formula**:
      `Total = MIN(100.0, ROUND((Presentasi * 0.40) + (Logika * 0.20) + (Kreativitas * 0.15) + (Fungsi * 0.15) + (Tema * 0.10) + bonus_score, 2))`

- **`GET ?action=get_judging_leaderboard&branch=&grade_category=&judge_group=&search=`**:
  Mengambil rekapitulasi nilai peringkat peserta berdasarkan rata-rata skor dewan juri (`AVG(total_score)`).
  - Mengembalikan `judge_group`, `judge_count` (0-2), rata-rata masing-masing kriteria (`avg_presentation`, `avg_logic`, `avg_creativity`, `avg_design`, `avg_theme`, `avg_bonus`), dan `final_score`.
  - **Jika diakses Dewan Juri (`juri`)**: Identitas `participant_name` dan `school_name` tetap disamarkan (*Dirahasiakan (Blind Review)*).
  - **Jika diakses Panitia / Superadmin**: Identitas peserta ditampilkan utuh beserta rincian per juri di array `judge_scores` (termasuk `bonus_score` dan `technical_passed`).

- **`GET ?action=export_judging_csv&branch=&grade_category=&judge_group=`**:
  Mengunduh Berita Acara Rekapitulasi Nilai Dewan Juri dalam format CSV (kolom Kelompok Juri, Status Jml Penilai `X/2`, Presentasi 40%, Logika 20%, Kreativitas 15%, Fungsi 15%, Tema 10%, Bonus Sensor, dan Nilai Akhir).

- **`GET ?action=stream_project_file&id={sub_id}&token={token}`**:
  Menyajikan aliran biner berkas proyek (`.sb3` / `.hex`) dengan header CORS (`Access-Control-Allow-Origin: *`) dan nama berkas bersih yang disamarkan (`Proyek_E-XXXX-XXXX.[ext]`).
