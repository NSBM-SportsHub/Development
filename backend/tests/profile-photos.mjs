import assert from 'node:assert/strict';

export async function testProfilePhotos({ check, Client, admin, newStudent, cli }) {
  const student = await newStudent('photo-owner');
  const other = await newStudent('photo-other');
  function photo(content = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), mime = 'image/png') {
    const body = new FormData(); body.append('photo', new Blob([content], { type: mime }), 'photo.png'); return body;
  }
  await check('Profile photos require sessions/CSRF, validate uploads and fail safely without Cloudinary credentials', async () => {
    for (const method of ['POST', 'DELETE']) {
      assert.equal((await new Client().request('/users/me/photo', { method, body: method === 'POST' ? photo() : {} })).status, 401);
      assert.equal((await student.request('/users/me/photo', { method, token: false, body: method === 'POST' ? photo() : {} })).status, 403);
    }
    assert.equal((await student.request('/users/me/photo')).status, 405);
    assert.equal((await student.request('/users/me/photo', { method: 'POST', body: {} })).status, 415);
    assert.equal((await student.request('/users/me/photo', { method: 'POST', body: new FormData() })).status, 422);
    assert.equal((await student.request('/users/me/photo', { method: 'POST', body: photo('<svg></svg>', 'image/png') })).status, 422);
    const extra = photo(); extra.append('user_id', String(other.id));
    assert.equal((await student.request('/users/me/photo', { method: 'POST', body: extra })).status, 422);
    assert.equal((await student.request('/users/me/photo', { method: 'POST', body: photo() })).status, 503);
    assert.equal((await admin.request('/users/me/photo', { method: 'POST', body: photo() })).status, 503);
    assert.equal((await student.request('/users/me')).data.photo_url, null);
  });
  await check('Profile photo removal persists over HTTP and cannot remove another account photo', async () => {
    const fixture = JSON.parse(cli('backend/tests/profile-photos.php', [`--seed-user=${student.id}`]));
    assert.equal((await student.request('/users/me')).data.photo_url, fixture.photo_url);
    assert.equal((await student.session()).data.user.photo_url, fixture.photo_url);
    assert.equal((await other.request('/users/me/photo', { method: 'DELETE' })).status, 200);
    assert.equal((await student.request('/users/me')).data.photo_url, fixture.photo_url);
    assert.equal((await other.request(`/users/${student.id}/photo`, { method: 'DELETE' })).status, 404);
    assert.equal((await student.request('/users/me/photo', { method: 'DELETE', body: { user_id: other.id } })).status, 422);
    assert.equal((await student.request('/users/me/photo', { method: 'DELETE' })).data.photo_url, null);
    assert.equal((await student.request('/users/me')).data.photo_url, null);
    assert.equal((await student.session()).data.user.photo_url, null);
    assert.equal((await student.request('/users/me/photo', { method: 'DELETE' })).status, 200);
  });
  await check('Cloudinary transport double verifies signed responses, replacement and rollback with real MySQL', async () => {
    const evidence = JSON.parse(cli('backend/tests/profile-photos.php'));
    assert.equal(evidence.status, 'passed'); assert.ok(evidence.verified.length >= 10);
  });
}
