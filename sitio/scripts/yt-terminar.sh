#!/usr/bin/env bash
# Termina lo que quedó pendiente en el canal de YouTube cuando reinicia la cuota.
#
# POR QUÉ EXISTE
# La cuota diaria de la API son 10,000 unidades y cada `videos.update` cuesta 50:
# doscientos videos por día como tope duro. El 18-sep-2026 se agotó con 6 videos
# por aplicar y 1 por ocultar. Esta rutina los termina sola en cuanto la cuota
# vuelve, en vez de depender de que alguien se acuerde.
#
# CUÁNDO CORRE
# 07:15 UTC = 00:15 del Pacífico, que es donde Google reinicia la cuota. El
# cuarto de hora de margen es a propósito: el reinicio no es instantáneo al
# segundo y un intento demasiado pronto se come un fallo por nada.
#
# SE APAGA SOLA
# Si al terminar no queda nada pendiente, se quita del crontab. Una rutina que
# sigue corriendo después de haber hecho su trabajo es ruido que alguien va a
# tener que ir a limpiar dentro de seis meses sin saber qué era.
#
# Correrla a mano es seguro y hace lo mismo:  bash scripts/yt-terminar.sh
set -uo pipefail

SITIO=/opt/sacs/paginawebsacs/sitio
LOG=/home/aaron/yt-terminar.log
NODE=/tmp/node-v22.12.0-linux-x64/bin
OCULTAR=            # ya está oculto

di() { echo "[$(date -u +'%Y-%m-%d %H:%M UTC')] $*" >> "$LOG"; }

cd "$SITIO" || { di "no existe $SITIO"; exit 1; }

# Node 22 vive en /tmp y /tmp se puede limpiar al reiniciar el servidor. Si no
# está, se dice en vez de fallar con un «command not found» que no explica nada.
if [ ! -x "$NODE/node" ]; then
  di "FALTA Node 22 en $NODE — se borró /tmp. Hay que volver a bajarlo antes de correr esto."
  exit 1
fi
export PATH="$NODE:$PATH"

di "─── arranque ───"

# ── 1. lo que falte por aplicar ─────────────────────────────────────────────
# El script es idempotente: salta lo que ya coincide, así que esto es seguro
# aunque no quede nada. En seco primero, para dejar escrito qué se va a tocar.
SALIDA=$(node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
  scripts/yt-aplicar.mjs --dry --saltar-revisar 2>&1)
SECO=$(echo "$SALIDA" | grep -E "cambiarían|al día" || true)

# «No pude comprobar» NO es «no hay nada pendiente». Con la cuota agotada el
# ensayo en seco no imprime nada, y la primera versión de esto lo leía como cero
# pendientes — que habría bastado para que la rutina se quitara del crontab
# dejando los seis videos sin aplicar PARA SIEMPRE, y diciendo en la bitácora
# que había terminado bien. Un trabajo automático que no distingue esas dos
# cosas es peor que no tener trabajo automático.
if echo "$SALIDA" | grep -qi "exceeded your\|Error al leer\|quota"; then
  di "la cuota sigue agotada; no se toca nada y se reintenta mañana"
  di "─── fin ───"
  exit 0
fi

di "en seco: ${SECO:-sin salida}"
PENDIENTES=$(echo "$SECO" | grep -oE '^[0-9]+' | head -1)
PENDIENTES=${PENDIENTES:-0}

if [ "$PENDIENTES" -gt 0 ]; then
  RES=$(node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
    scripts/yt-aplicar.mjs --saltar-revisar 2>&1 | grep -E "actualizados|FALLÓ" || true)
  di "aplicado: ${RES:-sin salida}"
else
  di "no quedaba nada por aplicar"
fi

# ── 2. el video que hay que ocultar ─────────────────────────────────────────
# `|| true` en todo: que falle ocultar no debe impedir que la rutina cierre bien
# ni que se apague sola.
if [ -n "$OCULTAR" ]; then
  OC=$(node scripts/yt-ocultar.mjs "$OCULTAR" 2>&1 | tail -2 || true)
  di "ocultar $OCULTAR: $(echo "$OC" | tr '\n' ' ')"
  # Si ya estaba privado o se logró, se deja de intentar en las próximas vueltas.
  if echo "$OC" | grep -q "private"; then
    sed -i 's/^OCULTAR=.*/OCULTAR=            # ya está oculto/' "$SITIO/scripts/yt-terminar.sh" || true
    di "ya quedó oculto; no se vuelve a intentar"
  fi
fi

# ── 3. ¿terminó? ────────────────────────────────────────────────────────────
FIN=$(node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
  scripts/yt-aplicar.mjs --dry --saltar-revisar 2>&1)
if echo "$FIN" | grep -qi "exceeded your\|Error al leer\|quota"; then
  di "no se pudo comprobar el cierre (cuota). Se deja el cron puesto."
  di "─── fin ───"
  exit 0
fi
FALTA=$(echo "$FIN" | grep -oE '^[0-9]+' | head -1 || true)
FALTA=${FALTA:-0}

if [ "$FALTA" -eq 0 ] && ! grep -q '^OCULTAR=[A-Za-z0-9_-]' "$SITIO/scripts/yt-terminar.sh"; then
  di "TERMINADO: no queda nada pendiente. Se quita del crontab."
  # Se escribe a un temporal y se valida antes de instalar: un crontab a medio
  # escribir se lleva por delante los demás trabajos del servidor.
  TMP=$(mktemp)
  if crontab -l 2>/dev/null | grep -v 'yt-terminar.sh' > "$TMP" && [ -s "$TMP" ]; then
    crontab "$TMP" && di "crontab actualizado ($(wc -l < "$TMP") líneas)"
  else
    di "OJO: no se pudo reescribir el crontab sin dejarlo vacío; se deja como está"
  fi
  rm -f "$TMP"
else
  di "siguen pendientes: $FALTA por aplicar"
fi

di "─── fin ───"
