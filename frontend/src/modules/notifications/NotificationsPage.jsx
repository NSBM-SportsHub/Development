import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../shared/api.js";
import { formatDate, statusLabel } from "../../shared/business.js";
import { Button, Loading, Notice } from "../../shared/ui.jsx";

export default function NotificationsPage() {
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [reload, setReload] = useState(0);
  const mutation = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    api.get(`/notifications?state=${state}&page=${page}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const last = Math.max(1, result.pagination.total_pages);
        if (page > last) setPage(last);
        else setData(result);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [state, page, reload]);

  async function markRead(id) {
    if (mutation.current) return;
    mutation.current = true;
    setBusyId(id);
    setError("");
    try {
      await api.patch(`/notifications/${id}`, { read: true });
      setReload((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { mutation.current = false; setBusyId(null); }
  }

  return <section className="business-page" aria-labelledby="notifications-title">
    <header className="business-heading"><div><p className="business-eyebrow">YOUR UPDATES</p><h1 id="notifications-title">Notifications</h1><p>Membership, booking, tournament entry and announcement updates.</p></div></header>
    <div className="business-tabs" aria-label="Filter notifications">
      {[["", "All"], ["unread", "Unread"], ["read", "Read"]].map(([value, label]) => <button key={value} type="button" aria-pressed={state === value} className={state === value ? "active" : ""} disabled={busyId !== null} onClick={() => { setState(value); setPage(1); }}>{label}</button>)}
      <button type="button" disabled={loading || busyId !== null} onClick={() => setReload((value) => value + 1)}>Refresh</button>
    </div>
    <Notice>{error}</Notice>
    {loading ? <Loading message="Loading notifications..." /> : data && <>
      <p role="status">{data.unread_count} unread {data.unread_count === 1 ? "notification" : "notifications"}</p>
      {data.notifications.length === 0 ? <div className="business-card business-empty"><h2>No {state ? `${state} ` : ""}notifications</h2><p>Your updates will appear here when activity happens in SportsHub.</p></div> : <div className="business-record-list">
        {data.notifications.map((record) => <article className="business-card business-record" key={record.id}>
          <div className="business-record-head"><div><p className="business-eyebrow">{statusLabel(record.type)}</p><h2>{record.title}</h2></div><span className="business-status">{record.read_at ? "Read" : "Unread"}</span></div>
          <p className="business-note">{record.message}</p>
          <p className="business-hint"><time dateTime={record.created_at}>{formatDate(record.created_at, { hour: "2-digit", minute: "2-digit" })}</time></p>
          <div className="business-actions"><Link className="business-link" to={record.link}>View related activity</Link>{!record.read_at && <Button type="button" className="button-secondary" disabled={busyId !== null || loading} busy={busyId === record.id} onClick={() => markRead(record.id)}>Mark as read</Button>}</div>
        </article>)}
      </div>}
      {data.pagination.total_pages > 1 && <nav className="business-pager" aria-label="Notifications pages"><button type="button" disabled={page <= 1 || busyId !== null} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {data.pagination.total_pages}</span><button type="button" disabled={page >= data.pagination.total_pages || busyId !== null} onClick={() => setPage(page + 1)}>Next</button></nav>}
    </>}
    {!loading && error && <Button type="button" className="button-secondary" onClick={() => setReload((value) => value + 1)}>Try again</Button>}
  </section>;
}
