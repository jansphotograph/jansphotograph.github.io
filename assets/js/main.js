/* ===========================
   JANS PHOTOGRAPH — Main JS
   =========================== */

// ── Hamburger / Nav Drawer ──
const hamburger = document.getElementById('hamburger');
const navDrawer = document.getElementById('navDrawer');
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

// ── Slider ──
const slider = document.getElementById('sliderTrack');
if (slider) {
  const slides = slider.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.slider-dots button');
  let current = 0;
  let autoTimer;

  function goTo(idx) {
    current = (idx + slides.length) % slides.length;
    slider.style.transform = `translateX(-${current * 20}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  document.getElementById('sliderPrev')?.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
  document.getElementById('sliderNext')?.addEventListener('click', () => { goTo(current + 1); resetAuto(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); resetAuto(); }));

  function resetAuto() { clearInterval(autoTimer); autoTimer = setInterval(() => goTo(current + 1), 5200); }
  resetAuto();
  goTo(0);

  // Touch / swipe
  let touchStartX = 0;
  slider.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { goTo(current + (diff > 0 ? 1 : -1)); resetAuto(); }
  });
}
