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
  ['es-3-muestrario', `Documentary editorial photograph, 35mm lens, shallow depth of field, natural window light, realistic film grain. A Spanish bridal boutique in an old city building, mid-morning. A woman in her forties, the shop owner, stands at a rail of wedding dresses in clear garment bags and ties a small blank cream card tag onto a hanger. ONLY ONE hand is visible in the frame: her right hand, sharply in focus, pinching the cotton string of the tag between thumb and index finger, all five fingers clearly separated with visible knuckles and natural short nails, correct human anatomy, no fused or missing fingers; her other arm hangs down out of frame, hidden behind the dresses. Blurred in the background, an open laptop on a wooden table shows a plain inventory interface: left sidebar, white cards, rows with small colored status chips, everything far out of focus and completely unreadable. Ivory, pale wood and warm neutral palette; tall dark wooden window with a European stone facade outside. Absolutely no readable or half-readable letters or numbers anywhere, nothing printed on the tag, no brand names, no logos, no money. Real skin texture, no plastic retouching, no stock-photo smile. 16:9.`],
  ['es-4-taller', `${COMUN} A small alterations workshop: a seamstress at a sewing machine, two wedding dresses hanging with blank paper tags, a wall-mounted screen showing an abstract blue schedule of coloured bars. Warm working atmosphere, threads and scissors on the table.`],
  ['es-5-proveedor', `${COMUN} Backroom receiving area: a delivery box just opened on a table with a wedding dress in a garment bag half out of it; the shop owner checks a tablet showing an abstract blue order screen. Shelves with boxes behind.`],
  ['es-6-fotos-ia', `Documentary editorial photograph, 35mm lens, shallow depth of field, natural window light, realistic film grain. A Spanish bridal boutique in a period building with carved wooden mirror and tall window; a woman photographs an ivory lace wedding gown displayed on a linen dress form, using a smartphone clamped on a tripod. The phone screen shows the live camera view of that exact same gown, same lace and same silhouette as the real dress, with the round shutter button visible. The woman stands to one side with her hands resting lightly on the tripod head, hands small in the frame, in focus, correct anatomy, five clearly separated fingers each, no hands touching the dress. In the right foreground, an open laptop shows a photo-catalogue screen: a clean grid of thumbnails that are ALL photographs of white and ivory wedding dresses on hangers and on dress forms — absolutely no landscapes, no mountains, no skies, no abstract or decorative images — with a left sidebar, filter chips and one blue action button; all captions and labels out of focus and unreadable. Warm ivory and pale wood palette, European architecture visible through the window. No readable or half-readable text, no logos, no brand names, no money. Real skin texture, no plastic retouching. 16:9.`],
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
