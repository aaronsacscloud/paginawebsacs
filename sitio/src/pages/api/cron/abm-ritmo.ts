// El ritmo de las cuentas: quién sube a llamada, quién se duerme y quién despierta.
//
// Hasta aquí la cadencia era un calendario: los toques salían los días
// 1-3-7-11-16-22-30 pasara lo que pasara. Este proceso hace lo contrario —
// mira lo que ESTÁ pasando y mueve la cuenta en consecuencia:
//
//   · Tres aperturas sin responder → sube a la cola de llamada. Leer tres
//     veces y no contestar es interés sin urgencia: eso se resuelve hablando.
//   · Siete toques sin UNA sola apertura → a dormir 90 días. El problema no es
//     el momento, es el canal; insistir solo gasta reputación.
//   · Cinco aperturas sin respuesta → también a llamada, y se para el correo.
//   · Una pausa vencida vuelve a la fila. Y una señal nueva la despierta ANTES:
//     el correo que llega la semana que abrieron tienda se contesta; el que
//     llega porque tocaba el día 11, no.
//
// Corre después del cartero, todos los días.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { apuntar, repuntuar } from '../../../lib/crm/abm.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const DIAS_DORMIDA = 90;      // sin una sola apertura: el canal no sirve
const DIAS_LEYENDO = 45;      // abre y no contesta: se le da aire y se le llama

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = (import.meta.env.CRON_SECRET || process.env.CRON_SECRET || '').trim();
  if (secret && auth !== `Bearer ${secret}`) return json({ error: 'no autorizado' }, 401);

  const hoy = new Date().toISOString().slice(0, 10);
  const enFecha = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

  // ── 1. Las pausas vencidas vuelven a la fila ──
  const { data: despiertan } = await supabase.from('abm_cuentas')
    .select('id, nombre, pausa_motivo').eq('etapa', 'en_pausa').lte('pausa_hasta', hoy).limit(300);
  for (const c of despiertan || []) {
    await supabase.from('abm_cuentas')
      .update({ etapa: 'sin_tocar', pausa_hasta: null, pausa_motivo: null, updated_at: new Date().toISOString() })
      .eq('id', c.id);
    await apuntar(c.id, 'sistema', 'nota', { texto: 'Vuelve a la fila: se cumplió la pausa' });
  }

  // ── 2. Una señal nueva despierta ANTES de tiempo ──
  // Que abran tienda o cambien de gerente vale más que cualquier plazo.
  const { data: senales } = await supabase.from('abm_senales')
    .select('cuenta_id, tipo, detalle').in('tipo', ['expansion', 'vacante', 'cambio_gerente'])
    .gte('created_at', new Date(Date.now() - 8 * 864e5).toISOString()).limit(200);
  const porSenal = new Set<string>();
  for (const s of senales || []) {
    const { data: c } = await supabase.from('abm_cuentas').select('id, etapa').eq('id', s.cuenta_id).maybeSingle();
    if (c?.etapa !== 'en_pausa') continue;
    await supabase.from('abm_cuentas')
      .update({ etapa: 'sin_tocar', pausa_hasta: null, pausa_motivo: null, fatiga: 0, updated_at: new Date().toISOString() })
      .eq('id', c.id);
    await apuntar(c.id, 'sistema', 'nota', { texto: `Despierta antes de tiempo: ${s.detalle}` });
    porSenal.add(c.id);
  }

  // ── 3. Las que están en cadencia: leer su comportamiento ──
  const { data: activas } = await supabase.from('abm_cuentas')
    .select('id, nombre, etapa, fatiga').eq('etapa', 'en_cadencia').limit(500);

  let aLlamada = 0, dormidas = 0;
  for (const c of activas || []) {
    const [{ count: enviados }, { count: aperturas }, { count: clics }, { count: respuestas }] = await Promise.all([
      supabase.from('abm_actividad').select('id', { count: 'exact', head: true }).eq('cuenta_id', c.id).eq('tipo', 'envio'),
      supabase.from('abm_actividad').select('id', { count: 'exact', head: true }).eq('cuenta_id', c.id).eq('tipo', 'apertura'),
      supabase.from('abm_actividad').select('id', { count: 'exact', head: true }).eq('cuenta_id', c.id).eq('tipo', 'clic'),
      supabase.from('abm_actividad').select('id', { count: 'exact', head: true }).eq('cuenta_id', c.id).in('tipo', ['respuesta', 'reunion']),
    ]);
    if (respuestas) continue;                        // ya contestó: no se toca

    const env = enviados || 0, ab = aperturas || 0;
    await supabase.from('abm_cuentas').update({ fatiga: env }).eq('id', c.id);

    // Abre y no contesta: deja de escribir y llama. Es interés sin urgencia,
    // y eso no se resuelve con otro correo.
    if (ab >= 3 || (clics || 0) >= 1) {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'abrió varias veces: pasa a llamada' })
        .eq('cuenta_id', c.id).in('estado', ['borrador', 'aprobado', 'programado']);
      await supabase.from('abm_senales').insert({
        cuenta_id: c.id, tipo: 'vacante', origen: 'sistema', peso: 10, fecha: hoy,
        caduca_at: enFecha(30), detalle: `Abrió ${ab} veces sin contestar: hay que llamarle`,
      });
      await supabase.from('abm_cuentas').update({ etapa: 'en_pausa', pausa_hasta: enFecha(DIAS_LEYENDO), pausa_motivo: 'abre y no contesta: toca llamada' }).eq('id', c.id);
      await apuntar(c.id, 'sistema', 'nota', { texto: `Abrió ${ab} correos sin contestar: se detiene el correo y sube a la cola de llamada` });
      await repuntuar(c.id);
      aLlamada++;
      continue;
    }

    // Siete correos y ni una apertura: el canal no sirve. Dormir, no insistir.
    if (env >= 7 && ab === 0) {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'siete correos sin una sola apertura' })
        .eq('cuenta_id', c.id).in('estado', ['borrador', 'aprobado', 'programado']);
      await supabase.from('abm_cuentas')
        .update({ etapa: 'en_pausa', pausa_hasta: enFecha(DIAS_DORMIDA), pausa_motivo: 'siete correos sin una sola apertura' })
        .eq('id', c.id);
      await apuntar(c.id, 'sistema', 'nota', { texto: 'Siete correos sin una sola apertura: duerme 90 días. El problema es el canal, no el momento.' });
      dormidas++;
    }
  }

  return json({
    despertadas_por_fecha: (despiertan || []).length,
    despertadas_por_senal: porSenal.size,
    a_llamada: aLlamada, dormidas,
    revisadas: (activas || []).length,
  });
};
