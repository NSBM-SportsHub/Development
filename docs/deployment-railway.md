# Deploy SportsHub on Railway

Use one Railway web service for the built React frontend and PHP API, plus a Railway MySQL service in the same project/environment:

```text
Browser --HTTPS--> SportsHub web service (Apache + React build + PHP /api)
                              |
                              +--private network--> MySQL + persistent volume
```

The multistage root `Dockerfile` builds React with Node, then copies the static build into the PHP/Apache image. A single public origin serves the frontend and `/api`, matching the existing session/CSRF client. Separate frontend proxy settings and a public backend hostname are unnecessary.

## Create the services

1. In Railway, create a project and add **MySQL** using Railway's database template. Keep its persistent volume attached. Use MySQL 8+ compatible with the schema and keep database networking private for normal application access.
2. Add a web service from this repository and select the branch containing the completed implementation. Keep **Root Directory at the repository root**, because the Docker build needs `frontend/`, `backend/` and `database/` together.
3. Use the root `Dockerfile` and `railway.toml`. The current TOML selects Docker, `/api/health` with a 300-second healthcheck timeout, failure retries and one replica. Leave Build/Start Command overrides empty so Docker's commands run.
4. Wait until MySQL is healthy, set the web service variables below, then deploy. Generate a public Railway domain for the **web service** and open its HTTPS URL.

## Web service variables

These references assume the database service is named exactly `MySQL`. If it has another name, choose that service in Railway's variable-reference picker or change the prefix accordingly.

| Variable | Value in Railway |
| --- | --- |
| `SPORTSHUB_ENV` | `production` |
| `SPORTSHUB_SESSION_SECURE` | `1` |
| `SPORTSHUB_APP_KEY` | Your own random value of at least 32 characters; preserve it across redeploys |
| `SPORTSHUB_DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `SPORTSHUB_DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `SPORTSHUB_DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `SPORTSHUB_DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `SPORTSHUB_DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |

Generate an application key locally with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"` and paste it directly into Railway's variable settings. Keep credentials in Railway; the Docker build excludes local `.env`, private PHP configuration, dependencies and build output from the checkout. Do not change the working local `backend/.env` to Railway's private-network host.

Railway injects `PORT`; the startup script configures Apache to listen on it. No manual `PORT` value is normally needed. `SPORTSHUB_SESSION_PATH` defaults to a private writable directory in the image. Optional `SPORTSHUB_DB_SSL_CA` remains available when using a database connection that requires a readable CA certificate file with verified TLS.

## Schema and first Admin

Startup runs `php backend/bin/setup.php --existing-database --reference-seed`. This applies repeatable migrations and reference sports to the database Railway already provisioned, without creating demo clubs or default users. A database connection/setup failure stops startup so the deployment cannot become healthy with a broken database. Set `SPORTSHUB_AUTO_SETUP=0` only when a separate migration process has applied the schema first.

Once the service is running, open an SSH shell **inside the web service container**, using Railway's dashboard-provided SSH command or `railway ssh` after selecting that service. Run:

```sh
cd /var/www/html
php backend/bin/create-admin.php --name="Your Name" --email="your-email@example.com"
```

The command prompts for a password and provisions only the first Admin. Later Admins are managed through the authenticated application. `railway run` executes on your computer with injected variables; it does not put your local computer inside Railway's private network, so use the remote container shell for private MySQL access.

This deployment starts with the hosted database's records. Your workstation's accounts/data are not automatically uploaded. If you need them, make a reviewed backup/import separately; applying schema migrations does not transfer data.

## Persistence and acceptance

MySQL's volume preserves application records. PHP sessions are currently files in the web container: users may need to sign in again after a restart/redeploy. Keep **one web replica** as configured. Shared or persistent session storage is required before scaling across replicas. A dedicated session volume may be added later; do not mount over the application source/build directories.

Before using the hosted system:

- Open `/api/health` on the public web domain and confirm database connectivity.
- Open `/profile`, `/admin/bookings` and other deep links directly and refresh them; React should load normally.
- Sign in and confirm profile/session persistence. Verify HttpOnly/Secure/SameSite cookies over HTTPS without recording cookie values.
- Check membership approval, coach access, training/attendance, booking review, competitions, announcements, notifications and report totals.
- Check direct unauthorized requests and a write without CSRF; API errors must stay JSON rather than returning the React page.
- Confirm the database volume/backups, the deployed branch/commit and the final public URL.

Local verification: `npm.cmd run build --prefix frontend`, `node tests/railway-smoke.mjs`, and the existing QA suites. The smoke test assembles the production public layout and checks static/deep/API routes using PHP's development server; it does not execute Apache rewrite rules or build Docker. Docker/Railway CLI access is unavailable on the current workstation, so the image build and live Railway HTTPS/database behavior still require verification on Railway or a Docker-equipped machine. Nothing has been deployed by these configuration changes.

Official references: [Railway Docker builds](https://docs.railway.com/builds/dockerfiles), [configuration as code](https://docs.railway.com/config-as-code), [MySQL](https://docs.railway.com/databases/mysql), [reference variables](https://docs.railway.com/variables), [healthchecks](https://docs.railway.com/deployments/healthchecks), [CLI/remote SSH](https://docs.railway.com/cli).
