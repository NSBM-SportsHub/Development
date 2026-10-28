import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function TrainingForm({ sessions, loading, onSave }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const session = sessions.find((item) => item.id === sessionId);
  const editing = Boolean(sessionId);
  const [error, setError] = useState("");

  if (loading) return <div className="club-state" role="status">Loading session information…</div>;
  if (editing && !session) {
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
    const startTime = values.get("startTime");
    const endTime = values.get("endTime");
    if (endTime <= startTime) {
      setError("End time must be later than start time.");
      return;
    }

    try {
      const id = onSave({
        id: session?.id,
        title: values.get("title").trim(),
        club: values.get("club").trim(),
        date: values.get("date"),
        startTime,
        endTime,
        location: values.get("location").trim(),
        coach: values.get("coach").trim(),
        capacity: Number(values.get("capacity")),
        description: values.get("description").trim(),
      });
      navigate(`/training-attendance/${id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the session.");
    }
  }

  return (
    <section className="training-form-page">
      <div className="training-form-aside">
        <Link className="back-link" to={session ? `/training-attendance/${session.id}` : "/training-attendance"}>← Back to schedule</Link>
        <p className="eyebrow">{editing ? "Session management" : "Plan a practice"}</p>
        <h1>{editing ? "Edit session." : "Make time to play."}</h1>
        <p>Bring your team together with a clear plan for the next training session.</p>
        <span className="form-decoration" aria-hidden="true">NSBM<br />SPORTS HUB</span>
      </div>
      <form className="training-form" onSubmit={handleSubmit}>
        <div className="form-title">
          <p className="eyebrow">{editing ? "Session details" : "New session"}</p>
          <h2>{editing ? "Update training session" : "Create a session"}</h2>
        </div>
        <label>Session name<input name="title" defaultValue={session?.title ?? ""} minLength="3" maxLength="80" required /></label>
        <label>Club<input name="club" defaultValue={session?.club ?? ""} minLength="2" maxLength="80" required /></label>
        <div className="training-form-row">
          <label>Date<input name="date" type="date" defaultValue={session?.date ?? ""} required /></label>
          <label>Capacity<input name="capacity" type="number" defaultValue={session?.capacity ?? 20} min="1" max="500" required /></label>
        </div>
        <div className="training-form-row">
          <label>Start time<input name="startTime" type="time" defaultValue={session?.startTime ?? ""} required /></label>
          <label>End time<input name="endTime" type="time" defaultValue={session?.endTime ?? ""} required /></label>
        </div>
        <label>Location<input name="location" defaultValue={session?.location ?? ""} maxLength="100" required /></label>
        <label>Coach<input name="coach" defaultValue={session?.coach ?? ""} maxLength="80" required /></label>
        <label>Description<textarea name="description" rows="4" defaultValue={session?.description ?? ""} minLength="10" maxLength="500" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" type="submit">{editing ? "Save changes" : "Create session"} <span aria-hidden="true">→</span></button>
        <p className="form-note">Preview only — saved locally in this browser.</p>
      </form>
    </section>
  );
}
