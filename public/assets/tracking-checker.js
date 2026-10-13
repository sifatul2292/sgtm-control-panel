const form = document.getElementById('scanForm');
const button = document.getElementById('scanButton');
const status = document.getElementById('scanStatus');
const reportEl = document.getElementById('scanReport');
let latestReport = null;

function element(tag, text, className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function section(title, description = '') {
  const node = element('section', '', 'report-section');
  node.append(element('h3', title));
  if (description) node.append(element('p', description));
  reportEl.append(node);
  return node;
}
function renderReport(report) {
  reportEl.replaceChildren();
  const top = element('div', '', 'report-top');
  const heading = element('div');
  heading.append(element('h2', 'Your website’s tracking clues'), element('p', report.url, 'report-url'));
  const actions = element('div', '', 'report-actions');
  const download = element('button', 'Download JSON');
  download.type = 'button';
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(latestReport, null, 2)], { type: 'application/json' }));
    const link = element('a');
    link.href = url;
    link.download = 'tagioo-tracking-report.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const print = element('button', 'Print report');
  print.type = 'button';
  print.addEventListener('click', () => window.print());
  actions.append(download, print);
  top.append(heading, actions);
  const summary = element('div', '', 'report-summary');
  const summaryText = element('div');
  summaryText.append(element('h3', 'Visible setup checks observed'), element('p', 'This is evidence coverage, not a tracking quality score. A tag reference does not prove that events are firing or accepted.'));
  summary.append(element('strong', `${report.observedChecks} / ${report.totalChecks}`, 'report-count'), summaryText);
  reportEl.append(top, summary, element('p', `Checked ${new Date(report.scannedAt).toLocaleString()} · ${report.inspectedSources.length} source ${report.inspectedSources.length === 1 ? 'file' : 'files'} · ${(report.bytes / 1024).toFixed(0)} KB inspected · ${(report.durationMs / 1000).toFixed(1)}s scan${report.cached ? ' · cached result' : ''}`, 'report-meta'));
  const checks = section('What we observed', 'Not observed means the clue was not found in the inspected files. It may be loaded elsewhere or after consent.');
  report.signals.forEach(signal => {
    const row = element('div', '', 'evidence-row');
    const detail = element('div');
    detail.append(element('p', signal.detail), element('p', `Verify next: ${signal.next}`, 'next-step'));
    row.append(element('strong', signal.name), detail, element('span', signal.status === 'observed' ? 'Observed' : 'Not observed', `scan-badge${signal.status === 'observed' ? '' : ' unknown'}`));
    checks.append(row);
  });
  const trackers = section('Tracker references & IDs', 'References were found in source. Tags inside externally loaded containers may not appear here.');
  if (!report.trackers.length) trackers.append(element('p', 'No recognizable tracker references found in the inspected source. Verify the live page in your browser before drawing conclusions.', 'report-empty'));
  report.trackers.forEach(tracker => {
    const row = element('div', '', 'evidence-row');
    const detail = element('div');
    detail.append(element('code', tracker.ids.length ? tracker.ids.join(' · ') : 'Reference found; no ID extracted'));
    const evidence = element('details');
    evidence.append(element('summary', 'View source locations'));
    const list = element('ul', '', 'source-list');
    tracker.sources.forEach(url => list.append(element('li', url)));
    evidence.append(list);
    detail.append(evidence);
    row.append(element('strong', tracker.name), detail, element('span', 'Reference', 'scan-badge'));
    trackers.append(row);
  });
  const architecture = section('Website & routing');
  architecture.append(element('p', `Platform clues: ${report.platforms.length ? report.platforms.join(', ') : 'Not observed'}.`));
  if (report.firstPartyEndpoints.length) {
    architecture.append(element('p', 'First-party endpoint references (query parameters omitted):'));
    const list = element('ul', '', 'source-list');
    report.firstPartyEndpoints.forEach(url => list.append(element('li', url)));
    architecture.append(list);
  } else architecture.append(element('p', 'No explicit first-party endpoint URL extracted. Check the routing-clue finding above and inspect a live request.'));
  if (report.multipleIds.length) {
    const ids = section('Multiple IDs to review', 'Multiple IDs can be intentional. They do not establish duplicate events.');
    report.multipleIds.forEach(item => ids.append(element('p', `${item.name}: ${item.ids.join(', ')}. Confirm that each property or container is expected.`)));
  }
  const cookies = section('Cookies in the HTTP response', 'These are response-header attributes, not cookies created by JavaScript. Browser restrictions can shorten lifetimes; values are never included.');
  if (!report.cookies.length) cookies.append(element('p', 'No Set-Cookie headers returned for this request. JavaScript or consent may create cookies later.', 'report-empty'));
  else {
    const wrap = element('div', '', 'report-table-wrap');
    const table = element('table', '', 'report-table');
    const head = element('tr');
    ['Name', 'Secure', 'HttpOnly', 'SameSite', 'Max-Age (seconds)'].forEach(text => head.append(element('th', text)));
    const thead = element('thead'); thead.append(head); table.append(thead);
    const tbody = element('tbody');
    report.cookies.forEach(cookie => {
      const row = element('tr');
      [cookie.name, cookie.secure ? 'Yes' : 'No', cookie.httpOnly ? 'Yes' : 'No', cookie.sameSite, cookie.maxAge || 'Not specified'].forEach(text => row.append(element('td', text)));
      tbody.append(row);
    });
    table.append(tbody); wrap.append(table); cookies.append(wrap);
  }
  const scope = section('Scan scope & limitations', report.limitations);
  if (report.warnings.length) [...new Set(report.warnings)].forEach(warning => scope.append(element('p', warning)));
  const sources = element('ul', '', 'source-list');
  report.inspectedSources.forEach(url => sources.append(element('li', url)));
  scope.append(sources);
  reportEl.hidden = false;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = 'Checking website…';
  status.className = 'scan-status is-loading';
  status.textContent = 'Reading the public page and checking visible tracking clues…';
  reportEl.hidden = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/public/tracking-checker', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: form.elements.url.value.trim() }), signal: AbortSignal.timeout(22000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The scan could not be completed.');
    latestReport = data;
    renderReport(data);
    status.textContent = 'Scan complete. Review the evidence and verification steps below.';
    status.className = 'scan-status';
    reportEl.focus({ preventScroll: true });
    reportEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  } catch (error) {
    status.className = 'scan-status is-error';
    status.textContent = error.name === 'TimeoutError' ? 'The scan timed out. Please try again.' : error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Check website →';
    form.setAttribute('aria-busy', 'false');
  }
});
const menu = document.getElementById('mobileNav');
const menuButton = document.getElementById('menuBtn');
function closeMenu() {
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  menu.inert = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menu.classList.toggle('open', open);
  menu.inert = !open;
  menu.setAttribute('aria-hidden', String(!open));
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.inert) { closeMenu(); menuButton.focus(); } });
