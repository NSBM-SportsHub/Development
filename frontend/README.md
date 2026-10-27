# NSBM SportsHub - Frontend

This directory is reserved for the user interfaces of NSBM SportsHub, the university Sports Club Management System. Start with the [project guide](../README.md) for the full scope, team, deadlines, and contribution rules. See the [backend guide](../backend/README.md) for PHP integration responsibilities.

> **Current status: initial scaffold only.** The React/Vite entry point has basic routes for sports clubs, training attendance, and announcements. Route components are empty; no UI features, APIs, or business workflows have been implemented. `.gitkeep` files preserve other empty directories in Git.

## Technology direction

- React, Vite, and React Router provide the frontend entry point and basic routing.
- Bootstrap is the planned UI framework.
- PHP handles server-side functionality and MySQL stores application data. Browser code communicates with PHP, never directly with MySQL.
- Node.js and npm are frontend development/build tooling and do not replace PHP.

Install dependencies with `npm install` from this directory. Use `npm run dev` to start the development server and `npm run build` to create the production build. No API base URL or backend integration is configured.

## Directory guide

```text
frontend/
|-- README.md
|-- public/             Public static assets
`-- src/
    |-- assets/         Source images, icons, and other visual assets
    |-- shared/         Shared layouts, controls, styling, and API helpers
    `-- modules/
        |-- authentication-users/
        |-- sports-clubs/
        |-- memberships/
        |-- facilities/
        |-- equipment/
        |-- bookings/
        |-- training-attendance/
        |-- tournaments/
        |-- matches-results/
        |-- announcements/
        |-- notifications/
        `-- reports/
```

Create implementation files within the assigned module after the shared setup and relevant contract are agreed. Specific component filenames are not fixed yet. Do not create a second implementation of an existing shared control or module.

## Module ownership and deliverables

| Module | Frontend owner | Planned screens/behavior | Backend partner |
| --- | --- | --- | --- |
| Authentication/users | Mukilan | Registration, login/logout, profile, authorized user management | Mukilan |
| Sports/clubs | Shahilan | Club listing/details/search and administrative forms | Looga |
| Memberships | Sanudi | Application, personal status, Admin review/member records | Jassim |
| Facilities | Sanudi | Listings/details and administrative forms | Mursid |
| Equipment | Sanudi | Inventory listings and administrative forms | Mursid |
| Bookings: Student | Sanudi | Request forms, personal status, permitted cancellation | Mursid |
| Bookings: Admin | Mursid | Review queue, booking records, approval/rejection feedback | Mursid |
| Training/attendance | Shahilan | Schedules, session forms, attendance viewing/recording | Looga |
| Tournaments | Shahadh | Tournament management, entries, and fixtures as required | Jassim |
| Matches/results | Shahadh | Fixtures, match management, results, and approved standings | Jassim |
| Announcements | Shahilan | Announcement display and authorized publication forms | Shahilan |
| Notifications | Nimesha | Recipient notification list and read state | Nimesha |
| Reports | Nimesha | Personal participation history and scoped Admin reports | Nimesha |

### Shared frontend ownership

- **Shahadh:** layouts, navigation, reusable controls, global presentation, and responsive consistency.
- **Mukilan:** frontend entry/routing integration, authenticated state conventions, and the shared API client.
- **Module owners:** their module components, forms, and integration behavior.
- **Sanudi and Mursid:** keep Student and Admin booking screen ownership separate and agree on shared booking controls before editing them.

Coordinate shared changes with the responsible owner. Each member should create their own reviewed code contributions.

## Interfaces and permissions

Student and Admin interfaces are required. Coach belongs to the initial scope, but its screens and club-level permissions require agreement.

The planned Student experience covers clubs, membership status, schedules, fixtures/results, bookings, personal history, and profile information. The planned Admin experience covers management, approvals, results, and reports.

Frontend navigation and hidden controls improve usability; they do not authorize actions. PHP must check identity, role, record ownership, and any club scope on every protected operation. Never trust role values, approval fields, or user IDs simply because the browser supplied them.

## Integration checklist

Before building a database-dependent screen, agree with the backend partner on:

1. Request path/method and authentication/session behavior.
2. Request fields, required values, validation rules, and date/time conventions.
3. Response fields, list/filter behavior, status values, and errors.
4. Role and record-ownership restrictions, including permitted actions for each status.
5. CSRF handling for cookie-authenticated mutations.
6. Loading, empty, retry, success, and failure behavior.

No endpoints or response contracts currently exist. Record approved contracts in `docs/` before independent frontend/backend implementations diverge. Keep transport conventions in the agreed shared client rather than duplicating them across modules.

Development fixtures may support early UI work, but identify them clearly. A screen is not complete until it uses the real PHP workflow and reflects persisted records after refresh. Keep database credentials, passwords, and session secrets out of frontend files and browser-visible configuration.

## UI and accessibility expectations

- Reuse shared layouts, spacing, typography, colors, and controls agreed with Shahadh.
- Support mobile and desktop layouts without unusable forms or tables.
- Use semantic headings, visible form labels, keyboard-accessible controls, and meaningful focus states.
- Display actionable server validation errors and clear success feedback.
- Provide loading/empty/error states and guard against repeated submissions while saving.
- Show only actions applicable to the current record state, with server enforcement behind them.
- Agree on date/time presentation and status wording across modules.

## Local setup and run status

The frontend can be built independently of the PHP backend. No backend startup command, API integration, or deployment configuration is set up yet.

## Workflow and acceptance

Use a task branch such as `feat/sanudi-membership-interface`. Keep PRs scoped, coordinate shared-file edits, and include screenshots plus the checks performed.

A frontend task is ready for review when:

- The agreed workflow works through PHP and the database.
- Correct persisted data appears after reload.
- Validation, permission failures, empty records, and network errors are handled.
- Relevant Student/Admin views and mobile/keyboard use have been checked.
- The backend partner has verified the integration.
- Shared UI conventions are followed and no secrets are included.

Module owners test their screens. Shahadh reviews UI consistency, Mukilan reviews routing/auth integration, and Nimesha coordinates regression evidence.

## Deadlines

All dates are in **2026**. Detailed member targets are in the [project schedule](../README.md#delivery-schedule).

- **6 November:** all implementation, integration, reviews, and merges complete.
- **7-9 November:** full workflow testing, defect fixes, and regression.
- **10 November:** deployment and deployed-system checks.
- **11 November:** final acceptance, documentation, and demo rehearsal; submission package ready.
- **12 November:** assignment submission.

Test during development. The reserved 7-11 November period is for system verification, fixes, and deployment rather than starting unfinished features.
