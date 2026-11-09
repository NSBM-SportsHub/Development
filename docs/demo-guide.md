# SportsHub demonstration guide

Prepared 9 November 2026. Deployment is deferred at the user's request. This guide demonstrates the local production build and PHP/MySQL workflows; it does not claim lecturer acceptance or submission.

## Prepare

Follow [local development](local-development.md). Apply migrations and reference sports, provision the first Admin through `backend/bin/create-admin.php`, build the frontend and start PHP plus the frontend. Keep three separate browser profiles or private sessions for an Admin, a Student and a second Student account that will receive a coach assignment. Choose your own account credentials privately; there are no default passwords. Use synthetic names, records and future dates, and remove personal information from screenshots.

The automated rehearsal is `tests/browser-workflows.mjs`. It creates random accounts in a temporary database, exercises all core role workflows and deletes those records on exit. Its temporary accounts are not reusable demo credentials. Run it using the [QA guide](qa-checklist.md); current screenshot/report evidence is generated in ignored `.artifacts/`.

## Ten-minute sequence

| Step | Role and route | Demonstrate and explain |
| --- | --- | --- |
| 1 | Student: `/register`, `/profile` | Registration, sign-in and profile persistence after refresh; passwords are hashed and the session is held by PHP |
| 2 | Admin: `/sports-clubs`, `/admin/coaches` | Create a club using a real sport; assign the second Student account as coach; account role stays Student and permissions come from the club assignment |
| 3 | Student: `/memberships/apply`, `/memberships/mine` | Apply to that club and show Pending; assigned coach approves at `/memberships/review`; refresh the Student's status to show Approved |
| 4 | Coach: `/training-attendance` | Create a training session, select the approved participant and record attendance; reload to prove database persistence |
| 5 | Student: `/participation`; Admin: `/admin/reports` | Show the same attendance source reflected in personal history and authorized report totals; filters retain role scope |
| 6 | Admin: `/facilities`, `/equipment`; Student: `/bookings/new` | Create a resource, request a future slot, edit the pending request and show it at `/bookings/mine` |
| 7 | Admin: `/admin/bookings`; Student: `/notifications` | Approve the booking, show the persisted Student notification and read state; approved bookings cannot be edited by the requester |
| 8 | Admin/Student/coach: `/tournaments` | Create an individual tournament, open registration, register two eligible entrants, approve entries, close registration, generate fixtures, start the tournament and enter a result; reload fixtures/standings |
| 9 | Admin: `/announcements`; Student: `/announcements`, `/notifications` | Publish an announcement and show its persistent display and inbox notification |
| 10 | Admin: `/admin/coaches`; coach: `/memberships/review` | End the assignment and show that scoped access disappears; sign out and reopen a protected route to show sign-in protection |

During competition setup, both entrants must meet the membership eligibility rules for the selected sport. Use the contract in [competitions](competitions-api.md) rather than bypassing eligibility through database changes. Keep one resource/time slot for the successful booking demonstration and a second overlapping request to demonstrate a 409 conflict if time permits.

## Questions to be ready for

- Show the [ERD](database-erd.md), canonical foreign keys and ordered migrations 001-009.
- Explain server-side authentication, CSRF checks, Admin/ownership/coach permissions and historical archival. Hiding a button alone does not grant or enforce authorization.
- Explain how resource locks and transactions prevent simultaneous double booking; how training-session locks prevent attendance from moving to another club; and where those cases are tested.
- Show the shared API client, PHP request router, a module handler and its database query. Explain the JSON `data`/`error` envelope and UTC timestamps.
- Explain the backup/restore rehearsal and the difference between local acceptance and later hosted acceptance.
- Each member must explain their own actual contribution, including code, R&D, database design, UI/UX or QA. Use Git history, the supplied artifacts and the [owner coverage record](development-status.md) to record accurate credits.

The supplied official guideline requires a PDF/Word report and one screen-recorded video with each member's brief contribution explanation. It sets no video duration and leaves the deadline unconfirmed. Use the [video plan](video-demonstration.md), add the actual live/video links and finalize team details before submission through the designated team account.
