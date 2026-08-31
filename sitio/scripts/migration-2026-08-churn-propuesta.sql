-- ═══ CHURN · propuesta de rescate + observación posterior ════════════════
--
-- DOS cosas que el módulo necesitaba y no tenía.
--
-- 1 · LA PROPUESTA no inventa tabla: es una COTIZACIÓN con forma de rescate.
--     El sistema de cotizaciones ya hace las cinco cosas que hacen falta y
--     está vivo (medido: 51 documentos, 17 aceptadas con firma, 5 con
--     aperturas reales del cliente): PDF, link público, conteo de vistas que
--     ignora al equipo, aceptación firmada y cron de recordatorios. Un
--     segundo motor de documentos daría dos PDFs, dos rastreos y dos verdades
--     sobre si el cliente ya lo vio.
--
-- 2 · RECUPERADO NO ES EL FINAL. Un cliente que volvió es frágil: se fue una
--     vez y las razones que lo hicieron irse siguen ahí hasta que se prueban
--     resueltas. Se queda EN LA SECCIÓN, en observación, hasta que el uso
--     demuestra que se quedó — y solo entonces se gradúa.

-- ── 1 · La propuesta ─────────────────────────────────────────────────────
alter table quotes add column if not exists churn_caso_id uuid references churn_casos(id) on delete set null;
alter table quotes add column if not exists tipo text;                    -- 'rescate' | null (cotización normal)
alter table quotes add column if not exists rescate_desde date;
alter table quotes add column if not exists rescate_hasta date;
alter table quotes add column if not exists rescate_mrr_regreso numeric;
-- Lo que NOSOTROS nos comprometemos a hacer. Es el bloque que de verdad
-- rescata: el 65% del MRR perdido se fue por servicio, no por precio.
alter table quotes add column if not exists rescate_compromisos jsonb default '[]'::jsonb;
-- Y lo que esperamos del cliente. Una gracia sin contraparte se vuelve un
-- cliente gratis pasivo, y el dato ya dice que la gracia fracasa cuando no lo usan.
alter table quotes add column if not exists rescate_esperamos text;

create index if not exists quotes_churn_caso on quotes (churn_caso_id) where churn_caso_id is not null;

-- ── 2 · La observación posterior ─────────────────────────────────────────
-- Hasta cuándo se le sigue de cerca después de recuperarlo.
alter table churn_casos add column if not exists observacion_hasta date;
-- La foto del uso al abrir el caso: sin ella no se puede decir «lo usa MÁS
-- que antes de irse», que es la única prueba de que el rescate funcionó.
alter table churn_casos add column if not exists uso_al_abrir jsonb;
-- Y la del momento de recuperarlo, para medir el tramo de la gracia.
alter table churn_casos add column if not exists uso_al_recuperar jsonb;
alter table churn_casos add column if not exists propuesta_id uuid references quotes(id) on delete set null;

-- La etapa nueva: se graduó. Terminal y BUENA — distinta de «irrecuperable»,
-- que también es terminal pero es la mala. Sin separarlas, el embudo no
-- podría decir cuántos rescates de verdad aguantaron.
alter table churn_casos drop constraint if exists churn_etapa_valida;
alter table churn_casos add constraint churn_etapa_valida
  check (etapa in ('detectado','conciliacion','gracia','recuperado','estable','irrecuperable'));

alter table churn_casos drop constraint if exists churn_resultado_valido;
alter table churn_casos add constraint churn_resultado_valido
  check (resultado is null or resultado in ('recuperado','perdido'));

-- Recuperado y estable exigen la suscripción que los respalda: un recuperado
-- que no paga mentiría en la ARR, y uno graduado más todavía.
alter table churn_casos drop constraint if exists churn_recuperado_con_sub;
alter table churn_casos add constraint churn_recuperado_con_sub
  check (etapa not in ('recuperado','estable') or subscription_nueva_id is not null);

-- El caso deja de estar «abierto» al graduarse, no al recuperarse: mientras
-- está en observación sigue siendo trabajo de alguien.
drop index if exists churn_casos_uno_abierto;
create unique index if not exists churn_casos_uno_abierto
  on churn_casos (company_id) where etapa not in ('estable','irrecuperable');

create index if not exists churn_casos_observacion on churn_casos (observacion_hasta) where etapa = 'recuperado';
