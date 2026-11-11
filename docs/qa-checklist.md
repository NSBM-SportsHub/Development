# QA checklist and execution guide

Implementation branch: `feat/mukilan-complete-workflows`, stacked on the notifications/reports branch. Execution and fixes in this pass were performed by Mukilan with coding-agent assistance; this document does not assign that authorship to other members. Current results are in [final integration evidence](final-integration-review.md).

## Automated checks

From the repository root, with MySQL running and private configuration set:

```powershell
npm.cmd ci --prefix frontend
npm.cmd run build --prefix frontend
npm.cmd test --prefix frontend
& ./.tools/php/php.exe backend/tests/configuration.php
$env:SPORTSHUB_PHP = (Resolve-Path .tools/php/php.exe).Path
node backend/tests/integration.mjs
```

Use your installed PHP path on another workstation. Backend integration tests retain a new random `sportshub_test_<16 hex>` database. Booking concurrency uses two separate PHP server processes and distinct account sessions, including on Windows; a single PHP development server would serialize requests and would not demonstrate concurrent database behavior.

## Browser workflow suite

`tests/browser-workflows.mjs` serves the production frontend build with an API proxy to a real PHP server and uses an isolated test database. It creates only synthetic accounts and workflow records, then shuts down its servers/browser and removes its database. Run it from the repository root after building the frontend.

An installed Playwright module and browser are required. This checkout can reuse ignored `.tools/qa/node_modules/playwright`. On another workstation, optionally install browser-test tooling into an ignored location:

```powershell
npm.cmd install --prefix .tools/browser-qa --no-save --package-lock=false playwright
$env:SPORTSHUB_PLAYWRIGHT_PATH = (Resolve-Path .tools/browser-qa/node_modules/playwright/index.mjs).Path
& ./.tools/browser-qa/node_modules/.bin/playwright.cmd install chromium
node tests/browser-workflows.mjs
```

On Windows with Edge already installed, set `$env:SPORTSHUB_BROWSER_CHANNEL = 'msedge'` instead of downloading Chromium. `SPORTSHUB_PHP` selects the PHP executable. Browser screenshots/logs are ignored under `.artifacts/`.

## Regression cases

| Area | Required evidence |
| --- | --- |
| Accounts | Sign-in/out, profile reload persistence, protected-route redirect, field errors; backend password/session revocation and Admin lockout tests |
| Clubs | Admin create/edit/archive; Student read-only controls; database club appears in membership choices; historical records retained |
| Coaches | Admin search/assign/end; coach club selector; permission removal after ending an assignment; account role unchanged |
| Memberships | Student application, coach/Admin approval, duplicate/self-review and other-club denial; retained ended/rejected history |
| Training | Assigned coach creates/edits; other users cannot manage; cancellation preserves history |
| Attendance/reports | Canonical approved participant selection; persisted attendance; Student sees own record; Admin report agrees with source; cancelled attendance excluded from attended totals |
| Bookings | Student create/edit/cancel, Admin approve/reject/cancel, ownership checks, persisted notifications, simultaneous facility/stock/edit conflicts |
| Competitions | Registration, coach entry review, fixture generation, result entry/reload, standings; backend league/knockout/correction coverage |
| Announcements | Admin publication, Student reads, inbox notification, deletion/pinning/backend permissions |
| UI | 390 px layouts, labelled controls, no page runtime errors, loading/empty/error/retry states |


## Issue register

| ID | Finding | Status and evidence |
| --- | --- | --- |
| QA-01 | Club/training/attendance forms wrote browser demo storage | Resolved: connected APIs and production-build browser checks |
| QA-02 | Admin booking-review interface missing | Resolved: `/admin/bookings`, approval and persisted notifications verified |
| QA-03 | Coach assignment and membership-review interfaces missing | Resolved: assignment/review/revocation workflow verified |
| QA-04 | Pending booking editor missing | Resolved: ownership-scoped edit and read-only approved state verified |
| QA-05 | Booking concurrency evidence missing | Verified: independent PHP processes test facility, stock and pending-edit contention |
| QA-06 | Application link for submission | To be supplied and checked by the responsible team member |
| QA-07 | Session club changes could transfer existing attendance visibility | Resolved: recorded-attendance club changes rejected; session locks serialize attendance/move races |

For new issues record the commit, role, steps, expected/actual result, severity, owner, fix and retest result. Use synthetic records and keep credentials/session tokens out of evidence. Each contributor remains responsible for understanding and demonstrating their own work.



## Release evidence and handover - 9 November 2026

`tests/browser-workflows.mjs` now writes `.artifacts/browser-evidence.json` and ten synthetic screenshots while exercising the same 11 workflow groups. Its report includes the executable-source SHA-256 fingerprint; the packager refuses evidence from different source. Passwords/session tokens are not written to that report. Navigation allows 30 seconds for a cold browser start; individual assertions retain their 12-second limit.

Run `node backend/tests/backup-restore.mjs` for the isolated 17-table dump/restore rehearsal described in [backup/restore](backup-restore.md). `.artifacts/backup-restore-evidence.json` records the source fingerprint and successful result. Both generated test databases are removed.

The `Application checks` GitHub workflow repeats frontend, PHP/MySQL, API replay, browser and backup/restore checks. It only tests the application; read its actual run result before claiming acceptance.



After checks and a reviewed source commit, run `node scripts/package-submission.mjs`. See [submission guide](submission-guide.md) for required release log filenames, output files, assessment mapping and the final human checklist.

The supplied guideline is now mapped in [the official review](guideline-review.md). Build the PDF with `python scripts/build-project-report.py` before packaging. The report preserves original supporting files, includes ten application screenshots plus the early design image, and records required missing links/contact/credits explicitly. The packager checks the PDF/source/template hashes and supporting-file checksums. UI/UX inputs can be supplied with `--uiux-root`; verify those files and their credits before finalizing the report. The actual official deadline remains unconfirmed in the PDF.
