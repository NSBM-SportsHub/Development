import { useId, useImperativeHandle, useRef } from 'react';

// Opposite front/rear legs and the middle leg form alternating walking tripods.
const legs = [
  { side: 'far', hip: 36, foot: 10, phase: Math.PI, bend: 1 },
  { side: 'far', hip: 43, foot: 40, phase: 0, bend: 1 },
  { side: 'far', hip: 49, foot: 76, phase: Math.PI, bend: -1 },
  { side: 'near', hip: 36, foot: 15, phase: 0, bend: 1 },
  { side: 'near', hip: 43, foot: 46, phase: Math.PI, bend: -1 },
  { side: 'near', hip: 49, foot: 81, phase: 0, bend: -1 },
];

function legPose(leg, stride, bob, restBlend = 0) {
  const cycle = ((stride + leg.phase) % (Math.PI * 2)) / (Math.PI * 2);
  const stance = .62, swinging = cycle >= stance, progress = swinging ? (cycle - stance) / (1 - stance) : cycle / stance;
  // During stance the foot travels back relative to the body, staying on the ground.
  const footX = leg.foot + (swinging ? 9 - progress * 18 : -9 + progress * 18) * (1 - restBlend);
  const footY = (leg.side === 'near' ? 69 : 63) - (swinging ? Math.sin(progress * Math.PI) * 6 : 0) * (1 - restBlend);
  const hipY = (leg.side === 'near' ? 37 : 33) + bob;
  const dx = footX - leg.hip, dy = footY - hipY, distance = Math.max(.001, Math.hypot(dx, dy));
  const upper = 27, lower = 28, along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * leg.bend;
  const kneeX = leg.hip + dx / distance * along - dy / distance * bend;
  const kneeY = hipY + dy / distance * along + dx / distance * bend;
  const ankleX = footX + 1.8, ankleY = footY - 3;
  return `M${leg.hip},${hipY.toFixed(2)} L${kneeX.toFixed(2)},${kneeY.toFixed(2)} L${ankleX.toFixed(2)},${ankleY.toFixed(2)} l-1.8,3 l-2.4,.65`;
}

export default function Ant({ motionRef }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, ''), body = useRef(null), head = useRef(null), limbs = useRef([]), feelers = useRef([]);
  useImperativeHandle(motionRef, () => ({
    paint(stride, pushing = false, life = {}) {
      const resting = life.restBlend ?? 0, time = life.time ?? 0;
      const bob = Math.cos(stride * 2) * .35 * (1 - resting) + Math.sin(time * 2) * .06 * resting;
      limbs.current.forEach((limb, index) => limb?.setAttribute('d', legPose(legs[index], stride, bob, resting)));
      body.current?.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) rotate(${pushing ? -2 : Math.sin(stride) * .3 * (1 - resting)} 43 37)`);
      const twitch = (Math.sin(time * 11.7) * .45 + Math.sin(time * 6.3) * .3) * (life.mode === 'inspect' ? 1 : .4);
      head.current?.setAttribute('transform', `rotate(${((life.headAngle ?? 0) + twitch).toFixed(2)} 32 34)`);
      feelers.current.forEach((feeler, index) => {
        const sweep = life.mode === 'inspect' ? 8 : 3;
        const angle = Math.sin(time * 3.6 + index * 2) * sweep + Math.sin(time * 8.1 + index) * 1.4;
        feeler?.setAttribute('transform', `rotate(${angle.toFixed(2)} ${index ? 27 : 20} 29)`);
      });
    },
  }), []);
  const limb = (leg, index) => <path key={index} ref={(node) => { limbs.current[index] = node; }} className={`animal-leg animal-leg-${leg.side}`} d={legPose(leg, 0, .35)} />;
  return <svg className="ant-anatomy" viewBox="0 0 96 72" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`ant-shell-${id}`} cx="38%" cy="20%" r="78%"><stop stopColor="#94725a" /><stop offset=".16" stopColor="#60432f" /><stop offset=".42" stopColor="#352418" /><stop offset=".74" stopColor="#1e1711" /><stop offset="1" stopColor="#0d0d0a" /></radialGradient>
      <radialGradient id={`ant-head-${id}`} cx="38%" cy="25%" r="80%"><stop stopColor="#896044" /><stop offset=".25" stopColor="#61412b" /><stop offset=".65" stopColor="#352419" /><stop offset="1" stopColor="#17130f" /></radialGradient>
      <linearGradient id={`ant-leg-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#67442a" /><stop offset=".45" stopColor="#48311f" /><stop offset="1" stopColor="#261d15" /></linearGradient>
      <linearGradient id={`ant-sheen-${id}`} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#f4dbc0" stopOpacity=".38" /><stop offset=".42" stopColor="#d4b48c" stopOpacity=".08" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <radialGradient id={`ant-shadow-${id}`}><stop stopColor="#293821" stopOpacity=".25" /><stop offset="1" stopColor="#293821" stopOpacity="0" /></radialGradient>
      <pattern id={`ant-grain-${id}`} width="2.7" height="2.3" patternUnits="userSpaceOnUse"><path d="M.3 .7l.5-.25m1 1.2l.4-.1" stroke="#e0bc90" strokeWidth=".15" strokeOpacity=".25" /></pattern>
      <pattern id={`ant-eye-${id}`} width=".75" height=".65" patternUnits="userSpaceOnUse"><path d="M0 .2L.35 0l.35.2v.3L.35.65 0 .5Z" stroke="#a69372" strokeWidth=".08" strokeOpacity=".45" /></pattern>
      <path id={`ant-gaster-shape-${id}`} d="M64 31 C68 26 78 25 84 29 C91 33 94 40 87 45 C80 50 68 45 63 39 C61 36 61 33 64 31Z" />
      <path id={`ant-head-shape-${id}`} d="M15 31 C15 27 20 24 25 25 C30 25 33 29 33 33 C32 37 29 41 24 42 L18 39 C15 37 14 34 15 31Z" />
    </defs>
    <ellipse cx="48" cy="69" rx="40" ry="3" fill={`url(#ant-shadow-${id})`} />
    <g className="ant-far-legs" stroke={`url(#ant-leg-${id})`}>{legs.slice(0, 3).map(limb)}</g>
    <g ref={body} className="ant-body-segments" transform="translate(0 .35)">
      <path d="M29 34 Q34 31 39 34 M50 35 Q57 39 65 35" stroke="#332116" strokeWidth="2.1" />
      <use className="ant-abdomen" href={`#ant-gaster-shape-${id}`} fill={`url(#ant-shell-${id})`} />
      <use href={`#ant-gaster-shape-${id}`} fill={`url(#ant-grain-${id})`} />
      <path d="M69 28 C65 32 67 39 72 44 M76 27 C71 32 75 43 79 46 M83 29 C79 33 82 42 86 45" stroke="#110d09" strokeOpacity=".55" strokeWidth=".6" />
      <path d="M70 28 C67 31 68 37 70 39 M77 28 C74 31 75 36 76 38 M84 30 C81 32 82 36 83 38" stroke={`url(#ant-sheen-${id})`} strokeWidth=".65" />
      <path d="M65 32 Q72 27 79 29" stroke="#d2ae7b" strokeOpacity=".25" strokeWidth=".65" strokeLinecap="round" />
      <path d="M54 36 L56 31 Q58 28 60 32 L62 37Z" fill={`url(#ant-head-${id})`} />
      <path className="ant-thorax" d="M33 33 C34 29 38 28 41 30 L44 31 C48 30 51 33 52 36 L50 40 Q47 40 44 38 L40 39 Q34 39 33 36Z" fill={`url(#ant-head-${id})`} />
      <path d="M35 31 Q38 29 42 32 M45 33 Q48 32 50 35" stroke={`url(#ant-sheen-${id})`} strokeWidth=".8" strokeLinecap="round" />
      <path d="M42 32 L41 37 M46 34 L45 38" stroke="#1b120d" strokeWidth=".45" strokeOpacity=".65" />
      <g ref={head} className="ant-head" transform="rotate(0 32 34)">
      <path className="ant-mandibles" d="M17 37 Q12 38 12 41 L16 40 M19 39 Q16 43 18 44 L21 41" stroke="#392717" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <use className="ant-head-shell" href={`#ant-head-shape-${id}`} fill={`url(#ant-head-${id})`} />
      <use href={`#ant-head-shape-${id}`} fill={`url(#ant-grain-${id})`} />
      <path d="M19 28 Q23 25 28 28 M22 29l2 8 M24 29l2 8" stroke="#d0a271" strokeOpacity=".22" strokeWidth=".4" strokeLinecap="round" />
      <ellipse cx="27" cy="31" rx="1.35" ry="1.7" transform="rotate(-18 27 31)" fill="#16120c" />
      <ellipse cx="27" cy="31" rx="1.35" ry="1.7" transform="rotate(-18 27 31)" fill={`url(#ant-eye-${id})`} />
      <path d="M14 32l-1-.6m4-5-.5-1m5-1 .2-1.2m10 9 1-.2" stroke="#ab8f68" strokeWidth=".3" strokeOpacity=".55" strokeLinecap="round" />
      <g className="ant-feelers" stroke="#513720" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round"><g ref={(node) => { feelers.current[0] = node; }}><path d="M20 29 L13 22 Q12 21 10 21 L2 22" /><path d="M2 22l-1.3.4" strokeWidth="1.1" /></g><g ref={(node) => { feelers.current[1] = node; }}><path d="M27 28 L26 17 Q26 15 24 14 L15 12" /><path d="M15 12l-1.4-.3" strokeWidth="1.1" /></g></g>
      </g>
      <path d="M35 30l.2-1.3m7 3 .6-1m26-2 .2-1.4m8 1 .6-1.4m7 5 1.5-.5m2 7 1.4.4m-5 5 .6 1.2m-11-1-.2 1.2" stroke="#ab8f68" strokeWidth=".3" strokeOpacity=".55" strokeLinecap="round" />
    </g>
    <g className="ant-near-legs" stroke={`url(#ant-leg-${id})`}>{legs.slice(3).map((leg, index) => limb(leg, index + 3))}</g>
  </svg>;
}
