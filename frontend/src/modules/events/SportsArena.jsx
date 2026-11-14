import { useEffect, useRef, useState } from 'react';
import Ant from './Ant.jsx';
import { advanceAntBehavior } from './ant-behavior.js';
import { useMotion } from '../../shared/MotionContext.jsx';
import './play-zone.css';

const ANT_WIDTH = 80;
const ANT_HEIGHT = 60;

const sports = [
  { name: 'Cricket ball', className: 'cricket-ball', label: 'CRICKET', size: 78 },
  { name: 'Tennis ball', className: 'tennis-ball', label: 'TENNIS', size: 48 },
  { name: 'Volleyball', className: 'volleyball', label: 'VOLLEYBALL', size: 104 },
  { name: 'Basketball', className: 'basketball', label: 'BASKETBALL', size: 88 },
  { name: 'Football', className: 'football', label: 'FOOTBALL', size: 64 },
];

export default function SportsArena() {
  const arena = useRef(null), ballNodes = useRef([]), visualNodes = useRef([]), antNode = useRef(null);
  const antMotion = useRef(null);
  const replay = useRef(() => {});
  const world = useRef({ balls: [], ant: { x: 10, direction: 1 }, width: 0, height: 0 });
  const dragState = useRef(null), focused = useRef(false);
  const { paused } = useMotion();
  const [reduced, setReduced] = useState(false);
  const paint = useRef(() => {});

  useEffect(() => {
    const element = arena.current, media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = null, previous = null, accumulator = 0, inView = false;
    const clamp = (value, maximum) => Math.max(4, Math.min(value, Math.max(4, maximum)));
    function contain(ball) {
      ball.x = clamp(ball.x, world.current.width - ball.size - 4);
      ball.y = clamp(ball.y, world.current.height - ball.size - 30);
    }
    paint.current = () => {
      world.current.balls.forEach((ball, i) => {
        if (ballNodes.current[i]) {
          ballNodes.current[i].style.transform = `translate3d(${ball.x}px, ${ball.y}px, 0)`;
          ballNodes.current[i].style.pointerEvents = 'auto';
          ballNodes.current[i].style.opacity = '1';
        }
        if (visualNodes.current[i]) visualNodes.current[i].style.transform = `rotate(${ball.rotation}deg)`;
      });
      const { ant, height } = world.current;
      if (antNode.current) {
        antNode.current.style.transform = `translate3d(${ant.x}px, ${Math.max(4, height - ANT_HEIGHT - 30)}px, 0) scaleX(${ant.direction > 0 ? -1 : 1})`;
        antMotion.current?.paint(ant.stride ?? 0, ant.pushing, ant);
      }
    };
    function dropBalls() {
      if (dragState.current) return;
      const { width, height } = world.current;
      world.current.balls = sports.map((sport, i) => ({ ...sport, x: 8 + (width - sport.size - 16) * (i + .5) / sports.length, y: 20 + (i % 3) * height * .12, vx: i % 2 ? .7 : -.5, vy: 0, rotation: i * 13 - 24 }));
      world.current.balls.forEach(contain); paint.current();
    }
    replay.current = dropBalls;
    function resize() {
      const { width, height } = element.getBoundingClientRect(), state = world.current;
      const oldWidth = state.width, oldHeight = state.height;
      state.width = width; state.height = height;
      if (!state.balls.length) dropBalls();
      else state.balls.forEach((ball) => { ball.x *= width / (oldWidth || width); ball.y *= height / (oldHeight || height); });
      state.balls.forEach(contain); state.ant.x = clamp(state.ant.x, width - ANT_WIDTH - 4); paint.current();
    }
    function step() {
      const state = world.current, dragged = dragState.current?.index;
      state.balls.forEach((ball, i) => {
        if (i === dragged) return;
        const floor = state.height - ball.size - 30;
        ball.vy = Math.min(ball.vy + .35, 12); ball.x += ball.vx; ball.y += ball.vy;
        ball.vx *= .992; ball.rotation += ball.vx * .22;
        if (ball.x < 4 || ball.x > state.width - ball.size - 4) ball.vx *= -.72;
        if (ball.y >= floor) { ball.vy = Math.abs(ball.vy) < .6 ? 0 : -ball.vy * .48; ball.vx *= .96; }
        contain(ball);
      });
      for (let a = 0; a < state.balls.length; a++) for (let b = a + 1; b < state.balls.length; b++) {
        const first = state.balls[a], second = state.balls[b];
        const dx = second.x + second.size / 2 - first.x - first.size / 2, dy = second.y + second.size / 2 - first.y - first.size / 2;
        const distance = Math.hypot(dx, dy), overlap = (first.size + second.size) / 2 - distance;
        if (overlap <= 0) continue;
        const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
        const massA = first.size ** 2, massB = second.size ** 2, total = massA + massB;
        const weightA = a === dragged ? 0 : b === dragged ? 1 : massB / total;
        const weightB = b === dragged ? 0 : a === dragged ? 1 : massA / total;
        first.x -= nx * overlap * weightA; first.y -= ny * overlap * weightA;
        second.x += nx * overlap * weightB; second.y += ny * overlap * weightB;
        const velocity = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
        if (velocity < 0) {
          const impulse = -1.72 * velocity / (1 / massA + 1 / massB);
          if (a !== dragged) { first.vx -= impulse * nx / massA; first.vy -= impulse * ny / massA; }
          if (b !== dragged) { second.vx += impulse * nx / massB; second.vy += impulse * ny / massB; }
        }
      }
      const ant = state.ant, tennis = state.balls[1];
      const ahead = (tennis.x + tennis.size / 2 - ant.x - ANT_WIDTH / 2) * ant.direction > 0;
      const touchingBall = dragged !== 1 && ahead && Math.hypot(tennis.x + tennis.size / 2 - ant.x - ANT_WIDTH / 2, tennis.y + tennis.size / 2 - state.height + ANT_HEIGHT / 2 + 30) < (ANT_WIDTH + tennis.size) / 2 + 3;
      advanceAntBehavior(ant, { minimum: 4, maximum: Math.max(4, state.width - ANT_WIDTH - 4), touchingBall }, 1 / 60);
      if (ant.pushing) { tennis.vx = ant.direction * ant.speed / 60 * 1.2; tennis.vy = Math.min(tennis.vy, 0); }
      state.balls.forEach(contain);
    }
    function running() { return !paused && !media.matches && !document.hidden && inView; }
    function tick(time) {
      frame = null;
      if (!running()) { previous = null; return; }
      if (previous !== null && !(focused.current && !dragState.current)) {
        accumulator += Math.min(50, time - previous);
        while (accumulator >= 1000 / 60) { step(); accumulator -= 1000 / 60; }
        paint.current();
      }
      previous = time; frame = requestAnimationFrame(tick);
    }
    function resume() {
      setReduced(media.matches);
      element.dataset.active = String(running());
      if (!running()) { if (frame !== null) cancelAnimationFrame(frame); frame = null; previous = null; accumulator = 0; }
      else if (frame === null) frame = requestAnimationFrame(tick);
    }
    resize();
    const observer = new ResizeObserver(resize); observer.observe(element);
    const visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) element.closest('section').dataset.revealed = 'true'; resume(); }); visibility.observe(element);
    document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume); resume();
    return () => { if (frame !== null) cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect(); document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume); replay.current = () => {}; };
  }, [paused]);

  function moveTo(ball, x, y) {
    ball.x = Math.max(4, Math.min(x, world.current.width - ball.size - 4));
    ball.y = Math.max(4, Math.min(y, world.current.height - ball.size - 30));
    paint.current();
  }
  function startDrag(event, index) {
    if (!event.isPrimary || event.button !== 0) return;
    const bounds = arena.current.getBoundingClientRect(), ball = world.current.balls[index];
    if (!ball) return;
    event.currentTarget.focus({ preventScroll: true });
    dragState.current = { index, pointerId: event.pointerId, offsetX: event.clientX - bounds.left - ball.x, offsetY: event.clientY - bounds.top - ball.y, lastX: event.clientX, lastY: event.clientY, time: performance.now() };
    ball.vx = 0; ball.vy = 0; event.currentTarget.setPointerCapture(event.pointerId);
  }
  function drag(event) {
    const state = dragState.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const bounds = arena.current.getBoundingClientRect(), ball = world.current.balls[state.index], now = performance.now(), elapsed = Math.max(8, now - state.time);
    ball.vx = Math.max(-12, Math.min(12, (event.clientX - state.lastX) / elapsed * 16));
    ball.vy = Math.max(-12, Math.min(12, (event.clientY - state.lastY) / elapsed * 16));
    moveTo(ball, event.clientX - bounds.left - state.offsetX, event.clientY - bounds.top - state.offsetY);
    Object.assign(state, { lastX: event.clientX, lastY: event.clientY, time: now });
  }
  function endDrag(event) {
    if (event.pointerId === dragState.current?.pointerId) { dragState.current = null; focused.current = false; paint.current(); }
  }
  function keyboard(event, index) {
    const offsets = { ArrowLeft: [-18,0], ArrowRight: [18,0], ArrowUp: [0,-18], ArrowDown: [0,18] }, offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault(); focused.current = true;
    const ball = world.current.balls[index]; ball.vx = 0; ball.vy = 0; moveTo(ball, ball.x + offset[0], ball.y + offset[1]);
  }
  return <section className="sports-play-section" id="play-zone" aria-labelledby="play-zone-title"><header className="sports-play-heading"><div><span className="eyebrow">A LITTLE PLAY BREAK</span><h2 id="play-zone-title">Go on. <em>Make a move.</em></h2><p id="arena-help">Drag a ball, give it a throw, or use the arrow keys. Our little ant has its own plans.</p></div><button type="button" className="button button-secondary" disabled={paused || reduced} onClick={() => replay.current()}>Drop them again <span aria-hidden="true">↻</span></button></header>
    <div className="sports-arena" ref={arena} role="group" aria-label="Interactive sports play area" onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
      <span className="sports-play-watermark" aria-hidden="true">PLAY.</span><span className="sports-play-floor" aria-hidden="true" />
      {sports.map((sport, index) => <button ref={(node) => { ballNodes.current[index] = node; }} key={sport.name} type="button" className="sports-object" aria-label={`Move ${sport.name}`} aria-describedby="arena-help" style={{ '--ball-size': `${sport.size}px` }} onPointerDown={(event) => startDrag(event, index)} onKeyDown={(event) => keyboard(event, index)} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}><span ref={(node) => { visualNodes.current[index] = node; }} className={`sports-ball-visual ${sport.className}`} /><span className="sports-ball-label">{sport.label}</span></button>)}
      <div className="sports-animal" ref={antNode} role="img" aria-label="Ant rolling the tennis ball"><Ant motionRef={antMotion} /></div>
    </div><p className="sports-play-caption"><span /> A little movement. A better day.{reduced ? ' Reduced motion is enabled.' : paused ? ' Animations are paused.' : ''}</p>
  </section>;
}
