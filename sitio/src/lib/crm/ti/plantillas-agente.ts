// TRABAJO INTELIGENTE · LAS PLANTILLAS DEL AGENTE (fuera de la ventana de 24 h).
//
// Decisión del dueño (2026-09-02, casos C26/C27): cuando la ventana de 24 h
// cerró, el agente manda PRIMERO la plantilla de MARKETING (más diseño), y si
// a los 10 minutos Meta no la entregó (131049, 130472, plantilla pausada…),
// sale la UTILITY equivalente. Y el agente CREA sus plantillas solo: aquí
// nace el par base de seguimiento; los ángulos viajan en la variable {{2}}.
// Candados: máx. 3 plantillas nuevas por día, nombres con prefijo ti_, sin
// precios ni promociones en el cuerpo, y se apaga sola con 3 rechazos.
import { supabase } from '../../supabase';

export type EstadoPlantilla = { nombre: string; categoria: 'MARKETING' | 'UTILITY'; estado: string; creada_at: string; revisada_at?: string; motivo?: string | null };
type Registro = { marketing?: EstadoPlantilla; utility?: EstadoPlantilla; rechazos?: number; apagado?: boolean; creadas_hoy?: { dia: string; n: number }; familias?: Record<string, { marketing?: EstadoPlantilla; utility?: EstadoPlantilla }> };

/* FAMILIAS POR MOMENTO (F7, decisión S4.1): el agente crea solo estas plantillas (Meta aprueba). Cada familia
   trae su par marketing → utility; el ángulo del momento viaja en {{2}}. Si una familia aún no está aprobada,
   se usa la de seguimiento. */
export type Familia = 'seguimiento' | 'no_show' | 'preparacion' | 'promo' | 'cierre';
export const FAMILIAS: Record<Familia, { marketing: { nombre: string; cuerpo: string; ejemplos: string[]; botones: any[] }; utility: { nombre: string; cuerpo: string; ejemplos: string[]; botones: any[] } }> = {
  seguimiento: {
    marketing: { nombre: 'ti_seguimiento_marketing_v1', cuerpo: 'Hola {{1}}, {{2}} ¿Te late que lo veamos en 15 minutos con un consultor, con tus propios productos?', ejemplos: ['Ana', 'te quedé a deber cómo se ve la existencia por talla en cada una de tus tiendas.'], botones: [{ tipo: 'QUICK_REPLY', texto: 'Sí, cuéntame' }, { tipo: 'QUICK_REPLY', texto: 'Ahora no' }] },
    utility: { nombre: 'ti_seguimiento_utility_v1', cuerpo: 'Hola {{1}}, te escribo de Sacs para dar seguimiento a la solicitud que hiciste. {{2}} Si prefieres que lo dejemos aquí, dime y no te escribo más.', ejemplos: ['Ana', 'Quedé de mandarte cómo se ve la existencia por talla en cada tienda.'], botones: [] },
  },
  no_show: {
    marketing: { nombre: 'ti_noshow_marketing_v1', cuerpo: 'Hola {{1}}, se nos cruzó la reunión y no pasa nada. {{2}} ¿La movemos a esta semana? Dime qué día te acomoda.', ejemplos: ['Ana', 'Tengo dos espacios: jueves a las 11 o viernes a las 4.'], botones: [{ tipo: 'QUICK_REPLY', texto: 'Sí, movámosla' }, { tipo: 'QUICK_REPLY', texto: 'Ya no' }] },
    utility: { nombre: 'ti_noshow_utility_v1', cuerpo: 'Hola {{1}}, no coincidimos en la reunión que tenías agendada con Sacs. {{2}} Si quieres reagendarla, respóndeme por aquí.', ejemplos: ['Ana', 'Quedan espacios esta semana en la mañana.'], botones: [] },
  },
  preparacion: {
    marketing: { nombre: 'ti_preparacion_marketing_v1', cuerpo: 'Hola {{1}}, mañana es tu demo con Sacs. {{2}} Así la vemos con lo tuyo y no con ejemplos genéricos.', ejemplos: ['Ana', 'Si tienes tu Excel de inventario o tres productos con tallas y colores, mándamelos por aquí.'], botones: [{ tipo: 'QUICK_REPLY', texto: 'Te lo mando' }, { tipo: 'QUICK_REPLY', texto: 'No tengo' }] },
    utility: { nombre: 'ti_preparacion_utility_v1', cuerpo: 'Hola {{1}}, te recordamos tu demo de Sacs de mañana. {{2}} Responde por aquí si necesitas moverla.', ejemplos: ['Ana', 'Si puedes, comparte tu Excel de inventario para prepararla con tus productos.'], botones: [] },
  },
  promo: {
    marketing: { nombre: 'ti_promo_marketing_v1', cuerpo: 'Hola {{1}}, {{2}} Es por tiempo limitado y quería que lo supieras antes de que cierre. ¿Lo vemos en una llamada de 15 minutos?', ejemplos: ['Ana', 'esta semana la implementación y migración de tu Excel va sin costo con el plan anual.'], botones: [{ tipo: 'QUICK_REPLY', texto: 'Cuéntame' }, { tipo: 'QUICK_REPLY', texto: 'No, gracias' }] },
    utility: { nombre: 'ti_promo_utility_v1', cuerpo: 'Hola {{1}}, seguimiento a tu solicitud con Sacs. {{2}} Responde por aquí si quieres los detalles.', ejemplos: ['Ana', 'Hay condiciones especiales vigentes esta semana para tu plan.'], botones: [] },
  },
  cierre: {
    marketing: { nombre: 'ti_cierre_marketing_v1', cuerpo: 'Hola {{1}}, {{2}} Si este no es el momento, dímelo y lo dejamos aquí sin problema; si sí, te propongo 15 minutos esta semana.', ejemplos: ['Ana', 'te escribí un par de veces sobre el control de tallas en tus tiendas y no quiero insistir de más.'], botones: [{ tipo: 'QUICK_REPLY', texto: 'Sí, esta semana' }, { tipo: 'QUICK_REPLY', texto: 'Lo dejamos' }] },
    utility: { nombre: 'ti_cierre_utility_v1', cuerpo: 'Hola {{1}}, último seguimiento de Sacs a tu solicitud. {{2}} Si no respondes, no te volveremos a escribir.', ejemplos: ['Ana', 'Quedo atenta por si quieres retomar el tema de tus tiendas.'], botones: [] },
  },
};

const PAR_BASE = {
  marketing: {
    nombre: 'ti_seguimiento_marketing_v1', categoria: 'MARKETING' as const,
    cuerpo: 'Hola {{1}}, {{2}} ¿Te late que lo veamos en 15 minutos con un consultor, con tus propios productos?',
    ejemplos: ['Ana', 'te quedé a deber cómo se ve la existencia por talla en cada una de tus tiendas.'],
    botones: [{ tipo: 'QUICK_REPLY', texto: 'Sí, cuéntame' }, { tipo: 'QUICK_REPLY', texto: 'Ahora no' }],
  },
  utility: {
    nombre: 'ti_seguimiento_utility_v1', categoria: 'UTILITY' as const,
    cuerpo: 'Hola {{1}}, te escribo de Sacs para dar seguimiento a la solicitud que hiciste. {{2}} Si prefieres que lo dejemos aquí, dime y no te escribo más.',
    ejemplos: ['Ana', 'Quedé de mandarte cómo se ve la existencia por talla en cada tienda.'],
    botones: [] as any[],
  },
};

async function leer(): Promise<Registro> {
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  return ((data?.valor as any)?.plantillas_agente) || {};
}
async function guardar(reg: Registro) {
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  await supabase.from('ti_config').update({ valor: { ...((data?.valor as any) || {}), plantillas_agente: reg } }).eq('id', 1);
}

/** Crea el par base si no existe y refresca su estado en Meta. Idempotente; corre con el observador. */
export async function asegurarPlantillas(): Promise<Registro> {
  const reg = await leer();
  const hoy = new Date().toISOString().slice(0, 10);
  const apagadoCreacion = !!reg.apagado;   // con 3 rechazos se deja de CREAR, pero los estados se siguen refrescando
  const creadasHoy = reg.creadas_hoy?.dia === hoy ? reg.creadas_hoy.n : 0;
  let cambios = false;
  const { crearPlantillaMeta, listarPlantillasMeta } = await import('../../whatsapp/kapso-api');
  // 1) Crear lo que falte (máx. 3 al día).
  let n = creadasHoy;
  for (const k of ['marketing', 'utility'] as const) {
    if (apagadoCreacion || reg[k] || n >= 3) continue;
    const def = PAR_BASE[k];
    try {
      await crearPlantillaMeta({ nombre: def.nombre, idioma: 'es_MX', categoria: def.categoria, cuerpo: def.cuerpo, ejemplos: def.ejemplos, botones: def.botones as any });
      reg[k] = { nombre: def.nombre, categoria: def.categoria, estado: 'PENDING', creada_at: new Date().toISOString() };
      n++; cambios = true;
      await supabase.from('ia_log').insert({ accion: 'plantilla_creada', razon: `${def.categoria} ${def.nombre}`, contenido: def.cuerpo });
    } catch (e: any) {
      const msg = String(e?.message || e);
      // Si ya existe con ese nombre, la adoptamos; si Meta la rechaza, cuenta como rechazo.
      if (/already exists|ya existe|2388023/i.test(msg)) { reg[k] = { nombre: def.nombre, categoria: def.categoria, estado: 'PENDING', creada_at: new Date().toISOString() }; cambios = true; }
      else {
        // Un error de configuración (falta la llave/WABA en este entorno) NO es un rechazo de Meta: se registra y se reintenta después.
        if (!/Falta KAPSO|HTTP 0/i.test(msg)) reg.rechazos = (reg.rechazos || 0) + 1;
        await supabase.from('ia_log').insert({ accion: 'plantilla_error', razon: msg.slice(0, 300), contenido: def.nombre }); cambios = true;
      }
    }
  }
  // 1b) Las demás FAMILIAS por momento (no_show, preparacion, promo, cierre), con el mismo tope diario.
  reg.familias = reg.familias || {};
  for (const fam of ['no_show', 'preparacion', 'promo', 'cierre'] as Familia[]) {
    reg.familias[fam] = reg.familias[fam] || {};
    for (const k of ['marketing', 'utility'] as const) {
      if (apagadoCreacion || reg.familias[fam][k] || n >= 3) continue;
      const def = FAMILIAS[fam][k];
      try {
        await crearPlantillaMeta({ nombre: def.nombre, idioma: 'es_MX', categoria: k === 'marketing' ? 'MARKETING' : 'UTILITY', cuerpo: def.cuerpo, ejemplos: def.ejemplos, botones: def.botones as any });
        reg.familias[fam][k] = { nombre: def.nombre, categoria: k === 'marketing' ? 'MARKETING' : 'UTILITY', estado: 'PENDING', creada_at: new Date().toISOString() };
        n++; cambios = true;
        await supabase.from('ia_log').insert({ accion: 'plantilla_creada', razon: `${fam} ${def.nombre}`, contenido: def.cuerpo });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (/already exists|ya existe|2388023/i.test(msg)) { reg.familias[fam][k] = { nombre: def.nombre, categoria: k === 'marketing' ? 'MARKETING' : 'UTILITY', estado: 'PENDING', creada_at: new Date().toISOString() }; cambios = true; }
        else { if (!/Falta KAPSO|HTTP 0/i.test(msg)) reg.rechazos = (reg.rechazos || 0) + 1; await supabase.from('ia_log').insert({ accion: 'plantilla_error', razon: msg.slice(0, 300), contenido: def.nombre }); cambios = true; }
      }
    }
  }
  if (n !== creadasHoy) { reg.creadas_hoy = { dia: hoy, n }; cambios = true; }
  if ((reg.rechazos || 0) >= 3) { reg.apagado = true; cambios = true; }
  // 2) Refrescar estados (APPROVED / REJECTED / PAUSED…) cada 10 min como máximo.
  const ultima = Math.max(Date.parse(reg.marketing?.revisada_at || '') || 0, Date.parse(reg.utility?.revisada_at || '') || 0);
  if (Date.now() - ultima > 10 * 60e3 && (reg.marketing || reg.utility)) {
    try {
      const lista: any[] = await listarPlantillasMeta();
      const todas: EstadoPlantilla[] = [reg.marketing, reg.utility, ...Object.values(reg.familias || {}).flatMap(f => [f.marketing, f.utility])].filter(Boolean) as EstadoPlantilla[];
      for (const r of todas) {
        if (!r) continue;
        const m = lista.find((x: any) => x.name === r.nombre && (x.language === 'es_MX' || !x.language));
        if (m) {
          if (m.status !== r.estado) { await supabase.from('ia_log').insert({ accion: 'plantilla_estado', razon: `${r.nombre}: ${r.estado} → ${m.status}`, contenido: m.rejected_reason || null }); if (m.status === 'REJECTED') reg.rechazos = (reg.rechazos || 0) + 1; }
          r.estado = m.status; r.motivo = m.rejected_reason || null;
        }
        r.revisada_at = new Date().toISOString();
      }
      cambios = true;
    } catch { /* Meta no contestó: se reintenta en el siguiente tick */ }
  }
  if (cambios) await guardar(reg);
  return reg;
}

/** El par listo para usar (nombres aprobados), o null si todavía no hay ninguno. */
export async function parListo(): Promise<{ marketing: string | null; utility: string | null } | null> {
  const reg = await leer();
  const ok = (p?: EstadoPlantilla) => p && p.estado === 'APPROVED' ? p.nombre : null;
  const marketing = ok(reg.marketing), utility = ok(reg.utility);
  return marketing || utility ? { marketing, utility } : null;
}

/** El par aprobado de una FAMILIA (momento); si no está aprobada, cae al par de seguimiento. */
export async function parListoPara(familia: Familia): Promise<{ marketing: string | null; utility: string | null; familia: Familia } | null> {
  const reg = await leer();
  const ok = (p?: EstadoPlantilla) => p && p.estado === 'APPROVED' ? p.nombre : null;
  const f = reg.familias?.[familia];
  if (f && (ok(f.marketing) || ok(f.utility))) return { marketing: ok(f.marketing), utility: ok(f.utility), familia };
  const base = await parListo();
  return base ? { ...base, familia: 'seguimiento' } : null;
}

/** Tablero: por plantilla, enviadas / entregadas / leídas / con respuesta en 48 h (últimos 30 días). */
export async function tableroPlantillas() {
  const desde = new Date(Date.now() - 30 * 86400e3).toISOString();
  const { data: envs } = await supabase.from('ti_envios').select('id, contact_id, kapso_message_id, enviado_at, plantilla, salida').eq('estado', 'enviado').not('plantilla', 'is', null).gte('enviado_at', desde).limit(500);
  const filas: Record<string, { enviadas: number; entregadas: number; leidas: number; respondidas: number }> = {};
  // Tres consultas en lote (antes eran dos por envío: ~1,000 por carga de la pestaña).
  const wamids = (envs || []).map(e => e.kapso_message_id).filter(Boolean) as string[];
  const cids = [...new Set((envs || []).map(e => e.contact_id).filter(Boolean))] as string[];
  const { data: ms } = wamids.length ? await supabase.from('wa_mensajes').select('kapso_message_id, status').in('kapso_message_id', wamids) : { data: [] as any[] };
  const status: Record<string, string> = {}; for (const m of ms || []) status[m.kapso_message_id] = m.status;
  const { data: evs } = cids.length ? await supabase.from('ti_eventos').select('contact_id, ocurrio_at').eq('tipo', 'wa_entrante').in('contact_id', cids).gte('ocurrio_at', desde) : { data: [] as any[] };
  const entradas: Record<string, number[]> = {}; for (const ev of evs || []) (entradas[ev.contact_id] ||= []).push(Date.parse(ev.ocurrio_at));
  for (const e of envs || []) {
    const nombre = String((e.salida as any)?.plantilla_usada || (e.plantilla as any)?.marketing || (e.plantilla as any)?.utility || '—');
    filas[nombre] = filas[nombre] || { enviadas: 0, entregadas: 0, leidas: 0, respondidas: 0 };
    filas[nombre].enviadas++;
    const st = e.kapso_message_id ? status[e.kapso_message_id] : undefined;
    if (st === 'delivered' || st === 'read') filas[nombre].entregadas++;
    if (st === 'read') filas[nombre].leidas++;
    if (e.contact_id && e.enviado_at) {
      const t0 = Date.parse(e.enviado_at), t1 = t0 + 48 * 3600e3;
      if ((entradas[e.contact_id] || []).some(t => t > t0 && t < t1)) filas[nombre].respondidas++;
    }
  }
  return Object.entries(filas).map(([nombre, v]) => ({ nombre, ...v, tasa_respuesta: v.entregadas ? Math.round((v.respondidas / v.entregadas) * 100) : 0 })).sort((a, b) => b.enviadas - a.enviadas);
}

/** El ángulo como parámetro de plantilla: una sola línea, sin saltos ni tabs, corto. */
export const paramAngulo = (texto: string) => String(texto || '').replace(/\s+/g, ' ').trim().replace(/^[¡!]+/, '').slice(0, 280);
