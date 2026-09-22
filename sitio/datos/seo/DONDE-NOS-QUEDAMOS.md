# Dónde nos quedamos · sesión del 19 al 22 de septiembre de 2026

Para retomar sin la conversación. Si solo vas a leer una cosa, lee «Lo que sigue».

---

## Lo que sigue (por orden de lo que más mueve la aguja)

### 1. Las reseñas · bloqueado, esperando al dueño

Las fichas están levantadas en cinco sitios (ver abajo) y **sin reseñas no
rankean ni las cita ninguna IA**. Es lo único que falta para que todo ese
trabajo sirva.

Falta **a quién escribirle** en La Bella Pandita, Casa Maca y Sandmade: los
casos publicados dicen «equipo», sin persona. De Liveshow sí hay nombre. Los
mensajes ya están escritos (WhatsApp, correo y recordatorio) en
`alta-capterra-g2.md`.

Ojo con el tiempo real: la reseña toma de 10 a 15 minutos, no 5, y piden entrar
con LinkedIn o correo del dominio. Y **no se puede ofrecer nada a cambio**:
Capterra y G2 lo prohíben y pueden retirar la ficha.

### 2. El texto de las guías de la base · esperando un sí

La neutralización de género se hizo en el código, pero **32 menciones siguen
vivas en siete guías publicadas**, porque el motor de demanda las escribe
directo en Supabase y no pasan por el repo:

| Menciones | Página |
|---|---|
| 15 | `/recursos/whatsapp-para-tiendas-de-ropa` |
| 6 | `/recursos/omnicanalidad-costo-extra` |
| 3 | `/recursos/precios-mayoreo-y-menudeo-mismo-inventario` |
| 3 | `/recursos/cajas-cajeros-y-permisos` |
| 2 | `/recursos/curva-de-tallas` · `/recursos/que-equipo-necesito-punto-de-venta` |
| 1 | `/recursos/probar-un-sistema-antes-de-pagarlo` |

Se corrige editando el cuerpo en `de_contenido`, con el mismo criterio del
código. El dueño quedó de decidir si se hace.

### 3. El servidor Apache · no es esta máquina (35.232.19.166)

Dos cosas pendientes ahí, las dos cuestan dinero hoy:

- **`ww.sacscloud.com`** (el dominio con una «w» de menos) se lleva **230 clics
  en 90 días** y los tira al portal de facturación. Necesita un 301 a www.
- **`dev.sacscloud.com`** está indexado: es el hallazgo «serio» que muestra el
  panel de SEO técnico del CRM. Necesita `X-Robots-Tag: noindex`.

Ambos caen ahí por un comodín `*.sacscloud.com` en el DNS. Detalle completo en
`decision-subdominios.md`. La cabecera es mejor que `robots.txt`: `Disallow`
impide rastrear pero NO saca del índice.

### 4. `app.sacscloud.com` · hecho en el repo, falta desplegar

El título y la descripción ya están corregidos en `sacs3` (commit `64a0f28df`,
pusheado). **Sale hasta el próximo `firebase deploy`**, que es manual. Es la
página más clicada del dominio: 3,840 clics en 90 días.

### 5. Datos del dueño que siguen abiertos

- **El año de fundación no cuadra.** El sitio dice 2014. Crunchbase traía
  25-may-2013. El LinkedIn de Aaron dice enero 2012. Hay que elegir uno.
  (El panel de agendar dice «más de una década» justo para no tomar partido.)
- **La sede tampoco.** LinkedIn personal dice Cancún; el domicilio fiscal es
  Santiago de Querétaro.
- **Número de empleados** para las fichas: 5 de equipo propio más consultores
  externos. El dueño pidió poner «50+»; **no se hizo**, es un campo que el
  comprador usa y que se cruza con LinkedIn. Falta el total real.
- **«vendedora», «dueña», «empleada»**: 330 menciones sin tocar. Es el personal
  de la tienda, no quien compra. Decisión aparte.

---

## Lo que quedó hecho

**SEO del sitio.** Los 18 puntos del plan. Lo más grande: 239 enlaces internos
declarados como datos en `relaciones-giro.ts`; datos estructurados completos
(migas, oferta, preguntas, las 28 páginas de función); el selector de idioma que
mandaba a 404 desde cualquier página; y las 23 rutas retiradas, que ahora son
páginas de redirección porque `redirects` de astro.config les borraba la barra
final y Google llegaba a un 404 (por eso «Electrónica» seguía saliendo en el
buscador). Auditorías completas en esta misma carpeta.

**Rendimiento, medido en producción, móvil, mediana de 3.** Planes de 76 a 98:
la causa no eran los scripts sino que el carrusel disparaba un scroll que la
compuerta de marketing leía como gesto del visitante. Portada de 84 a 93,
arreglando la prioridad de la foto y tres videos que bajaban su póster sin
pintarse.

**Presencia externa.** Crunchbase reclamada y corregida (describía a Sacs como
ERP genérico), G2 aprobado, Capterra dada de alta —y con ella GetApp y Software
Advice—. LinkedIn personal y de empresa reescritos en español e inglés.

**Contenido.** `/nosotros` escrita y viva con equipo, domicilio y contacto;
`/manifiesto` retirada; `/entrar` nueva; seis páginas en inglés; tres
calculadoras; el hub de software-para. 17 briefs encolados en el motor.

**Fotos.** Los 13 giros nuevos pasaron el referee de identidad y se corrió una
barrida de dignidad sobre los 24 giros: 19 fotos fuera de regla, rehechas.

**Lo último de la sesión.** El bloque de precios de cada giro ahora dice que
Sacs es software especializado para ESE giro, de principio a fin; el precio
grande es el mensual pagando anual (527 en lugar de 810), con la condición
pegada al número; y 490 menciones de «clienta» neutralizadas, dejando 105 a
propósito en maternidad, lencería, renta de vestidos y novias.

**Un botón nuevo en el CRM:** «Revisar ahora» en el panel de SEO técnico. Vuelve
a rastrear el sitio en vivo y después aplica las reglas, en ese orden: auditar
sin rastrear releía HTML de hasta una semana atrás y marcaba como rotas páginas
ya corregidas. Medido: 138 páginas en 37 segundos.

---

## Dos cosas que conviene no olvidar

**Las pruebas sociales de `/agendar` son inventadas.** El contador arranca en
180, el «personas viendo» es aleatorio y los avisos usan nombres falsos (ver
`src/pages/api/scheduling/social-proof.ts`). Se le señaló al dueño y **decidió
dejarlas**. No se amplían ni se replican en material nuevo.

**Otras sesiones trabajan en este repo al mismo tiempo** y alguna corre commits
de todo el árbol: parte de esta tanda quedó mezclada en un commit ajeno sobre
tokens de IA. Antes de tocar, `git pull --rebase --autostash`, y commitea por
rutas explícitas, nunca `git add -A`.
