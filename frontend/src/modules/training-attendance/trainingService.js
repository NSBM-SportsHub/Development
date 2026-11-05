import { api } from "../../shared/api.js";

export const trainingService = {
  async list(options = {}) {
    const [sessions, clubs] = await Promise.all([api.get("/training-sessions", options), api.get("/clubs", options)]);
    return sessions.map((session) => ({ ...session, id: String(session.id), clubId: String(session.club_id),
      club: clubs.find((club) => Number(club.id) === Number(session.club_id))?.name || "Archived club #" + session.club_id,
      date: session.session_date, startTime: session.start_time.slice(0, 5), endTime: session.end_time.slice(0, 5), description: session.notes }));
  },
  async save(currentSessions, session) {
    const payload = { club_id: Number(session.clubId), title: session.title, session_date: session.date, start_time: session.startTime, end_time: session.endTime, notes: session.description, status: session.status };
    const saved = session.id ? await api.patch("/training-sessions/" + session.id, payload) : await api.post("/training-sessions", payload);
    const record = { ...saved, id: String(saved.id), clubId: String(saved.club_id), club: session.club,
      date: saved.session_date, startTime: saved.start_time.slice(0, 5), endTime: saved.end_time.slice(0, 5), description: saved.notes };
    return { sessions: session.id ? currentSessions.map((item) => item.id === record.id ? record : item) : [...currentSessions, record], id: record.id };
  },
};
