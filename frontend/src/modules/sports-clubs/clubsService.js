import { api } from "../../shared/api.js";
import { statusLabel } from "../../shared/business.js";

const fallbackImage = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#16654c"/><circle cx="690" cy="130" r="220" fill="#27825d"/><path d="M70 470L330 150 520 470Z" fill="#8db975"/><text x="60" y="550" font-family="sans-serif" font-size="42" fill="white">NSBM SportsHub</text></svg>');

export const clubsService = {
  async list(options = {}) {
    const [clubs, sports, coaches] = await Promise.all([api.get("/clubs", options), api.get("/sports", options), api.get("/club-coaches", options)]);
    return clubs.map((club) => ({ ...club, id: String(club.id), sport: sports.find((sport) => Number(sport.id) === Number(club.sport_id))?.name || "Sport #" + club.sport_id,
      status: statusLabel(club.status), image: club.image_url || fallbackImage, members: Number(club.member_count || 0),
      coach: coaches.filter((coach) => Number(coach.club_id) === Number(club.id)).map((coach) => coach.user_name).join(", ") || "No coach assigned",
      schedule: club.schedule_text || "See the training schedule" }));
  },
  async save(currentClubs, club) {
    if (club.id && !currentClubs.some((item) => item.id === club.id)) throw new Error("This club no longer exists. Reload the clubs and try again.");
    const payload = { name: club.name, description: club.description || null, sport_id: Number(club.sport_id), status: club.status.toLowerCase() };
    const saved = club.id ? await api.patch("/clubs/" + club.id, payload) : await api.post("/clubs", payload);
    // A completed write must not become a failed submission because a follow-up read fails.
    const previous = currentClubs.find((item) => item.id === String(saved.id));
    const record = { ...previous, ...saved, id: String(saved.id), sport: club.sport || previous?.sport || "Sport #" + saved.sport_id,
      status: statusLabel(saved.status || payload.status), image: saved.image_url || previous?.image || fallbackImage,
      members: Number(previous?.members || 0), coach: previous?.coach || "No coach assigned", schedule: saved.schedule_text || "See the training schedule" };
    return { clubs: previous ? currentClubs.map((item) => item.id === record.id ? record : item) : [...currentClubs, record], id: record.id };
  },
  async delete(currentClubs, id) {
    if (!currentClubs.some((club) => club.id === id)) throw new Error("This club no longer exists. Reload the clubs and try again.");
    await api.patch("/clubs/" + id + "/archive", {});
    return currentClubs.filter((club) => club.id !== id);
  },
};
