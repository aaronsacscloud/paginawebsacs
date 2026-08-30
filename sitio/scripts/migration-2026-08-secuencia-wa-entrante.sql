-- Secuencia por EVENTO: "llega un WhatsApp" en vez de "día N después de entrar".
--
-- Todo lo que se acordó sobre el WhatsApp entrante —el acuse, el horario, el
-- candado de 24 h, la pausa cuando una persona toma el hilo, el etiquetado por
-- CTA y el candado de cierre— vivía repartido entre constantes de código y
-- wa_config. Aquí se junta en UNA fila que se ve y se edita desde Secuencias.
begin;

alter table crm_secuencias
  add column if not exists disparador text not null default 'tiempo';

comment on column crm_secuencias.disparador is
  'tiempo = pasos por día desde que entra (el modelo de siempre). wa_entrante = reacciona a un WhatsApp del lead.';

insert into crm_secuencias (nombre, descripcion, activa, disparador, objetivo, corte_dias, entrada)
select
  'WhatsApp entrante · atención y control',
  'Qué pasa cuando un lead nos escribe por WhatsApp: el acuse que recibe según la hora, de qué CTA venía, a quién se le avisa y con cuánto contexto, y los candados que evitan saturarlo o perderlo.',
  false, 'wa_entrante', 'respondio', 0,
  jsonb_build_object(
    'acuse', jsonb_build_object(
      'activo', true,
      'en_horario', 'Te leo 👋 Soy Andrea, consultora de moda en Sacs. Dame unos minutos y te contesto por aquí mismo.',
      'fuera', 'Te leo 👋 Soy Andrea, consultora de moda en Sacs. Ahorita ya estamos fuera de horario — te contesto en cuanto abramos, a partir de las 9 de la mañana.',
      'rearme_horas', 20
    ),
    'horario', jsonb_build_object('dias', jsonb_build_array(1,2,3,4,5,6), 'desde', '09:00', 'hasta', '19:00'),
    'presion', jsonb_build_object(
      'horas_entre_whatsapps', 24,
      'dias_pausa_por_manual', 5,
      'permitir_forzar_manual', true
    ),
    'intencion', jsonb_build_object(
      'etiquetar', true,
      'notificar', true,
      'solo_desde_cta', true
    ),
    'cierre', jsonb_build_object('bloquear_con_no_leidos', true)
  )
where not exists (select 1 from crm_secuencias where disparador = 'wa_entrante');

commit;
