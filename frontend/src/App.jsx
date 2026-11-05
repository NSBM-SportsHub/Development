import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./shared/AuthContext.jsx";
import { Avatar, Brand, Button, Icon, Loading, Notice } from "./shared/ui.jsx";
import AuthPage from "./modules/authentication-users/AuthPage.jsx";
import ProfilePage from "./modules/authentication-users/ProfilePage.jsx";
import UsersPage from "./modules/authentication-users/UsersPage.jsx";
import BookingsPage from "./modules/bookings/index.jsx";
import Announcements from "./modules/announcements/index.jsx";
import SportsClubs from "./modules/sports-clubs/index.jsx";
import TrainingAttendance from "./modules/training-attendance/index.jsx";
import TournamentList from "./modules/tournaments/TournamentList.jsx";
import TournamentDetails from "./modules/tournaments/TournamentDetails.jsx";
import Fixtures from "./modules/matches-results/Fixtures.jsx";

import MembershipApplication from "./modules/memberships/MembershipApplication.jsx";
import MyMemberships from "./modules/memberships/MyMemberships.jsx";
import MembershipReview from "./modules/memberships/MembershipReview.jsx";
import FacilityList from "./modules/facilities/FacilityList.jsx";
import FacilityForm from "./modules/facilities/FacilityForm.jsx";
import EquipmentList from "./modules/equipment/EquipmentList.jsx";
import EquipmentForm from "./modules/equipment/EquipmentForm.jsx";
import BookingForm from "./modules/bookings/BookingForm.jsx";
import MyBookings from "./modules/bookings/MyBookings.jsx";
import "./modules/business.css";

function ProtectedRoute({ admin = false, student = false }) {
  const { user, loading, sessionError, reloadSession } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (sessionError) return <div className="standalone-state"><Brand /><div className="card"><h1>Let’s reconnect</h1><Notice>{sessionError}</Notice><Button onClick={reloadSession}>Try again</Button></div></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/profile" replace />;
  if (student && user.role !== "student") return <Navigate to="/profile" replace />;
  return <Outlet />;
}

function Shell() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await logout(); navigate("/login", { replace: true }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const sectionNames = {
    "/memberships/apply": "Apply for membership",
    "/memberships/mine": "My memberships",
    "/admin/memberships": "Membership review",
    "/admin/bookings": "Booking management",
    "/facilities": "Facilities",
    "/equipment": "Equipment",
    "/bookings/new": "Request a booking",
    "/bookings/mine": "My bookings",
    "/announcements": "Announcements",
  };
  const sectionName = sectionNames[location.pathname] || (location.pathname.startsWith("/admin")
    ? "User management"
    : location.pathname.startsWith("/tournaments")
      ? "Tournaments"
      : "My profile");

  return (
    <div className={`app-shell ${user.role}-workspace`}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="sidebar">
        <NavLink to="/profile" className="brand-link" aria-label="NSBM SportsHub home"><Brand /></NavLink>
        <div className="sidebar-section-label">YOUR WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace">
          <NavLink to="/profile"><Icon name="user" />My profile</NavLink>
          {user.role === "admin" && <>
            <NavLink to="/admin/users"><Icon name="users" />User management</NavLink>
            <NavLink to="/admin/bookings"><Icon name="check" />Booking management</NavLink>
          </>}
          <NavLink to="/memberships/apply">Apply for membership</NavLink>
          <NavLink to="/memberships/mine">My memberships</NavLink>
          {user.role === "admin" && <NavLink to="/admin/memberships">Membership review</NavLink>}
          <NavLink to="/facilities">Facilities</NavLink>
          <NavLink to="/equipment">Equipment</NavLink>
          {user.role === "student" && <>
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
          <div><strong>{user.name}</strong><span>{user.role === "admin" ? "Administrator" : "Student"}</span></div>
          <button
            type="button"
            className="icon-button"
            onClick={signOut}
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
          <Outlet context={{ onSignOut: signOut, signingOut: busy }} />
        </main>
        <footer className="workspace-footer"><span>NSBM SportsHub</span><span>Built for our sporting community.</span></footer>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? "/profile" : "/login"} replace />;
}

function AuthFrame() {
  return (
    <div className="auth-route">
      <nav className="auth-module-nav" aria-label="SportsHub previews">
        <Link to="/sports-clubs">Clubs preview</Link>
        <Link to="/training-attendance">Training</Link>
        <Link to="/announcements">Announcements</Link>
      </nav>
      <Outlet />
    </div>
  );
}

function ModulePreview() {
  const { user, loading } = useAuth();
  return (
    <div className="module-preview">
      <a href="#module-content" className="skip-link">Skip to module content</a>
      <div className="module-account-bar">
        <p><strong>Preview</strong><span>Club and training previews use browser demo data. Announcements are saved to SportsHub.</span></p>
        <nav aria-label="Account">
          {loading ? <span role="status">Checking sign-in…</span> : user ? (
            <>
              <Link to="/profile">My profile</Link>
              {user.role === "admin" && <Link to="/admin/users">Manage users</Link>}
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </nav>
      </div>
      <div id="module-content" tabIndex={-1}><Outlet /></div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route element={<AuthFrame />}>
        <Route path="/login" element={<AuthPage key="login" />} />
        <Route path="/register" element={<AuthPage key="register" register />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/memberships/apply" element={<MembershipApplication />} />
          <Route path="/memberships/mine" element={<MyMemberships />} />
          <Route path="/facilities" element={<FacilityList />} />
          <Route path="/facilities/new" element={<ProtectedRoute admin />}><Route index element={<FacilityForm />} /></Route>
          <Route path="/facilities/:resourceId/edit" element={<ProtectedRoute admin />}><Route index element={<FacilityForm />} /></Route>
          <Route path="/equipment" element={<EquipmentList />} />
          <Route path="/equipment/new" element={<ProtectedRoute admin />}><Route index element={<EquipmentForm />} /></Route>
          <Route path="/equipment/:resourceId/edit" element={<ProtectedRoute admin />}><Route index element={<EquipmentForm />} /></Route>
          <Route element={<ProtectedRoute student />}>
            <Route path="/bookings/new" element={<BookingForm />} />
            <Route path="/bookings/mine" element={<MyBookings />} />
          </Route>
          <Route element={<ProtectedRoute admin />}>
            <Route path="/admin/memberships" element={<MembershipReview />} />
          </Route>
          <Route path="/announcements/*" element={<Announcements />} />
          <Route path="/tournaments" element={<TournamentList />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetails />} />
          <Route path="/tournaments/:tournamentId/matches" element={<Fixtures />} />
          <Route element={<ProtectedRoute admin />}>
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/bookings" element={<BookingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route element={<ModulePreview />}>
        <Route path="/sports-clubs/*" element={<SportsClubs />} />
        <Route path="/training-attendance/*" element={<TrainingAttendance />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
