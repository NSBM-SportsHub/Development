# NSBM SportsHub frontend

Every core module uses the shared PHP/MySQL APIs. See [local setup](../docs/local-development.md), [QA and browser checks](../docs/qa-checklist.md).

## Start locally

Node.js 22.12+ and npm are required. From frontend/:

```powershell
npm.cmd ci
npm.cmd run dev
```

Initialize the database and start PHP following the setup guide, then open http://localhost:5173. Module routes require sign-in; Admin-only actions and assigned-coach controls also enforce server permissions.

Vite forwards browser /api requests to http://127.0.0.1:8000. Stay on the React origin for session cookies and CSRF. Production needs a real same-origin /api route to PHP.

```powershell
npm.cmd run build
npm.cmd test
```

The build writes the ignored dist/ directory. The tests check canonical club API IDs, create/update payloads, archival and failures, plus shared API requests for result writes, CSRF renewal, cancellation, validation and expired sessions. API-client tests mock the HTTP boundary; the separate backend integration runner exercises real PHP/database operations.

## Routes and current data behavior

| Route | Current behavior |
| --- | --- |
| /login | PHP email/password sign-in |
| /register | PHP registration of an active Student |
| /profile | Protected PHP-backed profile editing and password change |
| /notifications | Recipient-owned PHP-backed inbox, read state, filters and pagination |
| /participation | Personal participation history and filtered training/registration/match totals |
| /admin/reports | Admin-only participation/performance reports with user, sport, date, type and status filters |
| /admin/users | Admin-only PHP user directory and create/edit/activate/deactivate/archive |
| /memberships/apply | Authenticated application submission to the PHP membership API |
| /memberships/mine | Personal membership status, withdraw, and leave actions |
| /admin/memberships | Admin review queue and membership records |
| /facilities | PHP-backed facility list; Admins can create, edit, and archive |
| /equipment | PHP-backed equipment list; Admins can create, edit, and archive |
| /bookings/new | Student-only PHP-backed facility/equipment booking request |
| /bookings/mine | Student-only booking status, edit links and pending-request cancellation |
| /bookings/:bookingId/edit | Edit own pending booking times, quantity and notes |
| /admin/bookings | Admin booking list/search/status filters and approve/reject/cancel actions |
| /admin/coaches | Admin coach account search, assignment and termination |
| /memberships/review | Assigned coach membership review for selected coached clubs |
| /tournaments | Signed-in Student/Admin tournament listing; Admins create/edit and manage tournament status |
| /tournaments/:tournamentId | Tournament details, entry registration/withdrawal, and authorized coach/Admin entry review |
| /tournaments/:tournamentId/matches | Fixtures, match scheduling and updates, score/result entry, league standings and knockout bracket |
| /sports-clubs/* | Signed-in club list/search/details; Admin create/edit/archive through PHP |
| /training-attendance/* | Database schedules and attendance; Admin/assigned-coach create/edit/cancel/record controls |
| /announcements/* | Signed-in announcement listing; Admin create/edit/pin/delete through PHP/MySQL |

Clubs, schedules and attendance now use canonical database IDs. Old browser demo keys are retained in localStorage but are no longer read, written or automatically imported. Club coaches are derived from active assignments; membership totals come from approved database memberships. Training forms expose the agreed session fields rather than unsaved preview-only fields.

Students see their own attendance. Admins and assigned club coaches see permitted rosters and record attendance for approved members. Coaches can review their clubs’ memberships and sport-scoped competition entries. Assignments do not change the account role.

Authentication uses the shared server session. The first Admin is provisioned with backend/bin/create-admin.php; no default credentials exist.

## Integration conventions

- src/main.jsx owns the single BrowserRouter and AuthProvider.
- src/App.jsx combines all protected module routes in the shared Student/Admin workspace.
- src/shared/api.js handles PHP JSON requests, cookies, CSRF, safe errors and GET/POST/PATCH/PUT/DELETE calls.
- src/shared/StudentLayout.jsx and src/shared/AdminLayout.jsx provide role-aware workspace navigation using a consistent shared shell.
- src/shared/FormField.jsx, src/shared/Feedback.jsx and src/shared/DataTable.jsx provide common accessible field, feedback and table patterns for competition screens.
- Use `api.get`, `api.post`, `api.put`, `api.patch` and `api.delete` with paths relative to `/api`. For example, `api.put("/matches/7/result", { home_score: 2, away_score: 1 })` records a result using the current session and CSRF token.
- The shared API client also accepts successful 204 archive/cancellation responses without trying to parse an empty JSON body.
- src/shared/AuthContext.jsx maintains the authoritative server session.
- src/shared/styles.css styles the authentication/user workspace.
- src/glass.css and module CSS provide sports-module presentation; integrated-workflows.css adapts it to the shared workspace.
- All active module services use the PHP APIs. useClubAccess.js reads current club assignments and fails closed on permission-loading errors.

Preserve authentication routes, the API proxy and shared helpers when adding workflows. Reuse loading/error/empty states, abort obsolete reads, enforce permission checks in PHP, and verify persistence through a separate read. See [sports/training APIs](../docs/sports-training-api.md) and the other module contracts.
