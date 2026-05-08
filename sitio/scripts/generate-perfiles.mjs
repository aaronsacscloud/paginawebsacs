// Imágenes de perfiles arquetipo: influencer, consultor, distribuidor,
// emprendedor desde cero, dueño de tienda. Para la sección "Para quién es"
// en la invitación de partners.

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/partner-perfiles');

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

const STYLE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or gloss. Subjects are real Mexican / Latin American people of varied ages 25-55. No legible text, no logos, no brand names anywhere. 4:3 framing.';

const ITEMS = [
  {
    file: 'perfil-influencer',
    prompt: `A 28-year-old Mexican woman in casual stylish clothes, sitting on the floor of her bright modern Mexican apartment, holding her phone in a vlogging chest-level position (phone screen angled away from camera, no UI visible). Plants, warm window light, minimalist white-and-wood decor. Mid-laugh, real and unposed. The mood: "I create for my audience and now my audience earns me income."`,
  },
  {
    file: 'perfil-consultor',
    prompt: `A 38-year-old Latin man consultant in a casual blazer, sitting across a clean wood meeting table from a 50-year-old Mexican shop owner woman. Both lean over a laptop on the table (laptop screen angled away from camera, not visible). Warm CDMX office in the background with exposed brick and plants. Mid-conversation, both engaged. The mood: "I help my clients run their business; SACS is one of my tools."`,
  },
  {
    file: 'perfil-distribuidor',
    prompt: `A 35-year-old Latin man wearing a polo shirt and jeans, mid-step walking through the aisles of a medium-size Mexican retail warehouse / distribution center, holding a tablet (angled away, no screen visible) and a clipboard. Wooden shelves with varied stocked product boxes around him, mixed natural and fluorescent light. Operational, capable, real-life. The mood: "I distribute to a network of stores and my reach grows with SACS."`,
  },
  {
    file: 'perfil-emprendedor',
    prompt: `A 30-year-old Mexican woman at a small wood desk in her modest home apartment, laptop open with screen angled away (no UI visible), a notebook with hand-written squiggles (illegible), a coffee mug, plants on the windowsill. Warm afternoon light from the window. She's leaning slightly into the screen, focused but hopeful, casual home clothes — clearly working from home. The mood: "I'm building from zero and I have a real path now."`,
  },
  {
    file: 'perfil-tienda',
    prompt: `A 48-year-old Mexican woman shop owner standing behind the wooden counter of her own small boutique or general store in Mexico, smiling warmly while handing a paper bag to a customer (only customer's torso and arm visible). Counter has a small POS tablet angled away from camera (no UI visible). Real working day, warm interior with shelves of products softly out of focus. The mood: "I run my store and I recommend SACS to other store owners like me."`,
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
