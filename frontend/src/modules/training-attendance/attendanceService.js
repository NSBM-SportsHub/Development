const STORAGE_KEY = "nsbm-training-attendance";

function isAttendanceList(value) {
  return Array.isArray(value) && value.every((record) =>
    record && typeof record.id === "string" && typeof record.sessionId === "string" &&
    typeof record.participantName === "string" && typeof record.studentId === "string" &&
    ["Present", "Late", "Absent"].includes(record.status)
  );
}

function readAttendance() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  const records = saved === null ? [] : JSON.parse(saved);
  if (!isAttendanceList(records)) throw new Error("Saved attendance data is invalid.");
  return records;
}

export const attendanceService = {
  list(sessionId) {
    return readAttendance().filter((record) => record.sessionId === sessionId);
  },

  save(attendance) {
    const records = readAttendance();
    const record = { ...attendance, id: `${Date.now()}` };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...records, record]));
    return record;
  },
};
