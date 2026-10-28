import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ClubDetails from "./ClubDetails.jsx";
import ClubForm from "./ClubForm.jsx";
import ClubList from "./ClubList.jsx";
import { clubs } from "./clubs.js";
import "./sports-clubs.css";

const STORAGE_KEY = "nsbm-sports-clubs";

function isClubList(value) {
  return Array.isArray(value) && value.every((club) =>
    club && typeof club.id === "string" && typeof club.name === "string" &&
    typeof club.sport === "string" && typeof club.status === "string"
  );
}

export default function SportsClubs() {
  const [clubList, setClubList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadClubs() {
    setLoading(true);
    setError("");
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === null) {
        setClubList(clubs);
      } else {
        const parsed = JSON.parse(saved);
        if (!isClubList(parsed)) throw new Error("Saved club data is invalid.");
        setClubList(parsed);
      }
    } catch (loadError) {
      setClubList(clubs);
      setError(loadError instanceof Error ? loadError.message : "Unable to load saved clubs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClubs();
  }, []);

  function saveClub(club) {
    let id = club.id;
    if (!id) {
      const base = club.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      id = `${base}-${Date.now()}`;
    }
    const updated = club.id
      ? clubList.map((item) => item.id === club.id ? club : item)
      : [...clubList, { ...club, id }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setClubList(updated);
    return id;
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
          <a href="/sports-clubs">Schedule</a>
          <a className="active" href="/sports-clubs">Clubs</a>
          <a href="/sports-clubs">Achievements</a>
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
