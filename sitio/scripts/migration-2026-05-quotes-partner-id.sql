-- Cotizaciones generadas por Partners en su panel
-- Asocia cada quote al partner que la creó y registra el origen.
BEGIN;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES team_members(id) ON DELETE SET NULL;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'admin';
-- valores esperados: 'admin' | 'partner_portal'

CREATE INDEX IF NOT EXISTS idx_quotes_partner_id
  ON quotes(partner_id) WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_created_via
  ON quotes(created_via);

-- Backfill: cotizaciones existentes ligadas a un deal cuyo owner es un partner
UPDATE quotes q
SET partner_id = d.owner_id
FROM deals d
JOIN team_members tm ON tm.id = d.owner_id
WHERE q.deal_id = d.id
  AND tm.rol = 'partner'
  AND q.partner_id IS NULL;

COMMIT;
