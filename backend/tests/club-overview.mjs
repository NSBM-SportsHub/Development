import assert from 'node:assert/strict';

export async function testClubOverview({ check, Client, admin, sports, newStudent }) {
  async function request(client, path, method = 'GET', body, status = 200) {
    const response = await client.request(path, { method, body });
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(response.error)}`);
    return response.data;
  }
  const club = await request(admin, '/clubs', 'POST', { name: 'Overview Main Club', sport_id: sports.Badminton, status: 'recruiting' }, 201);
  const otherClub = await request(admin, '/clubs', 'POST', { name: 'Overview Other Club', sport_id: sports.Badminton, status: 'recruiting' }, 201);
  const coach = await newStudent('overview-coach');
  const member = await newStudent('overview-member');
  const second = await newStudent('overview-second');
  const pending = await newStudent('overview-pending');
  const path = `/clubs/${club.id}/overview`;
  let assignment, membership, session;

  await check('Club overview is Admin-only, read-only and validates paging and filters', async () => {
    await request(new Client(), path, 'GET', undefined, 401);
    await request(member, path, 'GET', undefined, 403);
    assignment = await request(admin, '/club-coaches', 'POST', { club_id: club.id, user_id: coach.id }, 201);
    await request(coach, path, 'GET', undefined, 403);
    await request(admin, path, 'POST', {}, 405);
    for (const query of ['per_page=101', 'per_page=0', 'members_page=-1', 'coaches_page=oops', 'activity_page[]=1', 'activity_user_id=abc', 'unexpected=1']) {
      await request(admin, `${path}?${query}`, 'GET', undefined, 422);
    }
    await request(admin, '/clubs/999999/overview', 'GET', undefined, 404);
    const empty = await request(admin, `/clubs/${otherClub.id}/overview`);
    assert.equal(empty.summary.members, 0); assert.equal(empty.summary.coaches, 0);
    assert.deepEqual(empty.members.records, []); assert.deepEqual(empty.coaches.records, []); assert.deepEqual(empty.activity.records, []);
  });
  await check('Club overview counts current rosters and shows safe, current profile details', async () => {
    await request(member, '/users/me', 'PATCH', { student_id: `OVERVIEW-${club.id}`, phone: '+94770002233' });
    membership = await request(member, '/memberships', 'POST', { club_id: club.id }, 201);
    await request(coach, `/memberships/${membership.id}`, 'PATCH', { status: 'approved' });
    const secondMembership = await request(second, '/memberships', 'POST', { club_id: club.id }, 201);
    await request(coach, `/memberships/${secondMembership.id}`, 'PATCH', { status: 'approved' });
    await request(pending, '/memberships', 'POST', { club_id: club.id }, 201);
    const data = await request(admin, path);
    assert.equal(data.summary.members, 2); assert.equal(data.summary.coaches, 1); assert.equal(data.summary.pending_applications, 1);
    const row = data.members.records.find((row) => row.user_id === member.id);
    assert.equal(row.student_id, `OVERVIEW-${club.id}`); assert.equal(row.phone, '+94770002233'); assert.equal(row.account_status, 'active');
    const optional = data.members.records.find((row) => row.user_id === second.id);
    assert.equal(optional.phone, null); assert.equal(optional.student_id, null);
    assert.equal(data.coaches.records[0].membership_reviews, 2);
    for (const row of [...data.members.records, ...data.coaches.records]) {
      for (const field of ['password', 'password_hash', 'auth_version', 'deleted_at']) assert.equal(Object.hasOwn(row, field), false);
    }
    await request(member, '/users/me', 'PATCH', { phone: '+94770004455' });
    assert.equal((await request(admin, path)).members.records.find((row) => row.user_id === member.id).phone, '+94770004455');
    const listClub = (await request(admin, '/clubs')).find((row) => row.id === club.id);
    assert.equal(listClub.member_count, 2); assert.equal(listClub.coach_count, 1);
    const page1 = await request(admin, `${path}?per_page=1`);
    const page2 = await request(admin, `${path}?per_page=1&members_page=2`);
    assert.equal(page1.members.pagination.total, 2); assert.equal(page1.members.records.length, 1);
    assert.notEqual(page1.members.records[0].id, page2.members.records[0].id);
    assert.deepEqual((await request(admin, `${path}?members_page=999`)).members.records, []);
  });
  await check('Club activity and attendance statistics stay within the selected club and person', async () => {
    const foreignMembership = await request(member, '/memberships', 'POST', { club_id: otherClub.id }, 201);
    await request(admin, `/memberships/${foreignMembership.id}`, 'PATCH', { status: 'approved' });
    const training = { title: 'Overview Practice', session_date: '2034-05-01', start_time: '15:00', end_time: '16:00' };
    session = await request(coach, '/training-sessions', 'POST', { ...training, club_id: club.id }, 201);
    const foreign = await request(admin, '/training-sessions', 'POST', { ...training, title: 'Other club practice', club_id: otherClub.id }, 201);
    await request(coach, '/attendance', 'POST', { session_id: session.id, participant_id: member.id, status: 'late' }, 201);
    await request(admin, '/attendance', 'POST', { session_id: foreign.id, participant_id: member.id, status: 'present' }, 201);
    let data = await request(admin, path);
    assert.equal(data.summary.training_sessions, 1); assert.equal(data.summary.attendance_recorded, 1);
    const stats = data.members.records.find((row) => row.user_id === member.id);
    assert.equal(stats.present, 0); assert.equal(stats.late, 1); assert.equal(stats.last_session_date, '2034-05-01');
    assert.ok(data.activity.records.some((row) => row.type === 'attendance' && row.user_id === member.id && row.actor_id === null));
    assert.ok(data.activity.records.some((row) => row.type === 'review' && row.user_id === member.id && row.actor_id === coach.id));
    assert.ok(data.activity.records.filter((row) => row.type === 'application').every((row) => row.status === 'submitted'));
    assert.ok(data.activity.records.filter((row) => row.type === 'training').every((row) => row.actor_id === null));
    assert.ok(data.activity.records.every((row) => !row.title.includes('Other club practice')));
    assert.ok(data.activity.records.every((row) => row.type !== 'application' || row.source_id !== foreignMembership.id));
    const filtered = await request(admin, `${path}?activity_user_id=${coach.id}`);
    assert.ok(filtered.activity.records.some((row) => row.type === 'review'));
    assert.ok(filtered.activity.records.every((row) => row.user_id === coach.id || row.actor_id === coach.id));
    const first = await request(admin, `${path}?per_page=1`);
    const next = await request(admin, `${path}?per_page=1&activity_page=2`);
    assert.ok(first.activity.pagination.total > 1);
    assert.notEqual(`${first.activity.records[0].type}-${first.activity.records[0].source_id}`, `${next.activity.records[0].type}-${next.activity.records[0].source_id}`);
    await request(coach, `/training-sessions/${session.id}/cancel`, 'PATCH', {});
    data = await request(admin, path);
    assert.equal(data.summary.attendance_recorded, 1);
    assert.equal(data.members.records.find((row) => row.user_id === member.id).late, 0);
    assert.equal(data.activity.records.find((row) => row.type === 'attendance').session_status, 'cancelled');
  });
  await check('Ended members and coaches leave rosters while club activity history remains', async () => {
    await request(member, `/memberships/${membership.id}`, 'PATCH', { status: 'ended' });
    await request(admin, `/club-coaches/${assignment.id}`, 'DELETE', undefined, 204);
    const data = await request(admin, path);
    assert.equal(data.summary.members, 1); assert.equal(data.summary.coaches, 0);
    assert.ok(data.members.records.every((row) => row.user_id !== member.id)); assert.deepEqual(data.coaches.records, []);
    assert.ok(data.activity.records.some((row) => row.type === 'membership_ended' && row.user_id === member.id));
    assert.ok(data.activity.records.some((row) => row.type === 'coach_ended' && row.user_id === coach.id));
    assert.ok(data.activity.records.some((row) => row.type === 'attendance' && row.user_id === member.id));
    const listClub = (await request(admin, '/clubs')).find((row) => row.id === club.id);
    assert.equal(listClub.member_count, 1); assert.equal(listClub.coach_count, 0);
    await request(admin, `/clubs/${club.id}/archive`, 'PATCH', {});
    await request(admin, path, 'GET', undefined, 404);
  });
}
