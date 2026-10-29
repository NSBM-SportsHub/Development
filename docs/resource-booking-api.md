# Resource and booking API

This contract implements Mursid's backend slice using PHP 8.2+, MySQL 8+ / MariaDB 10.6+, PDO MySQL and mbstring. It integrates with the existing authentication module through Session::requireUser(), lowercase student/admin roles, Database::get(), and shared HTTP/CSRF helpers. Identity and role are never accepted from request data. Resource/booking interfaces remain separate frontend work.

## Setup

1. Follow [local development](local-development.md) to configure private backend/config/local.php or SPORTSHUB_DB_* variables and a random application key. The module shares the existing PDO connection; separate DB_* variables are not used.
2. Run `php backend/bin/setup.php`. It applies 001_authentication_users.sql, then 002_resources_and_bookings.sql without dropping records. The original resource-only migration was renamed; compatible tables imported from it can be retained.
3. Configure the web document root to backend/public/ using the shared Apache rewrite rules. For development, run `php -S 127.0.0.1:8000 -t backend/public backend/router.php` from the repository root.
4. Get a CSRF token from `GET /api/auth/session`, then sign in using `POST /api/auth/login`. Keep the cookie and use the new token returned after login. Send X-CSRF-Token on every write. The standalone /api/session endpoint from the original feature branch is replaced by the shared /api/auth/session endpoint.
5. Use HTTPS outside local development, with SPORTSHUB_ENV=production and SPORTSHUB_SESSION_SECURE=1. All modules share the same HttpOnly, SameSite session cookie and per-request account/session-revocation checks.

In this API, a resource is either a facility or a piece of equipment. Use `/api/facilities` and `/api/equipment`; there is no generic `/api/resources` route.

Responses use `{"data": ..., "error": null}` on success and `{"data": null, "error": {"code": "...", "message": "...", "fields": {}}}` on failure, matching authentication. Lists return arrays in data. Creates return 201, reads/updates 200, and archives/cancellations 204 with no body. The shared frontend client accepts empty 204 responses. Errors use 400 (malformed request), 401 (not logged in), 403 (permission/CSRF), 404, 405 (unsupported method), 409 (capacity conflict), 413/415 (body size/content type), 422 (validation), 503 (database unavailable), and 500. Dates are accepted as ISO-8601 and stored/returned in UTC.

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

## Running the CRUD smoke tests

Follow local-development.md to configure PHP/database access, then run from the repository root:

```powershell
node backend/tests/integration.mjs
```

This suite provisions a temporary Admin and registers Students through the real authentication endpoints. It exercises facility/equipment create, list, read, update and archive, plus booking creation, ownership, editing, review, cancellation and availability conflicts. It does not require a manually constructed session cookie or hardcoded server identity. Test records are kept in a random test database that is removed afterward.

For manual requests, first get /api/auth/session, then POST email/password as a JSON object to /api/auth/login with that token and cookie. Keep the regenerated login cookie and use the returned CSRF token for resource/booking writes. Use the same browser origin as React or a cookie-aware API client. Never edit session files to impersonate an account.

## Validation and decisions requiring partner confirmation

- Names are required, trimmed, and limited to 120 characters. Description is optional (up to 2000); facility location is optional (up to 160); capacity is optional and positive when set; equipment quantity is positive. Unknown fields and fields from another resource type are rejected.
- Booking end must be after start. Pending and approved requests reserve resources; time overlap uses half-open ranges, so adjacent bookings are allowed.
- A facility permits at most one overlapping pending/approved booking. Equipment permits overlapping reservations only while summed quantity does not exceed stock.
- Resource deletion archives instead of removing history. Student cancellation is allowed only while pending. Admin review acts only on pending records; Admin may cancel pending or approved bookings.
- Availability policy, self-service Admin booking, facility capacity/attendance, bookings in the past, membership/club scope, physical equipment checkout/return, and rescheduling of approved bookings were not defined in the project plan. Confirm these rules with the team before production acceptance.

## Refresh/persistence check

With setup completed and an authenticated session, create a resource, fetch the list, reload the client, and fetch again; the resource is stored in MySQL. Repeat for a booking and verify its status and resource after reload. Test an overlapping facility request and a request that exceeds equipment quantity (both must return 409), plus a Student attempt to mutate a resource (403).

Run `node backend/tests/integration.mjs` with the PHP/database configuration from local-development.md. The suite uses a random test database and real registration/login sessions, then removes only that test database. It checks authentication regression, resource CRUD, ownership, review, overlap, equipment stock, cancellation, archival, revoked-account access and repeatable setup. These checks exercise sequential availability conflicts; simultaneous multi-request concurrency and final resource/booking UI workflows need separate verification.
