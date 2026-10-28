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
