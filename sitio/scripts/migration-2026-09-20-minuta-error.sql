-- MINUTA DE LLAMADA · que un fallo se vea, en vez de desaparecer.
--
-- EL CASO QUE LO PIDIÓ (20-sep-2026). Llamada de 19 min 22 s con Manuela Vidal
-- (Maela Sport), la más larga y la más valiosa del día. Quedó así en la base:
--
--   duracion_seg = 1162 · grabacion_path = sí · transcript = 15,477 caracteres
--   minuta = NULL
--
-- Y en `ia_uso`, tres minutos después de colgar, la llamada al modelo con
-- `ok = true`, 6,178 tokens de entrada y 6,235 de salida en 140 segundos. O
-- sea: se pagó la transcripción, se pagó la redacción, el modelo CONTESTÓ —y
-- la minuta se perdió al convertir esa respuesta en datos (`JSON.parse` de un
-- markdown largo). El `catch` guardaba la transcripción y devolvía un error que
-- nadie miraba, porque quien lo llama es un webhook de Twilio.
--
-- En pantalla eso se veía como «Telefónica · realizada» y nada más. El dueño lo
-- encontró a mano dos días después, que es justo la regla que ya había puesto:
-- «en dado caso de que algo no suceda, me tiene que marcar el error».
--
-- Dos columnas para el motivo, y una tercera para poder preguntar «¿esta
-- llamada tiene material para reintentar?» sin leerse los 15 mil caracteres de
-- la transcripción en cada apertura del panel.

alter table wa_llamadas add column if not exists minuta_error text;
alter table wa_llamadas add column if not exists minuta_error_at timestamptz;

comment on column wa_llamadas.minuta_error is
  'Por qué NO hay minuta. Se limpia sola en cuanto una se escribe bien.';

-- Generada y almacenada: `length(text)` es inmutable, así que Postgres la
-- mantiene al día sin que nadie tenga que acordarse. El panel pide esta y no
-- `transcript`, que pesa 15 KB por llamada.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_name = 'wa_llamadas' and column_name = 'transcript_len') then
    alter table wa_llamadas
      add column transcript_len integer generated always as (length(transcript)) stored;
  end if;
end $$;

comment on column wa_llamadas.transcript_len is
  'Caracteres de la transcripción. >0 significa que la minuta se puede reintentar sin volver a bajar el audio.';

-- Las que ya se perdieron en silencio: transcripción guardada y sin minuta.
-- Se marcan para que aparezcan con su aviso en la ficha desde el primer día,
-- en vez de seguir viéndose como llamadas sin nada que contar.
update wa_llamadas
set minuta_error = 'La minuta no se llegó a escribir. La transcripción sí quedó guardada: se puede generar desde aquí.',
    minuta_error_at = coalesce(ended_at, created_at)
where minuta is null and length(coalesce(transcript, '')) > 400 and minuta_error is null;

select count(*) as llamadas_marcadas from wa_llamadas where minuta_error is not null;
