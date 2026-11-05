import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../shared/api.js";
import { useClubAccess } from "../../shared/useClubAccess.js";

export default function TrainingForm({ sessions, loading, onSave }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const session = sessions.find((item) => item.id === sessionId);
  const access = useClubAccess();
  const [clubs, setClubs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setClubsLoading(true);
    setError("");
    api.get("/clubs", { signal: controller.signal }).then((rows) => { if (!controller.signal.aborted) setClubs(rows); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setClubsLoading(false); });
    return () => controller.abort();
  }, [retry]);
  if (loading || clubsLoading || access.loading) return <div className="club-state" role="status">Loading training session...</div>;
  if (sessionId && !session) return <div className="club-state">Session not found. <Link to="/training-attendance">View schedule</Link></div>;
  if (access.error) return <div className="club-state" role="alert">{access.error}</div>;
  const allowedClubs = clubs.filter((club) => access.canManage(club.id));
  if ((session && !access.canManage(session.clubId)) || (!access.isAdmin && !access.assignments.length)) return <div className="club-state" role="alert">Only administrators and assigned club coaches can manage training.</div>;
  async function submit(event) {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    const values = new FormData(event.currentTarget);
    if (values.get("endTime") <= values.get("startTime")) { setError("End time must be later than start time."); return; }
    setBusy(true); setError("");
    try {
      const id = await onSave({ id: session?.id, title: values.get("title").trim(), clubId: values.get("clubId"), club: clubs.find((club) => String(club.id) === values.get("clubId"))?.name, date: values.get("date"), startTime: values.get("startTime"), endTime: values.get("endTime"), description: values.get("description").trim(), status: values.get("status") });
      navigate("/training-attendance/" + id);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="training-form-page"><div className="training-form-aside"><Link className="back-link" to="/training-attendance">Back to schedule</Link><p className="eyebrow">Training management</p><h1>{session ? "Edit session" : "Create training session"}</h1><p>Plan and manage practice for your clubs.</p></div>
    <form key={session?.id || "new"} className="training-form" onSubmit={submit}>
      <label>Session name<input name="title" defaultValue={session?.title || ""} maxLength="150" required disabled={busy} /></label>
      <label>Club<select aria-label="Club" name="clubId" defaultValue={session?.clubId || ""} required disabled={busy}><option value="">Choose a club</option>{allowedClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
      <label>Date<input name="date" type="date" defaultValue={session?.date || ""} required disabled={busy} /></label>
      <div className="training-form-row"><label>Start time<input name="startTime" type="time" defaultValue={session?.startTime || ""} required disabled={busy} /></label><label>End time<input name="endTime" type="time" defaultValue={session?.endTime || ""} required disabled={busy} /></label></div>
      <label>Status<select aria-label="Status" name="status" defaultValue={session?.status || "scheduled"} disabled={busy}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      <label>Notes (optional)<textarea name="description" rows="4" maxLength="2000" defaultValue={session?.description || ""} disabled={busy} /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      {!allowedClubs.length && <p>No active clubs are available to manage.</p>}
      <button type="submit" className="primary-button form-submit" disabled={busy || !allowedClubs.length}>{busy ? "Saving..." : session ? "Save changes" : "Create session"}</button>
      {error && <button type="button" className="business-text-button" onClick={() => setRetry(retry + 1)}>Reload clubs</button>}
    </form></section>;
}
