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
import "./shared/integrated-workflows.css";
import BookingReview from "./modules/bookings/index.jsx";
import BookingEdit from "./modules/bookings/BookingEdit.jsx";
import CoachAssignments from "./modules/memberships/CoachAssignments.jsx";
import NotificationsPage from "./modules/notifications/NotificationsPage.jsx";
import ParticipationPage from "./modules/reports/ParticipationPage.jsx";

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
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await logout(); navigate("/login", { replace: true }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const Layout = user.role === "admin" ? AdminLayout : StudentLayout;
  return <Layout user={user} busy={busy} error={error} onSignOut={signOut}><Outlet context={{ onSignOut: signOut, signingOut: busy }} /></Layout>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? "/profile" : "/login"} replace />;
}

function AuthFrame() {
  return (
    <div className="auth-route">
      <nav className="auth-module-nav" aria-label="SportsHub modules">
        <Link to="/sports-clubs">Clubs</Link>
        <Link to="/training-attendance">Training</Link>
        <Link to="/announcements">Announcements</Link>
      </nav>
      <Outlet />
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
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/participation" element={<ParticipationPage key="personal" />} />
          <Route element={<ProtectedRoute admin />}>
            <Route path="/admin/reports" element={<ParticipationPage key="admin" admin />} />
          </Route>
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
            <Route path="/bookings/:bookingId/edit" element={<BookingEdit />} />
          </Route>
          <Route element={<ProtectedRoute admin />}>
            <Route path="/admin/memberships" element={<MembershipReview />} />
            <Route path="/admin/bookings" element={<BookingReview />} />
            <Route path="/admin/coaches" element={<CoachAssignments />} />
          </Route>
          <Route path="/memberships/review" element={<MembershipReview />} />
          <Route path="/sports-clubs/*" element={<SportsClubs />} />
          <Route path="/training-attendance/*" element={<TrainingAttendance />} />
          <Route path="/announcements/*" element={<Announcements />} />
          <Route path="/tournaments" element={<TournamentList />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetails />} />
          <Route path="/tournaments/:tournamentId/matches" element={<Fixtures />} />
          <Route element={<ProtectedRoute admin />}>
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
