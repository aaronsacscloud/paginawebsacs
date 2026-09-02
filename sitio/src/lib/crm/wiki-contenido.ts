// La Wiki de procesos de ventas — CONTENIDO.
//
// Se separa del componente a propósito: agregar una página del wiki debe ser
// agregar un objeto a este arreglo, nunca tocar React. El orden del arreglo es
// el orden del menú; `grupo` los agrupa en la barra lateral.
//
// Regla de contenido: cada página responde UNA pregunta y se lee sola. Si algo
// necesita dos pantallas de scroll, probablemente son dos páginas.

export type SeccionWiki = 'ventas' | 'consultores';

export type PaginaWiki = {
  id: string;
  /** Sección de primer nivel. Omitirla equivale a 'ventas'. */
  seccion?: SeccionWiki;
  grupo: string;
  titulo: string;
  /** Aparece bajo el título, en gris. Una línea. */
  bajada?: string;
  /** Marca de estado a la derecha del título del menú. */
  chip?: { texto: string; tono: 'ok' | 'warn' | 'bad' | 'mut' };
  /** HTML del cuerpo. Se confía porque es contenido nuestro, versionado en git. */
  cuerpo: string;
};

/* DOS SECCIONES DE PRIMER NIVEL, no una lista con un grupo más al final.
   Son dos manuales distintos que le hablan a dos preguntas distintas: cómo se
   trabaja un lead, y bajo qué acuerdo trabaja un consultor. Mezclarlos dejaba
   el acuerdo como el séptimo grupo de una lista de ocho, que es exactamente el
   peso que NO tiene que tener. */
export const SECCIONES_WIKI: { id: SeccionWiki; label: string; bajada: string }[] = [
  { id: 'ventas', label: 'Procesos de venta', bajada: 'Cómo se trabaja un lead, desde que entra hasta que firma.' },
  { id: 'consultores', label: 'Consultores', bajada: 'El acuerdo de colaboración: qué se cobra, qué se debe y cómo se mide.' },
];

/* El índice lateral es UN RECORRIDO, no un cajón de temas: quien entra a
   vender por primera vez lo lee de arriba abajo y en ese orden aprende el
   trabajo. Los títulos van sin emoji — treinta y tres iconos distintos en una
   columna se leen como ruido, no como jerarquía. */
export const GRUPOS_WIKI: Record<SeccionWiki, readonly string[]> = {
  ventas: ['Empezar aquí', 'El proceso de venta', 'Los relevos', 'Las etapas', 'Hablar con el cliente', 'Después de la venta', 'Referencia'],
  consultores: ['El acuerdo', 'Compensación', 'Responsabilidades', 'Medición y reuniones'],
};

export const WIKI: PaginaWiki[] = [
  {
    id: 'modelo', grupo: 'Empezar aquí', titulo: 'El modelo en 2 minutos',
    bajada: 'Lo único que hay que entender antes de tocar el CRM.',
    cuerpo: `
<p>Cada lead tiene <b>dos campos que parecen lo mismo y no lo son</b>. Confundirlos es el origen de casi todos los errores del proceso.</p>
<table class="w-tab"><thead><tr><th>Campo</th><th>Pregunta que responde</th><th>Quién lo mueve</th></tr></thead><tbody>
<tr><td><b>Etapa</b><br><span class="w-mut">(ciclo de vida)</span></td><td>¿<b>QUIÉN</b> es?<br>Nuevo lead → Calificado → Oportunidad → Cliente</td><td><b>Personas</b> y reglas automáticas (agendar promueve; la suscripción convierte)</td></tr>
<tr><td><b>Estatus</b><br><span class="w-mut">(del lead)</span></td><td>¿Qué tan <b>VIVA</b> está la relación?<br>Sin tocar → Contactado → Respondió → …</td><td>Los <b>HECHOS</b>: mensajes, llamadas, reuniones, cotizaciones. El sistema lo deriva solo</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">La consecuencia que importa</span>
<p><b>TikTok lee únicamente la Etapa.</b> El Estatus avanza solo con los hechos; la Etapa la mueve una persona. Por eso un lead puede haber respondido, tenido tres llamadas y una cotización —y para TikTok seguir sin existir— si nadie movió la Etapa.</p></div>
<h3>La meta que fija TikTok</h3>
<div class="w-caja w-warn"><span class="w-k">Más de 50 señales en 14 días</span>
<p>Es la recomendación oficial de TikTok para que la optimización se <b>estabilice</b>. Con menos, el algoritmo no tiene con qué aprender y sigue entregando los leads más baratos de conseguir.</p>
<p>Hoy vamos en <b>30</b>. Los <b>51 que esperan al vendedor</b> son exactamente lo que falta para cruzar el umbral: clasificarlos no es limpieza de CRM, es lo que hace que la campaña empiece a aprender.</p></div>
<div class="w-caja w-bad"><span class="w-k">Cómo contar bien los leads de TikTok</span>
<p>La hoja y el CRM <b>no son el mismo conjunto</b>, y confundirlos da cifras falsas. La hoja trae filas que nunca se volvieron contacto; el CRM tiene contactos que perdieron la fuente en algún rescate.</p>
<p>La vara es <b>la huella en el contacto</b> (<code>propiedades → tiktok</code>), no el campo <code>fuente</code> ni el número de filas de la hoja. <b>Contar por fuente subcuenta; contar filas sobrecuenta.</b></p></div>`,
  },
  {
    id: 'p1', grupo: 'El proceso de venta', titulo: '1 · Llega el lead',
    bajada: 'Todo automático. Nadie captura nada.', chip: { texto: 'validado', tono: 'ok' },
    cuerpo: `
<p><b>Estado inicial:</b> Etapa = <i>Nuevo lead</i> · Estatus = <i>Sin tocar</i>.</p>
<h3>Con qué nace</h3>
<ul>
<li><b>Identidad:</b> nombre, correo, WhatsApp normalizado, empresa (crea la cuenta si viene), giro, sucursales de interés.</li>
<li><b>Atribución:</b> fuente <code>tiktok-lead-form</code>, campaña, anuncio, formulario, fecha real del anuncio.</li>
<li><b>Gestión:</b> sin dueño (hasta activar round-robin); reloj de SLA corriendo.</li>
</ul>
<h3>Qué se dispara solo</h3>
<ul>
<li>Campana en el CRM.</li>
<li>WhatsApp <b>al equipo</b> con link directo a la ficha.</li>
<li>WhatsApp <b>al lead</b> — plantilla <code>solicitud_asignada_asesor</code>.</li>
<li>Correo <b>al lead</b> — plantilla «Bienvenida a leads de TikTok»: presentación, video del POS en GIF, aviso del WhatsApp, CTA «Agendar mi demo» y sellos de confianza.</li>
</ul>
<h3>Dónde se configura, sin código</h3>
<p><b>WhatsApp ▸ ⚙ Automatización</b> → «Bienvenida a leads de TikTok» y «Correo de bienvenida a leads de TikTok», cada una con su toggle. El correo se edita por bloques en <b>Email ▸ Plantillas</b>.</p>
<p>Ahí mismo vive <b>«Leads por WhatsApp directo»</b>, que decide qué pasa cuando alguien escribe por WhatsApp <b>sin haber llenado formulario</b>: <i>la IA decide</i> · <i>crear siempre</i> · <i>nunca</i>, más el toggle de alta saliente. Es el ajuste que determina si esas conversaciones se vuelven ficha en el CRM o se quedan solo en el inbox — y por lo tanto si cuentan o no como lead.</p>
<div class="w-caja w-ok"><span class="w-k">Tres reglas que protegen el paso</span>
<p><b>1.</b> Las bienvenidas solo disparan con el goteo real (≤10 por corrida): un import masivo jamás manda cientos de mensajes.<br>
<b>2.</b> Ninguna bienvenida cuenta como toque humano — el lead sigue en «Sin tocar» hasta que una persona lo trabaje… o él responda.<br>
<b>3.</b> Mismo teléfono o correo ya registrado = <b>no</b> se duplica la ficha: se firma «volvió a levantar la mano» y se avisa.</p></div>`,
  },
  {
    id: 'p2', grupo: 'El proceso de venta', titulo: '2 · El tablero se mueve solo',
    bajada: 'Cada hecho real mueve el Estatus sin que nadie capture.', chip: { texto: 'validado', tono: 'ok' },
    cuerpo: `
<p>Todos los cambios <b>solo avanzan</b>; el recálculo nocturno (3 am) revisa los hechos completos y autocorrige. Todo queda firmado en la actividad del lead.</p>
<table class="w-tab"><thead><tr><th>Evento</th><th>Cambio automático</th><th>Cuándo</th></tr></thead><tbody>
<tr><td>Entra por formulario o campaña</td><td>nace con estatus «Sin tocar»</td><td>al instante</td></tr>
<tr><td>El lead escribe por WhatsApp</td><td>→ «Respondió» (si no existía, nace la ficha)</td><td>al instante</td></tr>
<tr><td>Le escribimos por WhatsApp (humano)</td><td>Sin tocar → «Contactado»</td><td>al instante</td></tr>
<tr><td>El lead responde el correo</td><td>→ «Respondió»</td><td>al instante</td></tr>
<tr><td>Llamada de WhatsApp contestada</td><td>→ «Respondió» (una perdida no mueve nada)</td><td>al instante</td></tr>
<tr><td>Llamada marcada «Contestó»</td><td>→ «Respondió»</td><td>al instante</td></tr>
<tr><td>«No contestó» / «Buzón»</td><td>Sin tocar → «Contactado»</td><td>al instante</td></tr>
<tr><td>Discovery hecha (o llamada 3+ min con minuta)</td><td>→ «Discovery hecho»</td><td>al instante</td></tr>
<tr><td><b>Agenda una reunión</b></td><td><b>Etapa → «Oportunidad»</b> + estatus «Agendó demo»</td><td>al instante</td></tr>
<tr><td>Reunión «Asistió»</td><td>→ «Demo hecha»</td><td>al instante</td></tr>
<tr><td>Reunión «No asistió»</td><td>sin cambio; entra a «No asistieron sin reagendar»</td><td>al instante</td></tr>
<tr><td>Se crea su cotización</td><td>→ «Cotizado»</td><td>recálculo nocturno</td></tr>
<tr><td>3+ toques y 14 días sin respuesta</td><td>→ «No contesta»</td><td>recálculo nocturno</td></tr>
<tr><td>30 min / 2 h sin primer toque</td><td>avisos de SLA (campana + WhatsApp al equipo)</td><td>cron cada 10 min</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Lo que NUNCA mueve el estatus</span><p>Las bienvenidas automáticas, los ecos y el backfill. <b>La automatización abre; el humano vende.</b></p></div>`,
  },
  {
    id: 'p3', grupo: 'El proceso de venta', titulo: '3 · La secuencia de seguimiento',
    bajada: 'Para el lead tocado que no responde.', chip: { texto: 'apagada · esperando OK', tono: 'warn' },
    cuerpo: `
<p><b>Dónde vive:</b> Automatización ▸ Secuencias. Mezcla WhatsApp y correo en <b>un solo flujo</b>, enseña sus reglas siempre, y se mide sola.</p>
<h3>La regla de oro es por canal</h3>
<p>Si responde por WhatsApp, se detienen los WhatsApps automáticos pero <b>los correos siguen nutriendo</b> — y al revés. Solo si respondió por ambos sale del todo. Sale al instante cuando agenda, se hace cliente, se descarta o empieza a negociar.</p>
<h3>El arco de confianza</h3>
<p>Corte al día 14 → Rezagados.</p>
<table class="w-tab"><thead><tr><th>Día</th><th>Pieza</th><th>Qué construye</th></tr></thead><tbody>
<tr><td>1</td><td>✉️ Tu consultora (Andrea, con foto)</td><td>Persona real: llevó los casos de éxito del sitio</td></tr>
<tr><td>2</td><td>📲 + ✉️ Multisucursal avanzado</td><td>Inventario central vivo, traspasos, precios por plaza</td></tr>
<tr><td>3</td><td>✉️ Inventario con IA</td><td>Mínimos/máximos y nivelación entre sucursales</td></tr>
<tr><td>4</td><td>✉️ + 📲 Fidelización avanzada</td><td>Vender más con los clientes que ya tienes</td></tr>
<tr><td>5</td><td>✉️ Caso Mi Bella Pandita</td><td>Prueba social: multisucursal + liveshows</td></tr>
<tr><td>6</td><td>✉️ Innovación</td><td>E-tiendas modernas, IA integrada, hardware propio</td></tr>
<tr><td>7</td><td>✉️ + 📲 Un plan para cada etapa</td><td>Vende · Controla · Fideliza · Automatiza</td></tr>
<tr><td>8</td><td>✉️ El último correo</td><td>Cierre elegante: el respeto como diferenciador</td></tr>
<tr><td>10-14</td><td>📲 Goteo</td><td>El canal humano queda abierto; al 14 cierra el expediente</td></tr>
</tbody></table>
<p><b>La meta de todas las piezas:</b> la sesión consultiva sin costo — vemos, entendemos y ejecutamos sus procesos en tiempo real.</p>
<h3>Cómo se administra</h3>
<p>En la sección se crea cualquier secuencia nueva —nombre, para qué es, corte, horario, días de la semana y <b>estatus de entrada</b>— y cada paso es un renglón <i>día + canal + plantilla</i> que se puede prender o apagar sin borrarlo.</p>
<p>El botón <b>Simular</b> (sin enviar) enseña <b>cuántos leads entrarían hoy</b> antes de prender nada. Los correos se editan por bloques en <b>Email ▸ Plantillas</b> —los 8 ya reescritos con enfoque retail de moda: tallas, colecciones, apartados, liveshows—; los WhatsApps son plantillas aprobadas por Meta. El toggle Prender/Apagar es por secuencia.</p>
<div class="w-caja w-ok"><span class="w-k">Blindajes que aplica el sistema, siempre</span>
<p>Horario humano (10-18 CDMX, L-V) · máximo un correo y un WhatsApp por corrida por lead · el reloj arranca el día que la secuencia <b>ve</b> al lead, nunca ráfagas retroactivas · los leads más viejos que el corte no entran · optout y pausa se respetan · cada envío queda firmado.</p></div>`,
  },
  {
    id: 'p4', grupo: 'El proceso de venta', titulo: '4 · El primer toque humano',
    bajada: 'El único paso manual de toda la cadena.', chip: { texto: 'pendiente', tono: 'warn' },
    cuerpo: `
<div class="w-caja w-warn"><span class="w-k">Falta definir</span><p>El <b>round-robin de dueños</b>: faltan los nombres del equipo para repartir los leads entrantes.</p></div>
<h3>Lo que ya sabemos</h3>
<p>Hoy hay <b>51 leads esperando</b>. La medición dice que el equipo <b>sí atiende</b> —la mayoría tiene el Estatus movido, muchos respondieron— pero <b>nadie mueve la Etapa</b>, que es el único campo que TikTok lee.</p>
<div class="w-caja w-ok"><span class="w-k">Y esa es la buena noticia</span>
<p>No es un problema de seguimiento —eso sería caro y lento de arreglar—: es <b>un paso manual que falta</b>, y eso se arregla con un hábito. <b>Mover la Etapa después de cada llamada.</b></p></div>`,
  },
  {
    id: 'p5', grupo: 'El proceso de venta', titulo: '5 · La señal de vuelta a TikTok',
    bajada: 'Cerrar el círculo.', chip: { texto: 'validado', tono: 'ok' },
    cuerpo: `
<p><b>El problema:</b> TikTok sabe <i>cuántos</i> formularios se llenaron. No sabe <i>cuáles sirvieron</i>. Con esa información a medias optimiza por lo único que puede medir —la cantidad— y entrega los leads más baratos, que casi nunca son los que compran.</p>
<p><b>El dato que le falta lo tenemos nosotros.</b></p>
<table class="w-tab"><thead><tr><th>Etapa en el CRM</th><th>Lo que recibe TikTok</th><th>Qué le enseña</th></tr></thead><tbody>
<tr><td>✅ Calificado</td><td><code>Qualified</code></td><td>«Este lead sí era del perfil»</td></tr>
<tr><td>🎯 Oportunidad</td><td><code>Opportunity</code></td><td>«Este iba en serio»</td></tr>
<tr><td>💚 Cliente</td><td><code>Converted</code> + el monto</td><td>«Este compró, y por esto»</td></tr>
<tr><td>🚫 Descalificado</td><td><code>Unqualified</code></td><td>«Deja de buscar gente así»</td></tr>
</tbody></table>
<p><b>Las demás no se reportan, a propósito.</b> «Nuevo lead» es el estado en que TikTok ya lo entregó. «Perdido» contradiría el «Cliente» que ya mandamos. Y <b>«Rezagado» habla de nuestro proceso, no del lead</b>.</p>
<h3>La cadena, y sus tiempos</h3>
<table class="w-tab"><thead><tr><th>Paso</th><th>Qué pasa</th><th>Cuándo</th></tr></thead><tbody>
<tr><td>1. El vendedor</td><td>Cambia la etapa en la ficha</td><td>—</td></tr>
<tr><td>2. El CRM</td><td>Registra el cambio con su fecha real</td><td>al instante</td></tr>
<tr><td>3. El puente</td><td>Escribe el estatus en el Google Sheet conectado</td><td><b>cada 3 h</b></td></tr>
<tr><td>4. TikTok</td><td>Relee la hoja y usa la señal para optimizar</td><td>cada ~10 min</td></tr>
</tbody></table>
<p>Entre que mueves la etapa y TikTok se entera pasan <b>entre 10 minutos y 3 horas</b>. La integración vive en Ads Manager ▸ Leads Center ▸ CRM integration, en modo <b>Signal postback</b>.</p>
<div class="w-caja w-warn"><span class="w-k">Clasificar no envía nada por sí solo</span><p>La señal sale cuando <b>el cron escribe la hoja</b> y TikTok la relee. Si clasificaste hace un rato, la señal todavía puede estar en camino.</p></div>`,
  },
  {
    id: 'p35', grupo: 'Los relevos', titulo: 'El relevo: demo agendada',
    bajada: 'El enemigo es el no-show.', chip: { texto: 'construida · APAGADA', tono: 'warn' },
    cuerpo: `
<p>El pase de estafeta es automático: agendar saca al lead de «Seguimiento sin respuesta» y la secuencia <b>«Demo agendada · rumbo a la sesión»</b> lo toma en su siguiente corrida.</p>
<p><b>El arco</b> (corte 10 días, L-S): D1 confirmación + botón de Google Calendar + qué preparar · D2 la historia de Andrea · D3 la agenda de los 20 minutos · D4 caso LiveShow + reseñas 4.8 · D6 y D8 anti no-show. Eje de todos: «mándame tus preguntas», y todos llevan el link de reagendar de <b>su</b> reunión.</p>
<h3>Los 8 pasos, exactos</h3>
<table class="w-tab"><thead><tr><th>Día</th><th>Canal</th><th>Qué sale</th></tr></thead><tbody>
<tr><td><b>1</b></td><td>✉️</td><td>«{{nombre}}, tu sesión quedó agendada» — botón de Google Calendar y qué preparar</td></tr>
<tr><td><b>1</b></td><td>📲</td><td><code>demo_preparacion</code> — ten a la mano 2-3 productos con sus tallas y colores</td></tr>
<tr><td>2</td><td>✉️</td><td>«Ya estoy preparando tu sesión» — entre más específicas tus preguntas, mejor llego preparada</td></tr>
<tr><td>3</td><td>✉️</td><td>«Así serán tus 20 minutos» — nada de tour de pantallas</td></tr>
<tr><td>3</td><td>📲</td><td><code>demo_pregunta</code> — ¿inventario por tallas, apartados, venta en línea o liveshows?</td></tr>
<tr><td>4</td><td>✉️</td><td>«De un pop-up a cientos de tiendas a la vez» — el caso y las 100+ reseñas</td></tr>
<tr><td>6</td><td>✉️</td><td>«{{nombre}}, ¿se te movió la agenda?» — reagendar toma 1 minuto</td></tr>
<tr><td>8</td><td>📲</td><td><code>demo_reagendar</code> — contéstame con el día y la reagendo yo misma</td></tr>
</tbody></table>
<p><b>5 correos y 3 WhatsApps.</b> Las tres plantillas están <b>aprobadas por Meta</b>, categoría UTILITY, es_MX, con una variable ({{1}} = nombre). Corte a los 10 días, L-S.</p>
<h3>Las variaciones</h3>
<table class="w-tab"><thead><tr><th>Evento</th><th>Qué pasa solo</th></tr></thead><tbody>
<tr><td><b>Reagenda</b></td><td>La cita vieja queda «reagendada» y nace la nueva ligada; el evento de Google Calendar se mueve; WhatsApp de confirmación; la secuencia reinicia en día 1.</td></tr>
<tr><td><b>Cancela</b></td><td>Sale de la secuencia; recibe UN rescate por WhatsApp; Andrea recibe aviso inmediato.</td></tr>
<tr><td><b>Vuelve a agendar</b></td><td>Se reinscribe solo en día 1.</td></tr>
<tr><td><b>No asiste</b></td><td>No cambia el estatus, pero entra a la lista «No asistieron sin reagendar» de Mi día. Es el caso que esta secuencia existe para evitar.</td></tr>
<tr><td><b>Asiste</b></td><td>Objetivo cumplido: sale entera.</td></tr>
<tr><td><b>Recordatorios</b></td><td>No son de la secuencia sino del sistema de reuniones: <b>correo 24 h antes</b> y <b>WhatsApp 1 h antes</b>, relativos a la fecha real y con link de reagendar. Salen aunque la secuencia esté apagada.</td></tr>
</tbody></table>
<h3>Las tres condiciones que la hacen segura</h3>
<p>El arco supone pista antes de la sesión. <b>No la hay:</b> 27 de 31 reuniones se agendan para el mismo día o el siguiente — mediana <b>0 días</b>, máximo 7. Sin guardas, casi todo el arco llegaba <b>después</b> de la reunión: preguntarle a alguien qué quiere ver en una sesión que ya tuvo.</p>
<table class="w-tab"><thead><tr><th>Condición</th><th>Qué hace</th></tr></thead><tbody>
<tr><td><b>Dos tramos, no una lista</b></td><td>Hasta el día 4 <b>prepara</b> y solo sale si hay sesión por delante. Del 6 en adelante <b>rescata</b> y solo sale si ya pasó sin asistir. Antes el rescate le llegaba a quien sí asistió.</td></tr>
<tr><td><b>Se para sola</b></td><td>Si la reunión pasó y sigue en «confirmada» —nadie marcó asistencia— la secuencia se pausa con motivo <code>reunion_sin_marcar</code> y deja nota en el inbox pidiendo que la marquen. Antes seguía escribiendo por el retraso de un registro.</td></tr>
<tr><td><b>Mira la reunión vencida</b></td><td>No solo la próxima. Sin ese dato el motor no distingue «todavía no llega» de «ya fue».</td></tr>
</tbody></table>
<div class="w-caja w-bad"><span class="w-k">Lo que ese dato te obliga a decidir</span>
<p>Con mediana de <b>0 días de pista</b>, la mayoría solo va a recibir el paso del día 1 —la confirmación— y nada más de preparación, porque la sesión ocurre antes. <b>Los pasos 2, 3 y 4 casi nunca van a salir.</b></p>
<p>No es un error del código: es una decisión de contenido. O el arco se comprime a lo que cabe en un día, o hay que empujar a que agenden con más anticipación.</p></div>
<div class="w-caja w-warn"><span class="w-k">Hoy está apagada</span>
<p>La secuencia está construida y sus plantillas listas, pero el toggle está en <b>off</b>: nada de esto se está enviando. Y el bloqueo <b>no es técnico</b> — las 3 plantillas de WhatsApp están aprobadas por Meta y los 5 correos activos. Falta el visto bueno al contenido.</p>
<p>Los recordatorios de 24 h y 1 h sí funcionan, porque viven en el sistema de reuniones y no en la secuencia.</p></div>`,
  },
  {
    id: 'p36', grupo: 'Los relevos', titulo: 'El relevo: ya cotizaste',
    bajada: 'Doce días de credibilidad.', chip: { texto: 'lista · falta prenderla', tono: 'ok' },
    cuerpo: `
<p>Cuando el lead llega a <b>Oportunidad</b> ya vio la demo y ya tiene precio. No hay nada que explicar y todo que demostrar, así que esta secuencia no repite el producto ni ofrece descuento: a esa altura las dos cosas restan.</p>
<p>Son <b>ocho correos en doce días</b>, todos con botón de WhatsApp. Cero WhatsApps automáticos: aquí el WhatsApp es del vendedor.</p>

<table class="w-tab"><thead><tr><th>Día</th><th>Qué se lleva el lead</th></tr></thead><tbody>
<tr><td><b>1</b></td><td>Diez cosas que un sistema genérico no hace. No supone nada de su operación — cada lead llega distinto.</td></tr>
<tr><td><b>3</b></td><td>Las 7 preguntas para evaluar cualquier sistema, con nuestra respuesta a cada una.</td></tr>
<tr><td><b>5</b></td><td>El hueco de curva: por qué su compra repite el mismo error cada temporada.</td></tr>
<tr><td><b>6</b></td><td>La cuenta que solo existe con varias tiendas: lo que falta aquí ya está pagado allá.</td></tr>
<tr><td><b>8</b></td><td>Las marcas que ponen el ejemplo, y qué hay debajo de esa experiencia.</td></tr>
<tr><td><b>9</b></td><td>El caso de LiveShow con número — y su parte fea, dicha antes de firmar.</td></tr>
<tr><td><b>11</b></td><td>El probador virtual: en tu tienda caben 200 prendas, en tu catálogo hay 2,000.</td></tr>
<tr><td><b>12</b></td><td>La decisión: arancel, calendario de compra y la resta hasta el Buen Fin.</td></tr>
</tbody></table>

<div class="w-caja"><span class="w-k">La regla que la distingue</span><p>Como es 100% correo, una respuesta por WhatsApp <b>no la detiene</b> — y eso es a propósito. Los correos siguen nutriendo mientras el vendedor conversa por el canal personal. Solo se detiene si responde por correo, se hace cliente o se descarta.</p></div>

<div class="w-caja w-bad"><span class="w-k">Antes de prenderla</span><p>Está <b>cargada pero apagada</b>. Prenderla manda correos a prospectos reales con cotización en la mano: es una decisión de negocio, no un paso de configuración.</p></div>`,
  },
  {
    id: 'p37', grupo: 'Los relevos', titulo: 'El relevo: prueba gratis',
    bajada: 'Catorce días, del primer login al nivelador.', chip: { texto: 'lista · falta prenderla', tono: 'ok' },
    cuerpo: `
<p>Once correos que llevan al usuario de cero a operar. Cada uno enseña <b>dónde está la cosa</b> con captura del sistema real y la ruta exacta del menú, para qué sirve, qué hacer hoy y qué viene después. El CTA nunca es comprar: es preguntar por WhatsApp.</p>

<h3>La secuencia final, día por día</h3>
<p>Tres canales a la vez. El correo enseña, el mensaje <b>dentro de Sacs</b> acompaña mientras trabaja, y el WhatsApp queda para cuando pregunta.</p>
<table class="w-tab"><thead><tr><th>Día</th><th>Correo</th><th>Dentro de Sacs</th><th>WhatsApp</th></tr></thead><tbody>
<tr><td><b>1</b></td><td>La Academia</td><td>—</td><td>—</td></tr>
<tr><td><b>2</b></td><td>Sesión con Andrea</td><td><b>Sesión con consultor (1 de 3)</b> · modal con calendario</td><td>—</td></tr>
<tr><td><b>3</b></td><td>Tu primer producto</td><td>—</td><td><b>¿Entraste a la Academia?</b></td></tr>
<tr><td><b>4</b></td><td>—</td><td><b>Tu promoción del anual</b> · tarjeta en inicio, no interrumpe</td><td>—</td></tr>
<tr><td><b>5</b></td><td>Talla × color</td><td>—</td><td><b>Sesión con consultor</b></td></tr>
<tr><td><b>6</b></td><td>—</td><td><b>Sesión con consultor (2 de 3)</b></td><td><b>¿Cómo vas con tus productos?</b></td></tr>
<tr><td><b>7</b></td><td>Abrir caja y vender</td><td>—</td><td>—</td></tr>
<tr><td><b>8</b></td><td>Sesión con Andrea (mitad)</td><td>—</td><td>—</td></tr>
<tr><td><b>9</b></td><td>Existencias por sucursal</td><td><b>Sesión con consultor (3 de 3)</b></td><td>—</td></tr>
<tr><td><b>10</b></td><td>—</td><td>—</td><td><b>Vas a la mitad</b></td></tr>
<tr><td><b>11</b></td><td>La orden de compra</td><td><b>Pregunta por WhatsApp</b> · deja de pedir cita</td><td>—</td></tr>
<tr><td><b>12</b></td><td>—</td><td>—</td><td><b>Te quedan pocos días</b> · sesión</td></tr>
<tr><td><b>13</b></td><td>La nivelación</td><td><b>Contratar con el 35%</b> · modal con precio</td><td>—</td></tr>
<tr><td><b>14</b></td><td>Lo que lograste</td><td><b>Último día</b> · o pide más días</td><td>—</td></tr>
<tr><td><b>15</b></td><td>35% en el pago anual</td><td>—</td><td><b>Terminó tu prueba</b> · sesión</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">La sesión con consultor, por los tres canales</span><p>Es la conversión real de una prueba: quien la toma contrata mucho más que quien no. Por eso se ofrece <b>seis veces</b> y por vías distintas — dentro de Sacs los días 2, 6 y 9, y por WhatsApp los días 5, 12 y 15.</p>
<p>El WhatsApp del día 5 cae entre dos ofertas in-app a propósito: es el mismo ofrecimiento por un canal más personal, para quien no abrió el modal. Un mensaje personal después de uno que se ignoró funciona; dos el mismo día, no.</p>
<p>Y el del día 15 llega cuando la cuenta <b>ya está bloqueada</b>. Por eso su texto dice primero que todo sigue guardado y sólo después propone algo: se quita el miedo a haber perdido el trabajo antes de hablar de nada. Ofrece la sesión <b>«aunque al final no contrates»</b> — condicionar la ayuda a la compra, justo en el momento de decidir, es la forma más rápida de que la decisión sea no.</p></div>

<div class="w-caja"><span class="w-k">Los WhatsApp los escribe Fernanda</span><p>Los de soporte caen en los días <b>3, 6 y 10</b>, no en el 2. El día 2 ya lleva dos toques —el correo de la sesión y el mensaje dentro de Sacs que ofrece la misma sesión—; un tercero hablando de otra cosa habría sido ruido. En el día 3 funciona mejor incluso: el correo del día 1 presenta la Academia y el WhatsApp llega dos días después a preguntar si entró. Un recordatorio separado del anuncio se lee como interés; pegado, como insistencia.</p></div>

<div class="w-caja"><span class="w-k">Tres veces la sesión, y luego se cambia la pregunta</span><p>La sesión con consultor se ofrece en los días 2, 6 y 9, y <b>el texto cambia cada vez</b>: arrancas · vas a la mitad · te queda poco. Tres veces la misma frase se lee como un robot y la tercera ya no se abre.</p>
<p>En el día 11 se <b>deja de pedir cita</b> y se pide la duda concreta por WhatsApp. Quien no agendó tres veces no va a agendar la cuarta; lo que sí hace es escribir una pregunta si se la piden así.</p></div>

<div class="w-caja"><span class="w-k">La promoción se avisa el día 4, no el último</span><p>Que sepa desde temprano que su prueba trae 35% en el anual — mientras decide, no cuando ya está decidiendo. Dicho el día 14 suena a rescate; dicho el día 4 es información.</p></div>

<div class="w-caja w-bad"><span class="w-k">Y se para en cuanto paga</span><p>Suscripción <b>activa</b> de ciclo anual o vitalicia y la secuencia se cierra con motivo <code>pago_licencia</code> — <b>y se le baja de los mensajes dentro de Sacs</b>. Un cliente que acaba de pagar viendo el modal de «contrata con 35%» aprende que le cobraron de más.</p>
<p>Un anual en <b>pendiente_pago</b> NO cuenta: ese es justo a quien todavía hay que empujar.</p></div>

<h3>Qué enseña cada correo</h3>
<table class="w-tab"><thead><tr><th>Día</th><th>Qué le enseña</th></tr></thead><tbody>
<tr><td><b>1</b></td><td>La Academia. Y no lo invita a «ver videos»: la Academia está gamificada y paga <b>$500 de saldo</b> más una licencia gratis para regalar.</td></tr>
<tr><td><b>2</b></td><td><b>Sesión con Andrea</b> para revisar sus flujos. Al principio a propósito: hacerla el día 12 resuelve dudas, hacerla el día 2 cambia cómo usa los doce que siguen.</td></tr>
<tr><td><b>3</b></td><td>Su primer producto. Uno solo, sin tallas.</td></tr>
<tr><td><b>5</b></td><td>Talla × color. Una blusa no es un producto, son 24.</td></tr>
<tr><td><b>7</b></td><td>Abrir caja y vender. El POS recibe con «Caja registradora cerrada» — no es un error, es el primer control.</td></tr>
<tr><td><b>8</b></td><td><b>Sesión con Andrea</b> de medio camino. Vale el doble que la primera porque ya tiene datos suyos adentro.</td></tr>
<tr><td><b>9</b></td><td>Existencias por sucursal. La respuesta a «¿te queda la M?».</td></tr>
<tr><td><b>11</b></td><td>La orden de compra y el hueco de curva.</td></tr>
<tr><td><b>13</b></td><td>La nivelación: mover en vez de comprar.</td></tr>
<tr><td><b>14</b></td><td>Lo que logró en catorce días, y qué pasa con su cuenta.</td></tr>
<tr><td><b>15</b></td><td><b>35% de descuento</b> en el pago anual de la primera sucursal.</td></tr>
</tbody></table>

<h3>Los días se cuentan desde su prueba, no desde que entró</h3>
<p>Es la diferencia entre que funcione y que no. Mover a alguien a la etapa cambia el <i>lifecycle</i>, no el estatus — así que un lead que llevabas dos meses nutriendo entraba con fecha de hace dos meses y el corte lo descartaba. <b>Nunca recibía el día 1</b>, sin error ni aviso.</p>
<p>Esa fecha ahora la sella el sistema en el momento en que se crea la cuenta, y la cadencia cuenta desde ahí. No hay que capturarla.</p>
<div class="w-caja"><span class="w-k">Y el que no tenga fecha, no entra</span><p>Mandarle el correo de bienvenida en su día 9, o el de cierre cuando su prueba ya venció, es peor que no mandar nada.</p></div>

<h3>Pedir cita se contesta solo</h3>
<p>Los correos del día 2 y del día 8 llevan botón de WhatsApp. Cuando esa solicitud llega, el sistema <b>contesta con los horarios reales del calendario</b> y el link que los confirma — sin esperar a que alguien abra la bandeja. El que elija queda confirmado al momento, con su invitación por correo y por WhatsApp.</p>
<p>Es la misma redacción que usa el vendedor a mano, para que el lead reciba lo mismo lo conteste una persona o el sistema.</p>

<div class="w-caja"><span class="w-k">Antes de prenderla</span><p>Está <b>completa</b>. Las plantillas de WhatsApp están aprobadas por Meta y enganchadas, y ningún paso apunta a nada sin aprobar. Lo único que falta es prenderla.</p></div>

<div class="w-caja"><span class="w-k">El día 14 y el bloqueo van juntos</span><p>El correo del día 14 —«lo que lograste y qué pasa con tu cuenta»— y el aviso de fin de prueba en la cuenta salen del <b>mismo</b> plazo. Si algún día se cambian los 14 días de la cadencia, hay que cambiar también los días que se otorgan al crear la cuenta, o el correo de cierre llega cuando el cliente ya no puede entrar.</p></div>`,
  },
  {
    id: 'e-lead', grupo: 'Las etapas', titulo: 'Nuevo lead',
    bajada: 'El estado en que TikTok lo entregó.', chip: { texto: 'No se reporta', tono: 'mut' },
    cuerpo: `
<p>Donde nace todo lead de campaña. <b>No significa abandono:</b> el Estatus puede decir que ya respondió, que hubo tres llamadas o que está cotizado. Significa únicamente que <b>nadie ha decidido todavía quién es</b>.</p>
<div class="w-caja"><span class="w-k">Por qué no se reporta</span><p>Decirle a TikTok «este lead es un lead» no le enseña nada — él lo entregó. Y cada etapa reportada compite con las demás por la atención del algoritmo: con demasiadas señales, ninguna pesa.</p></div>
<h3>Cuándo sacarlo de aquí</h3>
<p>En cuanto una persona lo trabaje y sepa quién es. Es el único paso manual de toda la cadena, y hoy es el que separa 30 señales de 81.</p>`,
  },
  {
    id: 'e-calificado', grupo: 'Las etapas', titulo: 'Calificado',
    bajada: 'Sí era del perfil.', chip: { texto: 'Qualified', tono: 'ok' },
    cuerpo: `
<p>Una persona lo revisó y confirmó que <b>es el cliente que buscamos</b>: giro que atendemos, tamaño que nos corresponde, necesidad real.</p>
<h3>Qué mirar para decidirlo</h3>
<ul>
<li><b>Sucursales declaradas en el formulario.</b> De 2 en adelante es nuestro terreno.</li>
<li><b>Sistema actual.</b> Quien ya usa algo (Eleventa, Sicar, Alegra, Avelon…) tiene la intención más alta: ya decidió que necesita un sistema, solo está eligiendo cuál.</li>
<li><b>Giro.</b> Hoy el foco es <b>fashion retail</b>: ropa, calzado, joyería y accesorios.</li>
</ul>
<div class="w-caja w-ok"><span class="w-k">Es la señal más rentable de mover</span><p>No cuesta nada y es la más frecuente. Un lead que contestó y encaja debería estar aquí el mismo día.</p></div>`,
  },
  {
    id: 'e-oportunidad', grupo: 'Las etapas', titulo: 'Oportunidad',
    bajada: 'Hay dinero en la mesa.', chip: { texto: 'Opportunity', tono: 'ok' },
    cuerpo: `
<p>Pasó de interesado a <b>proceso de venta abierto</b>: agendó demo, pidió cotización o está negociando.</p>
<div class="w-caja"><span class="w-k">Se mueve sola</span><p><b>Agendar una reunión promueve el lead a Oportunidad automáticamente.</b> No hay que hacerlo a mano. Si alguien agendó y sigue en Nuevo lead, algo no se registró por el canal correcto.</p></div>`,
  },
  {
    id: 'e-prueba', grupo: 'Las etapas', titulo: 'Prueba gratis',
    bajada: 'Ya está dentro. Todavía no paga.', chip: { texto: 'automática', tono: 'ok' },
    cuerpo: `
<p>Etapa entre Oportunidad y Cliente. Antes esta gente caía en una de las dos y <b>ninguna era cierta</b>: no está negociando —ya decidió probar— y no ha pagado.</p>

<h3>Se crea de dos lugares, y en los dos es un clic</h3>
<p>Antes eran tres pasos en dos sistemas: entrar a SACS, crear la cuenta a mano, y acordarse de anotar en el CRM cuál cuenta era de quién. El último casi nunca pasaba.</p>
<table class="w-tab"><thead><tr><th>Desde dónde</th><th>Cómo</th></tr></thead><tbody>
<tr><td><b>La ficha del lead</b></td><td>Pestaña <i>Seguimiento</i> ▸ tarjeta <b>Prueba gratis</b> ▸ «Crear cuenta de prueba». Propone el identificador con el nombre de la empresa y tú lo corriges.</td></tr>
<tr><td><b>El inbox, en plena conversación</b></td><td>El 📎 del composer ▸ <b>Prueba gratis</b>. Crea la cuenta y <b>deja el mensaje escrito</b> con la cuenta, el usuario y la contraseña. No lo manda: lo lees, le agregas lo tuyo y lo envías. Funciona igual en computadora y en el teléfono.</td></tr>
</tbody></table>

<div class="w-caja"><span class="w-k">Un clic hace las cinco cosas</span><p>Crea la cuenta en SACS marcada como prueba con sus días · la liga al lead y a su empresa · <b>lo mueve a esta etapa</b> · sella las fechas de inicio y fin · y deja la actividad en su ficha. Ese tercer punto es el que faltaba: la cadencia de onboarding se cuelga de la etapa, así que sin él se creaba la cuenta y el cliente <b>no recibía ninguno de los 14 correos</b>. No fallaba nada — simplemente no pasaba nada.</p></div>

<div class="w-caja"><span class="w-k">Dos datos que se dicen mal seguido</span><p>Se entra siempre por <b>app.sacscloud.com</b>: <b>no hay una dirección por cuenta</b>. El identificador —el que eliges al crearla— es el nombre del tenant, no un subdominio; dictarlo como si fuera una URL manda al cliente a una página que no existe, y eso es lo primero que ve de su prueba.</p>
<p>Y la contraseña temporal <b>se enseña una sola vez</b> para dictarla. No queda guardada en el CRM: el cliente la cambia en su primer acceso. Por eso el botón del inbox deja el mensaje ya escrito — es el momento en que hay que dictarla.</p></div>

<h3>Se acaba sola, y el cliente se entera</h3>
<p>Cada madrugada el sistema revisa las pruebas vivas:</p>
<table class="w-tab"><thead><tr><th>Cuándo</th><th>Qué pasa</th></tr></thead><tbody>
<tr><td><b>Faltando 3 días</b></td><td>Aviso en la campana, con su WhatsApp a un toque.</td></tr>
<tr><td><b>Faltando 1 día</b></td><td>El mismo aviso, en urgente.</td></tr>
<tr><td><b>El día que vence</b></td><td>La prueba se marca <b>terminada</b> y la cuenta muestra el aviso de fin de prueba — el <b>mismo</b> que pondría una persona desde sacs3 al suspender por falta de pago, con su título, su mensaje, <b>su botón de WhatsApp</b> y el link a planes. Se deja la actividad en la ficha y se avisa por la campana.</td></tr>
</tbody></table>
<p>Los textos de ese aviso no se escriben aquí: salen de la configuración central de SACS (<i>Configuración ▸ Cuentas ▸ bloqueo</i>), la misma que usa el bloqueo por adeudo. Si mañana se cambia el texto allá, este también cambia.</p>
<p>Qué ve exactamente, hasta dónde alcanza el candado y cómo revocar una cuenta a mano: <b>Revocar una cuenta</b>.</p>

<div class="w-caja"><span class="w-k">Vencida no es lo mismo que terminada</span><p><b>Vencida</b> es que la fecha pasó. <b>Terminada</b> es que ya se asumió y la cuenta tiene el aviso. Entre las dos hay una ventana —hasta que corre el cron de las 3:45 am— y es la que la ficha pinta en rojo. Si quieres el aviso hoy y no mañana, hay un botón «Cerrar ya».</p>
<p>Y si el aviso no se pudo poner —cuenta borrada, API caída— la prueba queda terminada pero <b>sin</b> marca de bloqueo, y el cron lo reintenta cada madrugada. Sin eso, un timeout de una noche dejaba una cuenta vencida abierta para siempre y en silencio.</p></div>

<h3>Lo que puedes hacer desde la ficha</h3>
<table class="w-tab"><thead><tr><th>Botón</th><th>Qué hace</th></tr></thead><tbody>
<tr><td><b>Extender</b></td><td>Le suma días a una prueba viva. No toca la cuenta.</td></tr>
<tr><td><b>Cerrar ya</b></td><td>La termina hoy y le pone el aviso, sin esperar al cron.</td></tr>
<tr><td><b>Reabrir</b></td><td>Le quita el aviso a la cuenta y la abre otra vez con días nuevos. Es una decisión comercial, no un trámite — por eso está separada de «Extender».</td></tr>
<tr><td><b>Ya compró</b></td><td>Cierra la prueba como <b>convertida</b> y le quita el aviso. Sin esto, el cliente que acaba de pagar se topa con la pantalla de «tu prueba terminó»: la peor primera impresión posible después de un cobro.</td></tr>
</tbody></table>
<p>Cerrar y cancelar se guardan distinto a propósito: <b>terminada</b> es que se acabó el tiempo, <b>cancelada</b> es que el cliente dijo que no antes. Mezclarlas hace que el reporte de conversión mienta.</p>

<h3>Todo queda escrito, en los dos lados</h3>
<p>Cada movimiento —creada, extendida, terminada, reabierta, convertida— deja una actividad en la ficha del lead. Y como el panel de detalle del inbox pinta <b>esa misma</b> línea de tiempo, quien atiende la conversación ve el contexto completo sin salir del chat: cuándo empezó su prueba, cuántos días le quedan y si alguien ya se la extendió.</p>

<h3>Qué se sabe de una prueba sin preguntarle a nadie</h3>
<table class="w-tab"><thead><tr><th>Dato</th><th>Para qué sirve</th></tr></thead><tbody>
<tr><td><b>Días que le quedan</b></td><td>Ya calculados. La fecha de fin se sella al crear la cuenta, así que no depende de que alguien la vuelva a contar — que es como terminan existiendo dos fechas para la misma prueba.</td></tr>
<tr><td><b>Si arrancó o no</b></td><td>Productos subidos, ventas y cortes de caja, con la fecha del último movimiento.</td></tr>
</tbody></table>

<div class="w-caja"><span class="w-k">El catálogo avisa antes que la venta</span><p>Nadie vende antes de subir su catálogo, así que <b>«subió productos» llega días antes que «hizo una venta»</b>. Es la señal más temprana de que la prueba arrancó — y su ausencia, la más temprana de que se está muriendo sola. Una cuenta en cero al día 3 no necesita el correo del día 5: necesita una llamada.</p></div>`,
  },
  {
    id: 'e-cliente', grupo: 'Las etapas', titulo: 'Cliente',
    bajada: 'Pagó.', chip: { texto: 'Converted + monto', tono: 'ok' },
    cuerpo: `
<p>La señal más fuerte del sistema, y la única que <b>viaja con dinero</b>.</p>
<div class="w-caja w-ok"><span class="w-k">Por qué importa el monto</span>
<p>Sale de su suscripción, y es lo que hace que TikTok persiga <b>clientes grandes</b> en vez de clientes cualesquiera. Sin suscripción registrada se reporta <b>sin</b> monto — nunca en cero, porque un cero le enseñaría que esa venta no valió nada.</p></div>
<div class="w-caja w-bad"><span class="w-k">Muévela cuando pasa, no en lote</span>
<p>TikTok guarda los leads <b>90 días</b>. Pasado eso el lead ya no existe de su lado y la señal no tiene a qué pegarse.</p>
<p>Ya estuvo a punto de costarnos: tres clientes que sumaban <b>$53,240 de ARR</b> casi quedan fuera porque su etapa se movió semanas después de la venta.</p></div>`,
  },
  {
    id: 'e-descalificado', grupo: 'Las etapas', titulo: 'Descalificado',
    bajada: 'Nunca fue del perfil.', chip: { texto: 'Unqualified', tono: 'bad' },
    cuerpo: `
<p>Es la <b>única señal negativa</b> del sistema, y la que faltaba hasta agosto de 2026. Con puros positivos el algoritmo aprende media lección: a quién buscar, pero nunca a quién <b>dejar</b> de buscar.</p>
<h3>Cuándo usarla</h3>
<ul>
<li><b>Giro fuera del foco.</b> Hoy el foco es fashion retail; una taquería o una tienda de celulares no lo es.</li>
<li><b>Tamaño que no corresponde</b> a lo que resolvemos.</li>
<li><b>Dato falso o inservible</b> — sin forma de contactarlo.</li>
</ul>
<div class="w-caja w-bad"><span class="w-k">La regla, y no admite excepciones</span>
<p>Solo se marca Descalificado <b>lo que una persona revisó y descartó</b>. Un lead sin trabajar <b>no</b> es un descalificado.</p>
<p><b>Un negativo equivocado hace más daño que un positivo faltante</b>, porque el algoritmo lo usa para <i>excluir</i> gente parecida. Marcar por flojera enseña a TikTok a evitar a tu próximo mejor cliente.</p></div>
<div class="w-caja w-warn"><span class="w-k">Efecto secundario que hay que vigilar</span>
<p>Si descalificas por giro de forma sistemática, revisa que la <b>página web no siga invitando ese giro</b>. Mientras el sitio muestre jugueterías, florerías o ferreterías —aunque sea en «próximamente»— vas a seguir pagando por leads que después descartas.</p></div>`,
  },
  {
    id: 'e-rezagado', grupo: 'Las etapas', titulo: 'Rezagado',
    bajada: 'Se enfrió de nuestro lado.', chip: { texto: 'No se reporta', tono: 'mut' },
    cuerpo: `
<p>El lead que <b>sí era del perfil</b> pero dejamos enfriar: se intentó, no prosperó, y ya no está vivo el hilo. Sirve para separarlo de los que todavía nadie tocó, y para poder recuperarlo después.</p>
<div class="w-caja"><span class="w-k">Por qué NO viaja a TikTok</span><p>Un rezagado habla de <b>nuestro proceso</b>, no de la calidad del lead. Reportarlo le enseñaría al algoritmo a evitar gente buena a la que simplemente no llamamos a tiempo. Mismo criterio que «Perdido».</p></div>
<div class="w-caja w-bad"><span class="w-k">Rezagado y Descalificado se ganan, no se deducen</span>
<p>Los dos describen algo que <b>una persona hizo</b> —intentó y no hubo respuesta; revisó y descartó—, nunca algo que el calendario hizo solo.</p>
<p>Marcar por antigüedad es la forma más fácil de equivocarse: <b>ya pasó una vez</b>, con 40 leads marcados por edad que hubo que revertir. Un lead de 10 días sin contactar no es un rezagado: <b>es un pendiente</b>.</p>
<p>Para «viejo pero todavía sin tocar» ya existe el <b>Estatus «Sin tocar»</b>, que el sistema calcula solo. Filtrar por antigüedad es una <b>vista</b>, no una etapa.</p></div>

<h3>Lo que recibe mientras está aquí</h3>
<p>Un rezagado no se abandona: entra a la cadencia <b>«Rezagados · top of mind»</b>, que no persigue —acompaña—. Tres carriles fijos, cada uno con su tipo de contenido y su propio ritmo:</p>
<table class="w-tab"><thead><tr><th>Día</th><th>Qué recibe</th><th>A qué invita</th></tr></thead><tbody>
<tr><td><b>Lunes</b></td><td>Un <b>insight</b> de la operación de una marca de moda, con su gráfica o su foto.</td><td>Agendar. Es una conversación de negocio.</td></tr>
<tr><td><b>Miércoles</b></td><td>Un <b>tip</b> que se hace esa misma semana, sin sistema y sin costo.</td><td>WhatsApp. Es una conversación de operación.</td></tr>
<tr><td><b>Viernes</b></td><td>Una <b>función</b> de Sacs, con la pantalla real.</td><td>Depende: se cuenta o se muestra.</td></tr>
</tbody></table>

<h3>Y cuatro WhatsApp, uno al mes</h3>
<p>Caen en las semanas <b>3, 6, 9 y 12</b>, intercalados entre los correos. Los escribe <b>Fernanda</b>, no Andrea.</p>
<div class="w-caja"><span class="w-k">Por qué uno al mes y no uno por semana</span><p>WhatsApp no es correo: Meta lo cobra por mensaje, entra al teléfono personal y a la tercera semana seguida de mensajes de marca uno bloquea. Un carril propio de WhatsApp habría disparado uno cada semana; por eso van <b>dentro</b> de los carriles que ya existen, en las posiciones que los dejan caer separados.</p></div>
<div class="w-caja"><span class="w-k">El último pregunta si le paramos</span><p>En la semana 12 llega un mensaje que ofrece dejar de escribir. No es rendirse: <b>es lo que más respuestas saca</b> de un rezagado, y el que contesta «sigue, me sirve» vale más que diez que nunca dijeron nada.</p></div>

<div class="w-caja"><span class="w-k">Se sale sola en cuanto hay señal</span><p>Si el lead responde, abre varios correos o vuelve al sitio, sale de la cadencia y regresa como <b>lead reciclado</b> — que aparece en el inicio del móvil, porque es el momento más caliente del embudo y no debe quedarse en una nota que solo ve quien ya está adentro.</p></div>`,
  },
  {
    id: 'e-perdido', grupo: 'Las etapas', titulo: 'Perdido',
    bajada: 'Fue cliente y se fue.', chip: { texto: 'No se reporta', tono: 'mut' },
    cuerpo: `
<p>Un <code>churned</code>: alguien que sí compró y luego se dio de baja.</p>
<div class="w-caja"><span class="w-k">Por qué no se manda</span>
<p>Porque <b>contradiría el «Cliente» que ya reportamos</b> por esa misma persona. Para TikTok esa conversión sí ocurrió y sí fue real; que después se haya ido es información de retención, no de adquisición.</p>
<p>No confundir con <b>Descalificado</b>, que es un lead que nunca avanzó y por eso sí es una etiqueta limpia.</p></div>`,
  },
  {
    id: 'inbox', grupo: 'Hablar con el cliente', titulo: 'Vender desde el inbox',
    bajada: 'Sin cambiar de pantalla.', chip: { texto: 'construido', tono: 'ok' },
    cuerpo: `
<p>En el panel derecho de cada conversación (pestaña <b>Acciones</b>) el vendedor ejecuta la venta completa.</p>
<table class="w-tab"><thead><tr><th>Acción</th><th>Cómo funciona</th></tr></thead><tbody>
<tr><td><b>Cotizar</b></td><td>Plan (precios del catálogo real), periodo (anual = 35% de descuento), sucursales, implementación y extras → Crear → el link del cliente aparece al instante → enviar por WhatsApp o correo. Queda ligada al lead y su apertura se rastrea.</td></tr>
<tr><td><b>Agendar</b></td><td>Días y horarios reales → confirmar ahí mismo. Al cliente le llega confirmación por correo + WhatsApp con su invitación y Meet. Si ya tiene reunión próxima, el panel avisa antes de duplicar.</td></tr>
<tr><td><b>Mandarle los horarios</b></td><td>Un clic manda los próximos horarios + el link público. Cuando el cliente elige, <b>todo</b> se confirma solo.</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Reglas del vendedor</span><p>El correo del cliente es <b>obligatorio</b> para confirmar una reunión. Si la ventana de WhatsApp está cerrada, el sistema lo dice y ofrece el camino que sí entrega. Todo usa los mismos precios y canales del CRM: <b>nada de rutas paralelas</b>.</p></div>`,
  },
  {
    id: 'wa-entrante', grupo: 'Hablar con el cliente', titulo: 'Cuando el lead nos escribe',
    bajada: 'Todo lo que pasa en los primeros segundos.', chip: { texto: 'construido', tono: 'ok' },
    cuerpo: `
<p>Un WhatsApp entrante no cae en el vacío. Antes de que nadie lo vea, el sistema ya decidió tres cosas: <b>quién es</b>, <b>qué contestarle</b> y <b>a quién avisarle</b>.</p>

<h3>1 · Quién es</h3>
<table class="w-tab"><thead><tr><th>Caso</th><th>Qué hace el sistema</th></tr></thead><tbody>
<tr><td><b>El teléfono ya es de alguien</b></td><td>Se liga a su ficha y avanza a «respondió». No se duplica nada. Es el caso de todo lead que viene de un correo nuestro.</td></tr>
<tr><td><b>Desconocido · la IA dice ventas</b></td><td>Crea el contacto y entra al funnel como «respondió».</td></tr>
<tr><td><b>Desconocido · dice soporte</b></td><td>Se marca y se queda solo como conversación, sin ensuciar el funnel.</td></tr>
<tr><td><b>Desconocido · dice spam</b></td><td>No crea nada.</td></tr>
<tr><td><b>La IA no contesta</b></td><td>Se asume ventas. Peor es perder un lead que sobrar un contacto.</td></tr>
</tbody></table>

<h3>2 · Qué contestarle</h3>
<p>Sale un acuse en segundos, <b>a cualquier hora</b>. El texto cambia según el reloj, porque la promesa tiene que ser verdad:</p>
<table class="w-tab"><thead><tr><th>Momento</th><th>Lo que recibe</th></tr></thead><tbody>
<tr><td><b>Dentro de horario</b><br />L-S, 9 a 19</td><td>«Te leo 👋 Soy Andrea, consultora de moda en Sacs. Dame unos minutos y te contesto por aquí mismo.»</td></tr>
<tr><td><b>Fuera de horario</b></td><td>«…Ahorita ya estamos fuera de horario — te contesto en cuanto abramos, a partir de las 9 de la mañana.»</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Una vez por conversación, no por mensaje</span><p>Si el lead manda tres mensajes seguidos <b>no</b> recibe tres veces la misma frase. El acuse se rearma a las 20 h, para que quien vuelve al día siguiente sí reciba señal de que lo leímos.</p></div>
<div class="w-caja"><span class="w-k">Y se calla si tú ya estás ahí</span><p>Si alguien del equipo escribió en esa conversación en las últimas <b>6 horas</b>, el acuse <b>no sale</b>. Pasó en real un domingo: el asesor le escribió a las 15:58, la clienta contestó a las 16:17 y el sistema le soltó «ya estamos fuera de horario, te contesto a partir de las 9 de la mañana» — porque el horario configurado es de lunes a sábado. El asesor le respondió doce minutos después. El bot tenía razón según su configuración y aun así el sistema quedó mintiendo delante de la clienta.</p>
<p>El acuse existe para que nadie se quede sin respuesta. Si ya hay una persona atendiendo, ese trabajo está hecho y el acuse solo puede estorbar: promete algo que ya está pasando, o contradice a quien está escribiendo. La ventana se ajusta en la misma pantalla; con <b>0</b> se apaga el candado.</p>
<p>Cuenta como «alguien del equipo» solo lo que sale del <b>composer del inbox</b> o de un mensaje programado. Un WhatsApp de cadencia no cuenta: ese es el sistema, no una persona.</p></div>

<h3>3 · De dónde venía</h3>
<p>Todos nuestros botones de WhatsApp mandan el mensaje ya escrito. Ese texto no dice solo «me escribieron»: dice <b>en qué punto del argumento se convenció</b>. El sistema lo reconoce, etiqueta la ficha y el aviso al equipo llega con contexto:</p>
<div class="w-caja"><span class="w-k">Así se ve el aviso</span><p><b>Regina de Kali Studio te escribió por WhatsApp</b><br />Viene de: Correo 3 · El hueco de curva<br />Quiere: Probar el motor con un estilo suyo de la temporada pasada<br />Etapa: oportunidad · cotizado</p></div>
<p>Se reconoce por una frase distintiva, no por el texto completo: WhatsApp deja editar antes de enviar y casi siempre agregan algo. Si el lead escribió por su cuenta <b>no se inventa etiqueta</b> — el acuse sale igual y el contador de no leídos hace su trabajo.</p>

<div class="w-caja"><span class="w-k">Dónde se configura</span><p>Todo esto vive en <b>Automatización ▸ Secuencias ▸ «WhatsApp entrante · atención y control»</b>. Es una secuencia por evento: no corre por días, reacciona en el momento. Si está apagada, no sale acuse.</p></div>`,
  },
  {
    id: 'canal-inapp', grupo: 'Hablar con el cliente', titulo: 'Hablarle dentro de Sacs',
    bajada: 'El tercer canal de las secuencias.', chip: { texto: 'nuevo', tono: 'ok' },
    cuerpo: `
<p>Correo y WhatsApp le hablan al lead donde su atención está repartida. Cuando alguien está <b>usando Sacs</b> —una prueba gratis, un cliente nuevo— el mejor lugar para hablarle es el sistema que tiene abierto: ahí ya puso atención, el mensaje llega en el contexto de lo que está haciendo, y no cuesta ni un peso de Meta ni de SendGrid.</p>

<h3>Cómo se arma un paso así</h3>
<p>En el editor de la secuencia, el canal <b>Dentro de Sacs</b>. No se redacta ahí: <b>se elige una campaña de Outbound</b>. La campaña es el mensaje —con su formato, sus botones y su vista previa ya resueltos—; la secuencia decide a quién y cuándo.</p>
<div class="w-caja"><span class="w-k">Por qué no se escribe dentro del paso</span><p>Habría dos editores de mensajes in-app, y se separan en la primera semana: Outbound estrena un formato y el de secuencias no lo tiene. Uno solo, y la secuencia lo usa.</p></div>

<h3>Solo aparecen las campañas de secuencia</h3>
<p>El selector no ofrece cualquier campaña de Outbound, y es a propósito. La audiencia de una campaña normal se resuelve por condiciones, y ahí <b>«sin condiciones» significa TODAS las empresas</b>, no ninguna. Elegir una de esas en un paso de secuencia le habría mandado el mensaje del día 2 de una prueba gratis a toda la base.</p>
<div class="w-caja w-bad"><span class="w-k">Medido, no supuesto</span><p>La misma definición de audiencia sin la marca de «gobernada por secuencia» resuelve a <b>143 cuentas</b>. Con la marca, a <b>1</b>.</p></div>
<p>Una campaña de secuencia nace con la audiencia <b>vacía</b> y va creciendo: cada lead que llega a ese paso entra, y al salir de la secuencia, sale.</p>

<h3>Dos cosas que el motor aprendió con esta cadencia</h3>
<table class="w-tab"><thead><tr><th>Qué</th><th>Para qué sirve</th></tr></thead><tbody>
<tr><td><b>Contar hacia atrás</b></td><td>Las cadencias de lead cuentan días <i>desde</i> una fecha que ya pasó. Una de renovación cuenta <i>hacia</i> una que no ha llegado. Se declara con el ancla «Su fecha de renovación».</td></tr>
<tr><td><b>No expulsar clientes</b></td><td>El motor sacaba a todo cliente de toda secuencia con motivo «convertido» — correcto para adquisición, imposible para retención. Una secuencia marcada <b>de cliente</b> apaga esa regla solo para ella.</td></tr>
</tbody></table>
<p>Sin esas dos, ninguna cadencia de post-venta era construible: ni renovación, ni onboarding del cliente nuevo, ni cuenta dormida, ni winback.</p>

<h3>No compite con los otros canales</h3>
<table class="w-tab"><thead><tr><th>Regla</th><th>Por qué</th></tr></thead><tbody>
<tr><td>No gasta el cupo de <b>un correo y un WhatsApp por día</b></td><td>No interrumpe: espera dentro del sistema a que el usuario entre.</td></tr>
<tr><td>No se detiene cuando el lead responde por otro canal</td><td>Que conteste un correo no es razón para quitarle de la pantalla el modal que explica su promoción.</td></tr>
<tr><td>Sin cuenta de SACS ligada, el paso se salta</td><td>Y queda anotado como saltado, no como enviado.</td></tr>
<tr><td>Si falla, <b>no</b> se marca como enviado</td><td>La siguiente corrida lo reintenta. Dar por entregado algo que el usuario nunca vio es peor que no mandarlo.</td></tr>
</tbody></table>`,
  },
  {
    id: 'reuniones', grupo: 'Hablar con el cliente', titulo: 'El estatus de las reuniones',
    bajada: 'Dónde vive el dato y qué falta para tenerlo a la mano.',
    cuerpo: `
<p>Hay <b>dos niveles</b>, y conviene no confundirlos.</p>
<h3>1 · Por reunión</h3>
<p>Cada cita tiene su propio estado, visible en la pestaña <b>Reuniones</b>:</p>
<table class="w-tab"><thead><tr><th>Estado</th><th>Qué significa</th></tr></thead><tbody>
<tr><td><code>confirmada</code></td><td>Agendada y por venir</td></tr>
<tr><td><code>asistio</code></td><td>Se presentó — es lo que gradúa al lead a «Demo hecha»</td></tr>
<tr><td><code>no_asistio</code></td><td>No-show. La métrica que la secuencia existe para bajar</td></tr>
<tr><td><code>cancelada</code></td><td>La canceló</td></tr>
<tr><td><code>reagendada</code></td><td>Se movió: esta queda marcada y nace una nueva ligada</td></tr>
</tbody></table>
<h3>2 · Por contacto</h3>
<p>El <b>Estatus del lead</b> refleja el momento más avanzado: «Agendó demo» y luego «Demo hecha», los dos del grupo <i>comprometido</i>. Pero es <b>un solo estado</b>: no dice cuántas reuniones hubo ni qué pasó con cada una.</p>
<div class="w-caja w-warn"><span class="w-k">Lo que falta y ya está escrito</span>
<p>Hay una migración lista —<code>scripts/migration-2026-08-contador-reuniones.sql</code>— que agrega siete columnas al contacto: <b>total, agendadas, completadas, canceladas, no_asistio, reagendadas</b> y la fecha de la última. Se mantienen con un trigger sobre <code>bookings</code>, así que no dependen de que nadie las actualice.</p>
<p><b>Falta correr el SQL.</b> Hasta entonces, para saber cuántas reuniones tuvo un lead hay que ir a mirarlas una por una.</p></div>
<div class="w-caja"><span class="w-k">Una trampa al leer el total</span>
<p>Una reunión reagendada deja el booking viejo en <code>reagendada</code> y crea uno nuevo. <b>Dos reagendas de la misma cita suman 3 al total.</b> Por eso la columna de reagendadas existe: para poder restar y saber cuántas reuniones hubo de verdad.</p></div>`,
  },
  {
    id: 'reunion-paso-a-paso', grupo: 'Hablar con el cliente', titulo: 'Una reunión, paso a paso',
    bajada: 'Qué hace el sistema solo, en qué orden, y qué viene puesto de fábrica.',
    cuerpo: `
<p>Esto es lo que pasa desde que se propone un horario hasta que la reunión se cierra. <b>Casi todo corre solo</b>; lo que necesita una persona está marcado.</p>

<h3>1 · Se propone el horario</h3>
<p>Hay tres caminos y sirven para cosas distintas:</p>
<table class="w-tab"><thead><tr><th>Camino</th><th>Cuándo se usa</th></tr></thead><tbody>
<tr><td><b>Desde el inbox</b> — botón de proponer horarios</td><td>El de todos los días. El cliente recibe la lista y <b>toca uno</b>: se agenda solo, sin que nadie escriba nada. Es lo que más cierra.</td></tr>
<tr><td><b>Link general</b> — sacscloud.com/agendar/…</td><td>Para campañas y firmas de correo. Da la cara quien diga el tipo de reunión.</td></tr>
<tr><td><b>Link personal</b> — /agendar/u/… </td><td>El de cada vendedor. Ahí da la cara <b>esa</b> persona, con su nombre y su foto.</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Los horarios que se ofrecen no son los primeros libres</span>
<p>Se ordenan por <b>a qué horas y qué días la gente sí llegó</b> en los últimos 90 días. Ordenar por el hueco más cercano es ordenar por la comodidad del calendario, no por la probabilidad de que la reunión ocurra. Cuando todavía no hay historia suficiente, todo empata y vuelve a mandar la cercanía.</p>
<p>Se ofrecen <b>máximo 2 horarios por día</b> para que la lista dé días distintos y no diez horas del mismo martes, y <b>10 en total</b>, que es el límite de WhatsApp.</p></div>

<h3>2 · Al agendar</h3>
<p>Salen la confirmación por correo y por WhatsApp con la liga de Meet, la fecha, la hora y el huso. Las dos se pueden apagar por separado en el tipo de reunión.</p>

<h3>3 · Antes de la reunión</h3>
<p>Los recordatorios que vienen <b>preconfigurados en los nueve tipos</b>:</p>
<table class="w-tab"><thead><tr><th>Cuándo</th><th>Al cliente</th><th>Al vendedor</th></tr></thead><tbody>
<tr><td><b>1 día antes</b></td><td>Correo y WhatsApp</td><td>WhatsApp</td></tr>
<tr><td><b>3 horas antes</b></td><td>Correo y WhatsApp</td><td>WhatsApp</td></tr>
<tr><td><b>10 minutos antes</b></td><td>Solo WhatsApp</td><td>WhatsApp</td></tr>
</tbody></table>
<p>Todo eso se cambia en <b>Configuración → Agenda → Editar → Avisos al cliente</b>. Ver <b>Los avisos de la reunión</b> para el detalle.</p>

<h3>4 · Si el cliente toca «Reagendar»</h3>
<p>El recordatorio trae ese botón. Al tocarlo recibe <b>en el acto</b> la liga para escoger otro horario, con su reunión nombrada — no espera a que alguien lea el chat. Quien toca ese botón está diciendo que sí quiere la reunión: es de las señales más fuertes que da un lead.</p>

<h3>5 · Después de la reunión — ESTO SÍ LO HACE UNA PERSONA</h3>
<div class="w-caja"><span class="w-k">Marcar «asistió» o «no asistió» es lo único que el sistema no puede adivinar</span>
<p>Y de ahí cuelga <b>todo</b> lo demás: el seguimiento a quien no llegó, el conteo de inasistencias del tipo de reunión y la medición de si los recordatorios sirven. Si nadie marca, las tres cosas se apagan solas y en silencio, y la agenda se llena de reuniones «confirmadas» que ya ocurrieron.</p>
<p><b>Tres horas después de terminar</b>, si sigue sin marcarse, sale un aviso en la campana preguntando si llegó.</p></div>

<h3>6 · Si no llegó</h3>
<p>Al marcar <b>no asistió</b> sale solo un correo y un WhatsApp invitándolo a escoger otro horario, con la liga lista. Se le escribe por plantilla: a quien no llegó casi nunca se le puede mandar texto libre —Meta solo lo permite si él escribió en las últimas 24 horas— y es justo a quien hay que alcanzar.</p>
<p>El tipo de reunión puede <b>alertar tras N inasistencias</b>; eso se ve en la ficha del cliente.</p>

<h3>Lo que viene puesto de fábrica</h3>
<table class="w-tab"><thead><tr><th>Qué</th><th>Por defecto</th></tr></thead><tbody>
<tr><td>Confirmación al agendar</td><td>Correo <b>y</b> WhatsApp, encendidos</td></tr>
<tr><td>Recordatorios</td><td>1 día · 3 horas · 10 minutos</td></tr>
<tr><td>Aviso al vendedor</td><td>WhatsApp, con la misma anticipación</td></tr>
<tr><td>Un tipo de reunión NUEVO</td><td>Nace con esos tres recordatorios, no mudo</td></tr>
<tr><td>Quién da la cara</td><td><b>Andrea Araujo</b> en los nueve tipos. En un link personal, el vendedor de ese link.</td></tr>
<tr><td>Zona horaria</td><td>Todo se dice en hora del centro de México, y a quien está en otra zona se le agrega su hora local</td></tr>
</tbody></table>`,
  },
  {
    id: 'avisos-reunion', grupo: 'Hablar con el cliente', titulo: 'Los avisos de la reunión',
    bajada: 'Qué recibe el cliente cuando agenda y antes de conectarse.',
    cuerpo: `
<p>Cada tipo de reunión decide <b>qué avisos salen y cuándo</b>. No está escrito en el código: se cambia en <b>Configuración → Agenda → Editar el tipo de reunión → Avisos al cliente</b>, y aplica desde el siguiente agendado.</p>
<h3>Al agendar</h3>
<table class="w-tab"><thead><tr><th>Aviso</th><th>Qué lleva</th></tr></thead><tbody>
<tr><td><b>Correo de confirmación</b></td><td>Fecha, hora con su huso, duración, la liga de Meet y los botones de reagendar y cancelar</td></tr>
<tr><td><b>WhatsApp</b></td><td>Lo mismo, en el chat — y queda espejado en el inbox, así que quien abra la conversación ve exactamente lo que el cliente recibió</td></tr>
</tbody></table>
<h3>Antes de la reunión</h3>
<p>Cada recordatorio dice <b>cuánto antes</b> y <b>por dónde</b>. Los que trae hoy toda reunión:</p>
<table class="w-tab"><thead><tr><th>Cuándo</th><th>Canales</th><th>Para qué sirve</th></tr></thead><tbody>
<tr><td><b>1 día antes</b></td><td>Correo y WhatsApp</td><td>Da tiempo de mover la agenda si no le queda</td></tr>
<tr><td><b>3 horas antes</b></td><td>Correo y WhatsApp</td><td>Lo pone en el día del cliente, cuando todavía puede acomodarse</td></tr>
<tr><td><b>10 minutos antes</b></td><td>Solo WhatsApp</td><td>Es para que se conecte: a diez minutos nadie abre el correo</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Todos dicen la hora y el huso</span>
<p>Cada aviso trae la hora <b>y</b> que es hora del centro de México. Un cliente en Tijuana y otro en Cancún llevan dos horas de diferencia entre sí: una hora sin huso es una reunión a la que alguien llega tarde.</p></div>
<h3>Quién da la cara</h3>
<p>En el mismo editor se define el <b>nombre y la foto</b> que ve el cliente en la página de agendar. Antes salía siempre el del dueño del tipo de reunión, y el dueño es quien decide de qué calendario salen los horarios — no necesariamente quien atiende. Vacío = el del dueño.</p>
<p>En un <b>link personal</b> (/agendar/u/…) manda el vendedor de ese link, no este campo: para eso existe un link personal.</p>

<h3>Lo que puedes configurar</h3>
<ul>
<li>Agregar o quitar recordatorios, los que quieras.</li>
<li>La anticipación en <b>minutos, horas, días o semanas</b>.</li>
<li>Por cuál canal sale cada uno: correo, WhatsApp o los dos.</li>
<li>Apagar uno sin borrarlo, con la casilla <b>activo</b>.</li>
<li>Apagar la confirmación de agendado, por canal.</li>
</ul>
<h3>El WhatsApp siempre sale por plantilla</h3>
<p>Meta no deja mandar texto libre a quien no nos escribió en las últimas 24 horas, y casi nadie está en esa ventana: <b>de 280 conversaciones, 8</b>. Por eso los recordatorios usan plantilla aprobada («reunion_recordatorio»), que llega siempre. Si Meta todavía no la aprueba, el correo sale igual y <b>aparece un aviso en la campana</b> diciendo que WhatsApp no está saliendo.</p>
<h3>Al vendedor también le llega</h3>
<p>El host recibe su propio WhatsApp con la misma anticipación: con quién es, cuándo y la liga. Si el vendedor se distrae, el cliente entra a Meet solo — que es peor que si no llegara ninguno de los dos.</p>
<h3>Lo que el sistema respeta y avisa</h3>
<ul>
<li><b>Quien pidió no recibir WhatsApp</b> no lo recibe, ni siquiera recordatorios. Eso no es preferencia, es cumplimiento.</li>
<li>Si <b>falta la liga de Meet</b> cuando toca el recordatorio, el aviso sale igual —la hora es lo que importa— y salta una alerta para que alguien la ponga.</li>
<li>Si un aviso <b>no logra salir</b>, aparece en la campana. Un recordatorio que no llegó y nadie supo es igual a no tener recordatorios, con la ilusión de tenerlos.</li>
<li>Al cliente que está <b>fuera del centro del país</b> se le dice además su hora local. Tijuana lleva una hora menos y Cancún una más: hacer la resta no es su trabajo.</li>
<li>En una <b>serie</b>, el aviso dice «sesión 2 de 3».</li>
</ul>
<div class="w-caja"><span class="w-k">Dos límites que conviene saber</span>
<p>El reloj revisa cada <b>5 minutos</b>: un recordatorio de menos de 5 minutos no alcanza a salir. Y ninguno se manda tarde — si la reunión ya empezó, el aviso no sale: decir «es en 1 día» cuando faltan 20 horas es peor que no decir nada.</p></div>
<div class="w-caja"><span class="w-k">¿Sirven?</span>
<p>En Agenda → Estadísticas se compara el no-show de las reuniones que <b>sí</b> recibieron recordatorio contra las que no. Con menos de diez de cada lado no se pinta el porcentaje: con tres reuniones, una falta es «33%» y eso no significa nada.</p></div>
<div class="w-caja"><span class="w-k">Cada aviso queda registrado</span>
<p>En la ficha del lead aparece qué recordatorio salió, por dónde y cuándo. Si el cliente dice que no le llegó, ahí se ve. Y nunca se manda dos veces, aunque el reloj corra dos veces por un reintento.</p></div>`,
  },
  {
    id: 'alta-cliente', grupo: 'Después de la venta', titulo: 'El alta del cliente',
    bajada: 'Toda venta termina con su cuenta de SACS ligada. Sin excepción.',
    cuerpo: `
<p>Cobrar deja al cliente pagado. <b>El alta lo deja usando el sistema</b> — y ese paso es obligatorio: un cliente sin cuenta ligada es un pendiente visible que el sistema recuerda solo, en la campana y en el barrido nocturno, hasta que se cierra.</p>
<h3>El botón «Cuenta SACS» de su ficha</h3>
<p>Pregunta solo qué camino aplica y enseña solo ese:</p>
<table class="w-tab"><thead><tr><th>Caso</th><th>Qué se hace</th></tr></thead><tbody>
<tr><td><b>Venía de prueba gratis</b></td><td><b>Activar</b>: la cuenta deja de ser prueba y queda indefinida — se apaga la marca en SACS, se desbloquea si estaba vencida, y el CRM marca la prueba como convertida. La liga ya existía.</td></tr>
<tr><td><b>Nunca tuvo cuenta</b></td><td><b>Crear</b>: identificador + correo del dueño (los demás datos salen de la ficha). Nace SIN marca de prueba y ligada. La contraseña temporal se enseña UNA vez: dásela al cliente en ese momento.</td></tr>
<tr><td><b>La cuenta existe pero nadie la ligó</b></td><td><b>Ligar</b>: se escribe la liga. Si la cuenta ya es de otra empresa, el botón lo dice y no la pisa — ese conflicto lo resuelve una persona.</td></tr>
<tr><td><b>Y siempre: sus datos fiscales</b></td><td>Razón social, RFC, código postal y régimen fiscal, más su <b>constancia de situación fiscal adjunta</b> (PDF o foto, en el mismo recuadro). Sin esto no se le puede facturar, y el recuadro del alta no se cierra sin ellos.</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Si algo falla, el pendiente no muere</span>
<p>El cobro nunca se deshace y el error queda en la campana con sus palabras. Se reintenta desde el mismo botón. Nunca «se cobró pero quién sabe qué pasó con la cuenta».</p></div>
<div class="w-caja warn"><span class="w-k">La prueba de un empleado cuenta</span>
<p>La cuenta se busca por EMPRESA, no solo por quien firmó la cotización: si un empleado probó con otra cuenta de la misma empresa, esa es la que se activa.</p></div>
<h3>El ritual, en orden</h3>
<ol>
<li><b>Se cobra la cotización.</b> El sistema revisa solo la cuenta: si falta, el pendiente cae en la campana en ese momento.</li>
<li><b>Se abre la ficha del cliente</b> (pestaña Resumen). Si hay trámite pendiente, ahí está el recuadro «Cuenta SACS · paso obligatorio del alta» con el camino que aplica. Si no aparece el recuadro, el trámite ya está cerrado.</li>
<li><b>Se ejecuta el camino</b> — activar, crear o ligar. Al crear, la contraseña temporal se enseña UNA sola vez: cópiala y dásela al cliente en ese momento, no existe forma de volver a verla.</li>
<li><b>Se capturan sus datos fiscales</b> en el mismo recuadro: razón social, RFC, C.P. y régimen tal como vienen en su constancia — y la constancia se adjunta ahí mismo. Pídesela en la misma llamada del alta: es cuando el cliente la tiene a la mano y la buena voluntad está fresca.</li>
<li><b>Se confirma con el cliente que ya entró.</b> El alta no termina cuando el botón dice «listo»: termina cuando el cliente está adentro.</li>
</ol>
<div class="w-caja mut"><span class="w-k">Si «Activar» contesta que el puente está cerrado</span>
<p>Sale un mensaje sobre <code>CRM_SYNC_SECRET</code>: significa que la conexión segura con SACS está pendiente de configurarse del lado técnico. <b>La liga de la cuenta sí queda hecha</b>; solo la conversión de la marca de prueba queda pendiente y se reintenta desde el mismo botón cuando el puente abra. No es un error tuyo ni del cliente.</p></div>`,
  },
  {
    id: 'onboarding-30', grupo: 'Después de la venta', titulo: 'Los primeros 30 días',
    bajada: 'El onboarding: etapas medidas por hechos, con el consultor donde el dato dice que se atoró.',
    cuerpo: `
<p>Cuando el alta se cierra, el cliente entra a sus 30 días acompañados. <b>Las etapas avanzan solas</b>, leyendo su uso real cada noche — al cliente no se le pregunta si ya configuró: se ve en sus datos.</p>
<table class="w-tab"><thead><tr><th>Etapa</th><th>Se cumple cuando…</th></tr></thead><tbody>
<tr><td><b>Cuenta lista</b></td><td>Tiene acceso; todavía no la hace suya</td></tr>
<tr><td><b>Configurado</b></td><td>Catálogo con ≥10 productos y ≥2 usuarios (los umbrales son editables)</td></tr>
<tr><td><b>Primer uso</b></td><td>Su primera venta real</td></tr>
<tr><td><b>Uso constante</b></td><td>Vende varios días por semana</td></tr>
<tr><td><b>Graduado</b></td><td>Día 30 con uso constante — el onboarding terminó bien</td></tr>
</tbody></table>
<h3>Qué hace el sistema solo</h3>
<ul>
<li><b>Día 0</b>: correo de bienvenida con su acceso y el botón para agendar su Sesión de configuración.</li>
<li><b>Día 3 sin configurar</b>: guía de arranque (solo si el hito falta — a quien ya vende no se le manda «carga tu catálogo»).</li>
<li><b>Día 7 sin primera venta</b>: aviso al CONSULTOR, no al cliente. Ahí lo que toca es llamada.</li>
<li><b>Atorado</b> (5–7 días sin avanzar): aviso escalonado al consultor con el dato que lo prueba.</li>
<li><b>Cancela a media rampa</b>: el caso cierra como perdido temprano y CHURN toma la estafeta — los dos módulos se pasan la bola, nunca conviven abiertos.</li>
</ul>
<h3>La pantalla</h3>
<p><b>Cuentas → Onboarding</b>: cada caso con su etapa, su día (N/30), sus tres hitos como puntos, si está atorado y su consultor (reasignable ahí mismo). El consultor trabaja los atorados primero: es una lista de a quién llamar hoy, no un tablero para admirar.</p>
<h3>Cómo se enciende (y qué pasa al hacerlo)</h3>
<ol>
<li>Ir a <b>Cuentas → Onboarding</b>. Arriba a la derecha dice su estado: <b>Pausado</b> o <b>Encendido</b>.</li>
<li>Tocar <b>Encender</b> y confirmar. Desde ese instante, todo cliente NUEVO con cuenta ligada entra solo a sus 30 días: correos de arranque, avisos al consultor y barrido nocturno.</li>
<li>Los clientes que ya existían <b>no entran</b>. La línea que separa «nuevo» de «viejo» se fija la PRIMERA vez que se enciende y no se mueve aunque se apague y se vuelva a prender.</li>
<li>Apagar detiene todo de inmediato: no se abre ningún caso nuevo ni sale ningún mensaje. Los casos abiertos se quedan como están, esperando.</li>
</ol>
<div class="w-caja warn"><span class="w-k">El interruptor: hoy está PAUSADO</span>
<p>El motor completo existe y no manda nada hasta que el dueño lo encienda. Un cliente viejo se puede meter a mano, uno por uno, si el consultor quiere acompañarlo — esa es la única puerta para los de antes del encendido.</p></div>
<div class="w-caja"><span class="w-k">De qué depende todo esto</span>
<p>Del sync nocturno de uso. Si el dato tiene más de 48 horas, el barrido lo dice en la campana en vez de medir con datos viejos — un tablero leyendo datos viejos es peor que ninguno.</p></div>`,
  },
  {
    id: 'renovacion', grupo: 'Después de la venta', titulo: 'Rumbo a la renovación',
    bajada: 'La primera cadencia de cliente.', chip: { texto: 'lista · falta prenderla', tono: 'ok' },
    cuerpo: `
<p>Noventa días antes de pedirle dinero a un cliente, enseñarle qué valió el año. Doce pasos por los tres canales, y una entrega limpia al cobro que ya existe.</p>

<div class="w-caja"><span class="w-k">Qué NO es</span><p><code>arr-reminders</code> ya manda el recordatorio de renovación a <b>30, 15 y 7 días</b> y hace dunning de las vencidas. Eso funciona y no se toca. Pero ese correo es transaccional —dice cuándo y cuánto— y le llega a alguien que lleva un año sin que nadie le muestre qué obtuvo. A esas alturas la decisión ya está tomada.</p>
<p>Esta cadencia corre <b>antes</b>: de D-90 a D-18. Cuando arranca el recordatorio de cobro, el cliente ya vio su año, ya le ofreciste tres veces una revisión y ya sabe cuánto se ahorra por decidir temprano.</p></div>

<h3>Las doce paradas</h3>
<table class="w-tab"><thead><tr><th>Falta</th><th>Correo</th><th>Dentro de Sacs</th><th>WhatsApp</th></tr></thead><tbody>
<tr><td><b>90 d</b></td><td>Tu año en números</td><td>—</td><td>—</td></tr>
<tr><td><b>80 d</b></td><td>—</td><td>Lo que ya pagas y no usas</td><td>—</td></tr>
<tr><td><b>60 d</b></td><td>Sesión 1 · ¿qué te cuesta trabajo?</td><td>Modal · escribir a un consultor</td><td>—</td></tr>
<tr><td><b>52 d</b></td><td>Sesión 2 · lo que no se ve desde afuera</td><td>—</td><td>—</td></tr>
<tr><td><b>45 d</b></td><td>—</td><td>—</td><td>La sesión, por si no abriste</td></tr>
<tr><td><b>40 d</b></td><td>Sesión 3 · la última antes de decidir</td><td>—</td><td>—</td></tr>
<tr><td><b>33 d</b></td><td><b>Renueva con 10%</b></td><td>Banner del 10%</td><td>—</td></tr>
<tr><td><b>25 d</b></td><td>—</td><td>—</td><td>Se pasó el 10%, queda el 5%</td></tr>
<tr><td><b>18 d</b></td><td><b>Últimos días del 5%</b></td><td>Banner del 5%</td><td>—</td></tr>
<tr><td><b>15 d</b></td><td colspan="3">↳ toma <code>arr-reminders</code></td></tr>
</tbody></table>

<h3>El descuento por decidir temprano</h3>
<table class="w-tab"><thead><tr><th>Si renueva…</th><th>Paga</th></tr></thead><tbody>
<tr><td>con <b>30 días</b> o más de anticipación</td><td><b>10% menos</b></td></tr>
<tr><td>con <b>15 días</b> o más</td><td><b>5% menos</b></td></tr>
<tr><td>después de eso</td><td>precio normal</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Y cada quien ve SUS números</span><p>El correo no dice «te damos 10%»: dice <b>tu monto, tu fecha límite y cuánto te ahorras</b>, calculado desde tu suscripción real. Un descuento sin la cuenta hecha se lo tiene que calcular el que lo recibe — y no lo hace.</p>
<p>Las fechas límite se calculan restando a la fecha de renovación, nunca sumando a hoy. Si se calcularan desde hoy, el correo de los 60 días y el de los 40 darían fechas distintas y parecería que se la estamos moviendo.</p></div>

<div class="w-caja w-bad"><span class="w-k">Si no hay datos, no se manda</span><p>Una suscripción sin fecha de próxima factura o sin monto produciría un correo que dice «tu renovación es el&nbsp;&nbsp;por&nbsp;». El paso se salta y queda anotado como <code>sin_datos_de_renovacion</code>. Hoy hay <b>9 suscripciones activas en ese caso</b>: esas nunca entran hasta que alguien les ponga fecha.</p></div>

<h3>Todos los botones llevan a WhatsApp</h3>
<p>Ninguno abre el agendador, y es a propósito. Para un <b>lead</b>, agendar es el compromiso que se busca: pone fecha y obliga a prepararse. Para un <b>cliente</b> que ya te conoce es fricción — tiene que encontrar hueco y esperar tres días para preguntar algo que se contesta en dos mensajes.</p>
<p>Y las tres cosas que quiere un cliente antes de renovar —resolver una duda, ver un upgrade, pedir algo específico— caben en un hilo y no en una junta. Si la conversación amerita la sesión, el consultor se la ofrece ahí mismo.</p>
<div class="w-caja"><span class="w-k">El mensaje prellenado cambia en cada paso</span><p>Cuando llega a la bandeja, quien atiende ve <b>de qué correo viene</b> sin preguntar, y el inbox lo etiqueta solo. Un «hola» a secas obliga a reconstruir el contexto y a que el cliente lo explique otra vez — que es justo lo que veníamos a evitarle.</p></div>

<h3>Los tres correos de la sesión no repiten el argumento</h3>
<table class="w-tab"><thead><tr><th>Cuál</th><th>Qué dice distinto</th></tr></thead><tbody>
<tr><td><b>D-60</b></td><td>Pregunta qué le cuesta trabajo. No un error del sistema — eso que resuelve a mano cada semana.</td></tr>
<tr><td><b>D-52</b></td><td>Desde aquí vemos qué módulos usa; lo que <b>no</b> vemos es por qué no usa los otros. Y hay tres razones muy distintas.</td></tr>
<tr><td><b>D-40</b></td><td>Dice para qué la queremos: para saber si le estamos sirviendo. Y ofrece dejar de insistir con un «ahorita no».</td></tr>
</tbody></table>
<p>La sesión es sin costo <b>aunque al final decida no renovar</b>. No es una concesión: una conversación honesta vale igual en los dos casos, y condicionarla a la compra en el momento de decidir es la forma más rápida de que la decisión sea no.</p>

<h3>Cuándo se para</h3>
<table class="w-tab"><thead><tr><th>Sale si…</th><th>Por qué</th></tr></thead><tbody>
<tr><td><b>Renovó</b></td><td>La fecha de próxima factura se movió. Seguir empujando después del pago enseña que le cobraste de más.</td></tr>
<tr><td><b>Respondió</b></td><td>A partir de ahí manda la persona, no la cadencia.</td></tr>
<tr><td><b>Lleva 30+ días sin vender</b></td><td>Ni siquiera entra. «Mira todo lo que lograste» a quien no usó el sistema es sordo — ese va a la cadencia de cuenta dormida.</td></tr>
</tbody></table>`,
  },
  {
    id: 'crecimiento', grupo: 'Después de la venta', titulo: 'Crecimiento · lo que sigue',
    bajada: 'Al cliente que ya opera bien.', chip: { texto: 'lista · falta prenderla', tono: 'ok' },
    cuerpo: `
<p>Veintitrés pasos en cuatro meses para enseñarle a un cliente activo lo que Sacs también puede hacer. <b>107 clientes</b> cumplen hoy la condición de entrada.</p>

<div class="w-caja"><span class="w-k">El tono es la decisión</span><p>No dice «te falta». Dice <b>«ya dominaste esto»</b>. Quien recibe estos correos vende, corta caja y mueve inventario — tratarlo como si le faltara algo insulta el trabajo que sí hizo. Cuando alguien ya domina el día a día, lo que sigue no es aprender el sistema: es <b>qué más se puede quitar de encima</b>.</p></div>

<h3>Las ocho cosas, y por qué canales viaja cada una</h3>
<p>Ninguna va solo por correo. Cada capacidad se cuenta en el correo y se <b>recuerda dentro de Sacs</b> dos o tres días después, cuando el cliente está trabajando — que es donde el argumento se vuelve concreto.</p>
<table class="w-tab"><thead><tr><th>Qué</th><th>Correo</th><th>Dentro de Sacs</th><th>WhatsApp</th></tr></thead><tbody>
<tr><td><b>Axo</b> · el asistente que ejecuta</td><td>día 12</td><td>día 15</td><td>—</td></tr>
<tr><td><b>Empleados</b> · asistencias, contratos, actas, clima</td><td>día 24</td><td>día 27</td><td>—</td></tr>
<tr><td><b>Administración</b> · gastos, cobrar y pagar, bancos</td><td>día 36</td><td>día 39</td><td>—</td></tr>
<tr><td><b>Nivelación</b> · qué mover y qué comprar</td><td>día 48</td><td>día 52</td><td><b>día 50</b></td></tr>
<tr><td><b>Personalizaciones</b> · automatizar un proceso tuyo</td><td>día 60</td><td>día 68</td><td><b>día 66</b></td></tr>
<tr><td><b>El plan que sigue</b> · el escalón completo</td><td>día 84</td><td>día 87</td><td>—</td></tr>
<tr><td><b>Catálogo con IA</b> · modelos y probador virtual</td><td>día 96</td><td>día 99</td><td><b>día 102</b></td></tr>
<tr><td><b>Renta de productos</b> · otro modelo de negocio</td><td>día 108</td><td>día 111</td><td>—</td></tr>
</tbody></table>
<p>Más la apertura (día 1, correo + dentro de Sacs), un WhatsApp a media serie (día 30) y el cierre del día 120, que resume las ocho, pregunta cuál le movió y ofrece dejar de mandarlas si ninguna.</p>

<div class="w-caja"><span class="w-k">Las tres últimas van al final a propósito</span><p>Las cinco primeras son cosas que puede usar <b>con lo que ya paga</b>. Subir de plan, cambiar cómo fotografía su catálogo o abrir un modelo de renta son decisiones más grandes — pedirlas antes de haber demostrado utilidad es pedir demasiado pronto.</p></div>

<h3>El correo del plan lee SU plan</h3>
<p>No manda una tabla comparativa: mira en qué escalón está el cliente y le cuenta el siguiente con <b>tres puntos concretos</b>. La escalera es <code>vende → controla → fideliza → automatiza</code>, y el asunto sale ya resuelto: «<i>Estás en Controla. Esto es lo que trae Fideliza</i>».</p>
<div class="w-caja"><span class="w-k">Y si ya está en el tope, no se manda</span><p>El contexto sale vacío y el paso se salta con motivo. Ofrecerle subir a quien ya está arriba es la forma más rápida de que deje de leerte.</p></div>
<p>Los tres puntos no salen de la descripción del catálogo («todo lo de Controla más…»), que sirve para una página de precios y no para un correo: a un cliente no le mueve una lista de módulos, le mueve saber <b>qué deja de hacer a mano</b>.</p>

<div class="w-caja"><span class="w-k">Por qué el in-app va DESPUÉS del correo, no el mismo día</span><p>Dos o tres días después. El correo cuenta el argumento; el mensaje dentro de Sacs lo encuentra ya trabajando, en la pantalla donde eso le serviría. El mismo día serían dos golpes del mismo mensaje; separados, uno le recuerda al otro.</p>
<p>Y las que MÁS lo necesitan son Empleados y Administración: nadie busca un módulo de recursos humanos dentro de un sistema de punto de venta, así que si no aparece en su pantalla, no se entera de que existe.</p></div>

<div class="w-caja"><span class="w-k">WhatsApp solo cuatro veces en cuatro meses</span><p>Es cliente, no lead. Uno a media serie, uno para nivelación —la que más dinero mueve—, uno para el catálogo con IA y uno al final. Uno por capacidad habría sido demasiado: el canal personal se gasta rápido con quien ya te paga.</p>
<p>El del catálogo con IA se ganó su lugar por una razón: es el que peor se explica por escrito y el único donde el cliente puede <b>mandar una foto suya por el mismo canal y recibirla hecha en minutos</b>. Un WhatsApp que termina en algo que el cliente ve vale más que tres que solo describen.</p></div>

<h3>Siempre las dos opciones</h3>
<p>Cada paso ofrece <b>agendar 45 minutos</b> o <b>escribir por WhatsApp</b>, en ese orden. Quien prefiere hablar agenda; quien prefiere escribir, escribe. Obligar a una sola pierde a la mitad — y de una cadencia de expansión, la mitad que se pierde suele ser la que ya te iba a comprar.</p>
<div class="w-caja"><span class="w-k">Con su propio tipo de reunión</span><p><b>Sesión de crecimiento</b>, 45 minutos, en <code>/agendar/crecimiento</code>. No reusa «consultoría» por dos razones: el nombre es lo primero que ve el cliente en el agendador —y «consultoría» a quien ya paga suena a que algo salió mal—, y en el reporte de reuniones mezclarlas haría imposible saber cuántas sesiones de crecimiento hubo y en qué acabaron.</p>
<p>Hereda dueño y horarios de consultoría: si se copiaran a mano, el día que alguien cambie su disponibilidad este tipo ofrecería horas que ya no existen.</p></div>

<h3>Sin precios, a propósito</h3>
<p>Los correos dicen que son <b>extensiones</b> del plan y que lo que implica cada una se ve por WhatsApp, sobre su caso y su número de sucursales. Se aclara desde el primer correo: si no se dice, el cliente asume que viene incluido y el reclamo llega después.</p>

<h3>Quién entra</h3>
<table class="w-tab"><thead><tr><th>Regla</th><th>Por qué</th></tr></thead><tbody>
<tr><td>Cliente <b>con menos de 15 días sin vender</b></td><td>A quien no está usando el sistema no se le ofrece más sistema. Ese va a la cadencia de cuenta dormida, que es otra conversación.</td></tr>
<tr><td>El arco cuenta desde que <b>entra</b>, no desde que es cliente</td><td>Con la fecha de alta, los clientes actuales aparecerían en su día 500 y recibirían los siete correos de golpe. Así cada uno camina su propio arco.</td></tr>
<tr><td>WhatsApp <b>solo dos veces</b> en 70 días</td><td>Es cliente, no lead. Uno a media serie y otro al final, cuando ya vio todo.</td></tr>
</tbody></table>`,
  },
  {
    id: 'churn', grupo: 'Después de la venta', titulo: 'Churn · rescatar al que canceló',
    bajada: 'El que se fue no se archiva: se trabaja.', chip: { texto: '$38,608 en rescate', tono: 'bad' },
    cuerpo: `
<p>Winback es la <b>cadencia automática</b> que les escribe. Churn es el <b>trabajo a mano</b> sobre cada uno: la sección que vive debajo de Clientes y lleva a un cliente cancelado de vuelta a pagar — o lo cierra con su porqué.</p>

<h3>Las cuatro etapas</h3>
<ul>
<li><b>Detectado.</b> Canceló y nadie lo ha tocado. Entra <b>solo</b>: al cancelarse la suscripción se abre el caso, y un barrido a las 3:30 am recoge lo que se haya escapado por otro camino.</li>
<li><b>En conciliación.</b> Ya estamos hablando: qué pasó de verdad y qué le ofrecemos.</li>
<li><b>En gracia.</b> Usa el sistema bajo un acuerdo. Pactar exige <b>tres datos</b>: qué se pactó, hasta cuándo, y a cuánto vuelve a pagar. Sin los tres el sistema no deja — una gracia sin fecha de fin es un cliente gratis para siempre. Al guardar se le <b>devuelve el acceso en SACS automáticamente</b>.</li>
<li><b>Recuperado.</b> Volvió a pagar. Exige la suscripción nueva que lo respalda: un recuperado que no paga mentiría en la ARR. Al cerrarse, la reactivación entra al ledger de MRR y la ARR lo cuenta sola.</li>
</ul>
<p><b>Irrecuperable</b> cierra desde cualquier etapa, con motivo obligatorio. Es terminal: si el cliente vuelve, se abre un <b>episodio nuevo</b> ligado al anterior — nunca se reabre el viejo, para que la historia no se pise.</p>

<div class="w-caja w-bad"><span class="w-k">Lo que el dato dice y cambia el guion</span>
<p>De los $38,608 de MRR que se fueron, <b>$25,048 (el 65%) fue por mal servicio o soporte</b> y <b>cero por precio</b>. A esta gente no se le rescata con descuento: se le rescata resolviendo lo que quedó mal. Por eso la primera plantilla de gracia es «30 días con soporte dedicado», no un mes gratis.</p></div>

<h3>La columna que de verdad decide</h3>
<p>«Uso del sistema» dice, desde la lista y sin abrir nada, si el cliente está entrando a SACS. Sale del sync nocturno que ya existía. Lo importante no es cuántos días lleva la gracia: es si la está usando. <b>Una gracia de 30 días con el sistema en cero ya fracasó</b>, y el sistema te avisa a los 7 días — no el último.</p>
<p>Cuando la empresa no tiene cuenta ligada, la columna dice «sin cuenta ligada» y no un cero: un cero ahí parecería abandono cuando es falta de dato.</p>

<h3>Los avisos</h3>
<ul>
<li><b>Sin tocar</b> a los 3 días de cancelar — el rescate en frío vale la mitad.</li>
<li><b>Conciliación estancada</b> a los 7 días sin movimiento.</li>
<li><b>Gracia por vencer</b> (7 días antes) y <b>gracia vencida</b>.</li>
<li><b>La gracia no está funcionando</b>: lleva días de gracia y sigue sin vender.</li>
</ul>
<p>Todos caen en el <b>caso exacto</b> al tocarlos, no en la lista.</p>

<div class="w-caja"><span class="w-k">Las fechas con tilde</span>
<p>22 de los 35 casos traen la fecha de cancelación marcada como <b>estimada</b>: vinieron de Excel sin fecha. El promedio de «cuánto tarda un rescate» solo cuenta los que tienen fecha real, y dice sobre cuántos se calculó. Un promedio sobre fechas inventadas sería un número con cara de dato.</p></div>
`,
  },
  {
    id: 'winback', grupo: 'Después de la venta', titulo: 'Winback · los que se fueron',
    bajada: 'Primero escuchar. La oferta va al final.', chip: { texto: 'lista · falta prenderla', tono: 'ok' },
    cuerpo: `
<p>Veinte pasos en 135 días para los <b>24 clientes que se fueron</b>. Quince correos y cinco WhatsApp — y ni un mensaje dentro de Sacs.</p>

<div class="w-caja"><span class="w-k">Por qué no hay in-app aquí</span><p>Un cliente que se fue <b>no entra al sistema</b>. Medido: de los 24, doce llevan más de 90 días sin vender y nueve no tienen ni dato de actividad. Un mensaje dentro de Sacs se quedaría esperando para siempre a alguien que no va a abrir la puerta. Correo y WhatsApp son los únicos canales que llegan.</p></div>

<h3>Cuatro fases, y el orden es todo el diseño</h3>
<table class="w-tab"><thead><tr><th>Fase</th><th>Días</th><th>Qué hace</th></tr></thead><tbody>
<tr><td><b>1 · Escuchar</b></td><td>1 – 25</td><td>No se ofrece <b>nada</b>. Solo la pregunta de qué pasó, y el director pidiendo media hora.</td></tr>
<tr><td><b>2 · Lo que cambió</b></td><td>31 – 73</td><td>Tampoco se pide nada. Se cuenta qué se arregló, incluido lo que estaba mal.</td></tr>
<tr><td><b>3 · La oferta</b></td><td>83 – 130</td><td>El año sin costo, la garantía, y por qué se lo ofrecemos.</td></tr>
<tr><td><b>4 · La puerta</b></td><td>135</td><td>Se cierra bien. Sin última oferta.</td></tr>
</tbody></table>

<div class="w-caja w-bad"><span class="w-k">La oferta NO va en el primer correo</span><p>Mandar un año gratis antes de preguntar qué falló sería el mismo error que los hizo irse: resolver con dinero algo que era de confianza. A quien ya se fue, una oferta desesperada le confirma su decisión.</p>
<p>Por eso los cuatro primeros correos no traen nada y tres <b>ni siquiera llevan botón</b>: el primero solo pide que contesten con una línea. Bajar el umbral hasta ahí es lo único que funciona con alguien que ya no te debe nada.</p></div>

<h3>La oferta, cuando llega</h3>
<p>Un <b>año completo</b> de Sacs sin costo, en el plan más avanzado. No un descuento ni un mes de prueba.</p>
<table class="w-tab"><thead><tr><th>Incluye</th><th>Qué significa</th></tr></thead><tbody>
<tr><td><b>El plan más completo</b></td><td>No una versión recortada.</td></tr>
<tr><td><b>Acompañamiento de arranque</b></td><td>Una persona asignada con nombre, plan por escrito, y nosotros cargamos el catálogo — no una plantilla de Excel para que la llene él.</td></tr>
<tr><td><b>Garantía de implementación</b></td><td>Si no queda operando, no seguimos y no cuesta nada. El punto de «listo» se acuerda ANTES de empezar, no lo definimos al final.</td></tr>
<tr><td><b>Sus datos de vuelta</b></td><td>Donde los dejó.</td></tr>
</tbody></table>

<div class="w-caja"><span class="w-k">El tono es modesto a propósito</span><p>No dice «volvimos mejores»: dice <b>«te fallamos y no preguntamos por qué»</b>. Y el correo 13 llega a decir que la oferta <b>nos conviene</b> —aprender de un cliente que se fue vale más que el año que regalamos— porque fingir generosidad con alguien que ya nos vio fallar es la forma más rápida de perderlo otra vez.</p></div>

<div class="w-caja"><span class="w-k">Los datos son suyos, y se dice sin condiciones</span><p>El correo 9 ofrece <b>exportarle todo</b> aunque nunca vuelva a hablarnos. No es una palanca de negociación, y ponerlo a mitad de la cadencia —antes de la oferta— es lo que lo hace creíble.</p></div>

<h3>Con su propio tipo de reunión</h3>
<p><b>Conversación con dirección</b>, 30 minutos, en <code>/agendar/direccion</code>. El nombre dice quién va a estar del otro lado, que es lo único que la hace distinta: a alguien que ya se fue no lo mueve otra consultoría, lo mueve que quien manda quiera escucharlo.</p>
<p>Media hora y no una: se pide para <b>escuchar</b>, no para presentar. Pedir una hora a quien ya decidió irse manda el mensaje equivocado sobre cuánto vamos a hablar nosotros.</p>
<div class="w-caja"><span class="w-k">Y la minuta es obligatoria</span><p>Aquí más que en ninguna otra reunión: lo que se diga ahí es <b>la única fuente honesta</b> que tenemos de por qué se van los clientes. Si no queda escrito, se pierde.</p></div>

<h3>Cuándo se para</h3>
<p>En cuanto <b>conteste por cualquier canal</b>. Nadie que acaba de decirte por qué se fue debe recibir al día siguiente el correo automático número 6 — a partir de ahí manda la persona.</p>

<div class="w-caja w-bad"><span class="w-k">La regla que casi la deja muda</span><p>Los 24 churned tienen todos <code>estatus_lead = 'descartado'</code>, y el motor <b>expulsa a todo descartado de toda secuencia</b>. Sin arreglarlo, esta cadencia los habría enrolado y sacado en la misma corrida: cero envíos, y en el reporte «graduados: 24» — que se lee como trabajo hecho.</p>
<p>Peor: el <b>diagnóstico de secuencias no lo habría detectado</b>, porque revisa las reglas de ENTRADA y esta es de SALIDA. Habría dicho «entra: sí» mientras el contacto no recibía nada.</p>
<p>Se resolvió con una lista por secuencia de motivos de salida que no aplican — no con un interruptor global: la regla sigue valiendo para las otras siete, donde un descartado sí debe salir. Aquí «descartado» no es una decisión sobre ese contacto, es su estado normal.</p></div>`,
  },
  {
    id: 'revocar', grupo: 'Después de la venta', titulo: 'Revocar una cuenta',
    bajada: 'Apagarle el acceso sin salir del CRM.', chip: { texto: 'nueva', tono: 'ok' },
    cuerpo: `
<p>Antes esto se hacía en <i>sacs3 ▸ Configuración ▸ Cuentas</i>: otro sistema, otra sesión, y buscar la cuenta entre 560. Quien está cobrando tiene el hilo de WhatsApp abierto delante y la ficha al lado — ese es el momento de apretar el botón, no quince minutos después en otra pestaña.</p>
<p>Ahora la tarjeta <b>Cuenta de SACS</b> aparece en <b>la ficha del lead o cliente</b> (pestaña Seguimiento) y en <b>el inbox</b> (panel de detalle ▸ Acciones). Es la misma tarjeta en los dos lados a propósito: tenerla dos veces garantizaba que un día dijeran cosas distintas de la misma cuenta.</p>

<div class="w-caja"><span class="w-k">Es la MISMA operación, no una paralela</span><p>Mismo motor del lado de SACS, mismos textos, mismo candado en la lista de cuentas y misma bitácora. Lo único que cambia es desde dónde se dispara — y que en la bitácora queda <b>tu correo</b>, no «el sistema».</p></div>

<h3>Los tres motivos</h3>
<table class="w-tab"><thead><tr><th>Motivo</th><th>Qué ve el cliente</th></tr></thead><tbody>
<tr><td><b>Falta de pago</b></td><td>El adeudo y los datos para depositar. <b>Pide el monto</b>: un aviso que dice «no especificado» le quita toda la fuerza al mensaje.</td></tr>
<tr><td><b>Se acabó la prueba</b></td><td>La invitación a contratar, con botón de WhatsApp y link a planes. Es el que pone el cron cuando vence una prueba.</td></tr>
<tr><td><b>Violación de términos</b></td><td>El aviso legal, sin datos de pago.</td></tr>
</tbody></table>
<p>Los textos exactos <b>no se escriben en el CRM</b>: salen de la configuración central de SACS. Si mañana se cambian allá, cambian aquí.</p>

<h3>Qué le pasa al cliente</h3>
<p>Al entrar le sale un <b>aviso a pantalla completa</b>, con el fondo difuminado, encima de todo. No es un banner que se cierra: no tiene forma de quitarlo, y el único botón es <b>cerrar sesión</b>. Vive en el armazón de sacs3, así que da igual a qué módulo intente entrar o si abre un link directo — el aviso está ahí.</p>

<div class="w-caja w-bad"><span class="w-k">El candado es de la web, no del sistema entero</span><p>Verificado, no supuesto: <b>la API no valida el bloqueo en ninguna ruta</b> y <b>la app móvil no lo mira</b>. Quien tenga la APK abierta puede seguir vendiendo con la cuenta revocada.</p>
<p>Para cobrar funciona —el dueño usa la web y ahí se topa de frente con el aviso—, pero no des por hecho que la operación se detuvo. Si el caso es grave, revócala <b>y</b> avisa.</p></div>

<div class="w-caja"><span class="w-k">Y no es retroactivo en la sesión abierta</span><p>El aviso se consulta al entrar. Quien ya tenga sacs3 abierto lo verá cuando recargue, no en el segundo en que aprietas el botón.</p></div>

<h3>Reabrir</h3>
<p>El mismo botón, en verde. Le quita el aviso y limpia los datos del bloqueo anterior — importante, porque si no, el adeudo viejo reaparecería la próxima vez que se apague por otro motivo.</p>

<div class="w-caja"><span class="w-k">Si dice «no se pudo consultar»</span><p>La tarjeta lee el estado de SACS cada vez que se abre; no lo recuerda. Si la consulta falla, lo dice y <b>esconde los botones</b> en vez de suponer «activa». Apretar a ciegas puede reabrirle la cuenta a quien la tenías apagada por términos.</p></div>

<h3>Todo queda escrito</h3>
<p>Cada revocación y cada reapertura deja una actividad en la ficha con tu nombre — y como el inbox pinta esa misma línea de tiempo, quien atienda la conversación después ve por qué está apagada sin preguntar. Del lado de SACS queda además en su bitácora.</p>`,
  },
  /* ══════════════════════ SECCIÓN CONSULTORES ══════════════════════
     El marco de colaboración puesto en operación. Una página por pregunta: si
     alguien tiene que hacer scroll dos pantallas para saber cuándo le pagan,
     la página está mal partida. El documento firmado vive en
     code.sacscloud.com/colaboracion/ y ante cualquier diferencia, manda él. */
  {
    id: 'c-acuerdo', seccion: 'consultores', grupo: 'El acuerdo', titulo: 'Cómo funciona el acuerdo',
    bajada: 'El mapa completo en dos minutos, antes de entrar al detalle.',
    cuerpo: `
<p>El acuerdo se apoya en <b>una idea</b>: se paga por sostener y hacer crecer clientes, no por haberlos cerrado una vez. Todo lo demás sale de ahí.</p>
<div class="w-caja"><span class="w-k">La regla que gobierna todo</span>
<p><b>La tasa es del CLIENTE, no del primer año.</b> Cada cuenta entra con un porcentaje según de dónde salió, y lo conserva en todas sus renovaciones mientras se cumplan las tres condiciones.</p></div>
<h3>Las tres partes</h3>
<table class="w-tab"><thead><tr><th>Parte</th><th>De qué trata</th><th>Dónde leerlo</th></tr></thead><tbody>
<tr><td><b>Compensación</b></td><td>Qué paga cada concepto, sobre qué base se calcula y cuándo cae el dinero.</td><td>Las 5 páginas de <i>Compensación</i></td></tr>
<tr><td><b>Responsabilidades</b></td><td>Qué le toca al consultor y qué le toca a Sacs, separado por tipo de actividad.</td><td>Las 3 páginas de <i>Responsabilidades</i></td></tr>
<tr><td><b>Medición y reuniones</b></td><td>Con qué número se comprueba cada compromiso, y en qué junta se revisa.</td><td>Las 2 páginas de <i>Medición y reuniones</i></td></tr>
</tbody></table>
<h3>Las dos actividades</h3>
<p>El acuerdo no trata igual todo el trabajo. Se divide en dos actividades con obligaciones propias de los dos lados:</p>
<ul>
<li><b>Cuentas activas asignadas</b> — sostener y expandir clientes que ya existen. Es lo que produce el ingreso recurrente.</li>
<li><b>Leads de campañas</b> — atender los prospectos que Sacs compra con publicidad. Es donde el tiempo de respuesta lo decide todo.</li>
</ul>
<div class="w-caja w-ok"><span class="w-k">Los tres principios que resuelven las dudas</span>
<p><b>1. Se comisiona dinero cobrado</b>, no facturado ni prometido.</p>
<p><b>2. Lo pagado no se recalcula.</b> Cambiar el modelo no reescribe la historia.</p>
<p><b>3. Ante un dato que falta, no se castiga.</b> Si nadie evaluó una cuenta, esa cuenta paga completo.</p></div>`,
  },
  {
    id: 'c-tasas', seccion: 'consultores', grupo: 'Compensación', titulo: 'Las tasas',
    bajada: 'Qué porcentaje paga cada concepto, según de dónde salió el cliente.',
    cuerpo: `
<table class="w-tab"><thead><tr><th>Concepto</th><th>Lead de Sacs</th><th>Referido</th><th>Recuperada</th><th>Ya era cliente</th></tr></thead><tbody>
<tr><td><b>Licencia</b><br><span class="w-mut">primer año y renovaciones</span></td><td>35%</td><td>55%</td><td>70%</td><td>30%</td></tr>
<tr><td><b>Plugins</b></td><td>30%</td><td>55%</td><td>70%</td><td>30%</td></tr>
<tr><td><b>Personalización</b></td><td colspan="4">20% · igual para todo origen</td></tr>
<tr><td><b>Servicios de arranque</b><br><span class="w-mut">implementación, capacitación, migración</span></td><td colspan="4">35% · igual para todo origen</td></tr>
</tbody></table>
<h3>Qué significa cada origen</h3>
<table class="w-tab"><thead><tr><th>Origen</th><th>Cuándo aplica</th></tr></thead><tbody>
<tr><td><b>Lead de Sacs</b></td><td>Llegó por los canales de marketing de la empresa y el consultor lo trabajó y cerró.</td></tr>
<tr><td><b>Referido</b></td><td>Llegó FUERA de esos canales: lo refirió otro cliente o vino por prospección propia. Se hicieron las dos mitades del trabajo.</td></tr>
<tr><td><b>Recuperada</b></td><td>Había dejado de usar el sistema y se logró reactivar. Es el trabajo más difícil que existe en ventas.</td></tr>
<tr><td><b>Ya era cliente</b></td><td>Cuenta preexistente de Sacs que el consultor empieza a atender. No hubo captación, pero sí trabajo de sostenerla.</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Por qué la personalización paga menos</span>
<p>El grueso de ese monto se va en horas del equipo de desarrollo, no en captación. Se paga el trabajo de vender, no el de construir. Por eso su tasa no depende del origen.</p></div>
<h3>Conceptos extraordinarios</h3>
<table class="w-tab"><thead><tr><th>Concepto</th><th>Tasa</th><th>Detalle</th></tr></thead><tbody>
<tr><td>Suscripción al canal de partners</td><td><b>35%</b></td><td>Alta y renovaciones de lo que paga cada partner por pertenecer al canal.</td></tr>
<tr><td>Ventas de un partner reclutado</td><td><b>10%</b></td><td>Adicional, a cargo de Sacs. <b>No</b> se le descuenta al partner.</td></tr>
<tr><td>Venta del CRM</td><td><b>90%</b></td><td>El 10% restante va a mantenimiento y servidores del portal.</td></tr>
<tr><td>Consultoría propia</td><td><b>100%</b></td><td>Sacs no retiene nada. Los viáticos corren por cuenta del consultor.</td></tr>
</tbody></table>
<div class="w-caja w-warn"><span class="w-k">De quién es cada cuenta</span>
<p>El origen se fija <b>una sola vez</b>, al registrar al cliente, y <b>el CRM es la única fuente de verdad</b>. Un prospecto sin registrar previo se clasifica como lead de Sacs (35%), y eso no admite corrección después.</p>
<p>Entre 35% y 55% hay veinte puntos: registrar toma un minuto y vale esa diferencia.</p></div>`,
  },
  {
    id: 'c-calculo', seccion: 'consultores', grupo: 'Compensación', titulo: 'Cómo se calcula un pago',
    bajada: 'La cadena completa, en el orden en que se explica ante un reclamo.',
    cuerpo: `
<p>Siempre el mismo orden, y <b>nunca sobre el monto bruto</b>:</p>
<div class="w-caja"><span class="w-k">Los cuatro pasos</span>
<p><b>1.</b> Se parte del monto <b>cobrado</b> al cliente. No lo facturado ni lo prometido: lo que entró.</p>
<p><b>2.</b> Se descuenta según la cuenta donde cayó: <b>16%</b> si fue la corporativa (IVA que se entera al SAT) o <b>6%</b> si fue la pagadora (costo de dispersión).</p>
<p><b>3.</b> Sobre <b>esa base</b> se aplica el porcentaje del cliente.</p>
<p><b>4.</b> Si la venta se cerró con más de 35% de descuento, el excedente se resta de la comisión.</p></div>
<div class="w-caja w-ok"><span class="w-k">Ejemplo</span>
<p>Licencia de <b>$50,000</b> en un cliente referido (55%), cobrada en la cuenta corporativa:</p>
<p>$50,000 − 16% = <b>$42,000</b> de base · × 55% = <b>$23,100</b> de comisión.</p></div>
<h3>Dónde se ve el desglose</h3>
<p>En <b>Comisiones → Periodo</b>, cada línea escribe su propia aritmética debajo del concepto. Cuando alguien reclama, la respuesta está en la fila y no hay que reconstruirla.</p>
<div class="w-caja"><span class="w-k">Qué dice una línea</span>
<p><code>$65,000 cobrado · −16% IVA = $54,600 · × 55% = $30,030</code></p></div>
<h3>Cuando algo no cuadra</h3>
<ul>
<li><b>Comisión en cero con distintivo ámbar</b> — el SKU vendido no tiene tarifa configurada en el modelo. No es un error del cálculo: es un hueco de configuración, y por eso se ve en vez de esconderse.</li>
<li><b>«Sin SKU»</b> — la suscripción no tiene producto asignado, así que no hay a qué colgarle un porcentaje. Se asigna a mano en la suscripción.</li>
<li><b>Distintivo «Tasa reducida»</b> — esa renovación no cumplió una de las tres condiciones. La línea dice cuál.</li>
</ul>`,
  },
  {
    id: 'c-cobro', seccion: 'consultores', grupo: 'Compensación', titulo: 'Cuándo y cómo se paga',
    bajada: 'Los tiempos, los cortes y qué pasa si el dinero se va para atrás.',
    cuerpo: `
<h3>Los tiempos</h3>
<ul>
<li><b>1 o 2 días hábiles</b> desde que el cliente paga. El reloj no arranca al firmar ni al facturar: arranca cuando el dinero entra.</li>
<li>Si el cliente paga en parcialidades, se comisiona <b>cada parcialidad</b> conforme se cobra.</li>
<li>Los clientes con pago mensual generan comisión <b>cada mes que pagan</b>.</li>
<li>Los pagos chicos —bugs, mejoras, reseñas— se acumulan y se liquidan en <b>corte quincenal</b>.</li>
</ul>
<h3>El estado de cuenta</h3>
<p>Cada quincena llega el detalle: qué se cobró, de qué cliente, a qué tasa, con qué descuentos y qué ajustes. Es el documento con el que se revisa un pago, y sale de <b>Comisiones → Periodo</b>.</p>
<h3>Si el dinero se va para atrás</h3>
<div class="w-caja w-warn"><span class="w-k">Cancelación, reembolso o pago rebotado</span>
<p>La comisión correspondiente <b>se descuenta del siguiente corte</b>. <b>Nunca</b> se pide devolver efectivo.</p>
<p>Es la contraparte de que se pague en dos días sin esperar a ver si el cliente se queda: el pago es rápido porque el ajuste es posible.</p></div>
<div class="w-caja"><span class="w-k">Si ya se había pagado</span>
<p>Una comisión ya liquidada <b>no se borra</b> —el dinero ya salió—: aparece como <i>ajuste pendiente</i> y se resta del corte siguiente. El sistema lo reporta solo en el recálculo de cada madrugada.</p></div>
<h3>Los estados de una línea</h3>
<table class="w-tab"><thead><tr><th>Estado</th><th>Qué significa</th></tr></thead><tbody>
<tr><td><b>Calculada</b></td><td>El sistema la generó. Se recalcula cada noche si algo cambia.</td></tr>
<tr><td><b>Aprobada</b></td><td>Revisada y lista para pagar. Todavía se recalcula.</td></tr>
<tr><td><b>Pagada</b></td><td>Liquidada. <b>Nunca se vuelve a recalcular</b>: la historia no se reescribe.</td></tr>
<tr><td><b>Cancelada</b></td><td>Anulada a mano. No suma y el recálculo no la revive.</td></tr>
</tbody></table>`,
  },
  {
    id: 'c-descuentos', seccion: 'consultores', grupo: 'Compensación', titulo: 'Descuentos y su tope',
    bajada: 'Hasta dónde se puede negociar sin costo, y qué pasa después.',
    cuerpo: `
<ul>
<li>Hasta <b>35%</b> sobre el precio de lista, <b>sin pedir permiso</b>. Es margen propio para cerrar.</li>
<li>Arriba de 35% se puede dar, pero el excedente <b>sale de la comisión de esa venta</b>.</li>
<li>Solo aplica a <b>licencia anual y personalización</b>. Plugins y servicios de arranque van a precio de lista.</li>
<li>El precio de lista es el <b>publicado en el sitio web</b> al momento de la venta.</li>
</ul>
<div class="w-caja w-ok"><span class="w-k">Cómo se calcula el excedente</span>
<p>Lista <b>$100,000</b> cerrada al <b>40%</b>: el cliente paga $60,000 y los <b>$5,000</b> del 5% extra salen de la comisión.</p>
<p>La fórmula es <code>cobrado × (descuento − 35) ÷ (100 − descuento)</code>, expresada contra lo cobrado y no contra el precio de lista, para que funcione igual si el cliente paga en parcialidades.</p></div>
<div class="w-caja w-warn"><span class="w-k">El tiempo gratis va aparte</span>
<p>Los meses de uso gratuito que se ofrecen para rescatar una cuenta <b>no cuentan</b> contra este 35%: se negocian caso por caso y los autoriza Sacs. Es la puerta trasera del descuento, y por eso está dicho.</p></div>
<div class="w-caja"><span class="w-k">La decisión es del consultor, y es legítima</span>
<p>A veces vale la pena ceder cinco mil para no perder un cliente de sesenta. El acuerdo no lo prohíbe: solo dice quién lo paga.</p></div>`,
  },
  {
    id: 'c-condiciones', seccion: 'consultores', grupo: 'Compensación', titulo: 'Las tres condiciones de la renovación',
    bajada: 'Lo que hay que cumplir para que una renovación pague la tasa completa.',
    cuerpo: `
<p>La tasa de un cliente es <b>de por vida</b>, pero no es automática: se revalida en cada renovación. Hay que cumplir <b>las tres</b>.</p>
<table class="w-tab"><thead><tr><th></th><th>Condición</th><th>La vara</th></tr></thead><tbody>
<tr><td><b>A</b></td><td><b>Seguimiento real</b></td><td>Contacto y acompañamiento durante el año, reflejados en el CRM. No basta con aparecer al momento de renovar.</td></tr>
<tr><td><b>B</b></td><td><b>Expansión del 30%</b></td><td>Venderle al año al menos el <b>30% de su plan anual vigente</b> en vitalicias, plugins o servicios. La renovación de la licencia <b>no cuenta</b>.</td></tr>
<tr><td><b>C</b></td><td><b>Cobranza puntual</b></td><td>La anualidad se cobra <b>antes del vencimiento, el mismo día, o máximo 5 días naturales después</b>.</td></tr>
</tbody></table>
<div class="w-caja w-ok"><span class="w-k">Ejemplo de la condición B</span>
<p>Cliente con plan anual de <b>$60,000</b>: hay que venderle al menos <b>$18,000</b> en vitalicias, plugins o servicios durante el año.</p>
<p>Se mide contra el plan <b>vigente</b> y no contra el histórico acumulado: una cuenta vieja no se vuelve imposible de cumplir solo por llevar años comprando.</p></div>
<div class="w-caja w-ok"><span class="w-k">Ejemplo de la condición C</span>
<p>Anualidad que vence el <b>25 de julio</b>. Cobrada el 20 o el 25: a tiempo. Cobrada el 30: dentro del margen. Cobrada el 10 de agosto: fuera de tiempo.</p>
<p>Se mide <b>por anualidad</b>, no por año: una cuenta puede ir bien y aun así haber cobrado tarde una renovación concreta. Solo esa se ve afectada.</p></div>
<h3>Si no se cumplen</h3>
<ul>
<li>Esa renovación se comisiona al <b>15%</b>, cualquiera que sea la tasa del cliente.</li>
<li><b>La cuenta no se pierde.</b> La tasa completa vuelve en la siguiente renovación que sí cumpla.</li>
<li>Aplica a toda renovación, sin excepción por tasa.</li>
</ul>
<div class="w-caja w-bad"><span class="w-k">Sin evaluar no se castiga</span>
<p>La condición B se calcula sola y la C sale de la fecha del pago, pero <b>la A la marca una persona</b>. Si nadie la marcó, la cuenta <b>paga completo</b>.</p>
<p>Bajar una comisión por un dato que nadie capturó es peor que no tener la regla: cobra de menos por un descuido administrativo y nadie se entera hasta el reclamo.</p></div>
<p class="w-mut">Se revisa en <b>Comisiones → Renovaciones</b>.</p>`,
  },
  {
    id: 'c-act1', seccion: 'consultores', grupo: 'Responsabilidades', titulo: 'Actividad 1 · Cuentas asignadas',
    bajada: 'Sostener y expandir un cliente que ya existe. Es lo que produce el ingreso recurrente.',
    cuerpo: `
<h3>Lo que pone Sacs</h3>
<ul>
<li><b>La cuenta asignada y registrada</b> en el CRM, con su consultor y su origen.</li>
<li><b>El contexto completo</b>: qué plan tiene, qué módulos usa, su historial de pagos, sus tickets y su situación de cobranza. <b>No se debe reconstruir preguntando.</b></li>
<li><b>El sistema de seguimiento</b>: dónde registrar cada sesión, cada acuerdo y cada oportunidad.</li>
<li><b>La medición trimestral</b> de uso y de ventas, tomada del propio sistema.</li>
</ul>
<h3>Lo que le toca al consultor</h3>
<table class="w-tab"><thead><tr><th>Compromiso</th><th>Qué significa en concreto</th></tr></thead><tbody>
<tr><td><b>Presentarse antes de la renovación</b></td><td>No el mes del vencimiento: con tiempo para trabajar la cuenta. Al cliente le tiene que quedar claro que el consultor es su <b>punto de contacto</b> para cualquier tema de flujo de trabajo.</td></tr>
<tr><td><b>Conocer la cuenta antes de sentarse</b></td><td>Qué uso le da al sistema, qué plan tiene, qué módulos toca y cuáles no. Llegar a preguntar lo que el CRM ya dice es tiempo del cliente.</td></tr>
<tr><td><b>Una sesión cada dos semanas</b></td><td>Mínimo, por WhatsApp o videollamada, por cada cuenta asignada. Queda registrada.</td></tr>
<tr><td><b>Que el uso crezca</b></td><td>Y que se pueda comprobar: se compara el trimestre contra el anterior. Que el cliente use más el sistema es <b>la evidencia de que el trabajo ocurrió</b>.</td></tr>
<tr><td><b>Expandir la cuenta un 30%</b></td><td>Del plan anual vigente, en vitalicias, plugins o servicios.</td></tr>
<tr><td><b>Que lo vendido se use</b></td><td>Un plugin contratado y nunca abierto no expandió nada: es una baja esperando su fecha.</td></tr>
<tr><td><b>Cobrar la anualidad</b></td><td>O empujar activamente a que el cliente pague, dentro del margen de 5 días.</td></tr>
</tbody></table>
<div class="w-caja w-warn"><span class="w-k">La revisión trimestral, y cómo se pierde una cuenta</span>
<p>Cada <b>3 meses</b> se revisa contra dos preguntas: <b>¿creció en uso? ¿creció en ventas?</b></p>
<p><b>Dos revisiones seguidas sin cumplir y la cuenta se retira.</b> Desde ese momento deja de generar comisión; se liquidan los pagos ya cobrados y la cuenta se reasigna.</p>
<p>Una sola revisión floja <b>no</b> cuesta la cuenta. Es a propósito: da margen para corregir el trimestre siguiente.</p></div>`,
  },
  {
    id: 'c-act2', seccion: 'consultores', grupo: 'Responsabilidades', titulo: 'Actividad 2 · Leads de campañas',
    bajada: 'Sacs compra el prospecto. Lo que pasa en las horas siguientes decide si se convierte o se tira.',
    cuerpo: `
<h3>Qué cuenta como lead comprometido</h3>
<div class="w-caja"><span class="w-k">Las tres condiciones, juntas</span>
<p>Pertenece al <b>nicho de Sacscloud</b> · <b>manifiesta querer contratar</b> · opera <b>entre 1 y 50 sucursales</b>.</p>
<p>Un contacto que no las cumple <b>no cuenta</b> contra el compromiso mensual de Sacs, y tampoco cuenta en contra del consultor si no prospera.</p></div>
<h3>Lo que pone Sacs</h3>
<ul>
<li><b>Las campañas y su presupuesto.</b></li>
<li><b>30 leads calificados al mes</b> del perfil de arriba, entregados en el CRM con su origen y su campaña.</li>
<li><b>La atención inicial por IA</b>, que responde las dudas de entrada y ordena al prospecto. <b>Filtra y agenda; no vende.</b></li>
<li><b>Ajustar la estrategia</b> con lo que salga de las reuniones de campañas.</li>
</ul>
<h3>Lo que le toca al consultor</h3>
<table class="w-tab"><thead><tr><th>Compromiso</th><th>Qué significa en concreto</th></tr></thead><tbody>
<tr><td><b>Una llamada en 24 horas</b></td><td>Horas <b>naturales</b>, no hábiles: un lead que entra el viernes se llama el sábado. Hasta <b>3 intentos registrados</b> en canales distintos. <b>No es «contactar»: es llamar.</b></td></tr>
<tr><td><b>Calificar según interés real</b></td><td>No según lo que convenga al embudo. Un lead marcado como caliente sin serlo desvía la campaña siguiente hacia el público equivocado.</td></tr>
<tr><td><b>Calificar los descartados</b></td><td>Con su motivo. Un descarte razonado le sirve a la campaña; uno abandonado sin calificar no le sirve a nadie y se paga igual.</td></tr>
<tr><td><b>Entrar donde la IA no llega</b></td><td>Cuando el prospecto pregunta algo de fondo que la automatización no resuelve, la explicación la da el consultor. <b>Ahí es donde un lead deja de ser un formulario.</b></td></tr>
<tr><td><b>Atender las reuniones</b></td><td>En tiempo y forma. Una reunión a la que no se llega quema un lead pagado y no se recupera.</td></tr>
</tbody></table>
<h3>El compromiso de volumen</h3>
<div class="w-caja"><span class="w-k">30 al mes, mientras vendan</span>
<p>Los 30 se sostienen mientras cada camada produzca al menos <b>$100,000 en ventas</b>, medidos <b>a los 90 días</b> de entregada.</p>
<p>Los 30 de enero se evalúan al <b>30 de abril</b>. Se mide por camada y no por mes calendario porque una venta B2B rara vez cierra en el mes en que entró el prospecto: medirlo así haría fallar el compromiso siempre, aunque todo estuviera bien.</p></div>
<div class="w-caja w-ok"><span class="w-k">Si una camada no llega</span>
<p><b>El envío se mantiene.</b> Se analiza en la revisión: si el problema estuvo en la campaña lo corrige Sacs, si estuvo en el seguimiento lo corrige el consultor. El compromiso no se corta al primer tropiezo.</p></div>
<div class="w-caja w-bad"><span class="w-k">Si los leads se apilan sin trabajar</span>
<p>Sacs <b>deja de asignar leads</b> hasta ponerse al corriente. No es una sanción: es dejar de gastar en prospectos que no se están atendiendo.</p></div>
<p class="w-mut">El volumen <b>crece</b> cuando los números lo justifican, y se acuerda en el corte de cada 4 meses. La condición para subir de 30 es sencilla: <b>comprobar que se vende</b>.</p>`,
  },
  {
    id: 'c-sacs', seccion: 'consultores', grupo: 'Responsabilidades', titulo: 'Lo que Sacs debe cumplir',
    bajada: 'La contraparte. Cada obligación del consultor solo funciona si esto se cumple.',
    cuerpo: `
<p>Cada cláusula del acuerdo le exige algo al consultor. Estas son las obligaciones que Sacs asume para que eso sea posible.</p>
<table class="w-tab"><thead><tr><th>Obligación</th><th>Plazo</th><th>Detalle</th></tr></thead><tbody>
<tr><td><b>El CRM y los accesos</b></td><td>Continuo</td><td>Operando, con lo necesario para trabajar y registrar.</td></tr>
<tr><td><b>El proceso, por escrito</b></td><td>Antes de exigir</td><td>Venta, renovación y cada concepto que se comisiona. <b>Si algo no tiene proceso claro, Sacs lo documenta antes de exigir resultados sobre él.</b></td></tr>
<tr><td><b>Que la tecnología cumpla</b></td><td>Continuo</td><td>El sistema hace aquello por lo que se vendió. Cuando no, corregirlo es de Sacs y <b>no consume tiempo ni comisión</b> del consultor.</td></tr>
<tr><td><b>Entregar en fecha</b></td><td>El día estipulado <b>o antes</b></td><td>Nunca después. Si una fecha va a moverse, se avisa <b>antes</b> de que llegue, no el mismo día.</td></tr>
<tr><td><b>Video de cada entrega</b></td><td>Con la entrega</td><td>Mostrándolo funcionando y abierto a retroalimentación. <b>Nada se da por entregado solo porque esté liberado.</b></td></tr>
<tr><td><b>Cuatro reuniones al mes</b></td><td>Mensual</td><td>Capacitación, dudas, revisión de cuentas. Las convoca Sacs.</td></tr>
<tr><td><b>Precios vigentes</b></td><td>Aviso previo</td><td>Por escrito <b>antes</b> de cualquier cambio de lista: el margen de descuento se mide contra ese precio.</td></tr>
<tr><td><b>Confirmar lo que no se puede prometer solo</b></td><td><b>2 días hábiles</b></td><td>Fechas de desarrollo, funciones que no existen, alcances de personalización. Sin esa respuesta el consultor no puede cerrar.</td></tr>
<tr><td><b>Dictaminar fallas y mejoras</b></td><td><b>5 días hábiles</b></td><td>Un reporte sin dictamen no se paga nunca, así que el plazo es parte del programa.</td></tr>
<tr><td><b>El soporte técnico</b></td><td>Continuo</td><td>Atendido <b>por el chat</b>, y el cliente tiene que sentirlo así. Ver la caja de abajo.</td></tr>
<tr><td><b>Visibilidad de vencimientos</b></td><td>Continuo</td><td>Qué anualidades vencen y cuáles están impagas, con anticipación para gestionarlas.</td></tr>
<tr><td><b>Respetar la atribución</b></td><td>Continuo</td><td>Una cuenta asignada no se reasigna ni se trabaja por fuera sin avisar primero.</td></tr>
<tr><td><b>Pagar y rendir cuentas</b></td><td>1-2 días · quincenal</td><td>El pago en 1 o 2 días hábiles y el estado de cuenta cada quincena.</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">El soporte, y por qué importa tanto</span>
<p>Sacs se encarga de que cada cliente <b>conozca el canal, se sienta cómodo usándolo y reciba respuesta clara</b>. El propósito es que lo que el consultor trabaja junto al cliente sea <b>consultoría pura</b>, no soporte.</p>
<p>Si una cuenta empieza a llevarle fallas técnicas al consultor en vez de al chat, <b>eso no es carga de él</b>: es señal de que el canal de soporte no está cumpliendo, y corregirlo es de Sacs.</p></div>`,
  },
  {
    id: 'c-medicion', seccion: 'consultores', grupo: 'Medición y reuniones', titulo: 'Cómo se mide todo',
    bajada: 'Cada compromiso con su número y el lugar del CRM donde se ve.',
    cuerpo: `
<p>Sin una vara, un compromiso es una intención. Cada renglón dice <b>dónde se ve el número</b> que lo comprueba.</p>
<h3>Cuentas asignadas</h3>
<table class="w-tab"><thead><tr><th>Compromiso</th><th>De quién</th><th>Cómo se mide</th><th>Dónde se ve</th></tr></thead><tbody>
<tr><td>Cuenta asignada con su origen</td><td><b>Sacs</b></td><td>% de cuentas con consultor y origen</td><td>Comisiones → Atribución</td></tr>
<tr><td>Contexto completo de la cuenta</td><td><b>Sacs</b></td><td>Plan, módulos, pagos, tickets y cobranza en la ficha</td><td>Clientes → ficha 360</td></tr>
<tr><td>Presentarse antes de la renovación</td><td>Consultor</td><td>Primer contacto vs. fecha de vencimiento</td><td>Clientes → actividades</td></tr>
<tr><td>Sesión cada dos semanas</td><td>Consultor</td><td>Sesiones registradas ÷ semanas del periodo</td><td><span class="w-mut">falta instrumentar</span></td></tr>
<tr><td>Que el uso crezca</td><td>Consultor</td><td>Uso del trimestre contra el anterior</td><td>Clientes → uso · snapshots</td></tr>
<tr><td>Expandir 30% del plan anual</td><td>Consultor</td><td>Vitalicias + plugins + servicios ÷ plan anual</td><td>Comisiones → Renovaciones</td></tr>
<tr><td>Que lo vendido se use</td><td>Consultor</td><td>Módulos contratados que registran actividad</td><td>Clientes → uso</td></tr>
<tr><td>Cobrar a tiempo</td><td>Consultor</td><td>Días entre vencimiento y cobro, contra el margen de 5</td><td>Comisiones → Periodo</td></tr>
</tbody></table>
<h3>Leads de campañas</h3>
<table class="w-tab"><thead><tr><th>Compromiso</th><th>De quién</th><th>Cómo se mide</th><th>Dónde se ve</th></tr></thead><tbody>
<tr><td>30 leads al mes del perfil</td><td><b>Sacs</b></td><td>Leads del mes que cumplen las tres condiciones</td><td>Leads → origen campaña</td></tr>
<tr><td>Atención inicial por IA</td><td><b>Sacs</b></td><td>Leads con primera respuesta automática</td><td>Conversaciones</td></tr>
<tr><td>Llamada en 24 horas</td><td>Consultor</td><td>Primera llamada vs. alta del lead</td><td><span class="w-mut">falta instrumentar</span></td></tr>
<tr><td>Calificar según interés real</td><td>Consultor</td><td>% de leads calificados / sin calificar</td><td>Leads → estatus</td></tr>
<tr><td>Descartados con motivo</td><td>Consultor</td><td>% de descartados que traen motivo</td><td>Leads → motivos</td></tr>
<tr><td>Atender las reuniones</td><td>Consultor</td><td>Reuniones atendidas ÷ agendadas</td><td>Reuniones</td></tr>
<tr><td>$100,000 por camada a 90 días</td><td><b>Ambos</b></td><td>Ventas cerradas de esa camada al día 90</td><td>Corte cuatrimestral</td></tr>
</tbody></table>
<h3>Obligaciones de Sacs</h3>
<table class="w-tab"><thead><tr><th>Compromiso</th><th>Cómo se mide</th><th>Dónde se ve</th></tr></thead><tbody>
<tr><td>Entregar en fecha</td><td>Fecha de entrega vs. fecha de compromiso</td><td>Consultoría → mejoras</td></tr>
<tr><td>Video con cada entrega</td><td>Entregas que traen video</td><td>Consultoría → mejoras</td></tr>
<tr><td>Confirmar en 2 días hábiles</td><td>Fecha de la pregunta vs. la respuesta</td><td>Canal del proyecto</td></tr>
<tr><td>Dictaminar en 5 días hábiles</td><td>Fecha del reporte vs. el dictamen</td><td>Consultoría → mejoras</td></tr>
<tr><td>Soporte por el chat</td><td>Tickets resueltos sin pasar por el consultor</td><td>Soporte</td></tr>
<tr><td>Pagar en 1-2 días</td><td>Días entre el cobro y el pago de la comisión</td><td>Comisiones → Periodo</td></tr>
</tbody></table>
<div class="w-caja w-ok"><span class="w-k">Cómo va Sacs hoy en entregas</span>
<p>De <b>22 mejoras entregadas</b> con fecha de compromiso registrada, <b>8 salieron a tiempo</b>. Es el primer número que este acuerdo pone bajo la lupa, y el que la reunión semanal debería mover.</p></div>
<div class="w-caja w-bad"><span class="w-k">Lo que todavía NO se mide solo</span>
<p>Dos compromisos no tienen dónde registrarse: <b>la sesión cada dos semanas</b> y <b>la llamada en 24 horas</b>. El CRM guarda actividades de WhatsApp, tickets y cambios de estatus, pero <b>no tiene un tipo de actividad para «llamada» ni para «sesión»</b>.</p>
<p>Mientras no se instrumente, esos dos se revisan a mano en la reunión. Vale más decirlo que fingir que hay un número detrás.</p></div>`,
  },
  {
    id: 'c-reuniones', seccion: 'consultores', grupo: 'Medición y reuniones', titulo: 'Las reuniones',
    bajada: 'Tres ritmos distintos. Cada uno asegura una parte del acuerdo.',
    cuerpo: `
<p>El acuerdo se sostiene en tres reuniones con propósitos que <b>no se mezclan</b>. Confundirlas es la forma más rápida de que ninguna sirva: la semanal se llena de capacitación, la mensual se vuelve un reporte y el corte de cuatro meses no alcanza a decidir nada.</p>
<table class="w-tab"><thead><tr><th>Reunión</th><th>Cadencia</th><th>Para qué existe</th><th>Qué se revisa</th></tr></thead><tbody>
<tr><td><b>De acompañamiento</b></td><td><b>4 al mes</b></td><td>Que el consultor tenga con qué trabajar</td><td>Capacitación, dudas del sistema, revisión de cuentas y cualquier tema relevante. Las convoca Sacs.</td></tr>
<tr><td><b>Semanal de campañas</b></td><td><b>Semanal</b></td><td>Corregir mientras el dinero de la campaña corre</td><td>Qué leads entraron, cuáles se llamaron a tiempo, dónde se atoran, y <b>qué cambiar ya</b> en la campaña, el mensaje o el seguimiento.</td></tr>
<tr><td><b>Corte de campañas</b></td><td><b>Cada 4 meses</b></td><td>Decidir la estrategia y el volumen</td><td>Leads recibidos, llamados en 24 h, reuniones, descalificados y por qué, oportunidades y ventas. La <b>tendencia</b>, no el día.</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">La diferencia entre la semanal y el corte</span>
<p>La semanal es <b>operativa</b>: se mira la semana y se cambia algo el lunes. El corte mira <b>la tendencia</b>: qué campaña convierte, si el compromiso de 30 leads se sostiene y si toca subirlo.</p>
<p>Una no sustituye a la otra. Sin la semanal, un mes malo se descubre cuatro meses tarde; sin el corte, se corrigen detalles sin nunca revisar la estrategia.</p></div>
<h3>Qué asegura cada una</h3>
<ul>
<li><b>Las 4 mensuales</b> aseguran que el consultor no se quede atorado: son la contraparte de exigirle que conozca la cuenta, sepa el proceso y pueda responder al cliente.</li>
<li><b>La semanal</b> asegura el compromiso de leads de los dos lados: que Sacs mande los 30 del perfil, y que se llamen dentro de las 24 horas.</li>
<li><b>El corte cuatrimestral</b> asegura que el volumen crezca cuando debe. Es la única reunión donde se decide subir de 30, y la condición es <b>comprobar que se vende</b>.</li>
</ul>
<div class="w-caja w-warn"><span class="w-k">La revisión que no es una reunión</span>
<p>Aparte de las tres, <b>cada 3 meses</b> se revisa cada cuenta asignada contra dos preguntas: ¿creció en uso? ¿creció en ventas? Esa revisión no necesita junta —sale del propio sistema— pero es la que puede costar la cuenta: <b>dos seguidas sin cumplir y se retira</b>.</p></div>
<div class="w-caja w-ok"><span class="w-k">El documento completo</span>
<p>Estas páginas son el marco puesto en operación. El documento firmado, con sus 16 cláusulas y su tabla de casos de aplicación, vive en <code>code.sacscloud.com/colaboracion/</code>. Ante cualquier diferencia, <b>manda el documento</b>.</p></div>`,
  },
  {
    id: 'toques', grupo: 'Referencia', titulo: 'Los tres toques',
    bajada: 'Qué respondió el cliente, qué hicimos nosotros, y qué se movió al final.',
    cuerpo: `
<p>Cada lead trae <b>tres fechas de actividad</b>, y la diferencia entre ellas es la que decide a quién llamar. Mezclarlas en un solo dato es el error clásico: ordenar por «última actividad» a secas pone arriba <b>a quien más perseguimos</b>, no a quien contestó.</p>
<table class="w-tab"><thead><tr><th>Campo</th><th>Qué es</th><th>De qué sale</th></tr></thead><tbody>
<tr><td><b>Respondió</b><br><span class="w-mut">toque del cliente</span></td><td>La última vez que <b>él</b> hizo algo hacia nosotros. Es la señal de interés: la única que dice si sigue vivo.</td><td>WhatsApp suyo · llamada que tomó · correo contestado · abrió un correo · visitó el sitio · vio la cotización</td></tr>
<tr><td><b>Le tocamos</b><br><span class="w-mut">toque nuestro</span></td><td>La última vez que <b>nosotros</b> hicimos algo hacia él. Es esfuerzo, no interés.</td><td>WhatsApp nuestro · llamada marcada sin contestar · correo enviado · cotización enviada</td></tr>
<tr><td><b>Último movimiento</b><br><span class="w-mut">consolidado</span></td><td>El más reciente de los dos, con quién habló. Sirve para «cuánto lleva quieta esta ficha» sin importar de qué lado vino.</td><td>El mayor entre los dos anteriores</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Por qué una llamada cuenta de los dos lados</span>
<p>Una llamada <b>contestada</b> es del cliente: tomó el teléfono. Una <b>marcada y no contestada</b> es nuestra: es esfuerzo. El mismo hecho cae de un lado o del otro según si hubo alguien del otro lado.</p></div>
<h3>Cómo se ordena cada pestaña</h3>
<table class="w-tab"><thead><tr><th>Pestaña</th><th>Orden</th><th>Por qué</th></tr></thead><tbody>
<tr><td>Todos · Leads nuevos</td><td>Por <b>cuándo llegó</b>, lo más nuevo arriba</td><td>Es una bandeja de entrada y se lee como tal</td></tr>
<tr><td>Contactados · Calificados</td><td>Por <b>Respondió</b>, lo más reciente arriba</td><td>Aquí ya todos fueron tocados: lo que decide es quién dio señales de vida al último</td></tr>
<tr><td>Oportunidad</td><td>Por <b>monto de la cotización</b>, de mayor a menor</td><td>Ahí ya no se prioriza por quién contestó, sino por cuánto hay sobre la mesa</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Quien nunca respondió cae al final</span>
<p>No al principio. Sin señal no hay prioridad, y ponerlo arriba con fecha cero sería inventarla. En la columna dice <b>«nunca»</b>, que es la verdad.</p></div>
<h3>Dónde se calculan</h3>
<p>Se calculan <b>al vuelo</b>, cada vez que se pide la lista — no son columnas guardadas. Es a propósito: una columna guardada hay que refrescarla y se queda vieja. Ya pasó con <code>ultima_actividad_venta_at</code>, que existe desde agosto y solo se calculó una vez, el día que se creó.</p>`,
  },
  {
    id: 'secuencias-estado', grupo: 'Referencia', titulo: 'Las secuencias, de un vistazo',
    bajada: 'Qué hay cargado y qué manda cada una.', chip: { texto: 'todas apagadas', tono: 'warn' },
    cuerpo: `
<p>Ocho cadencias, <b>144 pasos</b> por tres canales. Todas están <b>apagadas</b>: prenderlas es una decisión, no un trámite.</p>

<table class="w-tab"><thead><tr><th>Secuencia</th><th>A quién</th><th>Correo</th><th>WhatsApp</th><th>En Sacs</th></tr></thead><tbody>
<tr><td><b>Rezagados · top of mind</b></td><td>Lead que se enfrió</td><td>30</td><td>4</td><td>—</td></tr>
<tr><td><b>Prueba gratis · 14 días</b></td><td>Está probando</td><td>11</td><td>6</td><td>7</td></tr>
<tr><td><b>Crecimiento · lo que sigue</b></td><td>Cliente que opera bien</td><td>10</td><td>4</td><td>9</td></tr>
<tr><td><b>Seguimiento a leads sin respuesta</b></td><td>Lead nuevo</td><td>8</td><td>7</td><td>—</td></tr>
<tr><td><b>Rumbo a la renovación</b></td><td>Cliente que renueva pronto</td><td>6</td><td>2</td><td>4</td></tr>
<tr><td><b>Demo agendada · rumbo a la sesión</b></td><td>Ya agendó</td><td>5</td><td>3</td><td>—</td></tr>
<tr><td><b>Oportunidad · Moda multitienda</b></td><td>Ya tiene cotización</td><td>8</td><td>—</td><td>—</td></tr>
<tr><td><b>Winback · los que se fueron</b></td><td>Cliente que se fue</td><td>15</td><td>5</td><td>—</td></tr>
</tbody></table>

<p>Y una octava que <b>sí está prendida</b>: <b>WhatsApp entrante · atención y control</b>, que no manda nada — reacciona cuando el lead escribe.</p>

<h3>Cuál va con cuál</h3>
<table class="w-tab"><thead><tr><th>Momento</th><th>Secuencia</th></tr></thead><tbody>
<tr><td>Llegó y nadie lo ha tocado</td><td>Seguimiento a leads sin respuesta</td></tr>
<tr><td>Agendó una demo</td><td>Demo agendada</td></tr>
<tr><td>Ya cotizaste</td><td>Oportunidad · Moda multitienda</td></tr>
<tr><td>Está probando el sistema</td><td>Prueba gratis · 14 días</td></tr>
<tr><td>Se enfrió sin comprar</td><td>Rezagados · top of mind</td></tr>
<tr><td><b>Ya es cliente y opera bien</b></td><td>Crecimiento · lo que sigue</td></tr>
<tr><td><b>Su renovación viene</b></td><td>Rumbo a la renovación</td></tr>
<tr><td><b>Se fue</b></td><td>Winback · los que se fueron</td></tr>
</tbody></table>

<div class="w-caja"><span class="w-k">Las dos últimas son de CLIENTE</span><p>Y por eso el motor tuvo que aprender dos cosas: contar hacia atrás hacia una fecha futura, y dejar de expulsar a quien ya compró. Antes toda secuencia sacaba al cliente con motivo «convertido» — correcto para adquisición, imposible para retención.</p></div>

<div class="w-caja w-bad"><span class="w-k">Antes de prender cualquiera</span><p>Verifica que ningún paso apunte a una plantilla que no exista o no esté aprobada. <b>Un paso huérfano no falla: se salta en silencio</b>, y nadie se entera de que ese lead no recibió nada. Esa consulta pesa más que contar plantillas.</p>
<p>Para las de WhatsApp hay un atajo: <code>node scripts/estado-plantillas-wa.mjs</code>.</p></div>`,
  },
  {
    id: 'wa-voces', grupo: 'Referencia', titulo: 'Quién escribe por dónde',
    bajada: 'Fernanda abre. Andrea es a quien llegas.',
    cuerpo: `
<p>En <b>WhatsApp escribe Fernanda</b>, del equipo. En la sesión consultiva está <b>Andrea</b>, la consultora de moda.</p>
<p>No es un detalle de firma: separar las voces le da peso a Andrea. Si su nombre contesta también los acuses automáticos de las once de la noche, se gasta antes de llegar a la sesión. Así, cuando aparece, es porque la conversación subió de nivel.</p>
<div class="w-caja"><span class="w-k">Cómo se ve en la práctica</span><p>El acuse automático y los botones de los correos van a nombre del equipo. Las plantillas invitan así: «<i>te agendo una sesión con Andrea, nuestra consultora — ella acompañó a las marcas de nuestros casos de éxito</i>». Fernanda no es el premio de consolación: es la puerta.</p></div>
<div class="w-caja"><span class="w-k">Las nuevas ya están en Meta</span><p>Meta no deja editar el cuerpo de una plantilla, así que las que decían Andrea no se corrigieron: se dieron de alta las de Fernanda —<code>cadencia_equipo</code> y <code>cadencia_equipo_moda</code>— y la vieja genérica ya se borró.</p>
<p><code>cadencia_consultora_moda</code> <b>sigue viva a propósito</b>: está dentro de una secuencia, y quitarla antes de que su reemplazo esté aprobado dejaría ese paso mudo. Se apunta la secuencia a la nueva y se borra la vieja, en ese orden.</p></div>

<div class="w-caja w-bad"><span class="w-k">Una regla de Meta que cuesta encontrar</span><p>El cuerpo <b>no puede empezar ni terminar con una variable</b>. Si empieza con <code>{{1}}</code>, Meta devuelve un error 100 genérico —«Petición inválida»— que no dice nada hasta que se abre el detalle. Ya costó cuatro rechazos: se le antepone el saludo y listo.</p></div>`,
  },
  {
    id: 'wa-permitidos', grupo: 'Referencia', titulo: 'Qué escribe solo por WhatsApp',
    bajada: 'La lista corta. Lo que no está aquí, no sale.',
    cuerpo: `
<p>Desde el 2 de septiembre solo <b>cuatro cosas</b> le escriben al cliente por WhatsApp sin que una persona lo pida. Todo lo demás está pausado, y no es una promesa: el sistema pregunta por una lista de permitidos antes de cada envío. Lo que no esté en la lista —incluso algo que alguien programe mañana— <b>no puede enviar</b>.</p>

<table><tr><th>Sale solo</th><th>Cuándo</th></tr>
<tr><td><b>Confirmación de la reunión</b></td><td>Cuando el cliente reserva. Una vez.</td></tr>
<tr><td><b>Recordatorios</b></td><td>1 día, 3 horas y 10 minutos antes. Se configuran por tipo de reunión.</td></tr>
<tr><td><b>Seguimiento de la reunión</b></td><td>No llegó, se canceló, se reagendó, y el «Ahí estaré» del recordatorio.</td></tr>
<tr><td><b>Primer mensaje al contacto</b></td><td>Cuando entra un lead nuevo. Ver abajo.</td></tr></table>

<h3>El primer mensaje va en dos pasos</h3>
<p>Sale primero una plantilla de <b>marketing</b>: con foto, con preguntas concretas y con un texto más suelto, que es lo que de verdad abre conversación. A los <b>10 minutos</b> el sistema revisa si llegó. Si Meta la bloqueó —hay gente que apagó los mensajes de marketing, y hay un tope semanal por persona— entonces, y solo entonces, sale la de <b>utilidad</b>: dice menos, pero pasa por donde el marketing no pasa.</p>
<div class="w-caja"><span class="w-k">Por qué no se revisa al enviar</span><p>Meta <b>acepta</b> el mensaje y recién después reporta que el usuario lo tiene bloqueado. Al momento de mandarlo todavía no se sabe; por eso hay que volver a mirar más tarde.</p></div>
<p>Es el <b>primer</b> mensaje: uno por número, una vez en la vida. Si ese número ya tiene conversación con nosotros, no sale nada — no es un primer contacto, es meterse en un hilo que ya existe.</p>

<h3>El recordatorio también prepara la sesión</h3>
<p>Son <b>dos mensajes distintos</b>, según cuánto falte.</p>
<p>Los que van con tiempo —<b>1 día</b> y <b>3 horas</b> antes— además de recordar le piden contexto: cuántas tiendas maneja, con qué vende y qué es lo que más le complica. Y le ofrecen mandarlo en <b>nota de voz</b>, que es como la gente lo cuenta de verdad. Con eso llegas a la sesión con algo hecho a su medida en vez de una demo genérica.</p>
<p>El de <b>10 minutos</b> antes no pide nada: solo recuerda y da la liga. Pedirle a alguien que te cuente su operación diez minutos antes llega tarde para él y para ti.</p>
<p>El <b>correo</b> de ese mismo recordatorio lleva el mismo trato: los de con tiempo traen el bloque que pide contexto —ahí el cliente puede responder el correo directo o mandar la nota de voz por WhatsApp— y el de encima no.</p>
<div class="w-caja"><span class="w-k">El corte</span><p>Una hora. De ahí para arriba pide contexto; de ahí para abajo, no. Si configuras un recordatorio a 45 minutos, ese sale corto.</p></div>

<h3>Los recordatorios solo salen en horario laboral</h3>
<p>De <b>8:00 a 18:00</b>, hora del centro de México. Un aviso a las 6 de la mañana o a las 11 de la noche no lo lee nadie — y sí quema la conversación.</p>
<p>Lo que <b>cae antes de abrir</b> se recorre a las 8:00: el recordatorio de «3 horas» de una reunión de las 9:00 caería a las 6 de la mañana, así que sale a las 8:00. Y entonces <b>dice la verdad</b>: el cliente lee «es en 1 hora», no «es en 3 horas».</p>
<p>Lo que <b>cae después de cerrar</b> no se manda. Eso tiene un costo que conviene tener claro: una reunión de las 7 de la noche <b>pierde</b> su recordatorio de un día antes, porque caería a las 7 de la noche del día anterior. Si prefieres que en vez de perderse se adelante a las 6, se cambia en la misma pantalla.</p>
<p>La ventana rige <b>los dos canales</b>, no solo WhatsApp: si a esa hora no tiene sentido mandar, tampoco sale el correo.</p>
<div class="w-caja"><span class="w-k">Dónde se cambia</span><p><b>Reuniones ▸ Editar un tipo ▸ Avisos al cliente ▸ «A qué horas se pueden mandar»</b>. La ventana es <b>global</b>: aplica a todos los tipos de reunión, aunque se edite desde uno.</p></div>

<h3>Un cambio de horario ya no se contesta solo</h3>
<p>Si alguien pide mover su reunión —toca «Reagendar» o lo escribe— el sistema <b>no le contesta</b>. Queda anotado en su ficha y te levanta aviso para que lo atiendas desde el inbox. Antes le mandaba una liga y una lista de horarios, y el cliente terminaba sin saber si su reunión seguía en pie.</p>

<h3>Lo que está pausado</h3>
<p>El acuse automático del inbox («Te leo 👋»), la respuesta con horarios, el botón de reagendar, las secuencias de seguimiento, la cobranza de suscripciones vencidas y el copiloto de IA. <b>Encender cualquiera es una decisión tuya</b>, y se hace sin desplegar nada.</p>
<div class="w-caja"><span class="w-k">Dónde se prende y se apaga</span><p><b>WhatsApp ▸ el engrane del inbox ▸ «Qué escribe solo por WhatsApp»</b>. Cada renglón dice por qué está como está. Lo que apagues ahí deja de poder enviar en menos de un minuto.</p></div>
<h3>Lo que NO pasa por esta lista, y por qué</h3>
<p>Tres grupos, todos a propósito:</p>
<p>· <b>Lo que mandas tú</b> — el inbox, las campañas, los mensajes que dejas programados y el envío de prueba de una plantilla. Ahí hay una persona decidiendo; esta lista gobierna lo que sale <i>solo</i>.<br />
· <b>Los avisos al equipo</b> — «nuevo lead», el resumen semanal del ARR, las alertas del sistema. Van a números del equipo, no a clientes.<br />
· <b>Los avisos de una compra</b> — cuando alguien paga un regalo o un referido cobra, se le avisa por WhatsApp. Es el acuse de algo que la persona acaba de hacer, no una automatización de venta.</p>
<div class="w-caja"><span class="w-k">Cómo se sabe que la lista está completa</span><p>Se revisa al revés: se listan <b>todos</b> los lugares del código que pueden mandar un WhatsApp y se comprueba que cada uno, o pregunta la lista, o cae en uno de esos tres grupos. Así se encontró que la cancelación mandaba <b>dos</b> mensajes —el rescate por plantilla y otro con horarios sugeridos— sin que uno supiera del otro.</p></div>`,
  },
  {
    id: 'wa-manejo', grupo: 'Referencia', titulo: 'Cómo se maneja esto',
    bajada: 'Dónde se toca cada cosa y qué haces cuando pasa algo.',
    cuerpo: `
<p>Todo lo de la página anterior se maneja desde <b>dos pantallas</b>. Ninguna pide desplegar nada: lo que cambies ahí cambia el comportamiento en menos de un minuto.</p>

<table><tr><th>Qué quieres cambiar</th><th>Dónde</th></tr>
<tr><td>Prender o apagar una automatización</td><td>WhatsApp ▸ el <b>engrane</b> del inbox ▸ «Qué escribe solo por WhatsApp»</td></tr>
<tr><td>Cuánto antes salen los recordatorios y por qué canal</td><td>Reuniones ▸ <b>Editar</b> un tipo ▸ Avisos al cliente</td></tr>
<tr><td>El horario en que se pueden mandar</td><td>Ahí mismo ▸ «A qué horas se pueden mandar» — es <b>global</b></td></tr>
<tr><td>Qué plantilla usa el primer mensaje</td><td>Se guarda con la automatización «Primer mensaje al contacto»</td></tr></table>

<h3>Lo que tienes que atender tú</h3>
<div class="w-caja"><span class="w-k">«Un cliente pidió reagendar»</span><p>Llega como alerta porque la respuesta automática está pausada a propósito. <b>Ábrelo en el inbox y contéstale.</b> Nadie más lo va a hacer: el sistema ya no le manda liga ni horarios.</p></div>
<div class="w-caja"><span class="w-k">Una nota de voz</span><p>Los recordatorios que salen con tiempo le piden al cliente que cuente cómo trabaja, y muchos van a contestar con audio. <b>Escúchalo antes de la sesión</b> — es lo que hace que llegues con algo preparado en vez de una demo genérica. El inbox transcribe los audios.</p></div>
<div class="w-caja"><span class="w-k">«Los leads nuevos no están recibiendo WhatsApp»</span><p>Significa que la plantilla que usa el primer mensaje dejó de estar aprobada en Meta. Da de alta una nueva y apúntala en la configuración. <b>Meta no deja editar</b> el texto de una plantilla ya aprobada: se crea otra —por ejemplo <code>nombre_v2</code>— y se cambia cuál se usa.</p></div>

<h3>Cuando algo no salió</h3>
<p>El sistema <b>avisa</b> cuando un mensaje no sale; no hay que estarlo revisando. Si aun así falta un aviso, revísalo en este orden:</p>
<p>1. ¿La automatización está <b>encendida</b> en la lista de permitidos?<br />
2. ¿La hora en que tocaba caía <b>fuera de 8:00–18:00</b>? Ese recordatorio no se manda a propósito.<br />
3. ¿La <b>plantilla</b> sigue aprobada en Meta? Una plantilla rechazada tumba el WhatsApp, no el correo.<br />
4. ¿El cliente pidió <b>no recibir</b> WhatsApp? El opt-out manda sobre todo lo demás.</p>

<h3>Los dos canales dicen lo mismo</h3>
<p>El correo y el WhatsApp de un mismo recordatorio salen <b>juntos y con el mismo trato</b>: si el WhatsApp de un día antes pide contexto, el correo de ese recordatorio también lo pide —con la diferencia de que ahí puedes responder el correo directo—. Y el horario de 8:00 a 18:00 aplica a los dos: el candado está antes de que se separen los canales.</p>`,
  },
  {
    id: 'wa-candados', grupo: 'Referencia', titulo: 'Los candados de WhatsApp',
    bajada: 'Por qué a veces el sistema te frena.',
    cuerpo: `
<p>Tres candados, cada uno puesto por algo que ya pasó de verdad.</p>

<h3>Un WhatsApp por lead por día</h3>
<p>El candado cuenta los mensajes <b>reales</b>, así que incluye lo que manda la cadencia <i>y</i> lo que manda una persona desde la bandeja. Antes la cadencia llevaba su propia cuenta y los envíos manuales le eran invisibles: a un lead le salieron dos plantillas con <b>tres minutos</b> de diferencia.</p>
<p>Desde la bandeja <b>se puede forzar</b>, porque ahí hay una persona decidiendo. La cadencia nunca fuerza: ahí no hay nadie mirando.</p>

<h3>Si tomas el hilo, la máquina se calla</h3>
<p>Cuando un vendedor manda algo a mano, la cadencia automática se aparta <b>5 días</b>. Se reanuda sola si el hilo se queda quieto. El lead no debe escuchar dos voces a la vez — mientras el vendedor habla, gana él.</p>

<h3>No se cierra sobre un mensaje sin leer</h3>
<p>Marcar «resuelta» no saca la conversación de un filtro: la saca de <b>los cuatro</b> —abiertas, no contestadas, sin respuesta y sin asignar—, porque todos excluyen ese estado.</p>
<div class="w-caja w-bad"><span class="w-k">Lo que pasó</span><p>Un lead de TikTok contestó «Si» a las 17:23. A las 18:00 la conversación se cerró con ese mensaje sin leer. Ocho minutos después el sistema detectó que el cliente llevaba rato esperando, <b>y no avisó porque estaba cerrada</b>. Seis horas fuera de la fila.</p></div>
<p>Ahora, cerrar con la última palabra del cliente sin contestar pide confirmación. Cerrar sigue siendo normal —y es lo que se hace la mayoría de las veces—; lo que no puede pasar es perder a alguien en silencio.</p>

<h3>Responder ajusta el canal, no lo saca todo</h3>
<p>Si el lead responde por WhatsApp, se detienen los <b>WhatsApps</b> automáticos y los correos siguen. Si responde por correo, al revés. La asimetría es a propósito: <b>WhatsApp es más personal</b>, y por eso una respuesta ahí pesa más.</p>`,
  },
  {
    id: 'verificar', grupo: 'Referencia', titulo: 'Cómo verificar',
    bajada: 'En este orden.',
    cuerpo: `
<h3>1 · La hoja</h3>
<p>Abre el Google Sheet conectado y mira la columna <b>«TikTok Lead Status»</b>: ahí deben aparecer los <code>Qualified</code>, <code>Opportunity</code>, <code>Converted</code> y <code>Unqualified</code>. <b>Si la columna trae los estatus, nuestra mitad está hecha.</b></p>
<h3>2 · La conexión</h3>
<p>Ads Manager ▸ <b>Leads Center ▸ CRM integration</b>, en modo <b>Signal postback</b>: ahí se ve si TikTok está leyendo la hoja y cuándo lo hizo.</p>
<div class="w-caja w-bad"><span class="w-k">Dónde NO hay que buscar</span>
<p>El dataset <b>TIKTOK AGENDAS</b> de Events Manager y su barra <i>Dataset created → CRM connected → Events received</i>.</p>
<p>Esa barra pertenece a la <b>otra vía —la de API, que se apagó por duplicada—</b> y se va a quedar en «CRM connected» de forma permanente. <b>Eso es lo esperado, no una falla.</b></p></div>`,
  },
  {
    id: 'nohacer', grupo: 'Referencia', titulo: 'Qué NO hacer',
    bajada: 'Formas de romper algo que funciona.',
    cuerpo: `
<div class="w-caja w-bad"><span class="w-k">No edites a mano la columna del Sheet</span><p>La escribe el sistema. Lo que pongas se sobrescribe en la siguiente corrida.</p></div>
<div class="w-caja w-bad"><span class="w-k">No muevas etapas para «probar»</span><p>Cada envío cuenta como una conversión del lado de TikTok, y <b>regresar la etapa no deshace la señal</b>.</p></div>
<div class="w-caja w-bad"><span class="w-k">No dejes leads muertos en «Nuevo lead»</span><p>No hace daño, pero desperdicia la única oportunidad de enseñarle algo al algoritmo sobre ese perfil.</p></div>
<div class="w-caja w-warn"><span class="w-k">Y no reactives el cron apagado</span><p><code>/api/cron/tiktok-crm-events</code> se quitó de <code>vercel.json</code> por duplicar la hoja <b>y</b> por estar roto: reenviaba la misma conversión cada 6 horas. Si vuelve, el bucle vuelve.</p></div>`,
  },
  {
    id: 'limites', grupo: 'Referencia', titulo: 'Límites del sistema',
    bajada: 'Antes de sacar conclusiones.',
    cuerpo: `
<table class="w-tab"><thead><tr><th>Límite</th><th>Consecuencia práctica</th></tr></thead><tbody>
<tr><td><b>+50 señales en 14 días</b></td><td>Es lo que TikTok recomienda para que la optimización se estabilice. Por debajo, el algoritmo no aprende</td></tr>
<tr><td>Leads guardados <b>90 días</b></td><td>Un lead de hace más de 3 meses ya no existe del lado de TikTok</td></tr>
<tr><td>Identifica por correo, teléfono o Lead ID</td><td>Un lead sin ninguno de los tres no se puede reportar</td></tr>
<tr><td>Una vez por etapa</td><td>Regresar y volver a avanzar no manda la señal dos veces</td></tr>
<tr><td>Solo leads de TikTok</td><td>Los que llegaron por otro canal se ignoran</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Y el límite de fondo</span><p>El algoritmo <b>necesita volumen para aprender</b>. La diferencia aparece cuando hay decenas de señales acumuladas — por eso importa que sea un hábito y no un esfuerzo de una semana.</p></div>`,
  },
];
