# Project completion checklist - 7 November 2026

The agreed core modules are implemented: accounts, clubs, memberships and coach assignments, facilities/equipment/bookings, training/attendance, competitions/results, announcements, notifications and participation reports. Final completion still depends on deployment acceptance and the official assignment requirements.

## Integration and local checks

- [x] Save the completed workflows, notification/report modules, Railway configuration and attendance-history fix in Git.
- [x] Integrate GitHub main's booking approval changes and independent-process concurrency tests.
- [x] Keep one Admin booking route with search, status filters, paging, approval/rejection and cancellation; refresh after a conflict.
- [x] Pass the production build, 10 frontend tests, 34 configuration checks, 78 real PHP/database scenarios, five Railway public-layout smoke groups and PHP/shell syntax checks.
- [x] Pass all 11 production-build browser workflow groups against real PHP/MySQL using Microsoft Edge.
- [ ] Merge and publish the verified result to GitHub `main`.

## Remaining work to finish today

| Priority | Task | Completion evidence |
| --- | --- | --- |
| 1 | Deploy the main branch to Railway with a web service and MySQL persistent volume | Successful Docker image build/startup, database migrations, healthy public `/api/health`, and recorded deployed commit/URL |
| 2 | Configure production variables and provision the first hosted Admin | Private application key/database variables, secure session cookies, successful Admin login; follow [Railway deployment](deployment-railway.md) |
| 3 | Run hosted Student/Admin/coach acceptance | Sign-in, membership approval, coach assignment/revocation, training/attendance, booking approval/conflicts, competitions/results, announcements, inbox and report totals; direct deep links and mobile layouts also pass |
| 4 | Confirm the official assessment requirements | Check the actual brief/rubric, React permission, required report/export formats, exact submission platform/time and each member's required evidence; record any mandatory gaps |
| 5 | Prepare the final handover/submission package | Current setup/deployment instructions, ERD, test evidence and screenshots, source revision, safe database backup/export if required, and a tested restore/setup path |
| 6 | Rehearse the demo and submit | Demonstrate the complete Student/Admin/coach flows using synthetic data; each member can explain their actual contribution; retain submission confirmation |

Work through priorities 1-3 first for a hosted release, then 4-6 for assignment readiness. Do not add optional features unless the brief requires them. The repository records submission on 12 November 2026; today's target is early completion.

Hosting was deferred in the previous development-only scope. Local layout smoke tests do not build Docker or execute Apache, and cannot establish Railway HTTPS/database/persistence acceptance. This workstation has no Docker or Railway CLI available at review time. No cloud deployment or assignment submission is claimed here.

Keep credentials, personal records, session files, local `.env`, portable tools and generated dependencies out of the submission. Use the [QA guide](qa-checklist.md) to reproduce local checks.
