import { Link } from "react-router-dom";

export default function ClubList({ clubs }) {
  return (
    <section className="club-list-page" aria-labelledby="clubs-title">
      <div className="clubs-panel">
        <div className="clubs-heading">
          <div>
            <p className="eyebrow">Find your team</p>
            <h1 id="clubs-title">Sports <span>Clubs</span></h1>
            <p className="clubs-intro">Discover your passion. Play your part. Grow together.</p>
          </div>
          <Link className="primary-button" to="/sports-clubs/new">Join a club <span aria-hidden="true">→</span></Link>
        </div>

        <div className="club-grid">
          {clubs.map((club) => (
            <Link className="club-card" to={`/sports-clubs/${club.id}`} key={club.id}>
              <img src={club.image} alt="" loading="lazy" />
              <span className="club-card-label">
                <small>{club.sport}</small>
                <strong>{club.name}</strong>
                <span className="club-card-arrow" aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="sample-note">Explore our clubs and find the right team for you.</p>
      </div>
    </section>
  );
}
