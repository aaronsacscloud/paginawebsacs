-- ═══ Datos fiscales del cliente: parte del ALTA obligatoria ═══════════════
-- Medido al construirlo: 82 clientes activos, TODOS sin RFC ni razón social.
-- Los campos existían pero llenar «cuando haya tiempo» es nunca; ahora son
-- parte del trámite del alta y el recuadro de la ficha no se cierra sin ellos.
begin;
alter table companies
  add column if not exists regimen_fiscal text,
  add column if not exists cp_fiscal text,
  add column if not exists constancia_fiscal_url text,
  add column if not exists constancia_fiscal_nombre text;
comment on column companies.constancia_fiscal_url is
  'PDF/imagen de la constancia de situación fiscal, subida desde la ficha (bucket quotes/fiscales).';
commit;
