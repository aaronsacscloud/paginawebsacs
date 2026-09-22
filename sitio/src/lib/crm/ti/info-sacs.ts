/* ══ MEJORA CRM #3 · «¿ME PUEDEN MANDAR MÁS INFORMACIÓN?» (22-sep-2026) ═══════
 *
 * Pedido del dueño: cuando el prospecto pide más información de Sacs —con las
 * palabras que sea— el agente lo detecta y le manda, sin que intervenga nadie
 * y sin esperar a que pida un PDF o una liga:
 *   · un mensaje PERSONALIZADO (su nombre, su giro, lo que preguntó),
 *   · la liga a www.sacscloud.com,
 *   · y el PDF con lo que resuelve Sacs.
 *
 * Cómo se detecta: dos redes. (1) Una regla de frases, antes de llamar al
 * modelo, que es la que hace que el mensaje se escriba ya pensando en el PDF.
 * (2) El propio agente marca `pide_info` en su salida cuando la intención
 * viene dicha de otra forma que la regla no conoce. Cualquiera de las dos
 * basta para que el PDF salga.
 *
 * Cómo se manda: con la ventana de 24 h abierta (lo normal: acaba de
 * escribir), texto + documento, sin plantilla. Si la respuesta sale con la
 * ventana cerrada, el despachador usa la familia de plantillas `info`
 * (Marketing con el PDF de encabezado → si Meta no la acepta o no la
 * entrega, la Utility con el mismo PDF). Ver `plantillas-agente.ts`.
 */
import { supabase } from '../../supabase';
import { PDF_INFO_SACS } from './plantillas-agente';

export const LIGA_SACS = 'https://www.sacscloud.com';

/* Las formas de pedirlo. Van por familias para que se lean:
   «más información / info / informes», «conocer / saber más», «más detalles»,
   «de qué se trata», «dónde veo…», y los nombres del papel (folleto, catálogo,
   brochure, presentación). */
const PIDE_INFO_RE = new RegExp([
  String.raw`\b(m[aá]s\s+)?(informaci[oó]n|info|informes)\b`,
  String.raw`\b(conocer|saber)\s+(un\s+poco\s+)?m[aá]s\b`,
  String.raw`\bm[aá]s\s+detalles?\b`,
  String.raw`\bde\s+qu[eé]\s+(se\s+)?trata\b`,
  String.raw`\bd[oó]nde\s+(puedo\s+)?(ver|checar|revisar|conocer)\b`,
  String.raw`\b(folleto|brochure|cat[aá]logo|presentaci[oó]n)\b`,
].join('|'), 'i');
/* Lo que se parece pero no es pedir: agradecer la que ya se le mandó, o decir
   que ya la vio. Ahí mandarle otra vez el PDF es exactamente la respuesta
   automática que el dueño no quiere. */
const NO_ES_PEDIR_RE = /gracias\s+por\s+(la\s+)?(info|informaci[oó]n)|ya\s+(vi|le[ií]|revis[eé]|tengo|recib[ií])\s+(la\s+)?(info|informaci[oó]n|el\s+pdf|el\s+folleto)/i;

export function pideInformacion(texto?: string | null): boolean {
  const t = String(texto || '').trim();
  if (!t || NO_ES_PEDIR_RE.test(t)) return false;
  return PIDE_INFO_RE.test(t);
}

/** ¿Ya se le mandó el PDF hace poco? Evita que una ráfaga («info» · «porfa» · «del sistema») lo mande dos veces. */
export async function yaSeLeMandoInfo(contactId: string, horas = 72): Promise<boolean> {
  const desde = new Date(Date.now() - horas * 3600e3).toISOString();
  const { data } = await supabase.from('ti_envios').select('id')
    .eq('contact_id', contactId).eq('salida->>info_sacs', 'true')
    .in('estado', ['pendiente', 'enviando', 'enviado', 'sugerencia']).gte('created_at', desde).limit(1);
  return (data || []).length > 0;
}

/** Lo que se le dice al agente para que su mensaje ya cuente con el PDF y la liga. */
export function notaInfo(loQueDijo: string): string {
  return `EL LEAD PIDE MÁS INFORMACIÓN DE SACS (lo dijo así: «${String(loQueDijo).slice(0, 160)}»).
Esta vez SÍ se la mandas, sin preguntarle si la quiere: junto con tu mensaje sale SOLO un PDF con lo que resuelve Sacs en tiendas y marcas de moda (no lo pongas en "adjuntos": ya va).
Tu mensaje:
1) Personalizado de verdad: su nombre si lo sabes y amarrado a lo que sabemos de él (giro, tiendas, ciudad, lo que preguntó). Si no sabemos nada, di en UNA línea qué es Sacs con palabras de tienda de moda (inventario por talla y color, punto de venta, tienda en línea).
2) Dile que ahí le mandas el PDF con lo principal y que todo a detalle está en ${LIGA_SACS} (la liga tal cual).
3) Cierra con UNA pregunta fácil que avance: qué vende, cuántas tiendas maneja, o si quiere verlo 15 minutos con sus productos en pantalla.
Máximo 4 renglones. Que no suene a respuesta automática ni a folleto.`;
}

/** El PDF como adjunto del envío (misma forma que los de la galería). */
export const adjuntoInfo = () => ({ id: 'info_sacs_pdf', tipo: 'document' as const, url: PDF_INFO_SACS.url, nombre: PDF_INFO_SACS.archivo, por_que: 'pidió más información' });

/** Garantía de la liga: si el modelo no la puso, se agrega al final. */
export function conLiga(mensaje: string): string {
  const m = String(mensaje || '').trim();
  return /sacscloud\.com/i.test(m) ? m : `${m}\n\nTodo a detalle en ${LIGA_SACS}`;
}
