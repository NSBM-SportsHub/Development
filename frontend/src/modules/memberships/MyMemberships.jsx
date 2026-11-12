import { useCallback, useEffect, useState } from "react";
import { api } from "../../shared/api.js";
import { formatDate, statusLabel } from "../../shared/business.js";
import { Button, Loading, Notice } from "../../shared/ui.jsx";
import { useAuth } from "../../shared/AuthContext.jsx";
import { Link } from "react-router-dom";

export default function MyMemberships() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/memberships?user_id=${user.id}&page=${page}&per_page=20`, { signal });
      if (!signal.aborted) {
        const lastPage = Math.max(1, data.pagination.total_pages);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setRecords(data.memberships);
        setPagination(data.pagination);
      }
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [user.id, page]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, page, reload]);

  async function changeStatus(record, status) {
    if (busyId !== null) return;
    setBusyId(record.id);
    setError("");
    setNotice("");
    try {
      const updated = await api.patch(`/memberships/${record.id}`, { status });
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(status === "withdrawn" ? "Application withdrawn." : "Membership ended.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusyId(null);
    }
  }

  return <section className="business-page" aria-labelledby="my-memberships-title">
    <header className="business-heading"><div><p className="business-eyebrow">YOUR ACCOUNT</p><h1 id="my-memberships-title">My memberships</h1><p>Applications and current or past club memberships.</p></div><Link className="button button-primary business-create" to="/memberships/apply">Apply for membership</Link></header>
    <Notice>{error}</Notice><Notice type="success">{notice}</Notice>
    {loading ? <Loading message="Loading your memberships…" /> : records.length === 0 ? <div className="business-card business-empty"><h2>No memberships yet</h2><p>Your applications and club memberships will appear here. Choose Apply for membership to join a club.</p></div> : <div className="business-record-list">
      {records.map((record) => <article className="business-card business-record" key={record.id}>
        <div className="business-record-head"><div><p className="business-eyebrow">CLUB MEMBERSHIP</p><h2>{record.club_name}</h2></div><span className={`business-status status-${record.status}`}>{statusLabel(record.status)}</span></div>
        <dl className="business-details"><div><dt>Applied</dt><dd>{formatDate(record.applied_at)}</dd></div><div><dt>Updated</dt><dd>{formatDate(record.updated_at)}</dd></div></dl>
        {record.message && <p className="business-note"><strong>Your application:</strong> {record.message}</p>}
        {record.review_note && <p className="business-note"><strong>Review note:</strong> {record.review_note}</p>}
        {record.status === "pending" && <div className="business-actions"><Button className="button-secondary" type="button" busy={busyId === record.id} disabled={busyId !== null} onClick={() => changeStatus(record, "withdrawn")}>{busyId === record.id ? "Updating…" : "Withdraw application"}</Button></div>}
        {record.status === "approved" && <div className="business-actions"><Button className="button-secondary" type="button" busy={busyId === record.id} disabled={busyId !== null} onClick={() => changeStatus(record, "ended")}>{busyId === record.id ? "Updating…" : "Leave this club"}</Button></div>}
      </article>)}
    </div>}
    {!loading && records.length > 0 && <div className="business-pager"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.total_pages)}</span><button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((value) => value + 1)}>Next</button><button type="button" className="business-text-button" onClick={() => setReload((value) => value + 1)}>Refresh status</button></div>}
  </section>;
}
