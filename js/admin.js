/**
 * Admin Panel & Reporting Logic - Secure Auth & Multi-Event
 * Erlass Competition Portal
 */

let authToken = sessionStorage.getItem('erlass_admin_token') || localStorage.getItem('erlass_admin_token') || '';
let currentUser = JSON.parse(sessionStorage.getItem('erlass_admin_user') || localStorage.getItem('erlass_admin_user') || 'null');
let currentRegistrationList = [];
let activeModalRegId = null;
let currentCompetitionId = 1;
let competitionsList = [];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const authScreen = document.getElementById('auth-screen');
const dashboardContent = document.getElementById('dashboard-content');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const compSelector = document.getElementById('competition-selector');

// 1. Inisialisasi & Verifikasi Sesi
async function checkAuth() {
  if (authToken) {
    if (currentUser && currentUser.role === 'juri') {
      window.location.href = 'penjurian.html';
      return;
    }
    try {
      const res = await fetch(`api/admin.php?action=get_competitions&token=${encodeURIComponent(authToken)}`);
      const data = await res.json();
      if (data.status === 'ok') {
        showDashboard();
        if (currentUser) {
          const uName = document.getElementById('header-user-name');
          if (uName) uName.textContent = currentUser.username || 'admin';
          const uRole = document.getElementById('header-user-role');
          if (uRole) uRole.textContent = currentUser.role || 'Superadmin';
        }
        await loadCompetitions(data.competitions);
        return;
      } else {
        // Token kadaluwarsa / tidak valid, bersihkan sesi lama
        authToken = '';
        currentUser = null;
        sessionStorage.clear();
        localStorage.clear();
      }
    } catch (e) {
      console.error(e);
    }
  }
  showAuthModal();
}

function showAuthModal() {
  authScreen.classList.remove('hidden');
  dashboardContent.classList.add('hidden');
  lucide.createIcons();
}

function showDashboard() {
  authScreen.classList.add('hidden');
  dashboardContent.classList.remove('hidden');
  document.getElementById('print-date').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  lucide.createIcons();
}

// 2. Form Login Secure (Username & Password)
authForm.addEventListener('submit', async e => {
  e.preventDefault();
  const uInput = document.getElementById('username-input');
  const pInput = document.getElementById('password-input');
  const passcodeInput = document.getElementById('passcode-input');

  let username = uInput ? uInput.value.trim() : '';
  let password = pInput ? pInput.value.trim() : '';

  // Fallback jika browser masih me-render input passcode lama
  if (!username && passcodeInput) {
    username = 'admin';
    password = passcodeInput.value.trim();
  }

  const submitBtn = document.getElementById('login-submit-btn') || authForm.querySelector('button[type="submit"]');

  authError.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Memverifikasi...';
    lucide.createIcons();
  }

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

      if (currentUser && currentUser.role === 'juri') {
        window.location.href = 'penjurian.html';
        return;
      }

      const headerName = document.getElementById('header-user-name');
      if (headerName) headerName.textContent = currentUser.username;
      const headerRole = document.getElementById('header-user-role');
      if (headerRole) headerRole.textContent = currentUser.role || 'Superadmin';

      showDashboard();
      await loadCompetitions();
    } else {
      authError.textContent = data.message || 'Username atau password salah!';
      authError.classList.remove('hidden');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> <span>Masuk ke Dashboard</span>';
        lucide.createIcons();
      }
    }
  } catch (err) {
    authError.textContent = 'Gagal terhubung ke server login.';
    authError.classList.remove('hidden');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> <span>Masuk ke Dashboard</span>';
      lucide.createIcons();
    }
  }
});

function togglePasswordVisibility() {
  const pInput = document.getElementById('password-input');
  if (!pInput) return;
  const isPass = pInput.type === 'password';
  pInput.type = isPass ? 'text' : 'password';
  const icon = document.getElementById('eye-icon');
  if (icon) {
    icon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
    lucide.createIcons();
  }
}

async function logoutAdmin() {
  if (authToken) {
    try {
      await fetch(`api/admin.php?action=logout&token=${encodeURIComponent(authToken)}`);
    } catch (e) {}
  }
  authToken = '';
  currentUser = null;
  sessionStorage.clear();
  localStorage.clear();
  location.reload();
}

// 3. Multi-Event Switcher & Management
async function loadCompetitions(preloadedList = null) {
  try {
    if (!preloadedList) {
      const res = await fetch(`api/admin.php?action=get_competitions&token=${encodeURIComponent(authToken)}`);
      const data = await res.json();
      competitionsList = data.competitions || [];
    } else {
      competitionsList = preloadedList;
    }

    compSelector.innerHTML = '';
    if (competitionsList.length > 0) {
      competitionsList.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        const statusLabel = c.status === 'open' ? '🟢 Aktif' : (c.status === 'upcoming' ? '🟡 Segera' : '⚪ Arsip');
        opt.textContent = `${c.title} (${statusLabel})`;
        compSelector.appendChild(opt);
      });

      const openComp = competitionsList.find(c => c.status === 'open') || competitionsList[0];
      currentCompetitionId = openComp.id;
      compSelector.value = currentCompetitionId;
      updateActiveBadge(openComp.status);
    }

    await loadReports();
    await loadRegistrations();
  } catch (err) {
    console.error('Error load competitions:', err);
  }
}

function updateActiveBadge(status) {
  const badge = document.getElementById('active-comp-badge');
  if (status === 'open') {
    badge.textContent = 'PENDAFTARAN BUKA';
    badge.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-400 text-emerald-950 uppercase';
  } else if (status === 'upcoming') {
    badge.textContent = 'SEGERA HADIR';
    badge.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-300 text-amber-950 uppercase';
  } else {
    badge.textContent = 'SELESAI / ARSIP';
    badge.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-300 text-slate-800 uppercase';
  }
}

function switchCompetition(compId) {
  currentCompetitionId = parseInt(compId, 10);
  const selected = competitionsList.find(c => c.id == currentCompetitionId);
  if (selected) {
    updateActiveBadge(selected.status);
  }
  loadReports();
  loadRegistrations();
}

function openNewCompModal() {
  document.getElementById('new-comp-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeNewCompModal() {
  document.getElementById('new-comp-modal').classList.add('hidden');
}

document.getElementById('new-comp-form').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('new_title').value.trim(),
    slug: document.getElementById('new_slug').value.trim(),
    status: document.getElementById('new_status').value,
    tagline: document.getElementById('new_tagline').value.trim(),
    registration_start: document.getElementById('new_reg_start').value,
    registration_end: document.getElementById('new_reg_end').value,
    competition_date: document.getElementById('new_comp_date').value,
    general_fee: document.getElementById('new_general_fee').value,
    bank_account: document.getElementById('new_bank_account').value.trim(),
    whatsapp_group_url: document.getElementById('new_wa_url').value.trim()
  };

  try {
    const res = await fetch(`api/admin.php?action=save_competition&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status === 'ok') {
      alert('Event kompetisi baru berhasil disimpan!');
      closeNewCompModal();
      document.getElementById('new-comp-form').reset();
      await loadCompetitions();
      if (result.competition_id) {
        compSelector.value = result.competition_id;
        switchCompetition(result.competition_id);
      }
    } else {
      alert(result.message || 'Gagal menyimpan kompetisi.');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat menyimpan event kompetisi.');
  }
});

// 4. Load Laporan Eksekutif & Statistik
async function loadReports() {
  try {
    const res = await fetch(`api/admin.php?action=get_reports&competition_id=${currentCompetitionId}&token=${encodeURIComponent(authToken)}`);
    const data = await res.json();
    if (data.status === 'ok') {
      renderReports(data);
    }
  } catch (err) {
    console.error('Error load reports:', err);
  }
}

function renderReports(data) {
  const m = data.metrics;
  document.getElementById('stat-total').textContent = m.total_registered;
  document.getElementById('stat-verified').textContent = m.total_verified;
  document.getElementById('stat-pending').textContent = m.total_pending;
  document.getElementById('stat-partner').textContent = m.total_partner;
  document.getElementById('stat-public').textContent = m.total_public;
  document.getElementById('stat-revenue').textContent = 'Rp ' + Number(m.total_revenue).toLocaleString('id-ID');

  // Render Cabang Breakdown
  const branchContainer = document.getElementById('branch-breakdown');
  branchContainer.innerHTML = '';
  const total = m.total_registered || 1;

  if (data.by_branch && data.by_branch.length > 0) {
    data.by_branch.forEach(b => {
      const pct = Math.round((b.count / total) * 100);
      branchContainer.innerHTML += `
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span class="font-bold text-slate-800">${b.branch}</span>
            <span class="text-slate-500 font-semibold">${b.count} Peserta (${pct}%) • <strong class="text-emerald-600">${b.verified_count} Lolos</strong></span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div class="bg-orange-500 h-2.5 rounded-full" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    });
  } else {
    branchContainer.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">Belum ada pendaftar di event ini.</p>';
  }

  // Render Wilayah Breakdown
  const regionContainer = document.getElementById('region-breakdown');
  regionContainer.innerHTML = '';
  if (data.by_region && data.by_region.length > 0) {
    data.by_region.forEach(r => {
      regionContainer.innerHTML += `
        <div class="flex items-center justify-between text-xs py-1 border-b border-slate-50">
          <span class="font-semibold text-slate-700">${r.region}</span>
          <span class="font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px]">${r.count} siswa</span>
        </div>
      `;
    });
  } else {
    regionContainer.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">Belum ada data wilayah.</p>';
  }

  // Render Top Sekolah
  const schoolContainer = document.getElementById('top-schools-container');
  schoolContainer.innerHTML = '';
  if (data.top_schools && data.top_schools.length > 0) {
    data.top_schools.forEach((s, idx) => {
      schoolContainer.innerHTML += `
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <div class="flex items-center gap-2 truncate">
            <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px] shrink-0">${idx + 1}</span>
            <span class="font-bold text-slate-800 truncate" title="${s.school_name}">${s.school_name}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${s.is_partner == 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
              ${s.is_partner == 1 ? 'Mitra' : 'Umum'}
            </span>
            <strong class="text-orange-600">${s.count}</strong>
          </div>
        </div>
      `;
    });
  } else {
    schoolContainer.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">Belum ada data sekolah.</p>';
  }

  lucide.createIcons();
}

// 5. Load Daftar Registrasi (dengan Filter)
async function loadRegistrations() {
  const branch = document.getElementById('filter-branch').value;
  const status = document.getElementById('filter-status').value;
  const partner = document.getElementById('filter-partner').value;
  const search = document.getElementById('filter-search').value.trim();

  const url = `api/admin.php?action=get_registrations&competition_id=${currentCompetitionId}&token=${encodeURIComponent(authToken)}&branch=${encodeURIComponent(branch)}&status=${encodeURIComponent(status)}&partner=${encodeURIComponent(partner)}&search=${encodeURIComponent(search)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'ok') {
      currentRegistrationList = data.registrations || [];
      renderRegistrationsTable(currentRegistrationList);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderRegistrationsTable(rows) {
  const tbody = document.getElementById('registrations-tbody');
  tbody.innerHTML = '';
  document.getElementById('table-record-count').textContent = `Menampilkan ${rows.length} pendaftar`;

  const checkAll = document.getElementById('check-all-reg');
  if (checkAll) checkAll.checked = false;
  updateSelectedCount();

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-400">Tidak ada data pendaftaran untuk event ini.</td></tr>`;
    return;
  }

  rows.forEach((r, idx) => {
    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">Menunggu</span>';
    if (r.payment_status === 'verified') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">Lolos</span>';
    } else if (r.payment_status === 'rejected') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800">Ditolak</span>';
    }

    const cleanPhone = r.phone.replace(/[^0-9]/g, '');
    let waPhone = cleanPhone;
    if (waPhone.startsWith('0')) {
      waPhone = '62' + waPhone.substring(1);
    }
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(`Halo ${r.participant_name}, kami dari Panitia Kompetisi Erlass. Mengenai pendaftaran Anda (${r.reg_code})...`)}`;

    let proofCol = '<span class="text-slate-400">-</span>';
    if (r.payment_proof) {
      proofCol = `
        <button type="button" onclick="openModal(${r.id})" class="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-lg border border-orange-200">
          <i data-lucide="image" class="w-3.5 h-3.5"></i> Bukti
        </button>
      `;
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 transition';
    tr.innerHTML = `
      <td class="py-3 px-3 text-center no-print">
        <input type="checkbox" class="reg-checkbox rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-4 h-4" value="${r.id}" onchange="updateSelectedCount()">
      </td>
      <td class="py-3 px-3 font-mono text-slate-400">${idx + 1}</td>
      <td class="py-3 px-4 font-mono font-bold text-orange-600 whitespace-nowrap">${r.reg_code}</td>
      <td class="py-3 px-4">
        <strong class="text-slate-900 block text-xs">${r.participant_name}</strong>
        <span class="text-[10px] text-slate-400">${r.gender} • Usia ${r.age} thn</span>
      </td>
      <td class="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">${r.branch}</td>
      <td class="py-3 px-4 font-medium text-slate-600">${r.grade}</td>
      <td class="py-3 px-4">
        <span class="text-slate-800 font-semibold block">${r.school_name}</span>
        <span class="text-[10px] text-slate-400">${r.npsn ? 'NPSN: ' + r.npsn + ' • ' : ''}${r.region || '-'}</span>
      </td>
      <td class="py-3 px-4 whitespace-nowrap">
        <span class="text-[11px] font-bold px-2 py-0.5 rounded ${r.is_partner == 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
          ${r.is_partner == 1 ? 'Pelanggan Erlass' : 'Umum'}
        </span>
      </td>
      <td class="py-3 px-4 no-print">${proofCol}</td>
      <td class="py-3 px-4 whitespace-nowrap">${statusBadge}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap no-print">
        <div class="inline-flex items-center gap-1.5">
          <a href="${waUrl}" target="_blank" class="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition" title="Chat WhatsApp">
            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
          </a>
          <button type="button" onclick="openModal(${r.id})" class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-sm transition" title="Ubah Status Verifikasi">
            Verifikasi
          </button>
          <button type="button" onclick="deleteSingleRegistration(${r.id}, '${escapeHtml(r.reg_code)}', '${escapeHtml(r.participant_name)}')" class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 transition" title="Hapus Pendaftar">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// 5.1. Checklist & Aksi Massal Pendaftar
function toggleSelectAll(checked) {
  document.querySelectorAll('.reg-checkbox').forEach(cb => {
    cb.checked = checked;
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const checked = document.querySelectorAll('.reg-checkbox:checked');
  const countEl = document.getElementById('selected-reg-count');
  const bar = document.getElementById('bulk-actions-container');
  const checkAll = document.getElementById('check-all-reg');

  if (countEl) countEl.textContent = checked.length;
  if (bar) {
    if (checked.length > 0) {
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  const allCheckboxes = document.querySelectorAll('.reg-checkbox');
  if (checkAll && allCheckboxes.length > 0) {
    checkAll.checked = (checked.length === allCheckboxes.length);
  }
}

function cancelSelection() {
  document.querySelectorAll('.reg-checkbox').forEach(cb => {
    cb.checked = false;
  });
  const checkAll = document.getElementById('check-all-reg');
  if (checkAll) checkAll.checked = false;
  updateSelectedCount();
}

// 5.2. Hapus Pendaftar Satuan (Manual Delete)
async function deleteSingleRegistration(id, regCode, name) {
  if (!confirm(`Apakah Anda yakin ingin menghapus data peserta:\n\n• Nama: ${name}\n• No. Reg: ${regCode}\n\nData dan berkas bukti bayar akan dihapus permanen.`)) {
    return;
  }

  try {
    const res = await fetch(`api/admin.php?action=delete_registration&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ id })
    });
    const data = await res.json();

    if (data.status === 'ok') {
      alert(data.message || 'Pendaftar berhasil dihapus.');
      await loadRegistrations();
      await loadReports();
    } else {
      alert(data.message || 'Gagal menghapus pendaftar.');
    }
  } catch (err) {
    console.error('Error deleting registration:', err);
    alert('Terjadi kesalahan saat menghapus data pendaftar.');
  }
}

// 5.3. Hapus Banyak Pendaftar Sekaligus (Bulk Delete)
async function confirmBulkDelete() {
  const checked = [...document.querySelectorAll('.reg-checkbox:checked')];
  const ids = checked.map(cb => Number(cb.value)).filter(v => v > 0);

  if (ids.length === 0) {
    alert('Silakan pilih minimal satu pendaftar dengan mencentang kotak checklist.');
    return;
  }

  if (!confirm(`⚠️ KONFIRMASI HAPUS MASSAL:\n\nApakah Anda yakin ingin menghapus ${ids.length} data pendaftar yang dipilih?\n\nTindakan ini bersifat permanen dan tidak dapat dibatalkan.`)) {
    return;
  }

  try {
    const res = await fetch(`api/admin.php?action=bulk_delete_registrations&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();

    if (data.status === 'ok') {
      alert(data.message || 'Pendaftar terpilih berhasil dihapus.');
      cancelSelection();
      await loadRegistrations();
      await loadReports();
    } else {
      alert(data.message || 'Gagal menghapus pendaftar terpilih.');
    }
  } catch (err) {
    console.error('Error bulk deleting registrations:', err);
    alert('Terjadi kesalahan saat menghapus data terpilih.');
  }
}

// 6. Modal Verifikasi Bukti Bayar
function openModal(regId) {
  const reg = currentRegistrationList.find(item => item.id == regId);
  if (!reg) return;

  activeModalRegId = regId;
  document.getElementById('modal-reg-code').textContent = reg.reg_code;
  document.getElementById('modal-name').textContent = reg.participant_name;
  document.getElementById('modal-branch').textContent = reg.branch;
  document.getElementById('modal-school').textContent = `${reg.school_name} (${reg.region})`;
  document.getElementById('modal-notes').value = reg.admin_notes || '';
  const feeEl = document.getElementById('modal-fee');
  if (feeEl) {
    feeEl.textContent = reg.is_partner == 1 ? 'Gratis (Mitra)' : 'Rp ' + Number(reg.payment_amount || 75000).toLocaleString('id-ID');
  }

  const proofBox = document.getElementById('modal-proof-container');
  if (reg.payment_proof) {
    const ext = reg.payment_proof.split('.').pop().toLowerCase();
    const filePath = `uploads/bukti_transfer/${reg.payment_proof}`;
    if (ext === 'pdf') {
      proofBox.innerHTML = `
        <a href="${filePath}" target="_blank" class="inline-flex items-center gap-2 p-4 text-orange-600 font-bold hover:underline">
          <i data-lucide="file-text" class="w-6 h-6"></i> Buka Dokumen PDF Bukti Transfer
        </a>
      `;
    } else {
      proofBox.innerHTML = `
        <a href="${filePath}" target="_blank" title="Klik untuk memperbesar">
          <img src="${filePath}" alt="Bukti Transfer" class="max-h-52 mx-auto rounded-lg object-contain shadow-sm hover:opacity-90">
        </a>
        <span class="block text-[10px] text-slate-400 mt-1">Klik gambar untuk melihat resolusi penuh di tab baru</span>
      `;
    }
  } else {
    proofBox.innerHTML = '<p class="text-xs text-slate-400 py-4">Tidak ada lampiran bukti transfer (Gratis untuk Pelanggan Erlass).</p>';
  }

  document.getElementById('verify-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeModal() {
  document.getElementById('verify-modal').classList.add('hidden');
  activeModalRegId = null;
}

async function submitStatusUpdate(newStatus) {
  if (!activeModalRegId) return;
  const notes = document.getElementById('modal-notes').value.trim();

  try {
    const res = await fetch(`api/admin.php?action=update_status&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: activeModalRegId,
        status: newStatus,
        admin_notes: notes
      })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      closeModal();
      loadReports();
      loadRegistrations();
    } else {
      alert(data.message || 'Gagal memperbarui status');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat menyimpan update status.');
  }
}

// 7. Ganti Password Mandiri
function openChangePassModal() {
  document.getElementById('change-pass-error').classList.add('hidden');
  document.getElementById('change-pass-form').reset();
  document.getElementById('change-pass-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeChangePassModal() {
  document.getElementById('change-pass-modal').classList.add('hidden');
}

document.getElementById('change-pass-form').addEventListener('submit', async e => {
  e.preventDefault();
  const oldPass = document.getElementById('old_password').value;
  const newPass = document.getElementById('new_password').value;
  const confirmPass = document.getElementById('confirm_password').value;
  const errorBox = document.getElementById('change-pass-error');

  errorBox.classList.add('hidden');

  if (newPass !== confirmPass) {
    errorBox.textContent = 'Konfirmasi password baru tidak cocok!';
    errorBox.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`api/admin.php?action=change_password&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_password: oldPass, new_password: newPass })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      alert('Password berhasil diperbarui! Silakan gunakan password baru pada login berikutnya.');
      closeChangePassModal();
    } else {
      errorBox.textContent = data.message || 'Gagal mengubah password.';
      errorBox.classList.remove('hidden');
    }
  } catch (err) {
    errorBox.textContent = 'Terjadi kesalahan sistem.';
    errorBox.classList.remove('hidden');
  }
});

// 8. Ekspor CSV Laporan per Event
function exportCSV() {
  const branch = document.getElementById('filter-branch').value;
  const status = document.getElementById('filter-status').value;
  const url = `api/admin.php?action=export_csv&competition_id=${currentCompetitionId}&token=${encodeURIComponent(authToken)}&branch=${encodeURIComponent(branch)}&status=${encodeURIComponent(status)}`;
  window.open(url, '_blank');
}

// 9. Manajemen User Panitia (User Management)
let currentAdminUsers = [];
let currentLoggedInUserId = null;

function openUsersModal() {
  document.getElementById('users-modal').classList.remove('hidden');
  const msgBox = document.getElementById('create-user-msg');
  if (msgBox) msgBox.classList.add('hidden');
  loadAdminUsers();
  lucide.createIcons();
}

function closeUsersModal() {
  document.getElementById('users-modal').classList.add('hidden');
}

async function loadAdminUsers() {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Memuat data user...</td></tr>`;

  try {
    const res = await fetch(`api/admin.php?action=get_users&token=${encodeURIComponent(authToken)}`);
    const data = await res.json();
    if (data.status === 'ok') {
      currentAdminUsers = data.users || [];
      currentLoggedInUserId = data.current_user_id || null;
      renderAdminUsers(currentAdminUsers);
    } else {
      tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500 font-semibold">${data.message || 'Gagal memuat user.'}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500 font-semibold">Gagal memuat daftar user.</td></tr>`;
  }
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada akun panitia lain.</td></tr>`;
    return;
  }

  users.forEach(u => {
    const isMe = currentLoggedInUserId && u.id == currentLoggedInUserId;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 transition';

    // Role badge
    const roleBadge = u.role === 'superadmin' 
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-700">SUPERADMIN</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700">PANITIA</span>`;

    // Status badge
    const statusBadge = u.is_active == 1
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700">AKTIF</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700">NONAKTIF</span>`;

    // Action buttons
    let actionHtml = '';
    if (isMe) {
      actionHtml = `<span class="text-[11px] text-slate-400 font-bold italic">(Akun Anda)</span>`;
    } else {
      const toggleText = u.is_active == 1 ? 'Nonaktifkan' : 'Aktifkan';
      const toggleClass = u.is_active == 1 ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50';
      
      actionHtml = `
        <div class="flex items-center justify-end gap-1.5">
          <button type="button" onclick="toggleUserStatus(${u.id}, ${u.is_active}, '${escapeHtml(u.username)}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 ${toggleClass} transition">
            ${toggleText}
          </button>
          <button type="button" onclick="resetUserPassword(${u.id}, '${escapeHtml(u.username)}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition" title="Reset Password">
            Reset Password
          </button>
          ${u.id != 1 ? `
          <button type="button" onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" class="px-2 py-1 text-[11px] font-bold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition" title="Hapus User">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
          ` : ''}
        </div>
      `;
    }

    tr.innerHTML = `
      <td class="p-3">
        <div class="font-bold text-slate-800 text-xs">${escapeHtml(u.full_name || u.username)}</div>
        <div class="text-[11px] text-slate-400 font-mono">@${escapeHtml(u.username)}</div>
      </td>
      <td class="p-3">${roleBadge}</td>
      <td class="p-3">${statusBadge}</td>
      <td class="p-3 text-right">${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// Form Tambah User Panitia
const createUserForm = document.getElementById('create-user-form');
if (createUserForm) {
  createUserForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-user');
    const msgBox = document.getElementById('create-user-msg');
    msgBox.classList.add('hidden');

    const fullName = document.getElementById('new_user_fullname').value.trim();
    const username = document.getElementById('new_user_username').value.trim();
    const password = document.getElementById('new_user_password').value.trim();
    const role = document.getElementById('new_user_role').value;

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan...`;

    try {
      const res = await fetch(`api/admin.php?action=create_user&token=${encodeURIComponent(authToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          username: username,
          password: password,
          role: role
        })
      });
      const data = await res.json();
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Simpan & Tambah User</span>`;
      lucide.createIcons();

      if (data.status === 'ok') {
        msgBox.textContent = `User panitia @${username} berhasil dibuat! Password awal: ${password}`;
        msgBox.className = 'p-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 block';
        createUserForm.reset();
        document.getElementById('new_user_password').value = 'Erlass101.';
        loadAdminUsers();
      } else {
        msgBox.textContent = data.message || 'Gagal menambahkan user.';
        msgBox.className = 'p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 block';
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Simpan & Tambah User</span>`;
      lucide.createIcons();
      msgBox.textContent = 'Terjadi kesalahan sistem saat menghubungi server.';
      msgBox.className = 'p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 block';
    }
  });
}

// Toggle Aktif/Nonaktif User
async function toggleUserStatus(userId, currentStatus, username) {
  const actionText = currentStatus == 1 ? 'menonaktifkan' : 'mengaktifkan kembali';
  if (!confirm(`Apakah Anda yakin ingin ${actionText} akun panitia @${username}?`)) {
    return;
  }

  try {
    const res = await fetch(`api/admin.php?action=toggle_user_status&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      alert(data.message);
      loadAdminUsers();
    } else {
      alert(data.message || 'Gagal mengubah status user.');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat mengubah status user.');
  }
}

// Reset Password Panitia
async function resetUserPassword(userId, username) {
  const newPass = prompt(`Masukkan password baru untuk panitia @${username} (minimal 6 karakter):`, 'Erlass101.');
  if (newPass === null) return;

  if (newPass.trim().length < 6) {
    alert('Password baru minimal 6 karakter.');
    return;
  }

  try {
    const res = await fetch(`api/admin.php?action=reset_user_password&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, new_password: newPass.trim() })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      alert(`Password untuk @${username} berhasil direset menjadi: ${newPass.trim()}`);
      loadAdminUsers();
    } else {
      alert(data.message || 'Gagal mereset password.');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat mereset password user.');
  }
}

// Hapus User Panitia
async function deleteUser(userId, username) {
  if (!confirm(`Hapus permanen akun panitia @${username}? User ini tidak akan bisa login lagi.`)) {
    return;
  }

  try {
    const res = await fetch(`api/admin.php?action=delete_user&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      alert(`Akun panitia @${username} berhasil dihapus.`);
      loadAdminUsers();
    } else {
      alert(data.message || 'Gagal menghapus user.');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat menghapus user.');
  }
}

// ==========================================
// PENGUMPULAN PROYEK MANAGEMENT LOGIC
// ==========================================

let activeDashboardTab = 'registrations';

function switchDashboardTab(tabName) {
  activeDashboardTab = tabName;
  const btnRegs = document.getElementById('tab-btn-regs');
  const btnProjects = document.getElementById('tab-btn-projects');
  const viewRegs = document.getElementById('view-registrations');
  const viewProjects = document.getElementById('view-submissions');

  if (tabName === 'projects') {
    btnRegs.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-2';
    btnProjects.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-emerald-600 text-white shadow-sm transition flex items-center gap-2';
    viewRegs.classList.add('hidden');
    viewProjects.classList.remove('hidden');
    loadProjectSubmissions();
  } else {
    btnRegs.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-orange-600 text-white shadow-sm transition flex items-center gap-2';
    btnProjects.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-2';
    viewRegs.classList.remove('hidden');
    viewProjects.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

async function loadProjectSubmissions() {
  const tbody = document.getElementById('projects-table-body');
  if (!tbody) return;

  const branch = document.getElementById('proj-filter-branch').value;
  const gradeCat = document.getElementById('proj-filter-grade').value;
  const status = document.getElementById('proj-filter-status').value;
  const search = document.getElementById('proj-filter-search').value.trim();

  tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600"></i>Memuat data pengumpulan proyek...</td></tr>';
  if (window.lucide) lucide.createIcons();

  try {
    const url = `api/admin.php?action=get_project_submissions&token=${encodeURIComponent(authToken)}&branch=${encodeURIComponent(branch)}&grade_category=${encodeURIComponent(gradeCat)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'ok') {
      const stats = data.stats || {};
      document.getElementById('proj-stat-total').textContent = stats.total || 0;
      document.getElementById('proj-stat-scratch').textContent = stats.total_scratch || 0;
      document.getElementById('proj-stat-microbit').textContent = stats.total_microbit || 0;
      document.getElementById('proj-stat-erboblox').textContent = stats.total_erboblox || 0;
      document.getElementById('proj-stat-revision').textContent = stats.total_allow_revision || 0;

      const badgeCount = document.getElementById('badge-projects-count');
      if (badgeCount) badgeCount.textContent = stats.total || 0;

      const submissions = data.submissions || [];
      document.getElementById('proj-pagination-info').textContent = `Menampilkan ${submissions.length} proyek yang terkumpul`;

      if (submissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">Belum ada peserta yang mengumpulkan proyek untuk filter ini.</td></tr>';
        return;
      }

      let html = '';
      submissions.forEach((sub, idx) => {
        const isAllowRev = Number(sub.allow_revision) === 1;
        const versionBadge = sub.version > 1 
          ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">Versi ${sub.version} (Revisi)</span>`
          : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">Versi 1</span>`;

        const revStatusBadge = isAllowRev
          ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">Izin Revisi Aktif</span>`
          : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Terkunci (Final)</span>`;

        // File download button
        let fileBtn = '<span class="text-slate-400 italic">Tanpa file (Erboblox)</span>';
        if (sub.project_file_path) {
          const sizeKb = sub.project_file_size ? `${(sub.project_file_size / (1024 * 1024)).toFixed(2)} MB` : '';
          fileBtn = `
            <a href="${sub.project_file_path}" download class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 font-extrabold text-[11px] border border-orange-200 transition" title="Unduh Berkas Proyek">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Unduh File (${sizeKb})</span>
            </a>
          `;
        }

        // Video Links
        let videoLinks = `
          <a href="${sub.video_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-bold text-xs hover:underline">
            <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i> Video Utama
          </a>
        `;
        if (sub.backup_video_url) {
          videoLinks += `
            <a href="${sub.backup_video_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 text-[11px] hover:underline block mt-1">
              <i data-lucide="link" class="w-3 h-3"></i> Video Cadangan
            </a>
          `;
        }

        html += `
          <tr class="hover:bg-slate-50/70 transition">
            <td class="p-3.5 pl-5 font-bold text-slate-400">${idx + 1}</td>
            <td class="p-3.5 whitespace-nowrap">
              <span class="font-mono font-black text-orange-600 block text-xs">${sub.reg_code}</span>
              <span class="text-[10px] text-slate-400 block">${sub.submitted_at || '-'}</span>
            </td>
            <td class="p-3.5">
              <strong class="font-extrabold text-slate-900 block text-xs">${sub.participant_name}</strong>
              <span class="text-[11px] text-slate-600 block">${sub.school_name}</span>
              <span class="text-[10px] text-slate-400 block">WA: ${sub.phone || '-'}</span>
            </td>
            <td class="p-3.5 whitespace-nowrap">
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-orange-50 text-orange-800 border border-orange-200 block mb-1">
                ${sub.branch}
              </span>
              <span class="text-[10px] font-semibold text-slate-500">${sub.grade_category}</span>
            </td>
            <td class="p-3.5 max-w-xs">
              <strong class="text-xs font-bold text-slate-900 block truncate" title="${sub.project_title}">${sub.project_title}</strong>
              <p class="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed" title="${sub.project_description}">${sub.project_description}</p>
            </td>
            <td class="p-3.5 whitespace-nowrap">${fileBtn}</td>
            <td class="p-3.5 whitespace-nowrap">${videoLinks}</td>
            <td class="p-3.5 whitespace-nowrap space-y-1">
              <div>${versionBadge}</div>
              <div>${revStatusBadge}</div>
            </td>
            <td class="p-3.5 pr-5 text-right whitespace-nowrap no-print space-x-1">
              <button
                type="button"
                onclick="toggleProjectRevision(${sub.id}, ${isAllowRev ? 1 : 0}, '${sub.reg_code}', '${sub.participant_name.replace(/'/g, "\\'")}')"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${isAllowRev ? 'bg-amber-100 hover:bg-amber-200 text-amber-900' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'} transition"
                title="${isAllowRev ? 'Kunci kembali formulir peserta' : 'Beri izin peserta mengunggah ulang / merevisi karya'}"
              >
                <i data-lucide="${isAllowRev ? 'lock' : 'unlock'}" class="w-3.5 h-3.5"></i>
                <span>${isAllowRev ? 'Kunci Revisi' : 'Beri Izin Revisi'}</span>
              </button>
              <button
                type="button"
                onclick="deleteProjectSubmission(${sub.id}, '${sub.reg_code}', '${sub.participant_name.replace(/'/g, "\\'")}')"
                class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                title="Hapus data proyek ini"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-red-600 text-xs">Gagal memuat data pengumpulan proyek.</td></tr>';
  }
}

async function toggleProjectRevision(id, currentAllow, regCode, name) {
  const willAllow = currentAllow === 0;
  const actionPrompt = willAllow 
    ? `Beri izin peserta ${name} (${regCode}) untuk mengunggah ulang / merevisi proyek?\n\n(Opsional) Berikan catatan arahan revisi untuk peserta:`
    : `Kunci kembali formulir proyek peserta ${name} (${regCode})?`;

  const notes = willAllow ? prompt(actionPrompt, '') : '';
  if (willAllow && notes === null) return; // User cancel

  try {
    const res = await fetch(`api/admin.php?action=toggle_project_revision&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id,
        allow_revision: willAllow ? 1 : 0,
        admin_notes: notes || ''
      })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      alert(data.message);
      loadProjectSubmissions();
    } else {
      alert(data.message || 'Gagal mengubah status izin revisi.');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat mengubah izin revisi.');
  }
}

async function deleteProjectSubmission(id, regCode, name) {
  if (!confirm(`Hapus permanen berkas dan data pengumpulan proyek untuk peserta ${name} (${regCode})?\n\nPerhatian: Tindakan ini tidak dapat dibatalkan.`)) {
    return;
  }

  try {
    const res = await fetch(`api/admin.php?action=delete_project_submission&token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      alert(data.message);
      loadProjectSubmissions();
    } else {
      alert(data.message || 'Gagal menghapus proyek.');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat menghapus data proyek.');
  }
}

function exportProjectCSV() {
  window.location.href = `api/admin.php?action=export_project_submissions&token=${encodeURIComponent(authToken)}`;
}

// Global Window Bindings untuk memastikan fungsi inline onclick HTML selalu dapat diakses
window.openNewCompModal = openNewCompModal;
window.closeNewCompModal = closeNewCompModal;
window.openUsersModal = openUsersModal;
window.closeUsersModal = closeUsersModal;
window.loadAdminUsers = loadAdminUsers;
window.toggleUserStatus = toggleUserStatus;
window.resetUserPassword = resetUserPassword;
window.deleteUser = deleteUser;
window.openChangePassModal = openChangePassModal;
window.closeChangePassModal = closeChangePassModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchCompetition = switchCompetition;
window.loadReports = loadReports;
window.loadRegistrations = loadRegistrations;
window.exportCSV = exportCSV;
window.logoutAdmin = logoutAdmin;
window.deleteSingleRegistration = deleteSingleRegistration;
window.confirmBulkDelete = confirmBulkDelete;
window.toggleSelectAll = toggleSelectAll;
window.updateSelectedCount = updateSelectedCount;
window.cancelSelection = cancelSelection;

window.switchDashboardTab = switchDashboardTab;
window.loadProjectSubmissions = loadProjectSubmissions;
window.toggleProjectRevision = toggleProjectRevision;
window.deleteProjectSubmission = deleteProjectSubmission;
window.exportProjectCSV = exportProjectCSV;

// Event Listeners Filter Registrasi
document.getElementById('filter-branch').addEventListener('change', loadRegistrations);
document.getElementById('filter-status').addEventListener('change', loadRegistrations);
document.getElementById('filter-partner').addEventListener('change', loadRegistrations);
let searchTimeout;
document.getElementById('filter-search').addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadRegistrations, 300);
});

// Event Listeners Filter Proyek
document.getElementById('proj-filter-branch').addEventListener('change', loadProjectSubmissions);
document.getElementById('proj-filter-grade').addEventListener('change', loadProjectSubmissions);
document.getElementById('proj-filter-status').addEventListener('change', loadProjectSubmissions);
let projSearchTimeout;
document.getElementById('proj-filter-search').addEventListener('input', () => {
  clearTimeout(projSearchTimeout);
  projSearchTimeout = setTimeout(loadProjectSubmissions, 300);
});

document.addEventListener('DOMContentLoaded', checkAuth);

