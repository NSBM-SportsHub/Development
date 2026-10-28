# NSBM SportsHub frontend

This branch implements Mukilan's authentication/users screens in React with a real PHP/MySQL API. See [local setup](../docs/local-development.md), the [API contract](../docs/auth-users-api.md), and [team allocation](../README.md).

## Start locally

Node.js 22.12+ and npm are required. Initialize the database and start PHP using the setup guide, then run from frontend/:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173. Vite proxies browser requests to /api to http://127.0.0.1:8000. Keep the browser on the React origin so session cookies and CSRF work together. PHP and MySQL/MariaDB must be running; unavailable services display a retryable error.

```powershell
npm.cmd run build
```

The build writes the ignored dist/ directory. Vite preview uses the same local API proxy; production needs a real same-origin /api route to PHP.

## Implemented routes

| Route | Behavior |
| --- | --- |
| /login | Email/password sign-in |
| /register | Active Student registration |
| /profile | Signed-in profile editing and password change |
| /admin/users | Admin search, filters, pagination, create, edit, activate/deactivate, archive |

The first Admin is created through backend/bin/create-admin.php. There are no default credentials. PHP enforces every protected action independently of frontend navigation.

## Integration files

- src/App.jsx: routing and protected screens.
- src/shared/api.js: JSON transport, cookies, CSRF, safe API/network errors.
- src/shared/AuthContext.jsx: server session, sign-in/out, refresh.
- src/modules/authentication-users/: auth/profile forms and Admin CRUD dialogs.
- src/shared/styles.css: responsive presentation for this module; coordinate shared UI with Shahadh.

No authentication values are stored in localStorage. Validation failures retain form input; writes are disabled while saving; archive requires confirmation. Loading, empty, failure, and retry states are shown.

Reuse the shared API client and session conventions for partner screens. Public registration cannot choose a role. Admin creation supports Student/Admin; Coach permissions remain pending agreement.

Other business modules remain placeholders on this branch. Shahilan's screens are in his separate feature branch until reviewed and integrated. Refer to the root README for all module owners.
