-- Unir fichas duplicadas de un lead.
--
-- Vive en la base y no en el endpoint a propósito: son 27 tablas las que
-- apuntan a un contacto, y hacerlo con 27 updates sueltos desde el navegador
-- deja la fusión a medias en cuanto uno falle — con la mitad de la historia
-- repuntada y la otra mitad colgando de una ficha ya archivada. Aquí es una
-- sola transacción: o queda todo, o no queda nada.
create or replace function public.unir_leads(
  p_principal uuid,
  p_otras uuid[],
  p_dry_run boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pri contacts%rowtype;
  v_otra contacts%rowtype;
  v_correos text[] := '{}';
  v_props jsonb;
  v_resumen jsonb := '{}'::jsonb;
  v_acts int := 0; v_reus int := 0; v_cots int := 0;
  v_llenados jsonb := '[]'::jsonb;
  v_creado timestamptz;
  t text;
begin
  select * into v_pri from contacts where id = p_principal;
  if not found then raise exception 'La ficha principal no existe.'; end if;
  if v_pri.archived_at is not null then raise exception 'La ficha principal está archivada.'; end if;

  -- Candado: unir solo entre leads. Si una ya es cliente hay suscripciones y
  -- pagos de por medio, y eso no se resuelve con un botón.
  if v_pri.lifecycle_stage = 'cliente' then
    raise exception 'La ficha principal ya es cliente: eso se une desde la ficha del cliente.';
  end if;
  if exists (select 1 from contacts where id = any(p_otras) and lifecycle_stage = 'cliente') then
    raise exception 'Una de las fichas ya es cliente: eso se une desde la ficha del cliente.';
  end if;
  if p_principal = any(p_otras) then
    raise exception 'La ficha principal no puede estar también en la lista de las que se absorben.';
  end if;

  v_props := coalesce(v_pri.propiedades, '{}'::jsonb);
  v_creado := v_pri.created_at;

  for v_otra in select * from contacts where id = any(p_otras) and archived_at is null loop
    -- 1) Los campos vacíos de la principal se llenan con los de la otra. Nunca
    --    al revés: lo que la principal ya tiene no se pisa.
    if coalesce(v_pri.apellido,'') = '' and coalesce(v_otra.apellido,'') <> '' then
      v_pri.apellido := v_otra.apellido; v_llenados := v_llenados || jsonb_build_array('apellido');
    end if;
    if coalesce(v_pri.telefono,'') = '' and coalesce(v_otra.telefono,'') <> '' then
      v_pri.telefono := v_otra.telefono; v_llenados := v_llenados || jsonb_build_array('telefono');
    end if;
    if coalesce(v_pri.whatsapp,'') = '' and coalesce(v_otra.whatsapp,'') <> '' then
      v_pri.whatsapp := v_otra.whatsapp; v_llenados := v_llenados || jsonb_build_array('whatsapp');
    end if;
    if coalesce(v_pri.puesto,'') = '' and coalesce(v_otra.puesto,'') <> '' then
      v_pri.puesto := v_otra.puesto; v_llenados := v_llenados || jsonb_build_array('puesto');
    end if;
    if coalesce(v_pri.rol,'') = '' and coalesce(v_otra.rol,'') <> '' then v_pri.rol := v_otra.rol; end if;
    if coalesce(v_pri.giro,'') = '' and coalesce(v_otra.giro,'') <> '' then
      v_pri.giro := v_otra.giro; v_llenados := v_llenados || jsonb_build_array('giro');
    end if;
    if v_pri.sucursales_interes is null and v_otra.sucursales_interes is not null then
      v_pri.sucursales_interes := v_otra.sucursales_interes; v_llenados := v_llenados || jsonb_build_array('sucursales');
    end if;
    if v_pri.company_id is null and v_otra.company_id is not null then
      v_pri.company_id := v_otra.company_id; v_llenados := v_llenados || jsonb_build_array('empresa');
    end if;
    if coalesce(v_pri.proximo_paso,'') = '' and coalesce(v_otra.proximo_paso,'') <> '' then v_pri.proximo_paso := v_otra.proximo_paso; end if;
    if v_pri.next_followup is null then v_pri.next_followup := v_otra.next_followup; end if;
    -- La atribución de la PRIMERA visita es la buena: si la principal llegó sin
    -- campaña y la otra sí la traía, esa es la que explica de dónde salió.
    if coalesce(v_pri.utm_source,'') = '' and coalesce(v_otra.utm_source,'') <> '' then
      v_pri.utm_source := v_otra.utm_source; v_pri.utm_medium := v_otra.utm_medium; v_pri.utm_campaign := v_otra.utm_campaign;
      v_llenados := v_llenados || jsonb_build_array('atribución');
    end if;
    -- El toque más reciente y el puntaje más alto de las dos.
    v_pri.last_contact_at := greatest(coalesce(v_pri.last_contact_at, '-infinity'::timestamptz), coalesce(v_otra.last_contact_at, '-infinity'::timestamptz));
    if v_pri.last_contact_at = '-infinity'::timestamptz then v_pri.last_contact_at := null; end if;
    v_pri.lead_score := greatest(coalesce(v_pri.lead_score,0), coalesce(v_otra.lead_score,0));
    -- "Llegó" es la fecha de la ficha MÁS VIEJA del grupo, aunque la principal
    -- sea otra: el lead entró ese día, no el día de la copia.
    if v_otra.created_at < v_creado then v_creado := v_otra.created_at; end if;

    -- 2) El correo que no se queda no se tira: se guarda como alterno para que
    --    el buscador lo siga encontrando. Se ignora si es el mismo con otra
    --    capitalización, que es el caso de casi todos los duplicados de hoy.
    if coalesce(v_otra.email,'') <> '' and lower(trim(v_otra.email)) <> lower(trim(coalesce(v_pri.email,''))) then
      v_correos := v_correos || lower(trim(v_otra.email));
    end if;

    -- Las propiedades de la otra solo rellenan huecos.
    v_props := coalesce(v_otra.propiedades,'{}'::jsonb) || v_props;
  end loop;

  select count(*) into v_acts from activities where contact_id = any(p_otras);
  select count(*) into v_reus from bookings   where contact_id = any(p_otras);
  select count(*) into v_cots from quotes     where contact_id = any(p_otras);

  v_resumen := jsonb_build_object(
    'principal', p_principal,
    'absorbidas', to_jsonb(p_otras),
    'actividades', v_acts, 'reuniones', v_reus, 'cotizaciones', v_cots,
    'campos_llenados', v_llenados,
    'correos_alternos', to_jsonb(v_correos),
    'llego', v_creado
  );

  if p_dry_run then return v_resumen; end if;

  -- 3) Repuntar todo lo que cuelga de las otras fichas.
  --
  -- Las cuatro tablas con índice único sobre contact_id se limpian primero: si
  -- las dos fichas están inscritas en la misma automatización, repuntar la
  -- segunda revienta el índice. Se queda la fila de la principal.
  delete from automation_enrollments o
   where o.contact_id = any(p_otras) and o.estado = 'activo'
     and exists (select 1 from automation_enrollments p where p.contact_id = p_principal and p.automation_id = o.automation_id and p.estado = 'activo');
  delete from partner_commissions o
   where o.contact_id = any(p_otras) and o.tipo = 'prueba_gratis'
     and exists (select 1 from partner_commissions p where p.contact_id = p_principal and p.tipo = 'prueba_gratis');
  delete from web_disparos o
   where o.contact_id = any(p_otras)
     and exists (select 1 from web_disparos p where p.contact_id = p_principal and p.regla_id = o.regla_id and p.dia = o.dia);
  delete from web_descartes o
   where o.contact_id = any(p_otras)
     and exists (select 1 from web_descartes p where p.contact_id = p_principal and p.regla_id = o.regla_id and p.motivo = o.motivo and p.dia = o.dia);

  foreach t in array array[
    'activities','automation_enrollments','bookings','churn_events','contact_visits',
    'crm_soporte_tickets','deals','email_campaign_recipients','email_conversations',
    'email_list_members','email_no_alcanzados','email_presion','email_sends',
    'email_suppressions','email_unsubscribes','expansion_signals','invoices',
    'partner_commissions','partner_invitations','payments','product_events','quotes',
    'subscriptions','wa_broadcast_destinatarios','wa_conversaciones','web_disparos','web_descartes'
  ] loop
    execute format('update %I set contact_id = $1 where contact_id = any($2)', t) using p_principal, p_otras;
  end loop;
  update gifts set redeemed_by_contact = p_principal where redeemed_by_contact = any(p_otras);

  -- 4) Guardar la principal ya completa.
  update contacts set
    apellido = v_pri.apellido, telefono = v_pri.telefono, whatsapp = v_pri.whatsapp,
    puesto = v_pri.puesto, rol = v_pri.rol, giro = v_pri.giro,
    sucursales_interes = v_pri.sucursales_interes, company_id = v_pri.company_id,
    proximo_paso = v_pri.proximo_paso, next_followup = v_pri.next_followup,
    utm_source = v_pri.utm_source, utm_medium = v_pri.utm_medium, utm_campaign = v_pri.utm_campaign,
    last_contact_at = v_pri.last_contact_at, lead_score = v_pri.lead_score,
    created_at = v_creado,
    propiedades = case when array_length(v_correos,1) is null then v_props
                       else v_props || jsonb_build_object('correos_alternos',
                         to_jsonb(array(select distinct unnest(v_correos || coalesce(array(select jsonb_array_elements_text(v_props->'correos_alternos')), '{}'))))) end,
    updated_at = now()
  where id = p_principal;

  -- 5) Las otras NO se borran: se archivan apuntando a la que se quedó. Si esto
  --    sale mal, se devuelve; un delete no.
  update contacts set
    archived_at = now(),
    propiedades = coalesce(propiedades,'{}'::jsonb) || jsonb_build_object('fusionada_en', p_principal, 'fusionada_at', now()),
    updated_at = now()
  where id = any(p_otras);

  -- 6) Queda en la historia de la ficha, no solo en un log.
  insert into activities (contact_id, company_id, tipo, titulo, descripcion, metadata, automatico)
  values (p_principal, v_pri.company_id, 'sistema',
    'Se unieron ' || (array_length(p_otras,1) + 1) || ' fichas duplicadas',
    'Se trajeron ' || v_acts || ' actividades, ' || v_reus || ' reuniones y ' || v_cots || ' cotizaciones.',
    v_resumen, true);

  return v_resumen;
end;
$$;
