import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { attendanceService } from "./attendanceService.js";

export default function AttendanceList({ sessions, loading }) {
  const { sessionId } = useParams();
  const session = sessions.find((item) => item.id === sessionId);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    try {
      setRecords(attendanceService.list(session.id));
      setError("");
    } catch (loadError) {
      setRecords([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load attendance.");
    }
  }, [session]);

  if (loading) return <div className="club-state" role="status">Loading session information…</div>;
  if (!session) {
    return (
      <section className="not-found">
        <p className="eyebrow">Session not found</p>
        <h1>We couldn't find that training session.</h1>
        <Link className="primary-button" to="/training-attendance">View schedule</Link>
      </section>
    );
  }

  return (
    <section className="attendance-view">
      <div className="training-heading">
        <div>
          <Link className="attendance-back" to={`/training-attendance/${session.id}`}>← {session.title}</Link>
          <p className="eyebrow">{session.club} · {session.date}</p>
          <h1>Session <span>Attendance</span></h1>
        </div>
        <Link className="primary-button" to={`/training-attendance/${session.id}/attendance/record`}>Record attendance <span aria-hidden="true">→</span></Link>
      </div>
      {error && <div className="club-state club-error" role="alert">{error}</div>}
      {records.length ? (
        <div className="attendance-table-wrap">
          <table className="attendance-table">
            <thead><tr><th>Participant</th><th>Student ID</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.participantName}</td>
                  <td>{record.studentId}</td>
                  <td><span className={`attendance-status status-${record.status.toLowerCase()}`}>{record.status}</span></td>
                  <td>{record.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !error ? (
        <div className="club-state">No attendance recorded for this session yet. <Link to={`/training-attendance/${session.id}/attendance/record`}>Add the first participant</Link>.</div>
      ) : null}
      <p className="sample-note">Attendance records are preview data saved in this browser.</p>
    </section>
  );
}
