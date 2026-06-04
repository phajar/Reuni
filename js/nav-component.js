/**
 * nav-component.js
 * Inject floating navigation bar ke semua halaman publik secara otomatis.
 * Cukup include script ini di bagian bawah <body>.
 * Tidak perlu menduplikasi HTML nav di setiap halaman.
 */
(function () {
  const NAV_HTML = `
  <style>
    @media (max-width: 480px) {
      #floating-nav-component nav a span {
        display: none !important;
      }
      #floating-nav-component nav a {
        padding: 12px 6px !important;
      }
      #floating-nav-component nav a i {
        font-size: 20px !important;
      }
      #floating-nav-component {
        bottom: 12px !important;
      }
    }
  </style>
  <div id="floating-nav-component" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] pointer-events-none" style="width:95%;max-width:35rem;">
    <nav class="glass rounded-3xl border border-white/10 p-2 flex justify-around items-center shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl bg-[#060813]/90 pointer-events-auto">
      <a href="countdown.html"   data-nav="countdown.html"   class="nav-btn-float flex flex-col items-center gap-1 p-2 flex-1 rounded-2xl transition-all duration-300 text-slate-400 hover:bg-white/5 relative">
        <i class="fas fa-home text-lg relative z-10"></i>
        <span class="text-[10px] font-bold uppercase tracking-wider relative z-10 mt-1">Beranda</span>
      </a>
      <a href="pendaftaran.html" data-nav="pendaftaran.html" class="nav-btn-float flex flex-col items-center gap-1 p-2 flex-1 rounded-2xl transition-all duration-300 text-blue-400 hover:bg-white/5 relative">
        <i class="fas fa-user-plus text-lg relative z-10"></i>
        <span class="text-[10px] font-bold uppercase tracking-wider relative z-10 mt-1">Daftar</span>
      </a>
      <a href="cek-status.html"  data-nav="cek-status.html"  class="nav-btn-float flex flex-col items-center gap-1 p-2 flex-1 rounded-2xl transition-all duration-300 text-amber-400 hover:bg-white/5 relative">
        <i class="fas fa-search text-lg relative z-10"></i>
        <span class="text-[10px] font-bold uppercase tracking-wider relative z-10 mt-1">Status</span>
      </a>
      <a href="Rundown.html"     data-nav="Rundown.html"     class="nav-btn-float flex flex-col items-center gap-1 p-2 flex-1 rounded-2xl transition-all duration-300 text-purple-400 hover:bg-white/5 relative">
        <i class="fas fa-list-ol text-lg relative z-10"></i>
        <span class="text-[10px] font-bold uppercase tracking-wider relative z-10 mt-1">Jadwal</span>
      </a>
      <a href="pembayaran.html"  data-nav="pembayaran.html"  class="nav-btn-float flex flex-col items-center gap-1 p-2 flex-1 rounded-2xl transition-all duration-300 text-emerald-400 hover:bg-white/5 relative">
        <i class="fas fa-hand-holding-heart text-lg relative z-10"></i>
        <span class="text-[10px] font-bold uppercase tracking-wider relative z-10 mt-1">Donasi</span>
      </a>
      <a href="keuangan.html"    data-nav="keuangan.html"    class="nav-btn-float flex flex-col items-center gap-1 p-2 flex-1 rounded-2xl transition-all duration-300 text-cyan-400 hover:bg-white/5 relative">
        <i class="fas fa-wallet text-lg relative z-10"></i>
        <span class="text-[10px] font-bold uppercase tracking-wider relative z-10 mt-1">Laporan</span>
      </a>
      <a href="dokumentasi.html" data-nav="dokumentasi.html" class="nav-btn-float flex flex-col items-center gap-1 p-2 flex-1 rounded-2xl transition-all duration-300 text-pink-400 hover:bg-white/5 relative">
        <i class="fas fa-camera text-lg relative z-10"></i>
        <span class="text-[10px] font-bold uppercase tracking-wider relative z-10 mt-1">Galeri</span>
      </a>
    </nav>
  </div>`;

  // Inject nav ke body
  document.body.insertAdjacentHTML('beforeend', NAV_HTML);

  // Aktifkan tab yang sedang dibuka
  const path = window.location.pathname.split('/').pop() || 'countdown.html';
  document.querySelectorAll('.nav-btn-float').forEach(btn => {
    const target = btn.getAttribute('data-nav');
    if (path && path.toLowerCase() === target.toLowerCase()) {
      btn.classList.remove('text-slate-400', 'text-blue-400', 'text-purple-400', 'text-emerald-400', 'hover:bg-white/5');
      btn.classList.add('text-white', 'bg-white/20', 'scale-110', '-translate-y-3', 'border', 'border-white/30', 'shadow-[0_10px_20px_rgba(255,255,255,0.2)]');
      const glow = document.createElement('div');
      glow.className = 'absolute -bottom-1.5 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,1)] animate-pulse';
      btn.appendChild(glow);
    }
  });
})();
