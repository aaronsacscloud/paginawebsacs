# Quita el fondo verde croma de public/images/axo/axo-volando-verde.png (gpt-image-2 no da transparencia) y deja
# public/images/axo/axo-volando.webp recortado, con el borde verde «despintado». Uso: python3 -I scripts/axo-sin-fondo.py
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

base = Path(__file__).resolve().parent.parent / 'public/images/axo'
im = np.asarray(Image.open(base / 'axo-volando-verde.png').convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
verde = g - np.maximum(r, b)                      # cuánto domina el verde
alpha = np.clip(1.0 - (verde - 40) / 80, 0, 1)    # >120 = fondo; <40 = personaje
g2 = np.minimum(g, np.maximum(r, b) + 10)         # despill: el verde no puede pasar a los otros canales
out = np.dstack([r, np.where(alpha < 1, g2, g), b, alpha * 255]).astype(np.uint8)
img = Image.fromarray(out, 'RGBA')
a = img.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
img.putalpha(a)
img = img.crop(img.getbbox())
img.thumbnail((960, 960))
img.save(base / 'axo-volando.webp', quality=88, method=6)
print('✓', img.size)
