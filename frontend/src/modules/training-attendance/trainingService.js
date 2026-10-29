import { sampleSessions } from "./trainingData.js";

const STORAGE_KEY = "nsbm-training-sessions";

export const trainingService = {
  list() {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return sampleSessions;
    const sessions = JSON.parse(saved);
    if (!Array.isArray(sessions)) throw new Error("Saved training data is invalid.");
    return sessions;
  },

  save(currentSessions, session) {
    const id = session.id || `${Date.now()}`;
    const updated = session.id
      ? currentSessions.map((item) => item.id === session.id ? { ...session, id } : item)
      : [...currentSessions, { ...session, id }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { sessions: updated, id };
  },
};
