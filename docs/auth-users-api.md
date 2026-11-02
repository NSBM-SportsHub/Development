# Authentication and users API

Mukilan owns these PHP handlers, React screens, and shared authentication helpers. This branch implements authentication/users and announcements endpoints with the shared PDO conventions.

## Development URLs

- React: `http://localhost:5173`
- PHP API: `http://127.0.0.1:8000/api`
- Browser requests use `/api`. Vite proxies these to PHP, including the session cookie. Keep the browser on the React origin throughout development.

The URL becomes available after the database and PHP server are started; see [local setup](local-development.md). Production must serve the frontend and `/api` on the same HTTPS origin and expose only `backend/public/` as the PHP document root. There is no public cross-origin API configuration.

## Common request and response rules

All responses are JSON. Successful responses use `{ "data": ..., "error": null }`. Errors use:

```json
{
  "data": null,
  "error": {
    "code": "validation_failed",
    "message": "Please check the submitted fields.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

`fields` is a map, including when empty. Typical statuses are 400 malformed JSON, 401 authentication required/invalid login, 403 forbidden/invalid CSRF, 404 unknown record, 405 unsupported method, 409 duplicate/conflicting operation, 413 oversized body, 415 unsupported content type, 422 invalid fields, 429 throttled login, and 503 database unavailable. The UI displays safe messages and field errors; internal database errors are logged only on the server.

1. Fetch `GET /api/auth/session` before writing, including before login or registration. It returns `{ "user": null, "csrf_token": "..." }` for an anonymous visitor.
2. Send the session cookie and `X-CSRF-Token` on every POST, PATCH, and DELETE. Send `Content-Type: application/json` and a JSON object, including `{}` for logout and DELETE.
3. Login/registration return a new CSRF token. Fetch the session again after profile/email or password updates, which can rotate session credentials. The frontend shared client/provider handles this.
4. Identity and permissions come from the server session. A submitted role never grants a public registrant or Student extra access. Accounts are checked for deletion, active status, and session version on every authenticated request.

No password hashes, authentication versions, database credentials, or private session values appear in user responses. Session cookies are HttpOnly and SameSite=Lax; production requires Secure cookies and HTTPS. Login is rate limited by server-derived address and keyed email identifiers.

## Endpoints

Paths below are relative to `/api`.

| Method and path | Access | Body / response data |
| --- | --- | --- |
| `GET /health` | Public | Checks database connectivity; `{status, database}` |
| `GET /auth/session` | Public | `{user: User or null, csrf_token}` |
| `POST /auth/register` | Public + CSRF | `{name,email,password,phone?,student_id?}` → 201 `{user,csrf_token}`; creates an active Student and signs in |
| `POST /auth/login` | Public + CSRF | `{email,password}` → `{user,csrf_token}` |
| `POST /auth/logout` | CSRF | `{}` → `{user:null,csrf_token}`; destroys the authenticated session |
| `GET /users/me` | Signed in | Current `User` |
| `PATCH /users/me` | Signed in + CSRF | Any of `{name,email,phone,student_id,current_password}` → `User`; changed email requires current password |
| `PATCH /users/me/password` | Signed in + CSRF | `{current_password,new_password}` → `{message}`; revokes other sessions |
| `GET /users` | Admin | `{users: User[], pagination:{page,per_page,total,total_pages}}` |
| `GET /users/{id}` | Admin | `User` |
| `POST /users` | Admin + CSRF | `{name,email,password,role,status,phone?,student_id?}` → 201 `User` |
| `PATCH /users/{id}` | Admin + CSRF | Any of `{name,email,role,status,phone,student_id}` → `User` |
| `DELETE /users/{id}` | Admin + CSRF | `{}` → `{message}`; archives the account |
| `GET /announcements` | Signed in | `{announcements: Announcement[]}`; excludes soft-deleted records |
| `GET /announcements/{uuid}` | Signed in | `Announcement`; Students cannot read deleted records |
| `POST /announcements` | Admin + CSRF | `{title,body,club_id?,is_pinned?}` → 201 `Announcement` |
| `PATCH /announcements/{uuid}` | Admin + CSRF | Any of `{title,body,club_id,is_pinned}` → `Announcement` |
| `DELETE /announcements/{uuid}` | Admin + CSRF | `{}` → `{message}`; sets `is_deleted` |

Admin listing accepts `page`, `per_page`, `search`, `role`, and `status` query parameters. Role is `student` or `admin`; status is `active` or `inactive`. Coach workflows remain pending team agreement; this module grants no Coach privileges.

Admins may request `GET /announcements?include_deleted=1` to read soft-deleted records. A null `club_id` denotes a campus-wide announcement; non-null values reference `clubs.id`. Announcements contain `announcement_id`, `club_id`, `title`, `body`, `is_pinned`, and `is_deleted`.

## User fields and account behavior

```json
{
  "id": 12,
  "name": "Example Student",
  "email": "student@example.test",
  "role": "student",
  "status": "active",
  "phone": null,
  "student_id": "ST12345",
  "created_at": "2026-10-28 12:00:00",
  "updated_at": "2026-10-28 12:00:00"
}
```

Timestamps are UTC. IDs are generated by the database. Names and email are required; phone and student ID may be null. Email and nonempty student ID are unique. Passwords require at least 12 characters and at most 72 UTF-8 bytes because PHP's default bcrypt hash has a byte limit. Null bytes are rejected. Public registration has no password recovery or email verification workflow yet.

DELETE sets `deleted_at`, marks the account inactive, and revokes its sessions. Archived users disappear from normal reads and cannot log in; identifiers remain reserved to preserve historical relationships. This is the module's Delete operation. Restoring archived users and changing another person's password are outside this API.

Admins cannot demote, deactivate, or archive themselves. Changes affecting Admin access are serialized under database locks to prevent concurrent removal of the last active Admin. Deactivation, role changes, password changes, and archiving invalidate old sessions. An initial Admin is provisioned only through the local CLI; there are no committed accounts or default passwords.

## Partner integration

Use `frontend/src/shared/api.js` and the shared auth provider when adding module screens. In PHP, reuse `Session::requireUser()` / `Session::requireAdmin()` and the shared HTTP/database helpers; inspect their signatures in `backend/src/shared/`. Do not create duplicate login logic or derive permission from request fields.

This module does not implement Looga's clubs/training APIs, Jassim's membership/competition APIs, Mursid's resource/booking APIs, or other members' modules. Agree those contracts with the relevant frontend/backend pair before wiring their screens.
