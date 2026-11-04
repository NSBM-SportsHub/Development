import { Link, useNavigate, useParams } from "react-router-dom";

function Actions({ announcement, onPin, onDelete }) {
  async function remove() {
    if (!window.confirm("Soft-delete this announcement? It will no longer be visible to users.")) return;
    await onDelete(announcement.announcement_id);
  }

  return (
    <div className="announcement-actions">
      <button className="announcement-edit" type="button" onClick={() => onPin(announcement.announcement_id, !announcement.is_pinned)}>
        {announcement.is_pinned ? "Unpin" : "Pin"}
      </button>
      <Link className="announcement-edit" to={`/announcements/${announcement.announcement_id}/edit`}>Edit</Link>
      <button className="announcement-delete" type="button" onClick={() => remove().catch(() => {})}>Delete</button>
    </div>
  );
}

export default function AnnouncementList({ announcements, isAdmin, loading = false, error = "", onPin, onDelete }) {
  const { announcementId } = useParams();
  const navigate = useNavigate();
  const announcement = announcements.find((item) => item.announcement_id === announcementId);

  if (loading) return <div className="club-state" role="status">Loading announcements…</div>;
  if (error) {
    return (
      <div className="club-state" role="alert">
        {error}{error.includes("Sign in") && <> <Link to="/login">Sign in</Link>.</>}
      </div>
    );
  }

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
        {announcement.is_pinned && <span className="announcement-status">Pinned</span>}
        <div className="announcement-detail-heading">
          <p className="eyebrow">{announcement.club_id === null ? "Campus-wide" : `Club ${announcement.club_id}`}</p>
          <h1>{announcement.title}</h1>
        </div>
        <div className="announcement-body">{announcement.body}</div>
        {isAdmin && (
          <div className="announcement-admin-actions">
            <Link className="primary-button" to={`/announcements/${announcement.announcement_id}/edit`}>Edit announcement <span aria-hidden="true">→</span></Link>
            <button className="secondary-button" type="button" onClick={() => onPin(announcement.announcement_id, !announcement.is_pinned)}>
              {announcement.is_pinned ? "Unpin" : "Pin"}
            </button>
            <button className="announcement-delete" type="button" onClick={() => {
              if (!window.confirm("Soft-delete this announcement? It will no longer be visible to users.")) return;
              onDelete(announcement.announcement_id).then(() => navigate("/announcements")).catch(() => {});
            }}>Delete</button>
          </div>
        )}
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
        {isAdmin && <Link className="primary-button" to="/announcements/new">Create announcement <span aria-hidden="true">→</span></Link>}
      </div>
      <div className="announcement-list">
        {announcements.length ? announcements.map((item) => (
          <article className="announcement-card" key={item.announcement_id}>
            <Link className="announcement-card-link" to={`/announcements/${item.announcement_id}`}>
              <span className="announcement-card-meta">
                {item.is_pinned && <span className="announcement-status">Pinned</span>}
                <span>{item.club_id === null ? "Campus-wide" : `Club ${item.club_id}`}</span>
              </span>
              <strong>{item.title}</strong>
              <span className="announcement-preview">{item.body}</span>
            </Link>
            {isAdmin && <Actions announcement={item} onPin={onPin} onDelete={onDelete} />}
          </article>
        )) : (
          <div className="club-state">No announcements yet.{isAdmin && <> <Link to="/announcements/new">Create the first announcement</Link>.</>}</div>
        )}
      </div>
    </section>
  );
}
