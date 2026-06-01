/**
 * transitions.js
 * Fitur UI bersama:
 *  1. Top loading bar (NProgress-style) saat pindah halaman
 *  2. Smooth page fade transition
 *  3. Tombol scroll ke atas (back-to-top)
 * Cukup include sekali di setiap halaman publik.
 */
(function () {
  /* ─────────────────────────────────────────────
   * 1. TOP LOADING BAR
   * ───────────────────────────────────────────── */
  const bar = document.createElement('div');
  bar.id = 'page-load-bar';
  bar.style.cssText = `
    position: fixed; top: 0; left: 0; height: 3px; width: 0%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4);
    z-index: 99999; transition: width 0.3s ease, opacity 0.4s ease;
    box-shadow: 0 0 12px rgba(99,102,241,0.8); pointer-events: none;
    border-radius: 0 4px 4px 0;
  `;
  document.body.prepend(bar);

  let loadTimer = null;
  function startBar() {
    bar.style.opacity = '1';
    bar.style.width = '0%';
    clearTimeout(loadTimer);
    // Simulasikan progress cepat lalu berhenti di 85%
    let w = 0;
    const tick = () => {
      w = w < 70 ? w + 8 : w < 85 ? w + 1 : w;
      bar.style.width = w + '%';
      if (w < 85) loadTimer = setTimeout(tick, 80);
    };
    tick();
  }
  function finishBar() {
    clearTimeout(loadTimer);
    bar.style.width = '100%';
    setTimeout(() => { bar.style.opacity = '0'; setTimeout(() => { bar.style.width = '0%'; }, 400); }, 200);
  }

  /* ─────────────────────────────────────────────
   * 2. SMOOTH PAGE FADE TRANSITION
   * ───────────────────────────────────────────── */
  // Inject fade CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pageFadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pageFadeOut { from { opacity: 1; } to { opacity: 0; } }
    body.page-exit { animation: pageFadeOut 0.2s ease forwards; pointer-events: none; }
    body { animation: pageFadeIn 0.35s ease both; }
  `;
  document.head.appendChild(style);

  // Intercept link clicks untuk smooth transition
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    // Hanya halaman lokal .html
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel') || href.includes('//')) return;
    // Jangan intercept jika ada target="_blank"
    if (link.target === '_blank') return;

    e.preventDefault();
    startBar();
    document.body.classList.add('page-exit');
    setTimeout(() => { window.location.href = href; }, 200);
  });

  // Selesaikan bar saat halaman selesai load
  window.addEventListener('load', finishBar);
  // Fallback: selesaikan bar setelah 2 detik
  setTimeout(finishBar, 2000);

  /* ─────────────────────────────────────────────
   * 3. SCROLL TO TOP BUTTON
   * ───────────────────────────────────────────── */
  const scrollBtn = document.createElement('button');
  scrollBtn.id = 'btn-scroll-top';
  scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  scrollBtn.setAttribute('aria-label', 'Scroll ke atas');
  scrollBtn.style.cssText = `
    position: fixed; bottom: 100px; right: 20px; z-index: 998;
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white; border: none; cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 24px rgba(99,102,241,0.4);
    opacity: 0; transform: translateY(12px) scale(0.85);
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: none;
  `;
  document.body.appendChild(scrollBtn);

  // Show/hide berdasarkan scroll position
  let scrollVisible = false;
  window.addEventListener('scroll', () => {
    const shouldShow = window.scrollY > 300;
    if (shouldShow !== scrollVisible) {
      scrollVisible = shouldShow;
      scrollBtn.style.opacity = shouldShow ? '1' : '0';
      scrollBtn.style.transform = shouldShow ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)';
      scrollBtn.style.pointerEvents = shouldShow ? 'auto' : 'none';
    }
  }, { passive: true });

  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Hover effect
  scrollBtn.addEventListener('mouseenter', () => {
    scrollBtn.style.transform = 'translateY(-2px) scale(1.1)';
    scrollBtn.style.boxShadow = '0 10px 32px rgba(99,102,241,0.6)';
  });
  scrollBtn.addEventListener('mouseleave', () => {
    scrollBtn.style.transform = scrollVisible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)';
    scrollBtn.style.boxShadow = '0 6px 24px rgba(99,102,241,0.4)';
  });
})();
