-- REGLA: solo se manda WhatsApp a quien lo publicó él mismo.
--
-- Un enlace wa.me en la ficha de Google Maps o en el sitio del negocio es el
-- negocio diciendo "escríbeme por WhatsApp aquí". Ese es el único permiso que
-- aceptamos. Todo lo demás —un teléfono que PARECE celular, un móvil que
-- confirmó Twilio Lookup— es una suposición nuestra, y suponer aquí se paga
-- caro: cada mensaje a un número sin WhatsApp cuenta contra la calificación de
-- calidad de la línea, y escribirle a un negocio que nunca publicó ese canal es
-- justo lo que hace que reporten el número.
--
-- Lo medido hoy explica por qué no basta con "es celular": de los números
-- INFERIDOS del teléfono, la mitad resultó línea FIJA (15 de 30 en el segundo
-- lote de novias). Y aun los que salen móviles pueden no tener WhatsApp: Meta
-- quitó a propósito la única forma de preguntarlo, el endpoint `contacts`, que
-- HOY RESPONDE SIEMPRE "válido" tenga o no tenga.
--
-- El teléfono NO se pierde: sigue ahí como canal `telefono` y esas cuentas se
-- trabajan por llamada, que es su vía.

-- 1. Todo canal de WhatsApp que no sea declarado o ya confirmado queda fuera.
--    Se conserva la fila —con lo que aprendimos de Lookup— pero con un estado
--    que dice la verdad: nadie declaró este canal.
update abm_canales set estado = 'no_declarado'
 where tipo like 'whatsapp%' and estado not in ('declarado', 'valido', 'invalido', 'opt_out');

-- 2. La única puerta. Antes dejaba pasar `probable`; ya no.
create or replace view v_whatsapp_contactable as
  select x.*, c.nombre as cuenta_nombre, c.giro, c.ciudad, c.puntaje
    from abm_canales x
    join abm_cuentas c on c.id = x.cuenta_id
   where x.tipo like 'whatsapp%'
     and x.estado in ('declarado', 'valido')
     and c.etapa is distinct from 'no_contactar'
     and c.ya_es_cliente is null;

comment on view v_whatsapp_contactable is
  'Los UNICOS numeros de WhatsApp a los que se puede escribir: los que el negocio publico el mismo (wa.me), mas los ya confirmados por entrega. Ver MANUAL-PROSPECCION-ABM.md seccion 6.';

-- 3. El candado de verdad. Una vista es una convención: basta que alguien
--    escriba otra consulta para saltársela. Esto lo impide en la base.
create or replace function public.abm_whatsapp_solo_declarado()
 returns trigger language plpgsql as $fn$
declare ok boolean;
begin
  if new.canal is distinct from 'whatsapp' then return new; end if;
  select exists (
    select 1 from abm_canales x
     where x.cuenta_id = new.cuenta_id and x.tipo like 'whatsapp%'
       and x.estado in ('declarado','valido')
       and regexp_replace(x.valor,'\D','','g') = regexp_replace(new.destino,'\D','','g')
  ) into ok;
  if not ok then
    raise exception 'WhatsApp bloqueado: % no es un numero declarado por la cuenta. Solo se escribe a quien publico su wa.me. Ver MANUAL-PROSPECCION-ABM.md seccion 6.', new.destino;
  end if;
  return new;
end $fn$;

drop trigger if exists abm_toques_whatsapp_declarado on abm_toques;
create trigger abm_toques_whatsapp_declarado
  before insert or update of destino, canal on abm_toques
  for each row execute function public.abm_whatsapp_solo_declarado();
