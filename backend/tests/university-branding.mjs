import assert from 'node:assert/strict';

export async function testUniversityBranding({ check, Client, admin, cli, newStudent, sports }) {
  const student = await newStudent('branding-student');
  const coach = await newStudent('branding-coach');
  const club = await admin.request('/clubs', { method: 'POST', body: { name: 'Branding Coach Club', sport_id: sports.Badminton } });
  assert.equal(club.status, 201);
  assert.equal((await admin.request('/club-coaches', { method: 'POST', body: { club_id: club.data.id, user_id: coach.id } })).status, 201);
  function image(content = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')) {
    const body = new FormData(); body.append('logo', new Blob([content], { type: 'image/png' }), 'logo.png'); return body;
  }
  await check('Only Admins can change university branding; public reads expose no private settings', async () => {
    const anonymous = new Client();
    const publicData = await anonymous.request('/branding');
    assert.equal(publicData.status, 200);
    assert.deepEqual(Object.keys(publicData.data).sort(), ['university_logo_url', 'updated_at']);
    assert.equal((await anonymous.request('/branding?secret=1')).status, 422);
    for (const method of ['POST', 'DELETE']) {
      assert.equal((await anonymous.request('/branding/logo', { method, body: method === 'POST' ? image() : {} })).status, 401);
      for (const client of [student, coach]) assert.equal((await client.request('/branding/logo', { method, body: method === 'POST' ? image() : {} })).status, 403);
      assert.equal((await admin.request('/branding/logo', { method, token: false, body: method === 'POST' ? image() : {} })).status, 403);
    }
    assert.equal((await admin.request('/branding/logo')).status, 405);
    assert.equal((await admin.request('/branding', { method: 'POST', body: {} })).status, 405);
  });
  await check('Branding upload validates images and preserves the shared logo on provider/configuration failures', async () => {
    const seeded = JSON.parse(cli('backend/tests/university-branding.php', ['--seed']));
    const personalPhoto = (await admin.request('/users/me')).data.photo_url;
    assert.equal((await admin.request('/branding/logo', { method: 'POST', body: {} })).status, 415);
    assert.equal((await admin.request('/branding/logo', { method: 'POST', body: new FormData() })).status, 422);
    assert.equal((await admin.request('/branding/logo', { method: 'POST', body: image('<svg></svg>') })).status, 422);
    const extra = image(); extra.append('user_id', String(student.id));
    assert.equal((await admin.request('/branding/logo', { method: 'POST', body: extra })).status, 422);
    assert.equal((await admin.request('/branding/logo', { method: 'POST', body: image() })).status, 503);
    for (const client of [new Client(), student, coach, admin]) assert.equal((await client.request('/branding')).data.university_logo_url, seeded.logo_url);
    assert.equal((await admin.request('/users/me')).data.photo_url, personalPhoto);
    assert.equal((await admin.request('/branding/logo', { method: 'DELETE', body: { logo_url: 'https://untrusted.example/logo.png' } })).status, 422);
    assert.equal((await admin.request('/branding/logo', { method: 'DELETE' })).data.university_logo_url, null);
    assert.equal((await new Client().request('/branding')).data.university_logo_url, null);
  });
  await check('University logo service verifies real persistence, Admin revalidation, replacement and rollback using a provider double', async () => {
    const result = JSON.parse(cli('backend/tests/university-branding-service.php'));
    assert.equal(result.status, 'passed'); assert.ok(result.checks.length >= 10);
  });
}
