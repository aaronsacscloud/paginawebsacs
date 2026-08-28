import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const PAL = 'HARD RULES: all garments PLAIN solid sage green, lilac, black or cream — no prints, no logos, no other colors. No signs, posters or any readable text anywhere. Any app screen: blue-accent retail UI showing only sage/lilac/black/cream garments.';
const STYLE = 'Photorealistic documentary photo, real Mexican people, bright neutral daylight, slight film grain, candid editorial athleisure photography.';

// resuelto: EDIT sobre el resuelto actual — misma mujer, sonrisa leve, sin letrero
try {
  const png = await sharp(path.join(IMG, 'suite-active-resuelto.webp')).png().toBuffer();
  const r = await openai.images.edit({
    model: 'gpt-image-2',
    image: await toFile(png, 'res.png', { type: 'image/png' }),
    prompt: `Keep the EXACT same woman, pose, outfit, tablet and showroom. Change ONLY: (1) her expression to a calm slight smile (relaxed brows, no frown); (2) remove or blur beyond legibility ANY wall sign or lettering (there is an English sign behind her — replace with a plain cream wall or a solid-color garment rack). ${PAL}`,
    size: '1536x1024', quality: 'medium',
  });
  await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1400, 933, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, 'suite-active-resuelto.webp'));
  console.log('ok resuelto');
} catch (e) { console.error('FALLO resuelto:', e?.message || e); }

const JOBS = [
  ['hero-active', `Bright minimal Mexican activewear showroom: a 32-year-old woman founder (dark high ponytail, cream hoodie) arranging plain sage sets on a rack with SIMPLE ordinary wooden hangers (each garment on one normal hanger, no clips, no double hooks, no tangled wire), a customer browsing behind, tablet on the counter with blue-accent app showing sage/lilac garments. Her head fully in frame with air above. ${PAL}`],
  ['plano-active-showroom', `Activewear showroom floor, completely EMPTY of people, no hands, no person anywhere, shop before opening: racks by solid colorway generously spaced, large mirror reflecting only racks, bench, folded stacks, daylight. ${PAL}`],
];
for (const [file, prompt] of JOBS) {
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${prompt}\n\n${STYLE}`, size: '1536x1024', quality: 'medium' });
    await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1400, 933, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, `${file}.webp`));
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
