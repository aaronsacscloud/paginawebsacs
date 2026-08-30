// La Wiki de procesos de ventas — CONTENIDO.
//
// Se separa del componente a propósito: agregar una página del wiki debe ser
// agregar un objeto a este arreglo, nunca tocar React. El orden del arreglo es
// el orden del menú; `grupo` los agrupa en la barra lateral.
//
// Regla de contenido: cada página responde UNA pregunta y se lee sola. Si algo
// necesita dos pantallas de scroll, probablemente son dos páginas.

export type PaginaWiki = {
  id: string;
  grupo: string;
  titulo: string;
  /** Aparece bajo el título, en gris. Una línea. */
  bajada?: string;
  /** Marca de estado a la derecha del título del menú. */
  chip?: { texto: string; tono: 'ok' | 'warn' | 'bad' | 'mut' };
  /** HTML del cuerpo. Se confía porque es contenido nuestro, versionado en git. */
  cuerpo: string;
};

export const GRUPOS_WIKI = ['Empezar aquí', 'Las etapas', 'El proceso', 'Referencia'] as const;

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
    id: 'e-lead', grupo: 'Las etapas', titulo: '✨ Nuevo lead',
    bajada: 'El estado en que TikTok lo entregó.', chip: { texto: 'No se reporta', tono: 'mut' },
    cuerpo: `
<p>Donde nace todo lead de campaña. <b>No significa abandono:</b> el Estatus puede decir que ya respondió, que hubo tres llamadas o que está cotizado. Significa únicamente que <b>nadie ha decidido todavía quién es</b>.</p>
<div class="w-caja"><span class="w-k">Por qué no se reporta</span><p>Decirle a TikTok «este lead es un lead» no le enseña nada — él lo entregó. Y cada etapa reportada compite con las demás por la atención del algoritmo: con demasiadas señales, ninguna pesa.</p></div>
<h3>Cuándo sacarlo de aquí</h3>
<p>En cuanto una persona lo trabaje y sepa quién es. Es el único paso manual de toda la cadena, y hoy es el que separa 30 señales de 81.</p>`,
  },
  {
    id: 'e-calificado', grupo: 'Las etapas', titulo: '✅ Calificado',
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
    id: 'e-oportunidad', grupo: 'Las etapas', titulo: '🎯 Oportunidad',
    bajada: 'Hay dinero en la mesa.', chip: { texto: 'Opportunity', tono: 'ok' },
    cuerpo: `
<p>Pasó de interesado a <b>proceso de venta abierto</b>: agendó demo, pidió cotización o está negociando.</p>
<div class="w-caja"><span class="w-k">Se mueve sola</span><p><b>Agendar una reunión promueve el lead a Oportunidad automáticamente.</b> No hay que hacerlo a mano. Si alguien agendó y sigue en Nuevo lead, algo no se registró por el canal correcto.</p></div>`,
  },
  {
    id: 'e-cliente', grupo: 'Las etapas', titulo: '💚 Cliente',
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
    id: 'e-descalificado', grupo: 'Las etapas', titulo: '🚫 Descalificado',
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
    id: 'e-rezagado', grupo: 'Las etapas', titulo: '🕰️ Rezagado',
    bajada: 'Se enfrió de nuestro lado.', chip: { texto: 'No se reporta', tono: 'mut' },
    cuerpo: `
<p>El lead que <b>sí era del perfil</b> pero dejamos enfriar: se intentó, no prosperó, y ya no está vivo el hilo. Sirve para separarlo de los que todavía nadie tocó, y para poder recuperarlo después.</p>
<div class="w-caja"><span class="w-k">Por qué NO viaja a TikTok</span><p>Un rezagado habla de <b>nuestro proceso</b>, no de la calidad del lead. Reportarlo le enseñaría al algoritmo a evitar gente buena a la que simplemente no llamamos a tiempo. Mismo criterio que «Perdido».</p></div>
<div class="w-caja w-bad"><span class="w-k">Rezagado y Descalificado se ganan, no se deducen</span>
<p>Los dos describen algo que <b>una persona hizo</b> —intentó y no hubo respuesta; revisó y descartó—, nunca algo que el calendario hizo solo.</p>
<p>Marcar por antigüedad es la forma más fácil de equivocarse: <b>ya pasó una vez</b>, con 40 leads marcados por edad que hubo que revertir. Un lead de 10 días sin contactar no es un rezagado: <b>es un pendiente</b>.</p>
<p>Para «viejo pero todavía sin tocar» ya existe el <b>Estatus «Sin tocar»</b>, que el sistema calcula solo. Filtrar por antigüedad es una <b>vista</b>, no una etapa.</p></div>`,
  },
  {
    id: 'e-perdido', grupo: 'Las etapas', titulo: '🌙 Perdido',
    bajada: 'Fue cliente y se fue.', chip: { texto: 'No se reporta', tono: 'mut' },
    cuerpo: `
<p>Un <code>churned</code>: alguien que sí compró y luego se dio de baja.</p>
<div class="w-caja"><span class="w-k">Por qué no se manda</span>
<p>Porque <b>contradiría el «Cliente» que ya reportamos</b> por esa misma persona. Para TikTok esa conversión sí ocurrió y sí fue real; que después se haya ido es información de retención, no de adquisición.</p>
<p>No confundir con <b>Descalificado</b>, que es un lead que nunca avanzó y por eso sí es una etiqueta limpia.</p></div>`,
  },
  {
    id: 'p1', grupo: 'El proceso', titulo: '1 · Llega el lead',
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
    id: 'p2', grupo: 'El proceso', titulo: '2 · El tablero se mueve solo',
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
    id: 'p3', grupo: 'El proceso', titulo: '3 · La secuencia de seguimiento',
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
    id: 'p35', grupo: 'El proceso', titulo: '↳ El relevo: demo agendada',
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
    id: 'p36', grupo: 'El proceso', titulo: '↳ El relevo: ya cotizaste',
    bajada: 'Doce días de credibilidad.', chip: { texto: 'cargada, apagada', tono: 'warn' },
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
    id: 'e-prueba', grupo: 'Las etapas', titulo: '🎁 Prueba gratis',
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
    id: 'p37', grupo: 'El proceso', titulo: '↳ El relevo: prueba gratis',
    bajada: 'Catorce días, del primer login al nivelador.', chip: { texto: 'cargada, apagada', tono: 'warn' },
    cuerpo: `
<p>Once correos que llevan al usuario de cero a operar. Cada uno enseña <b>dónde está la cosa</b> con captura del sistema real y la ruta exacta del menú, para qué sirve, qué hacer hoy y qué viene después. El CTA nunca es comprar: es preguntar por WhatsApp.</p>

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

<div class="w-caja w-bad"><span class="w-k">Antes de prenderla</span><p>Está <b>cargada pero apagada</b>, y le faltan los tres WhatsApps de los días 2, 6 y 10: ninguna de las 33 plantillas aprobadas sirve para onboarding —todas son de leads, demos y cotizaciones— así que hay que darlas de alta y esperar a Meta.</p></div>

<div class="w-caja"><span class="w-k">El día 14 y el bloqueo van juntos</span><p>El correo del día 14 —«lo que lograste y qué pasa con tu cuenta»— y el aviso de fin de prueba en la cuenta salen del <b>mismo</b> plazo. Si algún día se cambian los 14 días de la cadencia, hay que cambiar también los días que se otorgan al crear la cuenta, o el correo de cierre llega cuando el cliente ya no puede entrar.</p></div>`,
  },
  {
    id: 'revocar', grupo: 'El proceso', titulo: 'Revocar una cuenta',
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
  {
    id: 'reuniones', grupo: 'El proceso', titulo: 'El estatus de las reuniones',
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
    id: 'p4', grupo: 'El proceso', titulo: '4 · El primer toque humano',
    bajada: 'El único paso manual de toda la cadena.', chip: { texto: 'pendiente', tono: 'warn' },
    cuerpo: `
<div class="w-caja w-warn"><span class="w-k">Falta definir</span><p>El <b>round-robin de dueños</b>: faltan los nombres del equipo para repartir los leads entrantes.</p></div>
<h3>Lo que ya sabemos</h3>
<p>Hoy hay <b>51 leads esperando</b>. La medición dice que el equipo <b>sí atiende</b> —la mayoría tiene el Estatus movido, muchos respondieron— pero <b>nadie mueve la Etapa</b>, que es el único campo que TikTok lee.</p>
<div class="w-caja w-ok"><span class="w-k">Y esa es la buena noticia</span>
<p>No es un problema de seguimiento —eso sería caro y lento de arreglar—: es <b>un paso manual que falta</b>, y eso se arregla con un hábito. <b>Mover la Etapa después de cada llamada.</b></p></div>`,
  },
  {
    id: 'p5', grupo: 'El proceso', titulo: '5 · La señal de vuelta a TikTok',
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
    id: 'inbox', grupo: 'El proceso', titulo: 'Vender desde el inbox',
    bajada: 'Sin cambiar de pantalla.', chip: { texto: 'construido', tono: 'ok' },
    cuerpo: `
<p>En el panel derecho de cada conversación (pestaña <b>Acciones</b>) el vendedor ejecuta la venta completa.</p>
<table class="w-tab"><thead><tr><th>Acción</th><th>Cómo funciona</th></tr></thead><tbody>
<tr><td><b>Cotizar</b></td><td>Plan (precios del catálogo real), periodo (anual = 2 meses gratis), sucursales, implementación y extras → Crear → el link del cliente aparece al instante → enviar por WhatsApp o correo. Queda ligada al lead y su apertura se rastrea.</td></tr>
<tr><td><b>Agendar</b></td><td>Días y horarios reales → confirmar ahí mismo. Al cliente le llega confirmación por correo + WhatsApp con su invitación y Meet. Si ya tiene reunión próxima, el panel avisa antes de duplicar.</td></tr>
<tr><td><b>Mandarle los horarios</b></td><td>Un clic manda los próximos horarios + el link público. Cuando el cliente elige, <b>todo</b> se confirma solo.</td></tr>
</tbody></table>
<div class="w-caja"><span class="w-k">Reglas del vendedor</span><p>El correo del cliente es <b>obligatorio</b> para confirmar una reunión. Si la ventana de WhatsApp está cerrada, el sistema lo dice y ofrece el camino que sí entrega. Todo usa los mismos precios y canales del CRM: <b>nada de rutas paralelas</b>.</p></div>`,
  },
  {
    id: 'wa-entrante', grupo: 'El proceso', titulo: 'Cuando el lead nos escribe',
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

<h3>3 · De dónde venía</h3>
<p>Todos nuestros botones de WhatsApp mandan el mensaje ya escrito. Ese texto no dice solo «me escribieron»: dice <b>en qué punto del argumento se convenció</b>. El sistema lo reconoce, etiqueta la ficha y el aviso al equipo llega con contexto:</p>
<div class="w-caja"><span class="w-k">Así se ve el aviso</span><p><b>Regina de Kali Studio te escribió por WhatsApp</b><br />Viene de: Correo 3 · El hueco de curva<br />Quiere: Probar el motor con un estilo suyo de la temporada pasada<br />Etapa: oportunidad · cotizado</p></div>
<p>Se reconoce por una frase distintiva, no por el texto completo: WhatsApp deja editar antes de enviar y casi siempre agregan algo. Si el lead escribió por su cuenta <b>no se inventa etiqueta</b> — el acuse sale igual y el contador de no leídos hace su trabajo.</p>

<div class="w-caja"><span class="w-k">Dónde se configura</span><p>Todo esto vive en <b>Automatización ▸ Secuencias ▸ «WhatsApp entrante · atención y control»</b>. Es una secuencia por evento: no corre por días, reacciona en el momento. Si está apagada, no sale acuse.</p></div>`,
  },
  {
    id: 'wa-voces', grupo: 'Referencia', titulo: 'Quién escribe por dónde',
    bajada: 'Fernanda abre. Andrea es a quien llegas.',
    cuerpo: `
<p>En <b>WhatsApp escribe Fernanda</b>, del equipo. En la sesión consultiva está <b>Andrea</b>, la consultora de moda.</p>
<p>No es un detalle de firma: separar las voces le da peso a Andrea. Si su nombre contesta también los acuses automáticos de las once de la noche, se gasta antes de llegar a la sesión. Así, cuando aparece, es porque la conversación subió de nivel.</p>
<div class="w-caja"><span class="w-k">Cómo se ve en la práctica</span><p>El acuse automático y los botones de los correos van a nombre del equipo. Las plantillas invitan así: «<i>te agendo una sesión con Andrea, nuestra consultora — ella acompañó a las marcas de nuestros casos de éxito</i>». Fernanda no es el premio de consolación: es la puerta.</p></div>
<div class="w-caja w-bad"><span class="w-k">Pendiente</span><p>Dos plantillas aprobadas por Meta todavía dicen Andrea: <code>cadencia_consultora</code> y <code>cadencia_consultora_moda</code>. Cambiarles el cuerpo exige volver a aprobación, así que hay que dar de alta las nuevas y apagar esas dos cuando pasen.</p></div>`,
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
