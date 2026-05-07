// Imágenes cover para las 5 certificaciones de partner.
// Output: sitio/public/images/certificaciones/<id>.webp (1200×900 ~ 4:3)

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/certificaciones');

const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;

const STYLE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or gloss. Subjects are real Mexican / Latin American people, ages 25-45. No legible text, no logos, no brand names anywhere. 4:3 framing.';

const ITEMS = [
  {
    file: 'impl-una-sucursal',
    prompt: `Inside a small bright Mexican boutique. A 32-year-old Latin partner-consultant (woman) standing at the counter beside the boutique owner (40s woman), both looking at a tablet on the counter (screen angled away from camera). The consultant gestures at the tablet explaining something simple. Warm late-morning light through the storefront, neat clothing displays softly out of focus behind. Calm, capable, "I'm setting this up for you" mood.`,
  },
  {
    file: 'impl-multisucursal',
    prompt: `Inside a modern Mexican corporate office, a 35-year-old Latin partner (man, casual blazer) presenting on a laptop to three executives seated around a meeting table. The laptop screen faces away from camera (no UI visible). On the wall behind: a large abstract diagram drawn with markers on a glass wall (illegible squiggles representing branch network). Late afternoon light, plants. Confident, executive, "I run multi-store implementations" mood.`,
  },
  {
    file: 'migracion-datos',
    prompt: `Close environmental shot of a 30-year-old Latin partner (woman) at a clean wood desk surrounded by stacks of old paper records on her left and a laptop on her right (laptop screen angled away). She holds one paper, mid-thought, comparing it to her screen. Warm window light, exposed brick wall, a coffee cup, plants. Methodical, careful, "I'm migrating their entire history without losing a record" mood.`,
  },
  {
    file: 'ia-automatizacion',
    prompt: `A 33-year-old Latin partner (man) at a sleek modern home office desk in CDMX, two external monitors visible at angles where their screens are not legible from camera (could show abstract shapes). He is mid-thought, hand on chin, a notebook with hand-written squiggles on the desk, a large plant beside the desk, warm window light. Tech-forward but human, "I am architecting an AI workflow for a client" mood.`,
  },
  {
    file: 'consultor-ia',
    prompt: `A 38-year-old Latin partner-consultant (woman) sitting across a small wood meeting table from a 50-something Mexican shop owner. Both leaning over a tablet between them on the table (the tablet is angled — screen shows soft abstract chart shapes, no readable text). She is gesturing at the tablet, the owner is nodding thoughtfully. Warm interior of a small business with shelving softly out of focus. Trusted advisor, "we look at your numbers together every month" mood.`,
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
