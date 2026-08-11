/* ===========================
   JANS PHOTOGRAPH — Main JS
   =========================== */

// ── Hamburger / Nav Drawer ──
const hamburger  = document.getElementById('hamburger');
const navDrawer  = document.getElementById('navDrawer');
const navOverlay = document.getElementById('navOverlay');

function openNav() {
  hamburger.classList.add('open');
  navDrawer.classList.add('open');
  navOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  hamburger.setAttribute('aria-expanded', 'true');
}
function closeNav() {
  hamburger.classList.remove('open');
  navDrawer.classList.remove('open');
  navOverlay.classList.remove('open');
  document.body.style.overflow = '';
  hamburger.setAttribute('aria-expanded', 'false');
}
hamburger?.addEventListener('click', () => {
  hamburger.classList.contains('open') ? closeNav() : openNav();
});
navOverlay?.addEventListener('click', closeNav);
document.querySelectorAll('.nav-drawer a').forEach(a => a.addEventListener('click', closeNav));

// ── Slider — Ping-pong (1→2→3→...→N→...→2→1→2…) ──
// Reescrito para soportar cualquier cantidad de slides (antes estaba fijo a 5).
// initSlider() es reutilizable: index.html la llama cada vez que renderiza
// los slides (caché local y luego datos frescos desde GitHub).
window.__sliderState = { current: 0, direction: 1, total: 0, timer: null };

window.initSlider = function initSlider() {
  const slider = document.getElementById('sliderTrack');
  if (!slider) return;
  const dots  = document.querySelectorAll('.slider-dots button');
  const total = slider.querySelectorAll('.slide').length;
  const st = window.__sliderState;
  st.total = total;
  st.current = 0;
  st.direction = 1;
  if (!total) return;

  function goTo(idx) {
    st.current = Math.max(0, Math.min(idx, st.total - 1));
    slider.style.transform = `translateX(-${st.current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === st.current));
  }

  function pingPongNext() {
    if (st.current >= st.total - 1) st.direction = -1;
    if (st.current <= 0)            st.direction =  1;
    goTo(st.current + st.direction);
  }

  function resetAuto() {
    clearInterval(st.timer);
    st.timer = setInterval(pingPongNext, 5200);
  }

  // Expuestas para el listener de swipe (bindeado una sola vez más abajo)
  window.__sliderGoTo = goTo;
  window.__sliderResetAuto = resetAuto;

  resetAuto();
  goTo(0);

  // Touch / swipe — se enlaza una sola vez; siempre usa la versión
  // más reciente de goTo/resetAuto vía window.__slider*.
  if (!slider.dataset.touchBound) {
    slider.dataset.touchBound = '1';
    let touchStartX = 0;
    slider.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend',   e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50 && window.__sliderGoTo) {
        window.__sliderGoTo(window.__sliderState.current + (diff > 0 ? 1 : -1));
        window.__sliderResetAuto();
      }
    });
  }
};

// Fallback: si el slider ya trae slides estáticos en el HTML (páginas que no
// los cargan dinámicamente), inicializar al cargar el DOM.
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelectorAll('#sliderTrack .slide').length) window.initSlider();
});

// ── Shared "Regresar" button handler — used by the .btn-back button on public pages ──
// Goes back in browser history if there's a same-site page to return to;
// otherwise falls back to the homepage so the visitor never gets stuck
// (e.g. if they arrived directly from Google/WhatsApp with no prior page).
function goBack() {
  const cameFromSameSite = document.referrer && document.referrer.includes(window.location.host);
  if (cameFromSameSite && window.history.length > 1) {
    window.history.back();
    return;
  }
  // Reuse the header logo's existing href to the homepage — it already has the
  // correct relative path for this page's depth (avoids guessing path depth,
  // since GitHub Pages serves from a repo subpath like /jansphotograph.github.io/).
  const logoLink = document.querySelector('.header-logo a[href*="index.html"]');
  window.location.href = logoLink ? logoLink.getAttribute('href') : 'index.html';
}
