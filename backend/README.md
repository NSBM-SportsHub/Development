# NSBM SportsHub backend

PHP 8.2+ with PDO MySQL and mbstring implements Mukilan's authentication/users module. MySQL 8+ or MariaDB 10.6+ stores its data. No Composer dependencies are required.

See [local development](../docs/local-development.md) for configuration, migration, first-Admin provisioning, startup, and tests. The [API contract](../docs/auth-users-api.md) describes implemented endpoints and request/response shapes.

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
- tests/: real HTTP/database integration runner.

Migrations create users, auth_rate_limits, clubs (the announcement FK target), and announcements. Setup checks existing column types/unique indexes without silently altering tables.

## Implemented behavior

- Registration creates active Students; passwords are hashed server-side.
- Sessions regenerate on login/logout and security changes. Cookies are HttpOnly/SameSite; production requires Secure cookies and HTTPS.
- Profile edits are scoped to the session user. Changing email requires the current password.
- Password changes require the current password and revoke other sessions.
- Admins can search/filter/paginate, create/read/update, deactivate/reactivate, and archive users.
- DELETE archives accounts and revokes sessions while retaining IDs and unique identifiers for historical records.
- Admins manage announcements; authenticated users can read non-deleted announcements. Writes use PDO prepared statements, validation, session roles, and CSRF.
- PHP checks active status, archived state, role, and auth version on each protected request.
- Admins cannot demote, deactivate, or archive themselves; transactions prevent concurrent removal of the last active Admin.
- All writes require JSON objects and CSRF headers, including registration/login/logout and DELETE. Login is rate limited.

Roles are student/admin. Coach policies, email verification, and password recovery remain separate work.

## Ownership and deployment

Mukilan owns auth/users, public routing, and session/CSRF integration. Jassim coordinates schema/PDO/response review and implements memberships/competitions. Looga implements clubs/training; Mursid resources/bookings; Shahilan announcements; Nimesha notifications/reports. Other modules remain placeholders. Each owner reuses shared helpers and implements their module's validation, permissions, and tests.

Keep config, logs, and sessions outside public/ and Git. Prepared PDO queries are required. Never return hashes, credentials, stack traces, or raw database errors. Use a restricted runtime database account; setup and integration tests need DDL permissions.

The built-in server is for local development. Apache/XAMPP can use the included .htaccess with mod_rewrite and public/ as the document root. Production serves the React build and PHP /api under one HTTPS origin; no blanket CORS policy is configured.
