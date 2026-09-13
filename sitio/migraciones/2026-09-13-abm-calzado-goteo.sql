-- 13-sep-2026 · Goteo de la cadencia de calzado (expositores de SAPICA)
--
-- El dueño pidió armar la cadencia completa y echarla a andar («ármate todo»).
-- Misma forma que el de Villa Hidalgo: diez cuentas nuevas por día hábil, las
-- mejor puntuadas primero, con IA, puro correo (la cadencia no tiene pasos de
-- WhatsApp). La firma es la del dueño: es quien dio la instrucción, y quien
-- enciende un goteo aprueba los correos que va dejando aprobados cada día
-- (manual, 8.3 y 8.4). El cartero ya está encendido (2026-09-13-abm-encender-
-- cartero.sql), así que el primer lote entra el lunes 14-sep a las 10:00 CDMX.
--
-- El goteo solo enrola cuentas sin_tocar con un correo con MX válido (606 de
-- 636 pasaron la verificación el mismo día) y salta los buzones compartidos:
-- 578 cuentas elegibles, unos 58 días hábiles de enrolamiento.
insert into abm_goteo (id, cadencia_id, nombre, cuentas_dia, filtro, con_ia, estado, creado_por, nota)
values ('d0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b11', 'c0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b03', 'SAPICA · diez al día', 10, '{}'::jsonb, true, 'activo',
        '60be8bd8-995a-45ca-926f-1bcb159d3c1e',
        'Fábricas y marcas de calzado de SAPICA. Puro correo, por instrucción del dueño. Diez negocios nuevos cada día hábil, los mejor puntuados primero; los proveedores de la industria, sombreros y marroquinería quedaron en pausa y SIZES AND COLORS (competidor) en no contactar.')
on conflict (id) do nothing;
