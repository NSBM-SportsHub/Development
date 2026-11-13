import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useMotion } from './MotionContext.jsx';
import { advanceBirdFlight, containBird, createBirdFlight } from './bird-flight.js';
import Parrot, { PARROT_FEET } from './Parrot.jsx';
import './flying-bird.css';

export default function FlyingBird() {
  const { pathname } = useLocation(), { paused, setPaused } = useMotion();
  const actor = useRef(null), facing = useRef(null), wings = useRef(null), flight = useRef(null);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reduced) return;
    let frame = null, previous = null;
    const measure = document.createElement('canvas').getContext('2d');
    const viewport = () => {
      const view = { width: window.innerWidth, height: window.innerHeight, size: window.innerWidth <= 600 ? 90 : 116 };
      const title = document.querySelector('[data-bird-perch]');
      if (title) {
        const box = title.getBoundingClientRect(), style = getComputedStyle(title), font = parseFloat(style.fontSize), margin = 4;
        let surface = box.top + font * .22;
        if (measure) {
          measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          const text = title.textContent.trim(), metrics = measure.measureText(text), letter = measure.measureText(text.slice(-1));
          if (Number.isFinite(metrics.fontBoundingBoxAscent) && Number.isFinite(letter.actualBoundingBoxAscent)) surface = box.top + metrics.fontBoundingBoxAscent - letter.actualBoundingBoxAscent;
        }
        // Feet grip the last letter; the left-facing tail hangs beyond the end of the word.
        // The offsets account for the SVG viewBox and its centered aspect ratio.
        const x = Math.max(margin, Math.min(view.width - view.size - margin, box.right - view.size * (16 + PARROT_FEET.x + 21) / 290));
        const y = surface - view.size * (PARROT_FEET.y + 20) / 290;
        if (y >= margin && y + view.size + margin <= view.height && box.right > 0 && box.left < view.width) view.perch = { x, y };
      }
      return view;
    };
    function paint() {
      if (!actor.current || !flight.current) return;
      const bird = flight.current, { size } = viewport();
      actor.current.style.width = `${size}px`; actor.current.style.height = `${size}px`;
      actor.current.style.transform = `translate3d(${bird.x}px, ${bird.y}px, 0) rotate(${bird.bank.toFixed(2)}deg)`;
      actor.current.dataset.flightState = bird.mode;
      facing.current.style.transform = `scaleX(${bird.facingRight ? -1 : 1})`;
      wings.current?.paint(bird);
      const below = document.elementFromPoint(bird.x + size / 2, bird.y + size / 2);
      actor.current.style.opacity = below?.closest('a,button,input,select,textarea,[role="dialog"]') ? '.28' : '1';
    }
    function resize() {
      if (!flight.current) flight.current = createBirdFlight(viewport());
      else {
        const view = viewport(); containBird(flight.current, view);
        if (flight.current.mode === 'perched' && view.perch) Object.assign(flight.current, view.perch);
      }
      paint();
    }
    function tick(time) {
      frame = null;
      if (paused || document.hidden) { previous = null; return; }
      if (previous !== null) advanceBirdFlight(flight.current, viewport(), (time - previous) / 1000);
      paint(); previous = time; frame = requestAnimationFrame(tick);
    }
    function resume() {
      previous = null;
      if (paused || document.hidden) { if (frame !== null) cancelAnimationFrame(frame); frame = null; }
      else if (frame === null) frame = requestAnimationFrame(tick);
    }
    resize(); resume();
    window.addEventListener('resize', resize); window.addEventListener('scroll', resize, { passive: true }); document.addEventListener('visibilitychange', resume);
    return () => { if (frame !== null) cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('scroll', resize); document.removeEventListener('visibilitychange', resume); };
  }, [paused, reduced, pathname]);
  if (reduced) return null;
  return createPortal(<div className="flying-bird-layer">
    <div className="flying-bird" ref={actor} aria-hidden="true"><div className="flying-bird-facing" ref={facing}><Parrot motionRef={wings} /></div></div>
    <button type="button" className="bird-motion-toggle" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? 'Play animations' : 'Pause animations'}</button>
  </div>, document.body);
}
