-- Tracking de visitas al link único del partner (/p/[slug]).
-- Cada vez que alguien entra a una landing de partner, insertamos una row.
-- visitor_id viene de cookie sacs_pv (uuid generado y guardado 1 año).
-- Nos permite distinguir visitantes únicos vs recurrentes.

CREATE TABLE IF NOT EXISTS partner_link_visits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  slug        text NOT NULL,
  visitor_id  text NOT NULL,                  -- uuid en cookie sacs_pv
  ip_hash     text,                            -- sha256 truncado de IP, no la IP cruda
  user_agent  text,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_link_visits_partner_created
  ON partner_link_visits(partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_link_visits_partner_visitor
  ON partner_link_visits(partner_id, visitor_id);

CREATE INDEX IF NOT EXISTS idx_partner_link_visits_visitor
  ON partner_link_visits(visitor_id);

NOTIFY pgrst, 'reload schema';
