// POST /api/scheduling/reuniones/estructurar  { texto }
//
// Recibe la conversación en crudo —pegada de WhatsApp, de un transcript, o
// escrita a las carreras al colgar— y la acomoda en la minuta de cinco campos.
// De paso separa las MEJORAS que se pidieron, porque en la práctica van
// revueltas con lo demás: "y oye, ¿se podría poner el certificado con QR?" cae
// en medio de un acuerdo de cobranza y después nadie lo encuentra.
//
// Las mejoras salen como PROPUESTA, no se crean solas. Quien estuvo en la
// junta decide cuáles eran de verdad: un modelo entusiasta convertiría
// cualquier "estaría padre que…" en un compromiso con el cliente.
import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { isPartner } from '../../../../lib/scheduling/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const SYSTEM = `Acomodas la minuta de una reunión entre un consultor de SACS (plataforma de punto de venta y gestión para retail en México) y su cliente.

Recibes la conversación en crudo: puede venir de WhatsApp, de una transcripción con muletillas y frases cortadas, o escrita a las carreras. Tu trabajo es ORDENARLA, no adornarla.

REGLAS QUE NO SE ROMPEN:
- NO inventes acuerdos, fechas, montos ni compromisos. Si no está en el texto, no existe.
- Distingue lo DECIDIDO de lo propuesto. "Podríamos" no es un acuerdo; "quedamos en" sí.
- Si un campo no tiene contenido en la conversación, devuélvelo como cadena vacía. Vacío es una respuesta correcta; rellenar no.
- Respeta las palabras del cliente cuando aporten contexto. No traduzcas todo a lenguaje corporativo.
- Nada de emoji. Español de México, claro y directo.

Además separas las MEJORAS AL SISTEMA que se mencionaron: personalizaciones, plugins, módulos que quiere activar, ajustes que pidió. Van revueltas en la conversación y se pierden.

Para cada mejora:
- titulo: 3-8 palabras, concreto (ej. "Certificado digital de pieza con QR").
- descripcion: una línea que el DUEÑO entienda, no lenguaje técnico.
- categoria: "personalizacion" | "plugin" | "modulo" | "ajuste" | "capacitacion".
- valor: el monto SOLO si se dijo en la conversación. null si no se habló de dinero. Jamás lo estimes.
- interes: "alto" si el cliente lo pidió o lo empujó, "medio" si lo comentó de pasada, "bajo" si solo se le propuso.

Si no se mencionó ninguna mejora, devuelve la lista vacía.

Responde ÚNICAMENTE con este JSON:
{
  "minuta": {
    "reviso": "qué se revisó",
    "acuerdos": "lo que quedó decidido",
    "cliente": "compromisos del cliente y para cuándo",
    "sacs": "compromisos de SACS y para cuándo",
    "siguiente": "siguiente paso y fecha"
  },
  "mejoras": [
    { "titulo": "...", "descripcion": "...", "categoria": "...", "valor": null, "interes": "alto" }
  ]
}`;

const CATS = ['personalizacion', 'plugin', 'modulo', 'ajuste', 'capacitacion'];

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  if (isPartner(user)) return json({ error: 'Solo admin' }, 403);

  const b = await request.json().catch(() => ({} as any));
  const texto = String(b?.texto || '').trim();
  if (texto.length < 40) return json({ error: 'Pega la conversación completa: con tan poco texto no hay nada que acomodar.' }, 400);

  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: 'OPENAI_API_KEY no configurada.' }, 500);

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        // Se recorta a 60k caracteres: más que eso es una transcripción de
        // horas y el modelo devuelve una minuta peor, no mejor.
        { role: 'user', content: texto.slice(0, 60000) },
      ],
    });
    const out = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
    const m = out?.minuta || {};
    // Se normaliza aquí y no se confía en la forma que devolvió el modelo: un
    // campo que llega como objeto rompería el textarea que lo va a mostrar.
    const minuta = Object.fromEntries(
      ['reviso', 'acuerdos', 'cliente', 'sacs', 'siguiente'].map(k => [k, typeof m[k] === 'string' ? m[k].trim() : ''])
    );
    const mejoras = (Array.isArray(out?.mejoras) ? out.mejoras : [])
      .filter((x: any) => x && typeof x.titulo === 'string' && x.titulo.trim())
      .slice(0, 12)
      .map((x: any) => ({
        titulo: String(x.titulo).trim().slice(0, 200),
        descripcion: typeof x.descripcion === 'string' ? x.descripcion.trim() : '',
        categoria: CATS.includes(x.categoria) ? x.categoria : 'personalizacion',
        valor: Number(x.valor) > 0 ? Math.round(Number(x.valor)) : 0,
        interes: ['alto', 'medio', 'bajo'].includes(x.interes) ? x.interes : 'medio',
      }));
    return json({ minuta, mejoras });
  } catch (e: any) {
    return json({ error: 'No se pudo acomodar la conversación: ' + String(e?.message || e) }, 500);
  }
};
