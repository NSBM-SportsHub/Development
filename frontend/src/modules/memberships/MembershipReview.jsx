import { useEffect, useState } from "react";
import { api } from "../../shared/api.js";
import { formatDate, statusLabel } from "../../shared/business.js";
import { Button, Loading, Modal, Notice } from "../../shared/ui.jsx";

export default function MembershipReview() {
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
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ status, page: String(page), per_page: "20" });
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
  }, [status, page, reload]);

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

  return <section className="business-page" aria-labelledby="membership-review-title">
    <header className="business-heading"><div><p className="business-eyebrow">ADMINISTRATION</p><h1 id="membership-review-title">Membership review</h1><p>Review applications and view approved member records.</p></div></header>
    <Notice>{error}</Notice><Notice type="success">{notice}</Notice>
    <div className="business-tabs" role="group" aria-label="Membership status filter">
      {["pending", "approved", "rejected", "withdrawn", "ended"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} aria-pressed={status === item} onClick={() => { setStatus(item); setPage(1); }}>{statusLabel(item)}</button>)}
    </div>
    {loading ? <Loading message="Loading membership records…" /> : records.length === 0 ? <div className="business-card business-empty"><h2>No {status} records</h2><p>There are no membership records in this view.</p></div> : <div className="business-record-list">
      {records.map((record) => <article className="business-card business-record" key={record.id}>
        <div className="business-record-head"><div><p className="business-eyebrow">{record.club_name}</p><h2>{record.user_name}</h2><a href={`mailto:${record.user_email}`} className="business-link">{record.user_email}</a></div><span className={`business-status status-${record.status}`}>{statusLabel(record.status)}</span></div>
        <dl className="business-details"><div><dt>Applied</dt><dd>{formatDate(record.applied_at)}</dd></div><div><dt>Reviewed</dt><dd>{formatDate(record.reviewed_at)}</dd></div></dl>
        {record.message && <p className="business-note"><strong>Application:</strong> {record.message}</p>}
        {record.review_note && <p className="business-note"><strong>Review note:</strong> {record.review_note}</p>}
        {record.status === "pending" && <div className="business-actions"><Button type="button" disabled={busyId !== null} onClick={() => openDecision(record, "approved")}>Approve</Button><Button className="button-danger" type="button" disabled={busyId !== null} onClick={() => openDecision(record, "rejected")}>Reject</Button></div>}
      </article>)}
    </div>}
    {!loading && <div className="business-pager"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.total_pages)}</span><button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((value) => value + 1)}>Next</button><button type="button" className="business-text-button" onClick={() => setReload((value) => value + 1)}>Refresh records</button></div>}
    {decision && <Modal title={decision.status === "rejected" ? "Reject application?" : "Approve application?"} subtitle={`${decision.record.user_name} · ${decision.record.club_name}`} onClose={() => setDecision(null)} busy={busyId !== null}>
      <form className="business-form" onSubmit={review}>
        <Notice>{error}</Notice>
        <div className="business-field"><label htmlFor="membership-review-note">{decision.status === "rejected" ? "Note for the applicant (optional)" : "Welcome note (optional)"}</label><textarea id="membership-review-note" maxLength={1000} value={reviewNote} disabled={busyId !== null} onChange={(event) => setReviewNote(event.target.value)} aria-describedby="membership-review-note-hint" /><span className="field-hint" id="membership-review-note-hint">{reviewNote.length}/1000 characters</span></div>
        <div className="business-actions"><Button type="button" className="button-secondary" disabled={busyId !== null} onClick={() => setDecision(null)}>Cancel</Button><Button type="submit" className={decision.status === "rejected" ? "button-danger" : "button-primary"} busy={busyId !== null}>{busyId !== null ? "Saving…" : decision.status === "rejected" ? "Reject application" : "Approve application"}</Button></div>
      </form>
    </Modal>}
  </section>;
}
