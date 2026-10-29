# NSBM SportsHub

NSBM SportsHub is a university Sports Club Management System being developed for **NSBM Green University** as an eight-member group project for the **Web and Mobile Application Development** module.

The project aims to bring sports clubs, membership applications, training, competitions, resources, and participation records into one platform for students and university sports administrators.

> **Current status: authentication/users and resource/booking APIs with integrated module previews.** Registration, login/logout, profile/password changes, Admin user management, facilities/equipment CRUD, and booking requests/review use PHP/MySQL. Resource/booking interfaces remain pending. Shahilan's club, training/attendance, and announcement screens are included as local-data previews; their PHP workflows are still pending integration. See [local setup](docs/local-development.md), the [authentication API contract](docs/auth-users-api.md), the [resource/booking API contract](docs/resource-booking-api.md), and the [frontend guide](frontend/README.md).

## Start here

1. Read this page for the scope, team allocation, schedule, and collaboration rules.
2. Read the [frontend guide](frontend/README.md) for interface ownership and integration expectations.
3. Read the [backend guide](backend/README.md) for PHP ownership, database coordination, and security expectations.
4. Confirm the relevant task, schema, and frontend/backend contract with its owners before implementing it.

## Technology plan

| Area | Requirement or direction | Current state |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript, React | Shared auth/API client plus clubs, training/attendance and announcement previews |
| UI framework | Bootstrap is planned | Shared auth CSS and module preview themes; coordinate presentation with Shahadh |
| Backend | PHP 8.2+ | Shared API router, PDO, session/CSRF, auth/users and resource/booking handlers |
| Database | MySQL 8+ / compatible MariaDB | Ordered authentication and resource/booking migrations; private configuration example |
| Local environment | PHP and MySQL/MariaDB; XAMPP is an option | Exact commands in the local setup guide |
| Version control | Git and GitHub | Repository initialized; remote configured |

React/Vite are used on this implementation branch. Confirm assignment framework permissions before submission. PHP and MySQL remain the backend/database requirements; Node.js serves frontend development/build work only. Confirm local XAMPP database/runtime compatibility using the setup guide.

## Users and access

| Role | Planned responsibilities |
| --- | --- |
| Student | Register/login, manage a profile, browse clubs, apply for membership, view schedules and competitions, request resources, and view personal participation |
| Admin | Manage accounts, clubs, memberships, resources, booking approvals, schedules, competitions, results, announcements, and reports |
| Coach | Included in the initial project scope; detailed club assignments, screens, and permissions still require agreement |

Student and Admin interfaces must be separate. All protected actions must also be checked on the PHP server. Coach permissions must be explicitly defined before that role's workflows are implemented.

## Planned modules

| Folder name | Planned functionality |
| --- | --- |
| `authentication-users` | Registration, login/logout, profile updates, user administration, and role-based access |
| `sports-clubs` | Sports/club browsing, details, search, and administrative CRUD |
| `memberships` | Applications, personal status, approval/rejection, and membership records |
| `facilities` | Facility records, details, availability information, and administration |
| `equipment` | Equipment records, stock information, and administration |
| `bookings` | Facility/equipment requests, status, cancellation, review, and availability enforcement |
| `training-attendance` | Training schedules, session management, and attendance |
| `tournaments` | Tournament management, eligible entries, and fixtures according to an agreed format |
| `matches-results` | Match schedules, score/result entry, results, and standings where applicable |
| `announcements` | Announcement management and publication to the agreed audiences |
| `notifications` | In-app updates and recipient read state; external delivery is not agreed |
| `reports` | Student participation history and authorized participation/performance reports |

Tournament/match registration, standings, Coach workflows, and other policy-dependent features must follow the approved assignment requirements and domain rules. The repository does not yet define these rules in code or a schema.

## Repository structure

```text
Development/
|-- README.md
|-- frontend/
|   |-- README.md
|   |-- public/              Public frontend assets
|   `-- src/
|       |-- assets/          Source images, icons, and other UI assets
|       |-- shared/          Shared layouts, UI components, and client helpers
|       `-- modules/         The twelve module folders listed above
|-- backend/
|   |-- README.md
|   |-- config/             Planned server/database configuration
|   |-- public/             Planned PHP web entry point directory
|   `-- src/
|       |-- shared/         Planned authentication, routing, and backend helpers
|       `-- modules/        Matching PHP module folders
|-- database/
|   |-- migrations/         Future ordered schema changes
|   `-- seeds/              Future safe reference/development data
`-- docs/                   Future requirements, architecture, API, and QA documents
```

Both module directories contain the twelve planned module folders. Authentication/users has React and PHP implementations. The frontend also contains clubs, training/attendance and announcement previews. Resource/booking PHP handlers reuse the shared login session and PDO connection. Ordered migrations cover authentication and resources/bookings; other business handlers/schemas still need integration.

## Team and working ownership

The following allocation is the working task plan. Changes should be coordinated with the team lead and affected owners.

| Member | Primary implementation ownership | Coordination responsibility |
| --- | --- | --- |
| **Mukilan** | Authentication/users frontend and backend; application entry points, routing, shared API client, auth and CSRF helpers | Team lead, module integration, code review, deployment |
| **Jassim** | Membership, tournament, and match/result backend; database configuration and shared database/response/validation helpers | Architecture lead, ERD/schema, transaction and backend review |
| **Shahadh** | Shared UI/layouts; tournament, fixture, match, and result interfaces | UI/UX lead, responsive consistency, frontend review |
| **Shahilan** | Sports/club and training/attendance interfaces; announcements frontend and backend | Architecture assistance and UI/backend coordination |
| **Looga** | Sports/club and training/attendance backend | PHP CRUD, validation, and integration with Shahilan |
| **Mursid** | Facilities, equipment, and booking backend; Admin booking interface | Booking rules, related documentation and test scenarios |
| **Nimesha** | Participation history/reports and notifications, frontend and backend | QA coordination, bug reporting, regression verification |
| **Sanudi** | Membership, facilities/equipment, and Student booking interfaces | Responsive forms, status feedback, integration with Jassim/Mursid |

Every member must contribute actual code and their own reviewed GitHub contributions. Documentation and testing support implementation; they do not replace it. Mukilan coordinates integration rather than implementing all modules for other members.

### Shared ownership boundaries

- Mukilan owns application routing/entry points, the shared frontend API client, and server authentication/CSRF helpers.
- Shahadh owns shared frontend layouts, controls, and global presentation.
- Jassim owns the initial schema, database configuration/access conventions, and common backend response/validation helpers.
- Module developers coordinate changes to these shared areas with the owner rather than creating duplicate implementations.
- Mursid owns the Admin booking screen; Sanudi owns Student booking requests and personal booking status.

## Delivery schedule

All dates below are in **2026**. Development dates are internal targets; the assignment submission date was supplied by the team.

| Milestone | Date |
| --- | --- |
| Confirm assessed scope, frontend choice, roles, and initial data model | 28 October |
| Complete all development, integration, reviews, and merges | **6 November** |
| Reserved testing and deployment period | **7-11 November** |
| Full workflow testing, bug fixes, and regression | 7-9 November |
| Deploy and verify the target environment | 10 November |
| Final acceptance, documentation, backup, and demo rehearsal; submission package ready | 11 November |
| **Final assignment submission** | **12 November** |

### Individual development targets

| Member | Working milestones |
| --- | --- |
| Mukilan | Shared setup/conventions: 28 Oct; authentication/role protection: 30 Oct; profiles/user management: 2 Nov; final integration: 6 Nov |
| Jassim | ERD/initial schema: 28 Oct; membership backend: 30 Oct; tournament backend: 2 Nov; matches/results backend: 4 Nov |
| Shahadh | Shared UI: 29 Oct; tournament/fixtures UI: 3 Nov; match/results UI: 5 Nov |
| Shahilan | Club UI: 31 Oct; training/attendance UI: 3 Nov; required announcements: 5 Nov |
| Looga | Sports/club backend: 30 Oct; training backend: 1 Nov; attendance backend: 2 Nov |
| Mursid | Resource backend: 30 Oct; booking backend: 2 Nov; Admin review and conflict checks: 4 Nov |
| Nimesha | Test plan: 29 Oct; required notifications: 4 Nov; participation history/reports: 5 Nov |
| Sanudi | Membership/resource UI: 1 Nov; Student booking UI: 4 Nov; validation/responsive fixes: 5 Nov |

A deadline means integrated, tested, reviewed, and merged work, not an isolated screen. Test during development as well as during the reserved five days. Open small PRs daily, aim for review within 24 hours, and report blockers immediately. After 6 November, focus on fixes, verification, deployment, and submission preparation rather than new features.

## Getting started as a new contributor

Clone the repository and enter it:

```sh
git clone https://github.com/NSBM-SportsHub/Development.git
cd Development
```

Then:

1. Read the root, frontend, and backend READMEs.
2. Confirm your assigned module, reviewer, dependencies, and acceptance criteria.
3. Agree on the relevant database model and request/response contract with the backend/frontend partner.
4. Create a task branch, for example `git switch -c feat/yourname-task-name`.
5. Implement a small, reviewable change in the assigned folders.
6. Test the change and submit a pull request with evidence.

Follow [local development](docs/local-development.md) to configure the private database connection, apply the ordered migrations, provision your first Admin, and start PHP plus React. No default credentials or committed accounts exist.

## Development dependencies and conventions

The initial implementation order is:

1. Agreed scope, database design, shared conventions, and UI foundations.
2. Authentication and server-side permissions.
3. Clubs/resources, followed by memberships and bookings.
4. Training/attendance and tournament/match workflows.
5. Communication, participation history, and reporting integrated with their source modules.

Frontend/backend pairs may work in parallel after agreeing on contracts. A screen using sample data must be identified as incomplete until its real PHP/database workflow is integrated.

The authentication/users schema and [API contract](docs/auth-users-api.md) are implemented on this branch. Other module contracts still require coordination. Agree request paths, fields, validation, responses, permissions, and errors with each partner. Record decisions in docs; Jassim reviews the initial identity migration and shared schema changes.

## GitHub collaboration

- Use short-lived task branches and small pull requests. Avoid direct pushes to `main`.
- Include the member name and task in branch names, such as `feat/sanudi-membership-interface` or `fix/mursid-booking-validation`.
- Keep work within assigned files; coordinate cross-module/shared changes first.
- Explain the problem, resulting behavior, dependencies, and database changes in each PR.
- Include tests performed and UI screenshots where useful. Do not claim untested functionality works.
- Update your branch after required dependencies merge and resolve conflicts with the affected owner.
- Jassim coordinates migration numbering/order and reviews schema consistency.
- Never commit credentials, passwords, session secrets, generated dependencies, or build output. Establish appropriate ignore rules before introducing them.
- Do not automatically commit or push someone else's work. Each member should author their own contributions.

## Definition of done

A task is complete when:

- It meets its agreed acceptance criteria and uses the approved schema/contracts.
- Its frontend, PHP handler, and database behavior work together where applicable.
- Server-side validation, authentication, record ownership, and role checks are enforced.
- Success, failure, loading, empty, and relevant responsive states have been checked.
- Historical data is preserved according to policy; multi-record writes remain consistent.
- Setup/schema changes are documented and no secrets are included.
- A reviewer has checked the PR and the work is merged.

Nimesha coordinates overall QA, but each developer tests their own contribution. Booking concurrency, direct unauthorized requests, report totals, and deployment behavior need explicit verification.

## Decisions still to resolve

- Official assignment brief/rubric, React permission, exact submission time/platform, and required evidence.
- Coach workflows, single versus multiple roles, registration verification, and initial Admin/staff provisioning.
- Membership eligibility, review permissions, duplicate/reapplication behavior, and self-review restrictions.
- Personal versus club bookings, pending-request availability, cancellation rules, and equipment issue/return tracking.
- Competition entrants, individual/team/club formats, registration eligibility, sport-specific results, and standings rules.
- Required report fields/exports, announcement audiences, notification triggers/delivery, and hosting requirements.

Confirm these with the relevant owners before dependent implementation. No university policy should be inferred solely from a placeholder folder or an interface design.
