# Backup Setup (GitHub Actions → Google Drive)

This document explains how the repository's `Database Backup` workflow works, what secrets and cloud setup it needs, how to verify produced `.backup` files, and how to restore them to a Supabase project.

**Files**

- Workflow: `.github/workflows/db-backup.yml`
- This doc: `docs/backup-setup.md`

## What the workflow does

- Runs nightly (or on-demand) in GitHub Actions.
- Uses `pg_dump -Fc` to create a custom-format Postgres dump, compresses it (`.dump.gz`).
- Decompresses to produce a `.backup` file (valid when the original is a custom-format archive).
- Uploads the `.backup` to Google Drive using `rclone` and a service-account JSON.

## Prerequisites

- Supabase project with a Postgres DB.
  - **For general use**, the **Session (pooler)** connection string is a fine alternative (e.g., to avoid IPv6 issues).
  - **For this backup workflow**, use the direct (non-pooler) connection string for `SUPABASE_DB_URL` (see below).
  - If server is Postgres 17.x, ensure pg client v17 is used by the workflow (already handled in the workflow).
- Google Cloud service account with Drive access to the target Drive/folder.
- GitHub repo admin access to add Actions secrets.

## Required GitHub Secrets

- `SUPABASE_DB_URL` — Postgres connection string for the source DB with access to **auth** schema. **Must use the direct (non-pooler) connection string** from Supabase Database settings so `pg_dump` can directly access `auth.users`/`auth.identities`. (Pooler connections do not reliably expose the auth schema to backup tools.) Use the direct connection in the format below:

```
postgresql://postgres:<PASSWORD>@db.<project>.supabase.co:5432/postgres?sslmode=require
```

The workflow explicitly dumps `auth`, `public`, `storage`, `graphql_public`, and `extensions` schemas and fails if `auth.users` or `auth.identities` are missing in the archive. If you see failures, double-check the DB URL and role permissions.

- `GDRIVE_SERVICE_ACCOUNT_JSON` — full JSON contents of the Google service account key. (Do NOT commit this to source control.)

Add via GitHub UI: Repository → Settings → Secrets and variables → Actions → New repository secret.

Or with the `gh` CLI (example):

```bash
gh secret set SUPABASE_DB_URL --body "$(cat supabase-uri.txt)" --repo OWNER/REPO
gh secret set GDRIVE_SERVICE_ACCOUNT_JSON --body "$(cat service-account.json)" --repo OWNER/REPO
```

## Create and configure Google Service Account (high level)

1. In Google Cloud Console, enable the **Google Drive API** for your project.
2. Create a Service Account (IAM & Admin → Service Accounts).
3. Create and download a JSON key for the service account.
4. Share the target Drive folder (or Shared Drive) with the service account email and grant appropriate permissions (Content manager/editor).
   - For Shared Drive, add the service account as a member of the Shared Drive.

## Run the workflow manually (verify)

- In GitHub: Actions → Database Backup → Run workflow (choose branch and click Run).
- Watch logs for steps:
  - `pg_dump` (produces `dumps/backup-<timestamp>.dump.gz`)
  - `Convert .dump.gz -> .backup` (produces `.backup`)
  - `Install rclone` and `Upload .backup to Google Drive`
- After success, check Google Drive → `Backups/<YourProjectName>` for the uploaded file (adjust path based on your workflow configuration).

## Verify `.backup` is valid custom-format archive

(Use Docker if you don't have `pg_restore` locally.)

```bash
# List archive contents to verify format (Docker)
docker run --rm -v "$PWD":/backups -w /backups postgres:17 \
  pg_restore --list /backups/dumps/your-backup.backup
```

- If `pg_restore --list` prints object list, the file is a valid custom-format archive suitable for Supabase UI or `pg_restore`.
- If it errors, the file may be plain SQL text; see conversion section below.

## Restore to a Supabase project (recommended: staging)

Use the Session-mode pooler URI for the target Supabase project. Prefer testing on a non-production project first.

Docker method (no local client install):

```bash
# Restore (adjust URI and filename)
docker run --rm -v "$PWD":/backups -w /backups postgres:17 \
  pg_restore --verbose --clean --if-exists --no-owner --dbname "postgresql://postgres:<PASSWORD>@<pooler-host>:5432/postgres?sslmode=require" /backups/dumps/your-backup.backup
```

WSL / Ubuntu (install pg_restore v17):

```bash
# install pg client v17 (once)
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc
sudo apt-get update
sudo apt-get install -y postgresql-client-17

# restore
pg_restore --verbose --clean --if-exists --no-owner --dbname "$TARGET_DB_URL" dumps/your-backup.backup
```

Windows (native install): install PostgreSQL 17 tools and run similar `pg_restore` commands in PowerShell.

Important flags:

- `--clean --if-exists`: drops existing objects before recreating.
- `--no-owner`: skip restoring ownership (useful on managed hosts like Supabase).

## Convert a plain SQL dump to custom-format `.backup`

If your `backup.dump` is actually plain SQL (not custom format), convert using a temporary Postgres instance and re-dump:

```bash
# Start temporary Postgres 17 container
docker run -d --name tmp-pg -e POSTGRES_PASSWORD=pass -p 5433:5432 postgres:17

# Import SQL (if dump is plain text)
cat backup.dump | docker exec -i tmp-pg psql -U postgres -d postgres

# Create custom-format backup in container
docker exec tmp-pg pg_dump -U postgres -Fc -f /backup.custom.backup postgres

# Copy out
docker cp tmp-pg:/backup.custom.backup ./backup.backup

# Cleanup
docker rm -f tmp-pg
```

Then validate with `pg_restore --list backup.backup`.

## Common errors & fixes

- "Network is unreachable" / IPv6-only host:
  - Use the Session-mode pooler URI (Supabase Dashboard → Connection string → Mode = Session) which has IPv4.
- `pg_dump`/`pg_restore` version mismatch:
  - Use Postgres client matching server major version (17.x). The workflow installs Postgres 17 client.
- Service account permission errors:
  - Confirm the service account has Drive access or is a member of the Shared Drive.
- `pg_restore` errors about extensions or roles:
  - Some extensions/roles require manual handling; restore core objects first and handle extensions separately.

## Optional improvements

- Rotate and delete old Drive files using `rclone delete` or `rclone lsjson` + date filtering.
- Upload to other storage backends (S3, Supabase Storage) if preferred.
- Add automated restore-to-staging job (needs target DB secret).

## Security notes

- Never commit secrets (DB URIs, service account JSON) to the repo.
- Use repo or org-level encrypted Actions secrets and rotate keys periodically.

---

If you want, I can:

- Add a `scripts/restore.sh` and `scripts/restore.ps1` helper in the repo.
- Add an automatic verification step to the workflow that fails when the produced `.backup` is not a custom-format archive and then tries the Docker conversion flow.

Which of the two would you like me to add next?
