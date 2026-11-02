# NSBM SportsHub frontend

This branch combines PHP-backed authentication/users screens and tournament, match and result management with Shahilan's club, training/attendance and announcement previews. Resource/booking and membership APIs share the login session; their screens remain pending. See [local setup](../docs/local-development.md), the [authentication API](../docs/auth-users-api.md), the [resource/booking API](../docs/resource-booking-api.md), the [membership API](../docs/memberships-api.md), the [competition API](../docs/competitions-api.md), and [team allocation](../README.md).

## Start locally

Node.js 22.12+ and npm are required. From frontend/:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173. Module previews can be explored with their browser demo data. To register, sign in, use a profile or manage users, initialize the database and start PHP following the setup guide.

Vite forwards browser /api requests to http://127.0.0.1:8000. Stay on the React origin for session cookies and CSRF. Production needs a real same-origin /api route to PHP.

```powershell
npm.cmd run build
npm.cmd test
```

The build writes the ignored dist/ directory. The tests check club create/update/delete persistence and missing-record mutations, plus shared API requests for result writes, CSRF renewal, cancellation, validation and expired sessions. API-client tests mock the HTTP boundary; the separate backend integration runner exercises real PHP/database operations.

## Routes and current data behavior

| Route | Current behavior |
| --- | --- |
| /login | PHP email/password sign-in |
| /register | PHP registration of an active Student |
| /profile | Protected PHP-backed profile editing and password change |
| /admin/users | Admin-only PHP user directory and create/edit/activate/deactivate/archive |
| /tournaments | Signed-in Student/Admin tournament listing; Admins create/edit and manage tournament status |
| /tournaments/:tournamentId | Tournament details, entry registration/withdrawal, and authorized coach/Admin entry review |
| /tournaments/:tournamentId/matches | Fixtures, match scheduling and updates, score/result entry, league standings and knockout bracket |
| /sports-clubs/* | Public preview: list/search/details and local create/edit/delete |
| /training-attendance/* | Public preview: schedules, session create/edit, attendance recording/listing |
| /announcements/* | Public preview: announcement drafts, editing and publication controls |

Clubs, training sessions and attendance use sample records and localStorage in the current browser origin. Existing storage keys/data are preserved by this integration. These records are not saved through PHP/MySQL and are not shared across devices or origins.

Tournament, entry, match, result and standings screens use the PHP/MySQL competition API and shared authenticated session. Tournament sports and active facilities load from the authenticated `/api/sports` and `/api/facilities` endpoints.

Announcements are held in React memory. Refreshing or leaving the mounted module resets them to sample records. Training/attendance and announcement previews do not currently implement a complete delete workflow.

Public preview controls do not establish business-role permissions or announcement-audience enforcement. Those workflows need their agreed PHP endpoints and server-side authorization before acceptance as integrated features. The preview/account navigation identifies their demo-data status.

Authentication uses the shared server session. No auth tokens or passwords are stored in localStorage. The first Admin is provisioned by backend/bin/create-admin.php; no default credentials exist. Account roles remain Student/Admin. Club coach assignments grant scoped membership/competition permissions in PHP; coach interfaces and training permissions remain pending.

## Integration conventions

- src/main.jsx owns the single BrowserRouter and AuthProvider.
- src/App.jsx combines protected account routes with separate module preview layouts.
- src/shared/api.js handles PHP JSON requests, cookies, CSRF, safe errors and GET/POST/PATCH/PUT/DELETE calls.
- src/shared/StudentLayout.jsx and src/shared/AdminLayout.jsx provide role-aware workspace navigation using a consistent shared shell.
- src/shared/FormField.jsx, src/shared/Feedback.jsx and src/shared/DataTable.jsx provide common accessible field, feedback and table patterns for competition screens.
- Use `api.get`, `api.post`, `api.put`, `api.patch` and `api.delete` with paths relative to `/api`. For example, `api.put("/matches/7/result", { home_score: 2, away_score: 1 })` records a result using the current session and CSRF token.
- The shared API client also accepts successful 204 archive/cancellation responses without trying to parse an empty JSON body.
- src/shared/AuthContext.jsx maintains the authoritative server session.
- src/shared/styles.css styles the authentication/user workspace.
- src/glass.css provides module preview presentation; coordinate shared styling with Shahadh.
- Each module retains its own components and local data services until its agreed API integration.

Preserve authentication routes, the API proxy and shared helpers when adding business APIs. Replace preview storage through the agreed client and backend contract, including loading/empty/error states, validation, permissions and reload persistence. Module owners remain responsible for their assigned workflows.

Public demo data and private application records have different persistence. Test previews in a fresh browser profile/context so QA does not overwrite another person's saved local clubs.
