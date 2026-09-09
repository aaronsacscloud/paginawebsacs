#!/bin/bash
# worker.sh <w> <n>  -> procesa las líneas de cola.tsv con (nro % n == w)
cd "$(dirname "$0")"
w=$1; n=$2; i=0
while IFS=$'\t' read -r g q; do
  i=$((i+1)); [ $((i % n)) -ne $w ] && continue
  [ -z "$q" ] && continue
  f="pool-$g/$(echo "$q" | md5sum | cut -c1-10).json"
  [ -s "$f" ] && continue
  timeout 180 node maps.js "$q" 4 > "$f" 2>/dev/null
  echo "[$i] $g | $q -> $(python3 -c "import json;print(len(json.load(open('$f'))))" 2>/dev/null || echo ERR)"
done < cola.tsv
