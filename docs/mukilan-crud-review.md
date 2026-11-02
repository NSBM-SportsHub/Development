# Mukilan authentication/users CRUD review

Branch: `feat/mukilan-auth-users-crud`, based on `main`. Work is local; no remote branch, pull request, or deployment was created.

## Implemented

- Student registration, login/logout, current-session lookup.
- Profile read/update and password changes with current-password verification.
- Admin user create/read/update/archive with search, role/status filters, and pagination.
- PHP session/CSRF helpers and a shared React API client.
- PDO/MySQL identity schema, non-destructive setup, first-Admin CLI.
- Server-side role/status/ownership checks, session revocation, unique fields, safe JSON errors, login throttling, and Admin lockout protection.

DELETE archives accounts so IDs remain available for future historical relationships. Public registration cannot choose an Admin role. Coach policies, email verification, password recovery, and other members' business modules remain separate work.

## Verification performed

- Production frontend build: passed with Vite.
- PHP syntax checks: all 16 PHP files passed.
- Real HTTP integration: all 21 scenarios passed against portable PHP 8.4.27 and MariaDB 11.4.13 on loopback. The suite exercised actual persisted records, permission denials, CSRF, login throttling, profile/email/password changes, account archiving, session revocation, duplicate fields, pagination/filtering, and bootstrap safeguards.
- Microsoft Edge browser checks: Admin create/edit/search/archive and cancellation; Student registration/profile persistence; protected-route redirect; password change/re-login; sign-out; desktop/mobile layouts; backend failure with retained inputs and no false success.
- Screenshots were inspected at desktop width 1440 and mobile width 390. They are local ignored artifacts under `.artifacts/`.
- Test databases and temporary accounts were removed. No default application account or password was committed.

Tests used a local MariaDB instance. A deployed Apache/MySQL installation and production HTTPS configuration have not been verified. Review the identity migration and PDO conventions with Jassim and shared presentation with Shahadh before merging.

Follow [local development](local-development.md) to configure your own application database and provision your Admin. Frontend/backend partners can use the [API contract](auth-users-api.md) after starting the PHP service.
