import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { getCurrentUser } from '../../../lib/auth/scope';
import { PLAN_PRICES } from '../../../lib/quotes/constants';

export const prerender = false;

// IA drafter para el PORTAL DEL PARTNER: pega la transcripción/notas de su
// llamada y devuelve un BORRADOR de cotización (items + minuta + roi + condiciones).
// REGLA DE ORO (igual que el agente quote_drafter del admin): NUNCA confiar en
// precios del LLM — los planes se recalculan server-side contra PLAN_PRICES y
// todo lo demás se sanitiza con límites duros.

const SYSTEM_PROMPT = `Eres un ejecutivo de ventas senior de SACS (software de punto de venta e inventarios para retail en México). Analiza la transcripción/notas de una llamada con un prospecto y produce un borrador de cotización en JSON.

PLANES DISPONIBLES (los únicos, no inventes otros):
- "vende" (POS básico), "controla" (POS + inventarios, el más común), "fideliza" (+ lealtad/marketing), "automatiza" (+ IA/automatización, enterprise)

Responde SOLO este JSON:
{
  "empresa": "nombre del negocio si se menciona, o null",
  "contacto": "nombre de la persona si se menciona, o null",
  "giro": "giro del negocio en 1-3 palabras si se detecta (ej. zapatería, farmacia), o null",
  "items": [
    {"tipo":"plan","nombre":"controla","sucursales":2,"descuento_pct":0},
    {"tipo":"extra","nombre":"Migración de datos","precio":3500,"recurrente":false,"periodo_extra":"unico","descripcion":"..."}
  ],
  "key_points": [{"title":"...","detail":"..."}],
  "roi": {"problema":"...","ahorro_mensual":15000,"detalle":"..."} | null,
  "condiciones": "términos relevantes mencionados o null",
  "descuento_global": 0
}

Reglas:
- Elige UN plan acorde al tamaño/necesidad; sucursales = las mencionadas (default 1).
- Extras SOLO si la llamada los justifica (hardware, migración, capacitación, consultoría). Usa precios mencionados en la llamada; si no hay precio, usa 0 para que el partner lo ponga.
- key_points: 3-6 puntos concretos de lo que dijo el cliente (dolores, contexto, acuerdos).
- roi solo si el cliente mencionó pérdidas/costos cuantificables; sé conservador.
- descuento_global máximo 15.`;

const clamp = (n: any, min: number, max: number) => Math.min(max, Math.max(min, Number(n) || 0));
const str = (s: any, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

function sanitize(draft: any) {
  const out: any = {
    empresa: str(draft?.empresa, 80) || '',
    contacto: str(draft?.contacto, 80) || '',
    giro: str(draft?.giro, 40) || '',
    items: [] as any[],
    key_points: [] as any[],
    roi: null as any,
    condiciones: str(draft?.condiciones, 600) || '',
    descuento_global: clamp(draft?.descuento_global, 0, 15),
  };

  for (const it of Array.isArray(draft?.items) ? draft.items.slice(0, 10) : []) {
    if (it?.tipo === 'plan') {
      const nombre = String(it.nombre || '').toLowerCase();
      if (!(nombre in PLAN_PRICES)) continue; // plan no reconocido → fuera
      const sucursales = Math.round(clamp(it.sucursales, 1, 50));
      const desc = clamp(it.descuento_pct, 0, 15);
      // Precio SIEMPRE del catálogo — jamás del LLM
      const base = PLAN_PRICES[nombre] * sucursales;
      const subtotal = Math.round(base * (1 - desc / 100));
      out.items.push({
        tipo: 'plan', nombre, sucursales, periodo: 'mensual', descuento_pct: desc,
        precio_unitario: PLAN_PRICES[nombre], subtotal, monto: subtotal,
        recurrente: true, periodo_extra: 'mensual',
        descripcion: `Plan ${nombre.charAt(0).toUpperCase() + nombre.slice(1)} · ${sucursales} sucursal${sucursales > 1 ? 'es' : ''}`,
      });
    } else if (it?.tipo === 'extra') {
      const nombre = str(it.nombre, 80);
      if (!nombre) continue;
      const precio = clamp(it.precio, 0, 500000);
      const recurrente = !!it.recurrente;
      const periodo = ['unico', 'mensual', 'anual'].includes(it.periodo_extra) ? it.periodo_extra : (recurrente ? 'mensual' : 'unico');
      out.items.push({
        tipo: 'extra', nombre, precio_unitario: precio, monto: precio, subtotal: precio,
        recurrente, periodo_extra: recurrente && periodo === 'unico' ? 'mensual' : periodo,
        descripcion: str(it.descripcion, 200),
      });
    }
  }

  for (const kp of Array.isArray(draft?.key_points) ? draft.key_points.slice(0, 6) : []) {
    const title = str(kp?.title, 80);
    const detail = str(kp?.detail, 300);
    if (title || detail) out.key_points.push({ title, detail });
  }

  if (draft?.roi && (draft.roi.problema || draft.roi.ahorro_mensual)) {
    const ahorro = clamp(draft.roi.ahorro_mensual, 0, 1000000);
    out.roi = {
      problema: str(draft.roi.problema, 200),
      ahorro_mensual: ahorro,
      ahorro_anual: ahorro * 12,
      detalle: str(draft.roi.detalle, 300),
    };
  }

  return out;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 401 });

  let body: any = {};
  try { body = await request.json(); } catch (e) { /* body inválido */ }
  const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
  if (transcript.length < 80) {
    return new Response(JSON.stringify({ error: 'Pega al menos unas líneas de la llamada (mínimo 80 caracteres).' }), { status: 400 });
  }

  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'IA no configurada' }), { status: 503 });

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `TRANSCRIPCIÓN/NOTAS DE LA LLAMADA:\n\n${transcript.slice(0, 30000)}` },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch (e) { /* JSON inválido del LLM */ }
    const draft = sanitize(parsed);
    if (!draft.items.length && !draft.key_points.length) {
      return new Response(JSON.stringify({ error: 'No pude extraer una propuesta de esas notas. Agrega más detalle (qué necesita, cuántas sucursales, qué le duele).' }), { status: 422 });
    }
    return new Response(JSON.stringify({ draft }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[draft-quote] error:', e);
    return new Response(JSON.stringify({ error: 'Error al procesar con IA. Intenta de nuevo.' }), { status: 500 });
  }
};
