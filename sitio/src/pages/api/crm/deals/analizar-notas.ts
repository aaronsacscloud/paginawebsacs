// POST /api/crm/deals/analizar-notas { deal_id, notas }
//
// Lee las notas de una llamada o demo y PROPONE la actualización del trato:
// etapa, próximo paso con fecha, cierre esperado, objeciones y —si se perdió—
// el motivo. Es el "Smart Deal Progression" de HubSpot en su versión honesta.
//
// No guarda NADA. Devuelve la propuesta y una persona decide: un CRM que se
// mueve solo con lo que entendió de una nota deja de ser confiable, y un dato
// inventado en el pipeline cuesta más que el minuto que ahorra.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { anthropic, MODELS } from '../../../../lib/ai/client';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const notas = String(b?.notas || '').trim();
  if (!b?.deal_id) return json({ error: 'deal_id requerido' }, 400);
  if (notas.length < 30) return json({ error: 'Pega las notas de la llamada (al menos un par de frases).' }, 400);

  const { data: deal } = await supabase.from('deals')
    .select('id, nombre, stage, valor_total, mrr, fecha_cierre_esperada, proximo_paso, categoria, companies(nombre)')
    .eq('id', b.deal_id).maybeSingle();
  if (!deal) return json({ error: 'No encontré esa oportunidad.' }, 404);

  // Las etapas REALES del pipeline configurado: proponer una etapa inventada
  // sería inaplicable, y el modelo no tiene por qué adivinar cómo se llaman aquí.
  const { data: pipe } = await supabase.from('pipelines').select('stages').eq('tipo', 'oportunidad').maybeSingle();
  const etapas = (pipe?.stages || []).map((s: any) => `${s.key} = ${s.label}`).join('\n');
  const hoy = new Date().toISOString().slice(0, 10);
  const empresa: any = Array.isArray(deal.companies) ? deal.companies[0] : deal.companies;

  const sistema = [
    'Eres el asistente de un CRM de SACS (software de punto de venta para comercios en México).',
    'Lees las notas de una llamada o demo y propones cómo actualizar la oportunidad.',
    'Reglas:',
    '- Responde SOLO con un objeto JSON, sin texto alrededor ni markdown.',
    '- Campos: resumen (1-2 frases), stage (una key EXACTA de la lista o null), proximo_paso (qué hay que hacer, imperativo y concreto, o null), proximo_paso_at (YYYY-MM-DD o null), fecha_cierre_esperada (YYYY-MM-DD o null), motivo_perdida (solo si de verdad se perdió, si no null), objeciones (array de strings, puede ir vacío).',
    '- Si algo no está en las notas, va null. NO inventes fechas, montos ni compromisos: un dato inventado en el pipeline cuesta más que el minuto que ahorra.',
    `- Hoy es ${hoy}. Las fechas relativas ("el lunes", "en dos semanas") se resuelven contra hoy.`,
    'Etapas válidas (usa la key, no el label):',
    etapas || 'calificacion, demo_agendada, demo_realizada, cotizacion_enviada, negociacion, cerrada_ganada, cerrada_perdida',
  ].join('\n');

  const contexto = [
    `Oportunidad: ${deal.nombre}`,
    empresa?.nombre ? `Cliente: ${empresa.nombre}` : '',
    `Etapa actual: ${deal.stage}`,
    deal.fecha_cierre_esperada ? `Cierre esperado actual: ${deal.fecha_cierre_esperada}` : '',
    deal.proximo_paso ? `Próximo paso actual: ${deal.proximo_paso}` : '',
    '',
    'NOTAS DE LA LLAMADA:',
    notas.slice(0, 12000),
  ].filter(Boolean).join('\n');

  try {
    const r = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 700,
      system: sistema,
      messages: [{ role: 'user', content: contexto }],
    });
    const texto = (r.content || []).map((c: any) => (c.type === 'text' ? c.text : '')).join('').trim();
    // El modelo a veces envuelve en ```json pese a la instrucción.
    const limpio = texto.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let p: any;
    try { p = JSON.parse(limpio); }
    catch { return json({ error: 'No pude leer la respuesta del modelo. Vuelve a intentar.', crudo: limpio.slice(0, 300) }, 502); }

    // Se filtra lo que no es aplicable aquí: una etapa que no existe en este
    // pipeline no se puede proponer.
    const keys = (pipe?.stages || []).map((s: any) => s.key);
    if (p.stage && keys.length && !keys.includes(p.stage)) p.stage = null;
    const fecha = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

    return json({
      resumen: p.resumen || null,
      stage: p.stage || null,
      proximo_paso: p.proximo_paso || null,
      proximo_paso_at: fecha(p.proximo_paso_at),
      fecha_cierre_esperada: fecha(p.fecha_cierre_esperada),
      motivo_perdida: p.motivo_perdida || null,
      objeciones: Array.isArray(p.objeciones) ? p.objeciones.slice(0, 6) : [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/api[_ ]?key|401|authentication/i.test(msg)) return json({ error: 'Falta configurar ANTHROPIC_API_KEY para esta función.' }, 503);
    return json({ error: 'No se pudo analizar: ' + msg }, 502);
  }
};
