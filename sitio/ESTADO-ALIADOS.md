# Aliados comerciales — en qué punto va

**Lee esto primero si vas a tocar aliados.** El manual del motor está en
`MANUAL-PROSPECCION-ABM.md`; esto es el estado y lo que se aprendió a golpes.

Última actualización: **22-sep-2026**.

---

## En una línea

El universo de aliados está construido y la cadencia escrita y probada, pero
**no se le ha escrito a nadie: cero toques**. Faltan tres interruptores, y los
tres son decisión del dueño.

---

## Los números de hoy

| | |
|---|---|
| Aliados cargados | **460** (`abm_cuentas` con `giro='aliados'`) |
| Con correo utilizable | **160** |
| Con WhatsApp que ellos publicaron | **122** |
| Correos enviados | **0** |
| Goteos configurados | **0** |

---

## Qué está hecho

**1 · La lista: 27 tipos en 5 familias.**
`src/lib/crm/abm-aliados.ts` es la fuente única — la leen el motor ABM, el CRM
y la página de partners. Dos ejes:

- **Perfil** (qué es la alianza y cómo se paga): referidor 40% de por vida,
  consultor, orquestador, tecnología. Son los cuatro que promete `/partners`.
- **Tipo** (quién es, dónde se busca, con qué se le entra). Cada tipo declara
  `apertura` (la frase que SÍ se le manda), `suGente`, `dolor`, `gancho` (nota
  interna, NO se manda), `fuentes` y los subgiros viejos que le corresponden.

**2 · El barrido sabe buscar aliados.**
`/api/cron/abm-barrido?aliado=<tipo>` busca con el término de ese tipo y da de
alta en `giro='aliados'` con el tipo en `subgiro`. Además:
`?ciudad=` barre una ciudad concreta y `?termino=` prueba un término en seco
antes de cargar con él.

Los cinco términos medidos que funcionan: `taller` (fábrica de ropa maquila
textil), `contador` (despacho contable), `insumos_tienda`, `fotografia`
(fotografía de producto para ecommerce), `escuela_moda`, más `bordado`.

**3 · La cadencia: cuatro arcos por perfil, apertura por tipo.**
7 correos en los días 1, 3, 7, 11, 16, 22 y 30. Las 28 plantillas viven en
`abm_plantillas` con `giro='aliados'` y `ruta=<perfil>`. Los correos 1 y 2
llevan `{{apertura}}`, `{{su_gente}}` y `{{dolor_cliente}}`, que se resuelven
**en código** desde el catálogo.

**4 · WhatsApp, con su propio guion.**
Tres plantillas de aliado (`abm_aliado_apertura_v1`, `_seguimiento_v1`,
`_cierre_v1`), **APROBADAS por Meta**. Las de prospecto no servían: ofrecen una
demo del sistema, y al aliado no le vendemos el sistema.

**5 · El raspado de sitios.**
`scripts/aliados-raspar-sitios.mjs` saca correo y WhatsApp del sitio propio y
guarda el WhatsApp como `whatsapp_tienda` en estado `declarado` — la única
puerta que abre el WhatsApp en frío (§6 bis del manual).

---

## Lo que falta para encender (las tres llaves)

1. **El goteo del correo.** No hay ninguno para `aliados`. Sin goteo no sale un
   solo correo, aunque las cuatro cadencias estén activas.
2. **`abm_frio`**, la automatización del WhatsApp en frío, sigue apagada.
3. **`abm_config.wa_frio_giros`** está vacío; `aliados` no está ahí.

---

## Dos cosas que hay que decidir antes

**El orden de la fila está sesgado.** El goteo ordena por puntaje, y los 419
que entraron por Maps tienen puntaje 0. Los que sí tienen puntaje son los 41
viejos —escuelas, creadoras, comunidades—, así que **los primeros correos irían
a las escuelas de siempre, no a los talleres ni a los contadores nuevos**. Si
se quiere estrenar con los nuevos hay que puntuarlos o filtrar el goteo por
subgiro.

**Solo 160 de 460 tienen correo.** El enriquecimiento corre los martes y
comparte fila con miles de cuentas de otros barridos.

---

## Lo que se aprendió a golpes (no lo repitas)

**Una instrucción a la IA no es una garantía. Tres veces en un día.**

1. La apertura iba como marcador en prosa para que la IA lo rellenara. La API
   de Anthropic se quedó sin crédito, la redacción cayó al texto base y
   nacieron borradores con `[[apertura del expediente…]]` dentro, esperando que
   alguien les diera aprobar. → Ahora es una **variable**, resuelta en código.
2. El expediente decía «APERTURA OBLIGATORIA: \<gancho\>» y la IA obedecía:
   escribía el **texto interno** —el redactado para nosotros— encima de la
   apertura buena. → El gancho no se manda; cada tipo tiene su `apertura`.
3. Con cuentas que traen `contexto`, la IA **tiraba la apertura entera** y
   escribía la suya, y de paso se inventó otra oferta (a la universidad le
   propuso Sacs como herramienta de clase en vez del 40%). → Ahora si el correo
   1 no trae la apertura, **se le impone en código**.

**Sin liga en el texto base, la IA se inventa una.** El correo del despacho
contable salió con una cita de HubSpot y un `wa.me/5215568806568` que no es
nuestro. El de ventas es **55 9302 7234**. Los cuatro arcos ya llevan la liga.

**Un guard que ya paga solo:** si una plantilla deja una variable sin resolver
para esa cuenta, `generarCadencia` **falla**. Mejor no generar que generar un
correo roto.

**La vista `v_whatsapp_contactable` no trae `subgiro`.** Sin eso
`paramsAliado` devolvía null y **todos los aliados se habrían saltado en
silencio** como «sin parámetros». Se pide en bloque en el cron.

**En los corredores el proveedor ya estaba cargado.** En Villa Hidalgo, 11 de
20 resultados de insumos ya existían como mayoristas. Ahí el trabajo no es
cargar: es **reclasificar**.

**El barrido nunca le toca a los corredores solo.** Elige ciudades por cuántas
cuentas hay ya, así que siempre va a Guadalajara y Monterrey. Villa Hidalgo,
Moroleón y Zapotlanejo hay que pedirlos con `?ciudad=`.

---

## Lo que quedó pendiente de hacer

- **La pantalla de aliados en el CRM.** Aprobada por el dueño y no empezada.
  Hoy los aliados se ven como dos giros sueltos del ABM; les falta vista propia
  con perfil, etapa, comisión pactada y cuentas referidas.
- **Los tipos sin una sola cuenta**: consultora de retail, visual merchandiser,
  patronista, agencia, medio, y toda la familia de tecnología (pagos,
  logística, ecommerce, marketplace, hardware, analítica). Maps no los
  encuentra — van por búsqueda en la web y lista curada.
- **El giro `canal`** (72 cuentas: plazas, cámaras, ferias, showrooms, B2B,
  mayoristas) sigue con sus cadencias viejas. El catálogo ya los mapea, pero no
  se migraron a `aliados`.
