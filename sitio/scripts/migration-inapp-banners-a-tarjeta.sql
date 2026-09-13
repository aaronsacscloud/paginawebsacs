-- 13-sep-2026 · Los avisos de Crecimiento que eran banner pasan a tarjeta de inicio.
--
-- El banner superior es una barra fija de UNA línea con puntos suspensivos: sirve
-- para «tu prueba vence en 3 días», no para explicar un módulo. Los cuatro avisos
-- que lo usaban miden entre 159 y 225 caracteres y en pantalla entran ~70, así que
-- el cliente leía medio mensaje. La tarjeta de inicio muestra título, mensaje
-- completo y los dos botones, y vive en el dashboard sin perseguir al usuario.
update inapp_campanas set formato = 'tarjeta_inicio', updated_at = now()
where formato = 'banner_superior' and nombre like 'Crecimiento%';
