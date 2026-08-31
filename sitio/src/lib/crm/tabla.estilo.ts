/**
 * LA TABLA DEL CRM · tokens y CSS compartidos.
 *
 * Esto NO empezó como librería: son los estándares que salieron de dos rondas
 * de referee sobre la tabla de Leads (jerarquía, anchos que sí mandan,
 * identidad congelada, contrastes AA, caja de línea común de 20 px). Vive
 * aparte porque la sección de Churn nace con los mismos, y dos copias de un
 * estándar son dos estándares que van a divergir en la tercera pantalla.
 *
 * Quien lo use necesita tres cosas:
 *   1. <style>{CSS_TABLA}</style> una vez en la pantalla.
 *   2. La reja: <div class="crm-reja" ref>  <span class="crm-orilla"/>
 *        <div class="crm-scroll-tabla" ref> <table class="crm-tabla">
 *   3. Los tokens de `T` en los <th> y <td>.
 *
 * Clases de columna: `fija0` (casilla), `fija1`/`fija2` (identidad congelada),
 * `derecha` (acciones congeladas), `num` (cifras a la derecha), `ord` (rótulo
 * que ordena).
 */
import type { CSSProperties } from 'react';

export const CSS_TABLA = `
.crm-tabla { width:100%; border-collapse:separate; border-spacing:0; table-layout:fixed; }
/* NINGÚN dato parte renglón por su cuenta. Era lo que desordenaba la
   tabla: "09:30 a.m." se rompía en dos, "3 d sin contacto" en dos, un
   nombre largo en tres — y cada fila medía distinto, así que el ojo no
   encontraba el ritmo para bajar. Ahora cada línea es UNA línea y lo
   que no cabe se corta con puntos suspensivos (el valor completo sigue
   en el titulo emergente y en la ficha del lead). Las filas quedan
   alto salvo cuando de verdad hay un segundo dato que contar. */
.crm-tabla tbody td { overflow:hidden; }
.crm-tabla tbody td, .crm-tabla tbody td > div, .crm-tabla tbody td > span,
.crm-tabla tbody td > div > div { white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:100%; }
/* El aro de foco del buscador del estándar. Vive aquí porque esta tabla no
   monta TablaEnterprise —que es donde estaba la regla— y sin ella el buscador
   se veía igual pero no respondía al foco. */
.te-search:focus { border-color:#4B7BE5 !important; box-shadow:0 0 0 3px rgba(75,123,229,0.12); }
/* La fila entera se ilumina al pasar: en 13 columnas, seguir un
   renglón hasta la orilla sin una guía es contar con la suerte. El
   #faf9fd anterior daba 1.03:1 contra el blanco —o sea, no se veía—,
   así que la marca de verdad es la barra morada del borde izquierdo. */
.crm-tabla tbody tr:hover td { background:#f5f3fc; }
/* La campaña ya no es tinta muerta: un clic deja solo los leads de
   ese anuncio. Era la mancha más fuerte de la fila, con color de
   enlace, y no llevaba a ningún lado — el dueño la quiere para saber
   de qué anuncio viene cada cosa, y así de verdad sirve para cortar. */
/* Se ven QUIETAS. Depender del cursor para descubrir que el teléfono
   abre WhatsApp y que la campaña filtra, entre trece columnas, es
   depender de que nunca se descubra: el subrayado punteado tenue lo
   insinúa sin gritar, y al pasar encima se vuelve sólido y de color. */
.crm-tabla .crm-fila-nom { all:unset; display:block; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.crm-tabla .crm-fila-nom:focus-visible, .crm-tabla [role="button"]:focus-visible, .crm-tabla a:focus-visible {
  outline:2px solid #5B4BD6; outline-offset:2px; border-radius:4px; }
.crm-tabla .crm-fila-tel, .crm-tabla .crm-fila-camp { text-decoration:underline dotted; text-decoration-color:#d3cfe2; text-underline-offset:3px; }
.crm-tabla .crm-fila-camp:hover { color:#5B4BD6; text-decoration:underline solid; text-decoration-color:currentColor; text-underline-offset:2px; }
.crm-tabla .crm-fila-tel:hover { color:#1E8A63; text-decoration:underline; text-underline-offset:2px; }
.crm-tabla .crm-fila-wa { opacity:.5; transition:opacity .12s ease, background .12s ease; }
.crm-tabla tbody tr:hover .crm-fila-wa { opacity:1; }
.crm-tabla .crm-fila-wa:hover, .crm-tabla .crm-fila-wa:focus-visible { opacity:1; background:#E8F7F0; }
.crm-tabla tbody tr:hover td:first-child { box-shadow: inset 3px 0 0 #5B4BD6; }
/* Un conteo va a la DERECHA, no centrado: alineados por la unidad se
   comparan de un vistazo. El !important no es capricho — S.th trae
   textAlign en línea y un estilo en línea le gana siempre a la clase,
   que es por lo que el rótulo salía a la izquierda y los dígitos al
   centro, leyéndose como dos columnas distintas. */
.crm-tabla th.num, .crm-tabla td.num { text-align:right !important; }
/* La identidad no se pierde al irse a la derecha: las dos primeras
   columnas quedan congeladas. Si al hacer scroll ves "HOY" en Reunión
   pero ya no sabes de quién es la fila, tienes que volver, contar
   renglones y regresar. */
.crm-tabla th.fija0, .crm-tabla td.fija0 { position:sticky; left:0; background:#fff; text-align:center; padding-left:0; padding-right:0; }
.crm-tabla th.fija1, .crm-tabla td.fija1 { position:sticky; left:40px; background:#fff; }
.crm-tabla th.fija2, .crm-tabla td.fija2 { position:sticky; left:148px; background:#fff; box-shadow:1px 0 0 #eceaf2; }
.crm-tabla th.derecha, .crm-tabla td.derecha { position:sticky; right:0; background:#fff; box-shadow:-1px 0 0 #eceaf2; }
.crm-tabla tbody tr:hover td.derecha { background:#f5f3fc; }
/* !important porque el token T.th trae zIndex 2 EN LÍNEA, y un estilo en
   línea le gana a la clase. Con los dos en 2, mandaba el orden del DOM: al
   desplazarse a la derecha, «Empresa» —que va después— se pintaba ENCIMA de
   los rótulos congelados «Llegó» y «Lead», así que la cabecera parecía
   desacomodarse mientras el cuerpo se quedaba en su sitio. Las celdas sí se
   veían bien; era solo quién pinta arriba. */
.crm-tabla th.fija0, .crm-tabla th.fija1, .crm-tabla th.fija2, .crm-tabla th.derecha { z-index:5 !important; }
.crm-tabla td.fija0, .crm-tabla td.fija1, .crm-tabla td.fija2 { z-index:1; }
/* La fila seleccionada se ve seleccionada en TODO su ancho, congeladas
   incluidas: si solo se pinta el centro, al desplazarse a la derecha la
   selección parece haberse perdido. */
.crm-tabla tbody tr.sel td, .crm-tabla tbody tr.sel td.fija0,
.crm-tabla tbody tr.sel td.fija1, .crm-tabla tbody tr.sel td.fija2,
.crm-tabla tbody tr.sel td.derecha { background:#F1EEFE; }
.crm-tabla input[type=checkbox] { width:16px; height:16px; accent-color:#5B4BD6; cursor:pointer; margin:0 auto; display:block; }
/* La celda de la casilla queda FUERA del recorte con puntos
   suspensivos: ahí no hay texto que recortar, y la regla le pintaba un
   «…» al lado de cada casilla porque la caja del control mide más que
   la columna de 40 px. */
.crm-tabla th.fija0, .crm-tabla td.fija0 { text-overflow:clip; }
/* El indicador de orden es el del estándar: un ⇅ TENUE pero visible en toda
   columna ordenable —se ve que SE PUEDE sin gritarlo—, marcado al pasar el
   mouse y vuelto ▾/▴ a color cuando esa columna manda. Antes la flecha vivía
   en opacity:0 hasta el hover: quien no pasa el mouse por los rótulos nunca
   se enteraba de que la tabla se podía ordenar. */
.crm-tabla th.ord { cursor:pointer; user-select:none; }
/* !important: T.th trae el fondo EN LÍNEA y un estilo en línea le gana a la
   clase, así que sin esto el resaltado al pasar el mouse no se ve. */
.crm-tabla th.ord:hover { background:#f3efff !important; }
.crm-tabla th .fl { display:inline-block; width:11px; margin-left:5px; color:#c3bcdd; font-size:.92em; transition:color .12s ease; }
.crm-tabla th.ord:hover .fl { color:#6b5fa8; }
.crm-tabla th.ord[aria-sort]:not([aria-sort="none"]) { color:#5B4BD6; }
.crm-tabla th.ord[aria-sort]:not([aria-sort="none"]) .fl { color:#5B4BD6; }
/* Congelada + hover: si no se repinta el fondo, la fila se parte en
   dos colores justo en el borde de lo que se quedó fijo. */
.crm-tabla tbody tr:hover td.fija0, .crm-tabla tbody tr:hover td.fija1, .crm-tabla tbody tr:hover td.fija2 { background:#f5f3fc; }
/* Y el aviso de que hay más columnas a la derecha: sin esto el borde
   es un corte blanco seco y la única acción por fila (el ⋮) vive
   fuera de la pantalla sin que nada lo insinúe. */
/* El contenedor ACOTA su altura. Sin esto el encabezado pegajoso era
   decorativo: quien hacía scroll era la página, no la reja, así que el
   thead no tenía de dónde despegarse y los rótulos se perdían igual a
   la fila diez — exactamente lo que se quería evitar. */
.crm-reja { position:relative; }
/* El alto lo mide el propio contenedor (--crm-tabla-alto), no un número
   inventado: con un 100dvh menos 250px fijo, en cuanto la barra de
   filtros crecía un renglón, el fondo de la tabla quedaba por debajo
   pantalla y aparecían dos barras de scroll peleando. */
.crm-scroll-tabla { overflow:auto; max-height:var(--crm-tabla-alto, calc(100dvh - 250px)); }
/* Y el aviso del borde va como capa aparte, no como ::after del
   scroller: un pseudo con height:100% dentro de una caja de alto
   automático mide cero, y siendo float su sitio natural es debajo de la
   tabla, no al costado. Aquí es una capa absoluta sobre la reja. */
.crm-reja .crm-orilla { position:absolute; top:0; right:0; bottom:0; width:36px; pointer-events:none;
  opacity:0; transition:opacity .15s ease;
  background:linear-gradient(90deg, rgba(255,255,255,0), rgba(16,24,40,.11)); }
.crm-reja[data-mas="1"] .crm-orilla { opacity:1; }
`;

/** Los tokens de celda. Un solo lugar: el tamaño y el gris de la segunda
 *  línea andaban en cuatro variantes distintas antes de unificarlos. */
export const T = {
  /* Cabecera: LA MISMA banda del datatable estándar (TablaEnterprise con
     headerTint, el que ya usa Clientes) — lila #faf8ff, tinta #6b5fa8, 0.64
     rem/700 y letterSpacing .06em. Dos tablas del mismo CRM con dos
     cabeceras distintas se leen como dos productos. Pegada arriba y con
     sombra: sin ella las filas se le meten por debajo sin ninguna capa que
     las separe. */
  th: { fontSize: '0.64rem', fontWeight: 700, color: '#6b5fa8', textTransform: 'uppercase' as const, letterSpacing: '.06em', textAlign: 'left' as const, padding: '10px 14px', background: '#faf8ff', position: 'sticky' as const, top: 0, zIndex: 2, whiteSpace: 'nowrap' as const, boxShadow: '0 1px 0 #e6ddfa, 0 6px 10px -8px rgba(16,24,40,.18)' } as CSSProperties,
  /* Alineación ARRIBA, no al centro: con `middle`, una celda de tres renglones
     empuja al dato de al lado hacia abajo y en la misma fila ningún valor
     principal queda a la altura del otro. */
  td: { padding: '9px 14px', fontSize: '0.75rem', borderBottom: '1px solid #ebe9f0', verticalAlign: 'top' as const, lineHeight: '20px', fontVariantNumeric: 'tabular-nums' as const } as CSSProperties,
  /** El ancla de la fila: UN solo dato por encima de 0.8rem. */
  nombre: { fontSize: '0.87rem', fontWeight: 700, color: '#16151c', letterSpacing: '-.01em', cursor: 'pointer', lineHeight: '20px' } as CSSProperties,
  /** Lo que acompaña al nombre: un escalón abajo, para que no compita. */
  dato2: { fontSize: '0.75rem', color: '#5c5870', lineHeight: '20px' } as CSSProperties,
  /** La segunda línea de cualquier celda. */
  sub: { fontSize: '0.65rem', color: '#71707C', marginTop: 2, lineHeight: 1.35 } as CSSProperties,
  /** El dato que no está: siempre igual, y más claro que un dato real. */
  vacio: { color: '#74727F' } as CSSProperties,
  /** La pastilla mide 20 px EXACTOS, que es lo que mide una línea de la celda:
   *  así la primera línea de todas las celdas cae a la misma altura. */
  tag: (bg: string, fg: string): CSSProperties => ({ fontSize: '0.66rem', fontWeight: 700, background: bg, color: fg, borderRadius: 20, padding: '0 9px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', height: 20, lineHeight: 1, maxWidth: '100%', overflow: 'hidden' }),
  /** Los botones de la barra de selección, sobre el morado oscuro. */
  btnSel: { border: '1px solid rgba(255,255,255,.28)', background: 'rgba(255,255,255,.08)', color: '#fff', borderRadius: 9, padding: '7px 13px', fontSize: '0.77rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as CSSProperties,
};

/** El corte de «atorado» que comparten las listas del CRM. */
export const DIAS_ATORADO = 3;
