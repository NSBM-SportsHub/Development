import { api } from "../../shared/api.js";

export const attendanceService = {
  list(sessionId, options = {}) { return api.get("/attendance?session_id=" + Number(sessionId), options); },
  save(record) { return api.post("/attendance", { session_id: Number(record.sessionId), participant_id: Number(record.participantId), status: record.status.toLowerCase(), notes: record.notes }); },
};
