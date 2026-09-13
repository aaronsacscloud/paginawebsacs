# Manual del motor de prospección (ABM)

Cómo se arma, se enriquece y se contacta una lista de prospectos fríos.

Está escrito para **repetirse en otro país**. México fue el primero y todo lo
que sigue está medido ahí; cada regla dice *por qué* existe, porque al cambiar
de país cambian los datos pero casi nunca la razón.

> **Antes de replicar, lee la sección 9 (Europa).** El correo frío B2B es legal
> en México y no lo es igual en la UE. Eso decide si un país entra por correo o
> solo por otro canal.

---

## 1. El modelo: cuenta, canal, cadencia, toque

| Tabla | Qué guarda |
|---|---|
| `abm_cuentas` | El negocio. Una fila por empresa, con su giro, ciudad, señales y puntaje |
| `abm_canales` | Cómo se le llega: correo, WhatsApp, teléfono, DM |
| `abm_personas` | Quién decide, cuando se sabe |
| `abm_senales` | Lo que duele, con fecha y caducidad |
| `abm_fuentes` | **De dónde salió cada dato.** Campo, valor, método, confianza y agente |
| `abm_plantillas` | El guion, por giro × ruta × canal |
| `abm_cadencias` / `abm_pasos` | El calendario: qué correo va en qué día |
| `abm_toques` | Cada mensaje concreto a cada cuenta, con su estado |
| `abm_config` | Cupo, tope, calentamiento, pausa global |

**`abm_fuentes` no es opcional.** Todo dato que entra deja su fila. Cuando un
correo rebota o un número no tiene WhatsApp, lo primero que se pregunta es de
dónde salió; sin esa tabla no hay forma de saber qué método está sucio y hay
que desconfiar de todo por igual.

---

## 2. El orden correcto, y por qué importa

```
1. UNIVERSO      quiénes existen          → nombre, ciudad, reseñas
2. ENRIQUECER    cómo se les llega        → correo, WhatsApp, sitio
3. GUION         qué se les dice          → plantillas por giro
4. PERSONALIZAR  adaptarlo a cada uno     → IA sobre el expediente
5. ENVIAR        despacio y midiendo      → rampa + disyuntor
6. APRENDER      y hasta entonces, crecer
```

**El paso 6 no es decorativo.** No se generan cadencias para el siguiente lote
antes de haber enviado el primero. Cada cadencia cuesta IA y queda como
borrador que alguien tiene que aprobar; hacer 500 antes de saber si el guion
funciona es pagar dos veces por el mismo aprendizaje.

---

## 3. Fase 1 — El universo

**Barrido de Google Maps por giro y ciudad.** Da volumen y da calidad de
señal: nombre, dirección, calificación, número de reseñas y **el texto de las
peores**, que es lo que más vale — una reseña que dice "no tenían mi talla" es
el dolor que vendemos, dicho por su cliente y con fecha.

**Lo que el barrido NO da: cómo contactarlos.** Medido en México: 21,107
cuentas levantadas, y al principio solo el 9.6% tenía correo. El barrido
levanta *quién es*, no *cómo se le llega*. Presupuestar el enriquecimiento
como una fase aparte, no como un detalle del barrido.

### La trampa del giro

Un negocio se clasifica por lo que el barrido buscó, no por lo que es. En
México, 556 casas de novia quedaron archivadas como `renta` porque también
rentan, y el segmento `novias` parecía tener 73 negocios cuando tenía 629.

**Regla:** antes de dar por chico un segmento, búscalo por NOMBRE en todos los
giros. Si el nombre dice "novia" y está en `renta`, es una casa de novias.

---

## 4. Fase 2 — Enriquecer, en cascada

De más barato y más confiable a menos. Se para en cuanto un dato entra.

### 4.1 El censo oficial del país ← **empieza SIEMPRE aquí**

En México es el **DENUE del INEGI**: 5 millones de establecimientos con
`telefono`, `correoelec` y `www`, por clase de actividad. Oficial, gratis y
legal de usar.

**No uses su API.** Tiene token, el token del portal de desarrolladores es de
*otra* API (Banco de Indicadores) y el propio INEGI enlaza mal su página. Los
datos se bajan en bruto y sin registro:

```
https://www.inegi.org.mx/contenidos/masiva/denue/denue_00_<RANGO>_csv.zip
```

`denue_00_46321-46531_csv.zip` — 56 MB, 648,578 establecimientos — cubre ropa
(179,669), calzado (45,379), joyería (17,506) y bisutería. Casi todos nuestros
giros en un archivo.

**Verifica la clase SCIAN, no la supongas.** Di por hecho que novias era
463215 y resultó ser bisutería. La correcta es **463214**, "disfraces,
vestimenta regional y vestidos de novia", 10,169 establecimientos. Se
comprueba filtrando `nombre_act` por la palabra del giro.

Cobertura real de esa clase: teléfono 36%, correo 11%, web 3%.

**Equivalentes a buscar en cada país nuevo** (verificar antes de asumir que
existen y que permiten uso comercial):

| País | Registro | Nota |
|---|---|---|
| México | DENUE (INEGI) | Descarga masiva libre, sin token |
| Colombia | RUES (Confecámaras) | |
| Chile | SII / Registro de Empresas | |
| Perú | SUNAT | |
| España | INE / Registro Mercantil | |
| Resto UE | Registros mercantiles nacionales | El acceso masivo suele ser de pago |

### 4.2 El sitio propio del negocio

Dos pasadas, en este orden:

**a) `fetch` directo.** Baja la portada y `/contacto`, `/pages/contacto`,
`/contact`, `/nosotros`.

> ⚠️ **El tope de descarga tiene que ser de al menos 6 MB.** Con 600 KB perdí
> la mitad de los hallazgos: las páginas de Shopify pesan ~2 MB y el enlace de
> WhatsApp de una tienda estaba en el byte 1,122,790. Subir el tope pasó el
> rendimiento de 6 a 12 sobre las mismas 33 cuentas.

**b) Navegador (Playwright) para las que salieron vacías.** Shopify, Wix y
React inyectan el contacto con JS: el botón flotante de WhatsApp, el pie, el
widget de chat no están en el HTML del servidor. Se leen tres fuentes de la
página ya pintada: los `href`, el texto visible y el JSON incrustado del tema.
Bloquea imágenes y fuentes en la ruta — son el 90% del peso y no traen
teléfonos.

Rinde poco pero es barato: de 21 vacías, 4 dieron contacto.

**Un sitio caído es un dato, no un hueco.** HTTP 000, un 404, o una página de
169 bytes significan que el negocio ya no mantiene su web. Eso es **señal de
dolor** y sube el puntaje. En el barrido de 1,089 cuentas salieron **208
sitios caídos** — casi uno de cada cinco.

### 4.3 Listas del ramo

Padrones de expositores de ferias y cámaras. En México funcionó SAPICA
(calzado) y existen las expos de novias. Son listas públicas de negocios ya
establecidos, con el sesgo correcto: quien paga un stand tiene tamaño.

### 4.4 Lo que NO se hace

**No raspar directorios comerciales de terceros** (Bodas.com.mx, The Knot,
Páginas Amarillas y equivalentes). Tienen los datos, y raspar su directorio
viola sus términos. El censo oficial da lo mismo sin ese riesgo.

---

## 5. Las reglas de verificación

Todas salieron de un error real. Ninguna es teórica.

### 5.1 Correo

1. **MX obligatorio.** Un dominio sin registro MX no recibe correo: es un
   rebote duro garantizado. `mivestido@tiscaeno.mx` iba a salir así (y el
   dominio real era `tiscarenobride.com` — le faltaba una letra). En el cruce
   del DENUE, 4 de 61 correos se cayeron en esta prueba.
2. **Nunca corregir una dirección a mano.** Si el dominio está mal escrito, se
   descarta y se busca la buena. Inventar la versión plausible es cómo se
   junta un rebote.
3. **Lista negra de proveedores.** Fundidoras de tipografía, CDN, hosting,
   analítica, plantillas. `team@latofonts.com` entró como el correo de una
   casa de novias porque se raspó el crédito de tipografía del sitio — y tenía
   MX, o sea que habría entregado.
4. **Prioridad: dominio propio > correo gratuito > cualquier otro.** Un
   dominio ajeno se descarta salvo que no haya nada más.
5. **`webmaster@`, `admin@`, `postmaster@`, `no-reply@` entran con confianza
   baja.** Son direcciones de rol del panel de hosting, no del negocio.

### 5.2 Teléfono y WhatsApp

1. **Formato del país, verosímil.** En México: 52 + 10 dígitos, lada válida.
   Un `wa.me` de 8 dígitos o de otro país es de un plugin, no de la tienda.
2. **Se queda el número MÁS REPETIDO del sitio.** El de la tienda aparece en
   todas las páginas; el del que hizo la web, una sola vez.
3. **Un número que aparece en dos cuentas se usa en una sola.** Es conmutador
   compartido o error de datos; mandar el mismo mensaje dos veces al mismo
   teléfono es la forma más rápida de que reporten la línea.
4. **800 / 900 nunca llevan WhatsApp.** Fuera.

### 5.3 Cruce entre fuentes

Para completar una cuenta que ya existe con datos de otra fuente, en este
orden, parando en el primero que pega:

| Vía | Firmeza | Resultado en novias |
|---|---|---|
| Teléfono exacto (10 dígitos) | Dos fuentes independientes dando el mismo número | 72 |
| Dominio del sitio | Exacta | 19 |
| Nombre normalizado + **mismo municipio** | Solo si el nombre es **único** ahí | 89 |

**Nunca por nombre a secas.** "NOVIAS KARLA" hay en varios estados. Normalizar
quitando acentos, mayúsculas y las palabras de relleno del ramo (`tienda`,
`casa`, `boutique`, `vestidos`, `de`, `la`).

Empataron 180 de 629. **Las 449 que no empataron se quedan sin dato**: es
preferible a meterle a una cuenta el correo del negocio equivocado.

---

## 6. Confianza: observado vs. inferido

Un dato **visto** y un dato **supuesto** no valen lo mismo y no pueden
guardarse igual.

```
confianza  alta    censo oficial, o el propio sitio del negocio
           media   raspado con verificación
           baja    inferido, o dirección de rol

metodo     directorio              censo oficial
           sitio_propio            raspado de su web
           inferido_del_telefono   suposición razonable, NO verificada
```

**Caso concreto:** en este ramo el mostrador contesta por WhatsApp, no por
correo — medido: de 33 casas de novia con sitio, **una** publica correo y el
resto pone `wa.me`. Así que el teléfono de cada cuenta se da de alta también
como WhatsApp… pero con confianza **baja** y método `inferido_del_telefono`,
para poder distinguirlos de los que sí vimos publicados. Si después resulta
que un pedazo no tiene WhatsApp, se separan sin adivinar.

**No se puede comprobar antes de mandar.** La Cloud API de Meta (v24) ya no
expone el "¿este número tiene WhatsApp?" del API viejo. Se sabe al primer
envío, y por eso entran `sin_probar`.

### El recuento tiene que mirar el estado

`tiene_email` / `tiene_wa` / `canales_n` son banderas desnormalizadas que
alimentan el puntaje de accesibilidad, los filtros de la pantalla y el orden
de la cola. **Un canal `invalido` o `rebote` no es un canal.** El trigger las
contaba sin mirar el estado, así que dos cuentas con el correo ya invalidado
seguían sumando +12 de accesibilidad y colándose arriba de la cola — y la
pantalla las mostraba como contactables mientras el generador las rechazaba
con 409. La pantalla y el motor tienen que decir lo mismo de la misma cuenta.

---

## 7. Fase 3 — El guion

### 7.1 Estructura

Plantillas por **giro × ruta × canal**. Dos rutas:

- **`demo`** — la mayoría. Cierra pidiendo una demo.
- **`diagnostico`** — cuentas grandes (varias sucursales). No vende demo:
  ofrece quince minutos con los números del prospecto y entrega el resultado
  aunque no compren.

> **El botón tiene que pedir lo mismo que el cuerpo.** Los botones de la ruta
> `diagnostico` se habían copiado de `demo`, así que el correo cerraba con
> "¿Le sacamos el diagnóstico con sus números?" y abajo decía "Ver una demo de
> 20 minutos". Pedir una cosa y ofrecer otra hace dudar justo a quien ya iba a
> dar clic.

### 7.2 El primer correo explica por qué llega

Obligatorio, y es el único con enlaces. Contiene, en este orden:

1. **Por qué le llega.** Con la verdad: los buscamos nosotros.
2. **Lo que encontramos de ellos** — reseñas, sucursales, su plataforma de
   e-commerce. Es lo que prueba que no es un envío automático.
3. **Las funciones específicas del giro**, y que eso es solo una parte.
4. **Dos vías de respuesta:** WhatsApp directo y el botón de agendar.

> 🚫 **JAMÁS escribir que se registró, pidió información o dejó sus datos.** No
> pasó. Se comprobó contra `abm_fuentes` antes de escribir el guion. Además de
> ser mentira, es lo que convierte un correo frío en una queja de spam.

### 7.3 Qué toca la IA y qué no

La IA adapta **el texto** al expediente de la cuenta. **No toca** la imagen, el
botón ni el calendario — esos salen de la plantilla y del paso.

```
correo 1      hasta 200 palabras, el único con enlaces
correo 2+     máximo 90 palabras, sin enlaces
```

Si la IA falla, la cadencia **sale igual** con la plantilla rellenada. Eso es
correcto, pero **tiene que avisar**: el fallo viaja en la respuesta
(`ia_error`), no solo al log. Sin eso, 19 cadencias salieron sin personalizar
y solo se notó al contarlas. La causa era saldo agotado del proveedor de IA, y
se veía igual que cualquier otro fallo.

Dimensiona `max_tokens` para el número de correos: 8 correos no caben en 4000.

### 7.4 Los días salen de los pasos

Nunca de un arreglo escrito en el código. Un `[1,3,7,11,16,22,30]` fijo puso el
octavo correo *antes* que el séptimo en cuanto la cadencia creció.

### 7.5 El diseño vive fuera del cuerpo

El cuerpo del correo es **texto plano**; el HTML lo arma una función aparte
(`abm-correo.ts`). Tres razones:

1. La versión de texto y la HTML tienen que decir lo mismo — la discrepancia la
   puntúan los filtros.
2. La IA reescribe el cuerpo; si trajera HTML lo rompería.
3. Cambiar el diseño ahí cambia los correos ya armados, sin regenerar ni
   volver a pagar IA.

**Técnica de correo, no de página.** Outlook renderiza con el motor de Word:
nada de flex, grid, degradados CSS ni webp. Todo tabla con `bgcolor`, estilos
en línea, JPEG, 600 px, y VML para los botones. Un degradado de marca se hace
con tres celdas sólidas.

---

## 8. Fase 4 — Enviar

### 8.1 Correo

```
cupo del día = min(tope, cupo_inicial × 1.3^⌊días_con_envíos / 3⌋)
```

Arranca en **15** y sube ~30% cada 3 días hasta **120**. Un dominio nuevo que
manda 500 el primer día va directo a spam.

**El disyuntor corta con UNA queja de spam.** No tres. Gmail corta arriba de
0.3%, que con 120 correos al día es menos de una queja diaria. Rebotes: corta
al 5% del cupo, mínimo 3. La pausa se levanta sola al día siguiente.

**Los primeros 3 correos van sin rastreo** (`sinRastreo` para `orden < 3`): sin
píxel y sin envolver enlaces. El rastreo en un primer contacto frío es
exactamente la señal que buscan los filtros.

**Una queja suprime a nivel de CUENTA, no de campaña.**

### 8.2 WhatsApp

Cada envío a un número **sin** WhatsApp cuenta contra la calificación de
calidad de la línea.

**Orden obligatorio:**
1. Primero los **observados** (los que vimos publicados como WhatsApp).
2. Después los **inferidos del teléfono**, por tandas, midiendo la línea entre
   una y otra.

Nunca los 554 de golpe.

### 8.3 Nada sale sin que una persona apruebe

Los toques nacen `borrador`. El motor arranca `pausado = si`. Aprobar y
despausar es decisión de una persona, siempre.

---

## 9. Replicar en otro país

### 9.1 Lo que cambia

| Pieza | Qué revisar |
|---|---|
| **Censo oficial** | ¿Existe? ¿Descarga masiva o API? ¿Trae correo y web? |
| **Clases de actividad** | SCIAN en México, CIIU/NACE en otros. **Verificar el código, no suponerlo** |
| **Formato telefónico** | Largo, prefijo internacional, cómo se detecta un móvil |
| **Mezcla de canales** | En México manda WhatsApp. En Europa el correo pesa más y WhatsApp menos |
| **Idioma del guion** | No traducir: reescribir en cómo habla esa gente en ese país |
| **Taxonomía de giros** | Los giros mexicanos no se exportan tal cual |
| **Legalidad** | ⚠️ ver abajo |

### 9.2 Europa: el correo frío NO es libre

En México el correo frío B2B es legal. **En la UE no es igual y varía por
país.** Algunos exigen consentimiento previo incluso entre empresas; otros lo
permiten con interés legítimo, siempre con baja inmediata e identificación
clara del remitente. El RGPD además obliga a decir de dónde se sacaron los
datos cuando no los dio el titular — que es justo nuestro caso.

**Esto se resuelve con un abogado por país ANTES de mandar el primer correo,
no después.** Un país donde el correo frío no proceda puede seguir
trabajándose por WhatsApp, teléfono o LinkedIn, pero es una decisión legal,
no técnica, y no la toma el motor.

### 9.3 Lo que NO cambia

- La cascada de enriquecimiento y su orden.
- Las reglas de verificación de la sección 5 — todas.
- Observado vs. inferido.
- La rampa, el disyuntor y el "nada sale sin aprobar".
- El primer correo explica por qué llega, y no miente sobre cómo llegamos.

### 9.4 Antes de dar por bueno un país nuevo

1. ¿El universo está clasificado por lo que el negocio **es**, o por lo que
   buscó el barrido?
2. ¿Se agotó el censo oficial antes de ponerse a raspar?
3. ¿Todo correo pasó por MX? ¿Ninguno se corrigió a mano?
4. ¿Los datos inferidos están marcados como inferidos?
5. ¿Las banderas de canal miran el estado?
6. ¿El botón pide lo mismo que el cuerpo?
7. ¿Se renderizó un correo real contra una cuenta real antes de generar los
   demás? *(así se cacharon "con sus 1 sucursales" y una línea duplicada)*
8. ¿Está resuelta la legalidad del correo frío en ese país?

---

## 10. La línea base de México

Para comparar cuando se replique.

**Motor completo:** 21,107 cuentas · 26 giros · 22 con guion escrito ·
310 plantillas de correo + 66 de WhatsApp.

**Novias, el primer segmento trabajado de punta a punta:**

| | Al empezar | Al terminar |
|---|---|---|
| Cuentas | 629 | 629 |
| Con correo | 34 | 93 |
| Con WhatsApp | 62 | 617 |
| Cadencias listas | 0 | 30 |

Sin importar un solo negocio nuevo. De los 59 correos ganados: **3** del sitio
propio, **56** del censo.

**Rendimiento del raspado de sitios** (1,089 cuentas, todos los giros):
WhatsApp 161 · teléfono 144 · correo 152 · **sitios caídos 208**.

---

## 11. Los errores que originaron cada regla

| Error | Regla que salió |
|---|---|
| `team@latofonts.com` como correo de una casa de novias | Lista negra de proveedores; dominio propio primero |
| `mivestido@tiscaeno.mx`, dominio inexistente | MX obligatorio; nunca corregir a mano |
| Segmento de 73 cuando eran 629 | Buscar por nombre en todos los giros |
| Tope de 600 KB escondía la mitad | Mínimo 6 MB al bajar una página |
| Clase SCIAN 463215 supuesta (era bisutería) | Verificar el código contra `nombre_act` |
| Token del portal de INEGI rechazado por DENUE | Preferir descarga masiva a la API |
| 19 cadencias sin IA por saldo agotado | El fallo viaja en la respuesta, no solo al log |
| `[1,3,7,11,16,22,30]` fijo | Los días salen de los pasos |
| Botón "demo" en la ruta `diagnostico` | El botón pide lo mismo que el cuerpo |
| `tiene_email` true con el correo invalidado | El recuento mira el estado |
| "con sus 1 sucursales" en 14 plantillas | Renderizar contra cuentas reales antes de generar |
| 83 "menciones de WhatsApp" que eran nombres de foto | Contar enlaces, no coincidencias de texto |

---

## 12. Dónde está cada cosa

```
src/lib/crm/abm.lib.ts                  puntaje, variables, rellenar(), apuntar()
src/lib/crm/abm-correo.ts               el HTML del correo (diseño fuera del cuerpo)
src/lib/crm/abm-giros.ts                catálogo de giros
src/pages/api/crm/abm/cadencias.ts      generar / aprobar / cancelar, y la IA
src/pages/api/cron/abm-cadencias.ts     el envío: rampa, disyuntor, cupo
src/pages/api/cron/abm-enriquecer.ts    Places y DENUE (necesita llaves)
sitio/migraciones/                      cada carga de datos, con su porqué
```

Las migraciones se escriben explicando **por qué** se hizo el cambio, no qué
hace el SQL. Una migración dice lo que pasó ese día — no lo que es cierto hoy.
