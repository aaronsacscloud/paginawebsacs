import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
const IMG = 'public/images/flujo/alt';
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const PRENDA = 'a sleeveless V-neck midi slip dress in deep terracotta rust satin with a subtle side slit';
const BASE = 'Photorealistic, no logos, no brand names, no readable text anywhere, editorial retail photography, warm natural light, slight film grain.';
// Las pantallas van VACÍAS y planas a propósito: encima se compone la captura
// real de Sacs. Una interfaz dibujada por la IA siempre sale ilegible.
const PANTALLAS = 'Every screen in the frame is completely BLANK — a flat, evenly lit light grey surface with absolutely no interface, no icons, no windows and no text.';

const IDEAS = [
  ['b05-mostrador', `A boutique counter in a warm Mexican shop, shot from a three-quarter angle slightly above: an open laptop on the left, a tablet propped upright in the centre, and a phone leaning against a small wooden stand on the right — three devices side by side on the wooden counter. ${PANTALLAS} Just behind the counter, slightly out of focus, ${PRENDA} hangs on a slim rack. Late afternoon light. ${BASE}`],
  ['b07-empaque', `Close-up over a boutique counter, shallow depth of field: two hands carefully folding ${PRENDA} into cream tissue paper, a kraft paper shopping bag waiting beside them. In the background, out of focus, a tablet stands propped on a small stand facing the camera. ${PANTALLAS} Warm light from a window on the left. ${BASE}`],
];
await fs.mkdir(IMG, { recursive: true });
for (const [file, prompt] of IDEAS) {
  const out = path.join(IMG, `${file}.webp`);
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: 'high' });
    await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1500, 1000, { fit: 'cover' }).webp({ quality: 88 }).toFile(out);
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
