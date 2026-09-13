-- Novias COMPLETADAS con el DENUE del INEGI (13-sep-2026).
--
-- No se importó ningún negocio nuevo: la lista de cuentas sigue siendo la que
-- salió del barrido de Google Maps. Lo que hace esto es LLENARLE el correo y el
-- sitio a las que ya habíamos elegido.
--
-- El cruce, en orden de confianza, parando en el primero que pega:
--   1. TELÉFONO exacto a 10 dígitos (72 empates). Dos fuentes independientes
--      dando el mismo número es la prueba más fuerte de que es el mismo negocio.
--   2. DOMINIO del sitio (19).
--   3. NOMBRE normalizado + MISMO MUNICIPIO (89), y solo cuando el nombre es
--      ÚNICO en ese municipio: "NOVIAS KARLA" hay en varios estados, así que
--      nunca se cruza por nombre a secas.
-- Empataron 180 de 629 cuentas.
--
-- Los 61 correos encontrados pasaron por verificación de MX y 4 se cayeron
-- (bridenformal.com.mx, dceromina.com.mx, lupanavilchez.com, noviasangelica.com):
-- sin MX no reciben correo y solo sirven para juntar rebotes. Es la misma
-- regla que atajó a mivestido@tiscaeno.mx.
--
-- Confianza ALTA: el DENUE es el censo oficial del INEGI, no un raspado.
-- Fuente: denue_00_46321-46531_csv.zip, clase SCIAN 463214 "disfraces,
-- vestimenta regional y vestidos de novia" (10,169 establecimientos).
insert into abm_canales (cuenta_id, tipo, valor, confianza, es_de_la_tienda, estado) values
('bfc3e291-e0c9-4e54-bb3d-e3ea6f014333','email_generico','hector@imagennovias.com.mx','alta',true,'sin_probar'),
('ab7b9e1c-86fe-46a8-9cbf-87cdab0f51ea','email_generico','ventasinnovia@gmail.com','alta',true,'sin_probar'),
('ae46a46a-4d93-48e3-91a6-5d273343bb4d','email_generico','info@mabyrosas.com','alta',true,'sin_probar'),
('da59b4d4-027b-4eb4-93df-0ca76977312c','email_generico','marsalanovias@gmail.com','alta',true,'sin_probar'),
('34cf2ec3-cf3b-409c-8b45-d4821f114370','email_generico','malibenovias@gmail.com','alta',true,'sin_probar'),
('99db7eca-6713-4bbb-81a1-6facda0f617f','email_generico','ventas@sacramentonovias.com','alta',true,'sin_probar'),
('842c3d90-6a3d-42f5-b951-108b49bcd911','email_generico','mtrogo@davidsbridal.com.mx','alta',true,'sin_probar'),
('b53a79f5-6eba-4804-b8eb-07b7620d2ad4','email_generico','rosemarynovia@gmail.com','alta',true,'sin_probar'),
('62f134f3-0dbe-4cc5-b2aa-9632069a48dc','email_generico','monique.novias@gmail.com','alta',true,'sin_probar'),
('fbd51bc3-f714-47e2-badb-ac168bfa257c','email_generico','stellari@hotmail.com','alta',true,'sin_probar'),
('1091e7b6-9458-443b-9e27-5be2c3819f29','email_generico','florf.f@hotmail.com','alta',true,'sin_probar'),
('927f74fb-2c90-43bc-b4c4-fa0560e64457','email_generico','vestidosdeluigi@gmail.com','alta',true,'sin_probar'),
('abfeff4d-3450-4ca5-a252-cfd82dc564de','email_generico','lauraerob1@outlook.es','alta',true,'sin_probar'),
('666e3f44-1c12-4fd0-ac23-ff3abaa9a57f','email_generico','ojmm@hotmail.com','alta',true,'sin_probar'),
('9a1b8366-1cdb-4bb6-b379-09ca178c0516','email_generico','natbridal32@gmail.com','alta',true,'sin_probar'),
('ca57c2c0-fbc7-4cae-a374-f9c8ee0ff295','email_generico','noviasly@gmail.com','alta',true,'sin_probar'),
('3ba24426-6ff4-42bd-9ea5-1999fdc6f531','email_generico','novias.insurgentes@gmail.com','alta',true,'sin_probar'),
('1d687be7-98a1-4c9e-b0c4-ecd77abb2f83','email_generico','rromo@corporativoandalucia.com','alta',true,'sin_probar'),
('1bc5fe78-4ba1-4ab3-98f9-b56c445ea942','email_generico','novia2003@gmail.com','alta',true,'sin_probar'),
('14232ce5-2a83-459b-aa7c-ef74dc5b7af6','email_generico','cp_gilbertoalvarez@live.com.mx','alta',true,'sin_probar'),
('076ba469-d9fb-415e-87f1-ea3b9e772851','email_generico','sieprenovias@gmail.com','alta',true,'sin_probar'),
('1eccd701-8dae-445e-a095-7e46022be035','email_generico','euronovias@noviasmid.com','alta',true,'sin_probar'),
('51211162-6b26-451c-919a-2a85080eef24','email_generico','sposa_europa@gmail.com','alta',true,'sin_probar'),
('ee4596ca-2921-4756-8cc7-e29bbe714351','email_generico','juliodiego1983@hotmail.com','alta',true,'sin_probar'),
('af458460-81d1-424a-a522-6ad559e363a6','email_generico','laesposaxalapa@hotmail.com','alta',true,'sin_probar'),
('7a981ded-e1dd-492e-902c-e83861a3b1bb','email_generico','l_chantres@hotmail.com','alta',true,'sin_probar'),
('c781aa58-83f2-48dc-a09f-05b4726908bc','email_generico','casabianconovias@hotmail.com','alta',true,'sin_probar'),
('395086c1-4ae1-497b-b737-4aff777aa533','email_generico','gutierezhernandezleticia@gmail.com','alta',true,'sin_probar'),
('0b2c0b80-576c-43c2-ae0f-ff882fbe75f5','email_generico','central_novias@gruponabu.com','alta',true,'sin_probar'),
('8c736ae3-046c-4237-8f01-30c428d4046c','email_generico','info@bellenovia.com','alta',true,'sin_probar'),
('aa481134-cf66-4888-87e2-6da477999e26','email_generico','novias.liin@hotmail.com','alta',true,'sin_probar'),
('1321a8da-f2fb-4be5-8513-1759facbaa4f','email_generico','lafayette@hotmail.com','alta',true,'sin_probar'),
('d0d43c90-a380-4087-adff-3028d4b78b73','email_generico','divanovias@hotmail.com','alta',true,'sin_probar'),
('726f1b80-e3b8-40b0-8ae6-dd26be73f3aa','email_generico','espemendoavi@hotmail.com','alta',true,'sin_probar'),
('bf207e87-842c-4153-85e4-3cdedc54d699','email_generico','noviaspamela1@hotmail.com','alta',true,'sin_probar'),
('29c7d8c5-3573-4713-ae80-7c94118b51c1','email_generico','andreasbridalmx@gmail.com','alta',true,'sin_probar'),
('ac497140-40bd-4469-a41e-ffc7bc36b840','email_generico','btobe2686@gmail.com','alta',true,'sin_probar'),
('df07b0c4-d2c8-4b03-a1f4-6f6a305461a2','email_generico','blancodenoviamx@gmail.co','alta',true,'sin_probar'),
('f1e385ae-4cb7-4fa2-8ba9-b7fc7ee40015','email_generico','sotolv@hotmail.com','alta',true,'sin_probar'),
('5d589fe7-70d9-41cc-9898-ab72fa5679fa','email_generico','blablazu@hotmail.com','alta',true,'sin_probar'),
('fa33ddfa-a582-40a1-8fd8-ed15a80616c6','email_generico','edith_central1@hotmail.com','alta',true,'sin_probar'),
('c71074d7-626c-4a14-bdce-8fc96a501233','email_generico','anaferronovias@gmail.com','alta',true,'sin_probar'),
('17b70a55-5e9f-43f2-bce1-e1eac7461d56','email_generico','cynthiagarcia_rios@hotmail.com','alta',true,'sin_probar'),
('2556be77-a2f9-4064-86af-3088ffdf7be5','email_generico','magozama@yahoo.com','alta',true,'sin_probar'),
('ff5d3223-0f2a-4911-9ce0-90fb991873b7','email_generico','edith-central1@hotmail.com','alta',true,'sin_probar'),
('b78f171d-1b72-4a3b-85c4-5023af09f624','email_generico','mezad6527@gmail.com','alta',true,'sin_probar'),
('799fa506-0481-427a-bad4-0aefa914f9f8','email_generico','moni_sam@hotmail.com','alta',true,'sin_probar'),
('66043631-982d-47c1-962b-a4e8d2540b08','email_generico','senilus@hotmail.com','alta',true,'sin_probar'),
('d1a6817a-f1af-4301-9d4f-14a62ad2a094','email_generico','noviasfabioladgo@outlook.com','alta',true,'sin_probar'),
('e9cd2f45-037d-4e33-9cda-e876a96b0ade','email_generico','info@velumbridal.com','alta',true,'sin_probar'),
('375d0b34-b19e-4838-aa3f-0552ded5c706','email_generico','naomilopez2000@hotmail.com','alta',true,'sin_probar'),
('5ce99bc7-e01c-4981-b48b-81fbb349a7e9','email_generico','jesus_zulaica@hotmail.com','alta',true,'sin_probar'),
('414d1ce5-81a4-4f77-b497-18c44359b32b','email_generico','noviascarla@gmail.com','alta',true,'sin_probar'),
('d6347701-8251-4af4-8195-c9033bdaeaec','email_generico','lgnovias@gmail.com','alta',true,'sin_probar'),
('00c8f390-b3ea-4573-8f88-9ea28a02dbe5','email_generico','rmoraty@hotmail.com','alta',true,'sin_probar'),
('a95a1717-dcfc-4ed9-9320-8b5f563399dc','email_generico','godiva@corporativonovias.com','alta',true,'sin_probar');

insert into abm_fuentes (cuenta_id, campo, valor, metodo, confianza, agente) values
('bfc3e291-e0c9-4e54-bb3d-e3ea6f014333','email','hector@imagennovias.com.mx','directorio','alta','denue-inegi'),
('ab7b9e1c-86fe-46a8-9cbf-87cdab0f51ea','email','ventasinnovia@gmail.com','directorio','alta','denue-inegi'),
('ae46a46a-4d93-48e3-91a6-5d273343bb4d','email','info@mabyrosas.com','directorio','alta','denue-inegi'),
('da59b4d4-027b-4eb4-93df-0ca76977312c','email','marsalanovias@gmail.com','directorio','alta','denue-inegi'),
('34cf2ec3-cf3b-409c-8b45-d4821f114370','email','malibenovias@gmail.com','directorio','alta','denue-inegi'),
('99db7eca-6713-4bbb-81a1-6facda0f617f','email','ventas@sacramentonovias.com','directorio','alta','denue-inegi'),
('842c3d90-6a3d-42f5-b951-108b49bcd911','email','mtrogo@davidsbridal.com.mx','directorio','alta','denue-inegi'),
('b53a79f5-6eba-4804-b8eb-07b7620d2ad4','email','rosemarynovia@gmail.com','directorio','alta','denue-inegi'),
('62f134f3-0dbe-4cc5-b2aa-9632069a48dc','email','monique.novias@gmail.com','directorio','alta','denue-inegi'),
('fbd51bc3-f714-47e2-badb-ac168bfa257c','email','stellari@hotmail.com','directorio','alta','denue-inegi'),
('1091e7b6-9458-443b-9e27-5be2c3819f29','email','florf.f@hotmail.com','directorio','alta','denue-inegi'),
('927f74fb-2c90-43bc-b4c4-fa0560e64457','email','vestidosdeluigi@gmail.com','directorio','alta','denue-inegi'),
('abfeff4d-3450-4ca5-a252-cfd82dc564de','email','lauraerob1@outlook.es','directorio','alta','denue-inegi'),
('666e3f44-1c12-4fd0-ac23-ff3abaa9a57f','email','ojmm@hotmail.com','directorio','alta','denue-inegi'),
('9a1b8366-1cdb-4bb6-b379-09ca178c0516','email','natbridal32@gmail.com','directorio','alta','denue-inegi'),
('ca57c2c0-fbc7-4cae-a374-f9c8ee0ff295','email','noviasly@gmail.com','directorio','alta','denue-inegi'),
('3ba24426-6ff4-42bd-9ea5-1999fdc6f531','email','novias.insurgentes@gmail.com','directorio','alta','denue-inegi'),
('1d687be7-98a1-4c9e-b0c4-ecd77abb2f83','email','rromo@corporativoandalucia.com','directorio','alta','denue-inegi'),
('1bc5fe78-4ba1-4ab3-98f9-b56c445ea942','email','novia2003@gmail.com','directorio','alta','denue-inegi'),
('14232ce5-2a83-459b-aa7c-ef74dc5b7af6','email','cp_gilbertoalvarez@live.com.mx','directorio','alta','denue-inegi'),
('076ba469-d9fb-415e-87f1-ea3b9e772851','email','sieprenovias@gmail.com','directorio','alta','denue-inegi'),
('1eccd701-8dae-445e-a095-7e46022be035','email','euronovias@noviasmid.com','directorio','alta','denue-inegi'),
('51211162-6b26-451c-919a-2a85080eef24','email','sposa_europa@gmail.com','directorio','alta','denue-inegi'),
('ee4596ca-2921-4756-8cc7-e29bbe714351','email','juliodiego1983@hotmail.com','directorio','alta','denue-inegi'),
('af458460-81d1-424a-a522-6ad559e363a6','email','laesposaxalapa@hotmail.com','directorio','alta','denue-inegi'),
('7a981ded-e1dd-492e-902c-e83861a3b1bb','email','l_chantres@hotmail.com','directorio','alta','denue-inegi'),
('c781aa58-83f2-48dc-a09f-05b4726908bc','email','casabianconovias@hotmail.com','directorio','alta','denue-inegi'),
('395086c1-4ae1-497b-b737-4aff777aa533','email','gutierezhernandezleticia@gmail.com','directorio','alta','denue-inegi'),
('0b2c0b80-576c-43c2-ae0f-ff882fbe75f5','email','central_novias@gruponabu.com','directorio','alta','denue-inegi'),
('8c736ae3-046c-4237-8f01-30c428d4046c','email','info@bellenovia.com','directorio','alta','denue-inegi'),
('aa481134-cf66-4888-87e2-6da477999e26','email','novias.liin@hotmail.com','directorio','alta','denue-inegi'),
('1321a8da-f2fb-4be5-8513-1759facbaa4f','email','lafayette@hotmail.com','directorio','alta','denue-inegi'),
('d0d43c90-a380-4087-adff-3028d4b78b73','email','divanovias@hotmail.com','directorio','alta','denue-inegi'),
('726f1b80-e3b8-40b0-8ae6-dd26be73f3aa','email','espemendoavi@hotmail.com','directorio','alta','denue-inegi'),
('bf207e87-842c-4153-85e4-3cdedc54d699','email','noviaspamela1@hotmail.com','directorio','alta','denue-inegi'),
('29c7d8c5-3573-4713-ae80-7c94118b51c1','email','andreasbridalmx@gmail.com','directorio','alta','denue-inegi'),
('ac497140-40bd-4469-a41e-ffc7bc36b840','email','btobe2686@gmail.com','directorio','alta','denue-inegi'),
('df07b0c4-d2c8-4b03-a1f4-6f6a305461a2','email','blancodenoviamx@gmail.co','directorio','alta','denue-inegi'),
('f1e385ae-4cb7-4fa2-8ba9-b7fc7ee40015','email','sotolv@hotmail.com','directorio','alta','denue-inegi'),
('5d589fe7-70d9-41cc-9898-ab72fa5679fa','email','blablazu@hotmail.com','directorio','alta','denue-inegi'),
('fa33ddfa-a582-40a1-8fd8-ed15a80616c6','email','edith_central1@hotmail.com','directorio','alta','denue-inegi'),
('c71074d7-626c-4a14-bdce-8fc96a501233','email','anaferronovias@gmail.com','directorio','alta','denue-inegi'),
('17b70a55-5e9f-43f2-bce1-e1eac7461d56','email','cynthiagarcia_rios@hotmail.com','directorio','alta','denue-inegi'),
('2556be77-a2f9-4064-86af-3088ffdf7be5','email','magozama@yahoo.com','directorio','alta','denue-inegi'),
('ff5d3223-0f2a-4911-9ce0-90fb991873b7','email','edith-central1@hotmail.com','directorio','alta','denue-inegi'),
('b78f171d-1b72-4a3b-85c4-5023af09f624','email','mezad6527@gmail.com','directorio','alta','denue-inegi'),
('799fa506-0481-427a-bad4-0aefa914f9f8','email','moni_sam@hotmail.com','directorio','alta','denue-inegi'),
('66043631-982d-47c1-962b-a4e8d2540b08','email','senilus@hotmail.com','directorio','alta','denue-inegi'),
('d1a6817a-f1af-4301-9d4f-14a62ad2a094','email','noviasfabioladgo@outlook.com','directorio','alta','denue-inegi'),
('e9cd2f45-037d-4e33-9cda-e876a96b0ade','email','info@velumbridal.com','directorio','alta','denue-inegi'),
('375d0b34-b19e-4838-aa3f-0552ded5c706','email','naomilopez2000@hotmail.com','directorio','alta','denue-inegi'),
('5ce99bc7-e01c-4981-b48b-81fbb349a7e9','email','jesus_zulaica@hotmail.com','directorio','alta','denue-inegi'),
('414d1ce5-81a4-4f77-b497-18c44359b32b','email','noviascarla@gmail.com','directorio','alta','denue-inegi'),
('d6347701-8251-4af4-8195-c9033bdaeaec','email','lgnovias@gmail.com','directorio','alta','denue-inegi'),
('00c8f390-b3ea-4573-8f88-9ea28a02dbe5','email','rmoraty@hotmail.com','directorio','alta','denue-inegi'),
('a95a1717-dcfc-4ed9-9320-8b5f563399dc','email','godiva@corporativonovias.com','directorio','alta','denue-inegi');

-- El sitio del censo, SOLO donde la cuenta no tenía ninguno.
update abm_cuentas set sitio='https://WWW.IMAGENNOVIAS.COM.MX' where id='bfc3e291-e0c9-4e54-bb3d-e3ea6f014333' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.INNOVIA.COM.MX' where id='ab7b9e1c-86fe-46a8-9cbf-87cdab0f51ea' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://MYAHNOVIAS.COM' where id='86774bfc-7cad-424d-9776-722876c5b3b1' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.MABYROSAS.COM' where id='ae46a46a-4d93-48e3-91a6-5d273343bb4d' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.MALIBENOVIAS' where id='34cf2ec3-cf3b-409c-8b45-d4821f114370' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.CARMENC.COM' where id='8f4f7fac-845e-4787-bbea-ce721e6b3f61' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.CARLO.MX' where id='5df6073a-86b0-46ef-a09d-c661c2a57e2f' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://AGUIAR.MX' where id='295e6eb2-c569-49a3-936e-d034d8b7f1a4' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.SACRAMENTONOVIAS.COM' where id='99db7eca-6713-4bbb-81a1-6facda0f617f' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.BRIDENFORMAL.COM' where id='05059d6b-083c-46bb-83cc-cbe7149364ee' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.GIGINOVIAS.COM.MX' where id='6cc94d60-b42f-44fe-bee1-552e08abee71' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.DAVIDSBRIDAL.COM.MX' where id='842c3d90-6a3d-42f5-b951-108b49bcd911' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.LUCYFRANCO.COM' where id='b97da424-d911-46c6-96f0-a53f8af26bd6' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.STELLARICASADENOVIAS.COM' where id='fbd51bc3-f714-47e2-badb-ac168bfa257c' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.ALMABLANCA.COM.MX' where id='bd6e741e-a371-4bea-9f36-83cbc979b8e0' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.FRANCONOVIAS.COM' where id='1091e7b6-9458-443b-9e27-5be2c3819f29' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.SPOSABRIDAL.MX' where id='a80005a7-67ad-4005-9abe-180c54d7f625' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.VESTIDOSNATBRIDAL.COM' where id='3ea9bb9f-b03c-403e-9ccc-5adb317b5194' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.LUPANAVILCHEZ.COM' where id='39f5f9d6-ea4e-4528-96cf-3d7b93494044' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.BELLENOVIA.COM' where id='7566729e-9eb2-48dc-a51e-55f6dd112d9a' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.VESTIDOSNATBRIDAL.COM' where id='9a1b8366-1cdb-4bb6-b379-09ca178c0516' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.NOVIAMIA.COM.MX' where id='fa02356e-deca-45a6-9673-35db28c13df0' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.NOVIASESPANA.NET' where id='3ba24426-6ff4-42bd-9ea5-1999fdc6f531' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.BRIDENFORMAL.COM' where id='2b0f01db-5a43-4e4f-a140-45991c9d110c' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.EURONOVIAS.COM.MX' where id='1eccd701-8dae-445e-a095-7e46022be035' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.LAESPOSA.MX' where id='af458460-81d1-424a-a522-6ad559e363a6' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://NOVIASDEESPANA.COM.MX' where id='49bd9e48-981a-4ec8-a809-1d857cd0cdc5' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.BELLENOVIA.COM' where id='8c736ae3-046c-4237-8f01-30c428d4046c' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.ROBERTA.COM.MX' where id='21cded7c-b3ac-42e7-9ee0-39fb55fe9c9f' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.LUPANAVILCHEZ.COM' where id='1321a8da-f2fb-4be5-8513-1759facbaa4f' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.DIVAXV.COM.MX' where id='d0d43c90-a380-4087-adff-3028d4b78b73' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.DESILVANOVIAS.COM.MX' where id='03b6dcdc-e816-4355-a653-0d723103680e' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.ANDREASBRIDAL.COM' where id='29c7d8c5-3573-4713-ae80-7c94118b51c1' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://BRIDETOBEVESTIDOS.COM' where id='ac497140-40bd-4469-a41e-ffc7bc36b840' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.CENTRONOVIAS.COM.MX' where id='fa33ddfa-a582-40a1-8fd8-ed15a80616c6' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://CENTRONOVIAS.COM' where id='ff5d3223-0f2a-4911-9ce0-90fb991873b7' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.VELUMBRIDAL.COM' where id='e9cd2f45-037d-4e33-9cda-e876a96b0ade' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.NOVIASANGELICA.COM' where id='8e11e467-b3f3-43da-b535-2873580dfc80' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.CASANOVIA.MX' where id='38cdc9dd-c28b-45d5-983f-595595599f83' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://MIANOVIAS.MX' where id='c65e69c5-a3fa-4635-94e2-678c7fe53a19' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.BIAANIALTACOSTURA.COM' where id='38c9e3d7-893b-4135-a7f3-8011c4be6c81' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.MORATY.COM.MX' where id='00c8f390-b3ea-4573-8f88-9ea28a02dbe5' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.ALTAMODASPOSA.COM.MX' where id='5e15329f-4e29-4e6b-a6c8-c3bf49065e21' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.ELEGANZZA.SPOSA.COM' where id='c066f1b7-6978-4230-a35f-d753cfceaf2c' and (sitio is null or sitio='');
update abm_cuentas set sitio='https://WWW.ROMANTICBRIDE.COM.MX' where id='7011e479-5612-4b72-b1c0-954b261d50be' and (sitio is null or sitio='');
