// LEADS · La etapa se DERIVA de hechos, no de una casilla que alguien palomeó.
//
// PURO: sin BD y sin red, para poder probarlo de verdad.
//
// La regla de oro es que la etapa capturada a mano solo puede ADELANTAR, nunca
// retroceder. Medido en producción antes de escribir esto: 0 de 105 leads
// tenían próximo paso, 0 tenían dueño y había 2 llamadas registradas en total.
// Con esos números, una etapa que dependa de que alguien la mueva deja los 105
// leads en "Nuevo" para siempre — un embudo falso es peor que no tener embudo.
// Lo que sí sabe el vendedor y no el sistema (que ya está negociando) se captura;
// lo demás sale de que el hecho exista.

export const ETAPAS = [
  'nuevo', 'contactado', 'calificado', 'agendado',
  'demo_hecha', 'cotizado', 'negociando', 'cliente', 'perdido',
] as const;
export type Etapa = typeof ETAPAS[number];

export const ETAPA_LABEL: Record<Etapa, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', calificado: 'Calificado', agendado: 'Agendado',
  demo_hecha: 'Demo hecha', cotizado: 'Cotizado', negociando: 'Negociando',
  cliente: 'Cliente', perdido: 'Perdido',
};

/** Orden de avance. `perdido` y `cliente` son finales y no compiten entre sí. */
const ORDEN: Record<Etapa, number> = {
  nuevo: 0, contactado: 1, calificado: 2, agendado: 3,
  demo_hecha: 4, cotizado: 5, negociando: 6, cliente: 7, perdido: 7,
};

/** Las dos únicas que un humano puede poner a mano: son lo que sabe el
 *  vendedor y el sistema no. El resto lo dicen los hechos. */
export const ETAPAS_MANUALES: Etapa[] = ['calificado', 'negociando'];

export type HechosLead = {
  lifecycle_stage?: string | null;
  calificacion?: string | null;
  desenlace?: string | null;
  /** Cualquier toque SALIENTE: llamada, whatsapp o correo enviado. */
  toques?: number;
  last_contact_at?: string | null;
  /** Reuniones con su estado ya normalizado (asistio | confirmada | cancelada…). */
  reuniones?: Array<{ estado?: string | null; fecha?: string | null }>;
  cotizaciones?: number;
  etapa_manual?: string | null;
};

const esAsistio = (e?: string | null) => String(e || '').toLowerCase().startsWith('asisti');

/**
 * Etapa real del lead: la MÁS AVANZADA entre la que dicen los hechos y la que
 * alguien capturó. Si el lead está descartado o ya se cerró con un desenlace
 * que no es "ganado", manda `perdido` — ahí sí retrocede, porque cerrar es una
 * decisión humana explícita y no un descuido.
 */
export function etapaDeLead(h: HechosLead): { etapa: Etapa; porHechos: Etapa; manual: Etapa | null; hitos: Partial<Record<Etapa, boolean>> } {
  // Qué peldaños OCURRIERON de verdad, uno por uno. Un lead puede saltarse
  // pasos —hay quien llega directo a cotización sin que nadie lo llame— y un
  // stepper que palomea todo lo anterior estaría inventando una historia que no
  // pasó. Caso real: una lead con dos cotizaciones, cero llamadas y cero demos
  // aparecía con "Contactado" y "Demo hecha" en verde.
  const reus0 = h.reuniones || [];
  const hitos: Partial<Record<Etapa, boolean>> = {
    nuevo: true,
    contactado: (h.toques || 0) > 0 || !!h.last_contact_at,
    calificado: h.calificacion === 'bueno',
    agendado: reus0.length > 0,
    demo_hecha: reus0.some(r => esAsistio(r.estado)),
    cotizado: (h.cotizaciones || 0) > 0,
    negociando: h.etapa_manual === 'negociando',
    cliente: h.lifecycle_stage === 'cliente',
  };
  if (h.lifecycle_stage === 'cliente') return { etapa: 'cliente', porHechos: 'cliente', manual: null, hitos };

  let porHechos: Etapa = 'nuevo';
  const sube = (e: Etapa) => { if (ORDEN[e] > ORDEN[porHechos]) porHechos = e; };

  if ((h.toques || 0) > 0 || h.last_contact_at) sube('contactado');
  if (h.calificacion === 'bueno') sube('calificado');
  const reus = h.reuniones || [];
  if (reus.length) sube('agendado');
  if (reus.some(r => esAsistio(r.estado))) sube('demo_hecha');
  if ((h.cotizaciones || 0) > 0) sube('cotizado');

  const manual = (ETAPAS_MANUALES as string[]).includes(String(h.etapa_manual)) ? (h.etapa_manual as Etapa) : null;
  let etapa = manual && ORDEN[manual] > ORDEN[porHechos] ? manual : porHechos;

  // Cerrar SÍ puede retroceder: es una decisión humana explícita.
  if (h.lifecycle_stage === 'churned' || h.calificacion === 'no_califica' || (h.desenlace && h.desenlace !== 'ganado')) {
    etapa = 'perdido';
  }
  return { etapa, porHechos, manual, hitos };
}

/** Lo que falta para el siguiente peldaño, en una frase. Sirve para que la
 *  ficha diga qué hacer en vez de solo dónde está. */
export function siguientePaso(etapa: Etapa): string | null {
  switch (etapa) {
    case 'nuevo': return 'Llámale o mándale WhatsApp: la etapa avanza sola con el primer toque.';
    case 'contactado': return 'Decide si califica. Es lo único de aquí que se marca a mano.';
    case 'calificado': return 'Agéndale una demo: al crearse la reunión, la etapa avanza sola.';
    case 'agendado': return 'Cierra la reunión como asistió o no asistió cuando pase.';
    case 'demo_hecha': return 'Mándale la cotización: al existir, la etapa avanza sola.';
    case 'cotizado': return 'Si ya están negociando, márcalo — eso el sistema no lo puede saber.';
    case 'negociando': return 'Al pagar la cotización se vuelve cliente solo.';
    default: return null;
  }
}
