// Vuelve a calificar cuentas en lote.
//
// POR QUÉ EXISTE. `abm-barrido` insertaba sin escribir `puntaje`, y la columna
// es NOT NULL DEFAULT 0: 7,105 cuentas quedaron en cero cuando el mínimo que
// puede dar el cálculo es 12. Cero no significaba «no nos sirve», significaba
// «nadie la calificó» — y todo lo que ordena por puntaje (el goteo y el
// WhatsApp en frío) las mandaba al final de la fila. Lo más fresco de la base
// era lo último en salir (16-sep-2026).
//
// El barrido ya califica al entrar. Esto es para las que ya estaban, y para
// cuando cambie la fórmula: entonces hay que repasar TODAS, no solo las nuevas.
//
// Se usa `repuntuar`, que es la misma función que usan la ficha y el vigilante.
// Copiar la fórmula a SQL habría sido más rápido y habría creado una segunda
// verdad que se despega de la primera en cuanto alguien toque los pesos.
//
//   GET /api/cron/abm-repuntuar?cuantas=500          las que están en cero
//   GET /api/cron/abm-repuntuar?cuantas=500&todas=1  todas, para un cambio de fórmula
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { quien, repuntuar } from '../../../lib/crm/abm.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = (import.meta.env.CRON_SECRET || process.env.CRON_SECRET || '').trim();
  if (secret && auth !== `Bearer ${secret}`) {
    const yo = await quien(request);
    if (!yo) return json({ error: 'no autorizado' }, 401);
  }

  const cuantas = Math.min(1000, Math.max(1, Number(url.searchParams.get('cuantas') || 300)));
  const todas = url.searchParams.get('todas') === '1';

  /* Las de más reseñas primero: si la corrida se corta a medias, lo que quedó
     calificado es lo que antes iba a salir. */
  let q = supabase.from('abm_cuentas').select('id, puntaje')
    .order('google_resenas', { ascending: false, nullsFirst: false }).limit(cuantas);
  if (!todas) q = q.eq('puntaje', 0);
  const { data: cuentas, error } = await q;
  if (error) return json({ error: error.message }, 500);
  if (!cuentas?.length) return json({ repuntuadas: 0, nota: 'no quedan cuentas sin calificar' });

  let cambiadas = 0;
  for (const c of cuentas) {
    await repuntuar(c.id);
    cambiadas++;
  }

  const { count: faltan } = await supabase.from('abm_cuentas')
    .select('id', { count: 'exact', head: true }).eq('puntaje', 0);

  return json({ repuntuadas: cambiadas, quedan_en_cero: faltan ?? null, modo: todas ? 'todas' : 'solo las de cero' });
};
