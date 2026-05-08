// Genera 4 imágenes adicionales de perfiles para la sección "Para quién es":
// nómada digital, contador/fiscalista, distribuidor de tecnología, vendedor de hardware POS.
// Output: sitio/public/images/partner-perfiles/perfil-<id>.webp

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/partner-perfiles');

const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
  const i = l.indexOf('='); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return [l.slice(0, i).trim(), v];
}));
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;

const STYLE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or gloss. Subjects are real Mexican / Latin American people of varied ages 28-50. No legible text, no logos, no brand names anywhere. 4:3 framing.';

const ITEMS = [
  {
    file: 'perfil-nomada',
    prompt: `A 30-year-old Latin man working on his MacBook at a sunlit café in Mexico City's Roma neighborhood, ceramic coffee cup beside him on a wooden table, plants and large windows in the background, casual stylish clothes (t-shirt, light jacket). Mid-typing, focused but relaxed. The mood is "I work from anywhere — today this café, tomorrow somewhere else."`,
  },
  {
    file: 'perfil-contador',
    prompt: `A 42-year-old Latin woman accountant or fiscal advisor, dressed in smart casual professional attire, sitting at a clean desk in a modest CDMX office. She is reviewing a paper printout on the table while a calculator and a closed laptop sit beside her. Warm window light, plants, simple bookshelf with binders blurred behind. Capable, methodical, "I help businesses with their numbers" mood.`,
  },
  {
    file: 'perfil-tecnologia',
    prompt: `A 35-year-old Latin man B2B technology distributor, casual blazer and polo, standing in front of a glass meeting room of a modern Mexican corporate office. He holds a tablet (angled away from camera, no UI visible) and is mid-conversation with another professional whose back is partially visible. Modern interior with soft natural light from floor-to-ceiling windows. The mood is "I sell software and tech solutions to companies".`,
  },
  {
    file: 'perfil-hardware',
    prompt: `A 38-year-old Latin man hardware sales rep wearing a polo shirt with a small lanyard (no logo visible), standing inside a small electronics or POS hardware showroom in Mexico. Behind him on shelves: stacked boxes of electronic equipment, a few floor-display POS terminals with screens off (no UI). He's mid-explanation, hand gesturing toward a piece of equipment. Fluorescent + natural light mix. The mood is "I sell the physical equipment that runs the operation".`,
  },
];

await fs.mkdir(OUT_DIR, { recursive: true });
const openai = new OpenAI();

async function genOne(item) {
  const outPath = path.join(OUT_DIR, `${item.file}.webp`);
  try { await fs.access(outPath); console.log(`✓ skip ${item.file}`); return; } catch {}
  const fullPrompt = `${item.prompt}\n\n${STYLE}`;
  console.log(`→ ${item.file}…`);
  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: fullPrompt,
      size: '1024x1024',
      quality: 'high',
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error('sin b64');
    const png = Buffer.from(b64, 'base64');
    const sharp = (await import('sharp')).default;
    await sharp(png)
      .resize(1200, 900, { fit: 'cover' })
      .webp({ quality: 88 })
      .toFile(outPath);
    const stat = await fs.stat(outPath);
    console.log(`  ✓ ${item.file}.webp · ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.error(`  ✗ ${item.file}:`, e?.message || e);
  }
}

await Promise.all(ITEMS.map(genOne));
console.log('\nDone.');
