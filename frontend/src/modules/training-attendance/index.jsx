import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "../sports-clubs/sports-clubs.css";
import TrainingForm from "./TrainingForm.jsx";
import TrainingSchedule from "./TrainingSchedule.jsx";
import { trainingService } from "./trainingService.js";
import "./training-attendance.css";

export default function TrainingAttendance() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadSessions() {
    setLoading(true);
    setError("");
    try {
      setSessions(trainingService.list());
    } catch (loadError) {
      setSessions([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load training sessions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  function saveSession(session) {
    const result = trainingService.save(sessions, session);
    setSessions(result.sessions);
    return result.id;
  }

  return (
    <div className="sports-hub training-hub">
      <header className="sports-header">
        <a className="sports-brand" href="/training-attendance" aria-label="NSBM Sports Hub home">
          <span className="sports-brand-mark">N</span>
          <span><strong>NSBM</strong><small>SPORTS HUB</small></span>
        </a>
        <nav className="sports-nav" aria-label="Main navigation">
          <a href="/sports-clubs">Home</a>
          <a className="active" href="/training-attendance">Schedule</a>
          <a href="/sports-clubs">Clubs</a>
          <a href="/sports-clubs">Achievements</a>
          <a className="sports-signup" href="/training-attendance/new">Add Session</a>
        </nav>
      </header>
      <main className="sports-main">
        {error && <div className="club-state club-error" role="alert">{error} <button type="button" onClick={loadSessions}>Try again</button></div>}
        <Routes>
          <Route index element={<TrainingSchedule sessions={sessions} loading={loading} />} />
          <Route path="new" element={<TrainingForm sessions={sessions} loading={loading} onSave={saveSession} />} />
          <Route path=":sessionId/edit" element={<TrainingForm sessions={sessions} loading={loading} onSave={saveSession} />} />
          <Route path=":sessionId" element={<TrainingSchedule sessions={sessions} loading={loading} />} />
          <Route path="*" element={<Navigate to="/training-attendance" replace />} />
        </Routes>
      </main>
      <footer className="sports-footer">NSBM Sports Hub <span>Every moment builds future champions.</span></footer>
    </div>
  );
}
