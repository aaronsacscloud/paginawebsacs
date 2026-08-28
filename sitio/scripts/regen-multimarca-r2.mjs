// Ronda 2 de fotos: identidad de la cortina vía images.edit + 5 regeneraciones
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();

const STYLE = 'Photorealistic documentary photo, real Mexican people with natural skin texture, natural light, slight film grain, no logos, no brand names, no readable text anywhere, candid, editorial retail photography.';
const TABLET = 'tablet screen showing a clean modern retail point-of-sale app with a soft grid of clothing product thumbnails (recognizable garments: dresses, blouses, jeans in muted colors) and blue accents';

async function save(buf, file, w, h) {
  await sharp(buf).resize(w, h, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, `${file}.webp`));
  console.log('ok', file);
}

// 1) resuelto = EDIT sobre "hoy" para conservar la cara
try {
  const hoyPng = await sharp(path.join(IMG, 'suite-multi-hoy.webp')).png().toBuffer();
  const r = await openai.images.edit({
    model: 'gpt-image-2',
    image: await toFile(hoyPng, 'hoy.png', { type: 'image/png' }),
    prompt: `Keep the EXACT same woman — identical face, hairstyle, olive blouse, gold necklace and earrings. Change the scene: she now stands relaxed and confident at the boutique checkout counter (wood and travertine), holding a ${TABLET}, tidy elegant boutique behind her, daylight, calm slight smile, no boxes, no papers. ${STYLE}`,
    size: '1536x1024', quality: 'medium',
  });
  await save(Buffer.from(r.data[0].b64_json, 'base64'), 'suite-multi-resuelto', 1400, 933);
} catch (e) { console.error('FALLO resuelto:', e?.message || e); }

// 2-6) regeneraciones
const jobs = [
  ['caso-multi-consigna', `Inside an upscale Mexican multi-brand boutique, the 40s woman owner showing a ${TABLET} to a male supplier in his 50s next to a rack of dresses; the tablet screen is clearly legible with realistic clothing thumbnails; both relaxed, businesslike, daylight.`],
  ['caso-multi-recepcion', `Back room of a Mexican boutique on delivery day: a 30s employee applying a small white barcode sticker to a folded garment, a compact desktop label printer on the table with a single strip of labels coming out of its single front slot, three open supplier boxes, garments on a rolling rack, natural light. Hands anatomically correct with five separated fingers.`],
  ['proc-multi-2', `The 40s boutique owner and a consultant at a small desk in the back office reviewing printed supplier terms laid flat on the desk; both hands resting naturally on the papers, no pens held in the air, shelves with folded women's garments behind, daylight.`],
  ['proc-multi-3', `Small team training before opening: three boutique employees around the counter watching a trainer hold a ${TABLET} with both hands fully visible and anatomically correct (five separated fingers each), morning light, boutique door still closed.`],
  ['proc-multi-5', `The 42-year-old woman owner of a women's fashion boutique alone in the quiet back room at closing time, reading a ${TABLET}, satisfied expression. Neutral daylight-balanced white light (NOT warm, NOT orange), matching a clean editorial series. Shelves of folded women's garments and a rolling rack of dresses behind.`],
  ['plano-multi-mostrador', `Boutique checkout counter in wood and travertine: a tablet on a stand whose screen shows a point-of-sale app but is slightly OUT OF FOCUS (shallow depth of field, no legible glyphs), kraft bags, tissue paper, small plant, no people, daylight.`],
];
for (const [file, prompt] of jobs) {
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${prompt}\n\n${STYLE}`, size: '1536x1024', quality: 'medium' });
    await save(Buffer.from(r.data[0].b64_json, 'base64'), file, 1400, 933);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
