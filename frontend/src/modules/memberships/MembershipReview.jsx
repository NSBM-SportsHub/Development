import { useEffect, useState } from "react";
import { useClubAccess } from "../../shared/useClubAccess.js";
import { useAuth } from "../../shared/AuthContext.jsx";
import { api } from "../../shared/api.js";
import { formatDate, statusLabel } from "../../shared/business.js";
import { Button, Loading, Modal, Notice } from "../../shared/ui.jsx";
import "./memberships.css";

function ApplicantContact({ record }) {
  return <>
    <div><dt>Student ID</dt><dd>{record.user_student_id || "Not provided"}</dd></div>
    <div><dt>Phone number</dt><dd>{record.user_phone ? <a className="business-link" href={`tel:${record.user_phone}`}>{record.user_phone}</a> : "Not provided"}</dd></div>
  </>;
}

export default function MembershipReview() {
  const access = useClubAccess();
  const { user } = useAuth();
  const [clubId, setClubId] = useState("");
  const effectiveClub = access.isAdmin ? clubId : (access.assignments.some((row) => String(row.club_id) === clubId) ? clubId : String(access.assignments[0]?.club_id || ""));
  const [status, setStatus] = useState("pending");
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [decision, setDecision] = useState(null);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    if (access.loading || (!access.isAdmin && !effectiveClub)) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ status, page: String(page), per_page: "20" });
    if (effectiveClub) query.set("club_id", effectiveClub);
    api.get(`/memberships?${query}`, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) {
        const lastPage = Math.max(1, data.pagination.total_pages);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setRecords(data.memberships);
        setPagination(data.pagination);
      }
    }).catch((failure) => {
        if (failure.name !== "AbortError") {
          setRecords([]);
          setError(failure.message);
        }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [status, page, reload, access.loading, access.isAdmin, effectiveClub]);

  function openDecision(record, status) {
    setDecision({ record, status });
    setReviewNote("");
    setError("");
  }

  async function review(event) {
    event.preventDefault();
    if (busyId !== null) return;
    if (!decision) return;
    const { record, status: nextStatus } = decision;
    setBusyId(record.id);
    setError("");
    setNotice("");
    try {
      const updated = await api.patch(`/memberships/${record.id}`, { status: nextStatus, review_note: reviewNote.trim() || null });
      setRecords((current) => current.filter((item) => item.id !== updated.id));
      setReload((value) => value + 1);
      setNotice(`${record.user_name}'s application to ${record.club_name} was ${nextStatus}.`);
      setDecision(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusyId(null);
    }
  }

  if (access.loading) return <Loading message="Checking club permissions..." />;
  if (access.error) return <Notice>{access.error}</Notice>;
  if (!access.isAdmin && !effectiveClub) return <Notice>Only administrators and assigned club coaches can review memberships.</Notice>;

  return <section className="business-page" aria-labelledby="membership-review-title">
    <header className="business-heading"><div><p className="business-eyebrow">{access.isAdmin ? "ADMINISTRATION" : "CLUB MANAGEMENT"}</p><h1 id="membership-review-title">Membership review</h1><p>Check applicant details, review applications and view approved member records.</p></div></header>
    <Notice>{error}</Notice><Notice type="success">{notice}</Notice>
    {!access.isAdmin && <div className="business-field"><label htmlFor="review-club">Club to review</label><select id="review-club" value={effectiveClub} onChange={(event) => { setClubId(event.target.value); setPage(1); }}>{access.assignments.map((row) => <option key={row.id} value={row.club_id}>{row.club_name}</option>)}</select></div>}
    <div className="business-tabs" role="group" aria-label="Membership status filter">
      {["pending", "approved", "rejected", "withdrawn", "ended"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} aria-pressed={status === item} onClick={() => { setStatus(item); setPage(1); }}>{statusLabel(item)}</button>)}
    </div>
    {loading ? <Loading message="Loading membership records…" /> : records.length === 0 ? <div className="business-card business-empty"><h2>No {status} records</h2><p>There are no membership records in this view.</p></div> : <div className="business-record-list">
      {records.map((record) => <article className="business-card business-record membership-review-record" key={record.id}>
        <div className="business-record-head"><div><p className="business-eyebrow">{record.club_name}</p><h2>{record.user_name}</h2><a href={`mailto:${record.user_email}`} className="business-link">{record.user_email}</a></div><span className={`business-status status-${record.status}`}>{statusLabel(record.status)}</span></div>
        <dl className="business-details membership-applicant-details"><ApplicantContact record={record} /><div><dt>Applied</dt><dd>{formatDate(record.applied_at)}</dd></div><div><dt>Reviewed</dt><dd>{formatDate(record.reviewed_at)}</dd></div></dl>
        <p className="business-note"><strong>Application:</strong> {record.message || "No application message provided."}</p>
        {record.review_note && <p className="business-note"><strong>Review note:</strong> {record.review_note}</p>}
        {record.status === "pending" && Number(record.user_id) !== Number(user.id) && <div className="business-actions"><Button type="button" disabled={busyId !== null} onClick={() => openDecision(record, "approved")}>Approve</Button><Button className="button-danger" type="button" disabled={busyId !== null} onClick={() => openDecision(record, "rejected")}>Reject</Button></div>}
        {record.status === "approved" && <div className="business-actions"><Button className="button-danger" disabled={busyId !== null} onClick={() => openDecision(record, "ended")}>End membership</Button></div>}
      </article>)}
    </div>}
    {!loading && <div className="business-pager"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.total_pages)}</span><button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((value) => value + 1)}>Next</button><button type="button" className="business-text-button" onClick={() => setReload((value) => value + 1)}>Refresh records</button></div>}
    {decision && <Modal title={decision.status === "ended" ? "End membership?" : decision.status === "rejected" ? "Reject application?" : "Approve application?"} subtitle={`${decision.record.user_name} · ${decision.record.club_name}`} onClose={() => setDecision(null)} busy={busyId !== null}>
      <form className="business-form" onSubmit={review}>
        <Notice>{error}</Notice>
        <dl className="business-details membership-applicant-details"><ApplicantContact record={decision.record} /></dl>
        {decision.record.message && <p className="business-note"><strong>Application:</strong> {decision.record.message}</p>}
        <div className="business-field"><label htmlFor="membership-review-note">{decision.status === "rejected" ? "Note for the applicant (optional)" : "Welcome note (optional)"}</label><textarea id="membership-review-note" maxLength={1000} value={reviewNote} disabled={busyId !== null} onChange={(event) => setReviewNote(event.target.value)} aria-describedby="membership-review-note-hint" /><span className="field-hint" id="membership-review-note-hint">{reviewNote.length}/1000 characters</span></div>
        <div className="business-actions"><Button type="button" className="button-secondary" disabled={busyId !== null} onClick={() => setDecision(null)}>Cancel</Button><Button type="submit" className={decision.status === "rejected" ? "button-danger" : "button-primary"} busy={busyId !== null}>{busyId !== null ? "Saving…" : decision.status === "ended" ? "End membership" : decision.status === "rejected" ? "Reject application" : "Approve application"}</Button></div>
      </form>
    </Modal>}
  </section>;
}
