-- La etapa «En conciliación» en el catálogo REAL — 17-sep-2026
--
-- La migración anterior buscó una tabla `crm_etapas` que no existe: el catálogo
-- se llama `crm_lifecycle_etapas` y `contacts.lifecycle_stage` tiene una llave
-- foránea contra él (`contacts_lifecycle_stage_fk`). Por eso el primer intento
-- de mover a alguien reventó con «violates foreign key constraint» — lo cual, a
-- favor del esquema, es exactamente lo que debe pasar: nadie puede inventar una
-- etapa desde el código sin declararla aquí.
--
-- Orden 9: después de «Perdido» (8) y antes de «Descalificado». Tipo `abierta`
-- y no `perdida` a propósito: alguien que aceptó sentarse a negociar SÍ está en
-- juego, y los tableros que cuentan oportunidades abiertas deben verlo.

insert into crm_lifecycle_etapas (id, nombre, emoji, color, orden, tipo, sugerencias, activo)
values ('en_conciliacion', 'En conciliación', '🤝', '#9a6a10', 9, 'abierta', '[]'::jsonb, true)
on conflict (id) do nothing;
