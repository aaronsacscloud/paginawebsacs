// TRABAJO INTELIGENTE · El motor — enrolar, generar el plan, transformar lo
// vencido y avanzar la cadencia. Spec: sitio/PLAN-TRABAJO-INTELIGENTE.md.
//
// Principio: ti_tareas es una PROYECCIÓN. El generador es idempotente porque
// el índice único (contact_id, paso) sobre pendientes hace imposible duplicar
// un paso — correrlo dos veces no hace nada la segunda.
import { supabase } from '../../supabase';
import { permitido } from '../../whatsapp/permisos';
import {
  PASOS, pasoDef, pasoSiguiente, TEXTOS, TIPO_LLAMADA, RESULTADOS_LLAMADA_L,
  CONFIG_DEFAULT, type TiConfig, programar, arranqueT1, primerNombre,
} from './reglas';

const MS_D = 86400e3;

export async function leerConfig(): Promise<TiConfig> {
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  return { ...CONFIG_DEFAULT, ...(data?.valor || {}) };
}

/** ¿Quiénes de estos contactos están en cadencia humana viva? (el candado
 *  anti-doble-toque que consulta el cron de secuencias). */
export async function contactosEnCadenciaHumana(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data } = await supabase.from('ti_cadencias')
    .select('contact_id').in('contact_id', ids).in('estado', ['activa', 'pausada', 'conversacion']);
  return new Set((data || []).map(x => x.contact_id));
}

/* ══ ENROLAR ══ */
export async function enrolar(contactId: string, opts: { paso?: string } = {}) {
  const cfg = await leerConfig();
  const ahora = new Date();
  const { data: c } = await supabase.from('contacts')
    .select('id, nombre, owner_id, company_id, archived_at, lifecycle_stage')
    .eq('id', contactId).maybeSingle();
  if (!c) return { error: 'No existe ese contacto' };
  if (c.archived_at) return { error: 'El contacto está archivado' };

  const fila = {
    contact_id: contactId,
    paso: opts.paso || 'T1',
    estado: 'activa',
    siguiente_at: (opts.paso && opts.paso !== 'T1') ? ahora.toISOString() : arranqueT1(ahora, cfg).toISOString(),
    iniciada_at: ahora.toISOString(),
  };
  const { error } = await supabase.from('ti_cadencias')
    .upsert(fila, { onConflict: 'contact_id', ignoreDuplicates: true });
  if (error) return { error: error.message };

  // Candado anti-doble-toque EN LA FUENTE: sus secuencias automáticas de
  // seguimiento se detienen; al descalificar, F5 lo enrola a nutrición.
  await supabase.from('crm_secuencia_miembros')
    .update({ detenida_at: ahora.toISOString(), motivo: 'cadencia_humana' })
    .eq('contact_id', contactId).is('detenida_at', null);

  return { ok: true };
}

/* ══ ARMAR LA TAREA de un paso (payload = lo que pinta la tarjeta) ══ */
function armarTarea(cad: any, contacto: any, cfg: TiConfig) {
  const def = pasoDef(cad.paso)!;
  const n = primerNombre(contacto);
  const t = TEXTOS[cad.paso] || { instr: (x: string) => `Toque a ${x}` };
  const llamadaN = { T1: 1, T2: 2, T4: 3, T7: 4 }[cad.paso as string] || 0;
  return {
    contact_id: cad.contact_id,
    company_id: contacto.company_id || null,
    owner_id: contacto.owner_id || null,
    familia: 'contactar',
    tipo: def.tipo,
    paso: cad.paso,
    prioridad: cad.paso === 'T1' ? 2 : 4,
    vence_at: cad.siguiente_at,
    origen: 'cadencia',
    payload: {
      instruccion: t.instr(n),
      nombre: contacto.nombre || null,
      whatsapp: contacto.whatsapp || null,
      email: contacto.email || null,
      tipo_llamada: TIPO_LLAMADA[cad.paso] || null,
      llamada_n: llamadaN || null,
      resultados: def.tipo === 'llamada' ? RESULTADOS_LLAMADA_L : null,
      mensaje: t.mensaje ? t.mensaje(n) : null,
      asunto: t.asunto ? t.asunto(n) : null,
      dia_cadencia: Math.max(1, Math.round((Date.now() - Date.parse(cad.iniciada_at)) / MS_D) + 1),
    },
  };
}

/* ══ GENERAR EL PLAN (cron de la mañana + llamable a mano) ══ */
export async function generarPlan() {
  const cfg = await leerConfig();
  const ahora = new Date();
  const finHoy = new Date(ahora); finHoy.setUTCHours(23 + 6, 59, 59, 0); // fin del día CDMX
  const res: any = { deslizadas: 0, promesas_rotas: 0, tareas_nuevas: 0, reactivadas: 0, saltos_t8: 0, enrolados: 0 };

  // 0) EL SWITCH DEL ARRANQUE: con arranque_desde puesto, todo lead NUEVO que
  //    entró después de esa fecha se enrola solo (T1 speed-to-lead). Mientras
  //    sea null, nadie entra sin mano humana.
  if (cfg.arranque_desde) {
    const { data: nuevos } = await supabase.from('contacts')
      .select('id, ti_cadencias(contact_id)')
      .eq('lifecycle_stage', 'lead').eq('estatus_lead', 'nuevo')
      .is('archived_at', null).gte('created_at', cfg.arranque_desde)
      .limit(100);
    for (const c of nuevos || []) {
      if ((c as any).ti_cadencias?.length) continue; // ya adentro
      const r = await enrolar(c.id);
      if ((r as any).ok) res.enrolados++;
    }
  }

  // 1) TRANSFORMAR — nada muere en silencio.
  // 1a. Lo pendiente de días anteriores se DESLIZA a hoy, marcado atrasado
  //     (el compromiso NO: ese se transforma en promesa rota, abajo).
  const ayer = new Date(ahora.getTime() - 1).toISOString();
  const { data: viejas } = await supabase.from('ti_tareas')
    .select('id, tipo, contact_id, owner_id, vence_at, payload')
    .eq('estado', 'pendiente').lt('vence_at', new Date(ahora.getTime() - 12 * 3600e3).toISOString())
    .limit(500);
  for (const v of viejas || []) {
    if (v.tipo === 'compromiso') {
      // 1b. PROMESA ROTA: falta al log + tarea de reparación al frente.
      await supabase.from('ti_faltas').insert({
        owner_id: v.owner_id, tipo: 'promesa_rota', contact_id: v.contact_id, tarea_id: v.id,
        detalle: { prometida: v.vence_at, payload: v.payload },
      });
      const n = primerNombre({ nombre: (v.payload as any)?.nombre });
      await supabase.from('ti_tareas').insert({
        contact_id: v.contact_id, owner_id: v.owner_id, familia: 'reparar', tipo: 'wa_libre',
        prioridad: 1, vence_at: ahora.toISOString(), origen: 'reparacion', atrasada: false,
        payload: {
          instruccion: `Recupera la promesa con ${n}`,
          promesa_original: v.vence_at,
          mensaje: `${n}, una disculpa — te quedé mal con la llamada. ¿Te marco hoy a la misma hora?`,
          falta: 'Falta registrada en tu log: compromiso con hora incumplido.',
        },
      });
      await supabase.from('ti_tareas').update({ estado: 'retirada', retirada_causa: 'transformada_promesa_rota' }).eq('id', v.id);
      res.promesas_rotas++;
    } else {
      await supabase.from('ti_tareas').update({ atrasada: true, vence_at: ahora.toISOString() }).eq('id', v.id);
      res.deslizadas++;
    }
  }

  // 2) Pausas vencidas → la cadencia despierta sola.
  const { data: despiertan } = await supabase.from('ti_cadencias')
    .select('contact_id').eq('estado', 'pausada').lt('pausa_hasta', ahora.toISOString());
  for (const d of despiertan || []) {
    await supabase.from('ti_cadencias')
      .update({ estado: 'activa', pausa_causa: null, pausa_hasta: null, siguiente_at: ahora.toISOString(), updated_at: ahora.toISOString() })
      .eq('contact_id', d.contact_id);
    res.reactivadas++;
  }

  // 3) Cadencias que vencen HOY (o vencieron: se deslizan solas al caer hoy).
  const { data: cads } = await supabase.from('ti_cadencias')
    .select('*, contacts(id, nombre, whatsapp, email, owner_id, company_id, archived_at)')
    .eq('estado', 'activa').lte('siguiente_at', finHoy.toISOString()).limit(500);
  // Con el AGENTE EN VIVO (decisión del dueño 2026-09-02): los toques de texto
  // (T3, T5, T6, T8) y las llamadas a ciegas 3ª y 4ª (T4, T7) son del agente y
  // su reloj de silencio; el humano se queda con T1 y T2 (las llamadas con
  // mayor tasa de contacto), la llamada de rescate y la tarjeta de decisión.
  const agenteVivo = (cfg as any).agente_activo === true && (cfg as any).agente_modo === 'vivo';
  const PASOS_DEL_AGENTE = new Set(['T3', 'T4', 'T5', 'T6', 'T7', 'T8']);
  for (const cad of cads || []) {
    const c = (cad as any).contacts;
    if (!c || c.archived_at || cad.do_not_contact) {
      await supabase.from('ti_cadencias').update({ estado: 'terminada', terminada_motivo: c ? 'do_not_contact' : 'contacto_borrado', updated_at: ahora.toISOString() }).eq('contact_id', cad.contact_id);
      continue;
    }
    if (agenteVivo && PASOS_DEL_AGENTE.has(cad.paso) && c.whatsapp) {
      await supabase.from('ti_cadencias').update({ estado: 'terminada', terminada_motivo: 'agente', updated_at: ahora.toISOString() }).eq('contact_id', cad.contact_id);
      res.al_agente = (res.al_agente || 0) + 1;
      continue;
    }
    // >35 días desde el inicio: un lead frío de 5 semanas ya no se rescata a
    // cucharadas — salta directo al cierre.
    if (cad.paso !== 'T8' && (ahora.getTime() - Date.parse(cad.iniciada_at)) > cfg.cadencia_max_dias * MS_D) {
      cad.paso = 'T8';
      await supabase.from('ti_cadencias').update({ paso: 'T8', updated_at: ahora.toISOString() }).eq('contact_id', cad.contact_id);
      res.saltos_t8++;
    }
    const { error } = await supabase.from('ti_tareas').insert(armarTarea(cad, c, cfg));
    if (!error) res.tareas_nuevas++; // el índice único hace idempotente la corrida
  }

  // 4) RELOJES DE ESTANCAMIENTO + VÁLVULA (umbrales aprobados: 3·7·14, 2d, 3d, 30d)
  try { Object.assign(res, await relojes(cfg, ahora)); } catch (e: any) { res.relojes_error = String(e?.message || e); }

  // 5) DEUDAS DE DATO (F3): el registro de campos detecta lo que falta y lo
  //    vuelve tareas de lote — con tope por corrida, nunca en tsunami.
  try {
    const { detectarDeudas } = await import('./campos');
    Object.assign(res, await detectarDeudas());
  } catch (e: any) { res.deudas_error = String(e?.message || e); }

  return res;
}

/** ¿Ya existe (en cualquier estado) la tarea de este reloj para este sujeto?
 *  Los relojes disparan UNA vez por etapa — la memoria es la propia tabla. */
async function yaHayReloj(contactId: string, reloj: string, sujeto?: string) {
  let q = supabase.from('ti_tareas').select('id').eq('contact_id', contactId)
    .filter('payload->>reloj', 'eq', reloj).limit(1);
  if (sujeto) q = q.filter('payload->>sujeto', 'eq', sujeto);
  const { data } = await q;
  return !!(data || []).length;
}

const RES_COTIZACION = { la_firma: 'La firma', pidio_cambios: 'Pidió cambios', la_rechazo: 'La rechazó', no_contesto: 'No contestó', buzon: 'Buzón' };

async function relojes(cfg: TiConfig, ahora: Date) {
  const res: any = { reloj_cotizacion: 0, reloj_demo: 0, reloj_charla: 0, reloj_dia30: 0, valvula: 0 };
  const haceD = (d: number) => new Date(ahora.getTime() - d * MS_D).toISOString();
  const dinero = (n: any) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');

  // ── COTIZACIÓN SIN DECISIÓN (3 · 7 · 14) ──
  const { data: cots } = await supabase.from('quotes')
    .select('id, numero, total, vistas, created_at, contact_id, contacts!inner(id, nombre, whatsapp, owner_id, company_id, archived_at)')
    .eq('estado', 'sent').not('contact_id', 'is', null)
    .lt('created_at', haceD(3)).limit(100);
  for (const qv of cots || []) {
    const c = (qv as any).contacts;
    if (!c || c.archived_at) continue;
    const dias = Math.floor((ahora.getTime() - Date.parse(qv.created_at)) / MS_D);
    const nombre = primerNombre(c);
    const etapa = dias >= 14 ? ['cot_decision', 14] as const : dias >= 7 ? ['cot_llamada', 7] as const : ['cot_feedback', 3] as const;
    if (await yaHayReloj(qv.contact_id, etapa[0], String(qv.id))) continue;
    const base = {
      contact_id: qv.contact_id, company_id: c.company_id, owner_id: c.owner_id,
      vence_at: ahora.toISOString(), origen: 'reloj',
    };
    const hechos = [
      ['La cotización', `#${qv.numero || 's/n'}`, dinero(qv.total)],
      ['Sin decisión', `${dias} días`, `la abrió ${qv.vistas || 0} veces`, dias >= 14 ? 'rojo' : 'ambar'],
      ['Decisión forzada', 'día 14', 'extender con razón o rechazar'],
    ];
    if (etapa[0] === 'cot_decision') {
      await supabase.from('ti_tareas').insert({ ...base, familia: 'decidir', tipo: 'veredicto', prioridad: 4, payload: {
        instruccion: `La cotización de ${nombre} llegó al día 14 — decide`,
        porque: 'Una cotización fría a dos semanas ya casi nunca cierra sola: extender con una razón real, o cerrarla como rechazada y que el lead siga su camino.',
        nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'cot_decision', sujeto: String(qv.id), quote_id: String(qv.id), hechos,
        evidencia: [`Enviada hace ${dias} días (#${qv.numero || 's/n'}, ${dinero(qv.total)}).`, `${qv.vistas || 0} vistas y ninguna decisión.`],
        resultados: { extender: 'Extender 14 días (con razón)', rechazar: 'Marcar rechazada', seguir: 'Yo la sigo trabajando' },
      } });
    } else if (etapa[0] === 'cot_llamada') {
      await supabase.from('ti_tareas').insert({ ...base, familia: 'avanzar', tipo: 'llamada', prioridad: 4, payload: {
        instruccion: `Llámale a ${nombre} — su cotización lleva ${dias} días sin decisión`,
        porque: 'El feedback por texto no la movió: la llamada resuelve la duda que la tiene detenida. El ángulo es resolver, no presionar.',
        nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'cot_llamada', sujeto: String(qv.id), quote_id: String(qv.id), hechos,
        tipo_llamada: 'Seguimiento de cotización', resultados: RES_COTIZACION,
      } });
    } else {
      await supabase.from('ti_tareas').insert({ ...base, familia: 'avanzar', tipo: 'wa_libre', prioridad: 4, payload: {
        instruccion: `Pídele feedback a ${nombre} de su cotización`,
        porque: `Se la mandaste hace ${dias} días${qv.vistas ? ` y la ha abierto ${qv.vistas} veces` : ' y no hay señal de que la abriera'}. Un empujón suave destraba más que esperar.`,
        nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'cot_feedback', sujeto: String(qv.id), quote_id: String(qv.id), hechos,
        mensaje: `Hola ${nombre}, ¿pudiste ver la cotización que te mandé? Si algo no cuadra o quieres ajustar algo, dime y lo movemos — para eso estoy.`,
      } });
    }
    res.reloj_cotizacion++;
  }

  // ── DEMO HECHA SIN COTIZACIÓN (2 días) ──
  const { data: demos } = await supabase.from('contacts')
    .select('id, nombre, whatsapp, owner_id, company_id, estatus_lead_at')
    .eq('lifecycle_stage', 'lead').eq('estatus_lead', 'demo_hecha')
    .is('archived_at', null).lt('estatus_lead_at', haceD(2)).limit(50);
  for (const c of demos || []) {
    const { data: q1 } = await supabase.from('quotes').select('id').eq('contact_id', c.id)
      .in('estado', ['sent', 'accepted', 'paid']).limit(1);
    if ((q1 || []).length) continue;
    if (await yaHayReloj(c.id, 'demo_cotiza')) continue;
    const nombre = primerNombre(c);
    await supabase.from('ti_tareas').insert({
      contact_id: c.id, company_id: c.company_id, owner_id: c.owner_id,
      familia: 'avanzar', tipo: 'wa_libre', prioridad: 4, vence_at: ahora.toISOString(), origen: 'reloj',
      payload: {
        instruccion: `Cotízale a ${nombre} — la demo fue hace 2+ días`,
        porque: 'La demo salió y nadie cotizó: cada día que pasa la emoción se enfría. Mándale la cotización o di por qué no.',
        nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'demo_cotiza',
        hechos: [['La demo', 'hace 2+ días', 'sin cotización después', 'ambar'], ['Qué sigue', 'Cotizar', 'o registrar por qué no']],
        mensaje: `Hola ${nombre}, te mando la cotización de lo que vimos en la demo — dime si quieres que ajuste algo antes de dejarla formal.`,
      },
    });
    res.reloj_demo++;
  }

  // ── CONVERSACIÓN VIVA SIN CITA (3 días) ──
  const { data: charlas } = await supabase.from('ti_cadencias')
    .select('contact_id, updated_at, contacts!inner(id, nombre, whatsapp, owner_id, company_id, archived_at)')
    .eq('estado', 'conversacion').lt('updated_at', haceD(3)).limit(50);
  for (const cad of charlas || []) {
    const c = (cad as any).contacts;
    if (!c || c.archived_at || String(c.nombre || '').startsWith('Demo ')) continue;
    const { data: cita } = await supabase.from('bookings').select('id').eq('contact_id', cad.contact_id)
      .gte('fecha', ahora.toISOString().slice(0, 10)).limit(1);
    if ((cita || []).length) continue;
    // se puede volver a proponer, pero no cada día: una vez por semana
    const { data: prev } = await supabase.from('ti_tareas').select('id').eq('contact_id', cad.contact_id)
      .filter('payload->>reloj', 'eq', 'charla_cita').gt('created_at', haceD(7)).limit(1);
    if ((prev || []).length) continue;
    const nombre = primerNombre(c);
    await supabase.from('ti_tareas').insert({
      contact_id: cad.contact_id, company_id: c.company_id, owner_id: c.owner_id,
      familia: 'avanzar', tipo: 'wa_libre', prioridad: 4, vence_at: ahora.toISOString(), origen: 'reloj',
      payload: {
        instruccion: `Ciérralo a cita: la charla con ${nombre} no aterriza`,
        porque: 'Tres días intercambiando mensajes sin cita = la conversación se está enfriando. El agendador hace el resto.',
        nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'charla_cita',
        hechos: [['Conversación viva', '3+ días', 'sin cita agendada', 'ambar'], ['Qué sigue', 'Proponer horario', 'con el agendador listo']],
        mensaje: `${nombre}, mejor lo vemos en vivo 15 minutos y sales con todo claro — ¿te queda mañana en la mañana o en la tarde?`,
      },
    });
    res.reloj_charla++;
  }

  // ── DÍA 30: todo lead tiene ciclo de vida claro, sin excepción ──
  const { data: viejos } = await supabase.from('contacts')
    .select('id, nombre, whatsapp, owner_id, company_id, created_at, last_contact_at, estatus_lead, ti_backlog(contact_id)')
    .eq('lifecycle_stage', 'lead').is('archived_at', null)
    .in('estatus_lead', ['nuevo', 'contactado', 'sin_respuesta', 'respondio'])
    .lt('created_at', haceD(30)).limit(50);
  for (const c of viejos || []) {
    if ((c as any).ti_backlog?.length) continue;           // ya lo resolvió la auditoría del arranque
    if (String(c.nombre || '').startsWith('Demo ')) continue;
    if (await yaHayReloj(c.id, 'dia30')) continue;
    const dias = Math.floor((ahora.getTime() - Date.parse(c.created_at)) / MS_D);
    const respondio = c.estatus_lead === 'respondio' || c.estatus_lead === 'contactado';
    const nombre = primerNombre(c);
    await supabase.from('ti_tareas').insert({
      contact_id: c.id, company_id: c.company_id, owner_id: c.owner_id,
      familia: 'decidir', tipo: 'veredicto', prioridad: 4, vence_at: ahora.toISOString(), origen: 'reloj',
      payload: {
        instruccion: `${nombre} llegó al día 30 — decide su destino`,
        porque: 'La regla madre: a los 30 días todo lead tiene ciclo de vida claro.',
        nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'dia30',
        hechos: [
          ['En el sistema', `${dias} días`, `estatus: ${c.estatus_lead}`],
          ['Señal', respondio ? 'Alguna vez' : 'Ninguna', respondio ? 'llegó a responder' : 'ni una respuesta', respondio ? 'ambar' : 'rojo'],
          ['La IA propone', respondio ? 'Reciclar' : 'Descartar', respondio ? 'ángulo nuevo' : 'a nutrición', 'morado'],
        ],
        evidencia: [
          `${dias} días desde que entró; estatus «${c.estatus_lead}».`,
          c.last_contact_at ? `Último toque nuestro: ${String(c.last_contact_at).slice(0, 10)}.` : 'Nunca se le tocó.',
        ],
        resultados: respondio
          ? { reciclar: 'Reciclar con ángulo nuevo', descartar: 'Descartar → nutrición', seguir: 'Yo lo sigo trabajando' }
          : { descartar: 'Descartar → nutrición', reciclar: 'Reciclar con ángulo nuevo', seguir: 'Yo lo sigo trabajando' },
      },
    });
    res.reloj_dia30++;
  }

  // ── LA VÁLVULA (aprobada): plantilla de cadencia vencida 24 h+ sale SOLA —
  //    pero SOLO si su plantilla de Meta está configurada (cfg.plantillas_meta).
  //    Sin config, se desliza como cualquier tarea: nunca texto libre solo. ──
  const mapa = (cfg as any).plantillas_meta || {};
  if (Object.keys(mapa).length && await permitido('valvula_ti')) {
    const { data: vencidas } = await supabase.from('ti_tareas')
      .select('id, paso, contact_id, payload')
      .eq('estado', 'pendiente').eq('tipo', 'wa_plantilla')
      .lt('vence_at', new Date(ahora.getTime() - (cfg.valvula_plantilla_horas || 24) * 3600e3).toISOString())
      .limit(20);
    for (const v of vencidas || []) {
      const nombreMeta = mapa[v.paso || ''];
      const tel = (v.payload as any)?.whatsapp;
      if (!nombreMeta || !tel) continue;
      try {
        const { enviarPlantilla } = await import('../../whatsapp/kapso-api');
        await enviarPlantilla(tel, nombreMeta, 'es_MX', [String((v.payload as any)?.nombre || '').split(/\s+/)[0] || 'Hola']);
        await supabase.from('ti_tareas').update({
          estado: 'hecha', resultado: 'valvula_automatica', hecho_at: ahora.toISOString(), updated_at: ahora.toISOString(),
        }).eq('id', v.id);
        await alCompletar({ ...v, tipo: 'wa_plantilla' }, null, null);
        res.valvula++;
      } catch { /* si Kapso falla, la tarea se queda para el humano */ }
    }
  }

  return res;
}

/* ══ AL COMPLETAR una tarea: la transición de la cadencia ══ */
export async function alCompletar(tarea: any, resultado: string | null, userId: string | null) {
  const cfg = await leerConfig();
  const ahora = new Date();
  if (!tarea.paso) return { ok: true }; // no era de cadencia (reparación, manual…)

  const { data: cad } = await supabase.from('ti_cadencias').select('*').eq('contact_id', tarea.contact_id).maybeSingle();
  if (!cad || cad.estado === 'terminada') return { ok: true };

  const cambios: any = { ultimo_toque_at: ahora.toISOString(), updated_at: ahora.toISOString() };

  if (tarea.tipo === 'llamada') {
    cambios.intentos_llamada = (cad.intentos_llamada || 0) + 1;
    if (resultado === 'contesto') {
      // Contestó y hubo conversación: la cadencia fría TERMINA su trabajo aquí
      // — el lead pasa a conversación viva y el humano manda.
      cambios.estado = 'conversacion';
      cambios.pausa_causa = 'contestó';
      // La MEJOR HORA se aprende del hecho: contestó a esta hora.
      cambios.mejor_hora = ((ahora.getUTCHours() - 6) % 24 + 24) % 24;
      await supabase.from('contacts').update({ estatus_lead: 'contactado', last_contact_at: ahora.toISOString() }).eq('id', tarea.contact_id).eq('estatus_lead', 'nuevo');
      await supabase.from('ti_cadencias').update(cambios).eq('contact_id', tarea.contact_id);
      return { ok: true, transicion: 'conversacion' };
    }
    if (resultado === 'numero_malo') {
      // No se queman intentos contra un número muerto: se saltan las llamadas
      // que faltaban y se sigue por texto. (Y nace una deuda de dato — F3.)
      const sig = pasoSiguiente(cad.paso, true);
      if (!sig) return terminarCadencia(tarea.contact_id, 'descalificado');
      cambios.paso = sig.paso;
      cambios.canal_preferido = cad.canal_preferido || 'sin_telefono';
      cambios.siguiente_at = programar(ahora, sig.espera, cfg, sig.bloque, cad.mejor_hora).toISOString();
      await supabase.from('ti_cadencias').update(cambios).eq('contact_id', tarea.contact_id);
      return { ok: true, transicion: sig.paso };
    }
  }

  // Toque hecho (llamada fallida, plantilla enviada, correo enviado) → avanza.
  const saltarLlamadas = cad.canal_preferido === 'sin_telefono' || cad.canal_preferido === 'no_llamar';
  const sig = pasoSiguiente(cad.paso, saltarLlamadas);
  if (!sig) return terminarCadencia(tarea.contact_id, 'descalificado');
  cambios.paso = sig.paso;
  cambios.siguiente_at = programar(ahora, sig.espera, cfg, sig.bloque, cad.mejor_hora).toISOString();
  await supabase.from('ti_cadencias').update(cambios).eq('contact_id', tarea.contact_id);
  await supabase.from('contacts').update({ last_contact_at: ahora.toISOString() }).eq('id', tarea.contact_id);
  return { ok: true, transicion: sig.paso };
}

async function terminarCadencia(contactId: string, motivo: string) {
  await supabase.from('ti_cadencias')
    .update({ estado: 'terminada', terminada_motivo: motivo, updated_at: new Date().toISOString() })
    .eq('contact_id', contactId);
  // El handoff a la secuencia de nutrición es F5; por ahora el lead queda
  // marcado y fuera del plan humano.
  if (motivo === 'descalificado') {
    await supabase.from('contacts').update({ estatus_lead: 'sin_respuesta' }).eq('id', contactId).in('estatus_lead', ['nuevo', 'contactado']);
  }
  return { ok: true, transicion: 'terminada:' + motivo };
}

/* ══ OMITIR: el motivo ajusta ESE lead ya (nivel inmediato del aprendizaje) ══ */
export async function alOmitir(tarea: any, motivo: string) {
  const cfg = await leerConfig();
  const ahora = new Date();
  if (!tarea.paso) return { ok: true };
  const { data: cad } = await supabase.from('ti_cadencias').select('*').eq('contact_id', tarea.contact_id).maybeSingle();
  if (!cad || cad.estado !== 'activa') return { ok: true };

  if (motivo === 'ya_contactado') {
    // Cuenta como toque: la cadencia avanza, no repite lo que ya hiciste.
    return alCompletar(tarea, null, null);
  }
  if (motivo === 'mal_momento') {
    // Descanso de 3 días para este lead.
    await supabase.from('ti_cadencias').update({
      estado: 'pausada', pausa_causa: 'mal_momento',
      pausa_hasta: new Date(ahora.getTime() + 3 * MS_D).toISOString(), updated_at: ahora.toISOString(),
    }).eq('contact_id', tarea.contact_id);
  }
  // dato_malo / duplicado / no_aplica / otro: se registran (ti_omisiones) y el
  // nivel AGREGADO del aprendizaje decide si proponen un cambio de regla.
  return { ok: true };
}
