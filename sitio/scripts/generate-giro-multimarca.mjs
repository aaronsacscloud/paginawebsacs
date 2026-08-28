// Fotos del giro Boutique Multimarca — mismas reglas que los giros anteriores:
// gente mexicana real, luz natural, nada de logos ni texto legible, y las
// pantallas NUNCA en blanco: muestran una app de punto de venta creíble.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');

// La llave de imágenes vive en ~/.openai-images.key (las de sitio/.env se rotaron).
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();

const STYLE = 'Photorealistic documentary photo, real Mexican people with natural skin texture, ages 28-55, natural light, slight film grain, no logos, no brand names, no readable text anywhere, candid, editorial retail photography. Any tablet or phone screen shows a clean modern retail point-of-sale app with a grid of colored product tiles and blue accents, slightly out of focus, never a blank screen.';
const TABLET = 'tablet screen visible showing the point-of-sale app';
const TIENDA = 'Upscale multi-brand fashion boutique in Mexico: wood floor, brass clothing racks each holding a different visual family of garments, warm pendant lights, plants, a travertine-and-wood checkout counter';

const SCENES = [
  ['verticales/boutique-multimarca', `${TIENDA}. A 40s Mexican woman owner arranging garments on a rack, another rack with dresses behind, daylight from the storefront.`],
  ['hero-multi', `${TIENDA}. The 40s woman owner standing between two racks of clearly different garment families (denim rack, dresses rack), holding a tablet (${TABLET}), smiling slightly at it.`],
  ['suite-multi-hoy', `A 42-year-old Mexican woman, shoulder-length dark wavy hair, oval face, thin arched eyebrows, small gold hoop earrings, delicate gold necklace, olive blouse, in the back room of her boutique surrounded by open cardboard boxes of new women's garments, holding paper supplier notes and a pen, head tilted down reading the notes, slightly stressed, warm light. NO tablet, NO phone, NO computer anywhere in frame — only paper.`],
  ['suite-multi-resuelto', `A 42-year-old Mexican woman, shoulder-length dark wavy hair, oval face, thin arched eyebrows, small gold hoop earrings, delicate gold necklace, olive blouse, calm and confident at the boutique checkout counter, consulting a tablet (${TABLET}), tidy women's boutique behind, daylight.`],
  ['suite-multi-tienda', `Very wide shot of a large, elegant multi-brand fashion boutique in Mexico: long rows of racks by brand, accessories table, two customers browsing, one salesperson, high ceilings, daylight.`],
  ['caso-multi-recepcion', `Back room of a Mexican boutique on delivery day: a 30s employee labeling garments with a small handheld label printer, three open supplier boxes on the table, garments on a rolling rack.`],
  ['caso-multi-expo', `A 40s Mexican boutique owner walking a busy fashion trade-show aisle in Mexico, checking her phone, booths with garment racks blurred on both sides, convention-hall lighting.`],
  ['caso-multi-consigna', `Inside the boutique, the 40s woman owner showing a tablet (${TABLET}) to a male supplier in his 50s next to a rack of dresses; both relaxed, businesslike.`],
  ['caso-multi-look', `Boutique checkout: a 30s saleswoman ringing up a customer buying a dress, a handbag and earrings together on the counter, tissue paper and a kraft bag ready.`],
  ['proc-multi-1', `A consultant with a laptop and the 40s boutique owner reviewing paper supplier notes together over the checkout counter, boxes nearby, morning light.`],
  ['proc-multi-2', `The 40s boutique owner and a consultant at a small desk in the back office reviewing printed supplier terms, shelves with folded garments behind.`],
  ['proc-multi-3', `Small team training moment before opening: three boutique employees around the counter watching a trainer point at a tablet (${TABLET}), morning light, door still closed.`],
  ['proc-multi-4', `First sale of the day at the boutique: young cashier charging a customer at the counter with a companion from the team beside her, ${TABLET}.`],
  ['proc-multi-5', `The 42-year-old woman owner of a women's fashion boutique alone in the quiet back room at closing time, reading a tablet (${TABLET}), satisfied expression, warm evening light. Shelves of folded women's garments and a rolling rack of dresses behind her — it is clearly a clothing boutique, no bottles, no food.`],
  ['plano-multi-piso', `Sales floor of the multi-brand boutique: brass racks each with a distinct garment family, a central table with accessories and handbags, no people, daylight.`],
  ['plano-multi-probador', `Fitting rooms of a Mexican boutique: linen curtains, full-length brass mirror, velvet bench, a dress and a handbag hanging together, no people.`],
  ['plano-multi-trastienda', `Back room of a WOMEN'S fashion boutique: desk with laptop, shelves with folded women's blouses and dresses in soft colors, open supplier boxes with dresses, a rolling rack of women's garments waiting for labels, slightly lived-in and real, no people.`],
  ['plano-multi-mostrador', `Boutique checkout counter in wood and travertine: tablet stand (${TABLET}), kraft bags, tissue paper, small plant, no people.`],
  ['plano-multi-linea', `Online-order packing table at a women's boutique: kraft boxes, tissue paper, a folded dress half-wrapped, printed shipping labels, ribbon, absolutely NO people, no hands, empty scene, daylight.`],
];
const PRODUCTS = [
  ['jean-recto', 'Straight-cut medium-blue women\'s jeans'],
  ['jean-slim', 'Slim-fit dark-indigo women\'s jeans'],
  ['jean-mom', 'Mom-fit light washed women\'s jeans'],
  ['jean-wide', 'Wide-leg medium-blue women\'s jeans'],
];
const PSTYLE = 'Clean e-commerce product photo, single garment on invisible mannequin form, soft even studio light, plain very light gray background, photorealistic fabric texture, no logos, no text, no person.';

async function gen(file, prompt, size, w, h) {
  const out = path.join(IMG, `${file}.webp`);
  try { await fs.access(out); console.log(`skip ${file}`); return; } catch {}
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size, quality: 'medium' });
    const png = Buffer.from(r.data[0].b64_json, 'base64');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(png).resize(w, h, { fit: 'cover' }).webp({ quality: 85 }).toFile(out);
    console.log(`ok ${file}`);
  } catch (e) { console.error(`FALLO ${file}: ${e?.message || e}`); }
}

const work = [
  ...SCENES.map(([f, p]) => () => gen(f, `${p}\n\n${STYLE}`, '1536x1024', 1400, 933)),
  ...PRODUCTS.map(([f, p]) => () => gen(f, `${p}. ${PSTYLE}`, '1024x1536', 700, 1050)),
];
for (let i = 0; i < work.length; i += 4) await Promise.all(work.slice(i, i + 4).map(fn => fn()));
console.log('LISTO');
