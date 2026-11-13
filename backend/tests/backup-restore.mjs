import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { releaseContext } from '../../scripts/release-context.mjs';

const php = process.env.SPORTSHUB_PHP || (existsSync('.tools/php/php.exe') ? resolve('.tools/php/php.exe') : 'php');
const portable = '.tools/mariadb/mariadb-11.4.13-winx64/bin';
const dump = process.env.SPORTSHUB_MYSQLDUMP || (existsSync(`${portable}/mariadb-dump.exe`) ? resolve(`${portable}/mariadb-dump.exe`) : 'mysqldump');
const mysql = process.env.SPORTSHUB_MYSQL || (existsSync(`${portable}/mariadb.exe`) ? resolve(`${portable}/mariadb.exe`) : 'mysql');
const databases = [0, 1].map(() => 'sportshub_test_' + randomBytes(8).toString('hex'));
const fixtureEnv = { ...process.env, SPORTSHUB_ENV: 'development', SPORTSHUB_SESSION_SECURE: '0', SPORTSHUB_APP_KEY: randomBytes(32).toString('hex') };
function run(program, args, env, input) {
  const result = spawnSync(program, args, { env, input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60000, windowsHide: true });
  assert.equal(result.status, 0, `${program} failed: ${result.error?.message || result.stderr || 'see tool installation/configuration'}`);
  return result.stdout;
}
function cli(file, database, args = []) { return run(php, [file, ...args], { ...fixtureEnv, SPORTSHUB_DB_NAME: database }); }
mkdirSync('.artifacts', { recursive: true });
let failure;
try {
  cli('backend/bin/setup.php', databases[0], ['--seed']);
  cli('backend/tests/database-snapshot.php', databases[0], ['seed']);
  const before = JSON.parse(cli('backend/tests/database-snapshot.php', databases[0], ['snapshot']));
  // Capture private settings through a pipe; never print them or put passwords in arguments.
  const settings = JSON.parse(run(php, ['-r', "require 'backend/src/shared/bootstrap.php'; echo json_encode(SportsHub\\Config::all()['database'], JSON_THROW_ON_ERROR);"], fixtureEnv));
  const clientArgs = ['--host=' + settings.host, '--port=' + settings.port, '--user=' + settings.user, '--default-character-set=utf8mb4'];
  if (settings.ssl_ca) clientArgs.push('--ssl-ca=' + settings.ssl_ca);
  const clientEnv = { ...fixtureEnv, MYSQL_PWD: settings.password };
  const sql = run(dump, [...clientArgs, '--single-transaction', '--skip-lock-tables', '--hex-blob', '--no-tablespaces', databases[0]], clientEnv);
  const dumpPath = resolve('.artifacts', 'backup-rehearsal.sql');
  writeFileSync(dumpPath, sql);
  cli('backend/bin/setup.php', databases[1]);
  run(mysql, [...clientArgs, databases[1]], clientEnv, sql);
  const after = JSON.parse(cli('backend/tests/database-snapshot.php', databases[1], ['snapshot']));
  assert.deepEqual(after, before, 'Every restored table must retain all source rows exactly');
  assert.equal(after.bookings.rows, 1);
  assert.equal(after.users.rows, 1);
  assert.equal(after.user_profile_photos.rows, 1);
  assert.equal(after.site_branding.rows, 1);
  assert.equal(after.event_promotions.rows, 1);
  assert.ok(after.sports.rows > 0 && after.clubs.rows > 0);
  cli('backend/bin/setup.php', databases[1], ['--existing-database']);
  console.log(`PASS backup/restore: ${Object.keys(after).length} tables, exact row fingerprints, foreign-key fixtures and schema setup after restore`);
  writeFileSync('.artifacts/backup-restore-evidence.json', JSON.stringify({ ...releaseContext(), checked_at: new Date().toISOString(), status: 'passed', tables: Object.keys(after).length, synthetic_data_only: true, application_database_touched: false }, null, 2) + '\n');
} catch (error) { failure = error; }
finally {
  for (const database of databases) {
    try { cli('backend/tests/cleanup-database.php', database); }
    catch (error) { failure ||= error; }
  }
}
if (failure) throw failure;
console.log('PASS backup rehearsal databases removed; only the synthetic SQL evidence remains in ignored .artifacts/.');
