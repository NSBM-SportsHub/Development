import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../shared/api.js";
import { useAuth } from "../../shared/AuthContext.jsx";
import { Button, Icon, Loading, Notice } from "../../shared/ui.jsx";
import TournamentForm from "./TournamentForm.jsx";
import "./tournaments.css";

const statuses = ["draft", "registration_open", "registration_closed", "in_progress", "completed", "cancelled"];
const transitions = {
  draft: ["registration_open", "cancelled"],
  registration_open: ["registration_closed", "cancelled"],
  registration_closed: ["registration_open", "in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const statusLabels = {
  draft: "Draft",
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function dateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function TournamentList() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadTournaments = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get("/tournaments", { signal });
      if (!signal?.aborted) setTournaments(result);
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadTournaments(controller.signal);
    return () => controller.abort();
  }, [loadTournaments]);

  const visibleTournaments = useMemo(() => tournaments.filter((tournament) => (
    (filter === "all" || tournament.status === filter)
    && `${tournament.name} ${tournament.sport_name} ${tournament.format}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [filter, query, tournaments]);

  async function changeStatus(tournament, status) {
    setBusyId(tournament.id);
    setError("");
    setNotice("");
    try {
      const updated = status === "cancelled"
        ? await api.delete(`/tournaments/${tournament.id}`)
        : await api.patch(`/tournaments/${tournament.id}`, { status });
      setTournaments((current) => status === "cancelled"
        ? current.map((item) => item.id === tournament.id ? { ...item, status } : item)
        : current.map((item) => item.id === tournament.id ? updated : item));
      setNotice(status === "cancelled" ? "Tournament cancelled." : `Tournament status changed to ${statusLabels[status].toLowerCase()}.`);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusyId(null);
    }
  }

  function saved(tournament, message) {
    setTournaments((current) => {
      const exists = current.some((item) => item.id === tournament.id);
      return exists
        ? current.map((item) => item.id === tournament.id ? tournament : item)
        : [tournament, ...current];
    });
    setEditor(null);
    setNotice(message);
    setError("");
  }

  return (
    <section className="tournaments-page" aria-labelledby="tournaments-title">
      <div className="tournaments-heading">
        <div>
          <p className="eyebrow">COMPETITIONS</p>
          <h1 id="tournaments-title">Tournaments</h1>
          <p>Find upcoming competitions and follow their progress.</p>
        </div>
        {isAdmin && <Button onClick={() => setEditor({})}><Icon name="plus" size={18} />Create tournament</Button>}
      </div>
      <Notice type="success">{notice}</Notice>
      <Notice>{error}</Notice>

      <div className="tournament-filters" role="search">
        <label className="field">
          <span>Search tournaments</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, sport or format" />
        </label>
        <label className="field">
          <span>Filter by status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.filter((status) => isAdmin || status !== "draft").map((status) => (
              <option value={status} key={status}>{statusLabels[status]}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <Loading message="Loading tournaments…" /> : error && tournaments.length === 0 ? (
        <div className="tournament-state"><Button className="button-secondary" onClick={() => loadTournaments()}>Try again</Button></div>
      ) : visibleTournaments.length ? (
        <div className="tournament-grid">
          {visibleTournaments.map((tournament) => (
            <article className="tournament-card" key={tournament.id}>
              <div className="tournament-card-heading">
                <span className={`tournament-status status-${tournament.status}`}>{statusLabels[tournament.status] || tournament.status}</span>
                <span className="tournament-format">{tournament.format}</span>
              </div>
              <h2>{tournament.name}</h2>
              <p className="tournament-sport">{tournament.sport_name}</p>
              {tournament.description && <p className="tournament-description">{tournament.description}</p>}
              <dl className="tournament-facts">
                <div><dt>Dates</dt><dd>{dateLabel(tournament.starts_on)} – {dateLabel(tournament.ends_on)}</dd></div>
                <div><dt>Approved entries</dt><dd>{tournament.approved_entries}{tournament.max_entries ? ` / ${tournament.max_entries}` : ""}</dd></div>
                <div><dt>Team size</dt><dd>{tournament.min_team_size === tournament.max_team_size ? tournament.min_team_size : `${tournament.min_team_size}–${tournament.max_team_size}`}</dd></div>
              </dl>
              <div className="tournament-card-links">
                <Link className="button button-secondary button-small" to={`/tournaments/${tournament.id}`}>Entries &amp; details</Link>
                <Link className="button button-secondary button-small" to={`/tournaments/${tournament.id}/matches`}>Fixtures &amp; results</Link>
              </div>
              {isAdmin && (
                <div className="tournament-actions">
                  <Button className="button-secondary button-small" onClick={() => setEditor(tournament)}>Edit</Button>
                  {transitions[tournament.status]?.length > 0 && (
                    <label className="field tournament-status-control">
                      <span className="sr-only">Change status for {tournament.name}</span>
                      <select
                        aria-label={`Change status for ${tournament.name}`}
                        value=""
                        disabled={busyId === tournament.id}
                        onChange={(event) => { if (event.target.value) changeStatus(tournament, event.target.value); }}
                      >
                        <option value="">Change status…</option>
                        {transitions[tournament.status].map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
                      </select>
                    </label>
                  )}
                  {busyId === tournament.id && <span className="sr-only" role="status">Saving tournament status…</span>}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="tournament-state">
          <h2>{tournaments.length ? "No tournaments match" : "No tournaments yet"}</h2>
          <p>{tournaments.length ? "Try a different search or status filter." : isAdmin ? "Create a tournament to get the competition started." : "New competitions will appear here when they are published."}</p>
          {tournaments.length > 0 && <Button className="button-secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>}
        </div>
      )}
      {editor && <TournamentForm tournament={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={saved} />}
    </section>
  );
}
