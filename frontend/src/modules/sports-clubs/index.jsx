import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import NotFoundPage from "../../shared/NotFoundPage.jsx";
import ClubDetails from "./ClubDetails.jsx";
import ClubForm from "./ClubForm.jsx";
import ClubList from "./ClubList.jsx";
import { clubsService } from "./clubsService.js";
import "./sports-clubs.css";

export default function SportsClubs() {
  const [clubList, setClubList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadClubs(signal) {
    setLoading(true);
    setError("");
    try {
      const rows = await clubsService.list({ signal });
      if (!signal?.aborted) setClubList(rows);
    } catch (loadError) {
      if (signal?.aborted) return;
      setClubList([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load saved clubs.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadClubs(controller.signal);
    return () => controller.abort();
  }, []);

  async function saveClub(club) {
    const result = await clubsService.save(clubList, club);
    setClubList(result.clubs);
    return result.id;
  }

  async function deleteClub(id) {
    const updated = await clubsService.delete(clubList, id);
    setClubList(updated);
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
          <a href="/announcements">Announcements</a>
        </nav>
      </header>

      <main className="sports-main">
        <Routes>
          <Route index element={<ClubList clubs={clubList} loading={loading} error={error} onRetry={() => loadClubs()} />} />
          <Route path="new" element={<ClubForm clubs={clubList} loading={loading} onSave={saveClub} />} />
          <Route path=":clubId/edit" element={<ClubForm clubs={clubList} loading={loading} onSave={saveClub} />} />
          <Route path=":clubId" element={<ClubDetails clubs={clubList} loading={loading} onDelete={deleteClub} />} />
          <Route path="*" element={<NotFoundPage embedded />} />
        </Routes>
      </main>
      <footer className="sports-footer">NSBM Sports Hub <span>Every moment builds future champions.</span></footer>
    </div>
  );
}
