const between = (min, max, random) => min + (max - min) * random();
const neutral = () => ({ look: 0, peck: 0, leftGrip: 0, rightGrip: 0, ruffle: 0, blink: 0, breath: 0, tail: 0 });
const durations = { look: [1.7, 2.8], peck: [1.5, 1.9], grip: [1.1, 1.7], ruffle: [.7, 1.1] };
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const pulse = (time, start, peak, hold, end) => time < start || time > end ? 0
  : time < peak ? smooth((time - start) / (peak - start)) : 1 - smooth((time - hold) / (end - hold));

export function advancePerchedBehavior(bird, dt, random = Math.random) {
  if (dt <= 0) return;
  const perched = bird.mode === 'perched';
  let motion = bird.perchedMotion;
  if (perched && !motion?.active) {
    motion = bird.perchedMotion = {
      active: true, time: 0, action: 'rest', lastAction: null, startedAt: 0, duration: 0,
      nextAction: between(1.1, 1.9, random), nextBlink: between(.6, 2, random), blinkAt: null,
      lookAngle: 0, foot: 'leftGrip', pose: motion?.pose ?? neutral(),
    };
  }
  if (!motion) return;
  const target = neutral();
  if (perched) {
    motion.time += dt;
    if (motion.action !== 'rest' && motion.time >= motion.startedAt + motion.duration) {
      motion.lastAction = motion.action; motion.action = 'rest';
      motion.nextAction = motion.time + between(2.2, 4.8, random);
    }
    if (motion.action === 'rest' && motion.time >= motion.nextAction) {
      const choices = Object.keys(durations).filter(action => action !== motion.lastAction);
      motion.action = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
      motion.startedAt = motion.time;
      motion.duration = between(...durations[motion.action], random);
      motion.lookAngle = between(7, 14, random) * (random() < .5 ? -1 : 1);
      motion.foot = random() < .5 ? 'leftGrip' : 'rightGrip';
    }
    if (motion.time >= motion.nextBlink) {
      motion.blinkAt = motion.time;
      motion.nextBlink = motion.time + between(2.4, 5.6, random);
    }
    const progress = (motion.time - motion.startedAt) / Math.max(.1, motion.duration);
    if (motion.action === 'look') target.look = motion.lookAngle * pulse(progress, 0, .2, .65, 1);
    if (motion.action === 'peck') target.peck = Math.max(pulse(progress, .04, .24, .36, .54), .85 * pulse(progress, .56, .72, .8, 1));
    if (motion.action === 'grip') target[motion.foot] = Math.sin(progress * Math.PI * 3) ** 2 * pulse(progress, 0, .15, .8, 1);
    if (motion.action === 'ruffle') target.ruffle = Math.sin(progress * Math.PI * 4) * Math.sin(progress * Math.PI);
    target.blink = motion.blinkAt === null ? 0 : pulse(motion.time - motion.blinkAt, 0, .065, .11, .22);
    target.breath = Math.sin(motion.time * 2.1) * .65;
    target.tail = Math.sin(motion.time * 1.35) * 1.8 + target.ruffle * 3;
  } else {
    motion.active = false; motion.action = 'rest';
  }
  // Return smoothly to flight if scrolling interrupts a grip or peck.
  for (const key of Object.keys(target)) {
    const rate = perched ? (key === 'blink' ? 45 : 24) : 12;
    motion.pose[key] += (target[key] - motion.pose[key]) * (1 - Math.exp(-rate * dt));
  }
}
