// Genera 14 imágenes wide environmental para el tab "¿A quién le puedo vender?"
// Estética: gente joven (24-32), cool, moderna — like a Spotify / Glossier / Apple ad.
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

const STYLE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or plastic gloss. Subjects are real Mexican / Latin American adults aged 24-32, modern and cool aesthetic — think Spotify, Glossier, Apple ads or modern editorial fashion. Modern outfits: streetwear, oversized blazers, cool sneakers, neutral palettes, minimal jewelry, fresh haircuts. Diverse mix of genders and looks. Energy is aspirational, fresh, urban, in-touch with current culture — never corporate-stuffy, never staged. No legible text, no logos, no brand names visible anywhere. Wide environmental framing, subjects integrated into a real scene, composed for 16:9 ratio.';

const ITEMS = [
  // ── Primera card en orden visual ──
  {
    file: 'canal-link-redes',
    prompt: `A cool 26-year-old Latin person (gender-neutral or femme presenting) sitting cross-legged on a low modern sofa in a sun-drenched minimalist apartment, smartphone in hand, mid-edit on what is clearly a profile-edit screen (interface not legible — only a soft glow on their face). Wearing an oversized cream knit sweater and gold hoop earrings. Behind: large indoor plants, a Bauhaus-style poster on the wall (no legible text), warm afternoon light streaming through gauzy curtains. Casual, unhurried, "I'm just adding the link to my bio" energy. Stylish home that feels lived-in.`,
  },
  {
    file: 'canal-campanas-pagadas',
    prompt: `A cool 28-year-old Latin man at a sleek modern home office desk with two monitors visible from the side (screen content not legible — only soft graphic glow). He wears a fitted black t-shirt, has tortoiseshell glasses pushed up on his head, a small ceramic espresso cup beside the keyboard. Minimalist studio space with a record player on a shelf, plants, brass desk lamp, exposed brick partial wall. Soft warm light, late afternoon. Focused but relaxed body language. The mood is "I just launched a Meta campaign and I'm watching the dashboard while it runs".`,
  },

  // ── Cards existentes (regeneradas con gente más joven y cool) ──
  {
    file: 'canal-visita-tienda',
    prompt: `A cool 27-year-old Latin person in a modern oversized denim jacket and cream tee standing inside a stylish independent boutique clothing store in a Mexican city, mid-conversation with the young owner (a 28-year-old Latin woman with effortless bohemian style and a small apron) who stands behind a wooden counter where a tablet sits. Daylight from large floor-to-ceiling windows, racks of curated minimal clothes blurred behind, a few young customers browsing in the deep background. Real working-day energy, not staged. The mood is "I came in to show her something useful for her store".`,
  },
  {
    file: 'canal-enterprise-linkedin',
    prompt: `A cool 28-year-old Latin femme professional working at her stylish home office desk on a slim laptop. She wears a fitted oversized blazer over a tank top, minimal gold necklace, hair pulled back. The laptop screen shows soft glow only (no UI legible). Behind her: tasteful neutral wall, a vintage abstract art print, a small coffee tumbler, an open bullet journal, soft afternoon light through a curtain. Focused, strategic energy. The mood is "I'm reaching out to a director of operations at a 30-store chain".`,
  },
  {
    file: 'canal-red-personal',
    prompt: `Two cool late-20s Latin friends (a man with a fade haircut and bomber jacket, and a woman in oversized blazer over a slip dress) sitting across from each other at a small wooden table inside a stylish specialty cafe in Mexico City, mid-conversation, both leaning forward with engaged expressions. One holds a phone showing a generic interface (no UI visible). Matcha lattes on the table, hanging globe lights, plants, exposed brick wall behind. The mood is "we've been friends for years, now I'm telling them about a tool that could help their family business".`,
  },
  {
    file: 'canal-showroom-tienda',
    prompt: `A cool 29-year-old Latin woman boutique owner with effortless modern style (oversized linen shirt, denim, layered necklaces) standing at her own retail counter in her own minimalist concept shop, gesturing at her own POS setup (tablet on a stand, no UI visible) while a small group of 3-4 other young business owners (mixed Latin men and women, late 20s to early 30s, all stylishly dressed) stand around her watching attentively, one taking notes on their phone. Curated racks of merchandise blur behind. Mid-day natural light, plants, polished concrete floor. The mood is "I run this place — let me show you how it actually works".`,
  },
  {
    file: 'canal-feria-expo',
    prompt: `Wide shot of a modern industry trade fair in Mexico City (retail or hospitality sector), with multiple sleek small exhibition booths visible. In the foreground a cool 26-year-old Latin person in a fitted black blazer stands at a small modern booth with a tablet and minimal printed materials, mid-conversation with two visitors (Latin adults, late 20s, stylishly dressed) wearing visitor badges. Other booths and visitors blur in the background under crisp white industrial venue lighting. Energetic, populated, real expo atmosphere — feels like CES, not a stuffy convention.`,
  },
  {
    file: 'canal-camara-comercio',
    prompt: `A cool 30-year-old Latin man in a fitted modern blazer (no tie) and clean sneakers giving a presentation to a seated audience of about 20 Latin business owners (mixed ages but modern energy — most under 40) in a minimalist contemporary chamber of commerce conference room in Mexico. He stands beside a small wooden lectern, mid-gesture, no visible projection screen content. The audience leans in, attentive, with phones and notebooks. Warm modern interior light, polished but understated formality, plants in corners.`,
  },
  {
    file: 'canal-whatsapp-grupos',
    prompt: `Wide environmental shot of a cool 27-year-old Latin person sitting on a low modern lounge chair in a sun-drenched minimalist apartment, smartphone in their lap, mid-typing a thoughtful message. The phone screen is angled so its content is illegible, only soft glow on their hands. They wear a cream linen oversized shirt, small gold ring. Natural afternoon light through large windows, monstera plants, a Bauhaus poster, an open notebook beside them. Calm focused energy. The mood is "I'm answering a real question in a community of restaurant owners".`,
  },
  {
    file: 'canal-creator-contenido',
    prompt: `A cool 25-year-old Latin femme content creator setting up her own ring light and smartphone-on-tripod inside a stylish home studio corner, mid-adjusting the angle while looking at the phone. She wears a cropped knit sweater, high-waisted jeans, layered gold necklaces. Behind her: clean off-white wall with one large abstract painting (no legible text), trailing pothos plant, warm floor lamp, vintage chair. Bright clean daylight from a window beside the setup. The mood is "I'm about to record my next Reel about a retail topic".`,
  },
  {
    file: 'canal-email-cartera',
    prompt: `A cool 29-year-old Latin man working at a sleek modern home office desk in front of a slim monitor (screen content not visible to viewer). He wears a fitted dark green sweater, has a small notebook open with handwritten notes, a closed paper folder, and a beautiful ceramic mug of black coffee. Soft side light from a large window with subtle linen curtain, single trailing plant. He's mid-thought, hands paused on the keyboard. Modern minimal workspace, not corporate. The mood is "I'm writing this month's newsletter to my client portfolio".`,
  },
  {
    file: 'canal-workshop-desayuno',
    prompt: `Wide shot of a small intimate breakfast meeting in a sunlit modern coworking space in Mexico City. Around a long communal wooden table sit 8-10 cool young Latin business owners (varied genders, ages 25-35, all stylishly dressed in modern casual streetwear — oversized blazers, denim, fresh sneakers) with cortado cups, pastries, slim notebooks. At the head of the table stands a 27-year-old Latin person mid-presentation, gesturing with one hand. Big windows, hanging plants, polished concrete floor, exposed wooden beams. Warm communal energy, fresh and modern.`,
  },
  {
    file: 'canal-comarketing',
    prompt: `Two cool late-20s Latin business professionals — a 28-year-old woman in an oversized cream blazer and a 29-year-old man in a black turtleneck — sitting side by side at a stylish cafe table in Mexico, both with open slim laptops (screens angled away from camera) and a printed marketing calendar on the table between them. They are mid-discussion, one pointing at the calendar with a pen. Daylight from a large window beside them. Plants, ceramic flat-white cups, a small succulent. The mood is "we are co-planning a joint campaign as allied modern brands".`,
  },
  {
    file: 'canal-speaking-paneles',
    prompt: `A cool 30-year-old Latin femme wearing a fitted modern blazer over a silk camisole, slim trousers, and clean white sneakers, mid-talk on stage at a sector conference in Mexico City. She holds a wireless mic, gesturing with the other hand, standing beside a tall minimal podium-style table with a glass of water. The blurred audience of about 80-100 Latin professionals (modern casual energy, mixed ages skewing 25-40) fills the lower foreground. Warm theatrical stage light with one accent gel, contemporary modern event venue. The mood is "I was invited to share a real client case".`,
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

for (const item of ITEMS) {
  await genOne(item);
}
console.log('\nDone.');
