// AXO volando (18-oct-2026; resultado en public/images/axo/axo-volando.webp) para la sección de flujos de /producto/axo-copiloto-ia: mismo personaje que
// public/images/axo/axo-mascota.webp, en pose de vuelo. gpt-image-2 no da fondo transparente: sale en verde
// croma y scripts/axo-sin-fondo.py lo recorta. Llave: OPENAI_API_KEY.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const ref = path.join(SITIO, 'public/images/axo/axo-mascota.webp');
const sharp = (await import('sharp')).default;
const png = await sharp(ref).png().toBuffer();
const openai = new OpenAI();
const resp = await openai.images.edit({
  model: 'gpt-image-2',
  image: await toFile(png, 'axo.png', { type: 'image/png' }),
  prompt: 'The exact same character (pink axolotl mascot with big purple eyes, black suit with glowing blue circuit lines, black shoes) now FLYING like a superhero: body horizontal-diagonal, one arm stretched forward, legs and pink tail trailing behind, determined happy face, glowing blue circuit lines brighter, a few small cyan light particles around. Full body, centered, nothing cropped. Plain solid pure green chroma-key background (#00FF00), perfectly flat, no shadow, no gradients, no text.',
  size: '1536x1024',
  quality: 'high',
});
const buf = Buffer.from(resp.data[0].b64_json, 'base64');
// Sale en verde croma; scripts/axo-sin-fondo.py lo recorta. El PNG verde (1.7 MB) no se sube: se borra después.
await fs.writeFile(path.join(SITIO, 'public/images/axo/axo-volando-verde.png'), buf);
console.log('✓ verde · ahora: python3 -I scripts/axo-sin-fondo.py y borra axo-volando-verde.png');
