import { useEffect, useState } from "react";
import { api } from "../../shared/api.js";
import { formatDate, statusLabel } from "../../shared/business.js";
import { Button, Loading, Notice } from "../../shared/ui.jsx";
import "./reports.css";

const emptyFilters = { type: "", status: "", from: "", to: "", sport_id: "", user_id: "" };
const statuses = ["present", "late", "absent", "excused", "pending", "approved", "rejected", "withdrawn", "win", "draw", "loss"];

export default function ParticipationPage({ admin = false }) {
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [sports, setSports] = useState([]);
  const [sportsError, setSportsError] = useState("");
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSportsError("");
    api.get("/sports", { signal: controller.signal }).then((result) => { if (!controller.signal.aborted) setSports(result); })
      .catch((failure) => { if (!controller.signal.aborted) setSportsError(failure.message); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) if (value && (admin || key !== "user_id")) query.set(key, value);
    api.get(`${admin ? "/reports/participation" : "/participation/me"}?${query}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const last = Math.max(1, result.pagination.total_pages);
        if (page > last) setPage(last);
        else setData(result);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError([failure.message, ...Object.values(failure.fields || {})].join(" ")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, filters, page, reload]);

  function field(key, value) { setDraft((current) => ({ ...current, [key]: value })); }
  function apply(event) { event.preventDefault(); setPage(1); setFilters({ ...draft }); }

  return <section className="business-page" aria-labelledby="participation-title">
    <header className="business-heading"><div><p className="business-eyebrow">{admin ? "SPORTS ADMINISTRATION" : "YOUR SPORTING JOURNEY"}</p><h1 id="participation-title">{admin ? "Participation reports" : "My participation history"}</h1><p>Training attendance, tournament registrations and completed match results.</p></div></header>
    <form className="business-card report-filters" onSubmit={apply}>
      <div className="business-field"><label htmlFor="report-type">Activity type</label><select id="report-type" value={draft.type} onChange={(event) => field("type", event.target.value)}><option value="">All activities</option>{["training", "tournament", "match"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></div>
      <div className="business-field"><label htmlFor="report-status">Status / outcome</label><select id="report-status" value={draft.status} onChange={(event) => field("status", event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></div>
      <div className="business-field"><label htmlFor="report-sport">Sport</label><select id="report-sport" value={draft.sport_id} onChange={(event) => field("sport_id", event.target.value)}><option value="">All sports</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></div>
      <div className="business-field"><label htmlFor="report-from">From date</label><input id="report-from" type="date" value={draft.from} onChange={(event) => field("from", event.target.value)} /></div>
      <div className="business-field"><label htmlFor="report-to">To date</label><input id="report-to" type="date" min={draft.from || undefined} value={draft.to} onChange={(event) => field("to", event.target.value)} /></div>
      {admin && <div className="business-field"><label htmlFor="report-user">Student / user ID (optional)</label><input id="report-user" type="number" min="1" step="1" value={draft.user_id} onChange={(event) => field("user_id", event.target.value)} /></div>}
      <div className="business-actions report-filter-actions"><Button type="submit" disabled={loading}>Apply filters</Button><Button type="button" className="button-secondary" disabled={loading} onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); }}>Reset</Button><Button type="button" className="button-secondary" disabled={loading} onClick={() => setReload((value) => value + 1)}>Refresh</Button></div>
    </form>
    <Notice>{sportsError && `Sport filters could not load. ${sportsError}`}</Notice><Notice>{error}</Notice>
    <p className="business-hint">Date filters include both dates. Training uses the session date; registrations use the tournament start date; match results use the scheduled date, or the result date if unscheduled. Match outcomes describe the team roster, rather than verified individual attendance.</p>
    {loading ? <Loading message="Loading participation records..." /> : data && <>
      <dl className="report-summary" aria-label="Totals for the applied filters">
        {[["total_records", "Records"], ...(admin ? [["participants", "People represented"]] : []), ["training_attended", "Training attended"], ["approved_entries", "Approved registrations"], ["matches_played", "Match roster appearances"], ["wins", "Wins"], ["draws", "Draws"], ["losses", "Losses"]].map(([key, label]) => <div className="business-card" key={key}><dt>{label}</dt><dd>{data.summary[key]}</dd></div>)}
      </dl>
      <p className="business-hint">Totals cover all matching records across pages. Training attended includes present and late records; cancelled sessions and tournaments do not count towards attendance or approved registrations.</p>
      {data.records.length === 0 ? <div className="business-card business-empty"><h2>No matching participation records</h2><p>Try changing the filters. Records appear once attendance or tournament activity is saved in SportsHub.</p></div> : <div className="business-record-list">
        {data.records.map((record) => <article className="business-card business-record" key={`${record.type}-${record.source_id}-${record.user_id}`}>
          <div className="business-record-head"><div><p className="business-eyebrow">{statusLabel(record.type)} · {record.sport_name}</p><h2>{record.activity}</h2><p className="business-note">{record.context}</p></div><span className="business-status">{statusLabel(record.status)}</span></div>
          <dl className="business-details"><div><dt>Activity date</dt><dd><time dateTime={record.activity_date}>{formatDate(record.activity_date, { timeZone: "UTC" })}</time></dd></div><div><dt>Activity status</dt><dd>{statusLabel(record.activity_status)}</dd></div>{admin && <div><dt>Participant</dt><dd>{record.user_name} (#{record.user_id})</dd></div>}</dl>
        </article>)}
      </div>}
      {data.pagination.total_pages > 1 && <nav className="business-pager" aria-label="Participation pages"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {data.pagination.total_pages}</span><button type="button" disabled={page >= data.pagination.total_pages} onClick={() => setPage(page + 1)}>Next</button></nav>}
    </>}
    {!loading && error && <Button type="button" className="button-secondary" onClick={() => setReload((value) => value + 1)}>Try again</Button>}
  </section>;
}
