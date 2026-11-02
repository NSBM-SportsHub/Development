import { useEffect, useState } from "react";
import { api } from "../../shared/api.js";
import { Button, Field, Modal, Notice } from "../../shared/ui.jsx";

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getMinutes())}`;
}

export default function MatchForm({ tournamentId, match, entries, onClose, onSaved }) {
  const editing = Boolean(match);
  const [values, setValues] = useState({
    home_entry_id: match ? String(match.home_entry_id) : "",
    away_entry_id: match ? String(match.away_entry_id) : "",
    round_no: match?.round_no ?? 1,
    scheduled_at: localDateTime(match?.scheduled_at),
    facility_id: match?.facility_id == null ? "" : String(match.facility_id),
    venue: match?.venue || "",
    status: match?.status || "scheduled",
  });
  const [fields, setFields] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [facilities, setFacilities] = useState([]);
  const [facilityError, setFacilityError] = useState("");
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/facilities", { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setFacilities(result);
    }).catch((failure) => {
      if (failure.name !== "AbortError") setFacilityError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setFacilitiesLoading(false);
    });
    return () => controller.abort();
  }, []);
  const change = (event) => {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFields((current) => ({ ...current, [event.target.name]: "" }));
  };

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const body = editing
      ? {
        round_no: Number(values.round_no),
        scheduled_at: values.scheduled_at ? new Date(values.scheduled_at).toISOString() : null,
        facility_id: values.facility_id ? Number(values.facility_id) : null,
        venue: values.venue.trim() || null,
        status: values.status,
      }
      : {
        home_entry_id: Number(values.home_entry_id),
        away_entry_id: Number(values.away_entry_id),
        round_no: Number(values.round_no),
        scheduled_at: values.scheduled_at ? new Date(values.scheduled_at).toISOString() : null,
        facility_id: values.facility_id ? Number(values.facility_id) : null,
        venue: values.venue.trim() || null,
      };
    try {
      const saved = editing
        ? await api.patch(`/matches/${match.id}`, body)
        : await api.post(`/tournaments/${tournamentId}/matches`, body);
      onSaved(saved);
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }

  const select = (name, label, options) => (
    <div className="field">
      <label htmlFor={`match-${name}`}>{label}</label>
      <select
        id={`match-${name}`}
        name={name}
        value={values[name]}
        onChange={change}
        disabled={busy}
        aria-invalid={Boolean(fields[name])}
        aria-describedby={fields[name] ? `match-${name}-error` : undefined}
        required
      >
        {options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
      </select>
      {fields[name] && <span className="field-error" id={`match-${name}-error`}>{fields[name]}</span>}
    </div>
  );

  return (
    <Modal title={editing ? "Edit match schedule" : "Schedule a match"} subtitle="Set the round, time and venue." onClose={onClose} busy={busy}>
      <form onSubmit={save}>
        <Notice>{error}</Notice>
        <Notice>{facilityError}</Notice>
        <div className="form-grid match-form-grid">
          {!editing && <>
            {select("home_entry_id", "Home entry", [["", "Choose an entry"], ...entries.map((entry) => [String(entry.id), entry.name])])}
            {select("away_entry_id", "Away entry", [["", "Choose an entry"], ...entries.map((entry) => [String(entry.id), entry.name])])}
          </>}
          <Field name="round_no" label="Round" type="number" min={1} max={1000} step={1} required value={values.round_no} onChange={change} error={fields.round_no} disabled={busy} />
          <Field name="scheduled_at" label="Date and time" type="datetime-local" value={values.scheduled_at} onChange={change} error={fields.scheduled_at} disabled={busy} />
          <div className="field">
            <label htmlFor="match-facility-id">Facility (optional)</label>
            <select
              id="match-facility-id"
              name="facility_id"
              value={values.facility_id}
              onChange={change}
              disabled={busy || facilitiesLoading || Boolean(facilityError)}
              aria-invalid={Boolean(fields.facility_id)}
              aria-describedby={fields.facility_id ? "match-facility-id-error" : undefined}
            >
              <option value="">{facilitiesLoading ? "Loading facilities…" : "No facility selected"}</option>
              {facilities.map((facility) => <option value={facility.id} key={facility.id}>{facility.name}</option>)}
            </select>
            {fields.facility_id && <span className="field-error" id="match-facility-id-error">{fields.facility_id}</span>}
          </div>
          {editing && select("status", "Match status", [["scheduled", "Scheduled"], ["postponed", "Postponed"]])}
          <Field name="venue" label="Venue" maxLength={160} value={values.venue} onChange={change} error={fields.venue} disabled={busy} />
        </div>
        <div className="modal-actions">
          <Button type="button" className="button-secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" busy={busy}>{busy ? "Saving…" : editing ? "Save schedule" : "Schedule match"}</Button>
        </div>
      </form>
    </Modal>
  );
}
