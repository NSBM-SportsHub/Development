import { Link, NavLink, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useClubAccess } from "./useClubAccess.js";
import { Avatar, Brand, Icon, Modal } from "./ui.jsx";
import "./workspace-navigation.css";

function WorkspaceLink({ to, icon, children }) {
  return <NavLink to={to} aria-label={children} title={children}><Icon name={icon} /><span className="sidebar-link-label">{children}</span></NavLink>;
}

export default function WorkspaceLayout({ user, role, busy, error, onSignOut, children }) {
  const location = useLocation();
  const access = useClubAccess();
  const [moreState, setMoreState] = useState("closed");
  const closeMore = useCallback(() => setMoreState((state) => state === "closed" ? state : "closing"), []);
  useEffect(() => { closeMore(); }, [location.key, user.id, role, closeMore]);
  useEffect(() => {
    if (moreState !== "closing") return;
    const timer = window.setTimeout(() => setMoreState("closed"), 160);
    return () => window.clearTimeout(timer);
  }, [moreState]);
  const moreGroups = [
    { title: "Memberships", links: [
      { to: "/memberships/mine", icon: "membership", label: "My memberships", description: "Apply to a club and check your memberships." },
    ] },
    { title: "Resources & bookings", links: [
      { to: "/facilities", icon: "facility", label: "Facilities", description: "Explore courts, grounds and other facilities." },
      { to: "/equipment", icon: "equipment", label: "Equipment", description: "Browse available sports equipment." },
      ...(role === "student" ? [{ to: "/bookings/new", icon: "booking-new", label: "Request a booking", description: "Reserve a facility or equipment." }] : []),
    ] },
    ...(role === "admin" ? [{ title: "Club management", links: [
      { to: "/admin/coaches", icon: "coach", label: "Coach assignments", description: "Assign coaches and manage club access." },
      { to: "/sports-clubs", icon: "sport", label: "Sports clubs", description: "Browse club information and edit clubs." },
    ] }] : []),
    { title: "History & reports", links: [
      { to: "/participation", icon: "activity", label: "My participation history", description: "Look back at training and competition records." },
      ...(role === "admin" ? [{ to: "/admin/reports", icon: "report", label: "Participation reports", description: "Review participation across the university." }] : []),
    ] },
  ];
  const moreActive = location.pathname === "/memberships/apply" || moreGroups.some((group) => group.links.some((link) => location.pathname === link.to || location.pathname.startsWith(link.to + "/")));
  const sectionNames = { "/memberships/apply": "Apply for membership", "/memberships/mine": "My memberships", "/admin/memberships": "Membership review", "/facilities": "Facilities", "/equipment": "Equipment", "/bookings/new": "Request a booking", "/bookings/mine": "My bookings", "/announcements": "Announcements" };
  Object.assign(sectionNames, { "/admin/bookings": "Booking review", "/admin/coaches": "Coach assignments", "/memberships/review": "Club membership review", "/notifications": "Notifications", "/participation": "My participation history", "/admin/reports": "Participation reports" });
  const sectionName = sectionNames[location.pathname] || (location.pathname.startsWith("/admin/clubs") ? "Club management" : location.pathname.startsWith("/sports-clubs") ? "Sports clubs" : location.pathname.startsWith("/training-attendance") ? "Training and attendance" : location.pathname.startsWith("/bookings/") ? "Bookings" : location.pathname.startsWith("/admin")
    ? "User management"
    : location.pathname.startsWith("/tournaments")
      ? "Tournaments"
      : "My profile");

  return (
    <div className={`app-shell ${role}-workspace compact-navigation`}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="sidebar">
        <NavLink to="/profile" className="brand-link" aria-label="NSBM SportsHub home"><Brand /></NavLink>
        <div className="sidebar-section-label">YOUR WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace">
          <WorkspaceLink to="/profile" icon="user">My profile</WorkspaceLink>
          {role === "admin" && <WorkspaceLink to="/admin/users" icon="users">User management</WorkspaceLink>}
          {role === "admin" && <WorkspaceLink to="/admin/clubs" icon="clubs">Clubs</WorkspaceLink>}
          {role === "admin" && <><WorkspaceLink to="/admin/memberships" icon="review">Membership review</WorkspaceLink><WorkspaceLink to="/admin/bookings" icon="booking-review">Booking review</WorkspaceLink></>}
          {role !== "admin" && access.assignments.length > 0 && <WorkspaceLink to="/memberships/review" icon="review">Club membership review</WorkspaceLink>}
          {role === "student" && <>
            <WorkspaceLink to="/bookings/mine" icon="bookings">My bookings</WorkspaceLink>
          </>}
          <WorkspaceLink to="/tournaments" icon="trophy">Tournaments</WorkspaceLink>
          {role !== "admin" && <WorkspaceLink to="/sports-clubs" icon="sport">Sports clubs</WorkspaceLink>}
          <WorkspaceLink to="/training-attendance" icon="calendar">Training and attendance</WorkspaceLink>
          <WorkspaceLink to="/announcements" icon="announcement">Announcements</WorkspaceLink>
          <WorkspaceLink to="/notifications" icon="bell">Notifications</WorkspaceLink>
          <button type="button" className={`sidebar-more-trigger${moreActive ? " active" : ""}`} aria-label="More" title="More" aria-haspopup="dialog" aria-expanded={moreState !== "closed"} aria-controls={moreState !== "closed" ? "workspace-more-menu" : undefined} onClick={() => setMoreState("open")}><Icon name="more" /><span className="sidebar-link-label">More</span></button>
        </nav>
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
            {busy ? <span className="spinner" /> : <Icon name="logout" />}<span className="sidebar-signout-label">Sign out</span>
          </button>
        </div>
      </aside>
      {moreState !== "closed" && <div id="workspace-more-menu" className={`workspace-more-layer${moreState === "closing" ? " is-closing" : ""}`}>
        <Modal title="More tools" subtitle="Your memberships, resources and activity, all in one place." onClose={closeMore} busy={moreState === "closing"}>
          <div className="workspace-more-groups" inert={moreState === "closing"}>{moreGroups.map((group) => <section key={group.title} className="workspace-more-group" aria-label={group.title}>
            <h3>{group.title}</h3><div>{group.links.map((link) => <NavLink key={link.to} to={link.to} aria-label={link.label} className="workspace-more-link" onClick={closeMore}><span className="workspace-more-icon"><Icon name={link.icon} size={22} /></span><span><strong>{link.label}</strong><small>{link.description}</small></span><Icon name="arrow" size={16} /></NavLink>)}</div>
          </section>)}</div>
        </Modal>
      </div>}
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
