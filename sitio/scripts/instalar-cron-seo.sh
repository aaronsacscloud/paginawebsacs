#!/usr/bin/env bash
# Instala la rutina semanal de visibilidad en agentes.
#
# Domingo 09:20. Sigue el mismo patrón que el cron del brief que ya corre en
# este servidor: Claude Code headless con un prompt file y herramientas
# restringidas a lo que la rutina necesita — medir, reportar y escribir en el
# repo. NO se le da push: la regla del repo es commitear siempre y subir solo
# cuando el dueño lo pida.
set -euo pipefail
LINEA='20 9 * * 0 set -a && . /opt/sacs/sacs_api/.env && set +a && /home/aaron/.local/bin/claude -p "$(cat scripts/seo-semanal.prompt.md)" --allowedTools '"'"'Bash(node scripts/seo-medir.mjs:*)'"'"' '"'"'Bash(node scripts/seo-reportar.mjs:*)'"'"' '"'"'Bash(git add:*)'"'"' '"'"'Bash(git commit:*)'"'"' Read Write Edit Glob Grep WebSearch WebFetch >> /home/aaron/seo-semanal.log 2>&1'

if crontab -l 2>/dev/null | grep -q 'seo-semanal.prompt.md'; then
  echo "Ya estaba instalado. Nada que hacer."
  exit 0
fi
( crontab -l 2>/dev/null; echo ""; echo "# --- radar de recomendacion: mide, mejora lo viejo, escribe uno nuevo y reporta (domingos) ---"; echo "$LINEA" ) | crontab -
echo "✓ instalado. Corre los domingos 09:20 y deja bitácora en /home/aaron/seo-semanal.log"
echo
echo "Pendiente de una persona:"
echo "  · crear el webhook del canal de ventas en Discord y ponerlo como DISCORD_SEO_URL"
echo "    en /opt/sacs/sacs_api/.env — si no, el parte cae al canal general."
