import assert from 'node:assert/strict';
import test from 'node:test';
import { promotionVisibility } from './event-utils.js';

const now = Date.parse('2026-11-14T12:00:00Z');
const base = { published: true, featured: true, ends_at: '2026-11-15T05:30:00Z', tournament_status: null };

test('Published promotions that finished are explicitly identified as hidden, with Sri Lanka end times', () => {
  const result = promotionVisibility({ ...base, ends_at: '2026-11-13T05:30:00Z' }, now);
  assert.equal(result.visible, false);
  assert.match(result.label, /Finished.*hidden/);
  assert.match(result.reason, /13 Nov 2026.*11:00.*Sri Lanka time/);
  assert.equal(promotionVisibility({ ...base, ends_at: new Date(now).toISOString() }, now).visible, false);
});

test('Upcoming promotions remain visible before they start, with featured and list-only placement explained', () => {
  assert.equal(promotionVisibility({ ...base, starts_at: '2026-11-15T03:30:00Z' }, now).visible, true);
  assert.match(promotionVisibility(base, now).reason, /Highlighted.*activity list/);
  const listOnly = promotionVisibility({ ...base, featured: false }, now);
  assert.equal(listOnly.visible, true); assert.match(listOnly.reason, /activity list/);
});

test('Draft promotions and unavailable linked tournaments explain why they are not public', () => {
  assert.equal(promotionVisibility({ ...base, published: false }, now).label, 'Draft');
  for (const tournament_status of ['draft', 'cancelled', 'completed']) {
    const result = promotionVisibility({ ...base, tournament_status }, now);
    assert.equal(result.visible, false); assert.ok(result.reason.includes(tournament_status));
  }
  for (const tournament_status of ['registration_open', 'registration_closed', 'in_progress']) {
    assert.equal(promotionVisibility({ ...base, tournament_status }, now).visible, true);
  }
});
