# Dokumentasi API - Erlass Competition 2026

Seluruh komunikasi data klien dan server menggunakan antarmuka JSON berbasis HTTP/HTTPS.

---

## 🌐 1. Endpoint Publik (`api/public.php`)

Endpoint ini dapat diakses oleh publik tanpa memerlukan token autentikasi.

### `GET ?action=get_config`
Mengambil konfigurasi aktif kompetisi (nama event, batas tanggal pendaftaran, biaya, dan status pembukaan pendaftaran).
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "competition": {
      "id": 1,
      "event_code": "ERLASS2026",
      "event_name": "Erlass Competition 2026",
      "registration_end": "2026-11-05",
      "is_active": 1,
      "is_registration_open": true
    }
  }
  ```

### `GET ?action=search_school&q={query}&province={prov}&city={city}&limit=20`
Mencari data sekolah nasional dari basis data 38 provinsi Kemdikbud.
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "count": 5,
    "schools": [
      {
        "npsn": "20101234",
        "name": "SD NEGERI 01 JAKARTA",
        "level": "SD",
        "status": "Negeri",
        "city": "KOTA JAKARTA PUSAT",
        "province": "DKI JAKARTA"
      }
    ]
  }
  ```

### `POST ?action=register` (Multipart Form Data)
Mengirimkan data formulir pendaftaran peserta baru beserta bukti transfer pembayaran.
- **Fields**: `full_name`, `email`, `phone`, `school_name`, `npsn`, `school_level`, `school_status`, `school_city`, `school_province`, `branch`, `grade_category`, `payment_proof` (File).
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "message": "Pendaftaran berhasil dikirim!",
    "reg_code": "E-1026-0605"
  }
  ```

### `GET ?action=check_registration_code&code={reg_code}`
Memvalidasi kode registrasi peserta sebelum pengumpulan karya proyek.
- **Respons Sukses (200)**:
  ```json
  {
    "status": "ok",
    "registration": {
      "reg_code": "E-1026-0605",
      "participant_name": "Azel Marcello",
      "branch": "Scratch Coding",
      "grade_category": "Kelas 4-6",
      "status": "verified"
    }
  }
  ```

### `POST ?action=submit_project` (Multipart Form Data)
Mengirimkan berkas karya proyek, sinopsis, dan tautan video presentasi.
- **Fields**: `reg_code`, `project_title`, `project_description`, `video_url`, `backup_video_url`, `project_file` (File `.sb3` atau `.hex`).

---

## 🔒 2. Endpoint Administratif & Penjurian (`api/admin.php`)

Endpoint administratif memerlukan token sesi (`?token=...` atau header `Authorization: Bearer <token>`).

### A. Autentikasi
- **`POST ?action=login`**: Masuk menggunakan username dan password (`superadmin`, `panitia`, atau `juri`). Mengembalikan session token 64 karakter.
- **`GET/POST ?action=logout`**: Menghapus token sesi aktif.
- **`POST ?action=change_password`**: Mengubah kata sandi mandiri pengguna yang sedang login.

### B. Modul Panitia (`role: superadmin, panitia`)
- **`GET ?action=get_registrations`**: Mengambil daftar seluruh pendaftar, pencarian, dan filter.
- **`POST ?action=verify_registration`**: Menyetujui (`approved`) atau menolak (`rejected`) verifikasi pendaftaran peserta.
- **`POST ?action=delete_registration`**: Menghapus satu pendaftar beserta berkas buktinya.
- **`POST ?action=bulk_delete_registrations`**: Menghapus beberapa pendaftar sekaligus (*batch delete*).
- **`GET ?action=export_csv`**: Mengunduh data seluruh peserta dalam format CSV/Excel.
- **`GET ?action=get_project_submissions`**: Mengambil daftar seluruh karya proyek yang terkumpul.
- **`POST ?action=toggle_project_revision`**: Membuka atau menutup izin revisi karya beserta catatan instruksi revisi.
- **`POST ?action=delete_project_submission`**: Menghapus data karya proyek peserta beserta berkas fisiknya.

### C. Modul Dewan Juri (`role: juri, superadmin`)
- **`GET ?action=get_judging_submissions`**:
  Mengambil antrian karya proyek yang **telah disanitasi secara ketat** (*Blind Review*).
  - Nama siswa, nama sekolah, nomor telepon, dan email tidak disertakan.
  - Kode peserta diformat: `Peserta #E-XXXX-XXXX`.
  - Berkas `.sb3` otomatis dianalisis struktur baloknya menggunakan `ZipArchive` (total blok, kostum, audio, dan rincian per sprite).
- **`POST ?action=save_project_score`**:
  Menyimpan atau memperbarui penilaian karya peserta.
  - **Payload JSON**:
    ```json
    {
      "submission_id": 2,
      "score_logic": 90,
      "score_creativity": 85,
      "score_theme": 95,
      "score_design": 88,
      "score_presentation": 92,
      "judge_notes": "Catatan evaluasi konstruktif juri..."
    }
    ```
  - **Perhitungan Terbobot Resmi (100%)**:
    `Total = (Logika * 0.3) + (Kreatif * 0.25) + (Tema * 0.2) + (Estetika * 0.15) + (Presentasi * 0.1)`
- **`GET ?action=get_judging_leaderboard&branch=&grade_category=`**:
  Mengambil rekapitulasi nilai peringkat peserta berdasarkan rata-rata skor dewan juri (`AVG(total_score)`). Identitas peserta disamarkan untuk juri.
- **`GET ?action=export_judging_csv&branch=&grade_category=`**:
  Mengunduh Berita Acara Rekapitulasi Nilai Dewan Juri dalam format CSV.
- **`GET ?action=stream_project_file&id={sub_id}`**:
  Menyajikan aliran biner berkas proyek dengan header CORS (`Access-Control-Allow-Origin: *`) dan nama berkas bersih yang disamarkan (`Proyek_E-XXXX-XXXX.sb3`).
