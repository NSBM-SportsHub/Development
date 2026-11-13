import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceAntBehavior } from './ant-behavior.js';

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function simulate(seed, bounds = { minimum: 4, maximum: 1600 }, seconds = 30) {
  const random = seeded(seed), ant = { x: 10, direction: 1 }, samples = [];
  for (let frame = 0; frame < seconds * 60; frame++) {
    advanceAntBehavior(ant, bounds, 1 / 60, random);
    samples.push({ ...ant });
  }
  return samples;
}

test('Ant changes pace, truly stops to inspect, and chooses different timings each visit', () => {
  const first = simulate(42), second = simulate(123);
  assert.ok(first.some((ant) => ant.speed > 75), 'No fast walking');
  assert.ok(first.some((ant) => ant.speed > 20 && ant.speed < 55), 'No slow walking');
  const still = first.filter((ant) => ant.speed === 0 && ant.mode === 'inspect');
  assert.ok(still.length > 20, 'No meaningful inspection pause');
  assert.ok(new Set(still.map((ant) => ant.x)).size < still.length / 2, 'Ant keeps sliding while paused');
  assert.notDeepEqual(first.map((ant) => ant.mode), second.map((ant) => ant.mode));
  const restStart = first.findIndex((ant) => ant.speed === 0 && ant.mode === 'inspect');
  assert.equal(first[restStart + 5].stride, first[restStart].stride, 'Legs keep cycling while stopped');
  assert.ok(first[restStart + 5].time > first[restStart].time, 'Idle antenna clock stopped');
});

test('Walking accelerates smoothly and steps match actual distance travelled', () => {
  const samples = simulate(77);
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1], current = samples[i];
    assert.ok(Math.abs(current.speed - previous.speed) <= 100 / 60 + .001);
    const expectedStride = Math.abs(current.x - previous.x) / 24.2 * Math.PI * 2;
    const stride = (current.stride - previous.stride + Math.PI * 2) % (Math.PI * 2);
    assert.ok(Math.abs(stride - expectedStride) < 1e-8);
  }
});

test('Ant stays inside a phone arena, turns at edges, and slows when pushing', () => {
  const mobile = simulate(9, { minimum: 4, maximum: 226 }, 60);
  assert.ok(mobile.every((ant) => ant.x >= 4 && ant.x <= 226));
  assert.ok(mobile.some((ant) => ant.direction === -1));
  for (let i = 1; i < mobile.length; i++) assert.ok(Math.abs(mobile[i].speed - mobile[i - 1].speed) <= 100 / 60 + .001, 'Ant stops abruptly at the arena edge');
  const walking = simulate(42), pushing = simulate(42, { minimum: 4, maximum: 1600, touchingBall: true });
  assert.ok(Math.max(...pushing.map((ant) => ant.speed)) < Math.max(...walking.map((ant) => ant.speed)));
  for (const ant of pushing.filter((ant) => ant.speed === 0)) assert.equal(ant.pushing, false);
  assert.ok(mobile.every((ant) => Number.isFinite(ant.stride)));
});
