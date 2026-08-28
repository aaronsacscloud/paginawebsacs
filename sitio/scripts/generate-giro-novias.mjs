// Fotos del giro Novias y Fiesta — luz clara y elegante; pantallas con POS.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();

const STYLE = 'Photorealistic documentary photo, real Mexican people with natural skin texture, ages 16-60, soft bright natural light, slight film grain, no logos, no brand names, no readable text anywhere, candid, elegant editorial bridal-shop photography. Any tablet or phone screen shows a clean modern retail app with soft cards and blue accents, never blank.';
const TABLET = 'tablet screen visible showing the retail app';
const CASA = 'Elegant Mexican bridal shop: white and ivory wedding gowns on spaced rails, a colorful quinceañera section, cream walls, large mirrors, soft daylight';

const SCENES = [
  ['verticales/novias-fiesta', `${CASA}. The 50s woman owner arranging a white gown on a rail, a pink quinceañera dress beside, daylight.`, 800, 534],
  ['hero-novia', `${CASA}. A young bride on a low platform in front of a triple mirror trying a sample gown, her mother seated watching, the 50s owner nearby consulting a tablet (${TABLET}).`, 1400, 933],
  ['suite-novia-hoy', `A 52-year-old Mexican woman, gray-streaked hair in a neat bun, pearl earrings, navy blouse, flipping through a worn appointment-and-payments notebook at the counter of her bridal shop, garment bags hanging behind, slightly worried. NO tablet, NO phone — paper only.`, 1400, 933],
  ['suite-novia-resuelto', `The same 52-year-old Mexican woman, gray-streaked hair in a neat bun, pearl earrings, navy blouse, calm at the same counter showing a tablet (${TABLET}) to a client, garment bags behind, daylight.`, 1400, 933],
  ['suite-novia-tienda', `Very wide shot of a large bright bridal store in Mexico: long rails of white gowns, a colorful quinceañera corner, seating area with velvet chairs, two families browsing, daylight.`, 1400, 933],
  ['caso-novia-cita', `A young Mexican bride in a sample gown in front of a mirror, smiling, while a saleswoman takes notes on a tablet (${TABLET}), the mother watching from a velvet chair.`, 1400, 933],
  ['caso-novia-abonos', `A Mexican father in his 50s at the bridal-shop counter paying a cash installment, the cashier registering it on a tablet (${TABLET}), garment bags behind.`, 1400, 933],
  ['caso-novia-taller', `A seamstress in the bridal-shop workroom pinning the hem of a white gown on a dress form, sewing machine and thread rack behind, focused, natural light.`, 1400, 933],
  ['caso-novia-entrega', `The bridal-shop counter: staff handing a garment bag with a gown to a beaming young woman and her mother, a tablet on the counter, daylight.`, 1400, 933],
  ['proc-novia-1', `A consultant with a laptop and the 52-year-old owner reviewing a handwritten list of gowns next to garment bags, morning light.`, 1400, 933],
  ['proc-novia-2', `The owner and a consultant at the workroom table configuring stages on a tablet (${TABLET}), the seamstress nearby with a gown on a dress form.`, 1400, 933],
  ['proc-novia-3', `Small team training before opening: three staff around the counter watching a trainer hold a tablet (${TABLET}), hands anatomically correct, gowns behind.`, 1400, 933],
  ['proc-novia-4', `A saleswoman registering an installment payment for a smiling client at the counter, tablet on a stand (${TABLET}).`, 1400, 933],
  ['proc-novia-5', `The 52-year-old owner reviewing the week's deliveries on her tablet (${TABLET}) among garment bags, calm satisfaction, daylight.`, 1400, 933],
  ['plano-novia-piso', `Sales floor of the bridal shop, EMPTY of people: white gowns on brass rails generously spaced, a colorful quinceañera section, soft daylight.`, 1400, 933],
  ['plano-novia-probador', `Large fitting area of a bridal shop, EMPTY of people: triple mirror, low platform, velvet bench, one gown hanging ready.`, 1400, 933],
  ['plano-novia-taller', `Bridal workroom, EMPTY of people: sewing machine, dress form with a pinned gown, thread rack, iron and board, natural light.`, 1400, 933],
  ['plano-novia-mostrador', `Elegant bridal-shop counter, EMPTY of people: tablet on a stand (screen slightly out of focus showing the app), garment bags on a rack, fresh flowers.`, 1400, 933],
  ['plano-novia-linea', `A corner of the bridal shop set for catalog photos, EMPTY of people: a gown on a mannequin in front of a clean backdrop, softbox light, camera on tripod.`, 1400, 933],
];
const PRODUCTS = [
  ['novia-princesa', 'White princess-cut wedding gown with full tulle skirt on invisible mannequin'],
  ['novia-sirena', 'Ivory mermaid-cut wedding gown with lace details on invisible mannequin'],
  ['novia-xv', 'Pink quinceañera ballgown with embroidered bodice on invisible mannequin'],
  ['novia-fiesta', 'Long emerald evening gown on invisible mannequin'],
];
const PSTYLE = 'Clean e-commerce product photo, soft even studio light, plain very light gray background, photorealistic fabric texture, no logos, no text, no person.';

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
  ...SCENES.map(([f, p, w, h]) => () => gen(f, `${p}\n\n${STYLE}`, '1536x1024', w, h)),
  ...PRODUCTS.map(([f, p]) => () => gen(f, `${p}. ${PSTYLE}`, '1024x1536', 700, 1050)),
];
for (let i = 0; i < work.length; i += 4) await Promise.all(work.slice(i, i + 4).map(fn => fn()));
console.log('LISTO');
