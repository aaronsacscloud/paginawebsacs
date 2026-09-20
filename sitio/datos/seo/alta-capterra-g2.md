# Alta de Sacs en Capterra y G2 — listo para copiar y pegar

Este documento junta lo que falta para dar de alta la ficha de Sacs en
**Capterra** (que syndica a Software Advice y GetApp) y en **G2**, más los
mensajes para pedir reseñas y las capturas ya generadas. Fuente de los datos:
`src/data/entidad.ts`, `src/data/plans.ts` y la confirmación del dueño del
19-sep-2026. Nada aquí se inventó: lo que seguía faltando se marca
`[FALTA DATO]`.

---

## 0. Antes de empezar — qué tener a la mano

- [ ] **Correo corporativo** `@sacscloud.com` (ej. `hola@sacscloud.com` o uno
  personal del dueño en ese dominio) — ambos sitios piden verificar con un
  correo del dominio de la empresa.
- [ ] **Acceso al DNS o al correo del dominio `sacscloud.com`** — por si el
  verificador manda un enlace de confirmación o pide un registro TXT.
- [ ] **El logo**: `public/brand/sacs-logo-full-dark.svg` (icono + wordmark
  "Sacs", trazo oscuro `#1a1a1a`, pensado para fondo claro — que es el fondo
  de casi cualquier formulario de alta). Si el campo pide un logo cuadrado
  (ícono solo, sin texto), usar `public/brand/sacs-icon-dark.svg`. Ninguno de
  los dos está exportado a PNG en el repo — ambos son SVG; si el formulario
  exige PNG/JPG, abrir el SVG en cualquier editor (o el propio navegador) y
  exportarlo a PNG a 500×500 px (ícono) o 720×240 px (logo completo,
  conserva la proporción 3:1).
- [ ] **Las 5 capturas** ya generadas (sección 1 de este documento, con sus
  links `shot`) — descargarlas y tenerlas listas antes de abrir el formulario.
- [ ] **Cuenta en cada plataforma** — Capterra usa el Vendor Portal de
  Gartner Digital Markets; G2 tiene su propio login, separado.

---

## 1. Las 5 capturas de la galería

Generadas con Playwright a 1280 px de ancho, recortadas a la pieza de
producto (sin menú ni pie de página). Publicadas para verlas desde el
celular:

| # | Qué muestra | Origen | Link |
|---|---|---|---|
| 1 | Punto de venta — categorías y ticket de cobro en vivo | `/producto/punto-de-venta`, captura en vivo con Playwright | https://code.sacscloud.com/shots/e6f0fb37326ce270.png |
| 2 | Inventario / Reportes — Dashboard de Inventario con tabla ABC por sucursal y SKU real | Asset ya usado en el sitio: `public/images/inventario-omnicanal-tab-reporte.webp` (ver nota abajo) | https://code.sacscloud.com/shots/21410865421dcf05.png |
| 3 | Tienda en línea — editor visual con hero, paleta y tipografía | `/producto/tienda-en-linea`, captura en vivo con Playwright | https://code.sacscloud.com/shots/48b1ef6c4f388764.png |
| 4 | WhatsApp vendiendo — Inbox de Sacs con un agente de IA cobrando por chat | Asset ya usado en el sitio: `public/images/whatsapp-catalogo.webp` (ver nota abajo) | https://code.sacscloud.com/shots/735f955c1088f267.png |
| 5 | Reportes — hub de reportes por área (punto de venta, ventas, clientes...) | `/producto/reportes-y-analitica`, captura en vivo con Playwright | https://code.sacscloud.com/shots/757010e237a8dd65.png |

**Nota honesta sobre las capturas 2 y 4** (para no entregar algo pobre sin
decirlo):

- **Captura 2 (inventario):** en la página `/producto/inventario-omnicanal`
  ese mismo screenshot vive dentro de un mockup de tablet con esquinas
  redondeadas que le recorta el borde derecho de la tabla (diseño intencional
  de la página). Tomé en cambio el archivo de imagen tal cual — es la misma
  captura real que ya usa el sitio, solo sin el recorte del mockup, para que
  la tabla se vea completa. La página tampoco tiene, hoy, ninguna captura que
  muestre literalmente una matriz talla × color (los assets disponibles para
  esa página son la vista de "Dashboard de Inventario" y esta tabla ABC); si
  el dueño quiere una captura específica de la matriz talla/color, hay que
  generarla aparte con datos reales de una cuenta demo.
- **Captura 4 (WhatsApp):** la página `/producto/marketing-por-whatsapp` no
  tiene, hoy, ninguna captura de interfaz real — sus imágenes (hero y
  showcase) son todas fotos de estilo de vida (alguien viendo el celular en
  la calle) o mockups borrosos, no pantallas del producto. Sí existe, ya
  guardado en el repo, un screenshot real y nítido del Inbox de WhatsApp de
  Sacs (`public/images/whatsapp-catalogo.webp` y su pareja
  `whatsapp-venta-producto.webp`), pero ninguno de los dos está conectado
  todavía a ninguna página en vivo del sitio — son piezas ya hechas que
  quedaron sin usar. Usé ese asset porque es real, nítido y exactamente lo
  que Capterra/G2 esperan ver ("WhatsApp vendiendo"); vale la pena que el
  equipo de producto lo conecte a `/producto/marketing-por-whatsapp` para que
  deje de ser una pieza huérfana.

**El logo para la ficha:** `public/brand/sacs-logo-full-dark.svg` — ícono de
tres círculos superpuestos (azul, ámbar, verde-azulado) sobre fondo oscuro
redondeado, más el wordmark "Sacs" en trazo `#1a1a1a`, proporción 3:1 (240×80
en su viewBox). Pensado para fondo claro, que es el 90% de los formularios de
alta. Si el campo pide un ícono cuadrado sin texto, usar
`public/brand/sacs-icon-dark.svg` (56×56, mismo trío de círculos).

---

## 2. Mensajes para pedir reseñas

Reglas seguidas en los tres: agradecer el tiempo con Sacs, explicar en una
línea qué es Capterra/G2 y por qué ayuda a otra tienda, decir que son 5
minutos, y **cero mención de regalo, descuento o beneficio a cambio** —
ofrecerlo viola los términos de ambas plataformas y puede tirar la ficha
completa.

### Versión WhatsApp (74 palabras)

```
Hola [Nombre] 👋 ¿cómo va todo por [tienda]? Te escribo rapidito: andamos
dándonos de alta en Capterra y G2 — son como el "Google de reseñas" de
software, y ahí es donde otra dueña de tienda como tú busca antes de
decidirse por un sistema. Tu opinión sobre Sacs ayuda muchísimo a que se
anime. ¿Nos regalas 5 minutitos para dejarla? Aquí está el link: [LINK].
Gracias de verdad por seguir con nosotros 🙌
```

### Versión correo (127 palabras, asunto incluido)

```
Asunto: ¿Nos regalas 5 minutos? Tu opinión sobre Sacs ayuda a otras tiendas

Hola [Nombre],

Espero que la temporada vaya bien por [tienda]. Te escribo porque estamos
dando de alta a Sacs en Capterra y G2 — son los sitios donde los dueños de
tienda comparan sistemas antes de decidirse, algo parecido a leer reseñas
antes de comprar en línea. Tu experiencia real con Sacs le sirve muchísimo a
otra marca que está justo donde estabas tú antes de empezar.

Son 5 minutos, sin compromiso, y puedes basarte en lo que ya nos compartiste
para tu caso de éxito o escribir lo que tú sientas justo.

Aquí está el link directo: [LINK]

Gracias por el tiempo y por seguir confiando en nosotros.

Un abrazo,
[Nombre] · Sacs
```

### Recordatorio a los 5 días (2 líneas)

```
Hola [Nombre], sé que andas hasta el tope con la tienda — solo un
empujoncito por si se te pasó el link de la reseña de Sacs 🙏
Son literal 5 minutos y nos ayuda muchísimo: [LINK]
```

**A quién mandarlo primero** (ya con relación de confianza por el caso de
éxito publicado):

| Cliente | Contacto | Canal sugerido |
|---|---|---|
| Liveshow Merchandising | Mariana López, Directora de Operaciones | WhatsApp o correo — es el único con nombre y cargo confirmados |
| La Bella Pandita | `[FALTA DATO]` — pedir al equipo comercial el contacto directo | — |
| Casa Maca | `[FALTA DATO]` — la cita pública es de Andrea Araujo (Sacs), no del cliente | — |
| Sandmade Swimwear | `[FALTA DATO]` — pedir contacto directo | — |

Mandar un correo/WhatsApp por plataforma en fechas distintas (uno para
Capterra, otro para G2) en vez de pedir las dos a la vez.

---

## 3. Hoja de alta — Capterra (Vendor Portal, syndica a Software Advice y GetApp)

Antes de abrir el formulario: confirmar que no exista ya una ficha buscando
"Sacs" o "Sacscloud" en capterra.com, softwareadvice.com y getapp.com — la
auditoría previa no pudo confirmarlo al 100% por el bloqueo anti-bot del
sitio.

| # | Campo del formulario | Valor a copiar |
|---|---|---|
| 1 | Nombre del producto | `Sacs` |
| 2 | Nombre de la empresa | `Sacscloud` |
| 3 | Razón social (si lo pide aparte) | `DESARROLLOS TECNOLOGICOS CON AMOR E IMPACTO POSITIVO` |
| 4 | Sitio web | `https://www.sacscloud.com` |
| 5 | Correo de contacto | `hola@sacscloud.com` |
| 6 | Teléfono / WhatsApp | `+52 55 9302 7234` |
| 7 | Año de fundación | `2014` |
| 8 | Sede / oficina | Santiago de Querétaro, Querétaro, México |
| 9 | Domicilio completo (si lo piden) | Calle Senda de Inspiración 19A, Col. Milenio III, Santiago de Querétaro, Querétaro, C.P. 76060, México |
| 10 | Número de empleados | `[FALTA DATO]` — no inventar; dejar el campo pendiente o pedir al dueño que elija el rango real antes de enviar |
| 11 | Tagline / resumen corto | `El sistema para marcas y tiendas de moda en México: inventario por talla y color, punto de venta, tienda en línea, mayoreo y WhatsApp sobre una sola base.` |
| 12 | Descripción larga | Ver la de 500 palabras en `fichas-externas.md`, sección 1 — pégala tal cual, es la versión "oficial" para que un modelo de IA reconozca a Sacs de forma consistente en todas las fichas |
| 13 | Categorías | Retail Management Software · Retail POS / Point of Sale Software · eCommerce Software · Inventory Management · Apparel & Footwear (si existe como subcategoría — **no** usar "Fashion Design Software") · Wholesale / B2B Commerce · Jewelry Store Software (si aplica) |
| 14 | Mercado objetivo / audiencia | Tiendas de ropa, boutiques multimarca, zapaterías, joyerías, marcas propias de moda, mayoristas, consignación, novias y fiesta, activewear, merchandising de eventos — de una sola tienda a cadenas de decenas de sucursales |
| 15 | Países donde opera | México |
| 16 | Idiomas soportados | Español |
| 17 | Precio de entrada | Desde $527 MXN al mes por sucursal (plan anual) |
| 18 | Modelo de precio | Suscripción mensual o anual, por sucursal, sin contratos de permanencia |
| 19 | Tabla de precios (si la piden completa) | Vende: $810/mes ó $527/mes anual · Controla: $1,215/mes ó $790/mes anual · Fideliza y Multiplica: $1,890/mes ó $1,229/mes anual · Automatiza: $3,780/mes ó $2,457/mes anual (todo MXN por sucursal — cifras de `src/data/plans.ts`) |
| 20 | Lista de funciones (features) | Punto de venta con y sin internet · Tienda en línea integrada al mismo inventario · Mayoreo y B2B con listas de precio · Facebook/Instagram/WhatsApp/TikTok Shop conectados · Apartados con abonos y pedidos · Cambios de talla y devoluciones entre sucursales · Promociones y rebajas programadas · Facturación CFDI 4.0 · Metas y comisiones · Inventario por talla y color (matriz) · Multi-sucursal y CEDIS · Traspasos y nivelación entre tiendas · Conteo físico sin cerrar la tienda · Compras y reabasto por curva de tallas · 50+ reportes · Gastos, cuentas por pagar y bancos · CRM de clienta · Monedero y puntos de lealtad · Portal de clienta y tarjetas de regalo · Campañas por correo y WhatsApp · Membresías · AXO (copiloto de IA) · Automatizaciones · Pronóstico de demanda · API abierta con +600 integraciones · Suite Joyería · Suite de Consignación |
| 21 | Integraciones | Facebook, Instagram, WhatsApp, TikTok Shop, Mercado Libre, Shopify, +600 apps vía API (plan Automatiza) |
| 22 | Logo | `public/brand/sacs-logo-full-dark.svg` (exportar a PNG si el formulario no acepta SVG) |
| 23 | Capturas de pantalla (4-6) | Las 5 de la sección 1 de este documento, en este orden: punto de venta → inventario/reportes → tienda en línea → WhatsApp → reportes |
| 24 | Video (opcional, si lo piden) | No hay uno genérico de producto listo; dejar en blanco por ahora en vez de improvisar uno |
| 25 | Enlaces a redes / sameAs | LinkedIn: `https://www.linkedin.com/company/sacscloud` |

**Verificación:** normalmente basta un correo `@sacscloud.com`. Si piden
confirmar el dominio por DNS, se necesita acceso al panel de DNS de
`sacscloud.com`.

---

## 4. Hoja de alta — G2

Cuenta y proceso separados de Capterra (G2 es una empresa distinta). Mismo
criterio: confirmar primero que no exista ya una ficha de "Sacs" o
"Sacscloud" en g2.com.

| # | Campo del formulario | Valor a copiar |
|---|---|---|
| 1 | Nombre del producto | `Sacs` |
| 2 | Empresa | `Sacscloud` |
| 3 | Razón social | `DESARROLLOS TECNOLOGICOS CON AMOR E IMPACTO POSITIVO` |
| 4 | Sitio web | `https://www.sacscloud.com` |
| 5 | Correo de verificación | Un correo `@sacscloud.com` (ej. `hola@sacscloud.com`) — G2 es estricto verificando que sea del dominio de la empresa |
| 6 | Año de fundación | `2014` |
| 7 | Sede | Santiago de Querétaro, Querétaro, México |
| 8 | Número de empleados | `[FALTA DATO]` |
| 9 | Short description | `El sistema para marcas y tiendas de moda en México: inventario por talla y color, punto de venta, tienda en línea, mayoreo y WhatsApp sobre una sola base.` |
| 10 | Long description | La de 500 palabras de `fichas-externas.md` sección 1 |
| 11 | Categorías G2 | Retail Management Software · POS Software · eCommerce Platforms · (si existe) Inventory Management Software |
| 12 | Precio | Desde $527 MXN/mes por sucursal (plan anual) — mismo detalle de planes que en Capterra, sección 3 fila 19 |
| 13 | Mercado objetivo | Tiendas y marcas de moda en México, de una boutique a cadenas de decenas de sucursales |
| 14 | Países | México |
| 15 | Idiomas | Español |
| 16 | Logo | `public/brand/sacs-logo-full-dark.svg` — si G2 pide un ícono cuadrado sin texto, usar `public/brand/sacs-icon-dark.svg` |
| 17 | Capturas de pantalla | Las mismas 5 de la sección 1 |
| 18 | Fundador / leadership (si lo pide) | Aaron Herzberg, Director general — confirmado por el dueño el 19-sep-2026, ya apto para uso público |
| 19 | Redes / perfiles | LinkedIn: `https://www.linkedin.com/company/sacscloud` |

**Qué exige para entrar a las Grid® (Leader, High Performer, etc.):** un
volumen mínimo de reseñas recientes — las de los últimos 12 meses pesan más
que las viejas, así que conviene concentrar el pedido de reseñas (sección 2)
en una ventana corta en vez de ir goteando una por mes.

---

## 5. Lo que sigue pendiente del dueño

- **Número de empleados** — sigue sin dato. No se inventó ningún número ni
  rango; dejarlo pendiente en ambos formularios hasta que el dueño lo
  confirme.
- **Contactos directos de La Bella Pandita, Casa Maca y Sandmade** — para
  poder mandarles los mensajes de la sección 2 (hoy el sitio solo cita
  "Equipo X" en sus casos de éxito, no una persona).
- **Confirmar si ya existe una ficha** de Sacs/Sacscloud en Capterra,
  Software Advice, GetApp o G2 — entrar directo a cada sitio con sesión antes
  de crear una nueva, porque el bloqueo anti-bot no permitió confirmarlo al
  100% desde este entorno.
- **Conectar los screenshots reales de WhatsApp al sitio** —
  `whatsapp-catalogo.webp` y `whatsapp-venta-producto.webp` ya existen y son
  buenos, pero hoy no están enlazados en ninguna página en vivo (ver nota de
  la captura 4, sección 1). Vale la pena pedirle al equipo de producto que
  los suba a `/producto/marketing-por-whatsapp`.
- **Nota sobre la ficha de Google ya confirmada** (4.7 con 113 reseñas): no
  es un campo de Capterra/G2, pero sirve como referencia de credibilidad si
  algún formulario pregunta "¿tienes reseñas en otro lado?".
