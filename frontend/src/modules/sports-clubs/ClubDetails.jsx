import { Link, useParams } from "react-router-dom";

export default function ClubDetails({ clubs, loading }) {
  const { clubId } = useParams();
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

  return (
    <article className="club-details">
      <section className="club-hero" style={{ "--club-image": `url("${club.image}")` }}>
        <div className="club-hero-content">
          <Link className="back-link" to="/sports-clubs">← All clubs</Link>
          <p className="eyebrow">{club.sport} · NSBM Sports Hub</p>
          <h1>{club.name}</h1>
          <p>{club.description}</p>
          <div className="club-actions">
            <Link className="light-button" to={`/sports-clubs/${club.id}/edit`}>Edit club <span aria-hidden="true">→</span></Link>
            <span className="club-status">{club.status}</span>
          </div>
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

      <section className="club-gallery">
        <div className="gallery-heading">
          <div><p className="eyebrow">Moments together</p><h2>Club <span>Photos</span></h2></div>
          <span className="gallery-caption">A glimpse into our community</span>
        </div>
        <div className="gallery-grid">
          {[0, 1, 2, 3, 4, 5].map((image) => (
            <img
              key={image}
              src={club.image.replace("w=900", "w=700") + `&sat=${image * 8}`}
              alt={`${club.name} training and club activities`}
              loading="lazy"
            />
          ))}
        </div>
      </section>
    </article>
  );
}
