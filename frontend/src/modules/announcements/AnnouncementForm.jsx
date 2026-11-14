import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function AnnouncementForm({ announcements = [], loading = false, error: loadError = "", onSave }) {
  const { announcementId } = useParams();
  const navigate = useNavigate();
  const announcement = announcements.find((item) => item.announcement_id === announcementId);
  const editing = Boolean(announcementId);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const fileInput = useRef(null);
  useEffect(() => {
    if (!image) { setPreview(null); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function chooseImage(event) {
    const selected = event.target.files?.[0] ?? null;
    if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024 || selected.size === 0)) {
      setError('Choose a JPEG, PNG or WebP image no larger than 5 MB.');
      event.target.value = '';
      return;
    }
    setImage(selected); setRemoveImage(false); setError('');
  }

  if (loading) return <div className="club-state" role="status">Loading announcement…</div>;
  if (loadError) return <div className="club-state" role="alert">{loadError}</div>;

  if (editing && !announcement) {
    return (
      <section className="not-found">
        <p className="eyebrow">Announcement not found</p>
        <h1>We couldn't find that announcement.</h1>
        <Link className="primary-button" to="/announcements">View announcements</Link>
      </section>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const title = values.get("title").trim();
    const body = values.get("body").trim();
    const rawClubId = values.get("club_id").trim();
    const clubId = rawClubId === "" ? null : Number(rawClubId);
    if (title.length < 3 || body.length < 10) {
      setError("Enter a title of at least 3 characters and message of at least 10 characters.");
      return;
    }
    if (clubId !== null && (!Number.isSafeInteger(clubId) || clubId < 1 || clubId > 2147483647)) {
      setError("Enter a valid existing club ID or leave it empty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const id = await onSave({
        id: savedId ?? announcement?.announcement_id,
        image,
        removeImage,
        fields: {
          title,
          body,
          club_id: clubId,
          is_pinned: values.get("is_pinned") === "on",
        },
      });
      navigate(`/announcements/${id}`);
    } catch (saveError) {
      if (saveError.announcementId) setSavedId(saveError.announcementId);
      setError(saveError instanceof Error ? saveError.message : "Unable to save the announcement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="announcement-form-page">
      <div className="announcement-form-aside">
        <Link className="back-link" to={announcement ? `/announcements/${announcement.announcement_id}` : "/announcements"}>← Back to announcements</Link>
        <p className="eyebrow">{editing ? "Update announcement" : "Share an update"}</p>
        <h1>{editing ? "Keep everyone in the loop." : "Your news matters."}</h1>
        <p>Prepare an update for the NSBM sports community.</p>
        <span className="form-decoration" aria-hidden="true">NSBM<br />SPORTS HUB</span>
      </div>
      <form className="announcement-form" onSubmit={handleSubmit}>
        <div className="form-title">
          <p className="eyebrow">{editing ? "Announcement details" : "New announcement"}</p>
          <h2>{editing ? "Edit announcement" : "Create announcement"}</h2>
        </div>
        <label>Title<input name="title" defaultValue={announcement?.title ?? ""} minLength="3" maxLength="255" required /></label>
        <label>Message<textarea name="body" rows="7" defaultValue={announcement?.body ?? ""} minLength="10" maxLength="65535" required /></label>
        <div className="announcement-image-field">
          <label htmlFor="announcement-image">Image <span className="optional-label">(optional)</span></label>
          <p id="announcement-image-help">Add an image to feature this announcement on the public home page. JPEG, PNG or WebP, up to 5 MB.</p>
          <input id="announcement-image" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={saving} aria-describedby="announcement-image-help" />
          {(preview || (!removeImage && announcement?.image_url)) && <div className="announcement-image-preview">
            <img src={preview || announcement.image_url} alt="Announcement image preview" referrerPolicy="no-referrer" />
            <button type="button" className="button button-secondary button-small" disabled={saving} onClick={() => { setImage(null); setRemoveImage(Boolean(announcement?.image_url)); fileInput.current.value = ''; }}>Remove image</button>
          </div>}
          {removeImage && announcement?.image_url && <p>This image will be removed when you save. <button className="text-button" type="button" disabled={saving} onClick={() => setRemoveImage(false)}>Keep current image</button></p>}
        </div>
        <label>Club ID <span className="optional-label">(optional for campus-wide announcements)</span>
          <input name="club_id" type="number" min="1" max="2147483647" step="1" defaultValue={announcement?.club_id ?? ""} />
        </label>
        <label className="announcement-pin-option">
          <input type="checkbox" name="is_pinned" defaultChecked={announcement?.is_pinned ?? false} />
          Pin this announcement
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="announcement-form-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save announcement"} <span aria-hidden="true">→</span>
          </button>
        </div>
        <p className="form-note">Changes are saved to the SportsHub database.</p>
      </form>
    </section>
  );
}
