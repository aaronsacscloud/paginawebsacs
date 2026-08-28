import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const NOTEXT = 'HARD RULE: every garment in frame is PLAIN SOLID COLOR with no print, no lettering, no logo.';

// 1) resuelto = EDIT sobre hoy → misma cara, mismo pelo rizado voluminoso
try {
  const hoyPng = await sharp(path.join(IMG, 'suite-merch-hoy.webp')).png().toBuffer();
  const r = await openai.images.edit({
    model: 'gpt-image-2',
    image: await toFile(hoyPng, 'hoy.png', { type: 'image/png' }),
    prompt: `Keep the EXACT same man — identical face, identical voluminous curly dark hair, sparse beard, left-ear earring, plain black tee, lanyard. Change the scene: he now stands calm and confident beside a lit concert merch booth at night, holding a tablet whose screen shows a clean point-of-sale app (grid of plain-tee thumbnails, blue accents), orderly line and wall of PLAIN solid-color t-shirts behind. ${NOTEXT}`,
    size: '1536x1024', quality: 'medium',
  });
  await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1400, 933, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, 'suite-merch-resuelto.webp'));
  console.log('ok suite-merch-resuelto');
} catch (e) { console.error('FALLO resuelto:', e?.message || e); }

// 2) corte con billetes mexicanos correctos
try {
  const r = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `After the show, house lights on at a quiet concert merch booth: the merch manager reviewing a tablet whose screen shows a clean cash-closing summary (rows of totals, blue accents, slightly out of focus), while a colleague counts a small stack of MEXICAN banknotes into a cash drawer — ONLY blue 500-peso and red 100-peso bills, colorful Mexican currency, absolutely NOT green US dollars, no invented denominations. Sealed brown boxes behind. ${NOTEXT}\n\nPhotorealistic documentary photo, real Mexican people, night venue light, no logos, no readable text, editorial concert-merch photography.`,
    size: '1536x1024', quality: 'medium',
  });
  await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1400, 933, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, 'caso-merch-corte.webp'));
  console.log('ok caso-merch-corte');
} catch (e) { console.error('FALLO corte:', e?.message || e); }
console.log('LISTO');
