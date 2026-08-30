-- CONVERSACIONES INTERNAS  ·  2026-08-30
--
-- Por qué: el propio número del dueño recibe los avisos operativos del CRM
-- («1 lead sin primer toque…»), y su número de pruebas recibe las respuestas
-- automáticas. Las dos aparecían en el inbox mezcladas con clientes reales,
-- ocupando los primeros lugares de «Sin respuesta» —porque en efecto nadie
-- contesta a un robot— y empujando hacia abajo a quien sí espera respuesta.
--
-- Se marca la CONVERSACIÓN, no el contacto: el mismo número puede ser interno
-- en un canal y un cliente en otro, y una etiqueta en el contacto obligaría a
-- inventar un contacto falso para los avisos del sistema.
--
-- Por omisión NULL/false: nada cambia hasta que alguien marque algo a mano.

alter table wa_conversaciones
  add column if not exists interna boolean not null default false;

comment on column wa_conversaciones.interna is
  'Conversación con un número propio (avisos del CRM, pruebas). Se excluye del inbox salvo en la vista «Internas».';

-- Índice parcial: las internas son un puñado y el inbox filtra por "no
-- interna" en cada carga. Un índice completo sobre un booleano casi siempre
-- false no lo usaría el planificador; el parcial sí sirve para listarlas.
create index if not exists wa_conv_internas_idx on wa_conversaciones (id) where interna;
