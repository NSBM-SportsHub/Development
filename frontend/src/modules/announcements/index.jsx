import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../../shared/AuthContext.jsx";
import { api } from "../../shared/api.js";
import { Loading } from "../../shared/ui.jsx";
import AnnouncementForm from "./AnnouncementForm.jsx";
import AnnouncementList from "./AnnouncementList.jsx";
import NotFoundPage from "../../shared/NotFoundPage.jsx";
import "../sports-clubs/sports-clubs.css";
import "./announcements.css";

function sortAnnouncements(items) {
  return [...items].sort((first, second) =>
    Number(second.is_pinned) - Number(first.is_pinned) ||
    second.announcement_id.localeCompare(first.announcement_id)
  );
}

export default function Announcements() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/announcements").then((result) => {
      if (active) setAnnouncements(result.announcements);
    }).catch((failure) => {
      if (active) setError(failure.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function saveAnnouncement(values) {
    setError("");
    let result = values.id
      ? await api.patch(`/announcements/${values.id}`, values.fields)
      : await api.post("/announcements", values.fields);
    setAnnouncements((items) => sortAnnouncements([
      result,
      ...items.filter((item) => item.announcement_id !== result.announcement_id),
    ]));
    if (values.image || values.removeImage) {
      try {
        if (values.image) {
          const body = new FormData(); body.append('image', values.image);
          result = await api.post(`/announcements/${result.announcement_id}/image`, body);
        } else {
          result = await api.delete(`/announcements/${result.announcement_id}/image`);
        }
        setAnnouncements((items) => sortAnnouncements(items.map((item) => item.announcement_id === result.announcement_id ? result : item)));
      } catch (failure) {
        failure.announcementId = result.announcement_id;
        failure.message = `Announcement saved, but the image could not be updated. ${failure.message} You can retry saving without creating another announcement.`;
        throw failure;
      }
    }
    return result.announcement_id;
  }

  async function setPinned(id, isPinned) {
    setError("");
    try {
      const saved = await api.patch(`/announcements/${id}`, { is_pinned: isPinned });
      setAnnouncements((items) => sortAnnouncements(items.map((item) => item.announcement_id === id ? saved : item)));
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function deleteAnnouncement(id) {
    setError("");
    try {
      await api.delete(`/announcements/${id}`);
      setAnnouncements((items) => items.filter((item) => item.announcement_id !== id));
    } catch (failure) {
      setError(failure.message);
      throw failure;
    }
  }

  return (
    <div className="sports-hub announcements-hub">
      <header className="sports-header">
        <a className="sports-brand" href="/announcements" aria-label="NSBM Sports Hub home">
          <span className="sports-brand-mark">N</span>
          <span><strong>NSBM</strong><small>SPORTS HUB</small></span>
        </a>
        <nav className="sports-nav" aria-label="Main navigation">
          <a href="/sports-clubs">Home</a>
          <a href="/training-attendance">Schedule</a>
          <a href="/sports-clubs">Clubs</a>
          <a className="active" href="/announcements">Announcements</a>
        </nav>
      </header>
      <main className="sports-main">
        <Routes>
          <Route index element={
            <AnnouncementList
              announcements={announcements}
              isAdmin={isAdmin}
              loading={loading}
              error={error}
              onPin={setPinned}
              onDelete={deleteAnnouncement}
            />
          } />
          <Route path="new" element={authLoading
            ? <Loading />
            : isAdmin ? <AnnouncementForm onSave={saveAnnouncement} />
              : <Navigate to="/announcements" replace />} />
          <Route path=":announcementId/edit" element={authLoading
            ? <Loading />
            : isAdmin ? <AnnouncementForm announcements={announcements} loading={loading} error={error} onSave={saveAnnouncement} />
              : <Navigate to="/announcements" replace />} />
          <Route path=":announcementId" element={
            <AnnouncementList
              announcements={announcements}
              isAdmin={isAdmin}
              loading={loading}
              error={error}
              onPin={setPinned}
              onDelete={deleteAnnouncement}
            />
          } />
          <Route path="*" element={<NotFoundPage embedded />} />
        </Routes>
      </main>
      <footer className="sports-footer">NSBM Sports Hub <span>Every moment builds future champions.</span></footer>
    </div>
  );
}
