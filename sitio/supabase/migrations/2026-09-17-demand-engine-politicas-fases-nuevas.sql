-- Políticas de las tres fases que faltaban.
--
-- `detectar.decay` y `detectar.competidor` son nivel 0 / LOW: solo LEEN y
-- anotan hallazgos. No tocan el sitio ni gastan modelo.
--
-- `aprender.recalibrar` es distinto y por eso pide aprobación aunque el motor
-- esté en autonomía alta: cambia CÓMO SE PRIORIZA, o sea qué trabajo hace el
-- sistema las semanas siguientes. Eso se mira antes de que ocurra, no después
-- de un mes escribiendo sobre lo que no importa.
--
-- Además guarda la versión nueva SIN activarla: `vigente` sigue en la anterior
-- hasta que una persona la aprueba. La aprobación de la acción y la activación
-- de los pesos son dos decisiones, y separarlas deja ver los números antes.
insert into de_politicas (tipo_accion, nivel, riesgo, requiere_aprobacion, tope_dia, max_intentos, inmutable, notas) values
  ('detectar.decay', 0, 'LOW', false, 2, 2, false,
   'Detecta páginas que pierden visibilidad MÁS QUE EL SITIO. Solo lee Search Console y anota hallazgos.'),
  ('detectar.competidor', 0, 'LOW', false, 2, 2, false,
   'Temas que varios competidores tocaron y nosotros no. Reporta el TEMA, no la página: es una señal del mercado, no una instrucción para copiar.'),
  ('aprender.recalibrar', 1, 'MEDIUM', true, 1, 2, false,
   'Propone pesos nuevos para el score. PIDE APROBACIÓN siempre: cambiar cómo se prioriza es cambiar qué hace el motor. Se niega a recalibrar con menos de 30 predicciones evaluadas.')
on conflict (tipo_accion) do update
   set nivel = excluded.nivel, riesgo = excluded.riesgo,
       requiere_aprobacion = excluded.requiere_aprobacion, notas = excluded.notas
returning tipo_accion, nivel, riesgo, requiere_aprobacion;
