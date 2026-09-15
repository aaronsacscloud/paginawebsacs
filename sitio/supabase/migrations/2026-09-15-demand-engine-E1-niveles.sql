-- DEMAND ENGINE · corrección de la semántica del nivel de autonomía.
--
-- QUÉ ESTABA MAL: `de_politicas.nivel` se sembró como «qué tan autónoma es esta
-- acción» (4 = muy autónoma). Pero el worker lo compara contra la autonomía
-- global con `nivel > autonomia_global`, así que significa lo contrario: es el
-- MÍNIMO de autonomía global que la acción necesita para correr sin preguntar.
--
-- Con las dos lecturas mezcladas, y el motor arrancando en nivel 2, hasta la
-- prueba de vida de la cola pedía autorización del dueño. Lo cazó la primera
-- corrida local: cuatro acciones encoladas, cuatro esperando permiso.
--
-- Cómo queda: el nivel de una acción es el escalón de autonomía a partir del
-- cual se suelta sola.
--   0 · pasa siempre, incluso en modo «solo observar» (leer, medir, clasificar,
--       y también DESHACER: revertir un daño nunca puede quedar bloqueado)
--   1 · recomendar  · 2 · redactar  · 3 · ejecutar lo reversible  · 4 · reservado
-- El riesgo es otra cosa y se respeta aparte: HIGH siempre pide permiso y
-- CRITICAL no corre sola jamás, esté donde esté la autonomía global.

update de_politicas set nivel = 0 where tipo_accion in (
  'sistema.noop','sistema.ciclo','sistema.cerrar_ciclo','sistema.salud',
  'ingerir.gsc','ingerir.ga4','ingerir.crm','ingerir.autocomplete','ingerir.reddit',
  'ingerir.youtube','ingerir.serp','ingerir.competidor',
  'normalizar','agrupar','clasificar','puntuar',
  'detectar.seo','detectar.decay','detectar.tecnico','detectar.competidor',
  'metricas.calcular','atribucion.procesar',
  'geo.muestrear','geo.extraer','geo.score',
  'enlaces.calcular','aprender.evaluar','experimento.leer',
  'contenido.revertir'
);

-- Proponer es el escalón «recomendar».
update de_politicas set nivel = 1 where tipo_accion in ('oportunidad.crear','contenido.brief');

-- Escribir un borrador es el escalón «redactar», que es donde arranca el motor.
update de_politicas set nivel = 2 where tipo_accion in (
  'contenido.borrador','contenido.auditar','codigo.tecnico','codigo.pagina','codigo.schema'
);

-- Tocar lo que ya está vivo, aunque se pueda deshacer, es el escalón siguiente.
update de_politicas set nivel = 3 where tipo_accion in ('contenido.actualizar','enlaces.aplicar');

-- Publicar algo nuevo: mismo escalón, y además con permiso hasta que la rampa
-- lo levante (veinte publicaciones seguidas aprobadas, etapa 6).
update de_politicas set nivel = 3, requiere_aprobacion = true
 where tipo_accion in ('contenido.publicar','contenido.programatica');

-- Recalibrar los pesos se PROPONE solo; aplicarlos es del dueño.
update de_politicas set nivel = 1, requiere_aprobacion = true where tipo_accion = 'aprender.recalibrar';

-- Lo que sale hacia afuera o toca páginas clave: permiso siempre, sin importar
-- el nivel global.
update de_politicas set nivel = 1, requiere_aprobacion = true
 where tipo_accion in ('codigo.herramienta','terceros.alta','pr.outreach','pagina.critica');

-- Y lo crítico sigue siendo crítico: nivel 0 para que el nivel no sea la
-- excusa, y la puerta la cierra el riesgo.
update de_politicas set nivel = 0, requiere_aprobacion = true
 where riesgo = 'CRITICAL';

update de_politicas set actualizado_at = now();
