-- Regalo Buddy: un cliente Sacs (padrino, identificado por su `account` de sacs3)
-- regala a un negocio amigo su PRIMER AÑO del Plan Vende ($6,000 MXN).
-- Flujo: sacs3 llama POST /api/gifts/create → link www.sacscloud.com/regalo/<code>
-- → landing → /registro?gift=<code> → create-subscription (anual Vende + cupón 100% once)
-- → webhook marca redeemed + crea deal/activity en CRM.
--
-- Estados: pending → redeeming (lock optimista en checkout) → redeemed.
--          pending → expired (120 días sin redimir). revoked = manual.

CREATE TABLE IF NOT EXISTS gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  -- Padrino (cliente sacs3 que regala)
  padrino_account text NOT NULL,
  padrino_nombre text,
  padrino_email text,
  padrino_whatsapp text,
  -- Estado del regalo
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','redeeming','redeemed','expired','revoked')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  -- Redención
  redeemed_by_contact uuid REFERENCES contacts(id),
  redeemed_email text,
  redeemed_at timestamptz,
  stripe_subscription_id text,
  -- Auditoría (IP de redención, user agent, etc.)
  meta jsonb DEFAULT '{}'::jsonb
);

-- Lock optimista del checkout: cuándo entró el gift a 'redeeming'. Si Stripe
-- cuelga / el proceso muere, un gift quedaría atorado en 'redeeming' para
-- siempre; con esto se revierte a 'pending' tras 15 min (ver
-- expireGiftIfNeeded en src/lib/gifts.ts). ALTER idempotente (re-correr seguro).
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS redeeming_at timestamptz;

-- 1 regalo por cuenta padrino — seguridad server-side (la API create es idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gifts_padrino_account ON gifts(padrino_account);
CREATE INDEX IF NOT EXISTS idx_gifts_code ON gifts(code);
CREATE INDEX IF NOT EXISTS idx_gifts_status ON gifts(status);

-- RLS: service-role only (sin policies → solo la service key del backend accede)
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
