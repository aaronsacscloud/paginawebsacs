// Fotos del giro Consignación — mismo estándar: gente mexicana real, luz
// natural, cero texto legible, pantallas SIEMPRE con app de POS creíble.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();

const STYLE = 'Photorealistic documentary photo, real Mexican people with natural skin texture, ages 28-55, natural light, slight film grain, no logos, no brand names, no readable text anywhere, candid, editorial retail photography. Any tablet or phone screen shows a clean modern retail point-of-sale app with clothing product thumbnails and blue accents, never blank.';
const TABLET = 'tablet screen visible showing the point-of-sale app with clothing thumbnails';
const TIENDA = 'Elegant Mexican consignment / preloved fashion store: curated garment racks with unique designer pieces, a display shelf of luxury handbags, warm minimal interior, plants, travertine-and-wood counter';

const SCENES = [
  ['verticales/consignacion', `${TIENDA}. A 40s Mexican woman owner arranging a single silk dress on a curated rack, handbag shelf behind, daylight.`, 800, 534],
  ['hero-consig', `${TIENDA}. The 40s woman owner attaching a small blank hang tag with a string to a silk dress on a curated rack, a shelf of pre-owned designer handbags beside her, daylight. No devices, no cables.`, 1400, 933],
  ['suite-consig-hoy', `A 45-year-old Mexican woman, straight dark hair in a low bun, burgundy blouse, in the back room of her consignment store surrounded by shopping bags and boxes of received garments, flipping through a worn paper notebook, slightly overwhelmed, warm light. NO tablet, NO phone, NO computer — only the notebook.`, 1400, 933],
  ['suite-consig-resuelto', `A 45-year-old Mexican woman, straight dark hair in a low bun, burgundy blouse, calm at the counter of her tidy consignment store, showing a ${TABLET} to a customer, daylight.`, 1400, 933],
  ['suite-consig-tienda', `Very wide shot of a large, bright consignment fashion store in Mexico: long curated racks of unique pieces, handbag display wall, a small live-streaming corner with a ring light, two customers browsing, daylight.`, 1400, 933],
  ['caso-consig-maletas', `A Mexican woman in her 30s handing garments from two open suitcases to the 45-year-old store owner across a reception counter; the owner inspects a silk dress, tablet on the counter (${TABLET}).`, 1400, 933],
  ['caso-consig-live', `A young Mexican saleswoman doing a live-stream sale in a corner of the consignment store: a phone mounted inside a ring light with its SCREEN facing the viewer and its camera facing HER, she holds up a dress toward the phone, rack of assigned pieces beside her, both hands anatomically correct. Neutral daylight white balance matching a clean editorial series.`, 1400, 933],
  ['caso-consig-autentica', `The 45-year-old owner carefully examining the plain gold clasp and stitching of a quilted leather handbag with a jeweler's loupe at the counter, white gloves on, focused expression, daylight. The bag has completely GENERIC unbranded hardware: plain rectangular clasp, absolutely no logos, no interlocking letters, no monograms.`, 1400, 933],
  ['caso-consig-cuenta', `A 35-year-old Mexican woman at a cafe checking her phone with a slight smile; the phone screen shows a clean account-statement app with a list and a blue balance card, slightly out of focus.`, 1400, 933],
  ['proc-consig-1', `A consultant with a laptop and the 45-year-old consignment store owner reviewing a handwritten list of pieces next to a curated rack, morning light.`, 1400, 933],
  ['proc-consig-2', `The 45-year-old owner and a consultant at a small desk reviewing a printed contract template, shelves with folded garments and handbag boxes behind, daylight.`, 1400, 933],
  ['proc-consig-3', `Small team training before opening: three store employees around the counter watching a trainer hold a ${TABLET}, both her hands fully visible and anatomically correct, morning light.`, 1400, 933],
  ['proc-consig-4', `First sale of the day at the consignment store: young cashier at the counter handing a kraft paper bag to a smiling customer, a teammate beside her, a single ${TABLET} on a stand — exactly one device in frame, no scanners, no phones.`, 1400, 933],
  ['proc-consig-5', `The 45-year-old owner at the counter showing a ${TABLET} to a smiling 30s customer (a consignor), both relaxed, the statement-like screen slightly out of focus, warm light.`, 1400, 933],
  ['plano-consig-piso', `Sales floor of an ELEGANT consignment store, completely EMPTY of people: curated brass racks with unique garments generously spaced, a lit shelf of pre-owned designer handbags, a full-length mirror. Absolutely no people, no hands, empty store before opening, daylight.`, 1400, 933],
  ['plano-consig-recepcion', `Valuation table at the consignment store: a quilted handbag, jeweler's loupe, white cotton gloves, measuring tape, tag gun, and a tablet on a stand (${TABLET}, slightly out of focus), no people.`, 1400, 933],
  ['plano-consig-bodega', `Tidy custody storage room of a consignment store, completely EMPTY of people: labeled archive boxes on wooden shelves, garments in clear garment bags on a rolling rack. Absolutely no people, no hands, empty room, soft daylight.`, 1400, 933],
  ['plano-consig-mostrador', `Checkout counter of the consignment store in wood and travertine: tablet on a stand (screen slightly out of focus showing the POS), kraft bags, tissue paper, a wrapped garment, no people.`, 1400, 933],
  ['plano-consig-linea', `Live-streaming and packing corner of the store: phone on tripod with ring light, small clothing rack with assigned pieces, packing table with kraft boxes and tissue, no people, daylight.`, 1400, 933],
];
const PRODUCTS = [
  ['consig-bolsa', 'Pre-owned camel leather designer handbag, structured, gold hardware'],
  ['consig-vestido', 'Pre-owned black silk evening dress on invisible mannequin'],
  ['consig-zapatos', 'Pre-owned designer high-heel pumps, nude leather, pair'],
  ['consig-abrigo', 'Pre-owned camel wool coat on invisible mannequin'],
];
const PSTYLE = 'Clean e-commerce product photo, soft even studio light, plain very light gray background, photorealistic texture with gentle signs of careful previous use, no logos, no text, no person.';

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
