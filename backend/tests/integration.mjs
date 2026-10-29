import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testCompetitions } from './competitions.mjs';
import { testMemberships } from './memberships.mjs';
import { testResourcesAndBookings } from './resources-bookings.mjs';

// Real PHP + MySQL/MariaDB HTTP tests. Creates and drops ONLY a random test DB.
const root = fileURLToPath(new URL('../../', import.meta.url));
const php = process.env.SPORTSHUB_PHP || 'php';
const suffix = randomBytes(8).toString('hex');
const database = `sportshub_test_${suffix}`;
const sessionPath = resolve(root, '.artifacts', `sessions-${suffix}`);
mkdirSync(sessionPath, { recursive: true });
const env = {
  ...process.env,
  SPORTSHUB_ENV: 'development',
  SPORTSHUB_DB_NAME: database,
  SPORTSHUB_APP_KEY: randomBytes(32).toString('hex'),
  SPORTSHUB_SESSION_PATH: sessionPath,
  SPORTSHUB_SESSION_SECURE: '0',
};
const adminEmail = `admin-${suffix}@example.test`;
const adminPassword = `Admin!${randomBytes(18).toString('hex')}`;
const password = `Student!${randomBytes(16).toString('hex')}`;
let backend;
let serverLog = '';
let count = 0;

function cli(file, args = [], extra = {}) {
  const result = spawnSync(php, [resolve(root, file), ...args], {
    cwd: root, env: { ...env, ...extra }, encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.status, 0, `${file} failed: ${result.stderr || result.error || result.stdout}`);
  return result.stdout;
}

async function check(label, operation) {
  await operation();
  count += 1;
  console.log(`PASS ${label}`);
}

function safeUser(user) {
  assert.equal(typeof user.id, 'number');
  assert.equal(typeof user.email, 'string');
  for (const key of ['password', 'password_hash', 'auth_version', 'deleted_at']) {
    assert.equal(Object.hasOwn(user, key), false, `Private field leaked: ${key}`);
  }
}

let base;
class Client {
  cookie = '';
  csrf = '';

  async request(path, { method = 'GET', body, token = true, raw, headers = {} } = {}) {
    const requestHeaders = { ...headers };
    if (this.cookie) requestHeaders.Cookie = this.cookie;
    if (!['GET', 'HEAD'].includes(method)) {
      requestHeaders['Content-Type'] ??= 'application/json';
      if (token && this.csrf) requestHeaders['X-CSRF-Token'] = this.csrf;
    }
    const response = await fetch(`${base}${path}`, {
      method, headers: requestHeaders,
      body: raw ?? (body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body)),
      redirect: 'manual',
    });
    const cookies = response.headers.getSetCookie();
    for (const cookie of cookies) {
      if (cookie.includes('=') && !cookie.startsWith('deleted=')) this.cookie = cookie.split(';')[0];
    }
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    if (response.status === 204) {
      assert.equal(await response.text(), '');
      return { status: 204, data: null, error: null, headers: response.headers };
    }
    const json = await response.json();
    assert.equal(Object.hasOwn(json, 'data'), true);
    assert.equal(Object.hasOwn(json, 'error'), true);
    if (response.ok) assert.equal(json.error, null);
    else {
      assert.equal(json.data, null);
      assert.equal(typeof json.error.code, 'string');
      assert.equal(typeof json.error.message, 'string');
    }
    if (json.data?.csrf_token) this.csrf = json.data.csrf_token;
    return { status: response.status, data: json.data, error: json.error, headers: response.headers };
  }

  async session() { return this.request('/auth/session'); }
}

async function freePort() {
  const listener = createServer();
  await new Promise((accept, reject) => listener.once('error', reject).listen(0, '127.0.0.1', accept));
  const port = listener.address().port;
  await new Promise((accept) => listener.close(accept));
  return port;
}

try {
  console.log(`Using isolated database ${database}`);
  cli('backend/bin/setup.php');
  cli('backend/bin/create-admin.php', ['--name=Integration Admin', `--email=${adminEmail}`], {
    SPORTSHUB_ADMIN_PASSWORD: adminPassword,
  });
  const port = await freePort();
  base = `http://127.0.0.1:${port}/api`;
  backend = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', 'backend/public', 'backend/router.php'], {
    cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  backend.stderr.on('data', (data) => { serverLog = (serverLog + data).slice(-12_000); });
  backend.on('error', (error) => { serverLog += String(error); });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch { /* starting */ }
    if (backend.exitCode !== null) break;
    await new Promise((accept) => setTimeout(accept, 100));
  }
  assert.equal(ready, true, `PHP did not start: ${serverLog}`);
  const student = new Client();
  const admin = new Client();
  let studentId;
  let targetId;
  let targetEmail;
  let studentEmail = `student-${suffix}@example.test`;

  await check('Anonymous session issues a protected cookie and CSRF token', async () => {
    const result = await student.session();
    assert.equal(result.status, 200);
    assert.equal(result.data.user, null);
    assert.ok(student.csrf.length >= 32);
    const cookie = result.headers.getSetCookie().join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  });
  await check('Writes without CSRF are rejected, including public registration', async () => {
    const result = await student.request('/auth/register', { method: 'POST', token: false, body: {} });
    assert.equal(result.status, 403);
  });
  await check('Malformed JSON and unsupported request content types are rejected', async () => {
    assert.equal((await student.request('/auth/login', { method: 'POST', raw: '{' })).status, 400);
    assert.equal((await student.request('/auth/login', {
      method: 'POST', raw: '{}', headers: { 'Content-Type': 'text/plain' },
    })).status, 415);
  });
  await check('Registration validates passwords and prevents self-assigned Admin roles', async () => {
    const body = { name: 'Test Student', email: studentEmail, password: 'short' };
    assert.equal((await student.request('/auth/register', { method: 'POST', body })).status, 422);
    body.password = password;
    body.role = 'admin';
    assert.equal((await student.request('/auth/register', { method: 'POST', body })).status, 422);
    delete body.role;
    body.password = 'x'.repeat(73);
    assert.equal((await student.request('/auth/register', { method: 'POST', body })).status, 422);
  });
  await check('Student registration persists and returns a safe authenticated user', async () => {
    const result = await student.request('/auth/register', {
      method: 'POST', body: { name: 'Test Student', email: studentEmail, password, student_id: `S-${suffix}` },
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.user.role, 'student');
    assert.equal(result.data.user.status, 'active');
    safeUser(result.data.user);
    studentId = result.data.user.id;
    assert.equal((await student.session()).data.user.id, studentId);
  });
  await check('Students cannot list, create, inspect or mutate other users', async () => {
    assert.equal((await student.request('/users')).status, 403);
    assert.equal((await student.request('/users/1')).status, 403);
    assert.equal((await student.request('/users', { method: 'POST', body: {} })).status, 403);
    assert.equal((await student.request('/users/1', { method: 'PATCH', body: {} })).status, 403);
    assert.equal((await student.request('/users/1', { method: 'DELETE' })).status, 403);
    assert.equal((await student.request('/users/me', { method: 'PATCH', body: { role: 'admin' } })).status, 422);
  });
  await check('Profile updates persist after a separate HTTP read', async () => {
    const result = await student.request('/users/me', { method: 'PATCH', body: { name: 'Updated Student', phone: '+94771234567' } });
    assert.equal(result.status, 200);
    safeUser(result.data);
    const saved = await student.request('/users/me');
    assert.equal(saved.data.name, 'Updated Student');
    assert.equal(saved.data.phone, '+94771234567');
  });
  await check('Changing email requires the current password', async () => {
    const result = await student.request('/users/me', { method: 'PATCH', body: { email: `changed-${suffix}@example.test` } });
    assert.equal(result.status, 422);
    assert.equal((await student.request('/users/me')).data.email, studentEmail);
  });
  await check('Confirmed email changes persist and revoke other sessions', async () => {
    const other = new Client();
    await other.session();
    assert.equal((await other.request('/auth/login', { method: 'POST', body: { email: studentEmail, password } })).status, 200);
    const changedEmail = `changed-${suffix}@example.test`;
    assert.equal((await student.request('/users/me', {
      method: 'PATCH', body: { email: changedEmail, current_password: password },
    })).status, 200);
    studentEmail = changedEmail;
    assert.equal((await student.session()).data.user.email, studentEmail);
    assert.equal((await other.request('/users/me')).status, 401);
  });
  await check('Login failures are generic and Admin login works', async () => {
    await admin.session();
    const result = await admin.request('/auth/login', { method: 'POST', body: { email: adminEmail, password: 'WrongPassword!123' } });
    assert.equal(result.status, 401);
    const unknown = new Client();
    await unknown.session();
    const other = await unknown.request('/auth/login', { method: 'POST', body: { email: `unknown-${suffix}@example.test`, password: 'WrongPassword!123' } });
    assert.equal(other.error.message, result.error.message);
    assert.equal((await admin.request('/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } })).data.user.role, 'admin');
  });
  await testResourcesAndBookings({ check, Client, admin, student, cli });
  const membershipContext = await testMemberships({ check, Client, admin, cli, suffix, password });
  await testCompetitions({ check, Client, admin, ...membershipContext });

  await check('Admin can create/read a user and duplicate email is rejected', async () => {
    targetEmail = `managed-${suffix}@example.test`;
    const body = { name: 'Managed Student', email: targetEmail, password, role: 'student', status: 'active' };
    const result = await admin.request('/users', { method: 'POST', body });
    assert.equal(result.status, 201);
    safeUser(result.data);
    targetId = result.data.id;
    const saved = await admin.request(`/users/${targetId}`);
    assert.equal(saved.status, 200);
    assert.equal(saved.data.email, targetEmail);
    assert.equal((await admin.request('/users', { method: 'POST', body })).status, 409);
  });
  await check('Duplicate Student IDs are rejected without affecting the existing account', async () => {
    const result = await admin.request('/users', {
      method: 'POST', body: { name: 'Duplicate ID', email: `duplicate-${suffix}@example.test`, password, student_id: `S-${suffix}` },
    });
    assert.equal(result.status, 409);
    assert.equal((await admin.request(`/users/${studentId}`)).data.student_id, `S-${suffix}`);
  });
  await check('Admin lists support search, filters and bounded pagination', async () => {
    const result = await admin.request(`/users?search=${encodeURIComponent(targetEmail)}&role=student&status=active&page=1&per_page=1`);
    assert.equal(result.status, 200);
    assert.equal(result.data.users.length, 1);
    assert.equal(result.data.users[0].id, targetId);
    assert.equal(result.data.pagination.total, 1);
    assert.equal(result.data.pagination.per_page, 1);
    assert.equal((await admin.request('/users?page=0')).status, 422);
    assert.equal((await admin.request('/users?role=superadmin')).status, 422);
    assert.equal((await admin.request('/users?search=%27%20OR%201%3D1--')).data.users.length, 0);
  });
  await check('Admin can update/deactivate/reactivate users; inactive users cannot log in', async () => {
    const existing = new Client();
    await existing.session();
    assert.equal((await existing.request('/auth/login', { method: 'POST', body: { email: targetEmail, password } })).status, 200);
    const result = await admin.request(`/users/${targetId}`, { method: 'PATCH', body: { name: 'Changed by Admin', status: 'inactive' } });
    assert.equal(result.status, 200);
    assert.equal((await existing.request('/users/me')).status, 401);
    assert.equal((await admin.request(`/users/${targetId}`)).data.name, 'Changed by Admin');
    const inactive = new Client();
    await inactive.session();
    assert.equal((await inactive.request('/auth/login', { method: 'POST', body: { email: targetEmail, password } })).status, 401);
    assert.equal((await admin.request(`/users/${targetId}`, { method: 'PATCH', body: { status: 'active' } })).status, 200);
    assert.equal((await existing.request('/users/me')).status, 401);
  });
  await check('Admin self-demotion, self-deactivation and self-deletion cannot lock out the application', async () => {
    const adminId = (await admin.session()).data.user.id;
    assert.equal((await admin.request(`/users/${adminId}`, { method: 'PATCH', body: { role: 'student' } })).status, 409);
    assert.equal((await admin.request(`/users/${adminId}`, { method: 'PATCH', body: { status: 'inactive' } })).status, 409);
    assert.equal((await admin.request(`/users/${adminId}`, { method: 'DELETE' })).status, 409);
  });
  await check('Password change preserves the current login and revokes other sessions', async () => {
    const other = new Client();
    await other.session();
    assert.equal((await other.request('/auth/login', { method: 'POST', body: { email: studentEmail, password } })).status, 200);
    assert.equal((await student.request('/users/me/password', { method: 'PATCH', body: { current_password: 'WrongPassword!123', new_password: password } })).status, 422);
    const nextPassword = `Changed!${randomBytes(16).toString('hex')}`;
    assert.equal((await student.request('/users/me/password', { method: 'PATCH', body: { current_password: password, new_password: nextPassword } })).status, 200);
    assert.equal((await other.request('/users/me')).status, 401);
    assert.equal((await student.session()).data.user.id, studentId);
    await other.session();
    assert.equal((await other.request('/auth/login', { method: 'POST', body: { email: studentEmail, password } })).status, 401);
    assert.equal((await other.request('/auth/login', { method: 'POST', body: { email: studentEmail, password: nextPassword } })).status, 200);
  });
  await check('Archiving removes users from reads and revokes existing sessions', async () => {
    const victim = new Client();
    await victim.session();
    assert.equal((await victim.request('/auth/login', { method: 'POST', body: { email: targetEmail, password } })).status, 200);
    assert.equal((await admin.request(`/users/${targetId}`, { method: 'DELETE', token: false })).status, 403);
    assert.equal((await admin.request(`/users/${targetId}`, { method: 'DELETE' })).status, 200);
    assert.equal((await admin.request(`/users/${targetId}`)).status, 404);
    assert.equal((await victim.request('/users/me')).status, 401);
    assert.equal((await admin.request(`/users?search=${encodeURIComponent(targetEmail)}`)).data.pagination.total, 0);
    await victim.session();
    assert.equal((await victim.request('/auth/login', { method: 'POST', body: { email: targetEmail, password } })).status, 401);
  });
  await check('Logout destroys the previous authenticated session', async () => {
    const old = new Client();
    old.cookie = student.cookie;
    assert.equal((await student.request('/auth/logout', { method: 'POST' })).status, 200);
    assert.equal((await student.session()).data.user, null);
    assert.equal((await old.request('/users/me')).status, 401);
  });
  await check('Unknown routes and unsupported methods have safe JSON errors', async () => {
    assert.equal((await admin.request('/does-not-exist')).status, 404);
    assert.equal((await admin.request('/users/me', { method: 'PUT' })).status, 405);
  });
  await check('Setup is repeatable and initial-Admin provisioning cannot be repeated', async () => {
    cli('backend/bin/setup.php');
    assert.equal((await admin.request('/users?role=admin')).data.pagination.total, 1);
    const result = spawnSync(php, [resolve(root, 'backend/bin/create-admin.php'), '--name=Unauthorized Bootstrap', `--email=extra-${suffix}@example.test`], {
      cwd: root, env: { ...env, SPORTSHUB_ADMIN_PASSWORD: adminPassword }, encoding: 'utf8', timeout: 30_000,
    });
    assert.notEqual(result.status, 0);
    assert.equal((await admin.request('/users?role=admin')).data.pagination.total, 1);
  });
  await check('Repeated failed login attempts are throttled server-side', async () => {
    const attacker = new Client();
    await attacker.session();
    const body = { email: `throttle-${suffix}@example.test`, password: 'WrongPassword!123' };
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal((await attacker.request('/auth/login', { method: 'POST', body })).status, 401);
    }
    assert.equal((await attacker.request('/auth/login', { method: 'POST', body })).status, 429);
  });
  console.log(`\n${count} integration scenarios passed against PHP and MySQL/MariaDB.`);
} catch (error) {
  console.error(error);
  console.error(serverLog);
  process.exitCode = 1;
} finally {
  if (backend && backend.exitCode === null && backend.signalCode === null) {
    backend.kill();
    await new Promise((accept) => backend.once('exit', accept));
  }
  try { cli('backend/tests/cleanup-database.php'); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
