import { advancePerchedBehavior } from './bird-perched.js';

const TAU = Math.PI * 2;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const between = (minimum, maximum, random) => minimum + (maximum - minimum) * random();

function bounds({ width, height, size }, perching = false) {
  const margin = perching ? 4 : Math.ceil(size * .21) + 8;
  return { minX: margin, maxX: Math.max(margin, width - size - margin), minY: margin, maxY: Math.max(margin, height - size - margin) };
}

export function createBirdFlight(viewport, random = Math.random) {
  const area = bounds(viewport);
  return containBird({ x: area.maxX * .78, y: area.maxY * .25, vx: -72, vy: 15, bank: 0, facingRight: false,
    targetX: area.maxX * .22, targetY: area.maxY * .6, time: 0, phase: 0, gliding: false, glideBlend: 0,
    speed: between(82, 120, random), nextGlide: between(2.5, 4.5, random), nextRoute: 5,
    mode: 'flying', perchBlend: 0, perchAvailable: false, landAt: null }, viewport);
}

export function containBird(bird, viewport) {
  const area = bounds(viewport, bird.mode === 'landing' || bird.mode === 'perched' || bird.perchBlend > .01);
  bird.x = clamp(bird.x, area.minX, area.maxX); bird.y = clamp(bird.y, area.minY, area.maxY);
  bird.targetX = clamp(bird.targetX, area.minX, area.maxX); bird.targetY = clamp(bird.targetY, area.minY, area.maxY);
  return bird;
}

export function advanceBirdFlight(bird, viewport, elapsed, random = Math.random) {
  const dt = clamp(elapsed, 0, .05);
  let area = bounds(viewport);
  if (dt === 0) return bird;
  bird.time += dt;
  const perch = viewport.perch;
  if (perch && !bird.perchAvailable) {
    bird.perchAvailable = true;
    bird.landAt = bird.time + (viewport.perchDelay ?? 6);
  } else if (!perch && bird.perchAvailable) {
    bird.perchAvailable = false; bird.landAt = null;
    bird.mode = 'flying'; bird.nextRoute = bird.time;
  }
  if (perch && bird.time >= bird.landAt && bird.mode === 'flying') bird.mode = 'landing';
  advancePerchedBehavior(bird, dt, random);
  if (bird.mode === 'perched' && perch) {
    bird.x = perch.x; bird.y = perch.y; bird.vx = 0; bird.vy = 0; bird.bank = 0; bird.facingRight = perch.facingRight ?? false;
    bird.perchBlend += (1 - bird.perchBlend) * (1 - Math.exp(-7 * dt));
    return bird;
  }
  if (bird.time >= bird.nextGlide) {
    bird.gliding = !bird.gliding;
    bird.nextGlide = bird.time + (bird.gliding ? between(.8, 1.7, random) : between(2.2, 4.6, random));
    bird.speed = bird.gliding ? between(72, 96, random) : between(86, 134, random);
  }
  const landing = bird.mode === 'landing' && perch;
  if (landing || bird.perchBlend > .01) area = bounds(viewport, true);
  let dx = (landing ? perch.x : bird.targetX) - bird.x, dy = (landing ? perch.y : bird.targetY) - bird.y, distance = Math.hypot(dx, dy);
  if (!landing && (distance < 65 || bird.time >= bird.nextRoute)) {
    for (let attempt = 0; attempt < 4; attempt++) {
      bird.targetX = between(area.minX, area.maxX, random); bird.targetY = between(area.minY, area.maxY, random);
      if (Math.hypot(bird.targetX - bird.x, bird.targetY - bird.y) > Math.min(viewport.width, viewport.height) * .28) break;
    }
    bird.nextRoute = bird.time + between(4.5, 8, random);
    dx = bird.targetX - bird.x; dy = bird.targetY - bird.y; distance = Math.max(1, Math.hypot(dx, dy));
  }
  const nx = dx / Math.max(1, distance), ny = dy / Math.max(1, distance), drift = landing ? 0 : Math.sin(bird.time * 1.35) * 11;
  const speed = landing ? Math.min(140, distance * 3) : bird.speed;
  const steer = 1 - Math.exp(-(landing ? 5 : 1.65) * dt);
  bird.vx += (nx * speed - ny * drift - bird.vx) * steer;
  bird.vy += (ny * speed + nx * drift - bird.vy) * steer;
  bird.x += bird.vx * dt; bird.y += bird.vy * dt;
  if (bird.x < area.minX || bird.x > area.maxX) { bird.vx *= -.65; bird.nextRoute = bird.time; }
  if (bird.y < area.minY || bird.y > area.maxY) { bird.vy *= -.65; bird.nextRoute = bird.time; }
  containBird(bird, viewport);
  if (landing && distance < 120) bird.facingRight = perch.facingRight ?? false;
  else if (Math.abs(bird.vx) > 8) bird.facingRight = bird.vx > 0;
  const bank = clamp(Math.atan2(bird.vy, Math.max(10, Math.abs(bird.vx))) * 180 / Math.PI * (bird.facingRight ? 1 : -1), -22, 22) * (landing ? Math.min(1, distance / 120) : 1);
  bird.bank += (bank - bird.bank) * (1 - Math.exp(-4 * dt));
  bird.glideBlend += ((bird.gliding ? 1 : 0) - bird.glideBlend) * (1 - Math.exp(-4 * dt));
  bird.phase = (bird.phase + dt * TAU * (landing ? 3.5 : 4 + bird.speed / 190)) % TAU;
  bird.perchBlend += ((landing ? clamp(1 - distance / 90, 0, .8) : 0) - bird.perchBlend) * (1 - Math.exp(-7 * dt));
  if (landing && distance < 1 && Math.hypot(bird.vx, bird.vy) < 7) {
    bird.mode = 'perched'; bird.x = perch.x; bird.y = perch.y; bird.vx = 0; bird.vy = 0; bird.bank = 0; bird.facingRight = perch.facingRight ?? false;
  }
  return bird;
}
