import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api.js";
import { formatDate, statusLabel } from "../../shared/business.js";
import { Button, EmptyState, ErrorState, Loading } from "../../shared/ui.jsx";
import "./club-management.css";

function ClubDirectory() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    Promise.all([api.get("/clubs", { signal: controller.signal }), api.get("/sports", { signal: controller.signal })])
      .then(([clubs, sports]) => { if (!controller.signal.aborted) setData(clubs.map((club) => ({ ...club, sport: sports.find((sport) => sport.id === club.sport_id)?.name || "Sport" }))); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [reload]);
  const clubs = data?.filter((club) => `${club.name} ${club.sport}`.toLowerCase().includes(query.trim().toLowerCase())) || [];
  return <section className="business-page club-management">
    <header className="business-heading"><div><p className="business-eyebrow">ADMINISTRATION</p><h1>Clubs</h1><p>Open a club to see its members, coaches and recorded activity.</p></div><Link className="business-link" to="/sports-clubs/new">Create a club</Link></header>
    <div className="business-field"><label htmlFor="admin-club-search">Search clubs or sports</label><input id="admin-club-search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" /></div>
    {error ? <ErrorState message={error} onRetry={() => setReload(reload + 1)} /> : !data ? <Loading message="Loading clubs..." /> : clubs.length ? <div className="club-management-grid">{clubs.map((club) => <Link key={club.id} to={`/admin/clubs/${club.id}`} className="business-card club-management-card">
      <span className="business-eyebrow">{club.sport} · {statusLabel(club.status)}</span><h2>{club.name}</h2><p>{club.description || "No club description provided."}</p>
      <dl className="club-management-counts"><div><dt>Members</dt><dd>{club.member_count}</dd></div><div><dt>Coaches</dt><dd>{club.coach_count}</dd></div></dl><span className="club-management-open">View club details →</span>
    </Link>)}</div> : <EmptyState title={data.length ? "No matching clubs" : "No clubs yet"}>{data.length ? "Try another club name or sport." : "Create a club to start building its community."}</EmptyState>}
  </section>;
}

function Contact({ person }) {
  return <dl className="club-person-contact">
    <div><dt>Email</dt><dd><a href={`mailto:${person.email}`}>{person.email}</a></dd></div>
    <div><dt>Student ID</dt><dd>{person.student_id || "Not provided"}</dd></div>
    <div><dt>Phone</dt><dd>{person.phone ? <a href={`tel:${person.phone}`}>{person.phone}</a> : "Not provided"}</dd></div>
  </dl>;
}

function Pager({ pagination, onPage, label }) {
  if (pagination.total_pages <= 1) return null;
  return <nav className="club-management-pager" aria-label={`${label} pages`}>
    <Button className="button-secondary" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</Button>
    <span>Page {pagination.page} of {pagination.total_pages}</span>
    <Button className="button-secondary" disabled={pagination.page >= pagination.total_pages} onClick={() => onPage(pagination.page + 1)}>Next</Button>
  </nav>;
}

function ClubOverview({ clubId }) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const tab = ["members", "coaches", "activity"].includes(params.get("tab")) ? params.get("tab") : "members";
  const query = new URLSearchParams();
  for (const key of ["members_page", "coaches_page", "activity_page", "activity_user_id"]) {
    if (params.has(key)) query.set(key, params.get(key));
  }
  const queryString = query.toString();
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    api.get(`/clubs/${clubId}/overview?${queryString}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [clubId, queryString, reload]);
  function update(values) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) value === null ? next.delete(key) : next.set(key, String(value));
      return next;
    });
  }
  function viewPerson(person) { update({ tab: "activity", activity_user_id: person.user_id, activity_page: null }); }
  if (error) return <section className="business-page club-management"><Link className="business-link" to="/admin/clubs">← All clubs</Link><ErrorState message={error} onRetry={() => setReload(reload + 1)} /></section>;
  if (!data) return <Loading message="Loading club details..." />;
  const { club, summary } = data;
  const section = data[tab];
  return <section className="business-page club-management">
    <Link className="business-link" to="/admin/clubs">← All clubs</Link>
    <header className="business-heading"><div><p className="business-eyebrow">{club.sport_name} · {statusLabel(club.status)}</p><h1>{club.name}</h1><p>{club.description || "No club description provided."}</p></div><Button className="button-secondary" onClick={() => setReload(reload + 1)}>Refresh club</Button></header>
    <dl className="club-management-summary" aria-label="Club totals">{[["Members", summary.members], ["Coaches", summary.coaches], ["Pending applications", summary.pending_applications], ["Training sessions", summary.training_sessions], ["Completed sessions", summary.training_completed], ["Attendance records", summary.attendance_recorded]].map(([label, value]) => <div className="business-card" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="business-actions"><Link className="business-link" to="/admin/memberships">Review applications</Link><Link className="business-link" to="/admin/coaches">Manage coaches</Link><Link className="business-link" to={`/sports-clubs/${club.id}`}>Club information</Link></div>
    <nav className="club-management-tabs" aria-label="Club details"><Button className={tab === "members" ? "button-primary" : "button-secondary"} aria-pressed={tab === "members"} onClick={() => update({ tab: "members" })}>Members ({summary.members})</Button><Button className={tab === "coaches" ? "button-primary" : "button-secondary"} aria-pressed={tab === "coaches"} onClick={() => update({ tab: "coaches" })}>Coaches ({summary.coaches})</Button><Button className={tab === "activity" ? "button-primary" : "button-secondary"} aria-pressed={tab === "activity"} onClick={() => update({ tab: "activity" })}>Activity</Button></nav>
    <div className="club-management-section" aria-live="polite">
      <h2>{tab === "members" ? "Club members" : tab === "coaches" ? "Club coaches" : "Club activity"}</h2>
      {tab === "members" && <p>Approved memberships. Attendance totals cover recorded sessions in this club, excluding cancelled sessions.</p>}
      {tab === "coaches" && <p>Current coach assignments and their recorded membership reviews for this club.</p>}
      {tab === "activity" && <><p>Applications, reviews, coach assignments, training and attendance. Training shows its latest saved state; the person who saved training or attendance was not recorded.</p>{section.user_id !== null && <div className="club-activity-filter"><strong>Activity for {section.user_name || `account #${section.user_id}`}</strong><Button className="button-secondary" onClick={() => update({ activity_user_id: null, activity_page: null })}>Show all activity</Button></div>}</>}
      {section.records.length === 0 ? <EmptyState title={tab === "members" ? "No approved members yet" : tab === "coaches" ? "No coaches assigned" : "No recorded activity"}> {tab === "activity" ? "Activity will appear here as club records are created." : "Use the management links above to get started."}</EmptyState> : <div className="business-record-list">{section.records.map((record) => tab === "activity" ? <article className="business-card club-activity-record" key={`${record.type}-${record.source_id}`}>
        <div className="business-record-head"><h3>{record.title}</h3><span className="business-status">{statusLabel(record.status)}</span></div>
        {record.user_name && <p><strong>{record.type.startsWith("coach_") ? "Coach" : ["application", "review", "withdrawn"].includes(record.type) ? "Applicant" : "Member"}:</strong> {record.user_name}</p>}
        <p><strong>Recorded by:</strong> {record.actor_name || "Not recorded"}</p><p><strong>Recorded:</strong> {formatDate(record.occurred_at, { hour: "2-digit", minute: "2-digit" })}</p>
        {record.session_id && <><p><strong>Session date:</strong> {formatDate(record.session_date)} · {statusLabel(record.session_status)}</p><Link className="business-link" to={`/training-attendance/${record.session_id}/attendance`}>View session attendance</Link></>}
      </article> : <article className="business-card club-person-record" key={record.id}>
        <div className="business-record-head"><h3>{record.name}</h3><span className="business-status">Account: {statusLabel(record.account_status)}</span></div><Contact person={record} />
        {tab === "members" ? <><p><strong>Member since:</strong> {formatDate(record.joined_at)}</p><dl className="club-person-stats">{[["Present", record.present], ["Late", record.late], ["Absent", record.absent], ["Excused", record.excused]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p><strong>Latest recorded session:</strong> {record.last_session_date ? formatDate(record.last_session_date) : "No attendance recorded"}</p></> : <><p><strong>Assigned:</strong> {formatDate(record.assigned_at)}</p><p><strong>Membership reviews:</strong> {record.membership_reviews}</p><p><strong>Latest review:</strong> {record.last_review_at ? formatDate(record.last_review_at) : "No reviews recorded"}</p></>}
        <Button className="button-secondary" onClick={() => viewPerson(record)}>View activity for {record.name}</Button>
      </article>)}</div>}
      <Pager pagination={section.pagination} label={tab} onPage={(page) => update({ [`${tab}_page`]: page })} />
    </div>
  </section>;
}

export default function AdminClubs() {
  const { clubId } = useParams();
  return clubId ? <ClubOverview key={clubId} clubId={clubId} /> : <ClubDirectory />;
}
