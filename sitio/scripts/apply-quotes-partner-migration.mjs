// Aplica la migración migration-2026-05-quotes-partner-id.sql
// Uso: node scripts/apply-quotes-partner-migration.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    }),
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const sql = await fs.readFile(
  path.join(SITIO, 'scripts', 'migration-2026-05-quotes-partner-id.sql'),
  'utf8',
);

// Postgres-meta REST: aceptamos cualquier endpoint que ejecute SQL.
// Si no existe la función exec_sql, usamos statements individuales por fetch.
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;

const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.match(/^(BEGIN|COMMIT)$/i) && !s.startsWith('--'));

let ok = true;
for (const stmt of statements) {
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ query: stmt + ';' }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[FAIL] ${stmt.slice(0, 80)}...`);
    console.error(text);
    ok = false;
  } else {
    console.log(`[OK]   ${stmt.slice(0, 80).replace(/\s+/g, ' ')}...`);
  }
}

if (!ok) {
  console.error('\nNo se pudo aplicar todo. Probablemente no existe la función exec_sql en tu Supabase.');
  console.error('Aplica la migración manualmente en el SQL Editor de Supabase:');
  console.error(path.join(SITIO, 'scripts', 'migration-2026-05-quotes-partner-id.sql'));
  process.exit(1);
}

console.log('\n✓ Migración aplicada.');
