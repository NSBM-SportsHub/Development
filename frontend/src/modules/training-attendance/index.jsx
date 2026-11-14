import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import NotFoundPage from "../../shared/NotFoundPage.jsx";
import "../sports-clubs/sports-clubs.css";
import AttendanceForm from "./AttendanceForm.jsx";
import AttendanceList from "./AttendanceList.jsx";
import TrainingForm from "./TrainingForm.jsx";
import TrainingSchedule from "./TrainingSchedule.jsx";
import { api } from "../../shared/api.js";
import { trainingService } from "./trainingService.js";
import "./training-attendance.css";

export default function TrainingAttendance() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSessions(signal) {
    setLoading(true);
    setError("");
    try {
      const rows = await trainingService.list({ signal });
      if (!signal?.aborted) setSessions(rows);
    } catch (loadError) {
      if (signal?.aborted) return;
      setSessions([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load training sessions.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadSessions(controller.signal);
    return () => controller.abort();
  }, []);

  async function saveSession(session) {
    const result = await trainingService.save(sessions, session);
    setSessions(result.sessions);
    return result.id;
  }

  async function cancelSession(id) {
    await api.patch(`/training-sessions/${id}/cancel`, {});
    setSessions((current) => current.map((item) => item.id === id ? { ...item, status: "cancelled" } : item));
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
          <a href="/announcements">Announcements</a>
        </nav>
      </header>
      <main className="sports-main">
        {error && <div className="club-state club-error" role="alert">{error} <button type="button" onClick={() => loadSessions()}>Try again</button></div>}
        <Routes>
          <Route index element={<TrainingSchedule sessions={sessions} loading={loading} onCancel={cancelSession} />} />
          <Route path="new" element={<TrainingForm sessions={sessions} loading={loading} onSave={saveSession} />} />
          <Route path=":sessionId/attendance/record" element={<AttendanceForm sessions={sessions} loading={loading} />} />
          <Route path=":sessionId/attendance" element={<AttendanceList sessions={sessions} loading={loading} />} />
          <Route path=":sessionId/edit" element={<TrainingForm sessions={sessions} loading={loading} onSave={saveSession} />} />
          <Route path=":sessionId" element={<TrainingSchedule sessions={sessions} loading={loading} onCancel={cancelSession} />} />
          <Route path="*" element={<NotFoundPage embedded />} />
        </Routes>
      </main>
      <footer className="sports-footer">NSBM Sports Hub <span>Every moment builds future champions.</span></footer>
    </div>
  );
}
