import assert from 'node:assert/strict';

// Uses the caller's isolated database, real PHP server, production build and sessions.
export async function testHomeWorkflows({ step, newBrowserContext, origin, admin, adminPage, studentPage, visit, screenshot, errors, cli }) {
  const guestContext = await newBrowserContext({ viewport: { width: 1440, height: 1000 } });
  const guest = await guestContext.newPage(); guest.setDefaultTimeout(12000); guest.on('pageerror', (error) => errors.push(error.message));
  let firstId, secondId;
  try {
    await step('News hero fallback and play section support dragging, keyboard controls and reduced-motion phones', async () => {
      await visit(guest, '/'); await guest.locator('.announcement-hero-empty:not(.is-loading)').waitFor();
      assert.equal(await guest.getByRole('link', { name: 'Sign in', exact: true }).count(), 1);
      assert.equal(await guest.getByRole('link', { name: 'Manage promotions', exact: true }).count(), 0);
      assert.equal(await guest.getByRole('link', { name: 'Explore campus activities', exact: false }).count(), 1);
      assert.equal(await guest.getByRole('button', { name: 'Pause animations', exact: true }).count(), 0);
      const arena = guest.locator('.sports-arena'), ant = guest.getByRole('img', { name: 'Ant rolling the tennis ball' });
      assert.equal(await arena.evaluate((element) => getComputedStyle(element).position), 'relative');
      assert.ok(await arena.evaluate((element) => !!element.closest('#play-zone')), 'Sports should stay in the play section');
      await screenshot(guest, 'home-hero-updated-desktop', { animations: 'disabled' });
      await arena.scrollIntoViewIfNeeded();
      const initial = await ant.getAttribute('style'); await guest.waitForFunction((style) => document.querySelector('.sports-animal').getAttribute('style') !== style, initial);
      assert.ok(!(await ant.getAttribute('style')).includes('rotate('), 'Ant should stay upright');
      const football = guest.getByRole('button', { name: 'Move Football', exact: true });
      await football.focus(); const before = await football.getAttribute('style'); await guest.keyboard.press('ArrowUp'); assert.notEqual(await football.getAttribute('style'), before);
      const bounds = await arena.boundingBox(), ball = await football.boundingBox();
      await guest.mouse.move(ball.x + ball.width / 2, ball.y + ball.height / 2); await guest.mouse.down(); await guest.mouse.move(bounds.x - 100, bounds.y - 100, { steps: 5 }); await guest.mouse.up();
      await guest.waitForFunction(() => {
        const ball = document.querySelector('.sports-object[aria-label="Move Football"]'), b = ball.getBoundingClientRect(), a = ball.parentElement.getBoundingClientRect();
        return b.x >= a.x - 1 && b.y >= a.y - 1 && b.right <= a.right + 1 && b.bottom <= a.bottom + 1;
      });
      await screenshot(guest, 'home-play-section-desktop', { animations: 'disabled' });
      await guest.evaluate(() => scrollTo(0, 0));
      assert.ok(await arena.evaluate((element) => element.getBoundingClientRect().top > innerHeight), 'Play area should scroll off-screen');
      await guest.getByRole('link', { name: 'What’s on', exact: true }).click();
      await guest.waitForFunction(() => document.querySelector('#whats-on').getBoundingClientRect().top < 100);
      await guest.evaluate(() => scrollTo(0, 0));
      await guest.emulateMedia({ reducedMotion: 'reduce' }); await guest.setViewportSize({ width: 390, height: 844 });
      await arena.scrollIntoViewIfNeeded();
      await guest.locator('.sports-play-caption').getByText('Reduced motion is enabled.', { exact: false }).waitFor();
      assert.equal(await guest.getByRole('button', { name: 'Drop them again', exact: false }).isDisabled(), true);
      await guest.waitForFunction(() => [...document.querySelectorAll('.sports-object')].every((element) => { const b = element.getBoundingClientRect(), a = element.parentElement.getBoundingClientRect(); return b.x >= a.x && b.right <= a.right + 1 && b.y >= a.y && b.bottom <= a.bottom + 1; }));
      assert.equal(await arena.evaluate((element) => getComputedStyle(element).touchAction), 'pan-y');
      assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await screenshot(guest, 'home-play-section-mobile-reduced-motion', { animations: 'disabled' });
      await guest.emulateMedia({ reducedMotion: 'no-preference' });
    });
    await step('Admin creates and publishes activities; guests see event details and Students cannot manage promotions', async () => {
      await visit(adminPage, '/admin/promotions'); await adminPage.getByRole('heading', { name: 'Home page promotions', exact: true }).waitFor();
      await adminPage.getByRole('button', { name: 'New promotion', exact: true }).click();
      let dialog = adminPage.getByRole('dialog', { name: 'New promotion', exact: true });
      await dialog.getByLabel('Event title', { exact: true }).fill('Browser Campus Camp');
      await dialog.getByLabel('Activity type', { exact: true }).selectOption('camp');
      await dialog.getByLabel('Venue', { exact: true }).fill('Campus Sports Ground');
      await dialog.getByLabel('Starts at', { exact: true }).fill('2090-01-01T09:00');
      await dialog.getByLabel('Ends at', { exact: true }).fill('2090-01-01T12:00');
      await dialog.getByLabel('Description & participation instructions', { exact: true }).fill('Contact the organising club to join this synthetic camp.');
      await dialog.getByRole('button', { name: 'Save promotion', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
      let saved = (await admin('/event-promotions')).events.find((event) => event.title === 'Browser Campus Camp'); assert.ok(saved); firstId = saved.id; assert.equal(saved.published, false);
      await visit(guest, `/events/${firstId}`); await guest.getByRole('alert').filter({ hasText: 'This event is no longer available.' }).waitFor();
      await adminPage.getByRole('button', { name: 'Edit Browser Campus Camp', exact: true }).click();
      dialog = adminPage.getByRole('dialog', { name: 'Edit promotion', exact: true }); await dialog.getByLabel('Publish for everyone to see', { exact: true }).check();
      await dialog.getByRole('button', { name: 'Save promotion', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
      saved = (await admin('/event-promotions')).events.find((event) => event.id === firstId); assert.equal(saved.published, true);
      const upload = adminPage.getByLabel('Upload banner for Browser Campus Camp', { exact: true });
      await upload.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg></svg>') });
      await adminPage.getByRole('alert').filter({ hasText: 'Check the submitted fields.' }).waitFor();
      await upload.setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
      await adminPage.getByRole('alert').filter({ hasText: 'Image uploads are not configured.' }).waitFor();
      await visit(guest, `/events/${firstId}`); await guest.getByRole('heading', { name: 'Browser Campus Camp', exact: true }).waitFor();
      assert.equal(await guest.getByRole('link', { name: 'Sign in to explore clubs', exact: false }).count(), 1);
      await visit(studentPage, '/'); await studentPage.getByRole('link', { name: 'My workspace', exact: true }).waitFor();
      assert.equal(await studentPage.getByRole('link', { name: 'Manage promotions', exact: true }).count(), 0);
      await visit(studentPage, '/admin/promotions'); await studentPage.waitForURL('**/profile');
      const second = await admin('/event-promotions', 'POST', { title: 'Browser Sports Day', description: 'Synthetic browser-only event.', category: 'sports_day', venue: 'Campus court', starts_at: '2090-01-02T09:00:00Z', ends_at: '2090-01-02T11:00:00Z', published: true, featured: true, display_order: 1 }); secondId = second.id;
    });
    await step('Promotions appear once in the activity grid and guest registration stays protected', async () => {
      await guest.setViewportSize({ width: 1440, height: 1000 }); await visit(guest, '/');
      await guest.locator('.discovery-event-card').filter({ hasText: 'Browser Campus Camp' }).waitFor();
      assert.equal(await guest.locator('.event-carousel').count(), 0);
      for (const id of [firstId, secondId]) assert.equal(await guest.locator(`a[href="/events/${id}"]`).count(), 1);
      assert.equal(await guest.locator('.discovery-event-card.is-featured').count(), 2);
      await screenshot(guest, 'home-promotions-once-desktop', { animations: 'disabled' });
      await guest.setViewportSize({ width: 390, height: 844 });
      await guest.locator(`a[href="/events/${secondId}"]`).scrollIntoViewIfNeeded();
      assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await screenshot(guest, 'home-promotions-once-mobile', { animations: 'disabled' });
      await guest.locator(`a[href="/events/${secondId}"]`).click();
      await guest.getByRole('heading', { name: 'Browser Sports Day', exact: true }).waitFor();
      await guest.getByRole('link', { name: 'Sign in to explore clubs', exact: false }).click(); await guest.waitForURL('**/login');
      await guest.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
      await visit(adminPage, '/admin/promotions'); await adminPage.getByRole('button', { name: 'Remove promotion', exact: true }).first().click();
      assert.ok(!(await admin('/event-promotions')).events.some((event) => event.id === firstId));
    });
    await step('Optional announcement images preview, fail safely, retry without duplicates and become public (provider stub)', async () => {
      await visit(adminPage, '/announcements/new');
      await adminPage.getByLabel('Title', { exact: true }).fill('Browser text-only announcement');
      await adminPage.getByLabel('Message', { exact: true }).fill('This text-only announcement remains behind sign-in.');
      await adminPage.getByRole('button', { name: 'Save announcement', exact: false }).click(); await adminPage.waitForURL(/\/announcements\/[0-9a-f-]+$/);
      const plain = (await admin('/announcements')).announcements.find(item => item.title === 'Browser text-only announcement');
      assert.equal(plain.image_url, null);
      assert.equal((await admin('/public/announcements')).announcements.some(item => item.announcement_id === plain.announcement_id), false);
      await visit(adminPage, '/announcements/new');
      await adminPage.getByLabel('Title', { exact: true }).fill('Browser image announcement');
      await adminPage.getByLabel('Message', { exact: true }).fill('This illustrated announcement appears in the public home page hero.');
      await adminPage.getByLabel('Pin this announcement', { exact: true }).check();
      const image = adminPage.locator('#announcement-image');
      await image.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
      await adminPage.getByRole('alert').filter({ hasText: 'Choose a JPEG, PNG or WebP image' }).waitFor();
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
      await image.setInputFiles({ name: 'announcement.png', mimeType: 'image/png', buffer: png });
      await adminPage.getByAltText('Announcement image preview').waitFor();
      await adminPage.getByRole('button', { name: 'Save announcement', exact: false }).click();
      await adminPage.getByRole('alert').filter({ hasText: 'Announcement saved, but the image could not be updated.' }).waitFor();
      const before = (await admin('/announcements')).announcements;
      const saved = before.find(item => item.title === 'Browser image announcement'); assert.ok(saved);
      const uploadPath = `**/api/announcements/${saved.announcement_id}/image`;
      await adminPage.route(uploadPath, async route => {
        assert.equal(route.request().method(), 'POST');
        assert.match(route.request().headers()['content-type'], /^multipart\/form-data; boundary=/);
        cli('backend/tests/announcement-images.php', ['--seed-image', saved.announcement_id]);
        await route.fulfill({ status: 201, json: { data: await admin(`/announcements/${saved.announcement_id}`), error: null } });
      });
      await adminPage.getByRole('button', { name: 'Save announcement', exact: false }).click();
      await adminPage.waitForURL(`**/announcements/${saved.announcement_id}`); await adminPage.unroute(uploadPath);
      assert.equal((await admin('/announcements')).announcements.length, before.length);
      assert.ok((await admin(`/announcements/${saved.announcement_id}`)).image_url);
      const second = await admin('/announcements', 'POST', { title: 'Browser second image announcement', body: 'Another public image announcement for the carousel.', is_pinned: false });
      cli('backend/tests/announcement-images.php', ['--seed-image', second.announcement_id]);
      await guest.route('https://res.cloudinary.com/fixture/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
    });
    await step('Image announcements use background slides, rotate every eight seconds, loop, and support manual phone swipes', async () => {
      await guest.setViewportSize({ width: 1440, height: 1000 }); await visit(guest, '/'); await guest.bringToFront();
      const carousel = guest.getByRole('region', { name: 'Latest campus announcements', exact: true }); await carousel.waitFor();
      await guest.waitForFunction(() => document.querySelector('.announcement-hero-count strong').textContent === '01');
      const background = await carousel.locator('.announcement-hero-slide').first().evaluate(slide => {
        const a = slide.getBoundingClientRect(), b = slide.querySelector('.announcement-hero-art').getBoundingClientRect();
        return { full: Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1, fit: getComputedStyle(slide.querySelector('img')).objectFit };
      });
      assert.deepEqual(background, { full: true, fit: 'cover' });
      await guest.waitForFunction(() => document.querySelector('.announcement-hero-count strong').textContent === '02', null, { timeout: 10500 });
      await guest.waitForFunction(() => document.querySelector('.announcement-hero-count strong').textContent === '01', null, { timeout: 10500 });
      await carousel.getByRole('button', { name: 'Next announcement', exact: true }).click();
      await guest.waitForFunction(() => document.querySelector('.announcement-hero-count strong').textContent === '02');
      await carousel.getByRole('button', { name: 'Previous announcement', exact: true }).click();
      await guest.waitForFunction(() => { const e = document.querySelector('.announcement-hero-track'); return e.scrollLeft < 2; });
      await screenshot(guest, 'home-announcement-hero-desktop', { animations: 'disabled' });
      await guest.setViewportSize({ width: 390, height: 844 }); await carousel.scrollIntoViewIfNeeded();
      const session = await guest.context().newCDPSession(guest), box = await carousel.boundingBox(), y = Math.min(600, box.y + 120);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y }] });
      for (const x of [280, 220, 140, 70, 30]) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await guest.waitForTimeout(30); }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
      await guest.waitForFunction(() => document.querySelector('.announcement-hero-count strong').textContent === '02');
      await guest.waitForFunction(() => { const e = document.querySelector('.announcement-hero-track'); return Math.abs(e.scrollLeft - e.clientWidth) < 2; });
      assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await screenshot(guest, 'home-announcement-hero-mobile', { animations: 'disabled' });
      const read = carousel.locator('.announcement-hero-slide').nth(1).getByRole('link', { name: 'Read announcement', exact: false });
      const target = await read.getAttribute('href');
      await read.click(); await guest.waitForURL(origin + target);
      await guest.getByRole('heading', { name: 'Browser second image announcement', exact: true }).waitFor();
    });
    await step('Unknown URLs retain a responsive 404 page with working recovery links', async () => {
      await visit(guest, '/404'); await guest.getByRole('heading', { name: 'Page not found.', exact: true }).waitFor();
      assert.ok(guest.url().endsWith('/404')); assert.match(await guest.title(), /^404/);
      assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await screenshot(guest, 'not-found-public-mobile', { animations: 'disabled' });
      await guest.getByRole('link', { name: 'Back to home', exact: false }).click(); await guest.waitForURL(origin + '/');
      for (const path of ['/announcements/invalid/nested/path', '/sports-clubs/invalid/nested/path', '/training-attendance/invalid/nested/path']) {
        await visit(adminPage, path); await adminPage.getByRole('heading', { name: 'Page not found.', exact: true }).waitFor();
        assert.ok(adminPage.url().endsWith(path)); assert.equal(await adminPage.locator('.not-found-screen.is-embedded').count(), 1);
      }
    });
  } catch (error) {
    console.error('Home workflow location:', new URL(guest.url()).pathname, 'Headings:', await guest.locator('h1').allTextContents());
    await screenshot(guest, 'home-workflow-failure', { animations: 'disabled' }).catch(() => {});
    throw error;
  } finally { await guestContext.close(); }
}
