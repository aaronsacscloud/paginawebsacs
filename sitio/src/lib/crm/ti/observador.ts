// TRABAJO INTELIGENTE · F2 — EL OBSERVADOR: reacciona a lo que pasa allá
// afuera y reordena la fila. «La fila es una proyección: los eventos invalidan
// y regeneran, no apilan.»
//
// No toca el webhook de WhatsApp (otra sesión lo trae a medias y el flujo del
// inbox ya es suyo): es un barrido ligero e idempotente sobre las tablas donde
// los eventos YA caen — corre cada 2 min por cron y al abrir el plan, así el
// consultor con el panel abierto ve el P1 en segundos.
//
// Universo: SOLO contactos dentro de Trabajo Inteligente (con cadencia o
// tarea viva). El resto del inbox no es asunto de este motor.
import { supabase } from '../../supabase';
import { leerConfig } from './motor';

const MS_MIN = 60e3;

async function marcarObservado(hasta: string) {
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  await supabase.from('ti_config').update({ valor: { ...(data?.valor || {}), observado_hasta: hasta } }).eq('id', 1);
}

export async function observar(): Promise<any> {
  const cfg: any = await leerConfig();
  const ahora = new Date();
  // Ventana: desde la última corrida (tope 60 min para no barrer historia).
  const desde = new Date(Math.max(
    Date.parse(cfg.observado_hasta || 0) || 0,
    ahora.getTime() - 60 * MS_MIN,
  )).toISOString();
  const res: any = { respuestas: 0, retiradas: 0, vistas_cotizacion: 0 };

  // ── 0) LA BITÁCORA (A0): los adaptadores proyectan lo nuevo a ti_eventos y
  //    el perfil de los contactos tocados se recalcula. Si falla, el resto del
  //    observador sigue: la bitácora es memoria, no el camino crítico del P1.
  try {
    const { sincronizarEventos } = await import('./eventos');
    const { recalcularPerfiles } = await import('./perfil');
    const ev = await sincronizarEventos();
    const per = await recalcularPerfiles(ev.tocados || []);
    res.eventos = ev.nuevos; res.perfiles = per.perfiles;
    if (Object.keys(ev.errores || {}).length) res.eventos_errores = ev.errores;
  } catch (e: any) { res.eventos_error = String(e?.message || e); }

  // ── 1) RESPUESTAS: mensajes ENTRANTES nuevos de contactos del universo TI ──
  const { data: msjs } = await supabase.from('wa_mensajes')
    .select('cuerpo, created_at, conversation_id, wa_conversaciones!inner(contact_id)')
    .eq('direccion', 'entrante').gt('created_at', desde)
    .order('created_at', { ascending: true }).limit(200);

  const porContacto: Record<string, { texto: string; cuando: string; n: number }> = {};
  for (const m of msjs || []) {
    const cid = (m as any).wa_conversaciones?.contact_id;
    if (!cid) continue;
    const prev = porContacto[cid];
    porContacto[cid] = { texto: String(m.cuerpo || '(media)'), cuando: m.created_at, n: (prev?.n || 0) + 1 };
  }
  const ids = Object.keys(porContacto);
  if (ids.length) {
    // ¿Cuáles son nuestros? (cadencia viva o tarea viva)
    const [{ data: cads }, { data: tars }, { data: contactos }] = await Promise.all([
      supabase.from('ti_cadencias').select('contact_id, estado').in('contact_id', ids).neq('estado', 'terminada'),
      supabase.from('ti_tareas').select('contact_id').in('contact_id', ids).eq('estado', 'pendiente'),
      supabase.from('contacts').select('id, nombre, whatsapp, owner_id, company_id').in('id', ids),
    ]);
    const nuestros = new Set([...(cads || []).map(x => x.contact_id), ...(tars || []).map(x => x.contact_id)]);
    const porId: Record<string, any> = {};
    for (const c of contactos || []) porId[c.id] = c;

    for (const cid of ids) {
      if (!nuestros.has(cid)) continue;
      const c = porId[cid] || {};
      const ev = porContacto[cid];
      const nombre = String(c.nombre || 'El lead').trim().split(/\s+/)[0];

      // a) La cadencia fría termina su trabajo: conversación viva.
      await supabase.from('ti_cadencias').update({
        estado: 'conversacion', pausa_causa: 'respondió', updated_at: ahora.toISOString(),
      }).eq('contact_id', cid).neq('estado', 'terminada');

      // b) Las tareas de cadencia pendientes ya no aplican: se RETIRAN.
      const { data: retiradas } = await supabase.from('ti_tareas')
        .update({ estado: 'retirada', retirada_causa: 'respondió', updated_at: ahora.toISOString() })
        .eq('contact_id', cid).eq('estado', 'pendiente').not('paso', 'is', null)
        .select('id');
      res.retiradas += (retiradas || []).length;

      // c) UNA tarea P1 por contacto (consolidación de señales): si ya hay una
      //    pendiente de responder, se refresca; si no, nace.
      const { data: previa } = await supabase.from('ti_tareas')
        .select('id, payload').eq('contact_id', cid).eq('estado', 'pendiente')
        .eq('tipo', 'responder').maybeSingle();
      const hechos = [
        ['Respondió hace', 'ahora', 'cada hora sin contestar cuesta', 'morado'],
        ['Mensajes nuevos', String(ev.n), ev.texto.slice(0, 46), 'verde'],
        ['Ventana WA', 'Abierta 24 h', 'puedes escribir libre'],
      ];
      if (previa) {
        await supabase.from('ti_tareas').update({
          vence_at: ahora.toISOString(), prioridad: 1, atrasada: false, updated_at: ahora.toISOString(),
          payload: { ...(previa.payload || {}), entrante: ev.texto, hechos, mensajes_nuevos: ((previa.payload as any)?.mensajes_nuevos || 0) + ev.n },
        }).eq('id', previa.id);
      } else {
        await supabase.from('ti_tareas').insert({
          contact_id: cid, company_id: c.company_id || null, owner_id: c.owner_id || null,
          familia: 'responder', tipo: 'responder', prioridad: 1, vence_at: ahora.toISOString(),
          origen: 'evento', payload: {
            instruccion: `${nombre} respondió — contéstale ya`,
            porque: 'Un lead que responde es lo más importante de tu día: la tasa de cierre cae por hora que pasa sin contestarle.',
            nombre: c.nombre, whatsapp: c.whatsapp, entrante: ev.texto, hechos,
          },
        });
      }
      res.respuestas++;
    }
  }

  // ── 2) LA ESTÁ VIENDO: cotización enviada con vista nueva → P1 ──
  const { data: vistas } = await supabase.from('quotes')
    .select('id, numero, total, vistas, ultima_vista_at, contact_id, contacts!inner(id, nombre, whatsapp, owner_id, company_id)')
    .eq('estado', 'sent').gt('ultima_vista_at', desde).not('contact_id', 'is', null).limit(50);
  for (const qv of vistas || []) {
    const c = (qv as any).contacts;
    // idempotente: una tarea de vista por cotización por día
    const { data: ya } = await supabase.from('ti_tareas')
      .select('id').eq('contact_id', qv.contact_id).eq('estado', 'pendiente')
      .eq('origen', 'evento').eq('tipo', 'llamada')
      .gte('created_at', new Date(ahora.getTime() - 20 * 3600e3).toISOString())
      .filter('payload->>quote_id', 'eq', String(qv.id)).maybeSingle();
    if (ya) continue;
    const nombre = String(c.nombre || 'El lead').trim().split(/\s+/)[0];
    await supabase.from('ti_tareas').insert({
      contact_id: qv.contact_id, company_id: c.company_id || null, owner_id: c.owner_id || null,
      familia: 'avanzar', tipo: 'llamada', prioridad: 1, vence_at: ahora.toISOString(),
      origen: 'evento', payload: {
        instruccion: `${nombre} está viendo su cotización AHORA — llámale`,
        porque: 'Abrió la cotización hace minutos: la está estudiando. Llamar en ese momento tiene tasa de cierre altísima — el ángulo es resolver la duda, no presionar.',
        nombre: c.nombre, whatsapp: c.whatsapp, quote_id: String(qv.id),
        tipo_llamada: 'Seguimiento de cotización',
        resultados: { la_firma: 'La firma', pidio_cambios: 'Pidió cambios', la_rechazo: 'La rechazó', no_contesto: 'No contestó', buzon: 'Buzón' },
        hechos: [
          ['La cotización', `#${qv.numero || 's/n'}`, `$${Math.round(Number(qv.total) || 0).toLocaleString('es-MX')}`],
          ['La abrió', `${qv.vistas || 1} veces`, 'la última: hace minutos', 'morado'],
          ['Ventana', 'AHORA', 'está frente a ella', 'verde'],
        ],
      },
    });
    res.vistas_cotizacion++;
  }

  // ── 2b) EL AGENTE SDR (N2): propone respuesta a cada lead que escribió y
  //    despacha lo que ya venció su ventana de veto. Apagado = no hace nada.
  try {
    const { proponerRespuestas, despacharEnvios } = await import('./agente');
    res.agente = await proponerRespuestas();
    res.agente_despacho = await despacharEnvios();
  } catch (e: any) { res.agente_error = String(e?.message || e); }

  // ── 3) EL COPILOTO: cubre los P1 que el humano no alcanzó (F5) ──
  try {
    const { cubrirPendientes } = await import('./copiloto');
    Object.assign(res, await cubrirPendientes());
  } catch (e: any) { res.copiloto_error = String(e?.message || e); }

  await marcarObservado(ahora.toISOString());
  return res;
}
