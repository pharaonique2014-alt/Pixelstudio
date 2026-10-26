#!/usr/bin/env bash
# Tests SQL : base jetable, shim Supabase, migrations, puis chaque test.
# Variables : PGHOST/PGPORT/PGUSER (défaut 127.0.0.1:54329 postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-54329}" PGUSER="${PGUSER:-postgres}"
DB="${RD_TEST_DB:-rd_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

dropdb --if-exists "$DB"
createdb "$DB"
"${PSQL[@]}" -f tests/sql/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
echo "✔ migrations appliquées"
for t in tests/sql/test_*.sql; do
  "${PSQL[@]}" -f "$t" > /dev/null
  echo "✔ $(basename "$t")"
done
echo "Tous les tests SQL passent."
