// Run after `npm --prefix frontend run build`: node tests/mobile-christmas.mjs
// Uses synthetic API responses; no database or existing accounts are changed.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from '../frontend/node_modules/vite/dist/node/index.js';

const playwrightPath = process.env.SPORTSHUB_PLAYWRIGHT_PATH || (existsSync('.tools/qa/node_modules/playwright/index.mjs') ? resolve('.tools/qa/node_modules/playwright/index.mjs') : null);
const { chromium } = await import(playwrightPath ? pathToFileURL(playwrightPath).href : 'playwright');
const server = await preview({ root: resolve('frontend'), configFile: false, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.SPORTSHUB_BROWSER_CHANNEL ? { channel: process.env.SPORTSHUB_BROWSER_CHANNEL } : {}) });
const errors = [];
const student = { id: 1, name: 'SportsHub Student', role: 'student', email: 'student@example.test', created_at: '2026-01-01T00:00:00Z' };
const administrator = { ...student, id: 2, role: 'admin', name: 'SportsHub Admin' };
const screenshots = resolve('.artifacts/mobile-christmas');
mkdirSync(screenshots, { recursive: true });

async function openPage({ user = null, width = 390, height = 844, reducedMotion = 'no-preference', coach = false, customLogo = false, hasTouch = false, path = '/' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, hasTouch });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await context.route('https://res.cloudinary.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#1d6048"/><text x="8" y="47" fill="white" font-size="24">NSBM</text></svg>' }));
  await context.route('**/api/**', route => {
    const url = new URL(route.request().url());
    let data = [];
    if (url.pathname === '/api/auth/session') data = { user, csrf_token: 'synthetic-test-token' };
    else if (url.pathname === '/api/branding') data = { university_logo_url: customLogo ? 'https://res.cloudinary.com/test/image/upload/v1/test/logo.webp' : null };
    else if (url.pathname === '/api/public/events') data = { events: [] };
    else if (url.pathname === '/api/public/announcements') data = { announcements: [] };
    else if (url.pathname === '/api/club-coaches') data = coach ? [{ club_id: 1, user_id: 1 }] : [];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + path);
  await page.locator('.site-loading-screen').waitFor({ state: 'detached' });
  return { page, context };
}

async function noOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page must fit the viewport');
}

try {
  const { page, context } = await openPage();
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  assert.equal(await nav.isVisible(), true);
  assert.equal(await nav.getByRole('link').count(), 4);
  assert.equal(await nav.getByRole('link', { name: 'Home', exact: true }).getAttribute('aria-current'), 'page');
  const navBox = await nav.boundingBox();
  assert.ok(navBox.y > 700 && navBox.y + navBox.height < 844, 'Tabs sit near the bottom with an inset');
  await noOverflow(page);
  await page.locator('.christmas-snowfall').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.christmas-snowfall').evaluate(element => getComputedStyle(element).pointerEvents), 'none');
  await page.locator('.parrot-head .parrot-christmas-hat').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.parrot-head .parrot-christmas-hat').count(), 1);
  assert.ok(await page.locator('.brand-mark > .christmas-hat').count() >= 1);
  assert.notEqual(await page.locator('.announcement-hero').evaluate(element => getComputedStyle(element, '::before').backgroundImage), 'none');
  await page.screenshot({ path: resolve(screenshots, 'phone-home.png'), animations: 'disabled' });

  await nav.getByRole('link', { name: 'Events', exact: true }).click();
  await page.waitForFunction(() => location.hash === '#whats-on' && Math.abs(document.getElementById('whats-on').getBoundingClientRect().top) < 100);
  await nav.getByRole('link', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => location.hash === '#play-zone' && Math.abs(document.getElementById('play-zone').getBoundingClientRect().top) < 100);
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await page.waitForFunction(() => !location.hash && window.scrollY === 0);
  await nav.getByRole('button', { name: 'More navigation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Explore SportsHub' });
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await nav.getByRole('button', { name: 'More navigation' }).evaluate(element => element === document.activeElement), true);
  await nav.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Good to see you again.' }).waitFor();
  await page.getByLabel('Email address', { exact: true }).fill('student@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-test-password');
  await noOverflow(page);
  assert.equal(await page.locator('.christmas-snow-toggle').count(), 0);
  // A setting saved by the removed toggle must not leave snowfall disabled.
  await page.evaluate(() => localStorage.setItem('sportshub.snowfall.v1', 'off'));
  await page.reload();
  await page.locator('.christmas-snowfall').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.christmas-snow-toggle').count(), 0);
  assert.equal(await page.locator('.christmas-snowfall').count(), 1);
  await context.close();
  console.log('PASS phone tabs, anchor navigation, menu focus, sign-in inputs, snowfall without a toggle');

  for (const user of [student, administrator]) {
    const { page, context } = await openPage({ user, coach: user.role === 'student', path: '/profile' });
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
    assert.equal(await page.locator('.sidebar').isVisible(), false);
    assert.equal(await page.locator('.workspace').evaluate(element => element.getBoundingClientRect().left), 0);
    await noOverflow(page);
    await nav.getByRole('button', { name: 'More navigation' }).click();
    const dialog = page.getByRole('dialog', { name: 'Explore SportsHub' });
    for (const label of ['Training & attendance', 'Announcements', 'My memberships', 'Facilities', 'Equipment', 'My participation', 'Notifications']) assert.equal(await dialog.getByRole('link', { name: label, exact: true }).count(), 1, label);
    assert.equal(await dialog.getByRole('link', { name: 'User management' }).count(), user.role === 'admin' ? 1 : 0);
    assert.equal(await dialog.getByRole('link', { name: 'Club membership review' }).count(), user.role === 'student' ? 1 : 0);
    await page.screenshot({ path: resolve(screenshots, `${user.role}-menu.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await nav.getByRole('link', { name: 'Bookings', exact: true }).click();
    await page.waitForURL(user.role === 'admin' ? '**/admin/bookings' : '**/bookings/mine');
    assert.equal(await nav.getByRole('link', { name: 'Bookings', exact: true }).getAttribute('aria-current'), 'page');
    await nav.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByRole('heading', { name: 'My profile', exact: true }).waitFor();
    await page.screenshot({ path: resolve(screenshots, `${user.role}-profile.png`), animations: 'disabled' });
    await context.close();
  }
  console.log('PASS student and administrator tabs, complete role menus, coach access, full-width workspace');

  for (const width of [320, 375, 430, 767]) {
    const { page, context } = await openPage({ width });
    await noOverflow(page);
    assert.equal(await page.getByRole('navigation', { name: 'Mobile navigation' }).isVisible(), true);
    await context.close();
  }
  for (const [width, height] of [[844, 390], [820, 1180], [1024, 768]]) {
    const { page, context } = await openPage({ width, height, hasTouch: true, user: student, path: '/profile' });
    assert.equal(await page.getByRole('navigation', { name: 'Mobile navigation' }).isVisible(), true);
    assert.equal(await page.locator('.sidebar').isVisible(), false);
    await noOverflow(page);
    await context.close();
  }
  const desktop = await openPage({ width: 1440, height: 1000, user: student, path: '/profile', customLogo: true });
  assert.equal(await desktop.page.getByRole('navigation', { name: 'Mobile navigation' }).count(), 0);
  assert.equal(await desktop.page.locator('.sidebar').isVisible(), true);
  assert.ok(await desktop.page.locator('.brand-mark-custom > .christmas-hat').count() >= 1);
  await noOverflow(desktop.page);
  await desktop.page.screenshot({ path: resolve(screenshots, 'desktop-profile.png'), animations: 'disabled' });
  await desktop.page.setViewportSize({ width: 390, height: 844 });
  await desktop.page.getByRole('navigation', { name: 'Mobile navigation' }).waitFor();
  await desktop.page.getByRole('button', { name: 'More navigation' }).click();
  await desktop.page.setViewportSize({ width: 1440, height: 1000 });
  await desktop.page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.notEqual(await desktop.page.evaluate(() => document.body.style.overflow), 'hidden');
  await desktop.context.close();
  console.log('PASS 320–767px phones, touch tablets and landscape, desktop sidebar, custom-logo hat, resize cleanup');

  const reduced = await openPage({ reducedMotion: 'reduce' });
  assert.equal(await reduced.page.locator('.christmas-snowfall').count(), 0);
  assert.equal(await reduced.page.locator('.christmas-snow-toggle').count(), 0);
  assert.ok(await reduced.page.locator('.brand-mark > .christmas-hat').count() >= 1);
  await reduced.page.getByRole('button', { name: 'More navigation' }).click();
  assert.equal(await reduced.page.getByRole('dialog').isVisible(), true);
  await reduced.context.close();
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('PASS reduced-motion navigation, static decorations, zero browser runtime errors');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.httpServer.close(resolveClose));
}
