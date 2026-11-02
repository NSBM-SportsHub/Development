import { useEffect, useState } from "react";
import { api } from "../../shared/api.js";
import { toApiDateTime } from "../../shared/business.js";
import { Button, Field, Loading, Notice } from "../../shared/ui.jsx";
import { useNavigate } from "react-router-dom";

function localDefaultTime(offsetHours) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function BookingForm() {
  const navigate = useNavigate();
  const [resources, setResources] = useState({ facilities: [], equipment: [] });
  const [values, setValues] = useState({ resource_type: "facility", resource_id: "", starts_at: localDefaultTime(1), ends_at: localDefaultTime(2), quantity: "1", notes: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [resourceReload, setResourceReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([api.get("/facilities", { signal: controller.signal }), api.get("/equipment", { signal: controller.signal })])
      .then(([facilities, equipment]) => {
        if (!controller.signal.aborted) {
          setResources({ facilities, equipment });
          const first = facilities[0] || equipment[0];
          if (first) setValues((current) => ({ ...current, resource_type: facilities.length ? "facility" : "equipment", resource_id: String(first.id) }));
        }
      })
      .catch((failure) => { if (failure.name !== "AbortError") setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resourceReload]);

  const choices = resources[values.resource_type];
  function change(event) {
    const { name, value } = event.target;
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "resource_type") next.resource_id = resources[value][0] ? String(resources[value][0].id) : "";
      return next;
    });
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!event.currentTarget.reportValidity()) return;
    if (new Date(values.ends_at) <= new Date(values.starts_at)) {
      setFieldErrors({ ends_at: "Choose an end time after the start time." });
      return;
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    const payload = {
      resource_type: values.resource_type,
      resource_id: Number(values.resource_id),
      starts_at: toApiDateTime(values.starts_at),
      ends_at: toApiDateTime(values.ends_at),
      notes: values.notes.trim() || null,
    };
    if (values.resource_type === "equipment") payload.quantity = Number(values.quantity);
    try {
      const booking = await api.post("/bookings", payload);
      navigate("/bookings/mine", { replace: true, state: { notice: `Booking request #${booking.id} submitted. Status: pending.` } });
    } catch (failure) {
      setError(failure.message);
      setFieldErrors(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading message="Loading available facilities and equipment…" />;
  const hasResources = resources.facilities.length > 0 || resources.equipment.length > 0;
  return <section className="business-page" aria-labelledby="booking-form-title">
    <header className="business-heading"><div><p className="business-eyebrow">BOOKINGS</p><h1 id="booking-form-title">Request a booking</h1><p>Choose an active resource and send a request for approval.</p></div></header>
    <form className="business-card business-form" onSubmit={submit} noValidate>
      <Notice>{error}</Notice>
      {!hasResources && error && <Button type="button" className="button-secondary" onClick={() => setResourceReload((value) => value + 1)}>Retry loading resources</Button>}
      {!hasResources && !error && <Notice>No active facilities or equipment are available to book right now.</Notice>}
      <div className="business-field"><label htmlFor="booking-resource-type">Resource type</label><select id="booking-resource-type" name="resource_type" value={values.resource_type} disabled={busy} onChange={change}><option value="facility">Facility</option><option value="equipment">Equipment</option></select></div>
      <div className="business-field"><label htmlFor="booking-resource-id">Resource</label><select id="booking-resource-id" name="resource_id" required value={values.resource_id} disabled={busy || choices.length === 0} onChange={change} aria-invalid={Boolean(fieldErrors.resource_id)}><option value="">Select a resource</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}{item.total_quantity ? ` (${item.total_quantity} total)` : ""}</option>)}</select>{fieldErrors.resource_id && <span className="field-error">{fieldErrors.resource_id}</span>}</div>
      <Field label="Starts" name="starts_at" type="datetime-local" required value={values.starts_at} disabled={busy} onChange={change} error={fieldErrors.starts_at} />
      <Field label="Ends" name="ends_at" type="datetime-local" required value={values.ends_at} disabled={busy} onChange={change} error={fieldErrors.ends_at} />
      {values.resource_type === "equipment" && <Field label="Quantity" name="quantity" type="number" min="1" step="1" required value={values.quantity} disabled={busy} onChange={change} error={fieldErrors.quantity} />}
      <div className="business-field"><label htmlFor="booking-notes">Notes (optional)</label><textarea id="booking-notes" name="notes" maxLength={1000} value={values.notes} disabled={busy} onChange={change} aria-invalid={Boolean(fieldErrors.notes)} aria-describedby={fieldErrors.notes ? "booking-notes-error" : undefined} />{fieldErrors.notes && <span className="field-error" id="booking-notes-error">{fieldErrors.notes}</span>}</div>
      <p className="business-hint">Times are submitted with your local time zone and converted to UTC. The request remains pending until reviewed.</p>
      <div className="business-actions"><Button type="submit" busy={busy} disabled={!hasResources || !values.resource_id}>{busy ? "Submitting…" : "Submit booking request"}</Button></div>
    </form>
  </section>;
}
