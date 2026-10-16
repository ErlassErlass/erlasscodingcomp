/**
 * Erlass Competition 2026 - Client Application
 * PT. Erlass Prokreatif Indonesia
 */

let currentStep = 1;
let competitionData = null;
let selectedSchool = null;
let selectedFile = null;
let searchDebounceTimer = null;

const form = document.getElementById('registration-form');
const messageBox = document.getElementById('form-message');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('bukti_transfer');

// Helper show message
function showMessage(text, type = 'error') {
  messageBox.textContent = text;
  messageBox.className = `mb-6 items-center gap-2 rounded-xl p-4 text-sm font-semibold flex ${
    type === 'error'
      ? 'bg-red-50 text-red-700 border border-red-200'
      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  }`;
  messageBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearMessage() {
  messageBox.className = 'hidden mb-6 items-center gap-2 rounded-xl p-4 text-sm font-semibold';
  messageBox.textContent = '';
}

// 1. Inisialisasi Data dari API
async function initApp() {
  try {
    const res = await fetch('api/public.php?action=get_competition');
    const data = await res.json();
    if (data.status === 'ok') {
      competitionData = data.competition;

      // Populate info kompetisi ke halaman
      if (competitionData) {
        const badgeEl = document.getElementById('badge-title');
        if (badgeEl) badgeEl.textContent = `${competitionData.title} • Open Registration`;
        
        const heroTitle = document.getElementById('hero-title');
        if (heroTitle) heroTitle.textContent = competitionData.theme || 'Technology for a Better Today';
        
        const heroTheme = document.getElementById('hero-theme');
        if (heroTheme) heroTheme.textContent = competitionData.tagline || 'Create, Code, and Innovate for a Better Future';
        
        const bankName = document.getElementById('bank-name-text');
        if (bankName) bankName.textContent = competitionData.bank_name || 'Bank Mandiri';
        
        const bankAcc = document.getElementById('bank-account-text');
        if (bankAcc) bankAcc.textContent = competitionData.bank_account || '129-000-742-767-3';
        
        const bankHolder = document.getElementById('bank-holder-text');
        if (bankHolder) bankHolder.textContent = `a/n ${competitionData.bank_holder || 'PT. Erlass Prokreatif Indonesia'}`;
        
        const btnWa = document.getElementById('btn-wa-group');
        if (btnWa && competitionData.whatsapp_group_url) {
          btnWa.href = competitionData.whatsapp_group_url;
        }
      }
    }
  } catch (err) {
    console.error('Error fetching competition data:', err);
  }

  initSchoolSearch();
  initCartoonScroll();
  lucide.createIcons();
}

// 2. Pencarian Sekolah Nasional Instan (NPSN & Nama Sekolah)
function initSchoolSearch() {
  const searchInput = document.getElementById('school-search-input');
  const dropdown = document.getElementById('school-dropdown');
  const clearBtn = document.getElementById('clear-search-btn');
  const card = document.getElementById('school-selected-card');
  const changeBtn = document.getElementById('change-school-btn');
  const toggleManualBtn = document.getElementById('toggle-manual-school-btn');
  const manualContainer = document.getElementById('manual-school-container');
  const closeManualBtn = document.getElementById('close-manual-school-btn');
  const applyManualBtn = document.getElementById('apply-manual-school-btn');

  if (!searchInput || !dropdown) return;

  // Real-time debounce autocomplete
  searchInput.addEventListener('input', function () {
    const q = this.value.trim();
    if (clearBtn) clearBtn.classList.toggle('hidden', q.length === 0);
    clearTimeout(searchDebounceTimer);

    if (q.length < 2) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`api/public.php?action=search_schools&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.status === 'ok') {
          renderSchoolResults(data.schools || []);
        }
      } catch (err) {
        console.error('Error searching schools:', err);
      }
    }, 160);
  });

  searchInput.addEventListener('focus', function () {
    if (this.value.trim().length >= 2 && dropdown.children.length > 0) {
      dropdown.classList.remove('hidden');
    }
  });

  // Render rekomendasi instan: Nama Sekolah, Jenjang (SD/SMP), NPSN, Kota/Kabupaten
  function renderSchoolResults(schools) {
    dropdown.innerHTML = '';

    if (!schools || schools.length === 0) {
      dropdown.innerHTML = `
        <div class="p-4 text-center text-xs text-slate-500">
          Sekolah tidak ditemukan untuk kata kunci ini. Silakan coba kata kunci lain atau gunakan menu <strong class="text-orange-600">Ketik manual</strong> di bawah.
        </div>
      `;
      dropdown.classList.remove('hidden');
      return;
    }

    schools.forEach(item => {
      const row = document.createElement('div');
      row.className = 'school-item';
      
      const jenjangBadgeClass = item.jenjang === 'SMP'
        ? 'bg-purple-100 text-purple-800'
        : 'bg-blue-100 text-blue-800';

      row.innerHTML = `
        <div class="font-bold text-sm text-slate-900 leading-snug">${item.school_name}</div>
        <div class="flex items-center gap-2 mt-1.5 flex-wrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${jenjangBadgeClass}">${item.jenjang}</span>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">NPSN: ${item.npsn}</span>
          <span class="text-[11px] text-slate-500 flex items-center gap-1">
            <i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i> ${item.city || '-'}
          </span>
        </div>
      `;

      row.addEventListener('click', () => {
        selectSchool(item);
      });

      dropdown.appendChild(row);
    });

    dropdown.classList.remove('hidden');
    lucide.createIcons();
  }

  // Pilih sekolah terpilih
  function selectSchool(item) {
    selectedSchool = item;
    dropdown.classList.add('hidden');

    // Simpan ke hidden inputs
    document.getElementById('selected_school_npsn_val').value = item.npsn || '';
    document.getElementById('selected_school_name_val').value = item.school_name || '';
    document.getElementById('selected_school_city_val').value = item.city || '';
    document.getElementById('selected_school_jenjang_val').value = item.jenjang || '';
    document.getElementById('selected_school_is_partner_val').value = Number(item.is_partner) === 1 ? '1' : '0';
    document.getElementById('selected_school_partnership_val').value = Number(item.is_partner) === 1 
      ? 'Siswa Aktif / Sekolah Pelanggan Erlass' 
      : 'Non-Pelanggan Erlass (UMUM)';

    // Update kartu preview sekolah
    const jenjangEl = document.getElementById('selected-school-jenjang');
    if (jenjangEl) {
      jenjangEl.textContent = item.jenjang;
      jenjangEl.className = `inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold ${
        item.jenjang === 'SMP' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
      }`;
    }

    const npsnEl = document.getElementById('selected-school-npsn');
    if (npsnEl) npsnEl.textContent = `NPSN: ${item.npsn || '-'}`;

    const nameEl = document.getElementById('selected-school-name');
    if (nameEl) nameEl.textContent = item.school_name;

    const locEl = document.getElementById('selected-school-location');
    if (locEl) {
      const prov = item.province ? ` • ${item.province}` : '';
      locEl.innerHTML = `<i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> <span>${item.city || '-'}${prov}</span>`;
    }

    // Update ringkasan di Step 3
    const s3Summary = document.getElementById('step3-school-summary');
    if (s3Summary) {
      s3Summary.textContent = `${item.school_name} (${item.jenjang}) - NPSN: ${item.npsn || '-'}`;
    }

    // Tampilkan kartu terpilih dan sembunyikan kotak input pencarian
    searchInput.parentElement.classList.add('hidden');
    card.classList.remove('hidden');
    clearMessage();
    lucide.createIcons();
  }

  // Tombol Ganti Sekolah
  if (changeBtn) {
    changeBtn.addEventListener('click', () => {
      selectedSchool = null;
      document.getElementById('selected_school_npsn_val').value = '';
      document.getElementById('selected_school_name_val').value = '';
      document.getElementById('selected_school_city_val').value = '';
      document.getElementById('selected_school_jenjang_val').value = '';
      document.getElementById('selected_school_is_partner_val').value = '0';
      document.getElementById('selected_school_partnership_val').value = 'Non-Pelanggan Erlass (UMUM)';

      card.classList.add('hidden');
      searchInput.parentElement.classList.remove('hidden');
      searchInput.focus();
      searchInput.select();
    });
  }

  // Tombol Hapus teks pencarian (X)
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      dropdown.classList.add('hidden');
      searchInput.focus();
    });
  }

  // Tutup dropdown jika klik di luar
  document.addEventListener('click', e => {
    if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
      dropdown.classList.add('hidden');
    }
  });

  // Menu Input Manual Data Sekolah
  if (toggleManualBtn && manualContainer) {
    toggleManualBtn.addEventListener('click', () => {
      manualContainer.classList.toggle('hidden');
    });
  }

  if (closeManualBtn && manualContainer) {
    closeManualBtn.addEventListener('click', () => {
      manualContainer.classList.add('hidden');
    });
  }

  if (applyManualBtn) {
    applyManualBtn.addEventListener('click', () => {
      const jnj = document.getElementById('manual-jenjang').value;
      const npsn = document.getElementById('manual-npsn').value.trim() || '-';
      const city = document.getElementById('manual-city').value.trim().toUpperCase();
      const name = document.getElementById('manual-name').value.trim().toUpperCase();

      if (!city || !name) {
        showMessage('Harap masukkan Kota/Kabupaten dan Nama Lengkap Sekolah.');
        return;
      }

      selectSchool({
        id: 0,
        npsn: npsn,
        school_name: name,
        jenjang: jnj,
        city: city,
        province: '',
        is_partner: 0
      });

      manualContainer.classList.add('hidden');
    });
  }
}

// Inisialisasi Animasi Scroll Bergaya Kartun
function initCartoonScroll() {
  const reveals = document.querySelectorAll('.cartoon-reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('revealed'));
  }
}

// 3. Navigasi Wizard Form
function updateStep(step) {
  currentStep = step;

  // Toggle step panes
  document.querySelectorAll('.step-pane').forEach(pane => {
    pane.classList.toggle('active', Number(pane.dataset.step) === step);
  });

  // Update dots indicator
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('dot-' + i);
    if (!dot) continue;
    if (i < step) {
      dot.className = 'progress-dot done';
    } else if (i === step) {
      dot.className = 'progress-dot active';
    } else {
      dot.className = 'progress-dot inactive';
    }
  }

  // Buttons visibility
  document.getElementById('back-button').classList.toggle('hidden', step === 1);
  document.getElementById('next-button').classList.toggle('hidden', step === 4);
  document.getElementById('submit-button').classList.toggle('hidden', step !== 4);

  // Jika sampai di step 4, siapkan ringkasan review
  if (step === 4) {
    populateReviewData();
  }

  clearMessage();
  lucide.createIcons();
}

function isStepValid() {
  const pane = document.querySelector(`.step-pane[data-step="${currentStep}"]`);
  const requiredInputs = [...pane.querySelectorAll('[required]')];

  for (const input of requiredInputs) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return false;
    }
  }

  if (currentStep === 1) {
    const phone = document.getElementById('nomor_telepon').value.trim();
    if (phone.length < 9) {
      showMessage('Nomor WhatsApp harus valid minimal 9 digit angka.');
      return false;
    }
  }

  if (currentStep === 2) {
    const branch = form.querySelector('input[name="cabang_kompetisi"]:checked');
    if (!branch) {
      showMessage('Silakan pilih cabang kompetisi yang ingin diikuti.');
      return false;
    }

    if (!selectedSchool || !document.getElementById('selected_school_name_val').value) {
      showMessage('Silakan cari dan pilih sekolah asal peserta pada kolom pencarian.');
      const searchInput = document.getElementById('school-search-input');
      if (searchInput) searchInput.focus();
      return false;
    }
  }

  if (currentStep === 3) {
    if (!selectedFile) {
      showMessage('Bukti transfer pembayaran (Rp 75.000) wajib diunggah sebelum melanjutkan.');
      return false;
    }
  }

  return true;
}

// Auto Calculate Age from Birthdate
document.getElementById('tanggal_lahir').addEventListener('change', function () {
  if (!this.value) return;
  const birth = new Date(this.value);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  if (age > 0 && age < 30) {
    document.getElementById('usia').value = age;
  }
});

// Setup File Upload & Drag-Drop (Step 3)
if (dropzone) {
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
}

if (fileInput) {
  fileInput.addEventListener('change', function () {
    if (this.files.length) {
      handleFile(this.files[0]);
    }
  });
}

function handleFile(file) {
  if (file.size > 8 * 1024 * 1024) {
    showMessage('Ukuran berkas melebihi 8MB. Harap gunakan foto/berkas yang lebih kecil.');
    return;
  }
  selectedFile = file;
  document.getElementById('transfer-file-name').textContent = file.name;
  document.getElementById('upload-prompt').classList.add('hidden');
  document.getElementById('file-preview-container').classList.remove('hidden');

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      const preview = document.getElementById('image-preview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById('image-preview').classList.add('hidden');
  }
  clearMessage();
}

function resetFile() {
  selectedFile = null;
  fileInput.value = '';
  document.getElementById('upload-prompt').classList.remove('hidden');
  document.getElementById('file-preview-container').classList.add('hidden');
}

function copyBankAccount(acc) {
  const account = acc || '1290007427673';
  navigator.clipboard.writeText(account).then(() => {
    alert('Nomor rekening Bank Mandiri berhasil disalin: 129-000-742-767-3');
  });
}

function copyTransferNote() {
  const note = 'Lomba Erlass 2026';
  navigator.clipboard.writeText(note).then(() => {
    alert('Teks berita transfer berhasil disalin: "' + note + '"\n\nPastikan kolom berita transfer di ATM atau Mobile Banking telah terisi saat transaksi.');
  });
}

function selectBranch(branchName) {
  const radio = form.querySelector(`input[name="cabang_kompetisi"][value="${branchName}"]`);
  if (radio) {
    radio.checked = true;
  }
  document.getElementById('daftar').scrollIntoView({ behavior: 'smooth' });
}

// Populate data pada step 4 (Review)
function populateReviewData() {
  document.getElementById('review-name').textContent = document.getElementById('nama_lengkap').value || '-';
  const branch = form.querySelector('input[name="cabang_kompetisi"]:checked');
  document.getElementById('review-branch').textContent = branch ? branch.value : '-';

  const isCust = selectedSchool && Number(selectedSchool.is_partner) === 1;

  document.getElementById('review-category').textContent = selectedSchool 
    ? `${selectedSchool.jenjang} • ${selectedSchool.city || '-'}`
    : '-';
  
  const schoolText = selectedSchool
    ? `${selectedSchool.school_name} (NPSN: ${selectedSchool.npsn || '-'})`
    : '-';
  document.getElementById('review-school').textContent = schoolText;

  const paymentEl = document.getElementById('review-payment');
  if (isCust) {
    paymentEl.textContent = 'Bebas Biaya Pendaftaran (Sekolah Rekanan)';
    paymentEl.className = 'font-bold text-emerald-600';
  } else {
    paymentEl.textContent = 'Rp 75.000 (Mandiri - Berita: Lomba Erlass 2026)';
    paymentEl.className = 'font-bold text-orange-600';
  }
}

// Next & Back Buttons dengan Logic Lompat Dinamis
document.getElementById('next-button').addEventListener('click', () => {
  if (!isStepValid()) return;

  // JIKA DI STEP 2:
  // Mitra Erlass (is_partner == 1): LANGSUNG LOMPAT KE STEP 4 (Lewati Step 3 Pembayaran)
  // Non-Mitra (is_partner == 0): MASUK KE STEP 3 PEMBAYARAN MANDIRI
  if (currentStep === 2) {
    if (selectedSchool && Number(selectedSchool.is_partner) === 1) {
      updateStep(4);
      return;
    } else {
      updateStep(3);
      return;
    }
  }

  updateStep(currentStep + 1);
});

document.getElementById('back-button').addEventListener('click', () => {
  // JIKA DI STEP 4:
  // Mitra Erlass (is_partner == 1): KEMBALI LANGSUNG KE STEP 2
  // Non-Mitra (is_partner == 0): KEMBALI KE STEP 3
  if (currentStep === 4) {
    if (selectedSchool && Number(selectedSchool.is_partner) === 1) {
      updateStep(2);
      return;
    } else {
      updateStep(3);
      return;
    }
  }

  updateStep(currentStep - 1);
});

// Submit Form Pendaftaran
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!isStepValid()) return;

  const submitBtn = document.getElementById('submit-button');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan...';
  lucide.createIcons();

  const isCust = selectedSchool && Number(selectedSchool.is_partner) === 1;

  const formData = new FormData();
  formData.append('competition_id', competitionData ? competitionData.id : 1);
  formData.append('nama_lengkap', document.getElementById('nama_lengkap').value.trim());
  formData.append('jenis_kelamin', form.querySelector('input[name="jenis_kelamin"]:checked').value);
  formData.append('tanggal_lahir', document.getElementById('tanggal_lahir').value);
  formData.append('usia', document.getElementById('usia').value.trim());
  formData.append('kelas', document.getElementById('kelas').value);
  formData.append('nomor_telepon', document.getElementById('nomor_telepon').value.trim());
  formData.append('alamat', document.getElementById('alamat').value.trim());

  formData.append('cabang_kompetisi', form.querySelector('input[name="cabang_kompetisi"]:checked').value);
  formData.append('nama_sekolah', selectedSchool ? selectedSchool.school_name : '');
  formData.append('npsn', selectedSchool ? (selectedSchool.npsn || '') : '');
  formData.append('wilayah', selectedSchool ? (selectedSchool.city || '') : '');
  formData.append('status_kemitraan', isCust ? 'Siswa Aktif / Sekolah Pelanggan Erlass' : 'Non-Pelanggan Erlass (UMUM)');

  if (!isCust && selectedFile) {
    formData.append('bukti_transfer', selectedFile);
  }

  try {
    const response = await fetch('api/public.php?action=register', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();

    if (result.status === 'ok') {
      // Tampilkan layar sukses & e-badge kartu peserta
      form.classList.add('hidden');
      const successScreen = document.getElementById('success-screen');
      successScreen.classList.remove('hidden');

      const data = result.data;
      document.getElementById('card-reg-code').textContent = data.reg_code;
      document.getElementById('card-name').textContent = data.participant_name;
      document.getElementById('card-branch').textContent = data.branch;
      document.getElementById('card-school').textContent = data.school_name;
      document.getElementById('card-phone').textContent = document.getElementById('nomor_telepon').value.trim();

      const badgeStatus = document.getElementById('card-badge-status');
      if (data.is_partner) {
        badgeStatus.textContent = 'TERDAFTAR RESMI';
        badgeStatus.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
      } else {
        badgeStatus.textContent = 'MENUNGGU VERIFIKASI';
        badgeStatus.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800';
      }

      for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById('dot-' + i);
        if (dot) dot.className = 'progress-dot done';
      }

      // Proteksi pengingat sebelum menutup tab
      window.addEventListener('beforeunload', preventAccidentalExit);

      successScreen.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      showMessage(result.message || 'Pendaftaran belum berhasil dikirim.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Kirim Pendaftaran Sekarang';
      lucide.createIcons();
    }
  } catch (err) {
    console.error(err);
    showMessage('Terjadi gangguan koneksi ke server. Silakan coba kembali.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Kirim Pendaftaran Sekarang';
    lucide.createIcons();
  }
});

function preventAccidentalExit(e) {
  e.preventDefault();
  e.returnValue = 'Pastikan Anda telah mencetak/menyimpan Kartu Peserta dan bergabung ke Grup WhatsApp sebelum menutup halaman!';
  return e.returnValue;
}

// Cek Status Pendaftaran Mandiri (Khusus Kode Registrasi Peserta)
document.getElementById('btn-check-status').addEventListener('click', async () => {
  const query = document.getElementById('check-query').value.trim();
  const container = document.getElementById('check-result-container');
  if (!query) {
    alert('Masukkan Kode Registrasi Peserta Anda terlebih dahulu (Contoh: E-1026-0001).');
    return;
  }

  container.innerHTML = '<p class="text-sm text-center text-slate-500 py-4"><i data-lucide="loader" class="w-4 h-4 animate-spin inline mr-1"></i> Mencari data kode registrasi...</p>';
  container.classList.remove('hidden');
  lucide.createIcons();

  try {
    const res = await fetch(`api/public.php?action=check_status&query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.status === 'ok' && data.results && data.results.length > 0) {
      let html = '<div class="space-y-4">';
      data.results.forEach(item => {
        let badgeColor = 'bg-amber-100 text-amber-800';
        let badgeText = 'Menunggu Verifikasi Bukti Bayar';
        if (item.payment_status === 'verified') {
          badgeColor = 'bg-emerald-100 text-emerald-800';
          badgeText = 'Terkonfirmasi (Lolos Berkas)';
        } else if (item.payment_status === 'rejected') {
          badgeColor = 'bg-red-100 text-red-800';
          badgeText = 'Ditolak: ' + (item.admin_notes || 'Bukti bayar tidak sesuai');
        }

        html += `
          <div class="participant-card rounded-2xl p-5 border border-orange-200 shadow-sm text-left">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-orange-100 pb-3 mb-3">
              <div>
                <span class="text-xs font-mono font-black text-orange-600 block">${item.reg_code}</span>
                <h4 class="font-extrabold text-base text-slate-900">${item.participant_name}</h4>
              </div>
              <span class="text-xs font-bold px-3 py-1 rounded-full ${badgeColor}">${badgeText}</span>
            </div>
            <div class="grid sm:grid-cols-3 gap-2 text-xs text-slate-600 mb-3">
              <div><strong class="text-slate-800">Cabang:</strong> ${item.branch}</div>
              <div><strong class="text-slate-800">Sekolah:</strong> ${item.school_name} (${item.region || '-'})</div>
              <div><strong class="text-slate-800">NPSN:</strong> ${item.npsn || '-'}</div>
            </div>
            <div class="pt-2 border-t border-orange-50 flex items-center justify-between text-xs">
              <span class="text-slate-400">Terdaftar: ${item.created_at}</span>
              <a href="${item.whatsapp_group_url || 'https://chat.whatsapp.com/ErlassCompetition2026'}" target="_blank" class="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1">
                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> Grup WhatsApp
              </a>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } else {
      container.innerHTML = `
        <div class="p-4 rounded-xl bg-red-50 text-red-700 text-xs sm:text-sm text-center border border-red-200">
          Data pendaftaran tidak ditemukan untuk kode registrasi: <strong>${query}</strong>.<br>
          Pastikan Anda memasukkan Kode Registrasi resmi dengan format yang benar (contoh: E-1026-0001).
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = '<div class="p-4 text-center text-xs text-red-600">Gagal terhubung ke server pendaftaran.</div>';
  }
  lucide.createIcons();
});

// Bind helpers to window
window.copyBankAccount = copyBankAccount;
window.copyTransferNote = copyTransferNote;
window.resetFile = resetFile;
window.selectBranch = selectBranch;

document.addEventListener('DOMContentLoaded', initApp);
