// ══ Con cuánto se saluda ═════════════════════════════════════════════════════
//
// Vive aparte de abm.lib a propósito: es una función PURA y abm.lib arrastra el
// cliente de Supabase, que necesita variables de entorno. Un archivo así no se
// puede probar sin levantar medio mundo, y esto se ve en el primer renglón de
// cada correo frío — merece prueba propia.
/** Con cuánto se saluda: "Juan Carlos Medina Fernández" → "Juan Carlos", pero
 *  "Cielo Inzunza" → "Cielo".
 *
 *  Cortar siempre en la primera palabra destroza los nombres compuestos, que en
 *  México son comunísimos: a Juan Carlos nadie le dice Juan, y a José Luis
 *  menos. Pero dejar dos palabras a ciegas saluda con apellido, que suena a
 *  base de datos comprada.
 *
 *  La señal que sí sirve: en un nombre compuesto la SEGUNDA palabra también es
 *  un nombre de pila. "Carlos" lo es, "Medina" no. Por eso la lista es de
 *  segundos elementos, no de apellidos — los apellidos son infinitos y los
 *  nombres que forman compuestos son un puñado.
 *
 *  Ante la duda se queda con una sola palabra: equivocarse acortando es una
 *  familiaridad de más; equivocarse alargando es saludar a un extraño por su
 *  apellido.
 */
const SEGUNDO_NOMBRE = new Set([
  'carlos', 'luis', 'jose', 'maria', 'manuel', 'antonio', 'angel', 'jesus',
  'fernando', 'alberto', 'eduardo', 'javier', 'miguel', 'pablo', 'andres',
  'ramon', 'enrique', 'alejandro', 'francisco', 'ignacio', 'rafael', 'daniel',
  'ricardo', 'roberto', 'armando', 'guadalupe', 'isabel', 'elena', 'sofia',
  'fernanda', 'paula', 'victoria', 'teresa', 'cristina', 'alejandra', 'esther',
  'dolores', 'pilar', 'rosa', 'laura', 'patricia', 'eugenia', 'auxiliadora',
  'del', 'de',   // "María del Carmen", "Ana de la Luz": se resuelven abajo
]);

/* Tratamientos y títulos: no son el nombre. Sin esto, "Don Pepe Castro"
   saludaba "Don" y "Lic. Marcela Ruiz" saludaba "Lic". */
const TRATAMIENTO = /^(don|dona|doña|sr|sra|srta|lic|ing|arq|mtro|mtra|dr|dra|c\.?p|cp)\.?$/i;

export function nombrePila(completo?: string | null): string {
  let t = String(completo || '').trim().split(/\s+/).filter(Boolean);
  while (t.length > 1 && TRATAMIENTO.test(t[0])) t = t.slice(1);
  if (!t.length) return '';
  // "Ma." y "Mª" son abreviaturas de María y así escritas se ven descuidadas.
  const uno = /^(ma\.?|mª)$/i.test(t[0]) ? 'María' : t[0];
  if (t.length < 2) return uno;
  const dos = t[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!SEGUNDO_NOMBRE.has(dos)) return uno;
  // "María del Carmen" son tres palabras: con dos quedaría "María del".
  if ((dos === 'del' || dos === 'de') && t.length >= 3) {
    const tres = t.slice(1, t[2].toLowerCase() === 'la' || t[2].toLowerCase() === 'los' ? 4 : 3);
    return [uno, ...tres].join(' ');
  }
  if (dos === 'del' || dos === 'de') return uno;
  return `${uno} ${t[1]}`;
}

// ══ Cómo se escribe el nombre del negocio en el correo ═══════════════════════
//
// El nombre viene de la ficha de Google Maps tal como lo capturó su dueño, y
// eso trae dos cosas que en un correo se leen fatal:
//
//   ALMACENES SILVON                         589 de 3,205 cuentas van así
//   AGORSS / DEEZER / MONACO / ESTUDIO S /   la ficha lista todas sus marcas
//
// «Le escribo a ALMACENES SILVON» grita, y «Vi AGORSS / DEEZER / MONACO /
// ESTUDIO S / DEFAY / WHOO / en Guadalajara» delata de una que el dato se
// copió de un directorio. Es la PRIMERA línea del correo que jura no ser
// automático.
//
// Tres reglas, y las tres con su excepción medida contra los 3,205 nombres:
//   · MAYÚSCULAS → Mayúscula inicial. La excepción son las siglas, y la señal
//     que las distingue NO es el largo: es que no tienen vocal. «JYV» y «URB»
//     se quedan; «YAZ», «VIA» y «JOY» no son siglas y se escriben Yaz, Via,
//     Joy. Se probó primero con «tres letras o menos», que producía «Cute AND
//     JOY» y «Contadores Y Abogados» — peor que el problema original.
//   · La lista de marcas se corta en la primera. Solo si hay DOS o más
//     diagonales: «Alquiler de Smoking / Trajes Mickey» es un nombre con una
//     diagonal, no una lista, y cortarlo dejaría «Alquiler de Smoking».
//   · La forma legal se va: «Textiles Opertel S.A. de C.V.» en un correo en
//     frío es de oficio de banco. En el correo se le llama como se le llama.

const ENLACE = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'al', 'con', 'por', 'para']);

export function nombreBonito(bruto?: string | null): string {
  let t = String(bruto || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';

  if ((t.match(/\//g) || []).length >= 2) t = t.split('/')[0].trim();
  t = t.replace(/[,\s]+(s\.?\s?a\.?(\s?de\s?c\.?\s?v\.?)?|s\.?\s?de\s?r\.?\s?l\.?(\s?de\s?c\.?\s?v\.?)?|s\.?\s?c\.?|a\.?\s?c\.?)\s*\.?$/i, '');
  t = t.replace(/[\s|/,.\-–—]+$/, '').trim();
  if (!t) return String(bruto || '').trim();

  const palabras = t.split(' ');
  const gritando = palabras.filter(p => /[A-ZÁÉÍÓÚÑ]/.test(p)).every(p => p === p.toUpperCase());
  if (!gritando) return t;

  return palabras.map((p, i) => {
    const baja = p.toLowerCase();
    if (i > 0 && ENLACE.has(baja.replace(/[^a-záéíóúñ]/g, ''))) return baja;
    const letras = p.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
    // Sigla = sin vocal. JYV y URB se quedan; YAZ, VIA y JOY no son siglas.
    if (letras.length > 1 && !/[AEIOUÁÉÍÓÚaeiouáéíóú]/.test(letras)) return p;
    return baja.charAt(0).toUpperCase() + baja.slice(1);
  }).join(' ');
}
