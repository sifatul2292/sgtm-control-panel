const guideTrack = document.getElementById('guide-track');
if (guideTrack) {
  const previous = document.querySelector('.guide-prev');
  const next = document.querySelector('.guide-next');
  const updateControls = () => {
    previous.disabled = guideTrack.scrollLeft <= 2;
    next.disabled = guideTrack.scrollLeft >= guideTrack.scrollWidth - guideTrack.clientWidth - 2;
  };
  const move = (direction) => {
    const card = guideTrack.querySelector('.home-guide');
    const distance = card.getBoundingClientRect().width + parseFloat(getComputedStyle(guideTrack).gap);
    guideTrack.scrollBy({ left: direction * distance, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  guideTrack.addEventListener('scroll', updateControls, { passive: true });
  guideTrack.addEventListener('keydown', (event) => {
    if (event.target === guideTrack && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  window.addEventListener('resize', updateControls);
  updateControls();
}

// Tagioo videos: load the YouTube player (privacy-enhanced domain) only after a click.
document.addEventListener('click', (event) => {
  const facade = event.target.closest('.home-videos [data-yt]');
  if (!facade) return;
  event.preventDefault();
  const frame = document.createElement('iframe');
  frame.src = `https://www.youtube-nocookie.com/embed/${facade.dataset.yt}?autoplay=1&rel=0`;
  frame.title = facade.getAttribute('aria-label') || 'Tagioo video';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture';
  frame.allowFullscreen = true;
  const box = document.createElement('div');
  box.className = facade.className.replace('hv-facade', '').trim();
  box.appendChild(frame);
  facade.replaceWith(box);
});
