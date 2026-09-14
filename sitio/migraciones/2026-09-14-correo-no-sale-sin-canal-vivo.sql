-- Un correo no sale a un canal que ya sabemos muerto.
--
-- El 14-sep salieron 15 correos y rebotaron 3. Los canales se marcaron `rebote`
-- al llegar el aviso, PERO los toques que ya estaban armados para esas mismas
-- direcciones seguían en la fila: el canal quedaba muerto y el correo salía
-- igual, a rebotar otra vez. Marcar el canal no basta si nadie limpia la fila.
--
-- Esto lo cierra en la base, no en el código, por lo mismo que el de WhatsApp:
-- la fila la escriben el generador, el goteo, la pantalla y lo que venga
-- después, y la próxima consulta que alguien escriba no se va a acordar.
create or replace function public.abm_correo_canal_vivo()
 returns trigger language plpgsql as $fn$
declare malo text;
begin
  if new.canal is distinct from 'email' then return new; end if;
  if new.estado not in ('borrador','aprobado','programado') then return new; end if;
  select x.estado into malo from abm_canales x
   where x.cuenta_id = new.cuenta_id and x.tipo like 'email%'
     and lower(x.valor) = lower(new.destino)
     and x.estado in ('invalido','rebote','opt_out')
   limit 1;
  if malo is not null then
    raise exception 'Correo bloqueado: % está marcado %. Un canal muerto no se reintenta; hay que buscar la direccion buena (manual §5.1).', new.destino, malo;
  end if;
  return new;
end $fn$;

drop trigger if exists abm_toques_correo_vivo on abm_toques;
create trigger abm_toques_correo_vivo
  before insert or update of destino, estado, canal on abm_toques
  for each row execute function public.abm_correo_canal_vivo();

-- Y de una vez, la fila que quedó sucia: todo toque vivo apuntando a un canal
-- ya marcado muerto se cancela.
update abm_toques t set estado = 'cancelado'
 where t.canal = 'email' and t.estado in ('borrador','aprobado','programado')
   and exists (select 1 from abm_canales x
                where x.cuenta_id = t.cuenta_id and x.tipo like 'email%'
                  and lower(x.valor) = lower(t.destino)
                  and x.estado in ('invalido','rebote','opt_out'));
