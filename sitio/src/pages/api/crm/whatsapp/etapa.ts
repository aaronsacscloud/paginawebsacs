// INBOX · cambiar la ETAPA del contacto y registrar un SEGUIMIENTO prometido.
//
// Las dos cosas viven juntas porque se piden desde el mismo lugar —la cabecera
// de la conversación— y en el mismo momento: «este ya no es un perdido, está
// negociando, y le tengo que marcar en 30 días».
//
// POST { accion:'etapa',      id|contact_id, etapa }          → { ok, salidas }
// POST { accion:'seguimiento', id|contact_id, motivo, fecha } → { ok, seguimiento }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getSessionFromRequest } from '../../../../lib/auth/session';
import { ETAPAS_CERRADAS } from '../../../../lib/crm/puerta';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/* Las etapas a las que se puede mover A MANO desde el inbox. No es el catálogo
   completo a propósito: `cliente` y `evangelista` los pone el cobro, no un
   clic —marcar cliente a alguien que no ha pagado descuadra el ARR—. */
const ETAPAS_MANUALES = new Set([
  'lead', 'lead_calificado', 'oportunidad', 'en_conciliacion',
  'rezagado', 'churned', 'perdido_definitivo', 'descalificado', 'suscriptor',
  /* `cliente` SÍ se puede poner a mano, pero sólo con cuenta detrás — ver
     abajo. El problema nunca fue marcar cliente: fue marcarlo suelto, sin
     empresa, que es lo que descuadra el ARR. Con la cuenta ligada, el número
     sigue cuadrando y se ahorra el rodeo de tres pantallas. (Pedido del dueño,
     17-sep-2026: «que me pida si relacionarlo o crear uno nuevo».) */
  'cliente',
]);

/* Las que NO se sostienen solas: exigen una empresa a la que colgarlas.
   `evangelista` se queda fuera del catálogo manual entero: eso lo gana el
   cliente con el tiempo, no se decide en una conversación. */
const ETAPAS_CON_CUENTA = new Set(['cliente']);

/* Entrar aquí significa «ya lo lleva una persona»: se apagan los automatismos.
   `en_conciliacion` es el caso que lo pidió —un perdido que aceptó negociar no
   puede seguir recibiendo la cadencia de recuperación mientras negocia—, y
   `descalificado` por la misma razón que el caso Montse. */
/* Las que apagan lo automático salen de LA PUERTA (lib/crm/puerta.ts), que es
   el único sitio donde eso se decide. Antes estaba escrito aquí y otra vez en
   la cadencia y otra vez en el ABM: tres listas que se creían la misma. */
const ETAPAS_QUE_APAGAN = new Set(Object.keys(ETAPAS_CERRADAS));

async function contactoDe(b: any): Promise<string | null> {
  if (b.contact_id) return String(b.contact_id);
  if (!b.id) return null;
  const { data } = await supabase.from('wa_conversaciones').select('contact_id').eq('id', b.id).maybeSingle();
  return (data as any)?.contact_id || null;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionFromRequest(request).catch(() => null);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const contactId = await contactoDe(b);
  if (!contactId) return json({ error: 'Esta conversación todavía no tiene contacto en el CRM' }, 400);
  const ahora = new Date().toISOString();

  /* ── SEGUIMIENTO PROMETIDO ──────────────────────────────────────────────── */
  if (b.accion === 'seguimiento') {
    const motivo = String(b.motivo || '').trim().slice(0, 300);
    const fecha = String(b.fecha || '').slice(0, 10);
    if (!motivo) return json({ error: 'Escribe para qué es el seguimiento' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return json({ error: 'La fecha no es válida' }, 400);
    // Hacia atrás no: un seguimiento con fecha pasada nace vencido y ensucia la
    // bandeja desde el primer día.
    if (fecha < new Date().toISOString().slice(0, 10)) return json({ error: 'Esa fecha ya pasó' }, 400);

    const { data, error } = await supabase.from('crm_seguimientos').insert({
      contact_id: contactId, conversation_id: b.id || null,
      motivo, fecha, creado_por: (user as any)?.id || null,
    }).select('id, motivo, fecha').maybeSingle();
    if (error) return json({ error: error.message }, 500);

    await supabase.from('activities').insert({
      contact_id: contactId, tipo: 'seguimiento', automatico: false,
      titulo: `Pidió seguimiento para el ${fecha}`, descripcion: motivo,
    }).then(() => {}, () => {});
    return json({ ok: true, seguimiento: data });
  }

  /* ── CAMBIO DE ETAPA ────────────────────────────────────────────────────── */
  const etapa = String(b.etapa || '').trim();
  if (!ETAPAS_MANUALES.has(etapa)) return json({ error: 'Esa etapa no se puede poner desde aquí' }, 400);

  /* LA PUERTA DEL ARR. Si la etapa exige cuenta, o viene una en el cuerpo o el
     contacto ya tiene la suya. Un «cliente» sin empresa no aparece en ningún
     informe de ARR, y un número que no cuadra es peor que un dato que falta:
     el que falta se nota. */
  let parche: any = { lifecycle_stage: etapa, updated_at: ahora };
  if (ETAPAS_CON_CUENTA.has(etapa)) {
    const { data: ct } = await supabase.from('contacts').select('company_id').eq('id', contactId).maybeSingle();
    const compId = b.company_id || ct?.company_id || null;
    if (!compId) return json({ error: 'Para marcarlo como cliente hace falta la cuenta: relaciónalo con una que ya exista o crea una nueva.', falta: 'company_id' }, 400);
    const { data: co } = await supabase.from('companies').select('id').eq('id', compId).maybeSingle();
    if (!co) return json({ error: 'Esa cuenta no existe.', falta: 'company_id' }, 400);
    parche.company_id = compId;
    parche.tipo = 'cliente';
  }

  const { error } = await supabase.from('contacts').update(parche).eq('id', contactId);
  if (error) return json({ error: error.message }, 500);

  /* Apagar los automatismos es parte del cambio, no un paso aparte que alguien
     tenga que acordarse de hacer. El caso Montse enseñó que si esto queda como
     tarea humana, no se hace: siguió recibiendo correos después de decir que no. */
  const salidas: string[] = [];
  if (ETAPAS_QUE_APAGAN.has(etapa)) {
    const { count: secs } = await supabase.from('crm_secuencia_miembros')
      .update({ detenida_at: ahora, motivo: etapa }, { count: 'exact' })
      .eq('contact_id', contactId).is('detenida_at', null);
    if (secs) salidas.push(`${secs} secuencia${secs === 1 ? '' : 's'}`);
    const { count: cad } = await supabase.from('ti_cadencias')
      .update({ estado: 'terminada', terminada_motivo: etapa, updated_at: ahora }, { count: 'exact' })
      .eq('contact_id', contactId).neq('estado', 'terminada');
    if (cad) salidas.push('la cadencia del agente');
    await supabase.from('ti_envios')
      .update({ estado: 'vetado', motivo_veto: `pasó a ${etapa}`, updated_at: ahora })
      .eq('contact_id', contactId).eq('estado', 'pendiente').then(() => {}, () => {});
  }

  await supabase.from('activities').insert({
    contact_id: contactId, tipo: 'etapa', automatico: false,
    titulo: `Cambió de etapa a «${etapa}»`,
    descripcion: salidas.length ? `Se sacó de ${salidas.join(' y ')}.` : null,
  }).then(() => {}, () => {});

  return json({ ok: true, etapa, salidas });
};
