-- La revisión de autonomía necesita su propia política. Nivel 0 y LOW: solo
-- LEE historial y, cuando baja un nivel, lo hace en la dirección segura. Si
-- ella misma pidiera aprobación, el freno automático dejaría de ser automático.
insert into de_politicas (tipo_accion, nivel, riesgo, requiere_aprobacion, tope_dia, max_intentos, inmutable, notas)
values ('autonomia.revisar', 0, 'LOW', false, 4, 2, true,
        'Revisa el historial y degrada sola los tipos que el dueño viene rechazando. INMUTABLE: si este freno pudiera desactivarse desde la aplicación, no sería un freno.')
on conflict (tipo_accion) do update
   set nivel = 0, riesgo = 'LOW', requiere_aprobacion = false, inmutable = true
returning tipo_accion, nivel, riesgo, inmutable;
