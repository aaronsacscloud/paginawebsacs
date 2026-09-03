#!/usr/bin/env bash
# Instala la rutina que revisa los briefs cada 12 horas (8:13 y 20:13).
#
# Corre Claude Code sin sesión interactiva, con SOLO dos herramientas
# permitidas: leer los pendientes y mandar la revisión. No es
# bypassPermissions — una rutina desatendida con permisos abiertos sobre este
# servidor es justo lo que no queremos.
#
#   bash scripts/instalar-cron-brief.sh            # instala
#   bash scripts/instalar-cron-brief.sh --quitar   # lo saca
set -euo pipefail

DIR="/opt/sacs/paginawebsacs/sitio"
LOG="/home/aaron/brief-revision.log"
MARCA="# --- revision del brief de proyecto (cada 12 h) ---"

if [[ "${1:-}" == "--quitar" ]]; then
  crontab -l 2>/dev/null | grep -v "brief-revision" | grep -v "revision del brief" | crontab -
  echo "Rutina quitada."
  crontab -l 2>/dev/null || echo "(crontab vacío)"
  exit 0
fi

if crontab -l 2>/dev/null | grep -q "brief-revision"; then
  echo "Ya estaba instalada:"
  crontab -l | grep -A1 "revision del brief"
  exit 0
fi

LINEA="13 8,20 * * * cd $DIR && /home/aaron/.local/bin/claude -p \"\$(cat scripts/brief-revision.prompt.md)\" --allowedTools 'Bash(node scripts/brief-pendientes.mjs:*)' 'Bash(node scripts/brief-responder.mjs:*)' >> $LOG 2>&1"

{ crontab -l 2>/dev/null || true; echo "$MARCA"; echo "$LINEA"; } | crontab -

echo "Instalada. Corre a las 8:13 y a las 20:13."
echo "Log: $LOG"
crontab -l | tail -3
