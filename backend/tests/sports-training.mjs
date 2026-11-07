import assert from 'node:assert/strict';

export async function testSportsTraining({ check, Client, admin, sports, newStudent }) {
  const student = await newStudent('training-member');
  const coach = await newStudent('training-coach');
  const outsider = await newStudent('training-outsider');
  let club, session, attendance;
  const body = { name: 'Integration Training Club', sport_id: sports.Badminton, status: 'recruiting' };

  await check('Sports and club APIs preserve sessions, Admin writes, validation and history', async () => {
    assert.equal((await new Client().request('/clubs')).status, 401);
    assert.equal((await student.request('/clubs', { method: 'POST', body })).status, 403);
    assert.equal((await admin.request('/clubs', { method: 'POST', body, token: false })).status, 403);
    const created = await admin.request('/clubs', { method: 'POST', body });
    assert.equal(created.status, 201);
    club = created.data;
    assert.equal(typeof club.id, 'number');
    assert.ok((await student.request('/clubs')).data.some((item) => item.id === club.id));
    assert.equal((await admin.request('/clubs', { method: 'POST', body })).status, 409);
    assert.equal((await admin.request(`/clubs/${club.id}`, { method: 'PATCH', body: { description: 'Updated club' } })).status, 200);
    assert.equal((await admin.request(`/clubs/${club.id}`, { method: 'DELETE' })).status, 409);
    const sport = await student.request(`/sports/${sports.Badminton}`);
    assert.equal(sport.status, 200);
    assert.equal(sport.data.name, 'Badminton');
  });

  await check('Training writes are limited to Admins and the assigned club coach', async () => {
    const assignment = await admin.request('/club-coaches', { method: 'POST', body: { club_id: club.id, user_id: coach.id } });
    assert.equal(assignment.status, 201);
    const training = { club_id: club.id, title: 'Practice', session_date: '2026-12-05', start_time: '15:00', end_time: '16:00' };
    assert.equal((await outsider.request('/training-sessions', { method: 'POST', body: training })).status, 403);
    assert.equal((await coach.request('/training-sessions', { method: 'POST', body: { ...training, end_time: '14:00' } })).status, 400);
    const created = await coach.request('/training-sessions', { method: 'POST', body: training });
    assert.equal(created.status, 201);
    session = created.data;
    assert.equal((await student.request(`/training-sessions/${session.id}`)).status, 200);
    assert.equal((await coach.request(`/training-sessions/${session.id}`, { method: 'PATCH', body: { title: 'Practice updated' } })).status, 200);
    assert.equal((await coach.request(`/training-sessions/${session.id}`, { method: 'PATCH', body: { status: 'invalid' } })).status, 400);
    const foreignClub = (await admin.request('/clubs')).data.find((item) => item.id !== club.id);
    assert.equal((await coach.request(`/training-sessions/${session.id}`, { method: 'PATCH', body: { club_id: foreignClub.id } })).status, 403);
  });

  await check('Attendance requires approved membership and hides other clubs and participants', async () => {
    const application = await student.request('/memberships', { method: 'POST', body: { club_id: club.id } });
    assert.equal(application.status, 201);
    assert.equal((await admin.request(`/memberships/${application.data.id}`, { method: 'PATCH', body: { status: 'approved' } })).status, 200);
    const record = { session_id: session.id, participant_id: student.id, status: 'present' };
    assert.equal((await student.request('/attendance', { method: 'POST', body: record })).status, 403);
    assert.equal((await coach.request('/attendance', { method: 'POST', body: { ...record, participant_id: outsider.id } })).status, 422);
    const created = await coach.request('/attendance', { method: 'POST', body: record });
    assert.equal(created.status, 201);
    attendance = created.data;
    assert.equal((await coach.request('/attendance', { method: 'POST', body: record })).status, 409);
    assert.equal((await student.request(`/attendance/${attendance.id}`)).status, 200);
    assert.equal((await outsider.request(`/attendance/${attendance.id}`)).status, 404);
    assert.deepEqual((await outsider.request('/attendance')).data, []);
    assert.ok((await coach.request('/attendance')).data.some((item) => item.id === attendance.id));
    assert.equal((await coach.request(`/training-sessions/${session.id}/cancel`, { method: 'PATCH' })).status, 200);
    assert.equal((await coach.request('/attendance', { method: 'POST', body: record })).status, 400);
  });

  await check('Recorded attendance prevents club changes and keeps the original coach visibility', async () => {
    const foreignClub = (await admin.request('/clubs')).data.find((item) => item.id !== club.id);
    assert.equal((await admin.request('/club-coaches', { method: 'POST', body: { club_id: foreignClub.id, user_id: outsider.id } })).status, 201);
    const moved = await admin.request(`/training-sessions/${session.id}`, { method: 'PATCH', body: { club_id: foreignClub.id, title: 'Must not overwrite history' } });
    assert.equal(moved.status, 409);
    const saved = (await admin.request(`/training-sessions/${session.id}`)).data;
    assert.equal(Number(saved.club_id), club.id);
    assert.equal(saved.title, 'Practice updated');
    assert.equal((await outsider.request(`/attendance/${attendance.id}`)).status, 404);
    assert.equal((await coach.request(`/attendance/${attendance.id}`)).status, 200);
    const empty = await admin.request('/training-sessions', { method: 'POST', body: { club_id: club.id, title: 'Session without attendance', session_date: '2026-12-06', start_time: '15:00', end_time: '16:00' } });
    assert.equal(empty.status, 201);
    assert.equal((await admin.request(`/training-sessions/${empty.data.id}`, { method: 'PATCH', body: { club_id: foreignClub.id } })).status, 200);
  });

  await check('Club archival retains historical records and rejects new club writes', async () => {
    assert.equal((await admin.request(`/clubs/${club.id}/archive`, { method: 'PATCH' })).status, 200);
    assert.equal((await student.request(`/clubs/${club.id}`)).status, 404);
    assert.equal((await admin.request(`/clubs/${club.id}`, { method: 'PATCH', body: { name: 'Reopened' } })).status, 404);
    assert.equal((await student.request(`/attendance/${attendance.id}`)).status, 200);
  });
}
