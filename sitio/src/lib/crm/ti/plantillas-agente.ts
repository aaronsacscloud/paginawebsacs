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
type Registro = { marketing?: EstadoPlantilla; utility?: EstadoPlantilla; rechazos?: number; apagado?: boolean; creadas_hoy?: { dia: string; n: number } };

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
  if (reg.apagado) return reg;
  const hoy = new Date().toISOString().slice(0, 10);
  const creadasHoy = reg.creadas_hoy?.dia === hoy ? reg.creadas_hoy.n : 0;
  let cambios = false;
  const { crearPlantillaMeta, listarPlantillasMeta } = await import('../../whatsapp/kapso-api');
  // 1) Crear lo que falte (máx. 3 al día).
  let n = creadasHoy;
  for (const k of ['marketing', 'utility'] as const) {
    if (reg[k] || n >= 3) continue;
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
  if (n !== creadasHoy) { reg.creadas_hoy = { dia: hoy, n }; cambios = true; }
  if ((reg.rechazos || 0) >= 3) { reg.apagado = true; cambios = true; }
  // 2) Refrescar estados (APPROVED / REJECTED / PAUSED…) cada 10 min como máximo.
  const ultima = Math.max(Date.parse(reg.marketing?.revisada_at || '') || 0, Date.parse(reg.utility?.revisada_at || '') || 0);
  if (Date.now() - ultima > 10 * 60e3 && (reg.marketing || reg.utility)) {
    try {
      const lista: any[] = await listarPlantillasMeta();
      for (const k of ['marketing', 'utility'] as const) {
        const r = reg[k]; if (!r) continue;
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

/** El ángulo como parámetro de plantilla: una sola línea, sin saltos ni tabs, corto. */
export const paramAngulo = (texto: string) => String(texto || '').replace(/\s+/g, ' ').trim().replace(/^[¡!]+/, '').slice(0, 280);
