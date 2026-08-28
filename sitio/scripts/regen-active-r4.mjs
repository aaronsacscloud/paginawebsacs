import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
try {
  const png = await sharp(path.join(IMG, 'suite-active-resuelto.webp')).png().toBuffer();
  const r = await openai.images.edit({
    model: 'gpt-image-2',
    image: await toFile(png, 'res.png', { type: 'image/png' }),
    prompt: `Keep everything identical — same woman, expression, pose, showroom. Change ONLY the tablet screen's text: make any words soft and OUT OF FOCUS beyond legibility (no readable "Products" or any word), keeping the blue header bar and garment thumbnails. Also smooth the waxy retouch on her forehead into natural skin.`,
    size: '1536x1024', quality: 'medium',
  });
  await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1400, 933, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, 'suite-active-resuelto.webp'));
  console.log('ok resuelto');
} catch (e) { console.error('FALLO:', e?.message || e); }
console.log('LISTO');
