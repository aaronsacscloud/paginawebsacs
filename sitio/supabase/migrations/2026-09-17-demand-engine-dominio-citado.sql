-- Normalizar una cita a su dominio, venga como venga.
--
-- Cada plataforma guarda una forma distinta y eso rompía el análisis más
-- accionable del motor —«en quién confía la IA»—, que es el que dice DÓNDE hay
-- que estar:
--
--   · ChatGPT y Perplexity → la URL completa
--   · Gemini               → solo el dominio (su `uri` es un redirector de
--                            Google que no dice de quién es la fuente)
--
-- La consulta hacía `split_part(u,'//',2)` y con los de Gemini devolvía cadena
-- VACÍA. Resultado: 199 citas reales agrupadas bajo un dominio en blanco, que
-- en la pantalla se leía como «la IA no cita a nadie». La conclusión estratégica
-- que salía de ahí era exactamente la contraria a la verdad.
create or replace function de_dominio_citado(cita text)
returns text
language sql
immutable
as $$
  select nullif(
    lower(
      regexp_replace(
        -- Con esquema: se corta lo de después de «//» y antes de la primera «/».
        -- Sin esquema: ya es el dominio.
        case when cita ~ '^https?://'
             then split_part(split_part(cita, '//', 2), '/', 1)
             else split_part(cita, '/', 1)
        end,
        '^www\.', ''          -- www y el dominio son el mismo sitio
      )
    ), '');
$$;

comment on function de_dominio_citado is
  'El dominio de una cita, acepte URL completa o dominio suelto. Existe porque cada IA devuelve una forma distinta y agrupar sin normalizar daba 199 citas bajo un dominio vacío.';
