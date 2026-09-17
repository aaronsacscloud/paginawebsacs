-- El latido tiene que dejar huella de que corrió.
--
-- El hueco: el latido solo escribe cuando encuentra algo mal. Cuando todo está
-- bien no deja rastro — y entonces «el vigilante corrió y no vio nada» es
-- indistinguible de «el vigilante no corrió».
--
-- Es el problema clásico del vigilante: alguien tiene que vigilar al vigilante.
-- La forma barata de resolverlo no es otro vigilante (que tendría el mismo
-- problema un nivel más arriba) sino hacer que **el silencio sea medible**: si
-- cada latido deja su marca, un latido muerto se nota porque la marca envejece.
--
-- Va en `de_config` y no en una tabla nueva: es UN dato, se sobreescribe, y una
-- tabla que crece cada 30 minutos para siempre a cambio de una marca es un
-- precio que nadie pidió pagar.

alter table de_config add column if not exists latido_at timestamptz;
alter table de_config add column if not exists latido_vivo boolean;

comment on column de_config.latido_at is
  'Cuándo corrió el latido por última vez. Si envejece, el muerto es el vigilante — que es el único fallo que el propio latido no puede reportar.';
comment on column de_config.latido_vivo is
  'Qué encontró la última vez. Junto a latido_at distingue las tres cosas: sano, enfermo, y sin vigilante.';
