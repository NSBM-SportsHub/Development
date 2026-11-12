# Admin club management

On the Admin sidebar, choose **Clubs**. Search by club name or sport, then open a club card. The card and detail page show approved membership and current coach assignment counts. Accounts marked inactive remain visible with their account status; ending a membership or coach assignment removes it from the current roster and preserves its history.

The detail page includes:

- **Members:** name, email, student ID, phone, account status, membership approval date, attendance totals and latest recorded session date. Missing optional contact details show “Not provided”.
- **Coaches:** current assignments, contact details, account status, assignment date, number of recorded membership reviews and latest review date.
- **Activity:** membership applications, reviews, withdrawals and endings; coach assignments and endings; latest saved training session states; recorded attendance. “View activity for …” filters to records involving that person as participant or recorded actor. “Show all activity” removes the filter.

Attendance totals cover the person's recorded history in this club, including earlier membership periods, and exclude cancelled sessions. Cancelled sessions and their attendance remain visible in activity with the session status. A coach's review total counts membership records reviewed by that account for this club, including earlier assignments.

Training and attendance tables do not store the account that created/updated those records. They show **Recorded by: Not recorded**; the attendance participant is shown separately. Training activity is its latest saved state, not a complete audit trail of every edit. Tournament entries reference sports and users, without a club reference, so this screen does not guess which club owns a tournament entry. Personal competition history remains in Participation reports.

## API

`GET /api/clubs/{id}/overview` requires an authenticated Admin. Unauthenticated requests return 401; Student and Coach accounts return 403. Missing or archived clubs return 404. Other methods return 405. The existing session, authentication and CSRF rules remain in place.

Optional query parameters:

| Parameter | Meaning |
| --- | --- |
| `members_page` | Members page, starting at 1 |
| `coaches_page` | Coaches page, starting at 1 |
| `activity_page` | Activity page, starting at 1 |
| `per_page` | Records per section, default 20, maximum 100 |
| `activity_user_id` | Filter activity by participant or recorded actor; roster counts stay unchanged |

Invalid or unsupported query parameters return 422. Lists use deterministic ordering and independent pagination. The response contains `club`, `summary`, `members`, `coaches`, and `activity`; each list contains `records` and `pagination`. Reads run in one database transaction so counts and lists use the same snapshot. Password hashes, authentication versions and private account internals are excluded.

`GET /api/clubs` now also returns `coach_count` alongside the existing `member_count`. Other consumers retain their existing fields.

This is a read-only feature using the existing club schema; no club migrations or changes to existing club data are required. This endpoint adds one operation to the original 83; see the API checklist for the current total, including profile photos.

## Verification

`node backend/tests/integration.mjs` includes API success/permission coverage and dedicated club overview scenarios for counts, contact details, pagination, club/person scoping, cancelled-session statistics, retained history, invalid queries and missing clubs. It creates an isolated test database and verifies the working database remains unchanged.

After `npm run build --prefix frontend`, `node tests/browser-workflows.mjs` exercises the Admin navigation, directory, member and coach details, activity filters, reload, mobile layouts, empty states, errors/retry and denied Student/Coach routes against real PHP/MySQL. On this Windows setup, set `SPORTSHUB_BROWSER_CHANNEL=msedge` before running it. The browser suite removes only its generated test database.
