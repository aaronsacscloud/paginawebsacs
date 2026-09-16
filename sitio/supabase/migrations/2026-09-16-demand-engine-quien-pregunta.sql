-- DEMAND ENGINE · quién pregunta: cliente o desconocido.
--
-- EL ERROR DE DISEÑO: se le estaba pidiendo a un modelo que adivinara, leyendo
-- el texto, si quien escribió ya era cliente. Y el CRM lo sabe como HECHO: la
-- conversación de WhatsApp está ligada a un contacto y a una empresa, y la
-- empresa tiene o no tiene suscripción.
--
-- Se notó al cambiar de modelo. Cosas como «el cajero tiene permisos que no
-- debería tener» o «cómo saber si dejé una sesión abierta» salían etiquetadas
-- como demanda de MERCADO —o sea, algo que atraer con una página— cuando son
-- clientes usando el producto. Un modelo puede equivocarse en eso; una llave
-- foránea no.
--
-- La regla que queda: lo que el CRM sabe, no se pregunta. Al modelo se le deja
-- lo que solo él puede hacer —entender qué está pidiendo la persona— y los
-- hechos se leen de donde están.
--
-- Definición de cliente (la del CRM, ver la memoria del proyecto): empresa con
-- alguna suscripción que NO esté cancelada. Las vitalicias viven en estado
-- 'programada', así que filtrar por 'activa' dejaría fuera a un tercio.

update de_senales s set fuente = 'whatsapp_cliente'
where s.fuente = 'whatsapp'
  and exists (
    select 1 from wa_conversaciones w
    join companies e on e.id = w.company_id
    join subscriptions su on su.company_id = e.id and su.estado <> 'cancelada'
    where w.id = (s.payload->>'conversacion')::uuid
  );

update de_senales s set fuente = 'whatsapp_prospecto'
where s.fuente = 'whatsapp';

-- Soporte, mejoras y churn vienen por definición de clientes actuales; la
-- agenda y las pérdidas, de gente que todavía no lo era.
update de_conectores set config = config || '{"fuentes_de_cliente":["whatsapp_cliente","soporte","mejoras","churn"]}'::jsonb
where id = 'crm';

select de_recontar_clusters();
