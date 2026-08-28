# Reglas de paginawebsacs (www.sacscloud.com + CRM)

El sitio y el CRM viven en `sitio/` (Astro 6 + React, `output: 'static'`,
adaptador de Vercel). Se despliega **en cada push a `main`**.

## 💸 EL COSTO DE VERCEL ES EL BUILD — cuídalo en cada cambio

**Agosto 2026 costó $100.22 y el 99% fue una sola línea: Build CPU Minutes
($118.96 de $120.22).** Todo lo demás junto —funciones, los 24 crons,
tráfico, edge requests— sumó **$1.26**. Esto NO es intuitivo, así que antes
de "optimizar el costo de Vercel" lee esto o vas a perder el día donde no es.

**Cómo se factura, que es lo que explica todo:** el build consume **2.43
CPU-minutos reales usando el 77% de UN núcleo** (medido con `/usr/bin/time
-v`), pero Vercel cobra ~**37 CPU-min por build**: paga la *máquina completa
por tiempo de reloj*. O sea, **el build ya gasta poquísimo CPU; lo caro es
CUÁNTOS builds se disparan.** En 30 días hubo **734 commits**, casi todos en
ráfaga (un día llegó a 143), y cada push a media ráfaga construye algo que
quedará viejo en 3 minutos.

### Las reglas

1. **NO quites ni ablandes `ignoreCommand`** (`sitio/vercel.json` →
   `scripts/vercel-ignore-build.sh`). Es un candado de costo: pregunta a
   origin si el commit sigue siendo la punta de su rama y, si ya lo
   superaron, salta el build — solo se construye el último de cada ráfaga
   (medido: 734 builds → ~297, −60%). Es **fail-open**: ante cualquier duda
   construye. Si lo tocas, prueba los 4 caminos (punta, superado, rama
   inexistente, sin variables).
2. **Agrupa los pushes.** Diez `git push` seguidos son diez builds; el
   candado salva la mayoría, pero el último de cada ráfaga se paga completo.
   Si vas a hacer 5 commits en 10 minutos, pushéalos juntos.
3. **Assets pesados: piénsalo dos veces.** `sitio/public/` ya trae 191 MB
   (846 imágenes webp + 31 videos) y el `.git` pesa 318 MB. No engorda el
   *build* (ver trampas), pero sí el clone y la carga del usuario. Video
   nuevo: máximo 1920 de ancho, H.264 CRF 24 (`-an` si no lleva audio) y
   revisa que pese menos que el original.
4. **Crons nuevos: son baratos, pero no gratis.** Los 24 actuales cuestan
   ~$1/mes. Antes de agregar otro cada 5 minutos, pregúntate si cada 15
   alcanza. Y `maxDuration` va en el adaptador (`astro.config.mjs`), no en
   `vercel.json`.

### Trampas ya medidas — no repitas el análisis

- **`ignoreCommand` por rutas (saltar si solo cambió documentación) NO
  sirve aquí**: apenas el 2% de los commits son de docs; el 98% toca `sitio/`.
- **Los 191 MB de `public/` NO son el cuello del build.** El log dice
  `Rearranging server assets ✓ Completed in 133.79s`, pero los timestamps
  muestran que esa fase empieza y termina en el MISMO segundo: ese número es
  el acumulado del bloque anterior. Prueba de control (build sin los assets):
  salió *más lento*. El build es compilación pura: entrypoints 46 s +
  cliente 84 s + bundling de la función 42 s.
- El caché de npm tampoco es el problema: `package-lock.json` cambió 2 veces
  en el mes, así que Vercel lo reutiliza casi siempre.
- Las ramas de preview no aportan costo: 0 commits en 30 días.

### Cómo medir el build en local

Astro 6 exige **Node ≥ 22.12** y el servidor tiene el 20. Se baja un Node 22
portátil a `/tmp` (no toca el sistema) y:

```bash
PATH=/tmp/.../node-v22.12.0-linux-x64/bin:$PATH \
  /usr/bin/time -v npx astro build
```

Mira `User time` (CPU real) y `Percent of CPU`. **Ojo con el OOM:** dos
builds seguidos dejan la memoria del servidor al tope.

### Lo que solo se puede hacer desde el dashboard

Bajar el **tamaño de la máquina de build** (Settings → Build & Deployment).
El build usa menos de un núcleo, así que la máquina grande es dinero tirado:
vale ~50% de la factura. No hay forma de hacerlo por código ni por
`vercel.json` — pídeselo a Aaron.

## 🔐 Secretos

`sitio/.env` no se commitea (`.gitignore`). Los tokens de Supabase, SendGrid
y demás viven ahí y en las variables de entorno de Vercel.
