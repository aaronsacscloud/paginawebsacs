import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const PAL = 'HARD RULES: all garments in scene AND inside any screen are PLAIN solid sage green, lilac, black or cream ONLY — no prints, no logos, no other colors, no floral patterns. Any app screen has a BLUE header and shows only those colorways. No caps with patches. Clean neutral daylight.';
const STYLE = 'Photorealistic documentary photo, real Mexican people, natural skin texture, bright neutral daylight, slight film grain, no logos, no readable text, candid editorial athleisure photography.';
const TAB = 'tablet screen showing a clean retail app with BLUE header and product tiles of plain sage/lilac/black/cream activewear';

async function save(buf, file, w, h) {
  await sharp(buf).resize(w, h, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, `${file}.webp`));
  console.log('ok', file);
}
// resuelto = EDIT sobre hoy (misma cara)
try {
  const hoyPng = await sharp(path.join(IMG, 'suite-active-hoy.webp')).png().toBuffer();
  const r = await openai.images.edit({
    model: 'gpt-image-2',
    image: await toFile(hoyPng, 'hoy.png', { type: 'image/png' }),
    prompt: `Keep the EXACT same woman — identical face, high ponytail, cream hoodie. Change the scene: she now stands calm at the bright showroom counter checking a ${TAB}, tidy racks of plain sage/lilac/black garments behind, daylight. ${PAL}`,
    size: '1536x1024', quality: 'medium',
  });
  await save(Buffer.from(r.data[0].b64_json, 'base64'), 'suite-active-resuelto', 1400, 933);
} catch (e) { console.error('FALLO resuelto:', e?.message || e); }

const JOBS = [
  ['hero-active', `Bright minimal Mexican activewear showroom: the 30s founder arranging plain sage sets on an intact simple metal rack (normal hangers, no tangled wire), a customer browsing behind, ${TAB} on the counter. ${PAL}`, 1400, 933],
  ['verticales/activewear', `Bright minimal activewear showroom: the 30s founder arranging matching plain sage top-and-legging sets on a rack, NO mirrors in frame, racks of lilac and black behind, daylight. ${PAL}`, 800, 534],
  ['suite-active-tienda', `Very wide shot of a large bright activewear showroom in Mexico at midday: long racks by solid colorway (sage, lilac, black, cream), folded stacks, two customers, big windows, clean NEUTRAL daylight (not golden hour). A laptop on the counter shows an app with BLUE header. ${PAL}`, 1400, 933],
  ['caso-active-set', `A folding table with matching plain sage top-and-legging sets paired by size, one lone sage legging set apart, the hands of a bare-headed employee pairing pieces, a ${TAB} propped beside showing ONLY sage/lilac/black/cream tiles. No caps, no hats. ${PAL}`, 1400, 933],
  ['proc-active-4', `First sale of the day: cashier at the showroom counter charging a customer who holds a SIMPLE folded plain sage legging (a clearly recognizable folded garment, no straps or cords), ${TAB} on a stand. ${PAL}`, 1400, 933],
  ['proc-active-5', `The 32-year-old Mexican founder (dark hair, high ponytail) at night watching her drop sell in real time on a ${TAB} — the screen shows ONLY plain sage/lilac/black/cream garments with a blue header — soft desk light. ${PAL}`, 1400, 933],
  ['plano-active-showroom', `Activewear showroom floor, completely EMPTY of people, no hands: racks by solid colorway generously spaced, large mirror reflecting only the racks, bench, folded stacks, daylight. ${PAL}`, 1400, 933],
  ['plano-active-bodega', `Small warehouse and packing area of the brand, completely EMPTY of people: shelves of folded plain activewear by size, packing table with mailer bags and blank labels, a tablet on the table with the BLUE-header app slightly out of focus. ${PAL}`, 1400, 933],
];
for (const [file, prompt, w, h] of JOBS) {
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${prompt}\n\n${STYLE}`, size: '1536x1024', quality: 'medium' });
    await save(Buffer.from(r.data[0].b64_json, 'base64'), file, w, h);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
