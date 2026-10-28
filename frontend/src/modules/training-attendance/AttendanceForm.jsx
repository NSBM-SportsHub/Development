import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { attendanceService } from "./attendanceService.js";

export default function AttendanceForm({ sessions, loading }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const session = sessions.find((item) => item.id === sessionId);
  const [error, setError] = useState("");

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

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);

    try {
      attendanceService.save({
        sessionId: session.id,
        participantName: values.get("participantName").trim(),
        studentId: values.get("studentId").trim(),
        status: values.get("status"),
        notes: values.get("notes").trim(),
        recordedAt: new Date().toISOString(),
      });
      navigate(`/training-attendance/${session.id}/attendance`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to record attendance.");
    }
  }

  return (
    <section className="training-form-page attendance-form-page">
      <div className="training-form-aside">
        <Link className="back-link" to={`/training-attendance/${session.id}/attendance`}>← Back to attendance</Link>
        <p className="eyebrow">{session.club}</p>
        <h1>Record attendance.</h1>
        <p>{session.title} · {session.date}</p>
        <span className="form-decoration" aria-hidden="true">NSBM<br />SPORTS HUB</span>
      </div>
      <form className="training-form" onSubmit={handleSubmit}>
        <div className="form-title">
          <p className="eyebrow">Session attendance</p>
          <h2>Add participant</h2>
        </div>
        <label>Participant name<input name="participantName" minLength="2" maxLength="100" autoComplete="name" required /></label>
        <label>Student ID<input name="studentId" minLength="2" maxLength="40" required /></label>
        <label>Attendance status
          <select name="status" defaultValue="Present" required>
            <option>Present</option>
            <option>Late</option>
            <option>Absent</option>
          </select>
        </label>
        <label>Notes <span className="optional-label">(optional)</span><textarea name="notes" rows="3" maxLength="300" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" type="submit">Save attendance <span aria-hidden="true">→</span></button>
        <p className="form-note">Preview only — stored locally in this browser.</p>
      </form>
    </section>
  );
}
