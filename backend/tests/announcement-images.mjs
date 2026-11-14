import assert from 'node:assert/strict';

export async function testAnnouncementImages({ check, Client, admin, newStudent, cli }) {
  const anonymous = new Client(), student = await newStudent('announcement-image-student');
  const record = await admin.request('/announcements', { method: 'POST', body: { title: 'Text-only announcement', body: 'This announcement has no public image.' } });
  assert.equal(record.status, 201);
  const path = `/announcements/${record.data.announcement_id}/image`;
  await check('Announcement images require Admin access and CSRF; text-only announcements stay private', async () => {
    assert.equal(record.data.image_url, null);
    assert.equal((await anonymous.request(`/public/announcements/${record.data.announcement_id}`)).status, 404);
    assert.equal((await anonymous.request('/public/announcements')).status, 200);
    assert.equal((await anonymous.request('/public/announcements?include_deleted=1')).status, 422);
    for (const method of ['POST', 'DELETE']) {
      assert.equal((await anonymous.request(path, { method, body: {} })).status, 401);
      assert.equal((await student.request(path, { method, body: {} })).status, 403);
      assert.equal((await admin.request(path, { method, body: {}, token: false })).status, 403);
    }
    assert.equal((await anonymous.request('/public/announcements', { method: 'POST', body: {} })).status, 405);
    assert.equal((await admin.request(path)).status, 405);
    assert.equal((await anonymous.request(`/public/announcements/${record.data.announcement_id}/image`)).status, 404);
  });
  await check('Announcement image validation and provider failures preserve existing text', async () => {
    const bad = new FormData(); bad.append('image', new Blob(['<svg></svg>'], { type: 'image/svg+xml' }), 'bad.svg');
    assert.equal((await admin.request(path, { method: 'POST', body: bad })).status, 422);
    const valid = new FormData(); valid.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'image.png');
    assert.equal((await admin.request(path, { method: 'POST', body: valid })).status, 503);
    assert.equal((await admin.request(`/announcements/${record.data.announcement_id}`)).data.title, record.data.title);
    const result = JSON.parse(cli('backend/tests/announcement-images.php'));
    assert.equal(result.status, 'passed'); assert.equal(result.checks.length, 12);
    const image = await anonymous.request(`/public/announcements/${result.image_id}`);
    assert.equal(image.status, 200); assert.match(image.data.image_url, /^https:\/\/res\.cloudinary\.com\/fixture\//);
    for (const field of ['cloud_name', 'public_id', 'version']) assert.equal(Object.hasOwn(image.data, field), false);
    assert.equal((await admin.request(`/announcements/${result.image_id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await anonymous.request(`/public/announcements/${result.image_id}`)).status, 404);
  });
}
