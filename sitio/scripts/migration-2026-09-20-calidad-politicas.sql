-- Políticas de las tres fases del gate de calidad (lib/demanda/calidad.ts).
-- Ninguna publica: leen, juzgan y generan una imagen. Los topes acotan el gasto
-- en gpt-5 web_search (~$0.20/pregunta) y en gpt-image-2 (~$0.19/portada).
insert into de_politicas (tipo_accion, nivel, riesgo, requiere_aprobacion, tope_dia, max_intentos, inmutable, notas)
values
  ('contenido.competencia', 2, 'LOW', false, 10, 2, false, 'Lee con gpt-5 web_search las páginas que hoy rankean para la pregunta del brief; guarda en de_paginas_similares y da de alta competidores nuevos.'),
  ('contenido.referee',     2, 'LOW', false, 15, 2, false, 'Juzga cada borrador contra la competencia en 6 ejes; pasa a aprobado o devuelve a brief con correcciones. Tras 2 rondas sin pasar la marca atascada.'),
  ('contenido.imagen',      2, 'LOW', false, 5,  2, false, 'Genera la portada (gpt-image-2, estilo documental) solo para piezas que ya pasaron el referee; la sube a storage wa-media/guias.')
on conflict (tipo_accion) do update set nivel = excluded.nivel, riesgo = excluded.riesgo, tope_dia = excluded.tope_dia, notas = excluded.notas, actualizado_at = now();
