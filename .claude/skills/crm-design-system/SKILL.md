---
name: crm-design-system
description: Reglas visuales del CRM interno (/admin/crm) y de los documentos que recibe el cliente — cotización, acuse, estado de cuenta, minuta. Consúltala ANTES de escribir cualquier pantalla o documento del CRM.
---

# El sistema visual del CRM

El sitio público de SACS tiene su propia identidad (ver `sacs-brand-identity`:
azul #4B7BE5, botones en píldora, Space Grotesk). **El CRM es otra cosa** y no
comparte esa paleta. Estas son sus reglas.

---

## 1. El morado manda

```
Morado          #9B8CFA    la forma: franjas, puntos, barras, botones
Morado tinta    #5B4BD6    la cifra: números y texto que importa
Morado hondo    #4536BE    hover del botón primario
Morado agua     #EEECFE    fondos de pastilla, pestaña activa
```

**Los estableció Cotizaciones y son los que mandan.** Una pantalla nueva usa
estos y no un morado parecido: un módulo con su propio tono se lee como otro
producto, y con veinte pantallas la diferencia deja de ser un detalle.

Viven en `sitio/src/lib/crm/paleta.ts`. **Impórtalos, no los escribas a mano.**

### El resto de la paleta

```
Azul            #7DA6F5 · tinta #2C5FC4 · agua #E3EDFD
Rosa            #D9538E · suave #EFA6CA · tinta #9c3d70     firma de marca, lo que se va
Verde           #4FBF95 · tinta #1E8A63 · agua #EAF8F2      dinero que entró, todo bien
Rojo            #EF7A72 · tinta #C0554E · agua #FEF0EF      vencido, perdido, roto
Ámbar           #E8A838 · tinta #9a6a10 · agua #FFF4E5      atención, aún no es problema
```

### Cómo se reparte el color

- **Pastel en la FORMA** —franja, punto, barra, fondo de pastilla—. Es
  decoración: dice de qué habla el bloque antes de leerlo.
- **Tinta en la CIFRA.** Una cantidad de dinero es información; si se despinta
  hay que acercarse a la pantalla para leerla, docenas de veces al día.
- **El significado no se negocia**: verde entró, rosa/rojo se fue, ámbar urge,
  morado es el recurrente y lo propio del sistema.

---

## 2. La tarjeta de KPI

Fondo blanco, borde `#ececec`, **franja de color de 3 px a la izquierda**,
radio 10. La franja dice de qué habla el número antes de leerlo.

```tsx
import { P, tarjetaKpi } from '../../../lib/crm/paleta';
<div style={tarjetaKpi(P.verde)}>…</div>
```

Dentro: etiqueta en versalitas 0.625rem gris `#999`, cifra 1.375–1.6rem peso
800 en su tinta, y una línea secundaria de 0.6875rem en `#888`.

## 3. Los botones tienen jerarquía, y se ve

```
Principal    fondo #9B8CFA sólido, letra blanca      · uno por pantalla
Secundario   fondo blanco, borde y letra MORADOS     · 1.5px #9B8CFA / texto #5B4BD6
Terciario    fondo blanco, borde y letra grises      · lo que casi nunca se toca
Destructivo  letra #C0554E, borde #f0c4bd            · nunca relleno
```

**Nunca negro.** Un botón negro no está en la paleta y además grita más que el
principal: pasó en Reuniones, donde "Esta semana" pesaba lo mismo que la acción
de la pantalla. En un grupo de segmentos, el ELEGIDO va en morado sólido y los
demás quedan neutros — si todos llevan borde morado, ninguno se ve activo.

El azul no es un botón secundario: es un color de dato (franjas de tarjeta,
cifras neutras). Si lo usas en un botón, compite con el morado del sistema.

## 4. Pestañas

Activa con fondo `#EEECFE`, radio `9px 9px 0 0`, borde inferior de 2 px en
`#9B8CFA`, texto `#5B4BD6` peso 800. Inactiva en `#666` peso 500. Contador en
pastilla pegado al texto.

## 4 bis. La firma de pantalla: el sello y los destellos

**Decisión del dueño (13-sep-2026): es la gestión de branding del CRM.** Toda
pantalla de módulo lleva, en la franja del título y en ningún otro lado:

- **Los destellos**, `<Chispas />` de `components/admin/crm/ui/Chispas.tsx`. Son
  la chispa del logo en dos capas —diez grandes que se ven y ocho chiquitos de
  polvo— con el latido desfasado. No se copian a otra pantalla: se importan. Un
  segundo juego con otros tamaños se lee como otra casa.
- **El sello**, `<Sello>…</Sello>`: la frase de esa pantalla en versalitas,
  dentro de una píldora blanca con borde rosa, pegada al título.

```tsx
import Chispas, { Sello, CSS_CHISPAS, CSS_SELLO } from './ui/Chispas';
<style>{CSS_CHISPAS + CSS_SELLO}</style>
<div className="chispas-cab" style={{ display:'flex', alignItems:'center', gap:12 }}>
  <Chispas />
  <h1>Soporte <Sello>Que nadie se quede a oscuras</Sello></h1>
</div>
```

### Las cuatro reglas que no se negocian

1. **Solo en la banda del título.** Es la única franja sin cifras; un destello
   detrás de un número estorba al leerlo. Nunca sobre tablas ni KPIs.
2. **El sello pesa igual en todas.** Mismo tamaño, mismo color, misma píldora.
   Es la firma de la casa, no el subtítulo de la sección: si cada módulo le
   cambia el tono, deja de ser una firma.
3. **Una frase por pantalla, y dice lo que esa pantalla hace.** Todas hablan el
   mismo idioma —estrellas y constelaciones, el de la entrada— pero cada una
   nombra su trabajo.
4. **La frase se calla cuando no cabe en la escena.** En Clientes desaparece al
   ver exclientes: «Ninguna estrella brilla sola» sobre una lista de cuentas que
   se fueron suena a burla. En pantalla angosta se esconde por CSS.


### La tercera pieza: LA TARJETA FARO

Nació en Clientes y el dueño la volvió branding el 13-sep-2026 («el color y las
estrellas que pusimos en clientes y cotizaciones»). **Una** tarjeta de KPI por
pantalla se pinta distinto:

- fondo `linear-gradient(135deg,#EEECFE,rgba(244,168,205,.16))`, borde `#ddd6fb`,
- **sin** franja de color a la izquierda,
- y una chispa de 52 px cortada por la esquina superior derecha, en
  `rgba(217,83,142,.18)` al 50% de opacidad,
- la cifra sube a 1.5rem y el rótulo pasa a `#8a6a9c`.

Se pide con `faro` en `ui/KpiCard`; las pantallas con su propia tarjeta copian
esas cuatro líneas y nada más.

**No es decoración repartida: es jerarquía.** Una fila de cuatro tarjetas
iguales no tiene dueño y el ojo empieza por la de la izquierda en vez de por la
que importa. Por eso es **una sola por pantalla** — dos faros no alumbran el
doble, se anulan. La que se elige es la que pide acción hoy:

| Pantalla | Faro |
|---|---|
| Clientes | la cuenta que manda la fila |
| Soporte | Sin resolver |
| Taller | Esperan tu OK |
| Consultoría | Ideas por vender |

Si la pantalla no tiene fila de KPIs —Leads abre en lista—, no se inventa una
para colgarle el faro.

### El catálogo de frases

| Pantalla | Frase |
|---|---|
| Entrada (login) y Tablero | Conectando estrellas, creando constelaciones |
| Cotizaciones | Cada sí enciende una estrella |
| Clientes | Ninguna estrella brilla sola |
| Soporte | Si algo se apaga, aquí se enciende |
| Taller | Aquí se pule cada estrella |
| Consultoría | Sembramos relaciones, cosechamos constelaciones |
| Leads | Cada nombre es una estrella por encender |

Las eligió el dueño el 13-sep-2026 de entre cuatro opciones por pantalla; la de
Consultoría se rehizo pidiendo que hablara de **relación y abundancia**, que es
como él describe ese trabajo.

Una pantalla nueva **no inventa su frase sola**: se propone al dueño y se anota
aquí, porque el catálogo es lo que impide que en un año haya once voces.

## 5. Espaciado

- El contenido del CRM **nunca toca el borde de la ventana**: el contenedor
  pone 22 px arriba en escritorio.
- Rejilla de tarjetas: `gap: 10–13px`.
- Una tarjeta respira con `padding: 15px 17px`.

## 5 bis. NINGUNA SECCIÓN DESCUADRADA (regla dura del dueño)

**El dueño lo pidió dos veces y la segunda con una captura: «por ningún motivo
esto se debe de ver así, no pueden existir secciones descuadradas».** Es una
regla de aceptación, no una preferencia: una pantalla con un escalón de fondo
colgando no se sube.

Qué cuenta como descuadrado, en orden de frecuencia:

1. **Una rejilla de N columnas con UN solo hijo.** Pasa siempre igual: el
   bloque vecino se mueve a otra sección y nadie cambió la rejilla, así que
   queda media fila de fondo. O se llena con otro bloque, **o el que queda se
   va a ancho completo**. No hay tercera opción.
2. **Dos tarjetas del mismo renglón que terminan a distinta altura.** Se
   arregla en la tarjeta, no en la pantalla: `display:flex; flexDirection:
   column; height:100%` y la nota explicativa al pie con `marginTop:auto`.
   Así el aire sobrante queda DENTRO y las dos cierran en la misma línea.
3. **El aire amontonado en un hueco.** Cuando una tarjeta estira, su contenido
   no se queda arriba: lo que puede crecer reparte el sobrante entre sus
   renglones (`flex:1; justifyContent:space-evenly`).
4. **Contenido que no cabe en su columna.** Una tabla de cinco columnas metida
   en media pantalla se lee peor que a ancho completo. Si el bloque tiene más
   contenido que sus vecinos, no comparte renglón: se lleva la fila entera.

### Cómo se verifica antes de dar por buena una pantalla

No a ojo. Con el navegador abierto y sesión real, la diferencia de altura entre
las tarjetas de un mismo renglón tiene que ser **CERO**:

```js
[...document.querySelectorAll('.rejilla')].map(f => {
  const h = [...f.children].map(c => Math.round(c.getBoundingClientRect().height));
  return h.length > 1 ? Math.max(...h) - Math.min(...h) : 0;   // todos en 0
});
```

## 6. Los documentos que recibe el cliente

Cotización, acuse de pago, estado de cuenta y minuta comparten forma:

- **Cinta de marca arriba**: `linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,rgba(244,168,205,.9))`
- **Firma en degradado**: `linear-gradient(100deg,#7C6BF0,#8E7DEF 35%,#D9538E)`
  con `background-clip: text`. Se salta el azul claro porque a 8 px en
  mayúsculas se lee grisáceo.
- **Bloque lila** para el ancla del documento —el total, la próxima fecha—:
  `linear-gradient(135deg,#EEECFE,rgba(244,168,205,.22))`
- **Botón primario** en `#9B8CFA` sólido, hover `#7C6BF0`. Nunca negro.
- La marca se escribe **Sacscloud** — ni SACSCloud, ni SACS Cloud, ni en
  versalitas (cuidado con `text-transform: uppercase` heredado).
- **El PDF es la misma página impresa**: conserva los colores con
  `print-color-adjust: exact` y esconde los botones con `.no-print`.

## 7. Estados de carga

Uno solo en todo el CRM: la **chispa en órbita** de
`components/admin/crm/ui/Cargando.tsx` —la misma chispa de la marca, girando,
porque el giro es el lenguaje universal de "espera" y se entiende de reojo.

```tsx
<Cargando texto="Cargando clientes…" />   // el texto dice QUÉ se trae
<Chispas size={9} color="#fff" />          // dentro de un botón: color plano
```

`color` la pinta plana en vez del degradado: sobre un botón morado el degradado
morado→rosa se pierde. `Corazones` sigue exportado como alias —lo importan 21
pantallas— pero en código nuevo se usa `Chispas`.

Nunca un "Cargando…" suelto. A los 8 s el componente avisa que tarda, a los 20
ofrece reintentar, y respeta `prefers-reduced-motion`.

## 8. Sin emoji en la interfaz

Nada de iconos decorativos: SVG de trazo o jerarquía tipográfica. La única
excepción es ⚠️ para un riesgo real.

---

## Antes de dar por buena una pantalla

1. ¿Los morados salen de `paleta.ts` o los escribiste a mano?
2. ¿Las tarjetas llevan su franja de color?
2b. ¿El botón principal es morado sólido y los secundarios de puro borde morado? ¿Queda algún negro?
3. ¿El verde significa que entró dinero y el rojo que se fue?
4. ¿Hay algún `Cargando…` que no sea el componente (la chispa en órbita)?
5. ¿La pantalla respira arriba?
5b. ¿Hay alguna rejilla con un solo hijo, o dos tarjetas del mismo renglón que
    terminen a distinta altura? **Se mide, no se mira** (ver 5 bis).
6. Si es un documento del cliente: ¿cinta, firma en degradado, y **Sacscloud**?

---

## 8. El margen de página

Uno solo, y se **importa**: `WRAP` de `sitio/src/lib/crm/layout.ts`.

```tsx
import { WRAP } from '../../../lib/crm/layout';
<div style={WRAP}>…</div>          // tope 1560 · centrado · 24 de aire
```

Escribirlo a mano es lo que produjo tres reglas distintas conviviendo —`1280
centrado`, `1200 sin aire`, `sin tope`— y que el título de Clientes empezara a
74 px del menú y el de Reuniones a 24.

**Por qué el tope es 1560 y no 1280.** Con la caja fija en 1280, plegar el menú
liberaba 156 px y no aparecía ni una columna: todo se iba a margen. Con 1560 la
caja es fluida en cualquier laptop —el margen se queda en 24, se compacta con el
menú abierto y se abre al plegarlo— y el tope solo entra en monitores muy anchos,
donde una tabla de nueve columnas estirada no se lee de corrido.

Antes de dar por buena una pantalla: **¿usa `WRAP` o escribió su propio ancho?**
