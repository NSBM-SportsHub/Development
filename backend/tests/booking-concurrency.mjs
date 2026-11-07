import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

// PHP's Windows development server handles one request at a time. Two distinct
// server processes and separate user sessions are required to exercise DB locks.
export async function testBookingConcurrency({ check, Client, admin, newStudent, sports, php, root, env }) {
  const workers = [];
  async function worker() {
    const listener = createServer();
    await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    const child = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', 'backend/public', 'backend/router.php'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    workers.push(child);
    let log = '';
    child.stderr.on('data', (data) => { log = (log + data).slice(-3000); });
    const baseUrl = `http://127.0.0.1:${port}/api`;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(`${baseUrl}/health`)).ok) return baseUrl; } catch { /* starting */ }
      if (child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error(`Concurrent test worker failed: ${log}`);
  }
  try {
    const bases = await Promise.all([worker(), worker()]);
    const students = await Promise.all([newStudent('concurrent-first'), newStudent('concurrent-second')]);
    const clients = students.map((student, index) => {
      const client = new Client(bases[index]);
      client.cookie = student.cookie; client.csrf = student.csrf;
      return client;
    });
    const facility = await admin.request('/facilities', { method: 'POST', body: { name: 'Concurrent verification court', capacity: 10 } });
    const equipment = await admin.request('/equipment', { method: 'POST', body: { name: 'Concurrent verification rackets', total_quantity: 3 } });
    assert.equal(facility.status, 201); assert.equal(equipment.status, 201);
    const slot = { starts_at: '2034-05-10T10:00:00Z', ends_at: '2034-05-10T11:00:00Z' };
    const facilityBody = { resource_type: 'facility', resource_id: facility.data.id, ...slot };
    await check('Separate PHP processes prevent simultaneous overlapping facility reservations', async () => {
      const results = await Promise.all(clients.map((client) => client.request('/bookings', { method: 'POST', body: facilityBody })));
      assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
      const saved = (await admin.request('/bookings')).data.filter((row) => Number(row.facility_id) === Number(facility.data.id));
      assert.equal(saved.length, 1);
      await admin.request(`/bookings/${saved[0].id}`, { method: 'DELETE' });
    });
    await check('Separate PHP processes enforce equipment stock across simultaneous requests', async () => {
      const body = { resource_type: 'equipment', resource_id: equipment.data.id, quantity: 2, ...slot };
      const results = await Promise.all(clients.map((client) => client.request('/bookings', { method: 'POST', body })));
      assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
      const remaining = await clients[0].request('/bookings', { method: 'POST', body: { ...body, quantity: 1 } });
      assert.equal(remaining.status, 201);
      assert.equal((await clients[1].request('/bookings', { method: 'POST', body: { ...body, quantity: 1 } })).status, 409);
    });
    await check('Simultaneous pending-booking edits cannot move two requests into the same facility slot', async () => {
      const bookings = [];
      for (const [index, client] of clients.entries()) {
        const response = await client.request('/bookings', { method: 'POST', body: { ...facilityBody, starts_at: `2034-05-${11 + index}T10:00:00Z`, ends_at: `2034-05-${11 + index}T11:00:00Z` } });
        assert.equal(response.status, 201); bookings.push(response.data);
      }
      const results = await Promise.all(clients.map((client, index) => client.request(`/bookings/${bookings[index].id}`, { method: 'PATCH', body: slot })));
      assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    });
    await check('Concurrent attendance and session moves cannot transfer records into another club', async () => {
      const first = await admin.request('/clubs', { method: 'POST', body: { name: 'Concurrent Training Source', sport_id: sports.Badminton, status: 'recruiting' } });
      const second = await admin.request('/clubs', { method: 'POST', body: { name: 'Concurrent Training Target', sport_id: sports.Badminton, status: 'recruiting' } });
      assert.equal(first.status, 201); assert.equal(second.status, 201);
      assert.equal((await admin.request('/club-coaches', { method: 'POST', body: { club_id: first.data.id, user_id: students[1].id } })).status, 201);
      const membership = await clients[0].request('/memberships', { method: 'POST', body: { club_id: first.data.id } });
      assert.equal(membership.status, 201);
      assert.equal((await admin.request(`/memberships/${membership.data.id}`, { method: 'PATCH', body: { status: 'approved' } })).status, 200);
      const created = await admin.request('/training-sessions', { method: 'POST', body: { club_id: first.data.id, title: 'Concurrent practice', session_date: '2034-05-15', start_time: '15:00', end_time: '16:00' } });
      assert.equal(created.status, 201);
      const administrator = new Client(bases[0]); administrator.cookie = admin.cookie; administrator.csrf = admin.csrf;
      const [move, attendance] = await Promise.all([
        administrator.request(`/training-sessions/${created.data.id}`, { method: 'PATCH', body: { club_id: second.data.id } }),
        clients[1].request('/attendance', { method: 'POST', body: { session_id: created.data.id, participant_id: students[0].id, status: 'present' } }),
      ]);
      assert.ok((move.status === 200 && attendance.status === 403) || (move.status === 409 && attendance.status === 201), JSON.stringify({ move: move.status, attendance: attendance.status }));
      const saved = (await admin.request(`/training-sessions/${created.data.id}`)).data;
      const records = (await admin.request(`/attendance?session_id=${created.data.id}`)).data;
      if (attendance.status === 201) { assert.equal(Number(saved.club_id), first.data.id); assert.equal(records.length, 1); }
      else { assert.equal(Number(saved.club_id), second.data.id); assert.equal(records.length, 0); }
    });
  } finally {
    await Promise.all(workers.map(async (child) => {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await exited;
      }
    }));
  }
}
