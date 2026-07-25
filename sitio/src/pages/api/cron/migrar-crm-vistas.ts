// TEMPORAL — POST /api/cron/migrar-crm-vistas?key=sacs-cron-2026
// Corre la migración de crm_vistas (vistas guardadas de los datatables) vía el
// RPC exec_sql, igual que /api/crm/arr/setup.ts. Idempotente. Mismo patrón de
// llave que el resto de los crons. Se ELIMINA una vez aplicada la migración.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const CRON_KEY = 'sacs-cron-2026';

const STMTS = [
  `CREATE TABLE IF NOT EXISTS crm_vistas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla text NOT NULL,
    nombre text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}',
    orden int NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_crm_vistas_tabla ON crm_vistas(tabla, orden, created_at)`,
  // Multi-contacto (por si la corrida manual anterior faltara en algo — idempotente)
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rol text`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS es_principal boolean NOT NULL DEFAULT false`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_principal_por_company
    ON contacts(company_id) WHERE es_principal = true AND company_id IS NOT NULL`,
];

export const POST: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== CRON_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const resultados: any[] = [];
  let execSqlDisponible = true;

  for (const stmt of STMTS) {
    const { error } = await supabase.rpc('exec_sql', { query: stmt + ';' });
    if (error) {
      resultados.push({ stmt: stmt.slice(0, 60) + '…', error: error.message });
      if (/function .*exec_sql.* does not exist|Could not find the function/i.test(error.message)) {
        execSqlDisponible = false;
        break;
      }
    } else {
      resultados.push({ stmt: stmt.slice(0, 60) + '…', ok: true });
    }
  }

  // Verificación real: ¿la tabla existe y responde?
  const check = await supabase.from('crm_vistas').select('id').limit(1);
  const tablaOk = !check.error;

  return new Response(JSON.stringify({
    exec_sql_disponible: execSqlDisponible,
    crm_vistas_ok: tablaOk,
    check_error: check.error?.message || null,
    resultados,
    nota: execSqlDisponible ? 'Listo. Este endpoint se elimina tras la migración.'
      : 'exec_sql no existe en este proyecto de Supabase: hay que pegar el SQL en el editor manualmente.',
  }), { headers: { 'Content-Type': 'application/json' } });
};
