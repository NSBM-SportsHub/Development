import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

// PHP's Windows development server handles one request at a time. Two distinct
// server processes and separate user sessions are required to exercise DB locks.
export async function testBookingConcurrency({ check, Client, admin, newStudent, php, root, env }) {
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
  } finally {
    await Promise.all(workers.map(async (child) => {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await exited;
      }
    }));
  }
}
