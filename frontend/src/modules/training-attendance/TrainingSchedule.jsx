import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useClubAccess } from "../../shared/useClubAccess.js";
import { statusLabel } from "../../shared/business.js";
const dateLabel = (value) => new Date(value + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function TrainingSchedule({ sessions, loading, onCancel }) {
  const { sessionId } = useParams();
  const session = sessions.find((item) => item.id === sessionId);
  const access = useClubAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  if (loading || access.loading) return <div className="club-state" role="status">Loading training schedule...</div>;
  async function cancel() {
    if (busy || !window.confirm("Cancel this training session? Attendance history will be kept.")) return;
    setBusy(true); setError("");
    try { await onCancel(session.id); } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  if (sessionId) {
    if (!session) return <div className="club-state">Session not found. <Link to="/training-attendance">View schedule</Link></div>;
    return <article className="training-detail"><div className="training-detail-banner"><Link className="back-link" to="/training-attendance">Back to schedule</Link><p className="eyebrow">{session.club}</p><h1>{session.title}</h1><p>{session.description}</p>
      <div className="training-detail-actions"><Link className="light-button" to={"/training-attendance/" + session.id + "/attendance"}>View attendance</Link>{access.canManage(session.clubId) && <><Link className="training-edit-link" to={"/training-attendance/" + session.id + "/edit"}>Edit session</Link>{session.status !== "cancelled" && <button type="button" className="danger-button" disabled={busy} onClick={cancel}>Cancel session</button>}</>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}{access.error && <p className="form-error" role="alert">{access.error}</p>}</div>
      <div className="training-facts"><div><small>Date</small><strong>{dateLabel(session.date)}</strong></div><div><small>Time</small><strong>{session.startTime} - {session.endTime}</strong></div><div><small>Status</small><strong>{statusLabel(session.status)}</strong></div><div><small>Club</small><strong>{session.club}</strong></div></div></article>;
  }
  const filtered = sessions.filter((item) => (!status || item.status === status) && (item.title + " " + item.club).toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="training-schedule"><div className="training-heading"><div><p className="eyebrow">Train together</p><h1>Training Schedule</h1><p>Find your next session and make every practice count.</p></div>{(access.isAdmin || access.assignments.length > 0) && <Link className="primary-button" to="/training-attendance/new">Create session</Link>}</div>
    {access.error && <p role="alert" className="form-error">{access.error}</p>}
    <div className="club-filters"><label>Search sessions<input value={query} onChange={(event) => setQuery(event.target.value)} /></label><label>Session status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["scheduled", "completed", "cancelled"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label></div>
    <div className="training-list">{filtered.length ? filtered.map((item) => <Link className="training-card" to={"/training-attendance/" + item.id} key={item.id}><span className="training-date"><strong>{new Date(item.date + "T00:00:00").getDate()}</strong><small>{new Date(item.date + "T00:00:00").toLocaleDateString(undefined, { month: "short" })}</small></span><span className="training-card-main"><small>{item.club} - {dateLabel(item.date)}</small><strong>{item.title}</strong><span>{item.startTime} - {item.endTime} - {statusLabel(item.status)}</span></span></Link>) : <div className="club-state">No training sessions match your filters.</div>}</div></section>;
}
