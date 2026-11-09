# Project completion checklist - 9 November 2026

The agreed core modules are implemented: accounts, clubs, memberships and coach assignments, facilities/equipment/bookings, training/attendance, competitions/results, announcements, notifications and participation reports. The user explicitly deferred deployment on 9 November. Remaining work in this pass covers local release preparation, evidence and handover.

## Integration and local checks

- [x] Save the completed workflows, notification/report modules, Railway configuration and attendance-history fix in Git.
- [x] Integrate GitHub main's booking approval changes and independent-process concurrency tests.
- [x] Keep one Admin booking route with search, status filters, paging, approval/rejection and cancellation; refresh after a conflict.
- [x] Pass the production build, 10 frontend tests, 34 configuration checks, 78 real PHP/database scenarios, five Railway public-layout smoke groups and PHP/shell syntax checks.
- [x] Pass all 11 production-build browser workflow groups against real PHP/MySQL using Microsoft Edge.
- [x] Merge and publish the verified result to GitHub `main` (integration commit `ecc8887`).

## Local handover completed

- [x] Repeat the production build, 10 frontend tests, 34 configuration checks, 78 real PHP/MySQL scenarios, 11 browser workflow groups, layout checks and PHP/shell syntax checks.
- [x] Capture ten fresh synthetic screenshots and a machine-readable browser report tied to the executable-source fingerprint.
- [x] Rehearse backup/restore in two temporary databases: all 17 tables and every row fingerprint match; schema setup succeeds after restoration; temporary databases are removed.
- [x] Prepare [backup/restore instructions](backup-restore.md), [demo sequence](demo-guide.md), [submission/handover guide](submission-guide.md), and the existing [ERD](database-erd.md)/API/setup documents.
- [x] Add a source packager that excludes ignored private/generated files, requires a reviewed clean commit, verifies evidence fingerprints and emits a manifest/checksums.
- [x] Generate a source ZIP/evidence folder, verify all checksums and private-file exclusions, extract into a clean folder, install locked dependencies, build/test, initialize all 17 tables/13 reference sports and provision the first Admin without local configuration files.
- [x] Pass the ephemeral GitHub Docker/Apache/MySQL image check: [Release checks run 42559574352](https://github.com/NSBM-SportsHub/Development/actions/runs/42559574352) builds the actual image and passes Apache routing/session/private-file acceptance. This is CI testing, not deployment to Railway.

The handover work is on `chore/mukilan-submission-readiness`. GitHub reports existing deployment integrations associated with `main`; leave main unchanged while deployment is deferred. Review those integrations before any later merge/push that may deploy.

## Waiting for the guideline and human acceptance

- [ ] Receive and compare the official project guideline/rubric, including React permission, required exports/report sections, diagrams, exact submission method/time and individual evidence.
- [ ] Add only mandatory gaps established by that guideline and prepare its exact cover sheet/report/file naming.
- [ ] Each member rehearses their own explanation and verifies actual contribution evidence. Automated workflow rehearsal does not certify individual assessment understanding.
- [ ] Submit through the authorized assessment account and retain confirmation. No assignment submission has been performed.

The user offered to upload the project guideline; its contents have not yet been supplied. The repository records 12 November 2026 as submission; the exact official time/platform is unconfirmed.

## Deferred deployment

Railway provisioning, hosted Admin setup, public HTTPS/session checks, authenticated hosted acceptance and redeploy/database-volume persistence are intentionally deferred. When resumed, use [deployment instructions](deployment-railway.md) and `node scripts/verify-deployment.mjs https://YOUR-PUBLIC-ORIGIN`; local or CI checks do not establish hosted acceptance.

Keep credentials, personal records, session files, local `.env`, portable tools and generated dependencies out of the submission. Use the [QA guide](qa-checklist.md) to reproduce local checks.
