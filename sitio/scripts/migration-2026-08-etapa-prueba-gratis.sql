-- Etapa "Prueba gratis": el que ya está DENTRO del sistema pero todavía no paga.
--
-- Hoy esa gente cae en 'oportunidad' o en 'cliente' y ninguna de las dos es
-- cierta: no está negociando (ya decidió probar) y no es cliente (no ha pagado).
-- Sin etapa propia no se le puede hablar distinto, que es justo lo que necesita
-- durante sus 14 días.
--
-- Va en el orden 5, entre Oportunidad y Cliente, y las siguientes se recorren.
begin;

update crm_lifecycle_etapas set orden = orden + 1 where orden >= 5;

insert into crm_lifecycle_etapas (id, nombre, emoji, color, tipo, orden, activo)
values ('prueba_gratis', 'Prueba gratis', '🎁', '#C77D0A', 'abierta', 5, true)
on conflict (id) do update set nombre = excluded.nombre, emoji = excluded.emoji,
  color = excluded.color, tipo = excluded.tipo, orden = excluded.orden, activo = true;

commit;
