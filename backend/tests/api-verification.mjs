import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseContext } from '../../scripts/release-context.mjs';

// Replays the 37 cases in the 9 November report. Existing databases are read only.
// Each run retains a NEW fixture database; it never drops, resets or repairs one.
const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
const php = process.env.SPORTSHUB_PHP || (existsSync('.tools/php/php.exe') ? resolve('.tools/php/php.exe') : 'php');
const inspectPhp = String.raw`
require getcwd() . '/backend/src/shared/bootstrap.php';
$config = SportsHub\Config::all();
$c = $config['database'];
if ($config['environment'] !== 'development' || !in_array($c['host'], ['127.0.0.1', 'localhost', '::1'], true)) {
    throw new RuntimeException('Verification requires a loopback development database.');
}
$db = SportsHub\Database::get();
$db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
$db->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
$tables = [];
foreach ($db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
    if (!preg_match('/\A[a-zA-Z0-9_]+\z/', $table)) throw new RuntimeException('Unsupported table identifier.');
    $quoted = chr(96) . $table . chr(96);
    $rows = array_map(static fn(array $row): string => json_encode($row, JSON_THROW_ON_ERROR), $db->query('SELECT * FROM ' . $quoted)->fetchAll());
    sort($rows, SORT_STRING);
    $columns = $db->query('SHOW COLUMNS FROM ' . $quoted)->fetchAll();
    $ddl = $db->query('SHOW CREATE TABLE ' . $quoted)->fetch(PDO::FETCH_NUM)[1];
    $tables[$table] = ['rows' => count($rows), 'sha256' => hash('sha256', implode("\n", $rows)),
        'columns' => array_column($columns, 'Type', 'Field'), 'schema_sha256' => hash('sha256', $ddl)];
}
ksort($tables);
$selected = $db->query('SELECT DATABASE() AS name, @@port AS port')->fetch();
$db->exec('COMMIT');
echo json_encode(['environment' => $config['environment'], 'host' => $c['host'], 'port' => $c['port'],
    'database' => $c['name'], 'selected_database' => $selected['name'], 'server_port' => (int) $selected['port'],
    'tables' => $tables], JSON_THROW_ON_ERROR);
`;

function runPhp(code, env = process.env) {
  const result = spawnSync(php, [], { input: '<?php\n' + code, env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, 'PHP verification helper failed; check local database/runtime configuration.');
  return result.stdout;
}
function cli(file, args, env) {
  const result = spawnSync(php, [file, ...args], { env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, `${file} failed; inspect local configuration and schema before proceeding.`);
  return result.stdout;
}

if (process.argv.includes('--inspect')) {
  console.log(runPhp(inspectPhp));
} else {
  assert.equal(process.argv.length, 2, 'Usage: node backend/tests/api-verification.mjs [--inspect]');
  await verify();
}

async function verify() {
  const before = JSON.parse(runPhp(inspectPhp));
  const suffix = randomBytes(8).toString('hex');
  const database = `sportshub_test_${suffix}`;
  const artifacts = resolve('.artifacts', 'api-verification', suffix);
  mkdirSync(resolve(artifacts, 'sessions'), { recursive: true });
  const env = { ...process.env, SPORTSHUB_DB_NAME: database, SPORTSHUB_ENV: 'development',
    SPORTSHUB_APP_KEY: randomBytes(32).toString('hex'), SPORTSHUB_SESSION_SECURE: '0',
    SPORTSHUB_SESSION_PATH: resolve(artifacts, 'sessions') };
  const port = Number(process.env.SPORTSHUB_API_PORT || '8000');
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, 'Invalid SPORTSHUB_API_PORT.');
  const listener = createServer();
  await new Promise((accept, reject) => listener.once('error', reject).listen(port, '127.0.0.1', accept));
  await new Promise((accept) => listener.close(accept));
  // Refuse to run setup unless the random name is currently unused.
  assert.equal(runPhp(String.raw`
require getcwd() . '/backend/src/shared/bootstrap.php';
$db = SportsHub\Database::connect(false);
$query = $db->prepare('SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
$query->execute([getenv('SPORTSHUB_DB_NAME')]);
echo $query->fetchColumn();
`, env), '0', 'Fixture database already exists; refusing to modify it.');

  const report = { ...releaseContext(), executed_at: new Date().toISOString(), timezone: 'Asia/Colombo',
    scope: '37 report cases replayed with synthetic accounts; original tester environment unavailable',
    working_database: before, fixture_database: database, api_base: `http://127.0.0.1:${port}/api`,
    existing_database_migrations_applied: [], fresh_fixture_migrations: '001-012 through backend/bin/setup.php',
    original_cases: [], supplementary_checks: [], backend_errors: [], working_database_unchanged: null };
  let server;
  let serverLog = '';
  let caught;
  const adminPassword = 'Admin!' + randomBytes(20).toString('hex');
  const studentPassword = 'Student!' + randomBytes(20).toString('hex');
  const adminEmail = `admin-${suffix}@example.test`;
  const studentEmail = `student-${suffix}@example.test`;
  let cookie = '';
  let csrf = '';
  async function request(path, method = 'GET', body, authenticated = true) {
    const headers = {};
    if (authenticated && cookie) headers.Cookie = cookie;
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      if (authenticated && csrf) headers['X-CSRF-Token'] = csrf;
    }
    const response = await fetch(report.api_base + path, { method, headers,
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}), redirect: 'manual', signal: AbortSignal.timeout(10000) });
    if (authenticated) {
      for (const value of response.headers.getSetCookie()) cookie = value.split(';')[0];
    }
    const json = await response.json();
    if (authenticated && json.data?.csrf_token) csrf = json.data.csrf_token;
    return { status: response.status, json, data: json.data, error: json.error };
  }
  async function check(id, method, path, expected, validate = () => {}, body) {
    let actual = null;
    let details = '';
    let result = 'PASS';
    try {
      const response = await request(path, method, body);
      actual = response.status;
      assert.equal(actual, expected, 'Unexpected HTTP status');
      assert.ok(Object.hasOwn(response.json, 'data') && Object.hasOwn(response.json, 'error'), 'Invalid response envelope');
      if (expected < 400) assert.equal(response.error, null);
      else {
        assert.equal(response.data, null);
        assert.equal(typeof response.error?.code, 'string');
        details = `${response.error.code}: ${response.error.message}`;
      }
      await validate(response);
    } catch (error) { result = 'FAIL'; details = error.message; }
    report.original_cases.push({ id, method, endpoint: '/api' + path, expected_status: expected, actual_status: actual, result, details });
    console.log(`${result} ${id} ${method} /api${path}: expected ${expected}, actual ${actual}`);
  }
  async function extra(label, operation) {
    try { await operation(); report.supplementary_checks.push({ label, result: 'PASS' }); }
    catch (error) { report.supplementary_checks.push({ label, result: 'FAIL', details: error.message }); }
  }
  const listSize = (size) => ({ data }) => assert.equal(data.users.length, size);
  const emptyList = ({ data }) => assert.deepEqual(data, []);
  const emptyReport = ({ data }) => { assert.deepEqual(data.records, []); assert.equal(data.summary.total_records, 0); };
  try {
    cli('backend/bin/setup.php', [], env);
    cli('backend/bin/create-admin.php', ['--name=Shahilan Admin', `--email=${adminEmail}`], { ...env, SPORTSHUB_ADMIN_PASSWORD: adminPassword });
    // Verify configuration resolved by the exact environment inherited by the HTTP worker.
    const runtime = JSON.parse(runPhp(inspectPhp, env));
    assert.equal(runtime.database, database);
    assert.equal(Object.keys(runtime.tables).length, 20);
    report.http_worker_database = { host: runtime.host, port: runtime.port, database: runtime.database, server_port: runtime.server_port };
    server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', 'backend/public', 'backend/router.php'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', (chunk) => { serverLog += chunk; });
    server.stderr.on('data', (chunk) => { serverLog += chunk; });
    server.on('error', () => { serverLog += '\nAPI server process failed to launch.\n'; });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await request('/health')).status === 200) { ready = true; break; } } catch { /* starting */ }
      if (server.exitCode !== null) break;
      await new Promise((accept) => setTimeout(accept, 100));
    }
    assert.ok(ready, 'PHP API server did not become ready.');
    await check('T01', 'GET', '/health', 200, ({ data }) => assert.equal(data.database, 'connected'));
    await check('T02', 'GET', '/auth/session', 200, ({ data }) => { assert.equal(data.user, null); assert.ok(data.csrf_token.length >= 32); });
    await check('T03', 'POST', '/auth/login', 200, ({ data }) => assert.equal(data.user.role, 'admin'), { email: adminEmail, password: adminPassword });
    // Controlled fixture creation is setup, not one of the original 37 cases.
    const student = await request('/users', 'POST', { name: 'Shahilan Student', email: studentEmail, password: studentPassword, role: 'student', status: 'active' });
    assert.equal(student.status, 201);
    assert.equal(student.data.id, 2);
    await check('T04', 'GET', '/users/me', 200, ({ data }) => assert.equal(data.email, adminEmail));
    await check('T05', 'GET', '/announcements', 200, ({ data }) => assert.deepEqual(data.announcements, []));
    await check('T06', 'GET', '/users', 200, listSize(2));
    await check('T07', 'GET', '/users?search=shahilan', 200, listSize(2));
    await check('T08', 'GET', '/users?role=student', 200, ({ data }) => { assert.equal(data.users.length, 1); assert.equal(data.users[0].role, 'student'); });
    await check('T09', 'GET', '/users?role=admin', 200, ({ data }) => { assert.equal(data.users.length, 1); assert.equal(data.users[0].role, 'admin'); });
    await check('T10', 'GET', '/users?status=active', 200, listSize(2));
    await check('T11', 'GET', '/users?status=inactive', 200, listSize(0));
    let firstUser;
    await check('T12', 'GET', '/users?page=1&per_page=1', 200, ({ data }) => { assert.equal(data.users.length, 1); firstUser = data.users[0].id; });
    await check('T13', 'GET', '/users?page=2&per_page=1', 200, ({ data }) => { assert.equal(data.users.length, 1); assert.notEqual(data.users[0].id, firstUser); });
    await check('T14', 'GET', '/users?page=3&per_page=1', 200, listSize(0));
    await check('T15', 'GET', '/users?page=0&per_page=1', 422);
    await check('T16', 'GET', '/users?role=manager', 422);
    await check('T17', 'GET', '/users?status=pending', 422);
    await check('T18', 'GET', '/users?per_page=0', 422);
    await check('T19', 'GET', '/users/2', 200, ({ data }) => assert.equal(data.email, studentEmail));
    await check('T20', 'GET', '/users/999999', 404);
    await check('T21', 'GET', '/users/abc', 404);
    await check('T22', 'POST', '/users/2', 405);
    let announcementId;
    await check('T23', 'POST', '/announcements', 201, ({ data }) => { assert.equal(data.title, 'Verification fixture'); announcementId = data.announcement_id; }, { title: 'Verification fixture', body: 'Synthetic announcement for the API verification replay.' });
    await check('T24', 'GET', '/notifications', 200, ({ data }) => { assert.equal(data.notifications.length, 1); assert.equal(data.unread_count, 1); });
    await check('T25', 'GET', '/participation/me', 200, emptyReport);
    await check('T26', 'GET', '/reports/participation', 200, emptyReport);
    await check('T27', 'GET', '/facilities', 200, emptyList);
    await check('T28', 'GET', '/equipment', 200, emptyList);
    await check('T29', 'GET', '/bookings', 200, emptyList);
    await check('T30', 'GET', '/memberships', 200, ({ data }) => { assert.deepEqual(data.memberships, []); assert.equal(data.pagination.total, 0); });
    await check('T31', 'GET', '/club-coaches', 200, emptyList);
    await check('T32', 'GET', '/tournaments', 200, emptyList);
    await check('T33', 'GET', '/matches/999999', 404);
    await check('T34', 'GET', '/sports', 200, emptyList);
    await check('T35', 'GET', '/clubs', 200, emptyList);
    await check('T36', 'GET', '/training-sessions', 200, emptyList);
    await check('T37', 'GET', '/attendance', 200, emptyList);
    await extra('Announcement persists on a separate HTTP read', async () => {
      const response = await request(`/announcements/${announcementId}`);
      assert.equal(response.status, 200); assert.equal(response.data.title, 'Verification fixture');
    });
    await extra('Unsigned clients cannot read protected endpoints', async () => {
      for (const path of ['/notifications', '/participation/me', '/reports/participation', '/facilities', '/equipment', '/bookings', '/memberships', '/club-coaches', '/tournaments', '/matches/999999', '/sports', '/clubs', '/training-sessions', '/attendance']) {
        assert.equal((await request(path, 'GET', undefined, false)).status, 401, path);
      }
    });
    await extra('Announcement write requires CSRF', async () => {
      const saved = csrf; csrf = '';
      try { assert.equal((await request('/announcements', 'POST', { title: 'Rejected fixture', body: 'Must be rejected without a CSRF token.' })).status, 403); }
      finally { csrf = saved; }
    });
    await extra('Student cannot read Admin accounts/reports or create announcements', async () => {
      await request('/auth/logout', 'POST');
      await request('/auth/session');
      assert.equal((await request('/auth/login', 'POST', { email: studentEmail, password: studentPassword })).status, 200);
      assert.equal((await request('/users')).status, 403);
      assert.equal((await request('/reports/participation')).status, 403);
      assert.equal((await request('/announcements', 'POST', { title: 'Denied fixture', body: 'Student publishing must be rejected.' })).status, 403);
      assert.equal((await request('/participation/me')).status, 200);
      assert.equal((await request('/notifications')).data.notifications.length, 1);
    });
  } catch (error) { caught = error; report.fatal_error = error.message; }
  finally {
    if (server && server.exitCode === null && server.signalCode === null && server.pid) {
      const stopped = new Promise((accept) => server.once('exit', accept));
      server.kill(); await stopped;
    }
    try {
      const after = JSON.parse(runPhp(inspectPhp));
      report.working_database_unchanged = JSON.stringify(after) === JSON.stringify(before);
      assert.equal(report.working_database_unchanged, true, 'Working database changed during verification.');
    } catch (error) { caught ??= error; report.preservation_error = error.message; }
    report.backend_errors = serverLog.split(/\r?\n/).filter((line) => /SQLSTATE|PHP (?:Fatal|Warning|Parse)|SportsHub (?:database|application) failure|PDOException|\[[45]\d\d\]/i.test(line));
    // Never persist cookies, CSRF values, passwords or full HTTP response bodies.
    writeFileSync(resolve(artifacts, 'php-server.log'), serverLog);
    writeFileSync(resolve(artifacts, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    const rows = report.original_cases.map((r) => `| ${r.id} | ${r.method} ${r.endpoint} | ${r.expected_status} | ${r.actual_status ?? 'No response'} | ${r.result} | ${r.details.replaceAll('|', '\\|')} |`);
    writeFileSync(resolve(artifacts, 'results.md'), '| Case | Endpoint | Expected | Actual | Result | Details |\n| --- | --- | --- | --- | --- | --- |\n' + rows.join('\n') + '\n');
    console.log(`Evidence: ${artifacts}`);
    console.log(`Fixture database retained: ${database}. Working database unchanged: ${report.working_database_unchanged}`);
  }
  const failures = report.original_cases.filter((r) => r.result !== 'PASS').length;
  const extraFailures = report.supplementary_checks.filter((r) => r.result !== 'PASS').length;
  console.log(`${report.original_cases.length - failures}/${report.original_cases.length} original cases passed; ${report.supplementary_checks.length - extraFailures}/${report.supplementary_checks.length} supplementary checks passed; ${report.backend_errors.length} backend error log entries.`);
  if (caught || failures || extraFailures || report.original_cases.length !== 37 || report.backend_errors.length) process.exitCode = 1;
}
