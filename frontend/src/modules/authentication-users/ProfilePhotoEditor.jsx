import { useEffect, useRef, useState } from "react";
import { api } from "../../shared/api.js";
import { Button, Notice } from "../../shared/ui.jsx";

export default function ProfilePhotoEditor({ user, onSaved, onBusy, disabled }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function clearSelection() {
    setFile(null);
    if (input.current) input.current.value = "";
  }
  function choose(event) {
    setError(""); setSuccess("");
    const selected = event.target.files?.[0];
    if (!selected) { clearSelection(); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { clearSelection(); setError("Choose a JPEG, PNG or WebP image."); return; }
    if (!selected.size || selected.size > 5 * 1024 * 1024) { clearSelection(); setError("Choose an image no larger than 5 MB."); return; }
    setFile(selected);
  }
  async function save(remove = false) {
    if (pending.current || disabled || (!remove && !file)) return;
    pending.current = true; setBusy(true); onBusy(true); setError(""); setSuccess("");
    try {
      let updated;
      if (remove) updated = await api.delete("/users/me/photo");
      else {
        const body = new FormData(); body.append("photo", file);
        updated = await api.post("/users/me/photo", body);
      }
      onSaved(updated); clearSelection();
      setSuccess(remove ? "Your profile photo has been removed." : "Your profile photo has been updated.");
    } catch (failure) { setError(failure.fields?.photo || failure.message); }
    finally { pending.current = false; setBusy(false); onBusy(false); }
  }
  return <fieldset className="profile-photo-editor" disabled={disabled || busy}>
    <legend>Profile photo</legend>
    <p>JPEG, PNG or WebP, up to 5 MB. Photo changes save immediately.</p>
    <Notice>{error}</Notice><Notice type="success">{success}</Notice>
    <label htmlFor="profile-photo-file">Choose a profile photo</label>
    <input ref={input} id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} />
    {preview && <img className="profile-photo-preview" src={preview} alt="Selected profile photo preview" />}
    <div className="profile-edit-actions"><Button type="button" disabled={!file} busy={busy} onClick={() => save(false)}>Upload photo</Button>{file && <Button type="button" className="button-secondary" onClick={clearSelection}>Cancel selection</Button>}{user.photo_url && <Button type="button" className="button-secondary" onClick={() => save(true)}>Remove photo</Button>}</div>
  </fieldset>;
}
