import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { attendanceService } from "./attendanceService.js";
import { api } from "../../shared/api.js";
import { useClubAccess } from "../../shared/useClubAccess.js";

export default function AttendanceForm({ sessions, loading }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const session = sessions.find((item) => item.id === sessionId);
  const access = useClubAccess();
  const [members, setMembers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!session || access.loading || !access.canManage(session.clubId)) { setFetching(false); return () => controller.abort(); }
    setFetching(true); setError("");
    (async () => {
      try {
        const all = [];
        let page = 1, last = 1;
        do {
          const result = await api.get("/memberships?status=approved&per_page=100&club_id=" + session.clubId + "&page=" + page, { signal: controller.signal });
          all.push(...result.memberships); last = result.pagination.total_pages; page++;
        } while (page <= last);
        const records = await attendanceService.list(session.id, { signal: controller.signal });
        if (!controller.signal.aborted) setMembers(all.filter((member) => !records.some((row) => Number(row.participant_id) === Number(member.user_id))));
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
      finally { if (!controller.signal.aborted) setFetching(false); }
    })();
    return () => controller.abort();
  }, [session?.id, session?.clubId, access.loading, access.isAdmin, JSON.stringify(access.assignments), retry]);
  if (loading || access.loading || fetching) return <div className="club-state" role="status">Loading participants...</div>;
  if (!session) return <div className="club-state">Session not found.</div>;
  if (!access.canManage(session.clubId)) return <div className="club-state" role="alert">Only the assigned club coaches and administrators can record attendance.</div>;
  if (session.status === "cancelled") return <div className="club-state">Attendance cannot be recorded for a cancelled session. <Link to="/training-attendance">View schedule</Link></div>;
  async function submit(event) {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await attendanceService.save({ sessionId: session.id, participantId: form.get("participantId"), status: form.get("status"), notes: form.get("notes").trim() });
      navigate("/training-attendance/" + session.id + "/attendance");
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="training-form-page"><div className="training-form-aside"><Link className="back-link" to={"/training-attendance/" + session.id + "/attendance"}>Back to attendance</Link><h1>Record attendance</h1><p>{session.title} - {session.club}</p></div>
    <form className="training-form" onSubmit={submit}>
      <label>Participant<select aria-label="Participant" name="participantId" required disabled={busy || !members.length}><option value="">Choose an approved member</option>{members.map((member) => <option key={member.id} value={member.user_id}>{member.user_name} (#{member.user_id})</option>)}</select></label>
      <label>Attendance status<select aria-label="Attendance status" name="status" disabled={busy}>{["Present", "Late", "Absent", "Excused"].map((status) => <option key={status}>{status}</option>)}</select></label>
      <label>Notes (optional)<textarea name="notes" maxLength="2000" rows="3" disabled={busy} /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      {!members.length && !error && <p>No approved members remain without an attendance record for this session.</p>}
      <button type="submit" className="primary-button form-submit" disabled={busy || !members.length}>{busy ? "Saving..." : "Save attendance"}</button>
      {error && <button type="button" onClick={() => setRetry(retry + 1)}>Reload participants</button>}
    </form></section>;
}
