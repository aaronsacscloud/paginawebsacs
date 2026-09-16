-- ══ El correo 7 arrancaba en minúscula en el 91% de los envíos ═══════════════
--
-- Las 88 plantillas de despedida abren así:
--
--     [[si persona]]{{persona}}, [[/si]]ya no le escribo más, nada más le…
--
-- Con nombre sale bien: «Cielo, ya no le escribo más». Sin nombre el bloque se
-- borra entero y el correo empieza con «ya no le escribo más» — en minúscula,
-- como si se hubiera cortado algo al copiar. Es el último correo de la
-- cadencia, el que se lee con más atención porque dice que uno se va.
--
-- Y no es el caso raro: 2,914 de las 3,210 cuentas contactables no tienen
-- nombre de persona. O sea que la versión rota es la que casi siempre sale.
--
-- Esto es exactamente la regla del manual §7.4 —un condicional tiene que ser
-- una frase completa que se pueda borrar— aplicada al revés: aquí el bloque
-- no es una frase, es el vocativo de la frase siguiente, y al irse deja a la
-- frase sin mayúscula. La forma correcta es la que ya usa el correo 1:
--
--     [[si persona]]{{persona}}.
--     [[/si]]Ya no le escribo más, nada más le…
--
-- Con nombre: «Cielo.» y abajo la frase. Sin nombre: la frase sola, con su
-- mayúscula. Las dos versiones se leen escritas por una persona.

with m as (
  select id, cuerpo, strpos(cuerpo, '[[si persona]]{{persona}}, [[/si]]') pos
  from abm_plantillas
  where canal = 'email' and activa
    and cuerpo like '%[[si persona]]{{persona}}, [[/si]]%'
), n as (
  -- 34 = largo de la marca. El carácter que sigue se pasa a mayúscula.
  select id, substr(cuerpo, 1, pos - 1)
              || '[[si persona]]{{persona}}.' || chr(10) || '[[/si]]'
              || upper(substr(cuerpo, pos + 34, 1))
              || substr(cuerpo, pos + 35) nuevo
  from m
)
update abm_plantillas t set cuerpo = n.nuevo from n where t.id = n.id;

select count(*) quedan_rotas from abm_plantillas
where canal='email' and activa and cuerpo like '%[[si persona]]{{persona}}, [[/si]]%';
