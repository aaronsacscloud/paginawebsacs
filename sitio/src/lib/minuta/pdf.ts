// MINUTA EN PDF · El documento formal de una llamada, con la marca de Sacs.
//
// ── Por qué se dibuja y no se imprime desde el navegador ───────────────────
// La minuta de una REUNIÓN ya tenía documento (`/minuta/[id]`), pero es una
// página HTML que alguien imprime a mano. Aquí hace falta un archivo PDF de
// verdad, porque el mismo archivo se le manda al cliente por WhatsApp y Meta
// necesita descargarlo de una URL. Imprimir HTML en el servidor pediría
// Chromium (~50 MB en la función), y en este repo el costo de Vercel ES el
// build: se dibuja con pdfkit, que pesa dos órdenes de magnitud menos.
//
// ── QUÉ NO LLEVA, a propósito ──────────────────────────────────────────────
// Ni la transcripción cruda ni el «siguiente paso» del equipo. Este archivo es
// el mismo que ve el cliente, y una transcripción palabra por palabra de una
// llamada —con lo que se dijo entre dientes, los precios que se tantearon y
// los nombres de terceros— no es algo que se le manda a nadie. Lo que sí va es
// lo que ambos lados acordaron. La transcripción se queda en el CRM.
import PDFDocument from 'pdfkit';
import { telefonoLegible } from '../telefono';

const MORADO = '#5B4BD6';
const MORADO_CLARO = '#9B8CFA';
const TINTA = '#1a1726';
const GRIS = '#6B7280';
const GRIS_CLARO = '#E5E7EB';
const WORDMARK = 'https://www.sacscloud.com/images/sacs-wordmark.png';

export type DatosMinuta = {
  callId: string;
  contacto?: string | null;
  empresa?: string | null;
  telefono: string;
  direccion: 'entrante' | 'saliente';
  fecha: Date;
  duracionSeg: number;
  atendio?: string | null;
  /** La minuta en markdown que redactó Claude (## Resumen, ## Temas…). */
  minuta: string;
};

/** pdfkit dibuja con WinAnsi: los emoji salen como cuadros. Fuera. */
const limpiar = (s: string) => String(s || '')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

const duracion = (s: number) => {
  const n = Math.max(0, Math.round(s));
  if (n < 60) return `${n} segundos`;
  const m = Math.floor(n / 60);
  return n % 60 ? `${m} min ${n % 60} s` : `${m} minutos`;
};

const FECHA = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
});

/** Folio corto y estable: el mismo CallSid siempre da el mismo folio. */
export const folioDe = (callId: string) => 'LL-' + String(callId).replace(/\D/g, '').slice(-8).padStart(8, '0');

/**
 * Parte el markdown de la minuta en secciones `## Título` → renglones.
 * Se acepta que venga sin encabezados: entonces todo es un solo bloque.
 */
function secciones(md: string): { titulo: string; lineas: string[] }[] {
  const out: { titulo: string; lineas: string[] }[] = [];
  let actual: { titulo: string; lineas: string[] } | null = null;
  for (const cruda of String(md || '').split('\n')) {
    const l = cruda.trimEnd();
    const h = l.match(/^\s*#{1,4}\s+(.+?)\s*$/);
    if (h) { actual = { titulo: limpiar(h[1]), lineas: [] }; out.push(actual); continue; }
    if (!l.trim()) continue;
    if (!actual) { actual = { titulo: 'Resumen', lineas: [] }; out.push(actual); }
    actual.lineas.push(l.replace(/^\s*[-*•]\s+/, '• ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'));
  }
  return out.filter(s => s.lineas.length);
}

/** El wordmark, si se puede bajar. Nunca bloquea: 3 s y se sigue sin él. */
async function logo(): Promise<Buffer | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(WORDMARK, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { return null; }
}

export async function minutaPDF(d: DatosMinuta): Promise<Buffer> {
  const marca = await logo();

  const doc = new PDFDocument({
    size: 'LETTER', margins: { top: 56, bottom: 64, left: 56, right: 56 },
    // Necesario para poder volver a cada página al final y ponerle el pie:
    // sin esto, pdfkit escribe en cadena y no deja regresar.
    bufferPages: true,
    info: {
      Title: `Minuta de llamada ${folioDe(d.callId)}`,
      Author: 'Sacs', Subject: 'Resumen de la llamada', Creator: 'Sacs CRM',
    },
  });
  const trozos: Buffer[] = [];
  doc.on('data', (c: Buffer) => trozos.push(c));
  const listo = new Promise<Buffer>(res => doc.on('end', () => res(Buffer.concat(trozos))));

  const ANCHO = doc.page.width - 112;   // 56 de margen por lado
  const X = 56;

  // ── Cintillo de marca ────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 6).fill(MORADO_CLARO);
  doc.y = 46;
  if (marca) {
    try { doc.image(marca, X, 42, { height: 26 }); } catch { doc.fontSize(17).fillColor(MORADO).font('Helvetica-Bold').text('Sacs', X, 44); }
  } else {
    doc.fontSize(17).fillColor(MORADO).font('Helvetica-Bold').text('Sacs', X, 44);
  }
  doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
    .text('EL SISTEMA DE LAS MARCAS DE RETAIL EN MÉXICO', X, 70, { characterSpacing: 0.8 });

  // Folio a la derecha, a la altura del logo.
  doc.font('Helvetica').fontSize(8).fillColor(GRIS)
    .text(`Folio ${folioDe(d.callId)}`, X, 48, { width: ANCHO, align: 'right' });

  // ── Título ───────────────────────────────────────────────────────────────
  doc.moveDown(2.4);
  doc.font('Helvetica-Bold').fontSize(21).fillColor(TINTA).text('Minuta de la llamada', X, 100);
  doc.font('Helvetica').fontSize(10.5).fillColor(GRIS)
    .text(limpiar(FECHA.format(d.fecha)), X, doc.y + 3);

  // ── Ficha de datos ───────────────────────────────────────────────────────
  const yFicha = doc.y + 14;
  const filas: [string, string][] = [
    ['Con', limpiar(d.contacto || telefonoLegible(d.telefono))],
    ...(d.empresa ? [['Empresa', limpiar(d.empresa)] as [string, string]] : []),
    ['Teléfono', telefonoLegible(d.telefono)],
    ['Duración', duracion(d.duracionSeg)],
    ['Tipo', d.direccion === 'saliente' ? 'Llamada que hicimos' : 'Llamada que recibimos'],
    ...(d.atendio ? [['Atendió', limpiar(d.atendio)] as [string, string]] : []),
  ];
  const altoFicha = filas.length * 16 + 18;
  doc.roundedRect(X, yFicha, ANCHO, altoFicha, 8).fill('#F7F6FE');
  filas.forEach(([k, v], i) => {
    const y = yFicha + 12 + i * 16;
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(k.toUpperCase(), X + 14, y, { width: 72 });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(TINTA).text(v, X + 92, y - 1, { width: ANCHO - 108, ellipsis: true, lineBreak: false });
  });
  doc.y = yFicha + altoFicha + 22;

  // ── Cuerpo ───────────────────────────────────────────────────────────────
  const secs = secciones(d.minuta);
  if (!secs.length) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(GRIS)
      .text('La llamada no dejó material suficiente para redactar un resumen.', X, doc.y, { width: ANCHO });
  }
  for (const s of secs) {
    // Un encabezado nunca se queda solo al pie de la página.
    if (doc.y > doc.page.height - 150) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(MORADO).text(s.titulo, X, doc.y, { width: ANCHO });
    doc.moveTo(X, doc.y + 3).lineTo(X + 34, doc.y + 3).lineWidth(2).stroke(MORADO_CLARO);
    doc.moveDown(0.8);
    for (const l of s.lineas) {
      const texto = limpiar(l);
      if (!texto) continue;
      const vineta = texto.startsWith('• ');
      if (doc.y > doc.page.height - 92) doc.addPage();
      /* La viñeta se dibuja contra la Y de ANTES del texto. Pintándola después
         se colgaba del ÚLTIMO renglón: en los puntos de dos líneas el puntito
         aparecía a media altura, junto a la segunda. */
      const yAntes = doc.y;
      doc.font('Helvetica').fontSize(10.5).fillColor(TINTA).text(
        vineta ? texto.slice(2) : texto,
        vineta ? X + 14 : X, yAntes,
        { width: vineta ? ANCHO - 14 : ANCHO, align: 'left', lineGap: 2.5 },
      );
      if (vineta) doc.circle(X + 5.5, yAntes + 5, 1.7).fill(MORADO_CLARO).fillColor(TINTA);
      doc.moveDown(0.35);
    }
    doc.moveDown(0.7);
  }

  // ── Pie en TODAS las páginas ─────────────────────────────────────────────
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    /* ⚠️ El pie vive DEBAJO del margen inferior, y pdfkit trata de saltar de
       página en cuanto la Y lo rebasa: la primera versión dibujó la rayita y
       se comió el texto. Se anula el margen mientras se pinta el pie y se
       restaura después. */
    const margenAbajo = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 52;
    doc.moveTo(X, y).lineTo(X + ANCHO, y).lineWidth(0.7).stroke(GRIS_CLARO);
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
      .text('Documento generado automáticamente por Sacs a partir de la grabación de la llamada.', X, y + 9, { width: ANCHO * 0.7, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
      .text(`Folio ${folioDe(d.callId)}  ·  Página ${i + 1} de ${rango.count}`, X, y + 9, { width: ANCHO, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margenAbajo;
  }

  doc.flushPages();
  doc.end();
  return listo;
}
