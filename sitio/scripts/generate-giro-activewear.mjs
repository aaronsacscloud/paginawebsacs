// Fotos del giro Activewear — showroom luminoso, colorways sólidos, cero texto.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const STYLE = 'Photorealistic documentary photo, real Mexican women and men with natural skin texture, ages 20-45, bright natural light, slight film grain, no logos, no brand names, no readable text anywhere, candid, editorial athleisure-brand photography. All activewear garments are PLAIN solid colors (sage green, lilac, black, cream) with no prints or lettering. Any tablet or laptop screen shows a clean modern retail app with product tiles and blue accents, never blank.';
const TABLET = 'tablet screen visible showing the retail app';
const SHOW = 'Bright minimal showroom of a Mexican activewear brand: garment racks organized by solid colorway (sage, lilac, black), large mirror, concrete floor, plants';

const SCENES = [
  ['verticales/activewear', `${SHOW}. The 30s woman founder arranging matching top-and-legging sets on a rack, daylight.`, 800, 534],
  ['hero-active', `${SHOW}. The 30s founder arranging sets by colorway on the rack, a customer browsing behind, tablet on the counter (${TABLET}).`, 1400, 933],
  ['suite-active-hoy', `A 32-year-old Mexican woman, straight dark hair in a high ponytail, cream hoodie, among open cardboard boxes of folded activewear counting pieces with a worn notebook and pen, slightly stressed, warehouse corner light. NO tablet, NO phone — paper only.`, 1400, 933],
  ['suite-active-resuelto', `The same 32-year-old Mexican woman, straight dark hair in a high ponytail, cream hoodie, calm at the showroom counter checking a tablet (${TABLET}), tidy racks behind, daylight.`, 1400, 933],
  ['suite-active-tienda', `Very wide shot of a large bright activewear showroom in Mexico: long racks by solid colorway, folded stacks on shelves, two customers, daylight through big windows.`, 1400, 933],
  ['caso-active-drop', `The founder and an assistant at a laptop launching the online drop at night, the new sage colorway rack behind them, screen with a clean product-grid app (blue accents, out of focus), focused energy.`, 1400, 933],
  ['caso-active-set', `A folding table with matching top-and-legging sets paired by color, one lone legging set apart to the side, hands of an employee pairing pieces, daylight.`, 1400, 933],
  ['caso-active-cambio', `A customer trying a plain sage sports top in front of the showroom mirror while a saleswoman checks sizes on a tablet (${TABLET}).`, 1400, 933],
  ['caso-active-restock', `The founder reviewing size-demand data on a tablet (${TABLET}) next to newly arrived cardboard boxes of the restock, warehouse light.`, 1400, 933],
  ['proc-active-1', `A consultant with a laptop and the founder reviewing the colorway catalog next to the rack, morning light.`, 1400, 933],
  ['proc-active-2', `The founder configuring her online store on a laptop at the showroom counter, the screen showing a clean storefront grid (out of focus), plants around.`, 1400, 933],
  ['proc-active-3', `Small team training before opening: three employees around the counter watching a trainer hold a tablet (${TABLET}), hands correct, racks behind.`, 1400, 933],
  ['proc-active-4', `First sale of the day: cashier charging a customer buying a sage set at the counter, ${TABLET} on a stand.`, 1400, 933],
  ['proc-active-5', `The founder at night watching her drop sell in real time on a tablet (${TABLET}), soft desk light, satisfied.`, 1400, 933],
  ['plano-active-showroom', `Activewear showroom floor, EMPTY of people: racks by solid colorway generously spaced, large mirror, bench, folded stacks on shelves, daylight.`, 1400, 933],
  ['plano-active-probador', `Fitting room of the showroom, EMPTY of people: curtain, mirror, hook with a plain sage set hanging, small bench.`, 1400, 933],
  ['plano-active-bodega', `Small warehouse and packing area of the brand, EMPTY of people: shelves of folded activewear by size, packing table with mailer bags and labels.`, 1400, 933],
  ['plano-active-mostrador', `Showroom counter, EMPTY of people: tablet on a stand (screen slightly out of focus with the app), brand mailer bags, a folded set ready, small plant.`, 1400, 933],
  ['plano-active-linea', `Product-photo corner of the brand, EMPTY of people: a plain sage set on a hanger against a clean backdrop, ring light, phone on tripod.`, 1400, 933],
];
const PRODUCTS = [
  ['active-top', 'Plain sage green sports bra top, solid color, no logos, flat lay'],
  ['active-legging', 'Plain sage green high-waist leggings, solid color, no logos, flat lay'],
  ['active-biker', 'Plain sage green biker shorts, solid color, no logos, flat lay'],
  ['active-sudadera', 'Plain sage green oversized hoodie, solid color, no logos, flat lay'],
];
const PSTYLE = 'Clean e-commerce product photo, soft even studio light, plain very light gray background, photorealistic fabric texture, no logos, no text, no person.';
async function gen(file, prompt, size, w, h) {
  const out = path.join(IMG, `${file}.webp`);
  try { await fs.access(out); console.log(`skip ${file}`); return; } catch {}
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size, quality: 'medium' });
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(w, h, { fit: 'cover' }).webp({ quality: 85 }).toFile(out);
    console.log(`ok ${file}`);
  } catch (e) { console.error(`FALLO ${file}: ${e?.message || e}`); }
}
const work = [
  ...SCENES.map(([f, p, w, h]) => () => gen(f, `${p}\n\n${STYLE}`, '1536x1024', w, h)),
  ...PRODUCTS.map(([f, p]) => () => gen(f, `${p}. ${PSTYLE}`, '1024x1536', 700, 1050)),
];
for (let i = 0; i < work.length; i += 4) await Promise.all(work.slice(i, i + 4).map(fn => fn()));
console.log('LISTO');
