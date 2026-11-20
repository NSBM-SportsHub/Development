import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMotion } from './MotionContext.jsx';
import { Icon } from './ui.jsx';
import './christmas.css';

const SNOW_PREFERENCE = 'sportshub.snowfall.v1';
const flakes = Array.from({ length: 44 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  size: `${3 + index % 5}px`,
  duration: `${13 + index % 13}s`,
  delay: `${-(index * 7 % 29)}s`,
  drift: `${(index % 2 ? 1 : -1) * (24 + index % 6 * 12)}px`,
}));

export default function ChristmasEffects() {
  const { paused } = useMotion();
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(SNOW_PREFERENCE) !== 'off'; } catch { return true; }
  });
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches), visibility = () => setHidden(document.hidden);
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  function toggle() {
    setEnabled(value => {
      try { localStorage.setItem(SNOW_PREFERENCE, value ? 'off' : 'on'); } catch { /* Snow also works without browser storage. */ }
      return !value;
    });
  }
  return createPortal(<>
    {enabled && !reduced && <div className={`christmas-snowfall${paused || hidden ? ' is-paused' : ''}`} aria-hidden="true">
      {flakes.map((flake, index) => <span key={index} className="christmas-snowflake" style={{ '--snow-left': flake.left, '--snow-size': flake.size, '--snow-duration': flake.duration, '--snow-delay': flake.delay, '--snow-drift': flake.drift }} />)}
    </div>}
    {!reduced && <button type="button" className="christmas-snow-toggle" aria-label={enabled ? 'Turn off falling snow' : 'Turn on falling snow'} aria-pressed={enabled} onClick={toggle}><Icon name="snowflake" size={17} /><span>Snow {enabled ? 'on' : 'off'}</span></button>}
  </>, document.body);
}
