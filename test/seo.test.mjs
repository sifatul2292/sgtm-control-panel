import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer, request } from 'node:http';
const root = new URL('../', import.meta.url);
const publicDir = new URL('../public/', import.meta.url);
const source = await readFile(new URL('server.js', root), 'utf8');
const routes = source.slice(source.indexOf('    // Marketing discovery must work'), source.indexOf('    if (pathname === "/" && !isAuthenticated(req))'));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runRoutes = new AsyncFunction('req', 'res', 'pathname', 'hostname', 'serveStatic', 'servePublicPage', routes);
async function servePublicPage(res, name) {
  try { const content = await readFile(new URL(name, publicDir)); res.writeHead(200, { 'content-type': 'text/html' }); res.end(content); }
  catch { res.writeHead(404); res.end('Not found'); }
}
async function serveStatic(req, res) {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1);
  res.writeHead(200, { 'content-type': name.endsWith('.xml') ? 'application/xml' : 'text/plain' });
  res.end(await readFile(new URL(name, publicDir)));
}
test('public SEO routes work without authentication and reject unknown/traversal article slugs', async () => {
  const server = createServer(async (req, res) => {
    try { await runRoutes(req, res, new URL(req.url, 'http://localhost').pathname, req.headers.host.split(':')[0], serveStatic, servePublicPage); if (!res.writableEnded) { res.writeHead(404); res.end(); } }
    catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/blog', '/blog/server-side-tracking-explained', '/robots.txt', '/sitemap.xml']) assert.equal((await fetch(origin + path)).status, 200, path);
    for (const path of ['/blog/not-a-post', '/blog/..%2Fserver.js', '/blog/foo/bar']) assert.equal((await fetch(origin + path)).status, 404, path);
    const appRequest = path => new Promise((resolve, reject) => {
      const req = request(origin + path, { headers: { Host: 'app.tagioo.com' } }, res => { let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ body, headers: res.headers })); });
      req.on('error', reject); req.end();
    });
    assert.match((await appRequest('/robots.txt')).body, /Disallow: \//);
    assert.equal((await appRequest('/blog')).headers['x-robots-tag'], 'noindex, nofollow');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('six articles have unique canonicals, one h1, parseable schema and resolvable blog links', async () => {
  const articles = (await readdir(new URL('blog/', publicDir))).filter(name => name !== 'index.html' && name.endsWith('.html'));
  assert.equal(articles.length, 6);
  const canonicals = new Set();
  for (const name of [...articles, 'index.html']) {
    const html = await readFile(new URL('blog/' + name, publicDir), 'utf8');
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)[1];
    assert.ok(!canonicals.has(canonical)); canonicals.add(canonical);
    for (const script of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) assert.equal(JSON.parse(script[1])['@context'], 'https://schema.org');
    for (const link of html.matchAll(/href="\/blog\/([^"]+)"/g)) assert.ok(articles.includes(link[1] + '.html'), link[1]);
  }
  const sitemap = await readFile(new URL('sitemap.xml', publicDir), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, 16);
  for (const name of articles) assert.ok(sitemap.includes('https://tagioo.com/blog/' + name.slice(0, -5)));
});
