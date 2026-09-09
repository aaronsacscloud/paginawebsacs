#!/bin/bash
# cargar.sh <giro>  -> prep + carga de cuentas + hijos + carga + verificación
cd "$(dirname "$0")"; g=$1; SQL=./sql.sh
rm -f sqlout/$g-cuentas-*.sql sqlout/$g-hijos-*.sql
python3 giro-carga.py prep $g 2>&1 | sed -n 1,5p
python3 -c "from giros_config import GIROS" || exit 1
for f in sqlout/$g-cuentas-*.sql; do r=$($SQL "$f"); [ "$r" = "[]" ] || echo "$f: ${r:0:200}"; done
python3 giro-carga.py hijos $g 2>&1 | tail -1
for f in sqlout/$g-hijos-*.sql; do r=$($SQL "$f"); [ "$r" = "[]" ] || echo "$f: ${r:0:200}"; done
$SQL -e "select (select count(*) from abm_cuentas where giro='$g') cuentas, (select count(*) from abm_canales k join abm_cuentas b on b.id=k.cuenta_id where b.giro='$g' and k.tipo='telefono') tels, (select count(*) from abm_fuentes where agente like 'carga $g %') fuentes"
