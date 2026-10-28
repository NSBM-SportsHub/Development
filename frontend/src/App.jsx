import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Announcements from "./modules/announcements";
import SportsClubs from "./modules/sports-clubs";
import TrainingAttendance from "./modules/training-attendance";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/sports-clubs" replace />} />
        <Route path="/sports-clubs/*" element={<SportsClubs />} />
        <Route path="/training-attendance/*" element={<TrainingAttendance />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="*" element={<Navigate to="/sports-clubs" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
