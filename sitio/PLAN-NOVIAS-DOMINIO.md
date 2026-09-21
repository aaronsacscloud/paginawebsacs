# Plan para dominar el segmento novias (y el molde para cualquier giro)

Cómo pasar de UNA página buena a SER la referencia del tema en Google, Bing y
las IAs: 15 criterios «WOW» que van más allá de los 28 que ya juzga el motor,
la arquitectura de enlaces (pieza → subpágina → landing) y el plan por
ángulos. Escrito el 22-sep-2026 sobre el caso de novias; se replica por giro.

## 1. Los 15 criterios WOW (29-43)

Los 18 del referee hacen que una página PASE. Los 10 de IA/agentes hacen que
la CITEN. Estos 15 hacen que la gente la USE, la comparta y vuelva — que es lo
que ningún competidor del ramo tiene y lo que un modelo ya no puede copiar.

| # | Criterio | Qué es | Quién | Por qué es WOW |
|---|---|---|---|---|
| 29 | **Selector de caso** | Arriba de la página: «Tengo 1 boutique / 3 sucursales / también rento» y el texto reordena y resalta lo que aplica (misma URL, sin recarga) | motor | Nadie del ramo personaliza; la lectura se vuelve suya |
| 30 | **Dato propio del ramo** | Un número que solo Sacs puede saber, agregado y anónimo de las tiendas que lo usan («en las boutiques de novias en Sacs, el apartado promedio dura 143 días y el 11% cambia de talla entre la primera y la última prueba») | motor (consulta a la base de sacs3) + dueño autoriza | Es la cita que las IAs repiten con nuestro nombre porque no existe en otro lado |
| 31 | **Caso real con nombre y cifras** | Una tienda que autorice (Casa Maca, Forja Western ya existen en video): antes/después con números | dueño consigue el permiso, motor escribe | E-E-A-T de experiencia real; lo que convierte a una dueña escéptica |
| 32 | **La voz de una dueña** | 2-3 citas textuales de una dueña real (10 min por WhatsApp), con nombre y ciudad | dueño | «Suena a alguien como yo» — imposible de fingir y Google lo premia |
| 33 | **«Cuándo NO te conviene Sacs»** | Sección honesta: si solo rentas 20 vestidos, si no facturas, si… | motor | La anti-venta es la señal de credibilidad más fuerte que hay; las IAs la citan como «equilibrado» |
| 34 | **Plantilla descargable hecha por el motor** | La nota de apartado, la ficha de medidas, el contrato: página imprimible `/recursos/<slug>/plantilla/` con los campos de la guía, marca Sacs, botón imprimir/PDF | motor | Lead magnet real sin diseñador; lo que la competencia promete y no da |
| 35 | **Video propio de 60 s** | Un clip explicativo por pieza (avatar o pantalla animada) con VideoObject y transcripción, generado (Higgsfield/gemini video) o grabado | motor genera, dueño aprueba | Carrusel de video en Google, tiempo en página ×3 |
| 36 | **Escúchalo en 3 minutos** | El resumen y los pasos en audio (TTS) con reproductor arriba | motor | Accesibilidad + el dueño que maneja lo escucha; señal de «contenido rico» |
| 37 | **Calculadora del costo de no tenerlo** | «¿Cuántos vestidos vendiste dos veces este año? ¿Cuántos apartados vencieron?» → pérdida en pesos + botón «mándame el resultado por WhatsApp» (entra al CRM) | motor construye (ya hay 3 herramientas) | Convierte lectura en lead con dato propio |
| 38 | **Bloques compartibles** | Cada tabla y diagrama con «Copiar» y «Mandar por WhatsApp» (imagen + enlace a la pieza) | motor | Distribución orgánica en los grupos de WhatsApp de dueñas, que es donde vive el ramo |
| 39 | **Revisado por un experto con nombre** | Lo legal-fiscal (LFPC, CFDI) con «revisado por [contador/abogado], cédula, fecha» | dueño consigue al experto | E-E-A-T de autoridad; nadie del ramo lo tiene |
| 40 | **Página gemela para la clienta final** | La misma pregunta desde el lado de la novia («¿cuánto anticipo me pueden pedir?») enlazada con la de la dueña | motor | Captura la búsqueda de bodas.com.mx (100× más volumen) y enlaza hacia el hub |
| 41 | **Lo que dicen los foros** | Bloque con 3 citas reales de foros (bodas.com.mx) con enlace, y la respuesta de la guía a cada una | motor (ya las trae la investigación) | Demuestra que contesta lo que la gente pregunta y enlaza al dominio que las IAs ya citan |
| 42 | **Serie por correo/WhatsApp del tema** | «Recibe las 6 piezas de novias, una por semana» → embudo del CRM (ya existe) | motor arma, dueño enciende | Retención y segundo toque; la pieza deja de ser un clic suelto |
| 43 | **100 en rendimiento y accesibilidad** | LCP < 1.5 s, AVIF/WebP, contraste AA, teclado, alt en todo; medido en cada publicación | motor | Los rastreadores de IA tienen timeouts; Google mide; el 60% del ramo lee en celular con datos |

Cómo entran al motor: `CRITERIOS_WOW` en `calidad.ts` se le dan al referee
como tercer nivel: **no bloquean** (una página sin video puede pasar), pero
salen puntuados en la bandeja (`wow: 6/15`) y cada uno que falta genera un
pendiente en «Seguimiento» con su `quien`. Los que son construcción (29, 34,
36, 37, 38, 43) se hacen una vez en la plantilla y valen para todas las piezas.

## 2. La arquitectura de enlaces: pieza → subpágina → landing

La regla que pediste —«una página debe llevar a otra subpágina y esa a una
principal»— es un **hub-and-spoke por giro** con tres niveles y enlaces en los
dos sentidos. Para novias:

```
NIVEL 0 · LANDING COMERCIAL           /giros/novias-y-fiesta            (hoy: 0 enlaces a guías ← el hueco más grande)
        ▲ CTA a mitad + cierre         │ bloque «Guías para boutiques de novias» (hub + 5 mejores spokes)
        │                               ▼
NIVEL 1 · HUB DEL TEMA (guía maestra)  /software-para/tienda-de-novias/  (la pieza que ya pasó: contesta TODO en resumen)
        ▲ 1 enlace contextual + CTA     │ bloque «Mapa del tema» con TODOS los spokes, agrupados por intención
        │                               ▼
NIVEL 2 · SPOKES (un ángulo cada uno)  /recursos/… /comparar/… /herramientas/…
        │  cada spoke: 1 enlace arriba al hub, 2 laterales a spokes hermanos, CTA a mitad a la landing
        ▼
NIVEL 3 · SATÉLITES                    página gemela para la novia · páginas por país (Latam) · plantillas · videos del canal
           todas apuntan al hub (y la gemela también a bodas.com.mx como fuente)
```

Reglas que el motor aplica solo (`enlaces.calcular` + checks del referee):

1. **Ninguna pieza sin camino hacia arriba**: todo spoke enlaza al hub en el primer tercio y a la landing en la CTA de mitad. (Check duro: ya exige `/giros/<giro>`; se agrega «enlaza al hub del giro».)
2. **El hub enlaza a todos**: bloque «Mapa del tema» generado de `de_contenido` por giro, agrupado por intención (entender / hacer / comparar / descargar / calcular). Se regenera al publicar cada spoke.
3. **La landing enlaza al hub y a los 5 spokes con más clics** (bloque en `giros/novias-y-fiesta.astro` leído de `de_pagina_metricas`).
4. **Laterales, no en cadena**: cada spoke enlaza a 2 hermanos del mismo grupo de intención, con anchors distintos (nunca el mismo texto dos veces en el sitio).
5. **Anchors con la forma de la búsqueda**, no la ruta ni «aquí»: «cuánto anticipo pedir por un vestido de novia».
6. **Profundidad ≤ 3 clics** desde el home a cualquier spoke (home → landing → hub → spoke).
7. **Breadcrumbs** en schema (BreadcrumbList) que reflejen la jerarquía landing › hub › spoke.
8. **Un solo hub por pregunta madre**: si dos piezas compiten (canibalización), una se vuelve spoke de la otra o se fusionan (check 22 del plan anterior).

Enlaces externos (los que dan autoridad y que el motor solo puede pedir):

- Descripción de los 509 videos del canal → enlace al hub (`yt-aplicar` ya escribe descripciones).
- Respuestas en los hilos de bodas.com.mx que la investigación encontró (apartado, ajustes, tallas) enlazando al spoke exacto — dueño.
- Fichas en Capterra / GetApp / Google Business con la categoría «software para boutique de novias» — dueño.
- Diseñadoras y talleres mexicanos (Vero Díaz, Claudia Toffano…): intercambio «tu guía de tallas ↔ nuestra guía de apartado» — dueño.
- Nota en Bodas.com.mx / Zankyou sobre «cómo eligen sistema las boutiques» con el dato propio (#30) — dueño con el dato del motor.

## 3. El mapa de ángulos para novias (los spokes)

Todo lo que una boutique de novias busca, agrupado por intención. Cada uno es una pieza que pasa por el referee. (✓ = existe · → = en cola · · = por crear)

**Entender (guías)**
- ✓ Hub: apartar 6 meses, medidas y pruebas — `/software-para/tienda-de-novias/`
- → ¿Cuánto anticipo pedir por un vestido de novia y cómo se reparte (50/25/25)?
- → ¿Qué reglas poner en la nota de apartado? (cancelación, cambio de modelo, ajustes)
- → ¿Cómo evitar vender dos veces un vestido apartado? (talla/color en piso, web y WhatsApp)
- · Ficha de medidas con historial: qué se mide, con qué zapatos, quién firma
- · Citas de prueba: cuántas, cuándo y cómo no se te empalman (agenda por probador)
- · El vestido importado que se atrasa: fecha límite de pedido contra la boda
- · Cancelaciones, PROFECO y qué puedes retener (arts. 7, 10, 92)
- · CFDI PPD y complemento de pagos en un apartado de 6 meses
- · Damas y madrinas: pedidos en grupo con anticipo por persona
- · XV años: el otro ciclo (10-20 días, 50% al pedir)
- · Renta de vestidos de fiesta dentro de una boutique de novias (garantía, calendario por pieza)

**Hacer (pasos, plantillas, calculadoras)**
- · Plantilla: nota/contrato de apartado para boutique de novias (imprimible)
- · Plantilla: ficha de medidas con historial
- · Calculadora: calendario de abonos contra la fecha de la boda
- · Calculadora: cuánto te cuesta un vestido vendido dos veces
- · Checklist de la última prueba y la entrega (vaporizado, cola, funda)

**Comparar**
- · Sacs vs BridalLive / BridalOp para boutiques en México (MXN, CFDI, WhatsApp)
- · Sacs vs MiBoutique.mx
- · Sacs vs Excel + WhatsApp (lo que hoy usa el 80%)
- · POS genérico vs sistema de moda para novias

**Casos y contexto**
- · Boutique de 1 tienda: cómo lo lleva
- · Cadena de 3 sucursales: apartados y taller compartidos
- · Por país (Latam): ✓ ya existen `/giros/novias-y-fiesta/<pais>` → enlazarlas al hub
- · Página gemela para la novia: «¿Cuánto anticipo me pueden pedir por mi vestido y qué pasa si cancelo?»

**Autoridad**
- · El dato propio: «así se aparta un vestido de novia en México» (agregado de tiendas Sacs)
- · Entrevista: una dueña cuenta su temporada (voz real)

## 4. El plan, por semanas

| Semana | Qué sale | Quién |
|---|---|---|
| 1 | Publicar el hub (novias) · bloque «Guías» en la landing con enlace al hub · «Mapa del tema» en el hub · los 4 ángulos ya en cola pasan por el referee | motor + tu aprobación |
| 2 | 6 spokes de «Entender» · plantilla de nota de apartado imprimible · calculadora de abonos · descripciones de los videos del canal con enlace al hub | motor; tú apruebas |
| 3 | Comparativas (BridalLive, MiBoutique, Excel) · calculadora «vendido dos veces» · página gemela para la novia · serie por correo del tema | motor; tú enciendes la serie |
| 4 | Casos (1 tienda / 3 sucursales) · dato propio del ramo (consulta a la base) · entrevista a una dueña · menciones en bodas.com.mx, Capterra, diseñadoras · video de 60 s | tú (permisos, entrevista, menciones) + motor |
| Cada semana | «Seguimiento»: autoridad medida (indexada, clics, citas IA, enlaces), pendientes tachados, ángulos nuevos que salgan de cada spoke | motor |

Meta a 90 días para el segmento: 25-30 piezas enlazadas en hub-and-spoke,
el hub en top 3 de Google MX para «software/sistema para tienda de vestidos de
novia», citado por ChatGPT y Gemini para «sistema para boutique de novias», y
la landing recibiendo tráfico desde 10+ spokes. Se mide en «Seguimiento» y en
«Tráfico»; el motor lo reporta cada lunes.

## 5. Cómo se replica a otro giro

1. Elegir el giro (zapaterías, joyerías…) y su landing `/giros/<giro>`.
2. Correr la investigación con agentes (`scripts/investigacion/`) sobre la pregunta madre.
3. Escribir el hub con el referee (28 + 15 criterios) y publicarlo.
4. Dejar que `contenido.angulos` proponga los spokes y completar el mapa por intención a mano si falta alguno.
5. Bloque «Guías» en la landing + «Mapa del tema» en el hub (son componentes; solo reciben el giro).
6. Semanas 2-4 igual que arriba. Lo que te toca a ti es siempre lo mismo: permisos de casos, una entrevista, las menciones externas y el video.
