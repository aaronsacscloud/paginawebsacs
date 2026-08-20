// GET /api/crm/email/salud — el tablero de reputación y resultados.
//
// Dos preguntas distintas, en una sola pantalla:
//   ¿estoy quemando mi dominio?  (entrega, rebotes, quejas, bajas)
//   ¿esto sirve para vender?     (reuniones y ARR que tocó cada campaña)
//
// La segunda es la que ninguna herramienta de correo puede responder, porque
// no tiene el CRM: aquí sí se cruza.
//
// Sobre las aperturas: se reportan, pero marcadas. Apple Mail las abre solas y
// Outlook corporativo bloquea imágenes; usarlas para decidir lleva a decisiones
// equivocadas. La señal buena es el CLIC.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const dias = Math.min(365, Math.max(1, Number(url.searchParams.get('dias')) || 30));
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  const cuenta = async (f: (q: any) => any) => {
    const { count } = await f(supabase.from('email_sends').select('id', { count: 'exact', head: true })
      .eq('tenant_id', t.id).in('categoria', ['marketing', 'relacion']).gte('created_at', desde));
    return count || 0;
  };

  const enviados = await cuenta((q: any) => q.in('estado', ['sent', 'delivered', 'opened', 'clicked', 'unsubscribed']));
  const entregados = await cuenta((q: any) => q.in('estado', ['delivered', 'opened', 'clicked']));
  const rebotes = await cuenta((q: any) => q.eq('estado', 'bounced'));
  const quejas = await cuenta((q: any) => q.eq('estado', 'spam'));
  const bajas = await cuenta((q: any) => q.eq('estado', 'unsubscribed'));
  const clics = await cuenta((q: any) => q.not('clicked_at', 'is', null));
  const aperturas = await cuenta((q: any) => q.not('first_opened_at', 'is', null));
  const fallidos = await cuenta((q: any) => q.in('estado', ['failed', 'dudoso']));

  // ── Alertas: el aviso llega ANTES de quemar el dominio ──
  const alertas: Array<{ nivel: 'urgente' | 'alerta' | 'info'; texto: string }> = [];
  // El denominador incluye a los rebotados: `enviados` los excluye (su estado
  // ya cambió a 'bounced'), así que dividir entre él sobrestimaba la tasa y no
  // coincidía con la que usa el freno automático de las campañas.
  const intentados = enviados + rebotes;
  const tasaRebote = pct(rebotes, intentados);
  const tasaQueja = pct(quejas, intentados);
  if (intentados >= 20 && tasaRebote > 2) alertas.push({ nivel: 'urgente', texto: `Rebotes en ${tasaRebote}% (el límite sano es 2%). Limpia la lista antes de la próxima campaña.` });
  if (intentados >= 20 && tasaQueja > 0.1) alertas.push({ nivel: 'urgente', texto: `Quejas de spam en ${tasaQueja}% (Gmail tolera hasta 0.3%, y su umbral de castigo empieza en 0.1%).` });
  if (enviados >= 50 && pct(clics, entregados) < 1) alertas.push({ nivel: 'alerta', texto: 'Menos de 1% de clics: el contenido o la audiencia no están conectando.' });
  if (fallidos > 0) alertas.push({ nivel: 'alerta', texto: `${fallidos} envíos quedaron fallidos o dudosos — revísalos antes de reintentar.` });

  // ── Campañas → negocio ──
  const { data: camps } = await supabase.from('email_campaigns')
    .select('id, nombre, estado, resumen, completada_at, created_at')
    .eq('tenant_id', t.id).in('estado', ['completada', 'enviando', 'pausada'])
    .gte('created_at', desde).order('created_at', { ascending: false }).limit(30);

  const porCampana: any[] = [];
  for (const c of camps || []) {
    // Quién hizo clic en esta campaña…
    const { data: clicaron } = await supabase.from('email_sends')
      .select('contact_id').eq('campaign_id', c.id).not('clicked_at', 'is', null).not('contact_id', 'is', null).limit(5000);
    const ids = [...new Set((clicaron || []).map((r: any) => r.contact_id))];

    // `.in()` por TANDAS: 5,000 uuids son ~185 KB de URL y PostgREST responde
    // 414 — el tablero se quedaba sin datos, en silencio.
    const enTandas = async <T>(lista: string[], f: (t: string[]) => Promise<T[]>): Promise<T[]> => {
      const out: T[] = [];
      for (let i = 0; i < lista.length; i += 400) out.push(...await f(lista.slice(i, i + 400)));
      return out;
    };

    let reuniones = 0, arr = 0;
    if (ids.length) {
      // …y qué hizo DESPUÉS: la única medida que importa.
      const desdeCamp = c.completada_at || c.created_at;
      const reus = await enTandas(ids, async t => {
        const { data } = await supabase.from('bookings')
          .select('id').in('contact_id', t).gte('created_at', desdeCamp);
        return data || [];
      });
      reuniones = reus.length;

      const cs = await enTandas(ids, async t => {
        const { data } = await supabase.from('contacts').select('company_id').in('id', t).not('company_id', 'is', null);
        return data || [];
      });
      const empresas = [...new Set(cs.map((r: any) => r.company_id))];
      if (empresas.length) {
        const { data: subs } = await supabase.from('subscriptions')
          .select('arr').in('company_id', empresas).eq('estado', 'activa').gte('fecha_inicio', String(desdeCamp).slice(0, 10));
        arr = (subs || []).reduce((s: number, x: any) => s + Number(x.arr || 0), 0);
      }
    }
    const r = c.resumen || {};
    porCampana.push({
      id: c.id, nombre: c.nombre, estado: c.estado,
      enviados: r.enviados || 0, entregados: r.entregados || 0,
      clics: r.clics || 0, rebotes: r.rebotes || 0, bajas: r.bajas || 0,
      reuniones, arr_tocado: arr,
    });
  }

  // ── Dormidos: por señales del CRM, no por aperturas ──
  // Un cliente que paga cada mes y nunca abre el newsletter NO está dormido.
  const corte = new Date(Date.now() - 180 * 86400000).toISOString();
  const { data: conEngagement } = await supabase.from('email_sends')
    .select('contact_id').eq('tenant_id', t.id).not('clicked_at', 'is', null)
    .gte('created_at', corte).not('contact_id', 'is', null).limit(20000);
  const vivos = new Set((conEngagement || []).map((r: any) => r.contact_id));
  const { data: recibieron } = await supabase.from('email_sends')
    .select('contact_id').eq('tenant_id', t.id).lt('created_at', corte)
    .not('contact_id', 'is', null).limit(20000);
  const candidatos = [...new Set((recibieron || []).map((r: any) => r.contact_id))].filter(id => !vivos.has(id));
  let dormidos = 0;
  if (candidatos.length) {
    // Se excluye a quien el CRM sabe que sigue vivo: cliente activo o con trato abierto.
    // Antes cortaba a 1,000 sin avisar: el número de "dormidos" mentía por
    // abajo justo cuando la lista crecía, que es cuando importa.
    let noClientes = 0;
    for (let i = 0; i < candidatos.length; i += 400) {
      const { data } = await supabase.from('contacts')
        .select('id, lifecycle_stage').in('id', candidatos.slice(i, i + 400));
      noClientes += (data || []).filter((c: any) => c.lifecycle_stage !== 'cliente').length;
    }
    dormidos = noClientes;
  }

  const { count: suprimidos } = await supabase.from('email_suppressions')
    .select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).is('restaurado_at', null);

  return json({
    periodo_dias: dias,
    global: {
      enviados, entregados, rebotes, quejas, bajas, clics, aperturas, fallidos, suprimidos: suprimidos || 0,
      tasa_entrega: pct(entregados, enviados),
      tasa_clic: pct(clics, entregados),
      tasa_apertura: pct(aperturas, entregados),
      tasa_rebote: tasaRebote,
      tasa_queja: tasaQueja,
      tasa_baja: pct(bajas, enviados),
    },
    // Gmail no reporta quejas individuales a SendGrid: el número de arriba es
    // sobre todo de Yahoo/Microsoft. Para Gmail hay que mirar Postmaster.
    nota_gmail: 'Las quejas de Gmail no llegan por webhook. Revísalas en Google Postmaster Tools.',
    alertas,
    campanas: porCampana,
    dormidos,
    dominio_remitente: String(t.from_email || '').split('@')[1] || null,
  });
};
