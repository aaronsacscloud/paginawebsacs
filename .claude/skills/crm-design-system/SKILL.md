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

## 5. Espaciado

- El contenido del CRM **nunca toca el borde de la ventana**: el contenedor
  pone 22 px arriba en escritorio.
- Rejilla de tarjetas: `gap: 10–13px`.
- Una tarjeta respira con `padding: 15px 17px`.

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
6. Si es un documento del cliente: ¿cinta, firma en degradado, y **Sacscloud**?
