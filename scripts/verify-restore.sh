#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
backup_dir="${1:?Usage: scripts/verify-restore.sh backup-directory}"
backup_dir="$(realpath "$backup_dir")"
command -v python3 >/dev/null
restore_db="pta_restore_$(date +%s)_${RANDOM}"
restore_dir="$(mktemp -d)"
restore_created=false
cleanup() {
  if "$restore_created"; then docker compose exec -T db dropdb -U pta --if-exists "$restore_db" >/dev/null || true; fi
  rm -rf -- "$restore_dir"
}
trap cleanup EXIT
# Resolve only the two expected artifact basenames, so a moved backup still works.
python3 - "$backup_dir" <<'PY'
import hashlib, pathlib, sys
root=pathlib.Path(sys.argv[1]); expected={}
for line in (root/'SHA256SUMS').read_text().splitlines():
    digest, name=line.split(maxsplit=1)
    name=pathlib.Path(name.lstrip('*')).name
    if name not in ('database.dump','files.tar.gz') or name in expected:
        raise SystemExit('Unexpected or duplicate checksum entry')
    expected[name]=digest
if set(expected)!={'database.dump','files.tar.gz'}:
    raise SystemExit('Missing backup checksum')
for name,digest in expected.items():
    with (root/name).open('rb') as source:
        actual=hashlib.file_digest(source,'sha256').hexdigest()
    if actual!=digest: raise SystemExit(f'Checksum mismatch: {name}')
print('Backup artifact checksums verified.')
PY
docker compose exec -T db createdb -U pta "$restore_db"
restore_created=true
docker compose exec -T db pg_restore -U pta -d "$restore_db" --no-owner --exit-on-error < "$backup_dir/database.dump"
docker compose exec -T db psql -U pta -d "$restore_db" -v ON_ERROR_STOP=1 -Atc 'SELECT COALESCE(json_agg(f), '\''[]'\''::json) FROM (SELECT id,exam_id,path,mime FROM files ORDER BY id) f;' > "$restore_dir/file-records.json"
python3 - "$backup_dir/files.tar.gz" "$restore_dir" <<'PY'
import hashlib, json, pathlib, shutil, sys, tarfile
archive=pathlib.Path(sys.argv[1]); temporary=pathlib.Path(sys.argv[2]); target=temporary/'files';target.mkdir()
expected={}
with tarfile.open(archive,'r:gz') as source:
    for member in source:
        relative=pathlib.PurePosixPath(member.name)
        if relative.is_absolute() or '..' in relative.parts:
            raise SystemExit('Unsafe path in files archive')
        if member.isdir(): continue
        if not member.isfile(): raise SystemExit('Only regular files are allowed in private storage')
        if len(relative.parts)!=1: raise SystemExit('Unexpected nested private storage path')
        name=relative.name
        if name in expected: raise SystemExit('Duplicate archive file')
        archived=source.extractfile(member)
        digest=hashlib.sha256()
        with (target/name).open('xb') as output:
            while chunk:=archived.read(1024*1024):
                digest.update(chunk);output.write(chunk)
        expected[name]=digest.hexdigest()
for name,digest in expected.items():
    with (target/name).open('rb') as restored:
        if hashlib.file_digest(restored,'sha256').hexdigest()!=digest:
            raise SystemExit('Restored file bytes differ from archive')
records=json.loads((temporary/'file-records.json').read_text())
seen=set()
for record in records:
    original=pathlib.PurePosixPath(record['path'])
    if not original.is_absolute() or original.name!=record['id']:
        raise SystemExit('Private file database path does not match its identifier')
    if record['id'] in seen: raise SystemExit('Duplicate private file reference')
    seen.add(record['id'])
    if original.name not in expected:
        raise SystemExit(f"Database references missing private file: {record['id']}")
    restored=target/original.name
    with restored.open('rb') as content: header=content.read(8)
    valid={'image/png':header==b'\x89PNG\r\n\x1a\n','image/jpeg':header[:3]==b'\xff\xd8\xff','application/pdf':header[:5]==b'%PDF-'}
    if not valid.get(record['mime'],False):
        raise SystemExit(f"Restored file type mismatch: {record['id']}")
print(f"Verified {len(records)} database file references and {len(expected)} restored files byte-for-byte.")
PY
# These checks operate only on the restored database. The dump checksum protects
# every historical JSON snapshot; hashes below make selected snapshots auditable.
docker compose exec -T db psql -U pta -d "$restore_db" -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM exams e WHERE e.version<>(e.payload->>'version')::int) THEN RAISE EXCEPTION 'Optimistic version mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM exams e WHERE e.locked_n_term IS NOT NULL AND (e.payload->>'nTerm' IS DISTINCT FROM e.locked_n_term OR e.payload->'nTermLock'->>'value' IS DISTINCT FROM e.locked_n_term)) THEN RAISE EXCEPTION 'Locked N-term mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM exams e WHERE NOT EXISTS(SELECT 1 FROM revisions r WHERE r.exam_id=e.id AND r.version=e.version AND r.payload=e.payload)) THEN RAISE EXCEPTION 'Current immutable revision missing'; END IF;
 IF EXISTS(SELECT 1 FROM exams e CROSS JOIN LATERAL jsonb_array_elements(e.payload->'snapshots') s WHERE s->>'releasedAt' IS NOT NULL AND (s->'content'->>'id' IS DISTINCT FROM e.id OR s->'content'->>'nTerm' IS DISTINCT FROM e.locked_n_term OR jsonb_array_length(s->'grades') <> (s->>'maxScore')::int + 1)) THEN RAISE EXCEPTION 'Released snapshot integrity mismatch'; END IF;
END $$;
SELECT count(*) AS examinations FROM exams;
SELECT count(*) AS revisions FROM revisions;
SELECT e.id, s->>'revision' AS released_revision, encode(sha256(convert_to(s::text,'UTF8')),'hex') AS restored_snapshot_fingerprint FROM exams e CROSS JOIN LATERAL jsonb_array_elements(e.payload->'snapshots') s WHERE s->>'releasedAt' IS NOT NULL ORDER BY e.id, (s->>'revision')::int;
SQL
printf 'Database, historical snapshots and private files verified in isolation; temporary copies will be removed.\n'
