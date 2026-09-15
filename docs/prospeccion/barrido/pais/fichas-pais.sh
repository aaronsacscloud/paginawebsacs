#!/bin/bash
# fichas-pais.sh <giro> [workers] — abre la FICHA de cada lugar único de los pools
# (teléfono con código de país, web, reseñas, categoría) y la guarda en
# ficha-<iso>/<md5 de la url>.json. Se puede relanzar: se salta las que ya existen.
cd "$(dirname "$0")"
g=$1; N=${2:-4}
python3 - "$g" > "fichas-$g.tsv" <<'PY'
import json, glob, sys, os, hashlib
g = sys.argv[1]; vistos = set()
for pool in sorted(glob.glob(f'pool-*-{g}')):
    iso = pool.split('-')[1]
    os.makedirs(f'ficha-{iso}', exist_ok=True)
    for f in glob.glob(pool + '/*.json'):
        try: lugares = json.load(open(f))
        except Exception: continue
        for l in lugares:
            u = l.get('url'); 
            if not u or u in vistos: continue
            vistos.add(u); print(f'{iso}\t{u}')
PY
echo "$(wc -l < fichas-$g.tsv) fichas por abrir"
for w in $(seq 0 $((N-1))); do (
  i=0
  while IFS=$'\t' read -r iso u; do
    i=$((i+1)); [ $((i % N)) -ne $w ] && continue
    f="ficha-$iso/$(echo "$u" | md5sum | cut -c1-12).json"
    [ -s "$f" ] && continue
    timeout 120 node lugar-pais.js "$u" US > "$f" 2>/dev/null
    echo "[$i] $iso $(python3 -c "import json;d=json.load(open('$f'));print(d.get('name'),d.get('phone'),d.get('reviews'))" 2>/dev/null || echo ERR)"
  done < "fichas-$g.tsv"
) > "log-ficha-$g-w$w.txt" 2>&1 & done
wait
date > "fichas-fin-$g.txt"
