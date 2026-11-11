# Shahilan: reproduce the API verification

Use the reviewed source containing the API fixes and verification runners. Run commands from the repository root. This guide is for local development only. The 9 November report establishes the original database name (`nsbm_sportshub`), but does not establish its MySQL host or port. PHP's HTTP port 8000 is separate from the MySQL port. Do not assume that phpMyAdmin and PHP select the same server/database.

## Confirm the original environment

Keep the existing private `backend/.env`. Do not copy `.env.example` over it. With MySQL/MariaDB running and PHP 8.2+ (`pdo_mysql`, `mbstring`) and Node.js installed:

```powershell
# Use this checkout's portable PHP, or replace with your installed PHP executable.
$env:SPORTSHUB_PHP = (Resolve-Path .tools/php/php.exe).Path
node backend/tests/api-verification.mjs --inspect
```

The inspection is read-only. It reports resolved environment, database host/port/name, actual selected database/server port, column types and table row/schema fingerprints. It never prints database credentials or record contents. It refuses non-loopback or production configuration. Settings resolve as defaults < private `config/local.php` < `backend/.env` < process environment. Compare with the reviewed workstation: `127.0.0.1:3307/nsbm_sportshub`, 17 tables. A database with the same name on another port is a different instance.

For a PHP server that was already running, a separate CLI process cannot prove that server's inherited settings. Stop your own PHP development server, run the inspection in that terminal, and start PHP from the same terminal without changing its environment:

```powershell
& $env:SPORTSHUB_PHP -S 127.0.0.1:8000 -t backend/public backend/router.php
```

In phpMyAdmin's SQL tab, check the selected server too:

```sql
SELECT DATABASE() AS selected_database, @@hostname AS server_host, @@port AS server_port;
SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME;
SHOW CREATE TABLE clubs;
```

Retain these results and PHP errors privately. If `clubs` has incompatible columns/types/indexes, or tables use an unexpected engine, stop before setup. Existing setup validates compatibility and does not repair old tables automatically.

## Verify a usable backup before repairing an affected database

Only do this when the affected local database has been positively identified. Pause writes in that test environment for a stable comparison. Keep backups out of Git. The `.artifacts/backup-rehearsal.sql` file is synthetic test evidence, not a backup of Shahilan's data.

Capture the read-only inspection:

```powershell
New-Item -ItemType Directory -Force .artifacts/backups | Out-Null
$sourceSnapshot = node backend/tests/api-verification.mjs --inspect | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Database inspection failed.' }
$backupUser = Read-Host 'MySQL backup username'
$backupPath = Join-Path (Resolve-Path .artifacts/backups).Path 'affected-test-database.sql'
if (Test-Path -LiteralPath $backupPath) { throw 'Choose a new backup filename; preserve existing backups.' }
$dumpTool = (Resolve-Path .tools/mariadb/mariadb-11.4.13-winx64/bin/mariadb-dump.exe).Path
$backupArgs = @("--host=$($sourceSnapshot.host)", "--port=$($sourceSnapshot.port)", "--user=$backupUser", '--password', '--single-transaction', '--skip-lock-tables', '--skip-add-drop-table', '--hex-blob', '--no-tablespaces', "--result-file=$backupPath", $sourceSnapshot.database)
& $dumpTool @backupArgs
if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $backupPath).Length -eq 0) { throw 'Backup failed; do not migrate.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath
```

Use the equivalent installed `mysqldump` if portable tools are unavailable. `--password` prompts without placing a password in the command. These snapshot options require transactional/InnoDB tables and no concurrent schema changes.

Verify usability by restoring that dump into a **new, uniquely named, empty local review database**. Create it with `CREATE DATABASE <review_name> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` (without `IF NOT EXISTS`, so an existing name causes a stop), then connect the native SQL client explicitly to that review database and run `SOURCE C:/absolute/path/to/affected-test-database.sql;`. The dump above excludes DROP TABLE statements. Never import it into the source/working database.

In a separate terminal, temporarily set `SPORTSHUB_DB_NAME` to that review database, run `--inspect` and compare its `tables` object with `$sourceSnapshot.tables`, including column types, every row count, row fingerprint and schema fingerprint. A complete match establishes a usable round trip. Remove the temporary override afterward. Stop if restoration or comparison fails; no migration is justified by an unverified backup.

## Apply only missing schema objects when necessary

The supported setup reads all ordered migration files 001-009 and uses `CREATE TABLE IF NOT EXISTS`. It has no migration-version ledger or option for selecting individual unapplied files. On a compatible partial database, existing tables are preserved and only missing tables are created. Dependencies already have the correct order.

After a verified backup and confirmation that the source configuration again selects the affected local database:

```powershell
& $env:SPORTSHUB_PHP backend/bin/setup.php --existing-database
if ($LASTEXITCODE -ne 0) { throw 'Setup stopped; review the compatibility error before further changes.' }
node backend/tests/api-verification.mjs --inspect
```

Do not use demo seeds as a repair. Do not modify an applied migration, drop tables, reset a database, disable foreign keys or overwrite records. A compatibility error requires schema review before changes. The current reviewed workstation already has all 17 tables and needs no repair.

## Execute the automated verification

```powershell
# All 83 operation workflows plus permissions, persistence and concurrency regression.
node backend/tests/integration.mjs

# Original report's 15 failures and 22 passing cases, with two synthetic accounts.
# Pick a free port, leaving your working API on 8000 alone.
$env:SPORTSHUB_API_PORT = '8001'
node backend/tests/api-verification.mjs

& $env:SPORTSHUB_PHP backend/tests/configuration.php
```

Both HTTP runners create new random fixture databases on the configured local database server, run the existing setup workflow there, start their own PHP workers and retain the databases. They read and fingerprint the configured working database without putting test records into it. They do not repair or retest Shahilan's original four-table database. Restarting the original API and performing the same requests in Postman is still necessary to establish that the original environment has recovered.

Evidence is written under `.artifacts/api-operations-<suffix>/` (83-operation table, scenario results, server logs) and `.artifacts/api-verification/<suffix>/` (37-case table, JSON and server log). Check exit codes, every expected/actual status and backend errors. Correct 401/403/404/405/422 outcomes are passes in negative tests. Missing CSRF, malformed JSON and duplicate requests must not be confused with server failures. Refresh `/api/auth/session` after password/email changes, which rotate credentials.

Do not commit passwords, cookies, CSRF values, private logs or SQL dumps. Retained databases contain synthetic accounts with generated passwords that are not printed; they are for local inspection and are never selected by the application's unchanged `.env`.
