import assert from 'node:assert/strict';

// Run through real login sessions and the same PHP router as the authentication suite.
export async function testResourcesAndBookings({ check, Client, admin, student, cli }) {
  const other = new Client();
  const studentId = (await student.session()).data.user.id;
  let facilityId;
  let equipmentId;
  let bookingId;
  let equipmentBookingId;
  const slot = { starts_at: '2030-10-29T09:00:00Z', ends_at: '2030-10-29T10:00:00Z' };

  await check('Resource and booking APIs require the existing authenticated session', async () => {
    for (const path of ['/facilities', '/equipment', '/bookings']) {
      assert.equal((await other.request(path)).status, 401);
      assert.equal((await student.request(path)).status, 200);
    }
    assert.equal((await student.request('/facilities', { method: 'POST', body: { name: 'Forbidden' } })).status, 403);
    assert.equal((await student.request('/equipment', { method: 'POST', body: { name: 'Forbidden', total_quantity: 1 } })).status, 403);
  });

  await check('Resource writes enforce CSRF, JSON objects and resource-specific fields', async () => {
    assert.equal((await admin.request('/facilities', { method: 'POST', token: false, body: { name: 'Forbidden' } })).status, 403);
    assert.equal((await admin.request('/facilities', { method: 'POST', raw: '{' })).status, 400);
    assert.equal((await admin.request('/facilities', { method: 'POST', body: {} })).status, 422);
    assert.equal((await admin.request('/facilities', { method: 'POST', body: [] })).status, 400);
    assert.equal((await admin.request('/equipment', { method: 'POST', body: { name: 'Missing stock' } })).status, 422);
    assert.equal((await admin.request('/facilities', { method: 'POST', body: { name: 'Wrong type', total_quantity: 2 } })).status, 422);
    assert.equal((await admin.request('/facilities', { method: 'POST', body: { name: 'x'.repeat(20_000) } })).status, 413);
  });

  await check('Admin resource CRUD persists through separate reads and repeatable setup', async () => {
    const facility = await admin.request('/facilities', {
      method: 'POST', body: { name: 'Integration court', location: 'Sports hall', capacity: 20 },
    });
    assert.equal(facility.status, 201);
    facilityId = facility.data.id;
    const equipment = await admin.request('/equipment', { method: 'POST', body: { name: 'Integration balls', total_quantity: 4 } });
    assert.equal(equipment.status, 201);
    equipmentId = equipment.data.id;
    assert.equal((await admin.request(`/facilities/${facilityId}`, { method: 'PUT', body: { name: 'Updated court' } })).status, 200);
    assert.equal((await admin.request(`/equipment/${equipmentId}`, { method: 'PATCH', body: { capacity: 1 } })).status, 422);
    cli('backend/bin/setup.php');
    assert.equal((await student.request(`/facilities/${facilityId}`)).data.name, 'Updated court');
    assert.equal((await student.request(`/equipment/${equipmentId}`)).data.total_quantity, 4);
  });

  await check('Student booking creates a pending record linked to the real login identity', async () => {
    const body = { resource_type: 'facility', resource_id: facilityId, ...slot };
    assert.equal((await student.request('/bookings', { method: 'POST', token: false, body })).status, 403);
    assert.equal((await student.request('/bookings', { method: 'POST', body: { ...body, requested_by: 999 } })).status, 422);
    const result = await student.request('/bookings', { method: 'POST', body });
    assert.equal(result.status, 201);
    bookingId = result.data.id;
    assert.equal(result.data.requested_by, studentId);
    assert.equal(result.data.status, 'pending');
    assert.equal((await student.request(`/bookings/${bookingId}`)).data.resource_name, 'Updated court');
  });

  await check('Bookings enforce ownership, Admin review and facility time conflicts', async () => {
    await other.session();
    assert.equal((await other.request('/auth/register', {
      method: 'POST', body: { name: 'Other booker', email: `booker-${Date.now()}@example.test`, password: 'OtherBooker!23456789' },
    })).status, 201);
    assert.equal((await other.request('/bookings')).data.length, 0);
    assert.equal((await other.request(`/bookings/${bookingId}`)).status, 404);
    assert.equal((await other.request(`/bookings/${bookingId}`, { method: 'PATCH', body: { notes: 'Forbidden' } })).status, 404);
    assert.equal((await other.request(`/bookings/${bookingId}`, { method: 'DELETE' })).status, 404);
    assert.equal((await student.request(`/bookings/${bookingId}`, { method: 'PATCH', body: { status: 'approved' } })).status, 422);
    assert.equal((await other.request('/bookings', {
      method: 'POST', body: { resource_type: 'facility', resource_id: facilityId, ...slot },
    })).status, 409);
    assert.equal((await student.request(`/bookings/${bookingId}`, { method: 'PATCH', body: { notes: 'Updated by owner' } })).status, 200);
    assert.equal((await admin.request(`/bookings/${bookingId}`, { method: 'PATCH', body: { status: 'approved' } })).status, 200);
    assert.equal((await student.request(`/bookings/${bookingId}`)).data.status, 'approved');
    assert.equal((await student.request(`/bookings/${bookingId}`, { method: 'DELETE' })).status, 404);
    assert.ok((await admin.request('/bookings')).data.some((entry) => entry.id === bookingId));
  });

  await check('Equipment capacity and reductions respect active reservations', async () => {
    const body = { resource_type: 'equipment', resource_id: equipmentId, quantity: 3, ...slot };
    const result = await student.request('/bookings', { method: 'POST', body });
    assert.equal(result.status, 201);
    equipmentBookingId = result.data.id;
    assert.equal((await other.request('/bookings', { method: 'POST', body: { ...body, quantity: 2 } })).status, 409);
    assert.equal((await admin.request(`/equipment/${equipmentId}`, { method: 'PATCH', body: { total_quantity: 2 } })).status, 409);
    assert.equal((await student.request(`/bookings/${equipmentBookingId}`, { method: 'PUT', body: { quantity: 2 } })).status, 200);
    assert.equal((await admin.request(`/equipment/${equipmentId}`, { method: 'PATCH', body: { total_quantity: 2 } })).status, 200);
    assert.equal((await student.request(`/bookings/${equipmentBookingId}`, { method: 'DELETE' })).status, 204);
    assert.equal((await student.request(`/bookings/${equipmentBookingId}`)).data.status, 'cancelled');
  });

  await check('Cancellation frees capacity and adjacent facility bookings are permitted', async () => {
    const adjacent = await other.request('/bookings', {
      method: 'POST', body: { resource_type: 'facility', resource_id: facilityId, starts_at: slot.ends_at, ends_at: '2030-10-29T11:00:00Z' },
    });
    assert.equal(adjacent.status, 201);
    assert.equal((await other.request(`/bookings/${adjacent.data.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await admin.request(`/bookings/${bookingId}`, { method: 'DELETE', token: false })).status, 403);
    assert.equal((await admin.request(`/bookings/${bookingId}`, { method: 'DELETE' })).status, 204);
    assert.equal((await other.request('/bookings', {
      method: 'POST', body: { resource_type: 'facility', resource_id: facilityId, ...slot },
    })).status, 201);
  });

  await check('Resource archival preserves history and hides archived records from Students', async () => {
    assert.equal((await student.request(`/facilities/${facilityId}`, { method: 'PATCH', body: { name: 'Forbidden' } })).status, 403);
    assert.equal((await admin.request(`/facilities/${facilityId}`, { method: 'DELETE' })).status, 204);
    assert.equal((await admin.request(`/equipment/${equipmentId}`, { method: 'DELETE' })).status, 204);
    assert.equal((await student.request(`/facilities/${facilityId}`)).status, 404);
    assert.equal((await student.request(`/equipment/${equipmentId}`)).status, 404);
    assert.equal((await admin.request(`/facilities/${facilityId}`)).data.is_active, 0);
    assert.equal((await student.request(`/bookings/${bookingId}`)).data.status, 'cancelled');
    assert.equal((await student.request('/bookings', {
      method: 'POST', body: { resource_type: 'facility', resource_id: facilityId, ...slot },
    })).status, 404);
    cli('backend/bin/setup.php');
    assert.equal((await admin.request(`/facilities/${facilityId}`)).data.is_active, 0);
  });

  await check('Deactivated accounts lose resource and booking access with their existing cookie', async () => {
    const otherId = (await other.session()).data.user.id;
    assert.equal((await admin.request(`/users/${otherId}`, { method: 'PATCH', body: { status: 'inactive' } })).status, 200);
    assert.equal((await other.request('/facilities')).status, 401);
    assert.equal((await other.request('/bookings')).status, 401);
  });

  await check('Resource routes return safe 404/405 errors for invalid identifiers and methods', async () => {
    assert.equal((await admin.request('/facilities/0')).status, 404);
    assert.equal((await admin.request('/facilities/9999999999999999999')).status, 404);
    assert.equal((await admin.request('/bookings/999999999')).status, 404);
    const result = await admin.request('/facilities', { method: 'DELETE' });
    assert.equal(result.status, 405);
    assert.equal(result.headers.get('allow'), 'GET, POST');
  });
}
