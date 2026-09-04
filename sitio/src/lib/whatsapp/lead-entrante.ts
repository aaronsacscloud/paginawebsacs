/**
 * EL LEAD QUE LLEGA POR WHATSAPP DESDE LA WEB (decisión del dueño, 2026-09-04).
 *
 * Caso real que lo destapó: alguien entra a sacscloud.com/prueba-gratis, el botón abre WhatsApp con el mensaje
 * «Hola 👋 Quiero solicitar una prueba gratis de SACS, por favor», lo manda… y no pasaba NADA. La conversación
 * se creaba huérfana (`wa_conversaciones.contact_id = null`) porque `ligarContacto` solo BUSCA un contacto
 * existente por teléfono, nunca lo crea. Y el agente trabaja sobre contactos: sin contacto, ni lo veía. Eran los
 * leads más calientes que hay —piden prueba o demo— y se quedaban sin respuesta.
 *
 * Aquí se crea el contacto en cuanto escribe un número desconocido, se le detecta la INTENCIÓN con la que llegó
 * (la web manda un texto distinto por botón) y se guarda de dónde vino, para que el agente conteste con la
 * secuencia que le toca y quede la atribución.
 */
import { supabase } from '../supabase';
import { telefonoWhatsApp } from '../telefono';

export type Intencion = 'prueba_gratis' | 'demo' | 'info' | 'precios' | 'partners' | 'otro';

export const INTENCIONES: Record<Intencion, { label: string; secuencia: string }> = {
  prueba_gratis: { label: 'Pide prueba gratis',
    secuencia: `Viene de la página de prueba gratis: YA decidió probar, no hay que convencerlo. Este primer mensaje hace tres cosas y nada más (decisión del dueño, 4-sep):
1) Confirma en media línea que sí se la damos.
2) Pregunta, en una sola línea y como un solo bloque, QUÉ VENDE (ropa, calzado, joyería) y CUÁNTAS TIENDAS o sucursales maneja: con eso se le deja configurada a su medida y no genérica.
3) Le pone las DOS opciones en dos renglones cortos y le pregunta cuál prefiere:
   · la prueba por su cuenta, con su cuenta lista y sus funciones activadas;
   · o una demo con un especialista, menos de una hora, donde se le muestra todo funcionando con SUS flujos y sus productos.
Cierra preguntando cuál de las dos le acomoda. Nada de precios ni de folleto aquí. El correo y el nombre de la tienda se piden hasta el mensaje siguiente, cuando ya haya elegido.` },
  demo: { label: 'Quiere agendar demo',
    secuencia: `Viene de la página a pedir demo: quiere verlo, no que le expliquen. Este primer mensaje:
1) Confirma que se la agendas.
2) Pregunta, en una sola línea, qué vende y cuántas tiendas maneja, para que la demo sea con SUS flujos y no una genérica.
3) Menciona en un renglón que la demo con el especialista dura menos de una hora y ahí se ve todo funcionando con lo suyo; y que si prefiere empezar probándolo por su cuenta, también se le puede dejar la prueba lista.
Cierra preguntando qué prefiere, o proponiendo dos horarios concretos si ya sabes qué vende y cuántas tiendas tiene.` },
  info: { label: 'Pide información',
    secuencia: 'Pidió información desde la web. No le sueltes el folleto: pregúntale qué vende y qué es lo que más le está costando hoy, y con eso dale UNA respuesta que le sirva.' },
  precios: { label: 'Pregunta precios',
    secuencia: 'Llega preguntando precio. Dáselo, pero el que le aplica: pregunta primero cuántas tiendas maneja si no lo sabes, y da el plan que le toca, no la lista completa.' },
  partners: { label: 'Programa de partners',
    secuencia: 'Pregunta por el programa de partners: NO es un lead de tienda. Pásalo con una persona (escalar) en vez de venderle Sacs.' },
  // Lo que sigue DESPUÉS de que elige (el agente lo aplica solo, leyendo el hilo):
  //   eligió prueba → pide correo y nombre de la tienda, la deja activada con las funciones de su giro y le avisa;
  //                   y le ofrece igual 15 minutos con un consultor para arrancarla sin perderse.
  //   eligió demo   → propone DOS horarios concretos y confirma con quién será.
  otro: { label: 'Escribió por su cuenta',
    secuencia: 'Escribió por su cuenta, sin venir de un botón de la web. Contesta lo que preguntó y averigua qué vende.' },
};

/** Qué quería el que escribió, según el texto con el que la web abre WhatsApp. */
export function intencionDeMensaje(texto: string): { intencion: Intencion; url: string | null; ref: string | null } {
  const t = String(texto || '').toLowerCase();
  const url = (String(texto || '').match(/https?:\/\/[^\s]+/) || [])[0] || null;
  const ref = (String(texto || '').match(/referido por:\s*([^\n)]+)/i) || [])[1]?.trim() || null;
  const intencion: Intencion =
    /programa de partners|ser partner|socio comercial/.test(t) ? 'partners'
    : /prueba (gratis|gratuita)|solicitar una prueba|probar sacs/.test(t) ? 'prueba_gratis'
    : /agendar (una )?demo|demo con un asesor|quiero (una )?demo|me interesa agendar/.test(t) ? 'demo'
    : /precio|cu[aá]nto cuesta|costo|planes?\b|mensualidad/.test(t) ? 'precios'
    : /informaci[oó]n|informes|saber m[aá]s|conocer m[aá]s/.test(t) ? 'info'
    : 'otro';
  return { intencion, url, ref };
}

const NOMBRE_GENERICO = /^(hola|buen|hi|hey|\+?\d)/i;

/**
 * Se asegura de que la conversación tenga contacto: si el número es desconocido, CREA el lead con lo que se
 * sabe (nombre del perfil de WhatsApp, intención, de qué página venía). Devuelve el contact_id o null.
 * Idempotente: si la conversación ya tiene contacto, no toca nada.
 */
export async function asegurarContactoDeConversacion(o: {
  conversationId: string; telefono: string; texto?: string | null; nombrePerfil?: string | null;
}): Promise<{ contactId: string | null; creado: boolean; intencion?: Intencion }> {
  const e164 = telefonoWhatsApp(o.telefono) || String(o.telefono || '').trim();
  if (!e164) return { contactId: null, creado: false };

  const { data: conv } = await supabase.from('wa_conversaciones').select('id, contact_id, interna').eq('id', o.conversationId).maybeSingle();
  if (!conv || conv.interna) return { contactId: conv?.contact_id || null, creado: false };
  if (conv.contact_id) return { contactId: conv.contact_id, creado: false };

  // Pudo crearse el contacto por otro lado (formulario, importación) entre el primer mensaje y este.
  const { data: ya } = await supabase.from('contacts').select('id, company_id').eq('whatsapp', e164).limit(1).maybeSingle();
  if (ya) {
    await supabase.from('wa_conversaciones').update({ contact_id: ya.id, company_id: ya.company_id }).eq('id', o.conversationId);
    return { contactId: ya.id, creado: false };
  }

  const { intencion, url, ref } = intencionDeMensaje(o.texto || '');
  const perfil = String(o.nombrePerfil || '').trim();
  const nombre = perfil && !NOMBRE_GENERICO.test(perfil) ? perfil.slice(0, 80) : `WhatsApp ${e164.slice(-4)}`;
  const deLaWeb = intencion !== 'otro' || !!url;

  const { data: nuevo, error } = await supabase.from('contacts').insert({
    nombre, whatsapp: e164, lifecycle_stage: 'lead',
    fuente: deLaWeb ? 'whatsapp_web' : 'whatsapp',
    utm_source: deLaWeb ? 'sitio_web' : null,
    propiedades: {
      intencion_inicial: intencion,
      mensaje_inicial: String(o.texto || '').slice(0, 400) || null,
      url_origen: url, referido_por: ref,
      creado_por: 'whatsapp_entrante', creado_at: new Date().toISOString(),
    },
  }).select('id, company_id').single();
  if (error || !nuevo) return { contactId: null, creado: false };

  await supabase.from('wa_conversaciones').update({ contact_id: nuevo.id }).eq('id', o.conversationId);
  await supabase.from('ia_log').insert({ accion: 'lead_entrante_creado', contact_id: nuevo.id, razon: `${INTENCIONES[intencion].label}${ref ? ` · referido por ${ref}` : ''}`, contenido: String(o.texto || '').slice(0, 400), detalle: { telefono: e164, intencion, url, ref, nombre_perfil: perfil || null } }).then(() => {}, () => {});
  await supabase.from('activities').insert({ contact_id: nuevo.id, tipo: 'nota', titulo: `Lead nuevo por WhatsApp: ${INTENCIONES[intencion].label}`, descripcion: String(o.texto || '').slice(0, 600), automatico: true }).then(() => {}, () => {});
  return { contactId: nuevo.id, creado: true, intencion };
}

/** La nota que se le pasa al agente cuando el lead llegó por un botón de la web y es su primer turno. */
export async function notaDeIntencion(contactId: string): Promise<string | null> {
  const { data } = await supabase.from('contacts').select('propiedades').eq('id', contactId).maybeSingle();
  const p: any = (data as any)?.propiedades || {};
  const i: Intencion = p.intencion_inicial;
  if (!i || !INTENCIONES[i] || i === 'otro') return null;
  // Solo aplica al primer turno: si ya hubo ida y vuelta, el hilo manda.
  const { count } = await supabase.from('ti_envios').select('id', { count: 'exact', head: true }).eq('contact_id', contactId).in('estado', ['enviado', 'sugerencia', 'pendiente']);
  if ((count || 0) > 1) return null;
  return `LLEGÓ DESDE LA PÁGINA: ${INTENCIONES[i].label}.${p.url_origen ? ` Venía de ${p.url_origen}.` : ''}${p.referido_por ? ` Referido por ${p.referido_por}.` : ''}\n${INTENCIONES[i].secuencia}`;
}
