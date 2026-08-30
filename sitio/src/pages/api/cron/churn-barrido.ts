// CHURN · barrido nocturno: la red de seguridad y los avisos del embudo.
//
// El caso se abre en el momento de cancelar. Este barrido existe porque «el
// momento de cancelar» no es un solo camino: hay bajas que entran por Stripe,
// por Mercado Pago, por el cron de vencimientos o a mano en la base. Correrlo
// todas las noches garantiza que ninguna se quede sin caso, y es idempotente
// —el índice único de un-caso-abierto-por-empresa lo hace imposible de
// duplicar—, así que no hay que llevar registro de qué ya se procesó.
//
// Corre a las 3:30 am CDMX (9:30 UTC), media hora después del sync de
// actividad: así los avisos de «no está usando la gracia» se calculan con los
// datos de HOY y no con los de ayer.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { abrirCasoSiAplica, diasDeGracia, ETAPA } from '../../../lib/crm/churn.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const dias = (iso?: string | null) => iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;

/** Un aviso por caso y por causa al día: repetir el mismo grito enseña a ignorarlo. */
async function avisar(caso: any, tipo: string, nivel: string, titulo: string, detalle: string) {
  const desde = new Date(Date.now() - 20 * 3600e3).toISOString();
  const { data: ya } = await supabase.from('crm_notificaciones')
    .select('id').eq('tipo', tipo).eq('company_id', caso.company_id)
    .gte('created_at', desde).maybeSingle();
  if (ya) return false;
  await supabase.from('crm_notificaciones').insert({
    tipo, nivel, titulo, detalle,
    company_id: caso.company_id, destino: 'churn',
    // La escalera de destino de la campana lee metadata primero: con esto el
    // clic cae en ESTE caso, no en la lista.
    metadata: { churn_caso_id: caso.id },
  });
  return true;
}

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== import.meta.env.CRON_SECRET) {
    return json({ error: 'no autorizado' }, 401);
  }
  const hechos = { casos_nuevos: 0, avisos: 0, gracias_vencidas: 0, revisadas: 0 };

  // ── 1 · Ninguna baja sin caso ──────────────────────────────────────────
  const { data: canceladas } = await supabase.from('subscriptions')
    .select('company_id').eq('estado', 'cancelada').not('company_id', 'is', null);
  const empresas = [...new Set((canceladas || []).map((s: any) => s.company_id))];
  for (const id of empresas) {
    hechos.revisadas++;
    const r = await abrirCasoSiAplica(String(id));
    if (r.creado) hechos.casos_nuevos++;
  }

  // ── 2 · Los avisos del embudo ──────────────────────────────────────────
  const { data: abiertos } = await supabase.from('churn_casos')
    .select('*, companies(nombre, sacs_account, dias_sin_venta)')
    .in('etapa', ['detectado', 'conciliacion', 'gracia']);

  for (const c of abiertos || []) {
    const nombre = c.companies?.nombre || 'un cliente';

    // Detectado sin tocar: el rescate en frío vale la mitad.
    if (c.etapa === 'detectado' && (dias(c.detectado_at) ?? 0) >= 3) {
      if (await avisar(c, 'churn_sin_tocar', 'alerta', `Churn sin atender: ${nombre}`,
        `Canceló hace ${dias(c.detectado_at)} días y nadie lo ha contactado. $${Number(c.mrr_perdido).toLocaleString('es-MX')} de MRR.`)) hechos.avisos++;
    }

    // Conciliación en silencio.
    if (c.etapa === 'conciliacion' && (dias(c.conciliacion_at) ?? 0) >= 7) {
      if (await avisar(c, 'churn_estancado', 'alerta', `Conciliación estancada: ${nombre}`,
        `${dias(c.conciliacion_at)} días sin movimiento. Decidir si se sigue o se cierra.`)) hechos.avisos++;
    }

    if (c.etapa === 'gracia') {
      const quedan = diasDeGracia(c);
      if (quedan != null && quedan < 0) {
        hechos.gracias_vencidas++;
        if (await avisar(c, 'churn_gracia_vencida', 'urgente', `Gracia vencida: ${nombre}`,
          `Terminó hace ${Math.abs(quedan)} días y el caso sigue abierto. Extender, recuperar o cerrar.`)) hechos.avisos++;
      } else if (quedan != null && quedan <= 7) {
        if (await avisar(c, 'churn_gracia_por_vencer', 'alerta', `La gracia de ${nombre} termina en ${quedan} d`,
          `Acuerdo: ${c.gracia_acuerdo}. Vuelve a $${Number(c.gracia_mrr || 0).toLocaleString('es-MX')}.`)) hechos.avisos++;
      }

      /* EL AVISO DE ORO. Una gracia con el sistema en cero ya fracasó, y hay
         que saberlo a mitad del período, no el último día. El dato ya existe:
         lo trae el sync de actividad que corre media hora antes. */
      const sinVender = c.companies?.dias_sin_venta;
      const corridos = dias(c.gracia_at) ?? 0;
      if (c.companies?.sacs_account && sinVender != null && sinVender > 14 && corridos >= 7) {
        if (await avisar(c, 'churn_gracia_sin_uso', 'urgente', `La gracia de ${nombre} no está funcionando`,
          `Lleva ${corridos} días de gracia y ${sinVender} sin vender. Devolverle el acceso no bastó.`)) hechos.avisos++;
      }
    }
  }

  return json({ ok: true, ...hechos });
};
