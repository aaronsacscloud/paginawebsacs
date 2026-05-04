-- Sistema de strikes para partners que no cumplen 100 pts/mes
-- Reglas:
-- · Mes 1 falla → carry-over al mes 2 (necesita 100 + déficit)
-- · Mes 2 falla también → 2 strikes activos
-- · Mes 3 falla → suspend automático
-- El conteo se reinicia a 0 cuando cumple un mes completo.

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS consecutive_failed_months int NOT NULL DEFAULT 0;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_period_evaluated date;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Categoría en content submissions: 'contenido' (videos, posts) o 'filantropia'
ALTER TABLE partner_content_submissions ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'contenido';

-- Permitimos agregar el CHECK de manera idempotente
ALTER TABLE partner_content_submissions DROP CONSTRAINT IF EXISTS partner_content_submissions_categoria_check;
ALTER TABLE partner_content_submissions ADD CONSTRAINT partner_content_submissions_categoria_check
  CHECK (categoria IN ('contenido','filantropia'));

NOTIFY pgrst, 'reload schema';
