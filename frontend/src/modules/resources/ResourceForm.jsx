import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../shared/api.js";
import { Button, Field, Loading, Notice } from "../../shared/ui.jsx";

const emptyValues = {
  facilities: { name: "", description: "", location: "", capacity: "" },
  equipment: { name: "", description: "", total_quantity: "1" },
};

export default function ResourceForm({ type }) {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(resourceId);
  const [values, setValues] = useState(emptyValues[type]);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!editing) return undefined;
    const controller = new AbortController();
    api.get(`/${type}/${resourceId}`, { signal: controller.signal }).then((record) => {
      if (!controller.signal.aborted) setValues({ ...emptyValues[type], ...record, capacity: record.capacity ?? "", location: record.location ?? "", description: record.description ?? "", total_quantity: String(record.total_quantity ?? 1) });
    }).catch((failure) => {
      if (failure.name !== "AbortError") setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [editing, resourceId, type]);

  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setError("");
    setFieldErrors({});
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
    };
    if (type === "facilities") {
      payload.location = values.location.trim() || null;
      payload.capacity = values.capacity === "" ? null : Number(values.capacity);
    } else {
      payload.total_quantity = Number(values.total_quantity);
    }
    try {
      if (editing) await api.patch(`/${type}/${resourceId}`, payload);
      else await api.post(`/${type}`, payload);
      navigate(`/${type}`, { replace: true, state: { notice: `${values.name} ${editing ? "updated" : "created"} successfully.` } });
    } catch (failure) {
      setError(failure.message);
      setFieldErrors(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading message={`Loading ${type === "facilities" ? "facility" : "equipment"} details…`} />;

  return <section className="business-page" aria-labelledby="resource-form-title">
    <header className="business-heading"><div><p className="business-eyebrow">RESOURCE MANAGEMENT</p><h1 id="resource-form-title">{editing ? "Edit" : "Add"} {type === "facilities" ? "facility" : "equipment"}</h1><p>Changes are saved to SportsHub and remain available after refresh.</p></div></header>
    <form className="business-card business-form" onSubmit={save} noValidate>
      <Notice>{error}</Notice>
      <Field label="Name" name="name" required maxLength={120} value={values.name} disabled={busy} onChange={change} error={fieldErrors.name} />
      {type === "facilities" ? <>
        <Field label="Location (optional)" name="location" maxLength={160} value={values.location} disabled={busy} onChange={change} error={fieldErrors.location} />
        <Field label="Capacity (optional)" name="capacity" type="number" min="1" step="1" value={values.capacity} disabled={busy} onChange={change} error={fieldErrors.capacity} />
      </> : <Field label="Total quantity" name="total_quantity" type="number" min="1" step="1" required value={values.total_quantity} disabled={busy} onChange={change} error={fieldErrors.total_quantity} />}
      <div className="business-field"><label htmlFor="resource-description">Description (optional)</label><textarea id="resource-description" name="description" maxLength={2000} value={values.description} disabled={busy} onChange={change} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "resource-description-error" : undefined} />{fieldErrors.description && <span className="field-error" id="resource-description-error">{fieldErrors.description}</span>}</div>
      <div className="business-actions"><Link className="button button-secondary" to={`/${type}`}>Cancel</Link><Button type="submit" busy={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create"}</Button></div>
    </form>
  </section>;
}
