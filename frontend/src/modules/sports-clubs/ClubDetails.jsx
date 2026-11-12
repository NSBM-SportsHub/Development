import { useAuth } from "../../shared/AuthContext.jsx";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function ClubDetails({ clubs, loading, onDelete }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState("");
  const club = clubs.find((item) => item.id === clubId);

  if (loading) {
    return <div className="club-state" role="status">Loading club details…</div>;
  }

  if (!club) {
    return (
      <section className="not-found">
        <p className="eyebrow">Club not found</p>
        <h1>We couldn't find that team.</h1>
        <Link className="primary-button" to="/sports-clubs">Browse all clubs</Link>
      </section>
    );
  }

  async function handleDelete() {
    if (busy || !window.confirm(`Archive ${club.name}? Existing participation and membership history will be kept.`)) return;
    setBusy(true);

    try {
      await onDelete(club.id);
      navigate("/sports-clubs", { replace: true });
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : "Unable to archive the club.");
    } finally { setBusy(false); }
  }

  return (
    <article className="club-details">
      <section className="club-hero" style={{ "--club-image": `url("${club.image}")` }}>
        <div className="club-hero-content">
          <Link className="back-link" to="/sports-clubs">← All clubs</Link>
          <p className="eyebrow">{club.sport} · NSBM Sports Hub</p>
          <h1>{club.name}</h1>
          <p>{club.description}</p>
          <div className="club-actions">
            {user.role === "admin" && <><Link className="light-button" to={`/sports-clubs/${club.id}/edit`}>Edit club <span aria-hidden="true">→</span></Link>
            <button className="danger-button" type="button" disabled={busy} onClick={handleDelete}>Archive club</button></>}
            <span className="club-status">{club.status}</span>
          </div>
          {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        </div>
        <div className="club-mark" aria-hidden="true">{club.sport.slice(0, 1)}</div>
      </section>

      <section className="club-info-grid" aria-label={`${club.name} information`}>
        <div className="club-info-card">
          <span className="info-icon" aria-hidden="true">◉</span>
          <div><small>Club coach</small><strong>{club.coach}</strong></div>
        </div>
        <div className="club-info-card">
          <span className="info-icon" aria-hidden="true">♧</span>
          <div><small>Club community</small><strong>{club.members} active members</strong></div>
        </div>
        <div className="club-info-card">
          <span className="info-icon" aria-hidden="true">◷</span>
          <div><small>Training schedule</small><strong>{club.schedule}</strong></div>
        </div>
      </section>

      <div className="business-actions">{user.role === "admin" && <Link className="business-link" to={`/admin/clubs/${club.id}`}>View members, coaches and activity</Link>}<Link className="business-link" to="/memberships/apply">Apply for membership</Link><Link className="business-link" to="/training-attendance">View training schedule</Link></div>
    </article>
  );
}
