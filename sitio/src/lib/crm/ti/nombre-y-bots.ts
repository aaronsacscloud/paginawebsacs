/**
 * EL NOMBRE Y LOS MENSAJES DE BOT (decisión del dueño, 2026-09-05).
 *
 * Dos cosas que ensuciaban los mensajes:
 *
 * 1. El NOMBRE. Llamar a alguien por su nombre al inicio cambia el mensaje, pero solo si el nombre es de verdad:
 *    en la base hay «Contacto 6917», «WhatsApp 3669», «G», marcas y teléfonos metidos en el campo nombre. Escribir
 *    «Hola G» es peor que no saludar. Y usarlo en TODOS los mensajes suena a robot: se usa en los dos primeros
 *    nuestros y después se deja de usar.
 *
 * 2. Los MENSAJES DE BOT DEL LEAD. Muchas tiendas tienen su propia respuesta automática («Gracias por escribir a
 *    …, en breve te atendemos», «Nuestro horario es…»). Eso NO es una respuesta suya: si el agente lo lee como si
 *    lo hubiera escrito la persona, contesta cosas absurdas y da por hecho que hay conversación. Se marcan y no
 *    cuentan: el siguiente mensaje se arma con lo último que sí escribió una persona.
 */

const PLACEHOLDER = /^(contacto|whatsapp|wa|lead|cliente|prospecto|usuario|sin nombre|desconocid|prueba|test)\b/i;
// «BOUTIQUE LA ESQUINA S.A.» es marca; «MARIA FERNANDA» es un nombre gritado y sí sirve (se recapitaliza).
const MARCA = /(\bS\.?A\.?\b|\bS\.?R\.?L\b|&|\bboutique\b|\btienda\b|\bshop\b|\bstore\b|\bmodas?\b|\bcomercializadora\b)/i;
const TITULO = /^(sr|sra|srta|lic|ing|dr|dra|mtro|mtra)\.?$/i;

/** ¿Se le puede llamar por su nombre sin que suene raro? Devuelve el nombre de pila listo para usar, o null. */
export function nombreUsable(nombre?: string | null): string | null {
  const bruto = String(nombre || '').trim();
  if (!bruto || PLACEHOLDER.test(bruto)) return null;
  if (/\d/.test(bruto)) return null;                      // «Mama2 L», «Cliente 45»: no
  if (MARCA.test(bruto)) return null;                     // es la razón social, no la persona
  if (bruto.split(/\s+/).length >= 4) return null;        // cuatro palabras o más: es un nombre de negocio
  // Si empieza con tratamiento («Sr Ramírez»), el nombre útil es el siguiente.
  const partes = bruto.split(/\s+/).filter(x => !TITULO.test(x));
  const primero = (partes[0] || '').replace(/[^\p{L}'´-]/gu, '');
  if (primero.length < 3) return null;                    // «G», «Im», iniciales
  if (!/^[\p{L}]/u.test(primero)) return null;
  // Capitalización decente: «MARIA» → «Maria», «maria» → «Maria»
  return primero[0].toUpperCase() + primero.slice(1).toLowerCase();
}

/* ── Mensajes automáticos del lado del lead ── */
const SENALES_BOT: RegExp[] = [
  /gracias por (escribir|contactar|comunicarte|tu mensaje)/i,
  /en (breve|un momento|unos minutos) (te|le) (atendemos|contactamos|respondemos|contestamos)/i,
  /(nuestro|el) horario de (atenci[oó]n|servicio)/i,
  /este es un mensaje autom[aá]tico/i,
  /(respuesta|mensaje) autom[aá]tic[oa]/i,
  /bienvenid[oa] a\b.{0,40}(tienda|boutique|shop|store)/i,
  /(uno de nuestros|un) asesor(es)? (te|le) (contactar[aá]|atender[aá])/i,
  /escribe (el n[uú]mero|una opci[oó]n|1 para)/i,
  /men[uú] de opciones/i,
  /(estamos|seguimos) (fuera de|cerrados)/i,
  /para agilizar tu (compra|pedido|atenci[oó]n)/i,
  /(cat[aá]logo|precios) (en|por) (nuestro|el) (link|enlace|sitio)/i,
];
/** Un mensaje del lead que en realidad lo mandó su bot. */
export function esMensajeDeBot(texto?: string | null): boolean {
  const t = String(texto || '').trim();
  if (t.length < 12) return false;
  if (SENALES_BOT.some(r => r.test(t))) return true;
  // Menú numerado con varias opciones: casi siempre es un bot.
  if ((t.match(/^\s*[1-9][).\-]\s+/gm) || []).length >= 3) return true;
  return false;
}

/**
 * Marca en el hilo qué mensajes entrantes son del bot del lead y dice cuál fue el último que sí escribió una
 * persona. Los repetidos idénticos también se marcan: un bot manda siempre lo mismo.
 */
export function limpiarHilo(msjs: { direccion: string; cuerpo?: string | null; created_at?: string }[]) {
  const vistos = new Map<string, number>();
  const marcados = msjs.map(m => {
    const t = String(m.cuerpo || '').trim();
    if (m.direccion !== 'entrante' || !t) return { ...m, bot: false };
    const clave = t.toLowerCase().slice(0, 120);
    const veces = (vistos.get(clave) || 0) + 1; vistos.set(clave, veces);
    return { ...m, bot: esMensajeDeBot(t) || (veces > 1 && t.length > 40) };
  });
  const humanos = marcados.filter(m => m.direccion === 'entrante' && !m.bot);
  return { msjs: marcados, ultimoHumano: humanos.length ? humanos[humanos.length - 1] : null, bots: marcados.filter(m => m.bot).length, huboHumano: humanos.length > 0 };
}

/** La instrucción sobre el nombre para el prompt: si se usa, cómo y por qué no. */
export function bloqueNombre(nombre: string | null, vecesUsado: number): string {
  if (!nombre) return '\n\nSU NOMBRE: no tenemos un nombre confiable (viene un teléfono, una marca o un placeholder). NO inventes uno ni escribas «Hola» seco con un nombre raro: entra directo al mensaje.';
  if (vecesUsado >= 2) return `\n\nSU NOMBRE es ${nombre}, pero YA se lo dijimos ${vecesUsado} veces en mensajes anteriores: esta vez NO lo uses, ya sonaría a robot. Entra directo.`;
  return `\n\nSU NOMBRE es ${nombre} y es la primera o segunda vez que le escribimos: úsalo al inicio, natural, variando la forma («Hola ${nombre}», «${nombre}, …», «Qué tal ${nombre}»). Una sola vez en todo el mensaje.`;
}

/**
 * CÓMO SALUDA UNA PERSONA (decisión del dueño, 5-sep, y medido en los mensajes reales del equipo).
 * De 1 988 mensajes con los que el equipo REABRIÓ una conversación después de más de 20 h:
 *   · 80 % saluda («Hola Ana»)   · 54 % pregunta cómo está   · 72 % usa saltos de línea   · 176 caracteres de media.
 * En cambio, dentro del mismo día nadie vuelve a saludar: se sigue la plática.
 */
export function bloqueSaludo(horasDesdeUltimo: number | null, nombre: string | null, vecesNombre: number, dentroDePlantilla = false): string {
  const h = horasDesdeUltimo ?? 999;
  // Un toque de silencio viaja DENTRO de una plantilla que ya trae «Hola {{1}},»: saludar otra vez lo duplica y
  // además el texto tiene que caber en una línea. Ahí no se saluda (lo cazó el árbitro, 5-sep).
  if (dentroDePlantilla) return '\n\nSALUDO: este texto va DENTRO de una plantilla que ya saluda por su nombre. NO saludes ni preguntes cómo está: entra directo al ángulo, en una sola línea.';
  const conNombre = nombre && vecesNombre < 2 ? nombre : null;
  if (h < 20) {
    return '\n\nSALUDO: siguen en la misma plática (menos de un día). NO saludes ni preguntes cómo está: se siente robótico. Entra directo a lo que sigue.';
  }
  const ej = conNombre
    ? `«Hola ${conNombre}, ¿cómo estás?», «Hola ${conNombre}, ¿qué tal?», «${conNombre}, ¿cómo te va?», «Qué tal ${conNombre}»`
    : '«Hola, ¿qué tal?», «Hola, ¿cómo va todo?», «Hola de nuevo»';
  const dias = Math.round(h / 24);
  return `\n\nSALUDO: pasaron ${dias >= 1 ? `${dias} día${dias === 1 ? '' : 's'}` : 'varias horas'} desde el último mensaje, así que ABRE saludando y preguntando cómo está, como haría una persona que retoma: ${ej}. Varía la forma, no uses siempre la misma. Prohibido «espero que estés bien» y «quería darle seguimiento»: eso es relleno, no es saludar.
FORMA: separa el mensaje en párrafos con una línea en blanco (el saludo por un lado, el fondo por otro). Un bloque compacto se ve automático; con aire se lee como escrito por alguien.`;
}

/**
 * SIN EMOJIS, POR CÓDIGO (5-sep). El guion los prohíbe desde el principio y aun así se colaban («confírmame con un
 * 👍», «le diste ❤️ al link»). Pedirlo en el prompt no alcanza: se quitan al salir y se deja registro de que el
 * modelo desobedeció, para saber si el guion necesita otra vuelta. El saludo alargado («Holaaa») NO se toca: eso lo
 * pidió el dueño y es estilo, no emoji.
 */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2764}\u{2665}]/gu;
export function sinEmojis(texto: string): { texto: string; quitados: number } {
  const original = String(texto || '');
  const limpio = original.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').trim();
  const quitados = (original.match(EMOJI) || []).length;
  return { texto: limpio, quitados };
}

/**
 * EL NOMBRE DEL NEGOCIO (5-sep). Muchas tiendas se llaman con una frase: «No se qué ponerme», «Mi Bella Pandita»,
 * «Que Onda Wey». Metidas crudas en una oración salen mal: «si sigues viendo opciones para No se qué ponerme».
 * Se le dice al modelo cómo presentarlas: antecedidas de «tu tienda» o entre comillas, nunca sueltas.
 */
export function bloqueEmpresa(empresa?: string | null): string {
  const e = String(empresa || '').trim();
  if (!e || e.length < 2) return '';
  const palabras = e.split(/\s+/).length;
  const esFrase = palabras >= 3 || /\b(que|qué|no|se|de|la|el|mi|tu)\b/i.test(e.split(/\s+/)[0]);
  if (!esFrase) return `\n\nSU NEGOCIO se llama ${e}: puedes nombrarlo con naturalidad («en ${e}…»).`;
  return `\n\nSU NEGOCIO se llama «${e}», que es una frase: NO la metas suelta en la oración (queda «opciones para ${e}» y se lee raro). Dila como «tu tienda ${e}» o entre comillas, o simplemente di «tu tienda».`;
}

/**
 * CUANDO NO SABEMOS SU GIRO (decisión del dueño, 5-sep). No es un hueco que haya que disimular: es LA pregunta.
 * Sin saber qué vende no se puede armar una demo que sirva, y decírselo así —con la razón— es más honesto y más
 * persuasivo que fingir que ya lo entendemos. El dueño lo pidió textual: «hacerle entender por qué necesitamos
 * entender su giro y cómo, basado en eso, podemos hacerle una demo personalizada».
 */
export function bloqueSinGiro(sabemosGiro: boolean, sabemosDolor: boolean, primerContacto = true): string {
  if (sabemosGiro && sabemosDolor) return '';
  const falta = !sabemosGiro && !sabemosDolor ? 'qué vende y qué le está costando hoy'
    : !sabemosGiro ? 'qué vende exactamente' : 'qué es lo que más le cuesta hoy';
  return `\n\nNO SABEMOS ${falta.toUpperCase()}, y eso es justo lo que hay que preguntar. No lo disimules ni inventes una «solución» genérica: díselo con su razón, que es verdad y además convence — sin saber ${falta} cualquier demo sería genérica, y lo que sirve es verle SU caso (sus productos, sus tallas y colores, su forma de cobrar) en pantalla.
Dilo en una línea, como quien quiere hacer bien su trabajo, no como quien llena un formulario: «para no mandarte cosas que no te sirven», «para que la demo sea con lo tuyo y no con ejemplos de otra tienda». ${primerContacto ? ' Y ofrécele la salida fácil: que te mande una nota de voz y te lo platique.' : ' NO le ofrezcas mandar audio: ya se lo ofrecimos antes y repetirlo agrega una segunda petición al mensaje.'}`;
}
