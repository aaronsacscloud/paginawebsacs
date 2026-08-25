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
import { pedirJSON, modeloEnUso } from '../../../../lib/ia';
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
- Los COMPROMISOS (cliente y sacs) van uno por renglón, separados con salto de línea. Cada renglón es una sola acción, empieza con verbo y no lleva guion ni número: así salen como viñetas en la minuta descargable y se pueden citar por número en el seguimiento.

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
    "cliente": "un compromiso del cliente por renglón",
    "sacs": "un compromiso de SACS por renglón",
    "siguiente": "siguiente paso y fecha"
  },
  "mejoras": [
    { "titulo": "...", "descripcion": "...", "categoria": "...", "valor": null, "interes": "alto" }
  ]
}`;

const CATS = ['personalizacion', 'plugin', 'modulo', 'ajuste', 'capacitacion'];

/* ── Modo LEAD ──────────────────────────────────────────────────────────────
   Un prospecto no tiene acuerdos que cumplir: tiene una necesidad sin precio.
   Lo que se extrae no son compromisos, son renglones cotizables — y los datos
   de la ficha que nadie captura a mano. */
const PLANES = ['vende', 'controla', 'fideliza', 'automatiza'];
const SYSTEM_LEAD = `Ordenas la reunión de descubrimiento entre un vendedor de SACS (plataforma de punto de venta, inventario multi-sucursal, lealtad e IA para retail en México) y un PROSPECTO que todavía no es cliente.

Recibes la conversación en crudo: WhatsApp, transcripción con muletillas o notas escritas a las carreras. La ordenas, no la adornas.

REGLAS QUE NO SE ROMPEN:
- NO inventes nada. Si no está en el texto, no existe. Un campo vacío es una respuesta correcta.
- Distingue lo que el prospecto PIDIÓ de lo que se le propuso. "Le enseñamos X" no es "quiere X".
- Cita sus palabras cuando aporten. No traduzcas todo a lenguaje corporativo.
- Nada de emoji. Español de México, claro y directo.

Los planes de SACS, de menor a mayor, y cada uno incluye al anterior:
- vende ($600/mes por sucursal): punto de venta, apartados con abonos, pedidos, ventas a crédito, listas de precios, tienda en línea, Instagram, Facebook, TikTok Shop, WhatsApp, kits, variantes, 20 folios de factura.
- controla ($900): inventario multi-sucursal, CEDIS, traspasos, conteo físico, kardex, órdenes de compra, mermas, metas y comisiones, 50+ reportes, costeo.
- fideliza ($1,400): monedero y puntos, niveles, portal del cliente, tarjetas de regalo, membresías, campañas por correo y WhatsApp, CRM 360.
- automatiza ($2,800): AXO copiloto de IA, workflows, alertas, reportes predictivos, agentes, API.

Extraes tres cosas:

1) La MINUTA, en siete campos:
   opera: cómo opera hoy (tiendas, canales, con qué sistema, volumen).
   duele: el problema concreto con el que llegó.
   intereso: los planes, módulos y funciones que pidió POR SU NOMBRE o describió con claridad. Es lo que hay que cotizar sí o sí.
   mostramos: lo que se le enseñó y lo que se le prometió.
   objeciones: lo que puede frenar el cierre (precio, socio, otro sistema, tiempos).
   decide: quién decide y para cuándo.
   siguiente: siguiente paso con fecha.

2) Los REQUERIMIENTOS cotizables. Cada uno:
   - titulo: 3-9 palabras, concreto, en el lenguaje del prospecto.
   - cita: la frase textual con la que lo pidió, recortada. Si lo dedujiste y no lo dijo, deja "".
   - plan: cuál de los cuatro planes lo cubre ("vende"|"controla"|"fideliza"|"automatiza"), o null si es un servicio suelto.
   - categoria: "plan" | "plugin" | "servicio" | "personalizacion" | "capacitacion".
   - incluido: true si ya viene dentro del plan que se le va a vender (entonces NO se cobra aparte).
   - deducido: true si NO lo pidió y lo estás infiriendo del contexto. Marca esto con honestidad.
   - valor: el monto SOLO si se dijo en la conversación o es precio de lista de un plan. 0 si no.

3) La FICHA: datos del negocio que salieron solos. Cada uno "" si no se mencionó.
   sucursales (número o texto corto), giro, sistema_actual, urgencia, presupuesto, usuarios.

Y plan_sugerido: el plan mínimo que cubre lo que pidió, o null si no alcanza para decidirlo.

Responde ÚNICAMENTE con este JSON:
{
  "minuta": { "opera":"", "duele":"", "intereso":"", "mostramos":"", "objeciones":"", "decide":"", "siguiente":"" },
  "requerimientos": [ { "titulo":"", "cita":"", "plan":null, "categoria":"plan", "incluido":false, "deducido":false, "valor":0 } ],
  "ficha": { "sucursales":"", "giro":"", "sistema_actual":"", "urgencia":"", "presupuesto":"", "usuarios":"" },
  "plan_sugerido": null
}`;
const CATS_LEAD = ['plan', 'plugin', 'servicio', 'personalizacion', 'capacitacion'];
const FICHA_K = ['sucursales', 'giro', 'sistema_actual', 'urgencia', 'presupuesto', 'usuarios'];

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  if (isPartner(user)) return json({ error: 'Solo admin' }, 403);

  const b = await request.json().catch(() => ({} as any));
  const texto = String(b?.texto || '').trim();
  const esLead = b?.tipo === 'lead';
  if (texto.length < 40) return json({ error: 'Pega la conversación completa: con tan poco texto no hay nada que acomodar.' }, 400);

  try {
    if (esLead) {
      const out = await pedirJSON({ system: SYSTEM_LEAD, user: texto.slice(0, 60000) });
      const m = out?.minuta || {};
      const minuta: Record<string, string> = Object.fromEntries(
        ['opera', 'duele', 'intereso', 'mostramos', 'objeciones', 'decide', 'siguiente']
          .map(k => [k, typeof m[k] === 'string' ? m[k].trim() : ''])
      );
      minuta.tipo = 'lead';
      const requerimientos = (Array.isArray(out?.requerimientos) ? out.requerimientos : [])
        .filter((x: any) => x && typeof x.titulo === 'string' && x.titulo.trim())
        .slice(0, 14)
        .map((x: any) => ({
          titulo: String(x.titulo).trim().slice(0, 200),
          cita: typeof x.cita === 'string' ? x.cita.trim().slice(0, 400) : '',
          plan: PLANES.includes(x.plan) ? x.plan : null,
          categoria: CATS_LEAD.includes(x.categoria) ? x.categoria : 'servicio',
          incluido: x.incluido === true,
          // Lo deducido entra APAGADO: un supuesto no puede subir de categoría a
          // requerimiento sin que alguien que estuvo en la junta lo confirme.
          deducido: x.deducido === true,
          incluir: x.deducido !== true,
          valor: Number(x.valor) > 0 ? Math.round(Number(x.valor)) : 0,
        }));
      const f = out?.ficha || {};
      const ficha = Object.fromEntries(FICHA_K.map(k => [k, typeof f[k] === 'string' ? f[k].trim().slice(0, 120) : '']));
      const plan_sugerido = PLANES.includes(out?.plan_sugerido) ? out.plan_sugerido : null;
      return json({ minuta, requerimientos, ficha, plan_sugerido, modelo: modeloEnUso() });
    }

    // Se recorta a 60k caracteres: más que eso es una transcripción de horas y
    // el modelo devuelve una minuta peor, no mejor.
    const out = await pedirJSON({ system: SYSTEM, user: texto.slice(0, 60000) });

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
    return json({ minuta, mejoras, modelo: modeloEnUso() });
  } catch (e: any) {
    return json({ error: 'No se pudo acomodar la conversación: ' + String(e?.message || e) }, 500);
  }
};
