// Imágenes editoriales de los módulos extraordinarios — registro Vogue:
// alta moda mexicana, luz dramática, color saturado por módulo.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images/extraordinarios');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();

const STYLE = 'High-fashion editorial photography, Vogue-style, real Mexican models with natural skin texture, dramatic directional lighting, rich saturated color, shallow depth of field, premium retail interior, cinematic composition, slight film grain. No logos, no brand names, no readable text anywhere. Garments are plain solid colors or subtle abstract prints.';

const JOBS = [
  ['probador', `A striking vertical floor-to-ceiling interactive mirror-screen in a luxury Mexican boutique: a young woman stands before it, and the screen shows HER reflection wearing a different colored dress than the one she has on. Deep violet and magenta light spill, dark polished floor, dramatic editorial mood.`],
  ['fotografia', `Split-scene fashion editorial: on the left, a plain flat-lay garment on a seamless studio backdrop; on the right, the SAME garment worn by a striking Mexican model in a full editorial pose with studio lights. Hot pink and fuchsia gel lighting, high fashion, dramatic.`],
  ['video', `Motion-blur fashion editorial: a Mexican model spinning in a flowing dress, multiple ghosted motion frames layered, captured mid-movement. Vivid orange and amber gel lighting against deep shadow, energetic, cinematic.`],
  ['outfits', `Overhead flat-lay of a complete curated outfit arranged with editorial precision on a deep teal surface: dress, handbag, heels, jewelry, sunglasses, laid out in perfect geometric composition. Teal and emerald tones, luxury magazine styling.`],
  ['lookbooks', `Elegant hands holding a tablet showing a fashion lookbook grid, resting on a marble surface with fabric swatches and a folded silk garment beside it. Cool cobalt blue light, luxury editorial still life.`],
  ['preordenes', `A single exclusive garment on a velvet hanger under a warm spotlight in a dim luxury boutique, with a small blank tag hanging from it. Golden amber light, deep shadows, sense of an exclusive reserved piece, editorial.`],
];

await fs.mkdir(IMG, { recursive: true });
for (const [file, prompt] of JOBS) {
  const out = path.join(IMG, `${file}.webp`);
  try { await fs.access(out); console.log('skip', file); continue; } catch {}
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${prompt}\n\n${STYLE}`, size: '1536x1024', quality: 'high' });
    await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1500, 1000, { fit: 'cover' }).webp({ quality: 88 }).toFile(out);
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
