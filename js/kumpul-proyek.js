/**
 * Script Pengumpulan Proyek Resmi
 * Erlass Coding & Robotics Competition 2026
 */

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  initCountdown();
  initLookup();
  initUploadHandlers();
  initSubmissionForm();
  checkUrlParams();
});

// 1. Live Interactive Countdown to 21 November 2026 23:59:59 WIB
function initCountdown() {
  // 21 November 2026 23:59:59 GMT+7
  const deadline = new Date('2026-11-21T23:59:59+07:00').getTime();

  function update() {
    const now = new Date().getTime();
    const diff = deadline - now;

    if (diff <= 0) {
      document.getElementById('cd-days').textContent = '00';
      document.getElementById('cd-hours').textContent = '00';
      document.getElementById('cd-minutes').textContent = '00';
      document.getElementById('cd-seconds').textContent = '00';
      const statusEl = document.getElementById('countdown-status');
      if (statusEl) {
        statusEl.textContent = 'Batas Waktu Pengumpulan Telah Berakhir';
        statusEl.className = 'text-red-300 font-extrabold';
      }
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('cd-days').textContent = String(days).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cd-minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('cd-seconds').textContent = String(seconds).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// Global active participant & submission data
let activeParticipant = null;
let activeSubmission = null;

// 2. URL Parameters Auto-fill & Lookup
function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const reg = urlParams.get('reg');
  if (reg) {
    const regInput = document.getElementById('lookup-reg-code');
    if (regInput) {
      regInput.value = reg.trim().toUpperCase();
      // Fokus ke nama peserta agar peserta melengkapi namanya
      const nameInput = document.getElementById('lookup-name');
      if (nameInput) nameInput.focus();
    }
  }
}

// 3. Verifikasi Identitas Peserta
function initLookup() {
  const form = document.getElementById('lookup-form');
  const errorBox = document.getElementById('lookup-error-box');
  const btn = document.getElementById('btn-lookup');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    errorBox.innerHTML = '';

    const regCode = document.getElementById('lookup-reg-code').value.trim().toUpperCase();
    const name = document.getElementById('lookup-name').value.trim();

    if (!regCode || !name) {
      showLookupError('Silakan masukkan ID Peserta dan Nama Lengkap Anda.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Memverifikasi...';
    if (window.lucide) lucide.createIcons();

    try {
      const res = await fetch(`api/public.php?action=lookup_project_participant&reg_code=${encodeURIComponent(regCode)}&participant_name=${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.status === 'ok') {
        activeParticipant = data.participant;
        activeSubmission = data.submission;

        // Cek status pengumpulan
        if (data.has_submitted && !data.allow_revision) {
          // Sudah mengumpulkan dan terkunci
          renderReceipt(data.participant, data.submission);
        } else {
          // Belum mengumpulkan ATAU mode revisi aktif
          renderSubmissionForm(data.participant, data.submission, Boolean(data.allow_revision));
        }
      } else {
        showLookupError(data.message || 'Terjadi kesalahan saat memverifikasi data.');
      }
    } catch (err) {
      showLookupError('Gagal menghubungi server. Mohon periksa koneksi internet Anda.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i> <span>Verifikasi & Buka Formulir</span>';
      if (window.lucide) lucide.createIcons();
    }
  });

  function showLookupError(msg) {
    errorBox.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="alert-circle" class="w-4 h-4 text-red-600 shrink-0"></i><span>${msg}</span></div>`;
    errorBox.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

// 4. Render Bukti / Tanda Terima (Jika sudah mengumpulkan & terkunci)
function renderReceipt(participant, submission) {
  document.getElementById('lookup-card').classList.add('hidden');
  document.getElementById('submission-card').classList.add('hidden');
  const receiptCard = document.getElementById('receipt-card');
  receiptCard.classList.remove('hidden');

  document.getElementById('receipt-timestamp').textContent = `Waktu Pengumpulan: ${submission.submitted_at || '-'}`;
  document.getElementById('receipt-reg-code').textContent = participant.reg_code;
  document.getElementById('receipt-name').textContent = participant.participant_name;
  document.getElementById('receipt-school').textContent = participant.school_name;
  document.getElementById('receipt-branch').textContent = `${participant.branch} (${submission.grade_category || participant.grade_category || '-'})`;
  document.getElementById('receipt-version').textContent = `Versi ${submission.version || 1} ${submission.last_revised_at ? `(Direvisi: ${submission.last_revised_at})` : ''}`;
  document.getElementById('receipt-title').textContent = submission.project_title;
  document.getElementById('receipt-desc').textContent = submission.project_description;

  // Video Link Button
  const videoBtn = document.getElementById('receipt-video-btn');
  if (submission.video_url) {
    videoBtn.href = submission.video_url;
    videoBtn.classList.remove('hidden');
  } else {
    videoBtn.classList.add('hidden');
  }

  // File Download Button (jika ada file)
  const fileBtn = document.getElementById('receipt-file-btn');
  const fileText = document.getElementById('receipt-file-text');
  if (submission.project_file_path) {
    fileBtn.href = submission.project_file_path;
    fileText.textContent = `Unduh Berkas: ${submission.project_file_name || 'Berkas Proyek'}`;
    fileBtn.classList.remove('hidden');
  } else {
    fileBtn.classList.add('hidden');
  }

  receiptCard.scrollIntoView({ behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

// 5. Render Formulir Pengumpulan (Baru atau Mode Revisi)
function renderSubmissionForm(participant, existingSubmission, isRevision) {
  document.getElementById('lookup-card').classList.add('hidden');
  document.getElementById('receipt-card').classList.add('hidden');
  const submissionCard = document.getElementById('submission-card');
  submissionCard.classList.remove('hidden');

  // Set hidden inputs
  document.getElementById('sub-reg-code').value = participant.reg_code;
  document.getElementById('sub-participant-name').value = participant.participant_name;

  // Set display badges
  document.getElementById('disp-reg-code').textContent = participant.reg_code;
  document.getElementById('disp-name').textContent = participant.participant_name;
  document.getElementById('disp-school').textContent = participant.school_name;
  document.getElementById('disp-branch').textContent = participant.branch;

  // Auto-check Jenjang Lomba
  const defaultGradeCat = existingSubmission ? existingSubmission.grade_category : (participant.grade_category || 'Kelas 4-6');
  const gradeCatRadio = document.querySelector(`input[name="grade_category"][value="${defaultGradeCat}"]`);
  if (gradeCatRadio) gradeCatRadio.checked = true;

  // Dynamic layout for branch
  const isScratch = participant.branch.toLowerCase().includes('scratch');
  const isMicrobit = participant.branch.toLowerCase().includes('micro');
  const isErboblox = participant.branch.toLowerCase().includes('erboblox');

  const fileContainer = document.getElementById('file-upload-container');
  const erbobloxContainer = document.getElementById('erboblox-info-container');
  const uploadLabel = document.getElementById('upload-label-text');
  const formatHint = document.getElementById('upload-format-hint');
  const fileInput = document.getElementById('project_file');

  if (isErboblox) {
    fileContainer.classList.add('hidden');
    erbobloxContainer.classList.remove('hidden');
    fileInput.required = false;
  } else {
    fileContainer.classList.remove('hidden');
    erbobloxContainer.classList.add('hidden');

    if (isScratch) {
      uploadLabel.textContent = 'Upload File Proyek Scratch (.sb3)';
      formatHint.textContent = 'Format berkas wajib .sb3 (Maksimal 50 MB)';
      fileInput.accept = '.sb3';
      fileInput.required = !existingSubmission; // wajib jika baru
    } else if (isMicrobit) {
      uploadLabel.textContent = 'Upload File Proyek Micro:bit (.hex)';
      formatHint.textContent = 'Format berkas wajib .hex (Maksimal 15 MB)';
      fileInput.accept = '.hex';
      fileInput.required = !existingSubmission;
    }
  }

  // Handle Revision Mode
  const revisionBanner = document.getElementById('revision-notice-banner');
  const submitBtnText = document.getElementById('btn-submit-text');

  if (isRevision && existingSubmission) {
    revisionBanner.classList.remove('hidden');
    submitBtnText.textContent = `Kirim Revisi Proyek (Versi ${(existingSubmission.version || 1) + 1})`;

    // Pre-fill fields
    document.getElementById('project_title').value = existingSubmission.project_title || '';
    document.getElementById('project_description').value = existingSubmission.project_description || '';
    document.getElementById('video_url').value = existingSubmission.video_url || '';
    document.getElementById('backup_video_url').value = existingSubmission.backup_video_url || '';

    if (existingSubmission.project_file_name) {
      const fileInfo = document.getElementById('selected-file-info');
      const fileName = document.getElementById('selected-file-name');
      fileInfo.classList.remove('hidden');
      fileName.textContent = `File Saat Ini: ${existingSubmission.project_file_name} (Unggah baru jika ingin mengganti)`;
    }
  } else {
    revisionBanner.classList.add('hidden');
    submitBtnText.textContent = 'Kirim Proyek Sekarang';
  }

  submissionCard.scrollIntoView({ behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

// 6. File Upload Handlers (Drag & Drop)
function initUploadHandlers() {
  const dropzone = document.getElementById('project-dropzone');
  const fileInput = document.getElementById('project_file');
  const fileInfo = document.getElementById('selected-file-info');
  const fileName = document.getElementById('selected-file-name');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-orange-500', 'bg-orange-100/60');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-orange-500', 'bg-orange-100/60');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-orange-500', 'bg-orange-100/60');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleSelectedFile(fileInput.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleSelectedFile(fileInput.files[0]);
    }
  });

  function handleSelectedFile(file) {
    if (!file) return;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.classList.remove('hidden');
    fileName.textContent = `${file.name} (${sizeMb} MB)`;
    if (window.lucide) lucide.createIcons();
  }
}

// 7. Submission Form Handling
function initSubmissionForm() {
  const form = document.getElementById('submission-form');
  const errorBox = document.getElementById('submit-error-box');
  const submitBtn = document.getElementById('btn-submit-project');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    errorBox.innerHTML = '';

    const title = document.getElementById('project_title').value.trim();
    const desc = document.getElementById('project_description').value.trim();
    const videoUrl = document.getElementById('video_url').value.trim();
    const fileInput = document.getElementById('project_file');

    if (!title || !desc || !videoUrl) {
      showSubmitError('Mohon lengkapi judul proyek, deskripsi singkat, dan link video presentasi.');
      return;
    }

    // Validasi format link video
    if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be') && !videoUrl.includes('instagram.com')) {
      if (!confirm('Tautan video utama Anda bukan YouTube atau Instagram resmi. Apakah Anda yakin link ini dapat diakses secara publik oleh dewan juri?')) {
        return;
      }
    }

    // Konfirmasi sebelum kirim
    if (!confirm('Apakah seluruh data, berkas proyek, dan tautan video sudah benar? Setelah dikirim, pengumpulan berstatus final.')) {
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Mengirim Proyek...';
    if (window.lucide) lucide.createIcons();

    const formData = new FormData(form);

    try {
      const res = await fetch('api/public.php?action=submit_project', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.status === 'ok') {
        alert(data.message || 'Proyek Anda berhasil dikumpulkan!');
        // Refresh data dan tampilkan bukti
        const regCode = document.getElementById('sub-reg-code').value;
        const name = document.getElementById('sub-participant-name').value;
        const refRes = await fetch(`api/public.php?action=lookup_project_participant&reg_code=${encodeURIComponent(regCode)}&participant_name=${encodeURIComponent(name)}`);
        const refData = await refRes.json();
        if (refData.status === 'ok') {
          renderReceipt(refData.participant, refData.submission);
        } else {
          window.location.reload();
        }
      } else {
        showSubmitError(data.message || 'Gagal mengirim proyek.');
      }
    } catch (err) {
      showSubmitError('Terjadi kendala jaringan saat mengirim berkas. Mohon coba kembali.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> <span id="btn-submit-text">Kirim Proyek Sekarang</span>';
      if (window.lucide) lucide.createIcons();
    }
  });

  function showSubmitError(msg) {
    errorBox.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 shrink-0"></i><span>${msg}</span></div>`;
    errorBox.classList.remove('hidden');
    errorBox.scrollIntoView({ behavior: 'smooth' });
    if (window.lucide) lucide.createIcons();
  }
}
