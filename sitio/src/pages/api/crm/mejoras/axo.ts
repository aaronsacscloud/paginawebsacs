// OPORTUNIDADES DE MEJORA (antes «Solicitudes de mejora») que llegan desde AXO (el asistente dentro de Sacs), 2026-10-04.
//
// El cliente le dice a AXO «¿pueden agregar…?» y AXO la registra en su cuenta de Sacs
// (sacs_api, colección axo_mejoras). Aquí el equipo las ve, decide gratis o con costo, pone
// monto, tiempo y la cuenta de cobro (bank_accounts), y las mueve de etapa; AXO se lo enseña al
// cliente con su barra de etapas. El puente es el de siempre: /interno/crm/* con x-crm-sync-secret.
//
// Además cada solicitud queda en la tabla `mejoras` de la empresa (origen 'axo'), ligada por
// companies.sacs_account — nunca por parecido de nombre —, para que viva donde el equipo ya
// lleva las mejoras de cada cliente.
//
// GET                     → lista de todas las cuentas (con la empresa del CRM y su mejora ligada)
// POST {account, fid, etapa?, costo?, monto?, tiempo?, fecha_estimada?, nota?}
//                         → mueve/cotiza en Sacs y sincroniza el renglón de `mejoras`
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();

async function puente(ruta: string, body: any) {
  const r = await fetch(SACS_API + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(j.error || ('Sacs respondió ' + r.status));
  return j;
}

// Etapa de AXO → estado de la tabla `mejoras` (idea · cotizada · en_proceso · entregada · descartada).
function estadoCrm(etapa: string): string {
  if (etapa === 'lista') return 'entregada';
  if (etapa === 'desarrollo' || etapa === 'pago_confirmado') return 'en_proceso';
  if (etapa === 'rechazada') return 'descartada';
  if (['cotizada', 'aceptada', 'pago_enviado'].includes(etapa)) return 'cotizada';
  return 'idea';
}

async function empresasPorCuenta(cuentas: string[]) {
  if (!cuentas.length) return {} as Record<string, any>;
  const { data } = await supabase.from('companies').select('id, nombre, nombre_comercial, sacs_account').in('sacs_account', cuentas);
  const m: Record<string, any> = {};
  (data || []).forEach((c: any) => { m[c.sacs_account] = c; });
  return m;
}

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  try {
    // Fase 4: de paso se copia el catálogo de plugins (`plans`, categoria 'plugin') a Sacs, para que
    // las oportunidades que AXO detecta muestren el precio REAL (sin precio → «Por cotizar»). Best-effort.
    try {
      const { data: planes } = await supabase.from('plans').select('slug, nombre, precio_mensual, precio_anual, precio_vitalicio, a_la_medida, activo').eq('categoria', 'plugin');
      if (planes && planes.length) await puente('/interno/crm/axo-mejoras/catalogo', { planes });
    } catch (e) { /* el catálogo no tumba la lista */ }
    const j = await puente('/interno/crm/axo-mejoras/listar', {});
    const lista = j.mejoras || [];
    const emp = await empresasPorCuenta(Array.from(new Set(lista.map((x: any) => x.account))));
    const { data: banco } = await supabase.from('bank_accounts').select('id, alias, banco, titular, cuenta, clabe, rfc, es_default, activa').eq('activa', true);
    return json({ mejoras: lista.map((x: any) => ({ ...x, empresa: emp[x.account] || null })), etapas: j.etapas, cuentas_cobro: banco || [] });
  } catch (e: any) {
    return json({ error: e?.message || 'No se pudo leer Sacs' }, 502);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!b.account || !b.fid) return json({ error: 'Falta account o fid' }, 400);

  const cambio: any = { account: b.account, fid: b.fid, por: (user as any).nombre || (user as any).email || 'Equipo de Sacs' };
  ['etapa', 'costo', 'monto', 'tiempo', 'nota'].forEach((k) => { if (b[k] !== undefined && b[k] !== '') cambio[k === 'nota' ? 'notaEquipo' : k] = b[k]; });
  if (b.fecha_estimada) cambio.fechaEstimada = b.fecha_estimada;
  // Al cotizar viaja la cuenta de cobro REAL del CRM (la elegida o la default activa).
  if (b.etapa === 'cotizada' || b.bank_account_id) {
    let q = supabase.from('bank_accounts').select('alias, banco, titular, cuenta, clabe, rfc').eq('activa', true);
    q = b.bank_account_id ? q.eq('id', b.bank_account_id) : q.eq('es_default', true);
    const { data: cta } = await q.limit(1).maybeSingle();
    if (!cta) return json({ error: 'No hay una cuenta de cobro activa en el CRM.' }, 400);
    cambio.pago = cta;
  }
  try {
    const j = await puente('/interno/crm/axo-mejoras/actualizar', cambio);
    const mej = j.mejora;
    // Espejo en `mejoras` de la empresa (si la cuenta está ligada a una empresa del CRM).
    const emp = (await empresasPorCuenta([b.account]))[b.account];
    if (emp && mej) {
      const fila: any = {
        company_id: emp.id, titulo: mej.titulo, descripcion: mej.descripcion || null,
        estado: estadoCrm(mej.etapa), origen: 'axo', tipo: 'mejora',
        categoria: mej.tipo === 'Plugin' ? 'plugin' : (mej.tipo === 'Integración' ? 'otro' : (mej.tipo === 'Ajuste' ? 'ajuste' : 'personalizacion')),
        valor: mej.costo === 'con_costo' ? mej.monto : 0,
        cobro: mej.costo === 'gratis' ? 'cortesia' : (['pago_confirmado', 'desarrollo', 'lista'].includes(mej.etapa) && mej.costo === 'con_costo' ? 'pagada' : null),
        fecha_compromiso: mej.fechaEstimada || null, visible_cliente: true, creado_por: 'AXO',
        updated_at: new Date().toISOString(),
      };
      const previo = (j.mejora && (j.mejora as any).crmMejoraId) || b.crm_mejora_id || null;
      if (previo) await supabase.from('mejoras').update(fila).eq('id', previo);
      else {
        const { data: nueva } = await supabase.from('mejoras').insert(fila).select('id').single();
        if (nueva?.id) await puente('/interno/crm/axo-mejoras/actualizar', { account: b.account, fid: b.fid, crmMejoraId: nueva.id });
      }
    }
    return json({ ok: true, mejora: mej, empresa: emp || null });
  } catch (e: any) {
    return json({ error: e?.message || 'No se pudo actualizar' }, 502);
  }
};
