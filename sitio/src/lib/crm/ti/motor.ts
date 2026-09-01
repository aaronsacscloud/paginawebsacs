// TRABAJO INTELIGENTE · El motor — enrolar, generar el plan, transformar lo
// vencido y avanzar la cadencia. Spec: sitio/PLAN-TRABAJO-INTELIGENTE.md.
//
// Principio: ti_tareas es una PROYECCIÓN. El generador es idempotente porque
// el índice único (contact_id, paso) sobre pendientes hace imposible duplicar
// un paso — correrlo dos veces no hace nada la segunda.
import { supabase } from '../../supabase';
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
  const res: any = { deslizadas: 0, promesas_rotas: 0, tareas_nuevas: 0, reactivadas: 0, saltos_t8: 0 };

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
  for (const cad of cads || []) {
    const c = (cad as any).contacts;
    if (!c || c.archived_at || cad.do_not_contact) {
      await supabase.from('ti_cadencias').update({ estado: 'terminada', terminada_motivo: c ? 'do_not_contact' : 'contacto_borrado', updated_at: ahora.toISOString() }).eq('contact_id', cad.contact_id);
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
