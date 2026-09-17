-- Política de `codigo.proponer`.
--
-- Nivel 0 y LOW porque no toca nada: LEE hallazgos y ESCRIBE órdenes de trabajo
-- que se quedan esperando a una persona. El trabajo real —editar archivos— lo
-- hace el operador en el repositorio, y el push del dueño es su aprobación.
--
-- Si esta acción pidiera aprobación, el dueño estaría aprobando «¿puedo
-- proponerte trabajo?», que es una pregunta sin contenido: lo que hay que
-- aprobar es el trabajo, y eso ya pasa después.
insert into de_politicas (tipo_accion, nivel, riesgo, requiere_aprobacion, tope_dia, max_intentos, inmutable, notas)
values ('codigo.proponer', 0, 'LOW', false, 2, 2, false,
        'Agrupa hallazgos técnicos en órdenes de trabajo para el operador del repositorio. No toca archivos.')
on conflict (tipo_accion) do update set nivel = 0, riesgo = 'LOW', requiere_aprobacion = false
returning tipo_accion, nivel, riesgo;
