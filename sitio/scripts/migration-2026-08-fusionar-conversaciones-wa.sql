-- Fusiona los historiales de WhatsApp que quedaron partidos por el bug de
-- upsertConversacion (buscaba solo conversaciones 'active', así que al mandar
-- una plantilla a una ventana cerrada creaba un hilo nuevo con el mismo
-- teléfono). El arreglo del código ya está; esto repara lo que quedó.
--
-- Sobrevive la conversación MÁS ANTIGUA de cada teléfono: es la que trae el
-- historial y el contacto ligado. Los hijos se mueven ANTES de borrar, porque
-- todas las llaves foráneas son ON DELETE CASCADE y un borrado directo se
-- llevaría los mensajes por delante.
begin;

create temp table fusion on commit drop as
select c.id as perdedora, g.sobreviviente, c.telefono
from wa_conversaciones c
join (
  select telefono,
         (array_agg(id order by created_at))[1] as sobreviviente,
         count(*) as hilos
  from wa_conversaciones group by telefono having count(*) > 1
) g on g.telefono = c.telefono
where c.id <> g.sobreviviente;

-- Estado que se lleva la sobreviviente: activa si alguna lo estaba.
update wa_conversaciones s set estado = 'active'
where s.id in (select sobreviviente from fusion)
  and exists (select 1 from wa_conversaciones p join fusion f on f.perdedora = p.id
              where f.sobreviviente = s.id and p.estado = 'active');

-- Datos que solo tenga la perdedora y le falten a la sobreviviente.
update wa_conversaciones s
set contact_id = coalesce(s.contact_id, p.contact_id),
    company_id = coalesce(s.company_id, p.company_id),
    phone_number_id = coalesce(s.phone_number_id, p.phone_number_id)
from fusion f join wa_conversaciones p on p.id = f.perdedora
where s.id = f.sobreviviente;

-- Mover a los hijos que guardan información.
update wa_mensajes    m set conversation_id = f.sobreviviente from fusion f where m.conversation_id = f.perdedora;
update wa_notas       n set conversation_id = f.sobreviviente from fusion f where n.conversation_id = f.perdedora;
update wa_eventos     e set conversation_id = f.sobreviviente from fusion f where e.conversation_id = f.perdedora;
update wa_llamadas    l set conversation_id = f.sobreviviente from fusion f where l.conversation_id = f.perdedora;
update wa_programados g set conversation_id = f.sobreviviente from fusion f where g.conversation_id = f.perdedora;

-- Lecturas y presencia son estado efímero por usuario y tienen únicos propios:
-- se descartan en vez de moverse, para no chocar.
delete from wa_lecturas  where conversation_id in (select perdedora from fusion);
delete from wa_presencia where conversation_id in (select perdedora from fusion);

delete from wa_conversaciones where id in (select perdedora from fusion);

-- Recalcular el resumen del hilo ya unido.
update wa_conversaciones c set
  ultimo_mensaje_at    = x.ult,
  ultimo_mensaje_texto = x.texto,
  ultima_direccion     = x.dir,
  ultimo_entrante_at   = x.ent,
  ultimo_saliente_at   = x.sal
from (
  select m.conversation_id cid,
         max(m.created_at) ult,
         (array_agg(m.cuerpo     order by m.created_at desc))[1] texto,
         (array_agg(m.direccion  order by m.created_at desc))[1] dir,
         max(m.created_at) filter (where m.direccion = 'entrante') ent,
         max(m.created_at) filter (where m.direccion = 'saliente') sal
  from wa_mensajes m group by m.conversation_id
) x
where c.id = x.cid and c.telefono in ('+525610353669', '+529171166173');

commit;
