# Sports/Clubs and Training/Attendance — Phase 1 Alignment

**Status:** Pending stakeholder confirmation  
**Branch:** `feat/Natheeshan-club-backend`  
**Scope:** Agree on the contracts and policies needed before implementing the club CRUD workflow.

This document records the questions to resolve for Phase 1. Decisions remain pending until confirmed by the named owners; do not treat examples or unanswered questions as approved requirements. The first implementation slice is club CRUD, followed by Jassim's schema review before expanding scope.

## Stakeholder alignment

### Shahilan — frontend request/response contract

- [ ] Confirm club list and detail routes and HTTP methods.
- [ ] Confirm create and edit routes and HTTP methods.
- [ ] Confirm request fields, types, required/optional status, length limits, and validation rules.
- [ ] Confirm list search/filter parameters, pagination, and sort behavior.
- [ ] Confirm the success response shape for lists, details, create, and edit.
- [ ] Confirm the error response shape and expected status codes for invalid input, missing records, conflicts, and authorization failures.
- [ ] Confirm whether the frontend expects archived clubs in lists or details, and how archive state is represented.

### Jassim — database schema and persistence

- [ ] Confirm the club table/entity name, columns, data types, identifiers, and required/optional fields.
- [ ] Confirm whether clubs reference sports and define the expected foreign-key behavior.
- [ ] Confirm uniqueness rules, including whether names or other fields must be unique and within what scope.
- [ ] Confirm status/archive fields and whether clubs with historical relationships may be deleted.
- [ ] Confirm migration ownership, ordering, and the review process for the club schema.
- [ ] Review the completed club CRUD workflow and its persistence/history behavior before work expands to other module features.

### Mukilan — authentication and authorization

- [ ] Confirm which authenticated roles may list and view clubs.
- [ ] Confirm which roles may create, edit, and archive clubs.
- [ ] Confirm any ownership, club-scope, or field-level restrictions on edits.
- [ ] Confirm required session/authentication and CSRF checks for write requests.
- [ ] Confirm the expected failure behavior for unauthenticated and unauthorized requests.

### Mursid — training/facility dependency

- [ ] Confirm whether creating or updating a training session must reserve a facility.
- [ ] If reservations are required, identify the reservation API/service, conflict rules, and transaction/rollback expectations.
- [ ] If no reservation integration is needed, record that decision and any facility-reference validation requirement.

## Decisions to record

| Topic | Decision | Owner | Status |
|---|---|---|---|
| Club endpoint paths and methods | Pending | Shahilan | Open |
| Club request/response and error formats | Pending | Shahilan | Open |
| Club search/filter and pagination behavior | Pending | Shahilan | Open |
| Club schema, references, constraints, and migration | Pending | Jassim | Open |
| Club archive versus deletion policy | Pending | Jassim, Mukilan | Open |
| Club read/write permissions and CSRF requirements | Pending | Mukilan | Open |
| Facility reservation dependency for training | Pending | Mursid | Open |

Replace `Pending` with the confirmed decision and change `Open` to `Confirmed` only after the relevant owner agrees. Link to or name the related schema, API contract, or policy document when one exists.

## Club CRUD review checklist

Before asking Jassim to review the first slice, verify that it:

- [ ] Implements club listing and details using the agreed contract.
- [ ] Implements authorized creation and editing with server-side validation.
- [ ] Implements archive/deletion only according to the agreed policy.
- [ ] Uses prepared database queries and the agreed shared database conventions.
- [ ] Rejects invalid field values and invalid references.
- [ ] Rejects unauthorized write attempts.
- [ ] Preserves historical records according to the confirmed policy.
- [ ] Includes focused tests for successful operations and relevant validation, authorization, missing-record, and history cases.

## Phase 1 exit criteria

Phase 1 is complete when:

1. Shahilan, Jassim, and Mukilan have confirmed the decisions assigned to them above.
2. Mursid has confirmed whether training requires facility reservation integration.
3. The club contract and schema/policy decisions are recorded in an agreed source of truth.
4. The club CRUD scope and review criteria are clear enough to implement without guessing.

Do not begin training/attendance implementation as part of this phase. After Phase 1, implement the club CRUD slice and obtain Jassim's review before expanding the module.

## Schema integration status

The current repository contains PHP controllers and routes, but no authoritative SQL schema,
migration, database dump, or ERD image. The ERD screenshots are not present in the repository
workspace. The controller details below are implementation assumptions only; they are not
confirmation of the database contract. Do not change ID handling or queries based only on these
assumptions.

| Entity | Current controller assumption | PK/FK type comparison still required |
|---|---|---|
| `SPORTS` (`sports`) | PK column `id`, treated as an integer in detail lookup and club sport validation. List also assumes `name`, `description`, and `status`. | Confirm actual PK name/type and compare it with `CLUBS.sport_id`. |
| `CLUBS` (`clubs`) | PK column `id`, treated as an integer in routes, CRUD, and `lastInsertId()`. `sport_id` is treated as an integer FK to `sports.id`. Assumes `name`, `description`, `status`, `is_archived`, `created_at`, and `updated_at`. | Confirm actual PK name/type and whether `sport_id` exists, its type/nullability, and its referenced `SPORTS` key/type. |
| `TRAINING_SESSIONS` (`training_sessions`) | PK column `id`, treated as an integer in routes and controller methods. `club_id` is treated as an integer FK to `clubs.id`. Assumes `title`, `status`, `session_date`, `start_time`, `end_time`, `notes`, `created_at`, and `updated_at`. | Confirm actual PK name/type and compare `club_id` with the actual `CLUBS` PK name/type. |
| `SESSION_ATTENDANCE` | Controller currently queries a table named `training_attendance` with integer `id`, `session_id`, and `participant_id`; it assumes `session_id` references `training_sessions.id`. It also assumes `status`, `notes`, and `recorded_at`. | Confirm whether the table is actually `SESSION_ATTENDANCE` or `training_attendance`; confirm its PK, the `session_id` target/name/type, and the participant FK target/name/type. The participant entity is not established by this module. |

**No exact ERD-versus-controller type mismatch can be asserted from repository evidence.** The
exact unresolved comparisons are `CLUBS.sport_id` ↔ `SPORTS` PK,
`TRAINING_SESSIONS.club_id` ↔ `CLUBS` PK, `SESSION_ATTENDANCE.session_id` ↔
`TRAINING_SESSIONS` PK, and `SESSION_ATTENDANCE.participant_id` ↔ its participant-table PK.
For each comparison, both the referenced column names and database types remain unverified.
The code currently assumes integer IDs for all of them, including numeric-only route parsing;
this is not evidence that the actual schema uses integers. The `SESSION_ATTENDANCE` table-name
difference is known from the controller versus the requested ERD entity name, but the canonical
table name is unconfirmed.

### Safe integration steps after Jassim confirms the schema

1. Request the authoritative `CREATE TABLE` definitions or exported schema for all four entities,
   including exact column names/types, PKs, FKs, nullability, unique constraints, indexes, and
   `ON DELETE`/`ON UPDATE` actions. Confirm the schema/database version and canonical table names.
2. Compare each controller query and request field against that schema. Align route parameter
   parsing, PHP parameter types, FK validation, and generated-ID handling with the confirmed ID
   representation; do not cast UUIDs to integers.
3. Confirm whether club deletion is allowed and how related membership/training/attendance history
   must be retained. Hard-delete is currently disabled and returns a conflict response. The archive
   endpoint still assumes `is_archived` and a status value of `archived`.
4. Confirm attendance participant identity, duplicate-record rules, editable/correctable
   attendance policy, and whether attendance is append-only/history-bearing before changing its
   insert behavior.
5. Confirm the authentication implementation, allowed roles/club scope, and write/CSRF rules.
   Authentication and authorization are not implemented in these controllers; keep protected
   operations unavailable to production clients until those rules and enforcement are reviewed.
6. Add focused tests against the confirmed schema for ID parsing, FK validation, CRUD, archive and
   historical-record behavior, duplicate attendance, and the existing JSON response conventions.

The present PHP uses prepared statements for data values and shared JSON response shapes, but
those practices do not resolve schema compatibility or provide authentication/authorization.

## Backend review follow-up

The current review made only schema-independent request/query fixes:

- Search filters use distinct named placeholders for each compared column. The shared PDO
  connection disables emulated prepares, where reusing a named placeholder can fail.
- Write handlers now require a top-level JSON object; JSON arrays and scalar values are rejected
  with the existing validation response convention.
- Integer route IDs now reject decimal, exponent, signed, and out-of-range forms instead of
  coercing them to a different integer. Text/date/time and integer filters reject non-scalar
  values as validation errors rather than allowing PHP type errors or array-to-string warnings.
- Table checks use a bound MySQL metadata query and allow unexpected database errors to reach the
  existing generic server-error response instead of reporting them as missing tables.
- Club hard-delete is disabled with a conflict response; no membership or club rows are deleted.

The following remain integration blockers rather than safe local fixes:

- Schema-dependent table/column/ID assumptions and the `training_attendance` versus
  `SESSION_ATTENDANCE` naming question listed above.
- Club deletion remains unavailable until Jassim confirms FK behavior and the team confirms
  retention policy; do not replace the disabled handler with a guessed cascade/archive design.
- Authentication/authorization are not in place. The team leader must wire the agreed auth and
  access rules to protected routes before production exposure; this work does not introduce a
  separate authorization system.
- No automated tests are configured. After schema and access rules are confirmed, add tests for
  database behavior, historical records, access enforcement, and invalid request types.
