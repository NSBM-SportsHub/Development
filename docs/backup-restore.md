# Database backup and restore

The source package includes migrations and reference/demo seeds, not the workstation's accounts or private database contents. Credentials, session files and SQL backups remain outside Git.

## Verified rehearsal

From the repository root with the local database running:

```powershell
$env:SPORTSHUB_PHP = (Resolve-Path .tools/php/php.exe).Path
node backend/tests/backup-restore.mjs
```

On another machine, install PHP with PDO MySQL/mbstring and MySQL/MariaDB client tools. `SPORTSHUB_MYSQLDUMP` and `SPORTSHUB_MYSQL` select client executable paths; the defaults are the portable tools in this checkout or `mysqldump`/`mysql` on PATH. Connection settings use the existing private backend configuration. The rehearsal creates two random `sportshub_test_<16 hex>` databases, applies schema/seeds, inserts synthetic user/resource/booking records, dumps the first database and restores into the second. It compares every table's row count and sorted row fingerprint and reruns schema setup on the restored database. Both test databases are dropped on exit through the existing test-only cleanup guard.

The generated `.artifacts/backup-rehearsal.sql` contains synthetic records only. `.artifacts/backup-restore-evidence.json` records the result and executable-source fingerprint. Neither is a backup of your actual application database.

## Back up real application data when required

Keep the backup private and review whether personal records are allowed in the assessed submission. Use your configured host/port/database/account, not a default password. From the repository root, create `.artifacts/backups/`, then use the database's own dump client. For the documented portable MariaDB instance:

```powershell
New-Item -ItemType Directory -Force .artifacts/backups | Out-Null
& ./.tools/mariadb/mariadb-11.4.13-winx64/bin/mariadb-dump.exe --host=127.0.0.1 --port=3307 --user=root --password --single-transaction --skip-lock-tables --hex-blob --no-tablespaces --result-file=.artifacts/backups/sportshub.sql nsbm_sportshub
```

The client prompts for the database password; it is not an application sign-in password. Use an appropriate restricted backup account outside this isolated development environment. `--result-file` avoids PowerShell changing the SQL encoding through text redirection. Record the source database, dump timestamp and client version in a private handover note.

## Restore a reviewed backup

Restore first to a **new empty database** with a distinct, reviewed name, never over the live application database. Provision that database with UTF-8 settings and appropriate privileges. From the repository root, open the native client with the target database selected:

```powershell
& ./.tools/mariadb/mariadb-11.4.13-winx64/bin/mariadb.exe --host=127.0.0.1 --port=3307 --user=root --password sportshub_restore_review
```

At the database prompt, check the selected database with `SELECT DATABASE();`, then run `SOURCE .artifacts/backups/sportshub.sql;`. A normal dump can contain `DROP TABLE` statements: this is why restoration uses an empty review database. Exit the client, point a separate local application/test configuration at the restored database and verify migrations, key row counts, login, club history, memberships, bookings, attendance and reports. Do not switch the working application to the restored copy until that acceptance is complete. The automated rehearsal above performs the isolated round trip without touching the configured application database.
