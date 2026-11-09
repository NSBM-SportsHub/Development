# Local handover and submission package

Prepared 9 November 2026. The core application is implemented and the previous main merge is recorded in [development status](development-status.md). The [supplied official guideline](guideline-review.md) has now been reviewed. The user wants a combined submission containing the application, R&D, database architecture and UI/UX work. Deployment is deferred; required live/video links, some contact/credit information and UI/UX files remain open. The PDF report is a clearly marked draft, not a submission confirmation.

Handover changes are prepared on `chore/mukilan-submission-readiness`. Existing GitHub deployment integrations are attached to `main`; this branch allows local release preparation and ephemeral CI tests without pushing main or requesting a cloud application deployment. Before a later merge, review those integrations if deployment must remain deferred.

## What is included

- React frontend, PHP backend, ordered SQL migrations 001-009 and reference/demo seeds.
- Setup, API/security/permission contracts, [database ERD](database-erd.md), [QA instructions](qa-checklist.md), [backup/restore guide](backup-restore.md) and [demo guide](demo-guide.md).
- A source ZIP of the committed Git revision, with a release manifest and SHA-256 checksums.
- Fresh screenshots from synthetic Student/Admin/coach workflows, machine-readable browser and backup/restore evidence and local verification logs.
- A PDF project report draft, filled editable Markdown and a report evidence record, naming **Mukilan Vasantharaj** as team leader.
- Unmodified supplied R&D PDFs, the original database architecture image and official guideline under `supporting-documents/`, with checksums. UI/UX assets are added when their directory is supplied.

Local `.env`, database accounts, application keys, sessions, dependencies, portable tools, build caches and real application data are excluded. Install dependencies with `npm ci --prefix frontend` and configure the backend using the examples in [local setup](local-development.md). There are no default Admin credentials; provision the first Admin privately.

## Build the package

From the repository root, install the report tooling into an ignored local directory, then prepare optional private metadata:

```powershell
python -m pip install --target .tools/report-qa -r scripts/report-requirements.txt
Copy-Item docs/report-metadata.example.json .artifacts/report-metadata.json
```

Skip the copy if private metadata already exists. Edit that ignored JSON with the leader's preferred contact, confirmed member names/actual contribution credits, and the live/video URLs when available. Keep any private contact details out of source commits. The default Documents directory is `../Documents`; pass `--documents-root` if it is elsewhere. Supply the UI/UX folder using `--uiux-root` when ready.

After the release checks and reviewed source commit:

```powershell
python scripts/build-project-report.py
node scripts/package-submission.mjs
```

The output is `.artifacts/submission-<commit>/`, containing `SportsHub-source.zip`, `project-report/`, `supporting-documents/`, `manifest.json`, `SHA256SUMS.txt` and `evidence/`. The source ZIP opens into `SportsHub/`. The packager requires a clean working tree, refuses tracked private/generated paths, checks browser/restore/report fingerprints, verifies the report template and validates supporting-file hashes before copying staged inputs. The source ZIP excludes ignored local files. Existing release folders are preserved rather than overwritten.

Fresh release logs use `.artifacts/release-{build,frontend,configuration,integration,browser,backup,layout}.log`; these are generated during release verification. The browser report lists each successful workflow group and screenshot. Evidence files are outside the source ZIP so reviewers can inspect source and runtime evidence separately. If the submission system accepts only one file, compress the complete `submission-<commit>` folder after checking the official guideline.

Validation on 9 November includes a successful clean extraction/setup/build rehearsal and [successful Docker/Apache CI](https://github.com/NSBM-SportsHub/Development/actions/runs/42559861109). The executable-source fingerprint normalizes text line endings across Windows and the Git archive. The guideline audit confirms the functional mapping; final required links, team details and human review remain pending.

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

The [guideline audit](guideline-review.md) maps the actual requirements and marking weights. The guideline requires report narrative/team/screenshots plus source/live/video links and genuine member explanations. It does not specify CSV exports, a video duration or a final filename, and leaves the deadline unconfirmed. Keep the [original design-evolution notes](design-evolution.md) with the earlier diagram and current ERD so differences are explained.

## Final human handover

1. Extract the source archive into a clean folder and follow the setup guide on the assessor's intended environment. Check any separate lecturer frontend restrictions.
2. Review screenshots and the manifest; confirm they contain only synthetic data and match the source fingerprint.
3. Rehearse the [demo sequence](demo-guide.md) and [required video](video-demonstration.md). Each member verifies their actual code/research/database/UI/UX/QA work and presents its evidence.
4. Finalize leader contact/member credits and the actual UI/UX artifacts. Add accessible live/video links, rebuild/review the PDF, and follow the actual LMS filename/deadline instructions.
5. Submit through the authorized account and retain the confirmation. No assessment submission has been performed by preparing this package.

When hosting is resumed, follow [Railway deployment](deployment-railway.md) and run `node scripts/verify-deployment.mjs https://YOUR-PUBLIC-ORIGIN` for read-only health/deep-link/session/private-file checks. Repeat the authenticated role workflows and check persistence over a redeploy before recording hosted acceptance.
