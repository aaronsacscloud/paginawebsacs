# Reglas de paginawebsacs (www.sacscloud.com + CRM)

El sitio y el CRM viven en `sitio/` (Astro 6 + React, `output: 'static'`,
adaptador de Vercel). Se despliega **en cada push a `main`**.

## 📥 COLA DE TRABAJO: lo que llegue a media tarea NO interrumpe

**Regla del dueño (4-sep-2026). Aplica a TODA sesión que trabaje este repo.**

El dueño manda cosas mientras estás trabajando. Eso **no es una interrupción
ni un cambio de prioridad**: es la siguiente tarea. La regla es:

1. **Termina por completo lo que estás haciendo.** Nada de dejar la tarea en
   curso a medias para atender lo nuevo. «Por completo» incluye su prueba, su
   commit y decirle cómo quedó.
2. **Lo que llegue en medio se anota en `sitio/COLA.md`** en cuanto llega, con
   fecha y el texto del dueño tal cual. Se le confirma en una línea que quedó
   en la cola, sin abandonar lo que se está haciendo.
3. **Al terminar, se toma lo siguiente de la cola** en el orden en que llegó y
   se marca lo hecho.
4. **Excepción única:** si lo nuevo dice que algo está roto en producción, se
   está cobrando mal o le está saliendo un mensaje malo a un cliente, eso
   manda: se atiende primero y se dice que se pausó lo anterior.
5. Si el dueño dice «deja eso y haz esto», manda él: se mueve la tarea en
   curso a la cola y se atiende lo nuevo.

Así puede mandar tres cosas seguidas sin romper nada y sin tener que esperar.

## 🚦 COMMIT SIEMPRE, PUSH SOLO CUANDO EL DUEÑO LO DIGA

**Regla del dueño (3-sep-2026). Aplica a TODA sesión que trabaje este repo.**

Cada cambio o mejora se **commitea** en cuanto está listo y verificado, con su
mensaje detallado en español, como siempre. Pero **no se sube**: `git push`
solo cuando el dueño lo pida con esas palabras —«push», «sube», «sube todo»,
«publica»— y entonces se suben **todos los commits acumulados de una vez**.

Eso ES la agrupación: los commits son gratis, lo que cuesta es el push. Diez
commits subidos juntos son un build y una sola ventana de despliegue; diez
pushes son diez builds y diez ventanas en las que los crons no corren (ver la
sección de costo, y el caso medido del agente).

Cómo se trabaja con esto, para que no se vuelva una pila invisible:

- Al terminar cada bloque, **di cuántos commits quedan esperando** y de qué
  son. El dueño decide cuándo sale todo.
- Si algo es urgente —producción rota, un cobro mal, un mensaje saliéndose a
  un cliente— **dilo y pide subirlo**; no lo subas por tu cuenta ni lo dejes
  esperando en silencio.
- Un commit sin push no está desplegado. No digas «ya está en producción» ni
  verifiques contra `www.sacscloud.com` esperando ver el cambio: ahí sigue
  corriendo lo anterior.

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

   **Y no es solo dinero: cada despliegue PARA LOS CRONS.** Medido el 3-sep-2026:
   18 commits entre las 23:05 y las 00:48 UTC —un despliegue cada seis
   minutos— y el agente de Trabajo Inteligente estuvo 16 minutos sin correr,
   justo entre el despliegue de las 00:32 y el de las 00:48. Reanudó solo tres
   minutos después del siguiente, con cero errores en su bitácora: no se cayó,
   no le tocó correr. Las invocaciones programadas se pierden mientras Vercel
   cambia de despliegue.

   Cómo se hace, en concreto: **ver la regla de arriba** —commitear siempre,
   subir solo cuando el dueño lo pida—. Diez commits pushados juntos son un
   build y una sola ventana; diez pushes son diez ventanas.

   Cuánto aguanta antes de doler: el observador arranca desde su última marca
   con tope de **60 minutos**, así que un hueco menor se recupera solo. Pasada
   esa hora, los mensajes anteriores al corte ya no se miran — ahí sí se
   pierden leads. El latido (`/api/cron/ti-latido`) avisa distinto según de qué
   lado del corte esté, y se calla cuando el hueco coincide con un despliegue.

   ⚠️ **Una máquina más grande NO arregla esto.** El cuello no es el CPU: está
   medido abajo que `turbo` (30 vCPU) tarda lo mismo que `standard` (4) porque
   el build usa 0.77 de un núcleo. Subir de máquina paga más por el mismo
   problema.
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

### La máquina de build (ARREGLADO 2026-08-28 — no lo devuelvas a turbo)

Vercel factura **minuto de build × número de vCPUs de la máquina**. Los 12
proyectos del equipo estaban en **`turbo` (30 vCPU / 60 GB)** porque el
*default del equipo* estaba en turbo — y el build usa **0.77 de UN núcleo**.
Se pagaban 30 para usar menos de 1.

| Máquina | vCPU | Memoria |
|---|---|---|
| standard | 4 | 8 GB |
| enhanced | 8 | 16 GB |
| turbo | 30 | 60 GB |

Ya está en `standard` los 12 proyectos **y el default del equipo**. Si algún
build muere por memoria (el de `sitio` llegó a 3.2 GB de RSS, cabe en 8 GB),
sube ESE proyecto a `enhanced` — nunca todo el equipo a `turbo`.

**MEDIDO en producción el mismo día, 4 builds de cada uno:** el build tarda
**lo mismo** con 4 núcleos que con 30 (111 s vs 115 s de reloj) — la prueba
de que los 30 no servían para nada. Por build: 57.4 CPU-min en turbo contra
**7.4 en standard, −87%**. Si alguien propone volver a turbo "para que
compile más rápido", este es el contraejemplo.

Por API (no hay comando en la CLI):

```bash
# por proyecto
curl -X PATCH "https://api.vercel.com/v9/projects/$ID?teamId=$TEAM" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"resourceConfig":{"buildMachineType":"standard"}}'
# default del equipo (la raíz del problema)
curl -X PATCH "https://api.vercel.com/v2/teams/$TEAM" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"resourceConfig":{"buildMachine":{"default":"standard"}}}'
```

## 🔐 Secretos

`sitio/.env` no se commitea (`.gitignore`). Los tokens de Supabase, SendGrid
y demás viven ahí y en las variables de entorno de Vercel.

### Entrar al CRM para QA con navegador

Muchas pantallas del CRM (`/admin/crm`) piden sesión, así que sin login no se
puede verificar nada de verdad: se compila, se despliega y se descubre el error
en producción. Las credenciales viven en **`.crm-login`** en la raíz del repo
(perms 600, **ignorado por git**), con el formato `CRM_EMAIL` / `CRM_PASSWORD`.

Se entra por POST a `/api/auth/login` y se guarda la cookie:

```bash
set -a; . ./.crm-login; set +a
curl -s -c /tmp/crm.jar -X POST http://localhost:4321/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$CRM_EMAIL\",\"password\":\"$CRM_PASSWORD\"}"
# y luego, con la sesión puesta:
curl -s -b /tmp/crm.jar http://localhost:4321/api/crm/secuencias
```

Para capturas hay un helper que ya hace el login y avisa de errores de JS —
que es justo lo que no se ve compilando:

```bash
cd sitio && npm run dev                       # en otra terminal
node scripts/qa-crm.mjs secuencias            # o leads, embudos, wiki…
node scripts/qa-crm.mjs leads --completa      # página entera
```

⚠️ **Playwright está en devDependencies y Vercel corre `npm ci --include=dev`.**
Sin candado, CADA build se bajaría Chromium. Por eso el proyecto tiene
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` en sus variables de entorno (los tres
entornos). Si algún día un build empieza a tardar de más en el install, revisa
que esa variable siga puesta. En local el navegador ya está en
`~/.cache/ms-playwright`; si falta: `npx playwright install chromium`.

⚠️ **La contraseña NO va en el repo ni en un commit.** Es la cuenta real del
dueño: quien la tenga entra al CRM completo. Si se filtra, se cambia desde
`/admin` — no se busca en el historial.

### Management API de Supabase (correr SQL sin depender de nadie)

El token personal del dueño vive en **`.supabase-token`** en la raíz del repo
(perms 600, **ignorado por git**). Con él se corre cualquier SQL —incluido DDL—
contra el proyecto del CRM:

```bash
TOK=$(cat .supabase-token)
SQL="select count(*) from wa_conversaciones;"
curl -s -X POST "https://api.supabase.com/v1/projects/wtzhogdyicekxcnclmyu/database/query" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  --data "{\"query\": $(node -e 'console.log(JSON.stringify(process.argv[1]))' "$SQL")}"
```

(El truco `node -e JSON.stringify` escapa comillas y saltos de línea del SQL.)

Proyecto: **`wtzhogdyicekxcnclmyu`** (`crm sacs`, us-west-2).

⚠️ **Por qué NO está commiteado:** es un token de CUENTA (`sbp_…`), no de
proyecto. Puede leer cualquier dato y borrar proyectos enteros. Si entra al
historial de git ya no se saca: solo se arregla revocándolo en
supabase.com/dashboard/account/tokens. Si un día da 401, es que lo rotaron —
hay que pedir uno nuevo y reescribir ese archivo, no buscarlo en el historial.

📋 **Regla al usarlo:** enseña el SQL antes de correrlo, ejecútalo, y verifica
el resultado. Todo cambio de esquema se guarda además como archivo en
`sitio/scripts/migration-*.sql` para que quede rastro en el repo.
