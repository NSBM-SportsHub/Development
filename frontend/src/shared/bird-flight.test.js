import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceBirdFlight, containBird, createBirdFlight } from './bird-flight.js';
import { buttonBirdPerch, PARROT_FEET } from './bird-perch.js';
import { advancePerchedBehavior } from './bird-perched.js';

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

test('Idle parrot grips visible button edges, takes off during scrolling and lands again', () => {
  for (const size of [{ width: 1440, height: 1000, size: 116 }, { width: 390, height: 844, size: 90 }, { width: 844, height: 390, size: 116 }]) {
    for (const side of ['left', 'right']) {
      const left = side === 'left' ? 45 : size.width - 175;
      const box = { left, right: left + 130, top: size.height * .65, bottom: size.height * .65 + 44, width: 130, height: 44 };
      const viewport = { ...size, perchDelay: 0, perch: buttonBirdPerch(box, size) };
      assert.ok(viewport.perch);
      const random = seeded(33), bird = createBirdFlight(viewport, random);
      advanceBirdFlight(bird, viewport, 1 / 60, random);
      assert.equal(bird.mode, 'landing', 'Idle landing should start without the old title delay');
      for (let frame = 0; frame < 20 * 60; frame++) advanceBirdFlight(bird, viewport, 1 / 60, random);
      assert.equal(bird.mode, 'perched');
      assert.equal(bird.x, viewport.perch.x); assert.equal(bird.y, viewport.perch.y);
      assert.equal(bird.facingRight, side === 'left', 'Resting parrot should face along the button');
      assert.ok(bird.perchBlend > .99);
      assert.ok(bird.x >= 0 && bird.x + size.size <= size.width);
      assert.ok(bird.y + size.size <= size.height);
      assert.ok(Math.abs(bird.y + size.size * (PARROT_FEET.y + 20) / 290 - box.top) < .001, 'Feet must touch the actual button top');
      assert.ok(viewport.perch.anchorX > box.left && viewport.perch.anchorX < box.right);

      delete viewport.perch;
      for (let frame = 0; frame < 2 * 60; frame++) advanceBirdFlight(bird, viewport, 1 / 60, random);
      assert.equal(bird.mode, 'flying'); assert.ok(bird.perchBlend < .01);
      viewport.perch = buttonBirdPerch(box, size);
      for (let frame = 0; frame < 20 * 60; frame++) advanceBirdFlight(bird, viewport, 1 / 60, random);
      assert.equal(bird.mode, 'perched');

      // Scrolling must also interrupt an unfinished landing.
      bird.mode = 'landing'; delete viewport.perch;
      advanceBirdFlight(bird, viewport, 1 / 60, random);
      assert.equal(bird.mode, 'flying');
    }
  }
});

test('Buttons with no safe visible perch are rejected', () => {
  const view = { width: 390, height: 844, size: 90 };
  const button = { left: 100, right: 230, top: 400, bottom: 444, width: 130, height: 44 };
  assert.equal(buttonBirdPerch({ ...button, width: 0 }, view), null);
  assert.equal(buttonBirdPerch({ ...button, left: -10 }, view), null);
  assert.equal(buttonBirdPerch({ ...button, right: 400 }, view), null);
  assert.equal(buttonBirdPerch({ ...button, top: 30, bottom: 74 }, view), null);
  assert.equal(buttonBirdPerch({ ...button, top: 830, bottom: 874 }, view), null);
});

test('Full-width phone buttons leave room for the whole parrot', () => {
  const view = { width: 390, height: 844, size: 90 };
  const button = { left: 25, right: 365, top: 490, bottom: 536, width: 340, height: 46 };
  const perch = buttonBirdPerch(button, view);
  assert.ok(perch);
  assert.ok(perch.x >= 4 && perch.x + view.size <= view.width - 4);
  assert.ok(perch.anchorX > button.left + 20 && perch.anchorX < button.right - 20);
});

test('Perched parrot varies its gestures, blinks and rests while staying anchored to the button', () => {
  const viewport = { width: 1440, height: 1000, size: 116, perchDelay: 0, perch: { x: 600, y: 300 } };
  const random = seeded(19), bird = createBirdFlight(viewport, random);
  bird.mode = 'perched';
  const actions = new Set(), peaks = {}, started = [];
  let previousAction = 'rest', restFrames = 0;
  for (let frame = 0; frame < 120 * 60; frame++) {
    advanceBirdFlight(bird, viewport, 1 / 60, random);
    const motion = bird.perchedMotion;
    actions.add(motion.action);
    if (motion.action === 'rest') restFrames++;
    else if (motion.action !== previousAction) started.push(motion.action);
    previousAction = motion.action;
    for (const [key, value] of Object.entries(motion.pose)) {
      assert.ok(Number.isFinite(value), `Invalid ${key}`);
      peaks[key] = Math.max(peaks[key] ?? 0, Math.abs(value));
    }
    assert.equal(bird.x, viewport.perch.x); assert.equal(bird.y, viewport.perch.y);
    assert.ok(motion.pose.leftGrip < .001 || motion.pose.rightGrip < .001, 'One foot must keep gripping the button');
  }
  assert.deepEqual([...actions].sort(), ['grip', 'look', 'peck', 'rest', 'ruffle']);
  assert.ok(restFrames > 120 * 60 / 2, 'Parrot should spend most of its time quietly resting');
  for (let i = 1; i < started.length; i++) assert.notEqual(started[i], started[i - 1]);
  assert.ok(peaks.peck > .9 && peaks.blink > .9 && peaks.look > 6);
  assert.ok(peaks.leftGrip > .5 && peaks.rightGrip > .5 && peaks.ruffle > .5);
});

test('Perched gestures freeze with zero time and ease out when scrolling interrupts a peck', () => {
  const random = seeded(18), bird = { mode: 'perched' };
  for (let frame = 0; frame < 60 * 60; frame++) {
    advancePerchedBehavior(bird, 1 / 60, random);
    if (bird.perchedMotion.pose.peck > .8) break;
  }
  assert.ok(bird.perchedMotion.pose.peck > .8);
  const frozen = structuredClone(bird);
  advancePerchedBehavior(bird, 0, random); assert.deepEqual(bird, frozen);
  bird.mode = 'flying'; advancePerchedBehavior(bird, 1 / 60, random);
  assert.ok(bird.perchedMotion.pose.peck > .5, 'Takeoff must not snap the head upright');
  for (let frame = 0; frame < 90; frame++) advancePerchedBehavior(bird, 1 / 60, random);
  for (const value of Object.values(bird.perchedMotion.pose)) assert.ok(Math.abs(value) < .001);
  bird.mode = 'landing'; advancePerchedBehavior(bird, 1 / 60, random);
  assert.equal(bird.perchedMotion.active, false);
  bird.mode = 'perched'; advancePerchedBehavior(bird, 1 / 60, random);
  assert.equal(bird.perchedMotion.action, 'rest');
  assert.ok(bird.perchedMotion.time < .02, 'A new landing starts with a quiet settling period');
});
