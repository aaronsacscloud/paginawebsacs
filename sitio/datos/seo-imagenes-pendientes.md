# Imágenes pendientes · pieza «Por qué tu sistema dice que tienes existencia y en la tienda no hay»

Se generan con ChatGPT (modelo de imagen) y se guardan en `sitio/public/images/`
con **exactamente** estos nombres. El nombre de archivo es parte del SEO: describe
la imagen en español, con guiones, sin acentos.

Formato: **1600×900**, exportar a **.webp** (y dejar el .png original al lado, como
ya se hace con las de Bershka). Estilo: diagrama limpio, fondo claro, sin fotos de
stock, sin texto en inglés.

---

## 1 · `blog-descuadre-inventario-kardex-409-vs-cero.webp`  ← hero

**Prompt:**
> Diagrama editorial limpio, horizontal 16:9, fondo blanco roto. A la izquierda,
> la pantalla de un sistema de punto de venta mostrando en grande el número
> "409" con la etiqueta "EN SISTEMA". A la derecha, una repisa de tienda
> completamente vacía con la etiqueta "EN EL ALMACÉN: 0". Entre ambos, una línea
> vertical punteada. Estilo minimalista de infografía, paleta sobria de azules
> grisáceos y un solo acento ámbar en el 409. Sin texto en inglés. Sin personas.

**Alt (ya está en el layout, usa el título):** conviene cambiar `BlogLayout.astro`
para que el alt describa la imagen en vez de repetir el título — hoy usa
`alt={title}`, que es la práctica que Google desaconseja.

---

## 2 · `blog-descuadre-linea-tiempo-409-congelado.webp`

**Prompt:**
> Línea de tiempo horizontal, estilo infografía limpia sobre fondo blanco, 16:9.
> Cuatro hitos con hora: "13:59 llega la mercancía", "14:18 sale por
> transferencia", "17:57 empiezan las ventas", "21:31 el cliente graba el video".
> Debajo, dos series paralelas: una etiquetada "detalle por talla" que baja
> escalonadamente de 409 a 0, y otra etiquetada "total del producto" que se
> queda plana en 409 todo el tiempo, resaltada en ámbar. Tipografía sans serif,
> sin adornos, en español.

---

## 3 · `blog-descuadre-renglon-partido-dos-mitades.webp`

**Prompt:**
> Diagrama de dos tarjetas idénticas lado a lado sobre fondo blanco, 16:9,
> estilo de documentación técnica. Ambas con el mismo encabezado "mismo producto,
> mismo almacén — creadas 13:59:47". La tarjeta izquierda muestra
> "existencia: 409 / ventas: 0". La derecha muestra "existencia: 0 / ventas: 409".
> Entre las dos, un símbolo de bifurcación y la leyenda "un solo registro partido
> en dos". Paleta sobria, un acento rojo suave. En español.

---

## 4 · `blog-descuadre-arbol-diagnostico.webp`

**Prompt:**
> Árbol de decisión vertical limpio, 16:9, fondo blanco. Primera pregunta:
> "¿El registro de movimientos cuadra con la existencia?" Dos ramas: SÍ lleva a
> "el problema es de LECTURA — revisa el total congelado o el renglón partido";
> NO lleva a "el problema es OPERATIVO — revisa si se vendió antes de capturar la
> entrada". Cada rama con dos sub-pasos. Al final de todo, en gris, "solo
> entonces: conteo físico". Estilo infografía minimalista en español, sin iconos
> decorativos.

---

## Al terminar

1. Guardar los 4 archivos en `sitio/public/images/`.
2. Revisar que la pieza se vea bien: `cd sitio && npm run dev` → `/blog/descuadre-inventario-anatomia`.
3. Cambiar `draft: true` → `draft: false` en el frontmatter.
4. Push (regla del repo: solo cuando el dueño lo pida).
