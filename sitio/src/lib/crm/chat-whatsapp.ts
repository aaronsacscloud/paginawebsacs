// Leer un chat de WhatsApp exportado, SIN pedirle nada a un modelo.
//
// Los conteos y las fechas de una conversación son un DATO, no una
// interpretación: están escritos en cada renglón del export. Pedírselos a una
// IA sería pagar por que adivine algo que ya viene medido —y que además, si se
// equivoca, termina siendo la evidencia con la que se decide si una cuenta
// conserva su tasa—. La IA redacta; este archivo cuenta.
//
// WhatsApp exporta en varias formas según el teléfono y el idioma:
//   [02/09/26, 9:14:32 a. m.] Pamela: hola      (iOS, español)
//   [2/9/26, 9:14:32] Pamela: hola              (iOS, 24 h)
//   02/09/2026, 9:14 - Pamela: hola             (Android)
//   2/9/26 9:14 - Pamela: hola                  (Android, sin coma)
// Todas caben en una sola expresión; lo que no cabe se trata como continuación
// del mensaje anterior, que es lo que de verdad es: un salto de línea.

export type MensajeChat = { fecha: string; hora: string; autor: string; texto: string };
export type LecturaChat = {
  mensajes: MensajeChat[];
  total: number;
  desde: string | null;
  hasta: string | null;
  dias: string[];
  /** Quién habló y cuánto, de más a menos. */
  participantes: { autor: string; n: number }[];
  /** Renglones que no se pudieron leer como mensaje (avisos del sistema, etc.). */
  ignorados: number;
};

/* El corchete de apertura es opcional, la coma entre fecha y hora también, y
   el separador antes del autor puede ser «]» o « - ». El a. m./p. m. viene con
   puntos y espacios finos según el teléfono, así que se acepta laxo. */
const RENGLON = new RegExp(
  '^\\s*\\[?\\s*' +
  '(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{2,4})' +      // 1 día  2 mes  3 año
  '[,\\s]+' +
  '(\\d{1,2}):(\\d{2})(?::\\d{2})?' +                    // 4 hora 5 min
  '(?:\\s*([ap])\\.?\\s*m\\.?)?' +                       // 6 am/pm (opcional)
  '\\s*(?:\\]\\s*|\\s+-\\s+)' +
  '([^:]{1,80}?)\\s*:\\s*' +                             // 7 autor
  '([\\s\\S]*)$',                                        // 8 texto
  'i',
);

const dos = (n: number) => String(n).padStart(2, '0');

/**
 * Fecha en formato DÍA/MES/AÑO, que es como exporta WhatsApp en México.
 * Si el primer número es mayor que 12 no hay duda; si el segundo lo es, venía
 * al revés y se corrige. En el caso ambiguo manda día primero: inventar el
 * otro orden movería medio año una conversación.
 */
function aISO(a: string, b: string, c: string): string | null {
  let d = Number(a), m = Number(b);
  const y = Number(c) < 100 ? 2000 + Number(c) : Number(c);
  if (m > 12 && d <= 12) { const t = d; d = m; m = t; }
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100)) return null;
  return `${y}-${dos(m)}-${dos(d)}`;
}

export function leerChat(texto: string): LecturaChat {
  const mensajes: MensajeChat[] = [];
  let ignorados = 0;

  for (const raw of String(texto || '').split(/\r?\n/)) {
    // El espacio fino invisible que iOS mete antes del corchete rompe el match.
    const linea = raw.replace(/[‎‏‪-‮ ]/g, ' ');
    const m = linea.match(RENGLON);
    if (!m) {
      // Continuación del mensaje anterior: un mensaje con saltos de línea sigue
      // siendo UN mensaje, y contarlo como varios inflaría la evidencia.
      if (mensajes.length && linea.trim()) mensajes[mensajes.length - 1].texto += '\n' + linea.trim();
      else if (linea.trim()) ignorados++;
      continue;
    }
    const fecha = aISO(m[1], m[2], m[3]);
    if (!fecha) { ignorados++; continue; }
    let h = Number(m[4]);
    const ampm = (m[6] || '').toLowerCase();
    if (ampm === 'p' && h < 12) h += 12;
    if (ampm === 'a' && h === 12) h = 0;
    mensajes.push({
      fecha, hora: `${dos(h)}:${m[5]}`,
      autor: m[7].trim(),
      texto: (m[8] || '').trim(),
    });
  }

  const dias = Array.from(new Set(mensajes.map(x => x.fecha))).sort();
  const cuenta = new Map<string, number>();
  for (const x of mensajes) cuenta.set(x.autor, (cuenta.get(x.autor) || 0) + 1);

  return {
    mensajes, total: mensajes.length,
    desde: dias[0] || null, hasta: dias[dias.length - 1] || null,
    dias,
    participantes: [...cuenta.entries()].map(([autor, n]) => ({ autor, n })).sort((a, b) => b.n - a.n),
    ignorados,
  };
}

/**
 * Cuántos mensajes puso cada lado, día por día.
 *
 * Es lo que se guarda como actividad: UNA por día y por lado, con su conteo
 * adentro. Una fila por mensaje serían ciento treinta y cuatro renglones en el
 * timeline por una sola conversación; una sola fila perdería las fechas, que
 * es justo lo que hace falta para decir «contestó el 11 de septiembre».
 */
export function porDiaYLado(lectura: LecturaChat, autoresDelCliente: string[]) {
  const suyos = new Set(autoresDelCliente.map(a => a.trim().toLowerCase()));
  const mapa = new Map<string, { fecha: string; lado: 'cliente' | 'nosotros'; n: number }>();
  for (const m of lectura.mensajes) {
    const lado: 'cliente' | 'nosotros' = suyos.has(m.autor.toLowerCase()) ? 'cliente' : 'nosotros';
    const k = `${m.fecha}|${lado}`;
    const r = mapa.get(k) || { fecha: m.fecha, lado, n: 0 };
    r.n++; mapa.set(k, r);
  }
  return [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Un extracto legible para que la IA no tenga que tragarse un chat de 3 MB. */
export function paraElModelo(lectura: LecturaChat, tope = 24000): string {
  const lineas = lectura.mensajes.map(m => `${m.fecha} ${m.hora} ${m.autor}: ${m.texto}`);
  const todo = lineas.join('\n');
  if (todo.length <= tope) return todo;
  /* Se parte por los DOS extremos: el arranque dice de qué iba y el final
     dice en qué quedó, que es lo que se está buscando. Quedarse solo con el
     principio perdería justo los acuerdos. */
  const mitad = Math.floor(tope / 2);
  return todo.slice(0, mitad) + '\n[…]\n' + todo.slice(-mitad);
}
