import { Link, useParams } from "react-router-dom";

function formatDate(value) {
  if (!value) return "Date not set";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AnnouncementList({ announcements }) {
  const { announcementId } = useParams();
  const announcement = announcements.find((item) => item.id === announcementId);

  if (announcementId) {
    if (!announcement) {
      return (
        <section className="not-found">
          <p className="eyebrow">Announcement not found</p>
          <h1>We couldn't find that announcement.</h1>
          <Link className="primary-button" to="/announcements">View announcements</Link>
        </section>
      );
    }

    return (
      <article className="announcement-detail">
        <Link className="announcement-back" to="/announcements">← All announcements</Link>
        <div className="announcement-detail-heading">
          <span className={`announcement-status ${announcement.status.toLowerCase()}`}>{announcement.status}</span>
          <p className="eyebrow">{formatDate(announcement.date)} · {announcement.author}</p>
          <h1>{announcement.title}</h1>
          <p className="announcement-audience">Audience labels: {announcement.audience.length ? announcement.audience.join(", ") : "Not specified"}</p>
        </div>
        <div className="announcement-body">{announcement.body}</div>
        <Link className="primary-button" to={`/announcements/${announcement.id}/edit`}>Edit announcement <span aria-hidden="true">→</span></Link>
      </article>
    );
  }

  return (
    <section className="announcement-page">
      <div className="announcement-heading">
        <div>
          <p className="eyebrow">News from the hub</p>
          <h1>Sports <span>Announcements</span></h1>
          <p className="clubs-intro">The latest updates from the NSBM sports community.</p>
        </div>
        <Link className="primary-button" to="/announcements/new">Create announcement <span aria-hidden="true">→</span></Link>
      </div>
      <div className="announcement-list">
        {announcements.length ? announcements.map((item) => (
          <article className="announcement-card" key={item.id}>
            <Link className="announcement-card-link" to={`/announcements/${item.id}`}>
              <span className="announcement-card-meta">
                <span className={`announcement-status ${item.status.toLowerCase()}`}>{item.status}</span>
                <span>{formatDate(item.date)}</span>
              </span>
              <strong>{item.title}</strong>
              <span className="announcement-preview">{item.body}</span>
              <span className="announcement-card-audience">Audience labels: {item.audience.length ? item.audience.join(", ") : "Not specified"}</span>
            </Link>
            <Link className="announcement-edit" to={`/announcements/${item.id}/edit`}>Edit</Link>
          </article>
        )) : (
          <div className="club-state">No announcements yet. <Link to="/announcements/new">Create the first announcement</Link>.</div>
        )}
      </div>
      <p className="sample-note">Temporary sample announcements. Audience values are labels only; permissions are not enforced.</p>
    </section>
  );
}
