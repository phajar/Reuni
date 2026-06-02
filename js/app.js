// Cukup panggil dari file js yang sudah Anda buat!

// FIX: Inisialisasi waktu mulai aplikasi untuk deteksi notifikasi realtime
window.APP_START_TIME = Date.now();

// ==========================================
// STATE GLOBAL & FUNGSI UTILITAS
// ==========================================
window.STATE = {
  user: null,
  users: [],
  rawAlumni: [],
  rawFinance: [],
  alumni: [],
  finance: [],
  rab: [],
  panitia: [],
  rundown: [],
  requests: [],
  eventDate: "TBD",
  eventTime: "",
  eventGuest: "",
};
window.filteredAlumniData = [];
window.filteredRekapData = [];
window.currentFinanceData = [];
window.currentAlumniPage = 1;
window.currentFinancePage = 1;
window.currentRABPage = 1;
window.ALUMNI_PER_PAGE = 10;
window.TARGET_DANA = 50000000;
window.sortConfig = {
  alumni: { key: "created_at", dir: "desc" },
  finance: { key: "tanggal", dir: "desc" },
};
window.isLightMode = localStorage.getItem("af_theme") === "light";
window.pieChartInstance = null;
let idleTime = 0;
const IDLE_TIMEOUT_MINUTES = 15;

window.isWilayahMatch = (w1, w2) => {
  const clean = (str) => {
    let s = String(str || "").toLowerCase().trim();
    // Hapus awalan wilayah administratif umum
    s = s.replace(/^(kabupaten|kab|kota|kecamatan|kec|desa|ds|kelurahan|kel)\s+/g, "");
    // Hapus akhiran wilayah administratif umum
    s = s.replace(/\s+(kabupaten|kab|kota|kecamatan|kec|desa|ds|kelurahan|kel)$/g, "");
    // Bersihkan karakter non-alfanumerik
    s = s.replace(/[^a-z0-9]/g, "").trim();
    if (s === "tgw" || s.startsWith("tegalwaru") || s.startsWith("tegalwalu") || s.startsWith("tegalwar") || s.startsWith("tegalwal")) {
      return "tegalwaru";
    }
    if (s.startsWith("pleredpurwakarta") || s.startsWith("pleredpwk")) return "plered";
    if (s.startsWith("sukatanipwk") || s.startsWith("sukatanipurwakarta")) return "sukatani";
    return s;
  };
  const c1 = clean(w1);
  const c2 = clean(w2);
  if (!c1 && !c2) return true; // both empty
  if (!c1 || !c2) return false; // one is empty
  return c1 === c2;
};

// Normalisasi nama wilayah ke label kanonik untuk tampilan dropdown
window.normalizeWilayah = (str) => {
  const s = String(str || "").trim();
  if (!s) return "";
  const low = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Tegal Waru variations
  if (low === "tgw" || low.startsWith("tegalwaru") || low.startsWith("tegalwalu") || low.startsWith("tegalwar") || low.startsWith("tegalwal")) {
    return "Tegal Waru";
  }
  // Purwakarta variations
  if (low === "pwk" || low === "purwakarta") {
    return "Purwakarta";
  }
  // Karawang variations
  if (low === "karawang") {
    return "Karawang";
  }
  // West Java variations
  if (low === "jabar" || low === "jawabarat") {
    return "Jawa Barat";
  }
  // Bandung Barat variations
  if (low === "bandungbarat") {
    return "Bandung Barat";
  }
  // Bekasi variations
  if (low === "bekasi") {
    return "Bekasi";
  }
  // Subang variations
  if (low === "subang") {
    return "Subang";
  }
  // Plered variations
  if (low.startsWith("pleredpurwakarta") || low.startsWith("pleredpwk")) return "Plered";
  // Sukatani variations
  if (low.startsWith("sukatanipwk") || low.startsWith("sukatanipurwakarta")) return "Sukatani";
  // Default: kembalikan nilai asli dengan kapitalisasi kata per kata
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

window.canUserManageAlumnus = (user, alumnus) => {
    if (!user) return false;
    const r = user.role;
    if (["admin_utama", "creator", "sekretaris"].includes(r)) return true;
    
    // Pengecekan cakupan wilayah koordinator
    if (r === 'korwil_kabupaten') {
        return window.isWilayahMatch(alumnus.kabupaten, user.wilayah_kabupaten);
    }
    if (r === 'korwil_kecamatan') {
        return (!alumnus.kabupaten || window.isWilayahMatch(alumnus.kabupaten, user.wilayah_kabupaten)) &&
               window.isWilayahMatch(alumnus.kecamatan, user.wilayah_kecamatan);
    }
    if (r === 'korwil_desa') {
        return (!alumnus.kabupaten || window.isWilayahMatch(alumnus.kabupaten, user.wilayah_kabupaten)) &&
               (!alumnus.kecamatan || window.isWilayahMatch(alumnus.kecamatan, user.wilayah_kecamatan)) &&
               window.isWilayahMatch(alumnus.desa, user.wilayah_desa);
    }
    // Backward compatibility for legacy role
    if (r === 'koordinator_wilayah') {
        let match = true;
        if (user.wilayah_kabupaten) match = match && window.isWilayahMatch(alumnus.kabupaten, user.wilayah_kabupaten);
        if (user.wilayah_kecamatan) match = match && window.isWilayahMatch(alumnus.kecamatan, user.wilayah_kecamatan);
        if (user.wilayah_desa) match = match && window.isWilayahMatch(alumnus.desa, user.wilayah_desa);
        return match;
    }
    return false;
};

window.canUserFinAlumnus = (user, alumnus) => {
    if (!user) return false;
    const r = user.role;
    if (["admin_utama", "creator", "bendahara"].includes(r)) return true;
    
    // Pengecekan cakupan wilayah koordinator (memiliki akses yang sama untuk wilayah tugasnya)
    if (r === 'korwil_kabupaten') {
        return window.isWilayahMatch(alumnus.kabupaten, user.wilayah_kabupaten);
    }
    if (r === 'korwil_kecamatan') {
        return (!alumnus.kabupaten || window.isWilayahMatch(alumnus.kabupaten, user.wilayah_kabupaten)) &&
               window.isWilayahMatch(alumnus.kecamatan, user.wilayah_kecamatan);
    }
    if (r === 'korwil_desa') {
        return (!alumnus.kabupaten || window.isWilayahMatch(alumnus.kabupaten, user.wilayah_kabupaten)) &&
               (!alumnus.kecamatan || window.isWilayahMatch(alumnus.kecamatan, user.wilayah_kecamatan)) &&
               window.isWilayahMatch(alumnus.desa, user.wilayah_desa);
    }
    // Backward compatibility for legacy role
    if (r === 'koordinator_wilayah') {
        let match = true;
        if (user.wilayah_kabupaten) match = match && window.isWilayahMatch(alumnus.kabupaten, user.wilayah_kabupaten);
        if (user.wilayah_kecamatan) match = match && window.isWilayahMatch(alumnus.kecamatan, user.wilayah_kecamatan);
        if (user.wilayah_desa) match = match && window.isWilayahMatch(alumnus.desa, user.wilayah_desa);
        return match;
    }
    return false;
};

window.toggleLoading = (show, text = "Memuat...") => {
  const overlay = document.getElementById("loading-overlay");
  if (show) {
    document.getElementById("loading-text").innerText = text;
    overlay.classList.remove("hidden");
    setTimeout(() => (overlay.style.opacity = "1"), 10);
  } else {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.classList.add("hidden"), 300);
  }
};
// openModalBroadcast & executeBroadcastWA telah dipindahkan sepenuhnya ke api-whatsapp.js

window.openModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
};
window.closeModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
};
window.populateEventSettingsForm = () => {
  const setEventDateEl = document.getElementById("set-event-date");
  const setEventTbdEl = document.getElementById("set-event-tbd");
  const setEventTimeEl = document.getElementById("set-event-time");
  const setEventGuestEl = document.getElementById("set-event-guest");
  const setEventWaHumasEl = document.getElementById("set-event-wa-humas");
  const apiBendaharaEl = document.getElementById("api-access-bendahara");
  const apiSekretarisEl = document.getElementById("api-access-sekretaris");
  const setEventWaDisabledEl = document.getElementById("set-event-wa-disabled");

  if (window.STATE) {
      if (setEventDateEl) {
          setEventDateEl.disabled = window.STATE.eventDate === "TBD";
          setEventDateEl.value = window.STATE.eventDate !== "TBD" ? window.STATE.eventDate : "";
      }
      if (setEventTbdEl) setEventTbdEl.checked = window.STATE.eventDate === "TBD";
      if (setEventTimeEl) setEventTimeEl.value = window.STATE.eventTime || "";
      if (setEventGuestEl) setEventGuestEl.value = window.STATE.eventGuest || "";
      if (setEventWaHumasEl) setEventWaHumasEl.value = window.STATE.eventWaHumas || "";
      
      if (setEventWaDisabledEl) {
          setEventWaDisabledEl.checked = window.STATE.eventInfo && window.STATE.eventInfo.wa_disabled === true;
      }
      
      const apiAccess = window.STATE.eventInfo && window.STATE.eventInfo.api_access_roles
          ? window.STATE.eventInfo.api_access_roles
          : ["admin_utama", "creator"];
      if (apiBendaharaEl) apiBendaharaEl.checked = apiAccess.includes("bendahara");
      if (apiSekretarisEl) apiSekretarisEl.checked = apiAccess.includes("sekretaris");
  }
};

window.switchSettingsSubTab = (subTabName) => {
  const subContents = document.querySelectorAll(".settings-sub-content");
  subContents.forEach(el => {
    el.classList.add("hidden");
    el.classList.remove("block");
  });

  const activeContent = document.getElementById(`subtab-settings-${subTabName}`);
  if (activeContent) {
    activeContent.classList.remove("hidden");
    activeContent.classList.add("block");
  }

  const subBtns = document.querySelectorAll(".settings-sub-btn");
  subBtns.forEach(btn => btn.classList.remove("active"));

  const activeBtn = document.getElementById(`subbtn-settings-${subTabName}`);
  if (activeBtn) activeBtn.classList.add("active");

  const sidebarSubBtns = document.querySelectorAll(".nav-sub-btn");
  sidebarSubBtns.forEach(btn => btn.classList.remove("active"));

  const activeLogoBtn = document.getElementById(`subbtn-logo-${subTabName}`);
  if (activeLogoBtn) activeLogoBtn.classList.add("active");

  const mobileSubBtns = document.querySelectorAll(".mobile-settings-sub-btn");
  mobileSubBtns.forEach(btn => btn.classList.remove("active"));

  const activeMobileBtn = document.getElementById(`subbtn-mobile-settings-${subTabName}`);
  if (activeMobileBtn) activeMobileBtn.classList.add("active");

  // ---- INTEGRATED AUTO-LOAD DATA HOOKS FOR ALL SUB-TABS ----
  if (subTabName === 'ai') {
      (async () => {
          try {
              const doc = await db.collection("app_settings").doc("ai_config").get();
              if (doc.exists) {
                  const data = doc.data();
                  const geminiKeyEl = document.getElementById("ai-gemini-key");
                  const groqKeyEl = document.getElementById("ai-groq-key");
                  const providerEl = document.getElementById("ai-provider");
                  
                  if (geminiKeyEl) geminiKeyEl.value = data.gemini_key || "";
                  if (groqKeyEl) groqKeyEl.value = data.groq_key || "";
                  if (providerEl && data.ai_provider) providerEl.value = data.ai_provider;
                  
                  window.geminiApiKey = data.gemini_key || "";
                  window.groqApiKey = data.groq_key || "";
                  window.aiProvider = data.ai_provider || "gemini";
              }
          } catch(err) {
              console.error("Gagal memuat AI config di sub-tab", err);
          }

          // Load Cloudinary config dan isi form
          try {
              const cldDoc = await db.collection("app_settings").doc("cloudinary_config").get();
              if (cldDoc.exists) {
                  const d = cldDoc.data();
                  const cnEl  = document.getElementById("cld-cloud-name");
                  const upEl  = document.getElementById("cld-upload-preset");
                  const fmtEl = document.getElementById("cld-allowed-formats");
                  const szEl  = document.getElementById("cld-max-size-mb");
                  if (cnEl)  cnEl.value  = d.cloud_name    || "";
                  if (upEl)  upEl.value  = d.upload_preset || "";
                  if (fmtEl) fmtEl.value = d.allowed_formats || "jpg,jpeg,png,webp";
                  if (szEl)  szEl.value  = d.max_size_mb   || 5;

                  // Perbarui runtime config
                  if (window.CLOUDINARY_CONFIG) {
                      window.CLOUDINARY_CONFIG.cloud_name      = d.cloud_name    || window.CLOUDINARY_CONFIG.cloud_name;
                      window.CLOUDINARY_CONFIG.upload_preset   = d.upload_preset || window.CLOUDINARY_CONFIG.upload_preset;
                      window.CLOUDINARY_CONFIG.allowed_formats = d.allowed_formats || window.CLOUDINARY_CONFIG.allowed_formats;
                      window.CLOUDINARY_CONFIG.max_size_mb     = d.max_size_mb   || window.CLOUDINARY_CONFIG.max_size_mb;
                  }
              }
          } catch(err) {
              console.error("Gagal memuat Cloudinary config di sub-tab", err);
          }
      })();
  } else if (subTabName === 'gallery') {
      (async () => {
          try {
              const doc = await db.collection("settings").doc("documentation").get();
              const container = document.getElementById("gallery-categories-container");
              if (container) container.innerHTML = ""; // Bersihkan kontainer terlebih dahulu

              if (doc.exists) {
                  const data = doc.data();
                  if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
                      data.categories.forEach(cat => {
                          window.addGalleryCategoryRow(cat.name, cat.folder_id, cat.id);
                      });
                  } else {
                      // Fallback migrasi jika hanya ada field individual dari format lama
                      const ac = data.folder_acara || "";
                      const ns = data.folder_nostalgia || "";
                      const pn = data.folder_panitia || "";
                      
                      if (ac) window.addGalleryCategoryRow("Acara Utama", ac);
                      if (ns) window.addGalleryCategoryRow("Foto Sekolah Lawas", ns);
                      if (pn) window.addGalleryCategoryRow("Persiapan Panitia", pn);
                      
                      if (!ac && !ns && !pn) {
                          // Jika masih kosong sama sekali, tampilkan 1 baris kosong
                          window.addGalleryCategoryRow("", "");
                      }
                  }
              } else {
                  // Default awal jika dokumen belum ada
                  window.addGalleryCategoryRow("", "");
              }
          } catch(err) {
              console.error("Gagal memuat konfigurasi folder galeri:", err);
          }
      })();
  } else if (subTabName === 'profile') {

      if (window.STATE && window.STATE.user) {
          const nameEl = document.getElementById("set-name");
          const photoEl = document.getElementById("preview-profile-photo");
          if (nameEl) nameEl.value = window.STATE.user.nama || "";
          if (photoEl) {
              photoEl.src = window.STATE.user.photoURL ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(window.STATE.user.nama || "User")}&background=6366f1&color=fff`;
          }
      }
  } else if (subTabName === 'event') {
      if (typeof window.populateEventSettingsForm === 'function') {
          window.populateEventSettingsForm();
      }
  } else if (subTabName === 'users') {
      if (typeof window.renderUsers === 'function') window.renderUsers();
  } else if (subTabName === 'approve') {
      if (typeof window.renderApproveUsers === 'function') window.renderApproveUsers();
  } else if (subTabName === 'audit') {
      if (typeof window.renderAuditLog === 'function') window.renderAuditLog();
  }
};
window.openImageModal = (url) => {
  if (!url || url === "null" || url === "undefined")
    return window.notify("Tidak ada bukti gambar.", "error");
  document.getElementById("preview-image-src").src = url;
  document.getElementById("preview-image-download").href = url;
  window.openModal("modal-image-preview");
};
window.formatRupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(n) || 0);

window.normalizePhoneNumber = (phone) => {
  if (!phone) return "";
  let clean = String(phone).replace(/\D/g, "");
  if (clean.startsWith("620")) {
    clean = "62" + clean.substring(3);
  }
  if (clean.startsWith("0")) {
    clean = "62" + clean.substring(1);
  } else if (clean.startsWith("8")) {
    clean = "62" + clean;
  }
  return clean;
};

// FIX XSS: Utility global untuk meng-escape karakter HTML berbahaya dari data Firestore
window.escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

window.notify = (message, type = "success") => {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `p-4 mb-2 rounded-xl glass border-l-4 ${type === "error" ? "border-red-500" : "border-emerald-500"} font-bold text-[10px] uppercase shadow-2xl transition-all duration-300 transform translate-x-full opacity-0 text-white`;
  toast.innerHTML = `<div class="flex items-center"><i class="fas ${type === "error" ? "fa-exclamation-circle text-red-500" : "fa-check-circle text-emerald-500"} mr-2"></i> ${message}</div>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.remove("translate-x-full", "opacity-0"), 10);
  setTimeout(() => {
    toast.classList.add("translate-x-full", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

window.applyTheme = () => {
  if (window.isLightMode) {
    document.body.classList.add("light-theme");
    if (document.getElementById("theme-icon-dash"))
      document.getElementById("theme-icon-dash").className = "fas fa-sun";
    if (document.getElementById("theme-icon-auth"))
      document.getElementById("theme-icon-auth").className = "fas fa-sun";
    if (document.getElementById("sidebar-theme-icon"))
      document.getElementById("sidebar-theme-icon").className = "fas fa-sun";
    if (document.getElementById("mobile-theme-icon"))
      document.getElementById("mobile-theme-icon").className = "fas fa-sun text-amber-400 text-sm mb-1";
  } else {
    document.body.classList.remove("light-theme");
    if (document.getElementById("theme-icon-dash"))
      document.getElementById("theme-icon-dash").className = "fas fa-moon";
    if (document.getElementById("theme-icon-auth"))
      document.getElementById("theme-icon-auth").className = "fas fa-moon";
    if (document.getElementById("sidebar-theme-icon"))
      document.getElementById("sidebar-theme-icon").className = "fas fa-moon";
    if (document.getElementById("mobile-theme-icon"))
      document.getElementById("mobile-theme-icon").className = "fas fa-moon text-amber-400 text-sm mb-1";
  }
};
window.toggleTheme = () => {
  window.isLightMode = !window.isLightMode;
  localStorage.setItem("af_theme", window.isLightMode ? "light" : "dark");
  window.applyTheme();
};
window.applyTheme();

window.toggleProfilePopover = () => {
  const popover = document.getElementById("profile-popover");
  if (!popover) return;
  
  if (popover.classList.contains("hidden")) {
    popover.classList.remove("hidden");
    const logoMenu = document.getElementById("logo-dropdown-menu");
    if (logoMenu) logoMenu.classList.add("hidden");
  } else {
    popover.classList.add("hidden");
  }
};

window.toggleLogoDropdown = () => {
  const menu = document.getElementById("logo-dropdown-menu");
  if (!menu) return;
  
  if (menu.classList.contains("hidden")) {
    menu.classList.remove("hidden");
    const popover = document.getElementById("profile-popover");
    if (popover) popover.classList.add("hidden");
  } else {
    menu.classList.add("hidden");
  }
};

window.clickLogoSubMenu = (subTabName) => {
  window.showTab('settings');
  window.switchSettingsSubTab(subTabName);
  window.toggleLogoDropdown();
  
  // Otomatis tutup sidebar di HP setelah diklik
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById("main-sidebar");
    if (sidebar && !sidebar.classList.contains("-translate-x-full")) {
      window.toggleSidebar();
    }
  }
};

// Auto-close popups when clicking outside
document.addEventListener("click", (e) => {
  const popover = document.getElementById("profile-popover");
  const profileCard = document.querySelector("[onclick='window.toggleProfilePopover()']");
  if (popover && !popover.classList.contains("hidden") && profileCard && !profileCard.contains(e.target) && !popover.contains(e.target)) {
    popover.classList.add("hidden");
  }
  
  const logoMenu = document.getElementById("logo-dropdown-menu");
  const logoCircle = document.querySelector("[onclick='window.toggleLogoDropdown()']");
  if (logoMenu && !logoMenu.classList.contains("hidden") && logoCircle && !logoCircle.contains(e.target) && !logoMenu.contains(e.target)) {
    logoMenu.classList.add("hidden");
  }
});

// FUNGSI BUKA-TUTUP SIDEBAR (HP)
window.toggleSidebar = () => {
  const sidebar = document.getElementById("main-sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (sidebar.classList.contains("-translate-x-full")) {
    // Buka Sidebar
    sidebar.classList.remove("-translate-x-full");
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.remove("opacity-0"), 10);
  } else {
    // Tutup Sidebar
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("opacity-0");
    setTimeout(() => overlay.classList.add("hidden"), 300);
  }
};

// FUNGSI GANTI TAB
window.showTab = (tabId) => {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.add("hidden"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((el) => el.classList.remove("active"));

  document.getElementById(`tab-${tabId}`).classList.remove("hidden");
  
  if (tabId === 'whatsapp' && typeof window.loadWaApiSettingsIntoTab === 'function') {
      window.loadWaApiSettingsIntoTab();
  }
  
  if (tabId === 'settings') {
      const activeSidebarSubBtn = document.querySelector(".nav-sub-btn.active");
      if (!activeSidebarSubBtn) {
          window.switchSettingsSubTab("profile");
      }
      setTimeout(() => {
          const btnEnable = document.getElementById("btn-enable-notif");
          if (btnEnable) {

          }
      }, 500);
  }
  
  // Set desktop sidebar button active if it exists
  const sideBtn = document.getElementById(`btn-${tabId}`);
  if (sideBtn) sideBtn.classList.add("active");

  // Sync mobile bottom nav buttons
  document.querySelectorAll(".mobile-nav-btn").forEach((el) => el.classList.remove("active"));
  const mobTabBtn = document.getElementById(`mobile-tab-${tabId}`);
  if (mobTabBtn) {
    mobTabBtn.classList.add("active");
  } else {
    // If not one of primary 3 tabs, highlight the "More" button (Menu Lainnya)
    const mobileMoreBtn = document.getElementById("mobile-tab-more");
    if (mobileMoreBtn && ['home', 'alumni', 'finance'].indexOf(tabId) === -1) {
      mobileMoreBtn.classList.add("active");
    }
  }

  const titleDict = {
    home: "Beranda",
    alumni: "Data Alumni",
    panitia: "Kepanitiaan",
    rundown: "Jadwal Acara",
    rab: "RAB & Anggaran",
    rekap: "Rekap Wilayah",
    requests: "Verifikasi",
    finance: "Keuangan",
    guestbook: "Buku Tamu",
    logistik: "Donasi Barang",
    whatsapp: "WhatsApp Gateway",
    settings: "Pengaturan & Sistem",
  };
  document.getElementById("page-title").innerText =
    titleDict[tabId] || tabId.toUpperCase();

  const mainEl = document.querySelector("main");
  if (mainEl) mainEl.scrollTop = 0;

  window.renderAllTabs();

  // OTOMATIS TUTUP SIDEBAR DI HP SETELAH DIKLIK
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById("main-sidebar");
    if (sidebar && !sidebar.classList.contains("-translate-x-full")) {
      window.toggleSidebar();
    }
  }
};

window.switchMobileTab = (tabId) => {
  window.showTab(tabId);
  window.toggleMobileMoreSheet(false);
};

window.toggleMobileMoreSheet = (isOpen) => {
  const sheet = document.getElementById("mobile-more-sheet");
  const overlay = document.getElementById("mobile-more-overlay");
  if (!sheet || !overlay) return;
  
  if (isOpen) {
    overlay.classList.remove("hidden");
    sheet.classList.add("open");
    setTimeout(() => {
      overlay.style.opacity = "1";
    }, 10);
  } else {
    sheet.classList.remove("open");
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.classList.add("hidden");
    }, 300);
  }
};

window.getWALink = (number, name) => {
  if (!number) return '<span class="text-slate-500">-</span>';
  let num = String(number).trim().replace(/\D/g, "");
  if (num === "") return '<span class="text-slate-500">-</span>';
  if (num.startsWith("0")) num = "62" + num.substring(1);
  return `<a href="https://wa.me/${num}" target="_blank" class="text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1"><i class="fab fa-whatsapp"></i> ${number}</a>`;
};

// ==========================================
// SISTEM OTENTIKASI & USER MANAGEMENT
// ==========================================
window.handleLogin = async () => {
  const email = document.getElementById("login-email").value;
  const pin = document.getElementById("login-pin").value;
  if (!email || !pin)
    return window.notify("Lengkapi email dan password", "error");
  window.toggleLoading(true, "Otentikasi...");
  try {
    await auth.signInWithEmailAndPassword(email, pin);
    window.notify("Berhasil masuk!", "success");
  } catch (e) {
    // <-- Ganti Auth jadi auth
    window.notify("Gagal Login: Email atau Password salah", "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.handleGoogleLogin = async () => {
  window.toggleLoading(true, "Otentikasi Google...");
  try {
    // In a non-bundled Capacitor environment, capacitor.js exports 'capacitorExports'
    const CapCore = window.capacitorExports ? window.capacitorExports.Capacitor : window.Capacitor;
    const isAndroidApp = CapCore && CapCore.isNativePlatform && CapCore.isNativePlatform();
    
    if (isAndroidApp) {
      // Create Proxy for Native Plugin
      const registerPlugin = (CapCore && CapCore.registerPlugin) ? CapCore.registerPlugin : (window.capacitorExports ? window.capacitorExports.registerPlugin : null);
      if (!registerPlugin) {
          window.notify("Capacitor Core (registerPlugin) tidak ditemukan di browser.", "error");
          return;
      }
      
      const FirebaseAuthentication = registerPlugin('FirebaseAuthentication');
      
      if (!FirebaseAuthentication) {
          window.notify("Plugin Native gagal dimuat.", "error");
          return;
      }
      
      const result = await FirebaseAuthentication.signInWithGoogle();
      
      if(result && result.credential && result.credential.idToken) {
          const credential = firebase.auth.GoogleAuthProvider.credential(result.credential.idToken);
          await auth.signInWithCredential(credential);
          window.notify("Berhasil masuk via Native!", "success");
      } else {
          throw new Error("Token Google tidak valid dari Native");
      }
    } else {
      // Use Web Popup (Only for browser/desktop)
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      window.notify("Berhasil masuk!", "success");
    }
  } catch (e) {
    console.error(e);
    window.notify("Gagal Login Google: " + (e.message || "Error tidak diketahui"), "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.handleRegisterAccount = async () => {
  const email = document.getElementById("login-email").value;
  const pin = document.getElementById("login-pin").value;
  if (!email || !pin || pin.length < 6)
    return window.notify("Isi Email dan PIN minimal 6 karakter", "error");
  window.toggleLoading(true, "Mendaftarkan akun...");
  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, pin); // <-- Ganti Auth jadi auth
    await db
      .collection("users")
      .doc(userCred.user.uid)
      .set({
        email: email,
        role: "pending",
        nama: email.split("@")[0],
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
    window.notify(
      "Akun berhasil dibuat! Menunggu persetujuan Admin.",
      "success",
    );
  } catch (e) {
    window.notify("Gagal daftar: " + e.message, "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.handleForgotPin = async () => {
  const email = document.getElementById("login-email").value;
  if (!email) return window.notify("Isi alamat Email!", "error");
  window.toggleLoading(true, "Mengirim link reset...");
  try {
    await auth.sendPasswordResetEmail(email);
    window.notify("Link reset dikirim ke email Anda.", "success");
  } catch (e) {
    // <-- Ganti Auth jadi auth
    window.notify("Gagal kirim reset link.", "error");
  } finally {
    window.toggleLoading(false);
  }
};
window.logout = () => window.openModal("modal-logout");
window.confirmLogout = () => auth.signOut().then(() => location.reload());

auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const userDoc = await Promise.race([
        db.collection("users").doc(user.uid).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
      ]);
      if (!userDoc.exists) {
        const newUser = {
          email: user.email,
          role: "pending",
          nama: user.email.split("@")[0],
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
        };
        await Promise.race([
          db.collection("users").doc(user.uid).set(newUser),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
        ]);
        window.STATE.user = { uid: user.uid, ...newUser };
      } else {
        window.STATE.user = { uid: user.uid, ...userDoc.data() };
      }

      if (window.STATE.user.role === "pending") {
        window.notify(
          "Akun Anda sedang menunggu persetujuan Admin/Ketua.",
          "error",
        );
        await auth.signOut();
        if (document.getElementById("loading-overlay"))
          document.getElementById("loading-overlay").classList.add("hidden");
        return;
      }
    } catch (e) {
      console.error("Gagal memverifikasi status akun di dashboard:", e);
      window.notify("Terjadi kesalahan koneksi atau kuota database terlampaui.", "error");
      await auth.signOut();
      if (document.getElementById("loading-overlay"))
        document.getElementById("loading-overlay").classList.add("hidden");
      return;
    }

    window.resetIdleTimer();
    if (document.getElementById("Auth-screen"))
      document.getElementById("Auth-screen").classList.add("hidden");
    if (document.getElementById("dashboard-screen"))
      document.getElementById("dashboard-screen").classList.remove("hidden");
    if (document.getElementById("loading-overlay"))
      document.getElementById("loading-overlay").classList.add("hidden");

    let r = window.STATE.user.role || "user";
    let roleName =
      r === "admin_utama" || r === "creator"
        ? "Admin"
        : r === "bendahara"
          ? "Bendahara"
          : r === "sekretaris"
            ? "Sekretaris"
            : r === "koordinator_wilayah"
              ? "Koordinator Wilayah"
              : r === "ketua"
                ? "Ketua"
                : "Viewer";
    if (document.getElementById("greeting"))
      document.getElementById("greeting").innerText =
        `Petugas: ${window.STATE.user.nama} | ${roleName}`;

    // --- BATAS VALIDASI HAK AKSES FITUR WA ---
    const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    // (greeting sudah diset di atas — baris duplikat dihapus)

    // SINKRONISASI FOTO AVATAR DI HEADER SAAT HALAMAN SELESAI DIMUAT
    const avatarUrl =
      window.STATE.user.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(window.STATE.user.nama || "User")}&background=6366f1&color=fff`;
    const avatarEl = document.getElementById("user-avatar-header");
    if (avatarEl) avatarEl.src = avatarUrl;

    // SINKRONISASI INFO PENGGUNA DI TAB PENGATURAN
    const sNameEl = document.getElementById("settings-user-name");
    const sRoleEl = document.getElementById("settings-user-role");
    const sAvatarEl = document.getElementById("user-avatar-settings");
    if (sNameEl) sNameEl.innerText = window.STATE.user.nama || "User";
    if (sRoleEl) {
      const roleNames = {
        creator: "Creator / Pemilik Sistem",
        admin_utama: "Admin Utama",
        sekretaris: "Sekretaris",
        bendahara: "Bendahara",
        koordinator_wilayah: "Koordinator Wilayah",
        panitia_divisi: "Panitia Divisi",
        viewer: "Viewer / Tamu",
        publikasi: "Humas Publikasi",
      };
      sRoleEl.innerText = roleNames[r] || r.toUpperCase();
    }
    if (sAvatarEl) sAvatarEl.src = avatarUrl;

    // SINKRONISASI INFO PENGGUNA DI SIDEBAR FOOTER
    const sidebarNameEl = document.getElementById("sidebar-user-name");
    const sidebarRoleEl = document.getElementById("sidebar-user-role");
    const sidebarAvatarEl = document.getElementById("sidebar-user-avatar");
    if (sidebarNameEl) sidebarNameEl.innerText = window.STATE.user.nama || "User";
    if (sidebarRoleEl) {
      const roleNames = {
        creator: "Creator / Pemilik Sistem",
        admin_utama: "Admin Utama",
        sekretaris: "Sekretaris",
        bendahara: "Bendahara",
        koordinator_wilayah: "Koordinator Wilayah",
        panitia_divisi: "Panitia Divisi",
        viewer: "Viewer / Tamu",
        publikasi: "Humas Publikasi",
      };
      sidebarRoleEl.innerText = roleNames[r] || r.toUpperCase();
    }
    if (sidebarAvatarEl) sidebarAvatarEl.src = avatarUrl;

    // --- PENYARINGAN VISIBILITAS NAVIGASI BERDASARKAN PERAN ---
    const showElement = (id, show) => {
      const el = document.getElementById(id);
      if (el) {
        if (show) el.classList.remove("hidden");
        else el.classList.add("hidden");
      }
    };

    // Tampilkan/sembunyikan sub-tab administrasi di Pusat Pengaturan
    const isAdmin = r === "admin_utama" || r === "creator";
    showElement("subbtn-settings-event", isAdmin);
    showElement("subbtn-settings-users", isAdmin);
    showElement("subbtn-settings-approve", isAdmin);
    showElement("subbtn-settings-audit", isAdmin);
    
    showElement("subbtn-logo-event", isAdmin);
    showElement("subbtn-logo-users", isAdmin);
    showElement("subbtn-logo-approve", isAdmin);
    showElement("subbtn-logo-audit", isAdmin);

    showElement("subbtn-mobile-settings-event", isAdmin);
    showElement("subbtn-mobile-settings-users", isAdmin);
    showElement("subbtn-mobile-settings-approve", isAdmin);
    showElement("subbtn-mobile-settings-audit", isAdmin);
    
    showElement("card-data-tools-tab", isAdmin);

    const allowedApiRoles =
      window.STATE.eventInfo && window.STATE.eventInfo.api_access_roles
        ? window.STATE.eventInfo.api_access_roles
        : ["admin_utama", "creator"];
    const canAccessApi = allowedApiRoles.includes(r);
    showElement("subbtn-settings-ai", canAccessApi);
    showElement("subbtn-logo-ai", canAccessApi);
    showElement("subbtn-mobile-settings-ai", canAccessApi);

    const canAccessGallery = r === "admin_utama" || r === "creator" || r === "publikasi";
    showElement("subbtn-settings-gallery", canAccessGallery);
    showElement("subbtn-logo-gallery", canAccessGallery);
    showElement("subbtn-mobile-settings-gallery", canAccessGallery);

    const canAccessWaApi = ["admin_utama", "creator", "bendahara", "sekretaris"].includes(r);
    showElement("btn-broadcast-alumni", canAccessWaApi);
    
    // Tanya AI is available to all logged in users (r exists)
    const canUseAI = !!r;
    showElement("btn-sidebar-tanya-ai", canUseAI);
    showElement("btn-mobile-tanya-ai", canUseAI);
    showElement("btn-floating-tanya-ai", canUseAI);

    // 1. Verifikasi (Requests)
    const canVerify = ["creator", "admin_utama", "sekretaris", "bendahara", "ketua", "koordinator_wilayah", "korwil_kabupaten", "korwil_kecamatan", "korwil_desa"].includes(r);
    showElement("btn-requests", canVerify);
    showElement("btn-mobile-requests", canVerify);

    // 2. Keuangan & RAB
    const canFinance = ["creator", "admin_utama", "bendahara", "sekretaris", "ketua", "koordinator_wilayah", "korwil_kabupaten", "korwil_kecamatan", "korwil_desa"].includes(r);
    showElement("btn-finance", canFinance);
    showElement("btn-mobile-finance", canFinance);
    const canRAB = ["creator", "admin_utama", "bendahara", "sekretaris", "ketua"].includes(r);
    showElement("btn-rab", canRAB);
    showElement("btn-mobile-rab", canRAB);

    // 3. WhatsApp Center (Dinamis: Server di HP, API di Web)
    const canWA = ["creator", "admin_utama", "sekretaris", "bendahara"].includes(r);
    showElement("btn-whatsapp", canWA);
    showElement("btn-mobile-whatsapp", canWA);
    
    // Toggle layout di dalam tab-whatsapp
    showElement("wa-nodejs-container", isNative);
    showElement("wa-status-chips", isNative);
    showElement("wa-web-api-container", !isNative);
    
    const headerTitle = document.getElementById("wa-header-title");
    const headerDesc = document.getElementById("wa-header-desc");
    if (headerTitle && headerDesc) {
        if (isNative) {
            headerTitle.innerText = "WhatsApp Server";
            headerDesc.innerText = "Manajemen Koneksi Bot Server";
        } else {
            headerTitle.innerText = "WhatsApp API Gateway";
            headerDesc.innerText = "Pengaturan & Sinkronisasi API WA";
        }
    }

    // 4. Logistik
    const canLogistik = ["creator", "admin_utama", "sekretaris", "bendahara", "ketua", "panitia_divisi", "koordinator_wilayah"].includes(r);
    showElement("btn-logistik", canLogistik);
    showElement("btn-mobile-logistik", canLogistik);

    // 5. Tugas & Panitia
    const isPanitia = r !== "viewer";
    showElement("btn-tugas", isPanitia);
    showElement("btn-mobile-tugas", isPanitia);
    showElement("btn-panitia", isPanitia);
    showElement("btn-mobile-panitia", isPanitia);

    // 6. Sembunyikan Header Kategori Sidebar jika tidak ada tombol di bawahnya
    // Kategori Keuangan & Aset
    const hasKeuanganItems = canFinance || canLogistik;
    showElement("heading-keuangan", hasKeuanganItems);

    // Kategori Integrasi (WhatsApp Center)
    showElement("heading-integrasi", canWA);
    
    // Inisialisasi Notifikasi Lokal (Tanpa Server)
    if (typeof window.initLocalNotifications === "function") window.initLocalNotifications();

    window.loadDataRealtime();
    if (typeof window.loadCloudinaryConfig === "function") window.loadCloudinaryConfig();
    window.showTab("home");
  } else {
    window.STATE.user = null;
    window.location.href = "login.html"; // Otomatis lempar ke halaman login jika belum masuk
  }
});
// ==========================================
// DATA SYNC & RENDER TABS
// ==========================================
window.processCombinedData = () => {
  try {
    window.STATE.pendingFinance = window.STATE.rawFinance.filter(
      (f) => f.status === "pending_payment",
    );
    window.STATE.rab = window.STATE.rawFinance.filter(
      (f) => f.kategori === "RAB",
    );
    window.STATE.finance = window.STATE.rawFinance.filter(
      (f) =>
        (f.kategori !== "RAB" && f.status !== "pending_payment") ||
        (f.kategori === "RAB" && f.status === "pengeluaran"),
    );
    window.STATE.requests = window.STATE.rawAlumni.filter(
      (a) => a.status === "pending",
    );

    // === PROTEKSI WILAYAH FILTER UNTUK KOORDINATOR WILAYAH ===
    if (window.STATE.user && ["koordinator_wilayah", "korwil_kabupaten", "korwil_kecamatan", "korwil_desa"].includes(window.STATE.user.role)) {
      window.STATE.requests = window.STATE.requests.filter(a => window.canUserManageAlumnus(window.STATE.user, a));
      
      window.STATE.pendingFinance = window.STATE.pendingFinance.filter((f) => {
        const matchedAlumni = window.STATE.rawAlumni.find(a => a.id === f.ref_alumni_id);
        if (!matchedAlumni) return false;
        return window.canUserFinAlumnus(window.STATE.user, matchedAlumni);
      });

      window.STATE.finance = window.STATE.finance.filter((f) => {
        if (f.kategori === "RAB") return false;
        const matchedAlumni = window.STATE.rawAlumni.find(a => a.id === f.ref_alumni_id);
        if (!matchedAlumni) return false;
        return window.canUserFinAlumnus(window.STATE.user, matchedAlumni);
      });
    }

    window.STATE.alumni = window.STATE.rawAlumni
      .filter((a) => a.status === "approved")
      .map((a) => {
        const totalD = window.STATE.finance
          .filter((f) => f.ref_alumni_id === a.id && f.status === "pemasukan")
          .reduce((s, c) => s + (Number(c.nominal) || 0), 0);
        return { ...a, totalDonasi: totalD };
      });

    // FILTER KOORDINATOR WILAYAH UNTUK DAFTAR ALUMNI AKTIF
    if (window.STATE.user && ["koordinator_wilayah", "korwil_kabupaten", "korwil_kecamatan", "korwil_desa"].includes(window.STATE.user.role)) {
      window.STATE.alumni = window.STATE.alumni.filter((a) =>
        window.canUserManageAlumnus(window.STATE.user, a)
      );
    }

    const searchInput = document.getElementById("search-alumni-input");
    if (!searchInput || !searchInput.value)
      window.filteredAlumniData = [...window.STATE.alumni];
    window.filteredRekapData = [...window.STATE.alumni];
    // Isi dropdown filter angkatan & kabupaten & provinsi secara dinamis
    if (typeof window.populateAlumniFilters === "function") window.populateAlumniFilters();
    if (typeof window.populateKabupatenFilter === "function") window.populateKabupatenFilter();
    if (typeof window.populateProvinsiFilter === "function") window.populateProvinsiFilter();

    const typeFilter = document.getElementById("fin-type-filter")
      ? document.getElementById("fin-type-filter").value
      : "all";
    window.currentFinanceData = window.STATE.finance;
    if (typeFilter !== "all")
      window.currentFinanceData = window.currentFinanceData.filter(
        (f) => f.status === typeFilter,
      );

    try {
      window.updateFilterOptions();
    } catch (e) {}
    try {
      if (typeof window.applyAlumniFilters === "function") {
        window.applyAlumniFilters(true);
      } else {
        window.sortAlumni(window.sortConfig.alumni.key, true);
      }
    } catch (e) {}
    try {
      window.sortFinance(window.sortConfig.finance.key, true);
    } catch (e) {}

    const selectAlumni = document.getElementById("fin-ref-select");
    if (selectAlumni) {
      const currentVal = selectAlumni.value;
      selectAlumni.innerHTML =
        '<option value="">-- Pilih Nama Alumni --</option>' +
        window.STATE.alumni
          .map(
            (a) =>
              `<option value="${window.escapeHtml(a.id)}" data-name="${window.escapeHtml(a.nama)}">${window.escapeHtml(a.nama)} (${window.escapeHtml(a.angkatan)})</option>`,
          )
          .join("");
      selectAlumni.value = currentVal;
    }
    const selectLogistik = document.getElementById("log-ref-select");
    if (selectLogistik) {
      const currentVal = selectLogistik.value;
      selectLogistik.innerHTML =
        '<option value="">-- Pilih Nama Alumni --</option>' +
        window.STATE.alumni
          .map(
            (a) => `<option value="${window.escapeHtml(a.id)}">${window.escapeHtml(a.nama)} (${window.escapeHtml(a.angkatan)})</option>`,
          )
          .join("");
      selectLogistik.value = currentVal;
    }
    try {
      if (typeof window.updateAlumniMetrics === "function") window.updateAlumniMetrics();
    } catch (e) {
      console.error("updateAlumniMetrics error:", e);
    }
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(() => {
      window.renderAllTabs();
    }, 100);
  }
};

window.updateBadges = () => {
  const pendingRequestsCount =
    (window.STATE.requests ? window.STATE.requests.length : 0) +
    (window.STATE.pendingFinance ? window.STATE.pendingFinance.length : 0);

  const pendingUsersCount = window.STATE.users
    ? window.STATE.users.filter((u) => u.role === "pending").length
    : 0;

  // 1. Desktop Sidebar Requests Badge
  const badgeRequests = document.getElementById("badge-requests");
  if (badgeRequests) {
    if (pendingRequestsCount > 0) {
      badgeRequests.innerText = pendingRequestsCount;
      badgeRequests.classList.remove("hidden");
    } else {
      badgeRequests.classList.add("hidden");
    }
  }

  // 2. Reuni Logo settings/approve submenu badge
  const badgeApproveLogo = document.getElementById("badge-logo-approve");
  if (badgeApproveLogo) {
    if (pendingUsersCount > 0) {
      badgeApproveLogo.innerText = pendingUsersCount;
      badgeApproveLogo.classList.remove("hidden");
    } else {
      badgeApproveLogo.classList.add("hidden");
    }
  }
  
  // 3. Mobile bottom nav "Lainnya" (Menu) badge (sum of requests + user approvals)
  const badgeMobileMore = document.getElementById("badge-mobile-more");
  if (badgeMobileMore) {
    const totalMobileMore = pendingRequestsCount + pendingUsersCount;
    if (totalMobileMore > 0) {
      badgeMobileMore.innerText = totalMobileMore;
      badgeMobileMore.classList.remove("hidden");
    } else {
      badgeMobileMore.classList.add("hidden");
    }
  }

  // 4. Mobile sheet "Verifikasi" button badge
  const badgeMobileRequests = document.getElementById("badge-mobile-requests");
  if (badgeMobileRequests) {
    if (pendingRequestsCount > 0) {
      badgeMobileRequests.innerText = pendingRequestsCount;
      badgeMobileRequests.classList.remove("hidden");
    } else {
      badgeMobileRequests.classList.add("hidden");
    }
  }

  // 5. Mobile sheet "Pusat Pengaturan" button badge
  const badgeMobileSettings = document.getElementById("badge-mobile-settings");
  if (badgeMobileSettings) {
    if (pendingUsersCount > 0) {
      badgeMobileSettings.innerText = pendingUsersCount;
      badgeMobileSettings.classList.remove("hidden");
    } else {
      badgeMobileSettings.classList.add("hidden");
    }
  }

  // 6. Mobile sheet settings sub-tab "Setujui" pill badge
  const badgeMobileSettingsApprove = document.getElementById("badge-mobile-settings-approve");
  if (badgeMobileSettingsApprove) {
    if (pendingUsersCount > 0) {
      badgeMobileSettingsApprove.innerText = pendingUsersCount;
      badgeMobileSettingsApprove.classList.remove("hidden");
    } else {
      badgeMobileSettingsApprove.classList.add("hidden");
    }
  }
};

window.renderAllTabs = () => {
  try {
    window.renderHome();
  } catch (e) {}
  try {
    window.renderAlumniTable();
  } catch (e) {}
  try {
    window.renderFinanceTable();
  } catch (e) {}
  try {
    window.renderRequestTable();
  } catch (e) {}
  try {
    window.renderRekapWilayah();
  } catch (e) {}
  try {
    window.renderRABTable();
  } catch (e) {}
  try {
    window.renderPanitiaTable();
  } catch (e) {}
  try {
    window.renderRundownTable();
  } catch (e) {}
  try {
    window.renderGuestbookTable();
  } catch (e) {}

  if (typeof window.updateBadges === "function") {
    window.updateBadges();
  }

  if (window.STATE.user) {
    const r = window.STATE.user.role;
    const btnRek = document.getElementById("btn-payment-settings");
    if (btnRek) {
      if (r === "admin_utama" || r === "creator" || r === "bendahara")
        btnRek.classList.remove("hidden");
      else btnRek.classList.add("hidden");
    }
  }
};

window.loadDataRealtime = () => {
  db.collection("settings")
    .doc("event_info")
    .onSnapshot((docSnap) => {
      if (docSnap.exists) {
        const data = docSnap.data();
        window.STATE.eventDate = data.event_date || "TBD";
        window.STATE.eventTime = data.event_time || "";
        window.STATE.eventGuest = data.event_guest || "";
        window.STATE.eventWaHumas = data.wa_humas || "";
        window.STATE.eventInfo = data;
        if (typeof window.populateEventSettingsForm === "function") {
          window.populateEventSettingsForm();
        }
        if (typeof window.renderAllTabs === "function") window.renderAllTabs();
      }
    });
  db.collection("guestbook").onSnapshot((snap) => {
    window.STATE.guestbook = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    window.renderGuestbookTable();
  });
  db.collection("users").onSnapshot((snap) => {
    window.STATE.users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    if (
      document.getElementById("modal-users") &&
      !document.getElementById("modal-users").classList.contains("hidden")
    )
      window.renderUsers();
    if (
      document.getElementById("modal-approve-users") &&
      !document.getElementById("modal-approve-users").classList.contains("hidden")
    )
      window.renderApproveUsers();
    
    if (typeof window.updateBadges === "function") window.updateBadges();
  });
  db.collection("rundown")
    .orderBy("waktu", "asc")
    .onSnapshot((snap) => {
      window.STATE.rundown = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      window.renderRundownTable();
    });
  db.collection("panitia").onSnapshot((snap) => {
    window.STATE.panitia = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    window.renderPanitiaTable();
  });

  window.incrementSyncVersion = async (type) => {
    try {
      const syncRef = db.collection("settings").doc("sync_state");
      const docSnap = await syncRef.get();
      const data = docSnap.exists ? docSnap.data() : { alumni_version: "1", finance_version: "1" };
      
      if (type === 'alumni') {
        const newVer = (parseInt(data.alumni_version) || 0) + 1;
        await syncRef.set({ alumni_version: String(newVer) }, { merge: true });
        // Trigger upload approved alumni to Cloudinary
        if (typeof window.triggerAlumniCloudinaryUpload === 'function') {
            window.triggerAlumniCloudinaryUpload();
        }
        if (typeof window.triggerAlumniAllCloudinaryUpload === 'function') {
            window.triggerAlumniAllCloudinaryUpload();
        }

      } else if (type === 'finance') {
        const newVer = (parseInt(data.finance_version) || 0) + 1;
        await syncRef.set({ finance_version: String(newVer) }, { merge: true });
        if (typeof window.triggerFinanceCloudinaryUpload === 'function') {
            window.triggerFinanceCloudinaryUpload();
        }
      }
    } catch (e) {
      console.error("Gagal increment sync version:", e);
    }
  };

  window.triggerAlumniCloudinaryUpload = async () => {
    try {
        console.log("[Cloudinary JSON Upload] Fetching fresh approved alumni list from Firestore...");
        const snap = await db.collection("alumni").where("status", "==", "approved").get();
        const approvedAlumni = snap.docs.map(d => ({
            id: d.id,
            nama: d.data().nama,
            angkatan: d.data().angkatan,
            nowa: d.data().nowa || "",
            lembaga: d.data().lembaga || "",
            kabupaten: d.data().kabupaten || ""
        }));
        
        const jsonString = JSON.stringify(approvedAlumni);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const file = new File([blob], 'alumni.json', { type: 'application/json' });
        
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "Reuniakbar");
        formData.append("public_id", "alumni.json");
        formData.append("resource_type", "raw");
        
        const response = await fetch("https://api.cloudinary.com/v1_1/dowih3wr7/raw/upload", {
            method: "POST",
            body: formData
        });
        const resData = await response.json();
        console.log("[Cloudinary JSON Upload] Success alumni.json:", resData.secure_url);
    } catch (e) {
        console.error("[Cloudinary JSON Upload] Error alumni.json:", e);
    }
  };

  window.triggerAlumniAllCloudinaryUpload = async () => {
    try {
        console.log("[Cloudinary JSON Upload] Fetching all alumni list from Firestore...");
        const snap = await db.collection("alumni").get();
        const allAlumni = snap.docs.map(d => ({
            id: d.id,
            nama: d.data().nama,
            angkatan: d.data().angkatan,
            nowa: d.data().nowa || "",
            status: d.data().status || "pending",
            created_at: d.data().created_at || "",
            alamat: d.data().alamat || "",
            desa: d.data().desa || "",
            kecamatan: d.data().kecamatan || "",
            kabupaten: d.data().kabupaten || "",
            provinsi: d.data().provinsi || "",
            lembaga: d.data().lembaga || "",
            bukti_transfer_alumni: d.data().bukti_transfer_alumni || ""
        }));
        
        const jsonString = JSON.stringify(allAlumni);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const file = new File([blob], 'alumni_all.json', { type: 'application/json' });
        
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "Reuniakbar");
        formData.append("public_id", "alumni_all.json");
        formData.append("resource_type", "raw");
        
        const response = await fetch("https://api.cloudinary.com/v1_1/dowih3wr7/raw/upload", {
            method: "POST",
            body: formData
        });
        const resData = await response.json();
        console.log("[Cloudinary JSON Upload] Success alumni_all.json:", resData.secure_url);
    } catch (e) {
        console.error("[Cloudinary JSON Upload] Error alumni_all.json:", e);
    }
  };

  window.triggerFinanceCloudinaryUpload = async () => {
    try {
        console.log("[Cloudinary JSON Upload] Fetching all finance records from Firestore...");
        const snap = await db.collection("finance").get();
        const allFinance = snap.docs.map(d => ({
            id: d.id,
            ref_alumni_id: d.data().ref_alumni_id || "",
            nama_pembayar: d.data().nama_pembayar || "",
            angkatan_pembayar: d.data().angkatan_pembayar || "",
            lembaga_pembayar: d.data().lembaga_pembayar || "",
            nominal: d.data().nominal || 0,
            status: d.data().status || "pending",
            kategori: d.data().kategori || "Donasi",
            bukti_url: d.data().bukti_url || "",
            bukti_hash: d.data().bukti_hash || "",
            tanggal: d.data().tanggal || "",
            created_at: d.data().created_at || "",
            payment_method: d.data().payment_method || "Manual"
        }));
        
        const jsonString = JSON.stringify(allFinance);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const file = new File([blob], 'finance.json', { type: 'application/json' });
        
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "Reuniakbar");
        formData.append("public_id", "finance.json");
        formData.append("resource_type", "raw");
        
        const response = await fetch("https://api.cloudinary.com/v1_1/dowih3wr7/raw/upload", {
            method: "POST",
            body: formData
        });
        const resData = await response.json();
        console.log("[Cloudinary JSON Upload] Success finance.json:", resData.secure_url);
    } catch (e) {
        console.error("[Cloudinary JSON Upload] Error finance.json:", e);
    }
  };

  window.manualSyncCloudinary = async () => {
    try {
        window.toggleLoading(true, "Menyinkronkan data alumni & keuangan ke Cloudinary...");
        await window.triggerAlumniCloudinaryUpload();
        await window.triggerAlumniAllCloudinaryUpload();
        await window.triggerFinanceCloudinaryUpload();
        window.notify("Sinkronisasi JSON Cloudinary Berhasil!", "success");
    } catch (e) {
        console.error(e);
        window.notify("Gagal menyinkronkan data!", "error");
    } finally {
        window.toggleLoading(false);
    }
  };

  window.getCloudinaryPublicId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) return null;
    let publicIdWithExt = match[1];
    const isRaw = url.includes('/raw/upload/');
    if (isRaw) {
      return { publicId: publicIdWithExt, resourceType: 'raw' };
    }
    const lastDotIdx = publicIdWithExt.lastIndexOf('.');
    const publicId = lastDotIdx !== -1 ? publicIdWithExt.substring(0, lastDotIdx) : publicIdWithExt;
    return { publicId, resourceType: 'image' };
  };

  window.deleteCloudinaryFileByUrl = async (url) => {
    if (!url || url.includes('ui-avatars.com') || url.includes('flaticon.com')) return;
    const parsed = window.getCloudinaryPublicId(url);
    if (!parsed) return;
    
    try {
      const settingsDoc = await db.collection("settings").doc("payment_gateway").get();
      if (!settingsDoc.exists) return;
      const gasUrl = settingsDoc.data().gas_url;
      if (!gasUrl) return;
      
      console.log(`[Cloudinary Destroy] Requesting delete for publicId: ${parsed.publicId}`);
      const res = await fetch(`${gasUrl}?action=deleteCloudinaryFile`, {
        method: "POST",
        body: JSON.stringify({
          publicId: parsed.publicId,
          resourceType: parsed.resourceType
        })
      });
      const resData = await res.json();
      console.log("[Cloudinary Destroy] Result:", resData);
    } catch (err) {
      console.error("[Cloudinary Destroy] Failed:", err);
    }
  };

  // --- CLIENT-SIDE VERSION-BASED CACHING SYNC SYSTEM ---
  db.collection("settings").doc("sync_state").onSnapshot(async (doc) => {
    const syncData = doc.exists ? doc.data() : { alumni_version: "1", finance_version: "1" };
    
    const localAlumniVer = localStorage.getItem('alumni_version');
    const localFinanceVer = localStorage.getItem('finance_version');
    
    // 1. Sinkronisasi Alumni
    let cachedAlumni = [];
    try {
        const stored = localStorage.getItem('cached_alumni');
        if (stored) cachedAlumni = JSON.parse(stored);
    } catch(e) {}

    if (localAlumniVer !== syncData.alumni_version || cachedAlumni.length === 0) {

        try {
            const snap = await db.collection("alumni").get();
            const freshAlumni = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Jalankan deteksi notifikasi lokal dengan membandingkan cache lama
            if (cachedAlumni.length > 0) {
                const oldIds = new Set(cachedAlumni.map(a => a.id));
                freshAlumni.forEach(item => {
                    if (!oldIds.has(item.id) && item.status === "pending") {
                        const createdAt = item.created_at ? (item.created_at.toDate ? item.created_at.toDate().getTime() : new Date(item.created_at).getTime()) : null;
                        if (createdAt && createdAt > window.APP_START_TIME) {
                            window.triggerLocalNotification(
                              "🔔 Alumni Baru Menunggu Verifikasi",
                              `${item.nama || "Alumni Baru"} (${item.angkatan || ""}) mendaftar dan menunggu verifikasi.`
                            );
                        }
                    }
                });
            }

            localStorage.setItem('cached_alumni', JSON.stringify(freshAlumni));
            localStorage.setItem('alumni_version', syncData.alumni_version || "1");
            window.STATE.rawAlumni = freshAlumni;
            
            // Auto trigger Cloudinary uploads
            if (typeof window.triggerAlumniCloudinaryUpload === 'function') {
                window.triggerAlumniCloudinaryUpload();
            }
            if (typeof window.triggerAlumniAllCloudinaryUpload === 'function') {
                window.triggerAlumniAllCloudinaryUpload();
            }
        } catch (err) {
            console.error("Gagal sinkronisasi alumni:", err);
            window.STATE.rawAlumni = cachedAlumni;
        }
    } else {

        window.STATE.rawAlumni = cachedAlumni;
    }

    // 2. Sinkronisasi Keuangan
    let cachedFinance = [];
    try {
        const stored = localStorage.getItem('cached_finance');
        if (stored) cachedFinance = JSON.parse(stored);
    } catch(e) {}

    if (localFinanceVer !== syncData.finance_version || cachedFinance.length === 0) {

        try {
            const snap = await db.collection("finance").get();
            const freshFinance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Jalankan deteksi notifikasi lokal dengan membandingkan cache lama
            if (cachedFinance.length > 0) {
                const oldIds = new Set(cachedFinance.map(f => f.id));
                freshFinance.forEach(item => {
                    if (!oldIds.has(item.id) && item.status === "pemasukan") {
                        const createdAt = item.created_at ? (item.created_at.toDate ? item.created_at.toDate().getTime() : new Date(item.created_at).getTime()) : null;
                        if (createdAt && createdAt > window.APP_START_TIME) {
                            const nominalFormatted = window.formatRupiah(Number(item.nominal) || 0);
                            window.triggerLocalNotification(
                              "💰 Donasi/Pemasukan Baru",
                              `${item.keterangan || item.nama_pembayar || "Donasi baru"} sebesar ${nominalFormatted} telah diterima.`
                            );
                        }
                    }
                });
            }

            localStorage.setItem('cached_finance', JSON.stringify(freshFinance));
            localStorage.setItem('finance_version', syncData.finance_version || "1");
            window.STATE.rawFinance = freshFinance;

            // Auto trigger Cloudinary upload
            if (typeof window.triggerFinanceCloudinaryUpload === 'function') {
                window.triggerFinanceCloudinaryUpload();
            }
        } catch (err) {
            console.error("Gagal sinkronisasi finance:", err);
            window.STATE.rawFinance = cachedFinance;
        }
    } else {

        window.STATE.rawFinance = cachedFinance;
    }

    window.processCombinedData();
  });
  window.STATE.paymentAccounts = [];
  db.collection("payment_accounts").onSnapshot((snap) => {
    window.STATE.paymentAccounts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    if (
      document.getElementById("modal-payment-settings") &&
      !document
        .getElementById("modal-payment-settings")
        .classList.contains("hidden")
    )
      window.renderPaymentAccounts();
  });
  db.collection("logistik").onSnapshot((snap) => {
    window.STATE.logistik = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    window.renderLogistikTable();
  });
};

// ==========================================
// RENDER FUNCTIONS (HOME, TABLES, dll)
// ==========================================
window.renderHome = () => {
  let inTotal = 0,
    outTotal = 0;
  let catCount = {};
  window.STATE.finance.forEach((f) => {
    const nom = Number(f.nominal) || 0;
    if (f.status === "pemasukan") {
      inTotal += nom;
      catCount[f.kategori] = (catCount[f.kategori] || 0) + nom;
    }
    if (f.status === "pengeluaran") outTotal += nom;
  });

  const balance = inTotal - outTotal;
  let totalRAB = window.STATE.rab.reduce(
    (s, c) => s + (Number(c.nominal) || 0),
    0,
  );
  window.TARGET_DANA = totalRAB > 0 ? totalRAB : 1;

  if (document.getElementById("stat-in"))
    document.getElementById("stat-in").innerText = window.formatRupiah(inTotal);
  if (document.getElementById("stat-out"))
    document.getElementById("stat-out").innerText =
      window.formatRupiah(outTotal);
  if (document.getElementById("stat-balance"))
    document.getElementById("stat-balance").innerText =
      window.formatRupiah(balance);
  if (document.getElementById("stat-alumni"))
    document.getElementById("stat-alumni").innerText =
      window.STATE.alumni.length;

  const perc = Math.min((balance / window.TARGET_DANA) * 100, 100).toFixed(1);
  if (document.getElementById("target-percentage"))
    document.getElementById("target-percentage").innerText = perc + "%";
  if (document.getElementById("target-progress"))
    document.getElementById("target-progress").style.width = perc + "%";
  if (document.getElementById("target-current"))
    document.getElementById("target-current").innerText =
      window.formatRupiah(balance);
  if (document.getElementById("target-max"))
    document.getElementById("target-max").innerText =
      `Target RAB: ${window.formatRupiah(totalRAB)}`;

  let angMap = {},
    kecMap = {},
    kabMap = {};
  window.STATE.finance.forEach((f) => {
    if (f.status === "pemasukan" && f.ref_alumni_id) {
      const a = window.STATE.alumni.find((x) => x.id === f.ref_alumni_id);
      if (a) {
        let nom = Number(f.nominal) || 0;
        if (a.angkatan) angMap[a.angkatan] = (angMap[a.angkatan] || 0) + nom;
        if (a.kabupaten)
          kabMap[a.kabupaten.toUpperCase()] =
            (kabMap[a.kabupaten.toUpperCase()] || 0) + nom;
        if (a.kecamatan)
          kecMap[a.kecamatan.toUpperCase()] =
            (kecMap[a.kecamatan.toUpperCase()] || 0) + nom;
      }
    }
  });

  const renderTop = (mapData, id, label) => {
    const s = Object.keys(mapData)
      .map((k) => ({ l: k, t: mapData[k] }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 3);
    const container = document.getElementById(id);
    if (!container) return;
    if (s.length === 0)
      return (container.innerHTML = `<div class="text-center text-slate-500 text-xs italic py-4">Belum ada donasi.</div>`);
    const meds = ["text-yellow-400", "text-slate-300", "text-amber-600"];
    container.innerHTML = s
      .map(
        (x, i) =>
          `<div class="flex items-center justify-between p-3 mb-2 bg-black/20 rounded-2xl border border-white/5 shadow-sm"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${meds[i]}"><i class="fas fa-medal"></i></div><div><div class="text-[8px] text-slate-400 uppercase font-bold">${label}</div><div class="text-sm font-black">${x.l}</div></div></div><div class="text-xs font-black text-emerald-500">${window.formatRupiah(x.t)}</div></div>`,
      )
      .join("");
  };
  renderTop(angMap, "leaderboard-angkatan", "Angkatan");
  renderTop(kabMap, "leaderboard-kabupaten", "Kabupaten");
  renderTop(kecMap, "leaderboard-kecamatan", "Kecamatan");

  try {
    const cdContainer = document.getElementById("home-countdown-container");
    if (cdContainer) {
      if (window.homeCountdownInterval)
        clearInterval(window.homeCountdownInterval);
      if (window.STATE.eventDate && window.STATE.eventDate !== "TBD") {
        cdContainer.classList.remove("hidden");
        const formattedDate = new Date(
          window.STATE.eventDate,
        ).toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        document.getElementById("home-event-date").innerText = formattedDate;
        const EVENT_DATE = new Date(window.STATE.eventDate).getTime();
        window.homeCountdownInterval = setInterval(() => {
          const now = new Date().getTime();
          const distance = EVENT_DATE - now;
          if (distance < 0) {
            clearInterval(window.homeCountdownInterval);
            document.getElementById("home-event-date").innerText =
              "🎉 Acara Sedang Berlangsung / Selesai!";
            ["days", "hours", "minutes", "seconds"].forEach((k) => {
              const el = document.getElementById(`home-cd-${k}`);
              if (el) el.innerText = "00";
            });
            return;
          }
          if (document.getElementById("home-cd-days"))
            document.getElementById("home-cd-days").innerText = Math.floor(
              distance / (1000 * 60 * 60 * 24),
            )
              .toString()
              .padStart(2, "0");
          if (document.getElementById("home-cd-hours"))
            document.getElementById("home-cd-hours").innerText = Math.floor(
              (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
            )
              .toString()
              .padStart(2, "0");
          if (document.getElementById("home-cd-minutes"))
            document.getElementById("home-cd-minutes").innerText = Math.floor(
              (distance % (1000 * 60 * 60)) / (1000 * 60),
            )
              .toString()
              .padStart(2, "0");
          if (document.getElementById("home-cd-seconds"))
            document.getElementById("home-cd-seconds").innerText = Math.floor(
              (distance % (1000 * 60)) / 1000,
            )
              .toString()
              .padStart(2, "0");
        }, 1000);
      } else {
        cdContainer.classList.add("hidden");
      }
    }
  } catch (e) {}

  try {
    const pieContainer = document.getElementById("pieChart");
    if (
      pieContainer &&
      pieContainer.offsetParent !== null &&
      typeof Chart !== "undefined"
    ) {
      if (window.pieChartInstance) window.pieChartInstance.destroy();
      const ctxPie = pieContainer.getContext("2d");
      window.pieChartInstance = new Chart(ctxPie, {
        type: "doughnut",
        data: {
          labels: Object.keys(catCount),
          datasets: [
            {
              data: Object.values(catCount),
              backgroundColor: [
                "#6366f1",
                "#10b981",
                "#f59e0b",
                "#3b82f6",
                "#ec4899",
              ],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: "#94a3b8", font: { size: 10 } },
            },
          },
        },
      });
    }
  } catch (e) {}

  // 1. TREN KAS & DONASI BULANAN (LINE CHART)
  try {
    const trendContainer = document.getElementById("chartKasDonasi");
    if (
      trendContainer &&
      trendContainer.offsetParent !== null &&
      typeof Chart !== "undefined"
    ) {
      /**
       * Konversi berbagai format tanggal ke "YYYY-MM" untuk grouping chart.
       * Format yang didukung:
       *   - "YYYY-MM-DD"  → ISO standard
       *   - "D/M/YYYY"    → "20/5/2026" atau "5/1/2025"
       *   - "DD/MM/YYYY"  → "20/05/2026"
       *   - ISO string    → "2026-05-20T12:00:00Z"
       *   - Firestore Timestamp object (.toDate())
       */
      function parseTanggalToMonthKey(tanggal) {
        if (!tanggal) return null;

        // Jika objek Firestore Timestamp
        if (tanggal && typeof tanggal.toDate === "function") {
          const d = tanggal.toDate();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }

        const str = String(tanggal).trim();

        // Format D/M/YYYY atau DD/MM/YYYY (slash)
        if (str.includes("/")) {
          const parts = str.split("/");
          if (parts.length === 3) {
            let day, month, year;
            // Cek apakah format YYYY/MM/DD atau DD/MM/YYYY
            if (parts[0].length === 4) {
              // YYYY/MM/DD
              year = parseInt(parts[0]);
              month = parseInt(parts[1]);
            } else {
              // DD/MM/YYYY atau D/M/YYYY
              day = parseInt(parts[0]);
              month = parseInt(parts[1]);
              year = parseInt(parts[2]);
            }
            if (!isNaN(year) && !isNaN(month) && year > 1970 && month >= 1 && month <= 12) {
              return `${year}-${String(month).padStart(2, "0")}`;
            }
          }
          return null;
        }

        // Format YYYY-MM-DD atau ISO string (substr aman karena dimulai YYYY)
        if (str.match(/^\d{4}-\d{2}/)) {
          return str.substring(0, 7); // "YYYY-MM"
        }

        // Fallback: coba parse pakai Date constructor
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }

        return null; // Tidak bisa diparse
      }

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

      let monthlyIn = {}, monthlyOut = {};
      window.STATE.finance.forEach((f) => {
        const monthKey = parseTanggalToMonthKey(f.tanggal);
        if (!monthKey) return; // Skip jika tidak bisa diparse
        const nom = Number(f.nominal) || 0;
        if (f.status === "pemasukan") {
          monthlyIn[monthKey] = (monthlyIn[monthKey] || 0) + nom;
        } else if (f.status === "pengeluaran") {
          monthlyOut[monthKey] = (monthlyOut[monthKey] || 0) + nom;
        }
      });

      const allMonths = Array.from(new Set([...Object.keys(monthlyIn), ...Object.keys(monthlyOut)])).sort();
      const displayMonths = allMonths.slice(-8); // Ambil maks 8 bulan terakhir

      const trendLabels = displayMonths.map(m => {
        // m selalu dalam format "YYYY-MM" setelah normalisasi
        const parts = m.split("-");
        const year = parts[0] || "??";
        const monthIdx = parseInt(parts[1] || "0") - 1;
        const monthName = monthNames[monthIdx] || "?";
        return `${monthName} '${year.substring(2)}`;
      });

      const trendIn  = displayMonths.map(m => monthlyIn[m]  || 0);
      const trendOut = displayMonths.map(m => monthlyOut[m] || 0);

      if (window.trendChartInstance) window.trendChartInstance.destroy();
      const ctxTrend = trendContainer.getContext("2d");
      window.trendChartInstance = new Chart(ctxTrend, {
        type: "line",
        data: {
          labels: trendLabels,
          datasets: [
            {
              label: "Pemasukan",
              data: trendIn,
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              borderWidth: 3,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: "#10b981",
              pointRadius: 4,
            },
            {
              label: "Pengeluaran",
              data: trendOut,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderWidth: 3,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: "#ef4444",
              pointRadius: 4,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: "#94a3b8", font: { size: 10 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${window.formatRupiah(ctx.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: { color: "#94a3b8", font: { size: 9 } }
            },
            y: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: {
                color: "#94a3b8",
                font: { size: 9 },
                callback: (v) => {
                  if (v >= 1000000) return "Rp " + (v / 1000000).toFixed(1) + "jt";
                  if (v >= 1000)    return "Rp " + (v / 1000).toFixed(0) + "rb";
                  return "Rp " + v;
                }
              }
            }
          }
        }
      });
    }
  } catch (e) {
    console.error("Gagal menggambar grafik tren bulanan:", e);
  }

  // 2. DISTRIBUSI ALUMNI PER ANGKATAN (BAR CHART)
  try {
    const angkatanContainer = document.getElementById("chartAngkatan");
    if (
      angkatanContainer &&
      angkatanContainer.offsetParent !== null &&
      typeof Chart !== "undefined"
    ) {
      let angCount = {};
      window.STATE.alumni.forEach((a) => {
        if (a.angkatan) {
          const cleanAng = String(a.angkatan).trim();
          if (/^\d{4}$/.test(cleanAng)) {
            angCount[cleanAng] = (angCount[cleanAng] || 0) + 1;
          }
        }
      });

      const sortedAngkatans = Object.keys(angCount).sort();
      const angData = sortedAngkatans.map(k => angCount[k]);

      if (window.angkatanChartInstance) window.angkatanChartInstance.destroy();
      const ctxAng = angkatanContainer.getContext("2d");
      window.angkatanChartInstance = new Chart(ctxAng, {
        type: "bar",
        data: {
          labels: sortedAngkatans.map(a => `'${a.substring(2)}`),
          datasets: [
            {
              label: "Jumlah Alumni",
              data: angData,
              backgroundColor: "rgba(139, 92, 246, 0.7)",
              borderColor: "#8b5cf6",
              borderWidth: 1,
              borderRadius: 6,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#94a3b8", font: { size: 9 } }
            },
            y: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: { color: "#94a3b8", font: { size: 9 }, stepSize: 1 }
            }
          }
        }
      });
    }
  } catch (e) {
    console.error("Gagal menggambar grafik angkatan:", e);
  }

  // 3. DONASI PER ANGKATAN (BAR CHART BARU)
  try {
    const donasiAngkatanContainer = document.getElementById("chartDonasiAngkatan");
    if (
      donasiAngkatanContainer &&
      donasiAngkatanContainer.offsetParent !== null &&
      typeof Chart !== "undefined"
    ) {
      // Kumpulkan donasi per angkatan dari data finance + alumni
      let donasiAngkMap = {};
      window.STATE.finance.forEach((f) => {
        if (f.status === "pemasukan" && f.ref_alumni_id) {
          const a = window.STATE.alumni.find((x) => x.id === f.ref_alumni_id);
          if (a && a.angkatan) {
            const cleanAng = String(a.angkatan).trim();
            if (/^\d{4}$/.test(cleanAng)) {
              donasiAngkMap[cleanAng] = (donasiAngkMap[cleanAng] || 0) + (Number(f.nominal) || 0);
            }
          }
        }
        // Juga cek nama_pembayar jika tidak ada ref_alumni_id (donasi langsung)
        if (f.status === "pemasukan" && !f.ref_alumni_id && f.angkatan_pembayar) {
          const cleanAng = String(f.angkatan_pembayar).trim();
          if (/^\d{4}$/.test(cleanAng)) {
            donasiAngkMap[cleanAng] = (donasiAngkMap[cleanAng] || 0) + (Number(f.nominal) || 0);
          }
        }
      });

      const sortedKeys = Object.keys(donasiAngkMap).sort();
      const donasiData = sortedKeys.map((k) => donasiAngkMap[k]);

      // Gradasi warna hijau-biru untuk bar
      const barColors = sortedKeys.map((_, i) => {
        const hue = 140 + (i / Math.max(sortedKeys.length - 1, 1)) * 80;
        return `hsla(${hue}, 70%, 55%, 0.75)`;
      });

      if (window.donasiAngkatanChartInstance) window.donasiAngkatanChartInstance.destroy();
      const ctxDA = donasiAngkatanContainer.getContext("2d");
      window.donasiAngkatanChartInstance = new Chart(ctxDA, {
        type: "bar",
        data: {
          labels: sortedKeys.map((a) => `Lulus '${String(a).slice(-2)}`),
          datasets: [
            {
              label: "Total Donasi (Rp)",
              data: donasiData,
              backgroundColor: barColors,
              borderColor: barColors.map((c) => c.replace("0.75", "1")),
              borderWidth: 1,
              borderRadius: 8,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => " " + window.formatRupiah(ctx.parsed.y),
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#94a3b8", font: { size: 9 } },
            },
            y: {
              grid: { color: "rgba(255,255,255,0.05)" },
              beginAtZero: true,
              suggestedMax: 1000000,
              ticks: {
                color: "#94a3b8",
                font: { size: 9 },
                callback: (v) => {
                  if (v % 1 !== 0) return null; // Sembunyikan tick pecahan
                  if (v >= 1000000) return "Rp " + (v / 1000000).toFixed(1) + "jt";
                  if (v >= 1000) return "Rp " + (v / 1000).toFixed(0) + "rb";
                  return "Rp " + v;
                },
              },
            },
          },
        },
      });
    }
  } catch (e) {
    console.error("Gagal menggambar grafik donasi per angkatan:", e);
  }
};
window.renderApproveUsers = () => {
  const tbody = document.getElementById("approve-users-list");
  if (!tbody) return;

  const pendingUsers = window.STATE.users.filter((u) => u.role === "pending");

  if (pendingUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-500 italic"><i class="fas fa-user-clock mr-2 text-lg"></i>Tidak ada pendaftaran baru yang perlu ditinjau</td></tr>`;
    return;
  }

  tbody.innerHTML = pendingUsers
    .map((u) => {
      return `
        <tr class="border-b border-white/5 hover:bg-black/5">
          <td class="p-4">
            <div class="font-bold">${u.nama || "-"}</div>
            <div class="text-[9px] text-slate-500">ID: ${u.uid}</div>
          </td>
          <td class="p-4 text-center">
            <span class="text-xs text-slate-300 font-bold">${u.email}</span>
          </td>
          <td class="p-4 text-center">
            <div class="flex gap-2 items-center justify-center">
              <button onclick="window.approveUserRegistration('${u.uid}')" class="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors flex items-center gap-1 font-bold text-[10px]" title="Setujui Pengguna">
                <i class="fas fa-check"></i> Setujui
              </button>
              <button onclick="window.rejectUserRegistration('${u.uid}')" class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1 font-bold text-[10px]" title="Tolak Pengguna">
                <i class="fas fa-times"></i> Tolak
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
};

window.approveUserRegistration = async (uid) => {
  window.toggleLoading(true, "Menyetujui Pengguna...");
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new Error("Pengguna tidak ditemukan.");
    }
    const userData = userDoc.data();

    await db.collection("users").doc(uid).update({ role: "user" });
    window.notify("Pendaftaran pengguna berhasil disetujui!", "success");

    // Kirim WhatsApp otomatis jika nomor WhatsApp tersedia
    if (userData.nowa) {
      const cleanPhone = window.normalizePhoneNumber ? window.normalizePhoneNumber(userData.nowa) : userData.nowa.replace(/\D/g, '');
      const msg = `*AKTIVASI AKUN PANITIA REUNI AL-FATAH* 🔓\n\nHalo *${userData.nama}*,\n\nSelamat! Akun panitia Anda telah disetujui oleh Admin Utama.\n\nSekarang Anda dapat login ke Dashboard Portal Panitia menggunakan:\n- Email: *${userData.email}*\n- PIN/Password: *(PIN yang telah Anda daftarkan)*\n\nSilakan masuk melalui tautan berikut:\n👉 https://phajar.github.io/Reuni/login.html\n\nMari kita bersinergi bersama untuk menyukseskan Reuni Akbar Pondok Pesantren AL-FATAH! 🤝\n\n_Pesan ini dikirim otomatis oleh Sistem Reuni Al-Fatah._`;

      if (window.sendWhatsAppInternal) {
        await window.sendWhatsAppInternal(cleanPhone, msg, null, 'broadcast');
        console.log(`[WA] Notifikasi aktivasi terkirim ke ${cleanPhone}`);
      } else {
        console.warn("[WA] Fungsi sendWhatsAppInternal tidak ditemukan.");
      }
    }

    if (window.renderApproveUsers) window.renderApproveUsers();
    if (window.renderUsers) window.renderUsers();
  } catch (e) {
    console.error(e);
    window.notify("Gagal menyetujui pengguna: " + e.message, "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.rejectUserRegistration = async (uid) => {
  const okDel = await window.showConfirm({
    title: 'Tolak Pendaftaran?',
    message: 'Yakin ingin menolak dan menghapus pendaftaran pengguna ini dari sistem? Tindakan ini tidak dapat dibatalkan.',
    confirmText: 'Ya, Tolak & Hapus',
    danger: true
  });
  if (!okDel) return;

  window.toggleLoading(true, "Menolak Pengguna...");
  try {
    await db.collection("users").doc(uid).delete();
    window.notify("Pendaftaran pengguna berhasil ditolak dan dihapus!", "success");
    if (window.renderApproveUsers) window.renderApproveUsers();
    if (window.renderUsers) window.renderUsers();
  } catch (e) {
    console.error(e);
    window.notify("Gagal menolak pengguna", "error");
  } finally {
    window.toggleLoading(false);
  }
};
window.renderUsers = () => {
  const tbody = document.getElementById("users-list");
  
  const dbHasCreator = window.STATE.users.some(u => u.role === "creator");
  
  const isOwner = (uObj) => {
      if (!uObj) return false;
      return uObj.role === "creator";
  };
  
  const currentUserIsOwner = isOwner(window.STATE.user);
  const isCurrentUserAdminUtama = window.STATE.user && (window.STATE.user.role === "admin_utama" || window.STATE.user.role === "creator");

  // Tombol Klaim Creator (Hanya muncul jika belum ada creator sama sekali)
  let claimBanner = "";
  if (!dbHasCreator && isCurrentUserAdminUtama) {
      claimBanner = `<div class="mb-4 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
          <div class="text-left"><h3 class="text-amber-500 font-black uppercase text-xs mb-1"><i class="fas fa-crown mr-2"></i>Sistem Tahta Creator Terbuka</h3>
          <p class="text-[9px] text-amber-200/70 font-bold">Saat ini belum ada akun yang menjadi Creator (Pemilik). Klaim tahta ini untuk melindungi akun Anda secara absolut.</p></div>
          <button onclick="window.updateUserRole('${window.STATE.user.uid}', 'creator')" class="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest transition-colors whitespace-nowrap shadow-[0_0_15px_rgba(245,158,11,0.3)]">Klaim Tahta</button>
      </div>`;
  }

  tbody.innerHTML = (claimBanner ? `<tr><td colspan="3" class="p-0 border-none">${claimBanner}</td></tr>` : "") + window.STATE.users
    .filter((u) => u.role !== "pending")
    .map((u) => {
      let rl = "Viewer", rc = "bg-slate-500/20 text-slate-500";
      if (isOwner(u)) {
        rl = "Creator"; rc = "bg-amber-500/20 text-amber-500";
      } else if (u.role === "admin_utama") {
        rl = "Admin"; rc = "bg-indigo-500/20 text-indigo-500";
      } else if (u.role === "bendahara") {
        rl = "Bendahara"; rc = "bg-emerald-500/20 text-emerald-500";
      } else if (u.role === "sekretaris") {
        rl = "Sekretaris"; rc = "bg-amber-500/20 text-amber-500";
      } else if (u.role === "ketua") {
        rl = "Ketua"; rc = "bg-rose-500/20 text-rose-500";
      } else if (u.role === "koordinator_wilayah") {
        rl = "Koor. Wilayah"; rc = "bg-cyan-500/20 text-cyan-500";
      } else if (u.role === "korwil_kabupaten") {
        rl = "Koor. Wil. Kabupaten"; rc = "bg-cyan-500/20 text-cyan-500";
      } else if (u.role === "korwil_kecamatan") {
        rl = "Koor. Wil. Kecamatan"; rc = "bg-cyan-500/20 text-cyan-500";
      } else if (u.role === "korwil_desa") {
        rl = "Koor. Wil. Desa"; rc = "bg-cyan-500/20 text-cyan-500";
      } else if (u.role === "pending") {
        rl = "Pending"; rc = "bg-orange-500/20 text-orange-400";
      }

      let actionBtn = `<div class="flex gap-2 items-center justify-center">`;
      const isSelf = u.email === (window.STATE.user && window.STATE.user.email);
      const thisUserIsOwner = isOwner(u);
      
      if (!thisUserIsOwner && !isSelf) {
          actionBtn += `<select onchange="updateUserRole('${u.uid}', this.value)" class="input-field py-2 text-[10px] w-auto">
                    <option value="pending" ${u.role === "pending" ? "selected" : ""}>Pending (Blm Disetujui)</option>
                    <option value="user" ${u.role === "user" ? "selected" : ""}>Viewer (Disetujui)</option>
                    <option value="sekretaris" ${u.role === "sekretaris" ? "selected" : ""}>Sekretaris</option>
                    <option value="bendahara" ${u.role === "bendahara" ? "selected" : ""}>Bendahara</option>
                    <option value="koordinator_wilayah" ${u.role === "koordinator_wilayah" ? "selected" : ""}>Koor Wilayah (Legacy)</option>
                    <option value="korwil_kabupaten" ${u.role === "korwil_kabupaten" ? "selected" : ""}>Koor Wil. Kabupaten</option>
                    <option value="korwil_kecamatan" ${u.role === "korwil_kecamatan" ? "selected" : ""}>Koor Wil. Kecamatan</option>
                    <option value="korwil_desa" ${u.role === "korwil_desa" ? "selected" : ""}>Koor Wil. Desa</option>
                    <option value="ketua" ${u.role === "ketua" ? "selected" : ""}>Ketua</option>
                    <option value="admin_utama" ${u.role === "admin_utama" ? "selected" : ""}>Admin Utama</option>
                    ${currentUserIsOwner ? `<option value="creator">👑 Jadikan Creator Baru</option>` : ''}
                </select>`;
      } else if (thisUserIsOwner) {
          actionBtn += `<span class="text-[9px] text-amber-500 font-black tracking-widest uppercase bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]"><i class="fas fa-crown mr-1"></i>Creator</span>`;
      }

      if (["koordinator_wilayah", "korwil_kabupaten", "korwil_kecamatan", "korwil_desa"].includes(u.role)) {
        actionBtn += `<button onclick="window.openModalSetWilayah('${u.uid}')" class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-colors flex-shrink-0" title="Set Wilayah"><i class="fas fa-map-marker-alt"></i></button>`;
      }

      if (!thisUserIsOwner && !isSelf) {
        actionBtn += `<button onclick="window.deleteUser('${u.uid}')" class="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex-shrink-0" title="Hapus Pengguna"><i class="fas fa-trash"></i></button>`;
      }
      actionBtn += `</div>`;

      let scopeText = "";
      if (["koordinator_wilayah", "korwil_kabupaten", "korwil_kecamatan", "korwil_desa"].includes(u.role)) {
        let locParts = [];
        if (u.wilayah_kabupaten) locParts.push(u.wilayah_kabupaten);
        if (["koordinator_wilayah", "korwil_kecamatan", "korwil_desa"].includes(u.role) && u.wilayah_kecamatan) locParts.push(u.wilayah_kecamatan);
        if (["koordinator_wilayah", "korwil_desa"].includes(u.role) && u.wilayah_desa) locParts.push(u.wilayah_desa);
        const locStr = locParts.length > 0 ? locParts.join(" - ") : "Belum diset";
        scopeText = `<div class="text-[8px] mt-1 text-cyan-400 italic">Wilayah: ${locStr}</div>`;
      }

      return (
        `<tr class="border-b border-white/5 hover:bg-black/5"><td class="p-4"><div class="font-bold">${u.nama || "-"}</div><div class="text-[9px] text-slate-500">${u.email}</div>${scopeText}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded text-[9px] font-black uppercase ${rc}">${rl}</span></td><td class="p-4 text-center">` +
        actionBtn +
        `</td></tr>`
      );
    })
    .join("");
};

window.getProfileCompleteness = (a) => {
  if (!a) return 0;
  let score = 0;
  if (a.nowa && a.nowa.trim()) score += 25;
  if (a.provinsi && a.provinsi.trim()) score += 10;
  if (a.kabupaten && a.kabupaten.trim()) score += 15;
  if (a.kecamatan && a.kecamatan.trim()) score += 15;
  if (a.desa && a.desa.trim()) score += 15;
  if (a.alamat && a.alamat.trim()) score += 10;
  if (a.lembaga && a.lembaga.trim()) score += 10;
  return score;
};

window.renderAlumniTable = () => {
  const tbody = document.getElementById("alumni-list");
  const role = window.STATE.user ? window.STATE.user.role : "user";
  const canManageAny = ["admin_utama", "creator", "sekretaris", "koordinator_wilayah", "korwil_kabupaten", "korwil_kecamatan", "korwil_desa"].includes(role);
  if (document.getElementById("th-checkbox-alumni"))
    document.getElementById("th-checkbox-alumni").style.display = canManageAny
      ? ""
      : "none";
  const start = (window.currentAlumniPage - 1) * window.ALUMNI_PER_PAGE;
  const pagedData = window.filteredAlumniData.slice(
    start,
    start + window.ALUMNI_PER_PAGE,
  );
  const maxPage = Math.max(
    1,
    Math.ceil(window.filteredAlumniData.length / window.ALUMNI_PER_PAGE),
  );
  if (document.getElementById("page-info"))
    document.getElementById("page-info").innerText =
      `Halaman ${window.currentAlumniPage} dari ${maxPage}`;

  const selectAllCb = document.getElementById("select-all-alumni");
  if (selectAllCb) selectAllCb.checked = false;
  if (!window.selectedAlumni) window.selectedAlumni = new Set();

  if (pagedData.length === 0) {
    return (tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-12 text-center text-slate-500">
          <div class="flex flex-col items-center justify-center py-8">
            <div class="w-14 h-14 bg-slate-500/5 rounded-full flex items-center justify-center mb-4 border border-white/5 shadow-inner">
              <i class="fas fa-search-minus text-2xl text-slate-600 animate-bounce"></i>
            </div>
            <p class="text-xs font-black uppercase tracking-widest text-slate-400">Data tidak ditemukan</p>
            <p class="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">Tidak ada alumni yang cocok dengan kata kunci atau filter yang Anda terapkan.</p>
          </div>
        </td>
      </tr>
    `);
  }

  tbody.innerHTML = pagedData
    .map((a) => {
      const hist = window.STATE.finance.filter(
        (f) => f.ref_alumni_id === a.id && f.status === "pemasukan",
      );
      const safeStr = encodeURIComponent(JSON.stringify(a)).replace(/'/g, "%27");
      let btns = `<button onclick="window.openInviteLinkModal('${a.id}')" class="w-7 h-7 text-teal-400 bg-teal-500/10 hover:bg-teal-500 hover:text-white rounded-lg tooltip-custom" data-tooltip="Undangan Digital"><i class="fas fa-envelope-open-text text-[10px]"></i></button><button onclick="window.openAlumniChangeHistory('${a.id}')" class="w-7 h-7 text-amber-500 bg-amber-500/10 hover:bg-amber-500 hover:text-white rounded-lg tooltip-custom" data-tooltip="Riwayat Perubahan"><i class="fas fa-history text-[10px]"></i></button><button onclick="window.sendInviteLink('${a.id}')" class="w-7 h-7 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white rounded-lg tooltip-custom" data-tooltip="Kirim Link WA"><i class="fas fa-link text-[10px]"></i></button>`;
      
      const rowCanManage = window.canUserManageAlumnus(window.STATE.user, a);
      const rowCanFin = window.canUserFinAlumnus(window.STATE.user, a);

      if (rowCanFin)
        btns += `<button onclick="openModalFinance('${safeStr}')" class="w-7 h-7 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white rounded-lg tooltip-custom" data-tooltip="Tambah Donasi"><i class="fas fa-coins text-[10px]"></i></button>`;
      if (rowCanManage)
        btns += `<button onclick="openModalAlumni('${safeStr}')" class="w-7 h-7 text-slate-500 bg-slate-500/10 hover:bg-slate-500 hover:text-white rounded-lg tooltip-custom" data-tooltip="Edit"><i class="fas fa-pen text-[10px]"></i></button><button onclick="handleDelete('alumni', '${a.id}')" class="w-7 h-7 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg tooltip-custom" data-tooltip="Hapus"><i class="fas fa-trash-alt text-[10px]"></i></button>`;
      const isChecked = window.selectedAlumni.has(a.id) ? "checked" : "";
      const cbHtml = rowCanManage
        ? `<td class="p-5 text-center"><input type="checkbox" value="${a.id}" onchange="toggleSelectAlumni('${a.id}', this.checked)" class="alumni-checkbox w-4 h-4 rounded border-white/10 bg-black/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer" ${isChecked}></td>`
        : "";
      const lembagaBadge = a.lembaga ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${a.lembaga === 'MA' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'}">${a.lembaga}</span>` : '';
      const comp = window.getProfileCompleteness(a);
      let badgeColor = "bg-red-500/20 text-red-400 border border-red-500/30";
      if (comp === 100) badgeColor = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.25)] animate-pulse font-black";
      else if (comp >= 80) badgeColor = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      else if (comp >= 50) badgeColor = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
      const completenessBadge = `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeColor}">Lengkap ${comp}%</span>`;
      return `<tr class="border-b border-white/5 hover:bg-black/5">${cbHtml}<td class="p-5 font-bold">${a.nama}${lembagaBadge}${completenessBadge}<br><div class="text-[10px] mt-1">${window.getWALink(a.nowa, a.nama)}</div></td><td class="p-5 text-center font-black text-indigo-500">${a.angkatan}</td><td class="p-5 text-xs text-slate-400">${a.desa || "-"}, ${a.kabupaten || "-"}</td><td class="p-5 text-center cursor-pointer hover:bg-emerald-500/5 group" onclick="window.openModalHistory('${a.id}')" title="Lihat Riwayat Donasi"><div class="font-black text-emerald-400 group-hover:underline">${window.formatRupiah(a.totalDonasi)}</div><div class="text-[9px] text-slate-500 group-hover:text-emerald-300 transition-colors">${hist.length}x Partisipasi</div></td><td class="p-5 text-center"><div class="flex justify-center gap-1">${btns}</div></td></tr>`;
    })
    .join("");
};

window.toggleSelectAlumni = (id, checked) => {
  if (checked) window.selectedAlumni.add(id);
  else window.selectedAlumni.delete(id);
  window.updateBulkDeleteUI();
};
window.toggleSelectAllAlumni = (checkbox) => {
  const checkboxes = document.querySelectorAll(".alumni-checkbox");
  checkboxes.forEach((cb) => (cb.checked = checkbox.checked));
  if (checkbox.checked) {
    window.filteredAlumniData.forEach((a) => window.selectedAlumni.add(a.id));
  } else {
    window.filteredAlumniData.forEach((a) =>
      window.selectedAlumni.delete(a.id),
    );
  }
  window.updateBulkDeleteUI();
};

window.updateBulkDeleteUI = () => {
  const btnDel = document.getElementById("btn-bulk-delete");
  const countDel = document.getElementById("bulk-delete-count");
  const btnWa = document.getElementById("btn-broadcast-wa");
  const countWa = document.getElementById("bulk-wa-count");
  const btnEdit = document.getElementById("btn-bulk-edit");
  const countEdit = document.getElementById("bulk-edit-count");

  if (window.selectedAlumni.size > 0) {
    if (countDel) countDel.innerText = window.selectedAlumni.size;
    if (countWa) countWa.innerText = window.selectedAlumni.size;
    if (countEdit) countEdit.innerText = window.selectedAlumni.size;
    if (btnDel) btnDel.classList.remove("hidden");
    if (btnWa) btnWa.classList.remove("hidden");
    if (btnEdit) btnEdit.classList.remove("hidden");
  } else {
    if (btnDel) btnDel.classList.add("hidden");
    if (btnWa) btnWa.classList.add("hidden");
    if (btnEdit) btnEdit.classList.add("hidden");
  }
};

window.changePage = (dir) => {
  const max = Math.max(
    1,
    Math.ceil(window.filteredAlumniData.length / window.ALUMNI_PER_PAGE),
  );
  window.currentAlumniPage += dir;
  if (window.currentAlumniPage < 1) window.currentAlumniPage = 1;
  if (window.currentAlumniPage > max) window.currentAlumniPage = max;
  window.renderAlumniTable();
};

window.handleBulkDelete = () => {
  if (window.selectedAlumni.size === 0) return;
  window.openModal("modal-delete");
  document.querySelector("#modal-delete h3").innerText =
    `Hapus ${window.selectedAlumni.size} Data?`;
  const pinInput = document.getElementById("delete-pin-input");
  const pinHelp = document.getElementById("delete-pin-help");
  pinInput.value = "";
  pinInput.classList.remove("hidden");
  pinHelp.classList.remove("hidden");
  const btn = document.getElementById("confirm-delete-btn");
  const nBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(nBtn, btn);
  nBtn.onclick = async () => {
    const pin = pinInput.value;
    if (!pin)
      return window.notify("Anda wajib memasukkan password akun!", "error");
    window.toggleLoading(true, "Memverifikasi Akses Keamanan...");
    try {
      await auth.signInWithEmailAndPassword(window.STATE.user.email, pin);
    } catch (err) {
      window.toggleLoading(false);
      return window.notify("Gagal: Password akun Anda salah!", "error");
    }
    window.closeModal("modal-delete");
    window.toggleLoading(
      true,
      `Akses Diterima! Menghapus ${window.selectedAlumni.size} data...`,
    );
    try {
      const ids = Array.from(window.selectedAlumni);
      const chunkSize = 400;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = db.batch();
        chunk.forEach((id) => batch.delete(db.collection("alumni").doc(id)));
        await batch.commit();
      }
      // Update local state instantly
      if (Array.isArray(window.STATE.rawAlumni)) {
        const idsSet = new Set(ids);
        window.STATE.rawAlumni = window.STATE.rawAlumni.filter(a => !idsSet.has(a.id));
        localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
        window.processCombinedData();
      }

      window.notify(
        `${window.selectedAlumni.size} data berhasil dihapus masal!`,
        "success",
      );
      window.selectedAlumni.clear();
      window.updateBulkDeleteUI();
      if (document.getElementById("select-all-alumni"))
        document.getElementById("select-all-alumni").checked = false;
      if (typeof window.applyAlumniFilters === "function") {
        window.applyAlumniFilters(true);
      }
    } catch (e) {
      window.notify("Gagal dihapus karena gangguan", "error");
    } finally {
      pinInput.classList.add("hidden");
      pinHelp.classList.add("hidden");
      document.querySelector("#modal-delete h3").innerText = "Konfirmasi Hapus";
      window.toggleLoading(false);
    }
  };
};
window.normalizeAngkatanYear = (angkatanVal, lembagaVal) => {
  const num = Number(angkatanVal);
  if (isNaN(num) || num <= 0) return angkatanVal;
  
  if (num < 100) {
    const lb = String(lembagaVal || "").toUpperCase().trim();
    if (lb === "MTS") {
      return num + 2006;
    } else if (lb === "MA") {
      return num + 2011;
    }
  }
  return num;
};

window.parseAddressText = (addressStr) => {
  if (!addressStr) return { desa: "", kecamatan: "", kabupaten: "" };
  
  // Pra-pemrosesan kata kunci agar terpisah dengan spasi dan tanda baca dibersihkan (misal "kec," -> "kec.")
  let processed = addressStr
    .replace(/(kecamatan|kec\b[.,\s]*)/gi, " kec. ")
    .replace(/(kabupaten|kab\b[.,\s]*)/gi, " kab. ")
    .replace(/(kelurahan|kel\b[.,\s]*)/gi, " kel. ")
    .replace(/(desa\b|des\b|ds\b)[.,\s]*/gi, " desa. ")
    .replace(/(provinsi|prov\b)[.,\s]*/gi, " prov. ")
    .replace(/(rt\b|rw\b)[.,\s]*/gi, " $1. ");

  // Rapikan spasi ganda
  processed = processed.replace(/\s+/g, " ").trim();

  let desa = "";
  let kecamatan = "";
  let kabupaten = "";

  // Regex pencocokan kata setelah kata kunci desa/kel, kec, kab (mengizinkan tanda baca opsional sebelum kata kunci/batas berikutnya)
  const desaMatch = processed.match(/(?:desa\.|kel\.)\s*([^,.\n]+?)(?=\s*[,.\-\s]*(?:kec\.|kab\.|prov\.|rt\.|rw\.)|$)/i);
  const kecMatch = processed.match(/kec\.\s*([^,.\n]+?)(?=\s*[,.\-\s]*(?:desa\.|kel\.|kab\.|prov\.|rt\.|rw\.)|$)/i);
  const kabMatch = processed.match(/kab\.\s*([^,.\n]+?)(?=\s*[,.\-\s]*(?:desa\.|kel\.|kec\.|prov\.|rt\.|rw\.)|$)/i);

  const cleanVal = (val) => {
    if (!val) return "";
    return val
      .replace(/^[:\-\s]+/, "") // bersihkan tanda hubung/titik dua di depan
      .replace(/[:\-\s]+$/, "") // bersihkan di belakang
      .trim();
  };

  if (desaMatch) desa = cleanVal(desaMatch[1]);
  if (kecMatch) kecamatan = cleanVal(kecMatch[1]);
  if (kabMatch) kabupaten = cleanVal(kabMatch[1]);

  // Post-processing untuk menangani kata terlewat tanpa kata kunci (keyword-less fallback)
  if (desa) {
    const parts = desa.split(/\s+/).filter(Boolean);
    if (!kecamatan && !kabupaten) {
      if (parts.length >= 3) {
        kabupaten = parts[parts.length - 1];
        kecamatan = parts[parts.length - 2];
        desa = parts.slice(0, parts.length - 2).join(" ");
      } else if (parts.length === 2) {
        kabupaten = parts[1];
        desa = parts[0];
      }
    } else if (!kecamatan && kabupaten) {
      if (parts.length >= 2) {
        kecamatan = parts[parts.length - 1];
        desa = parts.slice(0, parts.length - 1).join(" ");
      }
    }
  }

  if (kecamatan && !kabupaten) {
    const parts = kecamatan.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      kabupaten = parts[parts.length - 1];
      kecamatan = parts.slice(0, parts.length - 1).join(" ");
    }
  }

  return { desa, kecamatan, kabupaten };
};

// ============================================================
// EKSTRAK WILAYAH — berbasis API Wilayah Indonesia (emsifa)
// Strategi 2-fase:
// FASE 1: Coba deteksi Provinsi langsung dari teks (ketat, tanpa false positive arah)
// FASE 2: Jika provinsi tidak yakin, scan semua Kabupaten secara paralel → tentukan Provinsi dari situ
// ============================================================
window.extractAddressOnline = async (addressStr) => {
  if (!addressStr) return { provinsi: "", kabupaten: "", kecamatan: "", desa: "" };

  const API = 'https://www.emsifa.com/api-wilayah-indonesia/api';
  const DIRECTION_WORDS = new Set(['barat', 'timur', 'utara', 'selatan', 'tengah', 'laut', 'daya']);

  const fetchWilayah = async (localPath, remoteUrl) => {
    try {
      const res = await fetch(localPath);
      if (res.ok) return await res.json();
    } catch (e) {}
    try {
      return await fetch(remoteUrl).then(r => r.json());
    } catch (e) {
      console.error(`[Wilayah] Failed to fetch remote: ${remoteUrl}`, e);
      return [];
    }
  };

  if (!window.STATE.wilayahCache) {
    window.STATE.wilayahCache = {
      provinces: null,
      regencies: {},
      districts: {},
      villages: {}
    };
  }
  const cache = window.STATE.wilayahCache;

  const norm = (s) => (s || '').toLowerCase()
    .replace(/\bd\.k\.i\./gi, 'dki')
    .replace(/\bd\.i\./gi, 'di')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bprovinsi\b|\bprov\b/gi, '')
    .replace(/\bkabupaten\b|\bkab\b/gi, '')
    .replace(/\bkota\b/gi, '')
    .replace(/\bkecamatan\b|\bkec\b/gi, '')
    .replace(/\bkelurahan\b|\bkel\b/gi, '')
    .replace(/\bdesa\b|\bdes\b|\bds\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normAddr = (s) => norm(s)
    .replace(/\bperumahan\b/gi, '')
    .replace(/\bblok\b/gi, '')
    .replace(/\bjalan\b|\bjl\b/gi, '')
    .replace(/\bno\b|\bnomor\b/gi, '')
    .replace(/\brt\b|\brw\b/gi, '')
    .replace(/\bkp\b|\bkampung\b/gi, '')
    .replace(/\bgang\b|\bgg\b/gi, '')
    .replace(/\bpermai\b|\bindah\b|\bsejahtera\b/gi, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const addrClean = normAddr(addressStr);

  const scoreMatch = (candidateName, addr, isProvince = false, level = '', isPrioritized = false) => {
    const c = norm(candidateName);
    if (!c) return 0;

    // For non-prioritized counties matched broad-scale (without locked province), require explicit county prefix
    if (level === 'regency' && !isPrioritized) {
      const parts = c.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      const namePattern = parts.join('[\\s-]*');
      const prefixPattern = '\\b(kabupaten|kab|kota)\\b[\\s.]*' + namePattern + '\\b';
      const prefixRegex = new RegExp(prefixPattern, 'i');
      if (!prefixRegex.test(addressStr)) {
        return 0; // Reject!
      }
    }

    // REJECT match if name is preceded by wrong level prefix in original addressStr
    if (level && addressStr) {
      let correctPrefixes = [];
      if (level === 'province') correctPrefixes = ['provinsi', 'prov'];
      else if (level === 'regency') correctPrefixes = ['kabupaten', 'kab', 'kota'];
      else if (level === 'district') correctPrefixes = ['kecamatan', 'kec', 'kes', 'keca', 'kc'];
      else if (level === 'village') correctPrefixes = ['desa', 'des', 'ds', 'kelurahan', 'kel', 'kampung', 'kp', 'dusun', 'dsn', 'blok', 'dukuh', 'dkh'];

      let hasCorrectPrefix = false;
      if (correctPrefixes.length > 0) {
        const parts = c.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const namePattern = parts.join('[\\s-]*');
        const correctPattern = '\\b(' + correctPrefixes.join('|') + ')\\b[\\s.]*' + namePattern + '\\b';
        const correctRegex = new RegExp(correctPattern, 'i');
        if (correctRegex.test(addressStr)) {
          hasCorrectPrefix = true;
        }
      }

      let wrongPrefixes = [];
      if (level === 'province') {
        wrongPrefixes = ['kabupaten', 'kab', 'kota', 'kecamatan', 'kec', 'kes', 'keca', 'kc', 'desa', 'des', 'ds', 'kelurahan', 'kel', 'jalan', 'jl'];
      } else if (level === 'regency') {
        wrongPrefixes = ['kecamatan', 'kec', 'kes', 'keca', 'kc', 'desa', 'des', 'ds', 'kelurahan', 'kel', 'jalan', 'jl', 'kp', 'kampung'];
      } else if (level === 'district') {
        wrongPrefixes = ['desa', 'des', 'ds', 'kelurahan', 'kel', 'kabupaten', 'kab', 'kota', 'provinsi', 'prov', 'jalan', 'jl'];
      } else if (level === 'village') {
        wrongPrefixes = ['kecamatan', 'kec', 'kes', 'keca', 'kc', 'kabupaten', 'kab', 'kota', 'provinsi', 'prov'];
      }
      
      if (wrongPrefixes.length > 0 && !hasCorrectPrefix) {
        const parts = c.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const namePattern = parts.join('[\\s-]*');
        const wrongPattern = '\\b(' + wrongPrefixes.join('|') + ')\\b[\\s.]*' + namePattern + '\\b';
        const wrongRegex = new RegExp(wrongPattern, 'i');
        if (wrongRegex.test(addressStr)) {
          return 0; // Reject!
        }
      }
    }

    let score = 0;
    
    const cClean = c.replace(/\s+/g, '');
    const addrCleanedSpaces = addr.replace(/\s+/g, '');

    const exactRegex = new RegExp('\\b' + c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
    if (exactRegex.test(addr)) {
      score = 100 + c.length;
    } else if (addrCleanedSpaces.includes(cClean)) {
      score = 95 + cClean.length;
    } else {
      const words = c.split(' ').filter(w => w.length > 2);
      const significantWords = words.filter(w => !DIRECTION_WORDS.has(w));
      const directionWords = words.filter(w => DIRECTION_WORDS.has(w));
      const addrWords = new Set(addr.split(' '));

      if (isProvince) {
        const sigHits = significantWords.filter(w => addrWords.has(w)).length;
        if (sigHits > 0) {
          const dirHits = directionWords.filter(w => addrWords.has(w)).length;
          const ratio = sigHits / Math.max(significantWords.length, 1);
          score = Math.round(ratio * 80) + (dirHits > 0 ? 10 : 0);
        }
      } else {
        const sigHits = significantWords.filter(w => addrWords.has(w)).length;
        if (significantWords.length === 0 || sigHits > 0) {
          const allHits = words.filter(w => addrWords.has(w)).length;
          if (allHits > 0) {
            score = Math.round((allHits / words.length) * 70);
          }
        }
      }

      if (score === 0 && words.length > 0) {
        const addrWordsList = addr.split(' ');
        let fuzzyHits = 0;
        let totalFuzzyScore = 0;

        for (const cw of words) {
          if (cw.length < 5 || DIRECTION_WORDS.has(cw)) continue;
          
          let bestLev = Infinity;
          for (const aw of addrWordsList) {
            if (aw.length < 5 || DIRECTION_WORDS.has(aw)) continue;
            const d = window.levenshtein ? window.levenshtein(aw, cw) : 99;
            if (d < bestLev) bestLev = d;
          }

          if (bestLev <= 1) {
            fuzzyHits++;
            totalFuzzyScore += 50;
          } else if (bestLev === 2 && cw.length >= 8) {
            fuzzyHits++;
            totalFuzzyScore += 30;
          }
        }

        if (fuzzyHits > 0) {
          // Rata-ratakan skor berdasarkan rasio kata yang cocok
          score = Math.round((fuzzyHits / words.length) * (totalFuzzyScore / fuzzyHits));
        }
      }
    }

    if (score === 0) return 0;

    let hasCorrectPrefix = false;
    let correctPrefixes = [];
    if (level === 'province') correctPrefixes = ['provinsi', 'prov'];
    else if (level === 'regency') correctPrefixes = ['kabupaten', 'kab', 'kota'];
    else if (level === 'district') correctPrefixes = ['kecamatan', 'kec', 'kes', 'keca', 'kc'];
    else if (level === 'village') correctPrefixes = ['desa', 'des', 'ds', 'kelurahan', 'kel', 'kampung', 'kp', 'dusun', 'dsn', 'blok', 'dukuh', 'dkh'];

    if (correctPrefixes.length > 0) {
      const parts = c.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      const namePattern = parts.join('[\\s-]*');
      const prefixPattern = '\\b(' + correctPrefixes.join('|') + ')\\b[\\s.]*' + namePattern + '\\b';
      const prefixRegex = new RegExp(prefixPattern, 'i');
      if (prefixRegex.test(addressStr)) {
        hasCorrectPrefix = true;
      }
    }

    if (hasCorrectPrefix) {
      score += 50;
    }

    return score;
  };

  const bestMatch = (list, addr, isProvince = false, level = '', isPrioritized = false) => {
    let best = null, bestScore = 0;
    for (const item of list) {
      const score = scoreMatch(item.name, addr, isProvince, level, isPrioritized);
      if (score > bestScore) { bestScore = score; best = item; }
    }
    const threshold = isProvince ? 40 : 20;
    return bestScore >= threshold ? { item: best, score: bestScore } : null;
  };

  if (!cache.provinces) {
    cache.provinces = await fetchWilayah('./api-wilayah/provinces.json', `${API}/provinces.json`);
  }
  const provinces = cache.provinces;

  const jabarProv = provinces.find(p => p.name.toLowerCase() === 'jawa barat');
  const jabarId = jabarProv ? jabarProv.id : '32';
  const jakartaProv = provinces.find(p => p.name.toLowerCase() === 'dki jakarta');
  const jakartaId = jakartaProv ? jakartaProv.id : '31';
  const sumatraProvIds = ["11", "12", "13", "14", "15", "16", "17", "18", "19", "21"];

  const provResult = bestMatch(provinces, addrClean, true, 'province');
  let finalProv = provResult ? provResult.item : null;
  let finalReg = null;
  let finalDist = null;
  let finalVil = null;

  if (!finalProv || provResult.score < 50) {
    if (!cache.regencies[jabarId]) {
      cache.regencies[jabarId] = await fetchWilayah(`./api-wilayah/regencies/${jabarId}.json`, `${API}/regencies/${jabarId}.json`);
    }
    const jabarRegs = cache.regencies[jabarId];

    if (!cache.regencies[jakartaId]) {
      cache.regencies[jakartaId] = await fetchWilayah(`./api-wilayah/regencies/${jakartaId}.json`, `${API}/regencies/${jakartaId}.json`);
    }
    const jakartaRegs = cache.regencies[jakartaId].map(r => ({ ...r, _provinceId: jakartaId, _provinceName: 'DKI JAKARTA' }));

    const tier1Regs = jabarRegs.filter(r => 
      r.id === '3215' || r.id === '3214' || r.id === '3216' || r.id === '3275' ||
      r.name.toLowerCase().includes('karawang') || 
      r.name.toLowerCase().includes('purwakarta') || 
      r.name.toLowerCase().includes('bekasi')
    ).map(r => ({ ...r, _provinceId: jabarId, _provinceName: 'JAWA BARAT' }));

    const otherJabarRegs = jabarRegs
      .filter(r => !tier1Regs.find(t1 => t1.id === r.id))
      .map(r => ({ ...r, _provinceId: jabarId, _provinceName: 'JAWA BARAT' }));

    const tier2Regs = [...jakartaRegs, ...otherJabarRegs];

    const sumatraProvinces = provinces.filter(p => sumatraProvIds.includes(p.id));
    const sumatraRegencyPromises = sumatraProvinces.map(async (p) => {
      if (!cache.regencies[p.id]) {
        cache.regencies[p.id] = await fetchWilayah(`./api-wilayah/regencies/${p.id}.json`, `${API}/regencies/${p.id}.json`);
      }
      return cache.regencies[p.id].map(reg => ({ ...reg, _provinceId: p.id, _provinceName: p.name }));
    });
    const sumatraRegenciesLists = await Promise.all(sumatraRegencyPromises);
    const sumatraRegencies = sumatraRegenciesLists.flat();

    const otherProvincesPromises = provinces.map(async (p) => {
      if (p.id === jabarId || p.id === jakartaId || sumatraProvIds.includes(p.id)) return [];
      if (!cache.regencies[p.id]) {
        cache.regencies[p.id] = await fetchWilayah(`./api-wilayah/regencies/${p.id}.json`, `${API}/regencies/${p.id}.json`);
      }
      return cache.regencies[p.id].map(reg => ({ ...reg, _provinceId: p.id, _provinceName: p.name }));
    });
    const otherRegenciesLists = await Promise.all(otherProvincesPromises);
    const otherRegencies = otherRegenciesLists.flat();

    // ==========================================
    // LANGKAH A: CARI KABUPATEN/KOTA TERLEBIH DAHULU (across all tiers)
    // ==========================================
    const t1RegMatch = bestMatch(tier1Regs, addrClean, false, 'regency', true);
    if (t1RegMatch && t1RegMatch.score >= 30) {
      finalReg = t1RegMatch.item;
      finalProv = jabarProv || provinces.find(p => p.id === jabarId);
    } else {
      const t2RegMatch = bestMatch(tier2Regs, addrClean, false, 'regency', true);
      if (t2RegMatch && t2RegMatch.score >= 30) {
        finalReg = t2RegMatch.item;
        finalProv = provinces.find(p => p.id === finalReg._provinceId);
      } else {
        const t3RegMatch = bestMatch(sumatraRegencies, addrClean, false, 'regency', false);
        if (t3RegMatch && t3RegMatch.score >= 30) {
          finalReg = t3RegMatch.item;
          finalProv = provinces.find(p => p.id === finalReg._provinceId);
        } else {
          const regResult = bestMatch(otherRegencies, addrClean, false, 'regency', false);
          if (regResult && regResult.score >= 30) {
            finalReg = regResult.item;
            finalProv = provinces.find(p => p.id === finalReg._provinceId);
          }
        }
      }
    }

    // ==========================================
    // LANGKAH B: CARI KECAMATAN JIKA KABUPATEN TIDAK DITEMUKAN SECARA EKSPLISIT
    // ==========================================
    if (!finalReg) {
      const districtPromises = tier1Regs.map(async (reg) => {
        if (!cache.districts[reg.id]) {
          cache.districts[reg.id] = await fetchWilayah(`./api-wilayah/districts/${reg.id}.json`, `${API}/districts/${reg.id}.json`);
        }
        return cache.districts[reg.id].map(dist => ({ 
          ...dist, 
          _regencyId: reg.id, 
          _regencyName: reg.name,
          _provinceId: jabarId,
          _provinceName: 'JAWA BARAT'
        }));
      });
      const t1DistrictsLists = await Promise.all(districtPromises);
      const t1Districts = t1DistrictsLists.flat();

      const t1DistMatch = bestMatch(t1Districts, addrClean, false, 'district');
      if (t1DistMatch && t1DistMatch.score >= 40) {
        finalDist = t1DistMatch.item;
        let targetRegId = finalDist._regencyId;
        let targetRegName = finalDist._regencyName;

        const distNorm = finalDist.name.toLowerCase().replace(/\s+/g, '');
        if (distNorm === 'tegalwaru' && !addrClean.includes('karawang')) {
          targetRegId = '3214';
          targetRegName = 'KABUPATEN PURWAKARTA';
          const purwakartaDistricts = t1Districts.filter(d => d._regencyId === '3214');
          const pDist = purwakartaDistricts.find(d => d.name.toLowerCase().replace(/\s+/g, '') === 'tegalwaru');
          if (pDist) {
            finalDist = pDist;
          }
        }

        finalReg = { id: targetRegId, name: targetRegName };
        finalProv = jabarProv || provinces.find(p => p.id === jabarId);
      } else {
        const districtPromisesT2 = tier2Regs.map(async (reg) => {
          if (!cache.districts[reg.id]) {
            cache.districts[reg.id] = await fetchWilayah(`./api-wilayah/districts/${reg.id}.json`, `${API}/districts/${reg.id}.json`);
          }
          return cache.districts[reg.id].map(dist => ({ 
            ...dist, 
            _regencyId: reg.id, 
            _regencyName: reg.name,
            _provinceId: reg._provinceId,
            _provinceName: reg._provinceName
          }));
        });
        const t2DistrictsLists = await Promise.all(districtPromisesT2);
        const t2Districts = t2DistrictsLists.flat();

        const t2DistMatch = bestMatch(t2Districts, addrClean, false, 'district');
        if (t2DistMatch && t2DistMatch.score >= 40) {
          finalDist = t2DistMatch.item;
          finalReg = { id: finalDist._regencyId, name: finalDist._regencyName };
          finalProv = provinces.find(p => p.id === finalDist._provinceId);
        } else {
          const candidateRegencies = sumatraRegencies.filter(reg => {
            const words = norm(reg.name).split(' ');
            return words.some(w => w.length >= 4 && addrClean.includes(w));
          });

          if (candidateRegencies.length > 0) {
            const districtPromisesT3 = candidateRegencies.map(async (reg) => {
              if (!cache.districts[reg.id]) {
                cache.districts[reg.id] = await fetchWilayah(`./api-wilayah/districts/${reg.id}.json`, `${API}/districts/${reg.id}.json`);
              }
              return cache.districts[reg.id].map(dist => ({ 
                ...dist, 
                _regencyId: reg.id, 
                _regencyName: reg.name,
                _provinceId: reg._provinceId,
                _provinceName: reg._provinceName
              }));
            });
            const t3DistrictsLists = await Promise.all(districtPromisesT3);
            const t3Districts = t3DistrictsLists.flat();

            const t3DistMatch = bestMatch(t3Districts, addrClean, false, 'district');
            if (t3DistMatch && t3DistMatch.score >= 40) {
              finalDist = t3DistMatch.item;
              finalReg = { id: finalDist._regencyId, name: finalDist._regencyName };
              finalProv = provinces.find(p => p.id === finalDist._provinceId);
            }
          }
        }
      }
    }
  }

  if (!finalProv) {
    return { provinsi: "", kabupaten: "", kecamatan: "", desa: "" };
  }

  if (!cache.regencies[finalProv.id]) {
    cache.regencies[finalProv.id] = await fetchWilayah(`./api-wilayah/regencies/${finalProv.id}.json`, `${API}/regencies/${finalProv.id}.json`);
  }
  const regencies = cache.regencies[finalProv.id];

  if (!finalReg) {
    const rr = bestMatch(regencies, addrClean, false, 'regency', true);
    if (rr) finalReg = rr.item;
  }

  if (finalReg) {
    if (!cache.districts[finalReg.id]) {
      cache.districts[finalReg.id] = await fetchWilayah(`./api-wilayah/districts/${finalReg.id}.json`, `${API}/districts/${finalReg.id}.json`);
    }
    const districts = cache.districts[finalReg.id];

    if (!finalDist) {
      const dr = bestMatch(districts, addrClean, false, 'district');
      if (dr) finalDist = dr.item;
    }

    if (finalDist) {
      if (!cache.villages[finalDist.id]) {
        cache.villages[finalDist.id] = await fetchWilayah(`./api-wilayah/villages/${finalDist.id}.json`, `${API}/villages/${finalDist.id}.json`);
      }
      const villages = cache.villages[finalDist.id];

      const vr = bestMatch(villages, addrClean, false, 'village');
      if (vr) {
        finalVil = vr.item;
      }
    }
  }

  return {
    provinsi: finalProv ? finalProv.name : "",
    kabupaten: finalReg ? finalReg.name : "",
    kecamatan: finalDist ? finalDist.name : "",
    desa: finalVil ? finalVil.name : ""
  };
};

window.extractAddressSingle = async () => {
  const addressInput = document.getElementById('alm-alamat');
  const btnEl = document.getElementById('btn-extract-wilayah');
  if (!addressInput) return;

  const addressStr = addressInput.value.trim();
  if (!addressStr) {
    return window.notify('Masukkan alamat lengkap terlebih dahulu!', 'error');
  }

  const setBtn = (loading, text) => {
    if (!btnEl) return;
    btnEl.disabled = loading;
    btnEl.innerHTML = loading
      ? `<i class="fas fa-spinner fa-spin mr-1"></i> ${text}`
      : `<i class="fas fa-map-marker-alt mr-1"></i> Ekstrak Wilayah`;
  };

  const toTitleCase = (s) => (s || '').toLowerCase()
    .replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());

  setBtn(true, 'Memproses wilayah...');

  try {
    const result = await window.extractAddressOnline(addressStr);
    
    if (!result || !result.provinsi) {
      window.notify('Provinsi & Kabupaten tidak terdeteksi dari alamat. Sertakan nama kabupaten/kota di alamat, misalnya: "Kab. Karawang, Jawa Barat"', 'warning');
      return;
    }

    const setField = (fieldId, val) => {
      const inp = document.getElementById(fieldId);
      if (inp) {
        inp.value = toTitleCase(val);
        inp.placeholder = inp.placeholder.replace('Pilih', 'Ketik / Cari');
      }
    };

    setField('alm-provinsi', result.provinsi);
    setField('alm-kabupaten', result.kabupaten);
    setField('alm-kecamatan', result.kecamatan);
    setField('alm-desa', result.desa);

    const cache = window.STATE.wilayahCache || {};
    if (cache.provinces) {
      const listProv = document.getElementById('alm-list-provinsi');
      if (listProv) listProv.innerHTML = cache.provinces.map(p =>
        `<option value="${toTitleCase(p.name)}" data-id="${p.id}"></option>`).join('');
    }

    const finalProv = cache.provinces ? cache.provinces.find(p => p.name.toLowerCase() === result.provinsi.toLowerCase()) : null;
    if (finalProv && cache.regencies[finalProv.id]) {
      const listKab = document.getElementById('alm-list-kabupaten');
      if (listKab) listKab.innerHTML = cache.regencies[finalProv.id].map(r =>
        `<option value="${toTitleCase(r.name)}" data-id="${r.id}"></option>`).join('');

      const finalReg = cache.regencies[finalProv.id].find(r => r.name.toLowerCase() === result.kabupaten?.toLowerCase());
      if (finalReg && cache.districts[finalReg.id]) {
        const listKec = document.getElementById('alm-list-kecamatan');
        if (listKec) listKec.innerHTML = cache.districts[finalReg.id].map(d =>
          `<option value="${toTitleCase(d.name)}" data-id="${d.id}"></option>`).join('');

        const finalDist = cache.districts[finalReg.id].find(d => d.name.toLowerCase() === result.kecamatan?.toLowerCase());
        if (finalDist && cache.villages[finalDist.id]) {
          const listDesa = document.getElementById('alm-list-desa');
          if (listDesa) listDesa.innerHTML = cache.villages[finalDist.id].map(v =>
            `<option value="${toTitleCase(v.name)}" data-id="${v.id}"></option>`).join('');
        }
      }
    }

    const pn = toTitleCase(result.provinsi);
    const rn = result.kabupaten ? toTitleCase(result.kabupaten) : null;
    const dn = result.kecamatan ? toTitleCase(result.kecamatan) : null;
    const vn = result.desa ? toTitleCase(result.desa) : null;
    const chain = [pn, rn, dn, vn].filter(Boolean).join(' › ');
    const filled = [pn, rn, dn, vn].filter(Boolean).length;

    if (filled === 4) {
      window.notify(`✅ Semua wilayah ditemukan!\n${chain}`, 'success');
    } else if (filled >= 2) {
      window.notify(`Ditemukan ${filled} dari 4 level wilayah:\n${chain}\nSisanya lengkapi manual.`, 'success');
    } else {
      window.notify(`Hanya provinsi terdeteksi (${pn}). Pastikan nama kabupaten/kecamatan ditulis jelas di alamat.`, 'warning');
    }

  } catch (err) {
    console.error('[extractAddressSingle] Error:', err);
    window.notify('Gagal mengekstrak wilayah. Periksa koneksi internet Anda.', 'error');
  } finally {
    setBtn(false);
  }
};





window.openBulkEditModal = () => {
  const fields = ['angkatan', 'lembaga', 'kabupaten', 'kecamatan', 'desa', 'alamat'];
  fields.forEach((f) => {
    const chk = document.getElementById(`bulk-edit-chk-${f}`);
    const inp = document.getElementById(`bulk-edit-${f}`);
    if (chk) chk.checked = false;
    if (inp) {
      inp.disabled = true;
      inp.value = "";
    }
  });

  const autoChk = document.getElementById("bulk-edit-chk-autoextract");
  if (autoChk) autoChk.checked = false;

  const countSpan = document.getElementById("bulk-edit-selected-count");
  if (countSpan) countSpan.innerText = window.selectedAlumni.size;
  window.openModal("modal-bulk-edit");
};

window.toggleBulkField = (field, checked) => {
  const el = document.getElementById(`bulk-edit-${field}`);
  if (el) {
    el.disabled = !checked;
    if (!checked) {
      el.value = "";
    } else {
      el.focus();
    }
  }
};

window.showBulkEditPreview = async (e) => {
  e.preventDefault();
  if (window.selectedAlumni.size === 0) {
    return window.notify("Pilih minimal satu alumni!", "error");
  }

  const updates = {};
  const fields = ['angkatan', 'lembaga', 'kabupaten', 'kecamatan', 'desa', 'alamat'];
  let checkedAny = false;

  for (const f of fields) {
    const chk = document.getElementById(`bulk-edit-chk-${f}`);
    if (chk && chk.checked) {
      checkedAny = true;
      const inp = document.getElementById(`bulk-edit-${f}`);
      if (!inp) continue;
      
      let val = inp.value;
      if (f === 'angkatan') {
        const num = Number(val);
        if (!val || isNaN(num) || num <= 0 || (num >= 100 && num < 1900) || num > 2100) {
          return window.notify("Angkatan harus berupa tahun valid (1900–2100) atau nomor kelas angkatan (1-99)!", "error");
        }
        updates.angkatan = num;
      } else if (f === 'lembaga') {
        if (!val) {
          return window.notify("Lembaga harus dipilih!", "error");
        }
        updates.lembaga = val;
      } else {
        val = (val || "").trim();
        updates[f] = val;
      }
    }
  }

  const autoExtractChk = document.getElementById("bulk-edit-chk-autoextract");
  const autoExtractChecked = autoExtractChk && autoExtractChk.checked;

  if (!checkedAny && !autoExtractChecked) {
    return window.notify("Centang minimal satu bidang atau opsi untuk diubah!", "error");
  }

  // Siapkan map perubahan
  const ids = Array.from(window.selectedAlumni);
  const finalUpdatesMap = {};
  let totalChanges = 0;

  const fieldLabels = {
    angkatan: 'Angkatan', lembaga: 'Lembaga',
    provinsi: 'Provinsi', kabupaten: 'Kabupaten',
    kecamatan: 'Kecamatan', desa: 'Desa', alamat: 'Alamat'
  };

  const previewListEl = document.getElementById("bulk-edit-preview-list");
  if (!previewListEl) return;
  previewListEl.innerHTML = "";

  let listHtml = "";

  window.toggleLoading(true, `Mengekstrak dan memproses wilayah massal untuk ${ids.length} alumni...`);

  try {
    for (const id of ids) {
      const alm = window.STATE.rawAlumni.find(a => a.id === id);
      if (!alm) continue;

      const docUpdates = { ...updates };

      if (autoExtractChecked) {
        if (alm.alamat) {
          const parsed = await window.extractAddressOnline(alm.alamat);
          if (parsed.provinsi && !updates.hasOwnProperty('provinsi')) {
            docUpdates.provinsi = window.normalizeWilayahName(parsed.provinsi);
          }
          if (parsed.kabupaten && !updates.hasOwnProperty('kabupaten')) {
            docUpdates.kabupaten = window.normalizeWilayahName(parsed.kabupaten);
          }
          if (parsed.kecamatan && !updates.hasOwnProperty('kecamatan')) {
            docUpdates.kecamatan = window.normalizeWilayahName(parsed.kecamatan);
          }
          if (parsed.desa && !updates.hasOwnProperty('desa')) {
            docUpdates.desa = window.normalizeWilayahName(parsed.desa);
          }
        }
      }

      if (updates.hasOwnProperty('angkatan')) {
        const finalLembaga = docUpdates.lembaga || alm.lembaga || "MA";
        docUpdates.angkatan = Number(window.normalizeAngkatanYear(updates.angkatan, finalLembaga));
      }

      // Filter updates yang nilainya memang berbeda dari yang lama
      const actualUpdates = {};
      Object.entries(docUpdates).forEach(([field, val]) => {
        const oldVal = alm[field];
        if (String(val || "").trim() !== String(oldVal || "").trim()) {
          actualUpdates[field] = val;
        }
      });

      if (Object.keys(actualUpdates).length > 0) {
        finalUpdatesMap[id] = actualUpdates;
        totalChanges++;

        // Render baris pratinjau untuk alumni ini
        const changesListHtml = Object.entries(actualUpdates).map(([field, val]) => {
          const label = fieldLabels[field] || field;
          const oldVal = alm[field] || "(kosong)";
          const newVal = val || "(kosong)";
          return `<div class="mb-1"><span class="text-slate-400 font-bold">${label}:</span> <span class="line-through text-red-400/80">${oldVal}</span> <i class="fas fa-arrow-right text-slate-500 mx-1"></i> <span class="text-emerald-400 font-bold">${newVal}</span></div>`;
        }).join("");

        listHtml += `
          <tr class="border-b border-white/5 hover:bg-white/2 text-[10px]">
            <td class="p-3 font-bold text-white whitespace-nowrap">${alm.nama}<br><span class="text-[8px] text-indigo-400 font-bold uppercase">${alm.lembaga || '-'} &bull; Angkatan ${alm.angkatan || '-'}</span></td>
            <td class="p-3">${changesListHtml}</td>
          </tr>
        `;
      }
    }
  } catch (err) {
    console.error("[showBulkEditPreview] Error:", err);
    window.notify("Gagal memproses data wilayah secara online.", "error");
    return;
  } finally {
    window.toggleLoading(false);
  }

  if (totalChanges === 0) {
    return window.notify("Tidak ada perubahan terdeteksi pada data alumni terpilih (data sudah sesuai)!", "warning");
  }

  previewListEl.innerHTML = listHtml;

  // Simpan data perubahan sementara
  window.STATE.tempBulkUpdates = { updates, finalUpdatesMap, ids, checkedAny, autoExtractChecked };

  // Sembunyikan form dan tunjukkan preview
  document.getElementById("form-bulk-edit").classList.add("hidden");
  document.getElementById("bulk-edit-info-header").classList.add("hidden");
  document.getElementById("bulk-edit-preview-panel").classList.remove("hidden");
  document.getElementById("bulk-edit-modal-title").innerHTML = `<i class="fas fa-eye text-indigo-400 mr-2"></i> Konfirmasi Perubahan Massal`;
};

window.hideBulkEditPreview = () => {
  document.getElementById("bulk-edit-preview-panel").classList.add("hidden");
  document.getElementById("form-bulk-edit").classList.remove("hidden");
  document.getElementById("bulk-edit-info-header").classList.remove("hidden");
  document.getElementById("bulk-edit-modal-title").innerText = "Edit Massal Alumni";
  window.STATE.tempBulkUpdates = null;
};

window.executeBulkEditConfirmed = async () => {
  if (!window.STATE.tempBulkUpdates) return;
  const { updates, finalUpdatesMap, ids, checkedAny, autoExtractChecked } = window.STATE.tempBulkUpdates;

  window.toggleLoading(true, `Menyimpan perubahan massal untuk ${Object.keys(finalUpdatesMap).length} alumni...`);

  try {
    const idsToUpdate = Object.keys(finalUpdatesMap);
    const chunkSize = 400;

    for (let i = 0; i < idsToUpdate.length; i += chunkSize) {
      const chunk = idsToUpdate.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach((id) => {
        const docUpdates = finalUpdatesMap[id];
        batch.update(db.collection("alumni").doc(id), docUpdates);
      });
      await batch.commit();
    }

    // Update local state instantly
    if (Array.isArray(window.STATE.rawAlumni)) {
      window.STATE.rawAlumni = window.STATE.rawAlumni.map((a) => {
        if (finalUpdatesMap[a.id]) {
          return { ...a, ...finalUpdatesMap[a.id] };
        }
        return a;
      });
      localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
      window.processCombinedData();
    }

    await window.incrementSyncVersion('alumni');
    
    let activityDetails = `Mengubah massal ${idsToUpdate.length} data alumni.`;
    if (checkedAny) activityDetails += ` Bidang diubah: ${Object.keys(updates).join(", ")}.`;
    if (autoExtractChecked) activityDetails += ` Opsi ekstrak wilayah dari alamat aktif.`;
    
    await window.logActivity("alumni_bulk_edit", activityDetails);

    window.selectedAlumni.clear();
    window.updateBulkDeleteUI();
    
    if (document.getElementById("select-all-alumni")) {
      document.getElementById("select-all-alumni").checked = false;
    }

    window.closeModal("modal-bulk-edit");
    window.hideBulkEditPreview(); // Reset status modal
    window.notify("Perubahan massal berhasil disimpan!", "success");
    if (typeof window.applyAlumniFilters === "function") {
      window.applyAlumniFilters(true);
    }
  } catch (err) {
    console.error("Gagal simpan edit massal:", err);
    window.notify("Gagal memperbarui data: " + (err.message || "kesalahan tidak diketahui"), "error");
  } finally {
    window.toggleLoading(false);
  }
};

// UPDATE: RENDER TABEL PANITIA DENGAN FOTO PROFIL
// ==========================================
window.renderPanitiaTable = () => {
  const tbody = document.getElementById("panitia-list");
  const role = window.STATE.user ? window.STATE.user.role : "user";
  const canManage = role === "admin_utama" || role === "creator" || role === "sekretaris";

  if (window.STATE.panitia.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-500 text-xs italic">Belum ada data kepanitiaan.</td></tr>`;
    return;
  }

  tbody.innerHTML = window.STATE.panitia
    .map((p) => {
      // LAKUKAN PENCOCOKAN OTOMATIS BERDASARKAN NAMA KE KOLEKSI USERS ACC
      const matchedUser = window.STATE.users.find(
        (u) =>
          String(u.nama || "")
            .toLowerCase()
            .trim() ===
          String(p.nama || "")
            .toLowerCase()
            .trim(),
      );

      // JIKA AKUN SUDAH UPLOAD FOTO GUNAKAN CLOUDINARY-NYA, JIKA BELUM GUNAKAN INISIAL HURUF
      const avatarUrl =
        matchedUser && matchedUser.photoURL
          ? matchedUser.photoURL
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nama)}&background=6366f1&color=fff`;

      const safeStr = encodeURIComponent(JSON.stringify(p)).replace(/'/g, "%27");
      let act = `<button onclick="printIDCard('${safeStr}')" class="w-7 h-7 bg-indigo-500/10 text-indigo-500 rounded hover:bg-indigo-500 hover:text-white mr-1" title="Cetak ID Card"><i class="fas fa-id-badge text-[10px]"></i></button>`;

      if (canManage) {
        act += `<button onclick="openModalEditPanitia('${safeStr}')" class="w-7 h-7 bg-amber-500/10 text-amber-500 rounded hover:bg-amber-500 hover:text-white mr-1" title="Edit"><i class="fas fa-edit text-[10px]"></i></button><button onclick="handleDelete('panitia', '${p.id}')" class="w-7 h-7 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white" title="Hapus"><i class="fas fa-trash-alt text-[10px]"></i></button>`;
      }

      const ttdHtml = p.tanda_tangan 
        ? `<div class="bg-white/80 p-1.5 rounded-lg inline-block shadow-sm hover:scale-105 transition-transform"><img src="${p.tanda_tangan}" class="h-6 max-w-[65px] object-contain" alt="Ttd"></div>` 
        : `<span class="px-2 py-1 rounded bg-slate-800 text-[8px] font-black uppercase text-slate-500 tracking-wider">Belum Ada</span>`;

      return `
                <tr class="border-b border-white/5 hover:bg-black/5 transition-colors">
                    <td class="p-5">
                        <div class="flex items-center gap-3">
                            <img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover border border-white/10 shadow-sm" alt="Foto Profil">
                            <span class="font-bold text-white">${p.nama}</span>
                        </div>
                    </td>
                    <td class="p-5 text-[10px] uppercase tracking-wider">
                        <span class="font-black text-amber-500">${p.jabatan}</span>
                        ${p.divisi ? ` <span class="text-slate-400 font-bold ml-1">(${p.divisi})</span>` : ''}
                    </td>
                    <td class="p-5 text-center">${ttdHtml}</td>
                    <td class="p-5 text-center whitespace-nowrap">${act}</td>
                </tr>`;
    })
    .join("");
};

window.renderRundownTable = () => {
  const tbody = document.getElementById("rundown-list");
  const role = window.STATE.user ? window.STATE.user.role : "user";
  const canManage = role === "admin_utama" || role === "creator" || role === "sekretaris";
  if (window.STATE.rundown.length === 0)
    return (tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-500 text-xs italic">Belum ada jadwal rundown.</td></tr>`);
  let sortedData = [...window.STATE.rundown].sort((a, b) =>
    String(a.waktu).localeCompare(String(b.waktu)),
  );
  tbody.innerHTML = sortedData
    .map((r) => {
      const safeStr = encodeURIComponent(JSON.stringify(r)).replace(/'/g, "%27");
      let act = "-";
      if (canManage)
        act = `<button onclick="openModalRundown('${safeStr}')" class="w-7 h-7 bg-amber-500/10 text-amber-500 rounded hover:bg-amber-500 hover:text-white mr-1" title="Edit"><i class="fas fa-edit text-[10px]"></i></button><button onclick="handleDelete('rundown', '${r.id}')" class="w-7 h-7 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white" title="Hapus"><i class="fas fa-trash-alt text-[10px]"></i></button>`;
      return `<tr class="border-b border-white/5 hover:bg-black/5"><td class="p-5 font-black text-indigo-400 whitespace-nowrap">${r.waktu}</td><td class="p-5 font-bold">${r.kegiatan}</td><td class="p-5 text-xs text-slate-400 max-w-xs">${r.keterangan || "-"}</td><td class="p-5 text-center">${act}</td></tr>`;
    })
    .join("");
  
  try {
      if (typeof window.updateLiveRundownTracker === "function") {
          window.updateLiveRundownTracker();
      }
  } catch(err) {
      console.error("Gagal memperbarui tracker rundown live", err);
  }
};

window.changeRABPage = (dir) => {
  const max = Math.max(
    1,
    Math.ceil(window.STATE.rab.length / window.ALUMNI_PER_PAGE),
  );
  window.currentRABPage += dir;
  if (window.currentRABPage < 1) window.currentRABPage = 1;
  if (window.currentRABPage > max) window.currentRABPage = max;
  window.renderRABTable();
};

window.renderRABTable = () => {
  const tbody = document.getElementById("rab-list");
  const role = window.STATE.user ? window.STATE.user.role : "user";
  const canFin = role === "admin_utama" || role === "creator" || role === "bendahara";
  let total = 0;
  window.STATE.rab.forEach((r) => (total += Number(r.nominal) || 0));
  if (document.getElementById("rab-total-display"))
    document.getElementById("rab-total-display").innerText =
      window.formatRupiah(total);
  const start = (window.currentRABPage - 1) * window.ALUMNI_PER_PAGE;
  const pagedData = window.STATE.rab.slice(
    start,
    start + window.ALUMNI_PER_PAGE,
  );
  const maxPage = Math.max(
    1,
    Math.ceil(window.STATE.rab.length / window.ALUMNI_PER_PAGE),
  );
  if (document.getElementById("page-info-rab"))
    document.getElementById("page-info-rab").innerText =
      `Halaman ${window.currentRABPage} dari ${maxPage}`;

  if (pagedData.length === 0)
    return (tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-500 text-xs italic">Belum ada RAB.</td></tr>`);

  tbody.innerHTML = pagedData
    .map((r) => {
      const isPaid = r.status === "pengeluaran";
      let act = "-";
      if (canFin) {
        const btnB = isPaid
          ? `<button onclick="toggleRABStatus('${r.id}', true)" class="px-2 py-1 bg-red-500/10 text-red-500 rounded text-[9px] font-bold whitespace-nowrap mr-1">Batal</button>`
          : `<button onclick="toggleRABStatus('${r.id}', false)" class="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-bold whitespace-nowrap mr-1">Bayar</button>`;
        act = `${btnB}<button onclick="openModalRAB('${encodeURIComponent(JSON.stringify(r)).replace(/'/g, "%27")}')" class="w-7 h-7 bg-amber-500/10 text-amber-500 rounded hover:bg-amber-500 hover:text-white mr-1" title="Edit"><i class="fas fa-edit text-[10px]"></i></button><button onclick="handleDelete('finance', '${r.id}')" class="w-7 h-7 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white" title="Hapus"><i class="fas fa-trash-alt text-[10px]"></i></button>`;
      }
      const stBadge = isPaid
        ? `<span class="px-2 py-1 rounded bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase">Sudah Dibayar</span>`
        : `<span class="px-2 py-1 rounded bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase">Belum Dibayar</span>`;
      return `<tr class="border-b border-white/5 hover:bg-black/5"><td class="p-5 font-bold">${r.nama_pembayar}</td><td class="p-5 font-black text-emerald-400">${window.formatRupiah(r.nominal)}</td><td class="p-5 text-center">${stBadge}</td><td class="p-5 text-center">${act}</td></tr>`;
    })
    .join("");
};

window.changeFinancePage = (dir) => {
  const max = Math.max(
    1,
    Math.ceil(window.currentFinanceData.length / window.ALUMNI_PER_PAGE),
  );
  window.currentFinancePage += dir;
  if (window.currentFinancePage < 1) window.currentFinancePage = 1;
  if (window.currentFinancePage > max) window.currentFinancePage = max;
  window.renderFinanceTable();
};

window.updateUserRole = async (uid, newRole) => {
  const dbHasCreator = window.STATE.users.some(u => u.role === "creator");
  const isOwner = (uObj) => {
      if (!uObj) return false;
      return uObj.role === "creator";
  };

  const targetUser = window.STATE.users.find(u => u.uid === uid);
  
  if (isOwner(targetUser)) {
      window.notify("Anda tidak dapat mengubah role Sang Pembuat Aplikasi!", "error");
      return;
  }

  if (newRole === "creator" && window.STATE.user && window.STATE.user.uid !== uid) {
    if (!confirm("PERINGATAN KERAS: Mewariskan tahta Creator ke pengguna ini berarti ANDA AKAN TURUN PANGKAT menjadi Admin biasa, dan tidak akan bisa mengubahnya kembali. Yakin?")) {
        window.renderUsers();
        return;
    }
  } else if (newRole === "admin_utama") {
    if (!confirm("PERINGATAN: Menjadikan pengguna ini sebagai Admin Utama akan membuat akunnya memiliki akses penuh. Lanjutkan?")) {
        window.renderUsers();
        return;
    }
  }
  
  window.toggleLoading(true, "Mengubah Role...");
  try {
    const batch = db.batch();
    batch.update(db.collection("users").doc(uid), { role: newRole });
    
    // Jika transfer creator ke orang lain, demote diri sendiri
    if (newRole === "creator" && window.STATE.user && window.STATE.user.uid !== uid) {
        batch.update(db.collection("users").doc(window.STATE.user.uid), { role: "admin_utama" });
    }
    
    await batch.commit();
    window.notify("Role berhasil diubah!", "success");
    window.renderUsers();
  } catch (e) {
    window.notify("Gagal mengubah role", "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.deleteUser = async (uid) => {
  const dbHasCreator = window.STATE.users.some(u => u.role === "creator");
  const isOwner = (uObj) => {
      if (!uObj) return false;
      return uObj.role === "creator";
  };
  
  const targetUser = window.STATE.users.find(u => u.uid === uid);
  
  if (isOwner(targetUser)) {
      window.notify("Anda tidak dapat menghapus Sang Pembuat Aplikasi!", "error");
      return;
  }

  const okDel = await window.showConfirm({ title: 'Hapus Pengguna?', message: 'Yakin ingin menghapus pengguna ini dari sistem secara permanen? Tindakan ini tidak dapat dibatalkan.', confirmText: 'Ya, Hapus', danger: true });
  if (!okDel) return;
  window.toggleLoading(true, "Menghapus Pengguna...");
  try {
    await db.collection("users").doc(uid).delete();
    window.notify("Pengguna berhasil dihapus", "success");
    window.renderUsers();
  } catch (e) {
    window.notify("Gagal menghapus pengguna", "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.renderFinanceTable = () => {
  const tbody = document.getElementById("finance-list");
  const role = window.STATE.user ? window.STATE.user.role : "user";
  const canFin = role === "admin_utama" || role === "creator" || role === "bendahara";
  const start = (window.currentFinancePage - 1) * window.ALUMNI_PER_PAGE;
  const pagedData = window.currentFinanceData.slice(
    start,
    start + window.ALUMNI_PER_PAGE,
  );
  const maxPage = Math.max(
    1,
    Math.ceil(window.currentFinanceData.length / window.ALUMNI_PER_PAGE),
  );
  if (document.getElementById("page-info-fin"))
    document.getElementById("page-info-fin").innerText =
      `Halaman ${window.currentFinancePage} dari ${maxPage}`;

  if (pagedData.length === 0)
    return (tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 text-xs italic">Belum ada transaksi.</td></tr>`);

  tbody.innerHTML = pagedData
    .map((f) => {
      const safeStr = encodeURIComponent(JSON.stringify(f)).replace(/'/g, "%27");
      let act = ``;
      if (f.status === "pemasukan")
        act += `<button onclick="printReceipt('${safeStr}')" class="w-7 h-7 bg-indigo-500/10 text-indigo-500 rounded hover:bg-indigo-500 hover:text-white mr-1" title="Cetak Kwitansi"><i class="fas fa-receipt text-[10px]"></i></button>`;
      if (f.bukti_url && f.bukti_url !== "null")
        act += `<button onclick="window.openImageModal('${f.bukti_url}')" class="w-7 h-7 inline-flex items-center justify-center bg-slate-500/10 text-slate-500 rounded hover:bg-slate-500 hover:text-white mr-1" title="Lihat Bukti"><i class="fas fa-image text-[10px]"></i></button>`;

      if (canFin) {
        if (f.kategori === "RAB")
          act += `<span class="px-2 py-1 rounded bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase whitespace-nowrap">Kelola di RAB</span>`;
        else
          act += `<button onclick="openModalFinanceEdit('${safeStr}')" class="w-7 h-7 bg-amber-500/10 text-amber-500 rounded hover:bg-amber-500 hover:text-white mr-1" title="Edit"><i class="fas fa-edit text-[10px]"></i></button><button onclick="handleDelete('finance', '${f.id}')" class="w-7 h-7 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white" title="Hapus"><i class="fas fa-trash-alt text-[10px]"></i></button>`;
      }
      let dStr = f.tanggal
        ? typeof f.tanggal === "string"
          ? f.tanggal.split(",")[0]
          : f.tanggal.toDate().toLocaleDateString("id-ID")
        : "-";
      return `<tr class="border-b border-white/5 hover:bg-black/5"><td class="p-5 text-xs text-slate-500">${dStr}</td><td class="p-5"><div class="font-bold">${f.nama_pembayar}</div><div class="text-[8px] text-indigo-500 font-bold uppercase tracking-wider">${f.kategori}</div></td><td class="p-5 font-black ${f.status === "pengeluaran" ? "text-red-400" : "text-emerald-400"}">${f.status === "pengeluaran" ? "-" : "+"}${window.formatRupiah(f.nominal)}</td><td class="p-5 text-center"><div class="flex justify-center">${act}</div></td></tr>`;
    })
    .join("");
};

window.renderRequestTable = () => {
  const role = window.STATE.user ? window.STATE.user.role : "user";
  const canManageAlumni = role === "admin_utama" || role === "creator" || role === "sekretaris";
  const canManageFinance = role === "admin_utama" || role === "creator" || role === "bendahara";

  const tbodyFinance = document.getElementById("request-finance-list");
  if (!window.STATE.pendingFinance || window.STATE.pendingFinance.length === 0)
    tbodyFinance.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 text-xs italic">Tidak ada pembayaran pending.</td></tr>`;
  else
    tbodyFinance.innerHTML = window.STATE.pendingFinance
      .map((req) => {
        const matchedAlumni = window.STATE.alumni ? window.STATE.alumni.find(a => a.id === req.ref_alumni_id) : null;
        const nowa = matchedAlumni ? matchedAlumni.nowa : (req.nowa || "");
        const angkatan = matchedAlumni ? matchedAlumni.angkatan : (req.angkatan || "");
        
        let remindBtn = "";
        if (nowa) {
            remindBtn = `<button onclick="window.sendPaymentReminder('${nowa}', '${req.nama_pembayar.replace(/'/g, "\\'")}', ${req.nominal}, '${angkatan}')" class="bg-amber-600 hover:bg-amber-500 px-3 py-2 rounded-lg text-[10px] font-bold text-white shadow-lg mr-1" title="Kirim Pengingat WA"><i class="fab fa-whatsapp"></i> Ingatkan</button>`;
        }

        let act = canManageFinance
          ? `${remindBtn}<button onclick="window.openFinanceVerificationModal('${req.id}')" class="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg text-[10px] font-bold text-white shadow-lg"><i class="fas fa-shield-alt"></i> Verifikasi</button>`
          : `<span class="text-amber-500 text-[9px]"><i class="fas fa-lock"></i> Hak Bendahara</span>`;
        return `<tr class="border-b border-white/5 hover:bg-black/5"><td class="p-5 text-xs text-slate-400 whitespace-nowrap">${req.tanggal}</td><td class="p-5 font-bold text-emerald-400">${req.nama_pembayar}</td><td class="p-5 text-right font-black text-white whitespace-nowrap">${window.formatRupiah(req.nominal)}</td><td class="p-5 text-center"><button onclick="window.openFinanceVerificationModal('${req.id}')" class="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-500/10 px-3 py-2 rounded-lg whitespace-nowrap"><i class="fas fa-shield-alt"></i> Tinjau Struk</button></td><td class="p-5 text-center whitespace-nowrap">${act}</td></tr>`;
      })
      .join("");

  const tbodyAlumni = document.getElementById("request-list");
  if (!window.STATE.requests || window.STATE.requests.length === 0)
    tbodyAlumni.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-500 text-xs italic">Tidak ada pengajuan alumni pending.</td></tr>`;
  else
    tbodyAlumni.innerHTML = window.STATE.requests
      .map((req) => {
        let act = canManageAlumni
          ? `<button onclick="window.openReviewAlumniModal('${req.id}')" class="bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-2 rounded-lg text-[10px] font-bold text-white shadow-lg mr-1"><i class="fas fa-search-location"></i> Tinjau</button><button onclick="handleRequest('${req.id}', 'approverequest')" class="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg text-[10px] font-bold text-white shadow-lg mr-1"><i class="fas fa-check"></i> Setujui</button><button onclick="handleRequest('${req.id}', 'rejectrequest')" class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg text-[10px] font-bold text-white shadow-lg"><i class="fas fa-times"></i> Hapus</button>`
          : `<button onclick="window.openReviewAlumniModal('${req.id}')" class="bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-2 rounded-lg text-[10px] font-bold text-white shadow-lg mr-1"><i class="fas fa-search-location"></i> Tinjau</button><span class="text-amber-500 text-[9px]"><i class="fas fa-lock"></i> Hak Sekretaris</span>`;
        const lembagaBadge = req.lembaga ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${req.lembaga === 'MA' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'}">${req.lembaga}</span>` : '';
        return `<tr class="border-b border-white/5 hover:bg-black/5"><td class="p-5 font-bold">${req.nama}${lembagaBadge}</td><td class="p-5 text-center font-black text-indigo-500">${req.angkatan}</td><td class="p-5 text-xs text-slate-400">${req.desa || "-"}, ${req.kabupaten || "-"}</td><td class="p-5 text-center whitespace-nowrap">${act}</td></tr>`;
      })
      .join("");
};

window.openReviewAlumniModal = (id) => {
  const req = window.STATE.requests ? window.STATE.requests.find(x => x.id === id) : null;
  if (!req) return;

  const role = window.STATE.user ? window.STATE.user.role : "user";
  const canManageAlumni = role === "admin_utama" || role === "creator" || role === "sekretaris";

  // Set fields
  document.getElementById('review-alm-nama').textContent = req.nama || '-';
  document.getElementById('review-alm-angkatan-badge').textContent = 'Angkatan ' + (req.angkatan || '-');
  document.getElementById('review-alm-lembaga-badge').textContent = req.lembaga || 'MA/MTs';
  
  const nowaEl = document.getElementById('review-alm-nowa');
  if (req.nowa) {
    nowaEl.textContent = '+62 ' + req.nowa;
    nowaEl.href = `https://wa.me/${req.nowa}`;
  } else {
    nowaEl.textContent = '-';
    nowaEl.href = '#';
  }

  const dateText = req.created_at
    ? new Date(req.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';
  document.getElementById('review-alm-tanggal').textContent = dateText;
  document.getElementById('review-alm-alamat').textContent = req.alamat || '-';
  document.getElementById('review-alm-desa').textContent = req.desa || '-';
  document.getElementById('review-alm-kecamatan').textContent = req.kecamatan || '-';
  document.getElementById('review-alm-kabupaten').textContent = req.kabupaten || '-';
  document.getElementById('review-alm-provinsi').textContent = req.provinsi || '-';

  // Render actions
  const actionsEl = document.getElementById('review-alm-actions');
  if (canManageAlumni) {
    actionsEl.innerHTML = `
      <button onclick="window.closeReviewAlumniModal(); handleRequest('${req.id}', 'approverequest')" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]">
        <i class="fas fa-check"></i> Setujui
      </button>
      <button onclick="window.closeReviewAlumniModal(); handleRequest('${req.id}', 'rejectrequest')" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]">
        <i class="fas fa-times"></i> Hapus / Tolak
      </button>
    `;
  } else {
    actionsEl.innerHTML = `
      <div class="w-full text-center text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
        <i class="fas fa-lock mr-1"></i> Anda tidak memiliki hak akses (Sekretaris) untuk memverifikasi data ini.
      </div>
    `;
  }

  document.getElementById('modal-review-alumni').classList.remove('hidden');
};

window.closeReviewAlumniModal = () => {
  document.getElementById('modal-review-alumni').classList.add('hidden');
};

window.renderRekapWilayah = () => {
  const list = document.getElementById("rekap-list");
  const role = window.STATE.user ? window.STATE.user.role : "user";
  const canFin = role === "admin_utama" || role === "creator" || role === "bendahara";
  if (window.filteredRekapData.length === 0)
    return (list.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-500 text-xs italic">Tidak ada data.</td></tr>`);
  list.innerHTML = window.filteredRekapData
    .map(
      (a) => {
        const lembagaBadge = a.lembaga ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${a.lembaga === 'MA' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'}">${a.lembaga}</span>` : '';
        const rowCanFin = window.canUserFinAlumnus(window.STATE.user, a);
        return `<tr class="border-b border-white/5 hover:bg-black/5"><td class="p-5 font-bold">${a.nama}${lembagaBadge}</td><td class="p-5 text-center font-black text-indigo-500">${a.angkatan}</td><td class="p-5 text-[11px] text-slate-500">${a.alamat || "-"}, ${a.desa || "-"}, ${a.kecamatan || "-"}, ${a.kabupaten || "-"}</td><td class="p-5 text-center">${rowCanFin ? `<button onclick="openModalFinance('${encodeURIComponent(JSON.stringify(a)).replace(/'/g, "%27")}')" class="w-8 h-8 text-emerald-500 bg-emerald-500/10 rounded-lg hover:bg-emerald-500 hover:text-white" title="Tambah Donasi"><i class="fas fa-coins text-[10px]"></i></button>` : "-"}</td></tr>`;
      }
    )
    .join("");
};

// ==========================================
// FUNGSI CRUD & SIMPAN DATA
// ==========================================
window.compressImage = (file, maxMB = 0.5) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith("image/")) return resolve(file);
    if (file.size / (1024 * 1024) <= maxMB) return resolve(file);
    const r = new FileReader();
    r.readAsDataURL(file);
    r.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0, img.width, img.height);
        canvas.toBlob(
          (b) => resolve(new File([b], file.name, { type: "image/jpeg" })),
          "image/jpeg",
          0.7,
        );
      };
    };
  });
};

document.getElementById("form-alumni").onsubmit = async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target).entries());

  // === PROTEKSI WILAYAH UNTUK KOORDINATOR WILAYAH (OVERRIDE DARI SESSION USER) ===
  if (window.STATE.user) {
    const u = window.STATE.user;
    const role = u.role;
    if (role === 'korwil_kabupaten') {
      d.kabupaten = u.wilayah_kabupaten || d.kabupaten;
    } else if (role === 'korwil_kecamatan') {
      d.kabupaten = u.wilayah_kabupaten || d.kabupaten;
      d.kecamatan = u.wilayah_kecamatan || d.kecamatan;
    } else if (role === 'korwil_desa') {
      d.kabupaten = u.wilayah_kabupaten || d.kabupaten;
      d.kecamatan = u.wilayah_kecamatan || d.kecamatan;
      d.desa = u.wilayah_desa || d.desa;
    }
  }

  // === VALIDASI INPUT ===
  const nama = (d.nama || "").trim();
  if (nama.length < 3) return window.notify("Nama minimal 3 karakter!", "error");
  const normalizedAngkatan = window.normalizeAngkatanYear(d.angkatan, d.lembaga);
  const angkatan = Number(normalizedAngkatan);
  if (!d.angkatan || isNaN(angkatan) || angkatan < 1900 || angkatan > 2100)
    return window.notify("Angkatan harus berupa tahun yang valid (1900–2100)!", "error");
  if (d.nowa && !/^[0-9+\-\s]+$/.test(d.nowa))
    return window.notify("Nomor WhatsApp hanya boleh berisi angka!", "error");
  
  // === FITUR 3: WARNING KABUPATEN JIKA TIDAK DI DATALIST ===
  const kabVal = (d.kabupaten || "").trim();
  if (kabVal) {
    const listKab = document.getElementById("alm-list-kabupaten");
    const options = listKab ? Array.from(listKab.options).map(o => o.value.toUpperCase()) : [];
    if (options.length > 0 && !options.includes(kabVal.toUpperCase())) {
      const proceed = await window.showConfirm({
        title: '⚠️ Kabupaten Tidak Terdaftar',
        message: `Kabupaten/Kota "${kabVal}" tidak ditemukan dalam daftar rekomendasi resmi. Tetap simpan?`,
        confirmText: 'Ya, Simpan',
        cancelText: 'Perbaiki',
        danger: false
      });
      if (!proceed) {
        const inputKab = document.getElementById("alm-kabupaten");
        if (inputKab) {
          inputKab.focus();
          inputKab.classList.add("border-amber-500");
        }
        return;
      }
    }
  }
  // =======================================================

  window.toggleLoading(true, "Menyimpan Alumni...");
  d.nama = window.capitalizeName(nama);
  d.angkatan = angkatan;
  const id = d.id;
  delete d.id;
  d.status = "approved";
  if (d.nowa) d.nowa = window.normalizePhoneNumber(d.nowa);

  // === FITUR 3: AUTO-NORMALIZE NAMA WILAYAH SEBELUM SIMPAN ===
  if (d.kabupaten) d.kabupaten = window.normalizeWilayahName(d.kabupaten);
  if (d.kecamatan) d.kecamatan = window.normalizeWilayahName(d.kecamatan);
  if (d.desa) d.desa = window.normalizeWilayahName(d.desa);
  if (d.provinsi) d.provinsi = window.normalizeWilayahName(d.provinsi);
  // ===========================================================

  try {
    if (id) {
      const oldDoc = await db.collection("alumni").doc(id).get();
      if (!oldDoc.exists) {
        window.notify("Data tidak ditemukan!", "error");
        window.toggleLoading(false);
        return;
      }
      const oldData = oldDoc.data();

      // === PROTEKSI WILAYAH: VALIDASI EDIT DATA ALUMNI ===
      if (window.STATE.user) {
        if (!window.canUserManageAlumnus(window.STATE.user, { id, ...oldData })) {
          window.notify("Anda tidak memiliki akses untuk mengubah data alumni ini!", "error");
          window.toggleLoading(false);
          return;
        }
      }

      // === FITUR 6: SIMPAN CHANGELOG SEBELUM UPDATE ===
      try {
        const changedFields = {};
        const trackedFields = ['nama','angkatan','lembaga','nowa','kabupaten','kecamatan','desa','alamat','provinsi'];
        trackedFields.forEach(f => {
          if (String(oldData[f]||'') !== String(d[f]||'')) {
            changedFields[f] = { before: oldData[f]||'', after: d[f]||'' };
          }
        });
        if (Object.keys(changedFields).length > 0) {
          await db.collection("alumni_changelog").add({
            alumniId: id,
            alumniNama: d.nama,
            changedBy: window.STATE.user ? window.STATE.user.nama : 'Unknown',
            changedAt: new Date().toISOString(),
            changes: changedFields
          });
        }
      } catch(logErr) { console.warn('Gagal simpan changelog:', logErr); }
      // ================================================
      await db.collection("alumni").doc(id).update(d);
      await window.logActivity("alumni_edit", `Mengubah data alumni ${d.nama} (${d.angkatan})`);
      await window.incrementSyncVersion('alumni');
      
      // Update local state instantly
      if (Array.isArray(window.STATE.rawAlumni)) {
        window.STATE.rawAlumni = window.STATE.rawAlumni.map(a => a.id === id ? { ...a, ...d } : a);
        localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
        window.processCombinedData();
      }
    } else {
      d.created_at = new Date().toISOString();
      const res = await db.collection("alumni").add(d);
      await window.logActivity("alumni_add", `Menambahkan alumni baru ${d.nama} (${d.angkatan})`);
      await window.incrementSyncVersion('alumni');
      
      // Update local state instantly
      if (Array.isArray(window.STATE.rawAlumni)) {
        window.STATE.rawAlumni.push({ id: res.id, ...d });
        localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
        window.processCombinedData();
      }
    }
    window.closeModal("modal-alumni");
    window.notify("Tersimpan");
    e.target.reset();
    if (typeof window.applyAlumniFilters === "function") {
      window.applyAlumniFilters(true);
    }
  } catch (e) {
    window.notify("Gagal menyimpan: " + (e.message || "Periksa koneksi"), "error");
  } finally {
    window.toggleLoading(false);
  }
};

document.getElementById("form-finance").onsubmit = async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target).entries());

  // === VALIDASI INPUT ===
  const keterangan = (d.nama_pembayar || "").trim();
  if (keterangan.length < 2) return window.notify("Keterangan transaksi tidak boleh kosong!", "error");
  const nominal = Number(d.nominal);
  if (!d.nominal || isNaN(nominal) || nominal <= 0)
    return window.notify("Nominal harus berupa angka positif!", "error");
  if (nominal > 1000000000000) // > 1 Triliun
    return window.notify("Nominal terlalu besar, periksa kembali!", "error");
  // ======================

  window.toggleLoading(true, "Menyimpan Transaksi...");
  d.nama_pembayar = keterangan;
  d.nominal = nominal;
  const id = d.id;
  delete d.id;
  const fileInput = document.getElementById("fin-file");
  try {
    if (fileInput && fileInput.files.length > 0) {
      window.toggleLoading(true, "Mengunggah Bukti Struk...");
      let file = await window.compressImage(fileInput.files[0], 0.5);

      // --- UPLOAD VIA CLOUDINARY ---
      const formData = new FormData();
      formData.append("file", file); // Cloudinary menggunakan parameter 'file'
      formData.append("upload_preset", "Reuniakbar"); // GANTI INI

      const cloudRes = await fetch(
        "https://api.cloudinary.com/v1_1/dowih3wr7/image/upload",
        { method: "POST", body: formData },
      ); // GANTI [CLOUD_NAME_ANDA]
      const cloudData = await cloudRes.json();
      if (cloudData.secure_url) d.bukti_url = cloudData.secure_url;
    }

    d.updated_by = window.STATE.user.email;
    if (!id) d.tanggal = new Date().toLocaleString("id-ID");
     if (id) {
      await db.collection("finance").doc(id).update(d);
      await window.logActivity("finance_edit", `Mengubah transaksi keuangan "${d.nama_pembayar}" sebesar ${window.formatRupiah(d.nominal)}`);
      await window.incrementSyncVersion('finance');
      
      // Update local state instantly
      if (Array.isArray(window.STATE.rawFinance)) {
        window.STATE.rawFinance = window.STATE.rawFinance.map(f => f.id === id ? { ...f, ...d } : f);
        localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
        window.processCombinedData();
      }
    } else {
      d.created_at = new Date().toISOString();
      const res = await db.collection("finance").add(d);
      await window.logActivity("finance_add", `Menambahkan transaksi keuangan baru "${d.nama_pembayar}" sebesar ${window.formatRupiah(d.nominal)}`);
      await window.incrementSyncVersion('finance');
      
      // Update local state instantly
      if (Array.isArray(window.STATE.rawFinance)) {
        window.STATE.rawFinance.push({ id: res.id, ...d });
        localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
        window.processCombinedData();
      }
      
      if (window.sendReceiptNotification) {
        window.sendReceiptNotification({ id: res.id, ...d });
      }
    }

    window.closeModal("modal-finance");
    if (
      document.getElementById("modal-history") &&
      !document.getElementById("modal-history").classList.contains("hidden")
    )
      window.closeModal("modal-history");
    window.notify("Tersimpan");
    e.target.reset();
  } catch (e) {
    window.notify("Gagal", "error");
  } finally {
    window.toggleLoading(false);
  }
};

document.getElementById("form-rab").onsubmit = async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target).entries());

  // === VALIDASI INPUT ===
  const namaItem = (d.nama_pembayar || "").trim();
  if (namaItem.length < 2) return window.notify("Nama item RAB tidak boleh kosong!", "error");
  const nominalRAB = Number(d.nominal);
  if (!d.nominal || isNaN(nominalRAB) || nominalRAB <= 0)
    return window.notify("Anggaran RAB harus berupa angka positif!", "error");
  // ======================

  window.toggleLoading(true, "Menyimpan RAB...");
  d.nama_pembayar = namaItem;
  d.nominal = nominalRAB;
  const id = d.id;
  delete d.id;
  try {
    if (!id) {
      d.tanggal = new Date().toLocaleString("id-ID");
      d.created_at = new Date().toISOString();
    }
    if (id) {
      await db.collection("finance").doc(id).update(d);
      await window.logActivity("rab_edit", `Mengubah RAB "${d.nama_pembayar}" menjadi ${window.formatRupiah(d.nominal)}`);
      await window.incrementSyncVersion('finance');
      
      // Update local state instantly
      if (Array.isArray(window.STATE.rawFinance)) {
        window.STATE.rawFinance = window.STATE.rawFinance.map(f => f.id === id ? { ...f, ...d } : f);
        localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
        window.processCombinedData();
      }
    } else {
      const res = await db.collection("finance").add(d);
      await window.logActivity("rab_add", `Menambahkan RAB baru "${d.nama_pembayar}" sebesar ${window.formatRupiah(d.nominal)}`);
      await window.incrementSyncVersion('finance');
      
      // Update local state instantly
      if (Array.isArray(window.STATE.rawFinance)) {
        window.STATE.rawFinance.push({ id: res.id, ...d });
        localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
        window.processCombinedData();
      }
    }
    window.closeModal("modal-rab");
    window.notify("Tersimpan");
    e.target.reset();
  } catch (e) {
    window.notify("Gagal menyimpan: " + (e.message || "Periksa koneksi"), "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.toggleRABStatus = async (id, isPaid) => {
  window.toggleLoading(
    true,
    isPaid ? "Membatalkan pembayaran..." : "Mencatat pengeluaran...",
  );
  try {
    const d = { status: isPaid ? "rab_belum" : "pengeluaran" };
    if (!isPaid) d.tanggal = new Date().toLocaleString("id-ID");
    await db.collection("finance").doc(id).update(d);
    await window.logActivity("rab_toggle", `${isPaid ? 'Membatalkan pembayaran' : 'Membayar'} RAB ID ${id}`);
    await window.incrementSyncVersion('finance');
    
    // Update local state instantly
    if (Array.isArray(window.STATE.rawFinance)) {
      window.STATE.rawFinance = window.STATE.rawFinance.map(f => f.id === id ? { ...f, ...d } : f);
      localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
      window.processCombinedData();
    }

    window.notify(isPaid ? "Dibatalkan" : "Dibayar");
  } catch (e) {
    window.notify("Gagal", "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.handleDelete = (type, id, label) => {
  window.openModal("modal-delete");

  // Untuk Finance/RAB: tampilkan info transaksi di konfirmasi
  const titleEl = document.querySelector("#modal-delete h3");
  if ((type === "finance") && label) {
    titleEl.innerText = "Hapus Transaksi?";
    // Tampilkan detail transaksi di bawah judul jika ada elemen deskripsi
    let descEl = document.getElementById("delete-detail-desc");
    if (!descEl) {
      descEl = document.createElement("p");
      descEl.id = "delete-detail-desc";
      descEl.className = "text-xs text-slate-400 mt-1 mb-3 text-center";
      titleEl.parentNode.insertBefore(descEl, titleEl.nextSibling);
    }
    descEl.innerText = `"${label}" akan dihapus permanen dari data keuangan.`;
    descEl.classList.remove("hidden");
  } else {
    titleEl.innerText = "Konfirmasi Hapus";
    const descEl = document.getElementById("delete-detail-desc");
    if (descEl) descEl.classList.add("hidden");
  }

  if (document.getElementById("delete-pin-input")) {
    document.getElementById("delete-pin-input").classList.add("hidden");
    document.getElementById("delete-pin-help").classList.add("hidden");
  }
  const btn = document.getElementById("confirm-delete-btn");
  const nBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(nBtn, btn);
  nBtn.onclick = async () => {
    window.closeModal("modal-delete");
    window.toggleLoading(true, "Menghapus...");
    try {
      // === PROTEKSI WILAYAH: VALIDASI SEBELUM MENGHAPUS ===
      if (window.STATE.user) {
        if (type === "alumni") {
          const doc = await db.collection("alumni").doc(id).get();
          if (doc.exists) {
            const data = doc.data();
            if (!window.canUserManageAlumnus(window.STATE.user, { id, ...data })) {
              window.notify("Anda tidak memiliki akses untuk menghapus data alumni ini!", "error");
              window.toggleLoading(false);
              return;
            }
          }
        } else if (type === "finance") {
          const doc = await db.collection("finance").doc(id).get();
          if (doc.exists) {
            const data = doc.data();
            const matchedAlumni = window.STATE.rawAlumni.find(a => a.id === data.ref_alumni_id);
            if (matchedAlumni) {
              if (!window.canUserFinAlumnus(window.STATE.user, matchedAlumni)) {
                window.notify("Anda tidak memiliki akses untuk menghapus transaksi alumni ini!", "error");
                window.toggleLoading(false);
                return;
              }
            }
          }
        }
      }

      try {
        const docSnap = await db.collection(type).doc(id).get();
        if (docSnap.exists) {
          const docData = docSnap.data();
          if (type === "alumni") {
            if (docData.photoURL) await window.deleteCloudinaryFileByUrl(docData.photoURL);
            if (docData.bukti_url) await window.deleteCloudinaryFileByUrl(docData.bukti_url);
          } else if (type === "finance") {
            if (docData.bukti_url) await window.deleteCloudinaryFileByUrl(docData.bukti_url);
          }
        }
      } catch (errCloud) {
        console.error("Gagal menghapus file Cloudinary saat menghapus data:", errCloud);
      }

      await db.collection(type).doc(id).delete();
      await window.logActivity(`${type}_delete`, `Menghapus data ${type} ID ${id} ${label ? `(${label})` : ''}`);
      await window.incrementSyncVersion(type);
      
      // Update local state instantly
      if (type === "alumni" && Array.isArray(window.STATE.rawAlumni)) {
        window.STATE.rawAlumni = window.STATE.rawAlumni.filter(a => a.id !== id);
        localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
        window.processCombinedData();
        if (typeof window.applyAlumniFilters === "function") {
          window.applyAlumniFilters(true);
        }
      } else if (type === "finance" && Array.isArray(window.STATE.rawFinance)) {
        window.STATE.rawFinance = window.STATE.rawFinance.filter(f => f.id !== id);
        localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
        window.processCombinedData();
      }

      window.notify("Terhapus");
    } catch (e) {
      window.notify("Gagal menghapus: " + (e.message || ""), "error");
    } finally {
      window.toggleLoading(false);
    }
  };
};

window.handleRequest = async (id, action) => {
  window.toggleLoading(true, "Memproses verifikasi...");
  try {
    const alumniDoc = await db.collection("alumni").doc(id).get();
    if (!alumniDoc.exists) {
      window.notify("Data tidak ditemukan!", "error");
      window.toggleLoading(false);
      return;
    }
    const alumniData = alumniDoc.data();

    // === PROTEKSI WILAYAH: VERIFIKASI PENDING ALUMNI ===
    if (window.STATE.user && alumniData) {
      if (!window.canUserManageAlumnus(window.STATE.user, { id, ...alumniData })) {
        window.notify("Anda tidak memiliki akses ke wilayah ini!", "error");
        window.toggleLoading(false);
        return;
      }
    }

    if (action === "approverequest") {
      // 1. Update status pendaftaran menjadi disetujui di Firebase
      await db.collection("alumni").doc(id).update({ status: "approved" });
      await window.incrementSyncVersion('alumni');
      
      // LOG AKTIVITAS
      if (alumniData) {
        await window.logActivity("alumni_approve", `Menyetujui pendaftaran alumni ${alumniData.nama} (Angkatan ${alumniData.angkatan || ''})`);
      }

      // 3. KIRIM NOTIFIKASI WA MODULAR DENGAN API CLOUD MULTI-PROVIDER
      if (alumniData && alumniData.nowa) {
        let nomor = String(alumniData.nowa).replace(/\D/g, "");
        if (nomor.startsWith("0")) nomor = "62" + nomor.substring(1);
        const pesanTeks =
          "Assalamu'alaikum wr. wb.\n\nHalo *" +
          alumniData.nama +
          "*,\nSelamat, data pendaftaran Anda untuk acara Reuni Akbar AL-FATAH telah *BERHASIL DIVERIFIKASI* oleh panitia.\n\nTerima kasih atas partisipasinya!";
        try {
          await window.sendWhatsAppAPI(nomor, pesanTeks, null, null, "Pendaftaran", null);
        } catch (errWA) {
          console.error("Gagal mengirim WA:", errWA);
        }
      }

      // Update local state instantly
      if (Array.isArray(window.STATE.rawAlumni)) {
        window.STATE.rawAlumni = window.STATE.rawAlumni.map(a => a.id === id ? { ...a, status: "approved" } : a);
        localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
        window.processCombinedData();
        if (typeof window.applyAlumniFilters === "function") {
          window.applyAlumniFilters();
        }
      }

      window.notify("Berhasil disetujui & WA Terkirim!", "success");
    } else {
      // Jika tombol yang diklik adalah "Hapus / Tolak"
      if (alumniData) {
        if (alumniData.photoURL) {
          await window.deleteCloudinaryFileByUrl(alumniData.photoURL);
        }
        if (alumniData.bukti_url) {
          await window.deleteCloudinaryFileByUrl(alumniData.bukti_url);
        }
      }
      await db.collection("alumni").doc(id).delete();
      await window.logActivity("alumni_reject", `Menolak & menghapus pendaftaran alumni ID ${id}`);
      await window.incrementSyncVersion('alumni');
      
      // Update local state instantly
      if (Array.isArray(window.STATE.rawAlumni)) {
        window.STATE.rawAlumni = window.STATE.rawAlumni.filter(a => a.id !== id);
        localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
        window.processCombinedData();
        if (typeof window.applyAlumniFilters === "function") {
          window.applyAlumniFilters();
        }
      }

      window.notify("Data pendaftar ditolak dan dihapus.", "success");
    }
  } catch (e) {
    window.notify("Terjadi kesalahan saat memproses data", "error");
    console.error(e);
  } finally {
    window.toggleLoading(false);
  }
};

window.handleFinanceRequest = async (id, action) => {
  window.toggleLoading(
    true,
    action === "approve"
      ? "Menerima pembayaran & Mengirim WA..."
      : "Menolak pembayaran...",
  );
  try {
    const finDoc = await db.collection("finance").doc(id).get();
    if (!finDoc.exists) {
      window.notify("Transaksi tidak ditemukan!", "error");
      window.toggleLoading(false);
      return;
    }
    const finData = finDoc.data();

    // === PROTEKSI WILAYAH: VERIFIKASI PENDING FINANCE ===
    if (window.STATE.user && finData) {
      const matchedAlumni = window.STATE.rawAlumni.find(a => a.id === finData.ref_alumni_id);
      if (matchedAlumni) {
        if (!window.canUserFinAlumnus(window.STATE.user, matchedAlumni)) {
          window.notify("Anda tidak memiliki akses ke wilayah ini!", "error");
          window.toggleLoading(false);
          return;
        }
      }
    }

    if (action === "approve") {
      await db.collection("finance").doc(id).update({ status: "pemasukan" });
      await window.incrementSyncVersion('finance');

      // === SISTEM KIRIM WA TANDA TERIMA DONASI MODULAR ===
      if (finData) {
        await window.sendReceiptNotification({ id, ...finData, status: "pemasukan" });
        await window.logActivity("finance_approve", `Menyetujui pembayaran donasi ID ${id} sebesar ${window.formatRupiah(finData.nominal)} dari ${finData.nama_pembayar}`);
      }
      // ============================================

      // Update local state instantly
      if (Array.isArray(window.STATE.rawFinance)) {
        window.STATE.rawFinance = window.STATE.rawFinance.map(f => f.id === id ? { ...f, status: "pemasukan" } : f);
        localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
        window.processCombinedData();
      }

      window.notify(
        "Pembayaran & Donasi berhasil dimasukkan ke Kas!",
        "success",
      );
    } else {
      if (finData && finData.bukti_url) {
        await window.deleteCloudinaryFileByUrl(finData.bukti_url);
      }
      await db.collection("finance").doc(id).delete();
      await window.logActivity("finance_reject", `Menolak & menghapus laporan pembayaran donasi kas ID ${id}`);
      await window.incrementSyncVersion('finance');
      
      // Update local state instantly
      if (Array.isArray(window.STATE.rawFinance)) {
        window.STATE.rawFinance = window.STATE.rawFinance.filter(f => f.id !== id);
        localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
        window.processCombinedData();
      }

      window.notify("Laporan Pembayaran Ditolak & Dihapus.", "error");
    }
  } catch (e) {
    window.notify("Gagal memproses", "error");
  } finally {
    window.toggleLoading(false);
    const verifyModal = document.getElementById("modal-finance-verify");
    if (verifyModal) verifyModal.classList.add("hidden");
  }
};

window.handleUpdateProfile = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-save-profile");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Menyimpan...';

  try {
    let photoURL = window.STATE.user.photoURL || null;
    const fileInput = document.getElementById("set-photo");
    const oldPassword = document.getElementById("set-old-password").value;
    const newPassword = document.getElementById("set-new-password").value;

    // --- 1. PROSES UBAH PASSWORD (JIKA DIISI) ---
    if (newPassword && newPassword.trim().length >= 6) {
      if (!oldPassword) {
        throw new Error(
          "Anda WAJIB memasukkan PIN Lama untuk mengganti PIN Baru.",
        );
      }
      window.toggleLoading(true, "Memverifikasi PIN Lama...");
      try {
        // Re-otentikasi user dengan PIN Lama agar Firebase tidak meminta login ulang
        const credential = EmailAuthProvider.credential(
          window.STATE.user.email,
          oldPassword,
        );
        await reAuthenticateWithCredential(auth.currentUser, credential);

        window.toggleLoading(true, "Menerapkan PIN Baru...");
        await updatePassword(auth.currentUser, newPassword.trim());

        // Bersihkan form setelah sukses
        document.getElementById("set-old-password").value = "";
        document.getElementById("set-new-password").value = "";
      } catch (pwdError) {
        if (
          pwdError.code === "auth/invalid-credential" ||
          pwdError.code === "auth/wrong-password"
        ) {
          throw new Error("Gagal: PIN Lama yang Anda masukkan salah!");
        } else {
          throw new Error("Gagal mengubah PIN: " + pwdError.message);
        }
      }
    }

    // --- 2. PROSES UPLOAD FOTO CLOUDINARY (JIKA DIGANTI) ---
    if (fileInput.files.length > 0) {
      window.toggleLoading(true, "Mengunggah Foto Profil...");
      let file = await window.compressImage(fileInput.files[0], 0.5);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "Reuniakbar");

      const cloudRes = await fetch(
        "https://api.cloudinary.com/v1_1/dowih3wr7/image/upload",
        { method: "POST", body: formData },
      );
      const cloudData = await cloudRes.json();

      if (cloudData.secure_url) {
        if (window.STATE.user.photoURL) {
          await window.deleteCloudinaryFileByUrl(window.STATE.user.photoURL);
        }
        photoURL = cloudData.secure_url;
      } else {
        throw new Error("Gagal mengunggah foto.");
      }
    }

    window.toggleLoading(true, "Memperbarui Database Profil...");
    const newName = document.getElementById("set-name").value;

    // --- 3. SIMPAN NAMA & FOTO KE DATABASE FIRESTORE ---
    await db.collection("users").doc(window.STATE.user.uid).update({
      nama: newName,
      photoURL: photoURL,
    });

    // --- 4. UPDATE TAMPILAN SECARA REALTIME ---
    window.STATE.user.nama = newName;
    if (photoURL) window.STATE.user.photoURL = photoURL;

    const avatarEl = document.getElementById("user-avatar-header");
    if (avatarEl)
      avatarEl.src =
        photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=6366f1&color=fff`;

    const r = window.STATE.user.role;
    let roleName =
      r === "admin_utama" || r === "creator"
        ? "Admin"
        : r === "bendahara"
          ? "Bendahara"
          : r === "sekretaris"
            ? "Sekretaris"
            : r === "koordinator_wilayah"
              ? "Koordinator Wilayah"
              : r === "ketua"
                ? "Ketua"
                : "Viewer";
    document.getElementById("greeting").innerText =
      `Petugas: ${newName} | ${roleName}`;
    window.closeModal("modal-settings");
    window.notify("Perubahan profil berhasil disimpan!", "success");
  } catch (err) {
    window.notify(
      err.message || "Gagal menyimpan: Periksa koneksi Anda",
      "error",
    );
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
    window.toggleLoading(false);
  }
};

window.handleUpdateEventInfo = async (e) => {
  e.preventDefault();
  window.toggleLoading(true, "Menyimpan Info Acara...");
  const isTbd = document.getElementById("set-event-tbd").checked;
  const newDate = document.getElementById("set-event-date").value;
  const dFmt = isTbd
    ? "TBD"
    : newDate.length === 16
      ? newDate + ":00"
      : newDate;
  let apiAccess = ["admin_utama", "creator"];
  if (document.getElementById("api-access-bendahara").checked)
    apiAccess.push("bendahara");
  if (document.getElementById("api-access-sekretaris").checked)
    apiAccess.push("sekretaris");
  
  const waHumasVal = document.getElementById("set-event-wa-humas").value.trim().replace(/\D/g, "");
  const waDisabledVal = document.getElementById("set-event-wa-disabled").checked;
  
  try {
    await db
      .collection("settings")
      .doc("event_info")
      .set(
        {
          event_date: dFmt,
          event_time: document.getElementById("set-event-time").value,
          event_guest: document.getElementById("set-event-guest").value,
          wa_humas: waHumasVal,
          wa_disabled: waDisabledVal,
          api_access_roles: apiAccess,
        },
        { merge: true },
      );
    window.closeModal("modal-event-settings");
    window.notify("Info acara diperbarui!");
  } catch (e) {
    window.notify("Gagal", "error");
  } finally {
    window.toggleLoading(false);
  }
};

window.handleRundownSubmit = async (e) => {
  e.preventDefault();
  window.toggleLoading(true, "Menyimpan Rundown...");
  const data = Object.fromEntries(new FormData(e.target).entries());
  const id = data.id;
  delete data.id;
  try {
      if(id) await db.collection("rundown").doc(id).update(data); else await db.collection("rundown").add(data);
      window.notify('Rundown tersimpan', 'success'); window.closeModal('modal-rundown'); e.target.reset();
  } catch(e) { window.notify('Gagal menyimpan', 'error'); } finally { window.toggleLoading(false); }
};
window.openSettings = () => {
    if (window.STATE.user) {
      document.getElementById("set-name").value = window.STATE.user.nama || "";
      const avatarUrl =
        window.STATE.user.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(window.STATE.user.nama || "User")}&background=6366f1&color=fff`;
      document.getElementById("preview-profile-photo").src = avatarUrl;
    }
    window.showTab("settings");
    window.switchSettingsSubTab("profile");
    
    // Auto-expand the settings dropdown on logo
    const menu = document.getElementById("logo-dropdown-menu");
    if (menu) {
      menu.classList.remove("hidden");
    }
  };
  window.openModalIDCard = () => {
    document.getElementById("idcard-nama").value = "";
    document.getElementById("idcard-jabatan").value = "Ketua Panitia";
    document.getElementById("idcard-jabatan-custom").classList.add("hidden");
    window.openModal("modal-idcard");
  };

  // ==========================================
  // FORM ALUMNI TAB SWITCHER
  // ==========================================
  window.switchAlmTab = (tab) => {
    const infoTab = document.getElementById('alm-tab-info');
    const domTab = document.getElementById('alm-tab-domisili');
    const btnInfo = document.getElementById('alm-tab-btn-info');
    const btnDom = document.getElementById('alm-tab-btn-domisili');
    if (!infoTab || !domTab) return;
    if (tab === 'info') {
      infoTab.classList.remove('hidden');
      domTab.classList.add('hidden');
      btnInfo.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
      btnInfo.classList.remove('text-slate-400');
      btnDom.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
      btnDom.classList.add('text-slate-400');
    } else {
      infoTab.classList.add('hidden');
      domTab.classList.remove('hidden');
      btnDom.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
      btnDom.classList.remove('text-slate-400');
      btnInfo.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
      btnInfo.classList.add('text-slate-400');
    }
  };

  window.setAlumniFormField = (k, val) => {
    const el = document.getElementById("alm-" + k);
    if (!el) return;
    if (el.tagName === "SELECT") {
      const hasOption = Array.from(el.options).some(opt => opt.value === val);
      if (hasOption) {
        el.value = val;
      } else {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val;
        opt.selected = true;
        el.appendChild(opt);
      }
    } else {
      el.value = val;
    }
  };

  window.loadAlmProvinces = () => {
    const listProv = document.getElementById("alm-list-provinsi");
    if (!listProv) return Promise.resolve();
    return fetch(`${API_WILAYAH_BASE}/provinces.json`)
      .then((res) => res.json())
      .then((data) => {
        listProv.innerHTML = data
          .map((p) => `<option value="${p.name}" data-id="${p.id}"></option>`)
          .join("");
      })
      .catch((err) => console.error("Gagal memuat provinsi:", err));
  };

  window.loadAlmKabupaten = () => {
    const provVal = (document.getElementById("alm-provinsi").value || "").trim();
    const listProv = document.getElementById("alm-list-provinsi");
    const opt = listProv ? Array.from(listProv.options).find(o => o.value.toUpperCase() === provVal.toUpperCase()) : null;
    const provId = opt ? opt.getAttribute("data-id") : null;
    
    const listKab = document.getElementById("alm-list-kabupaten");
    const listKec = document.getElementById("alm-list-kecamatan");
    const listDesa = document.getElementById("alm-list-desa");
    
    const kabInp = document.getElementById("alm-kabupaten");
    const kecInp = document.getElementById("alm-kecamatan");
    const desaInp = document.getElementById("alm-desa");
    
    if (listKab) listKab.innerHTML = "";
    if (listKec) listKec.innerHTML = "";
    if (listDesa) listDesa.innerHTML = "";
    
    if (kabInp) { kabInp.value = ""; kabInp.placeholder = "Pilih Provinsi Dahulu"; }
    if (kecInp) { kecInp.value = ""; kecInp.placeholder = "Pilih Kabupaten Dahulu"; }
    if (desaInp) { desaInp.value = ""; desaInp.placeholder = "Pilih Kecamatan Dahulu"; }
    
    if (!provId) return Promise.resolve();
    if (kabInp) kabInp.placeholder = "Ketik / Cari Kabupaten/Kota...";

    // Show loading indicator
    const loadingEl = document.getElementById("alm-kabupaten-loading");
    if (loadingEl) loadingEl.classList.remove("hidden");

    return fetch(`${API_WILAYAH_BASE}/regencies/${provId}.json`)
      .then((res) => res.json())
      .then((data) => {
        if (listKab) {
          listKab.innerHTML = data
            .map((p) => `<option value="${p.name}" data-id="${p.id}"></option>`)
            .join("");
        }
      })
      .catch((err) => console.error("Gagal memuat kabupaten:", err))
      .finally(() => {
        if (loadingEl) loadingEl.classList.add("hidden");
      });
  };

  window.loadAlmKecamatan = () => {
    const kabVal = (document.getElementById("alm-kabupaten").value || "").trim();
    const listKab = document.getElementById("alm-list-kabupaten");
    const opt = listKab ? Array.from(listKab.options).find(o => o.value.toUpperCase() === kabVal.toUpperCase()) : null;
    const kabId = opt ? opt.getAttribute("data-id") : null;
    
    const listKec = document.getElementById("alm-list-kecamatan");
    const listDesa = document.getElementById("alm-list-desa");
    
    const kecInp = document.getElementById("alm-kecamatan");
    const desaInp = document.getElementById("alm-desa");
    
    if (listKec) listKec.innerHTML = "";
    if (listDesa) listDesa.innerHTML = "";
    
    if (kecInp) { kecInp.value = ""; kecInp.placeholder = "Pilih Kabupaten Dahulu"; }
    if (desaInp) { desaInp.value = ""; desaInp.placeholder = "Pilih Kecamatan Dahulu"; }
    
    if (!kabId) return Promise.resolve();
    if (kecInp) kecInp.placeholder = "Ketik / Cari Kecamatan...";

    // Show loading indicator
    const loadingEl = document.getElementById("alm-kecamatan-loading");
    if (loadingEl) loadingEl.classList.remove("hidden");

    return fetch(`${API_WILAYAH_BASE}/districts/${kabId}.json`)
      .then((res) => res.json())
      .then((data) => {
        if (listKec) {
          listKec.innerHTML = data
            .map((p) => `<option value="${p.name}" data-id="${p.id}"></option>`)
            .join("");
        }
      })
      .catch((err) => console.error("Gagal memuat kecamatan:", err))
      .finally(() => {
        if (loadingEl) loadingEl.classList.add("hidden");
      });
  };

  window.loadAlmDesa = () => {
    const kecVal = (document.getElementById("alm-kecamatan").value || "").trim();
    const listKec = document.getElementById("alm-list-kecamatan");
    const opt = listKec ? Array.from(listKec.options).find(o => o.value.toUpperCase() === kecVal.toUpperCase()) : null;
    const kecId = opt ? opt.getAttribute("data-id") : null;
    
    const listDesa = document.getElementById("alm-list-desa");
    const desaInp = document.getElementById("alm-desa");
    
    if (listDesa) listDesa.innerHTML = "";
    if (desaInp) { desaInp.value = ""; desaInp.placeholder = "Pilih Kecamatan Dahulu"; }
    
    if (!kecId) return Promise.resolve();
    if (desaInp) desaInp.placeholder = "Ketik / Cari Desa...";

    // Show loading indicator
    const loadingEl = document.getElementById("alm-desa-loading");
    if (loadingEl) loadingEl.classList.remove("hidden");

    return fetch(`${API_WILAYAH_BASE}/villages/${kecId}.json`)
      .then((res) => res.json())
      .then((data) => {
        if (listDesa) {
          listDesa.innerHTML = data
            .map((p) => `<option value="${p.name}" data-id="${p.id}"></option>`)
            .join("");
        }
      })
      .catch((err) => console.error("Gagal memuat desa:", err))
      .finally(() => {
        if (loadingEl) loadingEl.classList.add("hidden");
      });
  };

  window.openModalAlumni = (dataStr) => {
    const f = document.getElementById("form-alumni");
    f.reset();
    
    // Reset inputs and placeholders
    if (document.getElementById("alm-provinsi")) {
      document.getElementById("alm-provinsi").value = "";
      document.getElementById("alm-provinsi").placeholder = "Ketik / Cari Provinsi...";
    }
    if (document.getElementById("alm-kabupaten")) {
      document.getElementById("alm-kabupaten").value = "";
      document.getElementById("alm-kabupaten").placeholder = "Pilih Provinsi Dahulu";
    }
    if (document.getElementById("alm-kecamatan")) {
      document.getElementById("alm-kecamatan").value = "";
      document.getElementById("alm-kecamatan").placeholder = "Pilih Kabupaten Dahulu";
    }
    if (document.getElementById("alm-desa")) {
      document.getElementById("alm-desa").value = "";
      document.getElementById("alm-desa").placeholder = "Pilih Kecamatan Dahulu";
    }
    
    // Reset datalists
    if (document.getElementById("alm-list-provinsi")) document.getElementById("alm-list-provinsi").innerHTML = "";
    if (document.getElementById("alm-list-kabupaten")) document.getElementById("alm-list-kabupaten").innerHTML = "";
    if (document.getElementById("alm-list-kecamatan")) document.getElementById("alm-list-kecamatan").innerHTML = "";
    if (document.getElementById("alm-list-desa")) document.getElementById("alm-list-desa").innerHTML = "";
    
    // Selalu mulai dari tab Info Dasar
    window.switchAlmTab('info');

    // Reset any custom styles or readOnly statuses
    const inputsToReset = ["alm-kabupaten", "alm-kecamatan", "alm-desa"];
    inputsToReset.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.readOnly = false;
        el.style.opacity = "";
      }
    });

    window.loadAlmProvinces().then(async () => {
      if (dataStr) {
        const data = JSON.parse(decodeURIComponent(dataStr));
        document.getElementById("alm-id").value = data.id;
        document.getElementById("modal-alumni-title").innerText = "Edit Profil";
        [
          "nama",
          "angkatan",
          "lembaga",
          "nowa",
          "provinsi",
          "kabupaten",
          "kecamatan",
          "desa",
          "alamat",
        ].forEach((k) => {
          if (data[k]) {
            window.setAlumniFormField(k, data[k]);
          }
        });

        // Trigger cascade to load option lists for existing selections
        if (data.provinsi) {
          await window.loadAlmKabupaten();
          if (data.kabupaten) {
            const kabInp = document.getElementById("alm-kabupaten");
            if (kabInp) kabInp.value = data.kabupaten;
            
            await window.loadAlmKecamatan();
            if (data.kecamatan) {
              const kecInp = document.getElementById("alm-kecamatan");
              if (kecInp) kecInp.value = data.kecamatan;
              
              await window.loadAlmDesa();
              if (data.desa) {
                const desaInp = document.getElementById("alm-desa");
                if (desaInp) desaInp.value = data.desa;
              }
            }
          }
        }
      } else {
        document.getElementById("alm-id").value = "";
        document.getElementById("modal-alumni-title").innerText = "Tambah Alumni";
      }

      // Enforce regional scope for korwil roles after values are populated
      if (window.STATE.user) {
        const u = window.STATE.user;
        const role = u.role;
        const almKab = document.getElementById("alm-kabupaten");
        const almKec = document.getElementById("alm-kecamatan");
        const almDesa = document.getElementById("alm-desa");

        if (role === 'korwil_kabupaten') {
          if (almKab && u.wilayah_kabupaten) {
            almKab.value = u.wilayah_kabupaten;
            almKab.readOnly = true;
            almKab.style.opacity = "0.7";
          }
        } else if (role === 'korwil_kecamatan') {
          if (almKab && u.wilayah_kabupaten) {
            almKab.value = u.wilayah_kabupaten;
            almKab.readOnly = true;
            almKab.style.opacity = "0.7";
          }
          if (almKec && u.wilayah_kecamatan) {
            almKec.value = u.wilayah_kecamatan;
            almKec.readOnly = true;
            almKec.style.opacity = "0.7";
          }
        } else if (role === 'korwil_desa') {
          if (almKab && u.wilayah_kabupaten) {
            almKab.value = u.wilayah_kabupaten;
            almKab.readOnly = true;
            almKab.style.opacity = "0.7";
          }
          if (almKec && u.wilayah_kecamatan) {
            almKec.value = u.wilayah_kecamatan;
            almKec.readOnly = true;
            almKec.style.opacity = "0.7";
          }
          if (almDesa && u.wilayah_desa) {
            almDesa.value = u.wilayah_desa;
            almDesa.readOnly = true;
            almDesa.style.opacity = "0.7";
          }
        }
      }
    });

    window.openModal("modal-alumni");
  };

  window.openModalAddPanitia = () => {
    document.getElementById("panitia-id").value = "";
    document.getElementById("panitia-nama").value = "";
    document.getElementById("panitia-jabatan").value = "Ketua Panitia";
    document.getElementById("panitia-jabatan-custom").classList.add("hidden");
    document.getElementById("panitia-divisi").value = "";
    document.getElementById("modal-panitia-title").innerText = "Tambah Panitia";
    
    window.openModal("modal-panitia");
    
    // Resize & Reset TTD Canvas after modal is visible
    setTimeout(() => {
      if (typeof window.initTTDCanvas === "function") {
        window.initTTDCanvas();
      }
      if (typeof window.clearTTDCanvas === "function") {
        window.clearTTDCanvas();
      }
    }, 50);
  };
  
  window.openModalEditPanitia = (dataStr) => {
    const data = JSON.parse(decodeURIComponent(dataStr));
    document.getElementById("panitia-id").value = data.id;
    document.getElementById("panitia-nama").value = data.nama;
    document.getElementById("panitia-divisi").value = data.divisi || "";
    
    const selectJabatan = document.getElementById("panitia-jabatan");
    const customJabatan = document.getElementById("panitia-jabatan-custom");
    const existsInDropdown = Array.from(selectJabatan.options).some(
      (opt) => opt.value === data.jabatan,
    );
    if (existsInDropdown && data.jabatan !== "custom") {
      selectJabatan.value = data.jabatan;
      customJabatan.classList.add("hidden");
    } else {
      selectJabatan.value = "custom";
      customJabatan.classList.remove("hidden");
      customJabatan.value = data.jabatan;
    }
    
    document.getElementById("modal-panitia-title").innerText = "Edit Panitia";
    window.openModal("modal-panitia");
    
    // Resize, Reset & Load TTD Canvas after modal is visible
    setTimeout(() => {
      if (typeof window.initTTDCanvas === "function") {
        window.initTTDCanvas();
      }
      if (typeof window.clearTTDCanvas === "function") {
        window.clearTTDCanvas();
      }
      
      // Load existing TTD if exists
      if (data.tanda_tangan) {
        document.getElementById("panitia-ttd-base64").value = data.tanda_tangan;
        const previewImg = document.getElementById("ttd-preview-img");
        const previewContainer = document.getElementById("container-ttd-preview");
        if (previewImg && previewContainer) {
          previewImg.src = data.tanda_tangan;
          previewContainer.classList.remove("hidden");
        }
        
        // Render onto on-screen drawing canvas
        const canvas = document.getElementById("ttd-canvas");
        if (canvas) {
          const ctx = canvas.getContext("2d");
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Aspect-ratio fit render
            const ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            
            ctx.drawImage(img, x, y, w, h);
            
            // Convert charcoal black signature to bright indigo on-screen draw pad
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixelData = imgData.data;
            for (let i = 0; i < pixelData.length; i += 4) {
              const alpha = pixelData[i + 3];
              if (alpha > 10) {
                pixelData[i] = 129;   // R (#818cf8)
                pixelData[i + 1] = 140; // G
                pixelData[i + 2] = 248; // B
              }
            }
            ctx.putImageData(imgData, 0, 0);
            
            // Hide placeholder
            const placeholder = document.getElementById("ttd-canvas-placeholder");
            if (placeholder) placeholder.classList.add("hidden");
          };
          img.src = data.tanda_tangan;
        }
      }
    }, 50);
  };

  window.handlePanitiaSubmit = async (e) => {
    e.preventDefault();
    window.toggleLoading(true, "Menyimpan Panitia...");
    const id = document.getElementById("panitia-id").value;
    const nama = document.getElementById("panitia-nama").value.trim();
    
    let jabatan = document.getElementById("panitia-jabatan").value;
    if (jabatan === "custom") {
      jabatan = document.getElementById("panitia-jabatan-custom").value.trim();
    }
    
    if (!nama) {
      window.notify("Nama Lengkap wajib diisi", "error");
      window.toggleLoading(false);
      return;
    }
    if (!jabatan) {
      window.notify("Jabatan wajib diisi", "error");
      window.toggleLoading(false);
      return;
    }
    
    const divisi = document.getElementById("panitia-divisi").value.trim();
    const tanda_tangan = document.getElementById("panitia-ttd-base64").value || "";
    const data = { nama, jabatan, divisi, tanda_tangan };
    
    try {
      if (id) {
        await db.collection("panitia").doc(id).update(data);
        await window.logActivity("panitia_edit", `Memperbarui data panitia ${nama} sebagai ${jabatan}`);
        window.notify("Data panitia berhasil diperbarui", "success");
      } else {
        await db.collection("panitia").add(data);
        await window.logActivity("panitia_add", `Menambahkan panitia baru ${nama} sebagai ${jabatan}`);
        window.notify("Panitia baru berhasil ditambahkan", "success");
      }
      
      window.closeModal("modal-panitia");
    } catch(err) {
      console.error(err);
      window.notify("Gagal menyimpan panitia: " + err.message, "error");
    } finally {
      window.toggleLoading(false);
    }
  };

  window.openModalRundown = (dataStr) => {
    const form = document.getElementById("form-rundown");
    form.reset();
    if (dataStr) {
      const data = JSON.parse(decodeURIComponent(dataStr));
      document.getElementById("rnd-id").value = data.id || "";
      document.getElementById("rnd-waktu").value = data.waktu || "";
      document.getElementById("rnd-kegiatan").value = data.kegiatan || "";
      document.getElementById("rnd-keterangan").value = data.keterangan || "";
      document.getElementById("modal-rundown-title").innerText = "Edit Rundown";
    } else {
      document.getElementById("rnd-id").value = "";
      document.getElementById("modal-rundown-title").innerText =
        "Tambah Rundown";
    }
    window.openModal("modal-rundown");
  };

  window.openModalRAB = (dataStr) => {
    const form = document.getElementById("form-rab");
    form.reset();
    if (dataStr) {
      const data = JSON.parse(decodeURIComponent(dataStr));
      document.getElementById("rab-id").value = data.id;
      document.getElementById("rab-nama").value = data.nama_pembayar;
      document.getElementById("rab-nominal").value = data.nominal;
      document.getElementById("rab-status").value = data.status || "rab_belum";
      document.getElementById("modal-rab-title").innerText = "Edit Item RAB";
    } else {
      document.getElementById("rab-id").value = "";
      document.getElementById("rab-status").value = "rab_belum";
      document.getElementById("modal-rab-title").innerText = "Tambah Item RAB";
    }
    window.openModal("modal-rab");
  };

  window.openModalFinance = (almDataStr) => {
    const form = document.getElementById("form-finance");
    form.reset();
    document.getElementById("fin-id").value = "";
    document.getElementById("hidden-fin-ref-id").value = "";
    document.getElementById("modal-finance-title").innerText =
      "Input Transaksi Baru";
    document.getElementById("fin-file-help").classList.add("hidden");
    const stCont = document.getElementById("fin-status-container");
    const nomCont = document.getElementById("fin-nominal-container");
    const selectContainer = document.getElementById("fin-ref-container");
    const selectAlumni = document.getElementById("fin-ref-select");
    if (almDataStr) {
      const a = JSON.parse(decodeURIComponent(almDataStr));
      document.getElementById("hidden-fin-ref-id").value = a.id;
      selectContainer.classList.add("hidden");
      document.getElementById("fin-nama").value = "Donasi dari: " + a.nama;
      document.getElementById("fin-nama").readOnly = true;
      document
        .getElementById("fin-nama")
        .classList.add("opacity-70", "cursor-not-allowed");
      document.getElementById("fin-status").value = "pemasukan";
      document.getElementById("fin-kategori").value = "Donasi";
      stCont.classList.add("hidden");
      nomCont.classList.replace("col-span-1", "col-span-2");
    } else {
      document.getElementById("hidden-fin-ref-id").value = "";
      selectContainer.classList.remove("hidden");
      selectAlumni.value = "";
      document.getElementById("fin-nama").value = "";
      document.getElementById("fin-nama").readOnly = false;
      document
        .getElementById("fin-nama")
        .classList.remove("opacity-70", "cursor-not-allowed");
      document.getElementById("fin-status").value = "pemasukan";
      stCont.classList.remove("hidden");
      nomCont.classList.replace("col-span-2", "col-span-1");
    }
    window.openModal("modal-finance");
  };

  window.openModalFinanceEdit = (dataStr) => {
    const f = JSON.parse(decodeURIComponent(dataStr));
    const form = document.getElementById("form-finance");
    form.reset();
    document.getElementById("fin-status-container").classList.remove("hidden");
    document
      .getElementById("fin-nominal-container")
      .classList.replace("col-span-2", "col-span-1");
    document.getElementById("modal-finance-title").innerText = "Edit Transaksi";
    document.getElementById("fin-id").value = f.id;
    document.getElementById("hidden-fin-ref-id").value = f.ref_alumni_id || "";
    const selectContainer = document.getElementById("fin-ref-container");
    const selectAlumni = document.getElementById("fin-ref-select");
    selectAlumni.value = f.ref_alumni_id || "";
    if (f.ref_alumni_id) {
      selectContainer.classList.add("hidden");
      document.getElementById("fin-nama").readOnly = true;
      document
        .getElementById("fin-nama")
        .classList.add("opacity-70", "cursor-not-allowed");
    } else {
      selectContainer.classList.remove("hidden");
      document.getElementById("fin-nama").readOnly = false;
      document
        .getElementById("fin-nama")
        .classList.remove("opacity-70", "cursor-not-allowed");
    }
    document.getElementById("fin-nama").value = f.nama_pembayar || "";
    document.getElementById("fin-nominal").value = f.nominal || "";
    document.getElementById("fin-status").value = f.status || "pemasukan";
    document.getElementById("fin-kategori").value = f.kategori || "Donasi";
    document.getElementById("fin-file-help").classList.remove("hidden");
    window.openModal("modal-finance");
  };

  window.openModalHistory = (almId, almName) => {
    if (!almName && window.STATE && Array.isArray(window.STATE.rawAlumni)) {
      const alm = window.STATE.rawAlumni.find(x => x.id === almId);
      if (alm) almName = alm.nama;
    }
    document.getElementById("history-modal-title").innerText =
      `Riwayat: ${almName || ''}`;
    const hist = window.STATE.finance.filter(
      (f) => f.ref_alumni_id === almId && f.status === "pemasukan",
    );
    const tb = document.getElementById("history-list");
    const alm = window.STATE.rawAlumni.find(x => x.id === almId);
    const canFin =
      window.STATE.user.role === "admin_utama" ||
      window.STATE.user.role === "creator" ||
      window.STATE.user.role === "bendahara" ||
      (alm && window.canUserFinAlumnus(window.STATE.user, alm));
    if (hist.length === 0)
      tb.innerHTML = `<tr><td colspan="4" class="p-6 text-center italic text-slate-500">Belum ada riwayat.</td></tr>`;
    else
      tb.innerHTML = [...hist]
        .sort((a, b) => new Date(b.tanggal || 0) - new Date(a.tanggal || 0))
        .map(
          (h) => {
            const hasBukti = h.bukti_url ? `<button onclick="window.openImageModal('${h.bukti_url}')" class="w-7 h-7 bg-emerald-500/10 text-emerald-500 rounded hover:bg-emerald-500 hover:text-white mr-1" title="Lihat Bukti Transfer"><i class="fas fa-image text-[10px]"></i></button>` : '';
            const actionBtns = canFin ? `<button onclick="printReceipt('${encodeURIComponent(JSON.stringify(h)).replace(/'/g, "%27")}')" class="w-7 h-7 bg-indigo-500/10 text-indigo-500 rounded hover:bg-indigo-500 hover:text-white mr-1" title="Cetak Kuitansi"><i class="fas fa-receipt text-[10px]"></i></button><button onclick="openModalFinanceEdit('${encodeURIComponent(JSON.stringify(h)).replace(/'/g, "%27")}')" class="w-7 h-7 bg-amber-500/10 text-amber-500 rounded hover:bg-amber-500 hover:text-white" title="Ubah Transaksi"><i class="fas fa-edit text-[10px]"></i></button>` : '';
            const finalAction = hasBukti || actionBtns ? `${hasBukti}${actionBtns}` : '-';
            return `<tr class="hover:bg-black/5"><td class="p-4">${String(h.tanggal || "-").split(",")[0]}</td><td class="p-4 font-bold text-indigo-500">${h.kategori}</td><td class="p-4 text-right font-black text-emerald-500">${window.formatRupiah(h.nominal)}</td><td class="p-4 text-center">${finalAction}</td></tr>`;
          }
        )
        .join("");
    window.openModal("modal-history");
  };

  window.generateAIMessage = (nama, nowa) => {
    let n = String(nowa || "").replace(/\D/g, "");
    if (!n) return window.notify("Nomor tidak valid", "error");
    if (n.startsWith("0")) n = "62" + n.substring(1);
    document.getElementById("ai-message-box").value =
      `Assalamu'alaikum wr. wb.\n\nHalo *${nama}*, perkenalkan kami dari Panitia Reuni Akbar Pondok Pesantren AL-FATAH.\n\nSemoga Kakak senantiasa dalam keadaan sehat dan lancar rezekinya. Kami ingin mengundang Kakak untuk ikut berpartisipasi dan memeriahkan acara Reuni Akbar kita.\n\nBerapapun sumbangsih Kakak akan sangat berarti bagi kelancaran acara silaturahmi besar almamater tercinta kita.\n\nTerima kasih atas waktu dan perhatiannya. Wassalamu'alaikum wr. wb.`;
    document.getElementById("btn-copy-ai").onclick = () => {
      document.getElementById("ai-message-box").select();
      document.execCommand("copy");
      window.notify("Tersalin!");
    };
    document.getElementById("btn-send-wa-ai").onclick = () =>
      window.open(
        `https://wa.me/${n}?text=${encodeURIComponent(document.getElementById("ai-message-box").value)}`,
        "_blank",
      );
    window.openModal("modal-ai-message");
  };

  window.syncFinanceName = (select) => {
    if (select.value) {
      const name =
        select.options[select.selectedIndex].getAttribute("data-name");
      document.getElementById("fin-nama").value = "Donasi dari: " + name;
      document.getElementById("hidden-fin-ref-id").value = select.value;
    } else {
      document.getElementById("hidden-fin-ref-id").value = "";
    }
  };
  window.checkCustomJabatan = (el) => {
    const c = document.getElementById("idcard-jabatan-custom");
    if (el.value === "custom") {
      c.classList.remove("hidden");
      c.required = true;
    } else {
      c.classList.add("hidden");
      c.required = false;
    }
  };
  window.checkCustomJabatanPanitia = (el) => {
    const c = document.getElementById("panitia-jabatan-custom");
    if (el.value === "custom") {
      c.classList.remove("hidden");
      c.required = true;
    } else {
      c.classList.add("hidden");
      c.required = false;
    }
  };

  // ==========================================
  // FILTERING, SORTING, SEARCHING
  // ==========================================
  window.updateFilterOptions = () => {
    // Helper: ambil nilai unik setelah normalisasi, urutkan abjad
    const uniqueNormalized = (arr) => {
      const seen = new Map(); // normalized key -> canonical label
      arr.filter(Boolean).forEach((v) => {
        const normalized = window.normalizeWilayah(v);
        const key = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!seen.has(key)) seen.set(key, normalized);
      });
      return [...seen.values()].sort();
    };

    const pop = (id, list, p) => {
      const el = document.getElementById(id);
      if (el)
        el.innerHTML =
          `<option value="">${p}</option>` +
          list.map((v) => `<option value="${v}">${v}</option>`).join("");
    };
    pop(
      "filter-kab",
      uniqueNormalized(window.STATE.alumni.map((a) => a.kabupaten || "")),
      "Semua Kabupaten",
    );
    pop(
      "filter-kec",
      uniqueNormalized(window.STATE.alumni.map((a) => a.kecamatan || "")),
      "Semua Kecamatan",
    );
    pop(
      "filter-desa",
      uniqueNormalized(window.STATE.alumni.map((a) => a.desa || "")),
      "Semua Desa",
    );
  };

  window.applyWilayahFilter = (lvl) => {
    const kab = document.getElementById("filter-kab").value;
    const kec = document.getElementById("filter-kec").value;
    const des = document.getElementById("filter-desa").value;
    if (lvl === "kab") {
      document.getElementById("filter-kec").value = "";
      document.getElementById("filter-desa").value = "";
    } else if (lvl === "kec") {
      document.getElementById("filter-desa").value = "";
    }
    window.filteredRekapData = window.STATE.alumni.filter(
      (a) =>
        (!kab || window.isWilayahMatch(a.kabupaten, kab)) &&
        (!kec || window.isWilayahMatch(a.kecamatan, kec)) &&
        (!des || window.isWilayahMatch(a.desa, des)),
    );
    window.renderRekapWilayah();
  };

  let searchTimeout = null;
  window.searchAlumni = (val) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      window.applyAlumniFilters();
    }, 500);
  };

  window.sortAlumni = (key, keepDir = false) => {
    if (!keepDir) {
      if (window.sortConfig.alumni.key === key)
        window.sortConfig.alumni.dir =
          window.sortConfig.alumni.dir === "asc" ? "desc" : "asc";
      else {
        window.sortConfig.alumni.key = key;
        window.sortConfig.alumni.dir = "asc";
      }
    }
    const searchInput = document.getElementById("search-alumni-input");
    const searchVal = (searchInput?.value || "").toLowerCase().trim();
    const dir = window.sortConfig.alumni.dir === "asc" ? -1 : 1;
    window.filteredAlumniData.sort((a, b) => {
      if (searchVal) {
        const scoreA = a.searchScore || 0;
        const scoreB = b.searchScore || 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA; // Urutkan berdasarkan relevansi skor tertinggi terlebih dahulu
        }
      }
      let va = a[key],
        vb = b[key];
      if (["angkatan", "totalDonasi"].includes(key)) {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = String(va || "").toLowerCase();
        vb = String(vb || "").toLowerCase();
      }
      if (va < vb) return dir;
      if (va > vb) return -dir;
      return 0;
    });
    document
      .querySelectorAll(`[id^="sort-alm-"]`)
      .forEach((i) => (i.className = "fas fa-sort sort-icon ml-1"));
    const ic = document.getElementById(`sort-alm-${key}`);
    if (ic)
      ic.className = `fas fa-sort-${window.sortConfig.alumni.dir === "asc" ? "up" : "down"} sort-icon active ml-1`;
    window.renderAlumniTable();
  };

  window.applyFinanceFilter = () => {
    const type = document.getElementById("fin-type-filter")
      ? document.getElementById("fin-type-filter").value
      : "all";
    window.currentFinanceData = window.STATE.finance;
    if (type !== "all")
      window.currentFinanceData = window.currentFinanceData.filter(
        (f) => f.status === type,
      );
    window.sortFinance(window.sortConfig.finance.key, true);
  };

  window.sortFinance = (key, keepDir = false) => {
    if (!keepDir) {
      if (window.sortConfig.finance.key === key)
        window.sortConfig.finance.dir =
          window.sortConfig.finance.dir === "asc" ? "desc" : "asc";
      else {
        window.sortConfig.finance.key = key;
        window.sortConfig.finance.dir = "asc";
      }
    }
    const dir = window.sortConfig.finance.dir === "asc" ? -1 : 1;
    window.currentFinanceData.sort((a, b) => {
      let va = a[key],
        vb = b[key];
      if (key === "nominal") {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else if (key === "tanggal") {
        va = new Date(va || 0).getTime();
        vb = new Date(vb || 0).getTime();
      } else {
        va = String(va || "").toLowerCase();
        vb = String(vb || "").toLowerCase();
      }
      if (va < vb) return dir;
      if (va > vb) return -dir;
      return 0;
    });
    document
      .querySelectorAll(`[id^="sort-fin-"]`)
      .forEach((i) => (i.className = "fas fa-sort sort-icon ml-1"));
    const ic = document.getElementById(`sort-fin-${key}`);
    if (ic)
      ic.className = `fas fa-sort-${window.sortConfig.finance.dir === "asc" ? "up" : "down"} sort-icon active ml-1`;
    window.renderFinanceTable();
  };

  // ==========================================
  // CETAK & EXPORT (PDF/CSV)
  // ==========================================

  window.handlePrintIDCardPanitia = (e) => {
    e.preventDefault();
    let j = document.getElementById("idcard-jabatan").value;
    if (j === "custom")
      j = document.getElementById("idcard-jabatan-custom").value;
    window.printIDCard(
      encodeURIComponent(
        JSON.stringify({
          nama: document.getElementById("idcard-nama").value,
          jabatan: j,
        }),
      ),
    );
    window.closeModal("modal-idcard");
  };

  window.exportAlumniCSV = () => {
    const tabRekap = document.getElementById("tab-rekap");
    const isRekapTab = tabRekap && !tabRekap.classList.contains("hidden");
    const dataToExport = isRekapTab ? (window.filteredRekapData || []) : window.STATE.alumni;

     let csv = "Nama,Angkatan,Lembaga,WA,Kabupaten,Kecamatan,Desa,Alamat\n";
     dataToExport.forEach(
       (r) =>
         (csv += `"${r.nama}","${r.angkatan}","${r.lembaga || "-"}","${r.nowa}","${r.kabupaten}","${r.kecamatan}","${r.desa}","${r.alamat}"\n`),
     );
    let dl = document.createElement("a");
    dl.download = isRekapTab ? "Alumni_Wilayah.csv" : "Alumni.csv";
    dl.href = window.URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    dl.click();
    window.closeModal("modal-export");
  };
  // ==========================================
  // SEARCH KEUANGAN & RAB
  // ==========================================
  window.searchFinance = (q) => {
    const query = (q || "").toLowerCase().trim();
    const rows = document.querySelectorAll("#finance-list tr");
    let found = 0;
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      const visible = !query || text.includes(query);
      row.style.display = visible ? "" : "none";
      if (visible) found++;
    });
    const info = document.getElementById("page-info-fin");
    if (info && query) info.innerText = `Hasil pencarian: ${found} transaksi`;
    else if (info) info.innerText = `Halaman ${window.currentFinancePage || 1}`;
  };

  window.searchRAB = (q) => {
    const query = (q || "").toLowerCase().trim();
    const rows = document.querySelectorAll("#rab-list tr");
    let found = 0;
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      const visible = !query || text.includes(query);
      row.style.display = visible ? "" : "none";
      if (visible) found++;
    });
    const info = document.getElementById("page-info-rab");
    if (info && query) info.innerText = `Hasil pencarian: ${found} item`;
    else if (info) info.innerText = `Halaman ${window.currentRABPage || 1}`;
  };

  // ==========================================
  // AUTO-FORMAT NOMINAL (Rupiah) SAAT INPUT
  // ==========================================
  const nominalFields = ["fin-nominal", "rab-nominal"];
  nominalFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", function () {
      // Simpan posisi kursor
      const raw = this.value.replace(/\D/g, "");
      this.value = raw; // Simpan value bersih untuk validasi
      // Tampilkan hint format di placeholder area
      if (raw) {
        const formatted = Number(raw).toLocaleString("id-ID");
        this.setAttribute("data-formatted", "Rp " + formatted);
        this.title = "Rp " + formatted;
      } else {
        this.removeAttribute("data-formatted");
        this.title = "";
      }
    });
    // Tampilkan preview format di samping field
    el.addEventListener("blur", function () {
      const raw = Number(this.value.replace(/\D/g, ""));
      if (raw > 0) {
        const hint = this.parentElement.querySelector(".rupiah-hint");
        if (hint) hint.innerText = "= Rp " + raw.toLocaleString("id-ID");
      }
    });
    // Buat elemen hint rupiah
    const hint = document.createElement("div");
    hint.className = "rupiah-hint text-[10px] text-indigo-400 font-bold mt-1 ml-1";
    if (el.parentElement) el.parentElement.appendChild(hint);
  });

  // ==========================================
  // INDIKATOR KONEKSI OFFLINE
  // ==========================================
  const offlineBanner = document.getElementById("offline-banner");
  const showOffline = () => {
    if (offlineBanner) {
      offlineBanner.classList.remove("hidden");
      document.body.style.paddingTop = "36px";
    }
  };
  const showOnline = () => {
    if (offlineBanner) {
      offlineBanner.classList.add("hidden");
      document.body.style.paddingTop = "";
      window.notify("Koneksi internet kembali tersambung!", "success");
    }
  };
  window.addEventListener("offline", showOffline);
  window.addEventListener("online", showOnline);
  // Cek saat pertama kali load
  if (!navigator.onLine) showOffline();

  // ==========================================
  // AI, UPLOAD, SCANNERS, & LOGIKA LAINNYA
  // ==========================================

  window.resetIdleTimer = () => {
    idleTime = 0;
  };
  window.addEventListener("load", () => {
    const mf = new Blob(
      [
        JSON.stringify({
          name: "Portal Panitia Reuni",
          short_name: "Reuni Al-Fatah",
          start_url: ".",
          display: "standalone",
          background_color: "#060813",
          theme_color: "#6366f1",
          icons: [
            {
              src: "https://cdn-icons-png.flaticon.com/512/1903/1903162.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        }),
      ],
      { type: "application/json" },
    );
    const manifestEl = document.getElementById("manifest-link");
    if (manifestEl) manifestEl.href = URL.createObjectURL(mf);
    ["mousemove", "keypress", "touchstart", "click", "scroll"].forEach((e) =>
      document.body.addEventListener(e, window.resetIdleTimer),
    );
    setInterval(() => {
      if (window.STATE.user) {
        idleTime++;
        if (idleTime >= IDLE_TIMEOUT_MINUTES) {
          window.notify("Sesi berakhir", "error");
          window.confirmLogout();
        }
      }
    }, 60000);
  });

  window.parseIndonesianSpokenNumber = (txt) => {
    if (!txt) return null;
    
    // Pre-processing
    let normalized = txt.toLowerCase().trim();
    
    // Insert spaces between digits and letters (e.g., "50ribu" -> "50 ribu", "rp50" -> "rp 50")
    normalized = normalized
      .replace(/(\d+)([a-zA-Z]+)/g, "$1 $2")
      .replace(/([a-zA-Z]+)(\d+)/g, "$1 $2");
      
    // Split into tokens
    const tokens = normalized.split(/\s+/);
    
    const numberKeywords = [
      "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", 
      "sepuluh", "sebelas", "belas", "puluh", "ratus", "ribu", "juta", "rupiah", 
      "seratus", "seribu", "sejuta", "setengah", "rp", "rp."
    ];
    
    // Classify each token as numeric or descriptive
    const tokenClassifications = tokens.map(t => {
      const clean = t.replace(/[^a-z0-9]/g, "");
      const isKeyword = numberKeywords.includes(clean);
      const isDigit = /^\d+([.,]\d+)*$/.test(t);
      return {
        original: t,
        clean: clean,
        isNumeric: isKeyword || isDigit
      };
    });
    
    // Group contiguous numeric tokens into phrases
    let numericPhrases = [];
    let currentPhrase = [];
    
    tokenClassifications.forEach((tc, idx) => {
      if (tc.isNumeric) {
        currentPhrase.push(tc);
      } else {
        if (currentPhrase.length > 0) {
          numericPhrases.push({
            tokens: currentPhrase,
            startIndex: idx - currentPhrase.length,
            endIndex: idx - 1
          });
          currentPhrase = [];
        }
      }
    });
    if (currentPhrase.length > 0) {
      numericPhrases.push({
        tokens: currentPhrase,
        startIndex: tokenClassifications.length - currentPhrase.length,
        endIndex: tokenClassifications.length - 1
      });
    }
    
    if (numericPhrases.length === 0) return null;
    
    // Parse the numeric value of each phrase
    numericPhrases.forEach(phrase => {
      // Token expansion
      let expandedTokens = [];
      phrase.tokens.forEach(tc => {
        const w = tc.clean;
        if (w === "seratus") {
          expandedTokens.push("satu", "ratus");
        } else if (w === "seribu") {
          expandedTokens.push("satu", "ribu");
        } else if (w === "sejuta") {
          expandedTokens.push("satu", "juta");
        } else if (w === "sepuluh") {
          expandedTokens.push("satu", "puluh");
        } else if (w === "rp" || w === "rupiah") {
          // ignore currency symbol in calculations
        } else {
          expandedTokens.push(tc.original); // keep original to preserve digits with dots/commas
        }
      });
      
      let totalValue = 0;
      let currentGroup = 0;
      let tempValue = 0;
      
      for (let i = 0; i < expandedTokens.length; i++) {
        const w = expandedTokens[i].toLowerCase().replace(/[^a-z0-9.,]/g, "");
        if (w === "juta") {
          currentGroup += tempValue;
          totalValue += (currentGroup || 1) * 1000000;
          currentGroup = 0;
          tempValue = 0;
        } else if (w === "ribu") {
          currentGroup += tempValue;
          totalValue += (currentGroup || 1) * 1000;
          currentGroup = 0;
          tempValue = 0;
        } else if (w === "ratus") {
          tempValue = (tempValue || 1) * 100;
          currentGroup += tempValue;
          tempValue = 0;
        } else if (w === "puluh") {
          tempValue = (tempValue || 1) * 10;
          currentGroup += tempValue;
          tempValue = 0;
        } else if (w === "belas") {
          tempValue = (tempValue || 1) + 10;
          currentGroup += tempValue;
          tempValue = 0;
        } else {
          let val = 0;
          if (w === "satu") val = 1;
          else if (w === "dua") val = 2;
          else if (w === "tiga") val = 3;
          else if (w === "empat") val = 4;
          else if (w === "lima") val = 5;
          else if (w === "enam") val = 6;
          else if (w === "tujuh") val = 7;
          else if (w === "delapan") val = 8;
          else if (w === "sembilan") val = 9;
          else if (w === "sebelas") val = 11;
          else if (w === "setengah") val = 0.5;
          else if (/^\d+([.,]\d+)*$/.test(w)) {
            const next = expandedTokens[i + 1] ? expandedTokens[i + 1].toLowerCase().replace(/[^a-z]/g, "") : "";
            if (next === "juta" || next === "ribu") {
              val = parseFloat(w.replace(/,/g, "."));
            } else {
              val = parseInt(w.replace(/\D/g, ""));
            }
          }
          tempValue += val;
        }
      }
      currentGroup += tempValue;
      totalValue += currentGroup;
      
      phrase.value = totalValue;
    });
    
    // Choose the best numeric phrase:
    // 1. Prefer phrases with value >= 100
    // 2. If multiple, prefer the one near the end of the text
    // 3. Otherwise, pick the largest value
    let bestPhrase = null;
    let candidates = numericPhrases.filter(p => p.value >= 100);
    if (candidates.length > 0) {
      // Sort by proximity to the end, then by value
      candidates.sort((a, b) => {
        if (b.endIndex !== a.endIndex) {
          return b.endIndex - a.endIndex; // closer to the end first
        }
        return b.value - a.value; // larger value first
      });
      bestPhrase = candidates[0];
    } else {
      // Fallback to any phrase
      numericPhrases.sort((a, b) => b.value - a.value);
      bestPhrase = numericPhrases[0];
    }
    
    if (!bestPhrase || bestPhrase.value <= 0) return null;
    
    // Reconstruct the description by removing the best phrase
    const startIdx = bestPhrase.startIndex;
    const endIdx = bestPhrase.endIndex;
    
    const descTokens = tokens.filter((_, idx) => idx < startIdx || idx > endIdx);
    
    // Clean description from unwanted words
    let desc = descTokens.join(" ");
    desc = desc
      .replace(/catat|tulis|pengeluaran|pemasukan|donasi/g, "")
      .replace(/\s+/g, " ")
      .trim();
      
    return {
      nominal: bestPhrase.value,
      description: desc
    };
  };

  window.startVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window))
      return window.notify(
        "Browser tidak mendukung Voice API. Gunakan Chrome!",
        "error",
      );
    const btn = document.getElementById("btn-voice");
    const stat = document.getElementById("voice-status");
    const rec = new webkitSpeechRecognition();
    rec.lang = "id-ID";
    rec.interimResults = false;
    rec.onstart = () => {
      btn.classList.replace("bg-indigo-600", "bg-red-500");
      btn.classList.add("animate-pulse");
      stat.classList.remove("hidden");
    };
    rec.onresult = (e) => {
      const txt = e.results[0][0].transcript.toLowerCase();
      const parsed = window.parseIndonesianSpokenNumber(txt);
      
      if (parsed) {
        document.getElementById("fin-nominal").value = parsed.nominal;
        document.getElementById("fin-nominal").dispatchEvent(new Event("input"));
        
        let desc = parsed.description;
        document.getElementById("fin-nama").value =
          desc.charAt(0).toUpperCase() + desc.slice(1);
          
        if (
          txt.includes("keluar") ||
          txt.includes("beli") ||
          txt.includes("bayar") ||
          txt.includes("belanja")
        ) {
          document.getElementById("fin-status").value = "pengeluaran";
        } else if (
          txt.includes("donasi") ||
          txt.includes("terima") ||
          txt.includes("masuk") ||
          txt.includes("iuran")
        ) {
          document.getElementById("fin-status").value = "pemasukan";
        }
        window.notify("Suara & Nominal berhasil dibaca!", "success");
      } else {
        document.getElementById("fin-nama").value =
          txt.charAt(0).toUpperCase() + txt.slice(1);
        window.notify("Teks dibaca, nominal tidak ditemukan", "info");
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed")
        window.notify("Akses Mic diblokir", "error");
      else window.notify("Gagal mendengar: " + event.error, "error");
    };
    rec.onend = () => {
      btn.classList.replace("bg-red-500", "bg-indigo-600");
      btn.classList.remove("animate-pulse");
      stat.classList.add("hidden");
    };
    rec.start();
  };

  window.startVoiceTanyaAI = () => {
    if (!("webkitSpeechRecognition" in window))
      return window.notify(
        "Browser tidak mendukung Voice API. Gunakan Chrome!",
        "error",
      );
    const btn = document.getElementById("btn-voice-tanya-ai");
    const input = document.getElementById("tanya-ai-input");
    const rec = new webkitSpeechRecognition();
    rec.lang = "id-ID";
    rec.interimResults = false;
    rec.onstart = () => {
      btn.classList.replace("text-slate-300", "text-red-500");
      btn.classList.add("animate-pulse");
      window.notify("Asisten sedang mendengarkan...", "info");
    };
    rec.onresult = (e) => {
      const txt = e.results[0][0].transcript;
      if (input) {
        input.value = txt;
        window.notify("Suara berhasil direkam!", "success");
        // Automatically submit after a brief delay
        setTimeout(() => {
          window.handleTanyaAISubmit();
        }, 500);
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed")
        window.notify("Akses Mic diblokir", "error");
      else window.notify("Gagal mendengar: " + event.error, "error");
    };
    rec.onend = () => {
      btn.classList.replace("text-red-500", "text-slate-300");
      btn.classList.remove("animate-pulse");
    };
    rec.start();
  };
  window.levenshtein = (a, b) => {
    if (!a || !b) return (a || b).length;
    let m = [];
    for (let i = 0; i <= b.length; i++) {
      m[i] = [i];
      if (i === 0) continue;
      for (let j = 1; j <= a.length; j++) {
        m[0][j] = j;
        let c = a[j - 1] === b[i - 1] ? 0 : 1;
        m[i][j] = Math.min(
          m[i - 1][j - 1] + c,
          m[i][j - 1] + 1,
          m[i - 1][j] + 1,
        );
      }
    }
    return m[b.length][a.length];
  };
  window.checkDuplicateName = (val) => {
    const warn = document.getElementById("alm-duplicate-warning");
    if (!val || val.length < 4) {
      warn.classList.add("hidden");
      return;
    }
    const v = val.toLowerCase().trim();
    const found = window.STATE.alumni.find((a) => {
      const n = String(a.nama || "")
        .toLowerCase()
        .trim();
      if (n === v) return true;
      const vWords = v.split(" ").sort().join(" ");
      const nWords = n.split(" ").sort().join(" ");
      if (vWords === nWords && vWords.length > 4) return true;
      if (Math.abs(n.length - v.length) < 3) {
        if (window.levenshtein(n, v) <= 2 && n.length > 4) return true;
      }
      return false;
    });
    if (found) {
      const lembagaStr = found.lembaga ? ` (${found.lembaga})` : '';
      warn.innerHTML = `<i class="fas fa-exclamation-triangle mr-1"></i> Perhatian: Data mirip ditemukan <b>[${found.nama}${lembagaStr} - Angkatan ${found.angkatan}]</b>.`;
      warn.classList.remove("hidden");
    } else {
      warn.classList.add("hidden");
    }
  };
  // ==========================================
  // FUNGSI DOWNLOAD TEMPLATE IMPORT
  // ==========================================
  window.downloadImportTemplate = async () => {
    if (typeof XLSX === "undefined") {
      return window.notify("Library XLSX belum dimuat, coba refresh halaman.", "error");
    }

    const templateData = [
      ["Nama Lengkap", "Angkatan", "No. WA", "Kabupaten", "Kecamatan", "Desa", "Alamat"],
      ["Ahmad Fauzi", "2005", "081234567890", "Tasikmalaya", "Ciawi", "Sukamaju", "Jl. Raya No. 1"],
      ["Siti Aisyah", "2007", "082345678901", "Garut", "Tarogong", "Jayaraga", "Kp. Bojong Rt 01"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 25 }, { wch: 10 }, { wch: 16 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Alumni");

    await window.saveExcelFile(wb, "Template_Import_Alumni_AlFatah.xlsx");
  };

  // ==========================================
  // FUNGSI IMPORT CSV (DENGAN AUTO-CEK DUPLIKAT MODAL)
  // ==========================================
  window.handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          .map(row => row.map(cell => String(cell || "").trim()))
          .filter(row => row.join("") !== "");

        if (rows.length < 1) {
            e.target.value = "";
            return window.notify("File kosong", "error");
        }

        let hdrs = rows[0].map((h) => h.toLowerCase());
        let hIdx = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          let t = rows[i].map((x) => x.toLowerCase());
          if (t.some((x) => x.includes("nama"))) {
            hdrs = t;
            hIdx = i;
            break;
          }
        }

        let nameCols = [];
        for (let i = 0; i < hdrs.length; i++) {
          if (hdrs[i].includes("nama") && !hdrs[i].includes("kab"))
            nameCols.push(i);
        }

        let groupMappings = [];
        for (let idx of nameCols) {
          let mapping = {
            nm: idx,
            an: -1,
            lb: -1,
            wa: -1,
            al: -1,
            ds: -1,
            kc: -1,
            kb: -1,
            fixedAngkatan: "",
          };
          for (let j = idx; j >= 0; j--) {
            if (hdrs[j].includes("angkat")) {
              let match = hdrs[j].match(/\d+/);
              if (match) mapping.fixedAngkatan = match[0];
              else mapping.an = j;
              break;
            }
          }
          for (let j = idx + 1; j < hdrs.length; j++) {
            if (hdrs[j].includes("nama") && !hdrs[j].includes("kab")) break;
            if (hdrs[j].includes("angkat")) {
              if (mapping.an === -1 && !mapping.fixedAngkatan) mapping.an = j;
              continue;
            }
            let h = hdrs[j];
            if (
              h.includes("wa") ||
              h.includes("whatsapp") ||
              h.includes("telp") ||
              h.includes("hp")
            )
              mapping.wa = j;
            else if (h.includes("alamat")) mapping.al = j;
            else if (
              (h.includes("desa") || h.includes("kel")) &&
              !h.includes("kelamin")
            )
              mapping.ds = j;
            else if (h.includes("kec")) mapping.kc = j;
            else if (h.includes("kab")) mapping.kb = j;
            else if (h.includes("lembaga") || h.includes("ma/mts") || h.includes("sekolah"))
              mapping.lb = j;
          }
          groupMappings.push(mapping);
        }

        const checkCSVRowDuplicateState = (rowObj) => {
          const cleanCsvName = window.cleanAlumniName(rowObj.nama);
          if (!cleanCsvName) return "import";

          const existingList = window.STATE.rawAlumni.filter(a => 
            window.cleanAlumniName(a.nama) === cleanCsvName
          );

          if (existingList.length === 0) {
            return "import";
          }

          let hasDuplicate = false;
          let csvHasMore = false;
          let isIdentical = false;

          for (const existing of existingList) {
            const cleanNameWords = cleanCsvName.split(" ").filter(Boolean).length;
            const sameAngkatan = String(window.normalizeAngkatanYear(existing.angkatan, existing.lembaga) || "").trim() === String(rowObj.angkatan).trim();
            const sameWA = rowObj.nowa && existing.nowa && window.normalizeAlumniWA(rowObj.nowa) === window.normalizeAlumniWA(existing.nowa);
            
            // Tandai sebagai duplikat jika:
            // - Angkatan sama
            // - ATAU WhatsApp sama
            // - ATAU Nama memiliki 2+ kata / panjang >= 12 (nama unik terdeteksi ganda meskipun beda angkatan)
            const isDup = sameAngkatan || sameWA || (cleanNameWords >= 2 || cleanCsvName.length >= 12);
            
            if (isDup) {
              hasDuplicate = true;
              
              const fields = ["lembaga", "nowa", "alamat", "desa", "kecamatan", "kabupaten"];
              let currentCsvHasMore = false;
              let currentIsIdentical = sameAngkatan; // Dianggap identik jika angkatannya juga sama persis
              
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

          if (!hasDuplicate) {
            return "import";
          }
          
          if (isIdentical) {
            return "skip";
          }
          
          if (csvHasMore) {
            return "import_duplicate"; // Lebih lengkap, impor untuk dicheck manual
          }
          
          return "skip"; // Database sudah lebih lengkap/setara
        };

        let dataUpload = [];
        let skippedCount = 0;
        let duplicateCount = 0;

        for (let r = hIdx + 1; r < rows.length; r++) {
          for (let m of groupMappings) {
            let namaVal = rows[r][m.nm];
            if (namaVal && namaVal.trim()) {
              let namaClean = namaVal.trim();
              let rawAngkatan = m.fixedAngkatan
                ? m.fixedAngkatan
                : m.an !== -1
                  ? (rows[r][m.an] || "").trim()
                  : "";
              let rawLembaga = m.lb !== -1 ? (rows[r][m.lb] || "").trim() : "";
              
              // Normalisasi Angkatan
              let angkatanClean = window.normalizeAngkatanYear(rawAngkatan, rawLembaga);

              const rowObj = {
                nama: window.capitalizeName(namaClean),
                angkatan: angkatanClean,
                lembaga: rawLembaga,
                nowa: m.wa !== -1 ? window.normalizePhoneNumber(rows[r][m.wa] || "") : "",
                alamat: m.al !== -1 ? (rows[r][m.al] || "").trim() : "",
                desa: m.ds !== -1 ? window.normalizeWilayahName(rows[r][m.ds] || "") : "",
                kecamatan: m.kc !== -1 ? window.normalizeWilayahName(rows[r][m.kc] || "") : "",
                kabupaten: m.kb !== -1 ? window.normalizeWilayahName(rows[r][m.kb] || "") : "",
              };

              const dupState = checkCSVRowDuplicateState(rowObj);
              if (dupState === "skip") {
                skippedCount++;
                continue;
              } else if (dupState === "import_duplicate") {
                duplicateCount++;
              }

              dataUpload.push(rowObj);
            }
          }
        }

        if (dataUpload.length === 0) {
          e.target.value = "";
          if (skippedCount > 0)
            return window.notify(
              `Gagal. ${skippedCount} data di file tersebut sudah ada persis di database!`,
              "error",
            );
          return window.notify("Gagal membaca data atau data kosong.", "error");
        }

        // Simpan data ke temporary state untuk konfirmasi user
        window.STATE.tempImportData = { dataUpload, skippedCount, duplicateCount };

        // Tampilkan info pemetaan kolom di UI
        const mapInfoEl = document.getElementById("import-mapping-info");
        if (mapInfoEl && groupMappings.length > 0) {
          const m = groupMappings[0];
          const getColName = (idx) => idx !== -1 ? (hdrs[idx] || `Kolom ${idx + 1}`) : "<span class='text-red-400'>Tidak Terdeteksi</span>";
          mapInfoEl.innerHTML = `
            <div><span class='text-slate-500 font-bold'>Nama:</span> <b>${getColName(m.nm)}</b></div>
            <div><span class='text-slate-500 font-bold'>Angkatan:</span> <b>${m.fixedAngkatan ? `Statis (${m.fixedAngkatan})` : getColName(m.an)}</b></div>
            <div><span class='text-slate-500 font-bold'>Lembaga:</span> <b>${getColName(m.lb)}</b></div>
            <div><span class='text-slate-500 font-bold'>WhatsApp:</span> <b>${getColName(m.wa)}</b></div>
            <div><span class='text-slate-500 font-bold'>Kabupaten:</span> <b>${getColName(m.kb)}</b></div>
            <div><span class='text-slate-500 font-bold'>Alamat:</span> <b>${getColName(m.al)}</b></div>
          `;
        }

        // Tampilkan statistik
        document.getElementById("import-stat-new").textContent = dataUpload.length - duplicateCount;
        document.getElementById("import-stat-dupes").textContent = duplicateCount;
        document.getElementById("import-stat-skipped").textContent = skippedCount;

        // Render preview 5 baris pertama
        const previewListEl = document.getElementById("import-preview-list");
        if (previewListEl) {
          const previewRows = dataUpload.slice(0, 5);
          previewListEl.innerHTML = previewRows.map(row => `
            <tr class="hover:bg-black/5">
              <td class="p-3 font-bold">${row.nama}</td>
              <td class="p-3 text-center">
                <span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase text-[9px] font-black">${row.lembaga || '-'}</span><br>
                <span class="text-slate-400 font-bold">${row.angkatan || '-'}</span>
              </td>
              <td class="p-3">${row.nowa || '<span class="text-slate-600">-</span>'}</td>
              <td class="p-3 text-slate-400 text-[11px] truncate max-w-[150px]" title="${row.alamat || ''}">
                ${row.alamat || row.desa || row.kecamatan || row.kabupaten || '-'}
              </td>
            </tr>
          `).join("");
        }

        // Buka modal pratinjau impor
        window.openModal("modal-import-preview");
        e.target.value = "";
      } catch (err) {
        console.error("Parse Error:", err);
        window.notify("Format file tidak didukung atau rusak.", "error");
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Fungsi konfirmasi impor yang dipicu dari modal
  window.confirmCSVUpload = async (autoMerge = false) => {
    if (!window.STATE.tempImportData || !window.STATE.tempImportData.dataUpload) return;
    const { dataUpload, skippedCount, duplicateCount } = window.STATE.tempImportData;
    
    window.closeModal("modal-import-preview");
    window.toggleLoading(true, `Mengimpor ${dataUpload.length} Data...`);
    
    try {
      const chunkSize = 400; 
      for (let i = 0; i < dataUpload.length; i += chunkSize) {
        const chunk = dataUpload.slice(i, i + chunkSize);
        const batch = db.batch();
        chunk.forEach((d) => {
          d.created_at = new Date().toISOString();
          d.status = "approved";
          // === PROTEKSI WILAYAH: ENFORCE WILAYAH KOORDINATOR SAAT IMPORT ===
          if (window.STATE.user) {
            const u = window.STATE.user;
            const role = u.role;
            if (role === 'korwil_kabupaten') {
              d.kabupaten = u.wilayah_kabupaten || d.kabupaten;
            } else if (role === 'korwil_kecamatan') {
              d.kabupaten = u.wilayah_kabupaten || d.kabupaten;
              d.kecamatan = u.wilayah_kecamatan || d.kecamatan;
            } else if (role === 'korwil_desa') {
              d.kabupaten = u.wilayah_kabupaten || d.kabupaten;
              d.kecamatan = u.wilayah_kecamatan || d.kecamatan;
              d.desa = u.wilayah_desa || d.desa;
            }
          }
          const docRef = db.collection("alumni").doc();
          d.id = docRef.id;
          batch.set(docRef, d);
        });
        await batch.commit();

        // Push ke state lokal instan
        if (Array.isArray(window.STATE.rawAlumni)) {
          window.STATE.rawAlumni.push(...chunk);
        }
      }

      if (Array.isArray(window.STATE.rawAlumni)) {
        localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
        window.processCombinedData();
        if (typeof window.applyAlumniFilters === "function") {
          window.applyAlumniFilters();
        }
      }

      let msg = `Berhasil impor ${dataUpload.length} data.`;
      if (skippedCount > 0) msg += ` (${skippedCount} data persis/kurang lengkap dilewati).`;
      
      if (autoMerge) {
        window.notify(msg + " Menjalankan penggabungan otomatis...", "info");
        setTimeout(async () => {
          await window.executeBulkMergeDuplicates();
        }, 1000);
      } else {
        if (duplicateCount > 0) {
          window.notify(msg + ` (${duplicateCount} data ganda terimpor). Membuka Cek Duplikat...`, "warning");
          setTimeout(() => {
            if (typeof window.showDuplicates === "function") {
              window.showDuplicates();
            }
          }, 2500);
        } else {
          window.notify(msg, "success");
        }
      }
    } catch (err) {
      console.error(err);
      window.notify("Gagal menyimpan data ke database", "error");
    } finally {
      window.toggleLoading(false);
      window.STATE.tempImportData = null;
    }
  };

  window.handleCSVUploadConfirmBtn = () => {
    if (!window.STATE.tempImportData) return;
    const { duplicateCount } = window.STATE.tempImportData;
    if (duplicateCount > 0) {
      window.closeModal("modal-import-preview");
      const countEl = document.getElementById("import-resolve-count");
      if (countEl) countEl.textContent = duplicateCount;
      window.openModal("modal-import-duplicates-resolve");
    } else {
      window.confirmCSVUpload(false);
    }
  };

  window.submitImportResolveSelection = () => {
    const radios = document.getElementsByName("import-resolve-action");
    let val = "auto";
    for (const r of radios) {
      if (r.checked) {
        val = r.value;
        break;
      }
    }
    window.closeModal("modal-import-duplicates-resolve");
    if (val === "auto") {
      window.confirmCSVUpload(true);
    } else {
      window.confirmCSVUpload(false);
    }
  };
  // ==========================================
  // FITUR PEMANTAUAN & MODERASI BUKU TAMU
  // ==========================================
  window.renderGuestbookTable = () => {
    const tbody = document.getElementById("guestbook-admin-list");
    if (!tbody) return;

    const role = window.STATE.user ? window.STATE.user.role : "user";
    // Hanya Admin Utama, Sekretaris, dan Bendahara yang bisa menghapus komentar
    const canManage =
      role === "admin_utama" || role === "creator" || role === "sekretaris" || role === "bendahara";

    if (!window.STATE.guestbook || window.STATE.guestbook.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-500 text-xs italic">Belum ada pesan masuk di buku tamu publik.</td></tr>`;
      return;
    }

    // Urutkan dari komentar yang paling baru masuk
    let sortedData = [...window.STATE.guestbook].sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    );

    tbody.innerHTML = sortedData
      .map((g) => {
        let waktuFmt = g.created_at
          ? new Date(g.created_at).toLocaleString("id-ID")
          : "-";
        let btnHapus = canManage
          ? `<button onclick="window.handleDelete('guestbook', '${g.id}')" class="w-7 h-7 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg transition-all" title="Hapus Komentar"><i class="fas fa-trash-alt text-[10px]"></i></button>`
          : `<span class="text-slate-600 text-xs"><i class="fas fa-lock"></i> Terkunci</span>`;

        return `
                <tr class="border-b border-white/5 hover:bg-black/5 transition-colors">
                    <td class="p-5 text-xs text-slate-500 whitespace-nowrap">${waktuFmt}</td>
                    <td class="p-5">
                        <div class="font-bold text-white text-sm">${g.nama}</div>
                        <div class="mt-1"><span class="text-[9px] text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">Angkatan ${g.angkatan || "?"}</span></div>
                    </td>
                    <td class="p-5 text-xs text-slate-300 max-w-xl break-words leading-relaxed">${g.pesan}</td>
                    <td class="p-5 text-center whitespace-nowrap">${btnHapus}</td>
                </tr>
            `;
      })
      .join("");
  };
  // ==========================================
  // FITUR CEK DUPLIKAT ALUMNI (VERSI PENGECUALIAN / IGNORE)
  // ==========================================
  window.renderDuplicateClusters = (clusters) => {
    const listContainer = document.getElementById("duplicates-list");
    if (!listContainer) return;

    if (clusters.length === 0) {
      listContainer.innerHTML = `<div class="p-8 text-center text-slate-400 italic bg-black/20 rounded-2xl border border-white/5">Tersenyum lega! Tidak ditemukan indikasi data ganda / duplikat.</div>`;
    } else {
      listContainer.innerHTML = clusters
        .map((cluster, idx) => {
          let itemsHtml = cluster
            .map((a) => {
              const safeStr = encodeURIComponent(JSON.stringify(a)).replace(/'/g, "%27");

              let fullAddress = [a.alamat, a.desa, a.kecamatan, a.kabupaten]
                .filter((x) => x && String(x).trim() !== "")
                .join(", ");
              if (!fullAddress)
                fullAddress =
                  '<span class="text-red-400/50 italic">Alamat tidak diketahui</span>';
              let waStatus = a.nowa
                ? `<a href="https://wa.me/${a.nowa}" target="_blank" class="hover:text-emerald-400 transition-colors">${a.nowa}</a>`
                : '<span class="text-slate-500 italic">Tidak ada nomor HP</span>';

              return `
                            <div class="bg-black/40 p-4 rounded-xl border border-white/5 flex flex-col lg:flex-row justify-between gap-4 mt-2 hover:bg-black/60 transition-colors">
                                <div class="flex-1">
                                    <div class="font-bold text-white text-sm md:text-base">${a.nama} 
                                        <span class="text-[9px] text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded ml-2 uppercase font-black tracking-wider">Angkatan: ${a.angkatan || "?"}</span>
                                    </div>
                                    <div class="text-[10px] md:text-xs text-slate-300 mt-2.5 space-y-1.5 border-l-2 border-white/10 pl-3">
                                        <div class="flex items-start gap-2"><i class="fab fa-whatsapp mt-0.5 text-emerald-500 w-3 text-center"></i> <span>${waStatus}</span></div>
                                        <div class="flex items-start gap-2"><i class="fas fa-map-marker-alt mt-0.5 text-red-400 w-3 text-center"></i> <span class="leading-relaxed">${fullAddress}</span></div>
                                    </div>
                                    <div class="text-[10px] text-emerald-400 mt-3 font-bold bg-emerald-500/10 w-fit px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                                        <i class="fas fa-coins mr-1"></i>Total Donasi: ${window.formatRupiah(a.totalDonasi || 0)}
                                    </div>
                                </div>
                                <div class="flex flex-wrap gap-2 items-center lg:justify-end lg:items-start shrink-0">
                                    <button onclick="window.showDuplicateActionConfirm('ignore', '${a.id}', '${encodeURIComponent(JSON.stringify(cluster.map((x) => x.id)))}')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-lg whitespace-nowrap"><i class="fas fa-user-shield mr-1"></i> Bukan Duplikat</button>
                                    <button onclick="window.showDuplicateActionConfirm('merge', '${a.id}', '${encodeURIComponent(JSON.stringify(cluster.map((x) => x.id)))}')" class="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-lg whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i> Timpa & Pertahankan</button>
                                    <button onclick="window.openEditFromDuplicate('${safeStr}')" class="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-lg whitespace-nowrap"><i class="fas fa-edit mr-1"></i> Edit</button>
                                    <button onclick="window.openDeleteFromDuplicate('${a.id}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-lg whitespace-nowrap"><i class="fas fa-trash-alt mr-1"></i> Hapus</button>
                                </div>
                            </div>
                        `;
            })
            .join("");

          return `
                        <div class="mb-4 bg-purple-500/5 p-4 md:p-5 rounded-2xl border border-purple-500/20 shadow-sm">
                            <h4 class="text-xs font-black text-purple-400 uppercase tracking-widest border-b border-purple-500/20 pb-2 mb-3"><i class="fas fa-layer-group mr-2"></i> Grup Duplikat ${idx + 1} <span class="text-slate-400 ml-1 font-normal text-[10px]">(${cluster.length} Data Terindikasi Mirip)</span></h4>
                            ${itemsHtml}
                        </div>
                    `;
        })
        .join("");
    }
  };

  // ============================================================
  // FUNGSI ANALISIS DATA GANDA GLOBAL
  // ============================================================
  window.cleanAlumniName = (name) => {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\b(h|hj|dr|drs|ir|prof|ust|ustdz|ustadzah|spd|sag|skom|mpd|msi|se|sh|mm|st)\b\.?/g, "")
      .replace(/\bmuh\b/g, "muhammad")
      .replace(/\bmhd\b/g, "muhammad")
      .replace(/\bmd\b/g, "muhammad")
      .replace(/\babd\b/g, "abdul")
      .replace(/\b(bin|binti|bt|al|el)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  window.normalizeAlumniWA = (wa) => {
    return window.normalizePhoneNumber(wa);
  };

  window.getAlumniSimilarityScore = (a, b) => {
    const n1 = window.cleanAlumniName(a.nama);
    const n2 = window.cleanAlumniName(b.nama);
    const wa1 = window.normalizeAlumniWA(a.nowa);
    const wa2 = window.normalizeAlumniWA(b.nowa);
    
    // Normalisasi Angkatan agar format kelas (misal 11) dan tahun (2020) bisa cocok
    const ang1 = String(window.normalizeAngkatanYear(a.angkatan, a.lembaga) || "").trim();
    const ang2 = String(window.normalizeAngkatanYear(b.angkatan, b.lembaga) || "").trim();
    
    // Normalisasi Alamat agar spasi, baris baru, dan karakter khusus tidak menggagalkan pencocokan
    const cleanAddress = (str) => {
      return String(str || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();
    };
    const al1 = cleanAddress(String(a.alamat || "") + " " + String(a.desa || "") + " " + String(a.kecamatan || "") + " " + String(a.kabupaten || ""));
    const al2 = cleanAddress(String(b.alamat || "") + " " + String(b.desa || "") + " " + String(b.kecamatan || "") + " " + String(b.kabupaten || ""));
    
    const l1 = String(a.lembaga || "").toUpperCase().trim();
    const l2 = String(b.lembaga || "").toUpperCase().trim();

    let score = 0;
    if (wa1 && wa2 && wa1.length >= 10 && wa1 === wa2) score += 60;
    if (n1 && n2) {
      if (n1 === n2) {
        score += 40;
        // Tambahkan poin jika nama sama persis dan memiliki minimal 2 kata atau panjang nama >= 12 karakter (nama unik)
        const words = a.nama ? a.nama.trim().split(/\s+/).length : 0;
        if (words >= 2 || n1.length >= 12) {
          score += 20;
        }
      } else {
        const s1 = n1.split(" ").sort().join(" ");
        const s2 = n2.split(" ").sort().join(" ");
        if (s1 === s2 && s1.length > 3) score += 30;
        else if (n1.length > 4 && Math.abs(n1.length - n2.length) < 4 && window.levenshtein(n1, n2) <= 2) score += 20;
        else if (n1.length > 4 && n2.length > 4 && (n1.includes(n2) || n2.includes(n1))) score += 15;
      }
    }
    if (l1 && l2 && l1 === l2) score += 15;
    if (ang1 && ang2 && ang1 === ang2) score += 20;
    if (al1.length > 5 && al2.length > 5 && (al1.includes(al2) || al2.includes(al1))) score += 15;
    return Math.min(score, 100);
  };

  window.isAlumniDuplicate = (a, b) => {
    const ignoredA = a.ignored_dupes || [];
    const ignoredB = b.ignored_dupes || [];
    if (ignoredA.includes(b.id) || ignoredB.includes(a.id)) return false;
    const n1 = window.cleanAlumniName(a.nama);
    const n2 = window.cleanAlumniName(b.nama);
    if (!n1 || !n2) return false;
    const wa1 = window.normalizeAlumniWA(a.nowa);
    const wa2 = window.normalizeAlumniWA(b.nowa);
    if (wa1 && wa2 && wa1.length >= 10 && wa1 === wa2) return true;
    return window.getAlumniSimilarityScore(a, b) >= 60;
  };

  window.showDuplicates = () => {
    window.toggleLoading(true, "Menganalisis data ganda secara mendalam...");

    setTimeout(() => {
      const alumni = window.STATE.alumni;

      // ============================================================
      // CLUSTERING
      // ============================================================
      let clusters = [];
      let visited = new Set();

      // Mengelompokkan data yang saling berhubungan (Clustering)
      for (let i = 0; i < alumni.length; i++) {
        if (visited.has(alumni[i].id)) continue;

        let currentCluster = [alumni[i]];
        visited.add(alumni[i].id);
        let addedNew = true;

        // Loop terus sampai semua relasi duplikat dalam 1 grup ditemukan
        while (addedNew) {
          addedNew = false;
          for (let j = 0; j < alumni.length; j++) {
            if (visited.has(alumni[j].id)) continue;

            let matches = currentCluster.some((cItem) =>
              window.isAlumniDuplicate(cItem, alumni[j]),
            );
            if (matches) {
              currentCluster.push(alumni[j]);
              visited.add(alumni[j].id);
              addedNew = true;
            }
          }
        }

        if (currentCluster.length > 1) {
          let totalScore = 0, pairs = 0;
          for (let x = 0; x < currentCluster.length; x++) {
            for (let y = x + 1; y < currentCluster.length; y++) {
              totalScore += window.getAlumniSimilarityScore(currentCluster[x], currentCluster[y]);
              pairs++;
            }
          }
          const avgScore = pairs > 0 ? Math.round(totalScore / pairs) : 0;
          clusters.push({ items: currentCluster, score: avgScore });
        }
      }

      // Urutkan: skor tertinggi (paling yakin) tampil duluan
      clusters.sort((a, b) => b.score - a.score);

      // ============================================================
      // RENDER UI DENGAN SKOR KEMIRIPAN
      // ============================================================
      const listContainer = document.getElementById("duplicates-list");
      if (!listContainer) { window.toggleLoading(false); return; }

      // Tampilkan/sembunyikan tombol gabung masal
      const bulkMergeBtn = document.getElementById("btn-bulk-merge-duplicates");
      if (bulkMergeBtn) {
        if (clusters.length > 0) {
          bulkMergeBtn.classList.remove("hidden");
        } else {
          bulkMergeBtn.classList.add("hidden");
        }
      }

      if (clusters.length === 0) {
        listContainer.innerHTML = `<div class="p-8 text-center text-slate-400 italic bg-black/20 rounded-2xl border border-white/5">Tidak ditemukan indikasi data ganda / duplikat.</div>`;
      } else {
        listContainer.innerHTML = clusters.map((cluster, idx) => {
          const sc = cluster.score;
          const scoreColor = sc >= 90 ? "text-red-400 bg-red-500/20 border-red-500/30"
            : sc >= 70 ? "text-amber-400 bg-amber-500/20 border-amber-500/30"
            : "text-blue-400 bg-blue-500/20 border-blue-500/30";
          const scoreLabel = sc >= 90 ? "Sangat Yakin" : sc >= 70 ? "Kemungkinan Besar" : "Mungkin";

          const itemsHtml = cluster.items.map(a => {
            const safeStr = encodeURIComponent(JSON.stringify(a)).replace(/'/g, "%27");
            const pairScore = cluster.items.filter(x => x.id !== a.id)
              .reduce((max, x) => Math.max(max, window.getAlumniSimilarityScore(a, x)), 0);
            const waNorm = window.normalizeAlumniWA(a.nowa);
            const waDisplay = a.nowa
              ? `<a href="https://wa.me/${waNorm}" target="_blank" class="hover:text-emerald-400 transition-colors">${a.nowa}</a>`
              : '<span class="text-slate-500 italic">Tidak ada nomor HP</span>';
            const fullAddress = [a.alamat, a.desa, a.kecamatan, a.kabupaten]
              .filter(x => x && String(x).trim()).join(", ")
              || '<span class="text-red-400/50 italic">Alamat tidak diketahui</span>';
            return `
              <div class="bg-black/40 p-4 rounded-xl border border-white/5 flex items-start gap-4 mt-2 hover:bg-black/60 transition-colors">
                <div class="pt-1 select-none">
                  <input type="checkbox" class="duplicate-row-chk w-4 h-4 rounded border-white/10 bg-black/20 text-purple-600 focus:ring-purple-500 cursor-pointer" data-id="${a.id}" data-cluster-ids="${encodeURIComponent(JSON.stringify(cluster.items.map(x => x.id)))}" data-group-idx="${idx}" onclick="window.handleDuplicateChkClick(this)">
                </div>
                <div class="flex-1 flex flex-col lg:flex-row justify-between gap-4">
                  <div class="flex-1">
                    <div class="font-bold text-white text-sm">
                      ${a.nama}
                      <span class="text-[9px] text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded ml-2 uppercase font-black tracking-wider">Angkatan: ${a.angkatan || "?"}</span>
                      <span class="text-[9px] px-2 py-0.5 rounded ml-1 font-black border ${scoreColor}">${pairScore}%</span>
                    </div>
                    <div class="text-[10px] text-slate-300 mt-2 space-y-1 border-l-2 border-white/10 pl-3">
                      <div class="flex items-start gap-2"><i class="fab fa-whatsapp mt-0.5 text-emerald-500 w-3 text-center"></i> <span>${waDisplay}</span></div>
                      <div class="flex items-start gap-2"><i class="fas fa-map-marker-alt mt-0.5 text-red-400 w-3 text-center"></i> <span>${fullAddress}</span></div>
                    </div>
                    <div class="text-[10px] text-emerald-400 mt-2 font-bold bg-emerald-500/10 w-fit px-2 py-1 rounded-lg border border-emerald-500/20">
                      <i class="fas fa-coins mr-1"></i>Total Donasi: ${window.formatRupiah(a.totalDonasi || 0)}
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2 items-center lg:justify-end lg:items-start shrink-0">
                    <button onclick="window.showDuplicateActionConfirm('ignore', '${a.id}', '${encodeURIComponent(JSON.stringify(cluster.items.map(x => x.id)))}')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-lg whitespace-nowrap"><i class="fas fa-user-shield mr-1"></i> Bukan Duplikat</button>
                    <button onclick="window.showDuplicateActionConfirm('merge', '${a.id}', '${encodeURIComponent(JSON.stringify(cluster.items.map(x => x.id)))}')" class="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-lg whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i> Timpa &amp; Pertahankan</button>
                    <button onclick="window.openEditFromDuplicate('${safeStr}')" class="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-lg whitespace-nowrap"><i class="fas fa-edit mr-1"></i> Edit</button>
                    <button onclick="window.openDeleteFromDuplicate('${a.id}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all shadow-lg whitespace-nowrap"><i class="fas fa-trash-alt mr-1"></i> Hapus</button>
                  </div>
                </div>
              </div>`;
          }).join("");

          return `
            <div class="mb-4 bg-purple-500/5 p-4 md:p-5 rounded-2xl border border-purple-500/20 shadow-sm">
              <div class="flex items-center justify-between border-b border-purple-500/20 pb-2 mb-3">
                <h4 class="text-xs font-black text-purple-400 uppercase tracking-widest"><i class="fas fa-layer-group mr-2"></i>Grup Duplikat ${idx + 1} <span class="text-slate-400 font-normal text-[10px]">(${cluster.items.length} data)</span></h4>
                <span class="text-[9px] font-black px-2 py-1 rounded border ${scoreColor}"><i class="fas fa-percentage mr-1"></i>${sc}% &mdash; ${scoreLabel}</span>
              </div>
              ${itemsHtml}
            </div>`;
        }).join("");
      }

      window.toggleLoading(false);
      window.openModal("modal-duplicates");
      window.updateDuplicateBulkActionsUI();
    }, 800);
  };

  // ==========================================
  // FUNGSI PENYELESAIAN MASALAH Z-INDEX (AGAR BISA EDIT/HAPUS TANPA CLOSE)
  // ==========================================
  window.openEditFromDuplicate = (safeStr) => {
    document.getElementById("modal-alumni").style.zIndex = "600"; // Paksa ke depan
    window.openModalAlumni(safeStr);
  };

  window.openDeleteFromDuplicate = (id) => {
    document.getElementById("modal-delete").style.zIndex = "600"; // Paksa ke depan
    window.handleDelete("alumni", id);
  };

  // ==========================================
  // MODAL KONFIRMASI KUSTOM (LEBIH ELEGAN)
  // ==========================================
  window.showDuplicateActionConfirm = (type, keepId, clusterIdsStr) => {
    const existing = document.getElementById("custom-duplicate-confirm");
    if (existing) existing.remove();

    const clusterIds = JSON.parse(decodeURIComponent(clusterIdsStr));
    let title, message, icon, btnColor;

    if (type === "merge") {
      const idsToDelete = clusterIds.filter((id) => id !== keepId);
      let affectedFinances = [];
      idsToDelete.forEach((deletedId) => {
        const finances = window.STATE.rawFinance.filter(
          (f) => f.ref_alumni_id === deletedId,
        );
        affectedFinances.push(...finances);
      });

      title = "Timpa & Pertahankan";
      icon = "fas fa-check-circle text-purple-500";
      btnColor = "bg-purple-600 hover:bg-purple-500 shadow-purple-500/30";

      message = `Anda akan menjadikan data ini sebagai <b>Data Utama</b> dan menghapus <b>${idsToDelete.length} data duplikat</b> lainnya secara permanen dari sistem.<br><br>`;
      if (affectedFinances.length > 0) {
        message += `<span class="text-emerald-400 font-bold"><i class="fas fa-coins mr-1"></i> Penyelamatan Dana: Ditemukan ${affectedFinances.length} riwayat donasi pada akun yang akan dihapus. Riwayat ini akan OTOMATIS DIPINDAHKAN ke Data Utama yang Anda pilih.</span>`;
      } else {
        message += `<span class="text-slate-400 italic">Tidak ada riwayat donasi pada akun yang akan dihapus (Data Aman).</span>`;
      }
    } else {
      title = "Tandai Bukan Duplikat";
      icon = "fas fa-user-shield text-blue-500";
      btnColor = "bg-blue-600 hover:bg-blue-500 shadow-blue-500/30";
      message = `Data ini akan ditandai sebagai <b>Orang yang Berbeda</b> dari sisa data di grup ini.<br><br>Sistem AI tidak akan pernah lagi menggabungkan nama mereka di masa depan.`;
    }

    const modalHtml = `
        <div id="custom-duplicate-confirm" class="fixed inset-0 z-[700] flex items-center justify-center p-4">
            <div onclick="document.getElementById('custom-duplicate-confirm').remove()" class="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
            <div class="glass relative w-full max-w-sm rounded-[2rem] p-8 shadow-2xl text-center border border-white/10 modal-enter">
                <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg border border-white/10">
                    <i class="${icon}"></i>
                </div>
                <h3 class="text-lg font-black uppercase mb-3 text-white">${title}</h3>
                <div class="text-[11px] text-slate-300 mb-8 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5 text-left">
                    ${message}
                </div>
                <div class="flex gap-3">
                    <button onclick="document.getElementById('custom-duplicate-confirm').remove()" class="flex-1 py-3.5 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest text-white border border-white/10">Batal</button>
                    <button id="btn-duplicate-confirm-ok" class="flex-1 py-3.5 rounded-xl font-bold ${btnColor} transition-all uppercase text-[10px] tracking-widest text-white shadow-lg">Lanjutkan</button>
                </div>
            </div>
        </div>
        `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    document.getElementById("btn-duplicate-confirm-ok").onclick = () => {
      document.getElementById("custom-duplicate-confirm").remove();
      if (type === "merge") {
        window.executeKeepOneDeleteOthers(keepId, clusterIdsStr);
      } else {
        window.executeMarkAsNotDuplicate(keepId, clusterIdsStr);
      }
    };
  };

  // ==========================================
  // EKSEKUSI LOGIKA DUPLIKAT DI BALIK LAYAR
  // ==========================================
  window.executeMarkAsNotDuplicate = async (targetId, clusterIdsStr) => {
    const clusterIds = JSON.parse(decodeURIComponent(clusterIdsStr));
    const otherIds = clusterIds.filter((id) => id !== targetId);

    window.toggleLoading(true, "Menyimpan status pengecualian AI...");
    try {
      const batch = db.batch();

      const targetData = window.STATE.alumni.find((x) => x.id === targetId);
      let targetIgnored = targetData.ignored_dupes || [];
      let newTargetIgnored = [...new Set([...targetIgnored, ...otherIds])];
      batch.update(db.collection("alumni").doc(targetId), {
        ignored_dupes: newTargetIgnored,
      });

      for (let id of otherIds) {
        const otherData = window.STATE.alumni.find((x) => x.id === id);
        if (otherData) {
          let otherIgnored = otherData.ignored_dupes || [];
          if (!otherIgnored.includes(targetId)) {
            let newOtherIgnored = [...otherIgnored, targetId];
            batch.update(db.collection("alumni").doc(id), {
              ignored_dupes: newOtherIgnored,
            });
          }
        }
      }

      await batch.commit();
      window.notify("Berhasil ditandai sebagai BUKAN duplikat!", "success");
      window.closeModal("modal-duplicates");

      setTimeout(() => {
        window.showDuplicates();
      }, 800);
    } catch (error) {
      window.notify("Gagal menyimpan pengecualian. Periksa koneksi.", "error");
    } finally {
      window.toggleLoading(false);
    }
  };

  window.executeKeepOneDeleteOthers = async (keepId, clusterIdsStr) => {
    const clusterIds = JSON.parse(decodeURIComponent(clusterIdsStr));
    const idsToDelete = clusterIds.filter((id) => id !== keepId);

    let affectedFinances = [];
    idsToDelete.forEach((deletedId) => {
      const finances = window.STATE.rawFinance.filter(
        (f) => f.ref_alumni_id === deletedId,
      );
      affectedFinances.push(...finances);
    });

    window.toggleLoading(true, "Membersihkan duplikat & memindahkan donasi...");
    try {
      const batch = db.batch();

      // Pindahkan riwayat donasi ke Data Utama
      affectedFinances.forEach((fin) => {
        batch.update(db.collection("finance").doc(fin.id), {
          ref_alumni_id: keepId,
        });
      });

      // Hapus data kotor
      idsToDelete.forEach((id) => {
        batch.delete(db.collection("alumni").doc(id));
      });

      await batch.commit();
      window.notify(
        `${idsToDelete.length} data duplikat dibersihkan & riwayat donasi aman!`,
        "success",
      );
      window.closeModal("modal-duplicates");

      window.STATE.rawAlumni = window.STATE.rawAlumni.filter(
        (a) => !idsToDelete.includes(a.id),
      );
      window.processCombinedData();
    } catch (error) {
      window.notify("Gagal membersihkan data duplikat.", "error");
    } finally {
      window.toggleLoading(false);
    }
  };

  // ==========================================
  // KONFIRMASI & EKSEKUSI GABUNG MASAL DATA GANDA
  // ==========================================
  window.showBulkMergeConfirm = () => {
    const existing = document.getElementById("custom-duplicate-confirm");
    if (existing) existing.remove();

    const modalHtml = `
        <div id="custom-duplicate-confirm" class="fixed inset-0 z-[700] flex items-center justify-center p-4">
            <div onclick="document.getElementById('custom-duplicate-confirm').remove()" class="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
            <div class="glass relative w-full max-w-md rounded-[2rem] p-8 shadow-2xl text-center border border-white/10 modal-enter animate-fade-in">
                <div class="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg border border-purple-500/20 text-purple-400">
                    <i class="fas fa-compress-alt"></i>
                </div>
                <h3 class="text-sm font-black text-white uppercase tracking-wider mb-3">Gabungkan Masal Semua Duplikat?</h3>
                <div class="text-[10px] text-slate-300 mb-6 text-left leading-relaxed space-y-2">
                    <p>Sistem akan memproses semua grup duplikat secara otomatis dengan aturan:</p>
                    <ul class="list-disc pl-5 space-y-1">
                        <li>Memilih <b>Data Paling Lengkap</b> (yang memiliki WhatsApp, alamat terpanjang, dll.) sebagai data utama yang dipertahankan.</li>
                        <li><b>Menggabungkan riwayat keuangan & donasi</b> dari semua akun duplikat ke data utama.</li>
                        <li><b>Menyalin informasi yang kosong</b> (misalnya jika data utama tidak memiliki alamat/WhatsApp tapi data duplikat memilikinya).</li>
                        <li><b>Menormalisasi angkatan</b> ke tahun kalender masehi yang benar.</li>
                        <li>Menghapus data duplikat yang kosong secara permanen.</li>
                    </ul>
                </div>
                <div class="flex gap-3 justify-center">
                    <button onclick="document.getElementById('custom-duplicate-confirm').remove()" class="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[9px] uppercase transition-all">Batal</button>
                    <button onclick="document.getElementById('custom-duplicate-confirm').remove(); window.executeBulkMergeDuplicates();" class="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[9px] uppercase shadow-lg shadow-purple-600/30 transition-all">Gabungkan Sekarang</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  };

  window.executeBulkMergeDuplicates = async () => {
    window.toggleLoading(true, "Menganalisis & menggabungkan duplikat secara massal...");
    
    try {
      const alumni = window.STATE.alumni;
      
      let clusters = [];
      let visited = new Set();

      for (let i = 0; i < alumni.length; i++) {
        if (visited.has(alumni[i].id)) continue;

        let currentCluster = [alumni[i]];
        visited.add(alumni[i].id);
        let addedNew = true;

        while (addedNew) {
          addedNew = false;
          for (let j = 0; j < alumni.length; j++) {
            if (visited.has(alumni[j].id)) continue;

            let matches = currentCluster.some((cItem) =>
              window.isAlumniDuplicate(cItem, alumni[j]),
            );
            if (matches) {
              currentCluster.push(alumni[j]);
              visited.add(alumni[j].id);
              addedNew = true;
            }
          }
        }

        if (currentCluster.length > 1) {
          clusters.push(currentCluster);
        }
      }

      if (clusters.length === 0) {
        window.notify("Tidak ada data ganda yang perlu digabungkan.", "info");
        window.toggleLoading(false);
        return;
      }

      const getCompletenessScore = (item) => {
        let score = window.getProfileCompleteness(item);
        if (item.totalDonasi) score += 0.1;
        return score;
      };

      let totalDeletedCount = 0;
      let totalMergedCount = 0;
      const idsToDelete = [];
      const keptAlumniMap = {};

      // Eksekusi per chunk agar tidak melanggar limit batched write Firestore (500)
      const clusterChunkSize = 30;
      for (let cIdx = 0; cIdx < clusters.length; cIdx += clusterChunkSize) {
        const chunk = clusters.slice(cIdx, cIdx + clusterChunkSize);
        const batch = db.batch();

        chunk.forEach((cluster) => {
          cluster.sort((a, b) => getCompletenessScore(b) - getCompletenessScore(a));
          const keepRecord = cluster[0];
          const recordsToDelete = cluster.slice(1);

          recordsToDelete.forEach((r) => {
            idsToDelete.push(r.id);
            batch.delete(db.collection("alumni").doc(r.id));
            totalDeletedCount++;
          });

          let affectedFinances = [];
          recordsToDelete.forEach((delItem) => {
            const finances = window.STATE.rawFinance.filter(
              (f) => f.ref_alumni_id === delItem.id
            );
            affectedFinances.push(...finances);
          });

          affectedFinances.forEach((fin) => {
            batch.update(db.collection("finance").doc(fin.id), {
              ref_alumni_id: keepRecord.id,
            });
            fin.ref_alumni_id = keepRecord.id;
          });

          const fields = ["nowa", "alamat", "desa", "kecamatan", "kabupaten", "lembaga", "angkatan"];
          const updates = {};
          recordsToDelete.forEach((delItem) => {
            fields.forEach((f) => {
              const delVal = String(delItem[f] || "").trim();
              const keepVal = String(keepRecord[f] || "").trim();
              if (delVal && !keepVal) {
                updates[f] = delItem[f];
                keepRecord[f] = delItem[f];
              } else if (f === "alamat" && delVal.length > keepVal.length) {
                updates[f] = delItem[f];
                keepRecord[f] = delItem[f];
              }
            });
          });

          if (keepRecord.angkatan && Number(keepRecord.angkatan) < 100) {
            const norm = Number(window.normalizeAngkatanYear(keepRecord.angkatan, keepRecord.lembaga));
            if (norm !== Number(keepRecord.angkatan)) {
              updates.angkatan = norm;
              keepRecord.angkatan = norm;
            }
          }

          if (Object.keys(updates).length > 0) {
            batch.update(db.collection("alumni").doc(keepRecord.id), updates);
            keptAlumniMap[keepRecord.id] = updates;
          }
          totalMergedCount++;
        });

        await batch.commit();
      }

      // Hapus data dari local state
      window.STATE.rawAlumni = window.STATE.rawAlumni.filter(
        (a) => !idsToDelete.includes(a.id)
      );

      // Terapkan merge fields ke local state data utama
      window.STATE.rawAlumni = window.STATE.rawAlumni.map((a) => {
        if (keptAlumniMap[a.id]) {
          return { ...a, ...keptAlumniMap[a.id] };
        }
        return a;
      });

      // Simpan ke Cache & Update UI
      localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
      localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
      window.processCombinedData();
      if (typeof window.applyAlumniFilters === "function") {
        window.applyAlumniFilters();
      }
      
      window.notify(
        `Berhasil menggabungkan secara masal ${totalMergedCount} grup duplikat. ${totalDeletedCount} data dibersihkan!`,
        "success"
      );
      window.closeModal("modal-duplicates");
    } catch (err) {
      console.error(err);
      window.notify("Gagal memproses penggabungan masal.", "error");
    } finally {
      window.toggleLoading(false);
    }
  };

  // ==========================================
  // PENGELOLAAN DATA GANDA TERCENTANG (SELEKTIF)
  // ==========================================
  window.handleDuplicateChkClick = (chk) => {
    const groupIdx = chk.getAttribute("data-group-idx");
    if (chk.checked) {
      // Uncheck all other checkboxes in the same group (radio-button behavior)
      const groupChks = document.querySelectorAll(`.duplicate-row-chk[data-group-idx="${groupIdx}"]`);
      groupChks.forEach(c => {
        if (c !== chk) c.checked = false;
      });
    }
    window.updateDuplicateBulkActionsUI();
  };

  window.updateDuplicateBulkActionsUI = () => {
    const chks = document.querySelectorAll(".duplicate-row-chk:checked");
    const count = chks.length;
    
    const btnKeep = document.getElementById("btn-duplicate-bulk-keep");
    const btnDelete = document.getElementById("btn-duplicate-bulk-delete");
    const btnMergeAll = document.getElementById("btn-bulk-merge-duplicates");
    
    const countKeepSpan = document.getElementById("duplicate-bulk-keep-count");
    const countDeleteSpan = document.getElementById("duplicate-bulk-delete-count");
    
    if (count > 0) {
      if (btnKeep) {
        btnKeep.classList.remove("hidden");
        countKeepSpan.innerText = count;
      }
      if (btnDelete) {
        btnDelete.classList.remove("hidden");
        countDeleteSpan.innerText = count;
      }
      if (btnMergeAll) {
        btnMergeAll.classList.add("hidden");
      }
    } else {
      if (btnKeep) btnKeep.classList.add("hidden");
      if (btnDelete) btnDelete.classList.add("hidden");
      
      const listContainer = document.getElementById("duplicates-list");
      const hasClusters = listContainer && listContainer.querySelectorAll(".mb-4").length > 0;
      if (btnMergeAll) {
        if (hasClusters) btnMergeAll.classList.remove("hidden");
        else btnMergeAll.classList.add("hidden");
      }
    }
  };

  window.showDuplicateBulkKeepConfirm = () => {
    const existing = document.getElementById("custom-duplicate-confirm");
    if (existing) existing.remove();
    
    const count = document.querySelectorAll(".duplicate-row-chk:checked").length;

    const modalHtml = `
        <div id="custom-duplicate-confirm" class="fixed inset-0 z-[700] flex items-center justify-center p-4">
            <div onclick="document.getElementById('custom-duplicate-confirm').remove()" class="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
            <div class="glass relative w-full max-w-sm rounded-[2rem] p-8 shadow-2xl text-center border border-white/10 modal-enter animate-fade-in">
                <div class="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg border border-purple-500/20 text-purple-400">
                    <i class="fas fa-compress-alt"></i>
                </div>
                <h3 class="text-sm font-black text-white uppercase tracking-wider mb-3">Gabungkan Terpilih?</h3>
                <p class="text-xs text-slate-300 mb-6 leading-relaxed">
                    Anda akan menjadikan <b>${count} data tercentang</b> sebagai Data Utama. Data ganda lainnya dalam grup yang bersangkutan akan dihapus, dan riwayat donasi mereka akan dipindahkan ke Data Utama terpilih.
                </p>
                <div class="flex gap-3 justify-center">
                    <button onclick="document.getElementById('custom-duplicate-confirm').remove()" class="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[9px] uppercase transition-all">Batal</button>
                    <button onclick="document.getElementById('custom-duplicate-confirm').remove(); window.executeDuplicateBulkKeep();" class="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[9px] uppercase shadow-lg shadow-purple-600/30 transition-all">Gabungkan Sekarang</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  };

  window.showDuplicateBulkDeleteConfirm = () => {
    const existing = document.getElementById("custom-duplicate-confirm");
    if (existing) existing.remove();
    
    const count = document.querySelectorAll(".duplicate-row-chk:checked").length;

    const modalHtml = `
        <div id="custom-duplicate-confirm" class="fixed inset-0 z-[700] flex items-center justify-center p-4">
            <div onclick="document.getElementById('custom-duplicate-confirm').remove()" class="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
            <div class="glass relative w-full max-w-sm rounded-[2rem] p-8 shadow-2xl text-center border border-white/10 modal-enter animate-fade-in">
                <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg border border-red-500/20 text-red-500">
                    <i class="fas fa-trash-alt"></i>
                </div>
                <h3 class="text-sm font-black text-white uppercase tracking-wider mb-3">Hapus Terpilih?</h3>
                <p class="text-xs text-slate-300 mb-6 leading-relaxed">
                    Apakah Anda yakin ingin menghapus <b>${count} data tercentang</b> secara permanen dari sistem? Tindakan ini tidak dapat dibatalkan.
                </p>
                <div class="flex gap-3 justify-center">
                    <button onclick="document.getElementById('custom-duplicate-confirm').remove()" class="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[9px] uppercase transition-all">Batal</button>
                    <button onclick="document.getElementById('custom-duplicate-confirm').remove(); window.executeDuplicateBulkDelete();" class="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-[9px] uppercase shadow-lg shadow-red-600/30 transition-all">Hapus Sekarang</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  };

  window.executeDuplicateBulkKeep = async () => {
    const chks = document.querySelectorAll(".duplicate-row-chk:checked");
    if (chks.length === 0) return;
    
    window.toggleLoading(true, "Menggabungkan duplikat terpilih...");
    try {
      const batch = db.batch();
      const idsToDelete = [];
      const keptAlumniMap = {};
      let totalDeleted = 0;
      let totalMerged = 0;
      
      chks.forEach(chk => {
        const keepId = chk.getAttribute("data-id");
        const clusterIds = JSON.parse(decodeURIComponent(chk.getAttribute("data-cluster-ids")));
        
        const keepRecord = window.STATE.rawAlumni.find(a => a.id === keepId);
        if (!keepRecord) return;
        
        const currentGroupDeletes = clusterIds.filter(id => id !== keepId);
        
        currentGroupDeletes.forEach(delId => {
          idsToDelete.push(delId);
          batch.delete(db.collection("alumni").doc(delId));
          totalDeleted++;
        });
        
        let affectedFinances = [];
        currentGroupDeletes.forEach(delId => {
          const finances = window.STATE.rawFinance.filter(f => f.ref_alumni_id === delId);
          affectedFinances.push(...finances);
        });
        
        affectedFinances.forEach(fin => {
          batch.update(db.collection("finance").doc(fin.id), { ref_alumni_id: keepId });
          fin.ref_alumni_id = keepId;
        });
        
        const fields = ["nowa", "alamat", "desa", "kecamatan", "kabupaten", "lembaga", "angkatan"];
        const updates = {};
        
        currentGroupDeletes.forEach(delId => {
          const delItem = window.STATE.rawAlumni.find(a => a.id === delId);
          if (!delItem) return;
          
          fields.forEach(f => {
            const delVal = String(delItem[f] || "").trim();
            const keepVal = String(keepRecord[f] || "").trim();
            if (delVal && !keepVal) {
              updates[f] = delItem[f];
              keepRecord[f] = delItem[f];
            } else if (f === "alamat" && delVal.length > keepVal.length) {
              updates[f] = delItem[f];
              keepRecord[f] = delItem[f];
            }
          });
        });
        
        if (keepRecord.angkatan && Number(keepRecord.angkatan) < 100) {
          const norm = Number(window.normalizeAngkatanYear(keepRecord.angkatan, keepRecord.lembaga));
          if (norm !== Number(keepRecord.angkatan)) {
            updates.angkatan = norm;
            keepRecord.angkatan = norm;
          }
        }
        
        if (Object.keys(updates).length > 0) {
          batch.update(db.collection("alumni").doc(keepId), updates);
          keptAlumniMap[keepId] = updates;
        }
        totalMerged++;
      });
      
      await batch.commit();
      
      window.STATE.rawAlumni = window.STATE.rawAlumni.filter(
        (a) => !idsToDelete.includes(a.id)
      );

      window.STATE.rawAlumni = window.STATE.rawAlumni.map((a) => {
        if (keptAlumniMap[a.id]) {
          return { ...a, ...keptAlumniMap[a.id] };
        }
        return a;
      });

      localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
      localStorage.setItem('cached_finance', JSON.stringify(window.STATE.rawFinance));
      window.processCombinedData();
      
      window.notify(
        `Berhasil menggabungkan ${totalMerged} data terpilih. ${totalDeleted} data dibersihkan!`,
        "success"
      );
      window.closeModal("modal-duplicates");
      window.updateDuplicateBulkActionsUI();
    } catch (err) {
      console.error(err);
      window.notify("Gagal menggabungkan data terpilih.", "error");
    } finally {
      window.toggleLoading(false);
    }
  };

  window.executeDuplicateBulkDelete = async () => {
    const chks = document.querySelectorAll(".duplicate-row-chk:checked");
    if (chks.length === 0) return;
    
    window.toggleLoading(true, "Menghapus alumni terpilih...");
    try {
      const batch = db.batch();
      const idsToDelete = [];
      
      chks.forEach(chk => {
        const id = chk.getAttribute("data-id");
        idsToDelete.push(id);
        batch.delete(db.collection("alumni").doc(id));
      });
      
      await batch.commit();
      
      window.STATE.rawAlumni = window.STATE.rawAlumni.filter(
        (a) => !idsToDelete.includes(a.id)
      );

      localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
      window.processCombinedData();
      if (typeof window.applyAlumniFilters === "function") {
        window.applyAlumniFilters();
      }
      
      window.notify(
        `Berhasil menghapus ${idsToDelete.length} data terpilih!`,
        "success"
      );
      window.closeModal("modal-duplicates");
      window.updateDuplicateBulkActionsUI();
    } catch (err) {
      console.error(err);
      window.notify("Gagal menghapus data terpilih.", "error");
    } finally {
      window.toggleLoading(false);
    }
  };
  // ==========================================
  // FITUR PENCATATAN DONASI BARANG (LOGISTIK)
  // ==========================================
  window.openModalLogistik = (dataStr) => {
    const form = document.getElementById("form-logistik");
    form.reset();
    if (dataStr) {
      const data = JSON.parse(decodeURIComponent(dataStr));
      document.getElementById("log-id").value = data.id || "";
      document.getElementById("log-nama").value = data.nama_donatur || "";
      document.getElementById("log-barang").value = data.nama_barang || "";
      document.getElementById("log-jumlah").value = data.jumlah || "";
      document.getElementById("log-satuan").value = data.satuan || "";
      document.getElementById("log-keterangan").value = data.keterangan || "";
      document.getElementById("modal-logistik-title").innerText =
        "Edit Donasi Barang";
    } else {
      document.getElementById("log-id").value = "";
      document.getElementById("modal-logistik-title").innerText =
        "Input Donasi Barang";
    }
    window.openModal("modal-logistik");
  };

  window.handleLogistikSubmit = async (e) => {
    e.preventDefault();
    window.toggleLoading(true, "Menyimpan Data Barang...");
    const data = Object.fromEntries(new FormData(e.target).entries());
    const id = data.id;
    delete data.id;

    if (!id) data.tanggal = new Date().toLocaleString("id-ID");

    try {
      if (id) await db.collection("logistik").doc(id).update(data);
      else await db.collection("logistik").add(data);

      window.closeModal("modal-logistik");
      window.notify("Barang berhasil dicatat!", "success");
      e.target.reset();
    } catch (err) {
      window.notify("Gagal menyimpan data logistik", "error");
    } finally {
      window.toggleLoading(false);
    }
  };

  window.renderLogistikTable = () => {
    const tbody = document.getElementById("logistik-list");
    if (!tbody) return;

    const role = window.STATE.user ? window.STATE.user.role : "user";
    const canManage =
      role === "admin_utama" || role === "creator" || role === "bendahara" || role === "sekretaris";

    if (!window.STATE.logistik || window.STATE.logistik.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 text-xs italic">Belum ada donasi barang yang dicatat.</td></tr>`;
      return;
    }

    // Urutkan dari data terbaru ke terlama
    let sortedData = [...window.STATE.logistik].sort(
      (a, b) => new Date(b.tanggal || 0) - new Date(a.tanggal || 0),
    );

    tbody.innerHTML = sortedData
      .map((l) => {
        const safeStr = encodeURIComponent(JSON.stringify(l)).replace(/'/g, "%27");
        let act = "-";
        if (canManage)
          act = `<button onclick="window.openModalLogistik('${safeStr}')" class="w-7 h-7 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-white mr-1" title="Edit"><i class="fas fa-edit text-[10px]"></i></button><button onclick="window.handleDelete('logistik', '${l.id}')" class="w-7 h-7 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white" title="Hapus"><i class="fas fa-trash-alt text-[10px]"></i></button>`;

        let tgl = l.tanggal ? l.tanggal.split(",")[0] : "-";

        return `
            <tr class="border-b border-white/5 hover:bg-black/5 transition-colors">
                <td class="p-5 text-xs text-slate-500 whitespace-nowrap">${tgl}</td>
                <td class="p-5 font-bold text-white">${l.nama_donatur}</td>
                <td class="p-5">
                    <div class="font-black text-emerald-400">${l.nama_barang}</div>
                    <div class="text-[10px] text-slate-400 uppercase tracking-widest mt-1">${l.jumlah} ${l.satuan}</div>
                </td>
                <td class="p-5 text-xs text-slate-400 max-w-xs break-words">${l.keterangan || "-"}</td>
                <td class="p-5 text-center whitespace-nowrap">${act}</td>
            </tr>`;
      })
      .join("");
  };
  window.previewProfilePhoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById("preview-profile-photo").src =
          event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };
  // ==========================================
  // FUNGSI PENGATURAN REKENING & SCAN STRUK AI
  // ==========================================

  // Membuka modal pengaturan rekening panitia
  window.openPaymentSettings = async () => {
    window.renderPaymentAccounts();
    window.openModal("modal-payment-settings");

    // Memuat status pengaturan Midtrans & Manual dari Firestore
    try {
      const toggle = document.getElementById("toggle-midtrans-active");
      const toggleManual = document.getElementById("toggle-manual-active");
      const configFields = document.getElementById("midtrans-config-fields");
      const gasInput = document.getElementById("set-midtrans-gas-url");

      const docSnap = await db.collection("settings").doc("payment_gateway").get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const isActive = data.active === undefined ? true : (data.active === true || data.active === "true");
        const isManualActive = data.manual_active === undefined ? true : (data.manual_active === true || data.manual_active === "true");
        
        if (toggle) toggle.checked = isActive;
        if (toggleManual) toggleManual.checked = isManualActive;
        if (gasInput) gasInput.value = data.gas_url || "";
        if (configFields) {
          if (isActive) {
            configFields.classList.remove("hidden");
          } else {
            configFields.classList.add("hidden");
          }
        }
      }

      // Restriksi akses editing URL GAS (Hanya untuk Creator)
      const userRole = window.STATE && window.STATE.user ? window.STATE.user.role : '';
      if (userRole !== 'creator') {
        if (gasInput) {
          gasInput.disabled = true;
          gasInput.title = "Hanya Creator yang dapat mengubah URL Apps Script";
        }
        const saveButton = document.querySelector("button[onclick='window.saveMidtransGasUrl()']");
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.classList.add('opacity-50', 'cursor-not-allowed');
          saveButton.title = "Hanya Creator yang dapat menyimpan URL Apps Script";
        }
      } else {
        if (gasInput) {
          gasInput.disabled = false;
          gasInput.title = "";
        }
        const saveButton = document.querySelector("button[onclick='window.saveMidtransGasUrl()']");
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
          saveButton.title = "";
        }
      }
    } catch (err) {
      console.error("Gagal memuat pengaturan pembayaran:", err);
    }
  };

  // Mengubah status keaktifan Manual
  window.handleManualPaymentToggle = async (checkbox) => {
    const isManualActive = checkbox.checked;
    window.toggleLoading(true, "Mengubah status pembayaran manual...");
    try {
      await db.collection("settings").doc("payment_gateway").set({
        manual_active: isManualActive
      }, { merge: true });
      window.notify(`Metode pembayaran manual berhasil ${isManualActive ? 'diaktifkan' : 'dinonaktifkan'}!`, "success");
    } catch (err) {
      window.notify("Gagal mengubah status manual: " + err.toString(), "error");
      checkbox.checked = !isManualActive;
    }
    window.toggleLoading(false);
  };

  // Mengubah status keaktifan Midtrans
  window.handleMidtransToggle = async (checkbox) => {
    const isActive = checkbox.checked;
    const configFields = document.getElementById("midtrans-config-fields");

    if (configFields) {
      if (isActive) {
        configFields.classList.remove("hidden");
      } else {
        configFields.classList.add("hidden");
      }
    }

    window.toggleLoading(true, "Mengubah status Midtrans...");
    try {
      await db.collection("settings").doc("payment_gateway").set({
        active: isActive
      }, { merge: true });
      window.notify(`Metode pembayaran online berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}!`, "success");
    } catch (err) {
      window.notify("Gagal mengubah status: " + err.toString(), "error");
      checkbox.checked = !isActive;
      if (configFields) {
        if (!isActive) {
          configFields.classList.remove("hidden");
        } else {
          configFields.classList.add("hidden");
        }
      }
    }
    window.toggleLoading(false);
  };

  // Menyimpan URL Google Apps Script
  window.saveMidtransGasUrl = async () => {
    const userRole = window.STATE && window.STATE.user ? window.STATE.user.role : '';
    if (userRole !== 'creator') {
      return window.notify("Hanya Creator yang dapat menyimpan URL Apps Script!", "error");
    }

    const gasInput = document.getElementById("set-midtrans-gas-url");
    if (!gasInput) return;
    const gasUrl = gasInput.value.trim();

    if (gasUrl && !gasUrl.startsWith("https://script.google.com/")) {
      return window.notify("URL Apps Script harus valid!", "error");
    }

    window.toggleLoading(true, "Menyimpan URL Apps Script...");
    try {
      await db.collection("settings").doc("payment_gateway").set({
        gas_url: gasUrl
      }, { merge: true });
      window.notify("URL Google Apps Script berhasil disimpan!", "success");
    } catch (err) {
      window.notify("Gagal menyimpan URL: " + err.toString(), "error");
    }
    window.toggleLoading(false);
  };

  // Render daftar rekening
  window.renderPaymentAccounts = () => {
    const list = document.getElementById("payment-accounts-list");
    if (
      !window.STATE.paymentAccounts ||
      window.STATE.paymentAccounts.length === 0
    ) {
      list.innerHTML =
        '<p class="text-xs text-slate-500 text-center italic py-4">Belum ada rekening.</p>';
      return;
    }
    list.innerHTML = window.STATE.paymentAccounts
      .map(
        (rek) => `
            <div class="flex justify-between items-center p-3 bg-black/20 border border-white/5 rounded-xl">
                <div>
                    <div class="font-bold text-emerald-400 text-sm">${rek.bank} - ${rek.norek}</div>
                    <div class="text-[10px] text-slate-400">a.n ${rek.nama_rek}</div>
                </div>
                <button onclick="window.handleDelete('payment_accounts', '${rek.id}')" class="w-7 h-7 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white" title="Hapus"><i class="fas fa-trash-alt text-[10px]"></i></button>
            </div>
        `,
      )
      .join("");
  };
  // Fungsi membaca data rahasia di dalam gambar QRIS
  window.scanQRImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          resolve(code ? code.data : null);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };
  // Simpan rekening baru
  // Simpan rekening baru (Dengan AI Scanner QRIS)
  // Fungsi Pintar Mendeteksi Atas Nama Merchant Asli di Dalam String QRIS (Tag 59)
  window.parseQrisMerchantName = (qrisStr) => {
    if (!qrisStr) return null;
    try {
      let pos = 0;
      while (pos < qrisStr.length - 4) {
        let tag = qrisStr.substring(pos, pos + 2);
        let len = parseInt(qrisStr.substring(pos + 2, pos + 4), 10);
        if (isNaN(len)) break;
        let val = qrisStr.substring(pos + 4, pos + 4 + len);
        if (tag === "59") {
          return val.trim();
        }
        pos += 4 + len;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  // Update Fungsi Simpan Rekening / QRIS Murni
  window.handlePaymentSettingsSubmit = async (e) => {
    e.preventDefault();
    window.toggleLoading(true, "Memproses Metode Pembayaran...");

    const bankInput = document.getElementById("set-bank").value.trim();
    const norekInput = document.getElementById("set-norek").value.trim();
    const namaInput = document.getElementById("set-nama-rek").value.trim();
    const fileInput = document.getElementById("set-qris-file");

    // Struktur data default
    const d = {
      bank: bankInput || "QRIS",
      norek: norekInput || "QRIS Otomatis",
      nama_rek: namaInput || "Merchant QRIS",
      nama: namaInput || "Merchant QRIS",
    };

    try {
      if (fileInput && fileInput.files.length > 0) {
        let file = fileInput.files[0];
        window.toggleLoading(true, "AI Memindai Payload QRIS...");

        // 1. Scan image QRIS ke bentuk teks kode
        const qris_data = await window.scanQRImage(file);

        if (qris_data) {
          d.qris_data = qris_data;

          // 2. Ambil Atas Nama asli dari dalam kode QRIS secara otomatis
          const autoMerchantName = window.parseQrisMerchantName(qris_data);
          if (autoMerchantName) {
            d.nama = autoMerchantName;
            d.nama_rek = autoMerchantName;
          }
          window.notify("QRIS Terbaca! Atas Nama: " + d.nama, "success");
        } else {
          // Jika QRIS pecah/tidak terbaca teksnya, upload sebagai gambar biasa ke Cloudinary
          window.toggleLoading(
            true,
            "Gagal scan teks, mengunggah gambar fisik...",
          );
          file = await window.compressImage(file, 1);
          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", "Reuniakbar");

          const cloudRes = await fetch(
            "https://api.cloudinary.com/v1_1/dowih3wr7/image/upload",
            { method: "POST", body: formData },
          );
          const cloudData = await cloudRes.json();
          if (cloudData.secure_url) {
            d.qris_url = cloudData.secure_url;
          }
        }
      } else {
        // Jika tidak upload file QRIS, maka data bank manual mutlak wajib diisi
        if (!bankInput || !norekInput || !namaInput) {
          window.toggleLoading(false);
          return window.notify(
            "Gagal: Isi rincian bank atau upload gambar QRIS!",
            "error",
          );
        }
      }

      await db.collection("payment_accounts").add(d);
      window.notify("Metode Pembayaran Berhasil Disimpan!", "success");
      e.target.reset();
      window.renderPaymentAccounts();
    } catch (err) {
      window.notify("Gagal menyimpan: " + err.message, "error");
    } finally {
      window.toggleLoading(false);
    }
  };
  window.fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  window.scanReceiptTesseract = async () => {
    const fileInput = document.getElementById("fin-file");
    if (fileInput.files.length === 0)
      return window.notify("Pilih gambar struk terlebih dahulu!", "error");

    const btn = document.getElementById("btn-scan-struk");
    const originalText = btn.innerHTML;
    btn.disabled = true;

    // Load AI configurations
    let provider = window.aiProvider;
    let apiKey = provider === "groq" ? window.groqApiKey : window.geminiApiKey;

    if (!apiKey || !provider) {
      try {
        const doc = await db.collection("app_settings").doc("ai_config").get();
        if(doc.exists) {
          window.geminiApiKey = doc.data().gemini_key || "";
          window.groqApiKey = doc.data().groq_key || "";
          window.aiProvider = doc.data().ai_provider || "gemini";
          provider = window.aiProvider;
          apiKey = provider === "groq" ? window.groqApiKey : window.geminiApiKey;
        }
      } catch(err) {
        console.error("Gagal meload konfigurasi AI:", err);
      }
    }

    // FALLBACK: If no API key is set, prompt to enter nominal manually or set up API Key
    if (!apiKey) {
      btn.disabled = false;
      btn.innerHTML = originalText;
      
      const ok = await window.showConfirm({
          title: "Pemindaian AI Belum Aktif",
          message: "Untuk memindai nominal struk secara otomatis menggunakan AI Vision dalam 2 detik, mohon atur <b>Kunci API AI (Gemini/Groq)</b> di Pengaturan AI terlebih dahulu.<br><br>Untuk saat ini, silakan masukkan nominal transaksi secara manual.",
          confirmText: "Atur Sekarang",
          cancelText: "Tutup",
          danger: false
      });
      
      if (ok) {
          window.showTab("settings");
          setTimeout(() => {
              const el = document.getElementById("heading-sistem");
              if (el) el.scrollIntoView({ behavior: "smooth" });
          }, 400);
      }
      return;
    }

    // AI VISION FLOW (Gemini or Groq Llama 3.2 Vision)
    const providerName = provider === "groq" ? "Groq Llama 3.2 Vision" : "Gemini 1.5 Vision";
    window.toggleLoading(true, `AI sedang memindai struk dengan ${providerName}...`);

    try {
      const file = fileInput.files[0];
      const base64Image = await window.fileToBase64(file);
      const mimeType = file.type || "image/jpeg";

      const prompt = `Analisa gambar struk, invoice, kwitansi, atau bukti transfer ini secara sangat teliti.
Temukan:
1. Nominal total yang ditransfer atau dibayar (angka bersih saja, tanpa titik/koma/simbol Rp).
2. Keterangan transaksi pendek (contoh: "Iuran Reuni AHMAD" atau "Pembelian spanduk reuni").
3. Kategori yang paling cocok dari opsi berikut: "Donasi", "Iuran Bulanan", "Operasional", "Lainnya".
4. Status transaksi yang paling cocok: "pemasukan" (jika bukti transfer masuk/dana masuk) atau "pengeluaran" (jika struk belanja/pembelian/pengeluaran panitia).

Kembalikan jawaban HANYA sebagai objek JSON murni tanpa pembungkus markdown (tanpa ticks seperti \`\`\`json) dengan format persis seperti contoh berikut:
{
  "nominal": 150000,
  "keterangan": "Iuran Reuni Ahmad",
  "kategori": "Iuran Bulanan",
  "status": "pemasukan"
}
Jika salah satu informasi (seperti nominal) tidak bisa terdeteksi sama sekali, kembalikan nilai null pada properti tersebut. Jangan kembalikan teks penjelasan apa pun selain JSON.`;

      let resultText = "";

      if (provider === "groq") {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        const body = {
          model: "llama-3.2-11b-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1
        };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
          },
          body: JSON.stringify(body)
        });

        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        if (json.choices && json.choices.length > 0 && json.choices[0].message) {
          resultText = json.choices[0].message.content;
        } else {
          throw new Error("Gagal memproses gambar dengan Groq Vision.");
        }
      } else {
        // Gemini Vision
        const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + apiKey;
        const body = {
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image
                  }
                }
              ]
            }
          ]
        };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
          resultText = json.candidates[0].content.parts[0].text;
        } else {
          throw new Error("Gagal memproses gambar dengan Gemini Vision.");
        }
      }

      // Parse JSON murni dari respon AI
      let cleanJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
      const extracted = JSON.parse(cleanJson);

      if (extracted && extracted.nominal) {
        // Isi input Nominal
        const nomInput = document.getElementById("fin-nominal");
        nomInput.value = extracted.nominal;
        nomInput.dispatchEvent(new Event("input"));
        
        // Tampilkan hint format rupiah
        const hint = nomInput.parentElement.querySelector(".rupiah-hint");
        if (hint) {
          hint.innerText = "= Rp " + Number(extracted.nominal).toLocaleString("id-ID");
        }

        // Isi input Keterangan/Nama
        if (extracted.keterangan) {
          document.getElementById("fin-nama").value = extracted.keterangan;
        }

        // Isi input Kategori jika cocok
        if (extracted.kategori) {
          const katSelect = document.getElementById("fin-kategori");
          const options = Array.from(katSelect.options).map(o => o.value);
          if (options.includes(extracted.kategori)) {
            katSelect.value = extracted.kategori;
          }
        }

        // Isi input Status jika cocok
        if (extracted.status) {
          const statSelect = document.getElementById("fin-status");
          if (extracted.status === "pemasukan" || extracted.status === "pengeluaran") {
            statSelect.value = extracted.status;
          }
        }

        window.notify("AI Vision berhasil memindai struk & mengisi otomatis!", "success");
      } else {
        window.notify("AI gagal mendeteksi nominal transaksi pada struk.", "warning");
      }

    } catch (err) {
      console.error(err);
      window.notify("AI Vision Gagal: " + err.message, "error");
    } finally {
      window.toggleLoading(false);
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }; // Membuka modal dan mengisi template awal (opsional)
  // ==========================================
  // SISTEM WA API & GRUP TERBARU
  // ==========================================
  // 1. FUNGSI LOAD SETTING WA & MANAJEMEN GRUP
  window.renderWASettingsGroups = () => {
    const textarea = document.getElementById("set-wa-groups-data");
    const container = document.getElementById("wa-group-list-setting");
    if (!textarea || !container) return;
    let groups = [];
    try {
      groups = JSON.parse(textarea.value || "[]");
    } catch(e) {
      groups = [];
    }

    if (groups.length === 0) {
      container.innerHTML = `<p class="text-[10px] text-slate-500 text-center italic py-2">Belum ada grup terdaftar.</p>`;
      return;
    }

    container.innerHTML = groups.map(g => `
      <div class="flex justify-between items-center bg-white/5 px-3 py-2 rounded-xl border border-white/10 mb-1">
        <div class="flex flex-col truncate flex-1 pr-2 text-left">
          <span class="text-xs font-bold text-slate-300 truncate">${g.name}</span>
          <span class="text-[8px] text-slate-500 truncate">${g.id}</span>
        </div>
        <button type="button" onclick="window.removeGroupFromWASettings('${g.id}')" class="text-red-400 hover:text-red-300 p-1.5 transition-colors">
          <i class="fas fa-trash text-[10px]"></i>
        </button>
      </div>
    `).join("");
  };

  window.addNewGroupToWASettings = () => {
    const nameInput = document.getElementById("add-wa-group-name");
    const jidInput = document.getElementById("add-wa-group-jid");
    if (!nameInput || !jidInput) return;
    const name = nameInput.value.trim();
    let jid = jidInput.value.trim();

    if (!name) return window.notify("Nama grup tidak boleh kosong!", "error");
    if (!jid) return window.notify("JID/ID grup tidak boleh kosong!", "error");
    
    if (!jid.includes("@")) {
      jid = jid + "@g.us";
    }

    const textarea = document.getElementById("set-wa-groups-data");
    let groups = [];
    try {
      groups = JSON.parse(textarea.value || "[]");
    } catch(e) {
      groups = [];
    }

    if (groups.some(g => g.id === jid)) {
      return window.notify("Grup dengan JID tersebut sudah ada!", "error");
    }

    groups.push({ id: jid, name: name });
    textarea.value = JSON.stringify(groups);

    nameInput.value = "";
    jidInput.value = "";

    window.renderWASettingsGroups();
    window.notify("Grup ditambahkan ke daftar!", "success");
  };

  window.removeGroupFromWASettings = (jid) => {
    const textarea = document.getElementById("set-wa-groups-data");
    let groups = [];
    try {
      groups = JSON.parse(textarea.value || "[]");
    } catch(e) {
      groups = [];
    }

    groups = groups.filter(g => g.id !== jid);
    textarea.value = JSON.stringify(groups);

    window.renderWASettingsGroups();
    window.notify("Grup dihapus dari daftar!", "warning");
  };

  window.handleWASettingsSubmit = async (e) => {
    e.preventDefault();
    
    // Batasi akses hanya untuk role 'creator'
    if (!window.STATE.user || window.STATE.user.role !== 'creator') {
      window.notify("Akses ditolak! Hanya Kreator yang dapat menyunting pengaturan API WhatsApp.", "error");
      return;
    }
    
    const providerVerifikasi = document.getElementById("set-wa-provider-verifikasi").value;
    const tokenVerifikasi = document.getElementById("set-wa-token-verifikasi").value;
    const providerBroadcast = document.getElementById("set-wa-provider-broadcast").value;
    const tokenBroadcast = document.getElementById("set-wa-token-broadcast").value;
    const providerKeuangan = document.getElementById("set-wa-provider-keuangan").value;
    const tokenKeuangan = document.getElementById("set-wa-token-keuangan").value;
    const groupsData = document.getElementById("set-wa-groups-data").value;

    window.toggleLoading(true, "Menyimpan pengaturan WA...");
    try {
      await db.collection("settings").doc("whatsapp_api").set({
        provider_verifikasi: providerVerifikasi,
        token_verifikasi: tokenVerifikasi,
        provider_broadcast: providerBroadcast,
        token_broadcast: tokenBroadcast,
        provider_keuangan: providerKeuangan,
        token_keuangan: tokenKeuangan,
        groups_data: groupsData
      }, { merge: true });
      window.notify("Pengaturan WA Berhasil Disimpan!", "success");
      window.closeModal("modal-wa-settings");
    } catch(err) {
      window.notify("Gagal menyimpan: " + err.message, "error");
    }
    window.toggleLoading(false);
  };

  // 2. Fungsi Menampilkan Preview ke Dalam Layar Modal (Auto-Fallback visual)
  window.renderLaporanPreview = async () => {
    const format = document.getElementById("laporan-format-select").value;
    const framePdf = document.getElementById("preview-pdf");
    const imgPng = document.getElementById("preview-png");
    const loading = document.getElementById("preview-loading");

    loading.classList.remove("hidden");
    if (framePdf) framePdf.classList.add("hidden");
    imgPng.classList.add("hidden");

    try {
      // ALWAYS generate the high-fidelity premium image preview for unified visual inspection on Android WebView!
      const { fileBlob } = await window.generateLaporanFile("image");
      const fileUrl = URL.createObjectURL(fileBlob);
      imgPng.src = fileUrl;
      imgPng.classList.remove("hidden");
    } catch (e) {
      console.error("Gagal generate preview", e);
    } finally {
      loading.classList.add("hidden");
    }
  };

  // 3. Fungsi Membuka Modal (Disesuaikan)
  window.openModalLaporanWA = async () => {
    window.toggleLoading(true, "Memuat Data Grup...");
    try {
      const waSnap = await db.collection("settings").doc("whatsapp_api").get();
      const groupsStr = waSnap.exists
        ? waSnap.data().groups_data || "[]"
        : "[]";
      const groupSelect = document.getElementById("laporan-grup-select");

      try {
        const groups = JSON.parse(groupsStr);
        if (groups.length > 0) {
          groupSelect.innerHTML =
            '<option value="">-- Pilih Grup WA --</option>' +
            groups
              .map((g) => `<option value="${g.id}">${g.name}</option>`)
              .join("");
        } else {
          groupSelect.innerHTML =
            '<option value="">Belum ada grup (Tarik di Setting API)</option>';
        }
      } catch (e) {
        groupSelect.innerHTML = '<option value="">Error membaca grup</option>';
      }

      let inC = 0,
        outC = 0;
      window.STATE.finance.forEach((f) => {
        let v = Number(f.nominal) || 0;
        if (f.status === "pengeluaran") outC += v;
        else inC += v;
      });
      const saldo = inC - outC;
      const bulan = new Date().toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });

      document.getElementById("laporan-msg-input").value =
        `Assalamu'alaikum wr. wb.\n\nBerikut kami lampirkan Laporan Keuangan Reuni Akbar AL-FATAH (Periode ${bulan}).\n\nTotal Pemasukan: *${window.formatRupiah(inC)}*\nTotal Pengeluaran: *${window.formatRupiah(outC)}*\nSaldo Kas Saat Ini: *${window.formatRupiah(saldo)}*\n\nTerima kasih atas transparansi dan dukungan semua pihak.\n\nTtd,\nBendahara Panitia.`;

      // PANGGIL PREVIEW OTOMATIS SAAT MODAL DIBUKA
      window.renderLaporanPreview();
      window.openModal("modal-laporan-wa");
    } catch (e) {
      window.notify("Gagal memuat", "error");
    } finally {
      window.toggleLoading(false);
    }
  };

  // 3. FUNGSI KIRIM LAPORAN KEUANGAN MULTI-PROVIDER TELAH DIPINDAHKAN KE api-whatsapp.js
  // Logika API WA dan Grup telah dipindahkan ke api-whatsapp.js (1A Modularization)});

  // ==========================================
  // KOORDINATOR WILAYAH API LOGIC
  // ==========================================

  const API_WILAYAH_BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

  window.openModalSetWilayah = (uid) => {
    document.getElementById("koor-uid").value = uid;

    // Load existing data if any
    const user = window.STATE.users.find((u) => u.uid === uid);
    const role = user ? user.role : "";

    const provGroup = document.getElementById("koor-provinsi").closest('div');
    const kabGroup = document.getElementById("koor-kabupaten").closest('div');
    const kecGroup = document.getElementById("koor-kecamatan").closest('div');
    const desaGroup = document.getElementById("koor-desa").closest('div');

    const selProv = document.getElementById("koor-provinsi");
    const selKab = document.getElementById("koor-kabupaten");
    const selKec = document.getElementById("koor-kecamatan");
    const selDesa = document.getElementById("koor-desa");

    // Reset required
    selProv.required = true;
    selKab.required = true;
    selKec.required = true;
    selDesa.required = true;

    // Reset visibility
    if (provGroup) provGroup.classList.remove("hidden");
    if (kabGroup) kabGroup.classList.remove("hidden");
    if (kecGroup) kecGroup.classList.remove("hidden");
    if (desaGroup) desaGroup.classList.remove("hidden");

    if (role === 'korwil_kabupaten') {
        selKec.required = false;
        selDesa.required = false;
        if (kecGroup) kecGroup.classList.add("hidden");
        if (desaGroup) desaGroup.classList.add("hidden");
    } else if (role === 'korwil_kecamatan') {
        selDesa.required = false;
        if (desaGroup) desaGroup.classList.add("hidden");
    }

    // Load Provinces
    fetch(`${API_WILAYAH_BASE}/provinces.json`)
      .then((res) => res.json())
      .then((data) => {
        selProv.innerHTML =
          '<option value="">-- Pilih Provinsi --</option>' +
          data
            .map(
              (p) =>
                `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`,
            )
            .join("");

        // Note: because the API uses IDs for hierarchy but names for saving,
        // handling pre-fill is tricky without cascading fetch.
        // For simplicity, we just ask them to select from top to bottom every time.
        selKab.innerHTML = '<option value="">Pilih Provinsi Dahulu</option>';
        selKab.disabled = true;
        selKec.innerHTML = '<option value="">Pilih Kabupaten Dahulu</option>';
        selKec.disabled = true;
        selDesa.innerHTML = '<option value="">Pilih Kecamatan Dahulu</option>';
        selDesa.disabled = true;
      })
      .catch((err) => {
        console.error(err);
        window.notify("Gagal memuat data provinsi", "error");
      });

    window.openModal("modal-set-wilayah");
  };

  window.loadKabupaten = (provId) => {
    const sel = document.getElementById("koor-kabupaten");
    if (!provId) {
      sel.disabled = true;
      return;
    }

    fetch(`${API_WILAYAH_BASE}/regencies/${provId}.json`)
      .then((res) => res.json())
      .then((data) => {
        sel.innerHTML =
          '<option value="">-- Pilih Kabupaten/Kota --</option>' +
          data
            .map(
              (p) =>
                `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`,
            )
            .join("");
        sel.disabled = false;
      });
  };

  window.loadKecamatan = (kabId) => {
    const sel = document.getElementById("koor-kecamatan");
    if (!kabId) {
      sel.disabled = true;
      return;
    }

    fetch(`${API_WILAYAH_BASE}/districts/${kabId}.json`)
      .then((res) => res.json())
      .then((data) => {
        sel.innerHTML =
          '<option value="">-- Pilih Kecamatan --</option>' +
          data
            .map(
              (p) =>
                `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`,
            )
            .join("");
        sel.disabled = false;
      });
  };

  window.loadDesa = (kecId) => {
    const sel = document.getElementById("koor-desa");
    if (!kecId) {
      sel.disabled = true;
      return;
    }

    fetch(`${API_WILAYAH_BASE}/villages/${kecId}.json`)
      .then((res) => res.json())
      .then((data) => {
        sel.innerHTML =
          '<option value="">-- Pilih Desa/Kelurahan --</option>' +
          data
            .map(
              (p) =>
                `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`,
            )
            .join("");
        sel.disabled = false;
      });
  };

  window.handleSaveWilayahKoor = async (e) => {
    e.preventDefault();
    window.toggleLoading(true, "Menyimpan Wilayah...");

    try {
      const uid = document.getElementById("koor-uid").value;
      const selKab = document.getElementById("koor-kabupaten");
      const selKec = document.getElementById("koor-kecamatan");
      const selDesa = document.getElementById("koor-desa");

      const kabName = window.normalizeWilayahName(
        selKab.options[selKab.selectedIndex].getAttribute("data-name") || ""
      );
      const kecName = window.normalizeWilayahName(
        selKec.options[selKec.selectedIndex].getAttribute("data-name") || ""
      );
      const desaName = window.normalizeWilayahName(
        selDesa.options[selDesa.selectedIndex].getAttribute("data-name") || ""
      );

      await db.collection("users").doc(uid).update({
        wilayah_kabupaten: kabName,
        wilayah_kecamatan: kecName,
        wilayah_desa: desaName,
      });

      window.notify("Wilayah Koordinator berhasil diset!", "success");
      window.closeModal("modal-set-wilayah");
      window.renderUsers(); // re-render table to show updated territory
    } catch (err) {
      window.notify("Gagal menyimpan wilayah: " + err.message, "error");
    } finally {
      window.toggleLoading(false);
    }
  };
window.handleAiSettingsSubmit = async (e) => {
    e.preventDefault();
    const geminiKey = document.getElementById("ai-gemini-key").value;
    const groqKey = document.getElementById("ai-groq-key").value;
    const provider = document.getElementById("ai-provider").value;
    window.toggleLoading(true, "Menyimpan Kunci AI...");
    try {
        await db.collection("app_settings").doc("ai_config").set({ 
            gemini_key: geminiKey, 
            groq_key: groqKey, 
            ai_provider: provider 
        }, { merge: true });
        window.geminiApiKey = geminiKey;
        window.groqApiKey = groqKey;
        window.aiProvider = provider;
        window.notify("Konfigurasi AI Berhasil Disimpan!", "success");
        window.closeModal("modal-ai-settings");
    } catch(err) {
        window.notify("Gagal menyimpan: " + err.message, "error");
    }
    window.toggleLoading(false);
};

// ── CLOUDINARY CONFIG ──────────────────────────────────────────────────────
// Nilai default (fallback jika belum pernah disimpan di Firestore)
window.CLOUDINARY_CONFIG = {
    cloud_name: "dowih3wr7",
    upload_preset: "Reuniakbar",
    allowed_formats: "jpg,jpeg,png,webp",
    max_size_mb: 5
};

window.loadCloudinaryConfig = async () => {
    try {
        const doc = await db.collection("app_settings").doc("cloudinary_config").get();
        if (doc.exists) {
            const d = doc.data();
            window.CLOUDINARY_CONFIG.cloud_name    = d.cloud_name    || window.CLOUDINARY_CONFIG.cloud_name;
            window.CLOUDINARY_CONFIG.upload_preset = d.upload_preset || window.CLOUDINARY_CONFIG.upload_preset;
            window.CLOUDINARY_CONFIG.allowed_formats = d.allowed_formats || window.CLOUDINARY_CONFIG.allowed_formats;
            window.CLOUDINARY_CONFIG.max_size_mb   = d.max_size_mb   || window.CLOUDINARY_CONFIG.max_size_mb;
        }
    } catch(err) {
        console.error("Gagal memuat konfigurasi Cloudinary:", err);
    }
};

window.handleCloudinarySettingsSubmit = async (e) => {
    e.preventDefault();
    const cloudName    = (document.getElementById("cld-cloud-name")?.value || "").trim();
    const uploadPreset = (document.getElementById("cld-upload-preset")?.value || "").trim();
    const allowedFmt   = (document.getElementById("cld-allowed-formats")?.value || "").trim();
    const maxSizeMb    = parseInt(document.getElementById("cld-max-size-mb")?.value || "5");

    if (!cloudName || !uploadPreset) {
        window.notify("Cloud Name dan Upload Preset wajib diisi!", "error");
        return;
    }

    window.toggleLoading(true, "Menyimpan Konfigurasi Cloudinary...");
    try {
        await db.collection("app_settings").doc("cloudinary_config").set({
            cloud_name:      cloudName,
            upload_preset:   uploadPreset,
            allowed_formats: allowedFmt || "jpg,jpeg,png,webp",
            max_size_mb:     isNaN(maxSizeMb) ? 5 : maxSizeMb
        }, { merge: true });

        // Update runtime config langsung
        window.CLOUDINARY_CONFIG.cloud_name      = cloudName;
        window.CLOUDINARY_CONFIG.upload_preset   = uploadPreset;
        window.CLOUDINARY_CONFIG.allowed_formats = allowedFmt || "jpg,jpeg,png,webp";
        window.CLOUDINARY_CONFIG.max_size_mb     = isNaN(maxSizeMb) ? 5 : maxSizeMb;

        window.notify("Konfigurasi Cloudinary Berhasil Disimpan!", "success");
    } catch(err) {
        window.notify("Gagal menyimpan: " + err.message, "error");
    }
    window.toggleLoading(false);
};

window.addGalleryCategoryRow = (name = "", folderId = "", id = null) => {
    const container = document.getElementById("gallery-categories-container");
    if (!container) return;

    const rowId = id || "cat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);

    const div = document.createElement("div");
    div.id = `row-${rowId}`;
    div.className = "gallery-category-row premium-card bg-black/40 p-4 border border-white/5 rounded-2xl flex flex-col md:flex-row gap-4 items-end relative group transition-all duration-300 hover:border-indigo-500/30 animate-enter";
    div.innerHTML = `
      <div class="flex-1 w-full text-left">
        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Nama Kategori</label>
        <input type="text" class="input-field mt-1 category-name" required value="${name}" placeholder="Cth: Acara Utama / Malam Puncak" />
      </div>
      <div class="flex-[1.5] w-full text-left">
        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Link atau ID Folder Google Drive</label>
        <input type="text" class="input-field mt-1 category-folder-id" required value="${folderId}" placeholder="Tempel Link Folder atau ID saja" />
      </div>
      <div class="flex gap-2 w-full md:w-auto justify-end">
        <button type="button" onclick="window.moveGalleryCategoryRow('${rowId}', -1)" class="w-12 h-12 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl flex items-center justify-center border border-white/10 hover:border-indigo-500 transition-all duration-200 active:scale-95" title="Pindahkan Ke Atas">
          <i class="fas fa-chevron-up text-xs"></i>
        </button>
        <button type="button" onclick="window.moveGalleryCategoryRow('${rowId}', 1)" class="w-12 h-12 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl flex items-center justify-center border border-white/10 hover:border-indigo-500 transition-all duration-200 active:scale-95" title="Pindahkan Ke Bawah">
          <i class="fas fa-chevron-down text-xs"></i>
        </button>
        <button type="button" onclick="window.removeGalleryCategoryRow('${rowId}')" class="w-12 h-12 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl flex items-center justify-center border border-red-500/20 hover:border-red-500 transition-all duration-200 active:scale-95" title="Hapus Kategori">
          <i class="fas fa-trash-alt text-sm"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
};

window.moveGalleryCategoryRow = (rowId, direction) => {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const container = document.getElementById("gallery-categories-container");
    if (!container) return;

    if (direction === -1) {
        const prev = row.previousElementSibling;
        if (prev) {
            container.insertBefore(row, prev);
            // Animasi transisi halus
            row.classList.add("scale-[0.98]", "bg-indigo-500/5");
            setTimeout(() => row.classList.remove("scale-[0.98]", "bg-indigo-500/5"), 300);
        } else {
            window.notify("Kategori sudah berada di posisi paling atas!", "info");
        }
    } else if (direction === 1) {
        const next = row.nextElementSibling;
        if (next) {
            container.insertBefore(next, row);
            // Animasi transisi halus
            row.classList.add("scale-[0.98]", "bg-indigo-500/5");
            setTimeout(() => row.classList.remove("scale-[0.98]", "bg-indigo-500/5"), 300);
        } else {
            window.notify("Kategori sudah berada di posisi paling bawah!", "info");
        }
    }
};

window.removeGalleryCategoryRow = (rowId) => {
    const row = document.getElementById(`row-${rowId}`);
    if (row) {
        row.classList.add("scale-95", "opacity-0");
        setTimeout(() => {
            row.remove();
        }, 200);
    }
};

window.handleGallerySettingsSubmit = async (e) => {
    e.preventDefault();
    
    const container = document.getElementById("gallery-categories-container");
    if (!container) return;

    const rows = container.querySelectorAll(".gallery-category-row");
    const categories = [];

    rows.forEach(row => {
        const nameInput = row.querySelector(".category-name");
        const folderInput = row.querySelector(".category-folder-id");
        
        if (nameInput && folderInput) {
            const name = nameInput.value.trim();
            let folderId = folderInput.value.trim();
            
            // Ekstrak ID Folder Google Drive jika pengguna menempelkan link penuh
            if (folderId) {
                const driveUrlRegex = /(?:https?:\/\/)?(?:drive\.google\.com\/)(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=)([a-zA-Z0-9_-]{25,50})/i;
                const match = folderId.match(driveUrlRegex);
                if (match && match[1]) {
                    folderId = match[1];
                } else if (folderId.includes("drive.google.com")) {
                    // Pencarian segmen cadangan jika pola URL berbeda
                    const segments = folderId.split('/');
                    for (const segment of segments) {
                        const cleanSegment = segment.split('?')[0].split('#')[0];
                        if (cleanSegment.length >= 25 && cleanSegment.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(cleanSegment)) {
                            folderId = cleanSegment;
                            break;
                        }
                    }
                }
            }
            
            if (name && folderId) {
                const id = row.id.replace("row-", "");
                categories.push({
                    id: id,
                    name: name,
                    folder_id: folderId
                });
            }
        }
    });

    if (categories.length === 0) {
        window.notify("Minimal harus ada satu kategori dengan nama dan ID folder yang terisi!", "error");
        return;
    }

    window.toggleLoading(true, "Menyimpan Konfigurasi Galeri...");
    try {
        // Hapus field format lama agar database bersih, ganti dengan array categories
        await db.collection("settings").doc("documentation").set({
            categories: categories,
            updated_at: new Date().toISOString()
        });

        // Update sync_state untuk memicu sinkronisasi Cloudinary jika diperlukan
        try {
            await db.collection("settings").doc("sync_state").set({
                gallery_version: Date.now().toString()
            }, { merge: true });
        } catch(syncErr) {
            console.warn("[SYNC] Gagal update sync_state:", syncErr);
        }

        window.notify("Konfigurasi Galeri Berhasil Disimpan!", "success");
    } catch(err) {
        window.notify("Gagal menyimpan: " + err.message, "error");
    } finally {
        window.toggleLoading(false);
    }
};

// Validasi ukuran berkas berdasarkan konfigurasi Cloudinary aktif
window.validateCloudinaryFile = (file) => {
    if (!file) return true;
    const maxBytes = (window.CLOUDINARY_CONFIG.max_size_mb || 5) * 1024 * 1024;
    if (file.size > maxBytes) {
        window.notify(`Ukuran berkas melebihi batas ${window.CLOUDINARY_CONFIG.max_size_mb} MB. Berkas ini sebesar ${(file.size / 1024 / 1024).toFixed(1)} MB.`, "error");
        return false;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = (window.CLOUDINARY_CONFIG.allowed_formats || "jpg,jpeg,png,webp").split(",").map(f => f.trim());
    if (!allowed.includes(ext)) {
        window.notify(`Format berkas .${ext} tidak diizinkan. Format yang diizinkan: ${allowed.join(", ")}.`, "error");
        return false;
    }
    return true;
};

// Fungsi upload terpusat menggunakan konfigurasi dinamis
window.uploadToCloudinary = async (file) => {
    if (!window.validateCloudinaryFile(file)) throw new Error("Berkas tidak valid");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", window.CLOUDINARY_CONFIG.upload_preset);
    const url = `https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloud_name}/image/upload`;
    const res = await fetch(url, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || "Gagal upload ke Cloudinary");
    return data.secure_url;
};

window.callGeminiAI = async (prompt, systemInstruction = null) => {
    if (!window.geminiApiKey || !window.groqApiKey || !window.aiProvider) {
        try {
            const doc = await db.collection("app_settings").doc("ai_config").get();
            if(doc.exists) {
                window.geminiApiKey = doc.data().gemini_key || "";
                window.groqApiKey = doc.data().groq_key || "";
                window.aiProvider = doc.data().ai_provider || "gemini";
            }
        } catch(err) {}
    }
    
    const activeKey = window.aiProvider === "groq" ? window.groqApiKey : window.geminiApiKey;
    if (!activeKey) {
        window.notify("Kunci API untuk provider terpilih belum diatur! Silakan atur di Pengaturan AI.", "error");
        throw new Error("API Key missing");
    }

    if (window.aiProvider === "groq") {
        // Groq API Logic
        const url = "https://api.groq.com/openai/v1/chat/completions";
        const messages = [];
        if (systemInstruction) {
            messages.push({ role: "system", content: systemInstruction });
        }
        messages.push({ role: "user", content: prompt });
        
        const body = {
            model: "llama-3.1-8b-instant",
            messages: messages,
            temperature: 0.5
        };

        const res = await fetch(url, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": "Bearer " + activeKey
            },
            body: JSON.stringify(body)
        });

        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        
        if (json.choices && json.choices.length > 0 && json.choices[0].message) {
            return json.choices[0].message.content;
        }
        return "Gagal mendapatkan respons dari Groq AI.";

    } else {
        // Default Gemini API Logic
        const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + activeKey;
        const body = {
            contents: [{ parts: [{ text: prompt }] }]
        };
        
        if(systemInstruction) {
            body.system_instruction = { parts: [{ text: systemInstruction }] };
        }

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const json = await res.json();
        if(json.error) throw new Error(json.error.message);
        
        if(json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
            return json.candidates[0].content.parts[0].text;
        }
        return "Gagal mendapatkan respons dari Gemini AI.";
    }
};

window.generateAICopy = async (e) => {
    if (e) e.preventDefault();
    const prompt = document.getElementById("ai-prompt-input").value;
    window.toggleLoading(true, "AI sedang merangkai pesan...");
    try {
        const tone = window.selectedPresetTone || "Sopan & Santai";
        
        // Ambil pengaturan bahasa dan sapaan
        const langSelect = document.getElementById("ai-copywriter-lang");
        const langVal = langSelect ? langSelect.value : "id";
        const greetingSelect = document.getElementById("ai-copywriter-greeting");
        const greeting = greetingSelect ? greetingSelect.value : "Akhi/Ukhti";
        
        let languageDesc = "Bahasa Indonesia";
        if (langVal === "su_lemes") {
            languageDesc = "Bahasa Sunda Lemes/Halus (Sangat sopan, menggunakan tatakrama bahasa Sunda yang halus dan hormat)";
        } else if (langVal === "su_loma") {
            languageDesc = "Bahasa Sunda Loma/Akrab (Bahasa pertemanan Sunda yang hangat, santai, akrab namun tetap beradab)";
        } else if (langVal === "jv_kromo") {
            languageDesc = "Bahasa Jawa Kromo Alus/Inggil (Sangat sopan, halus, hormat, penuh kesantunan khas Jawa)";
        } else if (langVal === "jv_ngoko") {
            languageDesc = "Bahasa Jawa Ngoko (Akrab, santai, bahasa pertemanan Jawa sehari-hari yang hangat)";
        } else if (langVal === "ms_melayu") {
            languageDesc = "Bahasa Melayu / Daerah setempat yang sopan dan ramah";
        }
        
        const sys = `Kamu adalah copywriter profesional untuk acara Reuni Alumni Al-Fatah. Buatkan teks broadcast WhatsApp yang sopan, hangat, dan komunikatif.
Wajib menggunakan bahasa: ${languageDesc}.
Wajib menggunakan gaya sapaan pembuka: "${greeting}" (sesuaikan nada kalimat di sekitarnya agar terdengar natural dan mengalir).
Disesuaikan dengan nada suara: "${tone}" berdasarkan instruksi user. Jangan gunakan formatting markdown bold/italic berlebihan karena ini untuk WhatsApp (* untuk bold). Kembalikan TEKS SAJA, jangan dibungkus kutipan atau JSON.`;

        const result = await window.callGeminiAI(prompt, sys);
        const inputField = document.getElementById("broadcast-msg-input");
        if (inputField) {
            inputField.value = result.trim();
            inputField.dispatchEvent(new Event("input"));
        }
        window.closeModal("modal-ai-copywriter");
        window.notify(`Pesan berhasil dibuat oleh AI (${tone})!`, "success");
    } catch(err) {
        console.error(err);
        window.notify("Gagal membuat pesan: " + err.message, "error");
    }
    window.toggleLoading(false);
};

window.scanDuplicatesAI = async () => {
    if(!window.STATE.alumni || window.STATE.alumni.length === 0) {
        return window.notify("Belum ada data alumni.", "error");
    }
    
    window.toggleLoading(true, "Menganalisa kemiripan data alumni...");
    
    // Local Helper Functions
    const getLevDist = (s1, s2) => {
        s1 = (s1 || "").toLowerCase().trim();
        s2 = (s2 || "").toLowerCase().trim();
        if (s1 === s2) return 0;
        if (s1.length === 0) return s2.length;
        if (s2.length === 0) return s1.length;
        
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    };

    const nameSim = (a, b) => {
        const len = Math.max(a.length, b.length);
        if (len === 0) return 1.0;
        return 1.0 - (getLevDist(a, b) / len);
    };

    try {
        const n = window.STATE.alumni.length;
        const adj = Array.from({ length: n }, () => []);

        // Pairwise local comparison to filter candidate clusters
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = window.STATE.alumni[i];
                const b = window.STATE.alumni[j];
                
                const phoneA = (a.nowa || "").replace(/\D/g, "");
                const phoneB = (b.nowa || "").replace(/\D/g, "");
                const samePhone = phoneA && phoneB && phoneA.length >= 8 && phoneB.length >= 8 && (phoneA === phoneB || phoneA.slice(-7) === phoneB.slice(-7));
                
                const nameA = (a.nama || "").toLowerCase().trim();
                const nameB = (b.nama || "").toLowerCase().trim();
                const sim = nameSim(nameA, nameB);
                const sameAngkatan = a.angkatan && b.angkatan && a.angkatan.toString().trim() === b.angkatan.toString().trim();
                
                const nameMatch = sim >= 0.82 && sameAngkatan;
                const containsMatch = (nameA.length > 4 && nameB.length > 4 && (nameA.includes(nameB) || nameB.includes(nameA))) && sameAngkatan;
                
                if (samePhone || nameMatch || containsMatch) {
                    adj[i].push(j);
                    adj[j].push(i);
                }
            }
        }

        // BFS/DFS to cluster suspicious duplicates
        const visited = new Array(n).fill(false);
        const rawClusters = [];

        for (let i = 0; i < n; i++) {
            if (!visited[i]) {
                const component = [];
                const queue = [i];
                visited[i] = true;
                
                while (queue.length > 0) {
                    const curr = queue.shift();
                    component.push(window.STATE.alumni[curr]);
                    for (const neighbor of adj[curr]) {
                        if (!visited[neighbor]) {
                            visited[neighbor] = true;
                            queue.push(neighbor);
                        }
                    }
                }
                if (component.length > 1) {
                    rawClusters.push(component);
                }
            }
        }

        // If no suspicious clusters found locally, return immediately!
        if (rawClusters.length === 0) {
            window.toggleLoading(false);
            return window.notify("Luar biasa! AI tidak menemukan indikasi data ganda.", "success");
        }

        // Update progress dialog to show we are verifying candidate clusters
        window.toggleLoading(true, "AI memvalidasi " + rawClusters.length + " kelompok kandidat duplikat...");

        // Map rich objects to brief data to minimize API payload size and keep it fast/cost-effective
        const dataToSend = rawClusters.map(group => group.map(a => ({
            id: a.id,
            nama: a.nama,
            angkatan: a.angkatan,
            telp: a.nowa
        })));
        
        const prompt = "Berikut adalah daftar kelompok data alumni yang kami curigai duplikat berdasarkan pencocokan awal:\n" +
                       JSON.stringify(dataToSend) +
                       "\n\nTugasmu sebagai asisten database cerdas:\n" +
                       "1. Periksa setiap kelompok. Apakah mereka benar-benar merupakan orang yang sama (duplikat) atau berbeda?\n" +
                       "2. Kembalikan HANYA kelompok yang terkonfirmasi duplikat/ganda dalam bentuk array JSON, contoh format:\n" +
                       "[\n  [{\"id\":\"1\",\"nama\":\"Muh Ali\",\"angkatan\":\"2010\",\"telp\":\"081\"}, {\"id\":\"2\",\"nama\":\"Muhammad Ali\",\"angkatan\":\"2010\",\"telp\":\"081\"}]\n]\n" +
                       "Jika kelompok tersebut bukan duplikat, jangan sertakan dalam respon. Jika tidak ada duplikat sama sekali, kembalikan [].\n" +
                       "Keluarkan HANYA JSON murni tanpa penjelasan atau format markdown ticks seperti ```json.";
                       
        const resultText = await window.callGeminiAI(prompt);
        let cleanJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
        const duplicates = JSON.parse(cleanJson);
        
        if(duplicates.length === 0) {
            window.notify("Luar biasa! AI tidak menemukan indikasi data ganda setelah validasi mendalam.", "success");
        } else {
            // Map AI detected group IDs back to our rich, fully featured STATE.alumni objects!
            const clusters = duplicates.map(group => {
                return group.map(person => {
                    return window.STATE.alumni.find(a => a.id === person.id);
                }).filter(Boolean);
            }).filter(cluster => cluster.length > 1);

            if (clusters.length === 0) {
                window.notify("AI mendeteksi data ganda, namun datanya sudah tidak ada di sistem.", "error");
            } else {
                window.renderDuplicateClusters(clusters);
                window.openModal("modal-duplicates");
                window.notify("AI mendeteksi data ganda! Silakan lakukan resolusi.", "success");
            }
        }
        
    } catch(err) {
        console.error(err);
        window.notify("AI gagal menganalisa: " + err.message, "error");
    }
    window.toggleLoading(false);
};

// ==========================================
// PENGAYAAN 4: BACKUP & RESTORE DATA SATU-KLIK (Excel Multi-Sheet)
// ==========================================
window.backupDataToExcel = () => {
    window.toggleLoading(true, "Mengekspor Berkas Cadangan...");
    try {
        if (!window.STATE.alumni || window.STATE.alumni.length === 0) {
            window.notify("Data alumni kosong, tidak ada yang bisa diekspor.", "error");
            window.toggleLoading(false);
            return;
        }

        // Siapkan Buku Kerja (Workbook) Baru
        const wb = XLSX.utils.book_new();

        // 1. Sheet Alumni
        const alumniData = window.STATE.alumni.map(al => ({ id: al.id, ...al }));
        const wsAlumni = XLSX.utils.json_to_sheet(alumniData);
        XLSX.utils.book_append_sheet(wb, wsAlumni, "Alumni");

        // 2. Sheet Keuangan
        const financeData = (window.STATE.finance || []).map(fn => ({ id: fn.id, ...fn }));
        const wsFinance = XLSX.utils.json_to_sheet(financeData);
        XLSX.utils.book_append_sheet(wb, wsFinance, "Keuangan");

        // 3. Sheet RAB
        const rabData = (window.STATE.rab || []).map(rb => ({ id: rb.id, ...rb }));
        const wsRAB = XLSX.utils.json_to_sheet(rabData);
        XLSX.utils.book_append_sheet(wb, wsRAB, "RAB");

        // Unduh File
        const dateStr = new Date().toISOString().substring(0, 10);
        window.saveExcelFile(wb, `backup_reuni_alfatah_${dateStr}.xlsx`);
    } catch (err) {
        window.notify("Gagal mengekspor cadangan: " + err.message, "error");
        console.error(err);
    }
    window.toggleLoading(false);
};

window.restoreDataFromExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("⚠️ PERINGATAN: Memulihkan cadangan akan menggabungkan/menimpa data di database cloud Firestore. Apakah Anda yakin ingin melanjutkan?")) {
        event.target.value = "";
        return;
    }

    window.toggleLoading(true, "Membaca berkas cadangan...");
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            let restoredAlumni = [];
            let restoredFinance = [];
            let restoredRAB = [];

            if (workbook.SheetNames.includes("Alumni")) {
                restoredAlumni = XLSX.utils.sheet_to_json(workbook.Sheets["Alumni"]);
            }
            if (workbook.SheetNames.includes("Keuangan")) {
                restoredFinance = XLSX.utils.sheet_to_json(workbook.Sheets["Keuangan"]);
            }
            if (workbook.SheetNames.includes("RAB")) {
                restoredRAB = XLSX.utils.sheet_to_json(workbook.Sheets["RAB"]);
            }

            if (restoredAlumni.length === 0 && restoredFinance.length === 0 && restoredRAB.length === 0) {
                throw new Error("Berkas cadangan kosong atau tidak valid.");
            }

            window.toggleLoading(true, "Memulihkan data ke Firestore...");

            // 1. Pulihkan Alumni (Batch 400)
            if (restoredAlumni.length > 0) {
                const chunkSize = 400;
                for (let i = 0; i < restoredAlumni.length; i += chunkSize) {
                    const chunk = restoredAlumni.slice(i, i + chunkSize);
                    const batch = db.batch();
                    chunk.forEach(al => {
                        const docId = al.id || db.collection("alumni").doc().id;
                        const dataToSave = { ...al };
                        delete dataToSave.id; // Jangan masukkan ID ke field document
                        batch.set(db.collection("alumni").doc(docId), dataToSave);
                    });
                    await batch.commit();
                }
            }

            // 2. Pulihkan Keuangan (Batch 400)
            if (restoredFinance.length > 0) {
                const chunkSize = 400;
                for (let i = 0; i < restoredFinance.length; i += chunkSize) {
                    const chunk = restoredFinance.slice(i, i + chunkSize);
                    const batch = db.batch();
                    chunk.forEach(fn => {
                        const docId = fn.id || db.collection("finance").doc().id;
                        const dataToSave = { ...fn };
                        delete dataToSave.id;
                        batch.set(db.collection("finance").doc(docId), dataToSave);
                    });
                    await batch.commit();
                }
            }

            // 3. Pulihkan RAB (Batch 400)
            if (restoredRAB.length > 0) {
                const chunkSize = 400;
                for (let i = 0; i < restoredRAB.length; i += chunkSize) {
                    const chunk = restoredRAB.slice(i, i + chunkSize);
                    const batch = db.batch();
                    chunk.forEach(rb => {
                        const docId = rb.id || db.collection("rab").doc().id;
                        const dataToSave = { ...rb };
                        delete dataToSave.id;
                        batch.set(db.collection("rab").doc(docId), dataToSave);
                    });
                    await batch.commit();
                }
            }

            window.notify(`Restorasi sukses! Alumni: ${restoredAlumni.length}, Transaksi: ${restoredFinance.length}, RAB: ${restoredRAB.length}`, "success");
        } catch (err) {
            window.notify("Gagal memulihkan data: " + err.message, "error");
            console.error(err);
        } finally {
            window.toggleLoading(false);
            event.target.value = "";
        }
    };
    reader.readAsArrayBuffer(file);
};

// ==========================================
// PENGAYAAN EXTRA: ASISTEN AI PINTAR & EXCEL SAVER DUAL-MODE
// ==========================================
window.saveExcelFile = async (wb, fileName) => {
    const CapCore = window.capacitorExports ? window.capacitorExports.Capacitor : window.Capacitor;
    const isNative = CapCore && CapCore.isNativePlatform && CapCore.isNativePlatform();
    
    if (isNative) {
        try {
            const registerPlugin = window.capacitorExports
              ? window.capacitorExports.registerPlugin
              : (window.Capacitor ? window.Capacitor.registerPlugin : null);
            
            if (!registerPlugin) throw new Error("Capacitor registerPlugin tidak ditemukan");
            
            const Filesystem = registerPlugin("Filesystem");
            const Share = registerPlugin("Share");
            
            const base64Data = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
            
            try {
                await Filesystem.requestPermissions();
            } catch(e) {

            }
            
            try {
                // Tulis langsung ke folder public DOWNLOADS
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: "DOWNLOADS"
                });
                window.notify(`Berkas ${fileName} berhasil disimpan di folder Downloads!`, "success");
            } catch (writeErr) {
                console.warn("Write to DOWNLOADS failed, using CACHE + Share fallback:", writeErr);
                
                // Fallback ke CACHE + Share dialog
                const writeResult = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: "CACHE",
                    recursive: true
                });
                
                await Share.share({
                    title: fileName,
                    url: writeResult.uri,
                    dialogTitle: `Simpan Berkas ${fileName} ke...`
                });
                window.notify(`Berkas ${fileName} siap! Silakan pilih lokasi penyimpanan.`, "success");
            }
        } catch (err) {
            console.error("Save Excel Native Error:", err);
            window.notify("Gagal menyimpan berkas: " + (err.message || "Coba lagi"), "error");
        }
    } else {
        // Mode Browser
        try {
            XLSX.writeFile(wb, fileName);
            window.notify(`Berkas ${fileName} berhasil diunduh!`, "success");
        } catch (err) {
            console.error("Save Excel Browser Error:", err);
            window.notify("Gagal mengunduh berkas.", "error");
        }
    }
};

window.selectedPresetTone = "Sopan & Santai";

window.setAiPromptPreset = (topic, text) => {
    const area = document.getElementById("ai-prompt-input");
    if (area) {
        area.value = text;
        window.notify("Topik '" + topic + "' dipilih!", "success");
    }
};

window.setAiPromptTone = (tone) => {
    window.selectedPresetTone = tone;
    const buttons = document.querySelectorAll(".tone-btn");
    buttons.forEach(btn => {
        const btnTone = btn.getAttribute("data-tone");
        if (btnTone === tone) {
            btn.className = "tone-btn px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-bold uppercase transition-all";
        } else {
            btn.className = "tone-btn px-2.5 py-1.5 bg-white/5 text-slate-300 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase transition-all";
        }
    });
};

window.executeAiAction = (actionType, params) => {
    if (actionType === "navigate") {
        const target = params.target;
        if (target) {
            window.showTab(target);
            window.closeModal("modal-tanya-ai");
            window.notify(`Membuka halaman ${target.toUpperCase()}...`, "success");
        }
    } else if (actionType === "search_alumni") {
        const query = params.query;
        if (query) {
            window.showTab("alumni");
            const searchInput = document.getElementById("search-alumni-input");
            const filterAngkatan = document.getElementById("filter-alumni-angkatan");
            
            // Check if query contains the word "angkatan" followed by digits
            const angkatanMatch = query.match(/angkatan\s*(\d+)/i);
            
            if (angkatanMatch) {
                const angNum = angkatanMatch[1];
                if (filterAngkatan) {
                    filterAngkatan.value = angNum;
                }
                if (searchInput) {
                    searchInput.value = ""; // clear name search so it only filters by angkatan
                }
                window.applyAlumniFilters();
                window.closeModal("modal-tanya-ai");
                window.notify(`Menyaring alumni Angkatan ${angNum}...`, "success");
            } else if (/^\d+$/.test(query.trim())) {
                // If it is a pure number, treat it as an angkatan filter
                const num = query.trim();
                if (filterAngkatan) {
                    filterAngkatan.value = num;
                }
                if (searchInput) {
                    searchInput.value = "";
                }
                window.applyAlumniFilters();
                window.closeModal("modal-tanya-ai");
                window.notify(`Menyaring alumni Angkatan ${num}...`, "success");
            } else {
                // Standard name search
                if (filterAngkatan) {
                    filterAngkatan.value = "";
                }
                if (searchInput) {
                    searchInput.value = query;
                }
                window.applyAlumniFilters();
                window.closeModal("modal-tanya-ai");
                window.notify(`Mencari alumni dengan nama "${query}"...`, "success");
            }
        }
    } else if (actionType === "send_wa") {
        const target = params.target;
        const message = params.message;
        if (target && message) {
            if (window.sendWhatsAppInternal) {
                window.sendWhatsAppInternal(target, message)
                    .then(() => {
                        window.notify(`Pesan WhatsApp berhasil dikirim!`, "success");
                    })
                    .catch((err) => {
                        window.notify(`Gagal mengirim WA: ${err.message}`, "error");
                    });
            } else {
                window.notify("Gagal mengirim WA: gateway tidak tersedia.", "error");
            }
        } else {
            window.notify("Parameter pesan WA tidak lengkap.", "error");
        }
    }
};

window.openTanyaAI = () => {
    window.openModal("modal-tanya-ai");
    setTimeout(() => {
        const chatBox = document.getElementById("tanya-ai-messages");
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        const input = document.getElementById("tanya-ai-input");
        if (input) input.focus();
    }, 300);
};

window.sendQuickTanya = (text) => {
    const input = document.getElementById("tanya-ai-input");
    if (input) {
        input.value = text;
        window.handleTanyaAISubmit();
    }
};

window.handleTanyaAISubmit = async (e) => {
    if (e) e.preventDefault();
    const input = document.getElementById("tanya-ai-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    
    // 1. Render User Message
    const chatBox = document.getElementById("tanya-ai-messages");
    if (!chatBox) return;
    
    const userMsg = document.createElement("div");
    userMsg.className = "flex gap-3 justify-end animate-enter";
    userMsg.innerHTML = `
        <div class="bg-indigo-600 border border-indigo-500/30 p-4 rounded-[1.5rem] rounded-tr-none text-xs text-white max-w-[85%] leading-relaxed">
            ${text.replace(/\n/g, "<br>")}
        </div>
        <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0"><i class="fas fa-user text-xs"></i></div>
    `;
    chatBox.appendChild(userMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // 2. Add Typing Indicator
    const typingIndicator = document.createElement("div");
    typingIndicator.id = "tanya-ai-typing";
    typingIndicator.className = "flex gap-3 animate-enter";
    typingIndicator.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0"><i class="fas fa-robot text-sm"></i></div>
        <div class="bg-indigo-500/10 border border-white/5 p-4 rounded-[1.5rem] rounded-tl-none text-xs text-slate-400 max-w-[85%] leading-relaxed flex items-center gap-2">
            <i class="fas fa-spinner fa-spin mr-1"></i> AI sedang menganalisis data reuni...
        </div>
    `;
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    try {
        let totalPemasukan = 0;
        let totalPengeluaran = 0;
        const financeBrief = [];
        
        if (window.STATE.finance && window.STATE.finance.length > 0) {
            window.STATE.finance.forEach(f => {
                const nominal = parseFloat(f.nominal || 0);
                if (f.status === "Pemasukan") {
                    totalPemasukan += nominal;
                } else if (f.status === "Pengeluaran") {
                    totalPengeluaran += nominal;
                }
                if (financeBrief.length < 8) {
                    financeBrief.push({
                        keterangan: f.nama || f.keterangan || "Transaksi",
                        kategori: f.kategori,
                        status: f.status,
                        nominal: nominal
                    });
                }
            });
        }
        
        const saldo = totalPemasukan - totalPengeluaran;
        const totalAlumni = window.STATE.alumni ? window.STATE.alumni.length : 0;
        
        const angkatanMap = {};
        let alumniWithPhone = 0;
        if (window.STATE.alumni) {
            window.STATE.alumni.forEach(a => {
                const angk = a.angkatan || "Tidak Diketahui";
                angkatanMap[angk] = (angkatanMap[angk] || 0) + 1;
                if (a.nowa && a.nowa.trim().length > 5) {
                    alumniWithPhone++;
                }
            });
        }
        
        let totalRab = 0;
        const rabBrief = [];
        if (window.STATE.rab) {
            window.STATE.rab.forEach(r => {
                const nominal = parseFloat(r.biaya || r.nominal || 0);
                totalRab += nominal;
                if (rabBrief.length < 8) {
                    rabBrief.push({
                        nama: r.nama || r.keperluan || "Item",
                        biaya: nominal,
                        status: r.status || "Direncanakan"
                    });
                }
            });
        }
        
        const rundownBrief = [];
        if (window.STATE.rundown) {
            window.STATE.rundown.forEach(r => {
                if (rundownBrief.length < 8) {
                    rundownBrief.push({
                        waktu: r.waktu || r.jam,
                        acara: r.acara || r.nama,
                        keterangan: r.keterangan || ""
                    });
                }
            });
        }
        
        const rundownCount = window.STATE.rundown ? window.STATE.rundown.length : 0;
        
        const formatRupiah = (val) => {
            return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
        };
        
        // Programmatic Financial Projections & Early Warning System
        const deficitProjected = totalRab - totalPemasukan;
        const percentageComplete = totalRab > 0 ? ((totalPemasukan / totalRab) * 100).toFixed(1) : 100;
        
        // Count paying alumni
        const uniquePayingAlumni = new Set();
        if (window.STATE.finance) {
            window.STATE.finance.forEach(f => {
                const status = (f.status || "").toLowerCase();
                if (status === "pemasukan" && f.ref_alumni_id) {
                    uniquePayingAlumni.add(f.ref_alumni_id);
                }
            });
        }
        const payingCount = uniquePayingAlumni.size;
        const paymentRatio = totalAlumni > 0 ? ((payingCount / totalAlumni) * 100).toFixed(1) : 0;
        
        let financialHealthRating = "Sangat Sehat (Aman)";
        if (deficitProjected > 0) {
            if (percentageComplete >= 80) {
                financialHealthRating = "Aman Terkendali (Menuju Target)";
            } else if (percentageComplete >= 50) {
                financialHealthRating = "Cukup Waspada (Perlu Tambahan Pengumpulan Dues)";
            } else {
                financialHealthRating = "Defisit Kritis (Membutuhkan Aksi Cepat / Donasi Besar)";
            }
        }
        
        const warningStatus = deficitProjected > 0 
            ? `🚨 DEFISIT ANGGARAN: Kekurangan dana sebesar ${formatRupiah(deficitProjected)} (${percentageComplete}% tercapai dari total target RAB ${formatRupiah(totalRab)}). Baru ${payingCount} dari ${totalAlumni} alumni terdaftar (${paymentRatio}%) yang memberikan kontribusi keuangan.`
            : `✅ KAS AMAN / SURPLUS: Saldo kas saat ini telah mencukupi seluruh target RAB yang direncanakan!`;

        // Ambil daftar alumni dengan nama dan nomor WA untuk referensi AI (maksimal 100 entri pertama)
        const alumniBrief = (window.STATE.alumni || [])
            .filter(a => a.nama && a.nowa && a.status === "approved")
            .map(a => ({ nama: a.nama, nowa: a.nowa, angkatan: a.angkatan }))
            .slice(0, 100);

        // Ambil daftar grup WA terdaftar dari localStorage
        let waGroupsBrief = [];
        try {
            const storedGroups = localStorage.getItem('wa_registered_groups');
            if (storedGroups) {
                const parsed = JSON.parse(storedGroups);
                waGroupsBrief = parsed.map(g => ({ nama: g.name || g.subject, jid: g.id || g.jid }));
            }
        } catch (e) {
            console.error("Gagal membaca grup WA untuk AI:", e);
        }

        const sysInstruction = `Kamu adalah Asisten AI Reuni Al-Fatah, konsultan cerdas, profesional, dan analis keuangan strategis bagi panitia reuni.
Tugasmu adalah menganalisis data keuangan, statistik alumni, dan rundown secara real-time dan memberikan jawaban secara akurat.

--- DATA REAL-TIME APLIKASI ---
1. DATA KAS KEUANGAN:
   - Saldo Kas Saat Ini: ${formatRupiah(saldo)}
   - Total Pemasukan: ${formatRupiah(totalPemasukan)}
   - Total Pengeluaran: ${formatRupiah(totalPengeluaran)}
   - Contoh Transaksi Terkini: ${JSON.stringify(financeBrief)}

2. DATA STATISTIK ALUMNI:
   - Total Alumni Terdaftar: ${totalAlumni} orang
   - Statistik Per Angkatan: ${JSON.stringify(angkatanMap)}
   - Alumni dengan Kontak WA: ${alumniWithPhone} orang

3. RENCANA ANGGARAN BIAYA (RAB):
   - Total Anggaran Dibutuhkan: ${formatRupiah(totalRab)}
   - Contoh Item Anggaran: ${JSON.stringify(rabBrief)}

4. ACARA / RUNDOWN:
   - Jumlah Kegiatan Rundown: ${rundownCount} kegiatan
   - Rencana Rundown: ${JSON.stringify(rundownBrief)}

5. PROYEKSI & EARLY WARNING SYSTEM (FORECASTING):
   - Status Kesehatan Keuangan: ${financialHealthRating}
   - Rasio Pembayaran Alumni: ${paymentRatio}% (${payingCount} dari ${totalAlumni} alumni berkontribusi)
   - Analisis Defisit: ${warningStatus}

6. REFERENSI KONTAK ALUMNI (Untuk Pengiriman WA):
   - Daftar Alumni Aktif: ${JSON.stringify(alumniBrief)}
   
7. REFERENSI GRUP WHATSAPP TERDAFTAR (Untuk Pengiriman WA):
   - Daftar Grup WA: ${JSON.stringify(waGroupsBrief)}

--- FITUR NAVIGASI & SEARCH DIREKTIF ---
Kamu dapat mengarahkan user ke halaman/menu tertentu secara interaktif atau membantu mencari alumni. Cukup tambahkan baris perintah khusus di bagian akhir jawabanmu dengan format berikut:
1. Jika ingin mengarahkan atau menyarankan user membuka menu tertentu (seperti menu WhatsApp Gateway, RAB, Keuangan Kas, dll):
   Format: [ACTION: navigate, target: <page_id>, label: <Nama Tombol>]
   Pilihan target/page_id yang tersedia:
   - whatsapp (Konfigurasi WhatsApp Gateway / WA Server)
   - alumni (Daftar Data Alumni)
   - rab (Rencana Anggaran Biaya & RAB)
   - finance (Keuangan Kas Pemasukan/Pengeluaran)
   - logistik (Daftar Donasi Barang / Logistik)
   - tugas (Tugas & Progress Panitia)
   - panitia (Daftar Panitia / Struktur)
   - requests (Verifikasi Pendaftaran / Request)
   - settings (Pengaturan & Sistem / Kunci API)
   - rundown (Jadwal Rundown Acara)
   Contoh: [ACTION: navigate, target: whatsapp, label: Buka Konfigurasi WhatsApp]

2. Jika user menanyakan tentang alumni tertentu (mencari nama alumni, angkatan, dll), kamu WAJIB menyertakan perintah pencarian alumni otomatis:
   Format: [ACTION: search_alumni, query: <nama_yang_dicari>, label: Cari '<nama_yang_dicari>' di Alumni]
   Contoh: Jika user bertanya "Cari data Budi", sertakan: [ACTION: search_alumni, query: Budi, label: Cari Budi di Alumni]

3. Jika user meminta untuk mengirim pesan WhatsApp ke alumni tertentu atau ke grup WhatsApp tertentu (misalnya: "Kirim pesan reuni ke Budi" atau "Kirim pengumuman ke grup Pengurus"):
   Format: [ACTION: send_wa, target: <no_wa_atau_jid_grup>, message: "<isi_pesan_yang_ingin_dikirim>", label: "Kirim WA ke <nama_target>"]
   Aturan:
   - Cari target (no_wa alumni atau jid grup) dari REFERENSI KONTAK ALUMNI atau REFERENSI GRUP WHATSAPP di atas yang paling cocok dengan nama/grup yang disebutkan user.
   - Jika target berupa no_wa, pastikan berformat internasional (misal: 628xxx). Jika berupa grup, gunakan JID grup (misal: xxxxx@g.us).
   - Selalu apit nilai parameter 'message' dan 'label' dengan tanda kutip ganda (") jika mengandung tanda koma atau spasi agar parser tidak salah memecah parameter.
   Contoh: [ACTION: send_wa, target: 628123456789, message: "Halo Budi, rapat koordinasi Reuni AL-FATAH akan dimulai jam 19.00 malam ini.", label: "Kirim WA ke Budi"]

--- INSTRUKSI JAWABAN ---
- Berikan analisis keuangan yang sangat tajam, terproyeksi, dan profesional jika ditanya tentang uang/saldo/anggaran.
- Gunakan data pada bagian 'PROYEKSI & EARLY WARNING SYSTEM' untuk menjelaskan kondisi anggaran reuni ke depan. Berikan peringatan dini jika status keuangan kurang aman/kritis.
- PENTING: Anda diperbolehkan menggunakan format matematika LaTeX standar yang bersih (seperti pembungkus $$...$$ untuk matematika display/blok baru, atau $...$ untuk matematika inline) ketika menyajikan rumus matematika, pembagian nominal anggaran, atau perhitungan keuangan. Pastikan sintaks LaTeX Anda lengkap dan valid (jangan ada tanda kurung kurawal menggantung atau rusak) agar dapat dikonversi dengan rapi oleh library KaTeX di frontend.
- Tuliskan pesan broadcast WA yang siap pakai jika user meminta dibuatkan draf/pesan.
- Selalu gunakan Bahasa Indonesia yang sopan, profesional, dan menyemangati panitia.
- Format jawaban menggunakan markdown terstruktur agar sangat mudah dibaca.
- JANGAN TULISKAN aksi navigasi/search/send_wa di dalam blok kode. Tuliskan di akhir jawabanmu di baris tersendiri.`;

        const result = await window.callGeminiAI(text, sysInstruction);
        
        const typNode = document.getElementById("tanya-ai-typing");
        if (typNode) typNode.remove();
        
        // Parse Actions
        const actions = [];
        let match;
        const actionRegex = /\[ACTION:\s*([a-zA-Z_]+)\s*,\s*(.*?)\s*\]/g;
        while ((match = actionRegex.exec(result)) !== null) {
            const type = match[1];
            const paramsStr = match[2];
            const params = {};
            
            // Cocokkan pola: key: "value" ATAU key: 'value' ATAU key: value_tanpa_koma
            const paramRegex = /(\w+)\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^,]+))/g;
            let pMatch;
            while ((pMatch = paramRegex.exec(paramsStr)) !== null) {
                const key = pMatch[1];
                let val = pMatch[2] !== undefined ? pMatch[2] : (pMatch[3] !== undefined ? pMatch[3] : pMatch[4]);
                params[key] = val.trim();
            }
            actions.push({ type, params });
        }
        
        // Clean result text from action tags
        let cleanResult = result.replace(/\[ACTION:.*?\]/g, "").trim();
        
        // Build Action Buttons HTML
        let actionsHtml = "";
        if (actions.length > 0) {
            actionsHtml = `<div class="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-white/10">`;
            actions.forEach(act => {
                const label = act.params.label || (act.type === "navigate" ? "Buka Halaman" : (act.type === "send_wa" ? "Kirim WA" : "Cari Alumni"));
                const icon = act.type === "navigate" ? "fa-arrow-right" : (act.type === "send_wa" ? "fa-paper-plane" : "fa-search");
                const btnClass = act.type === "navigate" 
                    ? "bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 border border-indigo-500/20" 
                    : (act.type === "send_wa" ? "bg-fuchsia-600/30 text-fuchsia-300 hover:bg-fuchsia-600/50 border border-fuchsia-500/20" : "bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 border border-emerald-500/20");
                
                actionsHtml += `
                    <button onclick="window.executeAiAction('${act.type}', ${JSON.stringify(act.params).replace(/"/g, '&quot;')})" 
                            class="${btnClass} px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 duration-200">
                         <i class="fas ${icon}"></i> ${label}
                    </button>
                `;
            });
            actionsHtml += `</div>`;
        }
        
        const aiMsg = document.createElement("div");
        aiMsg.className = "flex gap-3 animate-enter";
        aiMsg.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0"><i class="fas fa-robot text-sm"></i></div>
            <div class="bg-indigo-500/10 border border-white/5 p-4 rounded-[1.5rem] rounded-tl-none text-xs text-slate-300 max-w-[85%] leading-relaxed flex flex-col">
                <div class="markdown-body flex-1">${parseMarkdown(cleanResult)}</div>
                ${actionsHtml}
            </div>
        `;
        chatBox.appendChild(aiMsg);
        
        // Render LaTeX equations using KaTeX if loaded
        if (window.renderMathInElement) {
            try {
                window.renderMathInElement(aiMsg, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false
                });
            } catch (katexErr) {
                console.error("[KaTeX] Error rendering math:", katexErr);
            }
        }
        
        chatBox.scrollTop = chatBox.scrollHeight;
        
        // Auto-execute search_alumni if present
        actions.forEach(act => {
            if (act.type === "search_alumni") {
                setTimeout(() => {
                    window.executeAiAction(act.type, act.params);
                }, 1000);
            }
        });
        
    } catch(err) {
        console.error(err);
        const typNode = document.getElementById("tanya-ai-typing");
        if (typNode) typNode.remove();
        
        const aiMsg = document.createElement("div");
        aiMsg.className = "flex gap-3 animate-enter";
        aiMsg.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0"><i class="fas fa-exclamation-triangle text-sm"></i></div>
            <div class="bg-red-500/10 border border-red-500/20 p-4 rounded-[1.5rem] rounded-tl-none text-xs text-red-300 max-w-[85%] leading-relaxed">
                Asisten AI mengalami kendala: ${err.message}
            </div>
        `;
        chatBox.appendChild(aiMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
};

const parseMarkdown = (text) => {
    if (!text) return "";
    let html = text;
    // Escape HTML to prevent XSS
    html = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic: *text*
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, "<li class='ml-4 list-disc'>$1</li>");
    // Wrap lists
    html = html.replace(/(<li.*?>.*?<\/li>)/gs, "<ul class='my-2 space-y-1'>$1</ul>");
    html = html.replace(/<\/ul>\s*<ul.*?>/g, "");
    
    // Headers
    html = html.replace(/^###\s+(.*)$/gm, "<h4 class='text-sm font-bold text-indigo-400 mt-3 mb-1 uppercase'>$1</h4>");
    html = html.replace(/^##\s+(.*)$/gm, "<h3 class='text-base font-black text-indigo-300 mt-4 mb-2 uppercase'>$1</h3>");
    html = html.replace(/^#\s+(.*)$/gm, "<h2 class='text-lg font-black text-white mt-5 mb-2 border-b border-white/10 pb-1 uppercase'>$1</h2>");
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, "<pre class='bg-black/40 border border-white/10 p-3 rounded-xl font-mono text-[10px] text-emerald-400 overflow-x-auto my-3 whitespace-pre-wrap'>$1</pre>");
    // Inline code
    html = html.replace(/`(.*?)`/g, "<code class='bg-black/30 border border-white/5 px-1.5 py-0.5 rounded font-mono text-[10px] text-emerald-300'>$1</code>");
    
    // Newlines to br
    html = html.replace(/\n/g, "<br>");
    html = html.replace(/(<br>\s*){2,}/g, "<br><br>");
    
    return html;
};

// ==========================================
// RUNDOWN LIVE TRACKER (DURASIONAL & OFFLINE)
// ==========================================
window.updateLiveRundownTracker = () => {
    const container = document.getElementById("rundown-live-tracker");
    if (!container) return;
    
    if (!window.STATE.rundown || window.STATE.rundown.length === 0) {
        container.classList.add("hidden");
        return;
    }
    
    // Sort rundown events by time
    const sorted = [...window.STATE.rundown].sort((a, b) => String(a.waktu).localeCompare(String(b.waktu)));
    
    const now = new Date();
    const currHour = now.getHours();
    const currMin = now.getMinutes();
    const currTotalMin = currHour * 60 + currMin;
    
    // Helper to parse time string like "08:00", "08.00", "08:00 - 09:00"
    const parseTime = (timeStr) => {
        const matches = [...timeStr.matchAll(/(\d{2})[:\.](\d{2})/g)];
        if (matches.length >= 2) {
            const start = parseInt(matches[0][1]) * 60 + parseInt(matches[0][2]);
            const end = parseInt(matches[1][1]) * 60 + parseInt(matches[1][2]);
            return { start, end };
        } else if (matches.length === 1) {
            const start = parseInt(matches[0][1]) * 60 + parseInt(matches[0][2]);
            return { start, end: start + 60 }; // Assume 60 mins duration
        }
        return null;
    };
    
    const parsedEvents = sorted.map((r, index) => {
        const parsed = parseTime(r.waktu || "");
        return {
            original: r,
            start: parsed ? parsed.start : (index * 60),
            end: parsed ? parsed.end : (index * 60 + 60)
        };
    });
    
    // Adjust end times for events without explicit end times (make it go until the next event starts)
    for (let i = 0; i < parsedEvents.length; i++) {
        const currentParsed = parseTime(parsedEvents[i].original.waktu || "");
        if (currentParsed && currentParsed.start === currentParsed.end - 60 && i < parsedEvents.length - 1) {
            // No explicit end time found (only one time match), extend until next event
            const nextParsed = parseTime(parsedEvents[i+1].original.waktu || "");
            if (nextParsed) {
                parsedEvents[i].end = nextParsed.start;
            }
        }
    }
    
    // Find current event
    let currentEvent = parsedEvents.find(e => currTotalMin >= e.start && currTotalMin < e.end);
    
    // Find next event (first event that hasn't started yet)
    let nextEvent = parsedEvents.find(e => currTotalMin < e.start);
    
    if (!currentEvent && !nextEvent) {
        // All events completed
        container.innerHTML = `
            <div class="bg-black/25 p-4 rounded-[2rem] border border-white/5 text-center text-xs text-slate-400 italic mb-2 animate-enter">
                <i class="fas fa-check-circle text-emerald-500 mr-1"></i> Semua agenda rundown hari ini telah selesai. Tetap semangat panitia!
            </div>
        `;
        container.classList.remove("hidden");
        return;
    }
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gradient-to-r from-slate-900 to-indigo-950/70 p-5 rounded-[2rem] border border-indigo-500/20 shadow-lg mb-2 animate-enter">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center animate-pulse"><i class="fas fa-play text-xs"></i></div>
            <div>
              <span class="text-[8px] font-black uppercase text-indigo-400 tracking-wider">Acara Sekarang</span>
              <h4 class="text-sm font-black text-white mt-0.5">${currentEvent ? currentEvent.original.kegiatan : 'Istirahat / Agenda Bebas'}</h4>
              <p class="text-[10px] text-slate-400">${currentEvent ? currentEvent.original.waktu : '-'}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-5">
            <div class="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center"><i class="fas fa-forward text-xs"></i></div>
            <div>
              <span class="text-[8px] font-black uppercase text-slate-500 tracking-wider">Acara Berikutnya</span>
              <h4 class="text-sm font-bold text-slate-300 mt-0.5">${nextEvent ? nextEvent.original.kegiatan : 'Tidak ada agenda berikutnya'}</h4>
              <p class="text-[10px] text-slate-400">${nextEvent ? nextEvent.original.waktu : '-'}</p>
            </div>
          </div>
        </div>
    `;
    container.classList.remove("hidden");
};

// Set up interval for Rundown live updates
setInterval(() => {
    const rundownTab = document.getElementById("tab-rundown");
    if (rundownTab && !rundownTab.classList.contains("hidden")) {
        window.updateLiveRundownTracker();
    }
}, 30000);

// ==========================================
// RUNDOWN AI GENERATOR
// ==========================================
window.generateRundownAI = async (e) => {
    if (e) e.preventDefault();
    
    const konsepEl = document.getElementById("ai-rundown-konsep");
    if (!konsepEl || !konsepEl.value) return;
    
    const konsep = konsepEl.value.trim();
    window.closeModal("modal-ai-rundown");
    window.toggleLoading(true, "AI sedang merancang jadwal rundown acara Anda...");
    
    try {
        const sysInstruction = `Kamu adalah Event Organizer profesional.
Tugasmu membuat susunan acara (rundown) yang logis, rapi, dan terstruktur berdasarkan konsep yang diberikan.
PENTING: Output HANYA boleh berupa array JSON murni tanpa markdown \`\`\`json. Format JSON yang wajib:
[
  { "waktu": "08:00 - 09:00", "kegiatan": "Registrasi", "keterangan": "Peserta datang dan daftar ulang" }
]
Jangan tambahkan teks apapun selain array JSON tersebut.`;
        
        const prompt = `Buatkan rundown acara untuk konsep berikut: "${konsep}". 
Pastikan urutan waktunya masuk akal, dan berikan keterangan singkat yang sesuai. Keluarkan murni dalam format array JSON sesuai instruksi.`;
        
        const result = await window.callGeminiAI(prompt, sysInstruction);
        
        // Bersihkan output AI barangkali ada sisa markdown
        let cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
        const rundownData = JSON.parse(cleanJson);
        
        if (!Array.isArray(rundownData) || rundownData.length === 0) {
            throw new Error("Format JSON AI tidak sesuai");
        }
        
        // Simpan ke Firebase (loop batch atau satuan)
        let count = 0;
        for (const item of rundownData) {
            await db.collection("rundown").add({
                waktu: item.waktu || "",
                kegiatan: item.kegiatan || "",
                keterangan: item.keterangan || ""
            });
            count++;
        }
        
        window.notify(`Berhasil membuat & menyimpan ${count} jadwal rundown!`, "success");
        konsepEl.value = ""; // Reset form
        
    } catch (err) {
        console.error("Rundown AI Error:", err);
        window.notify("Gagal meng-generate rundown. Coba gunakan deskripsi yang lebih jelas.", "error");
    } finally {
        window.toggleLoading(false);
    }
};

// ==========================================
// FILTER & METRIK ALUMNI (Angkatan, Status, Lembaga, Kabupaten)
// ==========================================
window.populateAlumniFilters = () => {
    const selectAngkatan = document.getElementById("filter-alumni-angkatan");
    if (!selectAngkatan) return;
    const currentVal = selectAngkatan.value;
    // Kumpulkan angkatan unik
    const angkatanSet = new Set(
        window.STATE.alumni.map(a => a.angkatan).filter(Boolean)
    );
    const sorted = [...angkatanSet].sort((a, b) => a - b);
    selectAngkatan.innerHTML = `<option value="">Semua Angkatan</option>`;
    sorted.forEach(ang => {
        const opt = document.createElement("option");
        opt.value = ang;
        opt.textContent = `Angkatan ${ang}`;
        if (String(ang) === String(currentVal)) opt.selected = true;
        selectAngkatan.appendChild(opt);
    });
};

// ==========================================
// NORMALISASI NAMA WILAYAH
// Menghapus prefix 'KABUPATEN/KOTA/KAB.' dan konversi ke Title Case
// Sehingga 'KABUPATEN PURWAKARTA', 'purwakarta', 'Purwakarta' menjadi 'Purwakarta'
// ==========================================
window.normalizeWilayahName = (name) => {
    if (!name) return "";
    const stripped = name
        .trim()
        // Hapus prefix KABUPATEN, KOTA, KAB., KAB (dengan atau tanpa spasi/titik)
        .replace(/^(KABUPATEN|KOTA|KAB\.|KAB|KEC\.|KEC|KECAMATAN|DESA|KEL\.|KELURAHAN)\s+/i, "")
        .trim();
    // Terapkan normalisasi typo khusus (Tegal Waru, Plered, Sukatani, dll)
    return window.normalizeWilayah(stripped);
};

window.populateKabupatenFilter = () => {
    const selectKabupaten = document.getElementById("filter-kabupaten");
    if (!selectKabupaten) return;
    const currentVal = selectKabupaten.value;
    
    // Kumpulkan kabupaten unik dari approved alumni — dinormalisasi dulu
    const kabupatenMap = new Map(); // normalized -> original (pertama ditemukan)
    window.STATE.alumni.forEach(a => {
        const kab = (a.kabupaten || "").trim();
        if (!kab || kab === "-" || kab.toLowerCase() === "kabupaten") return;
        const normalized = window.normalizeWilayahName(kab);
        if (normalized && !kabupatenMap.has(normalized)) {
            kabupatenMap.set(normalized, normalized);
        }
    });
    
    const sorted = [...kabupatenMap.keys()].sort((a, b) => a.localeCompare(b));
    selectKabupaten.innerHTML = `<option value="">Semua Kabupaten</option>`;
    sorted.forEach(kab => {
        const opt = document.createElement("option");
        opt.value = kab;
        opt.textContent = kab;
        // Cocokkan dengan normalisasi juga secara case-insensitive
        const normCurrent = window.normalizeWilayahName(currentVal || "");
        if (kab === currentVal || 
            (kab && currentVal && kab.toUpperCase() === currentVal.toUpperCase()) ||
            (normCurrent && kab && normCurrent.toUpperCase() === kab.toUpperCase())) {
            opt.selected = true;
        }
        selectKabupaten.appendChild(opt);
    });
};

window.populateProvinsiFilter = () => {
    const selectProvinsi = document.getElementById("filter-provinsi");
    if (!selectProvinsi) return;
    const currentVal = selectProvinsi.value;
    
    const provSet = new Set();
    window.STATE.alumni.forEach(a => {
        const prov = (a.provinsi || "").trim();
        if (prov && prov !== "-") provSet.add(prov);
    });
    
    const sorted = [...provSet].sort((a, b) => a.localeCompare(b));
    selectProvinsi.innerHTML = `<option value="">Semua Provinsi</option>`;
    sorted.forEach(prov => {
        const opt = document.createElement("option");
        opt.value = prov;
        opt.textContent = prov;
        if (prov === currentVal || (prov && currentVal && prov.toUpperCase() === currentVal.toUpperCase())) opt.selected = true;
        selectProvinsi.appendChild(opt);
    });
};

// Ketika filter provinsi berubah: update kabupaten dropdown sesuai provinsi, lalu apply filters
window.onFilterProvinsiChange = () => {
    const selProv = document.getElementById("filter-provinsi");
    const selKab = document.getElementById("filter-kabupaten");
    const provVal = selProv ? selProv.value : "";
    
    if (selKab) {
        const currentKab = selKab.value;
        const kabMap = new Map();
        window.STATE.alumni.forEach(a => {
            const prov = (a.provinsi || "").trim();
            const kab = (a.kabupaten || "").trim();
            if (!provVal || prov.toLowerCase() === provVal.toLowerCase()) {
                if (kab && kab !== "-" && kab.toLowerCase() !== "kabupaten") {
                    const normalized = window.normalizeWilayahName(kab);
                    if (normalized && !kabMap.has(normalized)) kabMap.set(normalized, normalized);
                }
            }
        });
        const sorted = [...kabMap.keys()].sort((a, b) => a.localeCompare(b));
        selKab.innerHTML = `<option value="">Semua Kabupaten</option>`;
        sorted.forEach(kab => {
            const opt = document.createElement("option");
            opt.value = kab;
            opt.textContent = kab;
            if (kab === currentKab || (kab && currentKab && kab.toUpperCase() === currentKab.toUpperCase())) opt.selected = true;
            selKab.appendChild(opt);
        });
    }
    
    window.applyAlumniFilters();
};

window.updateAlumniMetrics = () => {
    // 1. Total Alumni (approved)
    const totalAlumni = window.STATE.alumni.length;
    const totalEl = document.getElementById("metric-total-alumni");
    if (totalEl) totalEl.textContent = totalAlumni;

    // 2. Distribusi Lembaga (MA | MTs)
    let maCount = 0;
    let mtsCount = 0;
    window.STATE.alumni.forEach(a => {
        const lb = String(a.lembaga || "").toUpperCase().trim();
        if (lb === "MA") maCount++;
        else if (lb === "MTS") mtsCount++;
    });
    const distEl = document.getElementById("metric-distribusi-lembaga");
    if (distEl) distEl.textContent = `${maCount} MA | ${mtsCount} MTs`;

    // 3. Wilayah Teraktif (Kabupaten terbanyak)
    const kabMap = {};
    window.STATE.alumni.forEach(a => {
        const kab = (a.kabupaten || "").trim().toUpperCase();
        if (kab && kab !== "-" && kab !== "KABUPATEN") {
            kabMap[kab] = (kabMap[kab] || 0) + 1;
        }
    });
    let topKab = "-";
    let maxCount = 0;
    for (const k in kabMap) {
        if (kabMap[k] > maxCount) {
            maxCount = kabMap[k];
            topKab = k;
        }
    }
    if (topKab !== "-") {
        // Title Case formatting
        topKab = topKab.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
    const wilEl = document.getElementById("metric-wilayah-aktif");
    if (wilEl) wilEl.textContent = topKab;

    // 4. Total Dana Masuk
    const totalDonasi = window.STATE.alumni.reduce((sum, a) => sum + (a.totalDonasi || 0), 0);
    const donasiEl = document.getElementById("metric-total-donasi");
    if (donasiEl) donasiEl.textContent = window.formatRupiah(totalDonasi);
};

window.applyAlumniFilters = (keepPage = false) => {
    const angkatan = document.getElementById("filter-alumni-angkatan")?.value || "";
    const lembaga = document.getElementById("filter-lembaga")?.value || "";
    const provinsi = document.getElementById("filter-provinsi")?.value || "";
    const kabupaten = document.getElementById("filter-kabupaten")?.value || "";
    const kelengkapan = document.getElementById("filter-kelengkapan")?.value || "";
    const searchVal = (document.getElementById("search-alumni-input")?.value || "").toLowerCase().trim();

    const matched = [];
    window.STATE.alumni.forEach((a) => {
        const matchAngkatan = !angkatan || String(a.angkatan) === String(angkatan);
        let matchLembaga = false;
        if (!lembaga) {
            matchLembaga = true;
        } else if (lembaga === "tanpa_lembaga") {
            matchLembaga = !a.lembaga || String(a.lembaga).trim() === "" || String(a.lembaga).trim() === "-";
        } else {
            matchLembaga = String(a.lembaga || "").toUpperCase().trim() === String(lembaga).toUpperCase().trim();
        }
        const matchProvinsi = !provinsi || String(a.provinsi || "").trim().toLowerCase() === String(provinsi).trim().toLowerCase();
        const matchKabupaten = !kabupaten || window.normalizeWilayahName(a.kabupaten || "").toLowerCase() === window.normalizeWilayahName(kabupaten).toLowerCase();
        
        const hasLengkap = !!(
            a.nama && a.nama.trim() &&
            a.angkatan && String(a.angkatan).trim() &&
            a.lembaga && a.lembaga.trim() &&
            a.nowa && a.nowa.trim() &&
            a.provinsi && a.provinsi.trim() && a.provinsi !== "-" &&
            a.kabupaten && a.kabupaten.trim() && a.kabupaten !== "-" &&
            a.kecamatan && a.kecamatan.trim() && a.kecamatan !== "-" &&
            a.desa && a.desa.trim() && a.desa !== "-" &&
            a.alamat && a.alamat.trim() && a.alamat !== "-"
        );
        const matchKelengkapan = !kelengkapan || (kelengkapan === "lengkap" ? hasLengkap : !hasLengkap);

        if (!matchAngkatan || !matchLembaga || !matchProvinsi || !matchKabupaten || !matchKelengkapan) return;

        let score = 0;
        let isMatch = false;

        if (!searchVal) {
            isMatch = true;
            score = 0;
        } else {
            const n = String(a.nama || "").toLowerCase();
            const ang = String(a.angkatan || "");
            const wa = String(a.nowa || "");
            const alm = String(a.alamat || "").toLowerCase();
            const des = String(a.desa || "").toLowerCase();
            const kec = String(a.kecamatan || "").toLowerCase();
            const kab = String(a.kabupaten || "").toLowerCase();
            const fullAddress = `${alm} ${des} ${kec} ${kab}`.trim();

            if (n === searchVal) {
                score = 100;
                isMatch = true;
            } else if (n.startsWith(searchVal)) {
                score = 80;
                isMatch = true;
            } else if (n.includes(" " + searchVal)) {
                score = 60;
                isMatch = true;
            } else if (
                n.includes(searchVal) || 
                ang.includes(searchVal) || 
                wa.includes(searchVal) || 
                fullAddress.includes(searchVal)
            ) {
                score = 40;
                isMatch = true;
            } else if (searchVal.length >= 3) {
                const qWords = searchVal.split(" ").filter((w) => w.length > 0);
                const nWords = n.split(" ");
                const isFuzzyMatch = qWords.every((qw) => {
                    return nWords.some((nw) => {
                        if (qw.length < 3) return nw.includes(qw);
                        const distance = window.levenshtein(nw, qw);
                        const maxTypos = qw.length >= 4 ? 2 : 1;
                        return distance <= maxTypos || nw.includes(qw);
                    });
                });
                if (isFuzzyMatch) {
                    score = 20;
                    isMatch = true;
                }
            }
        }

        if (isMatch) {
            a.searchScore = score;
            matched.push({ alumni: a, score: score });
        }
    });

    // Urutkan berdasarkan skor tertinggi, lalu nama secara alfabetis
    matched.sort((x, y) => {
        if (y.score !== x.score) return y.score - x.score;
        return String(x.alumni.nama || "").localeCompare(String(y.alumni.nama || ""));
    });

    window.filteredAlumniData = matched.map((x) => x.alumni);

    // Tampilkan label hasil filter
    const countEl = document.getElementById("alumni-filter-count");
    if (countEl) {
        const total = window.filteredAlumniData.length;
        const isFiltered = angkatan || lembaga || provinsi || kabupaten || kelengkapan || searchVal;
        if (isFiltered) {
            countEl.textContent = `${total} hasil ditemukan`;
            countEl.classList.remove("hidden");
        } else {
            countEl.classList.add("hidden");
        }
    }

    if (window.sortConfig && window.sortConfig.alumni && typeof window.sortAlumni === "function") {
        const targetPage = keepPage ? window.currentAlumniPage : 1;
        window.sortAlumni(window.sortConfig.alumni.key, true);
        
        const maxPage = Math.max(1, Math.ceil(window.filteredAlumniData.length / window.ALUMNI_PER_PAGE));
        window.currentAlumniPage = Math.min(targetPage, maxPage);
        window.renderAlumniTable();
    } else {
        if (!keepPage) {
            window.currentAlumniPage = 1;
        } else {
            const maxPage = Math.max(1, Math.ceil(window.filteredAlumniData.length / window.ALUMNI_PER_PAGE));
            window.currentAlumniPage = Math.min(window.currentAlumniPage, maxPage);
        }
        window.renderAlumniTable();
    }
};

window.resetAlumniFilters = () => {
    const ang = document.getElementById("filter-alumni-angkatan");
    const lemb = document.getElementById("filter-lembaga");
    const prov = document.getElementById("filter-provinsi");
    const kab = document.getElementById("filter-kabupaten");
    const kel = document.getElementById("filter-kelengkapan");
    const srch = document.getElementById("search-alumni-input");
    if (ang) ang.value = "";
    if (lemb) lemb.value = "";
    if (prov) prov.value = "";
    if (kab) kab.value = "";
    if (kel) kel.value = "";
    if (srch) srch.value = "";
    // Juga repopulate kabupaten filter (semua kabupaten)
    window.populateKabupatenFilter();
    window.filteredAlumniData = [...window.STATE.alumni];
    const countEl = document.getElementById("alumni-filter-count");
    if (countEl) countEl.classList.add("hidden");
    window.currentAlumniPage = 1;
    window.renderAlumniTable();
};

// ==========================================
// MODUL TUGAS PANITIA
// ==========================================
window.STATE.tugas = [];

// Listener Firebase real-time untuk tugas
if (typeof db !== "undefined") {
    db.collection("tugas").orderBy("createdAt", "asc").onSnapshot(snap => {
        window.STATE.tugas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        window.renderTugasTable();
        window.updateTugasBadge();
        // Cek tugas overdue secara client-side untuk notifikasi
        if (typeof window.checkClientOverdueTasks === "function") window.checkClientOverdueTasks();
    }, err => console.error("Tugas listener error:", err));
}

window.updateTugasBadge = () => {
    const badge = document.getElementById("badge-tugas");
    if (!badge) return;
    const belum = window.STATE.tugas.filter(t => t.status === "belum" || t.status === "proses").length;
    if (belum > 0) {
        badge.textContent = belum;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
};

window.renderTugasTable = () => {
    const tbody = document.getElementById("tugas-list");
    if (!tbody) return;

    const filterDivisi = document.getElementById("filter-tugas-divisi")?.value || "";
    const filterStatus = document.getElementById("filter-tugas-status")?.value || "";

    let data = window.STATE.tugas.filter(t => {
        const matchDiv = !filterDivisi || t.divisi === filterDivisi;
        const matchSt = !filterStatus || t.status === filterStatus;
        return matchDiv && matchSt;
    });

    // Update progress bar
    const total = window.STATE.tugas.length;
    const selesai = window.STATE.tugas.filter(t => t.status === "selesai").length;
    const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;
    const bar = document.getElementById("tugas-progress-bar");
    const label = document.getElementById("tugas-progress-label");
    if (bar) bar.style.width = pct + "%";
    if (label) label.textContent = `${selesai} / ${total} Selesai (${pct}%)`;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 text-xs italic">Belum ada tugas. Klik "Tambah Tugas" untuk memulai.</td></tr>`;
        return;
    }

    const statusColor = { belum: "bg-slate-500/20 text-slate-400", proses: "bg-amber-500/20 text-amber-400", selesai: "bg-emerald-500/20 text-emerald-400" };
    const statusLabel = { belum: "Belum Dimulai", proses: "Sedang Proses", selesai: "✓ Selesai" };
    const divisiColor = { Acara: "text-indigo-400", Konsumsi: "text-orange-400", Perlengkapan: "text-blue-400", Dokumentasi: "text-purple-400", Humas: "text-emerald-400", Keuangan: "text-amber-400", Lainnya: "text-slate-400" };

    tbody.innerHTML = data.map(t => {
        const dl = t.deadline ? new Date(t.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
        const isOverdue = t.deadline && t.status !== "selesai" && new Date(t.deadline) < new Date();
        const safeStr = encodeURIComponent(JSON.stringify(t)).replace(/'/g, "%27");
        return `<tr class="hover:bg-white/5 transition-colors">
          <td class="p-5">
            <p class="font-bold text-white text-sm">${t.nama || ""}</p>
            ${t.catatan ? `<p class="text-slate-500 text-[10px] mt-0.5 italic">${t.catatan}</p>` : ""}
          </td>
          <td class="p-5 text-center"><span class="text-[10px] font-black uppercase ${divisiColor[t.divisi] || "text-slate-400"}">${t.divisi || "-"}</span></td>
          <td class="p-5 text-center"><span class="text-xs ${isOverdue ? "text-red-400 font-bold" : "text-slate-400"}">${isOverdue ? "⚠ " : ""}${dl}</span></td>
          <td class="p-5 text-center">
            <select onchange="window.updateStatusTugas('${t.id}', this.value)" class="text-[10px] font-black px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${statusColor[t.status] || "bg-slate-500/20 text-slate-400"}">
              <option value="belum" ${t.status==="belum"?"selected":""}>Belum Dimulai</option>
              <option value="proses" ${t.status==="proses"?"selected":""}>Sedang Proses</option>
              <option value="selesai" ${t.status==="selesai"?"selected":""}>✓ Selesai</option>
            </select>
          </td>
          <td class="p-5 text-center">
            <button onclick="window.openModalTugas('${safeStr}')" class="w-7 h-7 bg-amber-500/10 text-amber-500 rounded hover:bg-amber-500 hover:text-white mr-1" title="Edit"><i class="fas fa-edit text-[10px]"></i></button>
            <button onclick="window.deleteTugas('${t.id}')" class="w-7 h-7 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white" title="Hapus"><i class="fas fa-trash-alt text-[10px]"></i></button>
          </td>
        </tr>`;
    }).join("");
};

window.openModalTugas = (dataStr) => {
    const titleEl = document.getElementById("modal-tugas-title");
    if (dataStr) {
        const t = JSON.parse(decodeURIComponent(dataStr));
        document.getElementById("tugas-edit-id").value = t.id || "";
        document.getElementById("tugas-nama").value = t.nama || "";
        document.getElementById("tugas-divisi").value = t.divisi || "";
        document.getElementById("tugas-status").value = t.status || "belum";
        document.getElementById("tugas-deadline").value = t.deadline || "";
        document.getElementById("tugas-catatan").value = t.catatan || "";
        if (titleEl) titleEl.textContent = "Edit Tugas";
    } else {
        document.getElementById("form-tugas").reset();
        document.getElementById("tugas-edit-id").value = "";
        if (titleEl) titleEl.textContent = "Tambah Tugas";
    }
    window.openModal("modal-tugas");
};

window.handleTugasSubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById("tugas-edit-id").value;
    const nama = document.getElementById("tugas-nama").value.trim();
    const divisi = document.getElementById("tugas-divisi").value;
    const status = document.getElementById("tugas-status").value;
    const deadline = document.getElementById("tugas-deadline").value;
    const catatan = document.getElementById("tugas-catatan").value.trim();

    if (!nama) return window.notify("Nama tugas tidak boleh kosong!", "error");
    if (!divisi) return window.notify("Pilih divisi terlebih dahulu!", "error");

    const data = { nama, divisi, status, deadline, catatan, updatedAt: new Date().toISOString() };
    window.toggleLoading(true, "Menyimpan tugas...");
    try {
        if (id) {
            await db.collection("tugas").doc(id).update(data);
        } else {
            data.createdAt = new Date().toISOString();
            await db.collection("tugas").add(data);
        }
        window.closeModal("modal-tugas");
        window.notify("Tugas berhasil disimpan!", "success");
    } catch (err) {
        window.notify("Gagal menyimpan tugas: " + err.message, "error");
    } finally {
        window.toggleLoading(false);
    }
};

window.updateStatusTugas = async (id, newStatus) => {
    try {
        await db.collection("tugas").doc(id).update({ status: newStatus, updatedAt: new Date().toISOString() });
        const label = { belum: "Belum Dimulai", proses: "Sedang Proses", selesai: "Selesai" };
        window.notify(`Status diperbarui: ${label[newStatus]}`, "success");
    } catch (err) {
        window.notify("Gagal update status: " + err.message, "error");
    }
};

window.deleteTugas = async (id) => {
    if (!confirm("Yakin hapus tugas ini?")) return;
    try {
        await db.collection("tugas").doc(id).delete();
        window.notify("Tugas dihapus.", "success");
    } catch (err) {
        window.notify("Gagal hapus: " + err.message, "error");
    }
};

// ==========================================
// ZERO-SERVER LOCAL NOTIFICATION SYSTEM
// ==========================================
window.APP_START_TIME = Date.now();
window.notifiedOverdueTasks = new Set();

window.initLocalNotifications = async () => {
    try {
        const CapCore = window.capacitorExports ? window.capacitorExports.Capacitor : window.Capacitor;
        const isAndroidApp = CapCore && CapCore.isNativePlatform && CapCore.isNativePlatform();
        
        if (!isAndroidApp) {

            return;
        }

        const registerPlugin = (CapCore && CapCore.registerPlugin) ? CapCore.registerPlugin : (window.capacitorExports ? window.capacitorExports.registerPlugin : null);
        if (!registerPlugin) {
            console.warn("LocalNotif: registerPlugin not found.");
            return;
        }

        const LocalNotifications = registerPlugin('LocalNotifications');
        if (!LocalNotifications) {
            console.warn("LocalNotif: LocalNotifications native plugin not found.");
            return;
        }

        // Request permissions
        const permStatus = await LocalNotifications.requestPermissions();
        if (permStatus.display !== 'granted') {
            console.warn("LocalNotif: Display permission not granted.");
        } else {

        }
    } catch (err) {
        console.error("LocalNotif: Failed to initialize Local Notifications:", err);
    }
};

window.triggerLocalNotification = async (title, body, extraData = {}) => {
    try {
        const CapCore = window.capacitorExports ? window.capacitorExports.Capacitor : window.Capacitor;
        const isAndroidApp = CapCore && CapCore.isNativePlatform && CapCore.isNativePlatform();
        
        if (!isAndroidApp) {
            // Show custom in-app notification for browser
            window.notify(`🔔 ${title}: ${body}`, "success");
            return;
        }

        const registerPlugin = (CapCore && CapCore.registerPlugin) ? CapCore.registerPlugin : (window.capacitorExports ? window.capacitorExports.registerPlugin : null);
        if (!registerPlugin) return;

        const LocalNotifications = registerPlugin('LocalNotifications');
        if (!LocalNotifications) return;

        await LocalNotifications.schedule({
            notifications: [
                {
                    title: title,
                    body: body,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: new Date(Date.now() + 500) },
                    sound: 'default',
                    smallIcon: 'ic_stat_logo',
                    largeIcon: 'ic_stat_logo',
                    attachments: [],
                    actionTypeId: "",
                    extra: extraData
                }
            ]
        });
        
        // Also show in-app toast for perfect consistency
        window.notify(`🔔 ${title}: ${body}`, "success");
    } catch (err) {
        console.error("LocalNotif: Failed to schedule local notification:", err);
    }
};

window.checkClientOverdueTasks = () => {
    if (!window.STATE.tugas || window.STATE.tugas.length === 0) return;
    const now = new Date();
    window.STATE.tugas.forEach(t => {
        if (t.status !== "selesai" && t.deadline) {
            const dlDate = new Date(t.deadline);
            if (dlDate < now && !window.notifiedOverdueTasks.has(t.id)) {
                window.triggerLocalNotification(
                    "⚠️ Tugas Overdue!",
                    `Tugas "${t.nama || ""}" (Divisi: ${t.divisi || ""}) telah melewati deadline.`
                );
                window.notifiedOverdueTasks.add(t.id);
            }
        }
    });
};
window.logActivity = async (action, details) => {
    try {
        const user = window.STATE.user;
        if (!user) return;
        
        const logData = {
            operator_email: user.email || "unknown@reuni.com",
            operator_name: user.nama || user.email.split('@')[0],
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        };
        await db.collection("audit_logs").add(logData);

    } catch (e) {
        console.error("[AUDIT] Failed to save audit log:", e);
    }
};

window.STATE.auditLogs = [];
window.renderAuditLogsTable = (logs) => {
    const listContainer = document.getElementById("audit-logs-list");
    if (!listContainer) return;
    
    if (logs.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-500 font-bold uppercase tracking-wider text-[10px]"><i class="fas fa-history text-lg mb-2 block"></i>Belum ada aktivitas tercatat</td></tr>';
        return;
    }
    
    let html = "";
    logs.forEach(log => {
        const timeFmt = log.timestamp ? new Date(log.timestamp).toLocaleString("id-ID") : "-";
        const actionBadgeClass = getActionBadgeClass(log.action);
        
        html += `
            <tr class="hover:bg-white/5 transition-all">
                <td class="p-4 whitespace-nowrap text-slate-400 font-medium text-[10px]">${timeFmt}</td>
                <td class="p-4">
                    <div class="font-bold text-white">${log.operator_name}</div>
                    <div class="text-[9px] text-slate-500 lowercase">${log.operator_email}</div>
                </td>
                <td class="p-4 text-center">
                    <span class="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${actionBadgeClass}">
                        ${log.action || "AKSI"}
                    </span>
                </td>
                <td class="p-4 text-slate-300 leading-relaxed font-medium">${log.details || "-"}</td>
            </tr>
        `;
    });
    
    listContainer.innerHTML = html;
};

function getActionBadgeClass(action) {
    if (!action) return "bg-slate-500/20 text-slate-400 border-slate-500/20";
    const act = action.toLowerCase();
    
    if (act.includes("add") || act.includes("create") || act.includes("approve")) {
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/20";
    }
    if (act.includes("edit") || act.includes("update") || act.includes("toggle")) {
        return "bg-amber-500/20 text-amber-400 border-amber-500/20";
    }
    if (act.includes("delete") || act.includes("reject") || act.includes("cancel")) {
        return "bg-red-500/20 text-red-400 border-red-500/20";
    }
    if (act.includes("import") || act.includes("restore") || act.includes("merge")) {
        return "bg-indigo-500/20 text-indigo-400 border-indigo-500/20";
    }
    return "bg-slate-500/20 text-slate-400 border-slate-500/20";
}

window.filterAuditLogs = () => {
    const query = document.getElementById("search-audit-input").value.toLowerCase().trim();
    if (!query) {
        window.renderAuditLogsTable(window.STATE.auditLogs);
        return;
    }
    
    const filtered = window.STATE.auditLogs.filter(log => {
        return (log.operator_name || "").toLowerCase().includes(query) ||
               (log.operator_email || "").toLowerCase().includes(query) ||
               (log.action || "").toLowerCase().includes(query) ||
               (log.details || "").toLowerCase().includes(query);
    });
    window.renderAuditLogsTable(filtered);
};

// ============================================================================
// CORE TANDA TANGAN KEPANITIAAN (DRAWING CANVAS & SMART CONVERSION UPLOAD)
// ============================================================================
let ttdCanvas, ttdCtx, ttdDrawing = false;

window.switchTTDTab = (tab) => {
  const tabDraw = document.getElementById("tab-draw-ttd");
  const tabUpload = document.getElementById("tab-upload-ttd");
  const containerDraw = document.getElementById("container-draw-ttd");
  const containerUpload = document.getElementById("container-upload-ttd");
  
  if (!tabDraw || !tabUpload) return;
  
  if (tab === 'draw') {
    tabDraw.classList.add("bg-indigo-600", "text-white", "shadow-md");
    tabDraw.classList.remove("text-slate-400");
    tabUpload.classList.remove("bg-indigo-600", "text-white", "shadow-md");
    tabUpload.classList.add("text-slate-400");
    
    containerDraw.classList.remove("hidden");
    containerUpload.classList.add("hidden");
  } else {
    tabUpload.classList.add("bg-indigo-600", "text-white", "shadow-md");
    tabUpload.classList.remove("text-slate-400");
    tabDraw.classList.remove("bg-indigo-600", "text-white", "shadow-md");
    tabDraw.classList.add("text-slate-400");
    
    containerUpload.classList.remove("hidden");
    containerDraw.classList.add("hidden");
  }
};

window.initTTDCanvas = () => {
  ttdCanvas = document.getElementById("ttd-canvas");
  if (!ttdCanvas) return;
  ttdCtx = ttdCanvas.getContext("2d");
  
  // Reset size based on physical bounding box
  const rect = ttdCanvas.getBoundingClientRect();
  ttdCanvas.width = rect.width || 320;
  ttdCanvas.height = rect.height || 140;
  
  // Visual drawing style: White/Indigo glowing stroke on dark canvas
  ttdCtx.strokeStyle = "#818cf8";
  ttdCtx.lineWidth = 3;
  ttdCtx.lineCap = "round";
  ttdCtx.lineJoin = "round";
  
  if (ttdCanvas.dataset.listenersAdded) {
    return; // Already has event listeners, just updated size & style!
  }
  
  // Event listeners for drawing
  ttdCanvas.addEventListener("mousedown", startDraw);
  ttdCanvas.addEventListener("mousemove", draw);
  ttdCanvas.addEventListener("mouseup", endDraw);
  ttdCanvas.addEventListener("mouseleave", endDraw);
  
  // Touch support for mobiles
  ttdCanvas.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    ttdCanvas.dispatchEvent(mouseEvent);
  }, { passive: false });
  
  ttdCanvas.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    ttdCanvas.dispatchEvent(mouseEvent);
  }, { passive: false });
  
  ttdCanvas.addEventListener("touchend", () => {
    const mouseEvent = new MouseEvent("mouseup", {});
    ttdCanvas.dispatchEvent(mouseEvent);
  }, { passive: false });

  ttdCanvas.dataset.listenersAdded = "true";
};

function getMousePos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function startDraw(e) {
  ttdDrawing = true;
  const pos = getMousePos(ttdCanvas, e);
  ttdCtx.beginPath();
  ttdCtx.moveTo(pos.x, pos.y);
  
  const placeholder = document.getElementById("ttd-canvas-placeholder");
  if (placeholder) placeholder.classList.add("hidden");
  
  e.preventDefault();
}

function draw(e) {
  if (!ttdDrawing) return;
  const pos = getMousePos(ttdCanvas, e);
  ttdCtx.lineTo(pos.x, pos.y);
  ttdCtx.stroke();
  e.preventDefault();
}

function endDraw(e) {
  if (!ttdDrawing) return;
  ttdDrawing = false;
  ttdCtx.closePath();
  saveCanvasToBase64();
  if (e) e.preventDefault();
}

window.clearTTDCanvas = () => {
  if (!ttdCanvas || !ttdCtx) return;
  ttdCtx.clearRect(0, 0, ttdCanvas.width, ttdCanvas.height);
  
  document.getElementById("panitia-ttd-base64").value = "";
  
  const placeholder = document.getElementById("ttd-canvas-placeholder");
  if (placeholder) placeholder.classList.remove("hidden");
  
  const previewContainer = document.getElementById("container-ttd-preview");
  const previewImg = document.getElementById("ttd-preview-img");
  if (previewContainer && previewImg) {
    previewImg.src = "";
    previewContainer.classList.add("hidden");
  }
  
  // Reset input file
  const fileInput = document.getElementById("ttd-file-input");
  if (fileInput) fileInput.value = "";
  
  // Default to drawing tab
  window.switchTTDTab('draw');
};

window.handleTTDUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      ttdCtx.clearRect(0, 0, ttdCanvas.width, ttdCanvas.height);
      
      const canvasWidth = ttdCanvas.width;
      const canvasHeight = ttdCanvas.height;
      const ratio = Math.min(canvasWidth / img.width, canvasHeight / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (canvasWidth - w) / 2;
      const y = (canvasHeight - h) / 2;
      
      ttdCtx.drawImage(img, x, y, w, h);
      
      const placeholder = document.getElementById("ttd-canvas-placeholder");
      if (placeholder) placeholder.classList.add("hidden");
      
      // Process pixels for transparency and high-contrast
      processTTDCanvasPixels();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

function processTTDCanvasPixels() {
  if (!ttdCanvas || !ttdCtx) return;
  const imgData = ttdCtx.getImageData(0, 0, ttdCanvas.width, ttdCanvas.height);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];
    
    if (alpha === 0) continue;
    
    // Brightness thresholding: signature paper is bright, signature is dark
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    if (brightness > 160 || alpha < 30) {
      data[i + 3] = 0; // Make light background transparent
    } else {
      // Convert signature to sleek indigo preview color
      data[i] = 129;     // R (#818cf8)
      data[i + 1] = 140; // G
      data[i + 2] = 248; // B
      data[i + 3] = Math.min(255, (255 - brightness) * 2.0); // Boost opacity
    }
  }
  ttdCtx.putImageData(imgData, 0, 0);
  saveCanvasToBase64();
}

function saveCanvasToBase64() {
  if (!ttdCanvas) return;
  
  // Export as solid dark charcoal signature on a transparent background
  const offscreen = document.createElement("canvas");
  offscreen.width = ttdCanvas.width;
  offscreen.height = ttdCanvas.height;
  const oCtx = offscreen.getContext("2d");
  
  oCtx.drawImage(ttdCanvas, 0, 0);
  const imgData = oCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha > 10) {
      data[i] = 30;      // R (dark charcoal)
      data[i + 1] = 41;  // G
      data[i + 2] = 59;  // B
      // Boost opacity slightly to make it look full and solid, but preserve anti-aliasing edges for smoothness!
      data[i + 3] = Math.min(255, alpha * 1.5);
    } else {
      data[i + 3] = 0;   // Clean faint background noise
    }
  }
  
  oCtx.putImageData(imgData, 0, 0);
  
  // Crop the empty borders from signature canvas dynamically
  const croppedCanvas = cropSignatureCanvas(offscreen);
  const base64 = croppedCanvas.toDataURL("image/png");
  document.getElementById("panitia-ttd-base64").value = base64;
  
  // Show preview
  const previewImg = document.getElementById("ttd-preview-img");
  const previewContainer = document.getElementById("container-ttd-preview");
  if (previewImg && previewContainer) {
    previewImg.src = base64;
    previewContainer.classList.remove("hidden");
  }
}

// Helper to auto-crop empty borders/padding around signature strokes
function cropSignatureCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  // Ignore 4-pixel border to filter out edge/touch noise completely
  const borderIgnore = 4;

  for (let y = borderIgnore; y < h - borderIgnore; y++) {
    for (let x = borderIgnore; x < w - borderIgnore; x++) {
      const idx = (y * w + x) * 4;
      const alpha = data[idx + 3];
      // A threshold of 20 captures all visible signature strokes beautifully
      if (alpha > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  // Fallback to scanning everything with lower threshold if inner scan was empty
  if (!found) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
  }

  if (!found) {
    return canvas;
  }

  // Add a small aesthetic padding (8px) around the signature bounds
  const padding = 8;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(w - 1, maxX + padding);
  maxY = Math.min(h - 1, maxY + padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  if (cropW < 5 || cropH < 5) {
    return canvas;
  }

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;
  const croppedCtx = croppedCanvas.getContext("2d");

  croppedCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  

  return croppedCanvas;
}

// Inisialisasi Canvas saat DOM ter-load
window.addEventListener("DOMContentLoaded", () => {
  window.initTTDCanvas();
});

// Fallback init jika DOMContentLoaded sudah dilewati
if (document.readyState !== "loading") {
  window.initTTDCanvas();
}

// ============================================================
// ============================================================
// FITUR 1: TOOL BERSIHKAN DATA WILAYAH (BATCH FIX TO FIRESTORE)
// ============================================================

// Preview: tampilkan perubahan yang akan dilakukan tanpa menyimpan
window.previewWilayahCleanup = () => {
  const btn = document.getElementById('btn-preview-cleanup');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Memindai...'; }

  try {
    const fields = ['kabupaten','kecamatan','desa','provinsi'];
    const changes = [];

    (window.STATE.rawAlumni || []).forEach(a => {
      fields.forEach(f => {
        if (a[f]) {
          const fixed = window.normalizeWilayahName(a[f]);
          if (fixed !== a[f]) {
            changes.push({ nama: a.nama || '—', field: f, before: a[f], after: fixed });
          }
        }
      });
    });

    // Render preview
    const panel = document.getElementById('cleanup-preview-panel');
    const emptyMsg = document.getElementById('cleanup-preview-empty');
    const list = document.getElementById('cleanup-preview-list');
    const countEl = document.getElementById('cleanup-preview-count');
    const initialInfo = document.getElementById('cleanup-initial-info');
    const runBtn = document.getElementById('btn-run-cleanup');

    if (panel) panel.classList.remove('hidden');
    if (initialInfo) initialInfo.classList.add('hidden');

    if (changes.length === 0) {
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      if (list) list.innerHTML = '';
      if (countEl) countEl.textContent = '0 perubahan';
      if (runBtn) runBtn.classList.add('hidden');
    } else {
      if (emptyMsg) emptyMsg.classList.add('hidden');
      if (countEl) countEl.textContent = `${changes.length} perubahan akan diterapkan`;
      if (runBtn) runBtn.classList.remove('hidden');
      if (list) {
        const fieldLabel = { kabupaten: 'Kab/Kota', kecamatan: 'Kecamatan', desa: 'Desa', provinsi: 'Provinsi' };
        list.innerHTML = changes.map(c => `
          <tr>
            <td class="p-2.5 pl-4 font-bold text-white max-w-[120px] truncate" title="${c.nama}">${c.nama}</td>
            <td class="p-2.5 text-indigo-300 text-[10px] uppercase font-bold">${fieldLabel[c.field] || c.field}</td>
            <td class="p-2.5 text-rose-300 line-through opacity-70 max-w-[120px] truncate" title="${c.before}">${c.before}</td>
            <td class="p-2.5 text-emerald-300 font-bold max-w-[120px] truncate" title="${c.after}">${c.after}</td>
          </tr>`).join('');
      }
    }
  } catch(err) {
    window.notify('Gagal memuat preview: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt mr-1.5"></i> Pindai Ulang'; }
  }
};

window.runWilayahCleanup = async () => {
  const modal = document.getElementById('modal-wilayah-cleanup');
  if (modal) modal.classList.add('hidden');

  const role = window.STATE.user ? window.STATE.user.role : '';
  if (!['admin_utama','creator'].includes(role)) {
    return window.notify('Hanya admin utama yang dapat menjalankan cleanup!', 'error');
  }

  window.toggleLoading(true, 'Memulai perbaikan data wilayah...');
  try {
    const snap = await db.collection('alumni').get();
    const docs = snap.docs;
    const total = docs.length;
    let updated = 0;
    const BATCH_SIZE = 400;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);
      let batchHasChanges = false;

      chunk.forEach(doc => {
        const data = doc.data();
        const updates = {};
        const fields = ['kabupaten','kecamatan','desa','provinsi'];
        fields.forEach(f => {
          if (data[f]) {
            const fixed = window.normalizeWilayahName(data[f]);
            if (fixed !== data[f]) {
              updates[f] = fixed;
            }
          }
        });
        if (Object.keys(updates).length > 0) {
          batch.update(doc.ref, updates);
          batchHasChanges = true;
          updated++;
        }
      });

      if (batchHasChanges) await batch.commit();
      window.toggleLoading(true, `Memproses ${Math.min(i + BATCH_SIZE, total)} dari ${total} alumni...`);
    }

    await window.logActivity('wilayah_cleanup', `Perbaikan data wilayah: ${updated} dokumen diperbarui dari ${total} total`);

    // Refresh local cache
    if (Array.isArray(window.STATE.rawAlumni)) {
      window.STATE.rawAlumni = window.STATE.rawAlumni.map(a => {
        const fixed = { ...a };
        ['kabupaten','kecamatan','desa','provinsi'].forEach(f => {
          if (fixed[f]) fixed[f] = window.normalizeWilayahName(fixed[f]);
        });
        return fixed;
      });
      localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
      window.processCombinedData();
    }

    window.notify(`✅ Selesai! ${updated} data wilayah berhasil diperbaiki dari ${total} alumni.`, 'success');
  } catch(err) {
    console.error('Wilayah cleanup error:', err);
    window.notify('Gagal cleanup: ' + (err.message || 'Periksa koneksi'), 'error');
  } finally {
    window.toggleLoading(false);
  }
};

window.openWilayahCleanupModal = () => {
  // Reset modal ke state awal
  const panel = document.getElementById('cleanup-preview-panel');
  const initialInfo = document.getElementById('cleanup-initial-info');
  const runBtn = document.getElementById('btn-run-cleanup');
  const previewBtn = document.getElementById('btn-preview-cleanup');
  const list = document.getElementById('cleanup-preview-list');
  const emptyMsg = document.getElementById('cleanup-preview-empty');

  if (panel) panel.classList.add('hidden');
  if (initialInfo) initialInfo.classList.remove('hidden');
  if (runBtn) runBtn.classList.add('hidden');
  if (previewBtn) previewBtn.innerHTML = '<i class="fas fa-eye mr-1.5"></i> Pratinjau Perubahan';
  if (list) list.innerHTML = '';
  if (emptyMsg) emptyMsg.classList.add('hidden');

  const modal = document.getElementById('modal-wilayah-cleanup');
  if (modal) modal.classList.remove('hidden');
};

// ============================================================
// FITUR 4: LINK UNDANGAN PERSONAL VIA WHATSAPP
// ============================================================
window.sendInviteLink = (nama, nowa, angkatan) => {
  if (nowa === undefined && angkatan === undefined && window.STATE && Array.isArray(window.STATE.rawAlumni)) {
    const a = window.STATE.rawAlumni.find(x => x.id === nama);
    if (a) {
      nama = a.nama;
      nowa = a.nowa;
      angkatan = a.angkatan;
    } else {
      window.notify('Alumni tidak ditemukan!', 'error');
      return;
    }
  }
  if (!nowa) {
    window.notify('Alumni ini tidak memiliki nomor WhatsApp!', 'error');
    return;
  }
  const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
  const params = new URLSearchParams({
    nama: nama || '',
    angkatan: angkatan || '',
    ref: 'invite'
  });
  const link = `${baseUrl}pendaftaran.html?${params.toString()}`;
  const pesan = `Assalamu'alaikum ${nama},\n\nKami mengundang Anda untuk melengkapi data alumni Reuni AL-FATAH.\n\n🔗 Klik link berikut untuk mengisi/memperbarui data Anda:\n${link}\n\nTerima kasih 🙏`;
  const waNumber = nowa.replace(/\D/g, '');
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(pesan)}`;
  window.open(waUrl, '_blank');
};
// ============================================================
// FITUR 6: RIWAYAT PERUBAHAN DATA ALUMNI (VIEWER)
// ============================================================
window.openAlumniChangeHistory = async (alumniId, alumniNama) => {
  const modal = document.getElementById('modal-alumni-change-history');
  const titleEl = document.getElementById('alumni-history-title');
  const bodyEl = document.getElementById('alumni-history-body');
  if (!modal || !bodyEl) return;

  if (!alumniNama && window.STATE && Array.isArray(window.STATE.rawAlumni)) {
    const alm = window.STATE.rawAlumni.find(x => x.id === alumniId);
    if (alm) alumniNama = alm.nama;
  }

  if (titleEl) titleEl.textContent = `Riwayat: ${alumniNama || ''}`;
  bodyEl.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Memuat riwayat...</td></tr>`;
  modal.classList.remove('hidden');

  try {
    const snap = await db.collection('alumni_changelog')
      .where('alumniId', '==', alumniId)
      .orderBy('changedAt', 'desc')
      .limit(30)
      .get();

    if (snap.empty) {
      bodyEl.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-500 text-xs">Belum ada riwayat perubahan untuk alumni ini.</td></tr>`;
      return;
    }

    const fieldLabels = {
      nama: 'Nama', angkatan: 'Angkatan', lembaga: 'Lembaga',
      nowa: 'No. WA', kabupaten: 'Kabupaten', kecamatan: 'Kecamatan',
      desa: 'Desa', alamat: 'Alamat', provinsi: 'Provinsi'
    };

    bodyEl.innerHTML = snap.docs.map(doc => {
      const log = doc.data();
      const tanggal = log.changedAt ? new Date(log.changedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      const changesList = Object.entries(log.changes || {}).map(([field, val]) =>
        `<div class="mb-1"><span class="text-slate-400 text-[10px] uppercase font-bold">${fieldLabels[field] || field}:</span> <span class="line-through text-red-400 text-[10px]">${val.before || '(kosong)'}</span> <i class="fas fa-arrow-right text-slate-600 text-[9px] mx-1"></i> <span class="text-emerald-400 text-[10px]">${val.after || '(kosong)'}</span></div>`
      ).join('');
      return `<tr class="border-b border-white/5 hover:bg-white/2">
        <td class="p-3 text-[10px] text-slate-400 whitespace-nowrap">${tanggal}</td>
        <td class="p-3 text-[10px] font-bold text-indigo-300">${log.changedBy || '-'}</td>
        <td class="p-3">${changesList}</td>
      </tr>`;
    }).join('');
  } catch(err) {
    console.error('History error:', err);
    bodyEl.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-red-400 text-xs">Gagal memuat riwayat: ${err.message}</td></tr>`;
  }
};

// ============================================================
// UTILITY UNTUK KAPITALISASI NAMA ALUMNI (TITLE CASE)
// ============================================================
window.capitalizeName = (name) => {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
};

window.openNamaCleanupModal = () => {
  const panel = document.getElementById('nama-cleanup-preview-panel');
  const initialInfo = document.getElementById('nama-cleanup-initial-info');
  const runBtn = document.getElementById('btn-run-nama-cleanup');
  const previewBtn = document.getElementById('btn-preview-nama-cleanup');
  const list = document.getElementById('cleanup-nama-preview-list');
  const emptyMsg = document.getElementById('cleanup-nama-preview-empty');

  if (panel) panel.classList.add('hidden');
  if (initialInfo) initialInfo.classList.remove('hidden');
  if (runBtn) runBtn.classList.add('hidden');
  if (previewBtn) previewBtn.innerHTML = '<i class="fas fa-eye mr-1.5"></i> Pratinjau Perubahan';
  if (list) list.innerHTML = '';
  if (emptyMsg) emptyMsg.classList.add('hidden');

  const modal = document.getElementById('modal-nama-cleanup');
  if (modal) modal.classList.remove('hidden');
};

window.previewNamaCleanup = () => {
  const btn = document.getElementById('btn-preview-nama-cleanup');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Memindai...'; }

  try {
    const changes = [];

    (window.STATE.rawAlumni || []).forEach(a => {
      if (a.nama) {
        const fixed = window.capitalizeName(a.nama);
        if (fixed !== a.nama) {
          changes.push({ id: a.id, before: a.nama, after: fixed });
        }
      }
    });

    const panel = document.getElementById('nama-cleanup-preview-panel');
    const emptyMsg = document.getElementById('cleanup-nama-preview-empty');
    const list = document.getElementById('cleanup-nama-preview-list');
    const countEl = document.getElementById('nama-cleanup-preview-count');
    const initialInfo = document.getElementById('nama-cleanup-initial-info');
    const runBtn = document.getElementById('btn-run-nama-cleanup');

    if (panel) panel.classList.remove('hidden');
    if (initialInfo) initialInfo.classList.add('hidden');

    if (changes.length === 0) {
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      if (list) list.innerHTML = '';
      if (countEl) countEl.textContent = '0 perubahan';
      if (runBtn) runBtn.classList.add('hidden');
    } else {
      if (emptyMsg) emptyMsg.classList.add('hidden');
      if (countEl) countEl.textContent = `${changes.length} nama akan diformat`;
      if (runBtn) runBtn.classList.remove('hidden');
      if (list) {
        list.innerHTML = changes.map(c => `
          <tr>
            <td class="p-2.5 pl-4 font-bold text-rose-300 line-through opacity-70 truncate max-w-[200px]" title="${c.before}">${c.before}</td>
            <td class="p-2.5 text-emerald-300 font-bold truncate max-w-[200px]" title="${c.after}">${c.after}</td>
          </tr>`).join('');
      }
    }
  } catch(err) {
    window.notify('Gagal memuat preview: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt mr-1.5"></i> Pindai Ulang'; }
  }
};

window.runNamaCleanup = async () => {
  const modal = document.getElementById('modal-nama-cleanup');
  if (modal) modal.classList.add('hidden');

  const role = window.STATE.user ? window.STATE.user.role : '';
  if (!['admin_utama','creator'].includes(role)) {
    return window.notify('Hanya admin utama yang dapat menjalankan cleanup!', 'error');
  }

  window.toggleLoading(true, 'Memulai kapitalisasi nama alumni...');
  try {
    const snap = await db.collection('alumni').get();
    const docs = snap.docs;
    const total = docs.length;
    let updated = 0;
    const BATCH_SIZE = 400;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);
      let batchHasChanges = false;

      chunk.forEach(doc => {
        const data = doc.data();
        if (data.nama) {
          const fixed = window.capitalizeName(data.nama);
          if (fixed !== data.nama) {
            batch.update(doc.ref, { nama: fixed });
            batchHasChanges = true;
            updated++;
          }
        }
      });

      if (batchHasChanges) await batch.commit();
      window.toggleLoading(true, `Memproses ${Math.min(i + BATCH_SIZE, total)} dari ${total} alumni...`);
    }

    await window.logActivity('nama_cleanup', `Kapitalisasi nama alumni: ${updated} dokumen diperbarui dari ${total} total`);

    if (Array.isArray(window.STATE.rawAlumni)) {
      window.STATE.rawAlumni = window.STATE.rawAlumni.map(a => {
        const fixed = { ...a };
        if (fixed.nama) fixed.nama = window.capitalizeName(fixed.nama);
        return fixed;
      });
      localStorage.setItem('cached_alumni', JSON.stringify(window.STATE.rawAlumni));
      window.processCombinedData();
    }

    window.notify(`✅ Selesai! ${updated} nama alumni berhasil dikapitalisasi dari ${total} alumni.`, 'success');
  } catch(err) {
    console.error('Nama cleanup error:', err);
    window.notify('Gagal cleanup: ' + (err.message || 'Periksa koneksi'), 'error');
  } finally {
    window.toggleLoading(false);
  }
};

// ============================================================
// FITUR 1 & 2: VERIFIKASI DONASI, DETEKSI FRAUD (DUPLIKAT), DAN PREVIEW OCR
// ============================================================
window.urlToBase64 = async (url) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.readAsDataURL(blob);
  });
};

window.openFinanceVerificationModal = async (reqId) => {
  const modal = document.getElementById("modal-finance-verify");
  if (!modal) return;

  const req = (window.STATE.pendingFinance || []).find(r => r.id === reqId);
  if (!req) return window.notify("Data transaksi tidak ditemukan!", "error");

  // Reset UI
  document.getElementById("verify-receipt-img").src = req.bukti_url || "";
  document.getElementById("verify-download-btn").href = req.bukti_url || "#";
  document.getElementById("verify-donor-name").textContent = req.nama_pembayar || "—";
  document.getElementById("verify-system-amount").textContent = window.formatRupiah(req.nominal);
  document.getElementById("verify-input-date").textContent = req.tanggal || "—";

  // Setup action buttons
  const approveBtn = document.getElementById("verify-btn-approve");
  const rejectBtn = document.getElementById("verify-btn-reject");
  approveBtn.setAttribute("onclick", `window.handleFinanceRequest('${reqId}', 'approve')`);
  rejectBtn.setAttribute("onclick", `window.handleFinanceRequest('${reqId}', 'reject')`);

  // Reset duplicate detection UI
  const dupCard = document.getElementById("verify-duplicate-card");
  const dupIcon = document.getElementById("verify-duplicate-icon");
  const dupTitle = document.getElementById("verify-duplicate-title");
  const dupDesc = document.getElementById("verify-duplicate-desc");
  dupCard.className = "rounded-xl p-3.5 border hidden";

  // Reset OCR UI
  const ocrStatus = document.getElementById("verify-ocr-status");
  const ocrLoading = document.getElementById("verify-ocr-loading");
  const ocrResultRow = document.getElementById("verify-ocr-result-row");
  const ocrAmount = document.getElementById("verify-ocr-amount");
  const ocrMatchBadge = document.getElementById("verify-ocr-match-badge");
  
  ocrStatus.textContent = "Menunggu scan...";
  ocrLoading.classList.add("hidden");
  ocrResultRow.classList.add("hidden");

  modal.classList.remove("hidden");

  // 1. Run Duplicate Verification (Fingerprint/bukti_hash check with bukti_url fallback)
  try {
    let snap;
    if (req.bukti_hash) {
      snap = await db.collection("finance")
        .where("bukti_hash", "==", req.bukti_hash)
        .get();
    } else {
      snap = await db.collection("finance")
        .where("bukti_url", "==", req.bukti_url)
        .get();
    }
    
    const duplicates = snap.docs.filter(doc => doc.id !== reqId);
    
    dupCard.classList.remove("hidden");
    if (duplicates.length > 0) {
      const otherReq = duplicates[0].data();
      dupCard.className = "rounded-xl p-3.5 border bg-red-500/10 border-red-500/30 text-red-400 animate-pulse";
      dupIcon.className = "fas fa-exclamation-triangle text-red-400";
      dupTitle.textContent = "⚠️ TERDETEKSI DUPLIKAT / FRAUD!";
      dupDesc.innerHTML = `Struk bukti transfer ini <b>identik</b> dengan transaksi lain milik <b>${otherReq.nama_pembayar || 'Alumni'}</b> sebesar <b>${window.formatRupiah(otherReq.nominal)}</b>. Harap teliti kembali bukti transfer ini!`;
    } else {
      dupCard.className = "rounded-xl p-3.5 border bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      dupIcon.className = "fas fa-check-circle text-emerald-400";
      dupTitle.textContent = "✓ STRUK UNIK & AMAN";
      dupDesc.textContent = "Bukti transfer ini hanya digunakan pada donasi ini dan belum pernah terdaftar di transaksi mana pun.";
    }
  } catch(err) {
    console.error("Duplicate check error:", err);
  }

  // 2. Run AI OCR Scan Automatically if API configuration exists
  let provider = window.aiProvider;
  let apiKey = provider === "groq" ? window.groqApiKey : window.geminiApiKey;

  if (!apiKey || !provider) {
    try {
      const doc = await db.collection("app_settings").doc("ai_config").get();
      if(doc.exists) {
        window.geminiApiKey = doc.data().gemini_key || "";
        window.groqApiKey = doc.data().groq_key || "";
        window.aiProvider = doc.data().ai_provider || "gemini";
        provider = window.aiProvider;
        apiKey = provider === "groq" ? window.groqApiKey : window.geminiApiKey;
      }
    } catch(err) {
      console.error("Gagal meload konfigurasi AI:", err);
    }
  }

  if (!apiKey) {
    ocrStatus.textContent = "AI Belum Aktif";
    ocrStatus.className = "text-[9px] font-black text-amber-400";
    return;
  }

  ocrStatus.textContent = "Memindai...";
  ocrStatus.className = "text-[9px] font-black text-indigo-400";
  ocrLoading.classList.remove("hidden");

  try {
    const base64Image = await window.urlToBase64(req.bukti_url);
    const mimeType = "image/jpeg";

    const prompt = `Analisa gambar struk atau bukti transfer ini secara sangat teliti.
Temukan nominal total yang ditransfer atau dibayar.
Kembalikan jawaban HANYA sebagai objek JSON murni tanpa pembungkus markdown (tanpa ticks seperti \`\`\`json) dengan format persis seperti contoh berikut:
{
  "nominal": 150000
}
Jika nominal tidak bisa terdeteksi sama sekali, kembalikan nilai null. Jangan kembalikan teks penjelasan apa pun selain JSON.`;

    let resultText = "";
    if (provider === "groq") {
      const url = "https://api.groq.com/openai/v1/chat/completions";
      const body = {
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify(body)
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      if (json.choices && json.choices.length > 0 && json.choices[0].message) {
        resultText = json.choices[0].message.content;
      } else {
        throw new Error("Gagal memproses gambar.");
      }
    } else {
      // Gemini Vision
      const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + apiKey;
      const body = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image
                }
              }
            ]
          }
        ]
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
        resultText = json.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Gagal memproses gambar.");
      }
    }

    let cleanJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    const extracted = JSON.parse(cleanJson);

    ocrLoading.classList.add("hidden");
    ocrResultRow.classList.remove("hidden");

    if (extracted && extracted.nominal !== null) {
      const nominalStruk = Number(extracted.nominal);
      const nominalInput = Number(req.nominal);
      ocrAmount.textContent = window.formatRupiah(nominalStruk);

      if (nominalStruk === nominalInput) {
        ocrStatus.textContent = "Selesai (Cocok)";
        ocrStatus.className = "text-[9px] font-black text-emerald-400";
        ocrMatchBadge.textContent = "COCOK ✓";
        ocrMatchBadge.className = "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      } else {
        ocrStatus.textContent = "Selesai (BEDA)";
        ocrStatus.className = "text-[9px] font-black text-red-400";
        ocrMatchBadge.textContent = "BEDA ⚠️";
        ocrMatchBadge.className = "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse";
      }
    } else {
      ocrStatus.textContent = "Tidak Terdeteksi";
      ocrStatus.className = "text-[9px] font-black text-amber-400";
      ocrAmount.textContent = "Tidak terbaca";
      ocrMatchBadge.textContent = "PERIKSA MANUAL ⚠️";
      ocrMatchBadge.className = "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30";
    }
  } catch(err) {
    console.error("AI OCR verification error:", err);
    ocrLoading.classList.add("hidden");
    ocrStatus.textContent = "Gagal Pindai";
    ocrStatus.className = "text-[9px] font-black text-red-400";
  }
};

// ============================================================
