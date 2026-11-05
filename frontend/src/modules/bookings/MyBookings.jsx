import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../shared/api.js";
import { formatDate, statusLabel } from "../../shared/business.js";
import { Button, Loading, Notice } from "../../shared/ui.jsx";

export default function MyBookings() {
  const location = useLocation();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [busyId, setBusyId] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api.get("/bookings", { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setRecords(data);
    }).catch((failure) => {
      if (failure.name !== "AbortError") setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  async function cancel(record) {
    if (busyId !== null) return;
    if (!window.confirm(`Cancel the booking request for ${record.resource_name}?`)) return;
    setBusyId(record.id);
    setError("");
    setNotice("");
    try {
      await api.delete(`/bookings/${record.id}`);
      setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status: "cancelled" } : item));
      setNotice("Booking request cancelled.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusyId(null);
    }
  }

  return <section className="business-page" aria-labelledby="my-bookings-title">
    <header className="business-heading"><div><p className="business-eyebrow">YOUR ACCOUNT</p><h1 id="my-bookings-title">My bookings</h1><p>Track request decisions and upcoming resource bookings.</p></div><Link className="button button-primary business-create" to="/bookings/new">New request</Link></header>
    <Notice>{error}</Notice><Notice type="success">{notice}</Notice>
    {loading ? <Loading message="Loading your booking requests…" /> : records.length === 0 ? <div className="business-card business-empty"><h2>No bookings yet</h2><p>Your submitted requests and their statuses will appear here.</p><Link className="business-link" to="/bookings/new">Request a booking</Link></div> : <div className="business-record-list">
      {records.map((record) => <article className="business-card business-record" key={record.id}>
        <div className="business-record-head"><div><p className="business-eyebrow">{statusLabel(record.resource_type)}</p><h2>{record.resource_name}</h2></div><span className={`business-status status-${record.status}`}>{statusLabel(record.status)}</span></div>
        <dl className="business-details"><div><dt>Starts</dt><dd>{formatDate(record.starts_at, { hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Ends</dt><dd>{formatDate(record.ends_at, { hour: "2-digit", minute: "2-digit" })}</dd></div>{record.resource_type === "equipment" && <div><dt>Quantity</dt><dd>{record.quantity}</dd></div>}<div><dt>Requested</dt><dd>{formatDate(record.created_at)}</dd></div></dl>
        {record.notes && <p className="business-note"><strong>Notes:</strong> {record.notes}</p>}
        {record.status === "pending" && <div className="business-actions"><Link className="business-link" to={`/bookings/${record.id}/edit`}>Edit booking</Link><Button type="button" className="button-danger" busy={busyId === record.id} disabled={busyId !== null} onClick={() => cancel(record)}>{busyId === record.id ? "Cancelling…" : "Cancel request"}</Button></div>}
      </article>)}
    </div>}
    {!loading && <button className="business-text-button" type="button" onClick={() => setReload((value) => value + 1)}>Refresh booking status</button>}
  </section>;
}
