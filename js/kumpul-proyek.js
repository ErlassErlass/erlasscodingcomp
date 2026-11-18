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
  initFAQAccordion();
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
      const fileSize = document.getElementById('selected-file-size');
      const fileBadge = document.getElementById('selected-file-badge');
      if (fileInfo) fileInfo.classList.remove('hidden');
      if (fileName) fileName.textContent = `File Tersimpan: ${existingSubmission.project_file_name}`;
      if (fileSize && existingSubmission.project_file_size) {
        fileSize.textContent = `${(existingSubmission.project_file_size / (1024 * 1024)).toFixed(2)} MB`;
      }
      if (fileBadge) {
        fileBadge.textContent = 'Tersimpan di Server';
        fileBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700';
      }
    }
  } else {
    revisionBanner.classList.add('hidden');
    submitBtnText.textContent = 'Kirim Proyek Sekarang';
  }

  submissionCard.scrollIntoView({ behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

// 6. File Upload Handlers (Drag & Drop & Rich Preview)
function initUploadHandlers() {
  const dropzone = document.getElementById('project-dropzone');
  const dragOverlay = document.getElementById('dropzone-drag-overlay');
  const idleContent = document.getElementById('dropzone-idle-content');
  const fileInput = document.getElementById('project_file');
  const fileInfo = document.getElementById('selected-file-info');
  const fileName = document.getElementById('selected-file-name');
  const fileSize = document.getElementById('selected-file-size');
  const fileBadge = document.getElementById('selected-file-badge');
  const fileIcon = document.getElementById('selected-file-icon');
  const btnRemove = document.getElementById('btn-remove-selected-file');
  const errorBox = document.getElementById('submit-error-box');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', (e) => {
    // Hindari membuka dialog jika yang diklik adalah tombol remove
    if (e.target.closest('#btn-remove-selected-file')) return;
    fileInput.click();
  });

  if (btnRemove) {
    btnRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.value = '';
      if (fileInfo) fileInfo.classList.add('hidden');
      if (idleContent) idleContent.classList.remove('hidden');
      if (errorBox) errorBox.classList.add('hidden');
    });
  }

  let dragCounter = 0;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  dropzone.addEventListener('dragenter', (e) => {
    dragCounter++;
    if (dragOverlay) dragOverlay.classList.remove('hidden');
    dropzone.classList.add('scale-[1.02]', 'border-orange-500', 'ring-4', 'ring-orange-200/60', 'bg-orange-50/90');
    dropzone.classList.remove('border-orange-300', 'bg-orange-50/40');
  });

  dropzone.addEventListener('dragover', (e) => {
    if (dragOverlay && dragOverlay.classList.contains('hidden')) {
      dragOverlay.classList.remove('hidden');
    }
  });

  dropzone.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (dragOverlay) dragOverlay.classList.add('hidden');
      dropzone.classList.remove('scale-[1.02]', 'border-orange-500', 'ring-4', 'ring-orange-200/60', 'bg-orange-50/90');
      dropzone.classList.add('border-orange-300', 'bg-orange-50/40');
    }
  });

  dropzone.addEventListener('drop', (e) => {
    dragCounter = 0;
    if (dragOverlay) dragOverlay.classList.add('hidden');
    dropzone.classList.remove('scale-[1.02]', 'border-orange-500', 'ring-4', 'ring-orange-200/60', 'bg-orange-50/90');
    dropzone.classList.add('border-emerald-500', 'bg-emerald-50/70', 'ring-4', 'ring-emerald-200/50');

    setTimeout(() => {
      dropzone.classList.remove('border-emerald-500', 'bg-emerald-50/70', 'ring-4', 'ring-emerald-200/50');
      dropzone.classList.add('border-orange-300', 'bg-orange-50/40');
    }, 700);

    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      fileInput.files = dt.files;
      handleSelectedFile(fileInput.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleSelectedFile(fileInput.files[0]);
    }
  });

  function handleSelectedFile(file) {
    if (!file || !fileInfo) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const sizeBytes = file.size;
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const maxMb = 100;

    // Format tampilan ukuran (KB atau MB)
    const formattedSize = sizeBytes < 1024 * 1024 
      ? `${(sizeBytes / 1024).toFixed(1)} KB` 
      : `${sizeMb} MB`;

    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formattedSize;

    // Deteksi kesesuaian cabang lomba
    const branch = currentParticipant ? (currentParticipant.branch || '') : '';
    const isScratch = branch.toLowerCase().includes('scratch');
    const isMicrobit = branch.toLowerCase().includes('micro');

    let isValidExt = true;
    let extError = '';

    if (isScratch && ext !== 'sb3') {
      isValidExt = false;
      extError = 'Format harus .sb3 untuk Scratch';
    } else if (isMicrobit && ext !== 'hex') {
      isValidExt = false;
      extError = 'Format harus .hex untuk Micro:bit';
    }

    if (sizeBytes > maxMb * 1024 * 1024) {
      // Melebihi 100 MB
      if (idleContent) idleContent.classList.remove('hidden');
      fileInfo.className = 'mt-3 w-full max-w-md p-3.5 bg-red-50 border-2 border-red-300 rounded-2xl shadow-sm flex items-center justify-between gap-3 text-left animate-in fade-in duration-200';
      if (fileIcon) fileIcon.className = 'w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0';
      if (fileBadge) {
        fileBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-200 text-red-800';
        fileBadge.textContent = `Melebihi Batas 100 MB (${sizeMb} MB)`;
      }
      if (errorBox) {
        errorBox.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 shrink-0"></i><span>Ukuran berkas Anda (${sizeMb} MB) melebihi batas maksimal 100 MB. Mohon periksa kembali berkas proyek Anda.</span></div>`;
        errorBox.classList.remove('hidden');
      }
    } else if (!isValidExt) {
      // Ekstensi tidak sesuai
      if (idleContent) idleContent.classList.remove('hidden');
      fileInfo.className = 'mt-3 w-full max-w-md p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-sm flex items-center justify-between gap-3 text-left animate-in fade-in duration-200';
      if (fileIcon) fileIcon.className = 'w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0';
      if (fileBadge) {
        fileBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-200 text-amber-900';
        fileBadge.textContent = extError;
      }
    } else {
      // Valid & Siap Unggah
      if (idleContent) idleContent.classList.add('hidden');
      fileInfo.className = 'mt-2 w-full max-w-md p-3.5 bg-white border-2 border-emerald-400 rounded-2xl shadow-md flex items-center justify-between gap-3 text-left transition-all duration-300 scale-100';
      if (fileIcon) fileIcon.className = 'w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs';
      if (fileBadge) {
        fileBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1';
        fileBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span>Siap Diunggah</span>';
      }
      if (errorBox) errorBox.classList.add('hidden');
    }

    fileInfo.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

// Confetti Animation Controller
let confettiAnimationId = null;

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.add('hidden');
  }
}

function launchConfetti(durationMs = 3500) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  stopConfetti();

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.remove('hidden');

  const colors = ['#f97316', '#fbbf24', '#10b981', '#06b6d4', '#6366f1', '#ec4899', '#3b82f6'];
  const particleCount = 140;
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 220,
      y: canvas.height * 0.35 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      shape: Math.random() > 0.4 ? 'rect' : 'circle'
    });
  }

  const startTime = Date.now();

  function render() {
    const elapsed = Date.now() - startTime;
    if (elapsed > durationMs) {
      stopConfetti();
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const fadeFactor = elapsed > durationMs * 0.7 
      ? Math.max(0, 1 - (elapsed - durationMs * 0.7) / (durationMs * 0.3)) 
      : 1;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.32; // Gravity
      p.vx *= 0.985; // Air resistance
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.globalAlpha = p.opacity * fadeFactor;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    confettiAnimationId = requestAnimationFrame(render);
  }

  confettiAnimationId = requestAnimationFrame(render);
}

// Menampilkan Modal Selebrasi Sukses Pengumpulan Proyek
function showUploadSuccessModal(participant, submission) {
  const modal = document.getElementById('upload-success-modal');
  const card = document.getElementById('upload-success-card');
  const btnClose = document.getElementById('btn-close-success-modal');

  const regCodeEl = document.getElementById('success-modal-reg-code');
  const nameEl = document.getElementById('success-modal-name');
  const titleEl = document.getElementById('success-modal-title');
  const timeEl = document.getElementById('success-modal-time');

  if (regCodeEl) regCodeEl.textContent = participant.reg_code || '-';
  if (nameEl) nameEl.textContent = participant.participant_name || '-';
  if (titleEl) titleEl.textContent = submission.project_title || '-';
  if (timeEl) timeEl.textContent = submission.submitted_at || new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB';

  if (!modal) {
    renderReceipt(participant, submission);
    return;
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    if (card) {
      card.classList.remove('scale-95', 'opacity-0');
      card.classList.add('scale-100', 'opacity-100');
    }
  });

  launchConfetti(3500);

  const handleClose = () => {
    stopConfetti();
    if (card) {
      card.classList.remove('scale-100', 'opacity-100');
      card.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
      modal.classList.add('hidden');
      renderReceipt(participant, submission);
    }, 250);
  };

  if (btnClose) {
    btnClose.onclick = handleClose;
  }
}

// 7. Submission Form Handling (Real-time Upload Progress Bar via XHR)
function initSubmissionForm() {
  const form = document.getElementById('submission-form');
  const errorBox = document.getElementById('submit-error-box');
  const submitBtn = document.getElementById('btn-submit-project');

  // Komponen Progress Bar
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressPercent = document.getElementById('upload-progress-percent');
  const progressLabel = document.getElementById('upload-progress-label');
  const progressDetail = document.getElementById('upload-progress-detail');
  const progressStatus = document.getElementById('upload-progress-status');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (errorBox) {
      errorBox.classList.add('hidden');
      errorBox.innerHTML = '';
    }

    const title = document.getElementById('project_title').value.trim();
    const desc = document.getElementById('project_description').value.trim();
    const videoUrl = document.getElementById('video_url').value.trim();
    const fileInput = document.getElementById('project_file');

    if (!title || !desc || !videoUrl) {
      showSubmitError('Mohon lengkapi judul proyek, deskripsi singkat, dan link video presentasi.');
      return;
    }

    // Validasi ukuran client-side sebelum kirim
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const selectedFile = fileInput.files[0];
      if (selectedFile.size > 100 * 1024 * 1024) {
        showSubmitError(`Ukuran berkas (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 100 MB.`);
        return;
      }
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

    // Siapkan UI Upload & Progress Bar
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span id="btn-submit-text">Sedang Mengunggah (0%)...</span>';
    if (window.lucide) lucide.createIcons();

    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    const fileSizeTotal = hasFile ? fileInput.files[0].size : 0;
    const totalMbStr = (fileSizeTotal / (1024 * 1024)).toFixed(1);

    if (progressContainer) {
      progressContainer.classList.remove('hidden');
      if (progressBar) progressBar.style.width = '0%';
      if (progressPercent) progressPercent.textContent = '0%';
      if (progressLabel) progressLabel.textContent = hasFile ? 'Mengunggah berkas proyek...' : 'Menyimpan data proyek...';
      if (progressDetail) progressDetail.textContent = hasFile ? `0 MB / ${totalMbStr} MB` : 'Mengirim data...';
      if (progressStatus) progressStatus.textContent = 'Menghubungkan ke server...';
      progressContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const formData = new FormData(form);

    // Kirim via XMLHttpRequest untuk mendapatkan event onprogress byte-by-byte
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'api/public.php?action=submit_project', true);

    let lastLoaded = 0;
    let lastTime = Date.now();

    if (xhr.upload) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          // Tahan di 99% sampai respon server selesai diterima
          const pct = Math.min(Math.round((evt.loaded / evt.total) * 100), 99);
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressPercent) progressPercent.textContent = pct + '%';

          const loadedMb = (evt.loaded / (1024 * 1024)).toFixed(1);
          const totalMb = (evt.total / (1024 * 1024)).toFixed(1);
          if (progressDetail) progressDetail.textContent = `${loadedMb} MB / ${totalMb} MB`;

          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          if (timeDiff >= 0.4) {
            const bytesDiff = evt.loaded - lastLoaded;
            const speedKbs = (bytesDiff / timeDiff / 1024).toFixed(0);
            if (progressStatus) progressStatus.textContent = `${speedKbs} KB/s`;
            lastLoaded = evt.loaded;
            lastTime = now;
          }

          const btnText = document.getElementById('btn-submit-text');
          if (btnText) btnText.textContent = `Sedang Mengunggah (${pct}%)...`;

          if (evt.loaded >= evt.total) {
            if (progressBar) progressBar.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100%';
            if (progressLabel) progressLabel.textContent = 'Berkas selesai diunggah (100%)';
            if (progressStatus) progressStatus.textContent = 'Memverifikasi dan memproses di server...';
            if (btnText) btnText.textContent = 'Memverifikasi di Server...';
          }
        }
      };
    }

    xhr.onload = async () => {
      try {
        if (xhr.status === 413) {
          showSubmitError('Ukuran berkas proyek terlalu besar (melebihi batas maksimal 100 MB). Silakan periksa atau kompres aset di dalam proyek Anda.');
          if (progressContainer) progressContainer.classList.add('hidden');
          return;
        }

        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (parseErr) {
          showSubmitError(`Respon server tidak valid (Kode HTTP ${xhr.status}). Mohon hubungi panitia jika kendala berlanjut.`);
          if (progressContainer) progressContainer.classList.add('hidden');
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300 && data.status === 'ok') {
          if (progressBar) progressBar.style.width = '100%';
          if (progressPercent) progressPercent.textContent = '100%';
          if (progressStatus) progressStatus.textContent = 'Pengumpulan sukses!';

          // Ambil referensi data terkini dari server
          const regCode = document.getElementById('sub-reg-code').value;
          const name = document.getElementById('sub-participant-name').value;
          
          let refData = null;
          try {
            const refRes = await fetch(`api/public.php?action=lookup_project_participant&reg_code=${encodeURIComponent(regCode)}&participant_name=${encodeURIComponent(name)}`);
            refData = await refRes.json();
          } catch (fetchErr) {
            console.error('Lookup refresh error:', fetchErr);
          }

          const participantData = (refData && refData.status === 'ok' && refData.participant) ? refData.participant : {
            reg_code: regCode,
            participant_name: name,
            school_name: document.getElementById('disp-school') ? document.getElementById('disp-school').textContent : '',
            branch: document.getElementById('disp-branch') ? document.getElementById('disp-branch').textContent : ''
          };

          const submissionData = (refData && refData.status === 'ok' && refData.submission) ? refData.submission : {
            project_title: title,
            project_description: desc,
            video_url: videoUrl,
            submitted_at: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB'
          };

          // Tampilkan Animasi & Modal Selebrasi Sukses
          showUploadSuccessModal(participantData, submissionData);
        } else {
          showSubmitError(data.message || `Gagal mengirim proyek (Status: ${xhr.status}).`);
          if (progressContainer) progressContainer.classList.add('hidden');
        }
      } catch (err) {
        showSubmitError('Terjadi kendala saat memproses respons pengumpulan proyek.');
        if (progressContainer) progressContainer.classList.add('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> <span id="btn-submit-text">Kirim Proyek Sekarang</span>';
        if (window.lucide) lucide.createIcons();
      }
    };

    xhr.onerror = () => {
      showSubmitError('Terjadi kendala jaringan saat mengirim berkas. Mohon periksa koneksi internet Anda dan coba kembali.');
      if (progressContainer) progressContainer.classList.add('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> <span id="btn-submit-text">Kirim Proyek Sekarang</span>';
      if (window.lucide) lucide.createIcons();
    };

    xhr.ontimeout = () => {
      showSubmitError('Waktu pengunggahan habis (timeout). Koneksi internet terlalu lambat untuk mengirim berkas ini.');
      if (progressContainer) progressContainer.classList.add('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> <span id="btn-submit-text">Kirim Proyek Sekarang</span>';
      if (window.lucide) lucide.createIcons();
    };

    xhr.send(formData);
  });

  function showSubmitError(msg) {
    if (errorBox) {
      errorBox.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 shrink-0"></i><span>${msg}</span></div>`;
      errorBox.classList.remove('hidden');
      errorBox.scrollIntoView({ behavior: 'smooth' });
      if (window.lucide) lucide.createIcons();
    }
  }
}

// 6. Bantuan Lupa ID Peserta (Verifikasi Multi-Faktor Privat)
let recoveredParticipant = null;

function openForgotIdModal() {
  const modal = document.getElementById('forgot-id-modal');
  const formState = document.getElementById('forgot-id-form');
  const successState = document.getElementById('forgot-id-success');
  const errorBox = document.getElementById('forgot-id-error');

  if (modal) {
    modal.classList.remove('hidden');
    formState.classList.remove('hidden');
    successState.classList.add('hidden');
    errorBox.classList.add('hidden');
    errorBox.innerHTML = '';
    
    // Auto-fill nama dari input form jika ada
    const existingName = document.getElementById('lookup-name').value.trim();
    if (existingName) {
      document.getElementById('forgot-name').value = existingName;
    }
    
    document.getElementById('forgot-name').focus();
    if (window.lucide) lucide.createIcons();
  }
}

function closeForgotIdModal() {
  const modal = document.getElementById('forgot-id-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function submitForgotIdVerification(e) {
  e.preventDefault();
  const errorBox = document.getElementById('forgot-id-error');
  const btn = document.getElementById('btn-verify-forgot-id');

  errorBox.classList.add('hidden');
  errorBox.innerHTML = '';

  const name = document.getElementById('forgot-name').value.trim();
  const birthDate = document.getElementById('forgot-birth-date').value.trim();
  const phone = document.getElementById('forgot-phone').value.trim();

  if (!name || !birthDate || !phone) {
    errorBox.innerHTML = 'Mohon lengkapi seluruh field verifikasi.';
    errorBox.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Memverifikasi Identitas...';
  if (window.lucide) lucide.createIcons();

  try {
    const formData = new FormData();
    formData.append('action', 'recover_participant_id');
    formData.append('participant_name', name);
    formData.append('birth_date', birthDate);
    formData.append('phone', phone);

    const res = await fetch('api/public.php', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.status === 'ok' && data.data) {
      recoveredParticipant = data.data;

      // Render success card
      document.getElementById('found-reg-code').textContent = recoveredParticipant.reg_code;
      document.getElementById('found-name').textContent = recoveredParticipant.participant_name;
      document.getElementById('found-school').textContent = recoveredParticipant.school_name;
      document.getElementById('found-branch').textContent = `${recoveredParticipant.branch} (${recoveredParticipant.grade_category})`;
      document.getElementById('found-masked-phone').textContent = recoveredParticipant.masked_phone;
      
      const badgeStatus = document.getElementById('found-badge-status');
      if (recoveredParticipant.payment_status === 'verified' || recoveredParticipant.is_partner) {
        badgeStatus.className = 'inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800';
        badgeStatus.textContent = 'Terverifikasi (Siap Kumpul Proyek)';
      } else {
        badgeStatus.className = 'inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800';
        badgeStatus.textContent = 'Menunggu Verifikasi Pembayaran';
      }

      // Switch view to state 2
      document.getElementById('forgot-id-form').classList.add('hidden');
      document.getElementById('forgot-id-success').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    } else {
      errorBox.innerHTML = `<div class="flex items-start gap-2"><i data-lucide="alert-circle" class="w-4 h-4 text-red-600 shrink-0 mt-0.5"></i><span>${data.message || 'Verifikasi gagal.'}</span></div>`;
      errorBox.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    errorBox.innerHTML = '<div class="flex items-center gap-2"><i data-lucide="wifi-off" class="w-4 h-4 text-red-600 shrink-0"></i><span>Terjadi kendala koneksi ke server. Mohon coba beberapa saat lagi.</span></div>';
    errorBox.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i> <span>Verifikasi Identitas & Cari ID</span>';
    if (window.lucide) lucide.createIcons();
  }
}

function useFoundRegCode() {
  if (!recoveredParticipant) return;

  const regInput = document.getElementById('lookup-reg-code');
  const nameInput = document.getElementById('lookup-name');

  if (regInput && nameInput) {
    regInput.value = recoveredParticipant.reg_code;
    nameInput.value = recoveredParticipant.participant_name;
    closeForgotIdModal();

    // Trigger otomatis submit form verifikasi utama
    const lookupForm = document.getElementById('lookup-form');
    if (lookupForm) {
      lookupForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  }
}

// 8. FAQ Accordion, Category Filter & Live Search
function initFAQAccordion() {
  const faqSection = document.getElementById('faq-section');
  if (!faqSection) return;

  const toggles = faqSection.querySelectorAll('.faq-toggle');
  const items = faqSection.querySelectorAll('.faq-item');
  const filterBtns = faqSection.querySelectorAll('.faq-filter-btn');
  const searchInput = document.getElementById('faq-search-input');
  const searchClear = document.getElementById('faq-search-clear');
  const emptyState = document.getElementById('faq-empty-state');
  const btnResetSearch = document.getElementById('btn-reset-faq-search');

  let activeCategory = 'all';

  // Toggle Accordion Item
  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const item = toggle.closest('.faq-item');
      const answer = item.querySelector('.faq-answer');
      const chevron = item.querySelector('.faq-chevron');
      const isOpen = !answer.classList.contains('hidden');

      if (isOpen) {
        answer.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        item.classList.remove('border-orange-400', 'shadow-xs');
      } else {
        answer.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        item.classList.add('border-orange-400', 'shadow-xs');
      }
      if (window.lucide) lucide.createIcons();
    });
  });

  // Filter Logic
  function applyFilters() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let visibleCount = 0;

    items.forEach((item) => {
      const cat = item.getAttribute('data-category');
      const matchCat = (activeCategory === 'all' || cat === activeCategory);

      let matchQuery = true;
      if (query) {
        const text = item.innerText.toLowerCase();
        matchQuery = text.includes(query);
      }

      if (matchCat && matchQuery) {
        item.classList.remove('hidden');
        visibleCount++;
        // Otomatis buka jawaban jika sedang melakukan pencarian
        if (query) {
          const ans = item.querySelector('.faq-answer');
          const chev = item.querySelector('.faq-chevron');
          if (ans) ans.classList.remove('hidden');
          if (chev) chev.style.transform = 'rotate(180deg)';
        }
      } else {
        item.classList.add('hidden');
      }
    });

    if (emptyState) {
      if (visibleCount === 0) {
        emptyState.classList.remove('hidden');
      } else {
        emptyState.classList.add('hidden');
      }
    }

    if (searchClear) {
      if (query) {
        searchClear.classList.remove('hidden');
      } else {
        searchClear.classList.add('hidden');
      }
    }
  }

  // Category Filter Buttons
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.getAttribute('data-category') || 'all';

      // Update button active styling
      filterBtns.forEach((b) => {
        b.className = 'faq-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800';
      });
      btn.className = 'faq-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-orange-600 text-white shadow-sm';

      applyFilters();
    });
  });

  // Live Search Input
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      applyFilters();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      applyFilters();
    });
  }

  function resetSearch() {
    if (searchInput) searchInput.value = '';
    activeCategory = 'all';
    filterBtns.forEach((b) => {
      const isAll = (b.getAttribute('data-category') === 'all');
      b.className = isAll
        ? 'faq-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-orange-600 text-white shadow-sm'
        : 'faq-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800';
    });
    applyFilters();
  }

  if (btnResetSearch) {
    btnResetSearch.addEventListener('click', resetSearch);
  }

  window.resetFaqSearch = resetSearch;
}

window.openForgotIdModal = openForgotIdModal;
window.closeForgotIdModal = closeForgotIdModal;
window.submitForgotIdVerification = submitForgotIdVerification;
window.useFoundRegCode = useFoundRegCode;
