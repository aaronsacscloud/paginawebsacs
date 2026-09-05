-- ═══ El guion de las cuatro juntas ════════════════════════════════════════
--
-- Dictado por el dueño (5-sep-2026) y pasado a limpio. Cada bloque dice QUIÉN
-- presenta y QUÉ, en el orden en que se dice.
--
-- Dos reglas al redactarlo:
--  · Cada punto es una PREGUNTA que se contesta con datos, no un tema suelto.
--    «Renovaciones» no obliga a nada; «¿quién renueva y cuánto entra?» sí.
--  · Se conserva el cierre que el dueño puso en dos juntas —el aprendizaje de
--    la semana— porque es lo único del guion que no es un número.
--
-- Re-ejecutable: sobrescribe el guion completo de cada sala.

-- ── SÁBADO · Planeación estratégica de la próxima semana ──────────────────
update espacio_canales set guion = '[
  {"bloque":"Andrea · La semana que viene","quien":"Andrea","puntos":[
    "El plan de trabajo y dónde va a estar el enfoque.",
    "Qué funcionó esta semana y qué no.",
    "La estrategia, en claro: en qué se mete el foco y por qué.",
    "Qué necesita de Aaron para lograr los objetivos de la semana."
  ]},
  {"bloque":"Andrea · El dinero de la semana que viene","quien":"Andrea","puntos":[
    "Renovaciones: quiénes pagan y cuánto.",
    "Clientes actuales: ¿alguno paga un extra o va en expansión?",
    "Leads nuevos: quiénes están listos para pagar.",
    "Consultorías: ¿salió algo de ahí?",
    "El total: cuánto se genera la semana que viene — qué es SEGURO y qué es PROBABLE.",
    "Qué se necesita para que caiga más flujo, o para que una personalización de un cliente quede."
  ]},
  {"bloque":"Aaron · La semana que viene","quien":"Aaron","puntos":[
    "La estrategia de la semana y dónde va a estar el enfoque.",
    "Pendientes importantes que se están trabajando.",
    "Mejoras del sistema que hay que saber.",
    "Las solicitudes de Andrea sobre cualquier tema de su trabajo.",
    "Resultados generales de las campañas.",
    "Resultados de las reuniones y qué se puede mejorar.",
    "Qué se mejoró del producto.",
    "Dónde necesita ayuda."
  ]},
  {"bloque":"Aaron · Avisos","quien":"Aaron","puntos":[
    "Temas de la API de SACS.",
    "Suspensiones en la App Store, si las hay.",
    "Próximas mejoras de infraestructura.",
    "Cualquier cosa que haya pasado con un cliente y se deba saber.",
    "Cualquier cosa que pueda ayudar a Andrea con sus objetivos."
  ]},
  {"bloque":"Los dos · El cierre","quien":"Los dos","puntos":[
    "El aprendizaje de la semana: uno cada quien."
  ]}
]'::jsonb where nombre = 'sabado-estrategia';

-- ── DOMINGO · Día creativo ────────────────────────────────────────────────
update espacio_canales set guion = '[
  {"bloque":"Andrea · Ideas","quien":"Andrea","puntos":[
    "Sus ideas locas, con ejemplos. Cualquier cosa entra."
  ]},
  {"bloque":"Aaron · Ideas","quien":"Aaron","puntos":[
    "Lo mismo: lo que se le ocurra, con ejemplos."
  ]},
  {"bloque":"Los dos · Qué se hace realidad","quien":"Los dos","puntos":[
    "Lluvia de ideas: qué puede generar mayor impacto.",
    "Qué sí, qué no, y qué aplica de verdad.",
    "Lo que aplica se trabaja en la semana y se muestra el domingo siguiente.",
    "Se revisa lo del domingo pasado: qué se optimizó y qué ya está vivo."
  ]}
]'::jsonb where nombre = 'domingo-creativo';

-- ── LUNES · Ventas y expansión ────────────────────────────────────────────
update espacio_canales set guion = '[
  {"bloque":"Andrea · Cuentas actuales","quien":"Andrea","puntos":[
    "Resultados de las cuentas que está atendiendo: expansión y mejora en el uso de SACS."
  ]},
  {"bloque":"Andrea · Demos y cotizaciones","quien":"Andrea","puntos":[
    "Resultados de las demos realizadas.",
    "Cuáles son cotización REAL y cuánto dinero va a entrar.",
    "Qué se necesita para mejorar la calidad de los leads, o para vender más."
  ]},
  {"bloque":"Andrea · Consultorías","quien":"Andrea","puntos":[
    "Qué están buscando los clientes.",
    "Qué mejoras quieren en el sistema.",
    "Cuál de esas mejoras generaría dinero.",
    "Qué hace falta para cumplir con los flujos."
  ]},
  {"bloque":"Andrea · KPIs","quien":"Andrea","puntos":[
    "Reuniones: programadas, completadas, con interés en cotización, y cuántas COMPRARON.",
    "Monto total vendido a los clientes que están en consultoría.",
    "Qué oportunidades salen de ahí y qué falta para vender o ayudar más.",
    "Qué necesita de SACS para vender más."
  ]},
  {"bloque":"Aaron · Campañas","quien":"Aaron","puntos":[
    "Resultados de las campañas a leads fríos, con datos duros.",
    "Campaña pagada: costo por lead; cuántos calificados y cuántos no.",
    "De esos: cuántos agendaron, cuántos asistieron, cuántos son cotización y cuántos compraron.",
    "La estrategia para mejorar esos números."
  ]},
  {"bloque":"Aaron · Marca y contenido","quien":"Aaron","puntos":[
    "Reuniones y leads que llegaron por marca personal y contenido, y cómo mejorarlo."
  ]},
  {"bloque":"Los dos · Cómo conseguir más citas","quien":"Los dos","puntos":[
    "Ideas para más citas CALIFICADAS con Andrea, y dónde puede ayudar Aaron."
  ]}
]'::jsonb where nombre = 'lunes-semanal';

-- ── MARTES · La casa ──────────────────────────────────────────────────────
update espacio_canales set guion = '[
  {"bloque":"El dinero de la casa","quien":"Los dos","puntos":[
    "Calendario de pagos.",
    "Presupuesto de la semana."
  ]},
  {"bloque":"Mantenimiento","quien":"Los dos","puntos":[
    "Pendientes de mantenimiento: qué falta y cómo se ayuda cada quien."
  ]},
  {"bloque":"El fin de semana","quien":"Los dos","puntos":[
    "Plan del fin de semana: qué se arma, qué opciones hay y cuánto dinero hay para eso."
  ]},
  {"bloque":"Lo demás","quien":"Los dos","puntos":[
    "Cualquier tema de la casa que alguien quiera hablar para mejorar lo que estamos haciendo.",
    "Los perros."
  ]}
]'::jsonb where nombre = 'martes-casa';

select nombre,
       jsonb_array_length(guion) bloques,
       (select sum(jsonb_array_length(b->'puntos')) from jsonb_array_elements(guion) b) puntos
  from espacio_canales where tipo='sala' and guion is not null order by nombre;
