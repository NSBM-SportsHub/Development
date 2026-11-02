import { useState } from "react";
import { api } from "../../shared/api.js";
import { Button, Field, Modal, Notice } from "../../shared/ui.jsx";

export default function ResultForm({ match, tournament, onClose, onSaved }) {
  const [values, setValues] = useState({
    home_score: match.home_score ?? "",
    away_score: match.away_score ?? "",
    winner_entry_id: match.winner_entry_id == null ? "" : String(match.winner_entry_id),
    result_notes: match.result_notes || "",
  });
  const [fields, setFields] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tied = values.home_score !== "" && values.away_score !== "" && Number(values.home_score) === Number(values.away_score);
  const needsTieBreak = tournament.format === "knockout" && tied;
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
    try {
      const saved = await api.put(`/matches/${match.id}/result`, {
        home_score: Number(values.home_score),
        away_score: Number(values.away_score),
        winner_entry_id: needsTieBreak ? Number(values.winner_entry_id) : null,
        result_notes: values.result_notes.trim() || null,
      });
      onSaved(saved);
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={match.status === "completed" ? "Correct match result" : "Enter match result"}
      subtitle={`${match.home_name} vs ${match.away_name}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save}>
        <Notice>{error}</Notice>
        <div className="form-grid match-form-grid">
          <Field name="home_score" label={`${match.home_name} score`} type="number" min={0} max={999} step={1} required value={values.home_score} onChange={change} error={fields.home_score} disabled={busy} />
          <Field name="away_score" label={`${match.away_name} score`} type="number" min={0} max={999} step={1} required value={values.away_score} onChange={change} error={fields.away_score} disabled={busy} />
          {needsTieBreak && (
            <div className="field">
              <label htmlFor="match-winner-entry">Tie-break winner</label>
              <select
                id="match-winner-entry"
                name="winner_entry_id"
                value={values.winner_entry_id}
                onChange={change}
                disabled={busy}
                aria-invalid={Boolean(fields.winner_entry_id)}
                aria-describedby={fields.winner_entry_id ? "match-winner-entry-error" : undefined}
                required
              >
                <option value="">Choose the tie-break winner</option>
                <option value={match.home_entry_id}>{match.home_name}</option>
                <option value={match.away_entry_id}>{match.away_name}</option>
              </select>
              {fields.winner_entry_id && <span className="field-error" id="match-winner-entry-error">{fields.winner_entry_id}</span>}
            </div>
          )}
          <div className="field match-notes-field">
            <label htmlFor="match-result-notes">Result notes (optional)</label>
            <textarea id="match-result-notes" name="result_notes" rows={3} maxLength={500} value={values.result_notes} onChange={change} disabled={busy} aria-invalid={Boolean(fields.result_notes)} aria-describedby={fields.result_notes ? "match-result-notes-error" : undefined} />
            {fields.result_notes && <span className="field-error" id="match-result-notes-error">{fields.result_notes}</span>}
          </div>
        </div>
        {tournament.format === "league" && tied && <p className="field-hint">A level league score is recorded as a draw; no winner is selected.</p>}
        <div className="modal-actions">
          <Button type="button" className="button-secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" busy={busy}>{busy ? "Saving…" : "Save result"}</Button>
        </div>
      </form>
    </Modal>
  );
}
