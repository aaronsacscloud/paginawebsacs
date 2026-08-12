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

También extraes, SI Y SOLO SI las notas lo dicen, los números que alimentan la
calculadora de retorno de inversión. Nunca los inventes ni los estimes: si el
ejecutivo no anotó cuánto vende el cliente, ese campo va en null. Un ROI armado
con números inventados se cae en la primera junta y cuesta la venta.

- ventas_mes: ventas mensuales del cliente en pesos (ej. "factura 600 mil al mes" → 600000).
- sucursales: cuántas tiene.
- clientes_activos: tamaño de su base de clientes.
- ticket_promedio: ticket promedio de venta en pesos.
- stock_valor: valor del inventario en pesos.
- compras_mes: compras mensuales en pesos.
- horas_admin: horas al mes que dedica a tareas administrativas o de inventario.
- problema: UNA oración con el dolor concreto y medible que mencionó
  (ej. "Pierden 200 piezas al mes por falta de control"). null si no lo dijo.

RESPONDE ÚNICAMENTE con este JSON (sin texto adicional):

{
  "key_points": [
    { "title": "...", "detail": "..." }
  ],
  "roi": {
    "ventas_mes": null, "sucursales": null, "clientes_activos": null,
    "ticket_promedio": null, "stock_valor": null, "compras_mes": null,
    "horas_admin": null, "problema": null
  }
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

    // Los números del ROI: se aceptan solo si son positivos y finitos. Un cero
    // o un texto raro llegando al formulario prellenaría el bloque con basura y
    // el ejecutivo lo mandaría sin revisar.
    const num = (x: any) => {
      const n = typeof x === 'number' ? x : parseFloat(String(x ?? '').replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const r = parsed.roi || {};
    const roi = {
      ventas_mes: num(r.ventas_mes), sucursales: num(r.sucursales),
      clientes_activos: num(r.clientes_activos), ticket_promedio: num(r.ticket_promedio),
      stock_valor: num(r.stock_valor), compras_mes: num(r.compras_mes),
      horas_admin: num(r.horas_admin),
      problema: typeof r.problema === 'string' && r.problema.trim() ? r.problema.trim().slice(0, MAX_DETAIL) : null,
    };
    const tieneAlgo = Object.values(roi).some(v => v !== null);

    return json({ key_points, roi: tieneAlgo ? roi : null });
  } catch (err: any) {
    const msg = err?.status === 401 ? 'API key inválida' : err?.message || 'Error desconocido';
    return json({ error: `Error al procesar: ${msg}` }, 500);
  }
};
