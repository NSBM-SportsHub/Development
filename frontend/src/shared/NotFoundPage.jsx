import { useEffect, useId, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { Brand, Icon } from './ui.jsx';
import './not-found.css';

export default function NotFoundPage({ embedded = false }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const headingId = useId(), heading = useRef(null);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = '404 — Page not found | NSBM SportsHub';
    heading.current?.focus({ preventScroll: true });
    return () => { document.title = previousTitle; };
  }, [pathname]);

  const content = <div className="not-found-content">
    <div className="not-found-copy"><span className="not-found-kicker">404 / OUT OF BOUNDS</span>
      <h1 className="not-found-title" id={headingId} ref={heading} tabIndex={-1}>Page not found.</h1>
      <p>Looks like this page is out of play. The link may be outdated, or the page may have moved.</p>
      <div className="not-found-actions"><Link className="button button-secondary" to="/">Back to home <Icon name="arrow" size={18} /></Link>
        <Link className="not-found-workspace" to={user ? '/profile' : '/login'}>{user ? 'Open my workspace' : 'Sign in to SportsHub'} <Icon name="arrow" size={17} /></Link></div>
      <span className="not-found-note">Your next sporting moment is still waiting.</span>
    </div>
    <div className="not-found-court" aria-hidden="true"><span className="not-found-court-lines" /><strong>4<span className="not-found-ball"><Icon name="sport" size={100} /></span>4</strong><span className="not-found-court-caption">LET’S GET YOU BACK IN THE GAME.</span></div>
  </div>;

  if (embedded) return <section className="not-found-screen is-embedded" aria-labelledby={headingId}>{content}</section>;
  return <div className="not-found-screen">
    <a href="#not-found-main" className="skip-link">Skip to content</a>
    <header className="not-found-header"><Link to="/" aria-label="NSBM SportsHub home"><Brand /></Link><Link to={user ? '/profile' : '/login'}>{user ? 'My workspace' : 'Sign in'} <Icon name="arrow" size={17} /></Link></header>
    <main id="not-found-main" aria-labelledby={headingId}>{content}</main>
    <footer className="not-found-footer">NSBM SportsHub <span>One campus. Every sport.</span></footer>
  </div>;
}
