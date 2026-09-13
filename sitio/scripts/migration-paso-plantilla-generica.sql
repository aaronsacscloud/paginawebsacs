-- 13-sep-2026 · Cuando falta el dato, el paso manda la versión GENERAL en vez de callarse.
--
-- El WhatsApp del día 2 de rezagados habla de su negocio («zapatería, con dos
-- tiendas»), y de 76 rezagados solo 2 tienen esos datos. Con el resolutor de
-- variables, a los otros 74 el paso se les saltaba: quedaban sin mensaje.
--
-- Decisión del dueño: a esos mándales una versión general, donde lo primero es
-- conocer qué hacen. Cada paso puede llevar entonces DOS pares:
--   · el específico  (wa_plantilla + wa_plantilla_utility)       — si hay datos
--   · el general     (wa_plantilla_generica + su utility)        — si faltan
-- Son dos caídas distintas y por eso son dos campos distintos: una es «no tengo
-- el dato», la otra es «Meta frenó el marketing».
alter table crm_secuencia_pasos add column if not exists wa_plantilla_generica text;
alter table crm_secuencia_pasos add column if not exists wa_plantilla_generica_utility text;
update crm_secuencia_pasos
  set wa_plantilla_generica = 'rezagado_general_v1',
      wa_plantilla_generica_utility = 'rezagado_general_utility_v1'
  where wa_plantilla = 'rezagado_cuenta_v2';
