#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: scripts/verify-backup-restore.sh /path/to/backup.dump.age /path/to/age-identity.txt" >&2
  exit 2
fi

backup_file=$1
identity_file=$2
temporary_dump=$(mktemp "${TMPDIR:-/tmp}/kitchen-companion-restore.XXXXXX.dump")
trap 'rm -f "$temporary_dump"' EXIT

age --decrypt --identity "$identity_file" --output "$temporary_dump" "$backup_file"
pg_restore --list "$temporary_dump" >/dev/null
echo "Backup decrypted and the PostgreSQL archive catalogue is readable."
