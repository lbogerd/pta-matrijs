#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
backup_dir="${1:-backups/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$backup_dir"
docker compose exec -T db pg_dump -U pta -d pta -Fc > "$backup_dir/database.dump"
docker compose exec -T web tar -C /app/storage -czf - . > "$backup_dir/files.tar.gz"
sha256sum "$backup_dir/database.dump" "$backup_dir/files.tar.gz" > "$backup_dir/SHA256SUMS"
printf 'Backup saved to %s\n' "$backup_dir"
