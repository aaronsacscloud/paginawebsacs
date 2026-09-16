-- Guion de la junta de los lunes (canal `lunes-semanal`) — 16-sep-2026
--
-- QUÉ AGREGA (pedido del dueño): la junta del lunes es la REUNIÓN COMERCIAL, y
-- Andrea tiene que reportar tres cosas que el guion no contemplaba:
--   1. Leads VIP          → el resultado que han tenido
--   2. Renovaciones del mes → cuáles YA COBRARON y cuáles faltan
--   3. Churn              → el avance de los clientes recuperados
--
-- Se agregan dos bloques, cada uno donde le toca por naturaleza:
--   · «Renovaciones y churn» va después de «Cuentas actuales» — las tres son
--     la cartera que YA tienes (renovar y recuperar es el mismo trabajo).
--   · «Leads VIP» va después de «Demos y cotizaciones» — es pipeline nuevo.
-- Un bloque propio (y no un punto suelto dentro de otro) porque el guion es
-- justo lo que NO se puede saltar: un punto escondido se omite cuando la junta
-- va tarde; un bloque con minutos, no.
--
-- DE PASO se corrigen las `fuente` que quedaron viejas cuando se reorganizó el
-- menú del CRM (Reuniones y Leads se fueron de Cuentas a Ventas; Campañas a
-- Marketing). Apuntaban a pantallas que ya no viven ahí, y el sentido de la
-- `fuente` es precisamente que los dos lleguen con el MISMO número.
--
-- Estructura (validada contra POST /api/crm/espacio/sala, acción `guion`):
--   bloque ≤80 · quien ≤60 · punto ≤200 · fuente ≤80 · ≤20 puntos · ≤12 bloques
-- Quedan 10 bloques y 61 minutos.

update espacio_canales
set guion = '[
  {
    "bloque": "Antes de entrar",
    "quien": "Los dos",
    "puntos": [
      { "t": "Andrea: sus KPIs de la semana ya sacados.", "fuente": "Ventas → Reuniones" },
      { "t": "Aaron: costo por lead y el embudo de la campaña pagada.", "fuente": "Marketing → Campañas" }
    ]
  },
  {
    "bloque": "Cuentas actuales",
    "quien": "Andrea",
    "minutos": 5,
    "puntos": [
      { "t": "Resultados de las cuentas que atiende: expansión y mejora en el uso de SACS.", "fuente": "Cuentas → Clientes" }
    ]
  },
  {
    "bloque": "Renovaciones y churn",
    "quien": "Andrea",
    "minutos": 8,
    "puntos": [
      { "t": "Renovaciones que vencen este mes: cuáles YA cobraron y cuáles faltan.", "fuente": "Finanzas → Suscripciones" },
      { "t": "De las que faltan: quién no ha pagado, desde cuándo y qué se está haciendo.", "fuente": "Finanzas → Pagos y cobranza" },
      { "t": "Cuentas en riesgo de no renovar, con el motivo de cada una.", "fuente": "Cuentas → Churn" },
      { "t": "Clientes recuperados: avance de cada caso y ARR recuperado del mes.", "fuente": "Cuentas → Churn" },
      { "t": "Cuáles se dan por irrecuperables y por qué — la razón sirve para atacar la causa.", "fuente": "Cuentas → Churn" },
      "Qué hace falta para que las renovaciones se cobren solas y no a jalones."
    ]
  },
  {
    "bloque": "Demos y cotizaciones",
    "quien": "Andrea",
    "minutos": 10,
    "puntos": [
      { "t": "Resultados de las demos realizadas.", "fuente": "Ventas → Reuniones" },
      { "t": "Cuáles son cotización REAL y cuánto dinero va a entrar.", "fuente": "Ventas → Cotizaciones" },
      "Qué se necesita para mejorar la calidad de los leads, o para vender más."
    ]
  },
  {
    "bloque": "Leads VIP",
    "quien": "Andrea",
    "minutos": 5,
    "puntos": [
      { "t": "Cuántos leads VIP hay vivos y en qué etapa va cada uno.", "fuente": "Ventas → Leads (etiqueta VIP)" },
      { "t": "Cuáles avanzaron esta semana y cuáles llevan más de 15 días sin moverse.", "fuente": "Ventas → Leads (etiqueta VIP)" },
      { "t": "De los VIP: cuántos agendaron demo y cuántos ya están en cotización.", "fuente": "Ventas → Reuniones + Cotizaciones" },
      "Qué necesita para destrabar los que están atorados."
    ]
  },
  {
    "bloque": "Consultorías",
    "quien": "Andrea",
    "minutos": 8,
    "puntos": [
      { "t": "Qué están buscando los clientes.", "fuente": "Acompañamiento → Consultoría" },
      "Qué mejoras quieren en el sistema.",
      "Cuál de esas mejoras generaría dinero.",
      "Qué hace falta para cumplir con los flujos."
    ]
  },
  {
    "bloque": "KPIs",
    "quien": "Andrea",
    "minutos": 8,
    "puntos": [
      { "t": "Reuniones: programadas, completadas, con interés en cotización, y cuántas COMPRARON.", "fuente": "Ventas → Reuniones" },
      { "t": "Monto total vendido a los clientes que están en consultoría.", "fuente": "Acompañamiento → Consultoría" },
      "Qué oportunidades salen de ahí y qué falta para vender o ayudar más.",
      "Qué necesita de SACS para vender más."
    ]
  },
  {
    "bloque": "Campañas",
    "quien": "Aaron",
    "minutos": 8,
    "puntos": [
      { "t": "Resultados de las campañas a leads fríos, con datos duros.", "fuente": "Marketing → Campañas" },
      { "t": "Campaña pagada: costo por lead; cuántos calificados y cuántos no.", "fuente": "Marketing → Campañas" },
      { "t": "De esos: cuántos agendaron, asistieron, son cotización y compraron.", "fuente": "Ventas → Reuniones + Cotizaciones" },
      "La estrategia para mejorar esos números."
    ]
  },
  {
    "bloque": "Marca y contenido",
    "quien": "Aaron",
    "minutos": 4,
    "puntos": [
      { "t": "Reuniones y leads que llegaron por marca personal y contenido, y cómo mejorarlo.", "fuente": "Ventas → Leads (por canal)" }
    ]
  },
  {
    "bloque": "Cómo conseguir más citas",
    "quien": "Los dos",
    "minutos": 5,
    "puntos": [
      "Ideas para más citas CALIFICADAS con Andrea, y dónde puede ayudar Aaron.",
      "Los acuerdos: cada uno con responsable y fecha."
    ]
  }
]'::jsonb
where nombre = 'lunes-semanal';
