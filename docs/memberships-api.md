# Memberships and club coaches API

Backend: Jassim. Membership UI: Sanudi. Every endpoint needs a signed-in session, and every write needs the `X-CSRF-Token` header from `GET /api/auth/session` (the shared `api.js` client handles both). Responses follow [backend conventions](backend-conventions.md).

Clubs come from `003_sports_and_clubs.sql`. Until Looga's clubs API merges, run `php backend/bin/setup.php --seed` for demo clubs.

## Rules

- Any signed-in user can apply to a club whose status is `active` or `recruiting`. Archived or missing clubs return 422; `full` and `inactive` clubs return 409 `club_not_accepting`.
- A user can hold only one `pending` or `approved` membership per club (409 `duplicate_application`), but can belong to several clubs. They can reapply after `rejected`, `withdrawn` or `ended`.
- **Reviewers** are Admins and the club's assigned coaches. Nobody reviews their own application (403 `self_review`).
- Students see their own memberships. Coaches also see their clubs' memberships, and Admins see all of them. Anything else returns 404.

| From | To | Who |
| --- | --- | --- |
| `pending` | `approved`, `rejected` | Reviewer |
| `pending` | `withdrawn` | Applicant |
| `approved` | `ended` | The member (leaving), or a reviewer (removing) |

Any other change returns 409 `invalid_transition`. Approved rows are the member records; past rows are kept as history.

## Endpoints

| Method and path | Body or query | Result |
| --- | --- | --- |
| `GET /api/memberships` | Query: `club_id`, `user_id`, `status`, `page`, `per_page` (default 20, max 100) | `{memberships: [...], pagination: {page, per_page, total, total_pages}}` |
| `POST /api/memberships` | `club_id` (required), `message` (≤ 1000) | 201, membership |
| `GET /api/memberships/{id}` | | Membership |
| `PATCH /api/memberships/{id}` | `status`: `approved`, `rejected`, `withdrawn` or `ended`; `review_note` (≤ 1000) | Membership |
| `GET /api/club-coaches` | Query: `club_id`, `user_id` | Current coach assignments |
| `POST /api/club-coaches` | `club_id`, `user_id` (Admin) | 201, assignment. 409 `duplicate_coach` |
| `DELETE /api/club-coaches/{id}` | (Admin) | 204. The coach loses review access. |

Membership object:

```json
{
  "id": 7, "club_id": 2, "club_name": "Badminton Club",
  "user_id": 15, "user_name": "Alice Perera", "user_email": "alice@example.com",
  "status": "approved", "message": "I play doubles.", "review_note": "Welcome!",
  "reviewed_by": 4, "reviewed_at": "2026-10-30T09:12:00Z",
  "ended_by": null, "ended_at": null,
  "applied_at": "2026-10-30T08:55:41Z", "updated_at": "2026-10-30T09:12:00Z"
}
```

Coach assignment: `{"id", "club_id", "club_name", "user_id", "user_name", "assigned_at"}`.

## UI notes

- **Apply:** `api.post('/memberships', {club_id, message})`. Show 409 `duplicate_application` as "already applied".
- **My memberships:** `api.get('/memberships')`.
- **Review queue:** `api.get('/memberships?status=pending&club_id=...')`. Show it to Admins, and to coaches when `GET /club-coaches?user_id=<me>` returns rows.
- **Approve or reject:** `api.patch('/memberships/{id}', {status: 'approved', review_note})`.
- **Member count for a club:** `GET /memberships?club_id=...&status=approved`, then read `pagination.total`. Only reviewers see other users' rows; for a public count, the clubs API should return it.
