import { useEffect, useRef, useState } from "react";
import { api } from "../../shared/api.js";
import { useBranding } from "../../shared/BrandingContext.jsx";
import { Button, Icon, Notice, UniversityMark } from "../../shared/ui.jsx";

export default function UniversityLogoEditor() {
  const { branding, error: brandingError, updateBranding, refreshBranding } = useBranding();
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const input = useRef(null);
  const pending = useRef(false);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function clearSelection() { setFile(null); if (input.current) input.current.value = ""; }
  function choose(event) {
    setError(""); setSuccess("");
    const chosen = event.target.files?.[0];
    if (!chosen) { clearSelection(); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(chosen.type)) { clearSelection(); setError("Choose a JPEG, PNG or WebP logo."); return; }
    if (!chosen.size || chosen.size > 5 * 1024 * 1024) { clearSelection(); setError("Choose a logo no larger than 5 MB."); return; }
    setFile(chosen);
  }
  async function save(remove = false) {
    if (pending.current || (!remove && !file)) return;
    pending.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      let result;
      if (remove) result = await api.delete("/branding/logo");
      else { const body = new FormData(); body.append("logo", file); result = await api.post("/branding/logo", body); }
      updateBranding(result); clearSelection(); setEditing(false);
      setSuccess(remove ? "The default website logo has been restored." : "The university logo has been updated across SportsHub.");
    } catch (failure) { setError(failure.fields?.logo || failure.message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="card university-logo-card" aria-labelledby="university-logo-title">
    <div className="card-heading"><span className="section-icon"><Icon name="clubs" /></span><div><h2 id="university-logo-title">University logo</h2><p>Only Admins can change the shared website and loading-screen logo.</p></div></div>
    <Notice>{error || brandingError}</Notice><Notice type="success">{success}</Notice>
    <div className="university-logo-current"><UniversityMark /><p>{branding.university_logo_url ? "This logo is shown to everyone across SportsHub." : "SportsHub is using its default logo."}</p></div>
    {brandingError && <Button type="button" className="button-secondary" disabled={busy} onClick={() => refreshBranding()}>Reload university logo</Button>}
    {editing ? <fieldset className="university-logo-form" disabled={busy}>
      <label htmlFor="university-logo-file">Choose a university logo</label><input ref={input} id="university-logo-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} />
      <p>JPEG, PNG or WebP, up to 5 MB. The full logo keeps its proportions; a transparent PNG or WebP works well.</p>
      {preview && <img className="university-logo-preview" src={preview} alt="Selected university logo preview" />}
      <div className="profile-edit-actions"><Button type="button" busy={busy} disabled={!file} onClick={() => save()}>Save university logo</Button><Button type="button" className="button-secondary" onClick={() => { clearSelection(); setEditing(false); setError(""); }}>Cancel</Button></div>
    </fieldset> : <div className="profile-edit-actions"><Button type="button" className="button-secondary" onClick={() => { setEditing(true); setError(""); setSuccess(""); }}>Change university logo</Button>{branding.university_logo_url && <Button type="button" className="button-secondary" busy={busy} onClick={() => save(true)}>Use default logo</Button>}</div>}
  </section>;
}
