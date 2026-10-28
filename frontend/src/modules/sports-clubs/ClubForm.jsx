import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import GlassSelect from "../../shared/GlassSelect.jsx";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=900&q=85";

export default function ClubForm({ clubs, loading, onSave }) {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const selectedClub = clubs.find((club) => club.id === clubId);
  const isEditing = Boolean(clubId);
  const [error, setError] = useState("");
  const [sport, setSport] = useState(selectedClub?.sport ?? "");
  const [status, setStatus] = useState(selectedClub?.status ?? "Recruiting");

  useEffect(() => {
    if (selectedClub) {
      setSport(selectedClub.sport);
      setStatus(selectedClub.status);
    }
  }, [selectedClub]);

  if (loading) {
    return <div className="club-state" role="status">Loading club information…</div>;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const name = values.get("name").trim();
    const description = values.get("description").trim();
    if (name.length < 3 || description.length < 20) {
      setError("Enter a club name of at least 3 characters and a description of at least 20 characters.");
      return;
    }

    try {
      const id = onSave({
        id: selectedClub?.id,
        name,
        sport: values.get("sport"),
        status: values.get("status"),
        description,
        coach: values.get("coach").trim(),
        schedule: values.get("schedule").trim(),
        image: values.get("image").trim() || selectedClub?.image || DEFAULT_IMAGE,
        members: selectedClub?.members ?? 0,
      });
      navigate(`/sports-clubs/${id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the club.");
    }
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
          <GlassSelect label="Sport" name="sport" value={sport} onChange={setSport} allowCustom required placeholder="Choose or enter a sport" options={[...new Set(clubs.map((club) => club.sport))].map((item) => ({ value: item, label: item }))} />
        </label>
        <label>
          Status
          <GlassSelect label="Status" name="status" value={status} onChange={setStatus} required options={["Recruiting", "Active", "Full"].map((item) => ({ value: item, label: item }))} />
        </label>
        <label>
          Description
          <textarea name="description" rows="4" defaultValue={selectedClub?.description ?? ""} minLength="20" maxLength="500" required />
        </label>
        <label>
          Coach
          <input name="coach" defaultValue={selectedClub?.coach ?? ""} maxLength="80" required />
        </label>
        <label>
          Training schedule
          <input name="schedule" defaultValue={selectedClub?.schedule ?? ""} maxLength="100" required />
        </label>
        <label>
          Image URL <span className="optional-label">(optional)</span>
          <input name="image" type="url" defaultValue={selectedClub?.image ?? ""} placeholder="https://example.com/club-photo.jpg" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" type="submit">{isEditing ? "Save changes" : "Create club"} <span aria-hidden="true">→</span></button>
        <p className="form-note">Demo only — saved in this browser, not the database.</p>
      </form>
    </section>
  );
}
