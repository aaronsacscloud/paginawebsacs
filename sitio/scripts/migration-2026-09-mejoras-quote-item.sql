-- Qué PARTIDA de la cotización cubre esta entrega de consultoría.
--
-- `mejoras.quote_id` ya existía (y estaba en 0 de 61 filas, porque nunca hubo
-- campo para llenarla). Con solo la cotización no alcanza: una cotización trae
-- varias partidas y una entrega corresponde a UNA. Sin este dato no se puede
-- saber si dos entregas salieron del mismo cobro —el caso de ARTIK, donde
-- «Alertas de stock mínimo» y «Reportes automáticos por WhatsApp» salieron los
-- dos del Plugin de gastos— y el dinero se contaría dos veces.
--
-- Se guarda el NOMBRE de la partida, no su índice: reordenar la cotización no
-- debe mover el dinero de una entrega a otra.

alter table mejoras add column if not exists quote_item text;

comment on column mejoras.quote_item is
  'Nombre de la partida de quotes.items que cubre esta entrega. Se usa junto con quote_id.';
