import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceBirdFlight, containBird, createBirdFlight } from './bird-flight.js';

function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

test('Parrot curves across the screen, changes pace and alternates flapping with gliding', () => {
  const viewport = { width: 1440, height: 1000, size: 116 }, random = seeded(42), bird = createBirdFlight(viewport, random);
  const phases = new Set(), speeds = [], positions = [];
  for (let frame = 0; frame < 45 * 60; frame++) {
    const before = { x: bird.x, y: bird.y };
    advanceBirdFlight(bird, viewport, 1 / 60, random);
    assert.ok(Math.hypot(bird.x - before.x, bird.y - before.y) < 2.6, 'Sudden flight jump');
    phases.add(bird.gliding); speeds.push(Math.hypot(bird.vx, bird.vy)); positions.push({ x: bird.x, y: bird.y });
  }
  assert.equal(phases.size, 2);
  assert.ok(Math.max(...speeds) - Math.min(...speeds) > 20);
  assert.ok(Math.max(...speeds) > 100, 'Flight did not speed up');
  assert.ok(Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x)) > 300);
  assert.ok(Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y)) > 200);
});

test('Banking wings stay within desktop, phone and landscape viewports', () => {
  for (const viewport of [{ width: 1440, height: 1000, size: 116 }, { width: 390, height: 844, size: 90 }, { width: 844, height: 390, size: 116 }]) {
    const random = seeded(9), bird = createBirdFlight(viewport, random);
    for (let frame = 0; frame < 90 * 60; frame++) {
      advanceBirdFlight(bird, viewport, 1 / 60, random);
      const angle = bird.bank * Math.PI / 180, radius = viewport.size / 2 * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));
      assert.ok(bird.x + viewport.size / 2 - radius >= 0 && bird.x + viewport.size / 2 + radius <= viewport.width);
      assert.ok(bird.y + viewport.size / 2 - radius >= 0 && bird.y + viewport.size / 2 + radius <= viewport.height);
      assert.ok(Number.isFinite(bird.phase) && Number.isFinite(bird.bank));
    }
  }
});

test('Zero elapsed time freezes flight; resizing and a late frame cannot throw the bird off screen', () => {
  const viewport = { width: 1440, height: 1000, size: 116 }, bird = createBirdFlight(viewport, seeded(4));
  const frozen = { ...bird }; advanceBirdFlight(bird, viewport, 0); assert.deepEqual(bird, frozen);
  const mobile = { width: 320, height: 568, size: 90 }; containBird(bird, mobile);
  assert.ok(bird.x >= 0 && bird.x + mobile.size <= mobile.width && bird.y + mobile.size <= mobile.height);
  const before = { x: bird.x, y: bird.y }; advanceBirdFlight(bird, mobile, 60, seeded(4));
  assert.ok(Math.hypot(bird.x - before.x, bird.y - before.y) < 8.5);
});

test('Parrot lands on the title, stays perched, follows layout changes and takes off without a title', () => {
  const viewport = { width: 1440, height: 1000, size: 116, perch: { x: 420, y: 160 } }, random = seeded(21), bird = createBirdFlight(viewport, random);
  const states = new Set();
  for (let frame = 0; frame < 25 * 60; frame++) { advanceBirdFlight(bird, viewport, 1 / 60, random); states.add(bird.mode); }
  assert.deepEqual([...states].sort(), ['flying', 'landing', 'perched']);
  assert.equal(bird.x, viewport.perch.x); assert.equal(bird.y, viewport.perch.y);
  assert.ok(bird.perchBlend > .99); assert.equal(bird.vx, 0); assert.equal(bird.vy, 0);
  for (let frame = 0; frame < 10 * 60; frame++) advanceBirdFlight(bird, viewport, 1 / 60, random);
  assert.equal(bird.mode, 'perched'); assert.equal(bird.x, viewport.perch.x);
  viewport.perch.y += 20; advanceBirdFlight(bird, viewport, 1 / 60, random); assert.equal(bird.y, viewport.perch.y);
  delete viewport.perch; const before = { x: bird.x, y: bird.y };
  for (let frame = 0; frame < 120; frame++) advanceBirdFlight(bird, viewport, 1 / 60, random);
  assert.equal(bird.mode, 'flying'); assert.ok(Math.hypot(bird.x - before.x, bird.y - before.y) > 30);
  assert.ok(bird.perchBlend < .01);
});

test('Bird can grip the end of a phone title while keeping its tail facing away from the letters', () => {
  const viewport = { width: 320, height: 568, size: 90, perch: { x: 220, y: 100 } }, random = seeded(12), bird = createBirdFlight(viewport, random);
  for (let frame = 0; frame < 30 * 60; frame++) advanceBirdFlight(bird, viewport, 1 / 60, random);
  assert.equal(bird.mode, 'perched'); assert.equal(bird.x, 220); assert.equal(bird.y, 100);
  assert.equal(bird.facingRight, false); assert.equal(bird.bank, 0);
  assert.ok(bird.x + viewport.size <= viewport.width && bird.perchBlend > .99);
});
