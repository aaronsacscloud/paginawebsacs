-- PIE CORPORATIVO Y FIRMA POR DEFECTO EN TODO CORREO (13-sep-2026).
--
-- El dueño pidió que TODOS los correos, de todas las cadencias, lleven: quién
-- lo manda (con la foto en circulito), «visita nuestro sitio web», «visita
-- nuestro TikTok», la dirección de la oficina en Querétaro, el aviso de
-- confidencialidad y la nota de «queremos eliminar el papel».
--
-- Nada de eso va en una constante del código: es del INQUILINO (un partner
-- pondrá su sitio, su TikTok y su dirección). Por eso son columnas de
-- email_tenants y el compilador/pie las leen de ahí.
begin;
alter table email_tenants
  add column if not exists sitio_url        text,
  add column if not exists tiktok_url       text,
  add column if not exists confidencialidad text,
  add column if not exists nota_papel       text,
  add column if not exists firma_nombre     text,
  add column if not exists firma_puesto     text,
  add column if not exists firma_foto_url   text;

comment on column email_tenants.firma_nombre is 'Firma que se agrega sola al final de un correo que no trae bloque firma.';

update email_tenants set
  nombre           = 'Sacscloud',
  direccion_fisica = 'Senda de la Inspiración 19, Milenio III, 76060 Santiago de Querétaro, Querétaro, México',
  sitio_url        = 'https://www.sacscloud.com',
  tiktok_url       = 'https://www.tiktok.com/@sacsoficial',
  confidencialidad = 'Este correo y sus anexos son confidenciales y para uso exclusivo de la persona a la que van dirigidos. Si lo recibiste por error, avísanos respondiendo a este mensaje y bórralo: no está permitido copiarlo, guardarlo ni compartirlo.',
  nota_papel       = 'En Sacscloud queremos eliminar el papel. Antes de imprimir este correo, piensa si de verdad lo necesitas.',
  firma_nombre     = 'Andrea Gutiérrez Araujo',
  firma_puesto     = 'Tu consultora en Sacs',
  firma_foto_url   = 'https://www.sacscloud.com/images/andrea-consultora.jpg',
  updated_at       = now()
where slug = 'sacs';
commit;
