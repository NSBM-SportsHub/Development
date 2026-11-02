import { useEffect, useState } from "react";
import { api } from "../../shared/api.js";
import { Button, Notice } from "../../shared/ui.jsx";

export default function MembershipApplication() {
  const [values, setValues] = useState({ club_id: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api.get("/clubs", { signal: controller.signal }).then((records) => {
      if (!controller.signal.aborted) setClubs(records.filter((club) => ["active", "recruiting"].includes(club.status)));
    }).catch((failure) => {
      if (failure.name !== "AbortError") setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  function updateValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setError("");
    setSuccess("");
    setFieldErrors({});
    try {
      const membership = await api.post("/memberships", {
        club_id: Number(values.club_id),
        message: values.message.trim() || null,
      });
      setSuccess(`Your application to ${membership.club_name} has been submitted. Its status is pending.`);
      setValues({ club_id: "", message: "" });
    } catch (failure) {
      setError(failure.code === "duplicate_application"
        ? "You already have a pending application or active membership for this club."
        : failure.code === "club_not_accepting"
          ? "This club is not currently accepting applications."
          : failure.message);
      setFieldErrors(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }

  return <section className="business-page" aria-labelledby="membership-apply-title">
    <header className="business-heading"><div><p className="business-eyebrow">MEMBERSHIPS</p><h1 id="membership-apply-title">Apply to join a club</h1><p>Submit an application and check its progress in My memberships.</p></div></header>
    <form className="business-card business-form" onSubmit={submit} noValidate>
      <Notice>{error}</Notice><Notice type="success">{success}</Notice>
      <div className="business-field">
        <label htmlFor="membership-club">Club</label>
        <select id="membership-club" name="club_id" required value={values.club_id} disabled={busy || loading} onChange={(event) => updateValue("club_id", event.target.value)} aria-invalid={Boolean(fieldErrors.club_id)} aria-describedby={fieldErrors.club_id ? "membership-club-error" : undefined}>
          <option value="">{loading ? "Loading clubs…" : "Choose a club"}</option>
          {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>
        {fieldErrors.club_id && <span className="field-error" id="membership-club-error">{fieldErrors.club_id}</span>}
        {!loading && clubs.length === 0 && !error && <p>No clubs are currently accepting applications.</p>}
        {!loading && error && <Button type="button" className="button-secondary" onClick={() => setReload((value) => value + 1)}>Reload clubs</Button>}
      </div>
      <div className="business-field"><label htmlFor="membership-message">Why would you like to join? (optional)</label><textarea id="membership-message" name="message" maxLength={1000} value={values.message} disabled={busy} onChange={(event) => updateValue("message", event.target.value)} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? "membership-message-error" : "membership-message-hint"} />{fieldErrors.message ? <span className="field-error" id="membership-message-error">{fieldErrors.message}</span> : <span className="field-hint" id="membership-message-hint">{values.message.length}/1000 characters</span>}</div>
      <div className="business-actions"><Button type="submit" busy={busy} disabled={loading || !values.club_id || Number(values.club_id) < 1}>{busy ? "Submitting…" : "Submit application"}</Button></div>
    </form>
  </section>;
}
