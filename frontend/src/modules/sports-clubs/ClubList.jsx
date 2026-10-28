import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

export default function ClubList({ clubs, loading, error, onRetry }) {
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState("");
  const sports = useMemo(() => [...new Set(clubs.map((club) => club.sport))].sort(), [clubs]);
  const filteredClubs = clubs.filter((club) => {
    const searchText = `${club.name} ${club.sport}`.toLowerCase();
    return searchText.includes(query.trim().toLowerCase()) &&
      (!sport || club.sport === sport) &&
      (!status || club.status === status);
  });

  return (
    <section className="club-list-page" aria-labelledby="clubs-title">
      <div className="clubs-panel">
        <div className="clubs-heading">
          <div>
            <p className="eyebrow">Find your team</p>
            <h1 id="clubs-title">Sports <span>Clubs</span></h1>
            <p className="clubs-intro">Discover your passion. Play your part. Grow together.</p>
          </div>
          <Link className="primary-button" to="/sports-clubs/new">Create a club <span aria-hidden="true">→</span></Link>
        </div>

        <div className="club-filters" aria-label="Filter clubs">
          <label className="club-search">
            <span className="visually-hidden">Search by club name or sport</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clubs or sports" />
          </label>
          <label>
            <span className="visually-hidden">Filter by sport</span>
            <select value={sport} onChange={(event) => setSport(event.target.value)}>
              <option value="">All sports</option>
              {sports.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Filter by status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {[...new Set(clubs.map((club) => club.status))].sort().map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        </div>

        {error && <div className="club-state club-error" role="alert">{error} <button type="button" onClick={onRetry}>Try again</button></div>}
        {loading ? (
          <div className="club-state" role="status">Loading clubs…</div>
        ) : filteredClubs.length ? (
          <div className="club-grid">
          {filteredClubs.map((club) => (
            <Link className="club-card" to={`/sports-clubs/${club.id}`} key={club.id}>
              <img src={club.image} alt="" loading="lazy" />
              <span className="club-card-label">
                <small>{club.sport} · {club.status}</small>
                <strong>{club.name}</strong>
                <span className="club-card-arrow" aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
          </div>
        ) : (
          <div className="club-state">No clubs match your search or filters. Try changing them or <button type="button" onClick={() => { setQuery(""); setSport(""); setStatus(""); }}>clear filters</button>.</div>
        )}
        <p className="sample-note">Explore our clubs and find the right team for you.</p>
      </div>
    </section>
  );
}
