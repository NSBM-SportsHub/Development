import assert from 'node:assert/strict';

export async function testNotificationsReports({ check, Client, admin, clubs, sports, newStudent, password }) {
  const member = await newStudent('report-member');
  const teammate = await newStudent('report-teammate');
  const opponent = await newStudent('report-opponent');
  const outsider = await newStudent('report-outsider');
  const clubId = clubs['Badminton Club'].id;
  const range = 'from=2032-05-01&to=2032-05-31';
  const ownReport = (extra = '') => member.request(`/participation/me?${range}${extra}`);
  const adminReport = (extra = '') => admin.request(`/reports/participation?${range}${extra}`);
  const notifications = (client) => client.request('/notifications?per_page=100');
  const send = async (client, path, method, body, status = 200) => {
    const response = await client.request(path, { method, body });
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(response.error)}`);
    return response.data;
  };
  let notificationId;
  let entry;
  let tournament;
  let match;

  await check('Notifications and reports require authentication; Admin reports reject Students and coaches', async () => {
    for (const path of ['/notifications', '/participation/me', '/reports/participation']) {
      assert.equal((await new Client().request(path)).status, 401);
    }
    assert.equal((await member.request('/reports/participation')).status, 403);
    assert.equal((await member.request('/participation/me?user_id=1')).status, 422);
    assert.equal((await member.request('/notifications?recipient_id=1')).status, 422);
    assert.equal((await outsider.request('/participation/me')).data.summary.total_records, 0);
    const assignment = await send(admin, '/club-coaches', 'POST', { club_id: clubId, user_id: outsider.id }, 201);
    assert.equal((await outsider.request('/reports/participation')).status, 403);
    await send(admin, `/club-coaches/${assignment.id}`, 'DELETE', undefined, 204);
  });

  await check('Membership decisions create exactly one notification and failed repeats create none', async () => {
    for (const client of [member, teammate, opponent]) {
      const application = await send(client, '/memberships', 'POST', { club_id: clubId }, 201);
      await send(admin, `/memberships/${application.id}`, 'PATCH', { status: 'approved' });
      const first = (await notifications(client)).data;
      assert.equal(first.notifications.length, 1);
      assert.equal(first.notifications[0].type, 'membership');
      assert.equal(first.unread_count, 1);
      assert.equal((await admin.request(`/memberships/${application.id}`, { method: 'PATCH', body: { status: 'approved' } })).status, 409);
      assert.equal((await notifications(client)).data.pagination.total, 1);
    }
    notificationId = (await notifications(member)).data.notifications[0].id;
    assert.equal((await notifications(outsider)).data.pagination.total, 0);
  });

  await check('Read state is recipient-only, CSRF-protected, idempotent and persists across sessions', async () => {
    const path = `/notifications/${notificationId}`;
    assert.equal((await outsider.request(path, { method: 'PATCH', body: { read: true } })).status, 404);
    assert.equal((await admin.request(path, { method: 'PATCH', body: { read: true } })).status, 404);
    assert.equal((await member.request(path, { method: 'PATCH', body: { read: true }, token: false })).status, 403);
    assert.equal((await member.request(path, { method: 'PATCH', body: { read: false } })).status, 422);
    assert.equal((await member.request(path, { method: 'PATCH', body: { read: true, recipient_id: outsider.id } })).status, 422);
    const read = await send(member, path, 'PATCH', { read: true });
    assert.match(read.read_at, /Z$/);
    assert.equal((await send(member, path, 'PATCH', { read: true })).read_at, read.read_at);
    const again = new Client();
    await again.session();
    await send(again, '/auth/login', 'POST', { email: member.email, password });
    assert.equal((await notifications(again)).data.unread_count, 0);
    assert.equal((await member.request('/notifications?state=unread')).data.pagination.total, 0);
    assert.equal((await member.request('/notifications?state=read')).data.pagination.total, 1);
    assert.equal((await member.request(path, { method: 'GET' })).status, 405);
  });

  await check('Announcement creation reaches active users once; edits do not resend notifications', async () => {
    const post = await send(admin, '/announcements', 'POST', { title: 'Report suite announcement', body: 'The report suite announcement body.', club_id: clubId }, 201);
    for (const client of [member, outsider, admin]) {
      assert.ok((await notifications(client)).data.notifications.some((row) => row.type === 'announcement' && row.message === post.title));
    }
    const before = (await notifications(member)).data.pagination.total;
    await send(admin, `/announcements/${post.announcement_id}`, 'PATCH', { title: 'Updated report announcement' });
    assert.equal((await notifications(member)).data.pagination.total, before);
    assert.equal((await member.request('/notifications?per_page=1')).data.notifications.length, 1);
    const page2 = (await member.request('/notifications?page=2&per_page=1')).data;
    assert.equal(page2.notifications[0].id, notificationId);
  });

  await check('Booking approval, rejection and cancellation notify only the requester', async () => {
    const facility = await send(admin, '/facilities', 'POST', { name: 'Report suite court', location: 'Sports centre', capacity: 10 }, 201);
    const bookingBody = { resource_type: 'facility', resource_id: facility.id, starts_at: '2032-05-10T10:00:00Z', ends_at: '2032-05-10T11:00:00Z' };
    const booking = await send(member, '/bookings', 'POST', bookingBody, 201);
    await send(admin, `/bookings/${booking.id}`, 'PATCH', { status: 'approved' });
    await send(admin, `/bookings/${booking.id}`, 'DELETE', undefined, 204);
    const other = await send(member, '/bookings', 'POST', bookingBody, 201);
    await send(admin, `/bookings/${other.id}`, 'PATCH', { status: 'rejected' });
    assert.equal((await notifications(member)).data.notifications.filter((row) => row.type === 'booking').length, 3);
    assert.equal((await notifications(outsider)).data.notifications.some((row) => row.type === 'booking'), false);
  });

  await check('Training history preserves all attendance states while totals exclude cancelled sessions', async () => {
    for (const [index, status] of ['present', 'late', 'absent', 'excused', 'present'].entries()) {
      const session = await send(admin, '/training-sessions', 'POST', { club_id: clubId, title: `Report training ${index}`, session_date: `2032-05-${10 + index}`, start_time: '15:00', end_time: '16:00' }, 201);
      await send(admin, '/attendance', 'POST', { session_id: session.id, participant_id: member.id, status }, 201);
      if (index === 4) await send(admin, `/training-sessions/${session.id}/cancel`, 'PATCH', {});
    }
    const result = (await ownReport()).data;
    assert.equal(result.records.length, 5);
    assert.equal(result.summary.training_attended, 2);
    assert.equal(result.records.filter((row) => row.activity_status === 'cancelled').length, 1);
    assert.ok(result.records.every((row) => row.user_id === member.id));
    assert.equal((await outsider.request('/participation/me')).data.records.length, 0);
  });

  await check('Tournament history distinguishes pending and approved registration and notifies every team member', async () => {
    tournament = await send(admin, '/tournaments', 'POST', { name: 'Report suite league', sport_id: sports.Badminton, format: 'league', starts_on: '2032-05-10', ends_on: '2032-05-20', min_team_size: 1, max_team_size: 2 }, 201);
    await send(admin, `/tournaments/${tournament.id}`, 'PATCH', { status: 'registration_open' });
    entry = await send(member, `/tournaments/${tournament.id}/entries`, 'POST', { name: 'Report pair', member_ids: [member.id, teammate.id] }, 201);
    assert.equal((await ownReport('&type=tournament')).data.records[0].status, 'pending');
    assert.equal((await ownReport()).data.summary.approved_entries, 0);
    await send(admin, `/tournament-entries/${entry.id}`, 'PATCH', { status: 'approved' });
    const opposite = await send(opponent, `/tournaments/${tournament.id}/entries`, 'POST', { name: 'Report opponent', member_ids: [opponent.id] }, 201);
    await send(admin, `/tournament-entries/${opposite.id}`, 'PATCH', { status: 'approved' });
    for (const client of [member, teammate]) assert.equal((await notifications(client)).data.notifications.filter((row) => row.type === 'tournament').length, 1);
    await send(admin, `/tournaments/${tournament.id}`, 'PATCH', { status: 'registration_closed' });
    const fixtures = await send(admin, `/tournaments/${tournament.id}/fixtures`, 'POST', {}, 201);
    match = fixtures[0];
    await send(admin, `/matches/${match.id}`, 'PATCH', { scheduled_at: '2032-05-12T10:00:00Z' });
    await send(admin, `/tournaments/${tournament.id}`, 'PATCH', { status: 'in_progress' });
    assert.equal((await ownReport()).data.summary.matches_played, 0);
    await send(admin, `/matches/${match.id}/result`, 'PUT', { home_score: match.home_entry_id === entry.id ? 2 : 0, away_score: match.home_entry_id === entry.id ? 0 : 2 });
  });

  await check('Personal and Admin report totals match source records across pages and sport/date/status filters', async () => {
    const personal = (await ownReport('&per_page=1')).data;
    assert.equal(personal.records.length, 1);
    assert.equal(personal.summary.total_records, 7);
    assert.equal(personal.pagination.total_pages, 7);
    assert.equal(personal.summary.matches_played, 1);
    assert.equal(personal.summary.wins, 1);
    assert.equal(personal.summary.approved_entries, 1);
    const all = (await adminReport()).data;
    assert.equal(all.summary.total_records, 11);
    assert.equal(all.summary.participants, 3);
    assert.equal(all.summary.wins, 2); // One win per member of the winning pair.
    assert.equal(all.summary.losses, 1);
    assert.deepEqual((await adminReport(`&user_id=${member.id}`)).data.summary, personal.summary);
    assert.equal((await ownReport('&status=late')).data.summary.training_attended, 1);
    assert.equal((await ownReport('&type=match')).data.records[0].status, 'win');
    assert.equal((await ownReport(`&sport_id=${sports.Chess}`)).data.summary.total_records, 0);
    assert.equal((await member.request('/participation/me?from=2032-05-12&to=2032-05-12')).data.summary.total_records, 2);
    assert.equal((await ownReport('&page=8&per_page=1')).data.records.length, 0);
  });

  await check('Correcting a result immediately updates reports without duplicate history', async () => {
    await send(admin, `/matches/${match.id}/result`, 'PUT', { home_score: 1, away_score: 1 });
    const report = (await ownReport()).data;
    assert.equal(report.summary.total_records, 7);
    assert.equal(report.summary.wins, 0);
    assert.equal(report.summary.draws, 1);
    assert.equal((await adminReport()).data.summary.draws, 3);
  });

  await check('Report and notification filters reject invalid values and injection attempts', async () => {
    for (const query of ['from=2032-02-30', 'from=2032-06-01&to=2032-05-01', 'type=unknown', 'status=unknown', 'per_page=101', 'page=0', 'from[]=2032-05-01', "sport_id=' OR 1=1--", 'user_id=1']) {
      assert.equal((await member.request(`/participation/me?${query}`)).status, 422, query);
    }
    for (const query of ['state=unknown', 'state[]=read', 'page=0', 'per_page=101']) {
      assert.equal((await member.request(`/notifications?${query}`)).status, 422, query);
    }
    assert.equal((await admin.request('/reports/participation?user_id=-1')).status, 422);
    assert.equal((await member.request('/notifications', { method: 'POST', body: {} })).status, 405);
  });
}
