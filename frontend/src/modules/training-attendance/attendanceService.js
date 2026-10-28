const STORAGE_KEY = "nsbm-training-attendance";

export const attendanceService = {
  list(sessionId) {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const records = saved === null ? [] : JSON.parse(saved);
    if (!Array.isArray(records)) throw new Error("Saved attendance data is invalid.");
    return records.filter((record) => record.sessionId === sessionId);
  },

  save(attendance) {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const records = saved === null ? [] : JSON.parse(saved);
    if (!Array.isArray(records)) throw new Error("Saved attendance data is invalid.");
    const record = { ...attendance, id: `${Date.now()}` };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...records, record]));
    return record;
  },
};
