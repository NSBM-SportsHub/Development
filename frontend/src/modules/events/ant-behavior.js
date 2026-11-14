const TAU = Math.PI * 2;
const STRIDE_DISTANCE = 24.2;
const ACCELERATION = 100;
const ranges = {
  walk: { speed: [32, 62], duration: [1.2, 2.8] },
  scurry: { speed: [82, 116], duration: [.5, 1.25] },
  pause: { speed: [0, 0], duration: [.45, 1.1] },
  inspect: { speed: [0, 0], duration: [.9, 1.9] },
};

function choose(ant, mode, random) {
  const sample = ([minimum, maximum]) => minimum + (maximum - minimum) * random();
  ant.mode = mode;
  ant.targetSpeed = sample(ranges[mode].speed);
  ant.remaining = sample(ranges[mode].duration);
  ant.turnAfterRest = mode === 'inspect' && random() < .3;
}

// Advance only with simulated time. Pausing or hiding the arena suspends this clock.
export function advanceAntBehavior(ant, { minimum, maximum, touchingBall = false }, dt, random = Math.random) {
  ant.time = (ant.time ?? 0) + dt;
  ant.speed ??= 0;
  ant.stride ??= 0;
  ant.restBlend ??= 0;
  if (!ant.mode) choose(ant, 'walk', random);
  const resting = ant.mode === 'pause' || ant.mode === 'inspect';
  // A rest begins after deceleration, so short pauses still contain a real stop.
  if (!resting || ant.speed < .1) ant.remaining -= dt;
  if (ant.remaining <= 0) {
    if (resting && ant.turnAfterRest) ant.direction *= -1;
    const next = ant.mode === 'walk' ? (random() < .65 ? 'scurry' : 'inspect')
      : ant.mode === 'scurry' ? (random() < .5 ? 'pause' : 'inspect')
        : random() < .8 ? 'walk' : 'scurry';
    choose(ant, next, random);
  }
  const distanceToWall = Math.max(0, ant.direction > 0 ? maximum - ant.x : ant.x - minimum);
  const pace = ant.targetSpeed * (1 + Math.sin(ant.time * 2.1) * .045);
  const target = Math.min(touchingBall ? pace * .58 : pace, Math.sqrt(2 * ACCELERATION * distanceToWall));
  ant.speed += Math.max(-ACCELERATION * dt, Math.min(ACCELERATION * dt, target - ant.speed));
  const previousX = ant.x;
  ant.x = Math.max(minimum, Math.min(maximum, ant.x + ant.direction * ant.speed * dt));
  // Footfall cadence follows distance travelled, including acceleration and pushing.
  ant.stride = (ant.stride + Math.abs(ant.x - previousX) / STRIDE_DISTANCE * TAU) % TAU;
  const settled = ant.speed < 2 ? 1 : 0;
  ant.restBlend += (settled - ant.restBlend) * Math.min(1, dt * 9);
  ant.pushing = touchingBall && ant.speed > 1;
  if (distanceToWall < .3 && ant.speed === 0 && !resting) {
    ant.direction *= -1;
    choose(ant, 'inspect', random);
    ant.turnAfterRest = false;
    ant.pushing = false;
  }
  ant.headAngle ??= 0;
  ant.headTarget ??= 0;
  ant.nextHeadLook ??= ant.time + .25 + random() * .4;
  if (ant.time >= ant.nextHeadLook) {
    const inspecting = ant.mode === 'inspect';
    const range = ant.pushing ? 3 : inspecting ? 20 : ant.mode === 'pause' ? 12 : 8;
    ant.headTarget = (random() - .5) * range - (ant.pushing ? 1 : 0);
    ant.nextHeadLook = ant.time + (inspecting ? .18 + random() * .55 : .4 + random() * .9);
  }
  // Quick attention shifts ease through the neck instead of snapping or bobbing the whole ant.
  ant.headAngle += (ant.headTarget - ant.headAngle) * (1 - Math.exp(-12 * dt));
  return ant;
}
