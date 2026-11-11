import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Checklist coverage requires a real successful workflow plus persistence checks.
// Denied requests are checked separately and cannot stand in for a working write.
export async function testApiOperations({ check, Client, admin, newStudent, sports, password, suffix, php, env, root }) {
  const checklist = readFileSync(resolve(root, 'docs/api-working-status-checklist.md'), 'utf8');
  const expected = [...checklist.matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) \| ([^|]+)\|/gm)]
    .map((match) => `${match[1]} ${match[2].trim()}`);
  assert.equal(expected.length, 83);
  assert.equal(new Set(expected).size, 83);
  const observations = new Map();
  const evidencePath = resolve(root, '.artifacts', `api-operations-${suffix}`);
  mkdirSync(evidencePath, { recursive: true });
  const anonymous = new Client();
  await anonymous.session();
  let studentActor;
  function keyFor(method, path) {
    return method + ' /api' + path.split('?')[0]
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/{uuid}')
      .replace(/\/[1-9][0-9]*(?=\/|$)/g, '/{id}');
  }
  function adminOnly(method, path) {
    return (method === 'GET' && ['/api/users', '/api/users/{id}', '/api/reports/participation'].includes(path)) ||
      (method !== 'GET' && (/^\/api\/(?:users(?:\/\{id\})?|clubs(?:\/\{id\}(?:\/archive)?)?|facilities(?:\/\{id\})?|equipment(?:\/\{id\})?|club-coaches(?:\/\{id\})?|tournaments(?:\/\{id\})?|announcements(?:\/\{uuid\})?)$/.test(path) ||
        /^\/api\/(?:tournaments\/\{id\}\/(?:matches|fixtures)|matches\/\{id\}(?:\/result)?)$/.test(path)));
  }
  async function expect(client, path, method = 'GET', body, status = 200) {
    const response = await client.request(path, { method, body });
    assert.equal(response.status, status, `${method} ${path}: ${response.error?.message ?? 'unexpected status'}`);
    return response.data;
  }
  // Verify values through a separate PDO process, not the write response.
  function persisted(table, id, field, value, primary = 'id') {
    const code = String.raw`
require 'backend/src/shared/bootstrap.php';
$name = getenv('SPORTSHUB_DB_NAME');
if (!preg_match('/\Asportshub_test_[a-f0-9]{16}\z/', (string) $name)) exit(1);
[$table, $id, $field, $primary] = json_decode($argv[1], true, flags: JSON_THROW_ON_ERROR);
foreach ([$table, $field, $primary] as $part) if (!preg_match('/\A[a-z_]+\z/', $part)) exit(1);
$db = SportsHub\Database::get();
$db->exec('START TRANSACTION READ ONLY');
$quote = static fn(string $name): string => chr(96) . $name . chr(96);
$query = $db->prepare('SELECT ' . $quote($field) . ' FROM ' . $quote($table) . ' WHERE ' . $quote($primary) . ' = ?');
$query->execute([$id]);
echo json_encode($query->fetchColumn(), JSON_THROW_ON_ERROR);
$db->exec('COMMIT');
`;
    const result = spawnSync(php, ['-r', code, JSON.stringify([table, id, field, primary])], { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(result.status, 0, `PDO persistence audit failed: ${table}.${field}`);
    assert.equal(JSON.parse(result.stdout), value, `Persisted ${table}.${field}`);
  }
  async function op(client, method, path, status, body, verify = () => {}) {
    const key = keyFor(method, path);
    assert.ok(expected.includes(key), `Operation missing from checklist: ${key}`);
    const result = { operation: key, request: `${method} /api${path}`, expected_status: status, actual_status: null,
      result: 'FAIL', authentication: 'public', csrf: 'not applicable', student_permission: 'not applicable' };
    observations.set(key, result);
    let data;
    try {
      await check(`Checklist ${key}`, async () => {
        if (!key.includes(' /api/auth/') && key !== 'GET /api/health') {
          assert.equal((await anonymous.request(path, { method, body })).status, 401, `Authentication: ${key}`);
          result.authentication = 'unauthenticated request rejected (401)';
        }
        if (method !== 'GET') {
          assert.equal((await client.request(path, { method, body, token: false })).status, 403, `CSRF: ${key}`);
          result.csrf = 'missing token rejected (403)';
        }
        const canonical = key.slice(method.length + 1);
        if (studentActor && adminOnly(method, canonical)) {
          assert.equal((await studentActor.request(path, { method, body })).status, 403, `Student permissions: ${key}`);
          result.student_permission = 'student rejected (403)';
        }
        const response = await client.request(path, { method, body });
        result.actual_status = response.status;
        assert.equal(response.status, status, `${key}: ${response.error?.message ?? 'unexpected status'}`);
        data = response.data;
        await verify(data);
        result.result = 'PASS';
      });
    } catch (error) { result.details = error.message; throw error; }
    return data;
  }
  try {
    await op(anonymous, 'GET', '/health', 200, undefined, (d) => assert.equal(d.database, 'connected'));
    const member = new Client();
    await op(member, 'GET', '/auth/session', 200, undefined, (d) => { assert.equal(d.user, null); assert.ok(d.csrf_token.length >= 32); });
    const email = `operations-member-${suffix}@example.test`;
    const registration = await op(member, 'POST', '/auth/register', 201, { name: 'Operations Member', email, password }, (d) => {
      assert.equal(d.user.role, 'student'); persisted('users', d.user.id, 'email', email);
    });
    member.id = registration.user.id;
    studentActor = member;
    const login = new Client(); await login.session();
    await op(login, 'POST', '/auth/login', 200, { email, password }, (d) => assert.equal(d.user.id, member.id));
    await op(member, 'GET', '/users/me', 200, undefined, (d) => assert.equal(d.id, member.id));
    await op(member, 'PATCH', '/users/me', 200, { phone: '+94770000000' }, (d) => {
      assert.equal(d.phone, '+94770000000'); persisted('users', member.id, 'phone', '+94770000000');
    });
    const updatedPassword = 'Changed!' + suffix;
    await op(member, 'PATCH', '/users/me/password', 200, { current_password: password, new_password: updatedPassword }, async () => {
      assert.equal((await login.request('/users/me')).status, 401);
      assert.equal((await member.session()).data.user.id, member.id);
      const fresh = new Client(); await fresh.session();
      assert.equal((await fresh.request('/auth/login', { method: 'POST', body: { email, password: updatedPassword } })).status, 200);
    });
    await op(admin, 'GET', '/users', 200, undefined, (d) => assert.ok(d.users.length > 0 && d.pagination.total > 0));
    const account = await op(admin, 'POST', '/users', 201, { name: 'Operations Account', email: `operations-account-${suffix}@example.test`, password, role: 'student', status: 'active' },
      (d) => persisted('users', d.id, 'status', 'active'));
    await op(admin, 'GET', `/users/${account.id}`, 200, undefined, (d) => assert.equal(d.id, account.id));
    await op(admin, 'PATCH', `/users/${account.id}`, 200, { name: 'Operations Account Updated' },
      () => persisted('users', account.id, 'name', 'Operations Account Updated'));
    await op(admin, 'DELETE', `/users/${account.id}`, 200, undefined, async () => {
      assert.equal((await admin.request(`/users/${account.id}`)).status, 404);
      persisted('users', account.id, 'status', 'inactive');
    });
    await op(member, 'GET', '/sports', 200, undefined, (d) => assert.ok(d.some((s) => s.id === sports.Badminton)));
    await op(member, 'GET', `/sports/${sports.Badminton}`, 200, undefined, (d) => assert.equal(d.name, 'Badminton'));
    const club = await op(admin, 'POST', '/clubs', 201, { name: 'Operations Club', sport_id: sports.Badminton, status: 'recruiting' },
      (d) => persisted('clubs', d.id, 'name', 'Operations Club'));
    await op(member, 'GET', '/clubs', 200, undefined, (d) => assert.ok(d.some((c) => c.id === club.id)));
    await op(member, 'GET', `/clubs/${club.id}`, 200, undefined, (d) => assert.equal(d.id, club.id));
    await op(admin, 'PUT', `/clubs/${club.id}`, 200, { description: 'PUT club description' }, () => persisted('clubs', club.id, 'description', 'PUT club description'));
    await op(admin, 'PATCH', `/clubs/${club.id}`, 200, { description: 'PATCH club description' }, () => persisted('clubs', club.id, 'description', 'PATCH club description'));
    await check('Club list applies search, sport and status filters and rejects invalid filters', async () => {
      assert.deepEqual((await expect(member, '/clubs?search=Operations%20Club')).map((c) => c.id), [club.id]);
      assert.deepEqual(await expect(member, '/clubs?search=unmatched-club-fixture'), []);
      assert.ok((await expect(member, `/clubs?sport_id=${sports.Badminton}&status=recruiting`)).every((c) => c.sport_id === sports.Badminton && c.status === 'recruiting'));
      assert.deepEqual(await expect(member, '/clubs?search=%25'), []);
      assert.deepEqual(await expect(member, '/clubs?search=%27%20OR%201%3D1%20--'), []);
      await expect(member, '/clubs?sport_id=invalid', 'GET', undefined, 422);
      await expect(member, '/clubs?status=unknown', 'GET', undefined, 422);
    });
    const coach = await newStudent('operations-coach');
    const other = await newStudent('operations-opponent');
    const assignment = await op(admin, 'POST', '/club-coaches', 201, { club_id: club.id, user_id: coach.id }, (d) => persisted('club_coaches', d.id, 'user_id', coach.id));
    await op(coach, 'GET', '/club-coaches', 200, undefined, (d) => assert.ok(d.some((c) => c.id === assignment.id)));
    const membership = await op(member, 'POST', '/memberships', 201, { club_id: club.id }, (d) => persisted('memberships', d.id, 'status', 'pending'));
    await op(member, 'GET', '/memberships', 200, undefined, (d) => assert.ok(d.memberships.some((m) => m.id === membership.id)));
    await op(coach, 'GET', `/memberships/${membership.id}`, 200, undefined, (d) => assert.equal(d.id, membership.id));
    await op(coach, 'PATCH', `/memberships/${membership.id}`, 200, { status: 'approved' }, () => persisted('memberships', membership.id, 'status', 'approved'));
    const otherMembership = await expect(other, '/memberships', 'POST', { club_id: club.id }, 201);
    await expect(coach, `/memberships/${otherMembership.id}`, 'PATCH', { status: 'approved' });
    const session = await op(coach, 'POST', '/training-sessions', 201,
      { club_id: club.id, title: 'Operations Training', session_date: '2035-11-15', start_time: '14:00', end_time: '15:00' },
      (d) => persisted('training_sessions', d.id, 'title', 'Operations Training'));
    await op(member, 'GET', '/training-sessions', 200, undefined, (d) => assert.ok(d.some((s) => s.id === session.id)));
    await op(member, 'GET', `/training-sessions/${session.id}`, 200, undefined, (d) => assert.equal(d.title, 'Operations Training'));
    await op(coach, 'PUT', `/training-sessions/${session.id}`, 200, { notes: 'PUT training notes' }, () => persisted('training_sessions', session.id, 'notes', 'PUT training notes'));
    await op(coach, 'PATCH', `/training-sessions/${session.id}`, 200, { notes: 'PATCH training notes' }, () => persisted('training_sessions', session.id, 'notes', 'PATCH training notes'));
    const attendance = await op(coach, 'POST', '/attendance', 201, { session_id: session.id, participant_id: member.id, status: 'present' },
      (d) => persisted('training_attendance', d.id, 'participant_id', member.id));
    await op(member, 'GET', '/attendance', 200, undefined, (d) => assert.ok(d.some((a) => a.id === attendance.id)));
    await op(member, 'GET', `/attendance/${attendance.id}`, 200, undefined, (d) => assert.equal(d.participant_id, member.id));
    const facility = await op(admin, 'POST', '/facilities', 201, { name: 'Operations Court', capacity: 10 }, (d) => persisted('facilities', d.id, 'capacity', 10));
    await op(member, 'GET', '/facilities', 200, undefined, (d) => assert.ok(d.some((f) => f.id === facility.id)));
    await op(member, 'GET', `/facilities/${facility.id}`, 200, undefined, (d) => assert.equal(d.capacity, 10));
    await op(admin, 'PUT', `/facilities/${facility.id}`, 200, { capacity: 11 }, () => persisted('facilities', facility.id, 'capacity', 11));
    await op(admin, 'PATCH', `/facilities/${facility.id}`, 200, { capacity: 12 }, () => persisted('facilities', facility.id, 'capacity', 12));
    const equipment = await op(admin, 'POST', '/equipment', 201, { name: 'Operations Rackets', total_quantity: 10 }, (d) => persisted('equipment', d.id, 'total_quantity', 10));
    await op(member, 'GET', '/equipment', 200, undefined, (d) => assert.ok(d.some((e) => e.id === equipment.id)));
    await op(member, 'GET', `/equipment/${equipment.id}`, 200, undefined, (d) => assert.equal(d.total_quantity, 10));
    await op(admin, 'PUT', `/equipment/${equipment.id}`, 200, { total_quantity: 11 }, () => persisted('equipment', equipment.id, 'total_quantity', 11));
    await op(admin, 'PATCH', `/equipment/${equipment.id}`, 200, { total_quantity: 12 }, () => persisted('equipment', equipment.id, 'total_quantity', 12));
    const booking = await op(member, 'POST', '/bookings', 201, { resource_type: 'facility', resource_id: facility.id, starts_at: '2035-11-15T10:00:00Z', ends_at: '2035-11-15T11:00:00Z' },
      (d) => persisted('bookings', d.id, 'status', 'pending'));
    await op(member, 'GET', '/bookings', 200, undefined, (d) => assert.ok(d.some((b) => b.id === booking.id)));
    await op(member, 'GET', `/bookings/${booking.id}`, 200, undefined, (d) => assert.equal(d.requested_by, member.id));
    await op(member, 'PUT', `/bookings/${booking.id}`, 200, { notes: 'PUT booking notes' }, () => persisted('bookings', booking.id, 'notes', 'PUT booking notes'));
    await op(admin, 'PATCH', `/bookings/${booking.id}`, 200, { status: 'approved' }, () => persisted('bookings', booking.id, 'status', 'approved'));
    await op(admin, 'DELETE', `/bookings/${booking.id}`, 204, undefined, async () => {
      persisted('bookings', booking.id, 'status', 'cancelled'); assert.equal((await expect(member, `/bookings/${booking.id}`)).status, 'cancelled');
    });
    const tournamentBody = { sport_id: sports.Badminton, name: 'Operations League', format: 'league', starts_on: '2035-11-20', ends_on: '2035-11-25', min_team_size: 1, max_team_size: 1 };
    const tournament = await op(admin, 'POST', '/tournaments', 201, tournamentBody, (d) => persisted('tournaments', d.id, 'status', 'draft'));
    await op(admin, 'GET', '/tournaments', 200, undefined, (d) => assert.ok(d.some((t) => t.id === tournament.id)));
    await op(admin, 'GET', `/tournaments/${tournament.id}`, 200, undefined, (d) => assert.equal(d.name, 'Operations League'));
    await op(admin, 'PATCH', `/tournaments/${tournament.id}`, 200, { status: 'registration_open' }, () => persisted('tournaments', tournament.id, 'status', 'registration_open'));
    await op(member, 'GET', `/tournaments/${tournament.id}/eligible-members`, 200, undefined, (d) => assert.ok(d.some((m) => m.user_id === member.id)));
    const entry = await op(member, 'POST', `/tournaments/${tournament.id}/entries`, 201, { name: 'Operations Home', member_ids: [member.id] }, (d) => persisted('tournament_entries', d.id, 'status', 'pending'));
    await op(member, 'GET', `/tournament-entries/${entry.id}`, 200, undefined, (d) => assert.equal(d.name, 'Operations Home'));
    await op(coach, 'PATCH', `/tournament-entries/${entry.id}`, 200, { status: 'approved' }, () => persisted('tournament_entries', entry.id, 'status', 'approved'));
    const opponent = await expect(other, `/tournaments/${tournament.id}/entries`, 'POST', { name: 'Operations Away', member_ids: [other.id] }, 201);
    await expect(coach, `/tournament-entries/${opponent.id}`, 'PATCH', { status: 'approved' });
    await op(member, 'GET', `/tournaments/${tournament.id}/entries`, 200, undefined, (d) => assert.equal(d.length, 2));
    await expect(admin, `/tournaments/${tournament.id}`, 'PATCH', { status: 'registration_closed' });
    const match = await op(admin, 'POST', `/tournaments/${tournament.id}/matches`, 201, { home_entry_id: entry.id, away_entry_id: opponent.id, venue: 'Operations Venue' },
      (d) => persisted('matches', d.id, 'venue', 'Operations Venue'));
    await op(member, 'GET', `/tournaments/${tournament.id}/matches`, 200, undefined, (d) => assert.equal(d.length, 1));
    await op(member, 'GET', `/matches/${match.id}`, 200, undefined, (d) => assert.equal(d.home_entry_id, entry.id));
    await op(admin, 'PATCH', `/matches/${match.id}`, 200, { venue: 'Updated Operations Venue' }, () => persisted('matches', match.id, 'venue', 'Updated Operations Venue'));
    await op(admin, 'DELETE', `/matches/${match.id}`, 204, undefined, () => persisted('matches', match.id, 'status', 'cancelled'));
    const fixtures = await op(admin, 'POST', `/tournaments/${tournament.id}/fixtures`, 201, {}, (d) => {
      assert.equal(d.length, 1); persisted('matches', d[0].id, 'status', 'scheduled');
    });
    await expect(admin, `/tournaments/${tournament.id}`, 'PATCH', { status: 'in_progress' });
    await op(admin, 'PUT', `/matches/${fixtures[0].id}/result`, 200, { home_score: 2, away_score: 1 }, (d) => {
      persisted('matches', d.id, 'home_score', 2); persisted('matches', d.id, 'status', 'completed');
    });
    await op(member, 'GET', `/tournaments/${tournament.id}/standings`, 200, undefined, (d) => {
      assert.equal(d.standings.length, 2); assert.equal(d.standings[0].played, 1); assert.equal(d.standings[0].points, 3);
    });
    const cancelled = await expect(admin, '/tournaments', 'POST', { ...tournamentBody, name: 'Operations Cancelled League' }, 201);
    await op(admin, 'DELETE', `/tournaments/${cancelled.id}`, 204, undefined, () => persisted('tournaments', cancelled.id, 'status', 'cancelled'));
    const announcement = await op(admin, 'POST', '/announcements', 201, { title: 'Operations Announcement', body: 'Controlled announcement for complete API verification.' },
      (d) => persisted('announcements', d.announcement_id, 'title', 'Operations Announcement', 'announcement_id'));
    await op(member, 'GET', '/announcements', 200, undefined, (d) => assert.ok(d.announcements.some((a) => a.announcement_id === announcement.announcement_id)));
    await op(member, 'GET', `/announcements/${announcement.announcement_id}`, 200, undefined, (d) => assert.equal(d.title, 'Operations Announcement'));
    await op(admin, 'PATCH', `/announcements/${announcement.announcement_id}`, 200, { is_pinned: true },
      () => persisted('announcements', announcement.announcement_id, 'is_pinned', 1, 'announcement_id'));
    await op(admin, 'DELETE', `/announcements/${announcement.announcement_id}`, 200, undefined, async () => {
      persisted('announcements', announcement.announcement_id, 'is_deleted', 1, 'announcement_id');
      assert.equal((await member.request(`/announcements/${announcement.announcement_id}`)).status, 404);
    });
    const inbox = await op(member, 'GET', '/notifications', 200, undefined, (d) => assert.ok(d.notifications.length > 0));
    await op(member, 'PATCH', `/notifications/${inbox.notifications[0].id}`, 200, { read: true }, (d) => {
      assert.match(d.read_at, /Z$/); persisted('notifications', d.id, 'recipient_id', member.id);
    });
    await op(member, 'GET', '/participation/me', 200, undefined, (d) => {
      assert.ok(d.records.length >= 3); assert.ok(d.records.every((r) => r.user_id === member.id)); assert.equal(d.summary.matches_played, 1);
    });
    await op(admin, 'GET', `/reports/participation?user_id=${member.id}`, 200, undefined, (d) => {
      assert.equal(d.summary.matches_played, 1); assert.equal(d.summary.training_attended, 1); assert.equal(d.summary.approved_entries, 1);
    });
    await op(coach, 'PATCH', `/training-sessions/${session.id}/cancel`, 200, {}, () => persisted('training_sessions', session.id, 'status', 'cancelled'));
    await op(admin, 'DELETE', `/club-coaches/${assignment.id}`, 204, undefined, async () => {
      persisted('club_coaches', assignment.id, 'active_flag', null);
      assert.equal((await coach.request(`/training-sessions/${session.id}`, { method: 'PATCH', body: { notes: 'Denied' } })).status, 403);
    });
    await op(admin, 'DELETE', `/facilities/${facility.id}`, 204, undefined, () => persisted('facilities', facility.id, 'is_active', 0));
    await op(admin, 'DELETE', `/equipment/${equipment.id}`, 204, undefined, () => persisted('equipment', equipment.id, 'is_active', 0));
    const archivedClub = await expect(admin, '/clubs', 'POST', { name: 'Operations Archived Club', sport_id: sports.Badminton }, 201);
    await op(admin, 'PATCH', `/clubs/${archivedClub.id}/archive`, 200, {}, () => persisted('clubs', archivedClub.id, 'is_archived', 1));
    await op(admin, 'DELETE', `/clubs/${club.id}`, 200, undefined, async () => {
      persisted('clubs', club.id, 'is_archived', 1);
      assert.equal((await member.request(`/clubs/${club.id}`)).status, 404);
      persisted('memberships', membership.id, 'status', 'approved');
      persisted('training_attendance', attendance.id, 'participant_id', member.id);
    });
    await op(member, 'POST', '/auth/logout', 200, {}, async () => {
      assert.equal((await member.session()).data.user, null); assert.equal((await member.request('/users/me')).status, 401);
    });
  } finally {
    const operations = expected.map((operation) => observations.get(operation) ?? { operation, result: 'NOT TESTED', details: 'Execution stopped before this operation.' });
    writeFileSync(resolve(evidencePath, 'results.json'), JSON.stringify({ total: 83, operations }, null, 2) + '\n');
    const rows = operations.map((r) => `| ${r.operation} | ${r.expected_status ?? '-'} | ${r.actual_status ?? '-'} | ${r.result} | ${(r.details ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')} |`);
    writeFileSync(resolve(evidencePath, 'results.md'), '| Operation | Expected | Actual | Result | Details |\n| --- | --- | --- | --- | --- |\n' + rows.join('\n') + '\n');
    console.log(`83-operation evidence: ${evidencePath}`);
  }
  assert.equal(observations.size, 83, 'Every checklist operation must be executed.');
}
