// Genera 32 imágenes para el tab "Expande tu red" — todas las propuestas
// salvo el portrait del founder (Aaron lo pone después).
// Estética: gente 24-32, moderna/cool, Spotify/Glossier/Apple ad.
// Output: sitio/public/images/network-expansion/

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/network-expansion');

const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
  const i = l.indexOf('='); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return [l.slice(0, i).trim(), v];
}));
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;

const STYLE_WIDE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or plastic gloss. Subjects are real Mexican / Latin American adults aged 24-32, modern and cool aesthetic — Spotify, Glossier, Apple ad energy. Modern outfits: streetwear, oversized blazers, cool sneakers, neutral palettes, minimal jewelry, fresh haircuts. Diverse mix of genders and looks. Aspirational, fresh, urban, never corporate-stuffy or staged. No legible text, no logos, no brand names visible anywhere. Wide environmental framing, composed for 16:9 ratio. Editorial quality.';

const STYLE_DETAIL = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light, slight film grain. Modern editorial detail shot, no people faces visible (or only hands/profile/back). Neutral palette, minimal modern objects, soft warm light. No legible text, no UI legible, no logos. 4:3 framing.';

const STYLE_PORTRAIT = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate skin tones, no AI smoothing or plastic gloss. Cool young Latin American adults aged 24-32, modern aesthetic — streetwear, oversized blazers, neutral palettes, fresh haircuts. Editorial portrait crop (head and shoulders or chest-up). No legible text, no logos. Square 1:1 framing.';

const ITEMS = [
  // ── Hero del tab ──
  {
    file: 'red-hero', size: '1536x1024', resize: [1600, 900], style: STYLE_WIDE,
    prompt: `Wide environmental shot of a confident cool 28-year-old Latin person (femme, oversized cream blazer, layered necklaces, fresh haircut) standing in the foreground at a sunlit modern coworking space in Mexico City. Behind them, blurred but visible: 5-7 other young Latin professionals working, talking, networking — a sense of activity radiating outward. Big windows, hanging plants, polished concrete floor, exposed wood beams. The subject looks slightly off-camera, calm and aspirational. The mood: "I'm at the center of something growing."`,
  },

  // ── 4 fotos por tier (escala literal) ──
  {
    file: 'red-tier-1', size: '1536x1024', resize: [1400, 900], style: STYLE_WIDE,
    prompt: `An intimate huddle of 4-5 young Latin people (mid 20s, mixed genders, modern streetwear and oversized blazers) gathered around a small wooden table in a sunlit specialty coffee shop in Mexico City. They are mid-conversation, leaning in, with notebooks and ceramic flat-white cups on the table. One of them is gesturing while the others listen attentively. Hanging plants, exposed brick wall behind. Warm intimate energy — close inner circle, trust, the start of something.`,
  },
  {
    file: 'red-tier-2', size: '1536x1024', resize: [1400, 900], style: STYLE_WIDE,
    prompt: `A small team meeting of about 10 young Latin professionals (mid to late 20s, modern aesthetic) gathered around a long communal table in a bright modern coworking space in Mexico City. Laptops open, notebooks, coffees, slim journals. Some standing, some seated, mid-discussion. Big floor-to-ceiling windows, hanging plants, polished concrete floor. Engaged, productive, building energy. The mood: "team in formation, momentum building."`,
  },
  {
    file: 'red-tier-3', size: '1536x1024', resize: [1400, 900], style: STYLE_WIDE,
    prompt: `A medium-size networking event with about 20 young Latin professionals (24-35, modern stylish casual) standing in clusters of 3-4, drinks in hand, mid-conversation, in a stylish modern Mexico City venue with hanging warm bulbs, exposed beams, plants. Some are mid-laugh, some leaning in to hear better. Establishment shot showing the room from a slight angle, capturing the scale and energy. Warm interior light. The mood: "established network, real influence."`,
  },
  {
    file: 'red-tier-4', size: '1536x1024', resize: [1400, 900], style: STYLE_WIDE,
    prompt: `A wide cinematic shot of a partner summit in a Mexico City conference venue — about 80-100 young Latin professionals (24-40, modern aesthetic, mixed genders) seated in a contemporary modern auditorium with warm wooden walls and accent lighting, looking toward a stage where a single speaker stands (silhouette only, far from camera, no detail visible). The audience is engaged, illuminated by stage spill light. Sense of scale, sense of movement, sense of community. The mood: "this is bigger than me — I built a network."`,
  },

  // ── Closing wide arriba del CTA ──
  {
    file: 'red-closing', size: '1536x1024', resize: [1600, 900], style: STYLE_WIDE,
    prompt: `A warm cinematic moment in a stylish modern Mexico City coworking lounge: a 28-year-old Latin person (femme, oversized cream blazer) is shaking hands with another person (back partially visible, modern oversized denim jacket) over a small table that has two open notebooks and ceramic mugs. Around them, blurred but visible, 4-5 other young professionals applauding gently or simply present. Warm golden hour light from large windows, plants, exposed brick. The mood: "welcome to the network — this is the moment of induction."`,
  },

  // ── 4 detalles para benefits ──
  {
    file: 'red-benefit-badge', size: '1024x1024', resize: [1200, 900], style: STYLE_DETAIL,
    prompt: `Editorial detail shot: a slim modern laptop on a clean wooden desk, half-open, screen showing only a soft glow with a circular profile silhouette and a small shimmering golden circular badge ornament beside it (no UI text, no legible brand). A ceramic espresso cup, a small succulent plant, soft afternoon window light hitting the corner of the keyboard. Neutral palette. The mood: "your profile carries a distinction now."`,
  },
  {
    file: 'red-benefit-leads', size: '1024x1024', resize: [1200, 900], style: STYLE_DETAIL,
    prompt: `Editorial detail shot: a person's hand (Latin skin tone, single thin gold ring) holding a smartphone in a sunlit cafe, the phone screen showing only a soft glow notification (no UI text legible, just abstract notification shape). Steam rising from a ceramic cortado cup beside the hand. Wooden table, blurred plants in the background, warm late afternoon light. The mood: "a high-value lead just landed in your inbox."`,
  },
  {
    file: 'red-benefit-betas', size: '1024x1024', resize: [1200, 900], style: STYLE_DETAIL,
    prompt: `Editorial detail shot: a desk with two slim modern monitors (only sides visible, screens facing away with soft graphic glow visible — no UI text legible, just abstract shapes suggesting a fresh new product interface). A pair of headphones, a small notebook with a hand-sketched wireframe (illegible scribbles), a ceramic mug of black coffee. Soft side window light. Modern minimal home studio. The mood: "you got early access — try it before anyone else."`,
  },
  {
    file: 'red-benefit-mentor', size: '1024x1024', resize: [1200, 900], style: STYLE_DETAIL,
    prompt: `Editorial detail shot: two ceramic cortado coffee cups on a small marble cafe table, a pair of hands from each person visible (one Latin, one Latin, both casually dressed in neutral tones — only forearms and one hand each visible) leaning toward each other across the table mid-conversation. A small leather notebook open between them with handwritten notes (illegible). Warm window light, blurred plant in background. Intimate, two-person business meeting. The mood: "1:1 with the founder — depth, not noise."`,
  },

  // ── Network Builder iconic portrait (para tier 4) ──
  {
    file: 'red-builder-portrait', size: '1536x1024', resize: [1400, 900], style: STYLE_WIDE,
    prompt: `A single iconic editorial portrait of a confident cool 30-year-old Latin person (gender-neutral or femme-presenting, fresh haircut, fitted modern oversized black blazer over a cream silk top, minimal gold jewelry) standing in profile/three-quarter angle in a sunlit modern Mexico City lobby or atrium. Soft motion blur of 3-5 other young professionals walking past in the background. Calm, serene confidence, slight half-smile, looking past the camera. The mood: "I built this."`,
  },

  // ── Antes / Después split ──
  {
    file: 'red-before', size: '1024x1024', resize: [1200, 900], style: STYLE_WIDE,
    prompt: `A 26-year-old Latin person (femme, simple cream knit sweater) sitting alone at a small wooden desk in their bright minimalist apartment, slim laptop open with screen angled away (no UI visible), a single ceramic mug, a small plant. Soft afternoon light from a large window. Pensive, focused, working solo. Plants, simple Bauhaus poster. The mood: "I started alone."`,
  },
  {
    file: 'red-after', size: '1024x1024', resize: [1200, 900], style: STYLE_WIDE,
    prompt: `The same 26-year-old Latin person (femme, cream knit sweater) — recognizably similar styling — now sitting at the head of a long communal table in a sunlit modern coworking lounge in Mexico City, with 6-8 other young Latin professionals around the table mid-laugh and mid-conversation, ceramic cups and laptops and notebooks. The subject is gesturing, energized, leading. Big windows, hanging plants. The mood: "now I lead a team."`,
  },

  // ── 4 micro-fotos para "Cómo funciona" ──
  {
    file: 'red-how-1', size: '1024x1024', resize: [900, 900], style: STYLE_DETAIL,
    prompt: `Editorial square detail shot: a hand (Latin skin tone) signing the bottom of a printed contract page on a clean wooden desk with a slim black ballpoint pen. Only the hand and pen and corner of the document visible (no legible text on the document, just abstract paragraph shapes). A ceramic mug to the side, soft natural light. Modern minimal feel. The mood: "every partner signs their own agreement."`,
  },
  {
    file: 'red-how-2', size: '1024x1024', resize: [900, 900], style: STYLE_DETAIL,
    prompt: `Editorial square detail shot: two pairs of hands (Latin skin tones) leaning over a slim laptop on a wooden cafe table, one hand pointing at the screen (screen content not visible, only soft glow) while the other hand rests on a notebook. Ceramic coffee cups, plants blurred behind. Soft warm light. Intimate one-to-one onboarding moment. The mood: "you onboard your invite personally."`,
  },
  {
    file: 'red-how-3', size: '1024x1024', resize: [900, 900], style: STYLE_DETAIL,
    prompt: `Editorial square detail shot: two equal-size ceramic coffee cups side by side on a clean marble table, exactly mirrored, with a small minimal succulent plant between them. Soft window light. Symmetric composition emphasizing equality, balance. No people. The mood: "each partner earns their own — no overrides, no chain."`,
  },
  {
    file: 'red-how-4', size: '1024x1024', resize: [900, 900], style: STYLE_DETAIL,
    prompt: `Editorial square detail shot: a desk with a slim laptop closed, a small slim notebook with a clean checkmark drawn at the top of a page (illegible scribbles below the checkmark), a ceramic mug, a small magnifying glass off to the side, all on a light wood surface. Soft natural light. The mood: "SACS reviews and validates each invitation."`,
  },

  // ── Storyboard de invitación (3 secuencia) ──
  {
    file: 'red-story-1', size: '1024x1024', resize: [1200, 800], style: STYLE_WIDE,
    prompt: `Frame 1 of 3 in a story sequence: two young Latin friends (early 30s, both stylishly dressed in modern casual streetwear) sitting across from each other at a small wooden table inside a stylish specialty cafe in Mexico City, mid-conversation, leaning in, both with cortado coffee cups. One is gesturing, the other is listening intently. Plants, hanging warm bulb, exposed brick. The mood: "I have someone valuable in mind."`,
  },
  {
    file: 'red-story-2', size: '1024x1024', resize: [1200, 800], style: STYLE_WIDE,
    prompt: `Frame 2 of 3 in a story sequence: the same two young Latin friends, now both leaning over a slim open laptop together (laptop screen angled away from camera with only soft glow visible — no UI legible), one of them pointing at the screen while the other looks intently. Fresh ceramic coffees, an open notebook. Same cafe environment as before, slightly tighter framing. The mood: "I'm walking them through the program."`,
  },
  {
    file: 'red-story-3', size: '1024x1024', resize: [1200, 800], style: STYLE_WIDE,
    prompt: `Frame 3 of 3 in a story sequence: the same two young Latin friends, now smiling and lifting their cortado coffee cups in a small toast across the table. Both are happy, relaxed, mid-laugh. Same cafe environment, golden hour light through the window. The mood: "they're in — welcome to the network."`,
  },

  // ── 12 portraits para muro de Network Builders ──
  ...Array.from({ length: 12 }, (_, i) => ({
    file: `red-wall-${String(i + 1).padStart(2, '0')}`,
    size: '1024x1024',
    resize: [600, 600],
    style: STYLE_PORTRAIT,
    prompt: [
      // 12 distinct portrait scenarios, varied gender, age (24-32), mood, location
      `A 28-year-old Latin femme with effortless modern style (oversized cream blazer over a slip top, minimal gold necklace, soft brown waves), looking calmly slightly off-camera in a sunlit minimalist apartment with plants blurred behind her. Half-smile. Editorial portrait crop. Aspirational confident energy.`,
      `A 26-year-old Latin man with a fade haircut, oversized denim jacket over a white tee, simple gold ear cuff, three-quarter angle portrait in a stylish coffee shop with hanging warm bulbs softly blurred behind. Direct gaze, calm. Editorial.`,
      `A 30-year-old Latin person (gender-neutral, short cropped hair, statement tortoiseshell glasses, fitted black turtleneck) head-and-shoulders portrait against a warm beige wall in a modern Mexico City studio. Slight smile, intelligent. Editorial.`,
      `A 25-year-old Latin femme with curly hair pulled into a low bun, hoop earrings, fitted vintage band tee, three-quarter portrait in a bright modern coworking with floor-to-ceiling windows blurred behind. Mid-laugh, candid. Editorial.`,
      `A 32-year-old Latin man with short clean haircut, fitted dark green sweater, minimal silver chain, head-and-shoulders portrait in a warm wooden lobby in Mexico City. Calm direct gaze, slight half-smile. Editorial.`,
      `A 27-year-old Latin femme with sleek bob haircut, oversized white button-down, gold rings, three-quarter portrait against a soft pink-to-beige gradient natural backdrop. Confident neutral expression. Editorial fashion magazine quality.`,
      `A 29-year-old Latin man with longer textured hair, fitted oversized blazer over a fine knit, chest-up portrait in a sunlit cafe with plants blurred behind. Slight three-quarter angle, looking slightly off-camera. Editorial.`,
      `A 24-year-old Latin femme with very short cropped hair, statement gold hoop earrings, fitted cream knit sweater, head-and-shoulders portrait against a clean modern white wall with one small abstract painting blurred behind. Direct calm gaze. Editorial.`,
      `A 31-year-old Latin person (femme, fresh wavy haircut, modern minimal makeup, fitted oversized black blazer), three-quarter portrait in a stylish lobby with warm wood paneling blurred behind. Half-smile, polished. Editorial.`,
      `A 28-year-old Latin man with fitted black t-shirt, fresh fade haircut, simple thin chain, chest-up portrait against a soft beige natural backdrop, lit from one side. Direct calm gaze, slight half-smile. Editorial.`,
      `A 26-year-old Latin femme with long straight black hair, fitted sage green oversized blazer, gold layered necklaces, head-and-shoulders portrait in a sunlit minimalist apartment with a single trailing plant blurred behind. Calm aspirational. Editorial.`,
      `A 30-year-old Latin man with curly hair, fitted cream linen oversized shirt, three-quarter portrait against a warm modern beige wall with single trailing plant. Direct calm gaze, polished but warm. Editorial.`,
    ][i],
  })),
];

await fs.mkdir(OUT_DIR, { recursive: true });
const openai = new OpenAI();

async function genOne(item) {
  const outPath = path.join(OUT_DIR, `${item.file}.webp`);
  try { await fs.access(outPath); console.log(`✓ skip ${item.file}`); return; } catch {}
  const fullPrompt = `${item.prompt}\n\n${item.style}`;
  console.log(`→ ${item.file}…`);
  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: fullPrompt,
      size: item.size,
      quality: 'high',
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error('sin b64');
    const png = Buffer.from(b64, 'base64');
    const sharp = (await import('sharp')).default;
    await sharp(png)
      .resize(item.resize[0], item.resize[1], { fit: 'cover', position: 'center' })
      .webp({ quality: 86 })
      .toFile(outPath);
    const stat = await fs.stat(outPath);
    console.log(`  ✓ ${item.file}.webp · ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.error(`  ✗ ${item.file}:`, e?.message || e);
  }
}

console.log(`Total: ${ITEMS.length} imágenes\n`);
for (const item of ITEMS) {
  await genOne(item);
}
console.log('\nDone.');
