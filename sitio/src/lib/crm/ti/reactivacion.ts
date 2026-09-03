// ══ Reactivación de leads viejos (decisión 2026-09-03) ═══════════════════════════════════════════════════
// El ciclo normal arranca cuando el lead escribe. Los que preguntaron hace meses necesitan un PRIMER CONTACTO
// personalizado: el agente redacta uno por uno (qué preguntó, su giro, en qué se quedó, una novedad concreta),
// el dueño aprueba con rampa (20 sin editar → salen solas con ventana de veto) y a partir de la respuesta
// entra el ciclo de siempre. Máximo 15 al día, en horas distintas, solo entre semana.
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey, calculateCost } from '../../ai/client';
import { leerConfig } from './motor';
import { parListoPara, paramAngulo } from './plantillas-agente';
import { promoVigente, promoTexto } from './promociones';
import { notificar } from '../notificaciones';

export const SEGMENTOS: Record<string, { l: string; corto: string; desc: string }> = {
  intencion: { l: 'Pidió precio o demo y se enfrió', corto: 'Pidió precio/demo', desc: 'Llegó a preguntar precio, planes, costo o demo. Intención clara que no cerró.' },
  conversacion: { l: 'Preguntó y no siguió', corto: 'Preguntó', desc: 'Escribió alguna vez con una duda y la conversación se quedó a medias.' },
};
const MAX_DIA = 15;
const HORAS_CDMX = [10, 11, 12, 13, 15, 16, 17, 18];
const RAMPA_META = 20;
const VETO_MIN = 10;

const cdmx = (d = new Date()) => new Date(d.getTime() - 6 * 3600e3);   // reloj de México (UTC-6, sin horario de verano)
const esFinDeSemana = (d: Date) => [0, 6].includes(cdmx(d).getUTCDay());

/** Siguiente hueco libre: reparte el día en horas distintas y no pasa de MAX_DIA; fin de semana salta al lunes. */
export async function siguienteHueco(): Promise<Date> {
  let dia = new Date(); const hCdmx = cdmx(dia).getUTCHours();
  if (hCdmx >= 18) dia = new Date(dia.getTime() + 86400e3);
  for (let i = 0; i < 14; i++, dia = new Date(dia.getTime() + 86400e3)) {
    if (esFinDeSemana(dia)) continue;
    const ymd = cdmx(dia).toISOString().slice(0, 10);
    const ini = `${ymd}T06:00:00.000Z`, fin = `${ymd}T23:59:59.000Z`;   // 00:00–17:59 CDMX del día siguiente en UTC ≈ tope
    const { data } = await supabase.from('ti_envios').select('sale_at').eq('origen', 'reactivacion').in('estado', ['pendiente', 'enviando', 'enviado']).gte('sale_at', ini).lte('sale_at', fin);
    const usados = data || [];
    if (usados.length >= MAX_DIA) continue;
    const porHora: Record<number, number> = {}; for (const u of usados) { const h = cdmx(new Date(u.sale_at)).getUTCHours(); porHora[h] = (porHora[h] || 0) + 1; }
    const ahoraH = ymd === cdmx().toISOString().slice(0, 10) ? cdmx().getUTCHours() : -1;
    const libres = HORAS_CDMX.filter(h => h > ahoraH).sort((a, b) => (porHora[a] || 0) - (porHora[b] || 0) || a - b);
    if (!libres.length) continue;
    const h = libres[0]; const min = 5 + Math.floor(Math.random() * 46);
    return new Date(Date.parse(`${ymd}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00-06:00`));
  }
  return new Date(Date.now() + 86400e3);
}

async function contexto(c: any) {
  const [{ data: ms }, { data: pf }] = await Promise.all([
    supabase.from('wa_mensajes').select('direccion, cuerpo, tipo, created_at').eq('conversation_id', c.conversation_id).order('created_at', { ascending: false }).limit(30),
    supabase.from('ti_perfil').select('datos, resumen').eq('contact_id', c.contact_id).maybeSingle(),
  ]);
  const hilo = (ms || []).reverse().map(m => `${m.direccion === 'entrante' ? 'LEAD' : 'SACS'} (${String(m.created_at).slice(0, 10)}): ${(m.cuerpo || `[${m.tipo}]`).slice(0, 400)}`).join('\n');
  return { hilo, datos: (pf as any)?.datos || {}, resumen: (pf as any)?.resumen || '' };
}

/** Redacta el primer contacto de UN lead. Instrucción implícita: reconocer el tiempo, retomar SU pregunta, una novedad, una pregunta fácil, cero pitch. */
export async function redactarReactivacion(c: any): Promise<{ mensaje: string; angulo: string; resumen_lead: string; pregunta_original: string; por_que: string; costo: number; descartar?: string } | null> {
  if (!hasApiKey()) { console.error('[reactivacion] sin API key'); return null; }
  const cfg: any = await leerConfig();
  const { hilo, datos, resumen } = await contexto(c);
  const promo = await promoVigente();
  const novedades: string[] = Array.isArray(cfg.novedades) && cfg.novedades.length ? cfg.novedades : [
    'traspasos automáticos entre sucursales por talla y color (nivelación)',
    'AXO, el copiloto que avisa cuando una talla se va a agotar',
    'tienda en línea y catálogo de WhatsApp conectados al inventario',
    'apartados y liveshows con cobro por link',
    'reportes ejecutivos por sucursal y vendedor',
  ];
  const prompt = `Eres Andrea, asesora de Sacs (software para tiendas de moda en México). Vas a RETOMAR el contacto con un lead que escribió hace ${c.meses_sin_hablar} meses y se quedó a medias. Es un PRIMER mensaje después de mucho tiempo: sale por WhatsApp como plantilla y el lead no espera nada de ti.

QUIÉN ES
Nombre: ${c.nombre || 'sin nombre'} · Empresa: ${c.empresa || 'no la sabemos'} · Segmento: ${SEGMENTOS[c.segmento]?.l}
Datos que tenemos: ${JSON.stringify(datos).slice(0, 600)}
Resumen previo: ${resumen || 'ninguno'}

LA CONVERSACIÓN QUE TUVIMOS
${hilo || '(no hay mensajes legibles)'}

NOVEDADES REALES DESDE ENTONCES (elige UNA, la que le pegue a SU pregunta; si ninguna le pega, no inventes y usa su pregunta sola)
- ${novedades.join('\n- ')}
${promo ? `Promoción vigente (menciónala SOLO si el lead preguntó por precio): ${promoTexto(promo)}` : ''}

CÓMO SE ESCRIBE ESTE MENSAJE (obligatorio)
1. Reconoce el tiempo que pasó sin disculparte de más («hace unos meses», «en ${c.meses_sin_hablar > 5 ? 'primavera' : 'estos meses'}» no: usa hechos: «en tu mensaje de mayo»).
2. Retoma SU pregunta original con sus palabras, para que sepa que sí lo leíste.
3. Una sola novedad concreta que le sirva a esa pregunta. Cero lista de funciones.
4. Cierra con UNA pregunta fácil de contestar con sí/no o con un dato («¿sigues con las dos tiendas?»), no con «¿agendamos?».
5. Sin emojis, sin «espero que estés bien», sin «quería darle seguimiento», sin mayúsculas de énfasis. Máximo 300 caracteres: va dentro de una plantilla que ya trae «Hola {nombre},» al inicio y una salida amable al final, así que NO saludes ni te despidas ni ofrezcas la demo: eso ya lo dice la plantilla.
6. Habla como habla la gente de tiendas en México, de tú.

Si la conversación muestra que YA es cliente de Sacs (soporte, impresora, cuenta, factura, «mi sistema»), que no es una tienda o que pidió que no le escribieran, NO redactes: responde {"descartar": "motivo en una línea"}.

Responde SOLO con JSON: {"mensaje": "...", "angulo": "en 6 palabras qué palanca usas", "resumen_lead": "una línea para el dueño: quién es y en qué se quedó", "pregunta_original": "su pregunta en una línea", "por_que": "una línea: por qué este mensaje y no otro"}`;
  const r = await anthropic.messages.create({ model: MODELS.opus, max_tokens: 1400, messages: [{ role: 'user', content: prompt }] });
  const txt = (r.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') || '';
  if (!txt) console.error('[reactivacion] respuesta sin texto:', JSON.stringify(r).slice(0, 400));
  const m = txt.match(/\{[\s\S]*\}/); if (!m) { console.error('[reactivacion] sin JSON:', txt.slice(0, 300)); return null; }
  let j: any; try { j = JSON.parse(m[0]); } catch { console.error('[reactivacion] JSON inválido:', m[0].slice(0, 300)); return null; }
  const costo = calculateCost(MODELS.opus, r.usage as any).cost_usd;
  if (j.descartar) return { mensaje: '', angulo: '', resumen_lead: '', pregunta_original: '', por_que: '', costo, descartar: String(j.descartar) };
  if (!j.mensaje) return null;
  return { mensaje: String(j.mensaje).trim(), angulo: String(j.angulo || ''), resumen_lead: String(j.resumen_lead || ''), pregunta_original: String(j.pregunta_original || ''), por_que: String(j.por_que || ''), costo };
}

/** Lote del día: redacta hasta `n` propuestas nuevas (primero los de intención). Si la rampa está en automático, las programa con ventana de veto. */
export async function generarLoteReactivacion(n = MAX_DIA): Promise<any> {
  const res: any = { candidatos: 0, propuestas: 0, automaticas: 0, errores: 0, costo: 0 };
  const cfg: any = await leerConfig();
  if (cfg.reactivacion_activa === false) return { ...res, apagada: true };
  const { data: cands, error } = await supabase.from('v_ti_reactivacion_candidatos').select('*').limit(n);
  if (error) return { ...res, error: error.message };
  res.candidatos = (cands || []).length;
  const rampa: any = cfg.rampa_reactivacion || { sin_editar: 0, automatico: false };
  for (const c of cands || []) {
    try {
      const d = await redactarReactivacion(c);
      if (!d) { res.errores++; continue; }
      res.costo += d.costo;
      if (d.descartar) {
        // El agente vio que ya es cliente o no es tienda: queda registrado para no volver a proponerlo.
        await supabase.from('ti_reactivacion').insert({ contact_id: c.contact_id, conversation_id: c.conversation_id, telefono: c.telefono, segmento: c.segmento, meses_sin_hablar: c.meses_sin_hablar, mensaje: '', estado: 'descartada', error: d.descartar, modelo: MODELS.opus, costo_usd: d.costo });
        res.descartadas = (res.descartadas || 0) + 1; continue;
      }
      const { data: fila, error: e2 } = await supabase.from('ti_reactivacion').insert({ contact_id: c.contact_id, conversation_id: c.conversation_id, telefono: c.telefono, segmento: c.segmento, meses_sin_hablar: c.meses_sin_hablar, resumen_lead: d.resumen_lead, pregunta_original: d.pregunta_original, angulo: d.angulo, mensaje: d.mensaje, mensaje_original: d.mensaje, por_que: d.por_que, modelo: MODELS.opus, costo_usd: d.costo, automatica: !!rampa.automatico }).select('id').maybeSingle();
      if (e2 || !fila) { res.errores++; continue; }
      res.propuestas++;
      if (rampa.automatico) { await aprobarReactivacion(fila.id, { automatica: true }); res.automaticas++; }
    } catch (err: any) { res.errores++; await supabase.from('ia_log').insert({ accion: 'agente_error', contact_id: c.contact_id, razon: `reactivacion: ${err?.message || err}` }); }
  }
  if (res.propuestas) await notificar({ clave: `ti_reactivacion:${new Date().toISOString().slice(0, 10)}`, tipo: 'ti_revision', titulo: `Reactivación: ${res.propuestas} mensajes propuestos para leads viejos${res.automaticas ? ` (${res.automaticas} salen solos)` : ''}`, cuerpo: 'Revísalos en Trabajo inteligente → Reactivación.', url: '/admin/crm?tab=trabajo' } as any).catch(() => {});
  return res;
}

/** Aprobar: programa el envío como plantilla de la familia «reactivación» en el siguiente hueco y arranca el ciclo del agente para ese lead. */
export async function aprobarReactivacion(id: string, o: { mensaje?: string; userId?: string; automatica?: boolean } = {}): Promise<any> {
  const { data: r } = await supabase.from('ti_reactivacion').select('*').eq('id', id).maybeSingle();
  if (!r || !['propuesta'].includes(r.estado)) return { error: 'Esta propuesta ya se decidió' };
  const mensaje = String(o.mensaje || r.mensaje).trim();
  const editado = mensaje !== String(r.mensaje_original || r.mensaje).trim();
  const par = await parListoPara('reactivacion');
  if (!par) return { error: 'No hay plantilla aprobada por Meta todavía (ni la de reactivación ni la de seguimiento).' };
  const { data: k } = await supabase.from('contacts').select('nombre').eq('id', r.contact_id).maybeSingle();
  const primer = String(k?.nombre || '').trim().split(/\s+/)[0] || 'qué tal';
  let saleAt = await siguienteHueco();
  if (o.automatica) saleAt = new Date(Math.max(saleAt.getTime(), Date.now() + VETO_MIN * 60e3));
  const { data: env, error } = await supabase.from('ti_envios').insert({ contact_id: r.contact_id, conversation_id: r.conversation_id, telefono: r.telefono, origen: 'reactivacion', estado: 'pendiente', mensaje, mensaje_original: r.mensaje_original, sale_at: saleAt.toISOString(), modelo: r.modelo, costo_usd: r.costo_usd, aprobado_por: o.userId || null, editado_por: editado ? o.userId || null : null, revisado_at: new Date().toISOString(), plantilla: { marketing: par.marketing, utility: par.utility, familia: par.familia, params: [primer, paramAngulo(mensaje)] }, salida: { objetivo: 'reactivar', angulo: r.angulo, segmento: r.segmento } }).select('id').maybeSingle();
  if (error || !env) return { error: error?.message || 'No se pudo programar' };
  await supabase.from('ti_reactivacion').update({ estado: 'programada', envio_id: env.id, sale_at: saleAt.toISOString(), mensaje, editado, decidido_por: o.userId || null, decidido_at: new Date().toISOString(), automatica: !!o.automatica, updated_at: new Date().toISOString() }).eq('id', id);
  // El ciclo del agente arranca aquí: este envío cuenta como el primer intento del ciclo nuevo.
  const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', r.contact_id).maybeSingle();
  const st: any = (pf as any)?.agente_estado || {};
  await supabase.from('ti_perfil').upsert({ contact_id: r.contact_id, agente_estado: { ...st, ciclo: (st.ciclo || 0) + 1, toque: 1, fase: 'reconectar', base_at: saleAt.toISOString(), ultimo_toque_at: saleAt.toISOString(), intentos: [{ at: saleAt.toISOString(), tipo: 'plantilla', franja: 'mañana', envio_id: env.id, valido: false, reactivacion: true }], angulos: [r.angulo].filter(Boolean), cerrado: undefined, pausa_hasta: undefined, reactivacion_id: id }, updated_at: new Date().toISOString() }, { onConflict: 'contact_id' });
  await supabase.from('contacts').update({ lifecycle_stage: 'lead' }).eq('id', r.contact_id).eq('lifecycle_stage', 'descalificado');
  // Rampa: aprobadas seguidas sin editar → automático.
  if (!o.automatica) {
    const cfg: any = await leerConfig(); const rampa: any = cfg.rampa_reactivacion || { sin_editar: 0, automatico: false };
    const nueva = editado ? { ...rampa, sin_editar: 0 } : { ...rampa, sin_editar: (rampa.sin_editar || 0) + 1 };
    if (nueva.sin_editar >= RAMPA_META && !nueva.automatico) { nueva.automatico = true; nueva.automatico_desde = new Date().toISOString(); }
    await supabase.from('ti_config').update({ valor: { ...cfg, rampa_reactivacion: nueva } }).eq('id', 1);
  }
  if (editado) await supabase.from('ia_log').insert({ accion: 'agente_editado', contact_id: r.contact_id, contenido: mensaje, razon: 'reactivación editada por el dueño', detalle: { original: r.mensaje_original, reactivacion_id: id } });
  return { ok: true, envio_id: env.id, sale_at: saleAt.toISOString() };
}

export async function rechazarReactivacion(id: string, motivo: string, userId?: string) {
  const { data: r } = await supabase.from('ti_reactivacion').select('*').eq('id', id).maybeSingle();
  if (!r) return { error: 'No existe' };
  if (r.estado === 'programada' && r.envio_id) await supabase.from('ti_envios').update({ estado: 'vetado', motivo_veto: motivo || 'reactivación rechazada', vetado_por: userId || null }).eq('id', r.envio_id).eq('estado', 'pendiente');
  await supabase.from('ti_reactivacion').update({ estado: 'rechazada', error: motivo || null, decidido_por: userId || null, decidido_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  const cfg: any = await leerConfig(); const rampa: any = cfg.rampa_reactivacion || {};
  await supabase.from('ti_config').update({ valor: { ...cfg, rampa_reactivacion: { ...rampa, sin_editar: 0 } } }).eq('id', 1);
  await supabase.from('ia_log').insert({ accion: 'agente_vetado', contact_id: r.contact_id, contenido: r.mensaje, razon: motivo || 'reactivación rechazada', detalle: { reactivacion_id: id, segmento: r.segmento } });
  return { ok: true };
}

/** Sincroniza estados: enviada cuando el envío salió; respondió cuando el lead contestó después. */
export async function sincronizarReactivaciones() {
  const { data: filas } = await supabase.from('ti_reactivacion').select('id, envio_id, contact_id, sale_at, estado').in('estado', ['programada', 'enviada']).limit(200);
  for (const f of filas || []) {
    if (f.estado === 'programada' && f.envio_id) {
      const { data: e } = await supabase.from('ti_envios').select('estado, enviado_at').eq('id', f.envio_id).maybeSingle();
      if (e?.estado === 'enviado') await supabase.from('ti_reactivacion').update({ estado: 'enviada', updated_at: new Date().toISOString() }).eq('id', f.id);
      else if (e && ['vetado', 'fallido', 'reemplazado'].includes(e.estado)) await supabase.from('ti_reactivacion').update({ estado: e.estado === 'vetado' ? 'rechazada' : 'error', error: e.estado, updated_at: new Date().toISOString() }).eq('id', f.id);
      continue;
    }
    const { data: c } = await supabase.from('wa_conversaciones').select('ultimo_entrante_at').eq('contact_id', f.contact_id).order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
    if (c?.ultimo_entrante_at && f.sale_at && c.ultimo_entrante_at > f.sale_at) await supabase.from('ti_reactivacion').update({ estado: 'respondio', updated_at: new Date().toISOString() }).eq('id', f.id);
  }
}
