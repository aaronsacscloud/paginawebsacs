-- ══ «Esto es lo que vimos de ustedes:» seguido de nada ═══════════════════════
--
-- El correo 0 de los 25 giros presume de investigación con estos tres
-- renglones, todos condicionales:
--
--     Y no le escribo en automático. Esto es lo que vimos de ustedes:
--     [[si senal]]· {{senal}}.[[/si]]
--     [[si sucursales]]· {{sucursales}} sucursales.[[/si]]
--     [[si plataforma]]· Su tienda en línea está en {{plataforma}}.[[/si]]
--
-- Cuando la cuenta no tiene ninguno de los tres —2,164 de las 3,210
-- contactables, dos de cada tres— el prospecto recibe la promesa y ningún
-- dato: dos puntos y el siguiente párrafo. Es peor que no decir nada, porque
-- el correo justo acaba de asegurar que no se escribió en automático.
--
-- El motor de plantillas no tiene «o», así que la condición se calcula en
-- variablesDe (src/lib/crm/abm.lib.ts): `vimos` está lleno si hay algo que
-- citar. Aquí solo se envuelve el renglón de introducción.

update abm_plantillas
set cuerpo = replace(cuerpo,
  'Y no le escribo en automático. Esto es lo que vimos de ustedes:',
  '[[si vimos]]Y no le escribo en automático. Esto es lo que vimos de ustedes:[[/si]]')
where canal = 'email' and activa
  and cuerpo like '%Y no le escribo en automático. Esto es lo que vimos de ustedes:%'
  and cuerpo not like '%[[si vimos]]%';

select count(*) envueltas from abm_plantillas
where canal='email' and activa and cuerpo like '%[[si vimos]]%';
