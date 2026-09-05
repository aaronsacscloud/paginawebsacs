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
