import { useEffect, useState } from "react";
import { api } from "../../shared/api.js";
import { Feedback } from "../../shared/Feedback.jsx";
import { FormField } from "../../shared/FormField.jsx";
import { Button, Modal } from "../../shared/ui.jsx";

const emptyTournament = {
  sport_id: "",
  name: "",
  description: "",
  format: "league",
  starts_on: "",
  ends_on: "",
  registration_closes_at: "",
  max_entries: "",
  min_team_size: 1,
  max_team_size: 1,
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
};

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initialValues(tournament) {
  if (!tournament) return emptyTournament;
  return {
    ...emptyTournament,
    ...tournament,
    sport_id: String(tournament.sport_id),
    description: tournament.description || "",
    max_entries: tournament.max_entries == null ? "" : String(tournament.max_entries),
    registration_closes_at: localDateTime(tournament.registration_closes_at),
  };
}

export default function TournamentForm({ tournament, onClose, onSaved }) {
  const editing = Boolean(tournament);
  const [values, setValues] = useState(() => initialValues(tournament));
  const [fields, setFields] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sports, setSports] = useState([]);
  const [sportsError, setSportsError] = useState("");
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsRetry, setSportsRetry] = useState(0);
  const locked = editing && tournament.status !== "draft";
  const editable = !editing || !["completed", "cancelled"].includes(tournament.status);

  useEffect(() => {
    const controller = new AbortController();
    setSportsLoading(true);
    setSportsError("");
    api.get("/sports", { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setSports(result);
    }).catch((failure) => {
      if (failure.name !== "AbortError") setSportsError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setSportsLoading(false);
    });
    return () => controller.abort();
  }, [sportsRetry]);

  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFields((current) => ({ ...current, [event.target.name]: "" }));
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    const body = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      starts_on: values.starts_on,
      ends_on: values.ends_on,
      registration_closes_at: values.registration_closes_at
        ? new Date(values.registration_closes_at).toISOString()
        : null,
      max_entries: values.max_entries === "" ? null : Number(values.max_entries),
      ...(values.format === "league" ? {
        points_win: Number(values.points_win),
        points_draw: Number(values.points_draw),
        points_loss: Number(values.points_loss),
      } : {}),
    };
    if (!locked) {
      body.sport_id = Number(values.sport_id);
      body.format = values.format;
      body.min_team_size = Number(values.min_team_size);
      body.max_team_size = Number(values.max_team_size);
    }
    try {
      const saved = editing
        ? await api.patch(`/tournaments/${tournament.id}`, body)
        : await api.post("/tournaments", body);
      onSaved(saved, editing ? "Tournament updated." : "Tournament created.");
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }

  const input = (name, label, props = {}) => (
    <FormField
      name={name}
      label={label}
      value={values[name] ?? ""}
      onChange={change}
      error={fields[name]}
      disabled={busy || !editable || (locked && ["sport_id", "format", "min_team_size", "max_team_size"].includes(name))}
      {...props}
    />
  );
  const select = (name, label, options, disabled = false) => (
    <div className="field">
      <label htmlFor={`tournament-${name}`}>{label}</label>
      <select
        id={`tournament-${name}`}
        name={name}
        value={values[name]}
        onChange={change}
        disabled={busy || !editable || disabled}
        aria-invalid={Boolean(fields[name])}
        aria-describedby={fields[name] ? `tournament-${name}-error` : undefined}
      >
        {options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
      </select>
      {fields[name] && <span className="field-error" id={`tournament-${name}-error`}>{fields[name]}</span>}
    </div>
  );

  return (
    <Modal
      title={editing ? "Edit tournament" : "Create tournament"}
      subtitle={editing ? "Update tournament details." : "Set up a new competition."}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save}>
        <Feedback>{error}</Feedback>
        <Feedback>{sportsError}</Feedback>
        {!editable && <Feedback type="success">Completed and cancelled tournaments are read-only.</Feedback>}
        <div className="form-grid tournament-form-grid">
          <div className="field">
            <label htmlFor="tournament-sport">Sport</label>
            <select
              id="tournament-sport"
              name="sport_id"
              value={values.sport_id}
              onChange={change}
              disabled={busy || !editable || locked || sportsLoading || Boolean(sportsError)}
              required
              aria-invalid={Boolean(fields.sport_id)}
              aria-describedby={fields.sport_id ? "tournament-sport-error" : undefined}
            >
              <option value="">{sportsLoading ? "Loading sports…" : "Choose a sport"}</option>
              {sports.map((sport) => <option value={sport.id} key={sport.id}>{sport.name}</option>)}
              {editing && !sports.some((sport) => sport.id === tournament.sport_id) && (
                <option value={values.sport_id}>{tournament.sport_name} (inactive)</option>
              )}
            </select>
            {!sportsLoading && !sportsError && sports.length === 0 && <span className="field-error">No active sports are currently available.</span>}
            {fields.sport_id && <span className="field-error" id="tournament-sport-error">{fields.sport_id}</span>}
            {sportsError && (
              <button className="text-button" type="button" onClick={() => { setSportsLoading(true); setSportsRetry((value) => value + 1); }}>
                Try loading sports again
              </button>
            )}
          </div>
          {input("name", "Tournament name", { minLength: 2, maxLength: 150, required: true })}
          {select("format", "Format", [["league", "League"], ["knockout", "Knockout"]], locked)}
          {input("starts_on", "Start date", { type: "date", required: true })}
          {input("ends_on", "End date", { type: "date", required: true })}
          {input("registration_closes_at", "Registration closes", { type: "datetime-local" })}
          {input("max_entries", "Maximum entries", { type: "number", min: 2, max: 1000, step: 1 })}
          {input("min_team_size", "Minimum team size", { type: "number", min: 1, max: 100, step: 1, required: true })}
          {input("max_team_size", "Maximum team size", { type: "number", min: 1, max: 100, step: 1, required: true })}
          {values.format === "league" && <>
            {input("points_win", "Points for a win", { type: "number", min: 0, max: 20, step: 1, required: true })}
            {input("points_draw", "Points for a draw", { type: "number", min: 0, max: 20, step: 1, required: true })}
            {input("points_loss", "Points for a loss", { type: "number", min: 0, max: 20, step: 1, required: true })}
          </>}
          <div className="field tournament-description">
            <label htmlFor="tournament-description">Description</label>
            <textarea
              id="tournament-description"
              name="description"
              value={values.description}
              onChange={change}
              maxLength={5000}
              rows={4}
              disabled={busy || !editable}
              aria-invalid={Boolean(fields.description)}
              aria-describedby={fields.description ? "tournament-description-error" : undefined}
            />
            {fields.description && <span className="field-error" id="tournament-description-error">{fields.description}</span>}
          </div>
        </div>
        <div className="modal-actions">
          <Button type="button" className="button-secondary" onClick={onClose} disabled={busy}>Close</Button>
          {editable && <Button type="submit" busy={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create tournament"}</Button>}
        </div>
      </form>
    </Modal>
  );
}
