# Local development: PHP APIs and React frontend

All core React module screens use the shared PHP/MySQL APIs, including clubs, training/attendance, Admin booking review, Student booking editing, coach assignments, notifications and reports. All PHP modules use one private configuration, PDO connection, session and CSRF implementation. See [final integration evidence](final-integration-review.md) and [Railway deployment](deployment-railway.md).

## Requirements

- PHP 8.2+ with `pdo_mysql` and `mbstring` enabled.
- MySQL 8+ or MariaDB 10.6+ using InnoDB (XAMPP's MariaDB can be used if compatible).
- Node.js 22.12+ and npm for the React/Vite frontend.

Check `php -v`, `php -m`, and `node --version`. On Windows with XAMPP, use `C:/xampp/php/php.exe` wherever the instructions say `php` if PHP is not on PATH. The implementation has no Composer dependencies.

### Portable tools on this workstation

Verification downloaded PHP and MariaDB into the ignored `.tools/` directory without installing system services. These tools are local to this checkout and are not included in Git. To reuse them, start MariaDB from the repository root in its own terminal:

```powershell
$localDbIni = (Resolve-Path .tools/db-data/my.ini).Path
& ./.tools/mariadb/mariadb-11.4.13-winx64/bin/mariadbd.exe "--defaults-file=$localDbIni" --bind-address=127.0.0.1 --port=3307 --skip-log-bin --innodb-buffer-pool-size=64M --console
```

For this isolated loopback development instance, configure host `127.0.0.1`, port `3307`, database `nsbm_sportshub`, user `root`, and an empty database password in your private `backend/.env`. Set your own random application key. Replace each `php` command below with `& ./.tools/php/php.exe`. The application Admin still requires your own email and password through the provisioning command. Other teammates should use their own installed PHP/database or separately prepare portable tools. If the database is already running on that port, reuse it.

To stop this local database cleanly:

```powershell
& ./.tools/mariadb/mariadb-11.4.13-winx64/bin/mariadb-admin.exe --host=127.0.0.1 --port=3307 --user=root shutdown
```

## 1. Private database configuration

Start your local MySQL/MariaDB server. On a new clone, create private configuration in PowerShell from the repository root. Keep an existing `backend/.env`; the command below copies only when it is missing:

```powershell
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
```

For a new configuration, paste the generated key into `SPORTSHUB_APP_KEY` in the ignored `backend/.env` and edit `SPORTSHUB_DB_HOST`, `SPORTSHUB_DB_PORT`, `SPORTSHUB_DB_NAME`, `SPORTSHUB_DB_USER`, and `SPORTSHUB_DB_PASSWORD`. Preserve an existing key. Use `nsbm_sportshub` as a local database name unless your team agrees another. The example uses portable MariaDB port `3307`; change it to `3306` if that is your XAMPP port. Do not put secrets in the frontend, Git, screenshots, or shared messages. Use `SPORTSHUB_ENV=development` and `SPORTSHUB_SESSION_SECURE=0` for local HTTP development.

Configuration precedence is defaults < optional private `backend/config/local.php` < `backend/.env` < process environment. Existing `local.php` configurations remain supported. PHP and CLI commands find `.env` independently of the terminal folder. Restart PHP after configuration changes; inherited process variables override the file, including empty values. `SPORTSHUB_ENV=production` requires `SPORTSHUB_SESSION_SECURE=1` and HTTPS. An optional private session directory can be set through `SPORTSHUB_SESSION_PATH`.

## 2. Initialize the schema and first Admin

```powershell
php backend/bin/setup.php --reference-seed
php backend/bin/create-admin.php --name="Mukilan" --email="your-real-email@example.com"
```

Replace the example email with yours. Skip Admin provisioning if the first Admin already exists. The Admin command prompts for a password without showing it on an interactive terminal. There is no default password. For automation, `SPORTSHUB_ADMIN_PASSWORD` can be supplied through the process environment; keep it out of scripts and shell arguments.

The `--reference-seed` option loads reference sports without demo clubs, allowing Admins to create real clubs in a fresh installation. The setup command creates the configured database and applies every `database/migrations/NNN_name.sql` file in numeric order, without dropping data or altering existing tables. Add `--seed` (`php backend/bin/setup.php --seed`) to also load the reference sports and the demo clubs used by the membership and competition APIs. See [database design](database-erd.md) for the schema and migration order. The setup account needs permission to create that database/tables. Use a restricted application database account for normal runtime after initialization. The Admin command only provisions the first Admin and refuses repeated bootstrap or existing-email promotion. Later Admins are created by an authorized Admin through the UI/API.

The first migration creates users/rate limits; the second creates facilities, equipment and bookings; `003`–`006` create sports, clubs, memberships, club coaches, tournaments, entries and matches. `007` creates training sessions/attendance and `008` creates announcements using canonical club IDs and `009` creates recipient-owned notifications. Reports query the existing attendance, tournament and match tables. See the [notifications/reports contract](notifications-reports-api.md). Setup refuses two migrations that share a number. Setup checks existing schema compatibility and preserves records on repeat runs. Mursid's original resource-only migration was renamed from 001_resources_and_bookings.sql to 002_resources_and_bookings.sql; existing compatible tables can be retained. Review schema changes with Jassim; future schema changes need new ordered migrations.

## 3. Start PHP and React

In terminal 1, from the repository root:

```powershell
php -S 127.0.0.1:8000 -t backend/public backend/router.php
```

In terminal 2:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:5173`. Vite forwards `/api` to `http://127.0.0.1:8000`, so browser cookies and CSRF work on one origin. The health endpoint is `http://127.0.0.1:8000/api/health`; it checks database access too. A database/configuration failure returns a safe error instead of sample data.

Student accounts can register, sign in/out, edit their own profile, and change their password. Sign in with the CLI-provisioned Admin to use the user directory: search/filter/paginate, create, edit, activate/deactivate, and archive accounts. Confirm that records persist after reloading. Student accounts cannot reach Admin operations even by calling the API directly.

For a local Apache/XAMPP configuration, set the PHP document root to `backend/public` with `mod_rewrite` enabled so its `.htaccess` routes `/api/*` to `index.php`. Keep private config/source outside that document root. If Apache runs on another port, update the Vite proxy target to match your local backend.

The PHP built-in server and Vite development server are local development tools. Production should use HTTPS, a supported PHP server, secure cookies, and a single origin with static frontend assets plus `/api` routed to PHP.

## Verification

Build the frontend:

```powershell
cd frontend
npm.cmd run build
npm.cmd test
```

The frontend unit tests cover club API contracts (canonical IDs, status normalization, archival and failures) and the shared API contract: authenticated result writes with `PUT`, CSRF renewal, empty cancellation responses, validation errors and expired sessions.

Run configuration checks and the integration suite from the repository root with PHP and a running MySQL-compatible server configured as above:

```powershell
php backend/tests/configuration.php
node backend/tests/integration.mjs
```

Set `SPORTSHUB_PHP` to a PHP executable path if necessary. The test process creates a random `sportshub_test_<16 hex characters>` database, provisions a temporary Admin with a random password, launches its own PHP server on a free loopback port, exercises real HTTP/database operations, then drops only that test database. The configured database account needs CREATE/DROP DATABASE permissions for this suite. The application's configured database is not used for test records. Session artifacts under `.artifacts/` are ignored by Git.

With this workstation's portable PHP, run from the repository root:

```powershell
& ./.tools/php/php.exe backend/tests/configuration.php
$env:SPORTSHUB_PHP = (Resolve-Path .tools/php/php.exe).Path
node backend/tests/integration.mjs
```

Membership checks cover applications, duplicate/concurrent applications, coach assignments, scoped reads, reviews and lifecycle transitions. Competition checks cover eligibility, entries, league/knockout fixtures, result corrections and standings. The integrated membership and competition screens use these APIs. Sports/training checks cover club CRUD/archival, coach permissions, attendance membership/uniqueness and scoped reads. Announcement checks cover authenticated reads, Admin CRUD, CSRF, pinning and persistence. See the [membership contract](memberships-api.md) and [competition contract](competitions-api.md).

The suite checks registration, login/logout, CSRF, field validation, private-field protection, Student/Admin access, profile persistence, user create/read/update/archive, pagination/search/filtering, password changes, session revocation, and Admin lockout protection. It also checks authenticated resource CRUD, booking ownership, Admin review, facility overlap, equipment stock limits, cancellation, archival, repeatable setup and revoked-account access. The integration suite also starts two separate PHP processes to verify simultaneous facility requests, equipment stock limits and conflicting pending-booking edits. Run the production-build browser workflow suite in tests/browser-workflows.mjs for connected forms, confirmations, mobile layouts and backend-unavailable feedback; see the QA guide for setup.
