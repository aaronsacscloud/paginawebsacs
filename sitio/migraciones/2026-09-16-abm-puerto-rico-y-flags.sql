-- 16-sep-2026 · Lo que quedó suelto de la revisión del barrido.
--
-- 1 · D'Royal Bride es de PUERTO RICO, no de República Dominicana. Entró
--     porque `e164` daba por dominicano cualquier número del +1: sus tres
--     teléfonos son +1787. Puerto Rico no está en la lista de países ni tiene
--     guion, landing ni moneda propia en el sistema, así que no se le escribe:
--     queda en pausa con su motivo. El arreglo de raíz (regex nacional por
--     país, DO = 809/829/849) ya está en paises.py.
-- 2 · Recalcular `tiene_email` / `tiene_wa` con la misma regla del trigger:
--     después de invalidar canales, una cuenta puede seguir marcada como
--     contactable sin tener por dónde. De paso se recalcula la accesibilidad,
--     que le daba puntos de más a las 82 cuentas argentinas cuyo WhatsApp no
--     abría ninguna conversación.
begin;

update abm_cuentas set etapa = 'en_pausa',
       pausa_motivo = 'Es de Puerto Rico (+1787), no de República Dominicana: no hay guion ni página para ese mercado.'
 where id = 'cd104ec2-fc2a-4616-ba04-0b5cb05c1845';

with k as (
  select cuenta_id,
         bool_or(tipo like 'email%' and estado not in ('invalido','rebote')) em,
         bool_or(tipo like 'whatsapp%' and estado in ('declarado','valido')) wa
    from abm_canales group by cuenta_id)
update abm_cuentas a
   set tiene_email = coalesce(k.em, false), tiene_wa = coalesce(k.wa, false),
       accesibilidad = least(25, (case when coalesce(k.em, false) then 12 else 0 end) + (case when coalesce(k.wa, false) then 8 else 0 end)),
       updated_at = now()
  from (select a2.id, k.em, k.wa from abm_cuentas a2 left join k on k.cuenta_id = a2.id) k
 where k.id = a.id
   and (a.tiene_email is distinct from coalesce(k.em, false) or a.tiene_wa is distinct from coalesce(k.wa, false));

commit;

select pais, count(*) cuentas, count(*) filter (where tiene_email) correo, count(*) filter (where tiene_wa) wa,
       count(*) filter (where tiene_email or tiene_wa) contactables
  from abm_cuentas where giro = 'novias' and pais <> 'México' group by 1 order by 2 desc;
