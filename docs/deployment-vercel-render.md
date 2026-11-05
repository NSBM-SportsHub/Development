# Deploy SportsHub: Vercel frontend and Render backend

The repository is prepared for this architecture:

```text
Browser -> Vercel (React, HTTPS)
             /api/* -> Render (PHP/Apache Docker) -> hosted MySQL
```

The browser always calls relative `/api` URLs. Vercel forwards those requests to Render through a rewrite, preserving the browser's frontend origin for session cookies and CSRF. Do not replace the shared client with cross-origin backend calls. Confirm login/cookie forwarding on the real deployment before acceptance.

## Database

Use MySQL 8+ or compatible MariaDB, not Render Postgres. Either supply a separately hosted MySQL database or create MySQL as a Render private service with a persistent disk. Render's MySQL option and persistent disks require an appropriate paid service; the backend's free web-service plan does not provide persistent database storage.

Create the database before starting the backend. Configure its host, port, database name, user and password as Render environment variables. Use the provider's CA certificate when it requires verified TLS: upload the CA as a Render secret file and set `SPORTSHUB_DB_SSL_CA` to that file's absolute path. The client verifies the database certificate when a CA is configured. No secrets belong in Git or `frontend/`.

## Render backend

1. Push the reviewed feature branch to GitHub when ready and connect that branch to Render.
2. Create a Blueprint from root `render.yaml`, or create a Docker Web Service using root `Dockerfile` and repository root as Docker context. The API service is named `sportshub-api`; record its **actual assigned URL**.
3. Set `SPORTSHUB_DB_HOST`, `SPORTSHUB_DB_PORT`, `SPORTSHUB_DB_NAME`, `SPORTSHUB_DB_USER`, and `SPORTSHUB_DB_PASSWORD`. Set `SPORTSHUB_DB_SSL_CA` if required. The Blueprint generates `SPORTSHUB_APP_KEY` and sets production mode with secure cookies. Preserve that key across deployments.
4. Startup runs `php backend/bin/setup.php --existing-database --reference-seed`, applying the ordered, repeatable migrations and reference sports without creating a database or demo clubs. Set `SPORTSHUB_AUTO_SETUP=0` if a separate trusted migration process applies them first. The application account needs the schema permissions used by setup; a separate migration/runtime-account arrangement can be used after setup.
5. The container listens on Render's `PORT`, defaulting to 10000. Its document root exposes only `backend/public`; source, environment settings and database files are outside it. `/api/health` must return healthy database access.
6. Provision the first Admin with `php backend/bin/create-admin.php --name="Your Name" --email="your-email"`, using a trusted shell with database access. Use Render's shell if your plan supports it, or run the command locally with private environment settings pointing at an accessible hosted database. The command prompts for the password. No default Admin account is shipped.

The web-service filesystem is ephemeral. PHP sessions use files, so a restart/redeploy may require signing in again; application records live in MySQL. Keep the backend on one instance with this session setup. Persistent/shared session storage is needed before horizontal scaling. A free Render web service spins down after inactivity, which adds a cold start to the next API request. Choose a suitable always-on plan for a dependable presentation if needed.

## Vercel frontend

1. Set the actual Render origin in the checked-in rewrite configuration:

   ```powershell
   node scripts/configure-vercel.mjs https://your-actual-api.onrender.com
   ```

   The shipped `.invalid` placeholder sends no traffic to an unrelated service. Vercel's configured build command rejects it until you supply the URL Render actually assigns. Commit the resulting `frontend/vercel.json` before deploying.

2. Import the repository into Vercel with **Root Directory `frontend`**, framework Vite, install command `npm ci`, the build command from `vercel.json` (`node scripts/check-deployment.mjs && npm run build`), and output directory `dist`. Use Node 22.12+ supported by the configured Vite version.
3. Deploy the reviewed branch. `frontend/vercel.json` forwards `/api/*` to Render before applying the React route fallback. Browser refreshes on `/profile`, `/admin/bookings`, and other client routes must work.
4. No database passwords or application keys are needed in Vercel frontend environment settings. Keep session traffic uncached; the backend sends `Cache-Control: no-store`.

## Deployment acceptance

- Check `/api/health` through the **Vercel domain**, not just the Render URL.
- Register and sign in from the Vercel URL. Confirm the session survives route changes and refresh. Inspect HttpOnly/Secure/SameSite cookies without recording their values.
- Edit a profile and verify persistence after a separate read.
- Exercise membership approval, coach assignment/training/attendance, booking review, competition results, notifications, and report totals with temporary demonstration records.
- Verify denied Student/Admin/coach requests directly against the deployed API and check a missing-CSRF write.
- Check desktop/mobile views and API failure/retry. Verify HTTPS and deep-link refreshes.
- Make a database backup and record the deployed branch/commit and URLs. Remove temporary demonstration records through normal archival/cancellation policies.

Code and local checks cannot certify cloud cookie forwarding, provider TLS/network settings, free-service cold starts or a deployment that has not been provisioned. Docker is unavailable on the current workstation, so the container build remains to be verified by Render or a Docker-equipped machine. No live deployment has been performed by this implementation.

Primary platform references: [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Render Docker](https://render.com/docs/docker), [Render MySQL](https://render.com/docs/deploy-mysql), [Render persistent disks](https://render.com/docs/disks), [Render free-service behavior](https://render.com/docs/free).
