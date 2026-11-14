import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/AuthContext.jsx';
import { api } from '../../shared/api.js';
import { Brand, Button, Icon, Loading, Notice } from '../../shared/ui.jsx';
import { categories, currentEvents, dateLabel, eventState, timeLabel } from './event-utils.js';
import './events.css';
import AnnouncementHero from './AnnouncementHero.jsx';
import { usePublicAnnouncements } from '../announcements/usePublicAnnouncements.js';

const SportsArena = lazy(() => import('./SportsArena.jsx'));

function useEvents(id) {
  const [state, setState] = useState({ loading: true, events: [], error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await api.get(id ? `/public/events/${id}` : '/public/events', { signal: controller.signal });
        setState({ loading: false, events: id ? [result] : result.events, error: '' });
      } catch (error) { if (error.name !== 'AbortError') setState({ loading: false, events: [], error: error.message }); }
    }
    load();
    const timer = setInterval(load, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [id, revision]);
  return { ...state, retry: () => setRevision((value) => value + 1) };
}

function PublicFrame({ children }) {
  const { user } = useAuth();
  return <div className="discovery-page"><a href="#discovery-main" className="skip-link">Skip to content</a><header className="discovery-header"><Link to="/" aria-label="NSBM SportsHub home"><Brand /></Link><nav aria-label="Home navigation"><a href="/#whats-on">What’s on</a><Link className="discovery-nav-cta" to={user ? '/profile' : '/login'}>{user ? 'My workspace' : 'Sign in'}<Icon name="arrow" size={17} /></Link></nav></header><main id="discovery-main">{children}</main><footer className="discovery-footer"><Brand /><p>One campus. Every sport. Your next great moment.</p><Link to={user ? '/profile' : '/register'}>{user ? 'Open my workspace' : 'Join the community'} <span aria-hidden="true">↗</span></Link></footer></div>;
}

function EventArt({ event, className = '' }) {
  const [failedUrl, setFailedUrl] = useState(null);
  return <div className={`event-art ${className}`} aria-hidden="true">{event?.banner_url && failedUrl !== event.banner_url ? <img src={event.banner_url} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(event.banner_url)} /> : <div className="event-court"><div className="event-court-lines" /><span className="event-orbit" /><span className="event-ball" /><strong>{event ? categories[event.category] : 'PLAY'}<small>NSBM SPORTSHUB</small></strong></div>}</div>;
}

function EventMeta({ event }) {
  return <div className="event-meta"><span><Icon name="calendar" size={17} />{dateLabel(event.starts_at)} · {timeLabel(event.starts_at)}<small> Sri Lanka time</small></span><span><Icon name="facility" size={17} />{event.venue}</span></div>;
}

export default function HomePage() {
  const { user } = useAuth();
  const { events, loading, error, retry } = useEvents();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, []);
  const visible = currentEvents(events, now);
  return <PublicFrame><AnnouncementHero />
    <div className="discovery-ticker" aria-hidden="true"><span>ONE CAMPUS</span><span>✳</span><span>EVERY SPORT</span><span>✳</span><span>MORE THAN A GAME</span><span>✳</span><span>YOUR NEXT MOMENT</span></div>
    <section className="discovery-events" id="whats-on"><div className="discovery-section-heading"><div><span className="eyebrow">GET INVOLVED</span><h2>There’s a place<br />for your <em>energy.</em></h2><p>Tournaments, trials, camps and everything in between.</p></div>{user?.role === 'admin' && <Link to="/admin/promotions" className="button button-secondary"><Icon name="edit" size={18} /> Manage promotions</Link>}</div>
      {loading && <Loading message="Finding your next sporting moment…" />}
      {error && <div className="discovery-error"><Notice>{error}</Notice><Button className="button-secondary" onClick={retry}>Try again</Button></div>}
      {!loading && !error && !visible.length && <div className="discovery-empty"><Icon name="calendar" size={34} /><h3>The next moment is on its way.</h3><p>No published activities right now. Check back for the next tournament, trial or campus sports day.</p>{user?.role === 'admin' && <Link to="/admin/promotions">Create your first promotion →</Link>}</div>}
      <div className="discovery-event-grid">{visible.map((event) => <Link to={`/events/${event.id}`} className={`discovery-event-card${event.featured ? ' is-featured' : ''}`} key={event.id}><div className="event-card-image"><EventArt event={event} /><span className="event-card-category">{categories[event.category]}{event.featured && ' / Featured'}</span><span className="event-card-arrow" aria-hidden="true">↗</span></div><div className="event-card-body"><span className={`event-card-status ${eventState(event, now) === 'Happening now' ? 'is-live' : ''}`}>{eventState(event, now)}</span><h3>{event.title}</h3><p>{event.description}</p><span>{dateLabel(event.starts_at)} · {event.venue}</span></div></Link>)}</div>
    </section><Suspense fallback={<div id="play-zone" className="sports-play-placeholder"><Loading message="Getting the play area ready…" /></div>}><SportsArena /></Suspense><section className="discovery-invite"><div><span className="discovery-kicker">DON’T JUST WATCH. BE PART OF IT.</span><h2>Your community.<br />Your next chapter.</h2><p>Join a club, train with your team and make your mark on campus sport.</p></div><Link className="discovery-button" to={user ? '/memberships/mine' : '/register'}>{user ? 'Find my club' : 'Get started'} <Icon name="arrow" /></Link></section>
  </PublicFrame>;
}

export function EventDetailsPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const { events, loading, error, retry } = useEvents(eventId);
  const event = events[0];
  return <PublicFrame><div className="public-event-detail"><Link to="/">← All events & activities</Link>{loading ? <Loading message="Loading event…" /> : error ? <><Notice>{error}</Notice><Button onClick={retry}>Try again</Button></> : event && <><EventArt event={event} className="detail-banner" /><div className="event-detail-copy"><span className="eyebrow">{categories[event.category]}</span><h1>{event.title}</h1><EventMeta event={event} /><p className="event-end-time">Until {dateLabel(event.ends_at)} · {timeLabel(event.ends_at)} (Sri Lanka time)</p><p className="event-detail-description">{event.description}</p>{event.tournament_id ? <Link className="button button-primary" to={`/tournaments/${event.tournament_id}`}>{user ? 'Tournament & registration' : 'Sign in to view registration'} <Icon name="arrow" /></Link> : <p className="event-participation-note">For participation details, follow the instructions above or contact the organising club through SportsHub. {user ? <Link to="/sports-clubs">Explore clubs →</Link> : <Link to="/login" state={{ from: '/sports-clubs' }}>Sign in to explore clubs →</Link>}</p>}</div></>}</div></PublicFrame>;
}

export function AnnouncementDetailsPage() {
  const { announcementId } = useParams();
  const { announcements, loading, error, retry } = usePublicAnnouncements(announcementId);
  const item = announcements[0];
  return <PublicFrame><article className="public-announcement-detail"><Link to="/">← Back to the home page</Link>
    {loading ? <Loading message="Loading announcement…" /> : error ? <><Notice>{error}</Notice><Button onClick={retry}>Try again</Button></> : item && <>
      <span className="eyebrow">{item.is_pinned ? 'In the spotlight' : 'News from the hub'}</span><h1>{item.title}</h1>
      <img src={item.image_url} alt={item.title} referrerPolicy="no-referrer" /><div className="public-announcement-body">{item.body}</div>
    </>}
  </article></PublicFrame>;
}
