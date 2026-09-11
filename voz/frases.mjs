// LA VOZ DE FERNANDA · lo que pasa entre el texto del modelo y la boca.
//
// 1. `Partidor`: junta los tokens que llegan por streaming y suelta FRASES
//    completas, para que ElevenLabs empiece a hablar en cuanto hay una frase
//    y no espere el párrafo. La primera se suelta antes (más corta): es la
//    que decide cuánto silencio oye el prospecto.
// 2. `paraVoz`: números, horas y precios en palabras. «16:00» leído por una
//    voz sintética suena a máquina; «cuatro de la tarde» suena a persona.

const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

/** Un entero de 0 a 999,999 en palabras (español de México). */
export function enPalabras(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n < 30) return UNIDADES[n];
  if (n < 100) { const d = Math.floor(n / 10), u = n % 10; return u ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d]; }
  if (n === 100) return 'cien';
  if (n < 1000) { const c = Math.floor(n / 100), r = n % 100; return r ? `${CENTENAS[c]} ${enPalabras(r)}` : CENTENAS[c]; }
  if (n < 1000000) {
    const m = Math.floor(n / 1000), r = n % 1000;
    const miles = m === 1 ? 'mil' : `${enPalabras(m)} mil`;
    return r ? `${miles} ${enPalabras(r)}` : miles;
  }
  return String(n);
}

/** «16:00» → «cuatro de la tarde», «09:30» → «nueve y media de la mañana». */
export function horaEnPalabras(hh, mm) {
  const h24 = Number(hh), m = Number(mm || 0);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const franja = h24 < 12 ? 'de la mañana' : h24 < 20 ? 'de la tarde' : 'de la noche';
  const hora = h12 === 1 ? 'una' : enPalabras(h12);
  const min = m === 0 ? '' : m === 30 ? ' y media' : m === 15 ? ' y cuarto' : m === 45 ? ' cuarenta y cinco' : ` ${enPalabras(m)}`;
  return `${hora}${min} ${franja}`;
}

/** Deja el texto listo para decirse en voz alta. */
export function paraVoz(t) {
  let s = String(t || '');
  s = s.replace(/\*\*?|__|`|#+\s?/g, '');                         // sin markdown
  s = s.replace(/\b(\d{1,2}):(\d{2})\s*(h|hrs|horas)?\b/g, (_, h, m) => horaEnPalabras(h, m));
  s = s.replace(/\$\s?(\d{1,3}(?:[,.]\d{3})+|\d+)(?:\.\d{2})?\s*(mxn|pesos)?/gi, (_, n) => `${enPalabras(String(n).replace(/[,.]/g, ''))} pesos`);
  s = s.replace(/\b(\d{1,2})\s*%/g, (_, n) => `${enPalabras(n)} por ciento`);
  s = s.replace(/\b(\d{1,3})\s+(tiendas?|sucursales?|minutos?|días?|meses|años?|marcas?|personas?|empleados?)\b/gi, (_, n, q) => `${enPalabras(n)} ${q}`);
  s = s.replace(/\bSacs\b/g, 'Sacs');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Junta tokens y suelta frases. La primera frase sale en cuanto hay una
 * pausa natural (coma, punto, dos puntos) y al menos `minPrimera` letras;
 * las siguientes, en fin de oración. Lo que quede se suelta con `cerrar()`.
 */
export class Partidor {
  constructor({ minPrimera = 24, minResto = 40 } = {}) { this.buf = ''; this.n = 0; this.minPrimera = minPrimera; this.minResto = minResto; }
  /** Devuelve las frases listas (0..n). */
  empujar(token) {
    this.buf += token;
    const listas = [];
    for (;;) {
      const min = this.n === 0 ? this.minPrimera : this.minResto;
      const re = this.n === 0 ? /[.!?…;:,]\s|\n/ : /[.!?…]\s|\n/;
      const m = this.buf.match(re);
      if (!m || m.index + 1 < min) break;
      const corte = m.index + m[0].length;
      const frase = this.buf.slice(0, corte).trim();
      this.buf = this.buf.slice(corte);
      if (frase) { listas.push(frase); this.n++; }
    }
    return listas;
  }
  cerrar() { const r = this.buf.trim(); this.buf = ''; if (r) this.n++; return r ? [r] : []; }
}

/** Cuánto tarda en decirse un texto, a ojo (para saber cuándo colgar tras la despedida). */
export const segundosHablando = (texto) => Math.max(1, Math.ceil(String(texto || '').length / 14));
