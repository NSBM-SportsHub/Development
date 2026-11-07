# Mukilan's personal tech-lead guide

> **Latest implementation update - 5 November 2026:** `feat/mukilan-complete-workflows` completes the connected club/training/attendance interfaces, booking review/editing and coach management/review, on top of notifications/reports. The production build, 74 backend scenarios, 10 frontend tests, 34 configuration checks and 11 browser workflow groups passed. Use [current QA evidence](final-integration-review.md) and [Railway setup](deployment-railway.md). Live deployment remains to be provisioned and verified; older plans below are background.

**Project:** NSBM SportsHub. **Prepared:** 29 October 2026, Sri Lanka time. **Audience:** Mukilan, the student team lead and repository owner.

This is your working guide for coordinating the project. Follow it in order, then use the daily checklists. It describes current code separately from proposed work. The lecturer's assignment brief determines assessed requirements; this guide cannot replace that brief.

## Contents

1. [Your first actions](#1-your-first-actions)
2. [What is already available](#2-what-is-already-available)
3. [Confirm requirements and open decisions](#3-confirm-requirements-and-open-decisions)
4. [What belongs in main](#4-what-belongs-in-main)
5. [Database structure, records, and demo data](#5-database-structure-records-and-demo-data)
6. [One shared application and API contract](#6-one-shared-application-and-api-contract)
7. [Exactly what each member owns](#7-exactly-what-each-member-owns)
8. [Order of implementation and integration](#8-order-of-implementation-and-integration)
9. [Give members small, testable tasks](#9-give-members-small-testable-tasks)
10. [Finish your current local changes](#10-finish-your-current-local-changes)
11. [Branch and pull-request workflow](#11-branch-and-pull-request-workflow)
12. [Review code and resolve conflicts](#12-review-code-and-resolve-conflicts)
13. [Test every module](#13-test-every-module)
14. [Run the project and diagnose failures](#14-run-the-project-and-diagnose-failures)
15. [Daily coordination and messages](#15-daily-coordination-and-messages)
16. [Schedule and delays](#16-schedule-and-delays)
17. [Deploy the application](#17-deploy-the-application)
18. [Prepare the demonstration and submission](#18-prepare-the-demonstration-and-submission)
19. [Your final owner checklist](#19-your-final-owner-checklist)

## 1. Your first actions

Your lead responsibilities are to keep ownership clear, remove blockers, maintain a working combined application, and make evidence-based merge decisions. You also implement your assigned authentication/users work. Each member remains responsible for their own implementation and contribution history.

Work toward these three outcomes first:

1. **Review the verified foundation.** Persistent `.env` support and Jassim's membership/competition APIs are already present. Review this branch's shared-client and setup changes, then browser-check your account workflows. Have teammates demonstrate startup using the updated local setup guide.
2. **Unblock the remaining integrations.** Confirm ownership and readiness of the Natheeshan club backend branch with Looga. Coordinate its schema/router/session/CSRF integration with Jassim and agree the client contract with Shahilan.
3. **Integrate each ready interface.** Sanudi can use the membership/resource/booking APIs; Shahadh can use the competition APIs now. Review their PRs as they arrive. Clubs, training and announcements remain previews until their PHP/database workflows replace demo data.

Keep the dependency table in [the integration review](mukilan-integration-review.md) current with branch/PR links and demonstrated deliverables. It is not a claim about work outside this checkout.

## 2. What is already available

Snapshot from the local repository inspection and verification on 30 October:

| Item | Verified position | Your next action |
| --- | --- | --- |
| Authentication/users | React/PHP account workflows are integrated and automated HTTP checks pass | Browser-check forms, session redirects, mobile layout and failure feedback |
| Your branch | `feat/mukilan-module-integration`, based on `main` at `6a0a7ec` | Review shared-client/setup changes; see section 10 |
| Persistent `.env` support | Integrated; 31 configuration checks pass | Preserve private settings and use the updated setup guide |
| Resource/booking backend | Integrated and tested; interfaces pending | Sanudi implements Student screens; Mursid implements Admin review |
| Membership/competition backend | Integrated with contracts, migrations and passing HTTP checks | Sanudi and Shahadh implement their assigned interfaces |
| Shahilan frontend | Club/training/announcement screens are integrated previews | Replace local demo data with agreed PHP APIs |
| Club backend contribution | Cached branch `origin/feat/natheeshan-club-backend` contains PHP module code | Confirm its author/owner, schema, setup and foundation integration |
| Other members' progress | Their current working state has not been established by this guide | Ask for branch/PR links and a demonstrated next deliverable |
| Coach scope | Student/Admin account roles plus active club coach assignments for membership/competition permissions | Implement required interfaces and agree remaining training permissions |

The README assigns club/training backend to **Looga**. The relationship between Looga and the **Natheeshan-named branch is unconfirmed**. Ask the author rather than treating the names as interchangeable.

Current verification passed: 31 configuration checks, 53 combined HTTP/database scenarios, 7 frontend tests, 29 PHP syntax checks and the production build. The combined suite exercises authentication/users, resources/bookings, memberships and competitions. Historical browser checks were recorded in the authentication review; they were not rerun in this pass. These results do not certify pending interfaces or deployment.

## 3. Confirm requirements and open decisions

Create a requirements checklist from the actual assignment brief. For each requirement record its source, owner, acceptance demonstration, and status. Confirm these with the lecturer or assignment material where needed:

| Decision | What you need to establish | People involved |
| --- | --- | --- |
| Assessed scope | Required modules and exact Student/Admin/Coach workflows | You and the team, using the lecturer's brief |
| Technology | React/framework permission; whether the MySQL requirement allows the current MariaDB development setup | You and Jassim |
| Coach permissions | Assigned clubs, allowed records, attendance/session actions and report scope | You, Jassim, Looga, Shahilan and affected owners |
| Membership rules | Eligibility, duplicates, reapplication, review authority and allowed status changes | Jassim and Sanudi |
| Booking rules | Personal/club ownership, overlap boundaries, pending availability, stock limits and cancellations | Mursid and Sanudi; Jassim reviews transactions |
| Training rules | Eligible roster, attendance states/corrections, facility reservation dependency | Looga and Shahilan, with relevant partners |
| Competition rules | Individual/team/club entrants, format, eligibility, scoring, ties, corrections and standings | Jassim and Shahadh |
| Communications | Announcement audiences/publishers and notification triggers/recipients | Shahilan and Nimesha |
| Reports | Definition of participation, included statuses, date filters, totals and any required export | Nimesha and source-module owners |
| Delivery | Hosting capabilities, exact submission time/platform, report/video/demo requirements | You, checked against the assignment brief |

Record unanswered items as **TBD**, name the decision owner, and set a decision time. Members can continue independent work while their dependent rule is being resolved. Use agreed sample responses for early frontend work, clearly marked as development fixtures.

Current coach permissions use active `club_coaches` assignments, not a new account-role enum. Membership and competition APIs enforce club/sport scope and self-review restrictions; their access tests pass. Dedicated coach navigation and training permissions still require implementation. Password recovery, email verification, external email/SMS and report export remain separate scope decisions; do not promise them without confirming requirements.

## 4. What belongs in main

`main` is the team's reviewed, reproducible integrated version. Your personal computer's runtime data is separate from this source code. A teammate should be able to obtain `main`, follow the README, configure their own database, and run the documented features.

| Include in reviewed main | Purpose / owner |
| --- | --- |
| README with requirements, owners and run instructions | Shared starting point; you maintain integration accuracy |
| React entry, routing and shared API/session client | One application; you coordinate integration |
| Shared layout, controls and styling conventions | Shahadh coordinates; preserve existing auth usability |
| PHP public router and shared session/CSRF helpers | You coordinate application entry and permission conventions |
| Shared PDO, validation and JSON response conventions | Jassim reviews architecture with you; module owners reuse them |
| `frontend/package.json` and `package-lock.json` | Reproducible frontend dependencies |
| `backend/.env.example` and safe config defaults | Shows required settings without real keys/passwords |
| Ordered SQL migrations and safe development seed scripts | Reproducible database; Jassim coordinates numbering/relationships |
| Module code, agreed API contracts and meaningful checks | Each assigned frontend/backend owner |
| Setup notes, test evidence and known limitations | Author supplies; reviewer verifies relevant behavior |

Keep these local or in the appropriate private runtime/deployment storage:

- Real `.env`, database credentials, application keys, passwords and session files.
- `node_modules/`, generated build output, caches and logs.
- `.tools/`, portable database executables/data directories and `.artifacts/`.
- Personal student information, real user records and unsanitized database dumps.

Production build output is created for deployment as an artifact; it does not need to be committed to the source branch. Public examples should use fictional data. Keep secrets out of screenshots, issue text, PR descriptions and frontend `VITE_*` configuration too.

Before a shared-file change, identify the owner and explain why it is needed. For example, Looga adds club handlers while you coordinate their registration in the existing API router. He should not need a separate application login/router/configuration system for that module.

## 5. Database structure, records, and demo data

### 5.1 Understand the three kinds of data

| Kind | Example | Where it belongs |
| --- | --- | --- |
| Schema | A `users` table, foreign key, uniqueness rule or index | Reviewed migration SQL in Git |
| Development/demo data | Fictional sports, clubs and resources for repeatable demonstrations | Reviewed seed SQL/script if useful, clearly labelled |
| Runtime records | A submitted membership, booking, user profile or attendance record | The database created by the running application |

The current local configuration targets `nsbm_sportshub` on `127.0.0.1:3307`, using portable MariaDB. PHP connects through PDO's MySQL driver. Confirm compatibility with the assessed database requirement. Other machines may use a different local port, such as XAMPP's 3306, while following the same agreed schema.

Each teammate can have their **own local database instance**. Share schema migrations and contracts so those instances are compatible. `localhost` always refers to the computer making the request; it is not a team-wide hosted service.

### 5.2 What to settle with Jassim

Ask Jassim to review the existing identity migration and produce an agreed ERD/data dictionary for the remaining modules. Record:

- Table/column names, field meanings and types; required versus nullable values.
- Primary keys, foreign keys, uniqueness and indexes.
- Allowed statuses and valid transitions; who can perform each transition.
- Which records must be archived to preserve history.
- Which operations must commit together in a transaction.
- Ordered migration dependencies and how to apply/verify them.
- UTC timestamp storage and the agreed display timezone; keep date-only fields distinct from timestamps.

The existing `users.id` is `BIGINT UNSIGNED`. New references to it need matching compatible types. Current identity fields include name, email, password hash, role, active status, phone, student ID, timestamps and session-version/deletion internals. Reuse this identity instead of creating a second unrelated users table.

Candidate entities for discussion include clubs/sports, memberships, facilities, equipment, bookings, training sessions, attendance, tournaments/entries/matches/results, announcements and notifications. These are **design topics**, not permission to invent final table names or create all tables independently.

The current `backend/bin/setup.php` applies all numbered migration SQL files in order and refuses duplicate migration numbers. Migrations 001–006 cover users, resources/bookings, sports/clubs, memberships/coach assignments and competitions. `--seed` adds reference sports and demo clubs. Repeated setup preserves records and checks compatibility; it does not silently upgrade incompatible existing tables. Coordinate each new migration with Jassim.

Once a migration is shared/applied, make subsequent changes through new migrations. Changing Git branches or reverting code does not undo database changes. Plan corrective migrations and backups separately.

### 5.3 Safe demonstration records

Agree small fictional datasets with the relevant owners: a few sports/clubs, resources with known quantities, sessions and competition examples where required. Use these to calculate expected results and reproduce bugs. Avoid a large dataset that hides whether a workflow is correct.

Provision Admin credentials privately through the CLI. Do not seed a known shared Admin password in Git. Public registration creates a Student. Existing user DELETE behavior archives the account, reserves its identifiers, and invalidates its sessions.

## 6. One shared application and API contract

The intended path is:

```text
React screen -> shared API client -> PHP route/handler -> database
React screen <- JSON response    <- PHP result       <- saved/query data
```

Agree one API convention even though different people implement the handlers. Browser code calls `/api/...`; Vite forwards development requests to PHP at `127.0.0.1:8000`. Database port 3307 is for PHP/database clients, not browser API requests. Module screens do not connect directly to MySQL.

Current working frontend routes include `/login`, `/register`, `/profile` and `/admin/users`. Current implemented API routes are documented in [auth-users-api.md](auth-users-api.md). A proposed club, membership or booking URL becomes usable only after its handler is implemented, configured and integrated.

### 6.1 What every frontend/backend pair must agree

Copy this template into the relevant module's contract document:

```text
Module / workflow:
Frontend owner:
Backend owner:
Contract status: proposed / agreed / implemented / tested
Method and endpoint:
Purpose:
Signed-in role, record ownership and club scope:
Request query/body fields, types, required values and limits:
Successful response fields and HTTP status:
Validation and permission errors:
List filtering/pagination/sorting:
Database relationships / required migration:
Allowed status transitions and history behavior:
Example request and response using fictional data:
Checks both partners will demonstrate:
Date and people who agreed the contract:
```

For example, `GET /api/clubs` is a sensible **proposed** list endpoint. Looga and Shahilan must still agree its fields, search behavior, pagination and visibility. That name alone does not specify a complete implementation.

### 6.2 Reuse the existing foundation

- Success envelope: `{ "data": ..., "error": null }`.
- Error envelope: `{ "data": null, "error": { "code": "...", "message": "...", "fields": {} } }`.
- Every POST/PATCH/DELETE uses a JSON object and valid CSRF token, including bodyless actions represented by `{}`.
- The shared client obtains the session/CSRF token and sends cookies. Keep auth/session logic there.
- PHP derives identity and permissions from the session. A submitted `user_id`, `role` or `is_admin` must not grant access.
- Use `Config::all()` and `Database::get()` for the shared connection. The `.env` loader does not inject values into `getenv()` for separate module code.
- User ownership, club scope and audience filtering need server enforcement, in addition to visible UI controls.

Inspect existing helper signatures before reusing them; a module's specific ownership checks still need implementation. Do not expose password hashes, app keys, database details or stack traces in API responses.

## 7. Exactly what each member owns

The allocation below comes from the project README. A reviewer helps verify a contribution; that does not transfer the implementation task to the reviewer.

### Mukilan: your implementation and coordination

- Own authentication/users frontend and backend, entry/routing integration, shared API client, session/CSRF and auth conventions.
- Maintain the current login/profile/Admin workflows as other modules integrate.
- Coordinate schema/database helper review with Jassim and shared UI with Shahadh.
- Keep task status, dependencies, review decisions, release/deployment and demonstration readiness visible.
- Ask for small working contributions; bring blockers to the correct partner.
- Check the actual brief, roles, final hosting and submission requirements.

Your next deliverable is the `.env` follow-up PR and a shared setup demonstration. After that, coordinate the first club integration rather than taking over every owner's CRUD.

### Jassim: database architecture and three backend areas

- Own memberships, tournaments, and matches/results backend.
- Coordinate the ERD, schema/foreign keys, migration sequence, PDO access and response/validation conventions with you.
- Pair memberships with Sanudi and competitions/results with Shahadh.
- Agree duplicate/reapplication/review rules for memberships and the actual competition format/scoring rules.
- Supply migrations, request/response examples, validation/permission handling and transaction checks where operations affect multiple records.

Ask him first for the identity/club/membership schema review and a concrete next API slice. His database work is a dependency for several other members; make its decision dates visible.

### Shahadh: shared presentation and competition interfaces

- Own layouts, navigation, reusable controls, responsive conventions, and tournament/fixture/match/result screens.
- Pair business screens with Jassim's API contracts.
- Agree shared shell changes with you, preserving the auth provider and protected routes.
- Review Shahilan's global styling/select controls for compatibility with the combined application.
- Demonstrate real data, loading/empty/error states, keyboard use and mobile layouts.

Ask him for a small shared presentation decision first, then the first API-connected competition screen. Keep styling scope controlled while business workflows are being connected.

### Shahilan: club/training interfaces and announcements

- Own clubs and training/attendance frontend, paired with Looga's documented backend responsibility.
- Own announcements frontend and backend.
- Replace module fixtures/localStorage with the shared API and agreed database identifiers.
- Coordinate navigation/global CSS with Shahadh and route/session integration with you.
- Agree announcement publishing and audience restrictions; coordinate notification events with Nimesha if required.

Ask first for a database-backed club list/details/create demonstration with the backend partner. His separate screen branch needs integration work before its appearance can count as a completed system workflow.

### Looga: club and training/attendance backend

- Own club/sports and training/attendance PHP APIs.
- Pair contracts and integration with Shahilan.
- Obtain Jassim's schema/migration review and coordinate permission/CSRF routing with you.
- Agree eligible attendance participants with the membership owner; coordinate facility reservation dependencies with Mursid if required.
- Supply missing-record handling, duplicate attendance protection, archive/history decisions, and persisted workflow tests.

Confirm whether he is responsible for the existing Natheeshan-named backend branch. Ask for its exact branch/PR, required SQL migration, and setup demonstration.

### Mursid: resources, booking backend and Admin booking UI

- Own facilities, equipment and booking backend; own the Admin booking interface.
- Pair resource listings and Student booking screens with Sanudi.
- Complete resource CRUD before implementing rules that depend on availability.
- Agree booking ownership, states, time boundaries, stock limits and cancellation rules.
- Implement atomic checks/transactions so competing requests cannot double-book a facility or over-reserve equipment. Jassim reviews this strategy.
- Coordinate any training reservation dependency with Looga and source events/history with Nimesha.

Ask first for resource CRUD with migrations and API examples, then one request/approval workflow including an availability-conflict test.

### Nimesha: notifications/reports and QA coordination

Implementation update: Mukilan covers the notifications/reports code on `feat/mukilan-notifications-reports`. See the [implemented contract and checks](notifications-reports-api.md). Nimesha’s separate individual coding contribution remains to be agreed; the original allocation follows for context.

- Own notification, personal participation history and report frontend/backend.
- Obtain the meaning of source events, statuses, participation and dates from each module owner.
- Implement recipient/read ownership and scoped report queries. Report totals must match known source records.
- Coordinate regression cases, evidence and bug tracking while each developer tests their own module.

Ask first for a short test checklist and agreed report/notification contracts. Their final correctness depends on real source workflows. Reports mainly need queries and filters; create/edit/delete screens are useful only when an actual report-related record requires them.

### Sanudi: Student-facing membership/resource/booking screens

- Own membership, facility/equipment and Student booking interfaces.
- Pair membership with Jassim and resources/bookings with Mursid.
- Agree status/action contracts so buttons match permitted server operations.
- Keep failed inputs available, prevent repeated submissions, show loading/empty/error states and verify reload persistence.
- Check mobile/keyboard use and clear feedback.

Ask first for membership application/status or a resource listing connected to its agreed endpoint, depending on which backend slice is ready. Mursid retains the Admin booking interface.

## 8. Order of implementation and integration

Use this dependency order while letting independent pairs work in parallel:

1. Shared setup, auth/users, roles and API conventions.
2. Schema/contracts for clubs and resources; shared presentation conventions.
3. Clubs and facilities/equipment working through the database.
4. Memberships after users/clubs; bookings after users/resources and agreed availability rules.
5. Training/attendance after their club/user/eligibility dependencies; add facility booking integration only if required.
6. Competitions and results after entrant, format and scoring rules are agreed. Results depend on valid matches/fixtures.
7. Notifications and reports wired to the authoritative source-module events and records. Their contracts/UI can start earlier.
8. Complete cross-module tests, production deployment checks, evidence and rehearsal.

Dependency-specific rules can change this order. Record them explicitly. For example, a training roster may require approved club membership; a facility session may require an approved reservation. Do not invent either requirement from a screen's appearance.

## 9. Give members small, testable tasks

Use a task that a reviewer can demonstrate in a few minutes. Prefer a complete small workflow over a large unspecified phase.

Copy this task format:

```text
Title: Clubs - list and create using the database
Owner / partner: [backend owner] + [frontend owner]
Branch / PR:
Depends on: identity foundation, agreed club schema and API contract
Expected behavior: authorized create, saved listing and reload persistence
Invalid cases: missing name, duplicate if prohibited, unauthorized write
Required artifacts: code, migration/application instructions, contract, checks
Target date/time:
Current blocker / person helping:
Reviewer:
```

Task states: **To do -> In progress -> Review -> Done**. Record a blocker as a separate field so it is visible without pretending work is progressing. Done requires evidence and integration, not just a completion percentage or a commit title such as "Phase 5 Completed".

Have members report their next demonstrable slice, then allocate a target that accounts for dependencies. When a task is blocked, name the missing decision/API/schema and the person who will resolve it.

## 10. Finish your current local changes

**Working folder: repository root, `Development/`.** Current branch: `feat/mukilan-module-integration`. Changes add the missing shared `PUT` helper, API-client tests and current setup/status documentation. No commit, push, PR or deployment has been performed in this pass.

Inspect your state and confirm the real config stays ignored:

```powershell
git status --short --branch
git check-ignore backend/.env
git ls-files backend/.env
```

The ignore check should print the path; the tracked-files check should print nothing. Keep this personal guide local. Review these project files explicitly when preparing your commit:

```powershell
git diff --check
git diff
git add -- README.md backend/README.md frontend/README.md frontend/package.json frontend/src/shared/api.js frontend/src/shared/api.test.js docs/local-development.md docs/mukilan-integration-review.md
git diff --cached --name-only
git diff --cached --check
git diff --cached
```

Review the staged content for the intended scope, examples and secrets. If anything unexpected is staged, use `git restore --staged -- <that-file>` to unstage that specific file while retaining its local contents. Do not force-add the real `.env`.

Checks for this change, **from the repository root**:

```powershell
& ./.tools/php/php.exe backend/tests/configuration.php
$env:SPORTSHUB_PHP = (Resolve-Path .tools/php/php.exe).Path
node backend/tests/integration.mjs
```

The first needs no running database; the second needs the configured MySQL-compatible service running and a database account allowed to create/drop isolated test databases. Its records go into a random `sportshub_test_...` database and are removed afterward. This pass completed 31 configuration checks and 53 combined HTTP/database scenarios. From `frontend/`, `npm.cmd test` passed 7 tests and `npm.cmd run build` passed.

Once checks and staged review are satisfactory:

```powershell
git commit -m "Support result writes in shared API client and refresh integration setup"
git push -u origin feat/mukilan-module-integration
```

After pushing, open [the comparison against main](https://github.com/NSBM-SportsHub/Development/compare/main...feat/mukilan-module-integration?expand=1). Confirm **base main** and the correct compare branch, inspect Files changed, and include the shared-client change, setup impact and actual validation. Jassim should review API/schema descriptions; frontend partners should confirm the client usage.

Keep unrelated module implementation in its owner's branch and PR. This branch prepares the shared integration foundation; it does not complete their interfaces or final deployment.

## 11. Branch and pull-request workflow

### 11.1 Your local main after a merge

Save your intended work on its feature branch and confirm `git status --short` is empty before switching. Then, **from the repository root**:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
```

If the fast-forward fails, inspect the differing commits before proceeding. Keep existing work intact; a failed fast-forward is not a reason to reset or overwrite main.

Start a new task from that updated branch:

```powershell
git switch -c feat/mukilan-task-description
```

Replace the example suffix with the actual task. You can temporary-save unfinished work with a named `git stash push -u -m "..."`; record which stash you created, restore it on the original task branch with `git stash apply`, and inspect before dropping it. Avoid `-a`, which also includes ignored config/tools/data. Committing your intended work first is usually easier for this project.

### 11.2 What a teammate does

After the foundation is merged, a teammate saves their work, checks their working tree, fetches, and merges updated main into their own feature branch. Example for Shahilan, **from his repository root**:

```powershell
git fetch origin
git switch feat/shahilan-club-interface
git merge origin/main
```

Resolve conflicts with the relevant shared-file owner, test, commit if Git requests it, and push that feature branch. Each member authors their own contributions. You review through a PR instead of copying their code into your own files manually.

### 11.3 What every PR should contain

```text
Title: concrete workflow or defect fixed

What a user can now do:
Scope and affected frontend/backend modules:
API contract and permission behavior:
Migration/config changes and exact application order:
Dependencies on other PRs:
Checks performed and results:
Screenshots/demo steps where useful:
Known limitations:
```

Use small PRs and review them promptly. If an open PR receives more commits, recheck the changed content and relevant checks. A PR title or screenshot does not establish that persistence and permission tests passed.

You can inspect your own PR and merge when repository requirements allow. GitHub does not let its author approve their own PR; have another qualified member provide any required independent approval. For your schema/config work, involve Jassim; for shared presentation, involve Shahadh. Observe the repository's actual rules and resolve review feedback before merging.

## 12. Review code and resolve conflicts

### 12.1 Your review sequence

1. Read the task/contract and understand the intended user behavior.
2. Inspect the changed-file list and migration dependencies.
3. Read public routes, permissions, validation, SQL and response handling.
4. Review frontend API use and loading/empty/error/success states.
5. Ask the author to demonstrate the happy path and important failure cases.
6. Test the combined branch against updated main and a compatible database.
7. Record specific feedback, recheck fixes, then merge a ready PR.
8. Update the task tracker and rerun the relevant integrated smoke test.

Read-only comparison commands, **from the repository root after fetching**:

```powershell
git log --oneline origin/main..origin/feat/shahilan-club-interface
git diff --stat origin/main...origin/feat/shahilan-club-interface
git diff origin/main...origin/feat/shahilan-club-interface -- frontend/src/App.jsx
```

To run the latest fetched Shahilan contribution, first save your own work, then update its local review branch from the repository root:

```powershell
git switch feat/shahilan-club-interface
git merge --ff-only origin/feat/shahilan-club-interface
```

Fetching updates remote references; this fast-forward updates the local branch you will run. If it fails because the branch diverged, inspect the local commits before proceeding. Use that branch's setup instructions and return to your own branch after the review.

Change the branch/path for the contribution you are reviewing. Save your own work before checking out a teammate branch to run it. Database contents do not follow Git branch switches, so use the compatible schema and safe test data.

### 12.2 Known integration differences to address

These were inspected in the available teammate branches; they are review items, not proof of runtime completion.

**Club backend contribution:**

- It independently adds `backend/public/index.php` and `backend/src/shared/Database.php`, overlapping the auth foundation.
- Its global `Database::getConnection()` / `DB_DSN`, `DB_USER`, `DB_PASS` convention differs from `SportsHub\Database::get()`, `Config::all()` and `SPORTSHUB_*`.
- Its default database name and JSON `{success,...}` shape differ from the current shared setup/envelope.
- It includes overlapping response/validation helpers. No integrated foundation auth/CSRF checks or SQL migration were found in the inspected branch.
- Have the owner adapt module handlers to the shared router/config/helpers, add server permissions and provide reviewed migrations. Preserve existing login/users routes and their request lifecycle.

**Shahilan frontend contribution:**

- It has its own application entry, routes and `BrowserRouter`; the foundation already supplies one router and `AuthProvider`.
- Integrate module routes and navigation into that application, preserving login/profile/Admin routes and the Vite `/api` proxy.
- Global `glass.css` styling needs reconciliation with shared styles under Shahadh's review.
- Fixture/localStorage services and string club identifiers must be replaced or mapped using the agreed database-backed contract.

### 12.3 Resolve a conflict deliberately

Begin the merge on a clean feature branch. `git status` lists conflicted files. Work with the owner to preserve both required behaviors, remove conflict markers, and stage resolved files. When all conflicts are resolved, use `git merge --continue` and run the relevant checks. If the merge was started cleanly and cannot be resolved yet, `git merge --abort` returns to its pre-merge state.

Do not choose entire versions of shared files merely to remove conflict markers. Keep one React router/provider and one PHP entry point with the complete intended route set. If a package lock conflicts, first agree the combined `frontend/package.json`, regenerate its lock using npm in `frontend/`, and build/check the resulting dependency changes.

If a merged change breaks main, reproduce it, tell the author and relevant owner, and use a corrective fix or reviewed revert PR. A code revert does not reverse SQL or recover data. Jassim plans the database correction/restore. Preserve shared history and avoid destructive resets, cleaning or force pushes as troubleshooting shortcuts.

## 13. Test every module

Every module needs a valid workflow, invalid input, missing/empty records, role/ownership denial, persistence after reload, and a useful failure state. Use separate Student/Admin browser sessions so permissions are visible. If Coach becomes required, add the agreed Coach and club-scope cases.

| Workflow and pair | Minimum useful demonstration | Important additional check |
| --- | --- | --- |
| Auth/users: Mukilan | Register, login/logout, profile/password update; Admin create/search/edit/archive | Email change requires current password; password change revokes another session; login throttling; Student denied Admin API; inactive/archived sessions revoked; duplicate fields; self/last-Admin lockout protection |
| Clubs: Looga + Shahilan | Authorized create/update; Student list/search/details from saved data | Unknown ID, restricted write, empty search, references/history when archiving |
| Memberships: Jassim + Sanudi | Student applies, authorized Admin decides, Student reloads status | Duplicates/reapplication and another Student's record, according to agreed policy |
| Facilities/equipment: Mursid + Sanudi | Admin manages records; Student sees saved resources | Negative quantities, unavailable/archived records and effects on existing reservations |
| Bookings: Mursid + Sanudi | Student request, Admin review, persisted outcome/cancellation | Overlapping or competing approvals cannot exceed facility/stock availability; unauthorized ownership changes denied |
| Training/attendance: Looga + Shahilan | Session schedule, authorized attendance recording and reload | Eligible roster, duplicate records, date order, unauthorized club/session operations |
| Competitions/results: Jassim + Shahadh | Approved entrant/fixture workflow, result recorded and displayed | Invalid scoring/corrections, duplicate result, known hand-calculated standings if required |
| Announcements: Shahilan | Draft/edit/publish and saved permitted-reader display | Other audiences cannot fetch restricted drafts/content directly through the API |
| Notifications/reports: Nimesha | Real event produces intended notification; read state persists; report matches source data | Other users' notifications/reports denied; repeated events and report status/date inclusion checked |

For every form, verify that invalid input is explained, a failed save retains useful input, repeated clicks do not create duplicates, cancellation has no unwanted effect, and mobile/keyboard use remains practical.

Nimesha maintains the regression checklist and bug list; authors fix and test their own contributions. Log a reproducible bug with branch/commit, role, steps, expected/actual result, safe evidence, severity, owner and retest result. Keep credentials and personal records out of bug reports.

A useful integrated smoke test after a merge is: login, profile read, Admin user operation, the newly integrated workflow, refresh persistence and a denied unauthorized action. Broaden checks when shared helpers or dependencies change. A frontend build validates compilation; database/API tests and browser checks establish different parts of correctness.

## 14. Run the project and diagnose failures

Full details are in [local-development.md](local-development.md). Every command below states its working folder. `.tools` exists on Mukilan's machine and is ignored; teammates need their own PHP/database installation or separately prepared tools.

### Database terminal: working folder backend/

For the existing portable local instance:

```powershell
$dbIni = (Resolve-Path ../.tools/db-data/my.ini).Path
& ../.tools/mariadb/mariadb-11.4.13-winx64/bin/mariadbd.exe "--defaults-file=$dbIni" --bind-address=127.0.0.1 --port=3307 --skip-log-bin --innodb-buffer-pool-size=64M --console
```

Leave it running. If your database service is already listening, use that running instance instead of starting a duplicate on the same port.

### PHP terminal: working folder backend/

Once `.env` support is available, a new teammate copies `.env.example` to `.env` **only if they do not already have one**, generates their own key and edits database settings. On this workstation:

```powershell
& ../.tools/php/php.exe -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
```

Paste that output into the private `SPORTSHUB_APP_KEY`. Actual `.env` already exists in your current checkout; preserve it. PHP CLI and HTTP entry points find it independently of the working directory. Process variables take priority over the file, so use a fresh terminal or remove obsolete overrides if saved changes seem ignored.

First-time setup/provisioning, with your own email/password:

```powershell
& ../.tools/php/php.exe bin/setup.php
& ../.tools/php/php.exe bin/create-admin.php
```

Skip initial Admin provisioning if an Admin already exists. No default credentials exist. Then on each run:

```powershell
& ../.tools/php/php.exe -S 127.0.0.1:8000 -t public router.php
```

Teammates with PHP on PATH replace the portable executable with `php`. The backend is PHP; npm installs/starts the frontend tooling.

### Frontend terminal: working folder frontend/

```powershell
npm.cmd ci
npm.cmd run dev
```

Install again when dependency inputs change; otherwise the dev command is enough. Open `http://localhost:5173`. Use the same frontend origin throughout a session. Visit `http://127.0.0.1:8000/api/health` to check PHP/database connectivity.

### Inspect saved records: working folder backend/

```powershell
& ../.tools/mariadb/mariadb-11.4.13-winx64/bin/mariadb.exe --host=127.0.0.1 --port=3307 --user=root --database=nsbm_sportshub
```

This command matches the current isolated local instance. Other accounts need their own connection credentials. In the SQL console:

```sql
SHOW TABLES;
SELECT id, name, email, role, status, deleted_at FROM users ORDER BY id DESC LIMIT 50;
EXIT;
```

### Failure checklist

| Symptom | First checks |
| --- | --- |
| `.tools` path not found | Check terminal folder; from backend use `../.tools`, from root use `./.tools` |
| Connection refused / health unavailable | Database/PHP running? Correct host and ports? Read server-side errors |
| Access denied to database | Private `.env` account/password and permissions match that local server |
| Missing table | Correct database and required migrations applied? Ask the schema owner |
| API 401 | Sign in; check expiry, deactivation, archive and changed-password session revocation |
| API 403 | Check role/ownership/club scope and CSRF error code; do not remove checks to hide the failure |
| CSRF mismatch | Refresh the authoritative session and obtain its current token before an explicit retry |
| API returns HTML / parse error | Check PHP route, Vite proxy and production fallback routing |
| Old values after refresh | Check whether the screen still uses fixtures/localStorage, wrong API target or wrong database |
| Port already in use | Identify the existing service and use it or stop the owned instance; do not kill an unknown process |

Use your own password in the app login form. A database username/password is for the database connection; it is not an application Student/Admin account. Password hashes are not reusable login passwords.

## 15. Daily coordination and messages

### Your daily routine

1. Read the task tracker and identify the biggest shared dependency.
2. Hold a ten-minute check-in: each person states a demonstrated result, next small task, blocker and PR link.
3. Assign the blocker to the relevant decision/API/schema/UI owner and record a resolution target.
4. Reserve focused time for your auth/integration work and a separate PR-review window.
5. Ask partners to demonstrate one connected workflow, then have Nimesha record relevant regression evidence.
6. End the day with an updated tracker, clear next actions and a known working main commit.

### WhatsApp: align the team after the foundation follow-up merges

```text
Hi everyone. The shared authentication/configuration foundation is merged.
Please update your own branches from main and follow the setup guide.
Keep your actual .env private and reuse the shared API/session/database helpers.

Please send your current branch/PR, the next small workflow you can demonstrate,
your frontend/backend partner, and any blocking API/schema decision.
Jassim coordinates migrations, Shahadh coordinates shared presentation,
and I will coordinate routing/auth integration and PR reviews.
Each pair should test saving through PHP and the database, including reload.
```

Use that message only after the stated merge actually happens.

### WhatsApp: request a module handoff

```text
Please send the PR for [specific workflow], its API contract, required migration
and application command, setup changes, checks performed and demo steps.
Please coordinate with [partner] and show the saved result after refresh.
If blocked, state the missing decision/endpoint and who can resolve it.
```

### Feedback that leads to a fix

Use a reproducible observation: "After saving a club and reloading, it disappears because the list reads browser storage. Please connect the service to the agreed PHP endpoint and demonstrate a second browser reading the saved record." Record the issue in the PR and have the author make the correction on their branch.

## 16. Schedule and delays

The repository records **12 November 2026** as submission, with development/integration complete by **6 November**. Confirm the exact submission time and assessed deliverables. The intermediate grouping below is a proposed coordination plan, not a new lecturer deadline:

| Dates | Focus and evidence |
| --- | --- |
| 29 October | Shared setup follow-up, requirements decisions, owner status, schema/club contract |
| 30-31 October | Integrated clubs/resources and first membership slice; check early hosting compatibility |
| 1-3 November | Memberships/bookings/training and approved competition workflows, according to dependencies |
| 4-5 November | Remaining results/communications/report integration, permission checks and defect fixes |
| 6 November | Required functionality integrated, reviewed and merged; main can demonstrate the required workflows |
| 7-9 November | Whole-system testing, concurrent booking checks, fixes and regression |
| 10 November | Final deployment and deployed-workflow verification |
| 11 November | Acceptance, documentation, backup and demo rehearsal; submission package ready |
| 12 November | Submit using the confirmed time/platform and retain confirmation |

Test during development. Prove hosting compatibility early using the smallest running baseline so deployment is not first attempted on 10 November.

When a target slips, ask for the exact blocker and smallest unfinished behavior. Arrange a focused pairing/review, move independent work forward, and update the target openly. Keep assessed requirements visible. Optional enhancements can be deprioritized; changes to mandatory scope need lecturer clarification. Never mark an untested placeholder as completed to make a tracker look on schedule.

## 17. Deploy the application

Before choosing a destination, confirm it supports the required PHP version/extensions, compatible database, HTTPS, private configuration and the React/API routing arrangement. No hosting provider has been selected by this guide.

Your deployment checklist:

- [ ] Identify the target, access owner, runtime versions, domain/URL and database capabilities.
- [ ] Confirm budget/assignment constraints and a way to inspect private server logs.
- [ ] Build frontend assets with `npm.cmd run build` from `frontend/`.
- [ ] Serve the React build and PHP `/api` under one HTTPS origin.
- [ ] Make direct frontend links such as `/profile` load React; keep `/api/*` routed to PHP rather than the HTML fallback.
- [ ] Expose only `backend/public/` for PHP; private config/source/logs/sessions/database directories stay outside the public surface.
- [ ] Set production configuration privately: stable generated key, restricted runtime database account, `SPORTSHUB_ENV=production`, `SPORTSHUB_SESSION_SECURE=1` and correct session storage.
- [ ] Back up relevant existing data and apply reviewed migrations in the documented order using appropriately privileged setup credentials.
- [ ] Provision application Admin access privately; no demo password is published or committed.
- [ ] Verify health, login/logout, CSRF, persistence, permissions, direct frontend links and each required module on the deployed build.
- [ ] Record the deployed commit, URL, migration state, verification results and recovery procedure.

The local PHP built-in server/Vite dev server are development tools. Your workstation's loopback root database account with an empty password is local testing configuration; use dedicated credentials and restricted network access for deployment. A frontend-only static deployment cannot execute these PHP APIs by itself.

Keep a usable database backup and document how to restore it. A code rollback and a database restore/corrective migration are separate operations. Know both before changing a deployed schema.

## 18. Prepare the demonstration and submission

Confirm the lecturer's actual report/video/source/archive requirements. Prepare evidence as you work:

- Requirements checklist, agreed role policies and known limitations.
- ERD/data dictionary, migration/application instructions and safe demo fixtures.
- API contracts and fresh-clone setup instructions.
- PR/review links and each member's authored contribution evidence.
- Test cases/results, bug fixes, screenshots and deployment verification.
- Deployment URL/commit, backup/recovery notes and a repeatable demonstration script.

Plan a demonstration using separate Student/Admin sessions and fictional records. A useful future integrated journey is registration -> club browsing -> membership application/review -> training/attendance -> a permitted resource booking -> relevant announcement/notification -> participation history. Include the approved competition/result workflow if assessed. Adapt the journey to the actual implemented and required policies.

Show at least one validation/permission failure and the saved state after reload. Rehearse using the deployed build, the actual demonstration devices and a plan for connectivity failure. Confirm each member can explain their own code and contribution.

Inspect the submission package before sending it. Include only the required source, docs and safe database artifacts. Exclude real `.env`, credentials, personal records, session/log files, portable data directories and dependency caches. Record submission confirmation before the deadline.

## 19. Your final owner checklist

### Before asking someone to start a task

- [ ] The requirement and owner are clear.
- [ ] The frontend/backend partner is named.
- [ ] Needed schema/API/permission decisions are agreed or explicitly pending.
- [ ] The deliverable is small and can be demonstrated.
- [ ] The target, reviewer and blocker owner are recorded.

### Before merging a PR

- [ ] Base/compare branches and scope are correct.
- [ ] Relevant schema, UI and integration owners have reviewed their areas.
- [ ] Shared routes, auth/session helpers and existing working features are preserved.
- [ ] Migrations, configuration examples and exact setup/application notes are included.
- [ ] Valid/invalid/unauthorized cases and saved data after reload have been checked.
- [ ] No real secrets, personal data, generated dependencies or runtime directories are staged.
- [ ] Relevant checks pass and remaining limitations are honestly recorded.
- [ ] The combined result works with current main; repository merge requirements are satisfied.

### At the end of the day

- [ ] Tracker states, PR links, blockers and next deliverables are current.
- [ ] Every active dependency has an owner and next resolution action.
- [ ] The known working main commit and important test results are recorded.
- [ ] Your own work is saved on the intended branch.
- [ ] Tomorrow's first task is specific.

Your immediate next task is to review this integration branch and browser-check the account baseline. Coordinate the club backend with Jassim, Looga and Shahilan, and review Sanudi's and Shahadh's interfaces against the APIs already available. Full-system acceptance and deployment follow the remaining module integrations.
