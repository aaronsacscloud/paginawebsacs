#!/bin/bash
# uso: sql.sh <archivo.sql>  |  sql.sh -e "select 1"
# Corre SQL contra el Supabase del CRM por la Management API. El token vive en
# paginawebsacs/.supabase-token (gitignored). Devuelve [] si el DML salió bien,
# {"message":…} si falló. Regla: enseñar el SQL antes de correrlo y verificar después.
D=$(cd "$(dirname "$0")" && pwd); T=${TMPDIR:-/tmp}/sql-$$
TOK=$(head -c 200 "$D/../../../.supabase-token")
if [ "$1" = "-e" ]; then printf '%s' "$2" > "$T.sql"; F="$T.sql"; else F="$1"; fi
node -e 'const fs=require("fs");process.stdout.write(JSON.stringify({query:fs.readFileSync(process.argv[1],"utf8")}))' "$F" > "$T.json"
curl -s -X POST "https://api.supabase.com/v1/projects/wtzhogdyicekxcnclmyu/database/query" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" --data @"$T.json"
echo; rm -f "$T.sql" "$T.json"
