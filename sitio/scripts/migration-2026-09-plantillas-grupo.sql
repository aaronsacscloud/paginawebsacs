-- Un grupo NUESTRO para las plantillas — 17-sep-2026
--
-- Pedido del dueño: «que me los pongas en una categoría como apertura de
-- conversación para que las identifique rápido».
--
-- POR QUÉ HACE FALTA UNA COLUMNA Y NO SE USA LA CATEGORÍA QUE YA HAY. La
-- `categoria` de una plantilla no es nuestra: son las tres de Meta —UTILITY,
-- MARKETING, AUTHENTICATION—, las decide Meta (reclasifica sola si el texto no
-- corresponde) y dicen cómo se COBRA y cuándo puede salir, no para qué sirve.
-- «Apertura de conversación» es un para-qué, y con 30 plantillas aprobadas eso
-- es lo que se busca al abrir el modal: no «cuál es marketing», sino «cuál me
-- sirve para arrancar».
--
-- Se queda como texto libre a propósito. Hoy sólo hay un grupo; encerrarlo en
-- un `check` obligaría a una migración por cada familia nueva —seguimiento,
-- cobranza, recordatorio— y esas se inventan escribiendo, no desplegando.

alter table wa_plantillas add column if not exists grupo text;

comment on column wa_plantillas.grupo is
  'Para qué sirve, en nuestro idioma (ej. «apertura»). NO es la categoría de Meta: esa dice cómo se cobra, esta dice para qué se usa.';

create index if not exists wa_plantillas_grupo_idx on wa_plantillas (grupo) where grupo is not null;
