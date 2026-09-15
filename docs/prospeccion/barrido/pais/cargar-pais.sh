#!/bin/bash
# cargar-pais.sh <giro> [isos…] -> prep + carga de cuentas + sitios + hijos + carga + repuntuar
# Las cuentas entran `en_pausa`; las enciende la migración de lanzamiento con el OK del dueño.
cd "$(dirname "$0")"; g=$1; shift; SQL=../sql.sh
rm -f sqlout/$g-*-cuentas-*.sql sqlout/$g-pais-hijos-*.sql
python3 carga-pais.py prep $g "$@" 2>&1 | grep -v "^  "
for f in sqlout/$g-*-cuentas-*.sql; do [ -e "$f" ] || continue; r=$($SQL "$f"); [ "$r" = "[]" ] || echo "$f: ${r:0:200}"; done
python3 sitios-pais.py $g "$@" 2>&1 | tail -4
python3 carga-pais.py hijos $g "$@" 2>&1 | tail -1
for f in sqlout/$g-pais-hijos-*.sql; do [ -e "$f" ] || continue; r=$($SQL "$f"); [ "$r" = "[]" ] || echo "$f: ${r:0:200}"; done
# Repuntuar con la fórmula de calcularPuntaje() (abm.lib.ts): el puntaje de la
# carga es provisional; con sitio y canales cargados se vuelve a calcular.
# tiene_email / tiene_wa con la MISMA regla del trigger abm_canales_recontar
# (correo que no sea inválido/rebote; WhatsApp solo declarado o válido).
$SQL -e "with k as (select cuenta_id, bool_or(tipo like 'email%' and estado not in ('invalido','rebote')) em, bool_or(tipo like 'whatsapp%' and estado in ('declarado','valido')) wa from abm_canales group by cuenta_id)
update abm_cuentas a set
  encaje = least(50, 12 + (case when a.sucursales>=2 then 12 else 0 end) + (case when a.sucursales>=5 then 12 else 0 end) + (case when a.sucursales>=15 then 8 else 0 end) + (case when a.sucursales>=30 then 6 else 0 end)),
  dolor = least(50, (case when a.plataforma_web ~* 'shopify|woo|vtex|wix|tiendanube|magento|prestashop|squarespace|shopline' and coalesce(a.sucursales,0)>=2 then 16 else 0 end)
        + (case when a.sitio_http = 0 or a.sitio_http >= 400 then 12 else 0 end) + (case when a.sitio_carrito = false then 8 else 0 end)
        + (case when a.google_rating < 4.5 and a.sucursales >= 3 then 10 else 0 end)),
  accesibilidad = least(25, (case when k.em then 12 else 0 end) + (case when k.wa then 8 else 0 end)),
  tiene_email = coalesce(k.em,false), tiene_wa = coalesce(k.wa,false), updated_at = now()
from (select a2.id, k.em, k.wa from abm_cuentas a2 left join k on k.cuenta_id=a2.id where a2.giro='$g' and a2.pais<>'México') k where k.id=a.id;
update abm_cuentas set puntaje = least(100, coalesce(encaje,0)+coalesce(dolor,0)) where giro='$g' and pais<>'México';" >/dev/null
$SQL -e "select a.pais, count(*) cuentas, count(*) filter (where tiene_email) con_correo, count(*) filter (where tiene_wa) con_wa, count(*) filter (where sitio is not null) con_sitio, round(avg(google_resenas)) resenas_prom from abm_cuentas a where a.giro='$g' and a.pais<>'México' group by 1 order by 2 desc"
