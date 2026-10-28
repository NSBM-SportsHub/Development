# Resource and booking API

This contract implements the Mursid backend slice. It assumes PHP 8.1+, MySQL 8.0.16+, PDO MySQL, and the PHP `mbstring` extension, plus an existing login layer that stores the authenticated account as `$_SESSION['user'] = ['id' => <integer>, 'role' => 'Student'|'Admin']`. It does not create user accounts or grant roles. Never set this session value from request data.

## Setup

1. Create a MySQL database and import `database/migrations/001_resources_and_bookings.sql`.
2. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in the PHP/Apache process environment. Do not commit credentials.
3. Configure the web document root to `backend/public/`; Apache can use the included rewrite rules. For a PHP development server, run `php -S 127.0.0.1:8000 -t backend/public backend/public/index.php` from the repository root.
4. Integrate the existing authentication middleware so it regenerates the session ID and CSRF token after login and sets the session user shape above. `GET /api/session` provides the session CSRF token. Send it as `X-CSRF-Token` on every POST, PUT, PATCH, and DELETE request.
5. Serve over HTTPS outside local development. The session cookie is HTTP-only and SameSite=Lax; `Secure` is enabled when the request uses HTTPS.

In this API, a resource is either a facility or a piece of equipment. Use `/api/facilities` and `/api/equipment`; there is no generic `/api/resources` route.

Responses use `{"data": ...}` on success and `{"error": "...", "fields": [...]?}` on failure. `GET` list responses return `{"data": []}`. Creates return 201, reads and updates return 200, and deletes return 204 with no body. Errors use 400 (malformed request), 401 (not logged in), 403 (permission/CSRF), 404, 405 (unsupported method), 409 (capacity conflict), 422 (validation), and 500. Dates are accepted as ISO-8601 and stored/returned in UTC.

## Permissions and CRUD

| Resource | Method and path | Student | Admin |
| --- | --- | --- | --- |
| Facilities | `GET /api/facilities[/{id}]` | Read active | Read active and archived |
| Facilities | `POST /api/facilities`, `PUT/PATCH /api/facilities/{id}` | — | Create/update |
| Facilities | `DELETE /api/facilities/{id}` | — | Archive (`is_active=0`) |
| Equipment | `GET /api/equipment[/{id}]` | Read active | Read active and archived |
| Equipment | `POST /api/equipment`, `PUT/PATCH /api/equipment/{id}` | — | Create/update |
| Equipment | `DELETE /api/equipment/{id}` | — | Archive (`is_active=0`) |
| Bookings | `GET /api/bookings[/{id}]` | Own records only | All records |
| Bookings | `POST /api/bookings` | Create pending request | Create pending request |
| Bookings | `PUT/PATCH /api/bookings/{id}` | Edit own pending request | Set pending status to approved/rejected/cancelled |
| Bookings | `DELETE /api/bookings/{id}` | Cancel own pending request | Cancel pending/approved request |

Use the singular `resource_type` value `facility` or `equipment` for bookings.

## Endpoint contract

| Method and path | Request body | Success response |
| --- | --- | --- |
| `POST /api/facilities` | `name` required; optional `description`, `location`, `capacity` | `201 {"data":{"id":1,"name":"Indoor Court",...}}` |
| `GET /api/facilities` | None | `200 {"data":[...]}` |
| `GET /api/facilities/{id}` | None | `200 {"data":{...}}` |
| `PUT` or `PATCH /api/facilities/{id}` | One or more of `name`, `description`, `location`, `capacity` | `200 {"data":{...}}` |
| `DELETE /api/facilities/{id}` | None | `204` (archived) |
| `POST /api/equipment` | `name` and `total_quantity` required; optional `description` | `201 {"data":{"id":1,"name":"Basketball",...}}` |
| `GET /api/equipment` | None | `200 {"data":[...]}` |
| `GET /api/equipment/{id}` | None | `200 {"data":{...}}` |
| `PUT` or `PATCH /api/equipment/{id}` | One or more of `name`, `description`, `total_quantity` | `200 {"data":{...}}` |
| `DELETE /api/equipment/{id}` | None | `204` (archived) |
| `POST /api/bookings` | `resource_type`, `resource_id`, `starts_at`, `ends_at` required; optional `quantity`, `notes` | `201 {"data":{"id":1,"status":"pending",...}}` |
| `GET /api/bookings` | None | `200 {"data":[...]}` |
| `GET /api/bookings/{id}` | None | `200 {"data":{...}}` |
| `PUT` or `PATCH /api/bookings/{id}` | Student: one or more of `starts_at`, `ends_at`, `quantity`, `notes`; Admin: required `status` | `200 {"data":{...}}` |
| `DELETE /api/bookings/{id}` | None | `204` (cancelled) |

Every endpoint requires authentication. Resource writes require Admin; booking reads are scoped to the requesting Student and Admin can read all bookings. Students can change/cancel only their own pending bookings. Admin booking updates are review decisions (`approved`, `rejected`, or `cancelled`); Admin can cancel pending or approved bookings. All writes require the session CSRF token in `X-CSRF-Token`.

The success object contains the stored database record. Booking responses also include `resource_name` and `resource_type`. Missing/inactive resources and bookings not visible to the caller return 404. Unsupported methods return 405.

## Request examples

Facility create:

```json
{"name":"Indoor Court","description":"Main sports hall","location":"Building A","capacity":24}
```

Equipment create:

```json
{"name":"Basketball","description":"Size 7","total_quantity":12}
```

Booking create:

```json
{"resource_type":"facility","resource_id":1,"starts_at":"2026-10-29T09:00:00+05:30","ends_at":"2026-10-29T10:00:00+05:30","notes":"Training"}
```

Equipment bookings may additionally include a positive integer `quantity` (default 1). Facilities do not accept `quantity`.

Booking review:

```json
{"status":"approved"}
```

## PowerShell CRUD smoke-test commands

Run the PHP server and import the migration as described in Setup. The repository currently has no login endpoint: first authenticate through the team's login integration and save its PHP session cookie in `session-cookies.txt`. Use an Admin session for the resource commands and for the booking review shown below. These commands exercise the real database; they do not create seed or hardcoded server data.

```powershell
$BaseUrl = "http://127.0.0.1:8000"
$CookieFile = ".\session-cookies.txt"
$Session = curl.exe -sS -b $CookieFile -c $CookieFile "$BaseUrl/api/session" | ConvertFrom-Json
if ($null -eq $Session.data.user) { throw "Authenticate first and populate the cookie jar." }
$CsrfToken = $Session.data.csrf_token
$Headers = @("-b", $CookieFile, "-H", "X-CSRF-Token: $CsrfToken", "-H", "Content-Type: application/json")

# Facility: create, list, read, update, archive.
$Facility = curl.exe -sS @Headers -d '{"name":"CRUD test court","location":"Test building","capacity":20}' "$BaseUrl/api/facilities" | ConvertFrom-Json
$FacilityId = $Facility.data.id
curl.exe -i -b $CookieFile "$BaseUrl/api/facilities"
curl.exe -i -b $CookieFile "$BaseUrl/api/facilities/$FacilityId"
curl.exe -i @Headers -X PUT -d '{"name":"CRUD test court updated"}' "$BaseUrl/api/facilities/$FacilityId"
curl.exe -i @Headers -X DELETE "$BaseUrl/api/facilities/$FacilityId"

# Equipment: create, list, read, update, archive.
$Equipment = curl.exe -sS @Headers -d '{"name":"CRUD test ball","total_quantity":8}' "$BaseUrl/api/equipment" | ConvertFrom-Json
$EquipmentId = $Equipment.data.id
curl.exe -i -b $CookieFile "$BaseUrl/api/equipment"
curl.exe -i -b $CookieFile "$BaseUrl/api/equipment/$EquipmentId"
curl.exe -i @Headers -X PATCH -d '{"total_quantity":10}' "$BaseUrl/api/equipment/$EquipmentId"
curl.exe -i @Headers -X DELETE "$BaseUrl/api/equipment/$EquipmentId"

# Booking: create against a separately created active facility, list, read, review, cancel.
# Create this facility before its booking (or use another active facility).
$BookableFacility = curl.exe -sS @Headers -d '{"name":"CRUD booking court"}' "$BaseUrl/api/facilities" | ConvertFrom-Json
$Booking = curl.exe -sS @Headers -d "{`"resource_type`":`"facility`",`"resource_id`":$($BookableFacility.data.id),`"starts_at`":`"2030-10-29T09:00:00Z`",`"ends_at`":`"2030-10-29T10:00:00Z`"}" "$BaseUrl/api/bookings" | ConvertFrom-Json
$BookingId = $Booking.data.id
curl.exe -i -b $CookieFile "$BaseUrl/api/bookings"
curl.exe -i -b $CookieFile "$BaseUrl/api/bookings/$BookingId"
curl.exe -i @Headers -X PUT -d '{"status":"approved"}' "$BaseUrl/api/bookings/$BookingId"
curl.exe -i @Headers -X DELETE "$BaseUrl/api/bookings/$BookingId"
```

Expected statuses are 201 for each create, 200 for each list/read/update, and 204 for each archive/cancel. The booking approval may return 409 if that facility has a conflicting reservation. Archived facilities/equipment and cancelled bookings remain in the database to preserve history; use fresh test records if repeating the sequence.

## Validation and decisions requiring partner confirmation

- Names are required, trimmed, and limited to 120 characters. Description is optional (up to 2000); facility location is optional (up to 160); capacity is optional and positive when set; equipment quantity is positive.
- Booking end must be after start. Pending and approved requests reserve resources; time overlap uses half-open ranges, so adjacent bookings are allowed.
- A facility permits at most one overlapping pending/approved booking. Equipment permits overlapping reservations only while summed quantity does not exceed stock.
- Resource deletion archives instead of removing history. Student cancellation is allowed only while pending. Admin review acts only on pending records; Admin may cancel pending or approved bookings.
- Availability policy, self-service Admin booking, facility capacity/attendance, bookings in the past, membership/club scope, physical equipment checkout/return, and rescheduling of approved bookings were not defined in the project plan. Confirm these rules with the team before production acceptance.

## Refresh/persistence check

With the schema imported and an authenticated session, create a resource, fetch the list, reload the client, and fetch again; the resource is stored in MySQL. Repeat for a booking and verify its status and resource after reload. Test an overlapping facility request and a request that exceeds equipment quantity (both must return 409), plus a Student attempt to mutate a resource (403). Runtime PHP/MySQL verification remains to be run in the configured XAMPP environment.
