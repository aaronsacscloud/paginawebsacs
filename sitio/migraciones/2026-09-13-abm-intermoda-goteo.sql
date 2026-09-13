-- 13-sep-2026 · Goteo de la cadencia de marcas (expositores de Intermoda)
--
-- El dueño pidió armar la de Intermoda «igual» que la de SAPICA, y para SAPICA
-- acababa de pedir que el goteo fuera de 40 en 40; se asume el mismo 40 aquí
-- (se le avisa: si quiere otro número, se edita desde Envíos progresivos).
-- Puro correo, con IA, las mejor puntuadas primero. La firma es la del dueño:
-- es quien dio la instrucción, y quien enciende un goteo aprueba los correos
-- que va dejando aprobados cada día (manual, 8.3 y 8.4). El cartero ya está
-- encendido, así que el primer lote entra el lunes 14-sep a las 10:00 CDMX,
-- después del de SAPICA (van en orden de creación; el motor reparte el tiempo
-- de la corrida entre los dos y la corrida de la tarde completa lo que falte).
--
-- OJO con lo que de verdad sale: el cartero manda con su rampa (15 correos al
-- día al arrancar, ×1.3 cada tres días de envío, tope_diario 120). Dos goteos
-- de 40 escriben 80 cuentas nuevas al día y el cartero no las va a poder
-- mandar todas al principio; el guardia de atorados frena a cada goteo cuando
-- se le acumulan más de 40 correos aprobados de días anteriores sin salir. Es
-- decisión del dueño subir tope_diario; el goteo no lo hace solo.
--
-- Solo enrola cuentas sin_tocar con correo con MX válido (558 de 564 pasaron
-- la verificación el mismo día) y salta los buzones compartidos: ~460
-- elegibles.
insert into abm_goteo (id, cadencia_id, nombre, cuentas_dia, filtro, con_ia, estado, creado_por, nota)
values ('d0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b12', 'c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b05', 'Intermoda · cuarenta al día', 40, '{}'::jsonb, true, 'activo',
        '60be8bd8-995a-45ca-926f-1bcb159d3c1e',
        'Marcas que exponen en Intermoda. Puro correo, por instrucción del dueño. Cuarenta negocios nuevos cada día hábil (el mismo 40 que pidió para SAPICA), los mejor puntuados primero; 81 proveedores de la industria quedaron en pausa y 14 negocios ajenos o competidores en no contactar.')
on conflict (id) do nothing;
