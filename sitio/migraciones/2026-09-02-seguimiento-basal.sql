-- Linea base del uso, congelada, para poder decir "usa MAS que antes" sin mentir.
--
-- POR QUE HACE FALTA. La idea natural es comparar el primer snapshot contra el
-- ultimo. Medido sobre los datos reales, eso da: 70 cuentas de 84 "mejoraron",
-- 2 bajaron, promedio +2.51 modulos. Ningun negocio mejora asi de parejo: lo que
-- crecio fue el RECOLECTOR, que durante agosto aprendio a detectar mas modulos.
-- Un puntaje que casi siempre dice que si es peor que no tener puntaje, y aqui
-- ademas decide una tasa de comision.
--
-- Dos trampas mas de los mismos datos, ya medidas:
--   · solo ~80 de 144 cuentas traen `uso->modulos` en un dia dado, y no son
--     siempre las mismas (82 cuentas lo traen "a veces"). Un snapshot sin la
--     lista NO es un cero: es un dia sin dato, y contarlo como cero fabrica
--     caidas y recuperaciones que nunca pasaron;
--   · hay dias con la lista presente pero en blanco (escritura parcial). Por eso
--     la basal se toma como MEDIANA de varios dias y no de uno solo.
--
-- Lo que arregla: a partir de la fecha en que se congela, la comparacion es
-- contra un numero tomado con el recolector actual. La ventana empieza corta
-- —y la pantalla lo dice— pero crece sola y es honesta desde el primer dia.
create table if not exists comision_seguimiento_basal (
  company_id      uuid primary key references companies(id) on delete cascade,
  fecha           date not null,
  modulos_activos int  not null,
  -- Que modulos exactamente, para poder decir CUAL se sumo y cual se dejo de
  -- usar, en vez de solo un numero que sube o baja.
  modulos         jsonb not null default '[]'::jsonb,
  dias_muestra    int  not null default 0,
  creado_at       timestamptz not null default now()
);

comment on table comision_seguimiento_basal is
  'Uso de modulos congelado en una fecha, para medir la evolucion sin la deriva del recolector.';
