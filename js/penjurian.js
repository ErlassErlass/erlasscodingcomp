/**
 * Erlass Competition 2026 - Portal Penjurian Resmi (Blind Review)
 * Logika Client-Side Penjurian, Preview Balok Scratch / MakeCode, Video Player & Rubrik Penilaian
 * Light Theme Edition with Dynamic Filters, Real-Time Search, and Auto-Advance
 */

// Sesi & Auth State
let authToken = sessionStorage.getItem('erlass_admin_token') || localStorage.getItem('erlass_admin_token') || '';
let currentUser = JSON.parse(sessionStorage.getItem('erlass_admin_user') || localStorage.getItem('erlass_admin_user') || 'null');

// Data Submissions & Queue State
let allSubmissions = [];
let filteredSubmissions = [];
let currentIndex = -1;
let currentSubmission = null;

// Filter State
let currentStatusFilter = ''; // '', 'unscored', 'scored'

// Helper XSS Escaping
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 1. Inisialisasi & Verifikasi Autentikasi
async function checkJudgeAuth() {
  const authScreen = document.getElementById('auth-screen');
  const studio = document.getElementById('judging-studio');

  if (authToken) {
    try {
      const res = await fetch(`api/admin.php?action=get_judging_submissions&token=${encodeURIComponent(authToken)}`);
      const data = await res.json();
      
      if (data.status === 'ok') {
        if (data.current_judge) {
          currentUser = {
            id: data.current_judge.id,
            username: data.current_judge.name,
            full_name: data.current_judge.name,
            role: data.current_judge.role
          };
          sessionStorage.setItem('erlass_admin_user', JSON.stringify(currentUser));
        }

        authScreen.classList.add('hidden');
        studio.classList.remove('hidden');

        const judgeNameEl = document.getElementById('judge-display-name');
        if (judgeNameEl && currentUser) {
          judgeNameEl.textContent = currentUser.full_name || currentUser.username || 'Dewan Juri';
        }

        allSubmissions = data.submissions || [];
        applyFilters();
        if (window.lucide) lucide.createIcons();
        return;
      }
    } catch (err) {
      console.error('Auth verification failed:', err);
    }
  }

  // Jika sesi tidak valid, tampilkan login modal
  authToken = '';
  currentUser = null;
  sessionStorage.removeItem('erlass_admin_token');
  sessionStorage.removeItem('erlass_admin_user');
  authScreen.classList.remove('hidden');
  studio.classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

// 2. Handle Login Dewan Juri
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username-input').value.trim();
  const password = document.getElementById('password-input').value.trim();
  const errBox = document.getElementById('auth-error');
  const submitBtn = document.getElementById('login-submit-btn');

  errBox.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Memverifikasi...';
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('api/admin.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.status === 'ok') {
      authToken = data.token;
      currentUser = data.user;
      sessionStorage.setItem('erlass_admin_token', authToken);
      sessionStorage.setItem('erlass_admin_user', JSON.stringify(currentUser));
      
      await checkJudgeAuth();
    } else {
      errBox.textContent = data.message || 'Username atau password juri salah.';
      errBox.classList.remove('hidden');
    }
  } catch (err) {
    errBox.textContent = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
    errBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i><span>Masuk Ruang Penjurian</span>';
    if (window.lucide) lucide.createIcons();
  }
});

function togglePasswordVisibility() {
  const pInput = document.getElementById('password-input');
  const btn = document.getElementById('toggle-pwd-btn');
  if (pInput.type === 'password') {
    pInput.type = 'text';
    btn.innerHTML = '<i data-lucide="eye-off" class="w-4 h-4"></i>';
  } else {
    pInput.type = 'password';
    btn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>';
  }
  if (window.lucide) lucide.createIcons();
}

async function logoutJudge() {
  if (!confirm('Apakah Anda yakin ingin keluar dari Studio Penjurian?')) return;
  try {
    await fetch(`api/admin.php?action=logout&token=${encodeURIComponent(authToken)}`);
  } catch (e) {}
  sessionStorage.clear();
  localStorage.removeItem('erlass_admin_token');
  localStorage.removeItem('erlass_admin_user');
  window.location.reload();
}

// 3. Load & Filter Submissions
async function reloadSubmissions(preferredSelectId = null) {
  try {
    const res = await fetch(`api/admin.php?action=get_judging_submissions&token=${encodeURIComponent(authToken)}`);
    const data = await res.json();
    if (data.status === 'ok') {
      allSubmissions = data.submissions || [];
      applyFilters(preferredSelectId);
    }
  } catch (err) {
    console.error('Error reloading submissions:', err);
  }
}

function stopAllMedia() {
  const pIframe = document.getElementById('preview-iframe');
  const vIframe = document.getElementById('video-player-iframe');
  if (pIframe) pIframe.src = 'about:blank';
  if (vIframe) vIframe.src = 'about:blank';
}

function applyFilters(preferredSelectId = null) {
  const branchFilter = (document.getElementById('filter-branch')?.value || '').trim();
  const gradeFilter = (document.getElementById('filter-grade')?.value || '').trim();
  const searchFilter = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
  const sortFilter = (document.getElementById('filter-sort')?.value || 'unscored_first');

  // Toggle tombol Clear Search
  const btnClearSearch = document.getElementById('btn-clear-search');
  if (btnClearSearch) {
    if (searchFilter) btnClearSearch.classList.remove('hidden');
    else btnClearSearch.classList.add('hidden');
  }

  // Toggle tombol Reset All Filters
  const btnReset = document.getElementById('btn-reset-filters');
  const isAnyFilterActive = Boolean(branchFilter || gradeFilter || searchFilter || currentStatusFilter || sortFilter !== 'unscored_first');
  if (btnReset) {
    if (isAnyFilterActive) {
      btnReset.classList.remove('hidden');
      btnReset.classList.add('inline-flex');
    } else {
      btnReset.classList.add('hidden');
      btnReset.classList.remove('inline-flex');
    }
  }

  // 1. Base Pool yang sesuai Filter Cabang, Jenjang, dan Pencarian
  const baseList = allSubmissions.filter(s => {
    // Cabang: exact atau substring (Scratch Coding, Micro:bit, Erboblox Robotics)
    if (branchFilter) {
      const bStr = (s.branch || '').toLowerCase();
      const bFil = branchFilter.toLowerCase();
      if (bStr !== bFil && !bStr.includes(bFil)) return false;
    }

    // Jenjang: null-safe substring (Kelas 1-3, Kelas 4-6, SMP 7-9)
    if (gradeFilter) {
      const gStr = (s.grade_category || '').toLowerCase();
      const gFil = gradeFilter.toLowerCase();
      if (!gStr || (!gStr.includes(gFil) && !gFil.includes(gStr))) return false;
    }

    // Pencarian cepat (Kode Samaran / Reg Code / Judul Proyek)
    if (searchFilter) {
      const blindStr = (s.blind_code || '').toLowerCase();
      const regStr = (s.reg_code || '').toLowerCase();
      const titleStr = (s.project_title || '').toLowerCase();
      if (!blindStr.includes(searchFilter) && !regStr.includes(searchFilter) && !titleStr.includes(searchFilter)) {
        return false;
      }
    }

    return true;
  });

  // 2. Hitung statistik counter dinamis sesuai pool yang terfilter
  const countAll = baseList.length;
  const countUnscored = baseList.filter(s => !s.is_scored).length;
  const countScored = baseList.filter(s => s.is_scored).length;

  const countAllEl = document.getElementById('count-all');
  const countUnscoredEl = document.getElementById('count-unscored');
  const countScoredEl = document.getElementById('count-scored');
  if (countAllEl) countAllEl.textContent = countAll;
  if (countUnscoredEl) countUnscoredEl.textContent = countUnscored;
  if (countScoredEl) countScoredEl.textContent = countScored;

  // 3. Filter berdasarkan Status Tab (Semua / Belum Dinilai / Sudah Dinilai)
  filteredSubmissions = baseList.filter(s => {
    if (currentStatusFilter === 'unscored' && s.is_scored) return false;
    if (currentStatusFilter === 'scored' && !s.is_scored) return false;
    return true;
  });

  // 4. Urutkan Antrean (Sorting)
  filteredSubmissions.sort((a, b) => {
    if (sortFilter === 'unscored_first') {
      if (!a.is_scored && b.is_scored) return -1;
      if (a.is_scored && !b.is_scored) return 1;
      return (b.id - a.id);
    } else if (sortFilter === 'code_asc') {
      return (a.reg_code || '').localeCompare(b.reg_code || '');
    } else if (sortFilter === 'date_desc') {
      return (b.submitted_at || '').localeCompare(a.submitted_at || '');
    } else if (sortFilter === 'date_asc') {
      return (a.submitted_at || '').localeCompare(b.submitted_at || '');
    } else if (sortFilter === 'score_desc') {
      const scoreA = (a.my_score && a.my_score.total_score) ? a.my_score.total_score : 0;
      const scoreB = (b.my_score && b.my_score.total_score) ? b.my_score.total_score : 0;
      return (scoreB - scoreA);
    }
    return 0;
  });

  // 5. Update Progress Bar Penjurian
  const totalGlobal = allSubmissions.length;
  const scoredGlobal = allSubmissions.filter(s => s.is_scored).length;
  const percent = totalGlobal > 0 ? Math.round((scoredGlobal / totalGlobal) * 100) : 0;
  const pBar = document.getElementById('progress-bar-fill');
  const pText = document.getElementById('progress-bar-text');
  if (pBar) pBar.style.width = `${percent}%`;
  if (pText) pText.textContent = `${scoredGlobal}/${totalGlobal} (${percent}%)`;

  // 6. Update Dropdown Antrean Peserta
  updateParticipantSelector();

  // 7. Render Submission yang aktif
  if (filteredSubmissions.length > 0) {
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('active-workspace').classList.remove('hidden');

    let selectIdx = 0;
    if (preferredSelectId !== null) {
      const pIdx = filteredSubmissions.findIndex(s => s.id === preferredSelectId);
      if (pIdx !== -1) selectIdx = pIdx;
    } else if (currentSubmission) {
      const existingIdx = filteredSubmissions.findIndex(s => s.id === currentSubmission.id);
      if (existingIdx !== -1) selectIdx = existingIdx;
    }

    selectSubmissionByIndex(selectIdx);
  } else {
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('active-workspace').classList.add('hidden');
    stopAllMedia();
    currentSubmission = null;
    currentIndex = -1;
    const queueInd = document.getElementById('queue-indicator');
    if (queueInd) queueInd.textContent = '0/0';
  }

  if (window.lucide) lucide.createIcons();
}

function clearSearch() {
  const sInput = document.getElementById('filter-search');
  if (sInput) {
    sInput.value = '';
    sInput.focus();
  }
  applyFilters();
}

function resetAllFilters() {
  const branchEl = document.getElementById('filter-branch');
  const gradeEl = document.getElementById('filter-grade');
  const searchEl = document.getElementById('filter-search');
  const sortEl = document.getElementById('filter-sort');

  if (branchEl) branchEl.value = '';
  if (gradeEl) gradeEl.value = '';
  if (searchEl) searchEl.value = '';
  if (sortEl) sortEl.value = 'unscored_first';

  currentStatusFilter = '';
  const tabAll = document.getElementById('filter-tab-all');
  const tabUnscored = document.getElementById('filter-tab-unscored');
  const tabScored = document.getElementById('filter-tab-scored');
  if (tabAll && tabUnscored && tabScored) {
    [tabAll, tabUnscored, tabScored].forEach(tab => {
      tab.className = 'px-3 py-1 rounded-lg font-bold text-slate-500 hover:text-slate-900 transition';
    });
    tabAll.className = 'px-3 py-1 rounded-lg font-bold text-slate-800 bg-white shadow-xs transition';
  }

  applyFilters();
}

function setStatusFilter(status) {
  currentStatusFilter = status;
  
  const tabAll = document.getElementById('filter-tab-all');
  const tabUnscored = document.getElementById('filter-tab-unscored');
  const tabScored = document.getElementById('filter-tab-scored');

  [tabAll, tabUnscored, tabScored].forEach(tab => {
    tab.className = 'px-3 py-1 rounded-lg font-bold text-slate-500 hover:text-slate-900 transition';
  });

  if (status === 'unscored') {
    tabUnscored.className = 'px-3 py-1 rounded-lg font-bold text-amber-800 bg-amber-50 border border-amber-200 shadow-xs transition';
  } else if (status === 'scored') {
    tabScored.className = 'px-3 py-1 rounded-lg font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 shadow-xs transition';
  } else {
    tabAll.className = 'px-3 py-1 rounded-lg font-bold text-slate-800 bg-white shadow-xs transition';
  }

  applyFilters();
}

function updateParticipantSelector() {
  const sel = document.getElementById('participant-dropdown-selector');
  const queueInd = document.getElementById('queue-indicator');
  if (!sel) return;

  if (filteredSubmissions.length === 0) {
    sel.innerHTML = '<option value="">(Tidak ada karya)</option>';
    if (queueInd) queueInd.textContent = '0/0';
    return;
  }

  let html = '';
  filteredSubmissions.forEach((s, idx) => {
    const statusLabel = s.is_scored ? `✓ ${(s.my_score ? s.my_score.total_score.toFixed(1) : '')}` : '○ Belum';
    const shortTitle = s.project_title.length > 22 ? s.project_title.substring(0, 22) + '…' : s.project_title;
    html += `<option value="${s.id}">${idx + 1}. [${statusLabel}] ${s.blind_code} - ${shortTitle}</option>`;
  });
  sel.innerHTML = html;

  if (currentSubmission) {
    sel.value = currentSubmission.id;
  }
  if (queueInd && currentIndex >= 0) {
    queueInd.textContent = `${currentIndex + 1}/${filteredSubmissions.length}`;
  }
}

function selectSubmissionById(id) {
  const idx = filteredSubmissions.findIndex(s => s.id === parseInt(id));
  if (idx !== -1) selectSubmissionByIndex(idx);
}

function navigateSubmission(delta) {
  const targetIdx = currentIndex + delta;
  if (targetIdx >= 0 && targetIdx < filteredSubmissions.length) {
    selectSubmissionByIndex(targetIdx);
  }
}

// 4. Render Current Submission to Workspace
function selectSubmissionByIndex(idx) {
  if (idx < 0 || idx >= filteredSubmissions.length) return;
  currentIndex = idx;
  currentSubmission = filteredSubmissions[idx];

  // Update navigation buttons & dropdown
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (prevBtn) prevBtn.disabled = (currentIndex === 0);
  if (nextBtn) nextBtn.disabled = (currentIndex === filteredSubmissions.length - 1);

  const sel = document.getElementById('participant-dropdown-selector');
  if (sel) sel.value = currentSubmission.id;

  const queueInd = document.getElementById('queue-indicator');
  if (queueInd) queueInd.textContent = `${currentIndex + 1}/${filteredSubmissions.length}`;

  // Render Left Workspace Info
  document.getElementById('current-blind-code').textContent = currentSubmission.blind_code;
  document.getElementById('current-project-title').textContent = currentSubmission.project_title;
  document.getElementById('current-branch-label').textContent = currentSubmission.branch;
  document.getElementById('current-grade-label').textContent = currentSubmission.grade_category || '-';
  document.getElementById('current-submitted-at').textContent = 'Diunggah: ' + currentSubmission.submitted_at;
  document.getElementById('current-version-badge').textContent = 'v' + currentSubmission.version;

  // Status Badge
  const badge = document.getElementById('current-scored-badge');
  if (currentSubmission.is_scored && currentSubmission.my_score) {
    badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200';
    badge.innerHTML = `<i data-lucide="check" class="w-3 h-3 inline mr-1 text-emerald-600"></i>Skor: ${currentSubmission.my_score.total_score.toFixed(2)} / 100`;
  } else {
    badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200';
    badge.innerHTML = '<i data-lucide="clock" class="w-3 h-3 inline mr-1 text-amber-600"></i>Belum Dinilai';
  }

  // Render Code & Project Preview
  renderCodePreview(currentSubmission);

  // Render Video Preview
  renderVideoPreview(currentSubmission);

  // Render Description
  const descEl = document.getElementById('current-project-desc');
  descEl.textContent = currentSubmission.project_description || 'Peserta tidak menyertakan sinopsis teks tambahan.';

  // Render Scoring Studio (Right Column)
  populateScoringStudio(currentSubmission);

  if (window.lucide) lucide.createIcons();
}

// 5. Code Preview (Official TurboWarp Embed, Microsoft MakeCode & Erboblox Robotics)
function renderCodePreview(sub) {
  const iframe = document.getElementById('preview-iframe');
  const loader = document.getElementById('preview-loader');
  const microbitFallback = document.getElementById('microbit-fallback');
  const erbobloxFallback = document.getElementById('erboblox-fallback');
  const scratchStats = document.getElementById('scratch-stats-container');
  const btnOpenEditor = document.getElementById('btn-open-editor-tab');
  const btnOpenExternal = document.getElementById('btn-open-external');
  const btnDownload = document.getElementById('btn-download-clean-file');

  loader.classList.remove('hidden');
  iframe.classList.remove('hidden');
  if (microbitFallback) microbitFallback.classList.add('hidden');
  if (erbobloxFallback) erbobloxFallback.classList.add('hidden');

  // Bersihkan sanitized file download link
  btnDownload.href = sub.stream_url;
  btnDownload.setAttribute('download', sub.project_file_name);

  const isScratch = (sub.file_ext === 'sb3' || (sub.branch && sub.branch.includes('Scratch')));
  const isMicrobit = (sub.file_ext === 'hex' || (sub.branch && sub.branch.includes('Micro:bit')));
  const isErboblox = (sub.branch && sub.branch.toLowerCase().includes('erboblox')) || (!sub.project_file_path && !isScratch && !isMicrobit);

  const targetFileUrl = sub.project_file_url || sub.stream_url;

  if (isScratch) {
    if (scratchStats) scratchStats.classList.remove('hidden');
    if (btnDownload) btnDownload.classList.remove('hidden');
    if (btnOpenEditor) {
      btnOpenEditor.classList.remove('hidden');
      btnOpenEditor.href = `https://turbowarp.org/editor?project_url=${encodeURIComponent(targetFileUrl)}`;
    }
    if (btnOpenExternal) {
      btnOpenExternal.classList.remove('hidden');
      btnOpenExternal.href = `https://turbowarp.org/embed.html?project_url=${encodeURIComponent(targetFileUrl)}`;
    }

    const embedUrl = `https://turbowarp.org/embed.html?project_url=${encodeURIComponent(targetFileUrl)}`;
    iframe.src = embedUrl;
    iframe.onload = () => {
      loader.classList.add('hidden');
    };

    renderScratchInspector(sub.scratch_summary);

  } else if (isMicrobit) {
    if (scratchStats) scratchStats.classList.add('hidden');
    loader.classList.add('hidden');
    iframe.classList.add('hidden');
    if (microbitFallback) microbitFallback.classList.remove('hidden');

    if (btnOpenEditor) {
      btnOpenEditor.classList.remove('hidden');
      btnOpenEditor.href = 'https://makecode.microbit.org/#editor';
    }
    if (btnOpenExternal) {
      btnOpenExternal.classList.remove('hidden');
      btnOpenExternal.href = 'https://makecode.microbit.org/#editor';
    }
    if (btnDownload) btnDownload.classList.remove('hidden');

  } else if (isErboblox) {
    if (scratchStats) scratchStats.classList.add('hidden');
    loader.classList.add('hidden');
    iframe.classList.add('hidden');
    if (erbobloxFallback) erbobloxFallback.classList.remove('hidden');

    if (btnOpenEditor) btnOpenEditor.classList.add('hidden');
    if (btnOpenExternal) btnOpenExternal.classList.add('hidden');
    if (btnDownload) btnDownload.classList.add('hidden');

    // Otomatis arahkan ke tab video bila di tab balok karena Erboblox dinilai lewat video presentasi
    const tabBlocks = document.getElementById('tab-content-blocks');
    if (tabBlocks && !tabBlocks.classList.contains('hidden')) {
      switchContentTab('video');
    }

  } else {
    // Default fallback
    if (scratchStats) scratchStats.classList.add('hidden');
    loader.classList.add('hidden');
    if (btnOpenEditor) btnOpenEditor.href = sub.stream_url;
    if (btnOpenExternal) btnOpenExternal.href = sub.stream_url;
    iframe.src = sub.stream_url;
  }
}

// 6. Scratch Code Inspector Breakdown
function renderScratchInspector(summary) {
  const container = document.getElementById('scratch-stats-container');
  if (!summary) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  document.getElementById('stat-total-targets').textContent = summary.total_targets || 0;
  document.getElementById('stat-total-blocks').textContent = (summary.total_blocks || 0).toLocaleString();

  let costumesCount = 0;
  let soundsCount = 0;
  if (Array.isArray(summary.sprites)) {
    summary.sprites.forEach(s => {
      costumesCount += s.costumes_count || 0;
      soundsCount += s.sounds_count || 0;
    });
  }
  document.getElementById('stat-total-costumes').textContent = costumesCount;
  document.getElementById('stat-total-sounds').textContent = soundsCount;

  // Render Sprite Breakdown Table
  const tbody = document.getElementById('sprite-tbody');
  tbody.innerHTML = '';
  if (Array.isArray(summary.sprites)) {
    summary.sprites.forEach(s => {
      const typeLabel = s.is_stage 
        ? '<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-bold border border-slate-200">Panggung / Stage</span>'
        : '<span class="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[9px] font-bold border border-orange-200">Sprite Karakter</span>';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(s.name)}</td>
        <td class="py-1.5 px-3 text-center">${typeLabel}</td>
        <td class="py-1.5 px-3 text-right font-black text-orange-600">${s.block_count || 0}</td>
        <td class="py-1.5 px-3 text-right text-slate-500 font-medium">${s.costumes_count || 0}</td>
        <td class="py-1.5 px-3 text-right text-slate-500 font-medium">${s.sounds_count || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function toggleSpriteBreakdown() {
  const table = document.getElementById('sprite-breakdown-table');
  const btn = document.getElementById('btn-toggle-sprites');
  if (table.classList.contains('hidden')) {
    table.classList.remove('hidden');
    btn.innerHTML = '<span>Tutup Rincian</span><i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>';
  } else {
    table.classList.add('hidden');
    btn.innerHTML = '<span>Rincian Sprite</span><i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>';
  }
  if (window.lucide) lucide.createIcons();
}

// 7. Render Video Presentasi (YouTube & Google Drive Parser)
function parseVideoEmbed(url) {
  if (!url) return null;
  url = url.trim();

  // YouTube Parser
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0`;
  }

  // Google Drive Parser
  const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://drive.google.com/file/d/${gdriveMatch[1]}/preview`;
  }

  return url;
}

function renderVideoPreview(sub) {
  const vIframe = document.getElementById('video-player-iframe');
  const btnDirect = document.getElementById('btn-video-direct');
  const errBox = document.getElementById('video-error-state');
  const backupBox = document.getElementById('backup-video-box');
  const btnBackup = document.getElementById('btn-backup-video-link');

  const embedUrl = parseVideoEmbed(sub.video_url);

  if (embedUrl) {
    vIframe.src = embedUrl;
    vIframe.classList.remove('hidden');
    errBox.classList.add('hidden');
    btnDirect.href = sub.video_url;
  } else {
    vIframe.classList.add('hidden');
    errBox.classList.remove('hidden');
    btnDirect.href = sub.video_url || '#';
  }

  // Backup link
  if (sub.backup_video_url) {
    backupBox.classList.remove('hidden');
    btnBackup.href = sub.backup_video_url;
  } else {
    backupBox.classList.add('hidden');
  }
}

// 8. Tabs Switcher di Workspace Kiri
function switchContentTab(tabKey) {
  const tabBlocks = document.getElementById('tab-content-blocks');
  const tabVideo = document.getElementById('tab-content-video');
  const tabDesc = document.getElementById('tab-content-description');

  const btnBlocks = document.getElementById('tab-btn-blocks');
  const btnVideo = document.getElementById('tab-btn-video');
  const btnDesc = document.getElementById('tab-btn-description');

  [tabBlocks, tabVideo, tabDesc].forEach(el => el.classList.add('hidden'));
  [btnBlocks, btnVideo, btnDesc].forEach(btn => {
    btn.className = 'px-4 py-2.5 rounded-t-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center gap-2';
  });

  if (tabKey === 'blocks') {
    tabBlocks.classList.remove('hidden');
    btnBlocks.className = 'px-4 py-2.5 rounded-t-xl text-xs font-bold bg-white text-orange-600 border-t-2 border-orange-500 shadow-xs transition flex items-center gap-2';
  } else if (tabKey === 'video') {
    tabVideo.classList.remove('hidden');
    btnVideo.className = 'px-4 py-2.5 rounded-t-xl text-xs font-bold bg-white text-orange-600 border-t-2 border-orange-500 shadow-xs transition flex items-center gap-2';
  } else if (tabKey === 'description') {
    tabDesc.classList.remove('hidden');
    btnDesc.className = 'px-4 py-2.5 rounded-t-xl text-xs font-bold bg-white text-orange-600 border-t-2 border-orange-500 shadow-xs transition flex items-center gap-2';
  }

  if (window.lucide) lucide.createIcons();
}

// 9. Scoring Studio (Right Column) & Two-Way Sync
function populateScoringStudio(sub) {
  const myScore = sub.my_score;
  const logicVal = myScore ? myScore.score_logic : 0;
  const creativityVal = myScore ? myScore.score_creativity : 0;
  const themeVal = myScore ? myScore.score_theme : 0;
  const designVal = myScore ? myScore.score_design : 0;
  const presVal = myScore ? myScore.score_presentation : 0;
  const notesVal = myScore ? (myScore.judge_notes || '') : '';

  setScoreValues('logic', logicVal);
  setScoreValues('creativity', creativityVal);
  setScoreValues('theme', themeVal);
  setScoreValues('design', designVal);
  setScoreValues('presentation', presVal);

  document.getElementById('judge-notes-input').value = notesVal;

  const lastSavedEl = document.getElementById('last-saved-time');
  if (myScore && myScore.scored_at) {
    lastSavedEl.textContent = 'Tersimpan: ' + myScore.scored_at;
  } else {
    lastSavedEl.textContent = '';
  }

  recalculateTotalScore();
}

function setScoreValues(key, val) {
  const numInput = document.getElementById(`score-${key}-input`);
  if (numInput) numInput.value = val;
}

function syncScoreInput(key, val) {
  let num = parseFloat(val);
  if (isNaN(num)) num = 0;
  if (num < 0) num = 0;
  if (num > 100) num = 100;
  recalculateTotalScore();
}

function setScorePreset(key, presetVal) {
  const numInput = document.getElementById(`score-${key}-input`);
  if (numInput) {
    numInput.value = presetVal;
    recalculateTotalScore();
  }
}

function adjustScoreStep(key, delta) {
  const numInput = document.getElementById(`score-${key}-input`);
  if (numInput) {
    let current = parseFloat(numInput.value) || 0;
    let next = Math.max(0, Math.min(100, Math.round((current + delta) * 10) / 10));
    numInput.value = next;
    recalculateTotalScore();
  }
}

function recalculateTotalScore() {
  const logic = parseFloat(document.getElementById('score-logic-input').value) || 0;
  const creativity = parseFloat(document.getElementById('score-creativity-input').value) || 0;
  const theme = parseFloat(document.getElementById('score-theme-input').value) || 0;
  const design = parseFloat(document.getElementById('score-design-input').value) || 0;
  const presentation = parseFloat(document.getElementById('score-presentation-input').value) || 0;

  // Perhitungan bobot resmi (100%):
  // 30% Logika + 25% Kreativitas + 20% Tema + 15% Estetika + 10% Presentasi
  const cLogic = logic * 0.30;
  const cCreativity = creativity * 0.25;
  const cTheme = theme * 0.20;
  const cDesign = design * 0.15;
  const cPresentation = presentation * 0.10;

  document.getElementById('contrib-logic').textContent = `${cLogic.toFixed(2)} pts`;
  document.getElementById('contrib-creativity').textContent = `${cCreativity.toFixed(2)} pts`;
  document.getElementById('contrib-theme').textContent = `${cTheme.toFixed(2)} pts`;
  document.getElementById('contrib-design').textContent = `${cDesign.toFixed(2)} pts`;
  document.getElementById('contrib-presentation').textContent = `${cPresentation.toFixed(2)} pts`;

  const total = cLogic + cCreativity + cTheme + cDesign + cPresentation;
  document.getElementById('display-total-score').textContent = total.toFixed(2);

  // Grade Predicate (Light Theme Badges)
  const gradeBadge = document.getElementById('grade-predicate');
  if (total === 0) {
    gradeBadge.className = 'px-3 py-1 rounded-full font-extrabold bg-slate-100 text-slate-600 border border-slate-200 shadow-xs';
    gradeBadge.textContent = 'Belum Dinilai';
  } else if (total >= 90) {
    gradeBadge.className = 'px-3 py-1 rounded-full font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs';
    gradeBadge.textContent = 'Predikat: Istimewa (A+)';
  } else if (total >= 80) {
    gradeBadge.className = 'px-3 py-1 rounded-full font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs';
    gradeBadge.textContent = 'Predikat: Sangat Baik (A)';
  } else if (total >= 70) {
    gradeBadge.className = 'px-3 py-1 rounded-full font-extrabold bg-amber-100 text-amber-800 border border-amber-200 shadow-xs';
    gradeBadge.textContent = 'Predikat: Baik (B)';
  } else if (total >= 60) {
    gradeBadge.className = 'px-3 py-1 rounded-full font-extrabold bg-orange-100 text-orange-800 border border-orange-200 shadow-xs';
    gradeBadge.textContent = 'Predikat: Cukup (C)';
  } else {
    gradeBadge.className = 'px-3 py-1 rounded-full font-extrabold bg-red-100 text-red-800 border border-red-200 shadow-xs';
    gradeBadge.textContent = 'Predikat: Perlu Pembinaan (D)';
  }
}

// 10. Submit Score ke Backend API
async function submitScore(advanceToNext) {
  if (!currentSubmission) return;

  const logic = parseFloat(document.getElementById('score-logic-input').value) || 0;
  const creativity = parseFloat(document.getElementById('score-creativity-input').value) || 0;
  const theme = parseFloat(document.getElementById('score-theme-input').value) || 0;
  const design = parseFloat(document.getElementById('score-design-input').value) || 0;
  const presentation = parseFloat(document.getElementById('score-presentation-input').value) || 0;
  const notes = document.getElementById('judge-notes-input').value.trim();

  // Validasi nilai minimal
  const total = (logic * 0.3) + (creativity * 0.25) + (theme * 0.2) + (design * 0.15) + (presentation * 0.1);
  if (total <= 0) {
    if (!confirm('Total nilai yang diberikan adalah 0.00. Apakah Anda yakin ingin menyimpan nilai ini?')) {
      return;
    }
  }

  // Tentukan target ID berikutnya SEBELUM menyimpan / merefresh queue
  let targetNextId = null;
  if (advanceToNext) {
    const nextUnscored = filteredSubmissions.find((s, idx) => idx > currentIndex && !s.is_scored && s.id !== currentSubmission.id);
    if (nextUnscored) {
      targetNextId = nextUnscored.id;
    } else {
      const anyUnscored = filteredSubmissions.find(s => !s.is_scored && s.id !== currentSubmission.id);
      if (anyUnscored) {
        targetNextId = anyUnscored.id;
      }
    }
  }

  const btnSave = document.getElementById('btn-save-score');
  const btnNext = document.getElementById('btn-save-and-next');
  btnSave.disabled = true;
  btnNext.disabled = true;
  btnSave.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan...';
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch(`api/admin.php?action=save_project_score&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: currentSubmission.id,
        score_logic: logic,
        score_creativity: creativity,
        score_theme: theme,
        score_design: design,
        score_presentation: presentation,
        judge_notes: notes
      })
    });
    const data = await res.json();

    if (data.status === 'ok') {
      const savedBlind = currentSubmission.blind_code;
      const finalVal = data.total_score.toFixed(2);

      // Update data di memori
      currentSubmission.is_scored = true;
      currentSubmission.my_score = {
        score_id: data.score_id,
        score_logic: logic,
        score_creativity: creativity,
        score_theme: theme,
        score_design: design,
        score_presentation: presentation,
        total_score: data.total_score,
        judge_notes: notes,
        scored_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      // Sinkronkan ke pool allSubmissions
      const foundInAll = allSubmissions.find(s => s.id === currentSubmission.id);
      if (foundInAll) {
        foundInAll.is_scored = true;
        foundInAll.my_score = currentSubmission.my_score;
      }

      // Tentukan target yang akan dipilih setelah list diperbarui
      const preferredId = (advanceToNext && targetNextId) ? targetNextId : currentSubmission.id;

      // Reload data secara background
      await reloadSubmissions(preferredId);

      alert(`Nilai untuk ${savedBlind} berhasil disimpan!\nTotal Nilai: ${finalVal} / 100`);

      if (advanceToNext && !targetNextId) {
        alert('Selamat! Seluruh karya dalam filter ini telah Anda nilai.');
      }
    } else {
      alert(data.message || 'Gagal menyimpan penilaian karya.');
    }
  } catch (err) {
    alert('Terjadi kesalahan koneksi saat menyimpan penilaian.');
  } finally {
    btnSave.disabled = false;
    btnNext.disabled = false;
    btnSave.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Simpan Penilaian Karya Ini</span>';
    if (window.lucide) lucide.createIcons();
  }
}

// 11. Modal Rekapitulasi & Peringkat (Leaderboard)
function openLeaderboardModal() {
  document.getElementById('leaderboard-modal').classList.remove('hidden');
  loadLeaderboard();
  if (window.lucide) lucide.createIcons();
}

function closeLeaderboardModal() {
  document.getElementById('leaderboard-modal').classList.add('hidden');
}

async function loadLeaderboard() {
  const branch = document.getElementById('lb-filter-branch').value;
  const grade = document.getElementById('lb-filter-grade').value;
  const tbody = document.getElementById('leaderboard-tbody');

  tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-slate-400">Memuat rekapitulasi nilai...</td></tr>';

  try {
    const res = await fetch(`api/admin.php?action=get_judging_leaderboard&branch=${encodeURIComponent(branch)}&grade_category=${encodeURIComponent(grade)}&token=${encodeURIComponent(authToken)}`);
    const data = await res.json();

    if (data.status === 'ok') {
      const rows = data.leaderboard || [];
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-slate-400">Belum ada karya yang selesai dinilai dewan juri pada filter ini.</td></tr>';
        return;
      }

      let html = '';
      rows.forEach((r, idx) => {
        let rankBadge = '';
        if (idx === 0) rankBadge = '<span class="w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black inline-flex items-center justify-center text-[10px] shadow-xs">1</span>';
        else if (idx === 1) rankBadge = '<span class="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black inline-flex items-center justify-center text-[10px] shadow-xs">2</span>';
        else if (idx === 2) rankBadge = '<span class="w-6 h-6 rounded-full bg-amber-600 text-white font-black inline-flex items-center justify-center text-[10px] shadow-xs">3</span>';
        else rankBadge = `<span class="text-xs font-bold text-slate-500">${idx + 1}</span>`;

        html += `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-2.5 px-3 text-center">${rankBadge}</td>
            <td class="py-2.5 px-3 font-extrabold text-slate-900">${escapeHtml(r.blind_code)}</td>
            <td class="py-2.5 px-3 text-slate-600">${escapeHtml(r.branch)} <span class="text-[10px] text-slate-400 font-bold">(${escapeHtml(r.grade_category)})</span></td>
            <td class="py-2.5 px-3 font-bold text-orange-600">${escapeHtml(r.project_title)}</td>
            <td class="py-2.5 px-2 text-center text-slate-600">${r.judge_count} juri</td>
            <td class="py-2.5 px-2 text-right text-slate-600 font-semibold">${parseFloat(r.avg_logic || 0).toFixed(1)}</td>
            <td class="py-2.5 px-2 text-right text-slate-600 font-semibold">${parseFloat(r.avg_creativity || 0).toFixed(1)}</td>
            <td class="py-2.5 px-2 text-right text-slate-600 font-semibold">${parseFloat(r.avg_theme || 0).toFixed(1)}</td>
            <td class="py-2.5 px-2 text-right text-slate-600 font-semibold">${parseFloat(r.avg_design || 0).toFixed(1)}</td>
            <td class="py-2.5 px-2 text-right text-slate-600 font-semibold">${parseFloat(r.avg_presentation || 0).toFixed(1)}</td>
            <td class="py-2.5 px-3 text-right font-black text-orange-600 text-sm">${parseFloat(r.final_score || 0).toFixed(2)}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-red-500">Gagal memuat rekap nilai.</td></tr>';
  }
}

function exportJudgingCSV() {
  const branch = document.getElementById('lb-filter-branch').value;
  const grade = document.getElementById('lb-filter-grade').value;
  window.location.href = `api/admin.php?action=export_judging_csv&branch=${encodeURIComponent(branch)}&grade_category=${encodeURIComponent(grade)}&token=${encodeURIComponent(authToken)}`;
}

// 12. Modal Ganti Password Juri
function openChangePwdModal() {
  document.getElementById('change-pwd-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeChangePwdModal() {
  document.getElementById('change-pwd-modal').classList.add('hidden');
  document.getElementById('change-pwd-form').reset();
}

async function submitChangePassword(e) {
  e.preventDefault();
  const oldPass = document.getElementById('old-pwd-input').value.trim();
  const newPass = document.getElementById('new-pwd-input').value.trim();

  try {
    const res = await fetch(`api/admin.php?action=change_password&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_password: oldPass, new_password: newPass })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      alert('Password berhasil diperbarui. Silakan gunakan password baru pada sesi masuk berikutnya.');
      closeChangePwdModal();
    } else {
      alert(data.message || 'Gagal mengganti password.');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat mengganti password.');
  }
}

// 13. Keyboard Shortcuts Listener
document.addEventListener('keydown', (e) => {
  const activeTag = (document.activeElement?.tagName || '').toLowerCase();
  const isInputActive = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

  // Ctrl + Enter: Simpan Penilaian (Bisa di mana saja)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    submitScore(false);
    return;
  }

  // Alt + Arrow Left: Peserta Sebelumnya (Bisa di mana saja)
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateSubmission(-1);
    return;
  }

  // Alt + Arrow Right: Peserta Berikutnya (Bisa di mana saja)
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    navigateSubmission(1);
    return;
  }
});

// Global Bindings untuk inline HTML calls
window.togglePasswordVisibility = togglePasswordVisibility;
window.logoutJudge = logoutJudge;
window.applyFilters = applyFilters;
window.clearSearch = clearSearch;
window.resetAllFilters = resetAllFilters;
window.setStatusFilter = setStatusFilter;
window.selectSubmissionById = selectSubmissionById;
window.navigateSubmission = navigateSubmission;
window.switchContentTab = switchContentTab;
window.toggleSpriteBreakdown = toggleSpriteBreakdown;
window.syncScoreInput = syncScoreInput;
window.setScorePreset = setScorePreset;
window.adjustScoreStep = adjustScoreStep;
window.submitScore = submitScore;
window.openLeaderboardModal = openLeaderboardModal;
window.closeLeaderboardModal = closeLeaderboardModal;
window.loadLeaderboard = loadLeaderboard;
window.exportJudgingCSV = exportJudgingCSV;
window.openChangePwdModal = openChangePwdModal;
window.closeChangePwdModal = closeChangePwdModal;
window.submitChangePassword = submitChangePassword;

// Inisialisasi saat DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  checkJudgeAuth();
});
