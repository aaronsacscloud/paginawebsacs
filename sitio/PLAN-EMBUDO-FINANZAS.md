# GOAL 2026-09-03 · Contexto del lead, Embudo por ciclo de vida y Finanzas

Pedido del dueño (literal, resumido): (1) en cualquier tarjeta donde decida algo, un botón que abra un drawer con
las últimas 20 conversaciones del lead para entender el contexto y decidir desde ahí; (2) métrica de ciclo de
vida: por canal (TikTok últimos 30 días primero), con cuántos hubo conversación real (≥3-4 mensajes o llamada
≥2 min), cuántos nunca contestaron, descalificados (se habló y no era perfil), reuniones agendadas, completadas,
en cotización, vendido, inversión capturada por mí; todo clicable para desglosar; (3) sección Finanzas:
suscripciones que pago mes a mes (pagado/no, recurrente/única), nómina, comisiones → cuánto gasto al mes;
por mes: renovaciones a cobrar y cuánto entrará, gastos a pagar, cotizaciones/oportunidades de los vendedores
con probabilidad; cierre de mes (ingreso − gastos = utilidad) guardado; reporte mensual y anual por meses.

## Fases
- **A. Contexto del lead** — API `ti/contexto` + `ContextoLead` (Sheet) + botón «Ver conversación» en Revisión
  diaria, Próximos envíos, Aprendizaje y Reactivación. Acciones de la tarjeta disponibles dentro del drawer.
- **B. Embudo** — tab `embudo` (grupo Cuentas). API `crm/embudo` con rango + fuente; métricas por contacto
  creado en el rango; drill-down por métrica; inversión en `marketing_gastos` (ya existía vacía).
  Definiciones: conversación real = ≥2 entrantes y ≥2 salientes de WhatsApp o llamada contestada ≥120 s;
  nunca contestó = 0 entrantes y 0 llamadas contestadas; descalificado hablado = descalificado con conversación real.
- **C. Finanzas** — tab `finanzas` (grupo Facturación). Tablas `fin_gastos`, `fin_gastos_pagos`, `fin_cierres`.
  Ingresos = `payments` confirmados del mes; por cobrar = `subscriptions` activas con `proxima_factura` en el mes;
  comisiones = `comision_lineas` del mes; pipeline = `deals` abiertos ponderados por probabilidad. Cierre guarda
  snapshot; reporte anual lee cierres + mes vivo.

## Cola (pedidos que llegaron mientras se construía)
- **Lead que vuelve solo después de meses/año con un «hola».** Hoy el agente lee 36 h de mensajes + `ti_perfil`.
  Propuesta: si el hueco desde su último mensaje es > 45 días, antes de responder cargar un RESUMEN de toda la
  historia (qué preguntó, cotizaciones, reuniones, por qué se enfrió, datos ya conocidos) y saludar reconociendo
  el historial («la última vez veíamos X para tus 2 tiendas…»), retomar donde se quedó y NO volver a pedir los
  tres datos que ya tenemos. Implementar como bloque «HISTORIAL» en decidirTurno cuando hay reactivación
  espontánea; el resumen se genera con Haiku sobre los últimos 60 mensajes + perfil y se guarda en ti_perfil.resumen.
