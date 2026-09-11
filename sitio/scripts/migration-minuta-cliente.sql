-- TELEFONÍA · La minuta tiene DOS versiones. 2026-09-11
--
-- Por qué: la minuta que escribe Claude es de observación interna y sirve
-- justamente por eso. La primera real decía, de un cliente: «dos socios con
-- visiones diferentes», «los socios consideraron que se dispara el precio», «el
-- socio tecnológico se desanimó». Todo cierto y todo útil —para NOSOTROS—.
-- Mandárselo al cliente le devuelve sus propios desacuerdos citados.
--
-- Así que se guardan las dos: la interna, que no se toca, y una para el cliente
-- que Claude escribe sabiendo que él la va a leer. Las dos salen de la MISMA
-- llamada al modelo: no cuesta una pasada extra.
alter table wa_llamadas
  add column if not exists minuta_cliente text,
  add column if not exists minuta_pdf_cliente_url text;
