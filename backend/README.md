# NSBM SportsHub backend

PHP 8.2+ with PDO MySQL and mbstring implements Mukilan's authentication/users module and Mursid's resources/bookings module. MySQL 8+ or MariaDB 10.6+ stores their data. No Composer dependencies are required.

See [local development](../docs/local-development.md) for configuration, migrations, first-Admin provisioning, startup, and tests. The [authentication API](../docs/auth-users-api.md) and [resource/booking API](../docs/resource-booking-api.md) describe implemented endpoints and request/response shapes.

## Quick start

Copy config/config.example.php to the ignored config/local.php and set a random application key plus private database credentials. Start MySQL/MariaDB, then from the repository root:

```powershell
php backend/bin/setup.php
php backend/bin/create-admin.php --name="Mukilan" --email="your-real-email@example.com"
php -S 127.0.0.1:8000 -t backend/public backend/router.php
```

Replace the email and enter your own password at the prompt. CLI bootstrap only provisions the first Admin; it refuses repeat provisioning and existing-email promotion. No default credentials or committed accounts exist.

The API base URL is http://127.0.0.1:8000/api. The React development server proxies same-origin /api calls to PHP. GET /api/health checks database access too.

## Structure

- bin/: database setup and initial Admin CLI.
- config/: example and ignored private local.php.
- public/: only PHP web document root; API index and Apache rewrite rules.
- router.php: development PHP-server router.
- src/shared/: HTTP, config, PDO, validation, session/CSRF, login throttling.
- src/modules/authentication-users/: controllers and user repository.
- src/modules/resources/ and src/modules/bookings/: resource CRUD, booking ownership and Admin review.
- src/shared/ResourceBookingHttp.php: module validation and shared-response adapter, distinct from Http.php on every operating system.
- tests/: real HTTP/database integration runner.

Setup applies 001_authentication_users.sql (users and auth_rate_limits), then 002_resources_and_bookings.sql (facilities, equipment and bookings). It checks existing column types/unique indexes without silently altering tables; repeated runs preserve records. The original resource-only 001_resources_and_bookings.sql was renamed. If you imported it already, retain its compatible tables and records. Jassim reviews schema changes; future changes use new ordered migrations.

## Implemented behavior

- Registration creates active Students; passwords are hashed server-side.
- Sessions regenerate on login/logout and security changes. Cookies are HttpOnly/SameSite; production requires Secure cookies and HTTPS.
- Profile edits are scoped to the session user. Changing email requires the current password.
- Password changes require the current password and revoke other sessions.
- Admins can search/filter/paginate, create/read/update, deactivate/reactivate, and archive users.
- DELETE archives accounts and revokes sessions while retaining IDs and unique identifiers for historical records.
- PHP checks active status, archived state, role, and auth version on each protected request.
- Admins cannot demote, deactivate, or archive themselves; transactions prevent concurrent removal of the last active Admin.
- All writes require JSON objects and CSRF headers, including registration/login/logout and DELETE. Login is rate limited.

Roles are student/admin. Coach policies, email verification, and password recovery remain separate work.

Facilities/equipment writes require Admin access; Students read active resources and create/edit/cancel their own pending bookings. Admins review and cancel bookings. Availability checks use transactions and resource locks. All modules reuse Session, Database, Http and SPORTSHUB_* configuration. Resource archival and booking cancellation return 204 with no body.

## Ownership and deployment

Mukilan owns auth/users, public routing, and session/CSRF integration. Jassim coordinates schema/PDO/response review and implements memberships/competitions. Looga implements clubs/training; Mursid resources/bookings; Shahilan announcements; Nimesha notifications/reports. Other backend modules remain placeholders. Each owner reuses shared helpers and implements their module's validation, permissions, and tests.

Keep config, logs, and sessions outside public/ and Git. Prepared PDO queries are required. Never return hashes, credentials, stack traces, or raw database errors. Use a restricted runtime database account; setup and integration tests need DDL permissions.

The built-in server is for local development. Apache/XAMPP can use the included .htaccess with mod_rewrite and public/ as the document root. Production serves the React build and PHP /api under one HTTPS origin; no blanket CORS policy is configured.
