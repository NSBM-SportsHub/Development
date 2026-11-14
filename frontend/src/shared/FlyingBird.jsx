import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useMotion } from './MotionContext.jsx';
import { advanceBirdFlight, containBird, createBirdFlight } from './bird-flight.js';
import { BIRD_IDLE_DELAY_MS, buttonBirdPerch } from './bird-perch.js';
import Parrot from './Parrot.jsx';
import './flying-bird.css';

export default function FlyingBird() {
  const { pathname } = useLocation(), { paused } = useMotion();
  const actor = useRef(null), facing = useRef(null), wings = useRef(null), flight = useRef(null);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reduced) return;
    let frame = null, previous = null, idleTimer = null, idle = false, perchButton = null, nextSearch = 0;
    const buttonSelector = 'button, a.button, a[class*="button-"], a[class*="-button"], [role="button"], input[type="submit"], input[type="button"]';
    function buttonPerch(button, view) {
      if (!button.isConnected || button.closest('.flying-bird-layer, [inert], [aria-hidden="true"]') || button.matches(':disabled, [aria-disabled="true"]')) return null;
      const dialog = document.querySelector('[role="dialog"]:not([inert]), dialog[open]');
      if (dialog && !dialog.contains(button)) return null;
      const style = getComputedStyle(button);
      if (style.visibility !== 'visible' || Number(style.opacity) === 0) return null;
      const box = button.getBoundingClientRect(), perch = buttonBirdPerch(box, view);
      if (!perch) return null;
      // Reject controls hidden by another element or clipped by a scrolling panel.
      const surface = document.elementFromPoint(perch.anchorX, box.top + Math.min(8, box.height / 2));
      return surface && button.contains(surface) ? perch : null;
    }
    const viewport = () => {
      const view = { width: window.innerWidth, height: window.innerHeight, size: window.innerWidth <= 600 ? 90 : 116 };
      if (idle) {
        if (perchButton) {
          view.perch = buttonPerch(perchButton, view);
          if (!view.perch) { perchButton = null; nextSearch = performance.now() + 500; }
        } else if (performance.now() >= nextSearch) {
          let bestDistance = Infinity;
          // Students may have no tournament actions yet, or all card buttons
          // may be below the fold. The status dropdown is a real surface too.
          for (const selector of [buttonSelector, '.tournament-filters select']) {
            for (const button of document.querySelectorAll(selector)) {
              const perch = buttonPerch(button, view);
              if (!perch) continue;
              const distance = Math.hypot(perch.x - (flight.current?.x ?? view.width / 2), perch.y - (flight.current?.y ?? view.height / 2));
              if (distance < bestDistance) { bestDistance = distance; perchButton = button; view.perch = perch; }
            }
            if (perchButton) break;
          }
          nextSearch = performance.now() + 500;
        }
        view.perchDelay = 0;
      }
      return view;
    };
    function paint(view) {
      if (!actor.current || !flight.current) return;
      const bird = flight.current, { size } = view;
      actor.current.style.width = `${size}px`; actor.current.style.height = `${size}px`;
      actor.current.style.transform = `translate3d(${bird.x}px, ${bird.y}px, 0) rotate(${bird.bank.toFixed(2)}deg)`;
      actor.current.dataset.flightState = bird.mode;
      facing.current.style.transform = `scaleX(${bird.facingRight ? -1 : 1})`;
      wings.current?.paint(bird);
      const below = document.elementFromPoint(bird.x + size / 2, bird.y + size / 2);
      actor.current.style.opacity = bird.mode === 'flying' && below?.closest('a,button,input,select,textarea,[role="dialog"]') ? '.28' : '1';
    }
    function resize() {
      const view = viewport();
      if (!flight.current) flight.current = createBirdFlight(view);
      else {
        containBird(flight.current, view);
        if (flight.current.mode === 'perched' && view.perch) Object.assign(flight.current, view.perch);
      }
      paint(view);
    }
    function tick(time) {
      frame = null;
      if (paused || document.hidden) { previous = null; return; }
      const view = viewport();
      if (previous !== null) advanceBirdFlight(flight.current, view, (time - previous) / 1000);
      paint(view); previous = time; frame = requestAnimationFrame(tick);
    }
    function resume() {
      previous = null;
      if (paused || document.hidden) { if (frame !== null) cancelAnimationFrame(frame); frame = null; }
      else if (frame === null) frame = requestAnimationFrame(tick);
    }
    function onScroll() {
      idle = false; perchButton = null; nextSearch = 0;
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        idle = true;
      }, BIRD_IDLE_DELAY_MS);
    }
    onScroll(); resize(); resume();
    window.addEventListener('resize', resize); window.addEventListener('scroll', onScroll, { passive: true, capture: true }); document.addEventListener('visibilitychange', resume);
    return () => { if (frame !== null) cancelAnimationFrame(frame); window.clearTimeout(idleTimer); window.removeEventListener('resize', resize); window.removeEventListener('scroll', onScroll, true); document.removeEventListener('visibilitychange', resume); };
  }, [paused, reduced, pathname]);
  if (reduced) return null;
  return createPortal(<div className="flying-bird-layer">
    <div className="flying-bird" ref={actor} aria-hidden="true"><div className="flying-bird-facing" ref={facing}><Parrot motionRef={wings} /></div></div>
  </div>, document.body);
}
