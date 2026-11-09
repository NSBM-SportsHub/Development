import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { resolve } from 'node:path';
const playwrightPath = process.env.SPORTSHUB_PLAYWRIGHT_PATH || (existsSync('.tools/qa/node_modules/playwright/index.mjs') ? resolve('.tools/qa/node_modules/playwright/index.mjs') : null);
const { chromium } = await import(playwrightPath ? pathToFileURL(playwrightPath).href : 'playwright');
import { preview } from '../frontend/node_modules/vite/dist/node/index.js';
import { releaseContext } from '../scripts/release-context.mjs';

const root = process.cwd();
const php = process.env.SPORTSHUB_PHP || (existsSync('.tools/php/php.exe') ? resolve('.tools/php/php.exe') : 'php');
const suffix = randomBytes(8).toString('hex');
const sessionPath = resolve('.artifacts', `browser-notifications-${suffix}`);
mkdirSync(sessionPath, { recursive: true });
const env = { ...process.env, SPORTSHUB_DB_NAME: `sportshub_test_${suffix}`, SPORTSHUB_APP_KEY: randomBytes(32).toString('hex'), SPORTSHUB_SESSION_PATH: sessionPath, SPORTSHUB_ENV: 'development', SPORTSHUB_SESSION_SECURE: '0' };
const password = `Browser!${randomBytes(16).toString('hex')}`;
const email = `admin-${suffix}@example.test`;
function cli(file, args = [], extra = {}) {
  const result = spawnSync(php, [file, ...args], { cwd: root, env: { ...env, ...extra }, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
async function port() {
  const s = createNetServer();
  await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
  const p = s.address().port;
  await new Promise((ok) => s.close(ok));
  return p;
}
let backend, vite, browser;
const passedSteps = [];
const screenshots = [];
async function screenshot(page, name) {
  const path = `.artifacts/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
}
try {
  cli('backend/bin/setup.php', ['--seed']);
  cli('backend/bin/create-admin.php', [`--name=Browser Admin`, `--email=${email}`], { SPORTSHUB_ADMIN_PASSWORD: password });
  const phpPort = await port();
  backend = spawn(php, ['-S', `127.0.0.1:${phpPort}`, '-t', 'backend/public', 'backend/router.php'], { cwd: root, env, windowsHide: true, stdio: 'ignore' });
  vite = await preview({ root: resolve('frontend'), configFile: resolve('frontend/vite.config.js'), preview: { host: '127.0.0.1', port: await port(), strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${phpPort}`, changeOrigin: true } } } });
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ ...(process.env.SPORTSHUB_BROWSER_CHANNEL ? { channel: process.env.SPORTSHUB_BROWSER_CHANNEL } : {}), headless: true });
  const adminContext = await browser.newContext();
  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  async function client(context) {
    let csrf;
    return async (path, method = 'GET', body) => {
      const res = await context.request.fetch(`${origin}/api${path}`, { method, headers: { ...(method === 'GET' ? {} : { 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }) }, ...(method === 'GET' ? {} : { data: body || {} }) });
      const json = await res.json();
      assert.ok(res.ok(), `${method} ${path}: ${JSON.stringify(json.error)}`);
      csrf = json.data?.csrf_token || csrf;
      return json.data;
    };
  }
  const admin = await client(adminContext), student = await client(studentContext);
  await admin('/auth/session');
  await admin('/auth/login', 'POST', { email, password });
  await student('/auth/session');
  const registered = await student('/auth/register', 'POST', { name: 'Workflow Student', email: `student-${suffix}@example.test`, password });
  const coachContext = await browser.newContext();
  const coach = await client(coachContext);
  await coach('/auth/session');
  const coachUser = await coach('/auth/register', 'POST', { name: 'Workflow Coach', email: `coach-${suffix}@example.test`, password });
  const studentPage = await studentContext.newPage(), adminPage = await adminContext.newPage(), coachPage = await coachContext.newPage();
  const errors = [];
  for (const page of [studentPage, adminPage, coachPage]) {
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
  }
  async function visit(page, path) { await page.goto(origin + path, { waitUntil: 'domcontentloaded' }); }
  async function step(label, action) {
    try { await action(); passedSteps.push(label); console.log('PASS browser ' + label); }
    catch (error) {
      console.error('Browser step failed:', label, 'Runtime errors:', errors);
      for (const [index, page] of [studentPage, adminPage, coachPage].entries()) await page.screenshot({ path: `.artifacts/workflow-failure-${index}.png`, fullPage: true }).catch(() => {});
      throw error;
    }
  }
  async function chooseGlass(page, label, text) {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: text, exact: true }).click();
  }
  let clubId, trainingId, bookingId, tournamentId;
  await step('Admin creates a real club; reload persists it and Student cannot manage it', async () => {
    await visit(adminPage, '/sports-clubs/new');
    await adminPage.getByLabel('Club name', { exact: true }).fill('Workflow Real Club');
    await chooseGlass(adminPage, 'Sport', 'Badminton');
    await adminPage.getByLabel('Description', { exact: true }).fill('This club is created through the connected browser workflow.');
    await adminPage.getByRole('button', { name: 'Create club', exact: true }).click();
    await adminPage.waitForURL(new RegExp('/sports-clubs/[0-9]+$'));
    clubId = Number(new URL(adminPage.url()).pathname.split('/').at(-1));
    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    await adminPage.getByRole('heading', { name: 'Workflow Real Club', exact: true }).waitFor();
    await screenshot(adminPage, 'release-club');
    await visit(studentPage, `/sports-clubs/${clubId}`);
    await studentPage.getByRole('heading', { name: 'Workflow Real Club', exact: true }).waitFor();
    assert.equal(await studentPage.getByRole('button', { name: 'Archive club', exact: true }).count(), 0);
    await visit(studentPage, '/sports-clubs/new');
    await studentPage.getByRole('alert').filter({ hasText: 'Only administrators' }).waitFor();
    assert.equal((await admin('/clubs')).some((club) => Number(club.id) === clubId), true);
  });
  await step('Admin assigns a coach through account search and persisted club assignments', async () => {
    await visit(adminPage, '/admin/coaches');
    await adminPage.getByLabel('Find an account by name or email', { exact: true }).fill(`coach-${suffix}@example.test`);
    await adminPage.getByRole('button', { name: 'Search accounts', exact: true }).click();
    await adminPage.getByLabel('Club', { exact: true }).selectOption(String(clubId));
    await adminPage.getByLabel('Account', { exact: true }).selectOption(String(coachUser.user.id));
    await adminPage.getByRole('button', { name: 'Assign coach', exact: true }).click();
    await adminPage.getByText('Coach assigned.', { exact: true }).waitFor();
    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    await adminPage.getByRole('heading', { name: 'Workflow Coach', exact: true }).waitFor();
    await screenshot(adminPage, 'release-coach-assignments');
    await visit(coachPage, '/profile');
    await coachPage.locator('.side-nav').getByRole('link', { name: 'Club membership review', exact: true }).waitFor();
  });
  await step('Student applies to the new database club; assigned coach reviews it', async () => {
    await visit(studentPage, '/memberships/apply');
    await studentPage.getByLabel('Club', { exact: true }).selectOption(String(clubId));
    await studentPage.getByRole('button', { name: 'Submit application', exact: true }).click();
    await studentPage.getByText(/Your application to Workflow Real Club has been submitted/).waitFor();
    await visit(coachPage, '/memberships/review');
    await coachPage.getByRole('heading', { name: 'Workflow Student', exact: true }).waitFor();
    await coachPage.getByRole('button', { name: 'Approve', exact: true }).click();
    await coachPage.getByRole('dialog').getByRole('button', { name: 'Approve application', exact: true }).click();
    await coachPage.getByText(/Workflow Student's application to Workflow Real Club was approved/).waitFor();
    await visit(studentPage, '/memberships/mine');
    await studentPage.getByText('Approved', { exact: true }).waitFor();
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await studentPage.getByText('Approved', { exact: true }).waitFor();
    await screenshot(studentPage, 'release-membership');
  });
  await step('Assigned coach creates training and records canonical attendance; Student sees history', async () => {
    await visit(coachPage, '/training-attendance/new');
    await coachPage.getByLabel('Session name', { exact: true }).fill('Workflow Database Training');
    await coachPage.getByLabel('Club', { exact: true }).selectOption(String(clubId));
    await coachPage.getByLabel('Date', { exact: true }).fill('2032-05-10');
    await coachPage.getByLabel('Start time', { exact: true }).fill('15:00');
    await coachPage.getByLabel('End time', { exact: true }).fill('16:00');
    await coachPage.getByRole('button', { name: 'Create session', exact: true }).click();
    await coachPage.waitForURL(new RegExp('/training-attendance/[0-9]+$'));
    trainingId = Number(new URL(coachPage.url()).pathname.split('/').at(-1));
    await coachPage.reload({ waitUntil: 'domcontentloaded' });
    await coachPage.getByRole('link', { name: 'View attendance', exact: true }).click();
    await coachPage.getByRole('link', { name: 'Record attendance', exact: true }).click();
    await coachPage.getByLabel('Participant', { exact: true }).selectOption(String(registered.user.id));
    await coachPage.getByLabel('Attendance status', { exact: true }).selectOption('Late');
    await coachPage.getByLabel('Notes (optional)', { exact: true }).fill('Verified through a browser and PHP.');
    await coachPage.getByRole('button', { name: 'Save attendance', exact: true }).click();
    await coachPage.getByRole('cell', { name: 'Workflow Student', exact: true }).waitFor();
    await coachPage.reload({ waitUntil: 'domcontentloaded' });
    await coachPage.getByRole('cell', { name: 'Late', exact: true }).waitFor();
    await screenshot(coachPage, 'release-attendance');
    await visit(studentPage, `/training-attendance/${trainingId}/attendance`);
    await studentPage.getByRole('cell', { name: 'Workflow Student', exact: true }).waitFor();
    assert.equal(await studentPage.getByRole('link', { name: 'Record attendance', exact: true }).count(), 0);
    await visit(studentPage, '/participation');
    await studentPage.getByRole('heading', { name: 'Workflow Database Training', exact: true }).waitFor();
    assert.equal(await studentPage.locator('.report-summary div').filter({ hasText: 'Training attended' }).locator('dd').textContent(), '1');
    await visit(adminPage, '/admin/reports');
    await adminPage.getByRole('heading', { name: 'Workflow Database Training', exact: true }).waitFor();
    await screenshot(adminPage, 'complete-reports');
  });
  const facility = await admin('/facilities', 'POST', { name: 'Workflow Court', location: 'Sports centre', capacity: 10 });
  await step('Student submits and edits a pending booking; Admin approves; notification persists', async () => {
    await visit(studentPage, '/bookings/new');
    await studentPage.getByLabel('Resource', { exact: true }).selectOption(String(facility.id));
    await studentPage.getByLabel('Starts', { exact: true }).fill('2032-05-11T15:00');
    await studentPage.getByLabel('Ends', { exact: true }).fill('2032-05-11T16:00');
    await studentPage.getByRole('button', { name: 'Submit booking request', exact: true }).click();
    await studentPage.waitForURL('**/bookings/mine');
    await studentPage.getByRole('link', { name: 'Edit booking', exact: true }).click();
    bookingId = Number(new URL(studentPage.url()).pathname.split('/')[2]);
    await studentPage.getByLabel('Notes (optional)', { exact: true }).fill('Updated in the booking editor');
    await studentPage.getByRole('button', { name: 'Save booking changes', exact: true }).click();
    await studentPage.getByText('Updated in the booking editor', { exact: true }).waitFor();
    await visit(adminPage, '/admin/bookings');
    await adminPage.getByRole('heading', { name: 'Workflow Court', exact: true }).waitFor();
    await adminPage.getByRole('button', { name: 'Approve', exact: true }).click();
    await adminPage.getByText(`Booking #${bookingId} approved. The requester has been notified.`, { exact: true }).waitFor();
    await adminPage.getByRole('button', { name: 'Approved', exact: true }).click();
    await adminPage.getByRole('heading', { name: 'Workflow Court', exact: true }).waitFor();
    await screenshot(adminPage, 'release-booking-approval');
    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    await adminPage.getByRole('button', { name: 'Approved', exact: true }).click();
    await adminPage.getByRole('heading', { name: 'Workflow Court', exact: true }).waitFor();
    await visit(studentPage, '/notifications');
    await studentPage.getByRole('heading', { name: 'Booking approved', exact: true }).waitFor();
    const card = studentPage.locator('article').filter({ has: studentPage.getByRole('heading', { name: 'Booking approved', exact: true }) });
    await card.getByRole('button', { name: 'Mark as read', exact: true }).click();
    await studentPage.getByRole('button', { name: 'Read', exact: true }).click();
    await studentPage.getByRole('heading', { name: 'Booking approved', exact: true }).waitFor();
    await screenshot(studentPage, 'release-notifications');
    await visit(studentPage, `/bookings/${bookingId}/edit`);
    await studentPage.getByRole('alert').filter({ hasText: 'Only pending bookings can be edited' }).waitFor();
  });
  await step('Tournament registration, coach entry review, fixtures, result entry and standings use real data', async () => {
    const sports = await admin('/sports');
    await visit(adminPage, '/tournaments');
    await adminPage.getByRole('button', { name: 'Create tournament', exact: true }).click();
    const dialog = adminPage.getByRole('dialog');
    await dialog.getByLabel('Sport', { exact: true }).selectOption(String(sports.find((sport) => sport.name === 'Badminton').id));
    await dialog.getByLabel('Tournament name', { exact: true }).fill('Workflow League');
    await dialog.getByLabel('Start date', { exact: true }).fill('2032-05-10');
    await dialog.getByLabel('End date', { exact: true }).fill('2032-05-20');
    await dialog.getByRole('button', { name: 'Create tournament', exact: true }).click();
    await adminPage.getByRole('heading', { name: 'Workflow League', exact: true }).waitFor();
    tournamentId = (await admin('/tournaments')).find((item) => item.name === 'Workflow League').id;
    await adminPage.getByLabel('Change status for Workflow League', { exact: true }).selectOption('registration_open');
    await adminPage.getByText('Tournament status changed to registration open.', { exact: true }).waitFor();
    await visit(studentPage, `/tournaments/${tournamentId}`);
    await studentPage.getByLabel('Team or entrant name', { exact: true }).fill('Workflow Entrant');
    await studentPage.getByRole('button', { name: 'Submit entry', exact: true }).click();
    await studentPage.getByRole('cell', { name: 'Workflow Entrant', exact: true }).waitFor();
    const rivalContext = await browser.newContext();
    const rival = await client(rivalContext); await rival('/auth/session');
    const rivalUser = await rival('/auth/register', 'POST', { name: 'Workflow Rival', email: `rival-${suffix}@example.test`, password });
    const membership = await rival('/memberships', 'POST', { club_id: clubId });
    await admin(`/memberships/${membership.id}`, 'PATCH', { status: 'approved' });
    await rival(`/tournaments/${tournamentId}/entries`, 'POST', { name: 'Workflow Rival Entry', member_ids: [rivalUser.user.id] });
    await visit(coachPage, `/tournaments/${tournamentId}`);
    for (let index = 0; index < 2; index++) {
      await coachPage.getByRole('button', { name: 'Approve', exact: true }).first().click();
      await coachPage.waitForFunction((remaining) => document.querySelectorAll('.entry-review-actions button').length === remaining, (1 - index) * 2);
    }
    await visit(adminPage, '/tournaments');
    await adminPage.getByLabel('Change status for Workflow League', { exact: true }).selectOption('registration_closed');
    await adminPage.getByText('Tournament status changed to registration closed.', { exact: true }).waitFor();
    await visit(adminPage, `/tournaments/${tournamentId}/matches`);
    await adminPage.getByRole('button', { name: 'Generate fixtures', exact: true }).click();
    await adminPage.getByRole('button', { name: 'Edit schedule', exact: true }).waitFor();
    await visit(adminPage, '/tournaments');
    await adminPage.getByLabel('Change status for Workflow League', { exact: true }).selectOption('in_progress');
    await adminPage.getByText('Tournament status changed to in progress.', { exact: true }).waitFor();
    await visit(adminPage, `/tournaments/${tournamentId}/matches`);
    await adminPage.getByRole('button', { name: 'Enter result', exact: true }).click();
    const result = adminPage.getByRole('dialog');
    await result.getByLabel(/Workflow Entrant score/).fill('2');
    await result.getByLabel(/Workflow Rival Entry score/).fill('1');
    await result.getByRole('button', { name: 'Save result', exact: true }).click();
    await adminPage.getByRole('button', { name: 'Correct result', exact: true }).waitFor();
    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    await adminPage.getByRole('button', { name: 'Correct result', exact: true }).waitFor();
    await screenshot(adminPage, 'complete-competition');
    await visit(studentPage, '/participation');
    assert.equal(await studentPage.locator('.report-summary div').filter({ hasText: 'Match roster appearances' }).locator('dd').textContent(), '1');
    await rivalContext.close();
  });
  await step('Announcement publishing reaches the Student interface and inbox', async () => {
    await visit(adminPage, '/announcements/new');
    await adminPage.getByLabel('Title', { exact: true }).fill('Workflow Campus Update');
    await adminPage.getByLabel('Message', { exact: true }).fill('This announcement is published through the real browser workflow.');
    await adminPage.getByRole('button', { name: 'Save announcement', exact: true }).click();
    await adminPage.waitForURL(new RegExp('/announcements/[a-f0-9-]+$'));
    await visit(studentPage, '/announcements');
    await studentPage.getByRole('link', { name: /Workflow Campus Update/ }).click();
    await studentPage.getByRole('heading', { name: 'Workflow Campus Update', exact: true }).waitFor();
    await screenshot(studentPage, 'release-announcement');
    await visit(studentPage, '/notifications');
    await studentPage.getByText('Workflow Campus Update', { exact: true }).waitFor();
  });
  await step('Admin and Student permissions, mobile layouts and service failure/retry', async () => {
    await visit(studentPage, '/admin/coaches'); await studentPage.waitForURL('**/profile');
    await visit(studentPage, '/admin/bookings'); await studentPage.waitForURL('**/profile');
    for (const [page, path] of [[studentPage, '/sports-clubs'], [studentPage, '/training-attendance'], [studentPage, '/announcements'], [studentPage, '/participation'], [studentPage, '/notifications'], [coachPage, `/training-attendance/${trainingId}/attendance`], [adminPage, '/admin/coaches'], [adminPage, '/admin/bookings'], [adminPage, '/admin/reports'], [adminPage, `/tournaments/${tournamentId}/matches`]]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await visit(page, path);
      await page.waitForFunction(() => document.querySelector('h1') && !Array.from(document.querySelectorAll('[role="status"]')).some((element) => /Loading|Checking/.test(element.textContent)));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow on ' + path);
      if (path === '/training-attendance') await screenshot(page, 'complete-training-mobile');
    }
    await adminPage.route('**/api/bookings', (route) => route.fulfill({ status: 503, json: { data: null, error: { code: 'service_unavailable', message: 'Verification service temporarily unavailable.', fields: {} } } }));
    await visit(adminPage, '/admin/bookings');
    await adminPage.getByRole('alert').filter({ hasText: 'Verification service temporarily unavailable.' }).waitFor();
    await adminPage.unroute('**/api/bookings');
    await adminPage.getByRole('button', { name: 'Refresh bookings', exact: true }).click();
    await adminPage.getByRole('heading', { name: 'No matching booking requests', exact: true }).waitFor();
  });
  await step('Revoking a coach removes UI and server permissions without changing account role', async () => {
    await adminPage.setViewportSize({ width: 1440, height: 1000 });
    await visit(adminPage, '/admin/coaches');
    await adminPage.getByRole('button', { name: 'End assignment', exact: true }).click();
    await adminPage.getByText('Coach assignment ended.', { exact: true }).waitFor();
    await visit(coachPage, '/memberships/review');
    await coachPage.getByRole('alert').filter({ hasText: 'Only administrators and assigned club coaches' }).waitFor();
    const validSession = await coach('/auth/session');
    const denied = await coachContext.request.post(origin + '/api/attendance', { headers: { 'X-CSRF-Token': validSession.csrf_token }, data: { session_id: trainingId, participant_id: registered.user.id, status: 'present' } });
    assert.equal(denied.status(), 403);
    assert.equal((await denied.json()).error.code, 'forbidden');
    assert.equal((await coach('/auth/session')).user.role, 'student');
  });
  await step('Training editing/cancellation and club archival preserve attendance history', async () => {
    await visit(adminPage, `/training-attendance/${trainingId}/edit`);
    await adminPage.getByLabel('Session name', { exact: true }).fill('Workflow Training Updated');
    await adminPage.getByRole('button', { name: 'Save changes', exact: true }).click();
    await adminPage.getByRole('heading', { name: 'Workflow Training Updated', exact: true }).waitFor();
    await adminPage.getByRole('button', { name: 'Cancel session', exact: true }).click();
    await adminPage.getByText('Cancelled', { exact: true }).waitFor();
    await visit(adminPage, `/sports-clubs/${clubId}/edit`);
    await adminPage.getByLabel('Club name', { exact: true }).fill('Workflow Club Updated');
    await adminPage.getByRole('button', { name: 'Save changes', exact: true }).click();
    await adminPage.getByRole('heading', { name: 'Workflow Club Updated', exact: true }).waitFor();
    await adminPage.getByRole('button', { name: 'Archive club', exact: true }).click();
    await adminPage.waitForURL('**/sports-clubs');
    assert.equal((await admin('/clubs')).some((club) => Number(club.id) === clubId), false);
    await visit(studentPage, '/participation');
    await studentPage.getByRole('heading', { name: 'Workflow Training Updated', exact: true }).waitFor();
    assert.equal(await studentPage.locator('.report-summary div').filter({ hasText: 'Training attended' }).locator('dd').textContent(), '0');
  });
  await step('Sign-in, profile editing, reload persistence and logout work in a fresh browser session', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await visit(page, '/login');
    await page.getByLabel('Email address', { exact: true }).fill(`student-${suffix}@example.test`);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'My profile', exact: true }).waitFor();
    await page.getByLabel('Phone number', { exact: true }).fill('+94771234567');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByText('Your profile has been updated.', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByLabel('Phone number', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Phone number', { exact: true }).inputValue(), '+94771234567');
    await page.locator('.page-heading').getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL('**/login');
    await visit(page, '/participation'); await page.waitForURL('**/login');
    await context.close();
  });
  assert.deepEqual(errors, []);
  writeFileSync('.artifacts/browser-evidence.json', JSON.stringify({ ...releaseContext(), checked_at: new Date().toISOString(), status: 'passed', target: 'local production build with real PHP/MySQL', browser_channel: process.env.SPORTSHUB_BROWSER_CHANNEL || 'chromium', workflow_groups: passedSteps, screenshots, runtime_errors: 0, synthetic_data_only: true }, null, 2) + '\n');
  console.log('PASS real browser workflows against the production frontend build, PHP and MySQL; isolated database cleaned on exit.');
} finally {
  if (browser) await browser.close();
  if (vite) await new Promise((resolve) => vite.httpServer.close(resolve));
  if (backend) { backend.kill(); await new Promise((ok) => backend.once('exit', ok)); }
  cli('backend/tests/cleanup-database.php');
}
