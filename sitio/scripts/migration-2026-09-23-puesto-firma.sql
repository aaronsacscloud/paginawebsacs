-- El PUESTO de cada persona, para su firma en los correos (23-sep-2026).
-- El correo ejecutivo firma con los datos de quien lo manda; sin puesto,
-- Andrea lo escribía a mano al final del mensaje y la firma salía doble.
alter table team_members add column if not exists puesto text;
-- El de Andrea, tal como lo firmó ella en su correo a Artik del 22-sep.
update team_members set puesto = 'Consultora en Retail & Automatización'
 where email = 'lunandreaja@gmail.com' and puesto is null;
