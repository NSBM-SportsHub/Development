import { clubs as sampleClubs } from "./clubs.js";

const STORAGE_KEY = "nsbm-sports-clubs";

function isClubList(value) {
  return Array.isArray(value) && value.every((club) =>
    club && typeof club.id === "string" && typeof club.name === "string" &&
    typeof club.sport === "string" && typeof club.status === "string"
  );
}

export const clubsService = {
  list() {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return sampleClubs;
    const parsed = JSON.parse(saved);
    if (!isClubList(parsed)) throw new Error("Saved club data is invalid.");
    return parsed;
  },

  save(currentClubs, club) {
    let id = club.id;
    if (!id) {
      const base = club.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      id = `${base}-${Date.now()}`;
    } else if (!currentClubs.some((item) => item.id === id)) {
      throw new Error("This club no longer exists. Reload the clubs and try again.");
    }

    const updated = club.id
      ? currentClubs.map((item) => item.id === club.id ? club : item)
      : [...currentClubs, { ...club, id }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { clubs: updated, id };
  },

  delete(currentClubs, id) {
    if (!currentClubs.some((club) => club.id === id)) {
      throw new Error("This club no longer exists. Reload the clubs and try again.");
    }

    const updated = currentClubs.filter((club) => club.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },
};
