-- Paso 2 de la cascada: el correo y las redes salen del SITIO, no de Google.
--
-- Google Maps (paso 1) acaba de darle sitio web a 850 cuentas del top 100 que
-- antes solo tenían nombre. Esto raspa esos 1,237 sitios para sacar lo que la
-- ficha de Google NO tiene: correo, WhatsApp declarado, Instagram y Facebook.
--
-- Rendimiento: 272 correos, 183 WhatsApp, 144 telefonos, 447 Instagram,
-- 558 Facebook, y 115 sitios caidos.
--
-- LA REGLA DEL CORREO COMPARTIDO, AFINADA
-- Un correo que aparece en varias cuentas se descarta... salvo que sea del
-- MISMO dominio que el sitio de esa cuenta. `contacto@elglobo.com.mx` en cinco
-- tiendas El Globo es correcto: es una cadena publicando su contacto. Lo que
-- delata a un proveedor es un correo de OTRO dominio en negocios distintos,
-- como `impallari@gmail.com` —un disenador de tipografias— apareciendo en una
-- optica y una zapateria. La primera version de la regla tiraba los 32 correos
-- de cadena junto con los malos.
--
-- Todos los correos pasaron MX (201 dominios, ninguno cayo). Los WhatsApp
-- entran `declarado` porque salen de un wa.me del propio sitio (seccion 6 bis).

insert into abm_canales (cuenta_id, tipo, valor, confianza, es_de_la_tienda, estado) values
('531c2cf9-a4c5-40ed-a394-2bc577637763','email_generico','atencion@elnuevomundo.com','media',true,'sin_probar'),
('531c2cf9-a4c5-40ed-a394-2bc577637763','telefono','525551300353','media',true,'sin_probar'),
('543fbe2d-bb04-41af-9de4-2953c7c10137','telefono','528180589040','media',true,'sin_probar'),
('f7cbdfbe-c730-41dd-8d4b-b77aba2f3e9b','email_generico','contacto@priceshoes.com','media',true,'sin_probar'),
('f4716738-ccf2-4799-97d5-264e280db4cc','whatsapp_tienda','525518012835','alta',true,'declarado'),
('f4716738-ccf2-4799-97d5-264e280db4cc','telefono','525552626438','media',true,'sin_probar'),
('4aea7ea4-2e7a-4305-acb5-30aa8e36e602','telefono','523321013330','media',true,'sin_probar'),
('68db6ac0-d319-4ca3-a1c9-2ebcb0c0ec06','email_generico','info@sapica.com','media',true,'sin_probar'),
('b9544a15-96aa-4d82-b4a2-e6dd7c34f1af','whatsapp_tienda','525546085201','alta',true,'declarado'),
('b9544a15-96aa-4d82-b4a2-e6dd7c34f1af','telefono','525511010449','media',true,'sin_probar'),
('9c6a66a5-1e25-4d6f-b002-14bd8a5c5866','whatsapp_tienda','523335881570','alta',true,'declarado'),
('c90d67de-f822-4326-b00f-57843d3f942f','email_generico','ayuda@chapur.com.mx','media',true,'sin_probar'),
('c90d67de-f822-4326-b00f-57843d3f942f','telefono','529999302800','media',true,'sin_probar'),
('db4f57c1-597f-4aab-8803-510dda717c66','email_generico','info@granplazaoutlets.com','media',true,'sin_probar'),
('6685002f-5fea-46b9-832b-64e8236ca5e7','whatsapp_tienda','525554795374','alta',true,'declarado'),
('ef15b116-3d46-44b1-a5d0-d1e22a6d6ffa','email_generico','moises@goodbyefolk.com','media',true,'sin_probar'),
('7e1ff3f0-67c3-4d28-ba37-3535a3fe6771','whatsapp_tienda','522292153983','alta',true,'declarado'),
('667ddee9-267a-4d92-89f5-c1c1fc72a1cd','email_generico','infinitijoyas@gmail.com','media',true,'sin_probar'),
('667ddee9-267a-4d92-89f5-c1c1fc72a1cd','whatsapp_tienda','528120326282','alta',true,'declarado'),
('3a6db856-f6fa-49c4-8d0a-7368459af7d0','email_generico','contacto@promoda.com.mx','media',true,'sin_probar'),
('3a6db856-f6fa-49c4-8d0a-7368459af7d0','telefono','528000077066','media',true,'sin_probar'),
('c69cff03-2bff-4068-b1ce-40b6a875bfc2','email_generico','u003cdax@dax.com.mx','media',true,'sin_probar'),
('de1036b0-98c2-4feb-905e-63db477957d4','email_generico','contacto@miguelito.mx','media',true,'sin_probar'),
('de1036b0-98c2-4feb-905e-63db477957d4','whatsapp_tienda','525610216294','alta',true,'declarado'),
('e343b721-599f-48bd-afee-64cdacc0727e','whatsapp_tienda','528124277881','alta',true,'declarado'),
('e343b721-599f-48bd-afee-64cdacc0727e','telefono','528183447251','media',true,'sin_probar'),
('df468897-890d-4274-959d-132a68ad5251','email_generico','info@yulygiraldo.com','media',true,'sin_probar'),
('bbde869a-5a08-47e6-bd7d-9359ca2a9c1a','email_generico','ventasonline@artistcity.com.mx','media',true,'sin_probar'),
('3089a6c6-bb2a-41d9-9031-e4ab1e352011','telefono','523331263789','media',true,'sin_probar'),
('a08d6057-e06c-45c5-96e7-e26a23264b4b','email_generico','ventas@garufajeans.com.mx','media',true,'sin_probar'),
('a08d6057-e06c-45c5-96e7-e26a23264b4b','whatsapp_tienda','525530422356','alta',true,'declarado'),
('25b97676-317c-4a7d-9490-43f6feae8db3','whatsapp_tienda','526462876359','alta',true,'declarado'),
('86caece2-b9cb-4f4d-8b6b-dfc153e1aa4d','email_generico','mindoracollection@gmail.com','media',true,'sin_probar'),
('5ae9834f-c13c-4f0b-aeca-3919fa3bf127','email_generico','contacto@moutyjoyeria.com','media',true,'sin_probar'),
('5ae9834f-c13c-4f0b-aeca-3919fa3bf127','telefono','523345273624','media',true,'sin_probar'),
('f333ad0e-b722-48c0-9d97-158f4dee0e64','whatsapp_tienda','526145990767','alta',true,'declarado'),
('5334874c-f511-4447-aebe-20a2b380707b','email_generico','ventas@ameliejoyas.com','media',true,'sin_probar'),
('5334874c-f511-4447-aebe-20a2b380707b','whatsapp_tienda','523322214807','alta',true,'declarado'),
('0e47ad7f-0183-4d55-904e-b4791c579b4b','whatsapp_tienda','523315841191','alta',true,'declarado'),
('b497cffa-2f82-4a2c-8a0b-86c623f82f43','email_generico','tasteenlinea@tasteboutique.com','media',true,'sin_probar'),
('b497cffa-2f82-4a2c-8a0b-86c623f82f43','whatsapp_tienda','526622683344','alta',true,'declarado'),
('8a80c96b-2a41-4cd6-87bf-0087bde98a16','email_generico','info@hotelcasagonzalez.com','media',true,'sin_probar'),
('8a80c96b-2a41-4cd6-87bf-0087bde98a16','telefono','525555143302','media',true,'sin_probar'),
('3b432454-fc80-4b5d-9e24-ca5545e1115a','email_generico','tennisexpress@icloud.com','media',true,'sin_probar'),
('3b432454-fc80-4b5d-9e24-ca5545e1115a','telefono','528119902398','media',true,'sin_probar'),
('1e9dc983-caac-4ab5-8604-88659a4cc513','whatsapp_tienda','526641993698','alta',true,'declarado'),
('a5b65ef8-220b-471e-bc82-7d86de89ef35','whatsapp_tienda','524773977372','alta',true,'declarado'),
('3554b6ee-2fc1-4e46-b74d-69edc71cdcf6','email_generico','contacto@elglobo.com.mx','media',true,'sin_probar'),
('baabb0c4-7154-481a-89e9-3de73910fbd6','whatsapp_tienda','525586596023','alta',true,'declarado'),
('42aba0d7-2c30-4f7e-8900-73501f971ea7','email_generico','orlando.resendiz@zapateriafratello.com','media',true,'sin_probar'),
('42aba0d7-2c30-4f7e-8900-73501f971ea7','whatsapp_tienda','524274270336','alta',true,'declarado'),
('f32c7a6d-e3b7-40d0-941d-92f4be315fd1','email_generico','hola@unser.com.mx','media',true,'sin_probar'),
('f32c7a6d-e3b7-40d0-941d-92f4be315fd1','whatsapp_tienda','525549656879','alta',true,'declarado'),
('748a6749-60c5-42e0-a413-b0dbf145f795','whatsapp_tienda','527712881783','alta',true,'declarado'),
('2bac95e1-fcf2-4a46-b9a1-10c9b8dc60e8','email_generico','contacto@binaboutique.com','media',true,'sin_probar'),
('2bac95e1-fcf2-4a46-b9a1-10c9b8dc60e8','whatsapp_tienda','528118267337','alta',true,'declarado'),
('2bac95e1-fcf2-4a46-b9a1-10c9b8dc60e8','telefono','528118267337','media',true,'sin_probar'),
('3e7de61b-3fb6-405a-939e-1b7bb652a07f','whatsapp_tienda','525533407778','alta',true,'declarado'),
('3e7de61b-3fb6-405a-939e-1b7bb652a07f','telefono','525555142368','media',true,'sin_probar'),
('90171142-a2df-4d26-ac4a-e917d1b4ebae','email_generico','hola@havoc.mx','media',true,'sin_probar'),
('90171142-a2df-4d26-ac4a-e917d1b4ebae','whatsapp_tienda','525657822989','alta',true,'declarado'),
('3ea426ee-26c4-4fc5-ba16-24d34285e878','email_generico','ventaenlinea@cletoreyes.com','media',true,'sin_probar'),
('5174c604-1ed0-4c92-8ed1-8d19bfeaa628','email_generico','info@abbajoyas.com','media',true,'sin_probar'),
('5174c604-1ed0-4c92-8ed1-8d19bfeaa628','whatsapp_tienda','523322291899','alta',true,'declarado'),
('5174c604-1ed0-4c92-8ed1-8d19bfeaa628','telefono','523336182339','media',true,'sin_probar'),
('dc4e71dd-81c0-4645-8de8-99b4227edddd','email_generico','contacto@zapatoagil.com','media',true,'sin_probar'),
('dc4e71dd-81c0-4645-8de8-99b4227edddd','telefono','523323107798','media',true,'sin_probar'),
('42708317-5b28-4664-ad9f-4b3ba6f359f7','email_generico','contacto@hhdxt.mx','media',true,'sin_probar'),
('1d687be7-98a1-4c9e-b0c4-ecd77abb2f83','whatsapp_tienda','525522719809','alta',true,'declarado'),
('1d687be7-98a1-4c9e-b0c4-ecd77abb2f83','telefono','525555100536','media',true,'sin_probar'),
('6fcb7904-a90b-49cf-9cf7-08a2eb034efd','email_generico','hola@oggi.mx','media',true,'sin_probar'),
('b97da424-d911-46c6-96f0-a53f8af26bd6','whatsapp_tienda','528136391003','alta',true,'declarado'),
('1b02c944-a17d-47b1-b1f1-05dabfcc12ed','email_generico','ventas@bondsboutique.com.mx','media',true,'sin_probar'),
('62749c4c-3958-4248-963f-d7dc9a7e1b0b','whatsapp_tienda','523311105686','alta',true,'declarado'),
('fd1aef1c-c768-4288-afcc-4319c370792c','email_generico','info@carlo.mx','media',true,'sin_probar'),
('fd1aef1c-c768-4288-afcc-4319c370792c','whatsapp_tienda','525567835967','alta',true,'declarado'),
('5b503b2e-dc2c-4a0d-9869-b6bb93086224','whatsapp_tienda','525623871097','alta',true,'declarado'),
('5b503b2e-dc2c-4a0d-9869-b6bb93086224','telefono','525555120639','media',true,'sin_probar'),
('78638245-e3d3-4519-bfed-a5b2d3d0d15f','whatsapp_tienda','525517448241','alta',true,'declarado'),
('78638245-e3d3-4519-bfed-a5b2d3d0d15f','telefono','525517448241','media',true,'sin_probar'),
('ccf4daf9-7a2e-47ff-90bd-cfb39dfbe2f1','email_generico','pedidos@elfamundi.com.mx','media',true,'sin_probar'),
('ccf4daf9-7a2e-47ff-90bd-cfb39dfbe2f1','whatsapp_tienda','525615481365','alta',true,'declarado'),
('76aa55e6-4374-4774-b38f-5cb32fc08b79','email_generico','ecommerce@solatextil.mx','media',true,'sin_probar'),
('c93c46ab-e8d6-4438-98c9-612881e9f218','email_generico','ventas@uniformesescolaresalaman.com','media',true,'sin_probar'),
('e81eb2d9-296e-4bef-bdb2-b9d7ea81a76c','email_generico','ventas@almadeluna.mx','media',true,'sin_probar'),
('fe498d4e-deaf-4985-865a-8fde0c314344','email_generico','ventas@opticagema.com.mx','media',true,'sin_probar'),
('fe498d4e-deaf-4985-865a-8fde0c314344','whatsapp_tienda','525627418583','alta',true,'declarado'),
('02ab88a5-f5fb-42aa-a610-4aceb85494ff','email_generico','ventas@uniformeslaamistad.com','media',true,'sin_probar'),
('02ab88a5-f5fb-42aa-a610-4aceb85494ff','telefono','526865617392','media',true,'sin_probar'),
('bd0da07a-4ef0-4f48-835a-145c0340b096','email_generico','multilinea@karati.com','media',true,'sin_probar'),
('3069d25c-5e20-4ea0-930a-5c9623813791','email_generico','atencionaclientestijuana@jarmar.com','media',true,'sin_probar'),
('3069d25c-5e20-4ea0-930a-5c9623813791','whatsapp_tienda','529611855475','alta',true,'declarado'),
('78c581cf-eceb-4066-9774-8e2e127e6081','whatsapp_tienda','525571136661','alta',true,'declarado'),
('78c581cf-eceb-4066-9774-8e2e127e6081','telefono','525571136661','media',true,'sin_probar'),
('bf28a55b-6d8f-49d1-8d48-9c463c9463cd','email_generico','valma.mx@gmail.com','media',true,'sin_probar'),
('6c470b25-9163-48b3-aeba-46f995b9d8a8','email_generico','ulamm@ulammjoyas.com','media',true,'sin_probar'),
('6c470b25-9163-48b3-aeba-46f995b9d8a8','whatsapp_tienda','525559930600','alta',true,'declarado'),
('6c470b25-9163-48b3-aeba-46f995b9d8a8','telefono','525555103898','media',true,'sin_probar'),
('a9ee1f64-615a-4169-ac1c-e7dafb49ff07','whatsapp_tienda','527225560013','alta',true,'declarado'),
('bc9af7ef-e7f8-4ab7-8a50-31abb8c5ebf2','email_generico','merceriadelrefugiomx@gmail.com','media',true,'sin_probar'),
('bc9af7ef-e7f8-4ab7-8a50-31abb8c5ebf2','telefono','525555222362','media',true,'sin_probar'),
('5881b9a5-7719-49d3-a359-11089aac14b7','email_generico','contacto@boutiquemonet.com','media',true,'sin_probar'),
('5881b9a5-7719-49d3-a359-11089aac14b7','whatsapp_tienda','528117595771','alta',true,'declarado'),
('5881b9a5-7719-49d3-a359-11089aac14b7','telefono','528121392205','media',true,'sin_probar'),
('0c53cf71-ece4-4c36-83d1-8eff977b294d','email_generico','moises@goodbyefolk.com','media',true,'sin_probar'),
('00dc2a01-ab64-4f79-962a-821abdca6983','email_generico','contacto@opticasblink.com','media',true,'sin_probar'),
('00dc2a01-ab64-4f79-962a-821abdca6983','whatsapp_tienda','526182821983','alta',true,'declarado'),
('00dc2a01-ab64-4f79-962a-821abdca6983','telefono','526181850479','media',true,'sin_probar'),
('74863e07-6d1a-44d7-a503-33fc377a4b16','email_generico','tuzomaniaoficial@gmail.com','media',true,'sin_probar'),
('a4cb8a05-f96a-4295-b469-4ea82dd7b5d4','email_generico','info@zittro.com','media',true,'sin_probar'),
('a4cb8a05-f96a-4295-b469-4ea82dd7b5d4','whatsapp_tienda','524433249220','alta',true,'declarado'),
('ec9bd95f-3b9c-4a40-a1a7-4dd0836c09f0','email_generico','ayuda@petngo.com.mx','media',true,'sin_probar'),
('ec9bd95f-3b9c-4a40-a1a7-4dd0836c09f0','whatsapp_tienda','528129309809','alta',true,'declarado'),
('82795919-bfbd-4ce8-8c9c-f8c1892589ad','email_generico','servicioalcliente@majasportswear.com','media',true,'sin_probar'),
('82795919-bfbd-4ce8-8c9c-f8c1892589ad','telefono','526674267327','media',true,'sin_probar'),
('309b0946-763d-4434-bd08-5253d37fd7b6','whatsapp_tienda','526692657854','alta',true,'declarado'),
('309b0946-763d-4434-bd08-5253d37fd7b6','telefono','526699833350','media',true,'sin_probar'),
('8694876d-63ee-4d67-a5fe-800156deafed','email_generico','dianasoy58@gmail.com','media',true,'sin_probar'),
('8694876d-63ee-4d67-a5fe-800156deafed','whatsapp_tienda','525566005500','alta',true,'declarado'),
('94690d47-7c4a-4d9f-8193-a040f65167a1','email_generico','info@soybissu.com','media',true,'sin_probar'),
('1c2c27bd-582b-490f-8d74-75ce72cf8d5a','email_generico','chuz77z@gmail.com','media',true,'sin_probar'),
('454f66c6-9eee-44b1-8534-cec97dd20e4f','email_generico','contacto@sivuple.mx','media',true,'sin_probar'),
('454f66c6-9eee-44b1-8534-cec97dd20e4f','telefono','525554591055','media',true,'sin_probar'),
('8c736ae3-046c-4237-8f01-30c428d4046c','email_generico','bellenoviah@gmail.com','media',true,'sin_probar'),
('c4e824e1-f9b0-42e5-980c-6dbec6a316b8','email_generico','lety@cimarron.com.mx','media',true,'sin_probar'),
('8ecd3e9b-b2b5-445c-9731-ffa57404014e','email_generico','ecommerce@aldoconti.com','media',true,'sin_probar'),
('8ecd3e9b-b2b5-445c-9731-ffa57404014e','telefono','528003980000','media',true,'sin_probar'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','email_generico','info@opticalorentzdejuarez.com.mx','media',true,'sin_probar'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','whatsapp_tienda','526563604060','alta',true,'declarado'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','telefono','526563604060','media',true,'sin_probar'),
('d844243b-66b2-4d64-849c-4080dafe9a18','whatsapp_tienda','526623002087','alta',true,'declarado'),
('d844243b-66b2-4d64-849c-4080dafe9a18','telefono','526623002087','media',true,'sin_probar'),
('71a8858e-529a-42a8-aece-c15d7bece80b','whatsapp_tienda','524773833912','alta',true,'declarado'),
('1ffe1fbc-f3d5-4e5d-8af5-1360c04454db','whatsapp_tienda','526141704195','alta',true,'declarado'),
('2f6d779e-418b-4144-9bbe-c2bafdc5bdae','email_generico','hola@ranchdepot.com','media',true,'sin_probar'),
('d29c7b0e-824c-407f-bee0-4e82fc160147','email_generico','mkt@analorena.com','media',true,'sin_probar'),
('d29c7b0e-824c-407f-bee0-4e82fc160147','whatsapp_tienda','525574959937','alta',true,'declarado'),
('d29c7b0e-824c-407f-bee0-4e82fc160147','telefono','525623186432','media',true,'sin_probar'),
('a92c3f0c-0259-4af4-905d-11a0cdeb2e18','email_generico','multilinea@karati.com','media',true,'sin_probar'),
('ad0c66f7-09b7-4cd2-b337-1bd344b9d4d3','whatsapp_tienda','524611735444','alta',true,'declarado'),
('ad0c66f7-09b7-4cd2-b337-1bd344b9d4d3','telefono','524611735444','media',true,'sin_probar'),
('e972edd5-0423-4ff9-bb9c-17bb2fce252b','whatsapp_tienda','525535772793','alta',true,'declarado'),
('56fffa44-b5ea-447c-bfd7-c1f49b2579ce','email_generico','contacto@elglobo.com.mx','media',true,'sin_probar'),
('c48f7d65-3f94-4efd-8e51-952cfd4d1e1a','email_generico','igor.cohen@gmail.com','media',true,'sin_probar'),
('2c0ce3cd-5671-4c18-a389-7f7ee6b04d2a','whatsapp_tienda','526673920720','alta',true,'declarado'),
('dc65e85f-224b-4568-a137-a2741f88eb29','whatsapp_tienda','522461549385','alta',true,'declarado'),
('dc65e85f-224b-4568-a137-a2741f88eb29','telefono','522225914459','media',true,'sin_probar'),
('21dcbf70-e099-48a8-8fdd-ebd5676bcdf6','email_generico','lobstore@lob.com.mx','media',true,'sin_probar'),
('af41754d-27bf-4331-ba58-64cb45ba2d64','email_generico','motooutlettoluca@hotmail.com','media',true,'sin_probar'),
('af41754d-27bf-4331-ba58-64cb45ba2d64','whatsapp_tienda','527208639740','alta',true,'declarado'),
('bd5d4bbf-86ff-4e3e-a6f2-30dc100562d0','whatsapp_tienda','526691101322','alta',true,'declarado'),
('bd5d4bbf-86ff-4e3e-a6f2-30dc100562d0','telefono','526691101322','media',true,'sin_probar'),
('fd445e1b-f887-4311-9ff4-bc37405504a3','email_generico','atencionaclientes@veana.com','media',true,'sin_probar'),
('166f34aa-c005-4cfc-ad84-ebf6f02a0994','email_generico','ventas@uniformesescolaresalaman.com','media',true,'sin_probar'),
('05fa5246-0ecf-46a3-a899-ae06e2606169','email_generico','karlyta.galindo.bd@gmail.com','media',true,'sin_probar'),
('05fa5246-0ecf-46a3-a899-ae06e2606169','whatsapp_tienda','524421143052','alta',true,'declarado'),
('6b0c72fe-bcf0-4a15-a7d9-99c512574685','email_generico','direccion@dimeo.mx','media',true,'sin_probar'),
('4b0aaba5-408a-4486-a101-fe6db52f6a5e','whatsapp_tienda','526621396339','alta',true,'declarado'),
('871dfaef-06e8-46e8-a9b0-cda6db4c394c','email_generico','hellomom.mexico@gmail.com','media',true,'sin_probar'),
('871dfaef-06e8-46e8-a9b0-cda6db4c394c','whatsapp_tienda','524777252191','alta',true,'declarado'),
('871dfaef-06e8-46e8-a9b0-cda6db4c394c','telefono','524642221027','media',true,'sin_probar'),
('f24a518a-deba-4287-9dc6-8755f0c5c616','email_generico','sergio.soberanis@novedadestony.com','media',true,'sin_probar'),
('f24a518a-deba-4287-9dc6-8755f0c5c616','whatsapp_tienda','529995720142','alta',true,'declarado'),
('1ae3f863-3416-4bf0-b37a-a2c13d89d468','email_generico','contacto@misvestidosgdl.com','media',true,'sin_probar'),
('1ae3f863-3416-4bf0-b37a-a2c13d89d468','whatsapp_tienda','523321567135','alta',true,'declarado'),
('a80005a7-67ad-4005-9abe-180c54d7f625','email_generico','info@sposabridal.mx','media',true,'sin_probar'),
('a80005a7-67ad-4005-9abe-180c54d7f625','telefono','526642002078','media',true,'sin_probar'),
('0ad84f47-b3e5-4084-a0b9-312da23fe7fd','email_generico','contacto@urbanutility.mx','media',true,'sin_probar'),
('509b64b6-f33c-41c4-9d38-e1691d214a8f','email_generico','citybride.info@gmail.com','media',true,'sin_probar'),
('509b64b6-f33c-41c4-9d38-e1691d214a8f','whatsapp_tienda','523310310941','alta',true,'declarado'),
('509b64b6-f33c-41c4-9d38-e1691d214a8f','telefono','523310310941','media',true,'sin_probar'),
('27552c30-0b3b-4e31-9301-400ae8ac33f0','whatsapp_tienda','523314212717','alta',true,'declarado'),
('64a7dd85-5357-4bd0-b7e8-79b5122bca6d','email_generico','hola@aguiar.mx','media',true,'sin_probar'),
('64a7dd85-5357-4bd0-b7e8-79b5122bca6d','telefono','523327207389','media',true,'sin_probar'),
('baca993c-033d-4bd3-b96f-d6794efa4e23','email_generico','questions@online.danielsjewelers.com','media',true,'sin_probar'),
('baca993c-033d-4bd3-b96f-d6794efa4e23','telefono','528669587664','media',true,'sin_probar'),
('335f93d4-81d2-4c3b-8ac6-80c25327caa4','email_generico','devoluciones@converse.com.mx','media',true,'sin_probar'),
('7392dfa8-50a9-4d1b-8e67-f9982e0c7343','email_generico','info@sposabella.mx','media',true,'sin_probar'),
('7392dfa8-50a9-4d1b-8e67-f9982e0c7343','whatsapp_tienda','525555021116','alta',true,'declarado'),
('2e107b42-19a4-4ce0-8973-1fa5c7847c68','telefono','523315392346','media',true,'sin_probar'),
('812b651b-7b31-4599-8284-9a0b9ec48064','whatsapp_tienda','525571938391','alta',true,'declarado'),
('8063f4fc-7b11-451a-a7c7-ef20c9014e16','email_generico','admin@carmenc.com','media',true,'sin_probar'),
('8063f4fc-7b11-451a-a7c7-ef20c9014e16','whatsapp_tienda','524611859029','alta',true,'declarado'),
('8063f4fc-7b11-451a-a7c7-ef20c9014e16','telefono','524616130110','media',true,'sin_probar'),
('b59c604a-0a3e-4cb6-b43a-f3776e9f69b1','whatsapp_tienda','525612622146','alta',true,'declarado'),
('4f68fca9-6fd2-4c78-aa69-05aa4906e21e','telefono','523331223565','media',true,'sin_probar'),
('840d85ad-112d-44fe-9aca-9d354a0fd9a1','email_generico','atencionclientes@yale.com.mx','media',true,'sin_probar'),
('840d85ad-112d-44fe-9aca-9d354a0fd9a1','telefono','525558044242','media',true,'sin_probar'),
('e5d5d4dc-8cea-4fae-98de-a8755c6ef819','email_generico','contacto@ruvalcabafantasias.com','media',true,'sin_probar'),
('0366747a-4ca2-4a49-9928-b4e1cfcc645e','email_generico','info@libreriaacuario.com.mx','media',true,'sin_probar'),
('0366747a-4ca2-4a49-9928-b4e1cfcc645e','whatsapp_tienda','522299510561','alta',true,'declarado'),
('0366747a-4ca2-4a49-9928-b4e1cfcc645e','telefono','522299316971','media',true,'sin_probar'),
('c6d17540-d5b9-4f35-a029-45ddb8f34c1c','email_generico','online@pirma.com.mx','media',true,'sin_probar'),
('c6d17540-d5b9-4f35-a029-45ddb8f34c1c','telefono','524776330019','media',true,'sin_probar'),
('133558cd-6212-4893-b016-e57536f406f1','email_generico','servicioaclientes@discalse.com','media',true,'sin_probar'),
('ca8da1c2-861c-40b0-bf20-d895804967d3','email_generico','centrodegraduaciones@gmail.com','media',true,'sin_probar'),
('bea3c06c-2d31-471b-ae4b-5291ed87da8e','email_generico','l.luna@tejidosgaytan.com.mx','media',true,'sin_probar'),
('076be8c4-b09b-4f2e-b6ce-253377787f70','email_generico','capitaltextilmx@gmail.com','media',true,'sin_probar'),
('076be8c4-b09b-4f2e-b6ce-253377787f70','whatsapp_tienda','525647680027','alta',true,'declarado'),
('77af4b9a-c838-40a3-ba45-e1b2d56e3397','email_generico','hola@lineas.com.mx','media',true,'sin_probar'),
('948558cd-e8ab-4a05-8a09-e7b8bebd9a4d','telefono','525539366335','media',true,'sin_probar'),
('4c48b3e6-28e7-4841-9cea-b90e11183a27','email_generico','ventas@clinik.com','media',true,'sin_probar'),
('58e1f0cf-078b-4440-b4fd-9bef258d931c','whatsapp_tienda','522227095349','alta',true,'declarado'),
('09d49604-ecd0-45d3-a242-e342446c1c21','email_generico','admin@yotebordo.com','media',true,'sin_probar'),
('3d1c7560-5bd0-4e4a-b303-06b4271faaab','whatsapp_tienda','525561894779','alta',true,'declarado'),
('3d1c7560-5bd0-4e4a-b303-06b4271faaab','telefono','525561371366','media',true,'sin_probar'),
('dfddf52c-6ac3-4b9e-977d-6eaf252edd41','email_generico','disfracesmexico@hotmail.com','media',true,'sin_probar'),
('54271c2a-cd20-4c81-893a-192d9414207e','whatsapp_tienda','525579135973','alta',true,'declarado'),
('54271c2a-cd20-4c81-893a-192d9414207e','telefono','524644640571','media',true,'sin_probar'),
('40676076-064e-43e0-ad19-857ba0ea6fce','whatsapp_tienda','529991262332','alta',true,'declarado'),
('40676076-064e-43e0-ad19-857ba0ea6fce','telefono','529992231217','media',true,'sin_probar'),
('6998f232-2cbb-48d8-b822-255a3d93ee60','whatsapp_tienda','525531658139','alta',true,'declarado'),
('6998f232-2cbb-48d8-b822-255a3d93ee60','telefono','525555463476','media',true,'sin_probar'),
('d1319988-d02a-43de-9eb5-1863673f2bd6','whatsapp_tienda','528122150093','alta',true,'declarado'),
('d1319988-d02a-43de-9eb5-1863673f2bd6','telefono','528122150093','media',true,'sin_probar'),
('58b048e5-cbe4-435e-b897-a2faf0e18a1d','email_generico','elnopaltiendas@gmail.com','media',true,'sin_probar'),
('58b048e5-cbe4-435e-b897-a2faf0e18a1d','whatsapp_tienda','526681934635','alta',true,'declarado'),
('d4206644-a42f-4f0d-9a4c-c8a60df0700a','email_generico','ventas@uniformesprovidencia.com.mx','media',true,'sin_probar'),
('d4206644-a42f-4f0d-9a4c-c8a60df0700a','whatsapp_tienda','525564532052','alta',true,'declarado'),
('d406aabc-030a-4ec0-ab51-9ab2b928737e','email_generico','recepcion@unicofam.com','media',true,'sin_probar'),
('4d0813c8-d264-4e9e-a18d-122272ecb2a6','email_generico','cponce@lazzarmexico.com','media',true,'sin_probar'),
('4d0813c8-d264-4e9e-a18d-122272ecb2a6','telefono','525552086662','media',true,'sin_probar'),
('d3522da1-28b4-47d9-af52-46e4feed1ebc','email_generico','ventaenlinea@zapateriasrodriguez.com.mx','media',true,'sin_probar'),
('d3522da1-28b4-47d9-af52-46e4feed1ebc','telefono','528332149886','media',true,'sin_probar'),
('b74b290e-cd9d-45a9-b661-3a7336d917cd','email_generico','admin@ratte.com.mx','media',true,'sin_probar'),
('b74b290e-cd9d-45a9-b661-3a7336d917cd','whatsapp_tienda','528124140221','alta',true,'declarado'),
('8cbd2cf4-b15f-4093-8254-999ee5c245d5','email_generico','pagos@sombrereriaregia.com.mx','media',true,'sin_probar'),
('c82fa109-a067-4c78-9140-dc9ec0f6288b','whatsapp_tienda','523320808180','alta',true,'declarado'),
('2672fe3a-df6e-46e5-b9f2-518bd594a184','email_generico','asesorenlinea@cuadra.com.mx','media',true,'sin_probar'),
('6b9c1c6b-5c5b-46fd-9807-10629680f0ab','email_generico','example@gmail.com','media',true,'sin_probar'),
('381f65ba-6c25-4f6d-bd9d-75312e770792','whatsapp_tienda','525634028624','alta',true,'declarado'),
('705a7235-ee7e-4a16-9864-dfdc19f160e8','email_generico','ventas@juguel.com','media',true,'sin_probar'),
('705a7235-ee7e-4a16-9864-dfdc19f160e8','whatsapp_tienda','528182749004','alta',true,'declarado'),
('e2ab0ea5-c148-488c-8ce7-95babbf8b9f1','email_generico','info@tumbiko.mx','media',true,'sin_probar'),
('e2ab0ea5-c148-488c-8ce7-95babbf8b9f1','whatsapp_tienda','525579229571','alta',true,'declarado'),
('a1e3f191-361a-4a51-a6b4-dbd19dd8f2f0','email_generico','atencionyservicio@verdeverdad.com','media',true,'sin_probar'),
('a1e3f191-361a-4a51-a6b4-dbd19dd8f2f0','whatsapp_tienda','525570055212','alta',true,'declarado'),
('a1e3f191-361a-4a51-a6b4-dbd19dd8f2f0','telefono','528009678422','media',true,'sin_probar'),
('995e2903-23d6-4264-81ef-529c2676b90b','whatsapp_tienda','529999260054','alta',true,'declarado'),
('995e2903-23d6-4264-81ef-529c2676b90b','telefono','529999260054','media',true,'sin_probar'),
('8ce0b732-6bcc-4f46-86b6-085c3edec111','email_generico','jodie@silverexposure.com','media',true,'sin_probar'),
('307a5c7d-b1dd-4a19-b523-3b7efd0088f0','email_generico','pedidos@lanuevaespana.com.mx','media',true,'sin_probar'),
('307a5c7d-b1dd-4a19-b523-3b7efd0088f0','telefono','529621359138','media',true,'sin_probar'),
('51ec71e4-64df-45cb-b114-09f19087eeca','email_generico','ecommerce@rodaccesorios.com','media',true,'sin_probar'),
('70720b30-055f-41f1-8424-f568053051ce','email_generico','contacto@luzo.info','media',true,'sin_probar'),
('70720b30-055f-41f1-8424-f568053051ce','telefono','525559291919','media',true,'sin_probar'),
('4b76ee5a-f684-4981-9270-ca7d8985fd31','whatsapp_tienda','526643108398','alta',true,'declarado'),
('4b76ee5a-f684-4981-9270-ca7d8985fd31','telefono','526646842252','media',true,'sin_probar'),
('04f28815-81fa-4fdf-ba53-86e243bb6483','email_generico','ecommerceoficial@berlei.com.mx','media',true,'sin_probar'),
('dc65abc2-6d1e-4116-a4b2-d274cdb9ed4b','email_generico','deportesjoyce@gmail.com','media',true,'sin_probar'),
('dc65abc2-6d1e-4116-a4b2-d274cdb9ed4b','whatsapp_tienda','526671310033','alta',true,'declarado'),
('e6fddaf6-829c-4a19-b40b-a4718057d309','email_generico','soluciones@guayaberasycamisas.com','media',true,'sin_probar'),
('82430ccb-3620-48c4-8f96-183603db319a','email_generico','info@ag925.mx','media',true,'sin_probar'),
('337de5fd-27fb-49dc-9192-cb8dcb5053d1','email_generico','help@help.desigual.com','media',true,'sin_probar'),
('7408d4f6-9379-41eb-a502-3d68158e636b','email_generico','marketing@formatex.com.mx','media',true,'sin_probar'),
('f13bb6e2-c656-43bb-bdba-b399371bbf68','email_generico','contacto@leonuniformes.com','media',true,'sin_probar'),
('f13bb6e2-c656-43bb-bdba-b399371bbf68','whatsapp_tienda','525614930126','alta',true,'declarado'),
('f13bb6e2-c656-43bb-bdba-b399371bbf68','telefono','525553841865','media',true,'sin_probar'),
('082144e9-40f2-4a1b-9f13-75a08fe6569d','whatsapp_tienda','528129090612','alta',true,'declarado'),
('082144e9-40f2-4a1b-9f13-75a08fe6569d','telefono','528129090612','media',true,'sin_probar'),
('d7a8e361-8b1f-41f5-a46f-e9fc2d76e277','email_generico','info@ciceg.org','media',true,'sin_probar'),
('88bf50b1-5a30-4a37-bf9f-3068e6f5a273','whatsapp_tienda','525578876551','alta',true,'declarado'),
('88bf50b1-5a30-4a37-bf9f-3068e6f5a273','telefono','525555423896','media',true,'sin_probar'),
('11b16e9a-c28f-48bb-94ba-fab2dd6721f4','email_generico','email.establo@gmail.com','media',true,'sin_probar'),
('c03c432c-626a-4d7c-b968-1db28a7bdc96','whatsapp_tienda','522214144509','alta',true,'declarado'),
('c03c432c-626a-4d7c-b968-1db28a7bdc96','telefono','522214144509','media',true,'sin_probar'),
('181ea0bb-d558-4962-b04c-4dc1e96cfb64','telefono','525521299841','media',true,'sin_probar'),
('add0e133-ece7-492b-8970-3db41083f58a','email_generico','boss_mazaryk@hugoboss.com','media',true,'sin_probar'),
('58583d1b-6d3d-4d58-9601-52fe0270764a','email_generico','silvon@gruposilvon.com','media',true,'sin_probar'),
('c8985e06-804b-4a4b-b853-bd505a66445c','telefono','525202879241','media',true,'sin_probar'),
('57909852-9593-41d5-ac54-527aa7c54123','whatsapp_tienda','526633182048','alta',true,'declarado'),
('1b08c9fe-7941-4899-83c7-43cc7acc128b','email_generico','ventas@textilesdelfuturo.com.mx','media',true,'sin_probar'),
('1b08c9fe-7941-4899-83c7-43cc7acc128b','telefono','523338262990','media',true,'sin_probar'),
('b1817940-06cb-4fa2-bb57-38ae49a51942','email_generico','info@bwigroup.com','media',true,'sin_probar'),
('b0ae85ab-7bfc-4250-afa8-f97f398a4844','email_generico','web@uaem.mx','media',true,'sin_probar'),
('01f77c82-7349-488b-a69a-2a2e2dedc90a','email_generico','ventas@joyasrobles.com','media',true,'sin_probar'),
('fb736788-7c68-42a9-8b80-a766e7eec3bf','telefono','524436928215','media',true,'sin_probar'),
('2e082dd1-9aa6-41d0-81c6-b5744c2894ad','email_generico','clientes@malandra.mx','media',true,'sin_probar'),
('2e082dd1-9aa6-41d0-81c6-b5744c2894ad','whatsapp_tienda','528114886601','alta',true,'declarado'),
('2e082dd1-9aa6-41d0-81c6-b5744c2894ad','telefono','528114886601','media',true,'sin_probar'),
('401d3296-2eb9-4171-9624-9463158e063e','email_generico','ucmolegario@yahoo.com.mx','media',true,'sin_probar'),
('c11562ee-7c09-49d7-a2d4-cfb672745da1','email_generico','atencionaclientes@highstreet.com.mx','media',true,'sin_probar'),
('c11562ee-7c09-49d7-a2d4-cfb672745da1','whatsapp_tienda','523331917648','alta',true,'declarado'),
('c3384fc2-41f5-4935-91dd-8181de43ddb2','whatsapp_tienda','523319088880','alta',true,'declarado'),
('c3384fc2-41f5-4935-91dd-8181de43ddb2','telefono','523333653280','media',true,'sin_probar'),
('210c6cac-927e-4f80-9958-3a62519380f8','email_generico','garriaga@atleticos.com.mx','media',true,'sin_probar'),
('79a25b7c-abbb-404d-a484-19892e5369a5','email_generico','ventas@clinik.com','media',true,'sin_probar'),
('91e26e76-b5a4-4eee-ba8c-286084bd2e71','email_generico','social@paruno.com','media',true,'sin_probar'),
('8998cb3c-f3f6-4758-8747-86554b416cee','email_generico','customerservice@quiksilver.com','media',true,'sin_probar'),
('b437279c-5266-43e4-bf21-edee9ebcdb66','email_generico','lizzethmartinezbridal@gmail.com','media',true,'sin_probar'),
('2ef21276-9900-4cf6-a45c-7648a3d01755','email_generico','ventas@botaschicho.com','media',true,'sin_probar'),
('0160dc85-d766-43b8-ad9e-201b1e1878d7','email_generico','dormirreal@dormireal.com','media',true,'sin_probar'),
('f6b34fb9-4c21-426a-adf2-1925c25168fc','email_generico','lobstore@lob.com.mx','media',true,'sin_probar'),
('1471b25e-5cea-4446-be1e-716789d6680b','email_generico','info@origenespuebla.com','media',true,'sin_probar'),
('1471b25e-5cea-4446-be1e-716789d6680b','whatsapp_tienda','522227649593','alta',true,'declarado'),
('40a001ee-e4af-4d10-9388-093f74cb6519','email_generico','ventas@plarte.com.mx','media',true,'sin_probar'),
('2776480b-d83b-4032-bd30-80fe57ae0028','email_generico','nallely@corptextiljt.com.mx','media',true,'sin_probar'),
('fdcc1205-5fb8-42f3-bf2a-d9e50bd0f790','whatsapp_tienda','525534550106','alta',true,'declarado'),
('2fa4585b-37bb-4833-85e0-c3e6aef7c545','email_generico','ventas@uniformesunico.com','media',true,'sin_probar'),
('2fa4585b-37bb-4833-85e0-c3e6aef7c545','telefono','522299314575','media',true,'sin_probar'),
('e5abe833-595c-43cb-b851-838403715268','whatsapp_tienda','522216622781','alta',true,'declarado'),
('d7f0384c-86c3-4146-8df0-4f45b1ec345a','email_generico','info@vigilante.com.mx','media',true,'sin_probar'),
('14de0dac-640a-4be7-9d96-9e0bef574901','email_generico','contacto@okulux.mx','media',true,'sin_probar'),
('14de0dac-640a-4be7-9d96-9e0bef574901','whatsapp_tienda','524421255097','alta',true,'declarado'),
('14de0dac-640a-4be7-9d96-9e0bef574901','telefono','524421255097','media',true,'sin_probar'),
('b28e54ad-28ef-4b9e-99ba-230594d63612','email_generico','ventas@clinik.com','media',true,'sin_probar'),
('a187cc47-976c-4361-8b90-cd7f410b90aa','whatsapp_tienda','526677770660','alta',true,'declarado'),
('a187cc47-976c-4361-8b90-cd7f410b90aa','telefono','526677153272','media',true,'sin_probar'),
('ec213370-85ca-4f12-8f53-80316682c759','email_generico','uniformes.danmar@gmail.com','media',true,'sin_probar'),
('5f231744-ec70-47d2-9fe7-85b3b7d05c43','email_generico','admin@centrojoyerozocalo.com','media',true,'sin_probar'),
('83a26ef9-1c50-497b-a0eb-07c0df70b3f0','email_generico','pagospesadilla@gmail.com','media',true,'sin_probar'),
('0b88264f-38db-4be3-939f-efff7c3480f3','email_generico','info@lizakoekkoek.com','media',true,'sin_probar'),
('0b88264f-38db-4be3-939f-efff7c3480f3','whatsapp_tienda','523322574268','alta',true,'declarado'),
('01f4b2be-cfaf-49e5-814f-50e0b6ba7122','email_generico','uniformes.donza@outlook.com','media',true,'sin_probar'),
('277e0190-bdca-4794-843f-3233861d3c61','email_generico','mllegeorgesand@gmail.com','media',true,'sin_probar'),
('fcf9d4e7-5c59-4eed-a283-77ed73925da7','whatsapp_tienda','528135578160','alta',true,'declarado'),
('360941f8-7b03-4630-bf8b-e94256578277','email_generico','info@gastrotourchef.com.mx','media',true,'sin_probar'),
('360941f8-7b03-4630-bf8b-e94256578277','whatsapp_tienda','529842148080','alta',true,'declarado'),
('360941f8-7b03-4630-bf8b-e94256578277','telefono','529842148080','media',true,'sin_probar'),
('26d3afbc-438f-4ef3-ac7a-8de73973fdcb','whatsapp_tienda','525536726098','alta',true,'declarado'),
('02be3e30-0717-45e9-8b9d-1fd5bcff618f','telefono','528181586450','media',true,'sin_probar'),
('33eb82c4-4821-40da-a513-c2eead21d26e','telefono','525553633833','media',true,'sin_probar'),
('a30eb6aa-7d90-4e15-8621-5cef9772244f','email_generico','ventas@maxicaps.com.mx','media',true,'sin_probar'),
('021bc0ee-3ace-4bda-bee7-d91e6c37843c','email_generico','ventas@tiendacharra.com','media',true,'sin_probar'),
('60b514ad-01f0-4b5e-985c-80cecc568df0','email_generico','alaherradura1991@gmail.com','media',true,'sin_probar'),
('053a5d84-8cf5-45ba-82ee-d369e457a0ae','email_generico','joyeriayhechurasrivera@gmail.com','media',true,'sin_probar'),
('6a8becac-b478-40b8-bb52-ccbc195ed381','email_generico','info@cwesternwear.com','media',true,'sin_probar'),
('7ac6dfd1-73ec-4d7c-94ae-08b8fc5d152d','email_generico','info@oldwest.mx','media',true,'sin_probar'),
('b90c1134-fd3e-4cc7-a5d1-b6859b554ac8','email_generico','silvon@gruposilvon.com','media',true,'sin_probar'),
('6296cbb6-c5a1-4239-b3f8-77886e74dc2a','telefono','522222149012','media',true,'sin_probar'),
('65735319-2886-469e-aa15-8b3bcc3bf323','email_generico','contacto@duque.mx','media',true,'sin_probar'),
('65735319-2886-469e-aa15-8b3bcc3bf323','whatsapp_tienda','524791377204','alta',true,'declarado'),
('65735319-2886-469e-aa15-8b3bcc3bf323','telefono','524791377204','media',true,'sin_probar'),
('7a917b87-2076-44f8-bc4c-65ae36cb1ce3','email_generico','ventas@gutsmx.com','media',true,'sin_probar'),
('6828bf67-fb34-437e-b313-0f4b2e84d523','email_generico','zapatodiabetico@hotmail.com','media',true,'sin_probar'),
('414e188f-cfe0-44db-a7e9-c8f0b27177e7','email_generico','ventas@clinik.com','media',true,'sin_probar'),
('36af4033-16fb-4fee-b24d-e78e0204159b','whatsapp_tienda','525585799484','alta',true,'declarado'),
('1c0ad49a-2b27-4d01-b416-b9bbf706237e','telefono','528002321212','media',true,'sin_probar'),
('a3e9f1e0-9cad-42bf-81e6-014e6b574dd6','email_generico','contacto@befashionstore.mx','media',true,'sin_probar'),
('a3e9f1e0-9cad-42bf-81e6-014e6b574dd6','whatsapp_tienda','528128990755','alta',true,'declarado'),
('682ec899-95c2-499f-bf79-8f43eba6c3bf','email_generico','informes@sombreroscuauhtemoc.mx','media',true,'sin_probar'),
('682ec899-95c2-499f-bf79-8f43eba6c3bf','whatsapp_tienda','522224645368','alta',true,'declarado'),
('682ec899-95c2-499f-bf79-8f43eba6c3bf','telefono','522224645368','media',true,'sin_probar'),
('8da1439d-0a89-48cd-bb90-8d04e3a15e2a','email_generico','customerservice@quiksilver.com','media',true,'sin_probar'),
('528ea393-8fe0-4c89-84c3-54d2f4acd73e','email_generico','ventas1@playerasmark.com','media',true,'sin_probar'),
('17da89ff-b679-44b2-811a-81160e917c19','whatsapp_tienda','528110358941','alta',true,'declarado'),
('0b8809b6-c63b-430f-9972-e87d8d741de7','email_generico','ventas@t-lobordo.com','media',true,'sin_probar'),
('b1be4165-ee7c-4ba9-9ba4-7827f7e909b1','email_generico','adabellanoviasyprincesas@gmail.com','media',true,'sin_probar'),
('b1be4165-ee7c-4ba9-9ba4-7827f7e909b1','telefono','528183543224','media',true,'sin_probar'),
('1d94e3bf-684e-4a6f-8f73-14829935b0e3','email_generico','contacto.llopticas@gmail.com','media',true,'sin_probar'),
('2dec9dfe-4215-4970-a6d6-09487cb68141','email_generico','mexico@lazzarmexico.com','media',true,'sin_probar'),
('7e8e1136-5766-4dfb-9118-99ef44e1c33a','whatsapp_tienda','529993155009','alta',true,'declarado'),
('00e7f440-0271-44ca-8225-39491feed712','email_generico','tanyre71@gmail.com','media',true,'sin_probar'),
('00e7f440-0271-44ca-8225-39491feed712','telefono','528714551452','media',true,'sin_probar'),
('c36e796d-0bd1-4e8d-8a2a-24e99cf3e783','telefono','525510546037','media',true,'sin_probar'),
('46493f4f-34cf-46a3-a6d0-6a66f0cd21a5','telefono','526181077031','media',true,'sin_probar'),
('6558e2fb-2e22-432f-8b2c-aaf293c39cbc','email_generico','contacto@chicaschein.com','media',true,'sin_probar'),
('65d28f13-2b7f-4e6b-9391-f83bd26b627e','email_generico','pedidosundoskin@hotmail.com','media',true,'sin_probar'),
('65d28f13-2b7f-4e6b-9391-f83bd26b627e','whatsapp_tienda','523471041887','alta',true,'declarado'),
('65d28f13-2b7f-4e6b-9391-f83bd26b627e','telefono','523787066332','media',true,'sin_probar'),
('6163498b-dd73-40eb-9c91-ed7affe45f91','email_generico','ventas@laperlajoyerias.com','media',true,'sin_probar'),
('d0ac5186-324d-40f9-8dc5-eff4493e5009','email_generico','ventas@marittijoyas.com','media',true,'sin_probar'),
('d0ac5186-324d-40f9-8dc5-eff4493e5009','whatsapp_tienda','523329489466','alta',true,'declarado'),
('14446fe4-fff0-472c-8c60-531f4ba39ed2','whatsapp_tienda','525515132253','alta',true,'declarado'),
('e4e343d4-9312-482a-8c23-b8f347d9b2ce','whatsapp_tienda','523315573151','alta',true,'declarado'),
('d2e8eb4e-b1c8-4db5-be99-28136977afe4','email_generico','contacto@tecnosocks.com','media',true,'sin_probar'),
('ddd8dee5-80a8-4882-b7f5-a7f032f9e42e','email_generico','monterreystore@ferragamo.com','media',true,'sin_probar'),
('ddd8dee5-80a8-4882-b7f5-a7f032f9e42e','telefono','528183564027','media',true,'sin_probar'),
('8fcb5127-b9ec-4d82-a486-0d6331f87a5b','email_generico','contacto@montblan.mx','media',true,'sin_probar'),
('8fcb5127-b9ec-4d82-a486-0d6331f87a5b','whatsapp_tienda','522229003070','alta',true,'declarado'),
('8fcb5127-b9ec-4d82-a486-0d6331f87a5b','telefono','522224033546','media',true,'sin_probar'),
('74bce925-ec2d-415b-932c-e91c8c09dafd','email_generico','ventas@hefestosmoda.com','media',true,'sin_probar'),
('74bce925-ec2d-415b-932c-e91c8c09dafd','whatsapp_tienda','529513328160','alta',true,'declarado'),
('870fe4ef-10e8-491e-8219-68de23f676d7','whatsapp_tienda','525611720577','alta',true,'declarado'),
('870fe4ef-10e8-491e-8219-68de23f676d7','telefono','525611720577','media',true,'sin_probar'),
('6c161422-92e1-4415-b82e-0c5e8d000019','whatsapp_tienda','524425761518','alta',true,'declarado'),
('11219b5e-fad7-4616-aec7-5409669632ad','whatsapp_tienda','524439345516','alta',true,'declarado'),
('11219b5e-fad7-4616-aec7-5409669632ad','telefono','524439345516','media',true,'sin_probar'),
('35784eb2-1838-476f-ab89-1ea4a3f6029c','whatsapp_tienda','528186828115','alta',true,'declarado'),
('3d026714-ebe2-4b8e-82af-34c7a5a2ae63','email_generico','tienda@pirouette.mx','media',true,'sin_probar'),
('a503573c-b7bc-4ce6-94b0-b6d5addc82b0','email_generico','hola@lineas.com.mx','media',true,'sin_probar'),
('934bd69d-612b-41a1-aab4-2d728daf6aae','email_generico','proviamiga@mundoprovidencia.com','media',true,'sin_probar'),
('19578094-bd3d-46d1-b51b-8aa6b152816d','email_generico','info@jdk.mx','media',true,'sin_probar'),
('499ab6fa-7451-4ec4-b499-7852934f53a8','email_generico','ventas@deportescancun.mx','media',true,'sin_probar'),
('499ab6fa-7451-4ec4-b499-7852934f53a8','whatsapp_tienda','529984199828','alta',true,'declarado'),
('1773fb70-d81e-4ee0-af76-ae6aa60fcbd0','email_generico','recepcion@lozmerjoyeros.com','media',true,'sin_probar'),
('8c2b4f19-2ff0-49b2-9075-6cc8ed3685d8','email_generico','miradisfraces@gmail.com','media',true,'sin_probar'),
('8c2b4f19-2ff0-49b2-9075-6cc8ed3685d8','whatsapp_tienda','529612264911','alta',true,'declarado'),
('d93a629c-6b6d-407c-b2c8-22a5de084cf1','email_generico','contacto@tiendasmaxima.com.mx','media',true,'sin_probar'),
('e17a1506-35a2-4561-b1f1-955138d9a6b5','email_generico','ventas@depielyalgomas.com','media',true,'sin_probar'),
('e80b0246-d184-413e-94cd-37d6221f9347','email_generico','ventas@emporiosport.com.mx','media',true,'sin_probar'),
('e80b0246-d184-413e-94cd-37d6221f9347','whatsapp_tienda','525611073916','alta',true,'declarado'),
('e80b0246-d184-413e-94cd-37d6221f9347','telefono','525555428824','media',true,'sin_probar'),
('a3d7e60c-3383-490a-950a-b44d8eb08843','email_generico','siniestrarockstore@gmail.com','media',true,'sin_probar'),
('f9c6a3fc-04e5-40aa-83fa-da39d8e83c05','email_generico','cponce@lazzarmexico.com','media',true,'sin_probar'),
('f9c6a3fc-04e5-40aa-83fa-da39d8e83c05','telefono','525593085493','media',true,'sin_probar'),
('0fa91fdb-a089-4bb2-b958-1f6f9dfbc28d','whatsapp_tienda','525530580569','alta',true,'declarado'),
('0fa91fdb-a089-4bb2-b958-1f6f9dfbc28d','telefono','525574607748','media',true,'sin_probar'),
('f3686905-1e68-45f4-a60a-74e42447cfd7','email_generico','tintaseinsumos@hotmail.com','media',true,'sin_probar'),
('f3686905-1e68-45f4-a60a-74e42447cfd7','whatsapp_tienda','529612140876','alta',true,'declarado'),
('f3686905-1e68-45f4-a60a-74e42447cfd7','telefono','529616126139','media',true,'sin_probar'),
('2690efaa-df63-4fd4-99d8-b58452806799','email_generico','ventas@uniformeslaabejita.com','media',true,'sin_probar'),
('2690efaa-df63-4fd4-99d8-b58452806799','whatsapp_tienda','523324968556','alta',true,'declarado'),
('2690efaa-df63-4fd4-99d8-b58452806799','telefono','523324968556','media',true,'sin_probar'),
('3339ae65-a4b2-4a48-b7a8-0ec608d47148','email_generico','casa.tovar@hotmail.com','media',true,'sin_probar'),
('3339ae65-a4b2-4a48-b7a8-0ec608d47148','whatsapp_tienda','524811232981','alta',true,'declarado'),
('3339ae65-a4b2-4a48-b7a8-0ec608d47148','telefono','524813821725','media',true,'sin_probar'),
('45d514e3-3ef4-44e0-939f-61c453fe6d13','telefono','525568026533','media',true,'sin_probar'),
('f7600e1d-6ab3-404e-a103-c68d41577d61','email_generico','ventas1@codigouniformes.com.mx','media',true,'sin_probar'),
('b617cf7e-70ed-44f3-8755-2e4b76b895aa','whatsapp_tienda','523221356302','alta',true,'declarado'),
('b617cf7e-70ed-44f3-8755-2e4b76b895aa','telefono','523221356302','media',true,'sin_probar'),
('088dd8e8-7a4d-4665-bd59-b3f771f595f1','email_generico','mondepell@gmail.com','media',true,'sin_probar'),
('088dd8e8-7a4d-4665-bd59-b3f771f595f1','telefono','525556782240','media',true,'sin_probar'),
('6133b453-9a37-4aba-8af0-8da2c99631b2','email_generico','andres.valens@uniformesfinoshidalgo.com','media',true,'sin_probar'),
('6133b453-9a37-4aba-8af0-8da2c99631b2','whatsapp_tienda','528184598077','alta',true,'declarado'),
('04ee700c-fdd7-4635-8df9-c79d0f905a18','whatsapp_tienda','528113807142','alta',true,'declarado'),
('04ee700c-fdd7-4635-8df9-c79d0f905a18','telefono','528183449259','media',true,'sin_probar'),
('3e62a6a1-7fd1-4909-abf7-179b5d4c33ef','whatsapp_tienda','528120065308','alta',true,'declarado'),
('d77932de-6c69-4230-8ced-1b1bfa148400','email_generico','mercerias.net@gmail.com','media',true,'sin_probar'),
('d77932de-6c69-4230-8ced-1b1bfa148400','telefono','528183752250','media',true,'sin_probar'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','email_generico','info@elybride.com','media',true,'sin_probar'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','whatsapp_tienda','529988977717','alta',true,'declarado'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','telefono','529988977717','media',true,'sin_probar'),
('6d2d3379-4fe2-40f9-bec2-533cae23fdf8','email_generico','online@fiftyoutlet.com','media',true,'sin_probar'),
('3f003ad8-8043-4d2a-bb06-428dd1ad090d','email_generico','contacto@trajesdecharrogarcia.com.mx','media',true,'sin_probar'),
('3f003ad8-8043-4d2a-bb06-428dd1ad090d','whatsapp_tienda','525515269182','alta',true,'declarado'),
('3f003ad8-8043-4d2a-bb06-428dd1ad090d','telefono','525555263029','media',true,'sin_probar'),
('0ed6dadf-0d06-4f57-9d11-9b1368280431','email_generico','contacto@latallaperfecta.com.mx','media',true,'sin_probar'),
('3510f556-5a32-42e4-aaf6-54dea4cda932','email_generico','contacto@playerasvallarta.com','media',true,'sin_probar'),
('3510f556-5a32-42e4-aaf6-54dea4cda932','whatsapp_tienda','523221505264','alta',true,'declarado'),
('8dcd8b2a-2492-4362-95a1-e167c0ca0532','email_generico','vinitex2@hotmail.com','media',true,'sin_probar'),
('8dcd8b2a-2492-4362-95a1-e167c0ca0532','whatsapp_tienda','523329189920','alta',true,'declarado'),
('b8b92702-de63-4f11-8ca5-3ad4452457d0','telefono','524423843000','media',true,'sin_probar'),
('c386b80c-f5cf-468e-a9a5-bf43b018bcb1','email_generico','cayala@uniformeskared.com','media',true,'sin_probar'),
('c386b80c-f5cf-468e-a9a5-bf43b018bcb1','whatsapp_tienda','526188393020','alta',true,'declarado'),
('c386b80c-f5cf-468e-a9a5-bf43b018bcb1','telefono','526181964380','media',true,'sin_probar'),
('cfb6731c-51c0-4e0b-8c3d-d3cd56a7703c','telefono','522292236798','media',true,'sin_probar'),
('8645c2a5-8e53-4279-a56d-be67490089ea','email_generico','infokokodogz@gmail.com','media',true,'sin_probar'),
('771b0aa3-6b57-4648-8877-863f5578a21a','email_generico','contacto@canaiveyucatan.org.mx','media',true,'sin_probar'),
('771b0aa3-6b57-4648-8877-863f5578a21a','whatsapp_tienda','529995894487','alta',true,'declarado'),
('3ea9bb9f-b03c-403e-9ccc-5adb317b5194','email_generico','ventas@vestidosnatbridal.com','media',true,'sin_probar'),
('3ea9bb9f-b03c-403e-9ccc-5adb317b5194','whatsapp_tienda','525578785378','alta',true,'declarado'),
('11c5918a-4588-4604-a6ec-2db04d0d38be','email_generico','playerasgocas@gmail.com','media',true,'sin_probar'),
('11c5918a-4588-4604-a6ec-2db04d0d38be','whatsapp_tienda','525623967852','alta',true,'declarado'),
('11c5918a-4588-4604-a6ec-2db04d0d38be','telefono','525555381734','media',true,'sin_probar'),
('daa991af-2634-4704-ac00-7a43fc11f32e','telefono','528332170088','media',true,'sin_probar'),
('c8677487-5aa1-431a-bedf-31d8809d1bac','email_generico','contacto@domikuniformes.com','media',true,'sin_probar'),
('212a8734-1416-4c96-881e-25d143998f97','whatsapp_tienda','524494811213','alta',true,'declarado'),
('7a6269bc-3bbc-4a2d-99d4-a025f28580f1','email_generico','contacto@domikuniformes.com','media',true,'sin_probar'),
('a3d0e3a5-d9a6-486a-8465-90fb9de68484','email_generico','ventas1@codigouniformes.com.mx','media',true,'sin_probar'),
('65d7ff4b-257b-4d23-a08b-8833d91668b8','email_generico','tecnoserviciosgto@gmail.com','media',true,'sin_probar'),
('65d7ff4b-257b-4d23-a08b-8833d91668b8','whatsapp_tienda','524779219895','alta',true,'declarado'),
('9385cdff-2f38-42d6-b53c-3806c140333b','email_generico','ventas@unipromo.mx','media',true,'sin_probar'),
('9385cdff-2f38-42d6-b53c-3806c140333b','whatsapp_tienda','526861152777','alta',true,'declarado'),
('8b5c08c7-c664-4150-bd0a-16db011e8b85','email_generico','compras@romen.com.mx','media',true,'sin_probar'),
('8b5c08c7-c664-4150-bd0a-16db011e8b85','whatsapp_tienda','525543243680','alta',true,'declarado'),
('978ee5e3-6fa5-478d-a01b-dd5e3aa96466','whatsapp_tienda','528261592014','alta',true,'declarado'),
('05b32f49-5067-4eda-9a0c-423f952a1786','email_generico','contacto@croga.com.mx','media',true,'sin_probar'),
('67560147-f568-43ff-8476-5b5f3d538cb0','email_generico','info@uniformesybordados.mx','media',true,'sin_probar'),
('67560147-f568-43ff-8476-5b5f3d538cb0','telefono','526646343312','media',true,'sin_probar'),
('ce4224ff-b3ea-4636-8aee-c52502a1e4a9','email_generico','info@estopasfinasags.com.mx','media',true,'sin_probar'),
('1c85a9ab-f14f-4084-ab90-3fd8d095bbaa','whatsapp_tienda','523316972569','alta',true,'declarado'),
('c5322663-da1e-455b-b4ef-7fed9c42b1c2','email_generico','ventas1@playerasmark.com','media',true,'sin_probar'),
('980b321d-bee9-4e9e-a894-2f947eb71202','email_generico','info@belisapulido.com','media',true,'sin_probar'),
('980b321d-bee9-4e9e-a894-2f947eb71202','telefono','525518361290','media',true,'sin_probar'),
('0802e5d1-32c3-4a03-bf6d-c031f138c1bd','email_generico','tonnny_05@hotmail.com','media',true,'sin_probar'),
('0802e5d1-32c3-4a03-bf6d-c031f138c1bd','telefono','529381379414','media',true,'sin_probar'),
('129efa40-f59b-46d7-a408-12f66a8b04ad','whatsapp_tienda','525578343522','alta',true,'declarado'),
('129efa40-f59b-46d7-a408-12f66a8b04ad','telefono','525594629924','media',true,'sin_probar'),
('ee4d1c3c-9d95-46bd-b741-97b0136bbedb','whatsapp_tienda','523310115736','alta',true,'declarado'),
('b4d2ba6f-4e61-43bf-9ae8-5c1bc7954f62','whatsapp_tienda','523321670061','alta',true,'declarado'),
('3048c1d3-de37-4491-8134-e9515317fffc','email_generico','contacto@cuelloblanco.com.mx','media',true,'sin_probar'),
('3048c1d3-de37-4491-8134-e9515317fffc','whatsapp_tienda','524428899350','alta',true,'declarado'),
('e1c1aba0-a28f-4cf0-91b9-e782870aac54','email_generico','ventas@carmenrion.com','media',true,'sin_probar'),
('e1c1aba0-a28f-4cf0-91b9-e782870aac54','whatsapp_tienda','525574381890','alta',true,'declarado'),
('3f74952f-3e92-4192-8b87-e44a7221c62f','email_generico','admon@troppomoda.com','media',true,'sin_probar'),
('4a8690d9-9f66-4061-b470-2022b29720cd','email_generico','info@mayro.com.mx','media',true,'sin_probar'),
('db959d23-de72-4107-8258-92ff43a8c097','email_generico','ventas@cqualy.com','media',true,'sin_probar'),
('2a5feb11-978b-4667-adf3-ebcbfeac3fd8','email_generico','negocios@regency.com.mx','media',true,'sin_probar'),
('9ae3759d-634d-48c3-835e-fbc9082cf3a9','email_generico','sac@piccini.com.mx','media',true,'sin_probar'),
('9ae3759d-634d-48c3-835e-fbc9082cf3a9','whatsapp_tienda','528441223946','alta',true,'declarado'),
('9ae3759d-634d-48c3-835e-fbc9082cf3a9','telefono','528444318888','media',true,'sin_probar'),
('4430543b-78c0-480e-94a5-25eef53299e2','email_generico','sublim@sublimpromocionales.com','media',true,'sin_probar'),
('4430543b-78c0-480e-94a5-25eef53299e2','whatsapp_tienda','522228476388','alta',true,'declarado'),
('4430543b-78c0-480e-94a5-25eef53299e2','telefono','522222378025','media',true,'sin_probar'),
('b6f2075c-a357-48b3-90af-293f39d70493','email_generico','yumuri@yumuri.com.mx','media',true,'sin_probar'),
('b6f2075c-a357-48b3-90af-293f39d70493','telefono','525555670700','media',true,'sin_probar'),
('015f8a5f-937e-4043-a294-376d11f0fe46','whatsapp_tienda','525594149691','alta',true,'declarado'),
('015f8a5f-937e-4043-a294-376d11f0fe46','telefono','525594149691','media',true,'sin_probar'),
('dbcceb96-dea8-461f-b65c-e7ba89ceb603','email_generico','sales@elcharro1.com','media',true,'sin_probar'),
('dbcceb96-dea8-461f-b65c-e7ba89ceb603','telefono','529155347956','media',true,'sin_probar'),
('51351386-4d11-45a3-a398-537c621d3530','whatsapp_tienda','524773298055','alta',true,'declarado'),
('aabc44a2-12de-4317-a151-dba49ef8bc70','whatsapp_tienda','528110147973','alta',true,'declarado'),
('aabc44a2-12de-4317-a151-dba49ef8bc70','telefono','528181907373','media',true,'sin_probar'),
('5500c478-5804-4f13-81fa-4cd088f3a5ff','email_generico','informacion@secretodepandora.com','media',true,'sin_probar'),
('5500c478-5804-4f13-81fa-4cd088f3a5ff','whatsapp_tienda','524434753747','alta',true,'declarado'),
('5500c478-5804-4f13-81fa-4cd088f3a5ff','telefono','524433136560','media',true,'sin_probar'),
('a92f9cb7-dd3c-4df5-aef2-94a6dd5b5afd','email_generico','lau.cecilia93@gmail.com','media',true,'sin_probar'),
('e75d1221-7ce4-4e13-9f34-2d066d5af770','email_generico','pantaloneseljefe@gmail.com','media',true,'sin_probar'),
('e75d1221-7ce4-4e13-9f34-2d066d5af770','whatsapp_tienda','528134023112','alta',true,'declarado'),
('9b412fe9-0a2c-40d6-b89a-25a667b71fe2','email_generico','textildistribuidores@hotmail.com','media',true,'sin_probar'),
('9b412fe9-0a2c-40d6-b89a-25a667b71fe2','whatsapp_tienda','526671023025','alta',true,'declarado'),
('9b412fe9-0a2c-40d6-b89a-25a667b71fe2','telefono','526677137988','media',true,'sin_probar'),
('c2c13bef-0286-44b8-97fa-1deb0c7f2718','whatsapp_tienda','528443146666','alta',true,'declarado'),
('7bed4365-cb81-48c0-b2a9-3db18c086fe8','whatsapp_tienda','522226820694','alta',true,'declarado'),
('d60ebcaa-442d-4a0b-97a6-d053ea9a573e','email_generico','su.moda.real@gmail.com','media',true,'sin_probar'),
('d60ebcaa-442d-4a0b-97a6-d053ea9a573e','telefono','526144838309','media',true,'sin_probar'),
('1f9fef63-6da4-42f6-8871-d125c5f3babf','email_generico','ventas@latijera.mx','media',true,'sin_probar'),
('1f9fef63-6da4-42f6-8871-d125c5f3babf','telefono','528717128452','media',true,'sin_probar'),
('471061fa-dee3-4256-9095-2dfef171ec9b','email_generico','hola@benandfrank.com','media',true,'sin_probar'),
('471061fa-dee3-4256-9095-2dfef171ec9b','whatsapp_tienda','525571000395','alta',true,'declarado'),
('471061fa-dee3-4256-9095-2dfef171ec9b','telefono','525512051050','media',true,'sin_probar'),
('365bd8d2-415e-478c-b6dc-af8323aa7557','email_generico','joyasarco@gmail.com','media',true,'sin_probar'),
('365bd8d2-415e-478c-b6dc-af8323aa7557','whatsapp_tienda','523318726197','alta',true,'declarado'),
('365bd8d2-415e-478c-b6dc-af8323aa7557','telefono','523318726197','media',true,'sin_probar'),
('b7ea6113-a228-4275-b17d-364a2727354f','email_generico','ventas1@sparviero.com.mx','media',true,'sin_probar'),
('b7ea6113-a228-4275-b17d-364a2727354f','telefono','528183709196','media',true,'sin_probar'),
('e67fcf69-6fa7-4630-927b-98c2191c14a4','whatsapp_tienda','525565085710','alta',true,'declarado'),
('e67fcf69-6fa7-4630-927b-98c2191c14a4','telefono','525565085710','media',true,'sin_probar'),
('86727926-ef0e-49f9-b94a-3fd2e0a58871','email_generico','contacto@stractto.com','media',true,'sin_probar'),
('86727926-ef0e-49f9-b94a-3fd2e0a58871','whatsapp_tienda','523311867900','alta',true,'declarado'),
('e18cbe6f-c2a2-48e2-af7b-8c8ff26e4a94','telefono','523336471942','media',true,'sin_probar'),
('67da96fa-12e5-4d9d-97ca-13aa3aa414a7','email_generico','opticamadero@opticahera.com','media',true,'sin_probar'),
('67da96fa-12e5-4d9d-97ca-13aa3aa414a7','whatsapp_tienda','525585734647','alta',true,'declarado'),
('aff49070-9fb1-4603-a8e5-9789ba1f35f5','whatsapp_tienda','524421139948','alta',true,'declarado'),
('aff49070-9fb1-4603-a8e5-9789ba1f35f5','telefono','522201750032','media',true,'sin_probar'),
('e3aaaea2-7b90-4468-b7ee-e750ec1d7b2a','email_generico','ecodenogales@hotmail.com','media',true,'sin_probar'),
('e3aaaea2-7b90-4468-b7ee-e750ec1d7b2a','telefono','526313122040','media',true,'sin_probar'),
('eac11301-cd8b-4f91-8e5e-08406d1637d0','email_generico','info@outletdeplayeras.com','media',true,'sin_probar'),
('e2ada293-4e65-427b-8127-46b1417a2352','email_generico','calicuse@yahoo.com.mx','media',true,'sin_probar'),
('15221201-a3d1-43ce-80cd-09fb88408cf6','whatsapp_tienda','523330287951','alta',true,'declarado'),
('9862b719-b249-4ba0-8d54-b1afc60b42bc','email_generico','joel.cruz@lamaria.com.mx','media',true,'sin_probar'),
('9862b719-b249-4ba0-8d54-b1afc60b42bc','telefono','522222244241','media',true,'sin_probar'),
('30de2680-7010-4cf2-820e-ae2a9a541630','email_generico','ventas@logosybordados.com','media',true,'sin_probar'),
('30de2680-7010-4cf2-820e-ae2a9a541630','telefono','525553621816','media',true,'sin_probar'),
('cf4b7967-7b13-4a86-ba74-7871a7fec39d','email_generico','redibytes@gmail.com','media',true,'sin_probar'),
('d5607099-0c9c-4bad-bf0b-c30aa3f6cc5e','email_generico','info@estampalo.com','media',true,'sin_probar'),
('f321ae2d-d32a-4136-a286-3c410411da6e','email_generico','atn_clientes@opticaskauffman.com.mx','media',true,'sin_probar'),
('4ee96139-3bfa-45f7-b339-ce896d456903','email_generico','contacto@actiongroup.com.mx','media',true,'sin_probar'),
('dfbe5c09-f82c-492d-88ce-a5dd065e8e87','whatsapp_tienda','529512402734','alta',true,'declarado'),
('96735d8a-0393-4d8c-9caf-97ce9e9c5189','email_generico','info@outletdeplayeras.com','media',true,'sin_probar'),
('614e905c-7e9c-4401-a2db-2c476d125442','email_generico','rvillasante@viye.com.mx','media',true,'sin_probar'),
('614e905c-7e9c-4401-a2db-2c476d125442','whatsapp_tienda','525641151488','alta',true,'declarado'),
('8669ffd3-ac15-40fc-80a2-ca8ec3b61c63','email_generico','ventas@maxicaps.com.mx','media',true,'sin_probar'),
('431e2b5e-fbba-41e9-bce9-4f78eb10c6ed','email_generico','contacto@promoscreativos.com','media',true,'sin_probar'),
('5e82f579-ee98-468b-8359-490fab7ee05e','whatsapp_tienda','528112088178','alta',true,'declarado'),
('8fcea235-9933-4ec9-a57e-e5b727896bea','email_generico','jorge.castelan@casbec.com.mx','media',true,'sin_probar'),
('63b61188-db0b-4337-a403-d124530f48bf','telefono','529931214005','media',true,'sin_probar'),
('6adbdd4a-9ac7-41a1-abeb-497a7adbef6e','whatsapp_tienda','525572482687','alta',true,'declarado'),
('6adbdd4a-9ac7-41a1-abeb-497a7adbef6e','telefono','525572482687','media',true,'sin_probar'),
('5a733d0f-b23c-4eed-8199-27c8e9a59bfd','email_generico','contacto@desportik.com','media',true,'sin_probar'),
('5a733d0f-b23c-4eed-8199-27c8e9a59bfd','telefono','524448151781','media',true,'sin_probar'),
('eabec169-50c3-49ab-85b0-5beaf1737f94','whatsapp_tienda','528116291526','alta',true,'declarado'),
('4c8e35fa-1cae-421d-98d4-cd79b337d824','telefono','527123399294','media',true,'sin_probar'),
('911ceb05-3c99-4f0a-abd7-5f77f666e695','email_generico','support@calcetinespachuca.store','media',true,'sin_probar'),
('84d864c5-cb1b-4e97-a26a-4471f6faa3cf','email_generico','contacto@sportico.com.mx','media',true,'sin_probar'),
('84d864c5-cb1b-4e97-a26a-4471f6faa3cf','whatsapp_tienda','525561663960','alta',true,'declarado'),
('84d864c5-cb1b-4e97-a26a-4471f6faa3cf','telefono','525566516020','media',true,'sin_probar'),
('68d10e68-ef1b-48e6-8001-7ccc603cda00','email_generico','atencion@scappino.com','media',true,'sin_probar'),
('68d10e68-ef1b-48e6-8001-7ccc603cda00','whatsapp_tienda','525543481019','alta',true,'declarado'),
('9ec175bf-b008-4d2a-b0e3-ab665a25c86a','email_generico','hugo_puntovalle@hugoboss.com','media',true,'sin_probar'),
('eb17044f-8008-41f1-898a-7d9cc0ab29ab','email_generico','contacto@streetsilver.mx','media',true,'sin_probar'),
('eb17044f-8008-41f1-898a-7d9cc0ab29ab','telefono','528181400868','media',true,'sin_probar'),
('4bdd28ba-468e-42c5-9111-6b0d8f932343','whatsapp_tienda','528114642039','alta',true,'declarado'),
('1905828a-8f2d-438c-9014-a7a58020dde3','email_generico','atenciononline@duo.com.mx','media',true,'sin_probar'),
('1905828a-8f2d-438c-9014-a7a58020dde3','whatsapp_tienda','526682360911','alta',true,'declarado'),
('939b654c-d66c-4e11-8122-73bf6ccc1922','telefono','525556721450','media',true,'sin_probar'),
('594315b5-8f96-42e9-9ad0-5de84aa65364','email_generico','juan.vera@comprausadomexico.com.mx','media',true,'sin_probar'),
('594315b5-8f96-42e9-9ad0-5de84aa65364','whatsapp_tienda','525585803322','alta',true,'declarado'),
('e1bf4122-4f17-4aa3-80dd-5cd2e5b62889','email_generico','contacto@vintagedecoracion.com.mx','media',true,'sin_probar'),
('e1bf4122-4f17-4aa3-80dd-5cd2e5b62889','whatsapp_tienda','526141704233','alta',true,'declarado'),
('e1bf4122-4f17-4aa3-80dd-5cd2e5b62889','telefono','526145750868','media',true,'sin_probar'),
('868bd200-0e45-460c-a2fe-95c6b3662b3e','email_generico','georgerdz24@gmail.com','media',true,'sin_probar'),
('868bd200-0e45-460c-a2fe-95c6b3662b3e','telefono','528127669524','media',true,'sin_probar'),
('81dbf9e7-9e83-4def-b38d-9df9cb76255e','whatsapp_tienda','528127534215','alta',true,'declarado'),
('4b69fd17-f18b-4f8a-9d51-ff9a2b0160e7','email_generico','ventas@blackkissmx.com','media',true,'sin_probar'),
('3cd1f39e-cdf9-4e4d-b4fd-d48f9f2da69d','telefono','528000006872','media',true,'sin_probar'),
('0d11aafb-1949-4cc2-8dac-0dee13e62f89','email_generico','info@candyshop.com.mx','media',true,'sin_probar'),
('69ad1de6-de84-407c-a115-b910058c83b8','email_generico','ventas@fabricadetrajesdecharrogabrieles.com','media',true,'sin_probar'),
('69ad1de6-de84-407c-a115-b910058c83b8','whatsapp_tienda','525537015964','alta',true,'declarado'),
('69ad1de6-de84-407c-a115-b910058c83b8','telefono','525567941664','media',true,'sin_probar'),
('2103cbb1-f503-4b44-a0f2-1e3470457214','whatsapp_tienda','525554682563','alta',true,'declarado'),
('527bd42d-7414-4797-a7b3-4f4b3ac5fb02','email_generico','contacto@sary.com.mx','media',true,'sin_probar'),
('527bd42d-7414-4797-a7b3-4f4b3ac5fb02','telefono','523336720909','media',true,'sin_probar'),
('bde30ac4-6ae8-4598-b285-599bde364ff2','whatsapp_tienda','524771794796','alta',true,'declarado'),
('59c93124-12f4-40e0-9e43-4e4bbba0908f','telefono','525549349617','media',true,'sin_probar'),
('ce81327a-4ae5-42da-8cdc-0d8e75249ffd','whatsapp_tienda','523318474081','alta',true,'declarado'),
('cbd1f859-9cda-48c4-bfce-b6aecdfcbbe5','email_generico','canaivetehuacan@gmail.com','media',true,'sin_probar'),
('e5a1a820-819d-49b4-b97a-1414d463abf2','email_generico','bikinisriosyvalles@gmail.com','media',true,'sin_probar'),
('e5a1a820-819d-49b4-b97a-1414d463abf2','whatsapp_tienda','523112378341','alta',true,'declarado'),
('760cc90f-c55d-48cf-848d-dd5ad037f411','email_generico','info@visualmerchandisinglab.com','media',true,'sin_probar'),
('be60033f-3dad-4bd9-822b-bcbba9582c95','whatsapp_tienda','528128908120','alta',true,'declarado'),
('be60033f-3dad-4bd9-822b-bcbba9582c95','telefono','528128908120','media',true,'sin_probar'),
('03854931-06e1-4857-bb26-37aef1e9c635','email_generico','alcala831@hotmail.com','media',true,'sin_probar'),
('03854931-06e1-4857-bb26-37aef1e9c635','telefono','524931205531','media',true,'sin_probar'),
('08acbcc4-c9f4-4285-b5d6-96e36db86567','email_generico','pliegohats@yahoo.com','media',true,'sin_probar'),
('cd4cd6c0-54e9-4943-9db0-b484364d149c','email_generico','ventas@mrcachuchero.com','media',true,'sin_probar'),
('cd4cd6c0-54e9-4943-9db0-b484364d149c','whatsapp_tienda','528661021666','alta',true,'declarado'),
('44f43319-b65d-40b8-96c0-50e3f4eb9662','whatsapp_tienda','525648967642','alta',true,'declarado')
on conflict do nothing;

insert into abm_fuentes (cuenta_id, campo, valor, metodo, confianza, agente) values
('531c2cf9-a4c5-40ed-a394-2bc577637763','email','atencion@elnuevomundo.com','sitio_propio','media','raspado-top2'),
('f7cbdfbe-c730-41dd-8d4b-b77aba2f3e9b','email','contacto@priceshoes.com','sitio_propio','media','raspado-top2'),
('f4716738-ccf2-4799-97d5-264e280db4cc','whatsapp','525518012835','sitio_propio','alta','raspado-top2'),
('68db6ac0-d319-4ca3-a1c9-2ebcb0c0ec06','email','info@sapica.com','sitio_propio','media','raspado-top2'),
('b9544a15-96aa-4d82-b4a2-e6dd7c34f1af','whatsapp','525546085201','sitio_propio','alta','raspado-top2'),
('9c6a66a5-1e25-4d6f-b002-14bd8a5c5866','whatsapp','523335881570','sitio_propio','alta','raspado-top2'),
('c90d67de-f822-4326-b00f-57843d3f942f','email','ayuda@chapur.com.mx','sitio_propio','media','raspado-top2'),
('db4f57c1-597f-4aab-8803-510dda717c66','email','info@granplazaoutlets.com','sitio_propio','media','raspado-top2'),
('6685002f-5fea-46b9-832b-64e8236ca5e7','whatsapp','525554795374','sitio_propio','alta','raspado-top2'),
('ef15b116-3d46-44b1-a5d0-d1e22a6d6ffa','email','moises@goodbyefolk.com','sitio_propio','media','raspado-top2'),
('7e1ff3f0-67c3-4d28-ba37-3535a3fe6771','whatsapp','522292153983','sitio_propio','alta','raspado-top2'),
('667ddee9-267a-4d92-89f5-c1c1fc72a1cd','email','infinitijoyas@gmail.com','sitio_propio','media','raspado-top2'),
('667ddee9-267a-4d92-89f5-c1c1fc72a1cd','whatsapp','528120326282','sitio_propio','alta','raspado-top2'),
('3a6db856-f6fa-49c4-8d0a-7368459af7d0','email','contacto@promoda.com.mx','sitio_propio','media','raspado-top2'),
('c69cff03-2bff-4068-b1ce-40b6a875bfc2','email','u003cdax@dax.com.mx','sitio_propio','media','raspado-top2'),
('de1036b0-98c2-4feb-905e-63db477957d4','email','contacto@miguelito.mx','sitio_propio','media','raspado-top2'),
('de1036b0-98c2-4feb-905e-63db477957d4','whatsapp','525610216294','sitio_propio','alta','raspado-top2'),
('e343b721-599f-48bd-afee-64cdacc0727e','whatsapp','528124277881','sitio_propio','alta','raspado-top2'),
('df468897-890d-4274-959d-132a68ad5251','email','info@yulygiraldo.com','sitio_propio','media','raspado-top2'),
('bbde869a-5a08-47e6-bd7d-9359ca2a9c1a','email','ventasonline@artistcity.com.mx','sitio_propio','media','raspado-top2'),
('a08d6057-e06c-45c5-96e7-e26a23264b4b','email','ventas@garufajeans.com.mx','sitio_propio','media','raspado-top2'),
('a08d6057-e06c-45c5-96e7-e26a23264b4b','whatsapp','525530422356','sitio_propio','alta','raspado-top2'),
('25b97676-317c-4a7d-9490-43f6feae8db3','whatsapp','526462876359','sitio_propio','alta','raspado-top2'),
('86caece2-b9cb-4f4d-8b6b-dfc153e1aa4d','email','mindoracollection@gmail.com','sitio_propio','media','raspado-top2'),
('5ae9834f-c13c-4f0b-aeca-3919fa3bf127','email','contacto@moutyjoyeria.com','sitio_propio','media','raspado-top2'),
('f333ad0e-b722-48c0-9d97-158f4dee0e64','whatsapp','526145990767','sitio_propio','alta','raspado-top2'),
('5334874c-f511-4447-aebe-20a2b380707b','email','ventas@ameliejoyas.com','sitio_propio','media','raspado-top2'),
('5334874c-f511-4447-aebe-20a2b380707b','whatsapp','523322214807','sitio_propio','alta','raspado-top2'),
('0e47ad7f-0183-4d55-904e-b4791c579b4b','whatsapp','523315841191','sitio_propio','alta','raspado-top2'),
('b497cffa-2f82-4a2c-8a0b-86c623f82f43','email','tasteenlinea@tasteboutique.com','sitio_propio','media','raspado-top2'),
('b497cffa-2f82-4a2c-8a0b-86c623f82f43','whatsapp','526622683344','sitio_propio','alta','raspado-top2'),
('8a80c96b-2a41-4cd6-87bf-0087bde98a16','email','info@hotelcasagonzalez.com','sitio_propio','media','raspado-top2'),
('3b432454-fc80-4b5d-9e24-ca5545e1115a','email','tennisexpress@icloud.com','sitio_propio','media','raspado-top2'),
('1e9dc983-caac-4ab5-8604-88659a4cc513','whatsapp','526641993698','sitio_propio','alta','raspado-top2'),
('a5b65ef8-220b-471e-bc82-7d86de89ef35','whatsapp','524773977372','sitio_propio','alta','raspado-top2'),
('3554b6ee-2fc1-4e46-b74d-69edc71cdcf6','email','contacto@elglobo.com.mx','sitio_propio','media','raspado-top2'),
('baabb0c4-7154-481a-89e9-3de73910fbd6','whatsapp','525586596023','sitio_propio','alta','raspado-top2'),
('42aba0d7-2c30-4f7e-8900-73501f971ea7','email','orlando.resendiz@zapateriafratello.com','sitio_propio','media','raspado-top2'),
('42aba0d7-2c30-4f7e-8900-73501f971ea7','whatsapp','524274270336','sitio_propio','alta','raspado-top2'),
('f32c7a6d-e3b7-40d0-941d-92f4be315fd1','email','hola@unser.com.mx','sitio_propio','media','raspado-top2'),
('f32c7a6d-e3b7-40d0-941d-92f4be315fd1','whatsapp','525549656879','sitio_propio','alta','raspado-top2'),
('748a6749-60c5-42e0-a413-b0dbf145f795','whatsapp','527712881783','sitio_propio','alta','raspado-top2'),
('2bac95e1-fcf2-4a46-b9a1-10c9b8dc60e8','email','contacto@binaboutique.com','sitio_propio','media','raspado-top2'),
('2bac95e1-fcf2-4a46-b9a1-10c9b8dc60e8','whatsapp','528118267337','sitio_propio','alta','raspado-top2'),
('3e7de61b-3fb6-405a-939e-1b7bb652a07f','whatsapp','525533407778','sitio_propio','alta','raspado-top2'),
('90171142-a2df-4d26-ac4a-e917d1b4ebae','email','hola@havoc.mx','sitio_propio','media','raspado-top2'),
('90171142-a2df-4d26-ac4a-e917d1b4ebae','whatsapp','525657822989','sitio_propio','alta','raspado-top2'),
('3ea426ee-26c4-4fc5-ba16-24d34285e878','email','ventaenlinea@cletoreyes.com','sitio_propio','media','raspado-top2'),
('5174c604-1ed0-4c92-8ed1-8d19bfeaa628','email','info@abbajoyas.com','sitio_propio','media','raspado-top2'),
('5174c604-1ed0-4c92-8ed1-8d19bfeaa628','whatsapp','523322291899','sitio_propio','alta','raspado-top2'),
('dc4e71dd-81c0-4645-8de8-99b4227edddd','email','contacto@zapatoagil.com','sitio_propio','media','raspado-top2'),
('42708317-5b28-4664-ad9f-4b3ba6f359f7','email','contacto@hhdxt.mx','sitio_propio','media','raspado-top2'),
('1d687be7-98a1-4c9e-b0c4-ecd77abb2f83','whatsapp','525522719809','sitio_propio','alta','raspado-top2'),
('6fcb7904-a90b-49cf-9cf7-08a2eb034efd','email','hola@oggi.mx','sitio_propio','media','raspado-top2'),
('b97da424-d911-46c6-96f0-a53f8af26bd6','whatsapp','528136391003','sitio_propio','alta','raspado-top2'),
('1b02c944-a17d-47b1-b1f1-05dabfcc12ed','email','ventas@bondsboutique.com.mx','sitio_propio','media','raspado-top2'),
('62749c4c-3958-4248-963f-d7dc9a7e1b0b','whatsapp','523311105686','sitio_propio','alta','raspado-top2'),
('fd1aef1c-c768-4288-afcc-4319c370792c','email','info@carlo.mx','sitio_propio','media','raspado-top2'),
('fd1aef1c-c768-4288-afcc-4319c370792c','whatsapp','525567835967','sitio_propio','alta','raspado-top2'),
('5b503b2e-dc2c-4a0d-9869-b6bb93086224','whatsapp','525623871097','sitio_propio','alta','raspado-top2'),
('78638245-e3d3-4519-bfed-a5b2d3d0d15f','whatsapp','525517448241','sitio_propio','alta','raspado-top2'),
('ccf4daf9-7a2e-47ff-90bd-cfb39dfbe2f1','email','pedidos@elfamundi.com.mx','sitio_propio','media','raspado-top2'),
('ccf4daf9-7a2e-47ff-90bd-cfb39dfbe2f1','whatsapp','525615481365','sitio_propio','alta','raspado-top2'),
('76aa55e6-4374-4774-b38f-5cb32fc08b79','email','ecommerce@solatextil.mx','sitio_propio','media','raspado-top2'),
('c93c46ab-e8d6-4438-98c9-612881e9f218','email','ventas@uniformesescolaresalaman.com','sitio_propio','media','raspado-top2'),
('e81eb2d9-296e-4bef-bdb2-b9d7ea81a76c','email','ventas@almadeluna.mx','sitio_propio','media','raspado-top2'),
('fe498d4e-deaf-4985-865a-8fde0c314344','email','ventas@opticagema.com.mx','sitio_propio','media','raspado-top2'),
('fe498d4e-deaf-4985-865a-8fde0c314344','whatsapp','525627418583','sitio_propio','alta','raspado-top2'),
('02ab88a5-f5fb-42aa-a610-4aceb85494ff','email','ventas@uniformeslaamistad.com','sitio_propio','media','raspado-top2'),
('bd0da07a-4ef0-4f48-835a-145c0340b096','email','multilinea@karati.com','sitio_propio','media','raspado-top2'),
('3069d25c-5e20-4ea0-930a-5c9623813791','email','atencionaclientestijuana@jarmar.com','sitio_propio','media','raspado-top2'),
('3069d25c-5e20-4ea0-930a-5c9623813791','whatsapp','529611855475','sitio_propio','alta','raspado-top2'),
('78c581cf-eceb-4066-9774-8e2e127e6081','whatsapp','525571136661','sitio_propio','alta','raspado-top2'),
('bf28a55b-6d8f-49d1-8d48-9c463c9463cd','email','valma.mx@gmail.com','sitio_propio','media','raspado-top2'),
('6c470b25-9163-48b3-aeba-46f995b9d8a8','email','ulamm@ulammjoyas.com','sitio_propio','media','raspado-top2'),
('6c470b25-9163-48b3-aeba-46f995b9d8a8','whatsapp','525559930600','sitio_propio','alta','raspado-top2'),
('a9ee1f64-615a-4169-ac1c-e7dafb49ff07','whatsapp','527225560013','sitio_propio','alta','raspado-top2'),
('bc9af7ef-e7f8-4ab7-8a50-31abb8c5ebf2','email','merceriadelrefugiomx@gmail.com','sitio_propio','media','raspado-top2'),
('5881b9a5-7719-49d3-a359-11089aac14b7','email','contacto@boutiquemonet.com','sitio_propio','media','raspado-top2'),
('5881b9a5-7719-49d3-a359-11089aac14b7','whatsapp','528117595771','sitio_propio','alta','raspado-top2'),
('0c53cf71-ece4-4c36-83d1-8eff977b294d','email','moises@goodbyefolk.com','sitio_propio','media','raspado-top2'),
('00dc2a01-ab64-4f79-962a-821abdca6983','email','contacto@opticasblink.com','sitio_propio','media','raspado-top2'),
('00dc2a01-ab64-4f79-962a-821abdca6983','whatsapp','526182821983','sitio_propio','alta','raspado-top2'),
('74863e07-6d1a-44d7-a503-33fc377a4b16','email','tuzomaniaoficial@gmail.com','sitio_propio','media','raspado-top2'),
('a4cb8a05-f96a-4295-b469-4ea82dd7b5d4','email','info@zittro.com','sitio_propio','media','raspado-top2'),
('a4cb8a05-f96a-4295-b469-4ea82dd7b5d4','whatsapp','524433249220','sitio_propio','alta','raspado-top2'),
('ec9bd95f-3b9c-4a40-a1a7-4dd0836c09f0','email','ayuda@petngo.com.mx','sitio_propio','media','raspado-top2'),
('ec9bd95f-3b9c-4a40-a1a7-4dd0836c09f0','whatsapp','528129309809','sitio_propio','alta','raspado-top2'),
('82795919-bfbd-4ce8-8c9c-f8c1892589ad','email','servicioalcliente@majasportswear.com','sitio_propio','media','raspado-top2'),
('309b0946-763d-4434-bd08-5253d37fd7b6','whatsapp','526692657854','sitio_propio','alta','raspado-top2'),
('8694876d-63ee-4d67-a5fe-800156deafed','email','dianasoy58@gmail.com','sitio_propio','media','raspado-top2'),
('8694876d-63ee-4d67-a5fe-800156deafed','whatsapp','525566005500','sitio_propio','alta','raspado-top2'),
('94690d47-7c4a-4d9f-8193-a040f65167a1','email','info@soybissu.com','sitio_propio','media','raspado-top2'),
('1c2c27bd-582b-490f-8d74-75ce72cf8d5a','email','chuz77z@gmail.com','sitio_propio','media','raspado-top2'),
('454f66c6-9eee-44b1-8534-cec97dd20e4f','email','contacto@sivuple.mx','sitio_propio','media','raspado-top2'),
('8c736ae3-046c-4237-8f01-30c428d4046c','email','bellenoviah@gmail.com','sitio_propio','media','raspado-top2'),
('c4e824e1-f9b0-42e5-980c-6dbec6a316b8','email','lety@cimarron.com.mx','sitio_propio','media','raspado-top2'),
('8ecd3e9b-b2b5-445c-9731-ffa57404014e','email','ecommerce@aldoconti.com','sitio_propio','media','raspado-top2'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','email','info@opticalorentzdejuarez.com.mx','sitio_propio','media','raspado-top2'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','whatsapp','526563604060','sitio_propio','alta','raspado-top2'),
('d844243b-66b2-4d64-849c-4080dafe9a18','whatsapp','526623002087','sitio_propio','alta','raspado-top2'),
('71a8858e-529a-42a8-aece-c15d7bece80b','whatsapp','524773833912','sitio_propio','alta','raspado-top2'),
('1ffe1fbc-f3d5-4e5d-8af5-1360c04454db','whatsapp','526141704195','sitio_propio','alta','raspado-top2'),
('2f6d779e-418b-4144-9bbe-c2bafdc5bdae','email','hola@ranchdepot.com','sitio_propio','media','raspado-top2'),
('d29c7b0e-824c-407f-bee0-4e82fc160147','email','mkt@analorena.com','sitio_propio','media','raspado-top2'),
('d29c7b0e-824c-407f-bee0-4e82fc160147','whatsapp','525574959937','sitio_propio','alta','raspado-top2'),
('a92c3f0c-0259-4af4-905d-11a0cdeb2e18','email','multilinea@karati.com','sitio_propio','media','raspado-top2'),
('ad0c66f7-09b7-4cd2-b337-1bd344b9d4d3','whatsapp','524611735444','sitio_propio','alta','raspado-top2'),
('e972edd5-0423-4ff9-bb9c-17bb2fce252b','whatsapp','525535772793','sitio_propio','alta','raspado-top2'),
('56fffa44-b5ea-447c-bfd7-c1f49b2579ce','email','contacto@elglobo.com.mx','sitio_propio','media','raspado-top2'),
('c48f7d65-3f94-4efd-8e51-952cfd4d1e1a','email','igor.cohen@gmail.com','sitio_propio','media','raspado-top2'),
('2c0ce3cd-5671-4c18-a389-7f7ee6b04d2a','whatsapp','526673920720','sitio_propio','alta','raspado-top2'),
('dc65e85f-224b-4568-a137-a2741f88eb29','whatsapp','522461549385','sitio_propio','alta','raspado-top2'),
('21dcbf70-e099-48a8-8fdd-ebd5676bcdf6','email','lobstore@lob.com.mx','sitio_propio','media','raspado-top2'),
('af41754d-27bf-4331-ba58-64cb45ba2d64','email','motooutlettoluca@hotmail.com','sitio_propio','media','raspado-top2'),
('af41754d-27bf-4331-ba58-64cb45ba2d64','whatsapp','527208639740','sitio_propio','alta','raspado-top2'),
('bd5d4bbf-86ff-4e3e-a6f2-30dc100562d0','whatsapp','526691101322','sitio_propio','alta','raspado-top2'),
('fd445e1b-f887-4311-9ff4-bc37405504a3','email','atencionaclientes@veana.com','sitio_propio','media','raspado-top2'),
('166f34aa-c005-4cfc-ad84-ebf6f02a0994','email','ventas@uniformesescolaresalaman.com','sitio_propio','media','raspado-top2'),
('05fa5246-0ecf-46a3-a899-ae06e2606169','email','karlyta.galindo.bd@gmail.com','sitio_propio','media','raspado-top2'),
('05fa5246-0ecf-46a3-a899-ae06e2606169','whatsapp','524421143052','sitio_propio','alta','raspado-top2'),
('6b0c72fe-bcf0-4a15-a7d9-99c512574685','email','direccion@dimeo.mx','sitio_propio','media','raspado-top2'),
('4b0aaba5-408a-4486-a101-fe6db52f6a5e','whatsapp','526621396339','sitio_propio','alta','raspado-top2'),
('871dfaef-06e8-46e8-a9b0-cda6db4c394c','email','hellomom.mexico@gmail.com','sitio_propio','media','raspado-top2'),
('871dfaef-06e8-46e8-a9b0-cda6db4c394c','whatsapp','524777252191','sitio_propio','alta','raspado-top2'),
('f24a518a-deba-4287-9dc6-8755f0c5c616','email','sergio.soberanis@novedadestony.com','sitio_propio','media','raspado-top2'),
('f24a518a-deba-4287-9dc6-8755f0c5c616','whatsapp','529995720142','sitio_propio','alta','raspado-top2'),
('1ae3f863-3416-4bf0-b37a-a2c13d89d468','email','contacto@misvestidosgdl.com','sitio_propio','media','raspado-top2'),
('1ae3f863-3416-4bf0-b37a-a2c13d89d468','whatsapp','523321567135','sitio_propio','alta','raspado-top2'),
('a80005a7-67ad-4005-9abe-180c54d7f625','email','info@sposabridal.mx','sitio_propio','media','raspado-top2'),
('0ad84f47-b3e5-4084-a0b9-312da23fe7fd','email','contacto@urbanutility.mx','sitio_propio','media','raspado-top2'),
('509b64b6-f33c-41c4-9d38-e1691d214a8f','email','citybride.info@gmail.com','sitio_propio','media','raspado-top2'),
('509b64b6-f33c-41c4-9d38-e1691d214a8f','whatsapp','523310310941','sitio_propio','alta','raspado-top2'),
('27552c30-0b3b-4e31-9301-400ae8ac33f0','whatsapp','523314212717','sitio_propio','alta','raspado-top2'),
('64a7dd85-5357-4bd0-b7e8-79b5122bca6d','email','hola@aguiar.mx','sitio_propio','media','raspado-top2'),
('baca993c-033d-4bd3-b96f-d6794efa4e23','email','questions@online.danielsjewelers.com','sitio_propio','media','raspado-top2'),
('335f93d4-81d2-4c3b-8ac6-80c25327caa4','email','devoluciones@converse.com.mx','sitio_propio','media','raspado-top2'),
('7392dfa8-50a9-4d1b-8e67-f9982e0c7343','email','info@sposabella.mx','sitio_propio','media','raspado-top2'),
('7392dfa8-50a9-4d1b-8e67-f9982e0c7343','whatsapp','525555021116','sitio_propio','alta','raspado-top2'),
('812b651b-7b31-4599-8284-9a0b9ec48064','whatsapp','525571938391','sitio_propio','alta','raspado-top2'),
('8063f4fc-7b11-451a-a7c7-ef20c9014e16','email','admin@carmenc.com','sitio_propio','media','raspado-top2'),
('8063f4fc-7b11-451a-a7c7-ef20c9014e16','whatsapp','524611859029','sitio_propio','alta','raspado-top2'),
('b59c604a-0a3e-4cb6-b43a-f3776e9f69b1','whatsapp','525612622146','sitio_propio','alta','raspado-top2'),
('840d85ad-112d-44fe-9aca-9d354a0fd9a1','email','atencionclientes@yale.com.mx','sitio_propio','media','raspado-top2'),
('e5d5d4dc-8cea-4fae-98de-a8755c6ef819','email','contacto@ruvalcabafantasias.com','sitio_propio','media','raspado-top2'),
('0366747a-4ca2-4a49-9928-b4e1cfcc645e','email','info@libreriaacuario.com.mx','sitio_propio','media','raspado-top2'),
('0366747a-4ca2-4a49-9928-b4e1cfcc645e','whatsapp','522299510561','sitio_propio','alta','raspado-top2'),
('c6d17540-d5b9-4f35-a029-45ddb8f34c1c','email','online@pirma.com.mx','sitio_propio','media','raspado-top2'),
('133558cd-6212-4893-b016-e57536f406f1','email','servicioaclientes@discalse.com','sitio_propio','media','raspado-top2'),
('ca8da1c2-861c-40b0-bf20-d895804967d3','email','centrodegraduaciones@gmail.com','sitio_propio','media','raspado-top2'),
('bea3c06c-2d31-471b-ae4b-5291ed87da8e','email','l.luna@tejidosgaytan.com.mx','sitio_propio','media','raspado-top2'),
('076be8c4-b09b-4f2e-b6ce-253377787f70','email','capitaltextilmx@gmail.com','sitio_propio','media','raspado-top2'),
('076be8c4-b09b-4f2e-b6ce-253377787f70','whatsapp','525647680027','sitio_propio','alta','raspado-top2'),
('77af4b9a-c838-40a3-ba45-e1b2d56e3397','email','hola@lineas.com.mx','sitio_propio','media','raspado-top2'),
('4c48b3e6-28e7-4841-9cea-b90e11183a27','email','ventas@clinik.com','sitio_propio','media','raspado-top2'),
('58e1f0cf-078b-4440-b4fd-9bef258d931c','whatsapp','522227095349','sitio_propio','alta','raspado-top2'),
('09d49604-ecd0-45d3-a242-e342446c1c21','email','admin@yotebordo.com','sitio_propio','media','raspado-top2'),
('3d1c7560-5bd0-4e4a-b303-06b4271faaab','whatsapp','525561894779','sitio_propio','alta','raspado-top2'),
('dfddf52c-6ac3-4b9e-977d-6eaf252edd41','email','disfracesmexico@hotmail.com','sitio_propio','media','raspado-top2'),
('54271c2a-cd20-4c81-893a-192d9414207e','whatsapp','525579135973','sitio_propio','alta','raspado-top2'),
('40676076-064e-43e0-ad19-857ba0ea6fce','whatsapp','529991262332','sitio_propio','alta','raspado-top2'),
('6998f232-2cbb-48d8-b822-255a3d93ee60','whatsapp','525531658139','sitio_propio','alta','raspado-top2'),
('d1319988-d02a-43de-9eb5-1863673f2bd6','whatsapp','528122150093','sitio_propio','alta','raspado-top2'),
('58b048e5-cbe4-435e-b897-a2faf0e18a1d','email','elnopaltiendas@gmail.com','sitio_propio','media','raspado-top2'),
('58b048e5-cbe4-435e-b897-a2faf0e18a1d','whatsapp','526681934635','sitio_propio','alta','raspado-top2'),
('d4206644-a42f-4f0d-9a4c-c8a60df0700a','email','ventas@uniformesprovidencia.com.mx','sitio_propio','media','raspado-top2'),
('d4206644-a42f-4f0d-9a4c-c8a60df0700a','whatsapp','525564532052','sitio_propio','alta','raspado-top2'),
('d406aabc-030a-4ec0-ab51-9ab2b928737e','email','recepcion@unicofam.com','sitio_propio','media','raspado-top2'),
('4d0813c8-d264-4e9e-a18d-122272ecb2a6','email','cponce@lazzarmexico.com','sitio_propio','media','raspado-top2'),
('d3522da1-28b4-47d9-af52-46e4feed1ebc','email','ventaenlinea@zapateriasrodriguez.com.mx','sitio_propio','media','raspado-top2'),
('b74b290e-cd9d-45a9-b661-3a7336d917cd','email','admin@ratte.com.mx','sitio_propio','media','raspado-top2'),
('b74b290e-cd9d-45a9-b661-3a7336d917cd','whatsapp','528124140221','sitio_propio','alta','raspado-top2'),
('8cbd2cf4-b15f-4093-8254-999ee5c245d5','email','pagos@sombrereriaregia.com.mx','sitio_propio','media','raspado-top2'),
('c82fa109-a067-4c78-9140-dc9ec0f6288b','whatsapp','523320808180','sitio_propio','alta','raspado-top2'),
('2672fe3a-df6e-46e5-b9f2-518bd594a184','email','asesorenlinea@cuadra.com.mx','sitio_propio','media','raspado-top2'),
('6b9c1c6b-5c5b-46fd-9807-10629680f0ab','email','example@gmail.com','sitio_propio','media','raspado-top2'),
('381f65ba-6c25-4f6d-bd9d-75312e770792','whatsapp','525634028624','sitio_propio','alta','raspado-top2'),
('705a7235-ee7e-4a16-9864-dfdc19f160e8','email','ventas@juguel.com','sitio_propio','media','raspado-top2'),
('705a7235-ee7e-4a16-9864-dfdc19f160e8','whatsapp','528182749004','sitio_propio','alta','raspado-top2'),
('e2ab0ea5-c148-488c-8ce7-95babbf8b9f1','email','info@tumbiko.mx','sitio_propio','media','raspado-top2'),
('e2ab0ea5-c148-488c-8ce7-95babbf8b9f1','whatsapp','525579229571','sitio_propio','alta','raspado-top2'),
('a1e3f191-361a-4a51-a6b4-dbd19dd8f2f0','email','atencionyservicio@verdeverdad.com','sitio_propio','media','raspado-top2'),
('a1e3f191-361a-4a51-a6b4-dbd19dd8f2f0','whatsapp','525570055212','sitio_propio','alta','raspado-top2'),
('995e2903-23d6-4264-81ef-529c2676b90b','whatsapp','529999260054','sitio_propio','alta','raspado-top2'),
('8ce0b732-6bcc-4f46-86b6-085c3edec111','email','jodie@silverexposure.com','sitio_propio','media','raspado-top2'),
('307a5c7d-b1dd-4a19-b523-3b7efd0088f0','email','pedidos@lanuevaespana.com.mx','sitio_propio','media','raspado-top2'),
('51ec71e4-64df-45cb-b114-09f19087eeca','email','ecommerce@rodaccesorios.com','sitio_propio','media','raspado-top2'),
('70720b30-055f-41f1-8424-f568053051ce','email','contacto@luzo.info','sitio_propio','media','raspado-top2'),
('4b76ee5a-f684-4981-9270-ca7d8985fd31','whatsapp','526643108398','sitio_propio','alta','raspado-top2'),
('04f28815-81fa-4fdf-ba53-86e243bb6483','email','ecommerceoficial@berlei.com.mx','sitio_propio','media','raspado-top2'),
('dc65abc2-6d1e-4116-a4b2-d274cdb9ed4b','email','deportesjoyce@gmail.com','sitio_propio','media','raspado-top2'),
('dc65abc2-6d1e-4116-a4b2-d274cdb9ed4b','whatsapp','526671310033','sitio_propio','alta','raspado-top2'),
('e6fddaf6-829c-4a19-b40b-a4718057d309','email','soluciones@guayaberasycamisas.com','sitio_propio','media','raspado-top2'),
('82430ccb-3620-48c4-8f96-183603db319a','email','info@ag925.mx','sitio_propio','media','raspado-top2'),
('337de5fd-27fb-49dc-9192-cb8dcb5053d1','email','help@help.desigual.com','sitio_propio','media','raspado-top2'),
('7408d4f6-9379-41eb-a502-3d68158e636b','email','marketing@formatex.com.mx','sitio_propio','media','raspado-top2'),
('f13bb6e2-c656-43bb-bdba-b399371bbf68','email','contacto@leonuniformes.com','sitio_propio','media','raspado-top2'),
('f13bb6e2-c656-43bb-bdba-b399371bbf68','whatsapp','525614930126','sitio_propio','alta','raspado-top2'),
('082144e9-40f2-4a1b-9f13-75a08fe6569d','whatsapp','528129090612','sitio_propio','alta','raspado-top2'),
('d7a8e361-8b1f-41f5-a46f-e9fc2d76e277','email','info@ciceg.org','sitio_propio','media','raspado-top2'),
('88bf50b1-5a30-4a37-bf9f-3068e6f5a273','whatsapp','525578876551','sitio_propio','alta','raspado-top2'),
('11b16e9a-c28f-48bb-94ba-fab2dd6721f4','email','email.establo@gmail.com','sitio_propio','media','raspado-top2'),
('c03c432c-626a-4d7c-b968-1db28a7bdc96','whatsapp','522214144509','sitio_propio','alta','raspado-top2'),
('add0e133-ece7-492b-8970-3db41083f58a','email','boss_mazaryk@hugoboss.com','sitio_propio','media','raspado-top2'),
('58583d1b-6d3d-4d58-9601-52fe0270764a','email','silvon@gruposilvon.com','sitio_propio','media','raspado-top2'),
('57909852-9593-41d5-ac54-527aa7c54123','whatsapp','526633182048','sitio_propio','alta','raspado-top2'),
('1b08c9fe-7941-4899-83c7-43cc7acc128b','email','ventas@textilesdelfuturo.com.mx','sitio_propio','media','raspado-top2'),
('b1817940-06cb-4fa2-bb57-38ae49a51942','email','info@bwigroup.com','sitio_propio','media','raspado-top2'),
('b0ae85ab-7bfc-4250-afa8-f97f398a4844','email','web@uaem.mx','sitio_propio','media','raspado-top2'),
('01f77c82-7349-488b-a69a-2a2e2dedc90a','email','ventas@joyasrobles.com','sitio_propio','media','raspado-top2'),
('2e082dd1-9aa6-41d0-81c6-b5744c2894ad','email','clientes@malandra.mx','sitio_propio','media','raspado-top2'),
('2e082dd1-9aa6-41d0-81c6-b5744c2894ad','whatsapp','528114886601','sitio_propio','alta','raspado-top2'),
('401d3296-2eb9-4171-9624-9463158e063e','email','ucmolegario@yahoo.com.mx','sitio_propio','media','raspado-top2'),
('c11562ee-7c09-49d7-a2d4-cfb672745da1','email','atencionaclientes@highstreet.com.mx','sitio_propio','media','raspado-top2'),
('c11562ee-7c09-49d7-a2d4-cfb672745da1','whatsapp','523331917648','sitio_propio','alta','raspado-top2'),
('c3384fc2-41f5-4935-91dd-8181de43ddb2','whatsapp','523319088880','sitio_propio','alta','raspado-top2'),
('210c6cac-927e-4f80-9958-3a62519380f8','email','garriaga@atleticos.com.mx','sitio_propio','media','raspado-top2'),
('79a25b7c-abbb-404d-a484-19892e5369a5','email','ventas@clinik.com','sitio_propio','media','raspado-top2'),
('91e26e76-b5a4-4eee-ba8c-286084bd2e71','email','social@paruno.com','sitio_propio','media','raspado-top2'),
('8998cb3c-f3f6-4758-8747-86554b416cee','email','customerservice@quiksilver.com','sitio_propio','media','raspado-top2'),
('b437279c-5266-43e4-bf21-edee9ebcdb66','email','lizzethmartinezbridal@gmail.com','sitio_propio','media','raspado-top2'),
('2ef21276-9900-4cf6-a45c-7648a3d01755','email','ventas@botaschicho.com','sitio_propio','media','raspado-top2'),
('0160dc85-d766-43b8-ad9e-201b1e1878d7','email','dormirreal@dormireal.com','sitio_propio','media','raspado-top2'),
('f6b34fb9-4c21-426a-adf2-1925c25168fc','email','lobstore@lob.com.mx','sitio_propio','media','raspado-top2'),
('1471b25e-5cea-4446-be1e-716789d6680b','email','info@origenespuebla.com','sitio_propio','media','raspado-top2'),
('1471b25e-5cea-4446-be1e-716789d6680b','whatsapp','522227649593','sitio_propio','alta','raspado-top2'),
('40a001ee-e4af-4d10-9388-093f74cb6519','email','ventas@plarte.com.mx','sitio_propio','media','raspado-top2'),
('2776480b-d83b-4032-bd30-80fe57ae0028','email','nallely@corptextiljt.com.mx','sitio_propio','media','raspado-top2'),
('fdcc1205-5fb8-42f3-bf2a-d9e50bd0f790','whatsapp','525534550106','sitio_propio','alta','raspado-top2'),
('2fa4585b-37bb-4833-85e0-c3e6aef7c545','email','ventas@uniformesunico.com','sitio_propio','media','raspado-top2'),
('e5abe833-595c-43cb-b851-838403715268','whatsapp','522216622781','sitio_propio','alta','raspado-top2'),
('d7f0384c-86c3-4146-8df0-4f45b1ec345a','email','info@vigilante.com.mx','sitio_propio','media','raspado-top2'),
('14de0dac-640a-4be7-9d96-9e0bef574901','email','contacto@okulux.mx','sitio_propio','media','raspado-top2'),
('14de0dac-640a-4be7-9d96-9e0bef574901','whatsapp','524421255097','sitio_propio','alta','raspado-top2'),
('b28e54ad-28ef-4b9e-99ba-230594d63612','email','ventas@clinik.com','sitio_propio','media','raspado-top2'),
('a187cc47-976c-4361-8b90-cd7f410b90aa','whatsapp','526677770660','sitio_propio','alta','raspado-top2'),
('ec213370-85ca-4f12-8f53-80316682c759','email','uniformes.danmar@gmail.com','sitio_propio','media','raspado-top2'),
('5f231744-ec70-47d2-9fe7-85b3b7d05c43','email','admin@centrojoyerozocalo.com','sitio_propio','media','raspado-top2'),
('83a26ef9-1c50-497b-a0eb-07c0df70b3f0','email','pagospesadilla@gmail.com','sitio_propio','media','raspado-top2'),
('0b88264f-38db-4be3-939f-efff7c3480f3','email','info@lizakoekkoek.com','sitio_propio','media','raspado-top2'),
('0b88264f-38db-4be3-939f-efff7c3480f3','whatsapp','523322574268','sitio_propio','alta','raspado-top2'),
('01f4b2be-cfaf-49e5-814f-50e0b6ba7122','email','uniformes.donza@outlook.com','sitio_propio','media','raspado-top2'),
('277e0190-bdca-4794-843f-3233861d3c61','email','mllegeorgesand@gmail.com','sitio_propio','media','raspado-top2'),
('fcf9d4e7-5c59-4eed-a283-77ed73925da7','whatsapp','528135578160','sitio_propio','alta','raspado-top2'),
('360941f8-7b03-4630-bf8b-e94256578277','email','info@gastrotourchef.com.mx','sitio_propio','media','raspado-top2'),
('360941f8-7b03-4630-bf8b-e94256578277','whatsapp','529842148080','sitio_propio','alta','raspado-top2'),
('26d3afbc-438f-4ef3-ac7a-8de73973fdcb','whatsapp','525536726098','sitio_propio','alta','raspado-top2'),
('a30eb6aa-7d90-4e15-8621-5cef9772244f','email','ventas@maxicaps.com.mx','sitio_propio','media','raspado-top2'),
('021bc0ee-3ace-4bda-bee7-d91e6c37843c','email','ventas@tiendacharra.com','sitio_propio','media','raspado-top2'),
('60b514ad-01f0-4b5e-985c-80cecc568df0','email','alaherradura1991@gmail.com','sitio_propio','media','raspado-top2'),
('053a5d84-8cf5-45ba-82ee-d369e457a0ae','email','joyeriayhechurasrivera@gmail.com','sitio_propio','media','raspado-top2'),
('6a8becac-b478-40b8-bb52-ccbc195ed381','email','info@cwesternwear.com','sitio_propio','media','raspado-top2'),
('7ac6dfd1-73ec-4d7c-94ae-08b8fc5d152d','email','info@oldwest.mx','sitio_propio','media','raspado-top2'),
('b90c1134-fd3e-4cc7-a5d1-b6859b554ac8','email','silvon@gruposilvon.com','sitio_propio','media','raspado-top2'),
('65735319-2886-469e-aa15-8b3bcc3bf323','email','contacto@duque.mx','sitio_propio','media','raspado-top2'),
('65735319-2886-469e-aa15-8b3bcc3bf323','whatsapp','524791377204','sitio_propio','alta','raspado-top2'),
('7a917b87-2076-44f8-bc4c-65ae36cb1ce3','email','ventas@gutsmx.com','sitio_propio','media','raspado-top2'),
('6828bf67-fb34-437e-b313-0f4b2e84d523','email','zapatodiabetico@hotmail.com','sitio_propio','media','raspado-top2'),
('414e188f-cfe0-44db-a7e9-c8f0b27177e7','email','ventas@clinik.com','sitio_propio','media','raspado-top2'),
('36af4033-16fb-4fee-b24d-e78e0204159b','whatsapp','525585799484','sitio_propio','alta','raspado-top2'),
('a3e9f1e0-9cad-42bf-81e6-014e6b574dd6','email','contacto@befashionstore.mx','sitio_propio','media','raspado-top2'),
('a3e9f1e0-9cad-42bf-81e6-014e6b574dd6','whatsapp','528128990755','sitio_propio','alta','raspado-top2'),
('682ec899-95c2-499f-bf79-8f43eba6c3bf','email','informes@sombreroscuauhtemoc.mx','sitio_propio','media','raspado-top2'),
('682ec899-95c2-499f-bf79-8f43eba6c3bf','whatsapp','522224645368','sitio_propio','alta','raspado-top2'),
('8da1439d-0a89-48cd-bb90-8d04e3a15e2a','email','customerservice@quiksilver.com','sitio_propio','media','raspado-top2'),
('528ea393-8fe0-4c89-84c3-54d2f4acd73e','email','ventas1@playerasmark.com','sitio_propio','media','raspado-top2'),
('17da89ff-b679-44b2-811a-81160e917c19','whatsapp','528110358941','sitio_propio','alta','raspado-top2'),
('0b8809b6-c63b-430f-9972-e87d8d741de7','email','ventas@t-lobordo.com','sitio_propio','media','raspado-top2'),
('b1be4165-ee7c-4ba9-9ba4-7827f7e909b1','email','adabellanoviasyprincesas@gmail.com','sitio_propio','media','raspado-top2'),
('1d94e3bf-684e-4a6f-8f73-14829935b0e3','email','contacto.llopticas@gmail.com','sitio_propio','media','raspado-top2'),
('2dec9dfe-4215-4970-a6d6-09487cb68141','email','mexico@lazzarmexico.com','sitio_propio','media','raspado-top2'),
('7e8e1136-5766-4dfb-9118-99ef44e1c33a','whatsapp','529993155009','sitio_propio','alta','raspado-top2'),
('00e7f440-0271-44ca-8225-39491feed712','email','tanyre71@gmail.com','sitio_propio','media','raspado-top2'),
('6558e2fb-2e22-432f-8b2c-aaf293c39cbc','email','contacto@chicaschein.com','sitio_propio','media','raspado-top2'),
('65d28f13-2b7f-4e6b-9391-f83bd26b627e','email','pedidosundoskin@hotmail.com','sitio_propio','media','raspado-top2'),
('65d28f13-2b7f-4e6b-9391-f83bd26b627e','whatsapp','523471041887','sitio_propio','alta','raspado-top2'),
('6163498b-dd73-40eb-9c91-ed7affe45f91','email','ventas@laperlajoyerias.com','sitio_propio','media','raspado-top2'),
('d0ac5186-324d-40f9-8dc5-eff4493e5009','email','ventas@marittijoyas.com','sitio_propio','media','raspado-top2'),
('d0ac5186-324d-40f9-8dc5-eff4493e5009','whatsapp','523329489466','sitio_propio','alta','raspado-top2'),
('14446fe4-fff0-472c-8c60-531f4ba39ed2','whatsapp','525515132253','sitio_propio','alta','raspado-top2'),
('e4e343d4-9312-482a-8c23-b8f347d9b2ce','whatsapp','523315573151','sitio_propio','alta','raspado-top2'),
('d2e8eb4e-b1c8-4db5-be99-28136977afe4','email','contacto@tecnosocks.com','sitio_propio','media','raspado-top2'),
('ddd8dee5-80a8-4882-b7f5-a7f032f9e42e','email','monterreystore@ferragamo.com','sitio_propio','media','raspado-top2'),
('8fcb5127-b9ec-4d82-a486-0d6331f87a5b','email','contacto@montblan.mx','sitio_propio','media','raspado-top2'),
('8fcb5127-b9ec-4d82-a486-0d6331f87a5b','whatsapp','522229003070','sitio_propio','alta','raspado-top2'),
('74bce925-ec2d-415b-932c-e91c8c09dafd','email','ventas@hefestosmoda.com','sitio_propio','media','raspado-top2'),
('74bce925-ec2d-415b-932c-e91c8c09dafd','whatsapp','529513328160','sitio_propio','alta','raspado-top2'),
('870fe4ef-10e8-491e-8219-68de23f676d7','whatsapp','525611720577','sitio_propio','alta','raspado-top2'),
('6c161422-92e1-4415-b82e-0c5e8d000019','whatsapp','524425761518','sitio_propio','alta','raspado-top2'),
('11219b5e-fad7-4616-aec7-5409669632ad','whatsapp','524439345516','sitio_propio','alta','raspado-top2'),
('35784eb2-1838-476f-ab89-1ea4a3f6029c','whatsapp','528186828115','sitio_propio','alta','raspado-top2'),
('3d026714-ebe2-4b8e-82af-34c7a5a2ae63','email','tienda@pirouette.mx','sitio_propio','media','raspado-top2'),
('a503573c-b7bc-4ce6-94b0-b6d5addc82b0','email','hola@lineas.com.mx','sitio_propio','media','raspado-top2'),
('934bd69d-612b-41a1-aab4-2d728daf6aae','email','proviamiga@mundoprovidencia.com','sitio_propio','media','raspado-top2'),
('19578094-bd3d-46d1-b51b-8aa6b152816d','email','info@jdk.mx','sitio_propio','media','raspado-top2'),
('499ab6fa-7451-4ec4-b499-7852934f53a8','email','ventas@deportescancun.mx','sitio_propio','media','raspado-top2'),
('499ab6fa-7451-4ec4-b499-7852934f53a8','whatsapp','529984199828','sitio_propio','alta','raspado-top2'),
('1773fb70-d81e-4ee0-af76-ae6aa60fcbd0','email','recepcion@lozmerjoyeros.com','sitio_propio','media','raspado-top2'),
('8c2b4f19-2ff0-49b2-9075-6cc8ed3685d8','email','miradisfraces@gmail.com','sitio_propio','media','raspado-top2'),
('8c2b4f19-2ff0-49b2-9075-6cc8ed3685d8','whatsapp','529612264911','sitio_propio','alta','raspado-top2'),
('d93a629c-6b6d-407c-b2c8-22a5de084cf1','email','contacto@tiendasmaxima.com.mx','sitio_propio','media','raspado-top2'),
('e17a1506-35a2-4561-b1f1-955138d9a6b5','email','ventas@depielyalgomas.com','sitio_propio','media','raspado-top2'),
('e80b0246-d184-413e-94cd-37d6221f9347','email','ventas@emporiosport.com.mx','sitio_propio','media','raspado-top2'),
('e80b0246-d184-413e-94cd-37d6221f9347','whatsapp','525611073916','sitio_propio','alta','raspado-top2'),
('a3d7e60c-3383-490a-950a-b44d8eb08843','email','siniestrarockstore@gmail.com','sitio_propio','media','raspado-top2'),
('f9c6a3fc-04e5-40aa-83fa-da39d8e83c05','email','cponce@lazzarmexico.com','sitio_propio','media','raspado-top2'),
('0fa91fdb-a089-4bb2-b958-1f6f9dfbc28d','whatsapp','525530580569','sitio_propio','alta','raspado-top2'),
('f3686905-1e68-45f4-a60a-74e42447cfd7','email','tintaseinsumos@hotmail.com','sitio_propio','media','raspado-top2'),
('f3686905-1e68-45f4-a60a-74e42447cfd7','whatsapp','529612140876','sitio_propio','alta','raspado-top2'),
('2690efaa-df63-4fd4-99d8-b58452806799','email','ventas@uniformeslaabejita.com','sitio_propio','media','raspado-top2'),
('2690efaa-df63-4fd4-99d8-b58452806799','whatsapp','523324968556','sitio_propio','alta','raspado-top2'),
('3339ae65-a4b2-4a48-b7a8-0ec608d47148','email','casa.tovar@hotmail.com','sitio_propio','media','raspado-top2'),
('3339ae65-a4b2-4a48-b7a8-0ec608d47148','whatsapp','524811232981','sitio_propio','alta','raspado-top2'),
('f7600e1d-6ab3-404e-a103-c68d41577d61','email','ventas1@codigouniformes.com.mx','sitio_propio','media','raspado-top2'),
('b617cf7e-70ed-44f3-8755-2e4b76b895aa','whatsapp','523221356302','sitio_propio','alta','raspado-top2'),
('088dd8e8-7a4d-4665-bd59-b3f771f595f1','email','mondepell@gmail.com','sitio_propio','media','raspado-top2'),
('6133b453-9a37-4aba-8af0-8da2c99631b2','email','andres.valens@uniformesfinoshidalgo.com','sitio_propio','media','raspado-top2'),
('6133b453-9a37-4aba-8af0-8da2c99631b2','whatsapp','528184598077','sitio_propio','alta','raspado-top2'),
('04ee700c-fdd7-4635-8df9-c79d0f905a18','whatsapp','528113807142','sitio_propio','alta','raspado-top2'),
('3e62a6a1-7fd1-4909-abf7-179b5d4c33ef','whatsapp','528120065308','sitio_propio','alta','raspado-top2'),
('d77932de-6c69-4230-8ced-1b1bfa148400','email','mercerias.net@gmail.com','sitio_propio','media','raspado-top2'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','email','info@elybride.com','sitio_propio','media','raspado-top2'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','whatsapp','529988977717','sitio_propio','alta','raspado-top2'),
('6d2d3379-4fe2-40f9-bec2-533cae23fdf8','email','online@fiftyoutlet.com','sitio_propio','media','raspado-top2'),
('3f003ad8-8043-4d2a-bb06-428dd1ad090d','email','contacto@trajesdecharrogarcia.com.mx','sitio_propio','media','raspado-top2'),
('3f003ad8-8043-4d2a-bb06-428dd1ad090d','whatsapp','525515269182','sitio_propio','alta','raspado-top2'),
('0ed6dadf-0d06-4f57-9d11-9b1368280431','email','contacto@latallaperfecta.com.mx','sitio_propio','media','raspado-top2'),
('3510f556-5a32-42e4-aaf6-54dea4cda932','email','contacto@playerasvallarta.com','sitio_propio','media','raspado-top2'),
('3510f556-5a32-42e4-aaf6-54dea4cda932','whatsapp','523221505264','sitio_propio','alta','raspado-top2'),
('8dcd8b2a-2492-4362-95a1-e167c0ca0532','email','vinitex2@hotmail.com','sitio_propio','media','raspado-top2'),
('8dcd8b2a-2492-4362-95a1-e167c0ca0532','whatsapp','523329189920','sitio_propio','alta','raspado-top2'),
('c386b80c-f5cf-468e-a9a5-bf43b018bcb1','email','cayala@uniformeskared.com','sitio_propio','media','raspado-top2'),
('c386b80c-f5cf-468e-a9a5-bf43b018bcb1','whatsapp','526188393020','sitio_propio','alta','raspado-top2'),
('8645c2a5-8e53-4279-a56d-be67490089ea','email','infokokodogz@gmail.com','sitio_propio','media','raspado-top2'),
('771b0aa3-6b57-4648-8877-863f5578a21a','email','contacto@canaiveyucatan.org.mx','sitio_propio','media','raspado-top2'),
('771b0aa3-6b57-4648-8877-863f5578a21a','whatsapp','529995894487','sitio_propio','alta','raspado-top2'),
('3ea9bb9f-b03c-403e-9ccc-5adb317b5194','email','ventas@vestidosnatbridal.com','sitio_propio','media','raspado-top2'),
('3ea9bb9f-b03c-403e-9ccc-5adb317b5194','whatsapp','525578785378','sitio_propio','alta','raspado-top2'),
('11c5918a-4588-4604-a6ec-2db04d0d38be','email','playerasgocas@gmail.com','sitio_propio','media','raspado-top2'),
('11c5918a-4588-4604-a6ec-2db04d0d38be','whatsapp','525623967852','sitio_propio','alta','raspado-top2'),
('c8677487-5aa1-431a-bedf-31d8809d1bac','email','contacto@domikuniformes.com','sitio_propio','media','raspado-top2'),
('212a8734-1416-4c96-881e-25d143998f97','whatsapp','524494811213','sitio_propio','alta','raspado-top2'),
('7a6269bc-3bbc-4a2d-99d4-a025f28580f1','email','contacto@domikuniformes.com','sitio_propio','media','raspado-top2'),
('a3d0e3a5-d9a6-486a-8465-90fb9de68484','email','ventas1@codigouniformes.com.mx','sitio_propio','media','raspado-top2'),
('65d7ff4b-257b-4d23-a08b-8833d91668b8','email','tecnoserviciosgto@gmail.com','sitio_propio','media','raspado-top2'),
('65d7ff4b-257b-4d23-a08b-8833d91668b8','whatsapp','524779219895','sitio_propio','alta','raspado-top2'),
('9385cdff-2f38-42d6-b53c-3806c140333b','email','ventas@unipromo.mx','sitio_propio','media','raspado-top2'),
('9385cdff-2f38-42d6-b53c-3806c140333b','whatsapp','526861152777','sitio_propio','alta','raspado-top2'),
('8b5c08c7-c664-4150-bd0a-16db011e8b85','email','compras@romen.com.mx','sitio_propio','media','raspado-top2'),
('8b5c08c7-c664-4150-bd0a-16db011e8b85','whatsapp','525543243680','sitio_propio','alta','raspado-top2'),
('978ee5e3-6fa5-478d-a01b-dd5e3aa96466','whatsapp','528261592014','sitio_propio','alta','raspado-top2'),
('05b32f49-5067-4eda-9a0c-423f952a1786','email','contacto@croga.com.mx','sitio_propio','media','raspado-top2'),
('67560147-f568-43ff-8476-5b5f3d538cb0','email','info@uniformesybordados.mx','sitio_propio','media','raspado-top2'),
('ce4224ff-b3ea-4636-8aee-c52502a1e4a9','email','info@estopasfinasags.com.mx','sitio_propio','media','raspado-top2'),
('1c85a9ab-f14f-4084-ab90-3fd8d095bbaa','whatsapp','523316972569','sitio_propio','alta','raspado-top2'),
('c5322663-da1e-455b-b4ef-7fed9c42b1c2','email','ventas1@playerasmark.com','sitio_propio','media','raspado-top2'),
('980b321d-bee9-4e9e-a894-2f947eb71202','email','info@belisapulido.com','sitio_propio','media','raspado-top2'),
('0802e5d1-32c3-4a03-bf6d-c031f138c1bd','email','tonnny_05@hotmail.com','sitio_propio','media','raspado-top2'),
('129efa40-f59b-46d7-a408-12f66a8b04ad','whatsapp','525578343522','sitio_propio','alta','raspado-top2'),
('ee4d1c3c-9d95-46bd-b741-97b0136bbedb','whatsapp','523310115736','sitio_propio','alta','raspado-top2'),
('b4d2ba6f-4e61-43bf-9ae8-5c1bc7954f62','whatsapp','523321670061','sitio_propio','alta','raspado-top2'),
('3048c1d3-de37-4491-8134-e9515317fffc','email','contacto@cuelloblanco.com.mx','sitio_propio','media','raspado-top2'),
('3048c1d3-de37-4491-8134-e9515317fffc','whatsapp','524428899350','sitio_propio','alta','raspado-top2'),
('e1c1aba0-a28f-4cf0-91b9-e782870aac54','email','ventas@carmenrion.com','sitio_propio','media','raspado-top2'),
('e1c1aba0-a28f-4cf0-91b9-e782870aac54','whatsapp','525574381890','sitio_propio','alta','raspado-top2'),
('3f74952f-3e92-4192-8b87-e44a7221c62f','email','admon@troppomoda.com','sitio_propio','media','raspado-top2'),
('4a8690d9-9f66-4061-b470-2022b29720cd','email','info@mayro.com.mx','sitio_propio','media','raspado-top2'),
('db959d23-de72-4107-8258-92ff43a8c097','email','ventas@cqualy.com','sitio_propio','media','raspado-top2'),
('2a5feb11-978b-4667-adf3-ebcbfeac3fd8','email','negocios@regency.com.mx','sitio_propio','media','raspado-top2'),
('9ae3759d-634d-48c3-835e-fbc9082cf3a9','email','sac@piccini.com.mx','sitio_propio','media','raspado-top2'),
('9ae3759d-634d-48c3-835e-fbc9082cf3a9','whatsapp','528441223946','sitio_propio','alta','raspado-top2'),
('4430543b-78c0-480e-94a5-25eef53299e2','email','sublim@sublimpromocionales.com','sitio_propio','media','raspado-top2'),
('4430543b-78c0-480e-94a5-25eef53299e2','whatsapp','522228476388','sitio_propio','alta','raspado-top2'),
('b6f2075c-a357-48b3-90af-293f39d70493','email','yumuri@yumuri.com.mx','sitio_propio','media','raspado-top2'),
('015f8a5f-937e-4043-a294-376d11f0fe46','whatsapp','525594149691','sitio_propio','alta','raspado-top2'),
('dbcceb96-dea8-461f-b65c-e7ba89ceb603','email','sales@elcharro1.com','sitio_propio','media','raspado-top2'),
('51351386-4d11-45a3-a398-537c621d3530','whatsapp','524773298055','sitio_propio','alta','raspado-top2'),
('aabc44a2-12de-4317-a151-dba49ef8bc70','whatsapp','528110147973','sitio_propio','alta','raspado-top2'),
('5500c478-5804-4f13-81fa-4cd088f3a5ff','email','informacion@secretodepandora.com','sitio_propio','media','raspado-top2'),
('5500c478-5804-4f13-81fa-4cd088f3a5ff','whatsapp','524434753747','sitio_propio','alta','raspado-top2'),
('a92f9cb7-dd3c-4df5-aef2-94a6dd5b5afd','email','lau.cecilia93@gmail.com','sitio_propio','media','raspado-top2'),
('e75d1221-7ce4-4e13-9f34-2d066d5af770','email','pantaloneseljefe@gmail.com','sitio_propio','media','raspado-top2'),
('e75d1221-7ce4-4e13-9f34-2d066d5af770','whatsapp','528134023112','sitio_propio','alta','raspado-top2'),
('9b412fe9-0a2c-40d6-b89a-25a667b71fe2','email','textildistribuidores@hotmail.com','sitio_propio','media','raspado-top2'),
('9b412fe9-0a2c-40d6-b89a-25a667b71fe2','whatsapp','526671023025','sitio_propio','alta','raspado-top2'),
('c2c13bef-0286-44b8-97fa-1deb0c7f2718','whatsapp','528443146666','sitio_propio','alta','raspado-top2'),
('7bed4365-cb81-48c0-b2a9-3db18c086fe8','whatsapp','522226820694','sitio_propio','alta','raspado-top2'),
('d60ebcaa-442d-4a0b-97a6-d053ea9a573e','email','su.moda.real@gmail.com','sitio_propio','media','raspado-top2'),
('1f9fef63-6da4-42f6-8871-d125c5f3babf','email','ventas@latijera.mx','sitio_propio','media','raspado-top2'),
('471061fa-dee3-4256-9095-2dfef171ec9b','email','hola@benandfrank.com','sitio_propio','media','raspado-top2'),
('471061fa-dee3-4256-9095-2dfef171ec9b','whatsapp','525571000395','sitio_propio','alta','raspado-top2'),
('365bd8d2-415e-478c-b6dc-af8323aa7557','email','joyasarco@gmail.com','sitio_propio','media','raspado-top2'),
('365bd8d2-415e-478c-b6dc-af8323aa7557','whatsapp','523318726197','sitio_propio','alta','raspado-top2'),
('b7ea6113-a228-4275-b17d-364a2727354f','email','ventas1@sparviero.com.mx','sitio_propio','media','raspado-top2'),
('e67fcf69-6fa7-4630-927b-98c2191c14a4','whatsapp','525565085710','sitio_propio','alta','raspado-top2'),
('86727926-ef0e-49f9-b94a-3fd2e0a58871','email','contacto@stractto.com','sitio_propio','media','raspado-top2'),
('86727926-ef0e-49f9-b94a-3fd2e0a58871','whatsapp','523311867900','sitio_propio','alta','raspado-top2'),
('67da96fa-12e5-4d9d-97ca-13aa3aa414a7','email','opticamadero@opticahera.com','sitio_propio','media','raspado-top2'),
('67da96fa-12e5-4d9d-97ca-13aa3aa414a7','whatsapp','525585734647','sitio_propio','alta','raspado-top2'),
('aff49070-9fb1-4603-a8e5-9789ba1f35f5','whatsapp','524421139948','sitio_propio','alta','raspado-top2'),
('e3aaaea2-7b90-4468-b7ee-e750ec1d7b2a','email','ecodenogales@hotmail.com','sitio_propio','media','raspado-top2'),
('eac11301-cd8b-4f91-8e5e-08406d1637d0','email','info@outletdeplayeras.com','sitio_propio','media','raspado-top2'),
('e2ada293-4e65-427b-8127-46b1417a2352','email','calicuse@yahoo.com.mx','sitio_propio','media','raspado-top2'),
('15221201-a3d1-43ce-80cd-09fb88408cf6','whatsapp','523330287951','sitio_propio','alta','raspado-top2'),
('9862b719-b249-4ba0-8d54-b1afc60b42bc','email','joel.cruz@lamaria.com.mx','sitio_propio','media','raspado-top2'),
('30de2680-7010-4cf2-820e-ae2a9a541630','email','ventas@logosybordados.com','sitio_propio','media','raspado-top2'),
('cf4b7967-7b13-4a86-ba74-7871a7fec39d','email','redibytes@gmail.com','sitio_propio','media','raspado-top2'),
('d5607099-0c9c-4bad-bf0b-c30aa3f6cc5e','email','info@estampalo.com','sitio_propio','media','raspado-top2'),
('f321ae2d-d32a-4136-a286-3c410411da6e','email','atn_clientes@opticaskauffman.com.mx','sitio_propio','media','raspado-top2'),
('4ee96139-3bfa-45f7-b339-ce896d456903','email','contacto@actiongroup.com.mx','sitio_propio','media','raspado-top2'),
('dfbe5c09-f82c-492d-88ce-a5dd065e8e87','whatsapp','529512402734','sitio_propio','alta','raspado-top2'),
('96735d8a-0393-4d8c-9caf-97ce9e9c5189','email','info@outletdeplayeras.com','sitio_propio','media','raspado-top2'),
('614e905c-7e9c-4401-a2db-2c476d125442','email','rvillasante@viye.com.mx','sitio_propio','media','raspado-top2'),
('614e905c-7e9c-4401-a2db-2c476d125442','whatsapp','525641151488','sitio_propio','alta','raspado-top2'),
('8669ffd3-ac15-40fc-80a2-ca8ec3b61c63','email','ventas@maxicaps.com.mx','sitio_propio','media','raspado-top2'),
('431e2b5e-fbba-41e9-bce9-4f78eb10c6ed','email','contacto@promoscreativos.com','sitio_propio','media','raspado-top2'),
('5e82f579-ee98-468b-8359-490fab7ee05e','whatsapp','528112088178','sitio_propio','alta','raspado-top2'),
('8fcea235-9933-4ec9-a57e-e5b727896bea','email','jorge.castelan@casbec.com.mx','sitio_propio','media','raspado-top2'),
('6adbdd4a-9ac7-41a1-abeb-497a7adbef6e','whatsapp','525572482687','sitio_propio','alta','raspado-top2'),
('5a733d0f-b23c-4eed-8199-27c8e9a59bfd','email','contacto@desportik.com','sitio_propio','media','raspado-top2'),
('eabec169-50c3-49ab-85b0-5beaf1737f94','whatsapp','528116291526','sitio_propio','alta','raspado-top2'),
('911ceb05-3c99-4f0a-abd7-5f77f666e695','email','support@calcetinespachuca.store','sitio_propio','media','raspado-top2'),
('84d864c5-cb1b-4e97-a26a-4471f6faa3cf','email','contacto@sportico.com.mx','sitio_propio','media','raspado-top2'),
('84d864c5-cb1b-4e97-a26a-4471f6faa3cf','whatsapp','525561663960','sitio_propio','alta','raspado-top2'),
('68d10e68-ef1b-48e6-8001-7ccc603cda00','email','atencion@scappino.com','sitio_propio','media','raspado-top2'),
('68d10e68-ef1b-48e6-8001-7ccc603cda00','whatsapp','525543481019','sitio_propio','alta','raspado-top2'),
('9ec175bf-b008-4d2a-b0e3-ab665a25c86a','email','hugo_puntovalle@hugoboss.com','sitio_propio','media','raspado-top2'),
('eb17044f-8008-41f1-898a-7d9cc0ab29ab','email','contacto@streetsilver.mx','sitio_propio','media','raspado-top2'),
('4bdd28ba-468e-42c5-9111-6b0d8f932343','whatsapp','528114642039','sitio_propio','alta','raspado-top2'),
('1905828a-8f2d-438c-9014-a7a58020dde3','email','atenciononline@duo.com.mx','sitio_propio','media','raspado-top2'),
('1905828a-8f2d-438c-9014-a7a58020dde3','whatsapp','526682360911','sitio_propio','alta','raspado-top2'),
('594315b5-8f96-42e9-9ad0-5de84aa65364','email','juan.vera@comprausadomexico.com.mx','sitio_propio','media','raspado-top2'),
('594315b5-8f96-42e9-9ad0-5de84aa65364','whatsapp','525585803322','sitio_propio','alta','raspado-top2'),
('e1bf4122-4f17-4aa3-80dd-5cd2e5b62889','email','contacto@vintagedecoracion.com.mx','sitio_propio','media','raspado-top2'),
('e1bf4122-4f17-4aa3-80dd-5cd2e5b62889','whatsapp','526141704233','sitio_propio','alta','raspado-top2'),
('868bd200-0e45-460c-a2fe-95c6b3662b3e','email','georgerdz24@gmail.com','sitio_propio','media','raspado-top2'),
('81dbf9e7-9e83-4def-b38d-9df9cb76255e','whatsapp','528127534215','sitio_propio','alta','raspado-top2'),
('4b69fd17-f18b-4f8a-9d51-ff9a2b0160e7','email','ventas@blackkissmx.com','sitio_propio','media','raspado-top2'),
('0d11aafb-1949-4cc2-8dac-0dee13e62f89','email','info@candyshop.com.mx','sitio_propio','media','raspado-top2'),
('69ad1de6-de84-407c-a115-b910058c83b8','email','ventas@fabricadetrajesdecharrogabrieles.com','sitio_propio','media','raspado-top2'),
('69ad1de6-de84-407c-a115-b910058c83b8','whatsapp','525537015964','sitio_propio','alta','raspado-top2'),
('2103cbb1-f503-4b44-a0f2-1e3470457214','whatsapp','525554682563','sitio_propio','alta','raspado-top2'),
('527bd42d-7414-4797-a7b3-4f4b3ac5fb02','email','contacto@sary.com.mx','sitio_propio','media','raspado-top2'),
('bde30ac4-6ae8-4598-b285-599bde364ff2','whatsapp','524771794796','sitio_propio','alta','raspado-top2'),
('ce81327a-4ae5-42da-8cdc-0d8e75249ffd','whatsapp','523318474081','sitio_propio','alta','raspado-top2'),
('cbd1f859-9cda-48c4-bfce-b6aecdfcbbe5','email','canaivetehuacan@gmail.com','sitio_propio','media','raspado-top2'),
('e5a1a820-819d-49b4-b97a-1414d463abf2','email','bikinisriosyvalles@gmail.com','sitio_propio','media','raspado-top2'),
('e5a1a820-819d-49b4-b97a-1414d463abf2','whatsapp','523112378341','sitio_propio','alta','raspado-top2'),
('760cc90f-c55d-48cf-848d-dd5ad037f411','email','info@visualmerchandisinglab.com','sitio_propio','media','raspado-top2'),
('be60033f-3dad-4bd9-822b-bcbba9582c95','whatsapp','528128908120','sitio_propio','alta','raspado-top2'),
('03854931-06e1-4857-bb26-37aef1e9c635','email','alcala831@hotmail.com','sitio_propio','media','raspado-top2'),
('08acbcc4-c9f4-4285-b5d6-96e36db86567','email','pliegohats@yahoo.com','sitio_propio','media','raspado-top2'),
('cd4cd6c0-54e9-4943-9db0-b484364d149c','email','ventas@mrcachuchero.com','sitio_propio','media','raspado-top2'),
('cd4cd6c0-54e9-4943-9db0-b484364d149c','whatsapp','528661021666','sitio_propio','alta','raspado-top2'),
('44f43319-b65d-40b8-96c0-50e3f4eb9662','whatsapp','525648967642','sitio_propio','alta','raspado-top2');

update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/plazaforumtepic'), facebook=coalesce(facebook,'https://facebook.com/ForumTepicPlaza') where id='543fbe2d-bb04-41af-9de4-2953c7c10137';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/priceshoesoficial'), facebook=coalesce(facebook,'https://facebook.com/PriceShoes') where id='f7cbdfbe-c730-41dd-8d4b-b77aba2f3e9b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/fantasiasmiguel'), facebook=coalesce(facebook,'https://facebook.com/FantasiasMiguel') where id='f4716738-ccf2-4799-97d5-264e280db4cc';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/MagnoCentroJoyero'), facebook=coalesce(facebook,'https://facebook.com/MagnoCentroJoyero') where id='e83364f1-1156-40b1-b0f4-2d0f973bd09f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/vistaplayadeoromanzanillo') where id='4aea7ea4-2e7a-4305-acb5-30aa8e36e602';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sapicamexico'), facebook=coalesce(facebook,'https://facebook.com/SAPICAMexico') where id='68db6ac0-d319-4ca3-a1c9-2ebcb0c0ec06';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/gtcoapa'), facebook=coalesce(facebook,'https://facebook.com/GT.Coapa') where id='b9544a15-96aa-4d82-b4a2-e6dd7c34f1af';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Revistajoyeros') where id='9c6a66a5-1e25-4d6f-b002-14bd8a5c5866';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/GranChapur'), facebook=coalesce(facebook,'https://facebook.com/GranChapur') where id='c90d67de-f822-4326-b00f-57843d3f942f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/granplazaoutlets'), facebook=coalesce(facebook,'https://facebook.com/GranPlazaOutlets') where id='db4f57c1-597f-4aab-8803-510dda717c66';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/deportesgaleana'), facebook=coalesce(facebook,'https://facebook.com/deportesgaleana') where id='6685002f-5fea-46b9-832b-64e8236ca5e7';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/sharer.php') where id='ef15b116-3d46-44b1-a5d0-d1e22a6d6ffa';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/CasasCastilla') where id='7e1ff3f0-67c3-4d28-ba37-3535a3fe6771';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/infinitijoyasmx'), facebook=coalesce(facebook,'https://facebook.com/infinitijoyasmx') where id='667ddee9-267a-4d92-89f5-c1c1fc72a1cd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/promodaoutlet'), facebook=coalesce(facebook,'https://facebook.com/PromodaOutlet') where id='3a6db856-f6fa-49c4-8d0a-7368459af7d0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/macariadress'), facebook=coalesce(facebook,'https://facebook.com/macaria.dress') where id='0d240ce8-fc89-4fb5-8a54-b4cc83043fa1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dax_mexico') where id='c69cff03-2bff-4068-b1ce-40b6a875bfc2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/miguelito_mx'), facebook=coalesce(facebook,'https://facebook.com/MiguelitoTodoParaLaDanza') where id='de1036b0-98c2-4feb-905e-63db477957d4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/el_legadomx'), facebook=coalesce(facebook,'https://facebook.com/el.legadomx') where id='e343b721-599f-48bd-afee-64cdacc0727e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/yulygiraldoimagen') where id='df468897-890d-4274-959d-132a68ad5251';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/artistcitytienda') where id='bbde869a-5a08-47e6-bd7d-9359ca2a9c1a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/la.nueva.perla'), facebook=coalesce(facebook,'https://facebook.com/lanuevaperlatextil') where id='3089a6c6-bb2a-41d9-9031-e4ab1e352011';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/garufajeansmx'), facebook=coalesce(facebook,'https://facebook.com/garufajeansmx') where id='a08d6057-e06c-45c5-96e7-e26a23264b4b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/fortunehandsofficial'), facebook=coalesce(facebook,'https://facebook.com/fortunehandsbrand') where id='6443bd83-52ac-4813-953c-f61c1c7986b5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dgloriajoyeria'), facebook=coalesce(facebook,'https://facebook.com/dgloriajoyeria') where id='25b97676-317c-4a7d-9490-43f6feae8db3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/conde.cpz'), facebook=coalesce(facebook,'https://facebook.com/CentroPlaterodeZacatecas') where id='df139fbe-810e-4ff0-8c50-8ffe24fa1091';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/casaizanovias'), facebook=coalesce(facebook,'https://facebook.com/CasaIzaNovias') where id='abcf5967-53c4-4c25-99a8-72657a3bdd55';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/mindoracollection') where id='86caece2-b9cb-4f4d-8b6b-dfc153e1aa4d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/LG88'), facebook=coalesce(facebook,'https://facebook.com/LG88') where id='98f7835c-ed95-4b2b-a607-f302b876495e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/moutyjoyeria'), facebook=coalesce(facebook,'https://facebook.com/Moutyjoyeria') where id='5ae9834f-c13c-4f0b-aeca-3919fa3bf127';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/moonrodbrides'), facebook=coalesce(facebook,'https://facebook.com/MoonrodRentadevestidos') where id='f333ad0e-b722-48c0-9d97-158f4dee0e64';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cklassoficial'), facebook=coalesce(facebook,'https://facebook.com/cklassoficial') where id='711cff39-b78f-4699-a237-b9ca23e5e506';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ameliejoyasmx'), facebook=coalesce(facebook,'https://facebook.com/ameliejoyasmx') where id='5334874c-f511-4447-aebe-20a2b380707b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/mariamaria.cuu'), facebook=coalesce(facebook,'https://facebook.com/MariaMariaVestidosMx') where id='ecefa832-eeb6-415f-9c2d-e1b61aab3632';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ellasboutiquemx'), facebook=coalesce(facebook,'https://facebook.com/ELLASboutiqueGDL') where id='0e47ad7f-0183-4d55-904e-b4791c579b4b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elitetuxedo'), facebook=coalesce(facebook,'https://facebook.com/EliteTuxedoOficial') where id='51b4ffc5-8391-4cc7-bd16-3ba59681f8b1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/99problemsmx'), facebook=coalesce(facebook,'https://facebook.com/99problemsmx') where id='ea411f62-bd37-43d5-b2dd-ed3f15efc8af';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/carlotinaclothing'), facebook=coalesce(facebook,'https://facebook.com/CarlotinaClothing1') where id='07a314c8-ffcd-416f-b229-54f76457d7a0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hotelcasagonzalez'), facebook=coalesce(facebook,'https://facebook.com/Hotel.Casa.Gonzalez') where id='8a80c96b-2a41-4cd6-87bf-0087bde98a16';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/somostennisexpress'), facebook=coalesce(facebook,'https://facebook.com/TennisExpressMX') where id='3b432454-fc80-4b5d-9e24-ca5545e1115a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lluviademanualidades'), facebook=coalesce(facebook,'https://facebook.com/Lluviademanualidades') where id='1e9dc983-caac-4ab5-8604-88659a4cc513';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/VIETNAM303'), facebook=coalesce(facebook,'https://facebook.com/VIETNAM303') where id='e848f065-6d44-4634-8e74-6196e7bf3fbd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hellofashion.leon'), facebook=coalesce(facebook,'https://facebook.com/hellofashion.leon') where id='a5b65ef8-220b-471e-bc82-7d86de89ef35';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/yazbek_oficial') where id='fa2ff457-5147-47c6-adae-fa7f3ff486ac';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elglobooficial'), facebook=coalesce(facebook,'https://facebook.com/elglobooficial') where id='3554b6ee-2fc1-4e46-b74d-69edc71cdcf6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/pronovias'), facebook=coalesce(facebook,'https://facebook.com/pronovias') where id='baabb0c4-7154-481a-89e9-3de73910fbd6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/teepublic'), facebook=coalesce(facebook,'https://facebook.com/TeePubliccom-865099700332025') where id='a4bb3275-e006-4b08-824a-8bae9ba8e5a4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/RAJALANGIT77'), facebook=coalesce(facebook,'https://facebook.com/RAJALANGIT77') where id='688e9155-51f0-4c57-9d74-d46fc87c6f73';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zapateriafratello'), facebook=coalesce(facebook,'https://facebook.com/ZapateriaFratello') where id='42aba0d7-2c30-4f7e-8900-73501f971ea7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unseruniformes'), facebook=coalesce(facebook,'https://facebook.com/unser.uniformes') where id='f32c7a6d-e3b7-40d0-941d-92f4be315fd1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/blshoes_online'), facebook=coalesce(facebook,'https://facebook.com/blshoesonlinemx') where id='748a6749-60c5-42e0-a413-b0dbf145f795';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/binaboutique'), facebook=coalesce(facebook,'https://facebook.com/bina.boutique.mty.rentavestidos') where id='2bac95e1-fcf2-4a46-b9a1-10c9b8dc60e8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/uniformes_lobitos_') where id='2d4efeb5-6cf0-40e4-a713-44b909ac1866';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/windsor_smoking_trajes') where id='3e7de61b-3fb6-405a-939e-1b7bb652a07f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/havocmx'), facebook=coalesce(facebook,'https://facebook.com/HavocSuits') where id='90171142-a2df-4d26-ac4a-e917d1b4ebae';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cletoreyesmexico'), facebook=coalesce(facebook,'https://facebook.com/cletoreyesoficial') where id='3ea426ee-26c4-4fc5-ba16-24d34285e878';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/abba.joyas'), facebook=coalesce(facebook,'https://facebook.com/abbajoyasmx') where id='5174c604-1ed0-4c92-8ed1-8d19bfeaa628';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zapatoagiloficial'), facebook=coalesce(facebook,'https://facebook.com/zapato.agil.96') where id='dc4e71dd-81c0-4645-8de8-99b4227edddd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eurocotton'), facebook=coalesce(facebook,'https://facebook.com/EuroCottonOficial') where id='ed15c57d-c395-4d3e-8c35-ee71ecd1b19e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bridenformal'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='1d687be7-98a1-4c9e-b0c4-ecd77abb2f83';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/chivas'), facebook=coalesce(facebook,'https://facebook.com/chivas') where id='749f3a0e-17c1-40ac-b7eb-3ddd75f15c33';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/oggijeans'), facebook=coalesce(facebook,'https://facebook.com/OggiJeans') where id='6fcb7904-a90b-49cf-9cf7-08a2eb034efd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bondsboutique'), facebook=coalesce(facebook,'https://facebook.com/BondsBoutiquemx') where id='1b02c944-a17d-47b1-b1f1-05dabfcc12ed';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/estambresstateresita') where id='62749c4c-3958-4248-963f-d7dc9a7e1b0b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/skmed_uniforme_medico'), facebook=coalesce(facebook,'https://facebook.com/Sk-Med-Uniformes-M') where id='fd5873dc-513d-41c2-8ee4-790faaa34431';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/carlo.mx'), facebook=coalesce(facebook,'https://facebook.com/carlogiovannivestidos') where id='fd1aef1c-c768-4288-afcc-4319c370792c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/superdeportesmexico'), facebook=coalesce(facebook,'https://facebook.com/Superdeportesmx') where id='5b503b2e-dc2c-4a0d-9869-b6bb93086224';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/petipamexico'), facebook=coalesce(facebook,'https://facebook.com/Petipamx') where id='78638245-e3d3-4519-bfed-a5b2d3d0d15f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/disfraceselfamundi'), facebook=coalesce(facebook,'https://facebook.com/elfamundi') where id='ccf4daf9-7a2e-47ff-90bd-cfb39dfbe2f1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='f8ff78ea-9adf-4375-a5ce-646c6c1c70ba';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='fcaba4f2-41a7-4923-a910-b3fdac29f1ea';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/solatextil_'), facebook=coalesce(facebook,'https://facebook.com/SolaTextilPuebla') where id='76aa55e6-4374-4774-b38f-5cb32fc08b79';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/uniformes.alaman'), facebook=coalesce(facebook,'https://facebook.com/UniformesAlaman') where id='c93c46ab-e8d6-4438-98c9-612881e9f218';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/soulsnkrstore'), facebook=coalesce(facebook,'https://facebook.com/SOULSNKRS') where id='48df5ffc-c2a4-46db-aaf8-d47d771de661';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='adcc96ae-637f-4ef6-bfc8-060daa50e471';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/almadelunamx') where id='e81eb2d9-296e-4bef-bdb2-b9d7ea81a76c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/gema_optica'), facebook=coalesce(facebook,'https://facebook.com/optigema') where id='fe498d4e-deaf-4985-865a-8fde0c314344';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/uniformeslaamistad'), facebook=coalesce(facebook,'https://facebook.com/uniformeslaamistad') where id='02ab88a5-f5fb-42aa-a610-4aceb85494ff';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/karatimx'), facebook=coalesce(facebook,'https://facebook.com/karatimx') where id='bd0da07a-4ef0-4f48-835a-145c0340b096';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/holofdresses') where id='a0c37276-8a95-4dba-a53b-a194008e1096';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticasjarmar'), facebook=coalesce(facebook,'https://facebook.com/opticasjarmarchiapas') where id='3069d25c-5e20-4ea0-930a-5c9623813791';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/PlazaSapporoZapaterias') where id='78c581cf-eceb-4066-9774-8e2e127e6081';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/valma.playa'), facebook=coalesce(facebook,'https://facebook.com/VALMAPlayadelCarmen') where id='bf28a55b-6d8f-49d1-8d48-9c463c9463cd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/anillosdecompromiso'), facebook=coalesce(facebook,'https://facebook.com/anillosdecompromiso') where id='6c470b25-9163-48b3-aeba-46f995b9d8a8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/corseterialaconchita'), facebook=coalesce(facebook,'https://facebook.com/corseterialaconchita') where id='a9ee1f64-615a-4169-ac1c-e7dafb49ff07';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/merceriadelrefugio'), facebook=coalesce(facebook,'https://facebook.com/MerceriadelRefugio') where id='bc9af7ef-e7f8-4ab7-8a50-31abb8c5ebf2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/boutique.monet'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='5881b9a5-7719-49d3-a359-11089aac14b7';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/sharer.php') where id='0c53cf71-ece4-4c36-83d1-8eff977b294d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elitetuxedo'), facebook=coalesce(facebook,'https://facebook.com/EliteTuxedoOficial') where id='cdbe9465-c977-468d-bf08-ac417614e438';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticablink'), facebook=coalesce(facebook,'https://facebook.com/opticasblink') where id='00dc2a01-ab64-4f79-962a-821abdca6983';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tuzomaniaoficial'), facebook=coalesce(facebook,'https://facebook.com/tuzomania.of') where id='74863e07-6d1a-44d7-a503-33fc377a4b16';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='d0aaca18-19e2-4181-9db3-c9bb9343d461';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/skmed_uniforme_medico'), facebook=coalesce(facebook,'https://facebook.com/Sk-Med-Uniformes-M') where id='5b7fb733-315a-409f-9ae1-ce19135d0725';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zittro.mx') where id='a4cb8a05-f96a-4295-b469-4ea82dd7b5d4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/petngo'), facebook=coalesce(facebook,'https://facebook.com/petngo.com.mx') where id='ec9bd95f-3b9c-4a40-a1a7-4dd0836c09f0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cklassoficial'), facebook=coalesce(facebook,'https://facebook.com/cklassoficial') where id='b58f7fac-e459-4029-9769-8f96f5f5d516';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='32e8cd7c-2749-49a5-8499-18d4ffc269d4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='e24a97b3-347e-4c34-89f1-ef94b474a309';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/majasportswear') where id='82795919-bfbd-4ce8-8c9c-f8c1892589ad';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/me'), facebook=coalesce(facebook,'https://facebook.com/tooyscoleccionables') where id='309b0946-763d-4434-bd08-5253d37fd7b6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/vittoriofortiofficial'), facebook=coalesce(facebook,'https://facebook.com/vittoriofortimx') where id='8694876d-63ee-4d67-a5fe-800156deafed';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/stardancemx') where id='fe92d8d9-b571-4199-9397-1a853f7365ea';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='e41da441-9a85-43e5-a59b-8b6a18862dc0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/soybissu'), facebook=coalesce(facebook,'https://facebook.com/SoyBissu') where id='94690d47-7c4a-4d9f-8193-a040f65167a1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zapotlanejogob'), facebook=coalesce(facebook,'https://facebook.com/GobiernoZapotlanejo') where id='1c2c27bd-582b-490f-8d74-75ce72cf8d5a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/babycreysi'), facebook=coalesce(facebook,'https://facebook.com/babycreysi') where id='e5145a83-17e6-4105-88be-64f9b667b682';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/SIVUPLEMX') where id='454f66c6-9eee-44b1-8534-cec97dd20e4f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bellenovia'), facebook=coalesce(facebook,'https://facebook.com/BelleNoviaHermosillo') where id='8c736ae3-046c-4237-8f01-30c428d4046c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='f8503e44-cf59-4ef2-9def-12cc86d7a7ca';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/squalo.mx'), facebook=coalesce(facebook,'https://facebook.com/SQUALOMXN') where id='be4f2de3-c59d-4877-81cf-e060e3493ba9';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/aldocontimx'), facebook=coalesce(facebook,'https://facebook.com/aldocontitalia') where id='8ecd3e9b-b2b5-445c-9731-ffa57404014e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/gallantdaleoficial'), facebook=coalesce(facebook,'https://facebook.com/gallantdale') where id='60f251b6-dcdf-49f8-8583-cceeeb132d0c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/instagram.com'), facebook=coalesce(facebook,'https://facebook.com/facebook.com') where id='1a3d6037-413d-445a-9d5a-12a55dfb5c7d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/goena.trajes') where id='d844243b-66b2-4d64-849c-4080dafe9a18';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/FrancesLimonVestidos'), facebook=coalesce(facebook,'https://facebook.com/FrancesLimonVestidos') where id='1ffe1fbc-f3d5-4e5d-8af5-1360c04454db';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/versuskatestore'), facebook=coalesce(facebook,'https://facebook.com/versus.skatestore') where id='202529a5-fd85-435f-9c7d-c6a9bcb70f9a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ranchdepotmx') where id='2f6d779e-418b-4144-9bbe-c2bafdc5bdae';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/AnalorenaBridal') where id='d29c7b0e-824c-407f-bee0-4e82fc160147';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/duncanista'), facebook=coalesce(facebook,'https://facebook.com/MajorSneakerStore') where id='71dead2c-c31b-46ce-ad98-3f27a80e6ecd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/karatimx'), facebook=coalesce(facebook,'https://facebook.com/karatimx') where id='a92c3f0c-0259-4af4-905d-11a0cdeb2e18';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/MayoreoC') where id='ad0c66f7-09b7-4cd2-b337-1bd344b9d4d3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/whatsapp'), facebook=coalesce(facebook,'https://facebook.com/brand') where id='e972edd5-0423-4ff9-bb9c-17bb2fce252b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elglobooficial'), facebook=coalesce(facebook,'https://facebook.com/elglobooficial') where id='56fffa44-b5ea-447c-bfd7-c1f49b2579ce';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zona15mx'), facebook=coalesce(facebook,'https://facebook.com/zona15centro') where id='c48f7d65-3f94-4efd-8e51-952cfd4d1e1a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cazanova.mx'), facebook=coalesce(facebook,'https://facebook.com/CazanovaImportaciones') where id='2c0ce3cd-5671-4c18-a389-7f7ee6b04d2a';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/2008') where id='dc65e85f-224b-4568-a137-a2741f88eb29';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lobmoda'), facebook=coalesce(facebook,'https://facebook.com/lob.com.mx') where id='21dcbf70-e099-48a8-8fdd-ebd5676bcdf6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/soulsnkrstore'), facebook=coalesce(facebook,'https://facebook.com/SOULSNKRS') where id='770372cf-5da9-46b6-b197-e7e162609eb6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/textilessanantonio'), facebook=coalesce(facebook,'https://facebook.com/textilessanantoniogdl') where id='d38489cf-7d99-42e1-8c1c-ca06d69bd7ef';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/MotoOutletToluca') where id='af41754d-27bf-4331-ba58-64cb45ba2d64';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/moditex'), facebook=coalesce(facebook,'https://facebook.com/ModitexMexico') where id='bd5d4bbf-86ff-4e3e-a6f2-30dc100562d0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/shoecarnival'), facebook=coalesce(facebook,'https://facebook.com/ShoeCarnival') where id='acad7800-ba9e-4d58-b56c-7ec4c746c6cb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/_u'), facebook=coalesce(facebook,'https://facebook.com/aeropostale') where id='7bc6e5a3-7ea2-48cd-9c55-3da5eab63f2b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/encantodress'), facebook=coalesce(facebook,'https://facebook.com/encantodressrental') where id='7f1b3a68-36ca-4ec4-89cf-15253aac7a30';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dportenis'), facebook=coalesce(facebook,'https://facebook.com/dportenis') where id='9bde26df-b8fe-4733-928e-50c8adb78f5b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/veanamx'), facebook=coalesce(facebook,'https://facebook.com/VeanaMX') where id='fd445e1b-f887-4311-9ff4-bc37405504a3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/shopify'), facebook=coalesce(facebook,'https://facebook.com/shopify') where id='817db582-1c3b-4a24-9275-9073f1118dfa';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/uniformes.alaman'), facebook=coalesce(facebook,'https://facebook.com/UniformesAlaman') where id='166f34aa-c005-4cfc-ad84-ebf6f02a0994';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eraseunavez0110'), facebook=coalesce(facebook,'https://facebook.com/EraseUnaVez0110') where id='3a13c117-7516-4f4a-a183-ae00cd5f4a48';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dimeo_cc'), facebook=coalesce(facebook,'https://facebook.com/dimeocc') where id='6b0c72fe-bcf0-4a15-a7d9-99c512574685';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hellomom.mexico'), facebook=coalesce(facebook,'https://facebook.com/ropadematernidad.moda') where id='871dfaef-06e8-46e8-a9b0-cda6db4c394c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/novedadestony'), facebook=coalesce(facebook,'https://facebook.com/novedadestonymid') where id='f24a518a-deba-4287-9dc6-8755f0c5c616';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sposa_bridal_bc'), facebook=coalesce(facebook,'https://facebook.com/sposabridaltj') where id='a80005a7-67ad-4005-9abe-180c54d7f625';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/channel'), facebook=coalesce(facebook,'https://facebook.com/Urbanutilitymx') where id='0ad84f47-b3e5-4084-a0b9-312da23fe7fd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/citybridemx'), facebook=coalesce(facebook,'https://facebook.com/CityBrideMx') where id='509b64b6-f33c-41c4-9d38-e1691d214a8f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/gala.sport'), facebook=coalesce(facebook,'https://facebook.com/Gala-sport-410605095711669') where id='27552c30-0b3b-4e31-9301-400ae8ac33f0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='bf26414d-ab3f-4bdd-bb88-c6db69885dfd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/squalo.mx'), facebook=coalesce(facebook,'https://facebook.com/SQUALOMXN') where id='8c525f8d-c454-41f8-9511-d807493aa2d5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/aguiarnovias'), facebook=coalesce(facebook,'https://facebook.com/aguiarcasadenovias') where id='64a7dd85-5357-4bd0-b7e8-79b5122bca6d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/danielsjewelers'), facebook=coalesce(facebook,'https://facebook.com/DanielsJewelers') where id='baca993c-033d-4bd3-b96f-d6794efa4e23';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/conversemexico'), facebook=coalesce(facebook,'https://facebook.com/Converse.MX') where id='335f93d4-81d2-4c3b-8ac6-80c25327caa4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/mercadolibre.mex'), facebook=coalesce(facebook,'https://facebook.com/MercadoLibre') where id='d0eb8367-d5ae-4814-8be8-5d5caaeae4f9';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sposabellabrides'), facebook=coalesce(facebook,'https://facebook.com/sposabellamx') where id='7392dfa8-50a9-4d1b-8e67-f9982e0c7343';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/airebarcelona'), facebook=coalesce(facebook,'https://facebook.com/AireBarcelona') where id='2e107b42-19a4-4ce0-8973-1fa5c7847c68';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dportenis'), facebook=coalesce(facebook,'https://facebook.com/dportenis') where id='623de6af-7a12-4243-b405-2e3dca700e1f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/colorsublime'), facebook=coalesce(facebook,'https://facebook.com/colorsublime.mx') where id='812b651b-7b31-4599-8284-9a0b9ec48064';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/carmen_collection'), facebook=coalesce(facebook,'https://facebook.com/carmencbridal') where id='8063f4fc-7b11-451a-a7c7-ef20c9014e16';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/articulosparafiestamx'), facebook=coalesce(facebook,'https://facebook.com/AccesoriosparafiestaMexico') where id='b59c604a-0a3e-4cb6-b43a-f3776e9f69b1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elitetuxedo'), facebook=coalesce(facebook,'https://facebook.com/EliteTuxedoOficial') where id='55c8c25b-4508-4d84-a9c9-e0803beaf711';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/alexandersgdl'), facebook=coalesce(facebook,'https://facebook.com/AlexandersTrajesFormales') where id='4f68fca9-6fd2-4c78-aa69-05aa4906e21e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ruvalcaba.fantasias'), facebook=coalesce(facebook,'https://facebook.com/RuvalcabaFantasias') where id='e5d5d4dc-8cea-4fae-98de-a8755c6ef819';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hylizaboutique') where id='7ea7a95f-dd7e-4b87-8d4d-c61d89d0efc3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/libreria_acuario'), facebook=coalesce(facebook,'https://facebook.com/LibreriaAcuarioMedicalStore') where id='0366747a-4ca2-4a49-9928-b4e1cfcc645e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/pirma_oficial') where id='c6d17540-d5b9-4f35-a029-45ddb8f34c1c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elitetuxedo'), facebook=coalesce(facebook,'https://facebook.com/EliteTuxedoOficial') where id='ce22a2b6-1dbe-4174-ac22-cecec1bfaf32';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/toursexpo') where id='ca8da1c2-861c-40b0-bf20-d895804967d3';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Tejidos-Gayt') where id='bea3c06c-2d31-471b-ae4b-5291ed87da8e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zapateria_francis'), facebook=coalesce(facebook,'https://facebook.com/ZapateriaFrancis') where id='3681a6e5-c3dc-4a0c-afaf-13f55fbbc2f9';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/capitaltextil_mx'), facebook=coalesce(facebook,'https://facebook.com/capitaltextilmx') where id='076be8c4-b09b-4f2e-b6ce-253377787f70';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eva_brazzi'), facebook=coalesce(facebook,'https://facebook.com/EvaBrazziMx') where id='b8672c4a-f7e7-46d1-aa4f-106686d2c4bc';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lineasmx'), facebook=coalesce(facebook,'https://facebook.com/LineasMx') where id='77af4b9a-c838-40a3-ba45-e1b2d56e3397';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/clinikuniformes'), facebook=coalesce(facebook,'https://facebook.com/uniformesclinik') where id='4c48b3e6-28e7-4841-9cea-b90e11183a27';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/joyerias.mexico'), facebook=coalesce(facebook,'https://facebook.com/joyeriasmexico') where id='d1fd664c-076c-4d8b-b57e-21491eb0daed';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/clubtomaterosoficial'), facebook=coalesce(facebook,'https://facebook.com/clubtomateros') where id='214bfbb2-4030-4a33-a0f9-84f56a8d4311';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/dtalamantes1954') where id='d2e513e7-3881-435d-89c3-d90dc0ba439d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/allegrodancestore') where id='58e1f0cf-078b-4440-b4fd-9bef258d931c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/yotebordo'), facebook=coalesce(facebook,'https://facebook.com/yotebordo') where id='09d49604-ecd0-45d3-a242-e342446c1c21';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/barbiboo1'), facebook=coalesce(facebook,'https://facebook.com/zazadancewearmonterrey') where id='3d1c7560-5bd0-4e4a-b303-06b4271faaab';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Tienda-de-Disfraces-Comienza-la-Funci') where id='dfddf52c-6ac3-4b9e-977d-6eaf252edd41';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dafer.tienda'), facebook=coalesce(facebook,'https://facebook.com/dafertiendadepartamental') where id='54271c2a-cd20-4c81-893a-192d9414207e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticasdelmayab.mid'), facebook=coalesce(facebook,'https://facebook.com/217534515648') where id='40676076-064e-43e0-ad19-857ba0ea6fce';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/guayaberas_yucatecas_mayabki'), facebook=coalesce(facebook,'https://facebook.com/GuayaberasYucatecasMayabki') where id='6998f232-2cbb-48d8-b822-255a3d93ee60';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/todofutbolmty5'), facebook=coalesce(facebook,'https://facebook.com/TodoFutbolMTY') where id='d1319988-d02a-43de-9eb5-1863673f2bd6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='edb99fd4-58c7-4b91-8d08-7c8a51a8f0a7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elnopaal'), facebook=coalesce(facebook,'https://facebook.com/tiendaselnopal') where id='58b048e5-cbe4-435e-b897-a2faf0e18a1d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/wixstudio'), facebook=coalesce(facebook,'https://facebook.com/WixStudio') where id='d4206644-a42f-4f0d-9a4c-c8a60df0700a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unicofam_oficial'), facebook=coalesce(facebook,'https://facebook.com/Unicofam') where id='d406aabc-030a-4ec0-ab51-9ab2b928737e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lazzarmexico'), facebook=coalesce(facebook,'https://facebook.com/LazzarMexicoUniformes') where id='4d0813c8-d264-4e9e-a18d-122272ecb2a6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/megashoesoficial'), facebook=coalesce(facebook,'https://facebook.com/megashoesmx') where id='a58e8d61-06f6-4cae-bde8-27a3f05ec79e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ratteciclismo'), facebook=coalesce(facebook,'https://facebook.com/ratteciclismo') where id='b74b290e-cd9d-45a9-b661-3a7336d917cd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sombrereria_regia') where id='8cbd2cf4-b15f-4093-8254-999ee5c245d5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/casavictoriajyr'), facebook=coalesce(facebook,'https://facebook.com/joyeriayrelojeriacasavictoria') where id='71521b01-1a41-4b7d-9c08-5f52f6891918';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tuleblancbridalboutique'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='44b42f78-e0c0-47b3-b62b-2401fa539073';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cuadralifestyle'), facebook=coalesce(facebook,'https://facebook.com/CuadraOficial') where id='2672fe3a-df6e-46e5-b9f2-518bd594a184';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/panamoficial'), facebook=coalesce(facebook,'https://facebook.com/PanamOficial') where id='6b9c1c6b-5c5b-46fd-9807-10629680f0ab';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/carnivallenceria') where id='381f65ba-6c25-4f6d-bd9d-75312e770792';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='c600fa57-59cb-4a0f-b717-8482a6bd9511';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/juguel.of'), facebook=coalesce(facebook,'https://facebook.com/Juguel.Of') where id='705a7235-ee7e-4a16-9864-dfdc19f160e8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/TUMBIKOMX'), facebook=coalesce(facebook,'https://facebook.com/tumbikomx') where id='e2ab0ea5-c148-488c-8ce7-95babbf8b9f1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/verdeverdadmx'), facebook=coalesce(facebook,'https://facebook.com/verdeverdadmx') where id='a1e3f191-361a-4a51-a6b4-dbd19dd8f2f0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/optimolina.mx'), facebook=coalesce(facebook,'https://facebook.com/Optimolina') where id='995e2903-23d6-4264-81ef-529c2676b90b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/moduss_shoes'), facebook=coalesce(facebook,'https://facebook.com/SafetyOffshore') where id='781323a6-7a1b-4a2b-85b2-f39346a6f2ed';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/gallantdaleoficial'), facebook=coalesce(facebook,'https://facebook.com/gallantdale') where id='5af3a939-a1e9-4991-ad50-f787c5d43c46';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/lamagiadegranell') where id='77e63099-36f3-4000-872d-73df6a3f4ffd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/silverexposurejewelry'), facebook=coalesce(facebook,'https://facebook.com/l.php') where id='8ce0b732-6bcc-4f46-86b6-085c3edec111';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/LaNuevaEspanaTap') where id='307a5c7d-b1dd-4a19-b523-3b7efd0088f0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dpstreet'), facebook=coalesce(facebook,'https://facebook.com/dpstreetmx') where id='bf990d47-626d-4211-85ac-d2d9adb3971a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rod_accesorios'), facebook=coalesce(facebook,'https://facebook.com/Rodaccesorios') where id='51ec71e4-64df-45cb-b114-09f19087eeca';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='6093a38e-9072-4cea-b845-4c9a08318194';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/luzoopticas'), facebook=coalesce(facebook,'https://facebook.com/luzoopticas') where id='70720b30-055f-41f1-8424-f568053051ce';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/laherraduradeorotj'), facebook=coalesce(facebook,'https://facebook.com/laherraduradeoro') where id='4b76ee5a-f684-4981-9270-ca7d8985fd31';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/gallantdaleoficial'), facebook=coalesce(facebook,'https://facebook.com/gallantdale') where id='2e7c7dff-fccb-4dfa-9d22-ddb8e869e008';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/telasylonasvaldesmx'), facebook=coalesce(facebook,'https://facebook.com/telasylonasvaldesmx') where id='98a0543a-97ea-43af-a976-3503f99ba60c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/safemarket'), facebook=coalesce(facebook,'https://facebook.com/safemarketmx') where id='468c4a3c-357d-414b-a50d-b7d4c069824b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/guayaberasycamisasmare'), facebook=coalesce(facebook,'https://facebook.com/guayaberasycamisasmare') where id='e6fddaf6-829c-4a19-b40b-a4718057d309';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ag925.mx'), facebook=coalesce(facebook,'https://facebook.com/ag925.mx') where id='82430ccb-3620-48c4-8f96-183603db319a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/Desigual'), facebook=coalesce(facebook,'https://facebook.com/Desigual') where id='337de5fd-27fb-49dc-9192-cb8dcb5053d1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/formatex.mx'), facebook=coalesce(facebook,'https://facebook.com/formatex.telas') where id='7408d4f6-9379-41eb-a502-3d68158e636b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/leonuniformes'), facebook=coalesce(facebook,'https://facebook.com/1515810465148990') where id='f13bb6e2-c656-43bb-bdba-b399371bbf68';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tanyreuniformesoficial'), facebook=coalesce(facebook,'https://facebook.com/TanyreUniformesOficial') where id='a97bdf25-9f5c-40bf-978f-0c994f77d7c3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/colettajoyeria'), facebook=coalesce(facebook,'https://facebook.com/colettajoyeria') where id='082144e9-40f2-4a1b-9f13-75a08fe6569d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/oficialbotasestablo'), facebook=coalesce(facebook,'https://facebook.com/OficialBotasEstablo') where id='11b16e9a-c28f-48bb-94ba-fab2dd6721f4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='7c8235de-6a1a-498f-bdd5-0bd29681eef1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/la_gran_bodega_del_bebe'), facebook=coalesce(facebook,'https://facebook.com/La.Gran.Bodega.del.Bebe') where id='c03c432c-626a-4d7c-b968-1db28a7bdc96';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/santory_moda'), facebook=coalesce(facebook,'https://facebook.com/santorymodaoficial') where id='181ea0bb-d558-4962-b04c-4dc1e96cfb64';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/boss'), facebook=coalesce(facebook,'https://facebook.com/hugo') where id='add0e133-ece7-492b-8970-3db41083f58a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/buffaloexchange'), facebook=coalesce(facebook,'https://facebook.com/buffaloexchange') where id='c8985e06-804b-4a4b-b853-bd505a66445c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lilianarealmx'), facebook=coalesce(facebook,'https://facebook.com/lilianarealmx') where id='57909852-9593-41d5-ac54-527aa7c54123';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/textiles_del_futuro'), facebook=coalesce(facebook,'https://facebook.com/textilesdelfuturo') where id='1b08c9fe-7941-4899-83c7-43cc7acc128b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/fortunehandsofficial'), facebook=coalesce(facebook,'https://facebook.com/fortunehandsbrand') where id='d0a09896-e536-4922-8a97-64789068a8f0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tricotmania_yarns'), facebook=coalesce(facebook,'https://facebook.com/tricotmaniayarns') where id='d651d3ab-b0d9-4c90-ba9d-f1231f3a6d34';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='e4c65a28-a0d8-4f16-b894-21d229d901ef';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/uaem.mx') where id='b0ae85ab-7bfc-4250-afa8-f97f398a4844';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/roblesjoyas'), facebook=coalesce(facebook,'https://facebook.com/joyasroblesgdl') where id='01f77c82-7349-488b-a69a-2a2e2dedc90a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/boroni_mx') where id='67886d4b-fb1b-4e0c-90f5-9ac1b5090a2a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/clubsaraperos'), facebook=coalesce(facebook,'https://facebook.com/ClubSaraperos') where id='291be497-1566-4067-9f86-9b155f744a4c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='a33a66ff-3e88-49b0-a3e3-3849906e696a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hospitaldelentesmichoacan'), facebook=coalesce(facebook,'https://facebook.com/wix') where id='fb736788-7c68-42a9-8b80-a766e7eec3bf';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/malandramexico'), facebook=coalesce(facebook,'https://facebook.com/malandrajewelry') where id='2e082dd1-9aa6-41d0-81c6-b5744c2894ad';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/leco_boutique'), facebook=coalesce(facebook,'https://facebook.com/lecoboutique') where id='4eb391f1-bdd5-4f1e-ac79-0ee1fb0cf2af';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/IlusionMexico') where id='d4b6a059-8063-4d94-bc76-a37357c3d116';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='549f1a1a-0d76-4cae-90f3-ebe9255b2dc8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='19f65421-b22e-4585-bfce-63af0b7972f1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/providenciacobertores'), facebook=coalesce(facebook,'https://facebook.com/ProvidenciaCobertores') where id='8f0dd380-34f3-44b2-b452-81357b5901ec';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/downtown_casa_raul'), facebook=coalesce(facebook,'https://facebook.com/casarauldowntown') where id='302065fd-add6-4044-9bdd-3e66f2f07731';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/sharer.php') where id='6594d2fe-9ce2-44b9-b4a5-f12d8dac2ef2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/preyshop'), facebook=coalesce(facebook,'https://facebook.com/PREY-SHOP-145726985504177') where id='29cf4ec3-71ca-4f3a-87d7-43b2b806f723';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/highstreetmx'), facebook=coalesce(facebook,'https://facebook.com/highstreetmex') where id='c11562ee-7c09-49d7-a2d4-cfb672745da1';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/uniformesguadalajaramx') where id='c3384fc2-41f5-4935-91dd-8181de43ddb2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/aygueymx'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='3db51668-5354-49e3-83e9-805342808df9';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/clinikuniformes'), facebook=coalesce(facebook,'https://facebook.com/uniformesclinik') where id='79a25b7c-abbb-404d-a484-19892e5369a5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/paruno.oficial'), facebook=coalesce(facebook,'https://facebook.com/ParunoSC') where id='91e26e76-b5a4-4eee-ba8c-286084bd2e71';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/quiksilver'), facebook=coalesce(facebook,'https://facebook.com/quiksilver') where id='8998cb3c-f3f6-4758-8747-86554b416cee';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dpstreet'), facebook=coalesce(facebook,'https://facebook.com/dpstreetmx') where id='e0a62647-1ae7-44b4-b5fa-932481d8176c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lizzethmartinezbridal'), facebook=coalesce(facebook,'https://facebook.com/Lizzeth-Martinez-Bridal-109605657617337') where id='b437279c-5266-43e4-bf21-edee9ebcdb66';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lafestadisfraces'), facebook=coalesce(facebook,'https://facebook.com/lafestadisfraces') where id='401bceb1-d30e-427c-8bd8-3573ddb64261';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/botaschicho') where id='2ef21276-9900-4cf6-a45c-7648a3d01755';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dormireal'), facebook=coalesce(facebook,'https://facebook.com/DRDormireal') where id='0160dc85-d766-43b8-ad9e-201b1e1878d7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lobmoda'), facebook=coalesce(facebook,'https://facebook.com/lob.com.mx') where id='f6b34fb9-4c21-426a-adf2-1925c25168fc';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='90a1ab10-a054-4253-8b00-225854b2210f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/origenespuebla'), facebook=coalesce(facebook,'https://facebook.com/origenes.puebla') where id='1471b25e-5cea-4446-be1e-716789d6680b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/PLARTESLP'), facebook=coalesce(facebook,'https://facebook.com/plartejoyeria') where id='40a001ee-e4af-4d10-9388-093f74cb6519';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='993baf1e-4df6-48dc-9d82-a7d82d1e2537';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rentadisfraces'), facebook=coalesce(facebook,'https://facebook.com/rentadedisfraces') where id='fdcc1205-5fb8-42f3-bf2a-d9e50bd0f790';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='a784b284-b6f7-48e6-a967-e792f4ead24c';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/UniformesUnicoBoca') where id='2fa4585b-37bb-4833-85e0-c3e6aef7c545';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticalia_okulux'), facebook=coalesce(facebook,'https://facebook.com/OKuluX') where id='14de0dac-640a-4be7-9d96-9e0bef574901';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/clinikuniformes'), facebook=coalesce(facebook,'https://facebook.com/uniformesclinik') where id='b28e54ad-28ef-4b9e-99ba-230594d63612';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/blueorangemx'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='a187cc47-976c-4361-8b90-cd7f410b90aa';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='11770209-ffb2-46ef-bcb7-06ab45ad290e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/uniformesdanmar') where id='ec213370-85ca-4f12-8f53-80316682c759';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='57c38af8-f387-460f-b3ba-99061326c95a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/centrojoyerozocalo'), facebook=coalesce(facebook,'https://facebook.com/CentroJoyeroZocalo') where id='5f231744-ec70-47d2-9fe7-85b3b7d05c43';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/disfracespesadilla'), facebook=coalesce(facebook,'https://facebook.com/disfracesmexico') where id='83a26ef9-1c50-497b-a0eb-07c0df70b3f0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lizakoekkoekgems'), facebook=coalesce(facebook,'https://facebook.com/lizakoekkoek.jewellery') where id='0b88264f-38db-4be3-939f-efff7c3480f3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elborcegui'), facebook=coalesce(facebook,'https://facebook.com/borceguimx') where id='277e0190-bdca-4794-843f-3233861d3c61';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='64be3d77-cfa4-43ea-bb72-8450d14f1f10';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/joyeriadiaro'), facebook=coalesce(facebook,'https://facebook.com/JFDiaro') where id='fcf9d4e7-5c59-4eed-a283-77ed73925da7';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='512f698d-6bbb-47ff-838c-d655f87b9ea2';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Gastrotourmx') where id='360941f8-7b03-4630-bf8b-e94256578277';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/fullsand'), facebook=coalesce(facebook,'https://facebook.com/people') where id='26d3afbc-438f-4ef3-ac7a-8de73973fdcb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tigretienda'), facebook=coalesce(facebook,'https://facebook.com/TigreTiendaOficial') where id='02be3e30-0717-45e9-8b9d-1fd5bcff618f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/worldcardstoys'), facebook=coalesce(facebook,'https://facebook.com/World-Cards-Toys-Costumes-Collectibles-1') where id='33eb82c4-4821-40da-a513-c2eead21d26e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/maxicapsqro'), facebook=coalesce(facebook,'https://facebook.com/EurocottonQueretarouno') where id='a30eb6aa-7d90-4e15-8621-5cef9772244f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='2a1b6a82-352c-40b5-94c8-d0aabc7f8b77';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/talabarterialaherradura'), facebook=coalesce(facebook,'https://facebook.com/talabarterialaherraduramexico') where id='60b514ad-01f0-4b5e-985c-80cecc568df0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/joyeria_y_hechuras_rivera_cdmx'), facebook=coalesce(facebook,'https://facebook.com/joyeriarivera30') where id='053a5d84-8cf5-45ba-82ee-d369e457a0ae';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/calzadoandy_mx'), facebook=coalesce(facebook,'https://facebook.com/calzadoandymx') where id='11793b09-b481-41f9-88ab-a41f8d171027';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cwesternwear'), facebook=coalesce(facebook,'https://facebook.com/ElCentenarioWesternWear') where id='6a8becac-b478-40b8-bb52-ccbc195ed381';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='196a4d48-c9ca-4c20-ab81-00268a446b45';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/pisosmaco'), facebook=coalesce(facebook,'https://facebook.com/GM.Maco') where id='ba4b531c-435e-4f72-a1bd-b682c1396a38';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/oldwestmx'), facebook=coalesce(facebook,'https://facebook.com/oldwestmexico') where id='7ac6dfd1-73ec-4d7c-94ae-08b8fc5d152d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ivonnefashion'), facebook=coalesce(facebook,'https://facebook.com/IVONNEmx') where id='e1cb6a65-1b0a-4c55-b95c-ca3fabe1aa80';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/casasofiabodas'), facebook=coalesce(facebook,'https://facebook.com/Casasofiabodas') where id='6296cbb6-c5a1-4239-b3f8-77886e74dc2a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/duquedigalliano'), facebook=coalesce(facebook,'https://facebook.com/DuquediGalliano') where id='65735319-2886-469e-aa15-8b3bcc3bf323';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/guts_mx_store'), facebook=coalesce(facebook,'https://facebook.com/GutsMexico') where id='7a917b87-2076-44f8-bc4c-65ae36cb1ce3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cklassoficial'), facebook=coalesce(facebook,'https://facebook.com/cklassoficial') where id='108013e7-882f-43c7-bad9-e1819ce3a6b4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/diabetesyzapatos'), facebook=coalesce(facebook,'https://facebook.com/zapatodiabetico.mx') where id='6828bf67-fb34-437e-b313-0f4b2e84d523';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tanyreuniformesoficial'), facebook=coalesce(facebook,'https://facebook.com/TanyreUniformesOficial') where id='3c31b2dd-3862-4bc0-9b20-2b41e64dfa1d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/clinikuniformes'), facebook=coalesce(facebook,'https://facebook.com/uniformesclinik') where id='414e188f-cfe0-44db-a7e9-c8f0b27177e7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/disfracesmiguelito'), facebook=coalesce(facebook,'https://facebook.com/disfracesMiguelito') where id='8f5bf0ea-740e-4a7d-bd63-5e97b4eccfef';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lamarinatienda'), facebook=coalesce(facebook,'https://facebook.com/lamarinatienda') where id='1c0ad49a-2b27-4d01-b416-b9bbf706237e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/befashionstore.mx'), facebook=coalesce(facebook,'https://facebook.com/befashionstore.mx') where id='a3e9f1e0-9cad-42bf-81e6-014e6b574dd6';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='8cd3f4db-6d94-48bf-992f-6d3315f59ee0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ancora_themes'), facebook=coalesce(facebook,'https://facebook.com/AncoraThemes') where id='682ec899-95c2-499f-bf79-8f43eba6c3bf';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='5176ed8b-9c2e-4da7-93c8-66c4ede3ef54';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/quiksilver'), facebook=coalesce(facebook,'https://facebook.com/quiksilver') where id='8da1439d-0a89-48cd-bb90-8d04e3a15e2a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/playerasmark'), facebook=coalesce(facebook,'https://facebook.com/PlayerasMark') where id='528ea393-8fe0-4c89-84c3-54d2f4acd73e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/fighterden'), facebook=coalesce(facebook,'https://facebook.com/Fighterden') where id='17da89ff-b679-44b2-811a-81160e917c19';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/t_lobordo'), facebook=coalesce(facebook,'https://facebook.com/tlobordoMty') where id='0b8809b6-c63b-430f-9972-e87d8d741de7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/adabellanovias'), facebook=coalesce(facebook,'https://facebook.com/AdabellaNoviasyPrincesas') where id='b1be4165-ee7c-4ba9-9ba4-7827f7e909b1';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/montijouniformes') where id='6672d36b-ae43-4337-ae14-d254ad45f6d4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='ec6120b9-af0f-4186-b5ef-ac47c70b714a';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='820ff432-754c-4386-ae9b-e5bde20b3ec1';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Llopticas') where id='1d94e3bf-684e-4a6f-8f73-14829935b0e3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lazzarmexico'), facebook=coalesce(facebook,'https://facebook.com/LazzarMexicoUniformes') where id='2dec9dfe-4215-4970-a6d6-09487cb68141';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bimbaylola'), facebook=coalesce(facebook,'https://facebook.com/BimbayLolaOfficial') where id='92069039-923f-453b-9172-9b9d018123e9';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='e7eb22c2-0326-41d3-83ba-662d11f442e6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tanyre.noreste'), facebook=coalesce(facebook,'https://facebook.com/Uniformes.Tanyre.Noreste') where id='00e7f440-0271-44ca-8225-39491feed712';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='93c75ec6-1994-405e-a81b-e534aa74ddf5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='996be82a-4308-4554-864f-bb34e318a16d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/DWESTERN20') where id='46493f4f-34cf-46a3-a6d0-6a66f0cd21a5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/chicas.chein'), facebook=coalesce(facebook,'https://facebook.com/Shein-by-Chicas-Chein-108622181787883') where id='6558e2fb-2e22-432f-8b2c-aaf293c39cbc';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='a520db1e-2b84-4e8b-807e-fc03f900d410';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rodeocityoficial'), facebook=coalesce(facebook,'https://facebook.com/RodeoCityoficial') where id='69e7a5c9-16eb-48ad-b31d-eac3e0b458bc';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/undoskinoficial'), facebook=coalesce(facebook,'https://facebook.com/undoskinoficial') where id='65d28f13-2b7f-4e6b-9391-f83bd26b627e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='f480e37f-aa81-42a8-954e-076310bd730f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='375457cc-29c1-426d-a743-f27e0af20b37';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ilusiononline'), facebook=coalesce(facebook,'https://facebook.com/IlusionMexico') where id='14446fe4-fff0-472c-8c60-531f4ba39ed2';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='de156b7b-d698-472a-a6e9-7bd696a376b5';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='5c89cadd-cfbf-4bfc-9150-7b5903794bad';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/mireloficial_'), facebook=coalesce(facebook,'https://facebook.com/MirelOficial') where id='d54fa8c8-2a30-42ce-9d7d-60aaa6da102d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='30819af1-1fa5-49ea-b2bd-fabd35650371';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/DanielseHijos') where id='50ec116e-50fb-45df-b338-e12048df8194';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cubreasientosvallarta'), facebook=coalesce(facebook,'https://facebook.com/cubreasientosvallarta') where id='e4e343d4-9312-482a-8c23-b8f347d9b2ce';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ferragamo'), facebook=coalesce(facebook,'https://facebook.com/FERRAGAMO') where id='ddd8dee5-80a8-4882-b7f5-a7f032f9e42e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eurocotton'), facebook=coalesce(facebook,'https://facebook.com/EuroCottonOficial') where id='795cbf2d-8d5c-47aa-aba5-0e9a55215c3b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/corporacion_montblan'), facebook=coalesce(facebook,'https://facebook.com/corporacionmontblan') where id='8fcb5127-b9ec-4d82-a486-0d6331f87a5b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hefestosmoda'), facebook=coalesce(facebook,'https://facebook.com/HefestosModa') where id='74bce925-ec2d-415b-932c-e91c8c09dafd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/centrosdebordado'), facebook=coalesce(facebook,'https://facebook.com/bordados.encelaya') where id='4e826f6a-df5d-4688-8315-31a4a2cd0a8c';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='d24688d4-455b-4b92-9819-8704f29f639f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/maisonmetales') where id='870fe4ef-10e8-491e-8219-68de23f676d7';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='d67bdb10-b3fb-4b22-849c-0dda11ee6f12';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/2008') where id='6e64270e-f1d6-4d94-aa59-764367df0ff8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bebemartmex'), facebook=coalesce(facebook,'https://facebook.com/bebemartmexico') where id='7b16b4ec-1fa3-4fed-9e0d-b3c312ec1dd0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dpstreet'), facebook=coalesce(facebook,'https://facebook.com/dpstreetmx') where id='3b0b6633-d761-4008-a8e5-84a319a65c60';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rentadevestidosunique'), facebook=coalesce(facebook,'https://facebook.com/uniqueqro') where id='6c161422-92e1-4415-b82e-0c5e8d000019';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Centronovias-1594891627416281') where id='3abf7b81-808c-419a-924b-4d9bf0fc935e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/casavictoriajyr'), facebook=coalesce(facebook,'https://facebook.com/joyeriayrelojeriacasavictoria') where id='5e4ee835-651d-4469-b5d2-5d80de8b2da7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='f01ffe1a-227e-439a-903a-0301a2d84bac';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unimagdaoficial'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='11219b5e-fad7-4616-aec7-5409669632ad';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/camisetasimpresasmonterrey') where id='35784eb2-1838-476f-ab89-1ea4a3f6029c';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='823c8ceb-f470-4c46-999b-8f472e2dfbcf';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/pirouette.tiendadedanza'), facebook=coalesce(facebook,'https://facebook.com/pirouette.tiendadedanza') where id='3d026714-ebe2-4b8e-82af-34c7a5a2ae63';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lineasmx'), facebook=coalesce(facebook,'https://facebook.com/LineasMx') where id='a503573c-b7bc-4ce6-94b0-b6d5addc82b0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/providenciacobertores'), facebook=coalesce(facebook,'https://facebook.com/ProvidenciaCobertores') where id='934bd69d-612b-41a1-aab4-2d728daf6aae';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/MercadoLibre') where id='8018a1e5-fd61-44ea-a667-d2e05d6c0d27';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='3c325bd7-430c-4dbd-a066-74b4b63e941c';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='624e1e1e-8bf1-4f8a-8630-76834bd116a3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zamabytt'), facebook=coalesce(facebook,'https://facebook.com/ZAMABRANDMX') where id='139d1997-a2b7-406c-ae0e-437500c1c970';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/deportes_cancun') where id='499ab6fa-7451-4ec4-b499-7852934f53a8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='f14264d2-150b-4952-afc6-fd948eb271bb';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='0c3ebd58-5cc1-421f-b845-cb8118da328d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lozmer_joyeros'), facebook=coalesce(facebook,'https://facebook.com/LozmerJoyeria') where id='1773fb70-d81e-4ee0-af76-ae6aa60fcbd0';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='c0c99354-0cef-4ea2-975c-4a12cd503c0e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='5c68cf89-366b-4d87-8a3b-bb568a5008d3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/miradisfraces'), facebook=coalesce(facebook,'https://facebook.com/mira.disfraces') where id='8c2b4f19-2ff0-49b2-9075-6cc8ed3685d8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tiendasmaximaoficial'), facebook=coalesce(facebook,'https://facebook.com/tiendasmaximaoficial') where id='d93a629c-6b6d-407c-b2c8-22a5de084cf1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/depielyalgomas'), facebook=coalesce(facebook,'https://facebook.com/depielyalgoma') where id='e17a1506-35a2-4561-b1f1-955138d9a6b5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/emporiosportmx'), facebook=coalesce(facebook,'https://facebook.com/EmporioSportMX') where id='e80b0246-d184-413e-94cd-37d6221f9347';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/nycteria.mx') where id='96fb371a-69a3-4dd2-80a5-bfdde076efa4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/siniestra_boutique_alternativa'), facebook=coalesce(facebook,'https://facebook.com/siniestraboutiquealternativa') where id='a3d7e60c-3383-490a-950a-b44d8eb08843';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='0ce6cbfc-dd81-479c-b6ca-eda330b10195';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lazzarmexico'), facebook=coalesce(facebook,'https://facebook.com/LazzarMexicoUniformes') where id='f9c6a3fc-04e5-40aa-83fa-da39d8e83c05';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='bed6dfcf-0537-4e89-81e7-f7f944c9130e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/vikthejeweler') where id='8e1a8e2b-22be-4f79-b39f-3c3397f7d233';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='e54bc822-c1b5-4e13-b197-9960e52df5ea';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/IngrataFortuna') where id='0fa91fdb-a089-4bb2-b958-1f6f9dfbc28d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tinargraf') where id='f3686905-1e68-45f4-a60a-74e42447cfd7';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='bef96823-5b0e-4024-87bc-92ef73bfb8e6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tostadasgallo') where id='4b4f9a69-c507-4af3-95af-52a647784f0b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eurocotton'), facebook=coalesce(facebook,'https://facebook.com/EuroCottonOficial') where id='bd01ca3c-e8e9-433f-9f6b-a8a92726cef3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dpstreet'), facebook=coalesce(facebook,'https://facebook.com/dpstreetmx') where id='4d9c6e77-584f-4333-8daa-8d2b0e6ae2e3';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/CasaTovar1') where id='3339ae65-a4b2-4a48-b7a8-0ec608d47148';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/QRIS108'), facebook=coalesce(facebook,'https://facebook.com/QRIS108') where id='eadd1dd9-1281-4d28-8190-9782c76f2cd3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/protocolonovios'), facebook=coalesce(facebook,'https://facebook.com/protocolonovios') where id='45d514e3-3ef4-44e0-939f-61c453fe6d13';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/truekids.com.mx'), facebook=coalesce(facebook,'https://facebook.com/truekids.com.mx') where id='7081b28e-c76f-4d7e-9f9f-c691196d064e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='24d01e49-c4cd-4710-96df-16dd4f2e18b5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/pasitosdeluz'), facebook=coalesce(facebook,'https://facebook.com/pasitosdeluz2') where id='b617cf7e-70ed-44f3-8755-2e4b76b895aa';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/mondepell') where id='088dd8e8-7a4d-4665-bd59-b3f771f595f1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lazzarmexico'), facebook=coalesce(facebook,'https://facebook.com/LazzarMexicoUniformes') where id='04ee700c-fdd7-4635-8df9-c79d0f905a18';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='089f68bc-5999-471d-ad53-567388502190';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/abastecedora.demercerias.1') where id='d77932de-6c69-4230-8ced-1b1bfa148400';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elybride_official'), facebook=coalesce(facebook,'https://facebook.com/elybridecdmx') where id='3e2039ca-daf4-4d60-8d67-e7630a864978';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='1c718acd-cc10-468c-a8ba-56e16348fe60';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='20920ecb-ce85-4a6d-93c0-60146df43cb1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/fiftyoutlet_official'), facebook=coalesce(facebook,'https://facebook.com/fiftyoutlet_official') where id='6d2d3379-4fe2-40f9-bec2-533cae23fdf8';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='60023c10-758b-47be-9cc6-0beea7f908fc';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/trajesdecharrogarcia'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='3f003ad8-8043-4d2a-bb06-428dd1ad090d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/latallaperfecta'), facebook=coalesce(facebook,'https://facebook.com/LaTallaPerfecta') where id='0ed6dadf-0d06-4f57-9d11-9b1368280431';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/playerasvallarta'), facebook=coalesce(facebook,'https://facebook.com/PlayerasPuertoVallarta') where id='3510f556-5a32-42e4-aaf6-54dea4cda932';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='027a372c-ec99-4fc9-8703-851ed25f9afb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='3ce79cc3-dd6c-40ac-8df5-ec4eca923379';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/vinitexcustomideas'), facebook=coalesce(facebook,'https://facebook.com/vinitexestampados') where id='8dcd8b2a-2492-4362-95a1-e167c0ca0532';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/michaelkors'), facebook=coalesce(facebook,'https://facebook.com/MichaelKors') where id='b8b92702-de63-4f11-8ca5-3ad4452457d0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/kareduniformes'), facebook=coalesce(facebook,'https://facebook.com/Uniformes-Kared-299492940146010') where id='c386b80c-f5cf-468e-a9a5-bf43b018bcb1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/koko_dogz'), facebook=coalesce(facebook,'https://facebook.com/koko1dogz') where id='8645c2a5-8e53-4279-a56d-be67490089ea';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/canaiveyucatan'), facebook=coalesce(facebook,'https://facebook.com/CANAIVEMx') where id='771b0aa3-6b57-4648-8877-863f5578a21a';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='22793f36-e55e-4e7f-b8bf-b828f72f5647';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/BORDADOSUSA') where id='daa991af-2634-4704-ac00-7a43fc11f32e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='6a3abd51-5866-4048-8033-451d9004eab1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/domikuniformes'), facebook=coalesce(facebook,'https://facebook.com/uniformesmedicosdomik') where id='c8677487-5aa1-431a-bedf-31d8809d1bac';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tiscareno.mx'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='d16f7c5d-5048-4d07-98bd-420e575236ec';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/domikuniformes'), facebook=coalesce(facebook,'https://facebook.com/uniformesmedicosdomik') where id='7a6269bc-3bbc-4a2d-99d4-a025f28580f1';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/sharer.php') where id='f569be24-ca59-4452-a774-d75300a3c740';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tecnoserviciosgto'), facebook=coalesce(facebook,'https://facebook.com/TecnoServMatriz') where id='65d7ff4b-257b-4d23-a08b-8833d91668b8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='5acf0e9c-3e53-4201-bcfd-72a062fe6650';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/verabradley'), facebook=coalesce(facebook,'https://facebook.com/Vera-Bradley-379144929202446') where id='f19e9728-e7bd-4207-a6ad-1f50fe5d57f2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unipromomxli'), facebook=coalesce(facebook,'https://facebook.com/UnipromoMxli') where id='9385cdff-2f38-42d6-b53c-3806c140333b';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='ec439798-f5fc-470a-8f4f-eb8891c859b9';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sinteticosromenmx'), facebook=coalesce(facebook,'https://facebook.com/SinteticosRomenMx') where id='8b5c08c7-c664-4150-bd0a-16db011e8b85';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='1a9b9925-6d16-43bc-8fc6-fd27a30f9f44';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='8e81da35-975f-4d8c-8220-98a0926f3bdd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/watchsalasoficial'), facebook=coalesce(facebook,'https://facebook.com/sharer.php') where id='978ee5e3-6fa5-478d-a01b-dd5e3aa96466';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Distribuidora-ROGA-101864621798370') where id='05b32f49-5067-4eda-9a0c-423f952a1786';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/uniformesybordados.sportique'), facebook=coalesce(facebook,'https://facebook.com/sportique.uniformes') where id='67560147-f568-43ff-8476-5b5f3d538cb0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dm_cinturones') where id='1c85a9ab-f14f-4084-ab90-3fd8d095bbaa';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/playerasmark'), facebook=coalesce(facebook,'https://facebook.com/PlayerasMark') where id='c5322663-da1e-455b-b4ef-7fed9c42b1c2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/belisapulido'), facebook=coalesce(facebook,'https://facebook.com/belisapulido') where id='980b321d-bee9-4e9e-a894-2f947eb71202';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='462c3085-4c06-4327-8d8e-c5ed2e782a55';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='037f0d94-c702-424b-b25b-2fa729a7313d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='81e8b9f4-6c1a-4239-af16-ce456b96d5d1';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='2b619bfb-9e91-4726-92e5-dd51442f4d90';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Relojer') where id='0802e5d1-32c3-4a03-bf6d-c031f138c1bd';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='6aa07a5d-957a-4b70-bfcd-f02f0c0800cb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/scaparatoonline'), facebook=coalesce(facebook,'https://facebook.com/Scaparato') where id='129efa40-f59b-46d7-a408-12f66a8b04ad';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='240faaf3-6bcd-4a50-9ada-ac131e3ab461';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='5578228a-babb-4c36-bde0-e45ca91c5e6b';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='4093eb01-1dc4-4c1c-a016-20d191253458';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/disfraces_fantasyland'), facebook=coalesce(facebook,'https://facebook.com/disfracesfantasyland') where id='b4d2ba6f-4e61-43bf-9ae8-5c1bc7954f62';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='4f584f36-3867-4290-9aeb-acb131b86b1b';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/mayorkbajio') where id='3048c1d3-de37-4491-8134-e9515317fffc';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/carmenrion'), facebook=coalesce(facebook,'https://facebook.com/CarmenRionModa') where id='e1c1aba0-a28f-4cf0-91b9-e782870aac54';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/troppomoda'), facebook=coalesce(facebook,'https://facebook.com/help') where id='3f74952f-3e92-4192-8b87-e44a7221c62f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='0394bd62-7212-4726-902f-7213d6d0e863';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='442b6b7c-a80b-41c9-bdb9-370d4b6ac13e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/paruno.oficial'), facebook=coalesce(facebook,'https://facebook.com/ParunoSC') where id='ba0f5413-e9a8-465a-8eb1-28a0fdfc2f24';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sublimacionmonterreysadecv'), facebook=coalesce(facebook,'https://facebook.com/SublimacionMonterreySAdeCV') where id='9e6fe363-c417-45f2-a631-cf3ee31a2a0d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='dcc19f80-dac5-4651-95e2-d70dafbd65c5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/pompa_street_'), facebook=coalesce(facebook,'https://facebook.com/PompaStreet') where id='14382fea-02b3-4950-8c92-ed7eded9ec46';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/regencymx'), facebook=coalesce(facebook,'https://facebook.com/RegencyMx') where id='2a5feb11-978b-4667-adf3-ebcbfeac3fd8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='53909f50-5583-4acc-869d-ef9be8449b4b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sublimpromocionales'), facebook=coalesce(facebook,'https://facebook.com/sublimpromocionales') where id='4430543b-78c0-480e-94a5-25eef53299e2';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='d238f2fd-b288-493b-969e-291f0f71edea';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/instagramforreplacement') where id='b6f2075c-a357-48b3-90af-293f39d70493';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/TiendasRodriguez') where id='a512e112-e632-40f2-beaa-267e258d25f9';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/babycreysi'), facebook=coalesce(facebook,'https://facebook.com/babycreysi') where id='6c91870d-2f65-4312-8d53-8f2c823579a1';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='2aae734f-c57e-4b0c-8ff2-f19dbd2b6981';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rodeocityoficial'), facebook=coalesce(facebook,'https://facebook.com/RodeoCityoficial') where id='f0fd1035-579c-43ac-8560-9b62534cfc3d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='c318b347-54a9-4e02-8f44-edf518cbd1a3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elcharro_de_elpaso'), facebook=coalesce(facebook,'https://facebook.com/Folkloricoshoes') where id='dbcceb96-dea8-461f-b65c-e7ba89ceb603';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/galandserigrafia'), facebook=coalesce(facebook,'https://facebook.com/GalandSerigrafia') where id='51351386-4d11-45a3-a398-537c621d3530';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/2008') where id='aabc44a2-12de-4317-a151-dba49ef8bc70';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/shhdpandora'), facebook=coalesce(facebook,'https://facebook.com/Secreto-de-Pandora-1564094527237616') where id='5500c478-5804-4f13-81fa-4cd088f3a5ff';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/TenisMorganoficial') where id='6441a038-69cd-49a4-b134-c2bebfffde76';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/people') where id='e75d1221-7ce4-4e13-9f34-2d066d5af770';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/POPOTOGEL'), facebook=coalesce(facebook,'https://facebook.com/POPOTOGEL') where id='9d00f0a5-6d62-4178-b769-4b08be28eb5c';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/WixEspanol') where id='41862f3e-2066-4d59-8fde-00ddaafbc512';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/people') where id='9b412fe9-0a2c-40d6-b89a-25a667b71fe2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/buyee_jp'), facebook=coalesce(facebook,'https://facebook.com/buyee.jp.en') where id='fba8bc3c-8179-4e36-b231-af5cc0a7cbfb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bzrdegato'), facebook=coalesce(facebook,'https://facebook.com/manitade.gato.758') where id='c2c13bef-0286-44b8-97fa-1deb0c7f2718';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='97626b94-3fa0-4052-9829-869c36713917';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='84576c16-938c-493d-b655-2e3e0eabc26b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/estacionopticamx'), facebook=coalesce(facebook,'https://facebook.com/estacionopticamx') where id='c0c99d46-8bd8-4f5b-80b0-9a77d3d91584';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='9a994beb-0d14-47b5-821c-7e3b9120fd1d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='74e44601-7110-4fe5-9608-2a81305f4c50';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='ec471b0d-bbf3-4bfc-9155-f89caabde2fb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='0265bb3c-7972-4397-8be7-5b510c6f250f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='97bbd30a-994b-460a-af08-0becc8779a84';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='5129afb4-e431-4298-a772-401372f2ce29';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='f8d60b49-d3ba-4218-bfe8-079a91373496';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='6feda196-23e1-4838-9434-3799494a9aa5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rollinhardmx'), facebook=coalesce(facebook,'https://facebook.com/288130131310288') where id='ac175da8-f296-4374-843b-3f1940279ede';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='2eb02b02-089b-4cee-91ab-be24d6beacae';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='875e291c-ba4f-474d-8efa-19978d351199';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Moda-Real-101797883654314') where id='d60ebcaa-442d-4a0b-97a6-d053ea9a573e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eva_brazzi'), facebook=coalesce(facebook,'https://facebook.com/EvaBrazziMx') where id='ee1868ea-126c-4205-b970-76c4d9bb15fd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/benandfrank.mx'), facebook=coalesce(facebook,'https://facebook.com/benandfrank.mx') where id='471061fa-dee3-4256-9095-2dfef171ec9b';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='d82a8e44-51fa-4da5-8536-58fe2c513de3';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/2008') where id='b7ea6113-a228-4275-b17d-364a2727354f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='ae7ca525-4846-4160-b5f8-4a2cfeae22bb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='8119bee3-43f6-42b2-98dc-ecd85f6a9870';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='f2bc5768-b221-45d8-a185-c928372e3bb8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/stractto'), facebook=coalesce(facebook,'https://facebook.com/stracto') where id='86727926-ef0e-49f9-b94a-3fd2e0a58871';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='09b30329-ad8a-4ed7-b6b2-0f39012aa08f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/opticaheraoficial') where id='67da96fa-12e5-4d9d-97ca-13aa3aa414a7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/snowgold1993'), facebook=coalesce(facebook,'https://facebook.com/snowgold1993') where id='aff49070-9fb1-4603-a8e5-9789ba1f35f5';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='1ffe182b-4b8a-4800-9a34-b29ae489ed15';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/outletdeplayerasmexico') where id='eac11301-cd8b-4f91-8e5e-08406d1637d0';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='8a1316fc-97e3-4b08-94bd-c743efb9c525';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rapsodiaoficial'), facebook=coalesce(facebook,'https://facebook.com/rapsodia.com.ar') where id='487a746f-fdff-4396-9c9a-db56105d4f1d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='65ed9f95-7003-455e-8430-2c50ea06a8fe';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='58731208-98e3-4cd9-830a-9b56bcdbec6f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='9b54f227-b705-41cc-925a-686218d0194f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='cb875483-b4dc-4c96-959a-6facd9893d3d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='3d66f763-98e3-492a-a767-ee27f1cdd1a5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/el.retonito'), facebook=coalesce(facebook,'https://facebook.com/ElRetonitoTackApparel') where id='15221201-a3d1-43ce-80cd-09fb88408cf6';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='52f95503-7bec-4070-a6ac-792e94d066ac';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='55018639-b57e-46ab-b956-2192774d1f31';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lamariapuebla'), facebook=coalesce(facebook,'https://facebook.com/fabricamariapuebla') where id='9862b719-b249-4ba0-8d54-b1afc60b42bc';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='43c03277-b3cd-405c-8aec-28e4d1118e38';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/kauffmanopticas'), facebook=coalesce(facebook,'https://facebook.com/KauffmanOpticas') where id='f321ae2d-d32a-4136-a286-3c410411da6e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='6a92e193-c05e-48dd-9341-5ef5defe20a7';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='b1e6078f-94cd-46b5-b57f-be35b9881d0d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='643e9446-ab7b-47e7-af3f-56bd565aba00';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='9ed24fe9-589e-4128-b9db-27022b688635';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/cisnebordados'), facebook=coalesce(facebook,'https://facebook.com/cisnebordadosoaxaca') where id='dfbe5c09-f82c-492d-88ce-a5dd065e8e87';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='ab3079ac-ed17-48df-b697-3f1f1ef40c8b';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/outletdeplayerasmexico') where id='96735d8a-0393-4d8c-9caf-97ce9e9c5189';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='9faae6b5-67d0-48ef-a28c-49ad5aa195e2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='52c3688d-7f59-4696-99fc-a0fccb81e60b';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='5154dae8-0537-44c8-ad47-c1abccea4bb7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dpstreet'), facebook=coalesce(facebook,'https://facebook.com/dpstreetmx') where id='f86c058a-8efc-4b55-bd03-b89c0ffee58d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='f8af2309-e127-4e8f-92e7-72f451693b9f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='82f68469-bd6f-4c2f-9c2d-3f3782baa59f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='9529b800-e536-49c8-9785-e659effedfc6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/uniformespotenza.viye') where id='614e905c-7e9c-4401-a2db-2c476d125442';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/maxicapsqro'), facebook=coalesce(facebook,'https://facebook.com/EurocottonQueretarouno') where id='8669ffd3-ac15-40fc-80a2-ca8ec3b61c63';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/promoscreativos'), facebook=coalesce(facebook,'https://facebook.com/promoscreativos') where id='431e2b5e-fbba-41e9-bce9-4f78eb10c6ed';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='0c1be14e-b003-4425-87fe-b9c3595472fb';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='bc7d4a20-eec4-4972-9098-2f8e17240bf7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/melonlimon'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='7976dc15-c796-4c60-bdd5-cd268af69135';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='71b91f8b-cf3a-4217-aaa6-753685d57d48';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='439e9f94-2676-4276-b631-6bcd78064fd0';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='bfb680fc-1f2f-4764-a067-f51e07def3e6';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/designersmty') where id='5e82f579-ee98-468b-8359-490fab7ee05e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/casbec.1'), facebook=coalesce(facebook,'https://facebook.com/casbec.com.mx') where id='8fcea235-9933-4ec9-a57e-e5b727896bea';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='c1939f3e-0e51-4c3d-a9c4-319cc709afba';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/doris_boutique'), facebook=coalesce(facebook,'https://facebook.com/dorisboutiqueonline') where id='63b61188-db0b-4337-a403-d124530f48bf';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bonavimx'), facebook=coalesce(facebook,'https://facebook.com/Bonavimx') where id='6adbdd4a-9ac7-41a1-abeb-497a7adbef6e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='6051d394-5207-4b74-aa51-c45b09313bd2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/whatsapp'), facebook=coalesce(facebook,'https://facebook.com/brand') where id='eabec169-50c3-49ab-85b0-5beaf1737f94';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='84ba4810-14b3-455f-9304-44d50744421c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dpstreet'), facebook=coalesce(facebook,'https://facebook.com/dpstreetmx') where id='3927dbe6-28ea-40f9-a6d4-a89d1261598d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/milenaaldanacolombia'), facebook=coalesce(facebook,'https://facebook.com/Jeanscolombianosmilenaaldana') where id='4c8e35fa-1cae-421d-98d4-cd79b337d824';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='0a12c499-1b47-42af-b23e-d912bc28ee24';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/CALPACHUCA') where id='911ceb05-3c99-4f0a-abd7-5f77f666e695';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sporticomx'), facebook=coalesce(facebook,'https://facebook.com/sporticomx') where id='84d864c5-cb1b-4e97-a26a-4471f6faa3cf';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='46b71fb5-d8df-4a83-afcc-0b040f941f97';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='855622a1-9056-49de-8661-a531f5e8ab0f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='c0107256-692d-4f6b-9eff-bc2f95df0554';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/scappino'), facebook=coalesce(facebook,'https://facebook.com/scappino') where id='68d10e68-ef1b-48e6-8001-7ccc603cda00';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/boss'), facebook=coalesce(facebook,'https://facebook.com/hugo') where id='9ec175bf-b008-4d2a-b0e3-ab665a25c86a';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='d573f40a-2505-48df-859a-65d5c0cff06e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/uniformes.streetsilver'), facebook=coalesce(facebook,'https://facebook.com/streetsilverwork') where id='eb17044f-8008-41f1-898a-7d9cc0ab29ab';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/duotiendas'), facebook=coalesce(facebook,'https://facebook.com/duotiendas') where id='1905828a-8f2d-438c-9014-a7a58020dde3';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='b60c3138-1663-4bcf-9d8e-372f75bf6d84';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='45892a28-956a-4d52-ab6f-338199bebdcb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/reto_a_la_esperanza_mexico') where id='939b654c-d66c-4e11-8122-73bf6ccc1922';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='375a7005-8d82-48be-8fe0-88228d4eda9e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='e26f9768-77d2-4b20-a4ad-715cfd600068';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='c44ac2f2-c9dc-4b0c-b501-abd4d31a7a94';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='0de4d0b1-a06c-4927-acbe-75ddc657e475';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='8a178b29-bdb6-42be-8a52-667bc6c7423f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/haifalevy') where id='de10c80e-91de-4a0e-a4aa-babba876e034';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='7bab2f0b-9c09-48a6-a636-30aa497a40a3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='db4bbc85-0b2a-4d1f-82f1-697996d707ee';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='6f30853c-846b-44ff-8871-5da6ade0f379';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='c12aeacf-0e86-4537-b97b-1ed86462ebd4';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='14b9dfc1-5afd-41da-83b8-05f68dafeb8a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='598f48d8-e282-4922-b15b-2d36927761ec';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='baa57306-86ca-40a7-b1f5-e7f23b84ce54';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='12010fac-b49b-42e2-8024-23f224a4ae81';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='d14a63c5-02ec-4100-9f92-dd03051ee2e5';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/juanignacio.veramurcia') where id='594315b5-8f96-42e9-9ad0-5de84aa65364';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='ccf40d7b-42ff-45d6-a679-2abdc9c4fb5c';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='eea63536-bad9-47ba-b99c-1ac6ed7536a4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/furor_products'), facebook=coalesce(facebook,'https://facebook.com/furorproductsmx') where id='7d0ff6bf-8334-4f48-b252-a6c3342acd51';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/vintagechih') where id='e1bf4122-4f17-4aa3-80dd-5cd2e5b62889';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/docs') where id='868bd200-0e45-460c-a2fe-95c6b3662b3e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='375db97b-018d-4214-a118-c5fe9c1b4437';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='15eab3b3-105b-4bfc-a3b7-9d20e8e196e4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='6e241316-9423-4f61-8470-c594061357f1';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='bf2c1e63-5320-4ad8-b84b-395ac9244cf3';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='ea5efb22-7671-4c79-bcf2-bcd48c590aaf';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='e1c0297d-b068-4432-85a3-b828cd4091d9';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='ddc8b875-92c6-40e6-a16d-0312af426af6';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='96871608-badc-4f1f-94d6-effc85d68ea6';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/SooCurvyMty') where id='81dbf9e7-9e83-4def-b38d-9df9cb76255e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/blackkissmx'), facebook=coalesce(facebook,'https://facebook.com/blackkissmx') where id='4b69fd17-f18b-4f8a-9d51-ff9a2b0160e7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='3d840a99-8a1a-4e23-bd42-51e45881ba32';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/selfedge') where id='8b75cae7-246f-4fa8-8621-cd40dd5e8d75';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='5616d85e-2f5b-4365-b55b-cae8238ea96c';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='49e6aae5-5f8c-41be-acc4-e96173478375';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/musamaniquies'), facebook=coalesce(facebook,'https://facebook.com/musamaniquiesgdl') where id='3cd1f39e-cdf9-4e4d-b4fd-d48f9f2da69d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='715924cf-746a-455c-8e8f-74e4ce89ca76';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/candyshop.com.mx'), facebook=coalesce(facebook,'https://facebook.com/candyshop.com.mx') where id='0d11aafb-1949-4cc2-8dac-0dee13e62f89';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='469172c4-8018-4bbf-a4e0-de426287a337';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='624d6157-a71d-4f7e-adeb-5dce26b58898';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Trajes-de-charro-Los-Gabrieles--19914670') where id='69ad1de6-de84-407c-a115-b910058c83b8';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Juan-de-Dios-Alvarez-Ramos-Especialista-') where id='2103cbb1-f503-4b44-a0f2-1e3470457214';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='1d594384-8a65-4dfb-8303-db0190b4a88e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='1cca8499-85e4-490a-8876-ce42fe3544ba';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zapatossary'), facebook=coalesce(facebook,'https://facebook.com/ZapatosSary') where id='527bd42d-7414-4797-a7b3-4f4b3ac5fb02';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='d40d7ba0-f2d0-4798-a5e8-5cbf20f12c8b';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='f108093c-2e9f-42a2-822a-61308f732760';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='79ee1f4f-e968-4304-8d4b-7eda5d26584f';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='746d6d0b-b11a-48ae-97c6-5c0d756645ee';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lamorraleriaoficial'), facebook=coalesce(facebook,'https://facebook.com/lamorraleria') where id='bde30ac4-6ae8-4598-b285-599bde364ff2';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='ced60120-707c-4c73-adea-019f71004042';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='8c287f28-b54a-4ec2-958d-eefe687d767d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='f32689cb-4f16-4fd5-aed6-b69bb9c0a366';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/erswimwear') where id='59c93124-12f4-40e0-9e43-4e4bbba0908f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/puntoexpomoda'), facebook=coalesce(facebook,'https://facebook.com/puntoexpomoda') where id='ce81327a-4ae5-42da-8cdc-0d8e75249ffd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/canaivetehuacan'), facebook=coalesce(facebook,'https://facebook.com/CAINVESTEH') where id='cbd1f859-9cda-48c4-bfce-b6aecdfcbbe5';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='6b83e776-0c3a-4225-a7ed-f6477b50eeae';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='0935b1b7-8f02-42af-b3a8-cd1a23106eb6';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='3f6178b7-27be-4ab2-bdb4-5ce90018fbcc';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='78dc4a69-ae97-48d1-8aa2-3149a160f9bc';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='53a1ad36-bc0b-49ed-8b13-adcdb50eef21';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='6e968ab9-e7c4-45b8-afcd-3a946c31823a';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='da3a5492-f61b-46ae-836c-285eb270bceb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='0bca31b5-b908-40e4-9846-24b41c5e2281';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='b8386fea-5b98-4792-b5a7-94247a6bda69';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='91f8b308-3f7e-49f5-9f65-23fd8801c298';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='c918e637-30a2-4206-81e0-3f879fcf4eec';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bikinisriosyvalles'), facebook=coalesce(facebook,'https://facebook.com/bikinisriosyvalles') where id='e5a1a820-819d-49b4-b97a-1414d463abf2';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='239cd98b-2272-4232-99b3-1f48df402530';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='bd0011e1-668c-4cba-b89b-9d85634b2c42';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='b767f845-16fc-4146-b83e-50136cc66d97';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='a18570b2-817a-469e-a96d-846decb52db3';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='1de4707e-400d-4f38-90b4-981ff1443d98';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='c748b6ba-6e22-48ed-8d57-c8139c5bcdac';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='8d1a111a-0f2c-455e-a7ac-e965dc7842c0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/visualmerchandisinglab'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='760cc90f-c55d-48cf-848d-dd5ad037f411';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='0077db13-3b3d-4eca-9a13-a26d63de6abe';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/aprilseamx'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='be60033f-3dad-4bd9-822b-bcbba9582c95';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/dianaalcalacarrion') where id='03854931-06e1-4857-bb26-37aef1e9c635';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/help') where id='599724b0-8082-4f27-ad49-50839e849720';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/badvibes.mx'), facebook=coalesce(facebook,'https://facebook.com/666badvibes') where id='44f43319-b65d-40b8-96c0-50e3f4eb9662';

insert into abm_senales (cuenta_id, tipo, peso, origen, detalle, caduca_at) values
('842c3d90-6a3d-42f5-b951-108b49bcd911','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('ec0e005a-94f8-4a0d-9a80-352ccad37a61','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('9271a796-8b26-4de8-a779-a141ab1acf13','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('37615dc0-e849-4f30-bb05-4fb5724fc571','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('59d5fd00-1114-461f-b3e8-03e4a36a3437','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('a8ddb8ed-e44c-4ca7-a74e-ce1aba79d21f','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('18d8fca7-582d-45a1-a172-9e6ea88dbc61','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f5bf4fd0-dc84-4551-b311-3cca19a43031','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('7b47c422-aab0-4cc7-a271-3d2429a48d4c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('7bf625ee-9822-4b0c-8f1a-5b67c3a45b1f','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f5c7236e-a3c3-4f69-bfe4-69207731c97f','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('a885c0d3-3e78-45d3-97e5-1d806664ed6a','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('72b8d77a-3d88-410b-b40e-fbf56c21035c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('8c0afe0d-bc47-4e41-b688-12616cbe0284','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f651369f-a566-452c-864f-8da84dbe1ce0','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('b9e82edf-57bd-423c-905b-fd1429a1934f','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('58370fab-6b2d-42c0-98c1-266630df1b23','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('9c95942f-f3b4-472d-93f0-ea6709b622f5','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('e6d85bc0-5653-41fd-b066-d12462ba6acd','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('3ba24426-6ff4-42bd-9ea5-1999fdc6f531','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('5e80293d-7560-4152-9d82-f13ef2f86170','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('410f995b-89f4-464c-8e7d-e8b70ee6b02c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('2b0f01db-5a43-4e4f-a140-45991c9d110c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('dcb8f389-220a-48ef-bfb6-88b400950880','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f0ce7235-5d6e-412b-b451-a0c378bb56ba','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('56a58a13-8b46-4018-bf3c-bddc3190d37e','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('8eac22e9-4762-4649-94b8-1e9285c84906','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('542c24c3-f909-4e60-b818-91029f358736','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('eec78eb3-cb02-4f52-87e1-2ed1320aeca2','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('993f6558-c2b1-4ccc-92ab-bc7948a432b4','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('64b62ba9-6530-4d7a-bf51-15378768c919','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('aa6e0f1a-b5f7-4ee1-b6f3-c11d2aa8a05c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c4067bae-1285-4b87-aa7c-cc17a470ce27','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('20f102f8-66ad-4ee0-873c-041e3e973aad','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c58a6dea-8eb8-470b-9d90-61a85c8a6604','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('946b63fe-8962-4533-8e5e-7ba2a655c934','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('7cbee5c8-bfe6-4713-b966-0220d8a9a201','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('841bdfe2-0489-4bce-b9bf-a9958da31861','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c9f74de1-6989-4168-9813-4973c262ec5c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('13ddd0fe-1a2b-4b26-bbe8-3ace2b8272b7','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c877589b-e0ee-4d65-b859-c9ef5d1f169e','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('6a2efc2e-f4e8-4654-8722-e3da328c218c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('7cdddec0-0a7a-4eef-8d65-e877a81ee9bc','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('8166cb6c-873c-497d-b77f-abe8cd2ecd68','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('8a2bdbc1-055c-4836-9bc5-9c554b0a9692','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d3edddb9-8eea-4d97-ac87-d455150770c7','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4be93951-48c9-4a07-ae44-d007fa2c27b3','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('67b5e4e5-f50c-415b-ac7c-2590f96c5c94','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('385c081d-dbac-43f6-8844-8102d78bd80d','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('bfa58011-219e-4e44-ac38-ab3ccaec30ac','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c576aee2-4bed-4704-9d74-1641b7451a7e','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('e3337a5d-4157-4c3a-85c0-a4fd588f9067','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('2e85c862-a1cb-416e-8dc4-cf307d41fb77','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('00c8f390-b3ea-4573-8f88-9ea28a02dbe5','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('3e6c5055-32fb-4f05-af9b-468a84c66fab','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('e9908842-39f0-4ac5-a91d-b452b014124c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('477b5f1f-9350-47bf-b5c0-66f95100edfb','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('fe262d95-29de-400e-b7e1-33110b297e00','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f9fd990f-50eb-4ff0-a70f-0e312b1e9f47','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('65c330fe-d064-4225-8929-4cdc80f61492','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('56f89875-2ef9-4cfc-84d0-ea6965970360','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('1cd60f6e-e09d-460d-8f94-88d74642bc83','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('63c258f5-3fa1-40f7-88c5-f309436323d2','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('886d97a7-814e-4adf-b0e1-6e697cc3195d','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('168395f5-eb17-4001-9e87-71d75f545655','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4928926e-3a3f-434b-86b0-a00f204ea125','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('9d8c682a-28e3-42d7-8e41-2a8f008058be','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('55476204-a25a-4ec8-bb17-62b3238956f8','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d96fd104-bc40-4a45-89e2-cb85564a2259','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('cd49a2a6-6b53-4483-b753-727b324fc5bd','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d21c5967-ee1d-4e47-b09b-c63060a3fe4a','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('5ea96ff2-0c15-4422-a69a-d424de70e6f7','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('3870bf2f-1c89-4e38-b891-54252862d073','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4039e712-42f0-4ba3-bb53-22756559ef28','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('fe0ac055-fb5f-40b8-9622-b9ed1c383d0d','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('09782e00-2f2a-45f9-b5fd-112b8b9cfa00','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('b1dc4d93-3b0f-47e0-a9da-5d5d0a6ef059','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d2c20e2a-501e-4a9c-a2c5-b2ce31ad1fbd','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('216c4ac5-a138-4fba-a5ab-67edf0cc9f01','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('29e9e0d4-15b5-44aa-900e-b2b57d3146f7','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f9e2a6f0-8a1a-458e-90d1-3ce0005c4d86','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('84524b22-9868-45a8-83a4-77858ebf577c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('04cb487d-949d-42f8-941f-e47989f275ba','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('3ea1a9c1-f31a-4d7d-b4ad-c7fb07000b16','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('034c8b70-59c7-4c47-a242-313e6716ea75','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('b7093259-013d-4c29-8a75-105352f7bc62','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('1a596a60-adf0-41a2-a779-e51294b84b62','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('0efa31f3-fc79-4726-a327-0448fac9b2a0','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f5585669-4263-47e8-b67b-52f43f39b54b','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c50d223b-a41a-4d6b-b1cc-6220185fdc48','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('5b06d807-eaa9-4234-b2d5-cdb3a51affbf','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d80d99d1-945d-4f84-88e6-effe5dec9cf5','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('afb5214c-df13-4a62-b045-ba70c8f36ff7','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('960360d3-fbea-46e2-b370-f0f5810d68cf','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('ce5f94fa-58bf-47e2-8bd2-1e02f346319b','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d57c3bd7-6db2-4ce0-9227-4844da21c876','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('850ddb30-924b-4114-94b6-fe5c1c09ba74','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d1d9da21-684d-4744-878c-3e6ad1992302','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('7197f613-fbac-4847-aefa-60ebae91f00c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('60bc1994-8f56-46b3-a815-0403077df369','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('1f0e68d7-0cbc-4e63-8dae-b016d1ad012c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('45d34b02-fc96-4eb7-a57e-8c67e6fde7b2','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('411349bd-9233-4093-8ea3-7fcbc5610c2d','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('0bb8b760-6aaa-48d1-87f2-6d57bf8e5208','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('952ddba7-3ebd-421a-bf9e-9123b022ede9','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('e0994470-34f1-47a3-981d-4f37d8ef6654','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4d0cdb5e-c284-49f2-bf97-f035263fb119','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('0f0c2049-a21a-4f17-aa3f-f1e383ef6c08','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('7b1b5267-3c8b-4699-925e-a047db5b4a8c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('99653f33-e7d2-41ed-9a36-eee167af07cb','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d8a3d637-f702-4f93-ac33-6d54beba44dd','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4e59520d-a05a-4f75-8853-ee851d3a75bc','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('df8971e6-b342-4f97-801e-abd1b4b0b33a','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('7aac6c03-6a59-4f77-8f55-af7958e9599e','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f6ddd2ae-f680-42bc-98f6-c3e20abb038e','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365)
on conflict do nothing;
