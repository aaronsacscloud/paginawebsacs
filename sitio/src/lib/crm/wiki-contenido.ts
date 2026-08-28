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
<div class="w-caja w-ok"><span class="w-k">Blindajes que aplica el sistema, siempre</span>
<p>Horario humano (10-18 CDMX, L-V) · máximo un correo y un WhatsApp por corrida por lead · el reloj arranca el día que la secuencia <b>ve</b> al lead, nunca ráfagas retroactivas · los leads más viejos que el corte no entran · optout y pausa se respetan · cada envío queda firmado.</p></div>`,
  },
  {
    id: 'p35', grupo: 'El proceso', titulo: '↳ El relevo: demo agendada',
    bajada: 'El enemigo es el no-show.', chip: { texto: 'construida y probada', tono: 'ok' },
    cuerpo: `
<p>El pase de estafeta es automático: agendar saca al lead de «Seguimiento sin respuesta» y la secuencia <b>«Demo agendada · rumbo a la sesión»</b> lo toma en su siguiente corrida.</p>
<p><b>El arco</b> (corte 10 días, L-S): D1 confirmación + botón de Google Calendar + qué preparar · D2 la historia de Andrea · D3 la agenda de los 20 minutos · D4 caso LiveShow + reseñas 4.8 · D6 y D8 anti no-show. Eje de todos: «mándame tus preguntas», y todos llevan el link de reagendar de <b>su</b> reunión.</p>
<table class="w-tab"><thead><tr><th>Evento</th><th>Qué pasa solo</th></tr></thead><tbody>
<tr><td><b>Reagenda</b></td><td>La cita vieja queda «reagendada» y nace la nueva ligada; el evento de Google Calendar se mueve; WhatsApp de confirmación; la secuencia reinicia en día 1.</td></tr>
<tr><td><b>Cancela</b></td><td>Sale de la secuencia; recibe UN rescate por WhatsApp; Andrea recibe aviso inmediato.</td></tr>
<tr><td><b>Vuelve a agendar</b></td><td>Se reinscribe solo en día 1.</td></tr>
<tr><td><b>Asiste</b></td><td>Objetivo cumplido: sale entera.</td></tr>
<tr><td><b>Recordatorios</b></td><td>Correo 24 h antes y WhatsApp 1 h antes, ambos con link de reagendar.</td></tr>
</tbody></table>`,
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
