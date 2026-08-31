// El flujo insignia: de la foto que TÚ tomas, a tus variantes, a la modelo,
// al reel. Es la misma prenda en los cuatro pasos — la continuidad ES el
// argumento, así que el vestido se describe idéntico en los cuatro prompts.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images/flujo');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();

const PRENDA = 'a sleeveless V-neck midi slip dress in deep terracotta rust satin with a subtle side slit';
const BASE = 'Photorealistic, no logos, no brand names, no readable text anywhere, dark neutral background #0B0B12 tones, single warm key light, editorial fashion photography, slight film grain.';

const PASOS = [
  ['01-tu-foto', `${PRENDA} hanging on a simple wooden hanger against a plain wall inside a small Mexican boutique — an ordinary phone snapshot taken by the shop owner: slightly uneven framing, ambient store light, a rack edge visible. Honest and unglamorous, NOT a studio shot. ${BASE}`],
  ['02-variantes', `A clean horizontal row of FIVE identical ${PRENDA}, each in a different solid color — rust, sage green, black, cream, lilac — all photographed identically on invisible mannequins, evenly spaced on a seamless dark backdrop. Catalog grid feeling, perfectly consistent lighting across all five. ${BASE}`],
  ['03-modelo', `A striking Mexican female model wearing ${PRENDA}, full-length editorial pose, confident stance, dramatic single key light carving her silhouette from a deep dark background. High fashion campaign quality. ${BASE}`],
  ['04-reel', `Vertical 9:16 fashion campaign frame: a professionally dressed Mexican woman wearing ${PRENDA}, standing and walking forward toward the camera in a well-lit studio, full-length, modest and elegant posture, arms relaxed. Composed like a frame from a short brand video. ${BASE}`],
];

await fs.mkdir(IMG, { recursive: true });
for (const [file, prompt] of PASOS) {
  const out = path.join(IMG, `${file}.webp`);
  try { await fs.access(out); console.log('skip', file); continue; } catch {}
  try {
    const vertical = file.startsWith('04');
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size: vertical ? '1024x1536' : '1536x1024', quality: 'high' });
    const im = sharp(Buffer.from(r.data[0].b64_json, 'base64'));
    await (vertical ? im.resize(1000, 1500, { fit: 'cover' }) : im.resize(1500, 1000, { fit: 'cover' }))
      .webp({ quality: 88 }).toFile(out);
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
