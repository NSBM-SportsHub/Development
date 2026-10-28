import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ClubDetails from "./ClubDetails.jsx";
import ClubForm from "./ClubForm.jsx";
import ClubList from "./ClubList.jsx";
import { clubsService } from "./clubsService.js";
import "./sports-clubs.css";

export default function SportsClubs() {
  const [clubList, setClubList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadClubs() {
    setLoading(true);
    setError("");
    try {
      setClubList(clubsService.list());
    } catch (loadError) {
      setClubList([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load saved clubs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClubs();
  }, []);

  function saveClub(club) {
    const result = clubsService.save(clubList, club);
    setClubList(result.clubs);
    return result.id;
  }

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
          <a href="/training-attendance">Schedule</a>
          <a className="active" href="/sports-clubs">Clubs</a>
          <a href="/sports-clubs">Achievements</a>
          <a href="/announcements">Announcements</a>
          <a className="sports-signup" href="/sports-clubs/new">Sign Up</a>
        </nav>
      </header>

      <main className="sports-main">
        <Routes>
          <Route index element={<ClubList clubs={clubList} loading={loading} error={error} onRetry={loadClubs} />} />
          <Route path="new" element={<ClubForm clubs={clubList} loading={loading} onSave={saveClub} />} />
          <Route path=":clubId/edit" element={<ClubForm clubs={clubList} loading={loading} onSave={saveClub} />} />
          <Route path=":clubId" element={<ClubDetails clubs={clubList} loading={loading} />} />
          <Route path="*" element={<Navigate to="/sports-clubs" replace />} />
        </Routes>
      </main>
      <footer className="sports-footer">NSBM Sports Hub <span>Every moment builds future champions.</span></footer>
    </div>
  );
}
