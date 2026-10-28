import { Link, useParams } from "react-router-dom";

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time) {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TrainingSchedule({ sessions, loading }) {
  const { sessionId } = useParams();
  const session = sessions.find((item) => item.id === sessionId);

  if (loading) return <div className="club-state" role="status">Loading training schedule…</div>;

  if (sessionId) {
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
      <article className="training-detail">
        <div className="training-detail-banner">
          <Link className="back-link" to="/training-attendance">← Back to schedule</Link>
          <p className="eyebrow">{session.club}</p>
          <h1>{session.title}</h1>
          <p>{session.description}</p>
          <Link className="light-button" to={`/training-attendance/${session.id}/edit`}>Edit session <span aria-hidden="true">→</span></Link>
        </div>
        <div className="training-facts">
          <div><small>Date</small><strong>{formatDate(session.date)}</strong></div>
          <div><small>Time</small><strong>{formatTime(session.startTime)} – {formatTime(session.endTime)}</strong></div>
          <div><small>Location</small><strong>{session.location}</strong></div>
          <div><small>Coach</small><strong>{session.coach}</strong></div>
          <div><small>Capacity</small><strong>{session.capacity} participants</strong></div>
        </div>
      </article>
    );
  }

  const orderedSessions = [...sessions].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  return (
    <section className="training-schedule" aria-labelledby="schedule-title">
      <div className="training-heading">
        <div>
          <p className="eyebrow">Train together</p>
          <h1 id="schedule-title">Training <span>Schedule</span></h1>
          <p className="clubs-intro">Find your next session and make every practice count.</p>
        </div>
        <Link className="primary-button" to="/training-attendance/new">Create session <span aria-hidden="true">→</span></Link>
      </div>
      <div className="training-list">
        {orderedSessions.length ? orderedSessions.map((item) => (
          <Link className="training-card" to={`/training-attendance/${item.id}`} key={item.id}>
            <span className="training-date"><strong>{new Date(`${item.date}T00:00:00`).getDate()}</strong><small>{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: "short" })}</small></span>
            <span className="training-card-main">
              <small>{item.club} · {formatDate(item.date)}</small>
              <strong>{item.title}</strong>
              <span>{formatTime(item.startTime)} – {formatTime(item.endTime)} <span aria-hidden="true">·</span> {item.location}</span>
            </span>
            <span className="training-arrow" aria-hidden="true">↗</span>
          </Link>
        )) : (
          <div className="club-state">No training sessions are scheduled yet. <Link to="/training-attendance/new">Create the first session</Link>.</div>
        )}
      </div>
      <p className="sample-note">Training information is temporary sample data stored in this browser.</p>
    </section>
  );
}
