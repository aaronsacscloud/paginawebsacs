// TRABAJO INTELIGENTE · F5 — EL COPILOTO: la IA que CONVERSA.
//
// Decisión del dueño (2ª ronda): «si un P1 rebasa el SLA o el consultor
// declara ausencia, la IA responde ella misma; al retomar, se le dice qué
// pasó y la falta queda en su log». Aquí vive eso.
//
// Reglas duras del diseño:
// - La IA NUNCA responde antes del SLA: la primera oportunidad es del humano.
// - Fuera de horario responde de una vez (el lead de las 11 pm no espera).
// - Si el tema está fuera de sus límites, NO improvisa: manda un puente
//   («te contesto mañana a primera hora») y deja la tarea al tope.
// - Todo queda en ia_log con su razón, su costo y su contenido.
import { supabase } from '../../supabase';
import { anthropic, MODELS, calculateCost, hasApiKey } from '../../ai/client';
import { WIKI_COMERCIAL, LIMITES_COPILOTO } from './wiki-comercial';
import { leerConfig } from './motor';
import { esHorarioLaboral } from './reglas';

const MS_MIN = 60e3;

async function log(o: {
  accion: string; contact_id?: string | null; tarea_id?: string | null;
  razon?: string; contenido?: string | null; modelo?: string; costo?: number; detalle?: any;
}) {
  await supabase.from('ia_log').insert({
    accion: o.accion, contact_id: o.contact_id || null, tarea_id: o.tarea_id || null,
    razon: o.razon || null, contenido: o.contenido || null, modelo: o.modelo || null,
    costo_usd: o.costo ?? null, detalle: o.detalle || null,
  });
}

/** La conversación completa del contacto, en orden, para que la IA la LEA. */
async function charla(contactId: string, limite = 30) {
  const { data: convs } = await supabase.from('wa_conversaciones').select('id').eq('contact_id', contactId).limit(3);
  let msjs: any[] = [];
  for (const cv of convs || []) {
    const { data } = await supabase.from('wa_mensajes')
      .select('direccion, cuerpo, created_at').eq('conversation_id', cv.id)
      .order('created_at', { ascending: false }).limit(limite);
    msjs = msjs.concat(data || []);
  }
  return msjs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).slice(-limite);
}

/** Las jugadas APROBADAS del playbook (lo que el ciclo de 24 h ya validó). */
async function jugadas() {
  const { data } = await supabase.from('ia_jugadas').select('pregunta, respuesta').eq('estado', 'aprobada').limit(40);
  if (!(data || []).length) return '';
  return '\n\nJUGADAS APROBADAS (respuestas que YA funcionaron — úsalas como guía):\n'
    + data!.map(j => `P: ${j.pregunta}\nR: ${j.respuesta}`).join('\n---\n');
}

export type Veredicto = { puede: boolean; mensaje: string; motivo: string; costo: number };

/** Redacta la respuesta — o dice honestamente que no puede. */
export async function redactarRespuesta(contactId: string, nombre: string): Promise<Veredicto> {
  if (!hasApiKey()) return { puede: false, mensaje: '', motivo: 'sin_api_key', costo: 0 };
  const hist = await charla(contactId);
  if (!hist.length) return { puede: false, mensaje: '', motivo: 'sin_conversacion', costo: 0 };
  const texto = hist.map(m => `${m.direccion === 'entrante' ? 'LEAD' : 'NOSOTROS'}: ${String(m.cuerpo || '(media)').slice(0, 400)}`).join('\n');

  const r = await anthropic.messages.create({
    model: MODELS.opus, max_tokens: 600,
    system: `Eres parte del equipo comercial de Sacscloud y estás cubriendo a un consultor que no alcanzó a responder. Tu trabajo es contestarle al lead de forma humana, útil y corta.\n\n${WIKI_COMERCIAL}\n\n${LIMITES_COPILOTO}${await jugadas()}`,
    messages: [{
      role: 'user',
      content: `Conversación con ${nombre} (lo más reciente al final):\n\n${texto}\n\nResponde SOLO un JSON:\n{"puede":true|false,"motivo":"por qué NO puedes, si puede=false","mensaje":"el mensaje para el lead si puede=true"}\n\npuede=false cuando el último mensaje del lead entra en tus límites (descuentos, quejas, facturación/contratos, promesas) o cuando necesitas información que no tienes. En ese caso el humano lo verá.\npuede=true cuando puedes resolver con la wiki: info de producto/módulos/giros, precios de lista, cómo funciona, o proponer la demo de 15 minutos.`,
    }],
  });
  const t = r.content.find(b => b.type === 'text') as any;
  const costo = calculateCost(MODELS.opus, r.usage as any);
  let v: any = {};
  try { const s = t?.text || '{}'; v = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch { v = {}; }
  const puede = v.puede === true && typeof v.mensaje === 'string' && v.mensaje.trim().length > 10;
  return { puede, mensaje: String(v.mensaje || '').trim(), motivo: String(v.motivo || 'sin motivo'), costo };
}

/**
 * EL BARRIDO DE COBERTURA — corre con el observador.
 * Busca P1 de «responder» que el humano no atendió a tiempo y los cubre:
 *   · fuera de horario laboral → cubre de inmediato
 *   · en horario → espera el SLA (config sla_p1_min, 15 min)
 *   · ausencia declarada del owner → cubre siempre
 * Al cubrir: envía por WhatsApp, deja la FALTA en el log del consultor y
 * convierte la tarea en ESTAFETA («revisa lo que contesté y sigue tú»).
 */
export async function cubrirPendientes(): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.copiloto_activo === false) return { copiloto: 'apagado' };
  const ahora = new Date();
  const res: any = { cubiertas: 0, puentes: 0, no_pudo: 0 };
  if (!hasApiKey()) return { copiloto: 'sin_api_key' };

  const laboral = esHorarioLaboral(ahora, cfg);
  const slaMin = Number(cfg.sla_p1_min) || 15;
  // En horario: solo lo que ya rebasó el SLA. Fuera de horario: todo (el lead
  // que escribe de noche no espera a mañana).
  const corte = new Date(ahora.getTime() - (laboral ? slaMin : 2) * MS_MIN).toISOString();

  const { data: pend } = await supabase.from('ti_tareas')
    .select('id, contact_id, owner_id, created_at, payload')
    .eq('estado', 'pendiente').eq('tipo', 'responder').eq('prioridad', 1)
    .lt('created_at', corte).limit(10);

  for (const t of pend || []) {
    const p: any = t.payload || {};
    if (p.cubierta_ia) continue;                       // ya cubierta antes
    // CANDADO: el copiloto jamás le escribe a un contacto sembrado de demo.
    const { data: ctc } = await supabase.from('contacts').select('propiedades').eq('id', t.contact_id).maybeSingle();
    if ((ctc?.propiedades as any)?.demo_ti) continue;
    const nombre = String(p.nombre || 'el lead').trim();
    const esperaMin = Math.round((ahora.getTime() - Date.parse(t.created_at)) / MS_MIN);

    let v: Veredicto;
    try { v = await redactarRespuesta(t.contact_id, nombre); }
    catch (e: any) { await log({ accion: 'error', contact_id: t.contact_id, tarea_id: t.id, razon: String(e?.message || e) }); continue; }

    // Lo que no puede resolver NO se improvisa: puente y el humano decide.
    const mensaje = v.puede ? v.mensaje
      : `Te leo ${nombre.split(/\s+/)[0]} — déjame confirmarlo bien y te contesto a primera hora de mañana, ¿va?`;
    if (!v.puede && laboral) {                          // en horario, el humano sigue teniendo la pelota
      await log({ accion: 'no_pudo', contact_id: t.contact_id, tarea_id: t.id, razon: v.motivo, costo: v.costo, modelo: MODELS.opus });
      res.no_pudo++;
      continue;
    }

    try {
      const { enviarTexto } = await import('../../whatsapp/kapso-api');
      await enviarTexto(String(p.whatsapp || ''), mensaje);
    } catch (e: any) {
      await log({ accion: 'error', contact_id: t.contact_id, tarea_id: t.id, razon: `envío: ${e?.message || e}`, contenido: mensaje });
      continue;
    }

    await log({
      accion: laboral ? 'cubrir_sla' : 'cubrir_fuera_horario',
      contact_id: t.contact_id, tarea_id: t.id, contenido: mensaje, modelo: MODELS.opus, costo: v.costo,
      razon: v.puede ? 'respondió con la wiki' : `puente (${v.motivo})`,
      detalle: { espera_min: esperaMin, sla_min: slaMin },
    });

    // La FALTA del consultor: solo si estaba en horario y le tocaba a él.
    if (laboral) {
      await supabase.from('ti_faltas').insert({
        owner_id: t.owner_id, tipo: 'p1_fuera_sla', contact_id: t.contact_id, tarea_id: t.id,
        detalle: { espera_min: esperaMin, sla_min: slaMin, cubierta_por_ia: true },
      });
    }

    // La ESTAFETA: la tarea deja de ser «responder» y pasa a «revisa lo que
    // contesté y sigue tú», con la falta a la vista.
    const horas = Math.floor(esperaMin / 60), mins = esperaMin % 60;
    const espera = horas ? `${horas} h ${String(mins).padStart(2, '0')}` : `${mins} min`;
    await supabase.from('ti_tareas').update({
      tipo: 'estafeta', familia: 'responder', prioridad: 1, vence_at: ahora.toISOString(),
      payload: {
        ...p, cubierta_ia: true, mensaje: '',
        instruccion: `Toma la estafeta de ${nombre.split(/\s+/)[0]} — la cubrí por ti`,
        porque: laboral
          ? `Esperó ${espera} fuera del SLA de ${slaMin} min y le contesté con la wiki comercial. Revisa lo que dije y sigue tú.`
          : `Escribió fuera de horario y le contesté para no dejarlo en visto. Revisa lo que dije y sigue tú.`,
        charla: [
          ['ella', String(p.entrante || '').slice(0, 400), 'su mensaje'],
          ['ia', mensaje, v.puede ? 'lo contesté con la wiki' : 'puente: el tema te toca a ti'],
        ],
        hechos: [
          ['Esperó', espera, laboral ? `SLA de ${slaMin} min` : 'fuera de horario', laboral ? 'ambar' : ''],
          ['La cubrí', v.puede ? 'Con la wiki' : 'Con un puente', v.puede ? 'info de producto/precio' : v.motivo.slice(0, 40), v.puede ? 'verde' : 'ambar'],
        ],
        falta: laboral ? `Falta registrada en tu log: P1 atendido fuera del SLA (esperó ${espera}).` : null,
      },
    }).eq('id', t.id);

    v.puede ? res.cubiertas++ : res.puentes++;
  }
  return res;
}
