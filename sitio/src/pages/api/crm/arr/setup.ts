// POST /api/crm/arr/setup?key=... — aplica la migración ARR (si existe la RPC
// exec_sql) y SIEMPRE verifica el estado real de tablas/columnas. Idempotente.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const KEY = 'sacs-arr-2026';

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
    nombre_plan text NOT NULL,
    ciclo text NOT NULL CHECK (ciclo IN ('mensual','anual')),
    estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','pendiente_pago','pausada','cancelada','programada')),
    precio numeric(12,2) NOT NULL DEFAULT 0,
    moneda text NOT NULL DEFAULT 'MXN',
    mrr numeric(12,2) NOT NULL DEFAULT 0,
    arr numeric(12,2) NOT NULL DEFAULT 0,
    fecha_inicio date,
    proxima_factura date,
    monto_proximo numeric(12,2),
    pagos_realizados integer NOT NULL DEFAULT 0,
    total_pagado numeric(12,2) NOT NULL DEFAULT 0,
    stripe_subscription_id text,
    razon_cancelacion text,
    cancelada_at timestamptz,
    notas text,
    migrada_de_excel boolean NOT NULL DEFAULT false
  )`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_estado ON subscriptions(estado)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_proxima ON subscriptions(proxima_factura)`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS sacs_account text`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS actividad jsonb`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ultima_venta_at date`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS dias_sin_venta integer`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS actividad_sync_at timestamptz`,
  `CREATE INDEX IF NOT EXISTS idx_companies_sacs_account ON companies(sacs_account)`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS periodo_cubierto text`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS migrado boolean NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS crm_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    tipo text NOT NULL DEFAULT 'arr' CHECK (tipo IN ('arr','new_arr_mensual')),
    anio integer NOT NULL,
    mes integer CHECK (mes BETWEEN 1 AND 12),
    monto numeric(14,2) NOT NULL,
    UNIQUE (tipo, anio, mes)
  )`,
];

async function verify() {
  const status: Record<string, string> = {};
  const subs = await supabase.from('subscriptions').select('id', { count: 'exact', head: true });
  status.subscriptions = subs.error ? 'FALTA: ' + subs.error.message : 'ok';
  const goals = await supabase.from('crm_goals').select('id', { count: 'exact', head: true });
  status.crm_goals = goals.error ? 'FALTA: ' + goals.error.message : 'ok';
  const comp = await supabase.from('companies').select('id, sacs_account, ultima_venta_at').limit(1);
  status.companies_cols = comp.error ? 'FALTA: ' + comp.error.message : 'ok';
  const pay = await supabase.from('payments').select('id, subscription_id, migrado').limit(1);
  status.payments_cols = pay.error ? 'FALTA: ' + pay.error.message : 'ok';
  return status;
}

export const POST: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== KEY) return new Response('Forbidden', { status: 403 });

  const applied: string[] = [];
  const failed: string[] = [];
  let execSqlDisponible = true;

  for (const stmt of DDL) {
    const { error } = await supabase.rpc('exec_sql', { query: stmt + ';' });
    if (error) {
      failed.push(stmt.slice(0, 60).replace(/\s+/g, ' ') + '… → ' + error.message);
      if (/function .*exec_sql.* does not exist|Could not find the function/i.test(error.message)) {
        execSqlDisponible = false;
        break; // sin exec_sql no tiene caso seguir intentando
      }
    } else {
      applied.push(stmt.slice(0, 60).replace(/\s+/g, ' ') + '…');
    }
  }

  const status = await verify();
  const listo = Object.values(status).every(v => v === 'ok');

  return new Response(JSON.stringify({
    ok: listo,
    exec_sql_disponible: execSqlDisponible,
    aplicadas: applied.length,
    fallidas: failed,
    verificacion: status,
    instrucciones: listo ? null :
      'Si exec_sql no está disponible, pega sitio/scripts/migration-2026-07-crm-arr.sql en el SQL Editor de Supabase y vuelve a llamar este endpoint para verificar.',
  }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
