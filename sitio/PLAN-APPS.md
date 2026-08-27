# Plan de apps: multi-plataforma y App Stores (Capacitor)

Cómo el CRM móvil llega bien a CUALQUIER teléfono hoy (PWA) y cómo se sube a
las tiendas mañana (Capacitor), sin bifurcar el código.

## 1 · Multi-plataforma HOY (PWA) — qué ya está y qué cubre

| Plataforma | Cómo lo usa | Qué lo soporta en el código |
|---|---|---|
| iPhone (Safari) | Compartir → "Agregar a inicio" | `apple-mobile-web-app-*`, `apple-touch-icon`, safe-areas con `env(safe-area-inset-*)`, `viewport-fit=cover` (notch), SW registrado |
| Android (Chrome/Edge/Samsung) | Banner de instalación nativo | manifest con `id`, iconos **maskable** dedicados (arte al 66% sobre morado — sin ellos Android recorta el logo), `display: standalone`, `theme-color` claro/oscuro |
| Huawei (sin Google, AppGallery Browser/Petal) | PWA por navegador, igual que Android | mismo manifest; el SW y el SWR de datos hacen el arranque local sin depender de servicios Google |
| Escritorio (Chrome/Edge) | Instalable como app de ventana | mismo manifest; el CRM desktop ya existe y no se tocó |

Reglas que lo mantienen sano:
- `100dvh` (no `100vh`) en sheets/hilos — teclados y barras dinámicas de iOS/Android.
- Targets táctiles ≥44px y tipografía ≥16px en inputs (anti-zoom iOS) — ya en CRM_MOBILE_CSS.
- El tema oscuro responde a `prefers-color-scheme` + scope `data-crm-dark`: en
  cualquier OS el sistema decide y el CRM obedece.
- iOS purga el SW tras ~7 días sin uso: la app sigue funcionando (red normal),
  solo pierde el arranque instantáneo hasta la siguiente visita.

## 2 · App Stores con Capacitor — estrategia en 2 fases

### Fase 1 (recomendada para arrancar): cascarón remoto
La app nativa es un WebView Capacitor apuntando a `https://www.sacscloud.com/admin/crm`.

- **Pros**: cero cambios de arquitectura; cada deploy de Vercel actualiza la app
  al instante (sin pasar por revisión de la tienda); las cookies de sesión
  funcionan igual (mismo origen); el SW + SWR ya dan arranque rápido.
- **Contras**: Apple puede objetar apps que son "solo un sitio web" (guideline
  4.2). Mitigación: es una app de negocio con login (categoría Business, como
  las apps enterprise); y en fase 1 ya se agregan capacidades nativas:
  StatusBar (color por tema), SplashScreen, Push (cuando toque), Haptics.
- **Config**: `capacitor.config.ts` con `server: { url: 'https://www.sacscloud.com/admin/crm' }`,
  `App` plugin para el botón atrás de Android (ya cubierto: `useDrawerHistory`
  usa pushState → el back nativo cierra overlays antes de salir).

### Fase 2 (solo si la tienda lo exige): cascarón local + API remota
Empaquetar el shell estático (HTML + chunks JS de `/_astro/`) DENTRO de la app
y pegarle a las APIs de producción.

- Requiere en el servidor: CORS para el origen `capacitor://localhost` +
  cookies `SameSite=None; Secure` (hoy el middleware asume mismo origen).
- Requiere en el cliente: base URL configurable para `/api/*` (hoy relativa).
  El código YA está listo a medias: todos los fetch pasan por rutas relativas
  `/api/...` — un solo interceptor (o `const API_BASE`) las redirige.
- Beneficio: arranque 100% local; costo: cada cambio de shell pasa por review.

**Decisión**: arrancar Fase 1. La memoria del negocio (deploys diarios, un
solo founder-usuario hoy, equipo pequeño mañana) hace que el ciclo "push →
app actualizada" valga más que el arranque local puro.

### Checklist para publicar (cuando se decida)
1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android` en `sitio/`.
2. `npx cap init "SACS CRM" com.sacscloud.crm` + config con server.url.
3. Iconos/splash: generar desde `crm-icon-512` (herramienta `@capacitor/assets`).
4. iOS: cuenta Apple Developer ($99/año), Xcode, TestFlight primero.
5. Android: Play Console ($25 una vez), AAB firmado. Huawei AppGallery: cuenta
   gratuita, sube el mismo APK (la Fase 1 no usa servicios Google → compatible).
6. Privacidad: URLs de política ya existen en sacscloud.com; declarar "datos de
   cuenta" (email) en los formularios de las tiendas.

## 3 · Qué quedó preparado en esta pasada
- Manifest v2: `id`, `categories`, iconos maskable dedicados (192/512).
- `theme-color` dual (claro `#ffffff` / oscuro `#131318`) — la barra del
  sistema acompaña al tema.
- `viewport-fit=cover` — el contenido respeta el notch con las safe-areas ya
  existentes.
- Dark REAL en el Inbox (lista + hilo + composer) — ninguna pantalla adaptada
  "se pone blanca" en modo oscuro.
