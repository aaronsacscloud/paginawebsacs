// Hero para tab "Embudo y seguimiento de ventas"
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_PATH = path.join(SITIO, 'public/images/partner-tabs/embudo.webp');

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
A 35-year-old Mexican Customer Success agent (woman) sitting at a clean modern desk in a small CDMX office, wearing a simple casual blazer and headset. She is smiling warmly while in mid-conversation, looking at her laptop screen (screen angled away from camera, no UI visible). On the desk: a notebook with hand-written notes (illegible squiggles), a ceramic coffee cup, a small succulent plant, a tablet face-down. Behind her: a soft-focused open-plan office with another team member typing in the background, plants on shelves, exposed brick wall.

The mood is "we are the team taking care of every conversation behind your link" — capable, warm, professional, real.

Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light from a large window on the left, slight film grain, accurate skin tones, no AI smoothing or gloss. No legible text, no logos, no brand names. 16:9 cinematic editorial framing.`;

const openai = new OpenAI();
console.log('→ embudo hero (gpt-image-2)…');
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
console.log(`  ✓ embudo.webp · ${(stat.size / 1024).toFixed(0)} KB`);
