import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const AUDIENCE_LABELS = ["Campus community", "Students", "Coaches", "Administrators"];

export default function AnnouncementForm({ announcements = [], onSave }) {
  const { announcementId } = useParams();
  const navigate = useNavigate();
  const announcement = announcements.find((item) => item.id === announcementId);
  const editing = Boolean(announcementId);
  const [error, setError] = useState("");

  if (editing && !announcement) {
    return (
      <section className="not-found">
        <p className="eyebrow">Announcement not found</p>
        <h1>We couldn't find that announcement.</h1>
        <Link className="primary-button" to="/announcements">View announcements</Link>
      </section>
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const title = values.get("title").trim();
    const body = values.get("body").trim();
    if (title.length < 3 || body.length < 10) {
      setError("Enter a title of at least 3 characters and message of at least 10 characters.");
      return;
    }

    const status = event.nativeEvent.submitter?.value === "publish" ? "Published" : "Draft";
    try {
      const id = onSave({
        id: announcement?.id,
        title,
        body,
        audience: values.getAll("audience"),
        status,
        author: announcement?.author ?? "Sports Hub",
        date: new Date().toISOString().slice(0, 10),
      });
      navigate(`/announcements/${id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the announcement.");
    }
  }

  return (
    <section className="announcement-form-page">
      <div className="announcement-form-aside">
        <Link className="back-link" to={announcement ? `/announcements/${announcement.id}` : "/announcements"}>← Back to announcements</Link>
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
        <label>Title<input name="title" defaultValue={announcement?.title ?? ""} minLength="3" maxLength="120" required /></label>
        <label>Message<textarea name="body" rows="7" defaultValue={announcement?.body ?? ""} minLength="10" maxLength="3000" required /></label>
        <fieldset className="audience-fieldset">
          <legend>Audience labels <span className="optional-label">(optional)</span></legend>
          <p>Labels only for preview; permissions and delivery are not configured.</p>
          <div className="audience-options">
            {AUDIENCE_LABELS.map((label) => (
              <label key={label}>
                <input type="checkbox" name="audience" value={label} defaultChecked={announcement?.audience.includes(label) ?? false} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="announcement-form-actions">
          <button className="secondary-button" type="submit" name="action" value="draft">Save draft</button>
          <button className="primary-button" type="submit" name="action" value="publish">Publish <span aria-hidden="true">→</span></button>
        </div>
        <p className="form-note">Preview only — announcement data is not sent to a server.</p>
      </form>
    </section>
  );
}
