# GOAL · todo el CRM mobile-first

**Pedido del dueño (7-sep-2026):** «dale a todo hasta que todo el sistema quede
mobile first, todos los módulos y secciones».

Arrancó con un reporte concreto: Finanzas → Gastos salía **en blanco en medio de
una app oscura** y con el escritorio encogido (seis KPIs en rejilla, tabla de
siete columnas con scroll lateral).

---

## Qué significa «adaptada»

No es agregar el tab a `M_DARK_TABS`. Eso solo **cambia el fondo a negro**; si
la pantalla trae sus colores claros en línea, queda **fondo negro con texto
negro**, que es peor que blanco legible. Por eso el CSS de `CrmDashboard.tsx`
dice: *«SOLO pantallas adaptadas … una pantalla no adaptada queda en claro
legible, nunca fondo negro con texto negro»*.

Una pantalla está adaptada cuando cumple las cuatro:

1. **Rama de teléfono** con `useIsMobile()`, no el escritorio encogido.
2. **El sistema `m-*`**: `m-hdr` / `m-tt` / `m-cta` / `m-chips` / `m-chip` /
   `m-row` / `m-n1` / `m-n2` / `m-m1`. Es el mismo de Clientes y Leads.
3. **Un número, no seis.** En un teléfono cabe uno; el resto va plegado
   (`m-plegable`) o en otra pantalla.
4. **Nada de tablas.** Renglones tocables de 60 px mínimo. La acción principal
   se activa con el renglón entero, no con un control de 18 px.

Y entonces sí: el tab entra a `M_DARK_TABS`, con los overrides que le falten.

## Cómo se verifica

No se da por buena sin **abrirla en el teléfono**, en oscuro:

```
Playwright · 390×844 · isMobile · colorScheme dark
→ document.documentElement.dataset.crmDark === '1'
→ shot <archivo> "descripción"   (link obligatorio en la respuesta)
```

---

## Avance · COMPLETO

**46 pantallas medidas · 46 pasan el arnés.** 0 fallan.

Barrido del 7-sep-2026, en 390×844 y oscuro, contra el dev local:
lo que se sale de 390 px, superficies claras sobre fondo oscuro y contraste
texto/fondo. Cuatro bloques, todos en verde.

### Lo que hizo posible cerrarlo

**La paleta compartida.** `lib/crm/paleta.ts` la usan casi todas las pantallas y
sus valores van EN LÍNEA. Un bloque de overrides —con la cadena EXACTA que
serializa el navegador, leída del DOM— arregló once de golpe. Tocar cuarenta
archivos habría dejado que la siguiente naciera igual de blanca.

**Los tres agujeros que no se ven leyendo código:**
1. Los títulos no traían color propio: venía de una hoja global (h1..h4 en
   #1a1a1a), así que ningún selector por valor los alcanzaba.
2. `body` no tenía color en oscuro: todo lo que no declaraba el suyo caía al
   gris del tema claro.
3. Un `<button>` sin color lo pinta el navegador de NEGRO (`buttontext`), no lo
   hereda. Por eso flechas y botones de texto salían negros sobre negro sin
   tener ningún valor que buscar.

**Las tablas que se volvieron renglones:** comisiones (760 px), campañas
(1007 px), commissions (914 px). Siete a diez columnas en 390 px se leen de
lado, que es como no leerlas.

### Lo que aprendí a la mala

⚠️ **Un componente con tema propio no se pisa con reglas genéricas.** Trabajo
inteligente ya tenía su tema oscuro; mis overrides le aclararon el texto de dos
paneles que conservaban fondos claros fijos, y quedó gris claro sobre verde
claro. Se arregla completándole los huecos —pasar esos literales a SUS tokens—,
no excluyéndolo.

⚠️ **En el CSS de `CrmDashboard.tsx` no se escriben acentos graves.** Vive dentro
de un template literal y uno solo lo corta a media hoja. Pasó dos veces; la
segunda llegó a producción.

⚠️ **El arnés también miente si está mal hecho.** La primera versión dio «ok» a
una pantalla que la captura mostraba rota: el contraste texto/fondo no detecta
una tarjeta blanca con letra negra, porque por dentro tiene contraste perfecto.
Y la segunda marcaba como ilegibles pastillas que se leen bien, por no componer
el alfa del fondo sobre su padre.

### 🔑 La palanca: la paleta compartida
`lib/crm/paleta.ts` la usan casi todas las pantallas y sus valores se escriben
EN LÍNEA, así que ninguna cambiaba de tema. Un bloque de overrides en el CSS
oscuro de `CrmDashboard.tsx` —con el texto EXACTO que serializa el navegador,
leído del DOM— las arregla todas de golpe. El alternativo era tocar cuarenta
archivos y que el siguiente naciera igual de blanco.

⚠️ **En ese CSS no se escriben acentos graves.** Vive dentro de un template
literal y uno solo lo corta a media hoja. Ya me pasó dos veces; la segunda llegó
a producción.

### 🔬 El arnés de QA
`scratchpad/qa-movil.mjs <tab>` abre la pantalla en 390×844, oscuro, contra el
dev local (`npm run dev -- --port 4331`) y reporta tres cosas:
- **superficies claras sobre oscuro** — la que de verdad importa; el contraste
  texto/fondo NO la detecta, porque una tarjeta blanca con letra negra tiene
  contraste perfecto por dentro;
- **bajo contraste** texto/fondo;
- **lo que se sale de 390 px** (tablas con scroll lateral).

Y encima un **referee** (agente) que califica la captura de 1 a 10 contra el
estándar, y dice qué sobra. Se itera hasta 10/10.

### ⬜ Por hacer, en orden

| # | Tabs | Componente | Líns | ¿ya móvil? | Por qué en este orden |
|---|------|-----------|-----:|---|---|
| 1 | ti-seguimiento, ti-descalificar, ti-compromisos, ti-reactivacion, ti-informes | `TrabajoPanel` | 633 | NO | **5 pantallas de un golpe** y es lo que más se usa al día |
| 2 | cobranza | `CobranzaTab` | 1023 | NO | Dinero, y se abre desde el teléfono |
| 3 | comisiones | `ComisionesTab` | 87 | sí | Dinero, y es chica |
| 4 | abm | `AbmTab` | 347 | sí | Ya es móvil: falta el oscuro |
| 5 | sacs | `SacsUsuariosTab` | 239 | sí | Ídem |
| 6 | wa-plantillas, wa-numero | `ConfigWhatsApp` | 400 | sí | Ídem, 2 tabs |
| 7 | agenda | `ReunionesTab` | 1019 | sí | Grande, pero ya tiene base |
| 8 | hoy | `AgendaHoy` | 218 | NO | |
| 9 | onboarding | (lazy) | 129 | NO | |
| 10 | embudo | `EmbudoTab` | 161 | NO | Campañas |
| 11 | marca | `MarcaTab` | 195 | NO | |
| 12 | cobros | `PasarelaMercadoPago` | 205 | NO | |
| 13 | pipelines | `PipelinesConfig` | 121 | NO | Configuración: se toca poco |
| 14 | config | — | — | — | Ídem |
| 15 | wiki, equipo | `Wiki`, `Equipo` | — | — | **Tienen su propio tema**: revisar, no rehacer |

> `equipo` corre con `.eq` y su bloque `[data-crm-dark="1"] .eq{…}` propio —
> no entra a `M_DARK_TABS`. `wiki` se lee a pantalla completa y hay que ver si
> le aplica.

---

## Bitácora

- **7-sep-2026** · Finanzas ×5. Un número grande en vez de seis KPIs, «Todo el
  mes» plegado, la tabla a renglones, la casilla de pagado activada por el
  renglón entero, el mes en pastillas arriba. El formulario de alta se hoistó
  para que escritorio y teléfono usen el MISMO (dos copias se desincronizan).
