#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
backup_dir="${1:?Usage: scripts/verify-restore.sh backup-directory}"
sha256sum -c "$backup_dir/SHA256SUMS"
restore_db="pta_restore_$(date +%s)"
cleanup() { docker compose exec -T db dropdb -U pta --if-exists "$restore_db" >/dev/null; }
trap cleanup EXIT
docker compose exec -T db createdb -U pta "$restore_db"
docker compose exec -T db pg_restore -U pta -d "$restore_db" --no-owner --exit-on-error < "$backup_dir/database.dump"
docker compose exec -T db psql -U pta -d "$restore_db" -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS examinations FROM exams; SELECT count(*) AS revisions FROM revisions; SELECT count(*) AS files FROM files;'
restore_dir=$(mktemp -d)
tar -xzf "$backup_dir/files.tar.gz" -C "$restore_dir"
find "$restore_dir" -type f | wc -l
rm -rf "$restore_dir"
printf 'Database and files restored successfully in isolation.\n'
