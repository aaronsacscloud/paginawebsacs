import type { APIRoute } from 'astro';
import OpenAI from 'openai';

export const prerender = false;

const SYSTEM_PROMPT = `Eres un asistente que ayuda a un ejecutivo de ventas de SACS (plataforma POS y gestión para retailers en LatAm) a estructurar la minuta de una llamada con un prospecto.

Recibes notas raw escritas en lenguaje informal (a veces con typos, abreviaciones, fragmentos) y las conviertes en una minuta profesional con 3-8 puntos clave.

REGLAS:
- Cada punto clave tiene title (5-10 palabras) y detail (1-2 oraciones).
- title: tema concreto que se trató (ej. "Control de inventario multi-sucursal", "Migración desde Microsip").
- detail: qué dijo el cliente + cómo SACS lo resuelve, en español profesional pero cálido.
- Prioriza por importancia para el cliente.
- Mantén las palabras del cliente cuando agreguen contexto.
- NO inventes información que no esté en las notas raw.
- Si el ejecutivo escribió algo ambiguo, sé conservador en el detail.

RESPONDE ÚNICAMENTE con este JSON (sin texto adicional):

{
  "key_points": [
    { "title": "...", "detail": "..." }
  ]
}`;

function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

const MAX_POINTS = 8;
const MAX_TITLE = 80;
const MAX_DETAIL = 400;

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const raw = body?.raw;
  if (!raw || typeof raw !== 'string' || raw.trim().length < 30) {
    return json({ error: 'Las notas son muy cortas. Escribe al menos 30 caracteres.' }, 400);
  }
  if (raw.length > 20000) {
    return json({ error: 'Las notas exceden 20,000 caracteres. Acórtalas.' }, 400);
  }

  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: 'OPENAI_API_KEY no configurada.' }, 500);

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `NOTAS RAW DE LA LLAMADA:\n\n${raw.trim()}` },
      ],
    });

    const text = completion.choices[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch { return json({ error: 'La IA devolvió una respuesta inválida. Intenta de nuevo.' }, 502); }

    const key_points = Array.isArray(parsed.key_points)
      ? parsed.key_points
          .filter((kp: any) => kp && typeof kp.title === 'string' && typeof kp.detail === 'string')
          .slice(0, MAX_POINTS)
          .map((kp: any) => ({
            title: kp.title.trim().slice(0, MAX_TITLE),
            detail: kp.detail.trim().slice(0, MAX_DETAIL),
          }))
          .filter((kp: any) => kp.title.length > 0 && kp.detail.length > 0)
      : [];

    return json({ key_points });
  } catch (err: any) {
    const msg = err?.status === 401 ? 'API key inválida' : err?.message || 'Error desconocido';
    return json({ error: `Error al procesar: ${msg}` }, 500);
  }
};
