// Regenera las 9 imágenes de perfiles arquetipo (sección "Para quién es" en
// la invitación de partners) con la misma estética joven/cool que los canales
// de venta — gente 24-32, streetwear, oversized blazers, neutral palettes,
// energy Spotify/Glossier/Apple ad.
// Output: sitio/public/images/partner-perfiles/perfil-<id>.webp (1200×900)

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

const STYLE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or plastic gloss. Subjects are real Mexican / Latin American adults aged 24-32, modern and cool aesthetic — think Spotify, Glossier, Apple ads or modern editorial fashion. Modern outfits: streetwear, oversized blazers, cool sneakers, neutral palettes, minimal jewelry, fresh haircuts. Diverse mix of genders and looks. Energy is aspirational, fresh, urban, in-touch with current culture — never corporate-stuffy, never staged. No legible text, no logos, no brand names visible anywhere. 4:3 framing.';

const ITEMS = [
  {
    file: 'perfil-influencer',
    prompt: `A cool 26-year-old Latin femme content creator sitting on the floor of her bright minimalist apartment, holding her phone in a vlogging chest-level position (phone screen angled away, no UI visible). She wears a cropped knit sweater, layered gold necklaces, mom jeans. Trailing pothos plant, warm window light, white walls with one large abstract poster (no legible text), wooden floor. Mid-laugh, real and unposed. The mood: "I create for my audience and now my audience earns me income."`,
  },
  {
    file: 'perfil-nomada',
    prompt: `A cool 27-year-old Latin person (gender-neutral, fade haircut, simple gold ear cuff) working on a slim laptop at a sunlit specialty cafe in Mexico City's Roma neighborhood, ceramic flat-white cup beside them on a wooden table, monstera plants and large windows in the background. They wear an oversized cream linen shirt over a white tee. Mid-typing, focused but relaxed. The mood: "I work from anywhere — today this café, tomorrow somewhere else."`,
  },
  {
    file: 'perfil-consultor',
    prompt: `A cool 29-year-old Latin man consultant in a fitted modern oversized blazer over a black tee, sitting across a clean wood meeting table from a 28-year-old Latin woman shop owner with effortless style (denim jacket, layered necklaces). Both lean over a slim laptop on the table (laptop screen angled away, not visible). Modern minimalist Mexico City office in the background with concrete walls, a single hanging plant. Mid-conversation, both engaged. The mood: "I help my clients run their business; SACS is one of my tools."`,
  },
  {
    file: 'perfil-contador',
    prompt: `A cool 28-year-old Latin femme accountant in modern smart-casual style (oversized blazer over a slip top, slim trousers, minimal gold rings), sitting at a clean modern desk in a stylish small Mexico City office. She is reviewing a printout while a slim laptop sits closed beside her with a small ceramic espresso cup. Warm window light, plants, vintage abstract art on a clean wall. Capable, modern, focused. The mood: "I help businesses with their numbers — the modern way."`,
  },
  {
    file: 'perfil-tecnologia',
    prompt: `A cool 30-year-old Latin man B2B tech distributor in a fitted dark sweater and clean white sneakers, standing in front of a glass meeting room of a modern Mexico City corporate office. He holds a tablet (angled away, no UI visible) and is mid-conversation with another young professional whose back is partially visible. Modern interior with soft natural light from floor-to-ceiling windows, hanging plants, polished concrete floor. The mood: "I sell software and tech solutions to companies."`,
  },
  {
    file: 'perfil-hardware',
    prompt: `A cool 27-year-old Latin man hardware sales rep wearing a fitted oversized denim jacket over a white tee, standing inside a modern minimalist electronics or POS hardware showroom in Mexico City. Behind him on clean shelves: minimal product displays, a few floor-display POS terminals with screens off (no UI). He's mid-explanation, hand gesturing toward equipment. Bright soft daylight from large windows. The mood: "I sell the physical equipment that runs the operation."`,
  },
  {
    file: 'perfil-distribuidor',
    prompt: `A cool 28-year-old Latin man wearing a fitted black t-shirt and dark jeans with cool sneakers, mid-step walking through the aisles of a modern Mexican retail warehouse / distribution center, holding a tablet (angled away, no screen visible). Tall metal shelves with stocked product boxes around him, mixed natural light from clerestory windows. Modern logistics aesthetic — clean, organized. The mood: "I distribute to a network of stores and my reach grows with SACS."`,
  },
  {
    file: 'perfil-tienda',
    prompt: `A cool 30-year-old Latin woman shop owner with effortless modern style (oversized linen shirt, cropped denim, layered necklaces, minimal makeup) standing behind the wooden counter of her own curated boutique in Mexico City, mid-laugh while handing a paper bag to a customer (only customer's torso and arm visible). Counter has a small POS tablet on a stand angled away from camera (no UI visible). Real working day, racks of curated minimal merchandise softly out of focus, hanging plants. The mood: "I run my store and I recommend SACS to other store owners like me."`,
  },
  {
    file: 'perfil-emprendedor',
    prompt: `A cool 25-year-old Latin femme at a small modern wood desk in her bright apartment, slim laptop open with screen angled away (no UI visible), a notebook with handwritten squiggles (illegible), a beautiful ceramic mug, monstera plant on the windowsill. Warm afternoon light from a large window with linen curtains. She wears a cream oversized hoodie, small gold hoops, hair in a low bun. Leaning slightly into the screen, focused but hopeful. The mood: "I'm building from zero and I have a real path now."`,
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
      .resize(1200, 900, { fit: 'cover', position: 'center' })
      .webp({ quality: 88 })
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
