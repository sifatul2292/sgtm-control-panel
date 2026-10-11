const flow = document.querySelector('.event-flow');
const toggle = document.getElementById('motionToggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let paused = reducedMotion.matches;
let visible = true;
function updateMotion() {
  flow.classList.toggle('is-paused', paused || !visible || document.hidden);
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = reducedMotion.matches ? 'Motion reduced' : paused ? 'Play animation' : 'Pause animation';
  toggle.disabled = reducedMotion.matches;
}
toggle.addEventListener('click', () => { paused = !paused; updateMotion(); });
reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; updateMotion(); });
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updateMotion(); }).observe(flow);
document.addEventListener('visibilitychange', updateMotion);
updateMotion();
