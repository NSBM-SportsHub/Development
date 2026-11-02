# Backend conventions

Owner: Jassim, for database access, validation and responses. Mukilan owns routing, sessions and CSRF. Follow these when adding a PHP module so all modules behave the same. The schema rules are in [database-erd.md](database-erd.md).

## Adding a module

1. Put the code in `backend/src/modules/<module>/` under `namespace SportsHub;`. There is no autoloader, so add each file to `backend/src/shared/bootstrap.php`.
2. Add the routes to `backend/public/index.php`. The membership and competition block is the template: one regex matches the paths, then a map lists the allowed methods for each route. `Http::requireMethod` returns 405 for anything else.
3. Split the code into a **controller** and a **service**:
   - The controller rejects unknown fields (`Validation::allowed`), validates each field, checks roles (`Session::requireAdmin()`) and calls the service.
   - The service holds business rules, queries and transactions, and returns arrays ready to send.
   - `MembershipController`/`MembershipService` is a compact example.
4. Document the endpoints in `docs/<module>-api.md` and add an integration suite in `backend/tests/<module>.mjs`, imported by `integration.mjs`.

## Requests and responses

- The success body is `{"data": ..., "error": null}`. A failure is `{"data": null, "error": {"code", "message", "fields"}}`.
- Status codes:
  - POST create returns 201, GET/PATCH/PUT return 200, and DELETE returns 204 with no body (`Http::noContent()`).
  - 422 for invalid input (`fields` maps each field to a message), 401 when not signed in, and 403 for the wrong role or a missing CSRF token.
  - 404 for missing records and for records the caller may not see. Don't reveal whether something exists.
  - 409 for a state conflict such as a duplicate or an invalid transition. Each conflict has a stable `code`, e.g. `duplicate_application`.
- Throw `ApiException` for every expected failure. The front controller turns `PDOException` into a safe 503 and anything else into a 500, and logs both. Never echo database errors.
- Return timestamps with `Http::timestamp()` as `2026-11-01T09:00:00Z`, and dates as `YYYY-MM-DD`. Cast ids and counts to `int`.

## Validation helpers (`SportsHub\Validation`)

| Helper | Use |
| --- | --- |
| `allowed($data, [...])` | Reject unknown body or query fields |
| `text($data, $field, $max, $required = true)` | Trimmed text. Optional blank text becomes `null`. |
| `id($value, $field)` | Positive JSON integer id |
| `integer($value, $field, $min, $max)` | Bounded JSON integer |
| `choice($value, $field, [...])` | Enum value |
| `date($value, $field)` / `dateTime($value, $field)` | `YYYY-MM-DD` / ISO-8601 with an offset, converted to a UTC `DATETIME` |
| `queryId`, `queryChoice`, `positiveInteger` | Query-string filters and pagination |
| `fail($field, $message)` | Throw a single-field 422 |

A reference that doesn't resolve, such as an unknown or archived club, is a 422 on that field. Check it on the server even when the UI only offers valid choices.

## Database access

- Use `Database::get()` and prepared statements only. Interpolate only validated integers (e.g. `LIMIT`) and constant column names.
- Wrap writes that span several rows in `Database::transaction(fn (PDO $db) => ...)`. Any exception rolls back, including an `ApiException` thrown halfway through.
- Read the rows a decision depends on with `SELECT ... FOR UPDATE` inside the transaction, and always lock in the same order (for example tournament, then entry or match) to avoid deadlocks.
- Back duplicate checks with a unique index, and map the index error (`Database::isDuplicateKey`) to the same 409. The index is what stops two simultaneous requests.
