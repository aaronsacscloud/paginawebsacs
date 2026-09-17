// Las siete fotos de la cadencia de novias de España: cada una enseña la
// PANTALLA de Sacs dentro del proceso real de la tienda. Temporal: se corre a
// mano, se revisan las imágenes y se borra.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const envText = await fs.readFile(path.join(SITIO, '.env'), 'utf8');
for (const l of envText.split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const COMUN = `Photorealistic documentary photograph inside a real Spanish bridal shop (Spain, European interior: high ceilings, white walls, warm wood, natural light from a tall window). People look Spanish/European, natural skin, no glamour retouching, no AI gloss, slight film grain, shot on 35mm full-frame, shallow depth of field. Absolutely NO legible text, NO letters, NO numbers, NO logos anywhere in the image — screens show only abstract soft-blue UI shapes: cards, rows, bars and a calendar grid, blurred. No money, no banknotes, no flags. 16:9 editorial framing, calm and warm, dignified work in progress.`;

const FOTOS = [
  ['es-1-presentacion', `${COMUN} A woman shop owner in her 40s standing among garment-bagged wedding dresses, looking at a tablet on a marble counter; the tablet screen shows a soft abstract blue interface. She looks calm and in control. Wide shot of the shop.`],
  ['es-2-ficha', `${COMUN} Close over-the-shoulder view: a shop assistant holds a tablet showing an abstract blue record card with a small calendar grid highlighted; in front of her, a bride in a white dress stands on a fitting platform being pinned by a seamstress, softly out of focus. The tablet is the sharp subject.`],
  ['es-3-muestrario', `${COMUN} A rail of sample wedding dresses in garment bags; a hand attaches a small blank tag to one hanger while a laptop on a side table shows an abstract blue inventory list, softly out of focus behind. Focus on the hanger and the tag.`],
  ['es-4-taller', `${COMUN} A small alterations workshop: a seamstress at a sewing machine, two wedding dresses hanging with blank paper tags, a wall-mounted screen showing an abstract blue schedule of coloured bars. Warm working atmosphere, threads and scissors on the table.`],
  ['es-5-proveedor', `${COMUN} Backroom receiving area: a delivery box just opened on a table with a wedding dress in a garment bag half out of it; the shop owner checks a tablet showing an abstract blue order screen. Shelves with boxes behind.`],
  ['es-6-fotos-ia', `${COMUN} A single wedding dress on a mannequin next to a laptop and a smartphone on a tripod; the laptop screen shows an abstract blue gallery grid of soft image thumbnails. The phone is photographing the dress. Clean, studio-corner-in-the-shop feeling.`],
  ['es-7-almacen', `${COMUN} A stock room of a bridal shop, dozens of dresses in white garment bags on double rails, a woman with a tablet counting; the tablet shows an abstract blue list. Slightly cooler light, sense of hidden money.`],
  ['es-8-cierre', `${COMUN} Evening: the shop owner turning off the light of the shop window with wedding dresses, seen from inside, warm lamp glow, street at dusk through the glass. Nobody else. Quiet, grateful mood.`],
];

const openai = new OpenAI();
const sharp = (await import('sharp')).default;
const OUT = path.join(SITIO, 'public/images/mail');
for (const [nombre, prompt] of FOTOS) {
  const destino = path.join(OUT, `novias-${nombre}.jpg`);
  try { await fs.access(destino); console.log(`  = ${nombre} ya existe`); continue; } catch {}
  console.log(`→ ${nombre}…`);
  const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: 'high' });
  const b64 = r.data?.[0]?.b64_json;
  if (!b64) { console.error(`  ✗ ${nombre}: sin imagen`); continue; }
  await sharp(Buffer.from(b64, 'base64')).resize(1200, 600, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(destino);
  const st = await fs.stat(destino);
  console.log(`  ✓ ${nombre} · ${(st.size / 1024).toFixed(0)} KB`);
}
