import { Navigate, Route, Routes } from "react-router-dom";
import ClubDetails from "./ClubDetails.jsx";
import ClubForm from "./ClubForm.jsx";
import ClubList from "./ClubList.jsx";
import { clubs } from "./clubs.js";
import "./sports-clubs.css";

export default function SportsClubs() {
  return (
    <div className="sports-hub">
      <header className="sports-header">
        <a className="sports-brand" href="/sports-clubs" aria-label="NSBM Sports Hub home">
          <span className="sports-brand-mark">N</span>
          <span>
            <strong>NSBM</strong>
            <small>SPORTS HUB</small>
          </span>
        </a>
        <nav className="sports-nav" aria-label="Main navigation">
          <a href="/sports-clubs">Home</a>
          <a href="/sports-clubs">Schedule</a>
          <a className="active" href="/sports-clubs">Clubs</a>
          <a href="/sports-clubs">Achievements</a>
          <a className="sports-signup" href="/sports-clubs/new">Sign Up</a>
        </nav>
      </header>

      <main className="sports-main">
        <Routes>
          <Route index element={<ClubList clubs={clubs} />} />
          <Route path="new" element={<ClubForm />} />
          <Route path=":clubId/edit" element={<ClubForm clubs={clubs} />} />
          <Route path=":clubId" element={<ClubDetails clubs={clubs} />} />
          <Route path="*" element={<Navigate to="/sports-clubs" replace />} />
        </Routes>
      </main>
      <footer className="sports-footer">NSBM Sports Hub <span>Every moment builds future champions.</span></footer>
    </div>
  );
}
