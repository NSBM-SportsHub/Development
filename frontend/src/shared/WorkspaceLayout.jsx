import { Link, NavLink, useLocation } from "react-router-dom";
import { Avatar, Brand, Icon } from "./ui.jsx";

export default function WorkspaceLayout({ user, role, busy, error, onSignOut, children }) {
  const location = useLocation();
  const sectionNames = { "/memberships/apply": "Apply for membership", "/memberships/mine": "My memberships", "/admin/memberships": "Membership review", "/facilities": "Facilities", "/equipment": "Equipment", "/bookings/new": "Request a booking", "/bookings/mine": "My bookings", "/announcements": "Announcements" };
  const sectionName = sectionNames[location.pathname] || (location.pathname.startsWith("/admin")
    ? "User management"
    : location.pathname.startsWith("/tournaments")
      ? "Tournaments"
      : "My profile");

  return (
    <div className={`app-shell ${role}-workspace`}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="sidebar">
        <NavLink to="/profile" className="brand-link" aria-label="NSBM SportsHub home"><Brand /></NavLink>
        <div className="sidebar-section-label">YOUR WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace">
          <NavLink to="/profile"><Icon name="user" />My profile</NavLink>
          {role === "admin" && <NavLink to="/admin/users"><Icon name="users" />User management</NavLink>}
          <NavLink to="/memberships/apply">Apply for membership</NavLink>
          <NavLink to="/memberships/mine">My memberships</NavLink>
          {role === "admin" && <NavLink to="/admin/memberships">Membership review</NavLink>}
          <NavLink to="/facilities">Facilities</NavLink>
          <NavLink to="/equipment">Equipment</NavLink>
          {role === "student" && <>
            <NavLink to="/bookings/new">Request a booking</NavLink>
            <NavLink to="/bookings/mine">My bookings</NavLink>
          </>}
          <NavLink to="/tournaments">Tournaments</NavLink>
          <NavLink to="/sports-clubs">Clubs preview</NavLink>
          <NavLink to="/training-attendance">Training preview</NavLink>
          <NavLink to="/announcements">Announcements</NavLink>
        </nav>
        <div className="sidebar-note">
          <Icon name="shield" />
          <strong>Your university. Your team.</strong>
          <p>One account for your SportsHub community.</p>
        </div>
        <div className="sidebar-account">
          <Avatar user={user} />
          <div><strong>{user.name}</strong><span>{role === "admin" ? "Administrator" : "Student"}</span></div>
          <button
            type="button"
            className="icon-button"
            onClick={onSignOut}
            disabled={busy}
            aria-label={busy ? "Signing out" : "Sign out"}
            title="Sign out"
          >
            {busy ? <span className="spinner" /> : <Icon name="logout" />}
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><Link to="/profile">Workspace</Link><span>/</span><strong>{sectionName}</strong></div>
          <span className="session-label"><span /> Signed in</span>
        </header>
        <main id="main-content" className="main-content">
          {error && <div className="notice notice-error" role="alert">{error} You are still signed in. Try signing out again.</div>}
          {children}
        </main>
        <footer className="workspace-footer"><span>NSBM SportsHub</span><span>Built for our sporting community.</span></footer>
      </div>
    </div>
  );
}
