/**
 * app-improvements.js  v2
 * Dimuat SETELAH app.js — berisi semua perbaikan dan fitur baru.
 */

// ============================================================
// 1. TERJEMAHAN ERROR FIREBASE KE BAHASA INDONESIA
// ============================================================
window.translateFirebaseError = (code) => {
  const map = {
    'auth/email-already-in-use': 'Email sudah terdaftar. Silakan login atau gunakan email lain.',
    'auth/wrong-password': 'Password salah. Periksa kembali password Anda.',
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/user-not-found': 'Email tidak terdaftar dalam sistem.',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/weak-password': 'Password terlalu lemah. Gunakan minimal 6 karakter.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit.',
    'auth/network-request-failed': 'Koneksi internet bermasalah. Periksa jaringan Anda.',
    'auth/user-disabled': 'Akun ini telah dinonaktifkan. Hubungi admin.',
    'auth/requires-recent-login': 'Sesi habis. Silakan login ulang.',
    'auth/popup-closed-by-user': 'Login dibatalkan oleh pengguna.',
    'permission-denied': 'Anda tidak punya akses ke fitur ini.',
    'unavailable': 'Layanan sedang tidak tersedia. Coba lagi.',
    'not-found': 'Data tidak ditemukan.',
    'already-exists': 'Data sudah ada.',
  };
  return map[code] || map[String(code || '').split('/').pop()] || null;
};

// ============================================================
// 2. MODAL KONFIRMASI ESTETIS (Ganti confirm() bawaan browser)
// ============================================================
window.showConfirm = (opts) => {
  return new Promise((resolve) => {
    const {
      title = 'Konfirmasi',
      message = '',
      confirmText = 'Ya, Lanjutkan',
      cancelText = 'Batal',
      danger = false,
    } = typeof opts === 'string' ? { message: opts } : opts;

    const old = document.getElementById('_confirm-modal-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = '_confirm-modal-overlay';
    overlay.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm';
    overlay.style.cssText = 'animation: fadeIn 0.15s ease';

    const iconColor = danger
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    const icon = danger ? 'fa-exclamation-triangle' : 'fa-question-circle';
    const btnOk = danger
      ? 'bg-red-600 hover:bg-red-500 shadow-[0_4px_15px_rgba(239,68,68,0.3)]'
      : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_4px_15px_rgba(99,102,241,0.3)]';

    overlay.innerHTML = `
      <div style="background:rgba(14,18,37,0.97);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);animation:slideDown .2s ease"
           class="w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
        <div class="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl border ${iconColor}">
          <i class="fas ${icon}"></i>
        </div>
        <h3 class="font-black text-white text-base mb-2 uppercase tracking-wide">${title}</h3>
        <p class="text-[11px] text-slate-400 leading-relaxed mb-6">${message}</p>
        <div class="flex gap-3">
          <button id="_confirm-cancel"
            class="flex-1 py-3 rounded-xl text-slate-300 font-bold text-xs uppercase tracking-wider transition-all border border-white/10"
            style="background:rgba(255,255,255,0.05)"
            onmouseover="this.style.background='rgba(255,255,255,0.1)'"
            onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            ${cancelText}
          </button>
          <button id="_confirm-ok"
            class="flex-1 py-3 rounded-xl text-white font-black text-xs uppercase tracking-wider transition-all ${btnOk}">
            ${confirmText}
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = (result) => { overlay.remove(); resolve(result); };
    document.getElementById('_confirm-ok').onclick = () => close(true);
    document.getElementById('_confirm-cancel').onclick = () => close(false);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
  });
};

// ============================================================
// 3. GUARD DUPLIKASI loadDataRealtime() — Cegah Memory Leak
//    Jika dipanggil lebih dari sekali (tanpa page reload),
//    listener Firestore akan berlipat ganda. Guard ini mencegahnya.
// ============================================================
(function patchLoadDataRealtime() {
  const _orig = window.loadDataRealtime;
  if (!_orig) return;

  let _called = false;
  window.loadDataRealtime = function() {
    if (_called) {
      console.warn('[improvements] loadDataRealtime() dipanggil lebih dari sekali — diblokir untuk mencegah duplikasi listener.');
      return;
    }
    _called = true;
    _orig();
  };
})();

// ============================================================
// 4. DEBOUNCE renderAllTabs() — Cegah burst re-render
// ============================================================
(function patchRenderDebounce() {
  const _orig = window.renderAllTabs;
  if (!_orig) return;

  let debounceTimer;
  window.renderAllTabs = function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { _orig(); }, 150);
  };
})();

// ============================================================
// 5. PATCH: Ganti confirm() dengan showConfirm() estetis
// ============================================================
(function patchConfirmCalls() {
  // Patch deleteUser
  const _origDeleteUser = window.deleteUser;
  if (_origDeleteUser) {
    window.deleteUser = async function(uid) {
      const ok = await window.showConfirm({
        title: 'Hapus Pengguna?',
        message: 'Yakin ingin menghapus pengguna ini dari sistem secara permanen? Tindakan ini tidak dapat dibatalkan.',
        confirmText: 'Ya, Hapus', danger: true,
      });
      if (!ok) return;
      const orig = window.confirm; window.confirm = () => true;
      try { await _origDeleteUser(uid); } finally { window.confirm = orig; }
    };
  }

  // Patch deleteTugas
  const _origDeleteTugas = window.deleteTugas;
  if (_origDeleteTugas) {
    window.deleteTugas = async function(id) {
      const ok = await window.showConfirm({
        title: 'Hapus Tugas?',
        message: 'Yakin ingin menghapus tugas ini?',
        confirmText: 'Ya, Hapus', danger: true,
      });
      if (!ok) return;
      const orig = window.confirm; window.confirm = () => true;
      try { await _origDeleteTugas(id); } finally { window.confirm = orig; }
    };
  }

  // Patch updateUserRole (konfirmasi transfer creator & jadikan admin)
  const _origUpdateUserRole = window.updateUserRole;
  if (_origUpdateUserRole) {
    window.updateUserRole = async function(uid, newRole) {
      if (newRole === 'creator' && window.STATE?.user?.uid !== uid) {
        const ok = await window.showConfirm({
          title: '⚠️ Wariskan Tahta Creator?',
          message: 'PERINGATAN: Mewariskan tahta Creator berarti <strong>Anda akan turun menjadi Admin biasa</strong> dan tidak dapat diubah kembali.',
          confirmText: 'Ya, Wariskan', danger: true,
        });
        if (!ok) { window.renderUsers?.(); return; }
      } else if (newRole === 'admin_utama') {
        const ok = await window.showConfirm({
          title: 'Jadikan Admin Utama?',
          message: 'Pengguna ini akan mendapatkan akses penuh ke semua fitur manajemen. Lanjutkan?',
          confirmText: 'Ya, Jadikan Admin',
        });
        if (!ok) { window.renderUsers?.(); return; }
      }
      const orig = window.confirm; window.confirm = () => true;
      try { await _origUpdateUserRole(uid, newRole); } finally { window.confirm = orig; }
    };
  }

  // Patch restoreDataFromExcel
  const _origRestore = window.restoreDataFromExcel;
  if (_origRestore) {
    window.restoreDataFromExcel = async function(event) {
      const file = event.target.files[0];
      if (!file) return;
      const ok = await window.showConfirm({
        title: '⚠️ Pulihkan Cadangan?',
        message: 'Memulihkan cadangan akan <strong>menggabungkan/menimpa data</strong> di Firestore. Pastikan backup terbaru sudah ada!',
        confirmText: 'Ya, Pulihkan', danger: true,
      });
      if (!ok) { event.target.value = ''; return; }
      const orig = window.confirm; window.confirm = () => true;
      const dt = new DataTransfer(); dt.items.add(file);
      try { await _origRestore({ target: { files: dt.files, value: '' } }); }
      finally { window.confirm = orig; }
    };
  }
})();

// ============================================================
// 6. EXPORT EXCEL ALUMNI — 2 sheet (Data + Ringkasan Angkatan)
// ============================================================
window.exportAlumniExcel = () => {
  if (!window.STATE?.alumni?.length) {
    return window.notify('Belum ada data alumni untuk diekspor!', 'error');
  }
  if (typeof XLSX === 'undefined') {
    window.notify('Memuat library Excel...', 'success');
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
    s.onload = () => window._doExportExcel();
    s.onerror = () => window.notify('Gagal memuat library Excel!', 'error');
    document.head.appendChild(s);
  } else {
    window._doExportExcel();
  }
};

window._doExportExcel = () => {
  try {
    window.toggleLoading(true, 'Menyiapkan file Excel...');
    
    // Cek jika sedang berada di tab Rekap Wilayah
    const tabRekap = document.getElementById("tab-rekap");
    const isRekapTab = tabRekap && !tabRekap.classList.contains("hidden");
    const dataToExport = isRekapTab ? (window.filteredRekapData || []) : window.STATE.alumni;
    
    const alumniRows = dataToExport.map((a, i) => ({
      'No': i + 1, 'Nama Lengkap': a.nama || '',
      'Angkatan': a.angkatan || '',
      'Lembaga': a.lembaga || '',
      'No. WhatsApp': a.nowa || '',
      'Kabupaten/Kota': a.kabupaten || '', 'Kecamatan': a.kecamatan || '',
      'Desa/Kelurahan': a.desa || '', 'Alamat': a.alamat || '',
      'Total Donasi (Rp)': a.totalDonasi || 0,
    }));
    
    const angkatanMap = {};
    dataToExport.forEach(a => {
      const k = a.angkatan || '?';
      if (!angkatanMap[k]) angkatanMap[k] = { count: 0, total: 0 };
      angkatanMap[k].count++;
      angkatanMap[k].total += (a.totalDonasi || 0);
    });
    
    const ringkasanRows = Object.entries(angkatanMap)
      .sort(([a],[b]) => String(a).localeCompare(String(b)))
      .map(([k, v]) => ({ 'Angkatan': k, 'Jumlah Alumni': v.count, 'Total Donasi (Rp)': v.total, 'Rata-rata (Rp)': v.count ? Math.round(v.total/v.count) : 0 }));
      
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(alumniRows);
    const ws2 = XLSX.utils.json_to_sheet(ringkasanRows);
    ws1['!cols'] = [{wch:4},{wch:30},{wch:10},{wch:10},{wch:18},{wch:20},{wch:18},{wch:18},{wch:30},{wch:18}];
    ws2['!cols'] = [{wch:12},{wch:16},{wch:20},{wch:20}];
    XLSX.utils.book_append_sheet(wb, ws1, isRekapTab ? 'Alumni Wilayah' : 'Data Alumni');
    XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan Angkatan');
    const tgl = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-');
    
    let fileName = `Data_Alumni_Reuni_${tgl}.xlsx`;
    if (isRekapTab) {
      const kab = document.getElementById("filter-kab")?.value || "";
      const kec = document.getElementById("filter-kec")?.value || "";
      const des = document.getElementById("filter-desa")?.value || "";
      const searchVal = document.getElementById("search-wilayah-input")?.value || "";
      
      let suffix = "";
      if (kab) suffix += `_${kab}`;
      if (kec) suffix += `_${kec}`;
      if (des) suffix += `_${des}`;
      if (searchVal) suffix += `_Cari_${searchVal}`;
      
      // Bersihkan karakter non-alphanumeric agar aman untuk nama file
      suffix = suffix.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
      
      fileName = suffix ? `Data_Alumni_Wilayah${suffix}_${tgl}.xlsx` : `Data_Alumni_Wilayah_${tgl}.xlsx`;
    }
    
    XLSX.writeFile(wb, fileName);
    window.notify(`✅ ${dataToExport.length} alumni berhasil diekspor ke Excel!`, 'success');
  } catch (err) {
    window.notify('Gagal ekspor: ' + (err.message || ''), 'error');
  } finally {
    window.toggleLoading(false);
  }
};

// ============================================================
// 7. IMPORT ALUMNI DARI EXCEL — Batch write ke Firestore
// ============================================================
window.importAlumniFromExcel = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const ok = await window.showConfirm({
    title: '📥 Import Alumni dari Excel?',
    message: 'Data dari file Excel akan ditambahkan ke database dengan status <strong>pending</strong> (menunggu verifikasi). Data duplikat mungkin perlu dibersihkan manual. Lanjutkan?',
    confirmText: 'Ya, Import', danger: false,
  });
  if (!ok) return;

  // Pastikan XLSX tersedia
  if (typeof XLSX === 'undefined') {
    window.toggleLoading(true, 'Memuat library...');
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  try {
    window.toggleLoading(true, 'Membaca file Excel...');
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf);
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) {
      window.notify('File Excel kosong atau format tidak dikenali!', 'error');
      return;
    }

    // Mapping kolom fleksibel (coba berbagai nama kolom)
    const getField = (row, ...keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase());
        if (found && row[found] !== '') return String(row[found]).trim();
      }
      return '';
    };

    let berhasil = 0, gagal = 0;
    const BATCH_SIZE = 500;
    const totalRows = rows.length;

    // Proses per batch 500 (limit Firestore)
    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      window.toggleLoading(true, `Import... ${Math.min(i+BATCH_SIZE, totalRows)}/${totalRows}`);
      const batch = db.batch();
      for (const row of chunk) {
        const nama = getField(row, 'nama lengkap', 'nama', 'name', 'full name');
        if (!nama) { gagal++; continue; }
        const nowa = getField(row, 'no. whatsapp', 'no whatsapp', 'nowa', 'whatsapp', 'no wa', 'hp', 'telepon');
        const angkatan = getField(row, 'angkatan', 'tahun', 'year', 'batch');
        const lembaga = getField(row, 'lembaga', 'ma/mts', 'sekolah', 'school');
        const docRef = db.collection('alumni').doc();
        batch.set(docRef, {
          nama,
          angkatan: angkatan || '',
          lembaga: lembaga || '',
          nowa: nowa ? nowa.replace(/^0/, '62').replace(/\D/g, '') : '',
          kabupaten: getField(row, 'kabupaten/kota', 'kabupaten', 'kota', 'city'),
          kecamatan: getField(row, 'kecamatan', 'subdistrict'),
          desa: getField(row, 'desa/kelurahan', 'desa', 'kelurahan', 'village'),
          alamat: getField(row, 'alamat', 'address'),
          status: 'pending',
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
          imported_from_excel: true,
        });
        berhasil++;
      }
      await batch.commit();
    }

    window.notify(`✅ Import selesai! ${berhasil} data berhasil${gagal ? `, ${gagal} baris dilewati (kolom nama kosong)` : ''}.`, 'success');
  } catch (err) {
    console.error('Import Excel error:', err);
    window.notify('Gagal import: ' + (err.message || ''), 'error');
  } finally {
    window.toggleLoading(false);
  }
};

// ============================================================
// 8. TEMPLATE PESAN WA CEPAT — Patch getWALink untuk tabel alumni
//    Tambah fungsi getWATemplateLink yang bisa dipanggil dari render
// ============================================================
window.getWATemplateLink = (nowa, nama, angkatan) => {
  if (!nowa) return null;
  let num = String(nowa).trim().replace(/\D/g, '');
  if (!num) return null;
  if (num.startsWith('0')) num = '62' + num.slice(1);
  const nama_acara = window.STATE?.eventInfo?.nama_acara || 'Reuni Akbar AL-FATAH';
  const pesan = encodeURIComponent(
    `Assalamu'alaikum Kak ${nama}...\n\n` +
    `Kami dari Panitia ${nama_acara} ingin menginformasikan bahwa acara reuni akan segera dilaksanakan. ` +
    `Mohon konfirmasi kehadiran Kakak angkatan ${angkatan || ''}. 🙏\n\n` +
    `Info lengkap & pendaftaran: ${window.location.origin.replace('index.html','')}/pendaftaran.html`
  );
  return `https://wa.me/${num}?text=${pesan}`;
};

// ============================================================
// 9. SEMBUNYIKAN TOMBOL EDIT/HAPUS UNTUK ROLE VIEWER
//    Patch dengan MutationObserver — monitor perubahan DOM tabel alumni
// ============================================================
(function patchViewerRole() {
  const EDIT_ROLES = ['admin_utama', 'creator', 'sekretaris', 'bendahara', 'koordinator_wilayah', 'korwil_kabupaten', 'korwil_kecamatan', 'korwil_desa'];

  function hideEditButtonsIfViewer() {
    if (!window.STATE?.user) return;
    const role = window.STATE.user.role;
    if (EDIT_ROLES.includes(role)) return; // Punya akses, tidak perlu sembunyikan

    // Sembunyikan semua tombol edit/hapus di tabel
    const editButtons = document.querySelectorAll(
      '[onclick*="openEditAlumni"], [onclick*="deleteAlumni"], ' +
      '[onclick*="openEditFinance"], [onclick*="deleteFinance"], ' +
      '[onclick*="openEditPanitia"], [onclick*="deletePanitia"], ' +
      '[onclick*="openEditRundown"], [onclick*="deleteRundown"], ' +
      '[onclick*="handleBulkDelete"], [onclick*="deleteTugas"], ' +
      '[onclick*="handleApproveAlumni"], [onclick*="handleRejectAlumni"]'
    );
    editButtons.forEach(btn => {
      btn.style.display = 'none';
      btn.setAttribute('data-hidden-by-role', 'true');
    });
  }

  // Jalankan setelah setiap renderAllTabs
  const _origRender = window.renderAllTabs;
  if (_origRender) {
    window.renderAllTabs = function() {
      _origRender();
      // Sedikit delay biar DOM terupdate dulu
      setTimeout(hideEditButtonsIfViewer, 200);
    };
  }
})();

// ============================================================
// 10. LAZY LOAD CHART.JS — Hanya muat saat tab Beranda aktif
//     Patch showTab untuk intercept navigasi ke tab 'home'
// ============================================================
(function patchChartJsLazyLoad() {
  const _origShowTab = window.showTab;
  if (!_origShowTab) return;

  window.showTab = async function(tabId) {
    if (tabId === 'home' && typeof Chart === 'undefined') {
      try {
        await new Promise((res, rej) => {
          if (typeof Chart !== 'undefined') { res(); return; }
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      } catch(e) {
        console.warn('[improvements] Gagal lazy-load Chart.js:', e);
      }
    }
    _origShowTab(tabId);
  };
})();

// ============================================================
// 11. FIX: Catch kosong di area kritis — tambahkan console.error
//     Patch processCombinedData untuk tangkap error sorting/filter
// ============================================================
(function patchSilentCatches() {
  const _orig = window.processCombinedData;
  if (!_orig) return;
  window.processCombinedData = function() {
    try {
      _orig();
    } catch(e) {
      console.error('[processCombinedData] Error tersembunyi terdeteksi:', e);
      // Jangan notify user karena ini internal, tapi log untuk debugging
    }
  };
})();

// ============================================================
// 12. FITUR 4: MODAL UNDANGAN DIGITAL PERSONAL (openInviteLinkModal)
// ============================================================
window.openInviteLinkModal = (alumniId) => {
  const modal = document.getElementById('modal-invite-link');
  const preview = document.getElementById('invite-link-preview');
  const btnWa = document.getElementById('invite-btn-wa');
  const btnCopy = document.getElementById('invite-btn-copy');

  if (!modal || !preview) return;

  const a = window.STATE && Array.isArray(window.STATE.rawAlumni) 
    ? window.STATE.rawAlumni.find(x => x.id === alumniId) 
    : null;
  if (!a) {
    window.notify('Alumni tidak ditemukan!', 'error');
    return;
  }

  const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
  const params = new URLSearchParams({
    nama: a.nama || '',
    angkatan: a.angkatan || '',
    ref: 'invite'
  });
  const link = `${baseUrl}pendaftaran.html?${params.toString()}`;

  preview.textContent = link;

  if (btnWa) {
    btnWa.onclick = () => {
      if (!a.nowa) {
        window.notify('Alumni ini tidak memiliki nomor WhatsApp!', 'error');
        return;
      }
      const nama_acara = window.STATE?.eventInfo?.nama_acara || 'Reuni Akbar AL-FATAH';
      const pesan = `Assalamu'alaikum Kak ${a.nama}...\n\n` +
        `Kami dari Panitia ${nama_acara} ingin mengundang Kakak untuk ikut berpartisipasi dan melengkapi data alumni.\n\n` +
        `Mohon klik link berikut untuk mengisi/memperbarui data Anda:\n${link}\n\n` +
        `Terima kasih! 🙏`;
      const waNumber = a.nowa.replace(/\D/g, '');
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(pesan)}`;
      window.open(waUrl, '_blank');
    };
  }

  if (btnCopy) {
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(link).then(() => {
        window.notify('Link undangan berhasil disalin!', 'success');
      }).catch(() => {
        window.notify('Gagal menyalin link otomatis.', 'error');
      });
    };
  }

  modal.classList.remove('hidden');
};

// ============================================================
// 13. FITUR 1: UPDATE ROLE-BASED UI UNTUK DATA TOOLS
// ============================================================
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      setTimeout(() => {
        if (window.STATE && window.STATE.user) {
          const r = window.STATE.user.role;
          const isAdmin = r === 'admin_utama' || r === 'creator';
          const card = document.getElementById('card-data-tools');
          if (card) {
            if (isAdmin) card.classList.remove('hidden');
            else card.classList.add('hidden');
          }
        }
      }, 1000);
    }
  });
}

// ============================================================
// 14. FITUR 7: DROPDOWN ACTION FOR EXPORT (CLICK TOGGLE)
// ============================================================
window.toggleExportDropdown = (event) => {
  if (event) event.stopPropagation();
  const menu = document.getElementById('export-dropdown-menu');
  if (menu) {
    menu.classList.toggle('hidden');
    menu.classList.toggle('flex');
  }
};

// Close dropdown if click occurs outside
document.addEventListener('click', (event) => {
  const menu = document.getElementById('export-dropdown-menu');
  if (menu && !menu.classList.contains('hidden')) {
    const btn = event.target.closest('button');
    if (!btn || !btn.onclick || !btn.onclick.toString().includes('toggleExportDropdown')) {
      menu.classList.add('hidden');
      menu.classList.remove('flex');
    }
  }
});

// ============================================================
// 15. FITUR 7: FORMAL PDF EXPORT WITH KOP SURAT AND ACTIVE FILTERS
// ============================================================
window.exportAlumniPDF = async () => {
  const data = window.filteredAlumniData;
  if (!data || data.length === 0) {
    return window.notify('Tidak ada data untuk diexport!', 'error');
  }

  window.toggleLoading(true, "Membuat Laporan PDF...");
  try {
    await window._loadJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    // 1. KOP SURAT RESMI (Official Header)
    try {
      const logoImg = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "img/logo.png";
      });
      if (logoImg) {
        doc.addImage(logoImg, "PNG", 15, 11, 16, 16);
      }
    } catch (logoErr) {
      console.error("Failed to load logo in PDF:", logoErr);
    }

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 112, 15, { align: "center" });
    doc.text("PONDOK PESANTREN AL-FATAH PURWAKARTA", 112, 20, { align: "center" });
    
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.text("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw. 05 Cadassari Tegalwaru Purwakarta 41165", 112, 25, { align: "center" });
    
    // Double lines below header
    doc.setLineWidth(0.8);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, 29, 195, 29);
    doc.setLineWidth(0.2);
    doc.line(15, 30, 195, 30);

    // 2. JUDUL LAPORAN & DETAIL FILTER
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("LAPORAN DATA ALUMNI TERDAFTAR (TERFILTER)", 105, 37, { align: "center" });

    // Extract active filter labels
    const angkatan = document.getElementById("filter-alumni-angkatan")?.value || "";
    const lembaga = document.getElementById("filter-lembaga")?.value || "";
    const provinsi = document.getElementById("filter-provinsi")?.value || "";
    const kabupaten = document.getElementById("filter-kabupaten")?.value || "";
    const searchKueri = document.getElementById("search-alumni-input")?.value || "";

    const filterParts = [];
    if (angkatan) filterParts.push(`Angkatan: ${angkatan}`);
    if (lembaga) filterParts.push(`Lembaga: ${lembaga.toUpperCase()}`);
    if (kabupaten) filterParts.push(`Kabupaten: ${kabupaten}`);
    else if (provinsi) filterParts.push(`Provinsi: ${provinsi}`);
    if (searchKueri) filterParts.push(`Kata Kunci: "${searchKueri}"`);

    const filterText = filterParts.length > 0 ? filterParts.join(" | ") : "Semua Alumni (Tanpa Filter)";

    doc.setFont("times", "bolditalic");
    doc.setFontSize(9);
    doc.text(filterText, 105, 42, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(8.5);
    const tanggalCetak = new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Dicetak pada: ${tanggalCetak} | Total: ${data.length} Alumni`, 105, 47, { align: "center" });

    // 3. TABLE DATA ALUMNI
    doc.autoTable({
      startY: 51,
      head: [["No", "Nama Alumni", "Angkatan", "Lembaga", "WhatsApp", "Alamat/Domisili"]],
      body: data.map((a, i) => [
        i + 1,
        a.nama || "-",
        a.angkatan || "-",
        a.lembaga || "-",
        a.nowa ? `+${a.nowa}` : "-",
        [a.alamat, a.desa, a.kecamatan, a.kabupaten].filter(Boolean).join(", ") || "-"
      ]),
      styles: { font: "times", fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 38 },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 28, halign: "center" },
        5: { cellWidth: "auto" }
      }
    });

    // 4. SIGNATURES (Tanda Tangan Panitia)
    let finalY = doc.lastAutoTable.finalY + 12;
    if (finalY > 220) {
      doc.addPage();
      finalY = 30;
    }

    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.text("Hormat kami,", 105, finalY, { align: "center" });
    doc.setFont("times", "bold");
    doc.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 105, finalY + 4, { align: "center" });

    finalY += 12;

    const list = (window.STATE && window.STATE.panitia) ? window.STATE.panitia : [];
    let ketua = list.find(p => (p.jabatan || "").toLowerCase().includes("ketua"));
    let sekretaris = list.find(p => (p.jabatan || "").toLowerCase().includes("sekretaris"));
    let bendahara = list.find(p => (p.jabatan || "").toLowerCase().includes("bendahara"));

    const sigKetua = ketua || { nama: "", jabatan: "Ketua Panitia" };
    const sigSekretaris = sekretaris || { nama: "", jabatan: "Sekretaris" };
    const sigBendahara = bendahara || { nama: "", jabatan: "Bendahara" };

    // Row 1: Sekretaris (Left x=45) & Bendahara (Right x=165)
    doc.setFont("times", "bold");
    doc.text(sigSekretaris.jabatan || "Sekretaris,", 45, finalY, { align: "center" });
    if (sigSekretaris.tanda_tangan) {
      try { doc.addImage(sigSekretaris.tanda_tangan, 'PNG', 25, finalY + 1, 40, 15); } catch (e) {}
    }
    doc.line(25, finalY + 16, 65, finalY + 16);
    doc.setFont("times", "normal");
    doc.text(sigSekretaris.nama ? `( ${sigSekretaris.nama} )` : "( ____________________ )", 45, finalY + 20, { align: "center" });

    doc.setFont("times", "bold");
    doc.text(sigBendahara.jabatan || "Bendahara,", 165, finalY, { align: "center" });
    if (sigBendahara.tanda_tangan) {
      try { doc.addImage(sigBendahara.tanda_tangan, 'PNG', 145, finalY + 1, 40, 15); } catch (e) {}
    }
    doc.line(145, finalY + 16, 185, finalY + 16);
    doc.setFont("times", "normal");
    doc.text(sigBendahara.nama ? `( ${sigBendahara.nama} )` : "( ____________________ )", 165, finalY + 20, { align: "center" });

    // Row 2: Ketua
    const row2Y = finalY + 28;
    doc.setFont("times", "normal");
    doc.text("Mengetahui,", 105, row2Y - 3, { align: "center" });
    doc.setFont("times", "bold");
    doc.text(sigKetua.jabatan || "Ketua Panitia,", 105, row2Y, { align: "center" });
    if (sigKetua.tanda_tangan) {
      try { doc.addImage(sigKetua.tanda_tangan, 'PNG', 85, row2Y + 1, 40, 15); } catch (e) {}
    }
    doc.line(85, row2Y + 16, 125, row2Y + 16);
    doc.setFont("times", "normal");
    doc.text(sigKetua.nama ? `( ${sigKetua.nama} )` : "( ____________________ )", 105, row2Y + 20, { align: "center" });

    await window.savePDF(doc, `Laporan_Alumni_Terfilter.pdf`);
    window.notify("✅ Berhasil export PDF terfilter dengan Kop Surat!", "success");
  } catch (err) {
    console.error("Export PDF error:", err);
    window.notify("Gagal membuat PDF: " + (err.message || ""), "error");
  } finally {
    window.toggleLoading(false);
  }
};

// ============================================================
// 16. FITUR 1: MAGIC PASTE PARSER (TEMPEL & EKSTRAK CHAT WA)
// ============================================================
window.processMagicPaste = () => {
  const text = document.getElementById("magic-paste-input").value;
  if (!text) {
    return window.notify("Tempel/paste chat WA di kotak terlebih dahulu!", "error");
  }

  window.toggleLoading(true, "Mengekstrak Data...");
  setTimeout(() => {
    let nama = "";
    let angkatan = "";
    let lembaga = "";
    let nowa = "";
    let alamat = "";
    let desa = "";
    let kecamatan = "";
    let kabupaten = "";
    let provinsi = "";

    // Clear WhatsApp bold marks (e.g. *Nama:* Ahmad)
    const cleanText = text.replace(/\*/g, "");

    // 1. Structured Line-by-line Check
    const lines = cleanText.split('\n');
    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const label = parts[0].toLowerCase().trim();
        const value = parts.slice(1).join(':').trim();
        if (label.includes("nama") && !label.includes("kabupaten") && !label.includes("lembaga")) {
          nama = value;
        } else if (label.includes("angkatan") || label.includes("tahun") || label.includes("lulus")) {
          const m = value.match(/\d+/);
          if (m) angkatan = m[0];
        } else if (label.includes("lembaga") || label.includes("sekolah") || label.includes("ma/mts")) {
          if (value.toLowerCase().includes("ma")) lembaga = "MA";
          else if (value.toLowerCase().includes("mts")) lembaga = "MTs";
        } else if (label.includes("wa") || label.includes("hp") || label.includes("telp") || label.includes("kontak")) {
          nowa = value;
        } else if (label.includes("alamat") || label.includes("domisili") || label.includes("tempat")) {
          alamat = value;
        }
      }
    });

    // 2. Paragraph Fallbacks
    if (!nama) {
      const match = cleanText.match(/(?:nama|petugas|pendaftar)\s*[:\-]?\s*([a-zA-Z\s]{3,30}?)(?=\n|angkatan|lembaga|no|wa|alamat|,|\.|$)/i);
      if (match) nama = match[1].trim();
    }
    if (!angkatan) {
      const match = cleanText.match(/(?:angkatan|lulus|tahun)\s*(\d{4})/i) || cleanText.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) angkatan = match[1];
    }
    if (!lembaga) {
      if (/\bma\b/i.test(cleanText)) lembaga = "MA";
      else if (/\bmts\b/i.test(cleanText)) lembaga = "MTs";
    }
    if (!nowa) {
      const match = cleanText.match(/(?:wa|hp|no|telepon)?\s*[:\-]?\s*(08\d{8,11}|628\d{8,11}|\+628\d{8,11})/i);
      if (match) nowa = match[1];
    }
    if (!alamat) {
      const match = cleanText.match(/(?:alamat|domisili|lokasi)\s*[:\-]?\s*([^:\n]+?)(?=\n|nama|angkatan|lembaga|no|wa|$)/i);
      if (match) alamat = match[1].trim();
    }

    // Normalize phone number
    if (nowa) {
      nowa = nowa.replace(/\D/g, "");
      if (nowa.startsWith("62")) nowa = nowa.slice(2);
      else if (nowa.startsWith("0")) nowa = nowa.slice(1);
    }

    // 3. Extract Region Details
    if (alamat) {
      const parsed = window.parseAddressText(alamat);
      desa = parsed.desa;
      kecamatan = parsed.kecamatan;
      kabupaten = parsed.kabupaten;
    } else {
      const parsed = window.parseAddressText(cleanText);
      desa = parsed.desa;
      kecamatan = parsed.kecamatan;
      kabupaten = parsed.kabupaten;
    }

    // Extract Province if explicitly named
    const provMatch = cleanText.match(/(?:provinsi|prov\.)\s*([a-zA-Z\s]+?)(?=\s*(?:kab|kec|desa|,|\n|$))/i);
    if (provMatch) provinsi = provMatch[1].trim();

    // 4. Fill Fields in Form
    if (nama) window.setAlumniFormField("nama", nama.trim().replace(/(?:^|\s)\S/g, c => c.toUpperCase()));
    if (angkatan) {
      const normalizedAngkatan = window.normalizeAngkatanYear(angkatan, lembaga || "MA");
      window.setAlumniFormField("angkatan", normalizedAngkatan);
    }
    if (lembaga) {
      const el = document.getElementById("alm-lembaga");
      if (el) el.value = lembaga;
    }
    if (nowa) window.setAlumniFormField("nowa", nowa);
    if (alamat) window.setAlumniFormField("alamat", alamat);

    // Cascading select/input triggers for region dropdowns
    if (provinsi) {
      const el = document.getElementById("alm-provinsi");
      if (el) {
        el.value = window.normalizeWilayahName(provinsi);
        window.loadAlmKabupaten();
      }
    }
    if (kabupaten) {
      setTimeout(() => {
        const el = document.getElementById("alm-kabupaten");
        if (el) {
          el.value = window.normalizeWilayahName(kabupaten);
          window.loadAlmKecamatan();
        }
      }, 300);
    }
    if (kecamatan) {
      setTimeout(() => {
        const el = document.getElementById("alm-kecamatan");
        if (el) {
          el.value = window.normalizeWilayahName(kecamatan);
          window.loadAlmDesa();
        }
      }, 600);
    }
    if (desa) {
      setTimeout(() => {
        const el = document.getElementById("alm-desa");
        if (el) el.value = window.normalizeWilayahName(desa);
      }, 900);
    }

    document.getElementById("magic-paste-input").value = "";
    window.toggleLoading(false);
    window.notify("✅ Berhasil mengekstrak data alumni!", "success");

    if (nama) window.checkDuplicateName(nama.trim());
  }, 600);
};

// ============================================================
// 17. BULK IMPORT WHATSAPP CHAT AUTO-FILL & PARSER
// ============================================================

window.switchImportTab = (tab) => {
  const btnFile = document.getElementById("import-tab-file-btn");
  const btnText = document.getElementById("import-tab-text-btn");
  const sectFile = document.getElementById("import-sect-file");
  const sectText = document.getElementById("import-sect-text");

  if (!btnFile || !btnText || !sectFile || !sectText) return;

  if (tab === "file") {
    btnFile.className = "pb-3 px-4 font-bold text-xs uppercase tracking-wider text-amber-400 border-b-2 border-amber-400 transition-all";
    btnText.className = "pb-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-400 border-b-2 border-transparent hover:text-white transition-all";
    sectFile.classList.remove("hidden");
    sectFile.classList.add("block");
    sectText.classList.remove("block");
    sectText.classList.add("hidden");
  } else {
    btnFile.className = "pb-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-400 border-b-2 border-transparent hover:text-white transition-all";
    btnText.className = "pb-3 px-4 font-bold text-xs uppercase tracking-wider text-emerald-400 border-b-2 border-emerald-400 transition-all";
    sectFile.classList.remove("block");
    sectFile.classList.add("hidden");
    sectText.classList.remove("hidden");
    sectText.classList.add("block");
  }
};

// Helper internal untuk memproses satu blok alumni dari teks WhatsApp
function parseSingleAlumniBlock(blockText) {
  let nama = "";
  let angkatan = "";
  let lembaga = "";
  let nowa = "";
  let alamat = "";
  let desa = "";
  let kecamatan = "";
  let kabupaten = "";

  const lines = blockText.split("\n").map(l => l.trim()).filter(Boolean);

  // Cek apakah ada struktur key-value yang jelas di setiap baris
  let hasKeyValue = false;
  lines.forEach(line => {
    const parts = line.split(/[:\=]/);
    if (parts.length >= 2) {
      const key = parts[0].toLowerCase().trim();
      if (
        key === "nama" || key === "name" || key === "nama lengkap" ||
        key === "angkatan" || key === "tahun" || key === "lulus" ||
        key === "lembaga" || key === "sekolah" || key === "ma/mts" ||
        key === "wa" || key === "nowa" || key === "hp" || key === "telp" || key === "no wa" || key === "telepon" || key === "kontak" ||
        key === "alamat" || key === "domisili"
      ) {
        hasKeyValue = true;
      }
    }
  });

  if (hasKeyValue) {
    lines.forEach(line => {
      const parts = line.split(/[:\=]/);
      if (parts.length >= 2) {
        const key = parts[0].toLowerCase().trim();
        const val = parts.slice(1).join(":").trim();
        if (key.includes("nama") && !key.includes("kabupaten") && !key.includes("lembaga")) {
          nama = val;
        } else if (key.includes("angkatan") || key.includes("tahun") || key.includes("lulus") || key === "kelas") {
          const m = val.match(/\d+/);
          if (m) angkatan = m[0];
        } else if (key.includes("lembaga") || key.includes("sekolah") || key.includes("ma/mts") || key === "almamater") {
          if (val.toLowerCase().includes("ma")) lembaga = "MA";
          else if (val.toLowerCase().includes("mts")) lembaga = "MTs";
        } else if (key.includes("wa") || key.includes("hp") || key.includes("telp") || key.includes("kontak") || key.includes("telepon")) {
          nowa = val;
        } else if (key.includes("alamat") || key.includes("domisili") || key.includes("tempat")) {
          alamat = val;
        }
      } else {
        const dashParts = line.split("-");
        if (dashParts.length >= 2) {
          const key = dashParts[0].toLowerCase().trim();
          const val = dashParts.slice(1).join("-").trim();
          if (key === "nama" || key === "angkatan" || key === "lembaga" || key === "wa" || key === "alamat") {
            if (key === "nama") nama = val;
            else if (key === "angkatan") { const m = val.match(/\d+/); if (m) angkatan = m[0]; }
            else if (key === "lembaga") {
              if (val.toLowerCase().includes("ma")) lembaga = "MA";
              else if (val.toLowerCase().includes("mts")) lembaga = "MTs";
            }
            else if (key === "wa") nowa = val;
            else if (key === "alamat") alamat = val;
          }
        }
      }
    });
  } else {
    // Tidak ada label yang jelas. Split menggunakan pembatas umum
    const blockSingleLine = lines.join(" ");
    let cleanBlockText = blockSingleLine.replace(/^\s*\d+[\.\-\)]\s*/, "").trim();

    const tokens = cleanBlockText.split(/\s*(?:[\-\|\,\/]|\t)\s*/).filter(Boolean);
    if (tokens.length >= 2) {
      tokens.forEach(tok => {
        const tokClean = tok.trim();
        const tokLower = tokClean.toLowerCase();
        
        if (/^(?:08|62|\+62)\d{8,12}$/.test(tokClean.replace(/\D/g, ""))) {
          nowa = tokClean;
        } else if (/^\b\d{4}\b$/.test(tokClean) || (/^\b\d{1,2}\b$/.test(tokClean) && parseInt(tokClean) <= 50)) {
          angkatan = tokClean;
        } else if (tokLower === "ma" || tokLower === "mts") {
          lembaga = tokLower === "ma" ? "MA" : "MTs";
        } else if (
          tokLower.includes("desa") || tokLower.includes("kec") || tokLower.includes("kab") ||
          tokLower.includes("kp.") || tokLower.includes("kampung") || tokLower.includes("jalan") ||
          tokLower.includes("jl.") || tokLower.includes("rt") || tokLower.includes("rw")
        ) {
          alamat = (alamat ? alamat + ", " : "") + tokClean;
        } else if (/^[a-zA-Z\s\.\']{3,35}$/.test(tokClean) && !nama) {
          nama = tokClean;
        } else {
          alamat = (alamat ? alamat + ", " : "") + tokClean;
        }
      });
    } else {
      const cleanBlockText = blockText.replace(/^\s*\d+[\.\-\)]\s*/, "").trim();
      const nameMatch = cleanBlockText.match(/(?:nama|petugas|pendaftar)\s*[:\-]?\s*([a-zA-Z\s]{3,30}?)(?=\n|angkatan|lembaga|no|wa|alamat|,|\.|$)/i);
      if (nameMatch) nama = nameMatch[1].trim();
      else {
        const firstLine = lines[0] ? lines[0].replace(/^\s*\d+[\.\-\)]\s*/, "").trim() : "";
        if (firstLine && firstLine.length <= 30 && !firstLine.includes(":")) {
          nama = firstLine;
        }
      }
      
      const angkatanMatch = cleanBlockText.match(/(?:angkatan|lulus|tahun)\s*(\d{4})/i) || cleanBlockText.match(/\b(19\d{2}|20\d{2})\b/);
      if (angkatanMatch) angkatan = angkatanMatch[1];
      
      if (/\bma\b/i.test(cleanBlockText)) lembaga = "MA";
      else if (/\bmts\b/i.test(cleanBlockText)) lembaga = "MTs";
      
      const waMatch = cleanBlockText.match(/(?:wa|hp|no|telepon)?\s*[:\-]?\s*(08\d{8,11}|628\d{8,11}|\+628\d{8,11})/i);
      if (waMatch) nowa = waMatch[1];
      
      const alamatMatch = cleanBlockText.match(/(?:alamat|domisili|lokasi)\s*[:\-]?\s*([^:\n]+?)(?=\n|nama|angkatan|lembaga|no|wa|$)/i);
      if (alamatMatch) alamat = alamatMatch[1].trim();
    }
  }

  if (nama) {
    nama = nama.replace(/^\s*\d+[\.\-\)]\s*/, "").trim();
  }
  if (nowa) {
    nowa = nowa.replace(/\D/g, "");
    if (nowa.startsWith("0")) nowa = "62" + nowa.slice(1);
    else if (!nowa.startsWith("62") && nowa.length > 5) nowa = "62" + nowa;
  }
  if (angkatan) {
    angkatan = window.normalizeAngkatanYear(angkatan, lembaga || "MA");
  }

  if (alamat) {
    const parsed = window.parseAddressText(alamat);
    desa = parsed.desa;
    kecamatan = parsed.kecamatan;
    kabupaten = parsed.kabupaten;
  }

  return {
    nama: (nama || "").trim().replace(/(?:^|\s)\S/g, c => c.toUpperCase()),
    angkatan: angkatan || "",
    lembaga: lembaga || "",
    nowa: nowa || "",
    alamat: alamat || "",
    desa: window.normalizeWilayahName(desa),
    kecamatan: window.normalizeWilayahName(kecamatan),
    kabupaten: window.normalizeWilayahName(kabupaten)
  };
}

window.processBulkMagicPaste = () => {
  const rawText = document.getElementById("magic-paste-bulk-input").value;
  if (!rawText || !rawText.trim()) {
    return window.notify("Tempel chat WA yang memuat data alumni terlebih dahulu!", "error");
  }

  window.toggleLoading(true, "Memproses chat WA...");
  
  setTimeout(() => {
    try {
      const cleanText = rawText.replace(/\*/g, ""); 
      let blocks = [];
      
      if (cleanText.includes("---") || cleanText.includes("===") || cleanText.includes("___")) {
        blocks = cleanText.split(/\s*(?:\-{3,}|={3,}|_{3,})\s*/g);
      } else {
        const regexNumbered = /\n\s*(?=\b\d+[\.\-\)]\s+)/g;
        const splitByNumber = cleanText.split(regexNumbered);
        if (splitByNumber.length > 1) {
          blocks = splitByNumber;
        } else {
          const splitByNewline = cleanText.split(/\n\s*\n+/g);
          if (splitByNewline.length > 1) {
            blocks = splitByNewline;
          } else {
            const lines = cleanText.split(/\n+/g).map(l => l.trim()).filter(l => l.length > 5);
            if (lines.length > 1) {
              blocks = lines;
            } else {
              blocks = [cleanText];
            }
          }
        }
      }

      blocks = blocks.map(b => b.trim()).filter(b => b.length > 0);

      const dataUpload = [];
      let skippedCount = 0;
      let duplicateCount = 0;

      const checkBulkRowDuplicateState = (rowObj) => {
        const cleanName = window.cleanAlumniName(rowObj.nama);
        if (!cleanName) return "import";

        const existingList = window.STATE.rawAlumni.filter(a => 
          window.cleanAlumniName(a.nama) === cleanName
        );

        if (existingList.length === 0) {
          return "import";
        }

        let hasDuplicate = false;
        let isIdentical = false;
        let csvHasMore = false;

        for (const existing of existingList) {
          const cleanNameWords = cleanName.split(" ").filter(Boolean).length;
          const sameAngkatan = String(window.normalizeAngkatanYear(existing.angkatan, existing.lembaga) || "").trim() === String(rowObj.angkatan).trim();
          const sameWA = rowObj.nowa && existing.nowa && window.normalizeAlumniWA(rowObj.nowa) === window.normalizeAlumniWA(existing.nowa);
          
          const isDup = sameAngkatan || sameWA || (cleanNameWords >= 2 || cleanName.length >= 12);
          
          if (isDup) {
            hasDuplicate = true;
            
            const fields = ["lembaga", "nowa", "alamat", "desa", "kecamatan", "kabupaten"];
            let currentCsvHasMore = false;
            let currentIsIdentical = sameAngkatan;
            
            for (const f of fields) {
              const csvVal = (rowObj[f] || "").trim();
              const existVal = (existing[f] || "").trim();
              
              if (csvVal !== existVal) {
                currentIsIdentical = false;
              }
              if (csvVal && !existVal) {
                currentCsvHasMore = true;
              }
              if (csvVal.length > existVal.length && existVal) {
                currentCsvHasMore = true;
              }
            }
            
            if (currentIsIdentical) {
              isIdentical = true;
            }
            if (currentCsvHasMore) {
              csvHasMore = true;
            }
          }
        }

        if (!hasDuplicate) return "import";
        if (isIdentical) return "skip";
        if (csvHasMore) return "import_duplicate";
        return "skip";
      };

      blocks.forEach(block => {
        const rowObj = parseSingleAlumniBlock(block);
        if (rowObj.nama && rowObj.nama.length >= 2) {
          const dupState = checkBulkRowDuplicateState(rowObj);
          if (dupState === "skip") {
            skippedCount++;
          } else {
            if (dupState === "import_duplicate") {
              duplicateCount++;
            }
            dataUpload.push(rowObj);
          }
        }
      });

      if (dataUpload.length === 0) {
        window.toggleLoading(false);
        if (skippedCount > 0) {
          return window.notify(`Gagal. ${skippedCount} data di teks sudah ada persis di database!`, "error");
        }
        return window.notify("Gagal mengurai teks. Pastikan memuat setidaknya nama alumni.", "error");
      }

      window.STATE.tempImportData = { dataUpload, skippedCount, duplicateCount };

      const mapInfoEl = document.getElementById("import-mapping-info");
      if (mapInfoEl) {
        mapInfoEl.innerHTML = `
          <div><span class='text-slate-500 font-bold'>Sumber:</span> <b>WhatsApp Paste</b></div>
          <div><span class='text-slate-500 font-bold'>Parser:</span> <b>Auto-Extract</b></div>
          <div><span class='text-slate-500 font-bold'>Status:</span> <b>${dataUpload.length} terurai</b></div>
        `;
      }

      document.getElementById("import-stat-new").textContent = dataUpload.length - duplicateCount;
      document.getElementById("import-stat-dupes").textContent = duplicateCount;
      document.getElementById("import-stat-skipped").textContent = skippedCount;

      const previewListEl = document.getElementById("import-preview-list");
      if (previewListEl) {
        const previewRows = dataUpload.slice(0, 5);
        previewListEl.innerHTML = previewRows.map(row => `
          <tr class="hover:bg-black/5">
            <td class="p-3 font-bold">${row.nama}</td>
            <td class="p-3 text-center">
              <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase text-[9px] font-black">${row.lembaga || '-'}</span><br>
              <span class="text-slate-400 font-bold">${row.angkatan || '-'}</span>
            </td>
            <td class="p-3">${row.nowa ? '+' + row.nowa : '<span class="text-slate-600">-</span>'}</td>
            <td class="p-3 text-slate-400 text-[11px] truncate max-w-[150px]" title="${row.alamat || ''}">
              ${row.alamat || row.desa || row.kecamatan || row.kabupaten || '-'}
            </td>
          </tr>
        `).join("");
      }

      document.getElementById("modal-import-guide").classList.add("hidden");
      window.openModal("modal-import-preview");
      document.getElementById("magic-paste-bulk-input").value = "";
      
      window.toggleLoading(false);
      window.notify(`Berhasil mengurai ${dataUpload.length + skippedCount} data dari WhatsApp.`, "success");

    } catch (err) {
      console.error(err);
      window.toggleLoading(false);
      window.notify("Terjadi kesalahan saat memproses data: " + err.message, "error");
    }
  }, 500);
};

console.log('[app-improvements.js v11] ✅ Semua perbaikan dan fitur WhatsApp bulk import berhasil dimuat.');

