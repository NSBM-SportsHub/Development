import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { attendanceService } from "./attendanceService.js";
import { useClubAccess } from "../../shared/useClubAccess.js";
import { statusLabel } from "../../shared/business.js";

export default function AttendanceList({ sessions, loading }) {
  const { sessionId } = useParams();
  const session = sessions.find((item) => item.id === sessionId);
  const access = useClubAccess();
  const [records, setRecords] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFetching(true); setError("");
    attendanceService.list(sessionId, { signal: controller.signal }).then((rows) => { if (!controller.signal.aborted) setRecords(rows); })
      .catch((failure) => { if (!controller.signal.aborted) { setRecords([]); setError(failure.message); } })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [sessionId, reload]);
  if (loading || fetching || access.loading) return <div className="club-state" role="status">Loading attendance...</div>;
  if (!session) return <div className="club-state">Session not found.</div>;
  return <section className="attendance-view"><div className="training-heading"><div><Link className="attendance-back" to={"/training-attendance/" + session.id}>Back to {session.title}</Link><p className="eyebrow">{session.club} - {session.date}</p><h1>Session Attendance</h1></div>
    {access.canManage(session.clubId) && session.status !== "cancelled" && <Link className="primary-button" to={"/training-attendance/" + session.id + "/attendance/record"}>Record attendance</Link>}</div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button type="button" className="business-text-button" onClick={() => setReload(reload + 1)}>Refresh attendance</button>
    {records.length ? <div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Participant</th><th>Student ID</th><th>Status</th><th>Notes</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.participant_name || "User #" + record.participant_id}</td><td>{record.student_id || "Not provided"}</td><td><span className={"attendance-status status-" + record.status}>{statusLabel(record.status)}</span></td><td>{record.notes || "-"}</td></tr>)}</tbody></table></div> : !error && <div className="club-state">No attendance records are available in your permitted view.</div>}
    {!access.canManage(session.clubId) && <p className="sample-note">You can view your own attendance records.</p>}
  </section>;
}
