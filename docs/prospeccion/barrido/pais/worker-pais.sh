#!/bin/bash
# worker-pais.sh <giro> <w> <n> -> las líneas de cola-<giro>.tsv con (nro % n == w)
cd "$(dirname "$0")"
g=$1; w=$2; n=$3; i=0
while IFS=$'\t' read -r iso q; do
  i=$((i+1)); [ $((i % n)) -ne $w ] && continue
  [ -z "$q" ] && continue
  gl=$(python3 -c "from paises import PAISES;print(PAISES['$iso']['gl'])")
  f="pool-$iso-$g/$(echo "$q" | md5sum | cut -c1-10).json"
  [ -s "$f" ] && continue
  timeout 180 node maps-pais.js "$q" "$gl" 4 > "$f" 2>/dev/null
  echo "[$i] $iso | $q -> $(python3 -c "import json;print(len(json.load(open('$f'))))" 2>/dev/null || echo ERR)"
done < "cola-$g.tsv"
