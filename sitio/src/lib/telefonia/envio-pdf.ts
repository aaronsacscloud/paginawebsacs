// LLAMADAS INTELIGENTES · El PDF de lo que se prometió en la llamada («te mando
// la información de X»). Misma marca que la minuta (`minuta/pdf.ts`), pero es
// otro documento: no resume una llamada, explica un tema. El cuerpo viene de
// `tel_conocimiento` (lo que el equipo ya contestó antes) o de lo que el
// vendedor escribió en la cabina, en markdown sencillo.
import PDFDocument from 'pdfkit';
import { supabase } from '../supabase';

const MORADO = '#5B4BD6';
const MORADO_CLARO = '#9B8CFA';
const TINTA = '#1a1726';
const GRIS = '#6B7280';
const GRIS_CLARO = '#E5E7EB';
const WORDMARK = 'https://www.sacscloud.com/images/sacs-wordmark.png';
const BUCKET = 'wa-media';   // público: Meta descarga el archivo desde sus servidores

const limpiar = (s: string) => String(s || '')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
  .replace(/[ \t]{2,}/g, ' ').trim();

const FECHA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });

type Bloque = { titulo: string | null; lineas: string[] };
function bloques(md: string): Bloque[] {
  const out: Bloque[] = [];
  let b: Bloque | null = null;
  for (const cruda of String(md || '').split('\n')) {
    const l = cruda.trimEnd();
    const h = l.match(/^\s*#{1,4}\s+(.+?)\s*$/);
    if (h) { b = { titulo: limpiar(h[1]), lineas: [] }; out.push(b); continue; }
    if (!l.trim()) continue;
    if (!b) { b = { titulo: null, lineas: [] }; out.push(b); }
    b.lineas.push(l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '• ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'));
  }
  return out.filter(x => x.lineas.length);
}

async function logo(): Promise<Buffer | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(WORDMARK, { signal: ctl.signal });
    clearTimeout(t);
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch { return null; }
}

export type DatosEnvio = { tema: string; para?: string | null; empresa?: string | null; de?: string | null; cuerpo: string };

export async function envioPDF(d: DatosEnvio): Promise<Buffer> {
  const marca = await logo();
  const doc = new PDFDocument({
    size: 'LETTER', margins: { top: 56, bottom: 64, left: 56, right: 56 }, bufferPages: true,
    info: { Title: limpiar(d.tema), Author: 'Sacs', Subject: 'Información solicitada', Creator: 'Sacs CRM' },
  });
  const trozos: Buffer[] = [];
  doc.on('data', (c: Buffer) => trozos.push(c));
  const listo = new Promise<Buffer>(res => doc.on('end', () => res(Buffer.concat(trozos))));
  const ANCHO = doc.page.width - 112;
  const X = 56;

  doc.rect(0, 0, doc.page.width, 6).fill(MORADO_CLARO);
  if (marca) { try { doc.image(marca, X, 42, { height: 26 }); } catch { doc.fontSize(17).fillColor(MORADO).font('Helvetica-Bold').text('Sacs', X, 44); } }
  else doc.fontSize(17).fillColor(MORADO).font('Helvetica-Bold').text('Sacs', X, 44);
  doc.font('Helvetica').fontSize(7.5).fillColor(GRIS).text('EL SISTEMA DE LAS MARCAS DE RETAIL EN MÉXICO', X, 70, { characterSpacing: 0.8 });
  doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(limpiar(FECHA.format(new Date())), X, 48, { width: ANCHO, align: 'right' });

  doc.font('Helvetica-Bold').fontSize(21).fillColor(TINTA).text(limpiar(d.tema), X, 100, { width: ANCHO });
  const para = [d.para ? `Preparado para ${limpiar(d.para)}` : null, d.empresa ? limpiar(d.empresa) : null].filter(Boolean).join(' · ');
  if (para) doc.font('Helvetica').fontSize(10.5).fillColor(GRIS).text(para, X, doc.y + 3, { width: ANCHO });
  doc.y += 18;

  const bs = bloques(d.cuerpo);
  for (const b of bs) {
    if (b.titulo) {
      if (doc.y > doc.page.height - 150) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(12).fillColor(MORADO).text(b.titulo, X, doc.y, { width: ANCHO });
      doc.moveTo(X, doc.y + 3).lineTo(X + 34, doc.y + 3).lineWidth(2).stroke(MORADO_CLARO);
      doc.moveDown(0.8);
    }
    for (const l of b.lineas) {
      const texto = limpiar(l);
      if (!texto) continue;
      const vineta = texto.startsWith('• ');
      if (doc.y > doc.page.height - 92) doc.addPage();
      const yAntes = doc.y;
      doc.font('Helvetica').fontSize(10.5).fillColor(TINTA).text(vineta ? texto.slice(2) : texto, vineta ? X + 14 : X, yAntes, { width: vineta ? ANCHO - 14 : ANCHO, lineGap: 2.5 });
      if (vineta) doc.circle(X + 5.5, yAntes + 5, 1.7).fill(MORADO_CLARO).fillColor(TINTA);
      doc.moveDown(0.35);
    }
    doc.moveDown(0.7);
  }
  if (d.de) {
    doc.moveDown(0.6);
    const firma = limpiar(d.de);
    doc.font('Helvetica').fontSize(10).fillColor(GRIS).text(`Cualquier duda, con gusto: ${/sacs/i.test(firma) ? firma : `${firma}, Sacscloud`}.`, X, doc.y, { width: ANCHO });
  }

  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    const margenAbajo = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 52;
    doc.moveTo(X, y).lineTo(X + ANCHO, y).lineWidth(0.7).stroke(GRIS_CLARO);
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS).text('Sacscloud · www.sacscloud.com', X, y + 9, { width: ANCHO * 0.7, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS).text(`Página ${i + 1} de ${rango.count}`, X, y + 9, { width: ANCHO, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margenAbajo;
  }
  doc.flushPages();
  doc.end();
  return listo;
}

/** Sube el PDF al bucket público y devuelve su URL. El nombre lleva un tramo al azar: la URL no se adivina. */
export async function guardarEnvioPDF(id: string, buf: Buffer): Promise<string> {
  const azar = Math.random().toString(36).slice(2, 12);
  const ruta = `envios/${id}-${azar}.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, buf, { contentType: 'application/pdf', upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`no se pudo guardar el PDF: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}
