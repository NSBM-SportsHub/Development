import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/AuthContext.jsx';
import { Button, Icon } from '../../shared/ui.jsx';
import { usePublicAnnouncements } from '../announcements/usePublicAnnouncements.js';
import './announcement-hero.css';

function HeroImage({ item }) {
  const [failed, setFailed] = useState(null);
  return <div className="announcement-hero-art" aria-hidden="true">
    {failed !== item.image_url ? <img src={item.image_url} alt="" draggable="false" referrerPolicy="no-referrer" onError={() => setFailed(item.image_url)} />
      : <div className="announcement-hero-image-unavailable"><Icon name="announcement" size={64} /><span>News from the hub</span></div>}
  </div>;
}

export default function AnnouncementHero() {
  const { user } = useAuth();
  const { announcements, loading, error, retry } = usePublicAnnouncements();
  const track = useRef(null), drag = useRef(null), current = useRef(0);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [dragging, setDragging] = useState(false), [touching, setTouching] = useState(false), [keyboardFocus, setKeyboardFocus] = useState(false);
  const [rotationReset, setRotationReset] = useState(0);
  const active = Math.min(index, Math.max(0, announcements.length - 1));
  const autoRotating = announcements.length > 1 && !hidden && !reduced && !dragging && !touching && !keyboardFocus;
  const resetRotation = () => setRotationReset(value => value + 1);
  const goTo = useCallback((next, automatic = false) => {
    const element = track.current;
    if (!element) return;
    const target = Math.max(0, Math.min(announcements.length - 1, next));
    if (!automatic) setRotationReset(value => value + 1);
    element.scrollTo({ left: target * element.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  }, [announcements.length, reduced]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches), visibility = () => setHidden(document.hidden);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!autoRotating) return;
    const timer = window.setInterval(() => goTo((current.current + 1) % announcements.length, true), 8000);
    return () => window.clearInterval(timer);
  }, [autoRotating, announcements.length, rotationReset, goTo]);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    current.current = Math.min(current.current, announcements.length - 1);
    const resize = () => element.scrollTo({ left: current.current * element.clientWidth, behavior: 'auto' });
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [announcements.length]);

  function onScroll() {
    if (!track.current?.clientWidth) return;
    const next = Math.max(0, Math.min(announcements.length - 1, Math.round(track.current.scrollLeft / track.current.clientWidth)));
    current.current = next; setIndex(next);
  }
  function release(event) {
    if (!drag.current) return;
    const nearest = Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth);
    drag.current = null;
    setDragging(false);
    event.currentTarget.classList.remove('is-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    goTo(nearest);
  }

  if (!announcements.length) return <section className={`announcement-hero announcement-hero-empty${loading ? ' is-loading' : ''}`} aria-labelledby="announcement-hero-title" aria-busy={loading}>
    <div><span className="announcement-hero-kicker"><span /> THE CAMPUS NOTICEBOARD</span>
      <h1 id="announcement-hero-title">Campus news.<br /><em>First to know.</em></h1>
      <p>{loading ? 'Getting the latest news from SportsHub…' : error ? 'The latest announcements are taking a moment to load.' : 'Your next match, team update or campus moment. Find the latest from your sporting community here.'}</p>
      <div className="announcement-hero-empty-actions">{error ? <Button className="button-secondary" onClick={retry}>Try again</Button> : <a className="discovery-button" href="#whats-on">Explore campus activities <Icon name="arrow" /></a>}
        {user?.role === 'admin' && <Link className="button button-secondary" to="/announcements/new"><Icon name="plus" size={18} />Create announcement</Link>}</div>
    </div><div className="announcement-hero-empty-mark" aria-hidden="true"><Icon name="announcement" size={100} /><span>FROM THE HUB<br /><strong>TO YOU.</strong></span></div>
  </section>;

  return <section className="announcement-hero" aria-label="Latest campus announcements" aria-roledescription="carousel"
    onFocusCapture={event => setKeyboardFocus(event.target.matches(':focus-visible'))}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocus(false); }}>
    <h1 className="sr-only">Latest SportsHub announcements</h1>
    <div className="announcement-hero-track" ref={track} onScroll={onScroll} tabIndex={announcements.length > 1 ? 0 : undefined} aria-label="Scroll through announcements"
      onTouchStart={() => setTouching(true)} onTouchEnd={() => { setTouching(false); resetRotation(); }} onTouchCancel={() => { setTouching(false); resetRotation(); }}
      onWheel={event => { if (event.deltaX || event.shiftKey) resetRotation(); }}
      onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); goTo(active + (event.key === 'ArrowRight' ? 1 : -1)); } }}
      onPointerDown={event => { if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('a,button')) return; setDragging(true); drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (!drag.current) return; event.currentTarget.classList.add('is-dragging'); event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX; }}
      onPointerUp={release} onPointerCancel={release}>
      {announcements.map((item, position) => <article key={item.announcement_id} className="announcement-hero-slide" role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${announcements.length}`} aria-hidden={position !== active}>
        <div className="announcement-hero-copy"><span className="announcement-hero-kicker"><span /> {item.is_pinned ? 'IN THE SPOTLIGHT' : 'NEWS FROM THE HUB'}</span>
          <span className="announcement-hero-scope">{item.club_id === null ? 'Campus announcement' : 'Club announcement'}</span>
          <h2>{item.title}</h2><p>{item.body}</p>
          <Link className="discovery-button" to={`/news/${item.announcement_id}`} tabIndex={position === active ? 0 : -1}>Read announcement <Icon name="arrow" /></Link>
        </div><HeroImage item={item} />
      </article>)}
    </div>
    <div className="announcement-hero-footer"><span className="announcement-hero-count" aria-live={autoRotating ? 'off' : 'polite'} aria-atomic="true"><strong>{String(active + 1).padStart(2, '0')}</strong> / {String(announcements.length).padStart(2, '0')} <span>ANNOUNCEMENTS</span></span>
      {announcements.length > 1 && <><div className="announcement-hero-dots">{announcements.map((item, position) => <button key={item.announcement_id} type="button" aria-label={`Show announcement ${position + 1}: ${item.title}`} aria-current={active === position ? 'true' : undefined} onClick={() => goTo(position)}><span /></button>)}</div>
        <div className="announcement-hero-arrows"><button type="button" aria-label="Previous announcement" disabled={active === 0} onClick={() => goTo(active - 1)}><Icon name="arrow" /></button><button type="button" aria-label="Next announcement" disabled={active === announcements.length - 1} onClick={() => goTo(active + 1)}><Icon name="arrow" /></button></div></>}
    </div>
  </section>;
}
