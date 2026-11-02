# Shahilan Phase 1: Setup and Contract Proposal

**Status: Draft for team review — not an approved API, schema, permission policy, or tooling decision.**

This proposal is intended to align Shahilan's sports/clubs, training/attendance, and later announcements work with the shared application. The repository currently has no implemented frontend/backend foundation, database schema, or API endpoints. Do not implement this draft as a final contract until the relevant owners approve it.

## Owners and requested decisions

| Owner | Please confirm |
| --- | --- |
| Mukilan | Frontend framework/tooling, application entry point and routing, API base URL/client, authenticated state, PHP routing, session and CSRF conventions, and shared authorization helpers |
| Shahadh | Layouts, navigation, shared controls, design/accessibility conventions, and responsive patterns to use |
| Looga | Club, training-session, and attendance endpoint behavior, fields, validation, status transitions, and error responses |
| Jassim | ERD, identifiers/relationships, status values, migration order, database conventions, and review of permission/data rules |
| Shahilan | Module UI integration and announcement frontend/backend implementation, following the approved shared conventions |
| Team lead / relevant owners | Student/Admin/Coach scope, club-level authority, announcement audiences, and publication/viewing rules |

### Approval checklist

- [ ] Mukilan confirms the shared frontend and backend integration conventions.
- [ ] Shahadh confirms the shared UI conventions and components.
- [ ] Looga and Shahilan approve the club, session, and attendance API contract.
- [ ] Jassim approves the related schema proposal and migration approach.
- [ ] Relevant owners agree the role/action matrix and announcement audience policy.
- [ ] Approved decisions are recorded in the project docs before implementation diverges.

## Shared frontend proposal

These are requests for confirmation, not selected dependencies or established conventions:

- Confirm whether React is allowed by the assignment and select the frontend tooling/version with Mukilan.
- Use Mukilan's single shared API client and application routing/authenticated state. Do not add a module-specific transport or duplicate auth implementation.
- Reuse Shahadh's shared layout, navigation, styling, and controls; agree any missing shared controls before creating alternatives.
- Keep module files within the assigned `frontend/src/modules/` directories.
- Agree how the frontend obtains its API base URL, handles authenticated requests/CSRF, and presents server validation errors.
- Provide loading, empty, success, and failure states; retain server-side validation and authorization as authoritative.

## Proposed API shape for discussion

The paths below are illustrative REST-style suggestions. Mukilan must confirm the actual entry point, routing syntax, versioning, HTTP methods, session behavior, and response conventions. Looga owns club/training/attendance handlers; Shahilan owns announcements handlers. All write operations require the approved authentication and CSRF protections.

| Workflow | Suggested operations | Open contract decisions |
| --- | --- | --- |
| Clubs | `GET /api/clubs`; `GET /api/clubs/{clubId}`; `POST /api/clubs`; `PATCH /api/clubs/{clubId}` | Search/filter and pagination; editable fields; who can create/edit; archive versus delete; public versus authenticated visibility |
| Training sessions | `GET /api/training-sessions?club_id=...&from=...&to=...`; `GET /api/training-sessions/{sessionId}`; `POST /api/training-sessions`; `PATCH /api/training-sessions/{sessionId}` | Session fields, permitted club scope, date/time storage and display, cancellation/archive behavior, who can manage |
| Attendance | `GET /api/training-sessions/{sessionId}/attendance`; `PUT /api/training-sessions/{sessionId}/attendance` | Eligible roster source, record shape, duplicate handling, whether updates replace a full session roster or patch selected records, who can mark/correct |
| Announcements | `GET /api/announcements`; `GET /api/announcements/{announcementId}`; `POST /api/announcements`; `PATCH /api/announcements/{announcementId}`; proposed publish action | Audience model, draft visibility, authors/editors, publication scheduling/state transitions, archive behavior, list filtering |

Confirm whether IDs are numeric or otherwise, whether list results are paginated, and how filters are encoded. A possible JSON convention for discussion is:

```json
{
  "data": {},
  "error": null
}
```

For failures, agree on a consistent error object with a stable machine-readable code, a user-safe message, and field-level validation details where relevant. Agree on HTTP status mapping, empty-list representation, pagination metadata, and handling of unauthenticated/forbidden/not-found responses before adopting any response envelope.

### Candidate data fields to validate with Jassim and Looga

These are starting points for the ERD discussion, not final table or column names:

- **Club:** identifier, name, description, active/archive state, and any approved contact or sport/category fields.
- **Training session:** identifier, club reference, title, start/end date-time, location, state, and creator/audit references as required.
- **Attendance:** session reference, participant/user reference, attendance state, recorder and recorded/updated timestamps as required. Agree whether a unique session/participant pair is appropriate.
- **Announcement:** identifier, title, body, author, draft/published/archive state, publication timestamps, audience targeting, and audit timestamps.
- **Audience targeting:** agree whether audiences are global roles, specific clubs, membership groups, or a supported combination. Do not rely on a frontend-only audience filter.

Jassim coordinates identifiers, foreign keys, uniqueness, archive/history behavior, timestamps, and migration order against the shared user/auth schema. Do not create module migrations or assume table names before that review.

## Permission questions and secure baseline

The project's existing guidance requires PHP to enforce identity, role, ownership, and applicable club scope on every protected operation. Frontend route guards or hidden buttons are not authorization.

Ask the relevant owners to fill and approve this matrix:

| Action | Student | Coach | Admin | Decision owner |
| --- | --- | --- | --- | --- |
| Browse club list/details | Confirm visibility | Confirm visibility | Confirm | Jassim / team lead |
| Create/edit/archive clubs | Confirm (proposed: no) | Confirm (proposed: no) | Confirm | Looga / team lead |
| View club training sessions | Confirm visibility/scope | Confirm assigned-club scope | Confirm | Looga / team lead |
| Create/edit/cancel sessions | Confirm (proposed: no) | Confirm assigned-club scope | Confirm | Looga / team lead |
| View/record/correct attendance | Confirm personal access | Confirm assigned-club/session scope | Confirm | Looga / Jassim |
| Create/edit/publish announcements | Confirm (proposed: no) | Confirm scope, if applicable | Confirm | Shahilan / team lead |
| Read published announcements | Confirm audiences | Confirm audiences | Confirm | Shahilan / team lead |
| Read drafts or restricted announcements | Confirm (proposed: deny) | Confirm (proposed: deny unless explicitly authorized) | Confirm authorized editor access | Shahilan / team lead |

**Security baseline for review:** deny access unless an approved rule grants it; derive the actor and roles from authenticated server state rather than request fields; verify record and club scope on the server; and return no draft/restricted announcement data to an unauthorized caller. Define whether a draft author may view/edit their own draft and whether Admin access is universal or scoped before implementation. This baseline does not decide the final role policy.

## Cross-cutting behavior to agree

- Use the shared authentication/session and CSRF approach for mutations.
- Validate required fields, lengths, identifiers, date/time order, allowed states, and relationships on the server.
- Agree timezone storage and display rules. Validate that session end is after start and define how date filters are interpreted.
- Define attendance states, whether an attendance record can be corrected, and how repeated submissions behave.
- Prefer archive/status transitions over destructive deletion where records are referenced by attendance/history; confirm this with Jassim.
- Keep database credentials and server-only configuration out of frontend files and public directories.
- Agree safe error responses and logging; do not expose database errors or stack traces to clients.

## Suggested small integration sequence

1. Mukilan and Shahadh confirm shared frontend entry, API client/auth state, routing, and UI conventions.
2. Jassim confirms user/role references and the proposed club, session, attendance, and announcement model with Looga and Shahilan.
3. Looga and Shahilan agree endpoint fields, validation, responses, and permission checks for each workflow.
4. Record the approved API/schema/permission decisions; only then implement the club workflow, followed by sessions, attendance, and announcements.
5. Test each workflow through PHP and the database, including refresh persistence and direct unauthorized requests.

Keep pull requests small and scoped to one workflow. Shared foundation or schema changes should be coordinated with their owners rather than introduced as module-local replacements.
