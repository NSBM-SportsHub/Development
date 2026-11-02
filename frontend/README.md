# NSBM SportsHub frontend

This branch combines PHP-backed authentication/users with membership, resource, and Student booking interfaces, plus Shahilan's club, training/attendance, and announcement previews. See [local setup](../docs/local-development.md), the [authentication API](../docs/auth-users-api.md), the [membership API](../docs/memberships-api.md), the [resource/booking API](../docs/resource-booking-api.md), and [team allocation](../README.md).

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
node --test src/modules/sports-clubs/clubsService.test.js
```

The build writes the ignored dist/ directory. The club-service tests check create/update persistence, delete persistence including an empty list, and missing-record mutation errors. There is no npm test script.

## Routes and current data behavior

| Route | Current behavior |
| --- | --- |
| /login | PHP email/password sign-in |
| /register | PHP registration of an active Student |
| /profile | Protected PHP-backed profile editing and password change |
| /admin/users | Admin-only PHP user directory and create/edit/activate/deactivate/archive |
| /memberships/apply | Authenticated application submission to the PHP membership API |
| /memberships/mine | Personal membership status, withdraw, and leave actions |
| /admin/memberships | Admin review queue and membership records |
| /facilities | PHP-backed facility list; Admins can create, edit, and archive |
| /equipment | PHP-backed equipment list; Admins can create, edit, and archive |
| /bookings/new | Student-only PHP-backed facility/equipment booking request |
| /bookings/mine | Student-only booking status and pending-request cancellation |
| /sports-clubs/* | Public preview: list/search/details and local create/edit/delete |
| /training-attendance/* | Public preview: schedules, session create/edit, attendance recording/listing |
| /announcements/* | Public preview: announcement drafts, editing and publication controls |

Clubs, training sessions and attendance use sample records and localStorage in the current browser origin. Existing storage keys/data are preserved by this integration. These records are not saved through PHP/MySQL and are not shared across devices or origins.

Announcements are held in React memory. Refreshing or leaving the mounted module resets them to sample records. Training/attendance and announcement previews do not currently implement a complete delete workflow.

Club selection in the membership application currently accepts the database club ID because the PHP API does not yet expose a club-list endpoint; do not use the IDs from the local club preview as those records are not database-backed. Once the clubs API is available, replace this field with its active/recruiting club choices without changing the memberships API submission contract.

Membership, facility, equipment, and booking mutations use the shared authenticated session and CSRF-aware API client. Student/Admin access is enforced by both route guards and the PHP API. Public preview controls do not establish business-role permissions or announcement-audience enforcement. Those workflows need their agreed PHP endpoints and server-side authorization before acceptance as integrated features. The preview/account navigation identifies their demo-data status.

Authentication uses the shared server session. No auth tokens or passwords are stored in localStorage. The first Admin is provisioned by backend/bin/create-admin.php; no default credentials exist. Coach permissions remain pending team agreement.

## Integration conventions

- src/main.jsx owns the single BrowserRouter and AuthProvider.
- src/App.jsx combines protected account routes with separate module preview layouts.
- src/shared/api.js handles PHP JSON requests, cookies, CSRF and safe errors.
- The shared API client also accepts successful 204 archive/cancellation responses without trying to parse an empty JSON body.
- src/shared/AuthContext.jsx maintains the authoritative server session.
- src/shared/styles.css styles the authentication/user workspace.
- src/glass.css provides module preview presentation; coordinate shared styling with Shahadh.
- Membership, facility, equipment, and Student booking screens use the PHP APIs; other previews retain their local data services until their agreed API integration.

Preserve authentication routes, the API proxy and shared helpers when adding business APIs. Replace preview storage through the agreed client and backend contract, including loading/empty/error states, validation, permissions and reload persistence. Module owners remain responsible for their assigned workflows.

Public demo data and private application records have different persistence. Test previews in a fresh browser profile/context so QA does not overwrite another person's saved local clubs.
