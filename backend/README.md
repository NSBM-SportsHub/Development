# NSBM SportsHub - Backend

This directory is reserved for the PHP backend of NSBM SportsHub. It will implement authentication, authorization, validated business operations, MySQL access, and integration with the frontend.

Read the [project guide](../README.md) for the complete scope, team allocation, milestones, and contribution rules. Read the [frontend guide](../frontend/README.md) when coordinating a module's interface.

> **Current status:** Facilities, equipment, and bookings have a first PHP/MySQL API implementation. Authentication integration, MySQL setup, and execution tests still need to be completed in the team environment. Other module folders remain placeholders.

## Technology and runtime direction

- PHP is the required backend language.
- MySQL is the required database technology; confirm the actual local XAMPP engine/version and agreed compatibility.
- XAMPP is the planned local PHP/Apache/database environment.
- Browser clients call PHP; they never access the database directly.
- Shared connection/query conventions should use prepared statements, with PDO proposed for review by Jassim.

A PHP framework, dependency manager, runtime version, routing mechanism, and response format have not yet been selected or implemented. Agree on these before introducing module-specific alternatives. Node.js/MongoDB are not replacements for the required backend/database stack.

## Directory guide

```text
backend/
|-- README.md
|-- config/             Planned server and database configuration
|-- public/             Planned web entry point directory
`-- src/
    |-- shared/         Planned routing, auth, validation, and database helpers
    `-- modules/
        |-- authentication-users/
        |-- sports-clubs/
        |-- memberships/
        |-- facilities/
        |-- equipment/
        |-- bookings/
        |-- training-attendance/
        |-- tournaments/
        |-- matches-results/
        |-- announcements/
        |-- notifications/
        `-- reports/
```

Related repository directories:

- [`database/migrations/`](../database/migrations/): future ordered schema changes.
- [`database/seeds/`](../database/seeds/): future safe reference/development data.
- [`docs/`](../docs/): future requirements, ERD/architecture notes, contracts, and test evidence.

These directories currently contain placeholders only. Controller/service names discussed in planning are suggestions, not existing files or a fixed framework structure.

## Ownership and responsibilities

| Area | Backend owner | Planned functionality | Frontend partner |
| --- | --- | --- | --- |
| Authentication/users | Mukilan | Registration, login/logout, profiles, user management, role checks | Mukilan |
| Sports/clubs | Looga | Listings, details, search, validated CRUD, historical-record handling | Shahilan |
| Memberships | Jassim | Applications, status, review decisions, membership records | Sanudi |
| Facilities | Mursid | Resource CRUD and permitted availability information | Sanudi |
| Equipment | Mursid | Equipment/stock CRUD and quantity validation | Sanudi |
| Bookings | Mursid | Requests, ownership, cancellation, review, conflict and inventory checks | Sanudi: Student; Mursid: Admin |
| Training/attendance | Looga | Sessions, schedules, attendance records, eligibility checks | Shahilan |
| Tournaments | Jassim | Tournament lifecycle, eligible entries, fixtures according to approved rules | Shahadh |
| Matches/results | Jassim | Matches, result recording/correction, agreed standings logic | Shahadh |
| Announcements | Shahilan | Validated CRUD/publication and audience restrictions | Shahilan |
| Notifications | Nimesha | Recipient access, read updates, notification generation integration | Nimesha |
| Reports | Nimesha | Scoped history/report queries, agreed filters and totals | Nimesha |

### Shared backend ownership

- **Mukilan:** public entry/routing integration, authentication, role/ownership enforcement conventions, sessions, and CSRF helpers.
- **Jassim:** architecture, database configuration/access, initial schema, response/validation conventions, and transaction review.
- **Module owners:** module handlers, business validation, and tests; use the agreed shared helpers.
- **Nimesha:** overall QA coordination; each owner still tests their implementation.

Looga should start with one reviewed CRUD slice. Mursid should implement resource CRUD before complex booking rules. Jassim/Mukilan provide review support without taking away module ownership.

## Database state and coordination

**No database tables, relationships, database name, connection settings, or SQL import files are currently defined in this repository.** An external/local database has not been verified.

Jassim leads the ERD and initial schema, with review from Mukilan and the relevant module owners. The model must cover identity/roles, clubs/memberships, resources/bookings, training/attendance, competition participation/results, and communications as required.

Before a database-dependent implementation:

1. Agree on entities, names, fields, relationships, and identifiers.
2. Define required/optional values, uniqueness, foreign keys, status values, and delete/archive behavior.
3. Define transaction boundaries and cross-record business rules.
4. Agree on time storage/display and any date-only fields.
5. Coordinate an ordered migration and safe seed data.

Do not create independent competing schemas or infer table names from module folders. Module owners propose changes; Jassim coordinates migration numbering/order and reviews consistency. Once a migration has been shared/applied, add a new migration for subsequent changes rather than silently changing its history.

No seed credentials or default application accounts exist. Initial Admin/staff provisioning, registration verification, and development account creation must be agreed and documented securely.

## Planned backend conventions

Agree on and document the following before integrating handlers:

- Public entry point and routing rules.
- Request paths/methods, field types, validation, and list/filter behavior.
- Consistent success/error response shapes and appropriate HTTP statuses.
- Session behavior, authorization checks, and CSRF requirements.
- Configuration loading, logging, and safe exception handling.
- Database connection, prepared query, and transaction conventions.

The facilities/equipment/booking contract is documented in [`docs/resource-booking-api.md`](../docs/resource-booking-api.md). The first migration is [`database/migrations/001_resources_and_bookings.sql`](../database/migrations/001_resources_and_bookings.sql). Configure the web server to expose only `backend/public/`; keep credentials outside the public directory and out of Git.

### Resource and booking API (initial implementation)

- PHP entry point: `backend/public/index.php`; requires PHP 8.1+, `pdo_mysql`, `mbstring`, and MySQL 8.0.16+.
- Database environment: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- The existing authentication owner must provide `$_SESSION['user']` with integer `id` and `role` (`Student` or `Admin`). Mutating requests require `X-CSRF-Token`; retrieve it from `GET /api/session`.
- Import `database/migrations/001_resources_and_bookings.sql` before running the API.
- CRUD routes are listed in the API contract. `DELETE` archives resources and cancels bookings to retain history.
- Local PHP lint/testing could not be run in the current workspace because PHP is not installed. Partner must validate the migration and endpoint behavior under the agreed XAMPP versions before merge.

## Security requirements

- Hash passwords using PHP's password APIs and verify hashes on login. Never store or return plaintext passwords.
- Check authenticated identity, active status, role, record ownership, and applicable club scope on the server for protected operations.
- Define session renewal, expiry, logout, cookie settings, and CSRF protection for cookie-authenticated writes.
- Derive identity and approval authority from authenticated server state, not browser-submitted role/user fields.
- Validate types, identifiers, lengths, dates, quantities, and permitted state changes server-side.
- Use prepared statements for values and allowlists for dynamic query parts such as sort columns.
- Keep credentials, password hashes, session secrets, database errors, and stack traces out of client responses.
- Preserve historical records through agreed archive/status rules where deletion would lose participation or approval history.
- Establish appropriate ignore rules before introducing local configuration, dependencies, logs, or generated files.

Student and Admin interfaces do not replace server authorization. Coach permissions require explicit agreement; a Coach label does not imply Admin access or access to every club.

## Business rules requiring agreement and testing

| Area | Required decisions/checks |
| --- | --- |
| Memberships | Eligibility, duplicates/reapplication, review authority, status transitions, self-review restrictions |
| Facilities/bookings | Personal/club ownership, approval rules, overlap boundaries, cancellations, opening hours |
| Equipment | Quantity versus individual-item tracking, concurrent availability, stock changes, issue/return requirements |
| Training/attendance | Eligible participants, coach scope, duplicate attendance, session/facility consistency |
| Competitions | Individual/team/club entrants, tournament formats, fixture rules, sport-specific results, corrections and standings |
| Announcements/notifications | Audience/recipient derivation, publication rules, read ownership, delivery expectations |
| History/reports | Participation definition, included statuses, date filters, totals, visibility, export requirements |

Foreign keys alone cannot prevent overlapping reservations or aggregate equipment overbooking. Booking services require an agreed transactional locking/checking strategy and concurrent-request tests, reviewed with Jassim. Similar multi-record operations must commit or fail consistently.

## Local setup and run status

The Facilities/Equipment/Bookings API can be started after importing its migration, configuring its database environment variables, and integrating the existing authentication session. Merely enabling Apache/MySQL in XAMPP does not create the database or provision the authentication session.

The initial implementation prerequisites are documented in [`docs/resource-booking-api.md`](../docs/resource-booking-api.md). Other modules still need their own setup and contracts. Before integration:

1. Supported PHP/database versions and required extensions.
2. Safe configuration examples, local secret exclusions, and the agreed database name/account permissions.
3. Database creation, migration/seed import order, and verification steps.
4. Exact XAMPP document root, local URL, rewrite/routing configuration, and frontend integration settings.
5. Startup, syntax-check, test, and troubleshooting commands.
6. Initial user provisioning and deployment-specific configuration.

No server configuration, database, or application account is created by this README. Local/deployed configuration changes should be performed as explicit implementation/deployment tasks. PHP syntax and database-backed behavior still need to be verified in the target environment.

## Review and testing expectations

Use a scoped branch such as `feat/looga-club-backend`. Include affected contracts/tables, dependencies, setup changes, and test evidence in each PR. Coordinate schema and shared-file edits before changing them.

Check, as applicable:

- Valid and invalid requests, malformed identifiers, missing records, and duplicate submissions.
- Direct unauthorized requests, cross-user access, role escalation, and CSRF rejection.
- CRUD persistence, foreign keys/uniqueness, history preservation, and transaction rollback.
- Adjacent/overlapping bookings, simultaneous approvals, stock limits, and cancellation.
- Attendance eligibility/duplicates, competition calculations, report totals, and notification ownership.
- Frontend integration and behavior after refreshing/reloading records.
- Operation against the agreed MySQL/XAMPP engine and deployed configuration.

No test suite exists yet. Add meaningful checks with the relevant implementation, and report exactly what was tested. Jassim reviews database/transaction correctness; Mukilan reviews auth/integration; Nimesha coordinates regression evidence.

## Deadlines

All dates are in **2026**. Detailed member targets are in the [project schedule](../README.md#delivery-schedule).

- **6 November:** implementation, integration, reviews, and merges complete.
- **7-9 November:** system testing, bug fixes, and regression.
- **10 November:** deployment and deployed-system verification.
- **11 November:** final acceptance, documentation, backup, and demo rehearsal; submission package ready.
- **12 November:** assignment submission.

Test each task during development. The reserved five days, 7-11 November, are for verification, fixes, and deployment rather than starting new features.
