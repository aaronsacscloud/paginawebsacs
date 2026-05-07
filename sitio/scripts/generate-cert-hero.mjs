// Genera imagen hero "wow" para teaser de certificaciones en la invitación.
// Output: sitio/public/images/partner-cert-hero.webp

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_PATH = path.join(SITIO, 'public/images/partner-cert-hero.webp');

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

const PROMPT = `Wide environmental editorial photograph, photorealistic documentary style.
A 35-year-old Latin American woman partner-consultant standing inside a bright modern Mexican boutique on a real workday. She is mid-conversation with the boutique owner (40s woman, Mexican, calm expression), gesturing at a laptop screen on the counter. The laptop screen is angled away from camera (no readable UI). Both are dressed professionally but warmly — no suits, just real working attire.

Late-afternoon sun streaming through the storefront. Warm wood shelves with neatly displayed clothing or accessories blurred behind. Real architectural details — exposed brick column, plants. The mood is collaborative, confident, generous: "I know what I'm doing and I'm here to help".

Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing. Subjects look real. No legible text or logos anywhere. 16:9 cinematic framing.`;

const openai = new OpenAI();

console.log('→ generando partner-cert-hero (gpt-image-2, high quality)…');
const resp = await openai.images.generate({
  model: 'gpt-image-2',
  prompt: PROMPT,
  size: '1536x1024',
  quality: 'high',
});
const b64 = resp.data?.[0]?.b64_json;
if (!b64) { console.error('Sin b64'); process.exit(1); }
const png = Buffer.from(b64, 'base64');

const sharp = (await import('sharp')).default;
await sharp(png)
  .resize(1600, 900, { fit: 'cover' })
  .webp({ quality: 88 })
  .toFile(OUT_PATH);

const stat = await fs.stat(OUT_PATH);
console.log(`  ✓ partner-cert-hero.webp · ${(stat.size / 1024).toFixed(0)} KB`);
