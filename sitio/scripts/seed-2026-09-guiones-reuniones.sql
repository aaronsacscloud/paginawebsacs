-- ═══ El guion de las cuatro juntas ════════════════════════════════════════
--
-- Dictado por el dueño (5-sep-2026) y pasado a limpio. Cada bloque dice QUIÉN
-- presenta, CUÁNTO dura y QUÉ se muestra — y cada punto dice DE DÓNDE sale el
-- número.
--
-- Tres reglas al redactarlo, y las tres salen de la misma pregunta del dueño:
-- «¿qué falta para que ambos sepamos exactamente qué mostrar?».
--
--  1 · Cada punto es una PREGUNTA que se contesta con datos, no un tema suelto.
--      «Renovaciones» no obliga a nada; «quiénes pagan y cuánto» sí.
--
--  2 · Cada punto trae su FUENTE: la pantalla exacta del CRM de donde se saca.
--      Sin eso, cada quien busca por su lado y llegan con números distintos —o
--      sin ellos—. Con la pantalla escrita, preparar la junta es mecánico.
--      Los puntos sin fuente son a propósito: son de criterio, no de dato.
--
--  3 · Cada bloque trae sus MINUTOS. El sábado tiene 24 puntos: sin caja de
--      tiempo, la junta se va entera en el primer bloque y el dinero —que está
--      en el segundo— no se ve nunca.
--
-- Y cada junta abre con «Antes de entrar»: lo que cada quien trae LISTO. Una
-- junta donde el reporte se arma en vivo es una junta que dura el doble.
--
-- Forma: [{ bloque, quien, minutos, puntos: [ "texto" | {t, fuente} ] }]
-- Re-ejecutable: sobrescribe el guion completo de cada sala.

-- ── SÁBADO 10:00 · Planeación estratégica de la próxima semana ────────────
update espacio_canales set guion = '[
  {"bloque":"Antes de entrar","quien":"Los dos","minutos":0,"puntos":[
    {"t":"Andrea: la lista de quién paga la semana que viene, con montos.","fuente":"Ventas → Pagos y cobranza → Por cobrar"},
    {"t":"Aaron: los números de campañas y el estado del producto.","fuente":"Cuentas → Campañas"}
  ]},
  {"bloque":"La semana que viene","quien":"Andrea","minutos":10,"puntos":[
    "El plan de trabajo y dónde va a estar el enfoque.",
    "Qué funcionó esta semana y qué no.",
    "La estrategia, en claro: en qué se mete el foco y por qué.",
    "Qué necesita de Aaron para lograr los objetivos de la semana."
  ]},
  {"bloque":"El dinero de la semana que viene","quien":"Andrea","minutos":15,"puntos":[
    {"t":"Renovaciones: quiénes pagan y cuánto.","fuente":"Ventas → Pagos y cobranza → Por cobrar"},
    {"t":"Clientes actuales: ¿alguno paga un extra o va en expansión?","fuente":"Cuentas → Clientes (ficha: ARR y Por cobrar)"},
    {"t":"Leads nuevos: quiénes están listos para pagar.","fuente":"Ventas → Cotizaciones (aceptadas y enviadas)"},
    {"t":"Consultorías: ¿salió algo de ahí?","fuente":"Acompañamiento → Consultoría"},
    {"t":"El total: cuánto entra la semana que viene — qué es SEGURO y qué es PROBABLE.","fuente":"Finanzas → Ingresos y flujo"},
    "Qué se necesita para que caiga más flujo, o para que una personalización de un cliente quede."
  ]},
  {"bloque":"La semana que viene","quien":"Aaron","minutos":12,"puntos":[
    "La estrategia de la semana y dónde va a estar el enfoque.",
    "Pendientes importantes que se están trabajando.",
    "Mejoras del sistema que hay que saber.",
    "Las solicitudes de Andrea sobre cualquier tema de su trabajo.",
    {"t":"Resultados generales de las campañas.","fuente":"Cuentas → Campañas"},
    {"t":"Resultados de las reuniones y qué se puede mejorar.","fuente":"Cuentas → Reuniones"},
    "Qué se mejoró del producto.",
    "Dónde necesita ayuda."
  ]},
  {"bloque":"Avisos","quien":"Aaron","minutos":5,"puntos":[
    "Temas de la API de SACS.",
    "Suspensiones en la App Store, si las hay.",
    "Próximas mejoras de infraestructura.",
    "Cualquier cosa que haya pasado con un cliente y se deba saber.",
    "Cualquier cosa que pueda ayudar a Andrea con sus objetivos."
  ]},
  {"bloque":"El cierre","quien":"Los dos","minutos":5,"puntos":[
    "El aprendizaje de la semana: uno cada quien.",
    "Los acuerdos: cada uno con responsable y fecha. Se vuelven tarea solos."
  ]}
]'::jsonb where nombre = 'sabado-estrategia';

-- ── DOMINGO 10:00 · Día creativo ──────────────────────────────────────────
update espacio_canales set guion = '[
  {"bloque":"Antes de entrar","quien":"Los dos","minutos":0,"puntos":[
    "Cada quien llega con al menos una idea. Puede ser mala: para eso es el domingo."
  ]},
  {"bloque":"Ideas","quien":"Andrea","minutos":15,"puntos":[
    "Sus ideas locas, con ejemplos. Cualquier cosa entra."
  ]},
  {"bloque":"Ideas","quien":"Aaron","minutos":15,"puntos":[
    "Lo mismo: lo que se le ocurra, con ejemplos."
  ]},
  {"bloque":"Qué se hace realidad","quien":"Los dos","minutos":15,"puntos":[
    "Lluvia de ideas: qué puede generar mayor impacto.",
    "Qué sí, qué no, y qué aplica de verdad.",
    "Lo que aplica se trabaja en la semana y se muestra el domingo siguiente.",
    "Se revisa lo del domingo pasado: qué se optimizó y qué ya está vivo."
  ]}
]'::jsonb where nombre = 'domingo-creativo';

-- ── LUNES 10:00 · Ventas y expansión ──────────────────────────────────────
update espacio_canales set guion = '[
  {"bloque":"Antes de entrar","quien":"Los dos","minutos":0,"puntos":[
    {"t":"Andrea: sus KPIs de la semana ya sacados.","fuente":"Cuentas → Reuniones"},
    {"t":"Aaron: costo por lead y el embudo de la campaña pagada.","fuente":"Cuentas → Campañas"}
  ]},
  {"bloque":"Cuentas actuales","quien":"Andrea","minutos":5,"puntos":[
    {"t":"Resultados de las cuentas que atiende: expansión y mejora en el uso de SACS.","fuente":"Cuentas → Clientes"}
  ]},
  {"bloque":"Demos y cotizaciones","quien":"Andrea","minutos":10,"puntos":[
    {"t":"Resultados de las demos realizadas.","fuente":"Cuentas → Reuniones"},
    {"t":"Cuáles son cotización REAL y cuánto dinero va a entrar.","fuente":"Ventas → Cotizaciones"},
    "Qué se necesita para mejorar la calidad de los leads, o para vender más."
  ]},
  {"bloque":"Consultorías","quien":"Andrea","minutos":8,"puntos":[
    {"t":"Qué están buscando los clientes.","fuente":"Acompañamiento → Consultoría"},
    "Qué mejoras quieren en el sistema.",
    "Cuál de esas mejoras generaría dinero.",
    "Qué hace falta para cumplir con los flujos."
  ]},
  {"bloque":"KPIs","quien":"Andrea","minutos":8,"puntos":[
    {"t":"Reuniones: programadas, completadas, con interés en cotización, y cuántas COMPRARON.","fuente":"Cuentas → Reuniones"},
    {"t":"Monto total vendido a los clientes que están en consultoría.","fuente":"Acompañamiento → Consultoría"},
    "Qué oportunidades salen de ahí y qué falta para vender o ayudar más.",
    "Qué necesita de SACS para vender más."
  ]},
  {"bloque":"Campañas","quien":"Aaron","minutos":8,"puntos":[
    {"t":"Resultados de las campañas a leads fríos, con datos duros.","fuente":"Cuentas → Campañas"},
    {"t":"Campaña pagada: costo por lead; cuántos calificados y cuántos no.","fuente":"Cuentas → Campañas"},
    {"t":"De esos: cuántos agendaron, asistieron, son cotización y compraron.","fuente":"Cuentas → Reuniones + Ventas → Cotizaciones"},
    "La estrategia para mejorar esos números."
  ]},
  {"bloque":"Marca y contenido","quien":"Aaron","minutos":4,"puntos":[
    {"t":"Reuniones y leads que llegaron por marca personal y contenido, y cómo mejorarlo.","fuente":"Cuentas → Leads (por canal)"}
  ]},
  {"bloque":"Cómo conseguir más citas","quien":"Los dos","minutos":5,"puntos":[
    "Ideas para más citas CALIFICADAS con Andrea, y dónde puede ayudar Aaron.",
    "Los acuerdos: cada uno con responsable y fecha."
  ]}
]'::jsonb where nombre = 'lunes-semanal';

-- ── MARTES 10:00 · La casa ────────────────────────────────────────────────
update espacio_canales set guion = '[
  {"bloque":"El dinero de la casa","quien":"Los dos","minutos":8,"puntos":[
    "Calendario de pagos.",
    "Presupuesto de la semana."
  ]},
  {"bloque":"Mantenimiento","quien":"Los dos","minutos":5,"puntos":[
    "Pendientes de mantenimiento: qué falta y cómo se ayuda cada quien."
  ]},
  {"bloque":"El fin de semana","quien":"Los dos","minutos":7,"puntos":[
    "Plan del fin de semana: qué se arma, qué opciones hay y cuánto dinero hay para eso."
  ]},
  {"bloque":"Lo demás","quien":"Los dos","minutos":5,"puntos":[
    "Cualquier tema de la casa que alguien quiera hablar para mejorar lo que estamos haciendo.",
    "Los perros."
  ]}
]'::jsonb where nombre = 'martes-casa';

select nombre,
       jsonb_array_length(guion) bloques,
       (select sum(jsonb_array_length(b->'puntos')) from jsonb_array_elements(guion) b) puntos,
       (select sum((b->>'minutos')::int) from jsonb_array_elements(guion) b) minutos
  from espacio_canales where tipo='sala' and guion is not null order by nombre;
