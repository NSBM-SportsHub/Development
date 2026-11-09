import assert from 'node:assert/strict';

// Read-only public acceptance: never creates users or application records.
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/verify-deployment.mjs https://your-app.up.railway.app [--allow-local-http]');
const url = new URL(target);
assert.equal(url.username + url.password + url.search + url.hash, '', 'Use a public origin without credentials, query or fragment');
assert.ok(url.pathname === '/', 'Use the application origin without a path');
const localHttp = process.argv.includes('--allow-local-http') && ['127.0.0.1', 'localhost'].includes(url.hostname);
assert.ok(url.protocol === 'https:' || (url.protocol === 'http:' && localHttp), 'Hosted verification requires HTTPS');
const origin = url.origin;
async function request(path, headers = {}) {
  return fetch(origin + path, { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
}
async function json(path, status, headers) {
  const response = await request(path, headers);
  assert.equal(response.status, status, path);
  assert.match(response.headers.get('content-type') || '', /application\/json/, path);
  assert.match(response.headers.get('cache-control') || '', /no-store/, path);
  const body = await response.json();
  assert.ok(Object.hasOwn(body, 'data') && Object.hasOwn(body, 'error'), path);
  if (status >= 400) { assert.equal(body.data, null); assert.equal(typeof body.error?.code, 'string'); }
  else assert.equal(body.error, null);
  return { response, body };
}
const index = await request('/');
assert.equal(index.status, 200);
assert.match(index.headers.get('content-type') || '', /text\/html/);
const html = await index.text();
assert.match(html, /id="root"/);
for (const path of ['/login', '/profile', '/admin/bookings', '/admin/coaches', '/admin/reports', '/sports-clubs/123', '/training-attendance/123/attendance']) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  assert.equal(await response.text(), html, path);
}
console.log('PASS deployed frontend and direct React deep links');
const assets = [...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g)].map((match) => match[1]);
assert.ok(assets.some((path) => path.endsWith('.js')) && assets.some((path) => path.endsWith('.css')));
for (const asset of assets) {
  const assetUrl = new URL(asset, origin);
  assert.equal(assetUrl.origin, origin);
  const response = await request(assetUrl.pathname);
  assert.equal(response.status, 200, asset);
  assert.match(response.headers.get('content-type') || '', asset.endsWith('.js') ? /javascript/ : /text\/css/);
  assert.ok((await response.text()).length > 100, asset);
}
console.log('PASS compiled JavaScript and CSS');
assert.equal((await json('/api/health', 200)).body.data.database, 'connected');
for (const path of ['/api/users/me', '/api/bookings', '/api/reports/participation']) await json(path, 401);
assert.equal((await json('/api/unknown-release-check?check=1', 404)).body.error.code, 'not_found');
console.log('PASS database health, anonymous access denial and JSON API routing');
const first = await json('/api/auth/session', 200);
assert.equal(first.body.data.user, null);
const cookie = first.response.headers.getSetCookie().find((value) => value.startsWith('SPORTSHUBSESSID='));
assert.ok(cookie, 'Session cookie');
assert.match(cookie, /HttpOnly/i);
assert.match(cookie, /SameSite=Lax/i);
if (url.protocol === 'https:') assert.match(cookie, /;\s*Secure(?:;|$)/i);
assert.equal(typeof first.body.data.csrf_token, 'string');
assert.ok(first.body.data.csrf_token.length >= 32);
const again = await json('/api/auth/session', 200, { Cookie: cookie.split(';')[0] });
assert.equal(again.body.data.csrf_token, first.body.data.csrf_token);
console.log('PASS session continuity, cookie flags and CSRF token continuity');
for (const path of ['/backend/.env', '/backend/src/shared/Config.php', '/database/migrations/001_authentication_users.sql', '/.git/config']) {
  const response = await request(path);
  const content = await response.text();
  assert.ok([403, 404].includes(response.status) || (response.status === 200 && content === html), 'Private source exposed: ' + path);
}
console.log('PASS private configuration, source, migrations and Git metadata are inaccessible');
console.log(`PASS public deployment checks at ${origin}; authenticated workflows and persistence still require acceptance.`);
