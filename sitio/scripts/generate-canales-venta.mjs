// Genera 12 imágenes wide environmental para el tab "¿A quién le puedo vender?"
// Output: sitio/public/images/sales-channels/canal-<id>.webp (1600×900)

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/sales-channels');

const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
  const i = l.indexOf('='); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return [l.slice(0, i).trim(), v];
}));
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;

const STYLE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or gloss, no plastic look. People are real Mexican / Latin American adults of varied ages 28-50 with diverse appearances. No legible text, no logos, no brand names visible anywhere. Wide environmental framing, subjects integrated into a real scene, composed for 16:9 ratio. Editorial quality, like a Bloomberg Businessweek or Monocle magazine spread.';

const ITEMS = [
  {
    file: 'canal-visita-tienda',
    prompt: `A 35-year-old Latin man in a casual blazer standing inside a bright independent boutique clothing store in a Mexican city, mid-conversation with the owner (a 40-year-old Latin woman with apron) who is behind the counter. She gestures at the counter where a tablet sits. Daylight from large windows, racks of clothes blurred behind, a few other customers browsing in the deep background. Real working-day energy, not staged. The mood is "I came in to show her something useful for her store".`,
  },
  {
    file: 'canal-enterprise-linkedin',
    prompt: `A 38-year-old Latin woman professional working at her home office desk on a laptop, mid-typing a LinkedIn message visible only as soft glow on her face from the screen. She wears a smart casual button-down. Behind her: tasteful neutral wall, a small bookshelf, a cup of coffee, soft afternoon light through a window. Focused, strategic energy. The mood is "I'm reaching out to a director of operations at a 30-store chain".`,
  },
  {
    file: 'canal-red-personal',
    prompt: `Two Latin men in their late 30s sitting across from each other at a small wooden table inside a casual taqueria or family-owned cafe in Mexico, mid-conversation, both leaning forward slightly with engaged expressions. One holds a phone showing a generic interface (no UI visible). Plates and glasses on the table, warm tungsten light from above. The mood is "we've known each other for years, now I'm telling him about a tool that could help his business".`,
  },
  {
    file: 'canal-showroom-tienda',
    prompt: `A 42-year-old Latin woman boutique owner standing at her own retail counter in her own shop, gesturing at her own POS setup while a small group of 3-4 other small business owners (mixed Latin men and women, late 30s-50s) stand around her watching attentively, one taking notes on their phone. Racks of merchandise blur behind. Mid-day natural light. Casual but professional vibe. The mood is "I run this place — let me show you how it actually works".`,
  },
  {
    file: 'canal-feria-expo',
    prompt: `Wide shot of an industry trade fair in Mexico (retail or hospitality sector), with multiple small exhibition booths visible. In the foreground a 30-year-old Latin person in business casual stands at a small booth with a tablet and printed materials, mid-conversation with a couple of visitors (Latin adults, varied ages) wearing visitor badges. Other booths and visitors blur in the background under industrial venue lighting. Energetic, populated, real expo atmosphere.`,
  },
  {
    file: 'canal-camara-comercio',
    prompt: `A 45-year-old Latin man in a navy blazer giving a presentation to a seated audience of about 20 Latin business owners in a wood-paneled chamber of commerce conference room in Mexico. He stands beside a small podium, mid-gesture, no visible projection screen content. The audience leans in, attentive. Warm institutional light, polished but understated formality. The mood is "I was invited as a recommended provider by the chamber".`,
  },
  {
    file: 'canal-whatsapp-grupos',
    prompt: `Close-but-environmental shot of a 32-year-old Latin woman sitting on a comfortable couch in her well-lit home, smartphone in her lap, mid-typing a thoughtful message. The phone screen is angled so its content is illegible, only soft glow on her hands. Natural afternoon light through a window, plants, a notebook beside her. Calm focused energy. The mood is "I'm answering a real question in a community of restaurant owners".`,
  },
  {
    file: 'canal-creator-contenido',
    prompt: `A 28-year-old Latin woman content creator setting up her own ring light and smartphone-on-tripod inside a small home studio corner, mid-adjusting the angle while looking at the phone. She wears a stylish casual outfit. Behind her: clean neutral wall with a few framed posters (no legible text), a small plant, a bookshelf. Bright clean daylight. The mood is "I'm about to record my next Reel about a retail topic".`,
  },
  {
    file: 'canal-email-cartera',
    prompt: `A 40-year-old Latin man working at a clean modern office desk in front of a desktop monitor (screen content not visible to viewer). He has a coffee cup, a notebook open with handwritten notes, and a closed paper folder. Soft side light from a window, minimalist office plants. He's mid-thought, hands paused on the keyboard. The mood is "I'm writing this month's newsletter to my client portfolio".`,
  },
  {
    file: 'canal-workshop-desayuno',
    prompt: `Wide shot of a small intimate breakfast meeting in a sunlit coworking space in Mexico City. Around a long wooden table sit 8-10 Latin business owners (varied ages 30-55, mixed men and women) with coffee cups, croissants, notebooks. At the head of the table stands a 35-year-old Latin man mid-presentation, gesturing with one hand. Big windows, plants, brick wall behind. Warm communal energy.`,
  },
  {
    file: 'canal-comarketing',
    prompt: `Two Latin business professionals, a 33-year-old woman and a 38-year-old man, sitting side by side at a cafe table in Mexico, both with open laptops (screens angled away from camera) and a printed marketing calendar on the table between them. They are mid-discussion, one pointing at the calendar. Daylight from a window beside them. Plants, ceramic mugs. The mood is "we are co-planning a joint campaign as allied brands".`,
  },
  {
    file: 'canal-speaking-paneles',
    prompt: `A 42-year-old Latin woman wearing a smart blazer mid-talk on stage at a sector conference in Mexico City. She holds a wireless mic, gesturing with the other hand, standing beside a tall podium-style table with a glass of water. The blurred audience of about 80-100 Latin professionals fills the lower foreground. Warm theatrical stage light, professional event venue. The mood is "I was invited to share a real client case".`,
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
      size: '1536x1024',
      quality: 'high',
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error('sin b64');
    const png = Buffer.from(b64, 'base64');
    const sharp = (await import('sharp')).default;
    await sharp(png)
      .resize(1600, 900, { fit: 'cover', position: 'center' })
      .webp({ quality: 86 })
      .toFile(outPath);
    const stat = await fs.stat(outPath);
    console.log(`  ✓ ${item.file}.webp · ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.error(`  ✗ ${item.file}:`, e?.message || e);
  }
}

// Sequential to avoid rate limits / billing spikes
for (const item of ITEMS) {
  await genOne(item);
}
console.log('\nDone.');
