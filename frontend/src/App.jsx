import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./shared/AuthContext.jsx";
import { Brand, Button, Loading, Notice } from "./shared/ui.jsx";
import StudentLayout from "./shared/StudentLayout.jsx";
import AdminLayout from "./shared/AdminLayout.jsx";
import AuthPage from "./modules/authentication-users/AuthPage.jsx";
import ProfilePage from "./modules/authentication-users/ProfilePage.jsx";
import UsersPage from "./modules/authentication-users/UsersPage.jsx";
import Announcements from "./modules/announcements/index.jsx";
import SportsClubs from "./modules/sports-clubs/index.jsx";
import TrainingAttendance from "./modules/training-attendance/index.jsx";
import TournamentList from "./modules/tournaments/TournamentList.jsx";
import TournamentDetails from "./modules/tournaments/TournamentDetails.jsx";
import Fixtures from "./modules/matches-results/Fixtures.jsx";

function ProtectedRoute({ admin = false }) {
  const { user, loading, sessionError, reloadSession } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (sessionError) return <div className="standalone-state"><Brand /><div className="card"><h1>Let’s reconnect</h1><Notice>{sessionError}</Notice><Button onClick={reloadSession}>Try again</Button></div></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/profile" replace />;
  return <Outlet />;
}

function Shell() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await logout(); navigate("/login", { replace: true }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const Layout = user.role === "admin" ? AdminLayout : StudentLayout;
  return <Layout user={user} busy={busy} error={error} onSignOut={signOut}><Outlet /></Layout>;
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
        <p><strong>Preview</strong><span>Demo records stay in this browser. Announcements reset on reload.</span></p>
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
          <Route path="/tournaments" element={<TournamentList />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetails />} />
          <Route path="/tournaments/:tournamentId/matches" element={<Fixtures />} />
          <Route element={<ProtectedRoute admin />}>
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route element={<ModulePreview />}>
        <Route path="/sports-clubs/*" element={<SportsClubs />} />
        <Route path="/training-attendance/*" element={<TrainingAttendance />} />
        <Route path="/announcements/*" element={<Announcements />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
