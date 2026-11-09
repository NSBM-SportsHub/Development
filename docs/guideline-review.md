# Official guideline review

Reviewed 9 November 2026 against `WAD_Batch26_1_IFSL_Project_Instructions.pdf` supplied by the team leader. The four-page PDF's SHA-256 is `3df715db71fa84a2258788b22778708133625c71137375dd5e55311e30850354`. Page references below refer to that document, not the team's R&D proposal.

The guideline supplies assessment requirements; it is not an instruction to deploy, upload a video, contact anyone or submit an assignment automatically. The user's instruction to defer deployment remains in force.

## Topic 3 functionality - page 2

| Requirement | Implementation/evidence | Result |
| --- | --- | --- |
| Admin login | PHP session authentication, `/login`; auth integration/browser cases | Covered locally and in CI |
| Manage clubs and membership approvals | Club CRUD/archival, `/admin/memberships`, assigned-coach review | Covered |
| Schedule training and matches | Training schedule/create/edit/cancel; fixture match scheduling | Covered |
| Create tournaments and fixtures | Tournament lifecycle, league/knockout fixture generation | Covered |
| Record results and scores | Admin result entry/correction; persisted scores/standings | Covered |
| Manage resource booking requests | `/admin/bookings`, approval/rejection/cancellation and concurrent conflict checks | Covered |
| Participation/performance reports | `/admin/reports`, source-based attendance, registrations, match outcomes and totals | Covered; no mandatory CSV/PDF export format is specified |
| Student registration/login | PHP registration, session, validation and protected routes | Covered |
| Browse/join clubs | Club listing/details and membership application/history | Covered |
| Training schedules/match fixtures | Student-readable training and competition routes | Covered |
| Tournament/match registration | Approved-membership eligibility, tournament entry and roster membership; those entries become match participants | Covered through tournament-entry workflow; no separate ad hoc match signup is specified |
| Results/standings | Student-readable scores, league tables and knockout bracket | Covered |
| Facility/equipment booking | Student requests, pending edits/cancellation, availability validation | Covered |
| Personal participation history | `/participation`, ownership-scoped attendance/registration/match history | Covered |

## Overall requirements - page 3

The implementation has distinct Admin/Student routes and permissions, secure session login, logical CRUD/archival, responsive layouts, PHP/PDO database integration, form validation, consistent navigation and applicable search/filtering. The production build, 10 frontend tests, 34 configuration checks, 78 backend scenarios, 11 browser groups and successful MySQL 8/Docker/Apache CI provide implementation evidence. They do not substitute for lecturer assessment or individual understanding.

PHP and MySQL are mandatory. The frontend requirement names HTML, CSS and JavaScript and allows Bootstrap or Material UI. React is not expressly named or prohibited; the implemented React frontend compiles to HTML/CSS/JavaScript, while PHP/MySQL perform backend/data work. Any separate lecturer restriction still needs to be checked. The official PDF does not require CSV exports, native mobile apps, a particular hosting provider or a particular video duration. Additional ideas in the team's R&D document are design proposals, not additional official minimum requirements.

## Deliverables - pages 3-4

| Deliverable | Status / remaining input |
| --- | --- |
| Project report in PDF or Word | Draft report prepared with title, introduction, objectives, system description, team section and Admin/Student screenshots; must finalize contact details, credits and links |
| Leader name/contact | Leader confirmed as **Mukilan Vasantharaj**; preferred contact details pending |
| Group member names/roles | Repository working names/allocation available; final names and actual coding/R&D/database/UI/UX credits need team confirmation |
| Accessible complete GitHub source | Public repository available; core code on main, local-handover changes on the submission-readiness branch to avoid deployment hooks |
| Working live application and report link | **Required but deferred by the user**; successful container CI is not a public hosted application |
| One screen-recorded demonstration | Recording must show login, Admin/Student panels, CRUD, database behavior and main features, plus a real explanation from every member |
| Accessible uploaded video and report link | Pending recording/contribution segments and an accessible upload; no upload is authorized merely by supplying the guideline |
| Team leader/designated member submits report | Pending final review and submission through the actual LMS/platform; no submission performed |

The team also wants its R&D, database architecture and UI/UX work included. These are useful supporting artifacts; the guideline does not say that design/research contributions must be excluded or that every member's contribution must consist solely of application code. Preserve accurate authorship and contribution evidence for all work. Do not replace actual commit history or invent contribution claims.

## Original design versus implemented database

`Architecture Design/NSBM Assignment.drawio.png` is an earlier conceptual schema. It uses UUID-labelled keys, split first/last names, separate booking-items/results/participants tables and proposed fields that differ from the implementation. Preserve the original as design-process evidence, and accompany it with [design evolution](design-evolution.md), the [current ERD](database-erd.md) and the actual migrations. It must not be labelled as the exact implemented schema.

`Research-and-development/Jassim - R&D Document.pdf` identifies Jassim and Shahilan in its header. Its template roles and proposed CSV exports/Bootstrap use should be distinguished from final verified contributions and functionality. Other supporting authorship must be confirmed by the team. The UI/UX source/export files have not yet been supplied in the known Documents folder.

## Marks and deadline - page 4

| Criterion | Weight |
| --- | --- |
| UI/frontend | 20% |
| Backend/database integration | 20% |
| Admin functionality | 15% |
| Student/User functionality | 15% |
| Report, screenshots, GitHub and hosting links | 15% |
| Video demonstration and teamwork | 15% |

The official deadline remains **to be confirmed** in the supplied PDF. The 12 November 2026 date in repository/team planning is not verified by this guideline. Confirm the actual LMS deadline and submission details separately.
