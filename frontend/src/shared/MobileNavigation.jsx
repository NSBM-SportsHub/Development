import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { useClubAccess } from './useClubAccess.js';
import { Avatar, Icon, Modal } from './ui.jsx';
import './mobile-navigation.css';

export const MOBILE_NAV_QUERY = '(max-width: 767px), (max-width: 1024px) and (hover: none)';

function MobileMoreMenu({ user, onClose }) {
  const access = useClubAccess();
  const location = useLocation();
  const admin = user?.role === 'admin';
  const groups = [
    { title: 'On campus', links: [
      ['/', 'home', 'Home'], ['/#whats-on', 'calendar', 'Events & activities'], ['/#play-zone', 'sport', 'Play zone'],
    ] },
    ...(user ? [
      { title: 'Your sport', links: [
        ['/sports-clubs', 'clubs', 'Sports clubs'], ['/tournaments', 'trophy', 'Tournaments'],
        ['/training-attendance', 'calendar', 'Training & attendance'], ['/announcements', 'announcement', 'Announcements'],
        ['/memberships/mine', 'membership', 'My memberships'],
        ...(access.assignments.length ? [['/memberships/review', 'review', 'Club membership review']] : []),
      ] },
      { title: 'Resources & activity', links: [
        ['/facilities', 'facility', 'Facilities'], ['/equipment', 'equipment', 'Equipment'],
        ...(!admin ? [['/bookings/mine', 'bookings', 'My bookings'], ['/bookings/new', 'booking-new', 'Request a booking']] : []),
        ['/participation', 'activity', 'My participation'], ['/notifications', 'bell', 'Notifications'], ['/profile', 'user', 'My profile'],
      ] },
      ...(admin ? [{ title: 'Administration', links: [
        ['/admin/users', 'users', 'User management'], ['/admin/clubs', 'clubs', 'Club management'],
        ['/admin/memberships', 'review', 'Membership review'], ['/admin/bookings', 'booking-review', 'Booking review'],
        ['/admin/coaches', 'coach', 'Coach assignments'], ['/admin/promotions', 'announcement', 'Home page promotions'],
        ['/admin/reports', 'report', 'Participation reports'],
      ] }] : []),
    ] : [{ title: 'Your community', links: [['/login', 'user', 'Sign in'], ['/register', 'join', 'Create an account']] }]),
  ];
  return createPortal(<div className="mobile-more-layer">
    <Modal title="Explore SportsHub" onClose={onClose}>
      {user && <Link to="/profile" className="mobile-menu-account" onClick={onClose}><Avatar user={user} /><span><strong>{user.name}</strong><small>{admin ? 'Administrator' : 'Student workspace'}</small></span></Link>}
      <div className="mobile-menu-groups">{groups.map(group => <section key={group.title} aria-label={group.title}>
        <h3>{group.title}</h3><div>{group.links.map(([to, icon, label]) => to.includes('#')
          ? <Link key={to} to={to} onClick={onClose} className={`mobile-menu-link${location.pathname + location.hash === to ? ' active' : ''}`}><Icon name={icon} /><span>{label}</span></Link>
          : <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className="mobile-menu-link"><Icon name={icon} /><span>{label}</span></NavLink>)}</div>
      </section>)}</div>
    </Modal>
  </div>, document.body);
}

export default function MobileNavigation() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_NAV_QUERY).matches);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_NAV_QUERY);
    const update = () => { setMobile(media.matches); if (!media.matches) setOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { setOpen(false); }, [location.key, user?.id]);
  useEffect(() => {
    if (!window.matchMedia(MOBILE_NAV_QUERY).matches) return;
    const frame = requestAnimationFrame(() => {
      if (location.pathname === '/' && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
      else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.pathname, location.hash]);
  if (!mobile) return null;
  const admin = user?.role === 'admin';
  const tabs = user ? [
    ['/', 'home', 'Home'], [admin ? '/admin/clubs' : '/sports-clubs', 'clubs', 'Clubs'],
    [admin ? '/admin/bookings' : '/bookings/mine', 'bookings', 'Bookings'], ['/profile', 'user', 'Profile'],
  ] : [['/', 'home', 'Home'], ['/#whats-on', 'calendar', 'Events'], ['/#play-zone', 'sport', 'Play'], ['/login', 'user', 'Sign in']];
  function active(to) {
    if (to.includes('#')) return location.pathname + location.hash === to;
    if (to === '/') return location.pathname === '/' && !location.hash;
    if (to === '/login') return ['/login', '/register'].includes(location.pathname);
    return location.pathname === to || location.pathname.startsWith(to + '/');
  }
  const moreActive = open || !tabs.some(([to]) => active(to));
  return <>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {tabs.map(([to, icon, label]) => <Link key={to} to={to} className={`mobile-tab${active(to) ? ' is-active' : ''}`} aria-current={active(to) ? 'page' : undefined}><span className="mobile-tab-icon">{to === '/profile' ? <Avatar user={user} /> : <Icon name={icon} size={22} />}</span><span>{label}</span></Link>)}
      <button type="button" className={`mobile-tab${moreActive ? ' is-active' : ''}`} aria-label="More navigation" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}><span className="mobile-tab-icon"><Icon name="more" size={22} /></span><span>More</span></button>
    </nav>
    {open && <MobileMoreMenu user={user} onClose={() => setOpen(false)} />}
  </>;
}
