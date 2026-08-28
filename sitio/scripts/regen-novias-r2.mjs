import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const STYLE = 'Photorealistic documentary photo, real Mexican people with natural skin texture, soft bright natural light, slight film grain, no logos, no readable text anywhere, candid, elegant editorial bridal-shop photography. Hands anatomically correct with five separated fingers — count the hands: each person has exactly two.';
const JOBS = [
  ['plano-novia-probador', `Large fitting area of an elegant Mexican bridal shop, completely EMPTY of people, no hands, empty room before opening: triple mirror, low round platform, velvet bench, one white gown hanging ready on a hook, soft daylight.`],
  ['caso-novia-abonos', `A Mexican father in his 50s at the bridal-shop counter handing colorful MEXICAN peso banknotes (blue 500 and red 100 tones — NOT green US dollars) to the cashier, who registers the payment on a tablet whose screen shows a clean payment app with blue accents; garment bags behind. The father has exactly two hands, both visible and correct.`],
];
for (const [file, prompt] of JOBS) {
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${prompt}\n\n${STYLE}`, size: '1536x1024', quality: 'medium' });
    await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1400, 933, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, `${file}.webp`));
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
