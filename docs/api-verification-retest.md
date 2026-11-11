# Complete API verification — 10 November 2026

Branch: `fix/mukilan-api-database-integration`. Local verification refreshed on 11 November before preparing the pull request. The executable-source fingerprint below identifies the tested files. This is live HTTP verification against PHP 8.4.27 and MariaDB 11.4.13 with PDO MySQL, using the existing router, sessions, CSRF and migrations. MariaDB is the project's supported local MySQL-compatible server; these results do not establish deployment or separate MySQL-server compatibility.

| Checklist operations | Working | Failed | Not tested |
| --- | --- | --- | --- |
| 83 | 83/83 | 0/83 | 0/83 |

Working means a successful operation was asserted against controlled records; write/archive/cancellation behavior was checked through separate PDO reads or independent HTTP reads. Negative authorization/validation checks supplement successful workflows and do not substitute for them. This verifies the specified behaviors and is not a claim of exhaustive coverage of every possible input.

## Confirmed bugs and fixes

1. `DELETE /api/clubs/{id}` was a permanent 409 placeholder, contradicting the API checklist's archival behavior. It now uses the same soft archive as `PATCH /api/clubs/{id}/archive`, returns 200, hides the club from normal reads and preserves membership/attendance history. Admin access and CSRF remain required. Missing/already archived IDs return 404.
2. `GET /api/clubs` ignored all query parameters. An HTTP regression reproduced unrelated clubs appearing for a specific search. The controller now validates and applies `search`, `sport_id` and `status`, with prepared parameters and literal SQL wildcard handling. Invalid/unsupported filters return 422. The approved-membership count remains unchanged.

No other application API defect was found by the completed tests. The first development runs also corrected two test-harness assumptions: announcement lists use `data.announcements`, and clients must refresh their session/CSRF token after password changes as already documented. These were test corrections, not backend product bugs.

## Database findings and changes

The configured working database resolves to `127.0.0.1:3307/nsbm_sportshub`; SQL confirms database `nsbm_sportshub` and server port 3307. It has all 17 expected tables. Migration dependencies are correctly ordered from 001 through 009. Inspection found no missing migration-defined columns or foreign-key names. There was no reason to alter its schema.

All writes in these runs used new randomly named fixture databases on the same local server. Setup 001-009 was applied through `backend/bin/setup.php` only for those fixtures; no migrations were applied to the existing working database. Tests retain their fixture databases and perform no DROP/reset cleanup. Every working table's row count, sorted row fingerprint, column types and schema fingerprint matched before and after each completed runner. No existing records were changed. No production connection or private `.env` edit was used.

The original tester's report establishes `nsbm_sportshub` and missing-table evidence, including missing `notifications`, `sports`, `training_sessions` and `training_attendance`. It does not establish that tester's MySQL host/port, full schema or PHP runtime configuration. That environment and a usable backup of it were unavailable. No repair of that environment is claimed. Follow [Shahilan's reproduction guide](shahilan-api-retesting.md) before applying any migrations there.

The clubs list queries `memberships` for approved-member counts. A missing `memberships` table can therefore fail that query even when `clubs` exists. The current query succeeds and the original 500 was not reproduced; the historical root cause still needs the original error log.

## Executed checks and evidence

- `node backend/tests/integration.mjs`: **163 scenarios passed**, including all 83 checklist operations, 78 unauthenticated-access checks, 48 missing-CSRF checks and 32 Student-denial checks for Admin operations. Assigned Coach membership/entry review, training/attendance scope, self-review denial and permission revocation are also exercised.
- `node backend/tests/api-verification.mjs` with `SPORTSHUB_API_PORT=8001`: **37/37 original cases passed** (15/15 former failures and 22/22 regression cases), plus four supplementary persistence/access/CSRF checks. Original test paths and expected statuses were retained; identities/data were synthetic.
- `php backend/tests/configuration.php`: **34 passed, 0 failed**.
- `npm test` from `frontend/`: **10 API/service contract tests passed**.
- PHP syntax check for the modified controller and Node syntax checks for the new/modified test modules passed. `git diff --check` passed.

The full suite uses independent PHP processes and separate sessions to assert conflicting booking outcomes: concurrent facility/equipment approvals produce exactly one success and one 409, and stored approvals never exceed capacity. It also tests simultaneous requests, pending edits and attendance/session-move races. Report totals, results/standings corrections, empty lists, schema setup repeatability, password/session revocation, owner-only records, archive history, duplicates and invalid input are checked.

Backend log review found **zero unexpected server/database errors**. One expected duplicate-club insert produced a handled PDO 1062 diagnostic and the asserted 409 response. That diagnostic is retained in the private evidence and is not a failed request.

Local evidence (ignored by Git):

- `.artifacts/api-operations-497c6bac8e518edd/results.json` and `results.md`: per-operation expected/actual statuses, result and permission/CSRF checks.
- `.artifacts/api-operations-497c6bac8e518edd/integration.json` and `php-server.log`: all scenarios, source fingerprint, preserved working-database fingerprints and backend diagnostics.
- `.artifacts/api-verification/38dbb28ab393b971/results.json`, `results.md` and `php-server.log`: original 37-case replay and its supplementary checks.
- `.artifacts/pr-api-integration.log`: full integration console output.

The successful full-suite evidence identifies executable source SHA-256 `a75749e7f3f03e1ba99d52f07499a4cf60e8c1685228d47b3dc32d8d460d38dc`. The test databases `sportshub_test_497c6bac8e518edd` and `sportshub_test_38dbb28ab393b971` remain available for local inspection. Earlier incomplete development runs also retained their synthetic databases; none were dropped.

## Results for all 83 operations

| Operation | Expected | Actual | Result | Details |
| --- | --- | --- | --- | --- |
| GET /api/health | 200 | 200 | PASS |  |
| GET /api/auth/session | 200 | 200 | PASS |  |
| POST /api/auth/register | 201 | 201 | PASS |  |
| POST /api/auth/login | 200 | 200 | PASS |  |
| POST /api/auth/logout | 200 | 200 | PASS |  |
| GET /api/users/me | 200 | 200 | PASS |  |
| PATCH /api/users/me | 200 | 200 | PASS |  |
| PATCH /api/users/me/password | 200 | 200 | PASS |  |
| GET /api/users | 200 | 200 | PASS |  |
| POST /api/users | 201 | 201 | PASS |  |
| GET /api/users/{id} | 200 | 200 | PASS |  |
| PATCH /api/users/{id} | 200 | 200 | PASS |  |
| DELETE /api/users/{id} | 200 | 200 | PASS |  |
| GET /api/sports | 200 | 200 | PASS |  |
| GET /api/sports/{id} | 200 | 200 | PASS |  |
| GET /api/clubs | 200 | 200 | PASS |  |
| POST /api/clubs | 201 | 201 | PASS |  |
| GET /api/clubs/{id} | 200 | 200 | PASS |  |
| PUT /api/clubs/{id} | 200 | 200 | PASS |  |
| PATCH /api/clubs/{id} | 200 | 200 | PASS |  |
| DELETE /api/clubs/{id} | 200 | 200 | PASS |  |
| PATCH /api/clubs/{id}/archive | 200 | 200 | PASS |  |
| GET /api/memberships | 200 | 200 | PASS |  |
| POST /api/memberships | 201 | 201 | PASS |  |
| GET /api/memberships/{id} | 200 | 200 | PASS |  |
| PATCH /api/memberships/{id} | 200 | 200 | PASS |  |
| GET /api/club-coaches | 200 | 200 | PASS |  |
| POST /api/club-coaches | 201 | 201 | PASS |  |
| DELETE /api/club-coaches/{id} | 204 | 204 | PASS |  |
| GET /api/training-sessions | 200 | 200 | PASS |  |
| POST /api/training-sessions | 201 | 201 | PASS |  |
| GET /api/training-sessions/{id} | 200 | 200 | PASS |  |
| PUT /api/training-sessions/{id} | 200 | 200 | PASS |  |
| PATCH /api/training-sessions/{id} | 200 | 200 | PASS |  |
| PATCH /api/training-sessions/{id}/cancel | 200 | 200 | PASS |  |
| GET /api/attendance | 200 | 200 | PASS |  |
| POST /api/attendance | 201 | 201 | PASS |  |
| GET /api/attendance/{id} | 200 | 200 | PASS |  |
| GET /api/facilities | 200 | 200 | PASS |  |
| POST /api/facilities | 201 | 201 | PASS |  |
| GET /api/facilities/{id} | 200 | 200 | PASS |  |
| PUT /api/facilities/{id} | 200 | 200 | PASS |  |
| PATCH /api/facilities/{id} | 200 | 200 | PASS |  |
| DELETE /api/facilities/{id} | 204 | 204 | PASS |  |
| GET /api/equipment | 200 | 200 | PASS |  |
| POST /api/equipment | 201 | 201 | PASS |  |
| GET /api/equipment/{id} | 200 | 200 | PASS |  |
| PUT /api/equipment/{id} | 200 | 200 | PASS |  |
| PATCH /api/equipment/{id} | 200 | 200 | PASS |  |
| DELETE /api/equipment/{id} | 204 | 204 | PASS |  |
| GET /api/bookings | 200 | 200 | PASS |  |
| POST /api/bookings | 201 | 201 | PASS |  |
| GET /api/bookings/{id} | 200 | 200 | PASS |  |
| PUT /api/bookings/{id} | 200 | 200 | PASS |  |
| PATCH /api/bookings/{id} | 200 | 200 | PASS |  |
| DELETE /api/bookings/{id} | 204 | 204 | PASS |  |
| GET /api/tournaments | 200 | 200 | PASS |  |
| POST /api/tournaments | 201 | 201 | PASS |  |
| GET /api/tournaments/{id} | 200 | 200 | PASS |  |
| PATCH /api/tournaments/{id} | 200 | 200 | PASS |  |
| DELETE /api/tournaments/{id} | 204 | 204 | PASS |  |
| GET /api/tournaments/{id}/entries | 200 | 200 | PASS |  |
| POST /api/tournaments/{id}/entries | 201 | 201 | PASS |  |
| GET /api/tournaments/{id}/eligible-members | 200 | 200 | PASS |  |
| GET /api/tournament-entries/{id} | 200 | 200 | PASS |  |
| PATCH /api/tournament-entries/{id} | 200 | 200 | PASS |  |
| GET /api/tournaments/{id}/matches | 200 | 200 | PASS |  |
| POST /api/tournaments/{id}/matches | 201 | 201 | PASS |  |
| POST /api/tournaments/{id}/fixtures | 201 | 201 | PASS |  |
| GET /api/tournaments/{id}/standings | 200 | 200 | PASS |  |
| GET /api/matches/{id} | 200 | 200 | PASS |  |
| PATCH /api/matches/{id} | 200 | 200 | PASS |  |
| DELETE /api/matches/{id} | 204 | 204 | PASS |  |
| PUT /api/matches/{id}/result | 200 | 200 | PASS |  |
| GET /api/announcements | 200 | 200 | PASS |  |
| POST /api/announcements | 201 | 201 | PASS |  |
| GET /api/announcements/{uuid} | 200 | 200 | PASS |  |
| PATCH /api/announcements/{uuid} | 200 | 200 | PASS |  |
| DELETE /api/announcements/{uuid} | 200 | 200 | PASS |  |
| GET /api/notifications | 200 | 200 | PASS |  |
| PATCH /api/notifications/{id} | 200 | 200 | PASS |  |
| GET /api/participation/me | 200 | 200 | PASS |  |
| GET /api/reports/participation | 200 | 200 | PASS |  |

## Original 37 manual-report cases replayed through HTTP

These are new automated HTTP results, not a new manual Postman session. The earlier PDF remains the historical manual report.

| Case | Endpoint | Expected | Actual | Result | Details |
| --- | --- | --- | --- | --- | --- |
| T01 | GET /api/health | 200 | 200 | PASS |  |
| T02 | GET /api/auth/session | 200 | 200 | PASS |  |
| T03 | POST /api/auth/login | 200 | 200 | PASS |  |
| T04 | GET /api/users/me | 200 | 200 | PASS |  |
| T05 | GET /api/announcements | 200 | 200 | PASS |  |
| T06 | GET /api/users | 200 | 200 | PASS |  |
| T07 | GET /api/users?search=shahilan | 200 | 200 | PASS |  |
| T08 | GET /api/users?role=student | 200 | 200 | PASS |  |
| T09 | GET /api/users?role=admin | 200 | 200 | PASS |  |
| T10 | GET /api/users?status=active | 200 | 200 | PASS |  |
| T11 | GET /api/users?status=inactive | 200 | 200 | PASS |  |
| T12 | GET /api/users?page=1&per_page=1 | 200 | 200 | PASS |  |
| T13 | GET /api/users?page=2&per_page=1 | 200 | 200 | PASS |  |
| T14 | GET /api/users?page=3&per_page=1 | 200 | 200 | PASS |  |
| T15 | GET /api/users?page=0&per_page=1 | 422 | 422 | PASS | validation_failed: Check the query parameters. |
| T16 | GET /api/users?role=manager | 422 | 422 | PASS | validation_failed: Check the query parameters. |
| T17 | GET /api/users?status=pending | 422 | 422 | PASS | validation_failed: Check the query parameters. |
| T18 | GET /api/users?per_page=0 | 422 | 422 | PASS | validation_failed: Check the query parameters. |
| T19 | GET /api/users/2 | 200 | 200 | PASS |  |
| T20 | GET /api/users/999999 | 404 | 404 | PASS | user_not_found: This user could not be found. |
| T21 | GET /api/users/abc | 404 | 404 | PASS | not_found: This endpoint could not be found. |
| T22 | POST /api/users/2 | 405 | 405 | PASS | method_not_allowed: This request method is not supported. |
| T23 | POST /api/announcements | 201 | 201 | PASS |  |
| T24 | GET /api/notifications | 200 | 200 | PASS |  |
| T25 | GET /api/participation/me | 200 | 200 | PASS |  |
| T26 | GET /api/reports/participation | 200 | 200 | PASS |  |
| T27 | GET /api/facilities | 200 | 200 | PASS |  |
| T28 | GET /api/equipment | 200 | 200 | PASS |  |
| T29 | GET /api/bookings | 200 | 200 | PASS |  |
| T30 | GET /api/memberships | 200 | 200 | PASS |  |
| T31 | GET /api/club-coaches | 200 | 200 | PASS |  |
| T32 | GET /api/tournaments | 200 | 200 | PASS |  |
| T33 | GET /api/matches/999999 | 404 | 404 | PASS | not_found: This match could not be found. |
| T34 | GET /api/sports | 200 | 200 | PASS |  |
| T35 | GET /api/clubs | 200 | 200 | PASS |  |
| T36 | GET /api/training-sessions | 200 | 200 | PASS |  |
| T37 | GET /api/attendance | 200 | 200 | PASS |  |

## Files changed

- `backend/src/modules/sports-clubs/ClubController.php`: implement archival DELETE and validated club filters.
- `backend/tests/api-operations.mjs`: add explicit 83-operation success/permission/CSRF/PDO coverage driven by the existing checklist.
- `backend/tests/api-verification.mjs`: add original 37-case replay and read-only database inspection.
- `backend/tests/integration.mjs`: integrate full coverage, collect evidence, compare working-data fingerprints, detect portable PHP and retain test databases.
- `backend/tests/sports-training.mjs`: update club archival expectations and add DELETE regression checks.
- `.github/workflows/release-checks.yml`: select the provisioned CI database, run the original-case replay and retain API evidence in the workflow artifact.
- `backend/README.md`, `docs/local-development.md`, `docs/sports-training-api.md`: document test execution and corrected API behavior.
- `docs/shahilan-api-retesting.md`, `docs/api-verification-retest.md`: reproduction/backup instructions and this complete result record.

## Remaining limitations and next actions

No checklist operation remains failed or untested in this local verification. There was no new manual Postman/browser workflow run. Shahilan's original environment, its backup and its historical error logs remain unverified; no production/deployment verification was performed. Confirm his actual host/port/schema, verify a backup before any repair, then retest his original API process. Review the pull request and its CI results before merging. Local verification does not establish hosted acceptance.
