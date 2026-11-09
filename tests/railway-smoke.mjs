import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tests the built public layout and real PHP API. Apache/Docker still need a
// platform build; the temporary PHP router below approximates the rewrite rules.
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = resolve(root, '.artifacts');
const suffix = randomBytes(8).toString('hex');
const fixture = resolve(artifacts, `railway-smoke-${suffix}`);
const publicPath = resolve(fixture, 'public');
const php = process.env.SPORTSHUB_PHP || (existsSync(resolve(root, '.tools/php/php.exe')) ? resolve(root, '.tools/php/php.exe') : 'php');
const phpString = (value) => "'" + value.replaceAll('\\', '/').replaceAll("'", "\\'") + "'";
let server;
let log = '';
try {
  assert.ok(existsSync(resolve(root, 'frontend/dist/index.html')), 'Build the frontend first: npm run build --prefix frontend');
  mkdirSync(fixture, { recursive: true });
  cpSync(resolve(root, 'frontend/dist'), publicPath, { recursive: true });
  mkdirSync(resolve(publicPath, 'api'));
  cpSync(resolve(root, 'deployment/api-index.php'), resolve(publicPath, 'api/index.php'));
  cpSync(resolve(root, 'deployment/public.htaccess'), resolve(publicPath, '.htaccess'));
  mkdirSync(resolve(fixture, 'backend/public'), { recursive: true });
  // Keep the packaged entry-point path exact, with source/config outside public.
  writeFileSync(resolve(fixture, 'backend/public/index.php'), `<?php require ${phpString(resolve(root, 'backend/public/index.php'))};`);
  mkdirSync(resolve(fixture, 'sessions'));
  const router = resolve(fixture, 'router.php');
  writeFileSync(router, `<?php
    $public = ${phpString(publicPath)};
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if ($path === '/api' || str_starts_with($path, '/api/')) require $public . '/api/index.php';
    $file = realpath($public . rawurldecode($path));
    if ($file !== false && str_starts_with($file, realpath($public) . DIRECTORY_SEPARATOR) && is_file($file)) return false;
    header('Content-Type: text/html; charset=utf-8');
    readfile($public . '/index.html');
  `);
  const listener = createServer();
  await new Promise((ok) => listener.listen(0, '127.0.0.1', ok));
  const port = listener.address().port;
  await new Promise((ok) => listener.close(ok));
  server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', publicPath, router], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SPORTSHUB_ENV: 'development', SPORTSHUB_SESSION_SECURE: '0', SPORTSHUB_APP_KEY: randomBytes(32).toString('hex'), SPORTSHUB_SESSION_PATH: resolve(fixture, 'sessions') },
  });
  server.on('error', (error) => { log += String(error); });
  server.stderr.on('data', (data) => { log = (log + data).slice(-4000); });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* starting */ }
    if (server.exitCode !== null) break;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  assert.ok(ready, `PHP routing smoke server did not start: ${log}`);
  const index = readFileSync(resolve(publicPath, 'index.html'), 'utf8');
  for (const path of ['/', '/profile', '/admin/bookings', '/sports-clubs/123', '/training-attendance/123/attendance']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(await response.text(), index, path);
  }
  console.log('PASS Railway layout: built frontend and deep links');
  const asset = index.match(/src="([^"\s]+\.js)"/)[1];
  const js = await fetch(origin + asset);
  assert.equal(js.status, 200); assert.match(js.headers.get('content-type'), /javascript/);
  assert.ok((await js.text()).length > 1000);
  console.log('PASS Railway layout: compiled JavaScript is served as an asset');
  const health = await fetch(origin + '/api/health');
  assert.equal(health.status, 200, 'The configured local MySQL server must be running');
  assert.equal((await health.json()).data.database, 'connected');
  const anonymous = await fetch(origin + '/api/users/me');
  assert.equal(anonymous.status, 401); assert.equal((await anonymous.json()).data, null);
  const missing = await fetch(origin + '/api/unknown-route?check=1');
  assert.equal(missing.status, 404); assert.equal((await missing.json()).error.code, 'not_found');
  console.log('PASS Railway layout: real PHP health, permissions and missing API JSON');
  const session = await fetch(origin + '/api/auth/session');
  const cookie = session.headers.getSetCookie().find((value) => value.startsWith('SPORTSHUBSESSID='));
  assert.ok(cookie); assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i);
  const payload = await session.json();
  assert.equal(typeof payload.data.csrf_token, 'string');
  const again = await fetch(origin + '/api/auth/session', { headers: { Cookie: cookie.split(';')[0] } });
  assert.equal((await again.json()).data.csrf_token, payload.data.csrf_token);
  console.log('PASS Railway layout: same-origin session cookie and CSRF continuity');
  for (const path of ['/backend/.env', '/backend/src/shared/Config.php', '/database/migrations/001_authentication_users.sql']) {
    const response = await fetch(origin + path);
    assert.equal(await response.text(), index, 'Private files must not be exposed: ' + path);
  }
  assert.equal(existsSync(resolve(publicPath, 'backend')), false);
  assert.equal(existsSync(resolve(publicPath, '.env')), false);
  console.log('PASS Railway layout: PHP source, database scripts and private config stay outside public');
  const publicCheck = spawnSync(process.execPath, ['scripts/verify-deployment.mjs', origin, '--allow-local-http'], { cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.equal(publicCheck.status, 0, publicCheck.stderr || publicCheck.stdout || publicCheck.error?.message);
  console.log(publicCheck.stdout.trim());
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const stopped = new Promise((ok) => server.once('exit', ok)); server.kill(); await stopped;
  }
  if (existsSync(fixture)) {
    const target = realpathSync(fixture);
    assert.equal(dirname(target), realpathSync(artifacts));
    assert.match(basename(target), /^railway-smoke-[a-f0-9]{16}$/);
    rmSync(target, { recursive: true });
  }
}
