import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../shared/api.js";
import { useAuth } from "../../shared/AuthContext.jsx";
import { Button, Icon, Loading, Notice } from "../../shared/ui.jsx";
import MatchForm from "./MatchForm.jsx";
import ResultForm from "./ResultForm.jsx";
import Standings from "./Standings.jsx";
import "./matches-results.css";

const matchStatusLabels = {
  scheduled: "Scheduled",
  postponed: "Postponed",
  completed: "Completed",
  cancelled: "Cancelled",
};

function scheduledLabel(value) {
  if (!value) return "Time to be arranged";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function compareMatches(a, b) {
  if (a.round_no !== b.round_no) return a.round_no - b.round_no;
  if (a.scheduled_at == null && b.scheduled_at != null) return 1;
  if (a.scheduled_at != null && b.scheduled_at == null) return -1;
  return (a.scheduled_at || "").localeCompare(b.scheduled_at || "") || a.id - b.id;
}

export default function Fixtures() {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tournament, setTournament] = useState(null);
  const [entries, setEntries] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState(null);
  const [standingsError, setStandingsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    setTournament(null);
    setEntries([]);
    setMatches([]);
    setStandings(null);
    setStandingsError("");
    try {
      const tournamentData = await api.get(`/tournaments/${tournamentId}`, { signal });
      const [entryData, matchData, standingsData] = await Promise.all([
        api.get(`/tournaments/${tournamentId}/entries`, { signal }),
        api.get(`/tournaments/${tournamentId}/matches`, { signal }),
        api.get(`/tournaments/${tournamentId}/standings`, { signal }).catch((failure) => {
          if (failure.name !== "AbortError") setStandingsError(failure.message);
          return null;
        }),
      ]);
      if (!signal?.aborted) {
        setTournament(tournamentData);
        setEntries(entryData.filter((entry) => entry.status === "approved"));
        setMatches(matchData);
        setStandings(standingsData);
      }
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const filteredMatches = useMemo(() => matches.filter((match) => filter === "all" || match.status === filter), [filter, matches]);
  const canArrangeFixtures = isAdmin && ["registration_closed", "in_progress"].includes(tournament?.status);
  const canRecordResults = isAdmin && tournament?.status === "in_progress";

  const refreshStandings = useCallback(async () => {
    try {
      setStandings(await api.get(`/tournaments/${tournamentId}/standings`));
      setStandingsError("");
    } catch (failure) {
      setStandingsError(failure.message);
    }
  }, [tournamentId]);

  async function generateFixtures() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await api.post(`/tournaments/${tournamentId}/fixtures`, {});
      setMatches((current) => [...current, ...created].sort(compareMatches));
      await refreshStandings();
      setNotice(created.length ? `${created.length} fixture${created.length === 1 ? "" : "s"} generated.` : "No new fixtures were generated.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMatch(saved, message) {
    setMatches((current) => {
      const exists = current.some((match) => match.id === saved.id);
      return exists
        ? current.map((match) => match.id === saved.id ? saved : match)
        : [...current, saved].sort(compareMatches);
    });
    await refreshStandings();
    setForm(null);
    setNotice(message);
    setError("");
  }

  async function cancelMatch(match) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/matches/${match.id}`);
      setMatches((current) => current.map((item) => item.id === match.id ? { ...item, status: "cancelled" } : item));
      await refreshStandings();
      setNotice("Match cancelled.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveResult(saved, message) {
    setMatches((current) => current.map((match) => match.id === saved.id ? saved : match));
    await refreshStandings();
    setForm(null);
    setNotice(message);
    setError("");
  }

  if (loading) return <Loading message="Loading fixtures…" />;
  if (!tournament && error) return <section className="matches-page"><Notice>{error}</Notice><Button className="button-secondary" onClick={() => loadData()}>Try again</Button></section>;
  if (!tournament) return null;

  return (
    <section className="matches-page" aria-labelledby="matches-title">
      <Link className="matches-back-link" to="/tournaments">← All tournaments</Link>
      <div className="matches-heading">
        <div>
          <p className="eyebrow">{tournament.sport_name} · {tournament.format}</p>
          <h1 id="matches-title">{tournament.name}</h1>
          <p>Fixtures and match results</p>
        </div>
        {isAdmin && canArrangeFixtures && (
          <div className="matches-heading-actions">
            <Button className="button-secondary" onClick={generateFixtures} busy={busy} disabled={entries.length < 2}>
              {busy ? "Generating…" : "Generate fixtures"}
            </Button>
            <Button onClick={() => setForm({ type: "schedule" })} disabled={entries.length < 2}>
              <Icon name="plus" size={18} />Schedule match
            </Button>
          </div>
        )}
      </div>
      <Notice type="success">{notice}</Notice>
      <Notice>{error}</Notice>
      {isAdmin && canArrangeFixtures && entries.length < 2 && (
        <Notice>At least two approved entries are required before fixtures can be arranged.</Notice>
      )}
      <Standings data={standings} error={standingsError} entries={entries} />
      <div className="matches-toolbar">
        <p><strong>{matches.length}</strong> {matches.length === 1 ? "match" : "matches"}</p>
        <label className="field">
          <span>Filter matches</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {Object.entries(matchStatusLabels).map(([status, label]) => <option value={status} key={status}>{label}</option>)}
          </select>
        </label>
      </div>
      {filteredMatches.length ? (
        <div className="matches-list">
          {filteredMatches.map((match) => {
            const canEditSchedule = isAdmin && canArrangeFixtures && ["scheduled", "postponed"].includes(match.status);
            const canEditResult = canRecordResults && match.status !== "cancelled";
            return (
              <article className="match-card" key={match.id}>
                <div className="match-card-meta">
                  <span>Round {match.round_no}</span>
                  <span className={`match-status match-status-${match.status}`}>{matchStatusLabels[match.status] || match.status}</span>
                </div>
                <div className="match-scoreline">
                  <strong>{match.home_name}</strong>
                  <span className="match-score">
                    {match.status === "completed" ? `${match.home_score} – ${match.away_score}` : "vs"}
                  </span>
                  <strong>{match.away_name}</strong>
                </div>
                <div className="match-card-details">
                  <span>{scheduledLabel(match.scheduled_at)}</span>
                  {(match.venue || match.facility_name) && <span>{match.venue || match.facility_name}</span>}
                </div>
                {match.status === "completed" && match.winner_name && (
                  <p className="match-winner">Winner: <strong>{match.winner_name}</strong></p>
                )}
                {match.result_notes && <p className="match-notes">{match.result_notes}</p>}
                {(canEditSchedule || canEditResult) && (
                  <div className="match-actions">
                    {canEditSchedule && <>
                      <Button className="button-secondary button-small" onClick={() => setForm({ type: "schedule", match })}>Edit schedule</Button>
                      <Button className="button-secondary button-small" onClick={() => cancelMatch(match)} disabled={busy}>Cancel match</Button>
                    </>}
                    {canEditResult && (
                      <Button className="button-secondary button-small" onClick={() => setForm({ type: "result", match })}>
                        {match.status === "completed" ? "Correct result" : "Enter result"}
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="matches-empty">
          <h2>{matches.length ? "No matches in this view" : "No fixtures yet"}</h2>
          <p>{matches.length ? "Choose another status filter to see more matches." : isAdmin && canArrangeFixtures ? "Generate a fixture list or schedule a match manually." : "Fixtures and results will appear here when they are available."}</p>
          {matches.length > 0 && <Button className="button-secondary" onClick={() => setFilter("all")}>Show all matches</Button>}
        </div>
      )}
      {form?.type === "schedule" && (
        <MatchForm
          tournamentId={tournamentId}
          match={form.match}
          entries={entries}
          onClose={() => setForm(null)}
          onSaved={(savedMatch) => saveMatch(savedMatch, form.match ? "Match schedule updated." : "Match scheduled.")}
        />
      )}
      {form?.type === "result" && (
        <ResultForm
          match={form.match}
          tournament={tournament}
          onClose={() => setForm(null)}
          onSaved={(savedMatch) => saveResult(savedMatch, form.match.status === "completed" ? "Result corrected." : "Match result recorded.")}
        />
      )}
    </section>
  );
}
