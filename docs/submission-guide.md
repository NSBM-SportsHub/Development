# Local handover and submission package

Prepared 9 November 2026. The core application is implemented and the previous main merge is recorded in [development status](development-status.md). Deployment is deferred. The official assignment guideline is still needed to confirm exact assessed deliverables and the submission method; this package does not certify rubric compliance or submission.

Handover changes are prepared on `chore/mukilan-submission-readiness`. Existing GitHub deployment integrations are attached to `main`; this branch allows local release preparation and ephemeral CI tests without pushing main or requesting a cloud application deployment. Before a later merge, review those integrations if deployment must remain deferred.

## What is included

- React frontend, PHP backend, ordered SQL migrations 001-009 and reference/demo seeds.
- Setup, API/security/permission contracts, [database ERD](database-erd.md), [QA instructions](qa-checklist.md), [backup/restore guide](backup-restore.md) and [demo guide](demo-guide.md).
- A source ZIP of the committed Git revision, with a release manifest and SHA-256 checksums.
- Fresh screenshots from synthetic Student/Admin/coach workflows, machine-readable browser and backup/restore evidence and local verification logs.

Local `.env`, database accounts, application keys, sessions, dependencies, portable tools, build caches and real application data are excluded. Install dependencies with `npm ci --prefix frontend` and configure the backend using the examples in [local setup](local-development.md). There are no default Admin credentials; provision the first Admin privately.

## Build the package

From the repository root, after the release checks and reviewed source commit:

```powershell
node scripts/package-submission.mjs
```

The output is `.artifacts/submission-<commit>/`, containing `SportsHub-source.zip`, `manifest.json`, `SHA256SUMS.txt` and `evidence/`. The ZIP opens into `SportsHub/` and contains the committed source. The packager requires a clean working tree, refuses tracked private/generated paths, and checks that browser/restore evidence matches the executable-source fingerprint. It never includes ignored local files in the source archive. Existing release folders are preserved rather than overwritten.

Fresh release logs use `.artifacts/release-{build,frontend,configuration,integration,browser,backup,layout}.log`; these are generated during release verification. The browser report lists each successful workflow group and screenshot. Evidence files are outside the source ZIP so reviewers can inspect source and runtime evidence separately. If the submission system accepts only one file, compress the complete `submission-<commit>` folder after checking the official guideline.

## Acceptance mapping

| Implemented area | Source and documented evidence |
| --- | --- |
| Accounts and access | `frontend/src/modules/authentication-users`, `backend/src/modules/authentication-users`, [auth contract](auth-users-api.md), configuration/integration/browser checks |
| Clubs, coach scope and memberships | Club/membership module folders, [membership contract](memberships-api.md), [sports/training contract](sports-training-api.md), browser assignment/review/revocation evidence |
| Facilities, equipment and bookings | Resource/booking module folders, [booking contract](resource-booking-api.md), independent-process request/edit/approval concurrency tests and browser review evidence |
| Training, attendance and participation | Training/report module folders, [notification/report contract](notifications-reports-api.md), attendance/history/ownership/concurrency and report-total checks |
| Competitions and results | Tournament/match module folders, [competition contract](competitions-api.md), registration/eligibility/fixture/result/standings tests |
| Announcements and inbox | Announcement/notification module folders, persisted announcement/read-state browser evidence |
| Persistence and delivery | [ERD](database-erd.md), ordered migrations, isolated backup/restore rehearsal, Docker build/Apache CI and local setup instructions |

This is an implementation map, not an inferred marking scheme. Check the uploaded guideline for required screenshots, report sections, diagram formats, React permission, report/export fields, contribution evidence, demo duration, exact deadline and final file naming. Record mandatory gaps before declaring the assignment ready.

## Final human handover

1. Extract the source archive into a clean folder and follow the setup guide on the assessor's intended environment. Recheck framework/runtime requirements against the guideline.
2. Review screenshots and the manifest; confirm they contain only synthetic data and match the source fingerprint.
3. Rehearse the [demo sequence](demo-guide.md). Each member verifies their own actual Git contribution and can explain their implementation.
4. Add any required assessment report/cover sheet/declaration and use the official filename and submission platform.
5. Submit through the authorized account and retain the confirmation. No assessment submission has been performed by preparing this package.

When hosting is resumed, follow [Railway deployment](deployment-railway.md) and run `node scripts/verify-deployment.mjs https://YOUR-PUBLIC-ORIGIN` for read-only health/deep-link/session/private-file checks. Repeat the authenticated role workflows and check persistence over a redeploy before recording hosted acceptance.
