// TRABAJO INTELIGENTE · REVISIÓN DIARIA (F6, decisión S9). Cada mañana (8:00 CDMX) se lee CADA conversación
// con actividad de ayer y se responde una sola pregunta: «¿qué haría que este prospecto pregunte más, se
// explaye más y llegue a la demo?». De ahí sale una propuesta concreta con fundamento (mensaje extra antes de
// que cierre la ventana, plantilla, llamada, adjunto, cambiar ángulo, descalificar o nada). El dueño acepta o
// rechaza; con RAMPA (20 aceptadas seguidas) las de bajo riesgo salen solas con ventana de veto; descalificar y
// llamada siempre con clic. El resumen del día le llega por WhatsApp.
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey, calculateCost } from '../../ai/client';
import { leerConfig } from './motor';
import { notificar } from '../notificaciones';
import { GUION_AGENTE } from './agente-guion';

export type TipoPropuesta = 'mensaje_extra' | 'plantilla' | 'llamada' | 'adjunto' | 'cambiar_angulo' | 'descalificar' | 'ninguna';
const BAJO_RIESGO: TipoPropuesta[] = ['mensaje_extra', 'cambiar_angulo', 'adjunto'];
const hoyCdmx = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);

async function analizar(ctx: { nombre: string; giro: string | null; etapa: string; indice: number | null; estadoIndice: string | null; mensajes: any[]; agenteEstado: any; cita: boolean }): Promise<{ salida: any; costo: number }> {
  const conv = ctx.mensajes.map(m => `${m.direccion === 'entrante' ? 'LEAD' : 'NOSOTROS'} (${String(m.created_at).slice(5, 16).replace('T', ' ')}): ${String(m.transcript || m.cuerpo || `[${m.tipo}]`).slice(0, 400)}`).join('\n');
  const st = ctx.agenteEstado || {};
  const prompt = `Eres el revisor diario del agente SDR de Sacs (software para tiendas de moda en México). Lees UNA conversación con actividad de ayer y propones UNA acción concreta que haga que el prospecto pregunte más, se explaye más y llegue a la demo (o, si ya no hay caso, que se le deje de insistir).
LEAD: «${ctx.nombre}», giro ${ctx.giro || 'desconocido'}, etapa ${ctx.etapa}, índice de vida ${ctx.indice ?? '—'} (${ctx.estadoIndice || '—'}), ${ctx.cita ? 'CON cita vigente' : 'sin cita'}. Intentos del ciclo: ${(st.intentos || []).length}, ángulos usados: ${(st.angulos || []).join(' · ') || 'ninguno'}.
CONVERSACIÓN (lo más reciente al final):
${conv}

REGLAS: si tiene cita vigente, la única propuesta válida es «ninguna» o «adjunto» (material previo). Si el lead dejó una pregunta sin responder por nosotros, la propuesta es «mensaje_extra» con el texto listo. Si la ventana de 24 h está por cerrarse y falta un dato clave (giro, tiendas, horario), «mensaje_extra» corto que lo pida. Si ya hubo tres intentos sin respuesta, considera «llamada» (con ICP medio/alto) o «descalificar» (ICP bajo). «cambiar_angulo» cuando se repite lo mismo. «plantilla» solo si la ventana ya cerró. Sé concreto y breve; el texto propuesto debe ir listo para mandarse por WhatsApp, con el tono del guion.
Devuelve SOLO JSON: {"avance":"avanzo|igual|retrocedio","etapa_antes":"…","etapa_despues":"…","resumen":"2 líneas de qué pasó ayer","que_funciono":"1 línea (o vacío)","preguntas_abiertas":["…"],"propuesta":{"tipo":"mensaje_extra|plantilla|llamada|adjunto|cambiar_angulo|descalificar|ninguna","texto":"el mensaje listo (si aplica)","fundamento":"por qué esta acción y no otra, en 1-2 líneas","riesgo":"bajo|medio|alto"}}`;
  const r = await anthropic.messages.create({ model: MODELS.sonnet, max_tokens: 900, system: [{ type: 'text', text: `Guion del agente (para el tono y las reglas):\n${GUION_AGENTE.slice(0, 6000)}`, cache_control: { type: 'ephemeral' } }] as any, messages: [{ role: 'user', content: prompt }] });
  const t = (r.content.find(b => b.type === 'text') as any)?.text || '{}';
  const costo = calculateCost(MODELS.sonnet, r.usage as any).cost_usd;
  let salida: any = null; try { salida = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { salida = null; }
  return { salida, costo: Number(costo) || 0 };
}

export async function revisionDiaria(opts: { horas?: number; limite?: number; soloVentanas?: boolean } = {}): Promise<any> {
  if (!hasApiKey()) return { error: 'sin_api_key' };
  const cfg: any = await leerConfig();
  const dia = hoyCdmx();
  const desde = new Date(Date.now() - (opts.horas || 26) * 3600e3).toISOString();
  const res: any = { dia, revisadas: 0, propuestas: 0, automaticas: 0, costo: 0, por_tipo: {} as Record<string, number> };
  const { data: convs } = await supabase.from('wa_conversaciones').select('id, contact_id, telefono, contacts!inner(id, nombre, giro, lifecycle_stage, propiedades, archived_at)').gt('ultimo_mensaje_at', desde).not('contact_id', 'is', null).order('ultimo_mensaje_at', { ascending: false }).limit(opts.limite || 60);
  const rampa: any = cfg.rampa_revision || { aceptadas: 0, automatico: false };
  for (const cv of convs || []) {
    const c: any = (cv as any).contacts; if (!c || c.archived_at || c.propiedades?.demo_ti || !['lead', 'lead_calificado', 'oportunidad'].includes(c.lifecycle_stage)) continue;
    const { data: ya } = await supabase.from('ti_revision').select('id').eq('dia', dia).eq('contact_id', cv.contact_id).limit(1);
    if ((ya || []).length) continue;
    const [{ data: ms }, { data: pf }, { data: cita }] = await Promise.all([
      supabase.from('wa_mensajes').select('direccion, cuerpo, transcript, tipo, created_at').eq('conversation_id', cv.id).is('borrado_at', null).order('created_at', { ascending: false }).limit(14),
      supabase.from('ti_perfil').select('agente_estado, indice_vida, indice_estado, silenciar_ia').eq('contact_id', cv.contact_id).maybeSingle(),
      supabase.from('bookings').select('id').eq('contact_id', cv.contact_id).gte('fecha', dia).in('estado', ['agendada', 'confirmada']).limit(1),
    ]);
    if (pf?.silenciar_ia) continue;
    const { fueraDelAlcanceSDR } = await import('./agente');
    if (await fueraDelAlcanceSDR(cv.contact_id)) continue;   // ya tuvo reunión o tiene cotización: es del consultor
    const mensajes = (ms || []).reverse();
    if (!mensajes.some(m => m.direccion === 'entrante' && m.created_at >= desde)) continue;   // sin mensaje del lead ayer no hay qué revisar
    if (opts.soloVentanas) {
      // Pasada de las 14:00: solo conversaciones cuya ventana de 24 h cierra hoy (último mensaje del lead hace 16–22 h) y en las que la última palabra fue nuestra.
      const ultIn = [...mensajes].reverse().find(m => m.direccion === 'entrante'); const ultimoMsg = mensajes[mensajes.length - 1];
      const hIn = ultIn ? (Date.now() - Date.parse(ultIn.created_at)) / 3600e3 : 99;
      if (!(hIn >= 16 && hIn <= 22) || ultimoMsg?.direccion === 'entrante') continue;
    }
    try {
      const { salida, costo } = await analizar({ nombre: c.nombre || 'Lead', giro: c.giro, etapa: c.lifecycle_stage, indice: pf?.indice_vida ?? null, estadoIndice: pf?.indice_estado ?? null, mensajes, agenteEstado: pf?.agente_estado, cita: !!(cita || []).length });
      res.costo += costo; res.revisadas++;
      if (!salida) continue;
      const prop = salida.propuesta || { tipo: 'ninguna' };
      const tipo: TipoPropuesta = (['mensaje_extra', 'plantilla', 'llamada', 'adjunto', 'cambiar_angulo', 'descalificar', 'ninguna'] as TipoPropuesta[]).includes(prop.tipo) ? prop.tipo : 'ninguna';
      let estado = 'propuesta';
      const auto = rampa.automatico && BAJO_RIESGO.includes(tipo) && tipo !== 'ninguna';
      const { data: fila } = await supabase.from('ti_revision').insert({ dia, contact_id: cv.contact_id, conversation_id: cv.id, avance: salida.avance || null, etapa_antes: salida.etapa_antes || null, etapa_despues: salida.etapa_despues || null, resumen: String(salida.resumen || '').slice(0, 600), que_funciono: String(salida.que_funciono || '').slice(0, 300) || null, preguntas_abiertas: Array.isArray(salida.preguntas_abiertas) ? salida.preguntas_abiertas.slice(0, 6) : [], propuesta: { ...prop, tipo }, estado: tipo === 'ninguna' ? 'ejecutada' : estado, costo_usd: costo }).select('id').single();
      if (tipo !== 'ninguna') { res.propuestas++; res.por_tipo[tipo] = (res.por_tipo[tipo] || 0) + 1; }
      if (auto && fila) { const r2 = await ejecutarPropuesta(fila.id, null, 'aceptar', 'automática (rampa)'); if (r2.ok) { res.automaticas++; await supabase.from('ti_revision').update({ estado: 'automatica' }).eq('id', fila.id); } }
    } catch (e: any) { await supabase.from('ia_log').insert({ accion: 'revision_error', contact_id: cv.contact_id, razon: String(e?.message || e).slice(0, 200) }); }
  }
  await supabase.from('ia_log').insert({ accion: 'revision_diaria', razon: `${res.revisadas} conversaciones · ${res.propuestas} propuestas · ${res.automaticas} automáticas`, costo_usd: res.costo, detalle: res });
  // Resumen al dueño: notificación + WhatsApp (si su ventana está abierta; si no, queda la notificación).
  const { count: avanzaron } = await supabase.from('ti_revision').select('id', { count: 'exact', head: true }).eq('dia', dia).eq('avance', 'avanzo');
  const titulo = `${opts.soloVentanas ? 'Revisión de ventanas por cerrar' : 'Revisión diaria'}: ${res.revisadas} conversaciones, ${avanzaron || 0} avanzaron, ${res.propuestas} propuestas${res.automaticas ? ` (${res.automaticas} ya salieron solas)` : ''}`;
  await notificar({ clave: `ti_revision:${dia}${opts.soloVentanas ? ':ventanas' : ''}`, tipo: 'ti_revision', nivel: res.propuestas ? 'alerta' : 'info', titulo, detalle: Object.entries(res.por_tipo).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Nada que proponer hoy.', destino: 'trabajo?vista=revision', metadata: { dia } });
  try {
    const tel = String(cfg.dueno_whatsapp || (cfg.agente_prueba_telefonos || [])[0] || '525610353669').replace(/\D/g, '');
    if (tel && res.revisadas && (res.propuestas || !opts.soloVentanas)) {
      const { enviarTexto } = await import('../../whatsapp/kapso-api');
      await enviarTexto(tel, `${titulo}.\n${Object.entries(res.por_tipo).map(([k, v]) => `• ${k}: ${v}`).join('\n') || 'Nada que proponer hoy.'}\nRevísalas en Trabajo inteligente → Revisión diaria: https://www.sacscloud.com/admin/crm?tab=trabajo`);
    }
  } catch { /* fuera de ventana: queda la notificación */ }
  return res;
}

/** Aceptar (ejecuta según el tipo) o rechazar (aprende) una propuesta. La rampa cuenta aceptadas seguidas sin cambios. */
export async function ejecutarPropuesta(id: string, userId: string | null, decision: 'aceptar' | 'rechazar', motivo?: string, textoEditado?: string): Promise<{ ok: boolean; error?: string; hecho?: string }> {
  const { data: r } = await supabase.from('ti_revision').select('*').eq('id', id).maybeSingle();
  if (!r) return { ok: false, error: 'No existe esa propuesta' };
  if (!['propuesta'].includes(r.estado) && userId) return { ok: false, error: `La propuesta ya está ${r.estado}` };
  const ahora = new Date().toISOString();
  const cfg: any = await leerConfig();
  const rampa: any = cfg.rampa_revision || { aceptadas: 0, automatico: false };
  if (decision === 'rechazar') {
    await supabase.from('ti_revision').update({ estado: 'rechazada', motivo: String(motivo || '').slice(0, 300) || null, decidido_por: userId, decidido_at: ahora }).eq('id', id);
    await supabase.from('ia_log').insert({ accion: 'revision_rechazada', contact_id: r.contact_id, razon: motivo || null, detalle: { propuesta: r.propuesta, por: userId } });
    if (userId) await supabase.from('ti_config').update({ valor: { ...cfg, rampa_revision: { ...rampa, aceptadas: 0 } } }).eq('id', 1);
    return { ok: true, hecho: 'Rechazada. Queda como lección.' };
  }
  const p: any = r.propuesta || {}; const tipo: TipoPropuesta = p.tipo;
  // FRESCURA: si desde que se propuso hubo mensajes (del lead o nuestros), la propuesta ya no describe la realidad.
  if (userId && !p.forzar) {
    const { data: nuevos } = await supabase.from('ti_eventos').select('id').eq('contact_id', r.contact_id).in('tipo', ['wa_entrante', 'wa_saliente']).gt('ocurrio_at', r.created_at).limit(1);
    if ((nuevos || []).length && ['mensaje_extra', 'plantilla', 'adjunto'].includes(tipo)) return { ok: false, error: 'Ya hubo mensajes en esa conversación después de esta propuesta; revísala en el hilo antes de mandar algo.' };
  }
  const texto = String(textoEditado || p.texto || '').trim();
  const editada = !!textoEditado && textoEditado.trim() !== String(p.texto || '').trim();
  const { data: c } = await supabase.from('contacts').select('nombre, whatsapp, owner_id, company_id').eq('id', r.contact_id).maybeSingle();
  const tel = String(c?.whatsapp || '').replace(/\D/g, '');
  let hecho = '';
  if (tipo === 'mensaje_extra' || tipo === 'adjunto') {
    if (texto.length < 2 || !tel) return { ok: false, error: 'Falta el texto o el teléfono' };
    const ventana = Math.max(0, Number(cfg.agente_veto_min ?? 10));
    const { error: eIns } = await supabase.from('ti_envios').insert({ contact_id: r.contact_id, conversation_id: r.conversation_id, telefono: tel, origen: 'revision', estado: 'pendiente', mensaje: texto, adjuntos: Array.isArray(p.adjuntos) ? p.adjuntos : [], salida: { estado: 'revision', objetivo: p.fundamento || 'Propuesta de la revisión diaria', revision_id: id, reconsiderado: true }, sale_at: new Date(Date.now() + ventana * 60e3).toISOString(), modelo: 'revision', aprobado_por: userId });
    if (eIns) return { ok: false, error: /23505|duplicate/i.test(eIns.message) ? 'Ese lead ya tiene un envío pendiente en Próximos envíos; revísalo ahí.' : eIns.message };
    hecho = `Programado: sale en ${ventana} min salvo que lo detengas en Próximos envíos.`;
  } else if (tipo === 'llamada') {
    await supabase.from('ti_tareas').insert({ contact_id: r.contact_id, company_id: c?.company_id || null, owner_id: c?.owner_id || null, familia: 'contactar', tipo: 'llamada', prioridad: 2, vence_at: ahora, origen: 'reloj', payload: { instruccion: `Llámale a ${String(c?.nombre || 'el lead').split(/\s+/)[0]} — propuesta de la revisión diaria`, porque: p.fundamento || '', nombre: c?.nombre, whatsapp: c?.whatsapp, reloj: 'revision', tipo_llamada: 'Llamada de rescate' } });
    hecho = 'Tarea de llamada creada.';
  } else if (tipo === 'cambiar_angulo') {
    const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', r.contact_id).maybeSingle();
    await supabase.from('ti_perfil').upsert({ contact_id: r.contact_id, agente_estado: { ...((pf?.agente_estado as any) || {}), angulo_sugerido: texto || p.fundamento || 'cambiar de ángulo' }, updated_at: ahora }, { onConflict: 'contact_id' });
    hecho = 'El siguiente toque usará ese ángulo.';
  } else if (tipo === 'plantilla') {
    const { parListo, paramAngulo } = await import('./plantillas-agente');
    const par = await parListo(); if (!par || !tel) return { ok: false, error: 'No hay plantilla aprobada todavía' };
    const primer = String(c?.nombre || 'Hola').trim().split(/\s+/)[0];
    await supabase.from('ti_envios').insert({ contact_id: r.contact_id, conversation_id: r.conversation_id, telefono: tel, origen: 'revision', estado: 'pendiente', mensaje: texto || p.fundamento || '', salida: { estado: 'revision', objetivo: p.fundamento || '', revision_id: id, reconsiderado: true }, sale_at: new Date(Date.now() + Math.max(0, Number(cfg.agente_veto_min ?? 10)) * 60e3).toISOString(), modelo: 'revision', aprobado_por: userId, plantilla: { marketing: par.marketing, utility: par.utility, params: [primer, paramAngulo(texto || p.fundamento || '')] } });
    hecho = 'Plantilla programada (marketing → utility).';
  } else if (tipo === 'descalificar') {
    if (!userId) return { ok: false, error: 'Descalificar siempre requiere tu clic' };
    const { aplicarVeredictoSilencio } = await import('./agente');
    await aplicarVeredictoSilencio({ contact_id: r.contact_id, id: null, payload: { propuesta: 'descalificar', origen: 'revision' } }, 'descalificar', { revision_id: id }, userId);
    hecho = 'Descalificado: no respondió (a nutrición mecánica).';
  } else { hecho = 'Nada que ejecutar.'; }
  await supabase.from('ti_revision').update({ estado: userId ? 'aceptada' : 'automatica', decidido_por: userId, decidido_at: ahora, motivo: editada ? 'texto editado por el dueño' : null, propuesta: editada ? { ...p, texto_original: p.texto, texto } : p }).eq('id', id);
  await supabase.from('ia_log').insert({ accion: 'revision_aceptada', contact_id: r.contact_id, razon: tipo, contenido: texto || null, detalle: { revision_id: id, por: userId, editada } });
  if (userId) {
    const n = editada ? 0 : (Number(rampa.aceptadas) || 0) + 1;
    const nueva = { ...rampa, aceptadas: n, automatico: rampa.automatico || n >= 20, ...(n >= 20 && !rampa.automatico ? { automatico_desde: ahora } : {}) };
    await supabase.from('ti_config').update({ valor: { ...cfg, rampa_revision: nueva } }).eq('id', 1);
    if (n >= 20 && !rampa.automatico) await notificar({ clave: `rampa_revision_auto:${ahora.slice(0, 10)}`, tipo: 'sistema_rampa_revision', nivel: 'info', titulo: 'Las propuestas de bajo riesgo de la Revisión diaria ya salen solas', detalle: '20 aceptadas seguidas sin cambios. Mensaje extra, cambiar ángulo y adjunto salen con ventana de veto; descalificar y llamada siguen con tu clic.', metadata: { origen: 'agente', que_hacer: 'Nada; si quieres volver al clic, apágalo en Revisión diaria.' } });
  }
  return { ok: true, hecho };
}
