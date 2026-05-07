// Genera heroes fotográficos LatAm para cada tab de la invitación de partners.
// Output: sitio/public/images/partner-tabs/<id>.webp (16:9 high-quality)

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/partner-tabs');

const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const envMap = Object.fromEntries(
  envText.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || envMap.OPENAI_API_KEY;

const STYLE = `Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or gloss, real candid moments. Subjects are real Mexican / Latin American people of varied ages 25-55. No legible text, no logos, no brand names anywhere. 16:9 cinematic editorial framing.`;

const ITEMS = [
  {
    id: 'bienvenida',
    prompt: `A 35-year-old Mexican woman entrepreneur standing in front of her own warm-lit boutique at golden hour. Calm confident expression looking just past the camera. Hands relaxed at her sides, simple modern clothing. The boutique window behind shows softly lit interior with plants and neatly arranged displays (no readable text). Street-level shot, late afternoon golden light, candid welcoming moment. The mood is "we are glad you are here".`,
  },
  {
    id: 'proceso',
    prompt: `Two Mexican professionals — a man (early 30s) and a woman (40s) — sitting at a clean wood table in a modern airy CDMX coworking space. Mid-conversation, lightly smiling. A laptop closed beside them, a leather notebook open with a pen, two ceramic coffee cups, a small plant. Warm window light from the left, exposed brick column blurred behind. The mood is "the agreement is being figured out together".`,
  },
  {
    id: 'terminos',
    prompt: `Close environmental editorial shot of a clean light-wood table in a modern Mexican office. On the table: a printed multi-page document (the type appears as plain dark paragraphs without legible text), a sleek black pen, two ceramic coffee cups, a small succulent plant in a clay pot. Two pairs of hands resting on the table — one Latin American man's hands (40s, slight tan) and one Latin American woman's hands (30s). Soft late-morning window light from left, slight film grain, very real, no AI gloss. The mood is "everything is on the table, nothing hidden".`,
  },
  {
    id: 'compromisos',
    prompt: `A 30-year-old Mexican woman content creator standing inside her own small boutique, holding her phone vertically in front of her at chest level (the phone screen is angled away from camera, no UI visible) — clearly recording a short video for social media about her business. Confident professional posture, warm modern clothing, slight smile. Behind her: clothing or accessory displays softly out of focus, warm pendant lighting, plants. Mid-action candid moment. The mood is "I am proud to represent this".`,
  },
  {
    id: 'contenido',
    prompt: `A 28-year-old Mexican woman creator sitting on a wooden floor in her bright Mexican apartment, back leaning against a sofa, laptop open on her lap (the laptop screen is angled away from camera). She is mid-thought, eyes on the screen, one hand near the trackpad. A coffee mug on the floor beside her, a notebook with hand-written squiggles (no legible text), a small plant in the background. Warm late-afternoon light through a window. The mood is "creating something good takes focus and care".`,
  },
  {
    id: 'firma',
    prompt: `A wide editorial shot of two Mexican professionals — a 35-year-old woman in casual blazer and a 50-something man with relaxed business attire — standing on either side of a clean wood meeting table, smiling warmly mid-handshake. The handshake is the visual focus. Behind them: a modern Mexican office space with exposed brick, plants, large window with soft daylight. The mood is welcoming, real, generous — the moment of "welcome to the team".`,
  },
];

await fs.mkdir(OUT_DIR, { recursive: true });
const openai = new OpenAI();

async function genOne(item) {
  const outPath = path.join(OUT_DIR, `${item.id}.webp`);
  try { await fs.access(outPath); console.log(`✓ skip ${item.id}`); return; } catch {}
  const fullPrompt = `${item.prompt}\n\n${STYLE}`;
  console.log(`→ ${item.id}…`);
  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: fullPrompt,
      size: '1536x1024',
      quality: 'high',
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error('sin b64');
    const png = Buffer.from(b64, 'base64');
    const sharp = (await import('sharp')).default;
    await sharp(png)
      .resize(1600, 900, { fit: 'cover' })
      .webp({ quality: 88 })
      .toFile(outPath);
    const stat = await fs.stat(outPath);
    console.log(`  ✓ ${item.id}.webp · ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.error(`  ✗ ${item.id}:`, e?.message || e);
  }
}

// Paralelo (la API permite varios concurrentes a la vez)
await Promise.all(ITEMS.map(genOne));
console.log('\nDone.');
