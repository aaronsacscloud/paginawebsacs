// El cartero del motor Account-Based: manda los correos aprobados que ya tocan,
// y trae de vuelta lo que pasó con los anteriores.
//
// Arranca PAUSADO a propósito (abm_config.pausado = 'si'). Un correo en frío
// mal calibrado no cuesta dinero: cuesta el dominio, y con él la comunicación
// con los clientes que ya pagan.
//
// Cuatro frenos, en este orden:
//   1. Pausa manual desde la base, sin desplegar.
//   2. Cupo diario que sube con el calentamiento (empieza en 15, sube ~30% cada
//      tres días hasta el tope). Un dominio nuevo que manda 300 el primer día
//      va directo a spam.
//   3. Nunca dos correos al mismo negocio el mismo día.
//   4. Corte automático si el día viene con demasiados rebotes.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { sendEmail } from '../../../lib/email';
import { apuntar } from '../../../lib/crm/abm.lib';

export const prerender = false;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

/** La rampa: 15 el primer día y +30% cada tres días, hasta el tope. */
export function cupoDelDia(inicio: string, cupoInicial: number, tope: number, hoy = new Date()): number {
  const d0 = new Date(inicio + 'T00:00:00Z').getTime();
  if (!Number.isFinite(d0)) return cupoInicial;
  const dias = Math.max(0, Math.floor((hoy.getTime() - d0) / 864e5));
  const saltos = Math.floor(dias / 3);
  return Math.min(tope, Math.round(cupoInicial * Math.pow(1.3, saltos)));
}

async function config(): Promise<Record<string, string>> {
  const { data } = await supabase.from('abm_config').select('clave, valor');
  return Object.fromEntries((data || []).map((r: any) => [r.clave, r.valor]));
}

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = (import.meta.env.CRON_SECRET || process.env.CRON_SECRET || '').trim();
  if (secret && auth !== `Bearer ${secret}`) return json({ error: 'no autorizado' }, 401);

  const cfg = await config();
  const hoy = new Date().toISOString().slice(0, 10);
  const espejo = await espejarEventos();

  if ((cfg.pausado || 'si') === 'si') {
    return json({ pausado: true, motivo: 'abm_config.pausado = si', espejo });
  }

  const tope = Number(cfg.tope_diario || 120);
  const cupo = cupoDelDia(cfg.calentamiento_inicio || hoy, Number(cfg.cupo_inicial || 15), tope);

  const { count: yaHoy } = await supabase.from('abm_toques').select('id', { count: 'exact', head: true })
    .eq('estado', 'enviado').gte('enviado_at', hoy + 'T00:00:00Z');
  const restante = Math.max(0, cupo - (yaHoy || 0));
  if (!restante) return json({ enviados: 0, cupo, ya_hoy: yaHoy || 0, motivo: 'cupo del día agotado', espejo });

  // Rebotes del día: si se dispara, se corta y se avisa. Un dominio quemado no
  // se recupera pidiendo perdón.
  const { count: rebotesHoy } = await supabase.from('abm_actividad').select('id', { count: 'exact', head: true })
    .eq('tipo', 'rebote').gte('ocurrio_at', hoy + 'T00:00:00Z');
  if ((rebotesHoy || 0) >= Math.max(3, Math.round(cupo * 0.05))) {
    await supabase.from('abm_config').update({ valor: 'si', nota: `pausado solo el ${hoy} por ${rebotesHoy} rebotes` }).eq('clave', 'pausado');
    return json({ enviados: 0, pausado_por_rebotes: rebotesHoy, espejo });
  }

  const { data: toques } = await supabase.from('abm_toques')
    .select('id, cuenta_id, destino, asunto, cuerpo, programado_at')
    .eq('estado', 'aprobado').eq('canal', 'email')
    .lte('programado_at', new Date().toISOString())
    .order('programado_at').limit(restante * 3);

  const bloqueadas = new Set<string>();
  const { data: no } = await supabase.from('abm_no_contactar').select('valor');
  for (const r of no || []) bloqueadas.add(String(r.valor).toLowerCase());

  let enviados = 0; const fallos: string[] = [];
  const tocadasHoy = new Set<string>();
  const { data: hoyYa } = await supabase.from('abm_toques').select('cuenta_id').eq('estado', 'enviado').gte('enviado_at', hoy + 'T00:00:00Z');
  for (const r of hoyYa || []) tocadasHoy.add(r.cuenta_id);

  for (const t of toques || []) {
    if (enviados >= restante) break;
    if (tocadasHoy.has(t.cuenta_id)) continue;                       // uno por negocio al día
    if (bloqueadas.has(String(t.destino || '').toLowerCase())) {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'está en la lista de no contactar' }).eq('id', t.id);
      continue;
    }
    const { data: cuenta } = await supabase.from('abm_cuentas').select('etapa, nombre').eq('id', t.cuenta_id).maybeSingle();
    if (!cuenta || cuenta.etapa === 'no_contactar' || cuenta.etapa === 'respondio' || cuenta.etapa === 'ganada') {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'la cuenta ya no está en cadencia' }).eq('id', t.id);
      continue;
    }
    const r = await sendEmail({
      to: t.destino, subject: t.asunto || '',
      text: t.cuerpo || '', html: (t.cuerpo || '').replace(/\n/g, '<br>'),
      categoria: 'abm',
    });
    const ok = r.status === 'sent' || r.status === 'queued';
    await supabase.from('abm_toques').update({
      estado: ok ? 'enviado' : 'fallido', enviado_at: new Date().toISOString(),
      send_id: r.id || null, mensaje_id: r.provider_id || null,
      resultado: ok ? null : String(r.error || 'no se pudo enviar').slice(0, 300),
    }).eq('id', t.id);
    await apuntar(t.cuenta_id, 'email', ok ? 'envio' : 'rebote', { toque_id: t.id, texto: ok ? `Salió: ${t.asunto}` : `No salió: ${r.error}` });
    if (ok) {
      enviados++; tocadasHoy.add(t.cuenta_id);
      await supabase.from('abm_cuentas').update({ ultimo_toque_at: new Date().toISOString() }).eq('id', t.cuenta_id);
    } else fallos.push(String(r.error).slice(0, 120));
  }

  return json({ enviados, cupo, ya_hoy: yaHoy || 0, fallos: fallos.slice(0, 5), espejo });
};

/** Trae a la bitácora lo que SendGrid ya contó en email_sends. */
async function espejarEventos() {
  const { data: toques } = await supabase.from('abm_toques')
    .select('id, cuenta_id, send_id').eq('estado', 'enviado').not('send_id', 'is', null)
    .gte('enviado_at', new Date(Date.now() - 21 * 864e5).toISOString()).limit(500);
  if (!toques?.length) return { revisados: 0, nuevos: 0 };

  const ids = toques.map(t => t.send_id);
  const { data: sends } = await supabase.from('email_sends')
    .select('id, estado, delivered_at, opened_at, clicked_at, bounced_at').in('id', ids);
  const porId: Record<string, any> = {};
  for (const s of sends || []) porId[s.id] = s;

  // Lo que ya está apuntado, para no duplicar la línea de tiempo.
  const { data: yaHay } = await supabase.from('abm_actividad')
    .select('toque_id, tipo').in('toque_id', toques.map(t => t.id));
  const visto = new Set((yaHay || []).map((a: any) => `${a.toque_id}|${a.tipo}`));

  const nuevos: any[] = [];
  for (const t of toques) {
    const s = porId[t.send_id!]; if (!s) continue;
    const par = (tipo: string, cuando: string | null) => {
      if (!cuando || visto.has(`${t.id}|${tipo}`)) return;
      nuevos.push({ cuenta_id: t.cuenta_id, toque_id: t.id, canal: 'email', tipo, ocurrio_at: cuando });
    };
    par('entrega', s.delivered_at);
    par('apertura', s.opened_at);
    par('clic', s.clicked_at);
    par('rebote', s.bounced_at);
    if (s.estado === 'spam' && !visto.has(`${t.id}|spam`)) nuevos.push({ cuenta_id: t.cuenta_id, toque_id: t.id, canal: 'email', tipo: 'spam', ocurrio_at: new Date().toISOString() });
  }
  if (nuevos.length) await supabase.from('abm_actividad').insert(nuevos);

  // Quien hace clic o rebota cambia de estado: el clic es intención real, y el
  // rebote invalida el canal para que nadie le vuelva a escribir ahí.
  for (const n of nuevos) {
    if (n.tipo === 'clic') await supabase.from('abm_cuentas').update({ etapa: 'respondio', updated_at: new Date().toISOString() }).eq('id', n.cuenta_id).eq('etapa', 'en_cadencia');
    if (n.tipo === 'rebote' || n.tipo === 'spam') {
      const { data: tq } = await supabase.from('abm_toques').select('destino').eq('id', n.toque_id).maybeSingle();
      if (tq?.destino) await supabase.from('abm_canales').update({ estado: n.tipo === 'spam' ? 'opt_out' : 'rebote' }).eq('cuenta_id', n.cuenta_id).eq('valor', tq.destino);
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: n.tipo }).eq('cuenta_id', n.cuenta_id).in('estado', ['aprobado', 'programado']);
    }
  }
  return { revisados: toques.length, nuevos: nuevos.length };
}
