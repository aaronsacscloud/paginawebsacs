-- El nombre con el que se le llama al cliente en persona. No es la razón social
-- —esa es para facturar y casi nunca está capturada— ni la cuenta SACS, que
-- viene pegada y en minúsculas ("supercarnesriveramx").
--
-- La lista de Clientes mostraba el nombre del CONTACTO como título, así que un
-- renglón decía "Oscar Rivera" cuando el cliente es Super Carnes Rivera.
alter table companies add column if not exists nombre_comercial text;
comment on column companies.nombre_comercial is
  'Nombre con el que se conoce a la empresa. Se sugiere partiendo la cuenta SACS y se puede editar.';
