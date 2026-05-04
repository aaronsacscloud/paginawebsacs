-- Partner Certifications: 3 cursos pagados (básica, avanzada, multisucursal)
-- Cada partner puede comprar cada cert una vez. Status pending → paid via Stripe.
-- Webhook /api/revenue/stripe-webhook escucha checkout.session.completed con
-- metadata.cert_id y marca paid_at.

CREATE TABLE IF NOT EXISTS partner_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  cert_id text NOT NULL CHECK (cert_id IN ('basica','avanzada','multisucursal')),
  amount integer NOT NULL,             -- centavos MXN
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  stripe_session_id text,
  stripe_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Una cert por partner (no permite recompra del mismo)
  UNIQUE (partner_id, cert_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_certifications_partner ON partner_certifications(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_certifications_status ON partner_certifications(status);
CREATE INDEX IF NOT EXISTS idx_partner_certifications_session ON partner_certifications(stripe_session_id);
