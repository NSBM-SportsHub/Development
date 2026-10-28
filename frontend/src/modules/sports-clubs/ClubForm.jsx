import { Link, useParams } from "react-router-dom";
import { clubs } from "./clubs.js";

export default function ClubForm() {
  const { clubId } = useParams();
  const selectedClub = clubs.find((club) => club.id === clubId);
  const isEditing = Boolean(clubId);

  function handleSubmit(event) {
    event.preventDefault();
    window.alert(isEditing ? "Club details saved for this preview." : "Your club interest has been recorded for this preview.");
  }

  return (
    <section className="club-form-page">
      <div className="form-aside">
        <Link className="back-link" to={selectedClub ? `/sports-clubs/${selectedClub.id}` : "/sports-clubs"}>← Back to clubs</Link>
        <p className="eyebrow">{isEditing ? "Club management" : "Find your team"}</p>
        <h1>{isEditing ? "Update club" : "Join the community."}</h1>
        <p>{isEditing ? "Keep your club information up to date." : "Tell us a little about yourself and the club you would like to join."}</p>
        <span className="form-decoration" aria-hidden="true">NSBM<br />SPORTS HUB</span>
      </div>

      <form className="club-form" onSubmit={handleSubmit}>
        <div className="form-title">
          <p className="eyebrow">{isEditing ? "Club details" : "Club interest"}</p>
          <h2>{isEditing ? "Edit club information" : "Let's get started"}</h2>
        </div>

        {isEditing && (
          <label>
            Club name
            <input defaultValue={selectedClub?.name ?? ""} required />
          </label>
        )}
        {!isEditing && (
          <label>
            Select a club
            <select defaultValue="" required>
              <option value="" disabled>Choose your club</option>
              {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
          </label>
        )}
        <label>
          Full name
          <input name="name" autoComplete="name" placeholder="Enter your full name" required />
        </label>
        <label>
          Student email
          <input name="email" type="email" autoComplete="email" placeholder="name@student.nsbm.ac.lk" required />
        </label>
        <label>
          Why would you like to join?
          <textarea name="message" rows="4" placeholder="Tell us a little about your interest" />
        </label>
        <button className="primary-button form-submit" type="submit">{isEditing ? "Save changes" : "Send interest"} <span aria-hidden="true">→</span></button>
        <p className="form-note">Preview only — your information is not sent to a server.</p>
      </form>
    </section>
  );
}
