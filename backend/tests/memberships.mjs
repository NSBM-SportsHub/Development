import assert from 'node:assert/strict';

// Membership applications, reviews and coach assignments through real sessions and the shared router.
// Returns the seeded fixtures and a student factory for the competition suite.
export async function testMemberships({ check, Client, admin, cli, suffix, password }) {
  async function newStudent(label) {
    const client = new Client();
    await client.session();
    const result = await client.request('/auth/register', {
      method: 'POST', body: { name: `${label} ${suffix}`, email: `${label}-${suffix}@example.test`, password },
    });
    assert.equal(result.status, 201);
    client.id = result.data.user.id;
    client.email = `${label}-${suffix}@example.test`;
    return client;
  }
  let fixtures;
  let clubs;
  const alice = await newStudent('alice');
  const bob = await newStudent('bob');
  const carol = await newStudent('carol');
  const dave = await newStudent('dave');
  let aliceMembership;
  let carolMembership;
  let daveMembership;
  let coachId;

  await check('Setup with --seed is repeatable and loads reference sports and demo clubs', async () => {
    cli('backend/bin/setup.php', ['--seed']);
    cli('backend/bin/setup.php', ['--seed']);
    fixtures = JSON.parse(cli('backend/tests/competition-fixtures.php'));
    clubs = fixtures.clubs;
    assert.equal(Object.keys(fixtures.sports).length, 13);
    assert.equal(clubs['Badminton Club'].sport_id, fixtures.sports.Badminton);
    assert.ok(clubs['Archived Chess Society'] && clubs['Table Tennis Club']);
  });

  await check('Membership APIs require a session and CSRF for writes', async () => {
    assert.equal((await new Client().request('/memberships')).status, 401);
    assert.equal((await alice.request('/memberships', { method: 'POST', token: false, body: { club_id: clubs['Badminton Club'].id } })).status, 403);
    assert.equal((await alice.request('/memberships', { method: 'PUT' })).status, 405);
  });

  await check('Applications reject invalid fields, missing or archived clubs, and closed clubs', async () => {
    assert.equal((await alice.request('/memberships', { method: 'POST', body: {} })).status, 422);
    assert.equal((await alice.request('/memberships', { method: 'POST', body: { club_id: '1' } })).status, 422);
    assert.equal((await alice.request('/memberships', { method: 'POST', body: { club_id: 1, role: 'admin' } })).status, 422);
    const missing = await alice.request('/memberships', { method: 'POST', body: { club_id: 999999 } });
    assert.equal(missing.status, 422);
    assert.ok(missing.error.fields.club_id);
    assert.equal((await alice.request('/memberships', { method: 'POST', body: { club_id: clubs['Archived Chess Society'].id } })).status, 422);
    const full = await alice.request('/memberships', { method: 'POST', body: { club_id: clubs['Table Tennis Club'].id } });
    assert.equal(full.status, 409);
    assert.equal(full.error.code, 'club_not_accepting');
  });

  await check('Students apply once per club; duplicates, including simultaneous ones, are rejected', async () => {
    const applied = await alice.request('/memberships', { method: 'POST', body: { club_id: clubs['Badminton Club'].id, message: 'I play doubles.' } });
    assert.equal(applied.status, 201);
    assert.equal(applied.data.status, 'pending');
    assert.equal(applied.data.user_id, alice.id);
    assert.equal(applied.data.club_name, 'Badminton Club');
    aliceMembership = applied.data.id;
    const duplicate = await alice.request('/memberships', { method: 'POST', body: { club_id: clubs['Badminton Club'].id } });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.error.code, 'duplicate_application');
    // A second session for the same user, so PHP session locking does not serialize the requests.
    const bobAgain = new Client();
    await bobAgain.session();
    assert.equal((await bobAgain.request('/auth/login', { method: 'POST', body: { email: bob.email, password } })).status, 200);
    const results = await Promise.all([bob, bobAgain].map((client) => client.request('/memberships', {
      method: 'POST', body: { club_id: clubs['Badminton Club'].id },
    })));
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  });

  await check('Membership reads are scoped to the applicant, club coaches and Admins', async () => {
    assert.equal((await carol.request(`/memberships/${aliceMembership}`)).status, 404);
    assert.equal((await alice.request(`/memberships/${aliceMembership}`)).data.user_email, alice.email);
    const own = await carol.request('/memberships');
    assert.equal(own.status, 200);
    assert.equal(own.data.pagination.total, 0);
    const all = await admin.request(`/memberships?club_id=${clubs['Badminton Club'].id}&status=pending`);
    assert.equal(all.data.pagination.total, 2);
    assert.equal((await admin.request('/memberships?status=unknown')).status, 422);
    assert.equal((await admin.request('/memberships?club_id=abc')).status, 422);
    assert.equal((await admin.request('/memberships?sort=name')).status, 422);
  });

  await check('Students cannot review applications, including their own', async () => {
    assert.equal((await carol.request(`/memberships/${aliceMembership}`, { method: 'PATCH', body: { status: 'approved' } })).status, 404);
    const own = await alice.request(`/memberships/${aliceMembership}`, { method: 'PATCH', body: { status: 'approved' } });
    assert.equal(own.status, 403);
    assert.equal((await alice.request(`/memberships/${aliceMembership}`, { method: 'PATCH', body: { status: 'pending' } })).status, 422);
  });

  await check('Only Admins assign coaches, with valid club and user references', async () => {
    const body = { club_id: clubs['Badminton Club'].id, user_id: dave.id };
    assert.equal((await dave.request('/club-coaches', { method: 'POST', body })).status, 403);
    assert.equal((await admin.request('/club-coaches', { method: 'POST', body: { ...body, club_id: 999999 } })).status, 422);
    assert.equal((await admin.request('/club-coaches', { method: 'POST', body: { ...body, user_id: 999999 } })).status, 422);
    const assigned = await admin.request('/club-coaches', { method: 'POST', body });
    assert.equal(assigned.status, 201);
    assert.equal(assigned.data.user_id, dave.id);
    coachId = assigned.data.id;
    assert.equal((await admin.request('/club-coaches', { method: 'POST', body })).status, 409);
    const listed = await carol.request(`/club-coaches?club_id=${clubs['Badminton Club'].id}`);
    assert.deepEqual(listed.data.map((coach) => coach.user_id), [dave.id]);
  });

  await check('Coaches review their own clubs only and cannot review themselves', async () => {
    const chess = await carol.request('/memberships', { method: 'POST', body: { club_id: clubs['Chess Club'].id } });
    assert.equal(chess.status, 201);
    carolMembership = chess.data.id;
    assert.equal((await dave.request(`/memberships/${carolMembership}`, { method: 'PATCH', body: { status: 'approved' } })).status, 404);
    assert.equal((await dave.request(`/memberships?club_id=${clubs['Badminton Club'].id}`)).data.pagination.total, 2);
    const approved = await dave.request(`/memberships/${aliceMembership}`, { method: 'PATCH', body: { status: 'approved', review_note: 'Welcome!' } });
    assert.equal(approved.status, 200);
    assert.equal(approved.data.status, 'approved');
    assert.equal(approved.data.reviewed_by, dave.id);
    assert.ok(approved.data.reviewed_at.endsWith('Z'));
    const self = await dave.request('/memberships', { method: 'POST', body: { club_id: clubs['Badminton Club'].id } });
    assert.equal(self.status, 201);
    daveMembership = self.data.id;
    const selfReview = await dave.request(`/memberships/${daveMembership}`, { method: 'PATCH', body: { status: 'approved' } });
    assert.equal(selfReview.status, 403);
    assert.equal(selfReview.error.code, 'self_review');
  });

  await check('Membership status transitions are enforced and reapplication follows rejection or withdrawal', async () => {
    assert.equal((await admin.request(`/memberships/${aliceMembership}`, { method: 'PATCH', body: { status: 'rejected' } })).status, 409);
    assert.equal((await alice.request(`/memberships/${aliceMembership}`, { method: 'PATCH', body: { status: 'withdrawn' } })).status, 409);
    const bobs = (await bob.request('/memberships')).data.memberships;
    assert.equal(bobs.length, 1);
    assert.equal((await admin.request(`/memberships/${bobs[0].id}`, { method: 'PATCH', body: { status: 'withdrawn' } })).status, 403);
    assert.equal((await bob.request(`/memberships/${bobs[0].id}`, { method: 'PATCH', body: { status: 'withdrawn' } })).data.status, 'withdrawn');
    const reapplied = await bob.request('/memberships', { method: 'POST', body: { club_id: clubs['Badminton Club'].id } });
    assert.equal(reapplied.status, 201);
    assert.equal((await admin.request(`/memberships/${daveMembership}`, { method: 'PATCH', body: { status: 'rejected', review_note: 'Coaches do not join.' } })).data.status, 'rejected');
    assert.equal((await dave.request('/memberships', { method: 'POST', body: { club_id: clubs['Badminton Club'].id } })).status, 201);
    assert.equal((await admin.request(`/memberships/${reapplied.data.id}`, { method: 'PATCH', body: { status: 'approved' } })).status, 200);
    const ended = await bob.request(`/memberships/${reapplied.data.id}`, { method: 'PATCH', body: { status: 'ended' } });
    assert.equal(ended.status, 200);
    assert.equal(ended.data.ended_by, bob.id);
    assert.ok(ended.data.ended_at);
    const history = await admin.request(`/memberships?user_id=${bob.id}`);
    assert.deepEqual(history.data.memberships.map((membership) => membership.status).sort(), ['ended', 'withdrawn']);
  });

  await check('Ending a coach assignment removes the coach review scope', async () => {
    assert.equal((await dave.request(`/club-coaches/${coachId}`, { method: 'DELETE' })).status, 403);
    assert.equal((await admin.request(`/club-coaches/${coachId}`, { method: 'DELETE' })).status, 204);
    assert.equal((await admin.request(`/club-coaches/${coachId}`, { method: 'DELETE' })).status, 404);
    assert.equal((await dave.request(`/memberships/${aliceMembership}`)).status, 404);
    assert.equal((await dave.request('/memberships')).data.pagination.total, 2);
    assert.equal((await admin.request(`/memberships/${carolMembership}`, { method: 'PATCH', body: { status: 'approved' } })).status, 200);
  });

  return { clubs, sports: fixtures.sports, newStudent, students: { alice, bob, carol, dave } };
}
