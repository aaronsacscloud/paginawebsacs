// LLAMADAS INTELIGENTES · Los oídos: quién contestó, a partir de lo que se oye.
//
// Twilio transcribe en vivo lo que dice el otro lado (solo el lado del
// contacto: `inbound_track`). Cada fragmento pasa por aquí y se decide con
// REGLAS —rápidas, sin red— si contestó una persona, una grabadora de buzón,
// o el «portero»: la contestadora que pide nombre y motivo antes de pasar la
// llamada. El AMD de Twilio se usa como segunda opinión y la IA solo cuando
// las reglas no dicen nada y ya hay bastante texto.
//
// La regla de oro: ante la duda se le pasa al vendedor. Colgar por error a
// una persona cuesta el contacto; pasarle un buzón al vendedor cuesta cinco
// segundos.

export type Veredicto = 'persona' | 'buzon' | 'portero';
export type Oido = { t: number; texto: string; final: boolean };

const sinAcentos = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* El BUZÓN de voz: el saludo grabado de Telcel/AT&T/Movistar y de los
   celulares. Cualquiera de estas frases es inconfundible. */
const BUZON = [
  /buzon de voz/, /correo de voz/, /deje su mensaje/, /deja tu mensaje/, /grabe su mensaje/,
  /despues del tono/, /despues de la senal/, /al escuchar el tono/, /al sonar el tono/,
  /no esta disponible/, /no se encuentra disponible/, /se encuentra apagado/, /esta apagado/,
  /fuera del area de servicio/, /fuera de servicio/, /ha sido desconectado/,
  /el numero que usted marco/, /numero (que marco )?no existe/, /el numero que marco/, /numero marcado/, /intente mas tarde/,
  /su llamada sera transferida/, /sera transferida al buzon/, /no puede atender su llamada/,
  /no puedo contestar/, /no puedo atender/, /en este momento no/, /sistema de mensajes/,
  /please leave a message/, /voicemail/, /the person you are calling/, /at the tone/, /is not available/,
];

/* El PORTERO: un asistente automático que filtra la llamada. Pide nombre y
   motivo, y luego decide si pasa. NO es la recepcionista humana: esa es una
   persona y se le pasa al vendedor. */
const PORTERO = [
  /diga su nombre/, /digame su nombre/, /mencione su nombre/, /indique su nombre/, /dime tu nombre/,
  /nombre y (el )?motivo/, /motivo de (su|la|tu) llamada/, /razon de (su|la|tu) llamada/, /el motivo por el que/,
  /asistente (virtual|de llamadas|inteligente)/, /filtro de llamadas/, /esta siendo (filtrada|revisada|analizada)/,
  /esta usando un asistente/, /usa un asistente/, /la persona a la que llama/, /para que (le|lo) pueda atender/,
  /despues de la senal, diga/, /quien llama y por que/, /para pasar su llamada/, /le pasare su mensaje/,
  /call screening/, /who is calling and why/, /say your name/, /state your name/,
];

/* La PERSONA: lo primero que dice alguien que descuelga en México. Corto y
   coloquial. Con que aparezca al principio de lo oído, basta. */
const PERSONA_INICIO = /^(si|bueno|hola|diga|digame|alo|mande|buenas|buenos dias|buenas tardes|buenas noches|quien habla|quien es|si bueno|si diga|si digame|con quien|que paso|hey)\b/;
const PERSONA_CONTIENE = /\b(bueno|digame|mande|quien habla|quien es|con quien hablo|de parte de quien|en que le puedo (ayudar|servir)|a sus ordenes|para servirle|le puedo ayudar)\b/;

const palabras = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Decide con lo oído hasta ahora. Devuelve null si todavía no hay con qué.
 * @param oido   fragmentos en orden
 * @param ms     milisegundos desde que contestaron
 * @param amd    lo que dijo el AMD de Twilio (human / machine_* / unknown / fax), si ya llegó
 */
export function juzgar(oido: Oido[], ms: number, amd?: string | null): { veredicto: Veredicto; motivo: string } | null {
  const finales = oido.filter(o => o.final).map(o => sinAcentos(o.texto)).join(' ').trim();
  const ultimoParcial = sinAcentos([...oido].reverse().find(o => !o.final)?.texto || '');
  const todo = `${finales} ${ultimoParcial}`.trim();
  const amdMaquina = /^machine_/.test(String(amd || ''));

  if (todo) {
    for (const re of PORTERO) if (re.test(todo)) return { veredicto: 'portero', motivo: `dijo «${todo.match(re)?.[0]}»` };
    for (const re of BUZON) if (re.test(todo)) return { veredicto: 'buzon', motivo: `dijo «${todo.match(re)?.[0]}»` };
  }

  /* Persona: un arranque humano. Se pide que sea FINAL o que ya lleve un
     poco de tiempo, porque un parcial de media palabra engaña. */
  if (finales) {
    if (PERSONA_INICIO.test(finales)) return { veredicto: 'persona', motivo: `empezó con «${finales.slice(0, 40)}»` };
    if (PERSONA_CONTIENE.test(finales)) return { veredicto: 'persona', motivo: `dijo «${finales.match(PERSONA_CONTIENE)?.[0]}»` };
    /* Frase corta y sin señales de máquina —«Zapatería López»— es una persona
       que contesta con el nombre del negocio. Las grabadoras no paran de hablar. */
    if (palabras(finales) <= 8 && ms >= 1500 && !amdMaquina) return { veredicto: 'persona', motivo: 'contestó con una frase corta' };
  }
  if (!finales && ultimoParcial && PERSONA_INICIO.test(ultimoParcial) && ms >= 2500) return { veredicto: 'persona', motivo: `se oye «${ultimoParcial.slice(0, 30)}»` };

  /* Un monólogo largo sin nada humano dentro es una grabación. Se exige el
     AMD de acuerdo O un párrafo de verdad, para no confundir a una
     recepcionista platicadora. */
  if (palabras(todo) >= 22 && amdMaquina) return { veredicto: 'buzon', motivo: 'monólogo largo y el detector dice máquina' };
  if (palabras(todo) >= 40) return { veredicto: 'buzon', motivo: 'monólogo largo sin señales de persona' };

  return null;
}

/** Texto plano de lo oído, para la ficha y para la IA. */
export const textoOido = (oido: Oido[]) => oido.filter(o => o.final).map(o => o.texto).join(' ').trim();
