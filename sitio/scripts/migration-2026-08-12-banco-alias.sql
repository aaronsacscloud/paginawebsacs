-- Con dos cuentas del mismo banco el selector las listaba idénticas ("BBVA",
-- "BBVA") y no había forma de saber cuál era la de pesos y cuál la de dólares.
alter table bank_accounts add column if not exists alias text;
comment on column bank_accounts.alias is
  'Nombre corto para distinguirla en el selector: "BBVA pesos", "Santander dólares".';
