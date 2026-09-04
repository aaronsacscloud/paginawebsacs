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
// Se manda por el MISMO pipeline que las campañas, no por el atajo de
// sendEmail: el pipeline es el que pone el pie con la liga de baja, las
// cabeceras List-Unsubscribe (el botón nativo de "Cancelar suscripción" de
// Gmail), el Reply-To con el id del envío —para que la respuesta vuelva y
// frene la cadencia— y la medición de clics. Un correo en frío sin forma de
// darse de baja solo deja un botón a la mano: "Reportar como spam".
import { enviarCorreo } from '../../../lib/email/pipeline';
import { apuntar, repuntuar } from '../../../lib/crm/abm.lib';

export const prerender = false;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

/** La rampa cuenta DÍAS CON ENVÍOS REALES, no días de calendario.
 *
 *  Calentar es enseñarle al proveedor que este dominio manda poquito y bien.
 *  Si la rampa corriera con el reloj, encender el sistema tres semanas después
 *  arrancaría en 90 correos diarios sobre un dominio que nunca mandó uno — que
 *  es exactamente lo que se quería evitar. */
export function cupoDelDia(diasConEnvios: number, cupoInicial: number, tope: number): number {
  const saltos = Math.floor(Math.max(0, diasConEnvios) / 3);
  return Math.min(tope, Math.round(cupoInicial * Math.pow(1.3, saltos)));
}

/** El cuerpo es texto de una persona: en HTML son párrafos, nada más. */
function aHtml(texto: string): string {
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return texto.split('\n').filter((l: string) => l.trim())
    .map((l: string) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('');
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

  // La pausa automática se levanta sola al día siguiente. Antes el disyuntor
  // escribía "si" y nadie lo volvía a encender: un tropiezo dejaba la
  // prospección apagada hasta que alguien lo notara a mano.
  let pausado = cfg.pausado || 'si';
  if (pausado === 'auto') {
    const { data: fila } = await supabase.from('abm_config').select('hasta').eq('clave', 'pausado').maybeSingle();
    if (!fila?.hasta || String(fila.hasta) < hoy) {
      await supabase.from('abm_config').update({ valor: 'no', hasta: null, nota: 'reactivado solo tras la pausa automática' }).eq('clave', 'pausado');
      pausado = 'no';
    }
  }
  if (pausado === 'si') return json({ pausado: true, motivo: 'abm_config.pausado = si', espejo });
  if (pausado === 'auto') return json({ pausado: true, motivo: 'pausa automática por rebotes, se levanta mañana', espejo });

  const tope = Number(cfg.tope_diario || 120);
  const { data: diasPrevios } = await supabase.rpc('abm_dias_con_envios').single().then(
    (r: any) => r, () => ({ data: null as any }));
  let dias = Number((diasPrevios as any)?.dias ?? NaN);
  if (!Number.isFinite(dias)) {
    // Sin la función en la base, se cuenta a mano (barato: son pocas filas).
    const { data: env } = await supabase.from('abm_toques').select('enviado_at').eq('estado', 'enviado').limit(5000);
    dias = new Set((env || []).map((e: any) => String(e.enviado_at).slice(0, 10))).size;
  }
  const cupo = cupoDelDia(dias, Number(cfg.cupo_inicial || 15), tope);

  const { count: yaHoy } = await supabase.from('abm_toques').select('id', { count: 'exact', head: true })
    .eq('estado', 'enviado').gte('enviado_at', hoy + 'T00:00:00Z');
  const restante = Math.max(0, cupo - (yaHoy || 0));
  if (!restante) return json({ enviados: 0, cupo, dias_calentando: dias, ya_hoy: yaHoy || 0, motivo: 'cupo del día agotado', espejo });

  // El disyuntor cuenta REBOTES DE VERDAD (los que reporta SendGrid tras
  // entregar), no los fallos por una dirección mal escrita: seis direcciones
  // truncadas bastaban para apagar el sistema entero el primer día.
  const { count: rebotesHoy } = await supabase.from('abm_actividad').select('id', { count: 'exact', head: true })
    .eq('tipo', 'rebote').eq('canal', 'email').gte('ocurrio_at', hoy + 'T00:00:00Z');
  if ((rebotesHoy || 0) >= Math.max(3, Math.round(cupo * 0.05))) {
    await supabase.from('abm_config').update({ valor: 'auto', hasta: hoy, nota: `pausado el ${hoy} por ${rebotesHoy} rebotes` }).eq('clave', 'pausado');
    return json({ enviados: 0, pausado_por_rebotes: rebotesHoy, espejo });
  }

  const { data: toques } = await supabase.from('abm_toques')
    .select('id, cuenta_id, destino, asunto, cuerpo, programado_at')
    .eq('estado', 'aprobado').eq('canal', 'email')
    .lte('programado_at', new Date().toISOString())
    .order('programado_at').limit(restante * 4);

  const bloqueadas = new Set<string>();
  const { data: no } = await supabase.from('abm_no_contactar').select('valor');
  for (const r of no || []) bloqueadas.add(String(r.valor).toLowerCase());

  // Uno por BUZÓN al día, no por cuenta: diez direcciones están repetidas entre
  // dos negocios distintos, y ese buzón recibía dos correos en frío el mismo día.
  const tocadosHoy = new Set<string>();
  const { data: hoyYa } = await supabase.from('abm_toques').select('destino').eq('estado', 'enviado').gte('enviado_at', hoy + 'T00:00:00Z');
  for (const r of hoyYa || []) tocadosHoy.add(String(r.destino || '').toLowerCase());

  const CORREO_OK = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
  let enviados = 0; const fallos: string[] = [];

  for (const t of toques || []) {
    if (enviados >= restante) break;
    const destino = String(t.destino || '').toLowerCase();
    if (tocadosHoy.has(destino)) continue;
    if (!CORREO_OK.test(destino) || bloqueadas.has(destino)) {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: CORREO_OK.test(destino) ? 'está en la lista de no contactar' : 'la dirección no tiene forma de dirección' }).eq('id', t.id);
      continue;
    }
    const { data: cuenta } = await supabase.from('abm_cuentas').select('etapa, ya_es_cliente').eq('id', t.cuenta_id).maybeSingle();
    if (!cuenta || cuenta.ya_es_cliente || ['no_contactar', 'respondio', 'reunion', 'ganada'].includes(cuenta.etapa)) {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'la cuenta ya no está en cadencia' }).eq('id', t.id);
      continue;
    }

    // Del tercer correo en adelante se contesta DENTRO del mismo hilo: el
    // prospecto ve el contexto sin buscar y el proveedor lo lee como
    // conversación, no como campaña.
    const { data: previos } = await supabase.from('abm_toques')
      .select('mensaje_id, asunto, enviado_at').eq('cuenta_id', t.cuenta_id).eq('estado', 'enviado')
      .not('mensaje_id', 'is', null).order('enviado_at').limit(1);
    const raiz = (previos || [])[0];
    const enHilo = !!raiz;   // el hilo se sostiene con el asunto Re: (el pipeline arma sus propias cabeceras)
    const asunto = enHilo ? (String(raiz.asunto || t.asunto).startsWith('Re:') ? raiz.asunto : `Re: ${raiz.asunto}`) : t.asunto || '';

    const r = await enviarCorreo({
      para: t.destino, asunto,
      // Texto plano de verdad: el correo en frío que parece boletín no se lee
      // y además entrega peor. El HTML es el mismo texto con saltos de línea.
      texto: t.cuerpo || '',
      html: aHtml(t.cuerpo || ''),
      categoria: 'marketing',
    });
    const ok = r.enviado;
    await supabase.from('abm_toques').update({
      estado: ok ? 'enviado' : 'fallido', enviado_at: new Date().toISOString(),
      send_id: r.sendId || null, asunto,
      resultado: ok ? null : `${r.motivo || 'no salió'}: ${String(r.detalle || '').slice(0, 200)}`,
    }).eq('id', t.id);
    await apuntar(t.cuenta_id, 'email', ok ? 'envio' : 'nota', { toque_id: t.id, texto: ok ? `Salió: ${asunto}` : `No salió (${r.motivo}): ${r.detalle || ''}` });
    if (ok) {
      enviados++; tocadosHoy.add(destino);
      await supabase.from('abm_cuentas').update({ ultimo_toque_at: new Date().toISOString() }).eq('id', t.cuenta_id);
      await supabase.from('abm_cuentas').update({ etapa: 'en_cadencia', updated_at: new Date().toISOString() }).eq('id', t.cuenta_id).eq('etapa', 'sin_tocar');
    } else fallos.push(`${r.motivo}: ${String(r.detalle || '').slice(0, 90)}`);
  }

  return json({ enviados, cupo, dias_calentando: dias, ya_hoy: yaHoy || 0, fallos: fallos.slice(0, 5), espejo });
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
    // Un clic es INTERÉS, no respuesta: sube la prioridad y deja correr la
    // cadencia. Marcarlo como "respondió" y frenar ahí apagaba el seguimiento
    // justo sobre la señal más caliente que hay.
    if (n.tipo === 'clic') {
      await supabase.from('abm_senales').insert({ cuenta_id: n.cuenta_id, tipo: 'clic', detalle: 'Hizo clic en un correo de la cadencia', peso: 3 });
      await repuntuar(n.cuenta_id);
    }
    if (n.tipo === 'rebote' || n.tipo === 'spam') {
      const { data: tq } = await supabase.from('abm_toques').select('destino').eq('id', n.toque_id).maybeSingle();
      if (tq?.destino) await supabase.from('abm_canales').update({ estado: n.tipo === 'spam' ? 'opt_out' : 'rebote' }).eq('cuenta_id', n.cuenta_id).eq('valor', tq.destino);
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: n.tipo }).eq('cuenta_id', n.cuenta_id).in('estado', ['aprobado', 'programado']);
    }
  }
  return { revisados: toques.length, nuevos: nuevos.length };
}
