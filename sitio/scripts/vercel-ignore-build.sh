#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# "¿Vale la pena construir este commit?"  (Vercel: Ignored Build Step)
#
# CONTRATO DE VERCEL, al revés de lo que uno espera:
#   exit 0 → SALTAR el build     exit 1 → CONSTRUIR
#
# POR QUÉ EXISTE (medido con la factura de agosto 2026):
# el 99% del costo de Vercel fueron "Build CPU Minutes" ($118.96 de $120.22).
# La causa no es que el build sea pesado —consume 2.4 CPU-min reales— sino
# CUÁNTOS builds se disparan: 734 commits en 30 días, casi todos en ráfaga
# (hubo un día con 143). Cada push a mitad de una ráfaga construye una versión
# que quedará obsoleta en 3 minutos, y se paga completa.
#
# Este guion salta el build cuando el commit YA fue superado por otro más
# nuevo en la misma rama: solo se construye el último de cada ráfaga. Medido
# sobre el historial real: 734 builds → ~297 (−60%).
#
# FAIL-OPEN A PROPÓSITO: ante CUALQUIER duda (sin red, sin git, variables
# ausentes, rama rara) se construye. Un build de más cuesta centavos; un
# deploy que no salió porque este guion se equivocó cuesta una madrugada de
# depuración preguntándose por qué producción no tiene el último cambio.
# ───────────────────────────────────────────────────────────────────────────

set -u

log() { echo "[ignore-build] $*"; }

# Producción manda: si alguien redeploya a mano desde el dashboard, se respeta.
if [ "${VERCEL_ENV:-}" != "production" ] && [ "${VERCEL_ENV:-}" != "preview" ]; then
    log "entorno '${VERCEL_ENV:-desconocido}' — construyo por seguridad."
    exit 1
fi

RAMA="${VERCEL_GIT_COMMIT_REF:-}"
MIO="${VERCEL_GIT_COMMIT_SHA:-}"

if [ -z "$RAMA" ] || [ -z "$MIO" ]; then
    log "sin VERCEL_GIT_COMMIT_REF/SHA — construyo."
    exit 1
fi

# El clon de Vercel es superficial y sin ramas remotas: se pide SOLO la punta
# actual de esta rama (1 commit, sin historia). Si la red falla, se construye.
if ! git fetch --depth=1 origin "$RAMA" >/dev/null 2>&1; then
    log "no se pudo consultar origin/$RAMA — construyo."
    exit 1
fi

PUNTA="$(git rev-parse FETCH_HEAD 2>/dev/null || true)"

if [ -z "$PUNTA" ]; then
    log "no se pudo leer la punta de $RAMA — construyo."
    exit 1
fi

if [ "$PUNTA" != "$MIO" ]; then
    log "este commit (${MIO:0:7}) ya fue superado por ${PUNTA:0:7} en $RAMA."
    log "salto el build: el de ${PUNTA:0:7} publicará esto y lo más nuevo."
    exit 0
fi

log "${MIO:0:7} es la punta de $RAMA — construyo."
exit 1
