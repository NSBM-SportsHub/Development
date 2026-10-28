import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AnnouncementForm from "./AnnouncementForm.jsx";
import AnnouncementList from "./AnnouncementList.jsx";
import { sampleAnnouncements } from "./announcementData.js";
import "../sports-clubs/sports-clubs.css";
import "./announcements.css";

export default function Announcements() {
  const [announcements, setAnnouncements] = useState(sampleAnnouncements);

  function saveAnnouncement(announcement) {
    let id = announcement.id;
    if (!id) id = `announcement-${Date.now()}`;
    setAnnouncements((items) => announcement.id
      ? items.map((item) => item.id === id ? { ...announcement, id } : item)
      : [{ ...announcement, id, publishedAt: announcement.status === "Published" ? new Date().toISOString() : "" }, ...items]);
    return id;
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
          <a className="sports-signup" href="/announcements/new">Create</a>
        </nav>
      </header>
      <main className="sports-main">
        <Routes>
          <Route index element={<AnnouncementList announcements={announcements} />} />
          <Route path="new" element={<AnnouncementForm onSave={saveAnnouncement} />} />
          <Route path=":announcementId/edit" element={<AnnouncementForm announcements={announcements} onSave={saveAnnouncement} />} />
          <Route path=":announcementId" element={<AnnouncementList announcements={announcements} />} />
          <Route path="*" element={<Navigate to="/announcements" replace />} />
        </Routes>
      </main>
      <footer className="sports-footer">NSBM Sports Hub <span>Every moment builds future champions.</span></footer>
    </div>
  );
}
