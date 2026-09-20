-- TELEFONÍA · quién está en la cola de las llamadas ENTRANTES.
--
-- Pedido del dueño (20-sep-2026): «el problema es que los 2 estamos en la misma
-- cuenta y a ella le aparece cuando yo estoy haciendo llamadas y me llaman,
-- cuando al final ella no debería recibir esas llamadas».
--
-- Por qué NO va en `permisos`: ese mapa son secciones del menú —quién entra a
-- Finanzas o a Configuración— y el propio archivo dice que «el founder no se
-- toca: tiene todo, siempre». Andrea es founder. Además esto no es un permiso:
-- es un turno. No se trata de que no PUEDA atender el teléfono, sino de que
-- las entrantes no le suenen a ella.
--
-- Por omisión true: quien no sepa de esta columna sigue recibiendo llamadas,
-- que es como funcionaba antes. Apagarla es la decisión explícita.
alter table team_members add column if not exists recibe_entrantes boolean not null default true;

comment on column team_members.recibe_entrantes is
  'Si las llamadas ENTRANTES le suenan en el CRM. No afecta a las salientes ni a la cabina.';
