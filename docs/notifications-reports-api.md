# Notifications and participation reports

Implemented by Mukilan on `feat/mukilan-notifications-reports`, covering the notifications/reports scope originally allocated to Nimesha. This implementation does not establish another member's individual coding contribution.

These modules use the shared PHP session, PDO connection, JSON response envelope and CSRF client. Run `php backend/bin/setup.php` to apply `009_notifications.sql`; existing records are preserved. Reports query source tables directly and need no report-record CRUD or copied participation data.

## Notifications

| Method and path | Behavior |
| --- | --- |
| `GET /api/notifications` | Current user's notifications, newest first |
| `PATCH /api/notifications/{id}` | Mark the current user's notification read with `{"read":true}` and CSRF |

GET accepts `state=read|unread`, `page` (default 1), and `per_page` (default 20, maximum 100). Omit `state` for all. It returns `notifications`, `unread_count` across the entire inbox, and `pagination` (`page`, `per_page`, `total`, `total_pages`). Each notification contains numeric `id`, `type`, `title`, `message`, `link`, UTC `created_at` and nullable UTC `read_at`.

Read writes are idempotent: repeating them preserves the first read timestamp. Access to another recipient's record returns 404, including for Admins. Unknown parameters/fields and attempts to supply recipients or create notifications through the API are rejected. There is no external email/SMS delivery.

### Event and recipient contract

| Source event | Recipients | Destination |
| --- | --- | --- |
| Membership approved/rejected or approved membership ended | Membership owner | `/memberships/mine` |
| Booking approved/rejected/cancelled, including DELETE cancellation | Requester | `/bookings/mine` |
| Tournament entry approved/rejected/withdrawn | Every member of that entry | `/tournaments/{id}` |
| Announcement created | All currently active, unarchived accounts | `/announcements` |

Club-tagged announcements currently have the same signed-in read audience as general announcements. Their notification audience follows that existing behavior; club-only delivery would require a coordinated change to announcement access. Updates, pinning and deletion do not resend announcements. Notifications retain their event snapshot; the destination list reflects current source state, so an announcement may subsequently have been removed.

Source writes and notification inserts share a transaction: delivery failure rolls back the action. A unique event/recipient key prevents duplicate delivery of the same transition. Failed validation, denied operations and repeated invalid decisions create no notifications. Existing source records are not backfilled, and accounts registered after an announcement receive no historical notification.

## Participation and performance

| Method and path | Access |
| --- | --- |
| `GET /api/participation/me` | Signed-in user, strictly their own records, including when they coach a club |
| `GET /api/reports/participation` | Admin only, all users or filtered user |

Both accept `type=training|tournament|match`, `status`, `sport_id`, inclusive calendar dates `from` and `to` as `YYYY-MM-DD`, `page` and `per_page` (same bounds as notifications). Admin reports additionally accept numeric `user_id`. Personal reports reject a supplied `user_id`. Invalid dates, reversed ranges, array values, unknown fields and invalid enums return 422. A valid filter with no matching records returns empty records and zero totals.

The response contains `records`, `summary`, normalized `filters`, and `pagination`. Each record has `type`, numeric `source_id`, `user_id`, `user_name`, numeric `sport_id`, `sport_name`, `activity`, `context`, `activity_date`, `status` and `activity_status`.

### Definitions

| Type | One row represents | Status | Activity date |
| --- | --- | --- | --- |
| Training | One recorded attendance row, including absent/excused records | present, late, absent, excused | Session date |
| Tournament | One retained entry-member row; registration is not proof of attendance | pending, approved, rejected, withdrawn | Tournament start date |
| Match | One roster member of either side of a completed match | win, draw, loss | UTC scheduled date; UTC result-recorded date if unscheduled |

`activity_status` is the source session, tournament or match status. Cancelled activities remain visible for history. Club archival, ended memberships and inactive/archived users do not erase historical records. Match outcomes apply to the team's recorded roster; the source system has no individual match attendance. Correcting results immediately changes reports without appending duplicate history. These definitions are implementation decisions for team review, not university participation policy.

All summary values use the applied filters across **all pages**:

- `total_records`: all matching rows; this combines different record types and is not a count of attended events.
- `participants`: distinct users represented by those rows.
- `training_attended`: present/late attendance in sessions that are not cancelled.
- `approved_entries`: approved entry-member rows in tournaments that are not cancelled.
- `matches_played`: completed match roster appearances; the same match counts once per roster member in Admin totals.
- `wins`, `draws`, `losses`: outcomes of those completed match roster appearances.

Type/status filters can reduce other summary metrics to zero. Rejected/withdrawn entries and absent/excused attendance are history, not counted attendance. Memberships and bookings are not sporting participation. No CSV/PDF export is implemented; a required export format remains a scope decision.

## Screens and verification

- `/notifications`: signed-in inbox, unread count, read/unread filters, paging, refresh, persisted mark-as-read.
- `/participation`: personal history, activity/status/sport/date filters, totals and paging.
- `/admin/reports`: Admin report with the same filters plus an optional numeric account ID. Account IDs appear on report rows.

Run `node backend/tests/integration.mjs` with PHP/MySQL configured as described in [local development](local-development.md). `notifications-reports.mjs` covers real source-trigger delivery, ownership (including Admin/coach boundaries), CSRF, repeat decisions/read writes, pagination, retained cancelled attendance, team recipients, date boundaries, source totals, result corrections and invalid filters. It uses the runner's temporary database, not application records.

Browser regression checklist:

- Student can navigate to inbox/history; Admin additionally sees reports; direct Student access to Admin reports redirects.
- Mark a notification read, reload, and verify its persisted state and unread count. Verify empty read/unread filters.
- Apply and reset report filters; confirm totals apply to the selected filters across pages and reversed dates show validation.
- Check loading, empty and API failure states, refresh/retry, keyboard labels and mobile layout.
- Verify attendance recorded through the connected training interface appears in personal history and Admin reports. Old browser demo records are not automatically imported. See [current integration evidence](final-integration-review.md).

### Recorded verification — 5 November 2026

- PHP syntax checks passed for the new modules and edited PHP files.
- Configuration checks: 31 passed. Frontend unit tests: 7 passed. Production frontend build passed.
- Real HTTP/PHP/MariaDB integration: 70 scenarios passed, including 10 notification/report scenarios. Tests used temporary databases and removed them afterwards.
- Edge/Playwright against real PHP/MySQL and React: verified Student/Admin routes, inbox pagination, read state after reload, report totals/filter/reset, mobile overflow, Admin route protection and service failure/retry. The growing desktop sidebar now scrolls while keeping sign-out accessible.
- Local application setup applied migration 009 successfully while preserving existing records. No test accounts were added to the application database.

Screenshots and workstation browser harness are in ignored `.artifacts/` and `.tools/`; the backend integration scenarios are committed source under `backend/tests/`.
