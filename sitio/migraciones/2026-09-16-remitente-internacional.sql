-- 16-sep-2026 · Un segundo remitente para el correo en frío de fuera de México.
--
-- POR QUÉ. El calentamiento de un dominio es lento a propósito: +30% cada tres
-- días con envíos reales, de 15 a 320. Hoy el dominio de México (news) va en
-- el día 3 —unos 20 correos al día— y sus cinco goteos ya piden 73-95 diarios.
-- Meter encima once países (España sola son 923 cuentas con correo, 7,400
-- correos) sería poner a todos a hacer fila: el correo del día 4 llegaría el
-- día 25, que es peor que no mandarlo. Y si una base nueva rebota o le marcan
-- spam, hoy se lleva por delante al dominio con el que se le escribe a los
-- clientes —en SendGrid la supresión es de CUENTA—.
--
-- QUÉ HACE. Da de alta el inquilino `sacs-intl` (intl.sacscloud.com) para
-- España y Latinoamérica, con su propia rampa, su propio tope y sus propias
-- semillas. México no se entera: sigue saliendo por news.sacscloud.com.
--
-- CÓMO SE ENCIENDE. Queda `activo=false` y `abm_config.tenant_slug_intl` vacío
-- a propósito: mientras esté vacío, el cron manda TODO por el remitente de
-- siempre y nada cambia. Se llena cuando el dominio esté autenticado en
-- SendGrid y sus CNAME validados. Entonces: activo=true y el slug en config.
begin;

-- `owner_team_member_id` va con dueño a propósito: hay un índice único que
-- reserva el inquilino SIN dueño para el de casa (uq_email_tenants_sacs), y
-- este no es el de casa.
insert into email_tenants (slug, nombre, from_nombre, from_email, reply_to, direccion_fisica,
                           aviso_privacidad_url, motivo_recepcion, limite_diario, timezone,
                           ventana_inicio, ventana_fin, enviar_fines_semana, activo, sitio_url, semillas,
                           owner_team_member_id)
select 'sacs-intl', t.nombre, t.from_nombre, 'aaron@intl.sacscloud.com', t.reply_to, t.direccion_fisica,
       t.aviso_privacidad_url,
       -- El motivo real del correo en frío lo pone el pipeline (MOTIVO_FRIO);
       -- este es el de respaldo, y dice la verdad igual.
       'Recibes este correo porque tu negocio aparece en directorios públicos de internet y creemos que Sacs te puede servir. Nadie nos dio tus datos.',
       320, t.timezone, t.ventana_inicio, t.ventana_fin, false, false, t.sitio_url, '{}'::text[],
       '60be8bd8-995a-45ca-926f-1bcb159d3c1e'
  from email_tenants t where t.slug = 'sacs'
 on conflict (slug) do nothing;

insert into abm_config (clave, valor, nota) values
  ('tenant_slug_intl', '',
   'Remitente del correo en frío de España y Latinoamérica (email_tenants.slug). VACÍO = todo sale por tenant_slug, como siempre. Se llena con «sacs-intl» cuando intl.sacscloud.com esté autenticado y validado en SendGrid.')
 on conflict (clave) do nothing;

commit;

select slug, from_email, activo, limite_diario from email_tenants order by slug;
