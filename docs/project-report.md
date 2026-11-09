# NSBM SportsHub
## Sports Club Management System

Web and Mobile Application Development | Batch 26.1 IFSL

Faculty of Computing, NSBM Green University

**Report status:** {{report_status}}

**Team leader:** {{leader_name}}

**Leader contact:** {{leader_contact}}

**Source repository:** https://github.com/NSBM-SportsHub/Development

**Submission source:** {{source_url}}

**Working application:** {{hosted_url}}

**Demonstration video:** {{video_url}}

**Prepared:** {{prepared_date}}

**Completion items:** {{pending_items}}

This draft accompanies the application source, test evidence and original R&D/database design artifacts. It must be reviewed by the team and completed with the required contact details, confirmed contributions, working live link and accessible video before assessment submission. Deployment remains deferred at the team leader's request.

<!-- pagebreak -->

## 1. Introduction

NSBM SportsHub brings university sports club membership, training, competitions and resource requests into one web application. Its purpose is to give students a consistent place to join clubs and view their activity while providing administrators with tools to manage approvals, schedules, results and participation records.

The team's R&D document describes the motivation for replacing fragmented sports administration with shared records. This report does not claim that interviews, surveys or measured improvements were conducted unless the team supplies that evidence. The application and screenshots demonstrate the implemented workflows rather than predicted outcomes.

## 2. Project objectives

- Provide secure registration and login, with separate Admin and Student workspaces and server-enforced permissions.
- Manage clubs, membership applications, training sessions, attendance, matches and tournaments using PHP and MySQL.
- Allow students to request facilities/equipment and prevent conflicting allocations through validation and database transactions.
- Record competition results and calculate standings from stored results.
- Show personal participation history and authorized participation/performance reports from the same source records.
- Offer consistent navigation, responsive interfaces, validation and understandable failure/empty states.
- Maintain traceable source, research/design artifacts, test evidence and setup instructions for handover.

## 3. Team and contribution record

The team leader is Mukilan Vasantharaj. The table below records the available names and original working allocation. It must be finalized against actual contributions; it does not certify that each assigned area was completed by that person.

{{team_table}}

{{team_note}}

Credit includes actual research, database architecture, UI/UX design, code, integration and QA work. The R&D PDF identifies Jassim and Shahilan in its header. The database image is preserved as an original team design artifact, with final creator credits awaiting confirmation. UI/UX design source/export files are still awaited. Application integration coverage performed by Mukilan is recorded separately in the repository rather than attributed to another member. Every member's video segment must describe their own real contribution.

## 4. System description and architecture

The frontend is written in JavaScript using React, with HTML/CSS output built by Vite. PHP handles authentication, permissions, validation, domain workflows and JSON APIs. MySQL stores the persistent application data. Node.js is a development/build tool, not the production API backend.

{{architecture_diagram}}

The shared API client sends same-origin requests with the PHP session cookie and CSRF token. Protected routes select the appropriate workspace; server checks enforce Admin privileges, record ownership and club-scoped coach permissions. Coach assignments add permissions to an existing account rather than introducing a third database account role.

The official guideline requires HTML/CSS/JavaScript, PHP and MySQL, and permits Bootstrap or Material UI. It does not expressly name or prohibit React. Any separate classroom restriction must still be checked. Bootstrap-specific styling, CSV exports and other ideas in the early R&D document are not represented here as required or implemented merely because they appeared in a proposal.

### 4.1 Admin workflow

Admins manage accounts, club records and membership reviews; assign/end coaches; schedule training; manage facilities/equipment and booking requests; create competitions and fixtures; schedule matches and record/correct results. They publish announcements and inspect authorized participation/performance reports. Archival/cancellation preserves linked historical records.

### 4.2 Student workflow

Students register, sign in, edit their profile, browse/join clubs and follow their application status. They view training and fixtures, submit eligible tournament entries, request resources, edit/cancel pending bookings, read announcements/notifications and inspect personal participation history. Match participation is derived from tournament entry rosters; it is not falsely described as individually verified match attendance.

### 4.3 Assigned coach workflow

An assigned coach reviews permitted club memberships and sport-scoped competition entries, creates/manages authorized training and records attendance for approved club participants. Ending the assignment removes these permissions without changing the account's Student role. This is an enhancement to the minimum Admin/Student scope.

## 5. Database design and design evolution

Nine ordered migrations define 17 tables using InnoDB and UTF-8. Foreign keys maintain shared identity, club, competition and resource references. Prepared statements bind request values. UTC timestamps and explicit workflow states support consistent history and reporting.

| Area | Tables | Key behavior |
| --- | --- | --- |
| Identity/security | users; auth_rate_limits | Hashed passwords, role/status, session revocation and login throttling |
| Clubs/membership | sports; clubs; memberships; club_coaches | Canonical sport IDs, membership review history and revocable coach scope |
| Resources | facilities; equipment; bookings | Facility-or-equipment bookings, time ranges, quantity and serialized availability checks |
| Competitions | tournaments; tournament_entries; tournament_entry_members; matches | Eligible rosters, fixture generation, match scores and standings |
| Training | training_sessions; training_attendance | Session schedule and unique participant/session attendance |
| Communication | announcements; notifications | Persisted publication, recipient event snapshots and read state |

Participation reports query attendance, tournament registrations and completed match rosters directly. They do not maintain a second copy of the activity records in a separate report table. Totals and rows are read from one database snapshot.

The original database architecture image is included as early design evidence. The implemented schema evolved to matching numeric foreign keys, a shared user name/password-hash contract, separate coach assignments, a resource per booking, entry-based competition rosters and result fields on matches. The original image must therefore be read together with the current ERD and design-evolution notes rather than treated as exact production DDL.

![Original conceptual database design; preserved unchanged. See supporting-documents and the current SQL migrations for the final schema.](input:database-design-original.png)

## 6. Validation, security and reliability

- Passwords are hashed; login failure messages avoid exposing account existence. Session revocation and rate-limiting scenarios are tested.
- PHP checks authentication, role, ownership and coach assignment on protected operations. Writes use CSRF verification.
- Server-side validation rejects invalid IDs, field values, state transitions and resource conflicts. Frontend validation provides immediate feedback.
- Resource transactions and locks prevent simultaneous requests/edits/approvals from double-booking facilities or exceeding stock.
- Session locks and attendance-history rules prevent a concurrent club change from transferring existing attendance visibility.
- Archive/cancel operations retain relationships needed for reports and history. Reports distinguish roster appearances from actual training attendance.
- Secrets, private configuration, sessions and source remain outside the public document root; cookies and HTTPS still need final hosted acceptance.

## 7. Verification and results

The local suites use synthetic accounts and isolated temporary databases, which are removed after execution. The accepted browser evidence contains 11 workflow groups and ten screenshots. The release package includes the machine-readable reports, source fingerprint and checksums so evidence can be related to the packaged source.

| Verification | Recorded result |
| --- | --- |
| Production frontend build | Passed |
| Frontend API/service contract tests | 10 passed |
| Configuration checks | 34 passed |
| Real PHP/MySQL integration | 78 scenarios passed, including independent-process concurrency |
| Browser workflow acceptance | 11 groups passed, no page runtime errors |
| Backup/restore rehearsal | 17 tables and exact row fingerprints restored; schema setup succeeds afterward |
| Clean source extraction | Dependency install/build/test, schema/reference setup and initial Admin provisioning passed |
| MySQL 8 / actual Docker / Apache CI | Passed on the submission-readiness branch |

Container verification establishes that the image builds and serves the routes/API/session/private-file controls in a test environment. It does not establish a public live application, final HTTPS behavior, hosted database persistence or lecturer assessment acceptance.

## 8. Screenshots of key features

All screenshots below show synthetic workflow records. The evidence folder retains the original-resolution images; the report scales them for reading. The supplied UI/UX design sources should be included as separate supporting artifacts once available, with confirmed creator credits.

![Admin: a club created through the PHP/MySQL workflow and retained after reload.](evidence:release-club.png)

![Admin: persistent coach assignments and account-based club scope.](evidence:release-coach-assignments.png)

![Student: approved club membership after application and review.](evidence:release-membership.png)

![Coach: recorded attendance for an approved participant.](evidence:release-attendance.png)

![Admin: participation/performance records and totals sourced from actual activity.](evidence:complete-reports.png)

![Admin: an approved facility booking with requester information and cancellation controls.](evidence:release-booking-approval.png)

![Student: persisted booking notification and read state.](evidence:release-notifications.png)

![Admin: competition fixtures, saved result and standings.](evidence:complete-competition.png)

![Student: a published campus announcement.](evidence:release-announcement.png)

![Student: responsive training schedule at a mobile viewport.](evidence:complete-training-mobile.png)

## 9. Research, architecture and UI/UX supporting work

The complete handover is broader than application code. The supporting folder preserves the team's R&D PDF, original database design image and relevant project references. Original source names and SHA-256 fingerprints are recorded so those artifacts remain distinguishable from the current implementation and from this generated report.

The R&D document supplies design motivation and proposed scope. The architecture image illustrates the earlier schema, while the canonical ERD/migrations record the final database. The requested UI/UX design assets and creator credits are pending and are not replaced by an invented design artifact. Application screenshots prove the implemented interface; they are not claimed as the team's original design source files.

## 10. Deployment, video and final submission status

The official guideline requires a working hosted application and a live link in the report. Deployment is intentionally deferred by the team leader, so that deliverable remains open. Existing main-branch deployment integrations are why handover work is kept on the submission-readiness branch. No hosting is claimed complete on the basis of container CI.

The required screen recording must demonstrate login, both panels, CRUD, database integration and the main workflows, followed by a brief real explanation from every member. The demo guide and recording checklist support preparation; an accessible video link is still required after recording/upload. No voice or contribution explanation is invented on behalf of a member.

Only the team leader or a designated member should submit the final report through the actual LMS/submission platform after checking all three links: repository, application and video. The supplied official PDF leaves the deadline to be confirmed. The team's 12 November planning date must be checked against the actual LMS announcement.

## 11. Conclusion and completion checklist

The implemented application covers the official Topic 3 functional scope and has local/database/browser/container evidence. The team submission also preserves research and design work. Final readiness depends on accurate team/contact details, the supplied UI/UX artifacts, working hosting and video links, genuine individual explanations and the team leader's final review/submission.

**Items still open:** {{pending_items}}

## References and included evidence

- Official module guideline: WAD_Batch26_1_IFSL_Project_Instructions.pdf, pages 2-4, supplied by the team leader.
- Team R&D: Jassim - R&D Document.pdf, header attribution to Jassim and Shahilan; proposals are distinguished from final implementation.
- Original database design: NSBM Assignment.drawio.png; final design is described by migrations 001-009 and docs/database-erd.md.
- Project source: https://github.com/NSBM-SportsHub/Development
- Exact report source revision: {{source_url}}
- Successful container CI: https://github.com/NSBM-SportsHub/Development/actions/runs/42559861109
- Package evidence: browser/backup reports, ten synthetic screenshots, local verification logs, manifest and SHA256SUMS.txt.
