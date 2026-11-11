# Simple API working-status checklist

## Task to give your teammate

Check the APIs below and complete the Result and Notes columns. For each API, confirm what it does, who can use it and whether the expected result happens. Use **Working**, **Not working**, or **Not checked**. Add a short note or screenshot when something fails.

Tester: __________  Date: __________  Branch/commit: __________

## How to check

1. Run the project and sign in with the account needed for the action.
2. Open browser Developer Tools, select **Network**, then **Fetch/XHR**.
3. Perform the action in the application. Find the matching `/api/...` request and check its response and the screen result. Reload to check that saved changes remain.
4. Fill in the result. If the interface does not call a listed method, leave it **Not checked** and ask a backend teammate to help check that request.

Use test records. Create/edit/cancel only records prepared for this check. The app handles login cookies and request tokens during normal screen actions.

The paths below include `/api`; locally the backend address is `http://127.0.0.1:8000`. Replace `{id}` with a real record ID and `{uuid}` with an announcement's ID. A coach uses a normal account with an active club assignment. **Signed in** means an authenticated account; permissions may limit which records it can see.

Each row is one method + path. There are **83 API operations**; PUT and PATCH are listed separately where both are supported. All results start as **Not checked** for this teammate's review. This checklist does not claim the reviewer has already tested them.

## Login and connection

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/health | Check the server/database | Anyone | Database is running; response says connected | Not checked | |
| GET | /api/auth/session | Check sign-in state | Anyone | Returns current user or no user, plus a request token | Not checked | |
| POST | /api/auth/register | Create a Student account | Anyone | Valid unused email and valid password create an account | Not checked | |
| POST | /api/auth/login | Sign in | Anyone | Correct active-account email/password signs in; incorrect details are rejected | Not checked | |
| POST | /api/auth/logout | Sign out | Current session | Sign-in is cleared; protected actions require sign-in again | Not checked | |

## Accounts

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/users/me | Read own profile | Signed in | Returns the signed-in account | Not checked | |
| PATCH | /api/users/me | Update own profile | Signed in | Valid changes save; changing email requires current password | Not checked | |
| PATCH | /api/users/me/password | Change own password | Signed in | Correct current password and valid new password save successfully | Not checked | |
| GET | /api/users | View/search accounts | Admin | Returns matching accounts with paging | Not checked | |
| POST | /api/users | Create an account | Admin | Valid unused details create the requested account | Not checked | |
| GET | /api/users/{id} | Read an account | Admin | Existing visible account is returned | Not checked | |
| PATCH | /api/users/{id} | Edit account/access | Admin | Valid account changes save; Admin cannot remove their own access | Not checked | |
| DELETE | /api/users/{id} | Archive an account | Admin | Another permitted account is archived and cannot sign in | Not checked | |

## Sports and clubs

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/sports | View sports | Signed in | Returns reference sports | Not checked | |
| GET | /api/sports/{id} | Read a sport | Signed in | Existing sport is returned | Not checked | |
| GET | /api/clubs | Browse/search clubs | Signed in | Returns visible clubs matching the filters | Not checked | |
| POST | /api/clubs | Create a club | Admin | Valid name and sport create a club | Not checked | |
| GET | /api/clubs/{id} | Read a club | Signed in | Existing visible club details are returned | Not checked | |
| PUT | /api/clubs/{id} | Update a club | Admin | Valid club changes save | Not checked | |
| PATCH | /api/clubs/{id} | Update a club | Admin | Valid club changes save | Not checked | |
| DELETE | /api/clubs/{id} | Archive a club | Admin | Club is archived; linked history remains | Not checked | |
| PATCH | /api/clubs/{id}/archive | Archive a club | Admin | Club is archived; linked history remains | Not checked | |

## Memberships and coaches

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/memberships | View membership records | Signed in | Student sees own records; coach sees permitted club records; Admin sees all | Not checked | |
| POST | /api/memberships | Apply to a club | Signed in | Club accepts applications; duplicate live application is rejected | Not checked | |
| GET | /api/memberships/{id} | Read a membership | Owner / club coach / Admin | Returns a permitted membership | Not checked | |
| PATCH | /api/memberships/{id} | Review, withdraw or end membership | Owner / club coach / Admin | Only a permitted change works; nobody approves their own application | Not checked | |
| GET | /api/club-coaches | View coach assignments | Signed in | Returns permitted active assignments | Not checked | |
| POST | /api/club-coaches | Assign a coach | Admin | Valid active account and club create an assignment; duplicates are rejected | Not checked | |
| DELETE | /api/club-coaches/{id} | End a coach assignment | Admin | Assignment ends and its coach permissions disappear | Not checked | |

## Training and attendance

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/training-sessions | View/search training | Signed in | Returns matching sessions | Not checked | |
| POST | /api/training-sessions | Create training | Admin / assigned club coach | Valid club, date and times create a session | Not checked | |
| GET | /api/training-sessions/{id} | Read training details | Signed in | Existing session is returned | Not checked | |
| PUT | /api/training-sessions/{id} | Edit training | Admin / assigned club coach | Valid changes save; recorded attendance prevents changing the club | Not checked | |
| PATCH | /api/training-sessions/{id} | Edit training | Admin / assigned club coach | Valid changes save; recorded attendance prevents changing the club | Not checked | |
| PATCH | /api/training-sessions/{id}/cancel | Cancel training | Admin / assigned club coach | Session is cancelled and attendance history remains | Not checked | |
| GET | /api/attendance | View attendance | Signed in | Student sees own records; coach sees permitted club records; Admin sees all | Not checked | |
| POST | /api/attendance | Record attendance | Admin / assigned session-club coach | Approved club participant and active session; duplicate attendance is rejected | Not checked | |
| GET | /api/attendance/{id} | Read attendance | Participant / club coach / Admin | Returns only a permitted record | Not checked | |

## Facilities

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/facilities | View facilities | Signed in | Students see active facilities; Admin can also see archived ones | Not checked | |
| POST | /api/facilities | Create a facility | Admin | Valid facility name/details create a record | Not checked | |
| GET | /api/facilities/{id} | Read a facility | Signed in | Returns a visible facility | Not checked | |
| PUT | /api/facilities/{id} | Edit a facility | Admin | Valid changes save | Not checked | |
| PATCH | /api/facilities/{id} | Edit a facility | Admin | Valid changes save | Not checked | |
| DELETE | /api/facilities/{id} | Archive a facility | Admin | Facility becomes inactive; existing booking history remains | Not checked | |

## Equipment

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/equipment | View equipment | Signed in | Students see active equipment; Admin can also see archived equipment | Not checked | |
| POST | /api/equipment | Create equipment | Admin | Valid name and quantity create a record | Not checked | |
| GET | /api/equipment/{id} | Read equipment | Signed in | Returns a visible equipment record | Not checked | |
| PUT | /api/equipment/{id} | Edit equipment | Admin | Valid changes save; stock cannot fall below existing reservations | Not checked | |
| PATCH | /api/equipment/{id} | Edit equipment | Admin | Valid changes save; stock cannot fall below existing reservations | Not checked | |
| DELETE | /api/equipment/{id} | Archive equipment | Admin | Equipment becomes inactive; existing booking history remains | Not checked | |

## Bookings

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/bookings | View bookings | Signed in | Student sees own bookings; Admin sees all | Not checked | |
| POST | /api/bookings | Request a resource | Signed in | Resource is available for the requested time/quantity; request starts pending | Not checked | |
| GET | /api/bookings/{id} | Read a booking | Owner / Admin | Returns a permitted booking | Not checked | |
| PUT | /api/bookings/{id} | Edit or review a booking | Owner / Admin | Student edits own pending request; Admin reviews it; unavailable allocation is rejected | Not checked | |
| PATCH | /api/bookings/{id} | Edit or review a booking | Owner / Admin | Student edits own pending request; Admin reviews it; unavailable allocation is rejected | Not checked | |
| DELETE | /api/bookings/{id} | Cancel a booking | Owner / Admin | Student cancels own pending request; Admin can also cancel an approved booking | Not checked | |

## Tournaments and entries

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/tournaments | View/filter tournaments | Signed in | Returns visible tournaments; drafts are Admin-only | Not checked | |
| POST | /api/tournaments | Create a tournament | Admin | Valid sport, dates and format create a draft | Not checked | |
| GET | /api/tournaments/{id} | Read a tournament | Signed in | Returns a visible tournament | Not checked | |
| PATCH | /api/tournaments/{id} | Edit tournament/status | Admin | Valid fields and allowed status change save | Not checked | |
| DELETE | /api/tournaments/{id} | Cancel a tournament | Admin | Tournament is cancelled; history remains | Not checked | |
| GET | /api/tournaments/{id}/entries | View tournament entries | Signed in | Returns approved entries and any additional entries the user may view | Not checked | |
| POST | /api/tournaments/{id}/entries | Register an entry | Signed in | Registration is open; roster has eligible approved club members; duplicate entry is rejected | Not checked | |
| GET | /api/tournaments/{id}/eligible-members | Find eligible players | Signed in | Returns selectable eligible participants | Not checked | |
| GET | /api/tournament-entries/{id} | Read an entry | Permitted signed-in user | Returns an entry the user may view | Not checked | |
| PATCH | /api/tournament-entries/{id} | Review or withdraw an entry | Captain / sport-scoped coach / Admin | Captain withdraws own entry; reviewer approves/rejects; self-review is rejected | Not checked | |

## Fixtures, matches and results

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/tournaments/{id}/matches | View/filter fixtures | Signed in | Returns visible tournament matches | Not checked | |
| POST | /api/tournaments/{id}/matches | Create a match | Admin | Valid distinct approved entries and allowed tournament state create a match | Not checked | |
| POST | /api/tournaments/{id}/fixtures | Generate fixtures | Admin | Registration is closed or tournament is in progress; valid entries generate fixtures | Not checked | |
| GET | /api/tournaments/{id}/standings | View standings/bracket | Signed in | Returns the league table or knockout bracket based on saved results | Not checked | |
| GET | /api/matches/{id} | Read a match | Signed in | Returns a visible match | Not checked | |
| PATCH | /api/matches/{id} | Edit match schedule/status | Admin | Allowed match changes save; completed/cancelled matches are read-only | Not checked | |
| DELETE | /api/matches/{id} | Cancel a match | Admin | A cancellable match is cancelled and history remains | Not checked | |
| PUT | /api/matches/{id}/result | Record/correct a result | Admin | Tournament is in progress; valid scores save and standings update; locked results reject edits | Not checked | |

## Announcements

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/announcements | View announcements | Signed in | Returns visible announcements; only Admin can request deleted records | Not checked | |
| POST | /api/announcements | Publish an announcement | Admin | Valid title/message and optional club create an announcement | Not checked | |
| GET | /api/announcements/{uuid} | Read an announcement | Signed in | Returns a visible announcement | Not checked | |
| PATCH | /api/announcements/{uuid} | Edit/pin an announcement | Admin | Valid changes save | Not checked | |
| DELETE | /api/announcements/{uuid} | Delete an announcement | Admin | Announcement is hidden from normal Student reads | Not checked | |

## Notifications and reports

| Method | API path | Purpose | Who can use it | Working condition / expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/notifications | View/filter inbox | Signed in | Returns only the account's own notifications and unread count | Not checked | |
| PATCH | /api/notifications/{id} | Mark a notification read | Recipient | Sending read=true saves read state; another person's notification is denied | Not checked | |
| GET | /api/participation/me | View personal history | Signed in | Returns only own training, registration and match records/totals | Not checked | |
| GET | /api/reports/participation | View/filter participation/performance report | Admin | Records and totals agree with saved source activity and selected filters | Not checked | |

## Simple completion summary

Working: ___ / 83 | Not working: ___ / 83 | Not checked: ___ / 83

For each problem, record: **API, action attempted, expected result, actual result, screenshot if useful**. A deliberately rejected invalid request or unauthorized action can be a correct result; an empty list can also be correct when there are no matching records.

Confirm these rows against the source router when APIs change: `backend/public/index.php` and `backend/src/shared/SportsTrainingRoutes.php`. Detailed request examples are in [accounts](auth-users-api.md), [memberships](memberships-api.md), [sports/training](sports-training-api.md), [resources/bookings](resource-booking-api.md), [competitions](competitions-api.md), and [notifications/reports](notifications-reports-api.md).
