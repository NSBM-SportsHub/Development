import { useEffect, useRef, useState } from "react";
import { api } from "../../shared/api.js";
import { formatDate, statusLabel } from "../../shared/business.js";
import { Button, Loading, Notice } from "../../shared/ui.jsx";

export default function BookingReview() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const mutation = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api.get("/bookings", { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setRows(data); })
      .catch((failure) => { if (!controller.signal.aborted) { setRows([]); setError(failure.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  async function decide(row, next) {
    if (mutation.current || !window.confirm(`${statusLabel(next)} booking #${row.id} for ${row.resource_name}?`)) return;
    mutation.current = true; setBusyId(row.id); setError(""); setNotice("");
    try {
      if (next === "cancelled") await api.delete(`/bookings/${row.id}`);
      else await api.patch(`/bookings/${row.id}`, { status: next });
      setNotice(`Booking #${row.id} ${next}. The requester has been notified.`);
      setReload((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { mutation.current = false; setBusyId(null); }
  }
  const filtered = rows.filter((row) => (!status || row.status === status) && `${row.id} ${row.resource_name} ${row.requester_name || ""} ${row.requester_student_id || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  return <section className="business-page"><header className="business-heading"><div><p className="business-eyebrow">ADMINISTRATION</p><h1>Booking review</h1><p>Review facility and equipment requests and manage approved reservations.</p></div></header>
    <Notice>{error}</Notice><Notice type="success">{notice}</Notice>
    <div className="business-tabs" aria-label="Booking status filter">{["pending", "approved", "rejected", "cancelled", ""].map((value) => <button key={value} type="button" aria-pressed={status === value} className={status === value ? "active" : ""} onClick={() => { setStatus(value); setPage(1); }}>{value ? statusLabel(value) : "All"}</button>)}</div>
    <div className="business-field"><label htmlFor="booking-search">Search by booking ID, resource, requester or student ID</label><input id="booking-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
    <Button type="button" className="button-secondary" disabled={loading || busyId !== null} onClick={() => setReload(reload + 1)}>Refresh bookings</Button>
    {loading ? <Loading message="Loading bookings..." /> : filtered.length === 0 ? <div className="business-card business-empty"><h2>No matching booking requests</h2></div> : <div className="business-record-list">{filtered.slice((currentPage - 1) * 20, currentPage * 20).map((row) => <article key={row.id} className="business-card business-record">
      <div className="business-record-head"><div><p className="business-eyebrow">{statusLabel(row.resource_type)} · Booking #{row.id}</p><h2>{row.resource_name}</h2><p>{row.requester_name || "Archived account"} (#{row.requested_by}){row.requester_student_id && ` · ${row.requester_student_id}`}</p></div><span className={`business-status status-${row.status}`}>{statusLabel(row.status)}</span></div>
      <dl className="business-details"><div><dt>Starts</dt><dd>{formatDate(row.starts_at, { hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Ends</dt><dd>{formatDate(row.ends_at, { hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Quantity</dt><dd>{row.quantity}</dd></div></dl>
      {row.notes && <p className="business-note">{row.notes}</p>}
      <div className="business-actions">{row.status === "pending" && <><Button disabled={busyId !== null} onClick={() => decide(row, "approved")}>Approve</Button><Button className="button-danger" disabled={busyId !== null} onClick={() => decide(row, "rejected")}>Reject</Button></>}{["pending", "approved"].includes(row.status) && <Button className="button-secondary" disabled={busyId !== null} onClick={() => decide(row, "cancelled")}>Cancel booking</Button>}</div>
    </article>)}</div>}
    {!loading && pages > 1 && <nav className="business-pager" aria-label="Booking pages"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
  </section>;
}
