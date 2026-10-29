# Tournaments, matches and results API

Backend: Jassim. Competition UI: Shahadh. Every endpoint needs a signed-in session, and every write needs the `X-CSRF-Token` header. Responses follow [backend conventions](backend-conventions.md). The lifecycle tables are in [database-erd.md](database-erd.md#workflow-states).

## Who can do what

| Action | Student | Coach (of a club in the tournament's sport) | Admin |
| --- | --- | --- | --- |
| View tournaments (not drafts), approved entries, fixtures, standings | ✓ | ✓ | ✓ including drafts |
| Create, edit, cancel tournaments; change status | | | ✓ |
| Register an entry as captain; withdraw own entry | ✓ | ✓ | ✓ |
| Approve or reject entries | | ✓ (not entries they belong to) | ✓ (not entries they belong to) |
| Create fixtures, schedule matches, record or correct results | | | ✓ |

## Entries and eligibility

An entry is a team, or an individual when the team size is 1. Its captain is the user who registers it and must be one of `member_ids`. If `member_ids` is omitted, the captain enters alone.

Each request checks the following:
- The tournament is `registration_open` and before `registration_closes_at` (otherwise 409 `registration_closed`).
- The approved entries are below `max_entries` (otherwise 409 `tournament_full`).
- The number of members is between `min_team_size` and `max_team_size` (422).
- Every member is an active user with an **approved membership in a non-archived club of the tournament's sport** (422 on `member_ids`). This is re-checked on approval (409 `member_ineligible`).
- No member is in another pending or approved entry of the same tournament (409 `already_entered`).
- The entry name is unique among the tournament's live entries (409 `duplicate_entry`).

`GET /tournaments/{id}/eligible-members` lists the users a captain can pick.

## Formats

- **`league`**: `POST /fixtures` creates a single round-robin, once. An odd field gets one bye per round.
  - Standings are calculated from completed matches: `points_win`/`points_draw`/`points_loss` per result, ranked by points, then score difference, then score for, then name.
  - A level score is a draw with no winner.
- **`knockout`**: each `POST /fixtures` draws the next round from the entries that haven't lost.
  - The first round adds byes so the field becomes a power of two.
  - Each match needs a winner. For a level score, send `winner_entry_id` (decided by tie-break).
  - The next round can only be drawn once the current one has no scheduled or postponed matches (409 `round_incomplete`).
  - A winner can't be changed after the next round is drawn (409 `result_locked`).
  - Standings return the rounds, the remaining entries and the champion.

Fixtures (generated or manual) can be arranged in `registration_closed` and `in_progress`. Results can only be recorded `in_progress`. Admins can correct a result until the tournament is `completed`, after which everything is read-only.

## Endpoints

| Method and path | Body or query | Result |
| --- | --- | --- |
| `GET /api/tournaments` | Query: `status`, `format`, `sport_id` | Tournament list |
| `POST /api/tournaments` | Required: `sport_id`, `name` (≤ 150), `format`, `starts_on`, `ends_on`. Optional: `description`, `registration_closes_at` (ISO-8601), `max_entries` (≥ 2), `min_team_size`/`max_team_size` (default 1), `points_win`/`points_draw`/`points_loss` (default 3/1/0) | 201, tournament (`draft`) |
| `GET /api/tournaments/{id}` | | Tournament with `sport_name`, `approved_entries` |
| `PATCH /api/tournaments/{id}` | Any create field plus `status`. `sport_id`, `format` and team sizes can only change while `draft`. | Tournament |
| `DELETE /api/tournaments/{id}` | | 204, sets `cancelled` |
| `GET /api/tournaments/{id}/entries` | | Entries with `members`. Non-reviewers see approved entries and their own. |
| `POST /api/tournaments/{id}/entries` | `name` (≤ 120), `member_ids` (list of user ids) | 201, entry (`pending`) |
| `GET /api/tournaments/{id}/eligible-members` | | `[{user_id, name, clubs}]` |
| `GET /api/tournament-entries/{id}` | | Entry |
| `PATCH /api/tournament-entries/{id}` | `status`: `approved` or `rejected` (reviewer), `withdrawn` (captain); `review_note` | Entry |
| `GET /api/tournaments/{id}/matches` | Query: `status`, `round_no` | Matches ordered by round and time |
| `POST /api/tournaments/{id}/matches` | Required: `home_entry_id`, `away_entry_id` (approved entries of this tournament). Optional: `round_no` (default 1), `scheduled_at`, `facility_id`, `venue` | 201, match. 409 `entry_already_scheduled` if a side already plays in that round. |
| `POST /api/tournaments/{id}/fixtures` | | 201, the matches created |
| `GET /api/tournaments/{id}/standings` | | League table or knockout bracket |
| `GET /api/matches/{id}` | | Match |
| `PATCH /api/matches/{id}` | `round_no`, `scheduled_at`, `facility_id`, `venue`, `status` (`scheduled`, `postponed` or `cancelled`) | Match. Completed and cancelled matches are read-only. |
| `DELETE /api/matches/{id}` | | 204, sets `cancelled` |
| `PUT /api/matches/{id}/result` | `home_score`, `away_score` (0–999), `winner_entry_id` (knockout tie-break), `result_notes` (≤ 500) | Match (`completed`) |

`facility_id` is optional and only names the venue. It doesn't create a facility booking.

## Response shapes

Tournament: `{id, sport_id, sport_name, name, description, format, status, starts_on, ends_on, registration_closes_at, max_entries, min_team_size, max_team_size, points_win, points_draw, points_loss, approved_entries, created_by, created_at, updated_at}`.

Entry: `{id, tournament_id, name, captain_user_id, captain_name, status, review_note, reviewed_by, reviewed_at, members: [{user_id, name}], created_at, updated_at}`.

Match: `{id, tournament_id, round_no, home_entry_id, home_name, away_entry_id, away_name, scheduled_at, facility_id, facility_name, venue, status, home_score, away_score, winner_entry_id, winner_name, result_notes, result_recorded_by, result_recorded_at, created_at, updated_at}`.

League standings:

```json
{"format": "league", "tournament_status": "in_progress", "standings": [
  {"position": 1, "entry_id": 3, "name": "Shuttle Stars", "played": 2, "won": 1, "drawn": 1, "lost": 0,
   "score_for": 3, "score_against": 2, "score_difference": 1, "points": 4}
]}
```

Knockout standings: `{"format": "knockout", "tournament_status", "rounds": [{"round_no": 1, "matches": [...]}], "remaining_entry_ids": [...], "champion": {"entry_id", "name"} | null}`.
