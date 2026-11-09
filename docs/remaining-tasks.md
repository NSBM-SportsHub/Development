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

## Official guideline review and final acceptance

- [x] Read all four pages of the supplied official guideline and map Topic 3/general requirements to source and evidence in [the guideline review](guideline-review.md).
- [x] Prepare a PDF report draft with confirmed leader **Mukilan Vasantharaj**, required narrative sections, team allocation, ten application screenshots and design-evolution notes; [editable report source](project-report.md).
- [x] Preserve the team's R&D PDF and original database architecture image unchanged for the complete submission bundle; distinguish source references and original designs from final implementation.
- [x] Prepare the [required video recording plan](video-demonstration.md), including every member's genuine coding, R&D, database, UI/UX or QA contribution.
- [ ] Add the leader's preferred contact details, confirmed member names/actual credits and the supplied UI/UX source/export assets.
- [ ] Record the screen demonstration and every member's own explanation, upload when the team is ready, verify access and put the video link in the report.
- [ ] Add the required working hosted URL after the user resumes deployment, then verify public behavior and access.
- [ ] Each member rehearses their own explanation and verifies actual contribution evidence, including research/design artifacts. Automated workflow rehearsal does not certify individual assessment understanding.
- [ ] Submit through the authorized assessment account and retain confirmation. No assignment submission has been performed.

The official PDF requires a PDF/Word report, live hosted application/link, accessible video/link and team-leader/designated-member submission via LMS/platform. It leaves the deadline **to be confirmed**. The team's 12 November date is a planning record, not verified by this PDF. The user wants the R&D, database architecture and UI/UX work included; available supporting artifacts are preserved, while UI/UX files and some credits/contact details remain pending.

## Deferred deployment

Railway provisioning, hosted Admin setup, public HTTPS/session checks, authenticated hosted acceptance and redeploy/database-volume persistence are intentionally deferred. This is an outstanding **official deliverable**, not an optional requirement. When resumed, use [deployment instructions](deployment-railway.md) and `node scripts/verify-deployment.mjs https://YOUR-PUBLIC-ORIGIN`; local or CI checks do not establish hosted acceptance.

Keep credentials, personal records, session files, local `.env`, portable tools and generated dependencies out of the submission. Use the [QA guide](qa-checklist.md) to reproduce local checks.
