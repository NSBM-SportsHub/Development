import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../shared/api.js";
import { useAuth } from "../../shared/AuthContext.jsx";
import GlassSelect from "../../shared/GlassSelect.jsx";


export default function ClubForm({ clubs, loading, onSave }) {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const selectedClub = clubs.find((club) => club.id === clubId);
  const isEditing = Boolean(clubId);
  const { user } = useAuth();
  const [sports, setSports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sport, setSport] = useState(String(selectedClub?.sport_id ?? ""));
  const [status, setStatus] = useState(selectedClub?.status ?? "Recruiting");

  useEffect(() => {
    if (selectedClub) {
      setSport(String(selectedClub.sport_id));
      setStatus(selectedClub.status);
    }
  }, [selectedClub]);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/sports", { signal: controller.signal }).then(setSports).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, []);

  if (user.role !== "admin") return <div className="club-state" role="alert">Only administrators can manage clubs.</div>;
  if (loading) {
    return <div className="club-state" role="status">Loading club information…</div>;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const name = values.get("name").trim();
    const description = values.get("description").trim();
    if (name.length < 3 || description.length < 20) {
      setError("Enter a club name of at least 3 characters and a description of at least 20 characters.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const id = await onSave({
        id: selectedClub?.id,
        name,
        sport_id: values.get("sport"),
        sport: sports.find((item) => String(item.id) === values.get("sport"))?.name,
        status: values.get("status"),
        description,
      });
      navigate(`/sports-clubs/${id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the club.");
    } finally { setBusy(false); }
  }

  if (isEditing && !selectedClub) {
    return (
      <section className="not-found">
        <p className="eyebrow">Club not found</p>
        <h1>We couldn't find that team.</h1>
        <Link className="primary-button" to="/sports-clubs">Browse all clubs</Link>
      </section>
    );
  }

  return (
    <section className="club-form-page">
      <div className="form-aside">
        <Link className="back-link" to={selectedClub ? `/sports-clubs/${selectedClub.id}` : "/sports-clubs"}>← Back to clubs</Link>
        <p className="eyebrow">{isEditing ? "Club management" : "Find your team"}</p>
        <h1>{isEditing ? "Update club" : "Build your team."}</h1>
        <p>{isEditing ? "Keep your club information up to date." : "Add a club to the NSBM Sports Hub community."}</p>
        <span className="form-decoration" aria-hidden="true">NSBM<br />SPORTS HUB</span>
      </div>

      <form className="club-form" onSubmit={handleSubmit}>
        <div className="form-title">
          <p className="eyebrow">{isEditing ? "Club details" : "New club"}</p>
          <h2>{isEditing ? "Edit club information" : "Create a club"}</h2>
        </div>

        <label>
          Club name
          <input name="name" defaultValue={selectedClub?.name ?? ""} minLength="3" maxLength="60" required />
        </label>
        <label>
          Sport
          <GlassSelect label="Sport" name="sport" value={sport} onChange={setSport} required placeholder="Choose a sport" options={sports.map((item) => ({ value: String(item.id), label: item.name }))} />
        </label>
        <label>
          Status
          <GlassSelect label="Status" name="status" value={status} onChange={setStatus} required options={["Recruiting", "Active", "Full", "Inactive"].map((item) => ({ value: item, label: item }))} />
        </label>
        <label>
          Description
          <textarea name="description" rows="4" defaultValue={selectedClub?.description ?? ""} minLength="20" maxLength="500" required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" type="submit" disabled={busy || !sport}>{busy ? "Saving..." : isEditing ? "Save changes" : "Create club"} <span aria-hidden="true">→</span></button>
        <p className="form-note">Coaches are managed through coach assignments. Training sessions appear in the training schedule.</p>
      </form>
    </section>
  );
}
