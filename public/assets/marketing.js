// Keep the shared mobile menu out of keyboard navigation while it is closed.
const marketingMenu = document.getElementById('mobileNav');
const marketingMenuButton = document.getElementById('menuBtn');
if (marketingMenu && marketingMenuButton) {
  const closeMarketingMenu = () => {
    marketingMenu.classList.remove('open');
    marketingMenuButton.setAttribute('aria-expanded', 'false');
    marketingMenu.setAttribute('aria-hidden', 'true');
  };
  const syncMenu = () => {
    marketingMenu.inert = !marketingMenu.classList.contains('open');
  };
  // Legal pages share the header but have no legacy inline menu handler.
  if (typeof closeMobileNav !== 'function') {
    marketingMenuButton.addEventListener('click', () => {
      const open = marketingMenu.classList.toggle('open');
      marketingMenuButton.setAttribute('aria-expanded', String(open));
      marketingMenu.setAttribute('aria-hidden', String(!open));
    });
    marketingMenu.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMarketingMenu();
    });
    marketingMenu.querySelectorAll('[onclick]').forEach((link) => link.removeAttribute('onclick'));
  }
  syncMenu();
  new MutationObserver(syncMenu).observe(marketingMenu, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && marketingMenu.classList.contains('open')) {
      closeMarketingMenu();
      marketingMenuButton.focus();
    }
  });
  window.matchMedia('(min-width: 1051px)').addEventListener('change', (event) => {
    if (event.matches) closeMarketingMenu();
  });
}
