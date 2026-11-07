# Clubs, training and attendance API integration

All endpoints use the common `/api` router, authenticated PHP session and `{data,error}` response envelope. Writes require `X-CSRF-Token`. Source controllers retain their existing validation responses (400/422); denied roles return 403 and invisible/missing records return 404.

## Clubs and sports

| Endpoint | Access and behavior |
| --- | --- |
| `GET /sports`, `GET /sports/{id}` | Signed-in reference sport reads |
| `GET /clubs`, `GET /clubs/{id}` | Signed-in, non-archived club reads |
| `POST /clubs` | Admin creation: `name`, numeric `sport_id`, optional `description`, `status` |
| `PATCH/PUT /clubs/{id}` | Admin updates to the same club fields |
| `PATCH /clubs/{id}/archive` | Admin archival; retains memberships, schedules and participation history |

Club statuses are `active`, `recruiting`, `full`, `inactive`. Only active/recruiting clubs accept membership applications. The list also supplies `member_count`, derived from approved memberships. Client display names come from canonical sports and active coach assignments. The form does not submit preview-only coach strings, images or fictional member totals. Existing image/schedule columns remain readable when present.

## Training

| Endpoint | Access and behavior |
| --- | --- |
| `GET /training-sessions` | Signed-in schedule reads; filters: `search`, `status`, `date`, `club_id` |
| `GET /training-sessions/{id}` | Signed-in session read |
| `POST /training-sessions` | Admin or assigned coach of the selected club creates a session |
| `PATCH/PUT /training-sessions/{id}` | Admin or assigned coach edits a session |
| `PATCH /training-sessions/{id}/cancel` | Admin or assigned coach cancels a session, preserving attendance |

Fields are `title`, numeric `club_id`, `session_date` (`YYYY-MM-DD`), `start_time`/`end_time` (`HH:MM`), optional `notes` and `status` (`scheduled`, `completed`, `cancelled`). End time must follow start time. Clubs must be non-archived. Moving a session requires permission in both the original and new club and is rejected with 409 once attendance exists, preserving historical club ownership. Session edits/cancellations and attendance creation lock the same session row in a transaction so concurrent requests cannot bypass that restriction. Calendar date/time fields preserve the source API's existing scheduling semantics; they do not reserve a facility. Facility booking, capacity and coach-text inputs from the old preview are not silently stored as real session fields.

## Attendance

| Endpoint | Access and behavior |
| --- | --- |
| `GET /attendance` | Admin sees all; assigned coach sees club rosters; students see own records. Filters: `session_id`, `participant_id`, `status` |
| `GET /attendance/{id}` | Same ownership/club scope; out-of-scope IDs return 404 |
| `POST /attendance` | Admin or assigned session-club coach records attendance |

POST fields: numeric `session_id`, numeric `participant_id`, `status` (`present`, `late`, `absent`, `excused`), optional `notes`. The participant must be an active user with an approved membership in the session's club. Cancelled sessions reject writes. A unique session/participant constraint prevents duplicate attendance. List rows also include `participant_name` and `student_id` from the referenced account, including retained historical records.

The browser participant selector loads all pages of approved club memberships and omits participants already recorded in that session. Free-text names/student IDs are not used as database identity. New attendance appears in `/participation` and Admin reports immediately after a separate read. No attendance correction/deletion policy has been invented; the existing source API records attendance once.

## Coach permissions

`GET /club-coaches` accepts `club_id`/`user_id` and returns active assignments. Admins use `POST /club-coaches` with numeric `club_id` and `user_id` to assign an active account; `DELETE /club-coaches/{id}` ends the assignment and preserves history. Duplicate live assignments return 409. The account role stays Student/Admin.

The Admin interface is `/admin/coaches`. Assigned coaches use `/memberships/review` to select and review only their assigned clubs. PHP authorizes every read/write independently of browser controls, and ending an assignment removes the relevant coach permissions on subsequent requests. Coaches can also review sport-scoped tournament entries under the existing competition contract.
