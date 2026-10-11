const guides = [...document.querySelectorAll('.post-card')];
const topics = [...document.querySelectorAll('[data-topic]')];
const search = document.getElementById('guideSearch');
const count = document.getElementById('guideCount');
let topic = 'All guides';
function filterGuides() {
  const query = search.value.trim().toLowerCase();
  let shown = 0;
  guides.forEach(guide => {
    guide.hidden = (topic !== 'All guides' && guide.dataset.category !== topic) || !guide.textContent.toLowerCase().includes(query);
    if (!guide.hidden) shown++;
  });
  count.textContent = `${shown} ${shown === 1 ? 'guide' : 'guides'}`;
  document.querySelector('.empty-guides').hidden = shown !== 0;
}
topics.forEach(button => button.addEventListener('click', () => {
  topic = button.dataset.topic;
  topics.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  filterGuides();
}));
search.addEventListener('input', filterGuides);
