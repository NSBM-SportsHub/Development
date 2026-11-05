import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../shared/api.js";
import { toApiDateTime } from "../../shared/business.js";
import { Button, Field, Loading, Notice } from "../../shared/ui.jsx";

function localTime(value) {
  const normalized = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(value) ? value.replace(" ", "T") + "Z" : value;
  const date = new Date(normalized);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function BookingEdit() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [values, setValues] = useState({ starts_at: "", ends_at: "", quantity: "1", notes: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setRecord(null);
    api.get(`/bookings/${bookingId}`, { signal: controller.signal }).then((row) => {
      if (controller.signal.aborted) return;
      setRecord(row); setValues({ starts_at: localTime(row.starts_at), ends_at: localTime(row.ends_at), quantity: String(row.quantity), notes: row.notes || "" });
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [bookingId, reload]);
  async function submit(event) {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    if (new Date(values.ends_at) <= new Date(values.starts_at)) { setFields({ ends_at: "Choose an end time after the start time." }); return; }
    setBusy(true); setError(""); setFields({});
    const payload = { starts_at: toApiDateTime(values.starts_at), ends_at: toApiDateTime(values.ends_at), notes: values.notes.trim() || null };
    if (record.resource_type === "equipment") payload.quantity = Number(values.quantity);
    try {
      await api.patch(`/bookings/${bookingId}`, payload);
      navigate("/bookings/mine", { replace: true, state: { notice: `Booking #${bookingId} updated.` } });
    } catch (failure) { setError(failure.message); setFields(failure.fields || {}); }
    finally { setBusy(false); }
  }
  function change(event) { const { name, value } = event.target; setValues((current) => ({ ...current, [name]: value })); }
  if (loading) return <Loading message="Loading your booking..." />;
  return <section className="business-page"><header className="business-heading"><div><p className="business-eyebrow">YOUR BOOKINGS</p><h1>Edit booking</h1><p>{record?.resource_name} · Request #{bookingId}</p></div></header><Notice>{error}</Notice>
    {!record ? <Button type="button" onClick={() => setReload(reload + 1)}>Try again</Button> : record.status !== "pending" ? <Notice>This booking is {record.status}. Only pending bookings can be edited.</Notice> : <form className="business-card business-form" onSubmit={submit}>
      <p>The resource stays the same. Availability is checked again when you save.</p>
      <Field label="Starts" name="starts_at" type="datetime-local" required value={values.starts_at} disabled={busy} onChange={change} error={fields.starts_at} />
      <Field label="Ends" name="ends_at" type="datetime-local" required value={values.ends_at} disabled={busy} onChange={change} error={fields.ends_at} />
      {record.resource_type === "equipment" && <Field label="Quantity" name="quantity" type="number" required min="1" step="1" value={values.quantity} disabled={busy} onChange={change} error={fields.quantity} />}
      <div className="business-field"><label htmlFor="edit-booking-notes">Notes (optional)</label><textarea id="edit-booking-notes" name="notes" maxLength="1000" value={values.notes} disabled={busy} onChange={change} /></div>
      <Button type="submit" busy={busy}>Save booking changes</Button>
    </form>}<Link className="business-link" to="/bookings/mine">Back to my bookings</Link>
  </section>;
}
