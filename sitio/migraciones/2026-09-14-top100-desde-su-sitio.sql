-- Enriquecimiento del TOP 100 por giro, desde su propio sitio (14-sep-2026).
--
-- Primera corrida con la premisa nueva del manual (§0): no se enriquece toda la
-- base, se enriquecen las MEJORES. 404 cuentas del top 100 de cada giro, todas
-- con 3.7 estrellas o más en Google Maps, que tenían sitio y les faltaba alguna
-- vía de contacto.
--
-- Rendimiento: 104 correos, 85 WhatsApp, 68 teléfonos, 145 Instagram, 142
-- Facebook, y 47 sitios caídos — casi uno de cada nueve.
--
-- LO QUE SE DESCARTÓ, Y POR QUÉ IMPORTA
-- `impallari@gmail.com` salía como correo de CINCO negocios sin relación entre
-- sí: renta de trajes, ópticas, guayaberas. Es Pablo Impallari, diseñador de
-- tipografías, acreditado en el pie de esos sitios. Es el mismo error que
-- `team@latofonts.com`, pero con dominio gratuito, así que la lista negra de
-- dominios no lo atrapaba.
--
-- De ahí la regla nueva: un correo que aparece en VARIAS cuentas distintas se
-- descarta ENTERO. Si dos negocios sin relación publican el mismo correo, no es
-- de ninguno de los dos. Quedarse con la primera aparición era quedarse justo
-- con la mala.
--
-- Todos los correos pasaron verificación de MX (82 dominios, ninguno cayó).
-- Los WhatsApp entran como `declarado` porque salen de un enlace wa.me del
-- propio sitio: el negocio lo publicó (§6 bis).

insert into abm_canales (cuenta_id, tipo, valor, confianza, es_de_la_tienda, estado) values
('477d8c56-234c-4d87-aada-491a15b4414d','whatsapp_tienda','524770000000','alta',true,'declarado'),
('f7cbdfbe-c730-41dd-8d4b-b77aba2f3e9b','email_generico','contacto@priceshoes.com','media',true,'sin_probar'),
('531c2cf9-a4c5-40ed-a394-2bc577637763','email_generico','atencion@elnuevomundo.com','media',true,'sin_probar'),
('531c2cf9-a4c5-40ed-a394-2bc577637763','telefono','525551300353','media',true,'sin_probar'),
('68db6ac0-d319-4ca3-a1c9-2ebcb0c0ec06','email_generico','info@sapica.com','media',true,'sin_probar'),
('c90d67de-f822-4326-b00f-57843d3f942f','email_generico','ayuda@chapur.com.mx','media',true,'sin_probar'),
('c90d67de-f822-4326-b00f-57843d3f942f','telefono','529999302800','media',true,'sin_probar'),
('c69cff03-2bff-4068-b1ce-40b6a875bfc2','email_generico','u003cdax@dax.com.mx','media',true,'sin_probar'),
('ef15b116-3d46-44b1-a5d0-d1e22a6d6ffa','email_generico','moises@goodbyefolk.com','media',true,'sin_probar'),
('5f231744-ec70-47d2-9fe7-85b3b7d05c43','email_generico','admin@centrojoyerozocalo.com','media',true,'sin_probar'),
('3a6db856-f6fa-49c4-8d0a-7368459af7d0','email_generico','contacto@promoda.com.mx','media',true,'sin_probar'),
('3a6db856-f6fa-49c4-8d0a-7368459af7d0','telefono','528000077066','media',true,'sin_probar'),
('c8118aa0-f41d-45bd-8cce-c44356d995c4','whatsapp_tienda','528123847702','alta',true,'declarado'),
('c8118aa0-f41d-45bd-8cce-c44356d995c4','telefono','525547772222','media',true,'sin_probar'),
('25b97676-317c-4a7d-9490-43f6feae8db3','whatsapp_tienda','526462876359','alta',true,'declarado'),
('df468897-890d-4274-959d-132a68ad5251','email_generico','info@yulygiraldo.com','media',true,'sin_probar'),
('e343b721-599f-48bd-afee-64cdacc0727e','whatsapp_tienda','528124277881','alta',true,'declarado'),
('e343b721-599f-48bd-afee-64cdacc0727e','telefono','528183447251','media',true,'sin_probar'),
('3089a6c6-bb2a-41d9-9031-e4ab1e352011','telefono','523331263789','media',true,'sin_probar'),
('5df6073a-86b0-46ef-a09d-c661c2a57e2f','email_generico','info@carlo.mx','media',true,'sin_probar'),
('5df6073a-86b0-46ef-a09d-c661c2a57e2f','whatsapp_tienda','525567835967','alta',true,'declarado'),
('bf28a55b-6d8f-49d1-8d48-9c463c9463cd','email_generico','valma.mx@gmail.com','media',true,'sin_probar'),
('e81eb2d9-296e-4bef-bdb2-b9d7ea81a76c','email_generico','ventas@almadeluna.mx','media',true,'sin_probar'),
('5ae9834f-c13c-4f0b-aeca-3919fa3bf127','email_generico','contacto@moutyjoyeria.com','media',true,'sin_probar'),
('5ae9834f-c13c-4f0b-aeca-3919fa3bf127','telefono','523345273624','media',true,'sin_probar'),
('f333ad0e-b722-48c0-9d97-158f4dee0e64','whatsapp_tienda','526145990767','alta',true,'declarado'),
('3b432454-fc80-4b5d-9e24-ca5545e1115a','email_generico','tennisexpress@icloud.com','media',true,'sin_probar'),
('3b432454-fc80-4b5d-9e24-ca5545e1115a','telefono','528119902398','media',true,'sin_probar'),
('0e47ad7f-0183-4d55-904e-b4791c579b4b','whatsapp_tienda','523315841191','alta',true,'declarado'),
('3069d25c-5e20-4ea0-930a-5c9623813791','email_generico','atencionaclientestijuana@jarmar.com','media',true,'sin_probar'),
('3069d25c-5e20-4ea0-930a-5c9623813791','whatsapp_tienda','529611855475','alta',true,'declarado'),
('3554b6ee-2fc1-4e46-b74d-69edc71cdcf6','email_generico','contacto@elglobo.com.mx','media',true,'sin_probar'),
('3554b6ee-2fc1-4e46-b74d-69edc71cdcf6','telefono','528007184811','media',true,'sin_probar'),
('74863e07-6d1a-44d7-a503-33fc377a4b16','email_generico','tuzomaniaoficial@gmail.com','media',true,'sin_probar'),
('00dc2a01-ab64-4f79-962a-821abdca6983','email_generico','contacto@opticasblink.com','media',true,'sin_probar'),
('00dc2a01-ab64-4f79-962a-821abdca6983','whatsapp_tienda','526182821983','alta',true,'declarado'),
('00dc2a01-ab64-4f79-962a-821abdca6983','telefono','526181850479','media',true,'sin_probar'),
('ed15c57d-c395-4d3e-8c35-ee71ecd1b19e','whatsapp_tienda','525594484465','alta',true,'declarado'),
('ed15c57d-c395-4d3e-8c35-ee71ecd1b19e','telefono','527282843125','media',true,'sin_probar'),
('dc65e85f-224b-4568-a137-a2741f88eb29','whatsapp_tienda','522461549385','alta',true,'declarado'),
('dc65e85f-224b-4568-a137-a2741f88eb29','telefono','522225914459','media',true,'sin_probar'),
('f3cc24ca-7c8e-4b21-a830-ec8daad7dadc','email_generico','help@stax.shop','media',true,'sin_probar'),
('f3cc24ca-7c8e-4b21-a830-ec8daad7dadc','whatsapp_tienda','525579179921','alta',true,'declarado'),
('f3cc24ca-7c8e-4b21-a830-ec8daad7dadc','telefono','528005204040','media',true,'sin_probar'),
('b97da424-d911-46c6-96f0-a53f8af26bd6','whatsapp_tienda','528136391003','alta',true,'declarado'),
('fe498d4e-deaf-4985-865a-8fde0c314344','email_generico','ventas@opticagema.com.mx','media',true,'sin_probar'),
('fe498d4e-deaf-4985-865a-8fde0c314344','whatsapp_tienda','525627418583','alta',true,'declarado'),
('78638245-e3d3-4519-bfed-a5b2d3d0d15f','whatsapp_tienda','525517448241','alta',true,'declarado'),
('78638245-e3d3-4519-bfed-a5b2d3d0d15f','telefono','525517448241','media',true,'sin_probar'),
('30801424-ca55-49f3-bc3b-ba135bcf612c','email_generico','info@favitelas.com','media',true,'sin_probar'),
('30801424-ca55-49f3-bc3b-ba135bcf612c','telefono','526461413964','media',true,'sin_probar'),
('be864c0b-2338-42cf-a78c-9e11927cd4b4','email_generico','empresarial@opticavilook.com','media',true,'sin_probar'),
('be864c0b-2338-42cf-a78c-9e11927cd4b4','whatsapp_tienda','524427809748','alta',true,'declarado'),
('13afea7a-64d8-4422-b50b-15c8395929cc','email_generico','contacto@plasticoseltio.com.mx','media',true,'sin_probar'),
('13afea7a-64d8-4422-b50b-15c8395929cc','whatsapp_tienda','525570090212','alta',true,'declarado'),
('fd445e1b-f887-4311-9ff4-bc37405504a3','email_generico','atencionaclientes@veana.com','media',true,'sin_probar'),
('a9ee1f64-615a-4169-ac1c-e7dafb49ff07','whatsapp_tienda','527225560013','alta',true,'declarado'),
('668d732e-0b87-48e5-b7d3-a497d691cac2','whatsapp_tienda','525563896285','alta',true,'declarado'),
('fd5873dc-513d-41c2-8ee4-790faaa34431','whatsapp_tienda','525516960757','alta',true,'declarado'),
('fd5873dc-513d-41c2-8ee4-790faaa34431','telefono','525516960757','media',true,'sin_probar'),
('1c0ad49a-2b27-4d01-b416-b9bbf706237e','telefono','528002321212','media',true,'sin_probar'),
('40676076-064e-43e0-ad19-857ba0ea6fce','whatsapp_tienda','529991262332','alta',true,'declarado'),
('40676076-064e-43e0-ad19-857ba0ea6fce','telefono','529992231217','media',true,'sin_probar'),
('94690d47-7c4a-4d9f-8193-a040f65167a1','email_generico','info@soybissu.com','media',true,'sin_probar'),
('1c2c27bd-582b-490f-8d74-75ce72cf8d5a','email_generico','chuz77z@gmail.com','media',true,'sin_probar'),
('b9e82edf-57bd-423c-905b-fd1429a1934f','email_generico','info@tuxedosvictors.com','media',true,'sin_probar'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','email_generico','info@opticalorentzdejuarez.com.mx','media',true,'sin_probar'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','whatsapp_tienda','526563604060','alta',true,'declarado'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','telefono','526563604060','media',true,'sin_probar'),
('9f85670b-3f7b-4995-a8a6-b0304a744b76','whatsapp_tienda','523337872430','alta',true,'declarado'),
('d844243b-66b2-4d64-849c-4080dafe9a18','whatsapp_tienda','526623002087','alta',true,'declarado'),
('d844243b-66b2-4d64-849c-4080dafe9a18','telefono','526623002087','media',true,'sin_probar'),
('71a8858e-529a-42a8-aece-c15d7bece80b','whatsapp_tienda','524773833912','alta',true,'declarado'),
('635313dc-946d-47e3-bb81-bf3e661541ba','email_generico','lorygil.cabo@gmail.com','media',true,'sin_probar'),
('635313dc-946d-47e3-bb81-bf3e661541ba','telefono','526121230120','media',true,'sin_probar'),
('210c6cac-927e-4f80-9958-3a62519380f8','email_generico','garriaga@atleticos.com.mx','media',true,'sin_probar'),
('6998f232-2cbb-48d8-b822-255a3d93ee60','whatsapp_tienda','525531658139','alta',true,'declarado'),
('6998f232-2cbb-48d8-b822-255a3d93ee60','telefono','525555463476','media',true,'sin_probar'),
('4b0aaba5-408a-4486-a101-fe6db52f6a5e','whatsapp_tienda','526621396339','alta',true,'declarado'),
('a80005a7-67ad-4005-9abe-180c54d7f625','email_generico','info@sposabridal.mx','media',true,'sin_probar'),
('a80005a7-67ad-4005-9abe-180c54d7f625','telefono','526642002078','media',true,'sin_probar'),
('c03c432c-626a-4d7c-b968-1db28a7bdc96','whatsapp_tienda','522214144509','alta',true,'declarado'),
('c03c432c-626a-4d7c-b968-1db28a7bdc96','telefono','522214144509','media',true,'sin_probar'),
('812b651b-7b31-4599-8284-9a0b9ec48064','whatsapp_tienda','525571938391','alta',true,'declarado'),
('7e8e1136-5766-4dfb-9118-99ef44e1c33a','whatsapp_tienda','529993155009','alta',true,'declarado'),
('133558cd-6212-4893-b016-e57536f406f1','email_generico','servicioaclientes@discalse.com','media',true,'sin_probar'),
('ca8da1c2-861c-40b0-bf20-d895804967d3','email_generico','centrodegraduaciones@gmail.com','media',true,'sin_probar'),
('bea3c06c-2d31-471b-ae4b-5291ed87da8e','email_generico','l.luna@tejidosgaytan.com.mx','media',true,'sin_probar'),
('dc4e71dd-81c0-4645-8de8-99b4227edddd','email_generico','contacto@zapatoagil.com','media',true,'sin_probar'),
('dc4e71dd-81c0-4645-8de8-99b4227edddd','telefono','523323107798','media',true,'sin_probar'),
('58e1f0cf-078b-4440-b4fd-9bef258d931c','whatsapp_tienda','522227095349','alta',true,'declarado'),
('3d1c7560-5bd0-4e4a-b303-06b4271faaab','whatsapp_tienda','525561894779','alta',true,'declarado'),
('3d1c7560-5bd0-4e4a-b303-06b4271faaab','telefono','525561371366','media',true,'sin_probar'),
('fd73b44e-41f7-44e3-821f-aafde8b6960a','email_generico','contacto@giorgio.icu','media',true,'sin_probar'),
('fd73b44e-41f7-44e3-821f-aafde8b6960a','whatsapp_tienda','525574343534','alta',true,'declarado'),
('fd73b44e-41f7-44e3-821f-aafde8b6960a','telefono','525518330947','media',true,'sin_probar'),
('cda5e406-daa5-436b-82d3-227586363084','email_generico','contacto@mxoptix.mx','media',true,'sin_probar'),
('cda5e406-daa5-436b-82d3-227586363084','whatsapp_tienda','522281094714','alta',true,'declarado'),
('e6fddaf6-829c-4a19-b40b-a4718057d309','email_generico','soluciones@guayaberasycamisas.com','media',true,'sin_probar'),
('14de0dac-640a-4be7-9d96-9e0bef574901','email_generico','contacto@okulux.mx','media',true,'sin_probar'),
('14de0dac-640a-4be7-9d96-9e0bef574901','whatsapp_tienda','524421255097','alta',true,'declarado'),
('14de0dac-640a-4be7-9d96-9e0bef574901','telefono','524421255097','media',true,'sin_probar'),
('50092d20-0a05-4a86-aad0-9f557c51aacb','email_generico','contacto@deportextil.com','media',true,'sin_probar'),
('50092d20-0a05-4a86-aad0-9f557c51aacb','whatsapp_tienda','525567086651','alta',true,'declarado'),
('70720b30-055f-41f1-8424-f568053051ce','email_generico','contacto@luzo.info','media',true,'sin_probar'),
('70720b30-055f-41f1-8424-f568053051ce','telefono','525559291919','media',true,'sin_probar'),
('04f28815-81fa-4fdf-ba53-86e243bb6483','email_generico','ecommerceoficial@berlei.com.mx','media',true,'sin_probar'),
('d7a8e361-8b1f-41f5-a46f-e9fc2d76e277','email_generico','info@ciceg.org','media',true,'sin_probar'),
('fb736788-7c68-42a9-8b80-a766e7eec3bf','telefono','524436928215','media',true,'sin_probar'),
('1b08c9fe-7941-4899-83c7-43cc7acc128b','email_generico','ventas@textilesdelfuturo.com.mx','media',true,'sin_probar'),
('1b08c9fe-7941-4899-83c7-43cc7acc128b','telefono','523338262990','media',true,'sin_probar'),
('19b0da46-a833-467e-9cce-4b44f78309eb','email_generico','ventas@lacasadelrebozo.com.mx','media',true,'sin_probar'),
('19b0da46-a833-467e-9cce-4b44f78309eb','telefono','529513629983','media',true,'sin_probar'),
('b1817940-06cb-4fa2-bb57-38ae49a51942','email_generico','info@bwigroup.com','media',true,'sin_probar'),
('16dd6a11-0748-4ef5-a46f-890c760282d7','email_generico','ventas@hovers.com.mx','media',true,'sin_probar'),
('16dd6a11-0748-4ef5-a46f-890c760282d7','whatsapp_tienda','528181754857','alta',true,'declarado'),
('401d3296-2eb9-4171-9624-9463158e063e','email_generico','ucmolegario@yahoo.com.mx','media',true,'sin_probar'),
('d1239268-f4f2-410a-bff5-a35825c6d798','email_generico','mundoinfantil.dgo@gmail.com','media',true,'sin_probar'),
('d1239268-f4f2-410a-bff5-a35825c6d798','whatsapp_tienda','526181844220','alta',true,'declarado'),
('d1239268-f4f2-410a-bff5-a35825c6d798','telefono','526181844220','media',true,'sin_probar'),
('870fe4ef-10e8-491e-8219-68de23f676d7','whatsapp_tienda','525611720577','alta',true,'declarado'),
('870fe4ef-10e8-491e-8219-68de23f676d7','telefono','525611720577','media',true,'sin_probar'),
('6c26a25e-54cd-4d6e-9245-625058dd3c65','email_generico','drchef.jacal@gmail.com','media',true,'sin_probar'),
('6c26a25e-54cd-4d6e-9245-625058dd3c65','whatsapp_tienda','524427482539','alta',true,'declarado'),
('6c26a25e-54cd-4d6e-9245-625058dd3c65','telefono','524422158595','media',true,'sin_probar'),
('5b58935c-c6a5-4697-a8d7-fbe77181897f','email_generico','ventasweb@vertimania.com','media',true,'sin_probar'),
('5b58935c-c6a5-4697-a8d7-fbe77181897f','whatsapp_tienda','523313370590','alta',true,'declarado'),
('5b58935c-c6a5-4697-a8d7-fbe77181897f','telefono','523336165371','media',true,'sin_probar'),
('a87d856a-3b7b-4175-97d3-8e3919c24d8f','email_generico','contacto@sterling.fashion','media',true,'sin_probar'),
('a87d856a-3b7b-4175-97d3-8e3919c24d8f','whatsapp_tienda','525519079298','alta',true,'declarado'),
('0197411b-f15b-4fea-9c00-922dd076e07d','email_generico','bcbvictoria@hotmail.com','media',true,'sin_probar'),
('0197411b-f15b-4fea-9c00-922dd076e07d','whatsapp_tienda','528992051673','alta',true,'declarado'),
('0197411b-f15b-4fea-9c00-922dd076e07d','telefono','528999254991','media',true,'sin_probar'),
('01f4b2be-cfaf-49e5-814f-50e0b6ba7122','email_generico','uniformes.donza@outlook.com','media',true,'sin_probar'),
('74bce925-ec2d-415b-932c-e91c8c09dafd','email_generico','ventas@hefestosmoda.com','media',true,'sin_probar'),
('74bce925-ec2d-415b-932c-e91c8c09dafd','whatsapp_tienda','529513328160','alta',true,'declarado'),
('6296cbb6-c5a1-4239-b3f8-77886e74dc2a','telefono','522222149012','media',true,'sin_probar'),
('4f6eb524-632f-4c61-afc4-3af4ec72b02b','email_generico','opticas@caryera.mx','media',true,'sin_probar'),
('4f6eb524-632f-4c61-afc4-3af4ec72b02b','whatsapp_tienda','526563110094','alta',true,'declarado'),
('c3b2176c-473b-4f66-b888-e50ad52c054c','email_generico','contacto@zapatoguante.com','media',true,'sin_probar'),
('2dec9dfe-4215-4970-a6d6-09487cb68141','email_generico','mexico@lazzarmexico.com','media',true,'sin_probar'),
('65c330fe-d064-4225-8929-4cdc80f61492','whatsapp_tienda','527717726424','alta',true,'declarado'),
('e71cb596-6af7-4abf-89a4-87de83c7a762','email_generico','ayuda@dorothygaynor.com','media',true,'sin_probar'),
('e71cb596-6af7-4abf-89a4-87de83c7a762','whatsapp_tienda','525532488222','alta',true,'declarado'),
('e71cb596-6af7-4abf-89a4-87de83c7a762','telefono','525593312906','media',true,'sin_probar'),
('d2e8eb4e-b1c8-4db5-be99-28136977afe4','email_generico','contacto@tecnosocks.com','media',true,'sin_probar'),
('376e1986-d5b9-4880-95f9-912dba58897e','email_generico','info@textilregiomontana.com.mx','media',true,'sin_probar'),
('376e1986-d5b9-4880-95f9-912dba58897e','whatsapp_tienda','528136202797','alta',true,'declarado'),
('6c161422-92e1-4415-b82e-0c5e8d000019','whatsapp_tienda','524425761518','alta',true,'declarado'),
('934bd69d-612b-41a1-aab4-2d728daf6aae','email_generico','proviamiga@mundoprovidencia.com','media',true,'sin_probar'),
('5c7020ef-257e-4652-9515-61ab4ec6db04','email_generico','info@excelenciaoptica.com.mx','media',true,'sin_probar'),
('5c7020ef-257e-4652-9515-61ab4ec6db04','whatsapp_tienda','529931354425','alta',true,'declarado'),
('5c7020ef-257e-4652-9515-61ab4ec6db04','telefono','529931354425','media',true,'sin_probar'),
('11219b5e-fad7-4616-aec7-5409669632ad','whatsapp_tienda','524439345516','alta',true,'declarado'),
('11219b5e-fad7-4616-aec7-5409669632ad','telefono','524439345516','media',true,'sin_probar'),
('3d026714-ebe2-4b8e-82af-34c7a5a2ae63','email_generico','tienda@pirouette.mx','media',true,'sin_probar'),
('527b262c-045d-47f9-8d04-484c225fd44f','telefono','526699155300','media',true,'sin_probar'),
('3ea9bb9f-b03c-403e-9ccc-5adb317b5194','email_generico','ventas@vestidosnatbridal.com','media',true,'sin_probar'),
('3ea9bb9f-b03c-403e-9ccc-5adb317b5194','whatsapp_tienda','525578785378','alta',true,'declarado'),
('84524b22-9868-45a8-83a4-77858ebf577c','whatsapp_tienda','522721913486','alta',true,'declarado'),
('84524b22-9868-45a8-83a4-77858ebf577c','telefono','522727259928','media',true,'sin_probar'),
('acba8fbb-7208-4e3b-bd1b-a8c0fd26c252','email_generico','servicio@highlife.com.mx','media',true,'sin_probar'),
('acba8fbb-7208-4e3b-bd1b-a8c0fd26c252','whatsapp_tienda','525548036379','alta',true,'declarado'),
('088dd8e8-7a4d-4665-bd59-b3f771f595f1','email_generico','mondepell@gmail.com','media',true,'sin_probar'),
('088dd8e8-7a4d-4665-bd59-b3f771f595f1','telefono','525556782240','media',true,'sin_probar'),
('3e62a6a1-7fd1-4909-abf7-179b5d4c33ef','whatsapp_tienda','528120065308','alta',true,'declarado'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','email_generico','info@elybride.com','media',true,'sin_probar'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','whatsapp_tienda','529988977717','alta',true,'declarado'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','telefono','529988977717','media',true,'sin_probar'),
('d77932de-6c69-4230-8ced-1b1bfa148400','email_generico','mercerias.net@gmail.com','media',true,'sin_probar'),
('d77932de-6c69-4230-8ced-1b1bfa148400','telefono','528183752250','media',true,'sin_probar'),
('3d3cea7b-fff9-4c6b-93d3-235d7eb06369','email_generico','ventas@fravel.com.mx','media',true,'sin_probar'),
('3d3cea7b-fff9-4c6b-93d3-235d7eb06369','whatsapp_tienda','524499710924','alta',true,'declarado'),
('3d3cea7b-fff9-4c6b-93d3-235d7eb06369','telefono','524499710924','media',true,'sin_probar'),
('533b8982-1a98-485d-a510-2c2a91250533','email_generico','opticostampico@hotmail.com','media',true,'sin_probar'),
('533b8982-1a98-485d-a510-2c2a91250533','whatsapp_tienda','528335260760','alta',true,'declarado'),
('533b8982-1a98-485d-a510-2c2a91250533','telefono','528333010304','media',true,'sin_probar'),
('337de5fd-27fb-49dc-9192-cb8dcb5053d1','email_generico','help@help.desigual.com','media',true,'sin_probar'),
('1c85a9ab-f14f-4084-ab90-3fd8d095bbaa','whatsapp_tienda','523316972569','alta',true,'declarado'),
('129efa40-f59b-46d7-a408-12f66a8b04ad','whatsapp_tienda','525578343522','alta',true,'declarado'),
('129efa40-f59b-46d7-a408-12f66a8b04ad','telefono','525594629924','media',true,'sin_probar'),
('252e0f85-8981-41b7-b38f-293db092a3ad','email_generico','impresiones@gutink.mx','media',true,'sin_probar'),
('252e0f85-8981-41b7-b38f-293db092a3ad','whatsapp_tienda','523318669441','alta',true,'declarado'),
('1905828a-8f2d-438c-9014-a7a58020dde3','email_generico','atenciononline@duo.com.mx','media',true,'sin_probar'),
('1905828a-8f2d-438c-9014-a7a58020dde3','whatsapp_tienda','526682360911','alta',true,'declarado'),
('b6f2075c-a357-48b3-90af-293f39d70493','email_generico','yumuri@yumuri.com.mx','media',true,'sin_probar'),
('b6f2075c-a357-48b3-90af-293f39d70493','telefono','525555670700','media',true,'sin_probar'),
('67da96fa-12e5-4d9d-97ca-13aa3aa414a7','email_generico','opticamadero@opticahera.com','media',true,'sin_probar'),
('67da96fa-12e5-4d9d-97ca-13aa3aa414a7','whatsapp_tienda','525585734647','alta',true,'declarado'),
('711fde91-4965-45dd-800d-1c819b154f38','email_generico','playeraspersonalizadasmx23@gmail.com','media',true,'sin_probar'),
('711fde91-4965-45dd-800d-1c819b154f38','whatsapp_tienda','525568803076','alta',true,'declarado'),
('711fde91-4965-45dd-800d-1c819b154f38','telefono','525568803076','media',true,'sin_probar'),
('66770fd9-18fb-4e77-b9ac-91241739156a','email_generico','ventas@rematedebotas.com.mx','media',true,'sin_probar'),
('b2ea1aa9-c8f9-4345-8572-4d957ec99e86','email_generico','opticavisualook@gmail.com','media',true,'sin_probar'),
('2fa0bf16-f9fc-49d6-97f4-00478853a8c3','email_generico','oxanashekh@gmail.com','media',true,'sin_probar'),
('2fa0bf16-f9fc-49d6-97f4-00478853a8c3','whatsapp_tienda','528126440236','alta',true,'declarado'),
('95399faf-f37d-4de1-9327-75c2cddc8690','email_generico','galeria.optica0@gmail.com','media',true,'sin_probar'),
('95399faf-f37d-4de1-9327-75c2cddc8690','telefono','526566172453','media',true,'sin_probar'),
('1f9fef63-6da4-42f6-8871-d125c5f3babf','email_generico','ventas@latijera.mx','media',true,'sin_probar'),
('1f9fef63-6da4-42f6-8871-d125c5f3babf','telefono','528717128452','media',true,'sin_probar'),
('ee1868ea-126c-4205-b970-76c4d9bb15fd','whatsapp_tienda','525579475941','alta',true,'declarado'),
('e67fcf69-6fa7-4630-927b-98c2191c14a4','whatsapp_tienda','525565085710','alta',true,'declarado'),
('e67fcf69-6fa7-4630-927b-98c2191c14a4','telefono','525565085710','media',true,'sin_probar'),
('e2ada293-4e65-427b-8127-46b1417a2352','email_generico','calicuse@yahoo.com.mx','media',true,'sin_probar'),
('d80d99d1-945d-4f84-88e6-effe5dec9cf5','email_generico','info@canaive.mx','media',true,'sin_probar'),
('d80d99d1-945d-4f84-88e6-effe5dec9cf5','whatsapp_tienda','525555887822','alta',true,'declarado'),
('d80d99d1-945d-4f84-88e6-effe5dec9cf5','telefono','525555887822','media',true,'sin_probar'),
('9862b719-b249-4ba0-8d54-b1afc60b42bc','email_generico','joel.cruz@lamaria.com.mx','media',true,'sin_probar'),
('9862b719-b249-4ba0-8d54-b1afc60b42bc','telefono','522222244241','media',true,'sin_probar'),
('2867dc8f-1b8d-46e9-b5c2-761ab8409cd5','email_generico','compras@grupovios.com','media',true,'sin_probar'),
('2867dc8f-1b8d-46e9-b5c2-761ab8409cd5','whatsapp_tienda','525590158827','alta',true,'declarado'),
('431e2b5e-fbba-41e9-bce9-4f78eb10c6ed','email_generico','contacto@promoscreativos.com','media',true,'sin_probar'),
('63b61188-db0b-4337-a403-d124530f48bf','telefono','529931214005','media',true,'sin_probar'),
('dd97aede-59ad-4503-aa71-4a651a0aebb6','email_generico','tienda@andycalderon.com','media',true,'sin_probar'),
('dd97aede-59ad-4503-aa71-4a651a0aebb6','whatsapp_tienda','523322588791','alta',true,'declarado'),
('dd97aede-59ad-4503-aa71-4a651a0aebb6','telefono','523328769883','media',true,'sin_probar'),
('b05bfa51-33a3-42f1-8746-e4c87cdaa271','email_generico','merca@apimex.org','media',true,'sin_probar'),
('b05bfa51-33a3-42f1-8746-e4c87cdaa271','whatsapp_tienda','524773938095','alta',true,'declarado'),
('ae7ce5f7-7c2b-43c0-bb89-1eef89295050','email_generico','ventas@dicuniformes.mx','media',true,'sin_probar'),
('ae7ce5f7-7c2b-43c0-bb89-1eef89295050','whatsapp_tienda','522461453516','alta',true,'declarado'),
('ae7ce5f7-7c2b-43c0-bb89-1eef89295050','telefono','522464150243','media',true,'sin_probar'),
('4b69fd17-f18b-4f8a-9d51-ff9a2b0160e7','email_generico','ventas@blackkissmx.com','media',true,'sin_probar'),
('0d11aafb-1949-4cc2-8dac-0dee13e62f89','email_generico','info@candyshop.com.mx','media',true,'sin_probar'),
('3cd1f39e-cdf9-4e4d-b4fd-d48f9f2da69d','telefono','528000006872','media',true,'sin_probar'),
('2103cbb1-f503-4b44-a0f2-1e3470457214','whatsapp_tienda','525554682563','alta',true,'declarado'),
('527bd42d-7414-4797-a7b3-4f4b3ac5fb02','email_generico','contacto@sary.com.mx','media',true,'sin_probar'),
('527bd42d-7414-4797-a7b3-4f4b3ac5fb02','telefono','523336720909','media',true,'sin_probar'),
('bde30ac4-6ae8-4598-b285-599bde364ff2','whatsapp_tienda','524771794796','alta',true,'declarado'),
('ce81327a-4ae5-42da-8cdc-0d8e75249ffd','whatsapp_tienda','523318474081','alta',true,'declarado'),
('cbd1f859-9cda-48c4-bfce-b6aecdfcbbe5','email_generico','canaivetehuacan@gmail.com','media',true,'sin_probar'),
('6adbdd4a-9ac7-41a1-abeb-497a7adbef6e','whatsapp_tienda','525572482687','alta',true,'declarado'),
('6adbdd4a-9ac7-41a1-abeb-497a7adbef6e','telefono','525572482687','media',true,'sin_probar'),
('760cc90f-c55d-48cf-848d-dd5ad037f411','email_generico','info@visualmerchandisinglab.com','media',true,'sin_probar'),
('98b409e0-f523-486a-a2fd-a7b0769f9d4f','email_generico','contacto@central-store.com.mx','media',true,'sin_probar'),
('98b409e0-f523-486a-a2fd-a7b0769f9d4f','telefono','525641675532','media',true,'sin_probar'),
('44f43319-b65d-40b8-96c0-50e3f4eb9662','whatsapp_tienda','525648967642','alta',true,'declarado'),
('dbcceb96-dea8-461f-b65c-e7ba89ceb603','email_generico','sales@elcharro1.com','media',true,'sin_probar'),
('dbcceb96-dea8-461f-b65c-e7ba89ceb603','telefono','529155347956','media',true,'sin_probar'),
('4bdd28ba-468e-42c5-9111-6b0d8f932343','whatsapp_tienda','528114642039','alta',true,'declarado')
on conflict do nothing;

insert into abm_fuentes (cuenta_id, campo, valor, metodo, confianza, agente) values
('477d8c56-234c-4d87-aada-491a15b4414d','whatsapp','524770000000','sitio_propio','alta','raspado-top'),
('f7cbdfbe-c730-41dd-8d4b-b77aba2f3e9b','email','contacto@priceshoes.com','sitio_propio','media','raspado-top'),
('531c2cf9-a4c5-40ed-a394-2bc577637763','email','atencion@elnuevomundo.com','sitio_propio','media','raspado-top'),
('68db6ac0-d319-4ca3-a1c9-2ebcb0c0ec06','email','info@sapica.com','sitio_propio','media','raspado-top'),
('c90d67de-f822-4326-b00f-57843d3f942f','email','ayuda@chapur.com.mx','sitio_propio','media','raspado-top'),
('c69cff03-2bff-4068-b1ce-40b6a875bfc2','email','u003cdax@dax.com.mx','sitio_propio','media','raspado-top'),
('ef15b116-3d46-44b1-a5d0-d1e22a6d6ffa','email','moises@goodbyefolk.com','sitio_propio','media','raspado-top'),
('5f231744-ec70-47d2-9fe7-85b3b7d05c43','email','admin@centrojoyerozocalo.com','sitio_propio','media','raspado-top'),
('3a6db856-f6fa-49c4-8d0a-7368459af7d0','email','contacto@promoda.com.mx','sitio_propio','media','raspado-top'),
('c8118aa0-f41d-45bd-8cce-c44356d995c4','whatsapp','528123847702','sitio_propio','alta','raspado-top'),
('25b97676-317c-4a7d-9490-43f6feae8db3','whatsapp','526462876359','sitio_propio','alta','raspado-top'),
('df468897-890d-4274-959d-132a68ad5251','email','info@yulygiraldo.com','sitio_propio','media','raspado-top'),
('e343b721-599f-48bd-afee-64cdacc0727e','whatsapp','528124277881','sitio_propio','alta','raspado-top'),
('5df6073a-86b0-46ef-a09d-c661c2a57e2f','email','info@carlo.mx','sitio_propio','media','raspado-top'),
('5df6073a-86b0-46ef-a09d-c661c2a57e2f','whatsapp','525567835967','sitio_propio','alta','raspado-top'),
('bf28a55b-6d8f-49d1-8d48-9c463c9463cd','email','valma.mx@gmail.com','sitio_propio','media','raspado-top'),
('e81eb2d9-296e-4bef-bdb2-b9d7ea81a76c','email','ventas@almadeluna.mx','sitio_propio','media','raspado-top'),
('5ae9834f-c13c-4f0b-aeca-3919fa3bf127','email','contacto@moutyjoyeria.com','sitio_propio','media','raspado-top'),
('f333ad0e-b722-48c0-9d97-158f4dee0e64','whatsapp','526145990767','sitio_propio','alta','raspado-top'),
('3b432454-fc80-4b5d-9e24-ca5545e1115a','email','tennisexpress@icloud.com','sitio_propio','media','raspado-top'),
('0e47ad7f-0183-4d55-904e-b4791c579b4b','whatsapp','523315841191','sitio_propio','alta','raspado-top'),
('3069d25c-5e20-4ea0-930a-5c9623813791','email','atencionaclientestijuana@jarmar.com','sitio_propio','media','raspado-top'),
('3069d25c-5e20-4ea0-930a-5c9623813791','whatsapp','529611855475','sitio_propio','alta','raspado-top'),
('3554b6ee-2fc1-4e46-b74d-69edc71cdcf6','email','contacto@elglobo.com.mx','sitio_propio','media','raspado-top'),
('74863e07-6d1a-44d7-a503-33fc377a4b16','email','tuzomaniaoficial@gmail.com','sitio_propio','media','raspado-top'),
('00dc2a01-ab64-4f79-962a-821abdca6983','email','contacto@opticasblink.com','sitio_propio','media','raspado-top'),
('00dc2a01-ab64-4f79-962a-821abdca6983','whatsapp','526182821983','sitio_propio','alta','raspado-top'),
('ed15c57d-c395-4d3e-8c35-ee71ecd1b19e','whatsapp','525594484465','sitio_propio','alta','raspado-top'),
('dc65e85f-224b-4568-a137-a2741f88eb29','whatsapp','522461549385','sitio_propio','alta','raspado-top'),
('f3cc24ca-7c8e-4b21-a830-ec8daad7dadc','email','help@stax.shop','sitio_propio','media','raspado-top'),
('f3cc24ca-7c8e-4b21-a830-ec8daad7dadc','whatsapp','525579179921','sitio_propio','alta','raspado-top'),
('b97da424-d911-46c6-96f0-a53f8af26bd6','whatsapp','528136391003','sitio_propio','alta','raspado-top'),
('fe498d4e-deaf-4985-865a-8fde0c314344','email','ventas@opticagema.com.mx','sitio_propio','media','raspado-top'),
('fe498d4e-deaf-4985-865a-8fde0c314344','whatsapp','525627418583','sitio_propio','alta','raspado-top'),
('78638245-e3d3-4519-bfed-a5b2d3d0d15f','whatsapp','525517448241','sitio_propio','alta','raspado-top'),
('30801424-ca55-49f3-bc3b-ba135bcf612c','email','info@favitelas.com','sitio_propio','media','raspado-top'),
('be864c0b-2338-42cf-a78c-9e11927cd4b4','email','empresarial@opticavilook.com','sitio_propio','media','raspado-top'),
('be864c0b-2338-42cf-a78c-9e11927cd4b4','whatsapp','524427809748','sitio_propio','alta','raspado-top'),
('13afea7a-64d8-4422-b50b-15c8395929cc','email','contacto@plasticoseltio.com.mx','sitio_propio','media','raspado-top'),
('13afea7a-64d8-4422-b50b-15c8395929cc','whatsapp','525570090212','sitio_propio','alta','raspado-top'),
('fd445e1b-f887-4311-9ff4-bc37405504a3','email','atencionaclientes@veana.com','sitio_propio','media','raspado-top'),
('a9ee1f64-615a-4169-ac1c-e7dafb49ff07','whatsapp','527225560013','sitio_propio','alta','raspado-top'),
('668d732e-0b87-48e5-b7d3-a497d691cac2','whatsapp','525563896285','sitio_propio','alta','raspado-top'),
('fd5873dc-513d-41c2-8ee4-790faaa34431','whatsapp','525516960757','sitio_propio','alta','raspado-top'),
('40676076-064e-43e0-ad19-857ba0ea6fce','whatsapp','529991262332','sitio_propio','alta','raspado-top'),
('94690d47-7c4a-4d9f-8193-a040f65167a1','email','info@soybissu.com','sitio_propio','media','raspado-top'),
('1c2c27bd-582b-490f-8d74-75ce72cf8d5a','email','chuz77z@gmail.com','sitio_propio','media','raspado-top'),
('b9e82edf-57bd-423c-905b-fd1429a1934f','email','info@tuxedosvictors.com','sitio_propio','media','raspado-top'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','email','info@opticalorentzdejuarez.com.mx','sitio_propio','media','raspado-top'),
('1a3d6037-413d-445a-9d5a-12a55dfb5c7d','whatsapp','526563604060','sitio_propio','alta','raspado-top'),
('9f85670b-3f7b-4995-a8a6-b0304a744b76','whatsapp','523337872430','sitio_propio','alta','raspado-top'),
('d844243b-66b2-4d64-849c-4080dafe9a18','whatsapp','526623002087','sitio_propio','alta','raspado-top'),
('71a8858e-529a-42a8-aece-c15d7bece80b','whatsapp','524773833912','sitio_propio','alta','raspado-top'),
('635313dc-946d-47e3-bb81-bf3e661541ba','email','lorygil.cabo@gmail.com','sitio_propio','media','raspado-top'),
('210c6cac-927e-4f80-9958-3a62519380f8','email','garriaga@atleticos.com.mx','sitio_propio','media','raspado-top'),
('6998f232-2cbb-48d8-b822-255a3d93ee60','whatsapp','525531658139','sitio_propio','alta','raspado-top'),
('4b0aaba5-408a-4486-a101-fe6db52f6a5e','whatsapp','526621396339','sitio_propio','alta','raspado-top'),
('a80005a7-67ad-4005-9abe-180c54d7f625','email','info@sposabridal.mx','sitio_propio','media','raspado-top'),
('c03c432c-626a-4d7c-b968-1db28a7bdc96','whatsapp','522214144509','sitio_propio','alta','raspado-top'),
('812b651b-7b31-4599-8284-9a0b9ec48064','whatsapp','525571938391','sitio_propio','alta','raspado-top'),
('7e8e1136-5766-4dfb-9118-99ef44e1c33a','whatsapp','529993155009','sitio_propio','alta','raspado-top'),
('133558cd-6212-4893-b016-e57536f406f1','email','servicioaclientes@discalse.com','sitio_propio','media','raspado-top'),
('ca8da1c2-861c-40b0-bf20-d895804967d3','email','centrodegraduaciones@gmail.com','sitio_propio','media','raspado-top'),
('bea3c06c-2d31-471b-ae4b-5291ed87da8e','email','l.luna@tejidosgaytan.com.mx','sitio_propio','media','raspado-top'),
('dc4e71dd-81c0-4645-8de8-99b4227edddd','email','contacto@zapatoagil.com','sitio_propio','media','raspado-top'),
('58e1f0cf-078b-4440-b4fd-9bef258d931c','whatsapp','522227095349','sitio_propio','alta','raspado-top'),
('3d1c7560-5bd0-4e4a-b303-06b4271faaab','whatsapp','525561894779','sitio_propio','alta','raspado-top'),
('fd73b44e-41f7-44e3-821f-aafde8b6960a','email','contacto@giorgio.icu','sitio_propio','media','raspado-top'),
('fd73b44e-41f7-44e3-821f-aafde8b6960a','whatsapp','525574343534','sitio_propio','alta','raspado-top'),
('cda5e406-daa5-436b-82d3-227586363084','email','contacto@mxoptix.mx','sitio_propio','media','raspado-top'),
('cda5e406-daa5-436b-82d3-227586363084','whatsapp','522281094714','sitio_propio','alta','raspado-top'),
('e6fddaf6-829c-4a19-b40b-a4718057d309','email','soluciones@guayaberasycamisas.com','sitio_propio','media','raspado-top'),
('14de0dac-640a-4be7-9d96-9e0bef574901','email','contacto@okulux.mx','sitio_propio','media','raspado-top'),
('14de0dac-640a-4be7-9d96-9e0bef574901','whatsapp','524421255097','sitio_propio','alta','raspado-top'),
('50092d20-0a05-4a86-aad0-9f557c51aacb','email','contacto@deportextil.com','sitio_propio','media','raspado-top'),
('50092d20-0a05-4a86-aad0-9f557c51aacb','whatsapp','525567086651','sitio_propio','alta','raspado-top'),
('70720b30-055f-41f1-8424-f568053051ce','email','contacto@luzo.info','sitio_propio','media','raspado-top'),
('04f28815-81fa-4fdf-ba53-86e243bb6483','email','ecommerceoficial@berlei.com.mx','sitio_propio','media','raspado-top'),
('d7a8e361-8b1f-41f5-a46f-e9fc2d76e277','email','info@ciceg.org','sitio_propio','media','raspado-top'),
('1b08c9fe-7941-4899-83c7-43cc7acc128b','email','ventas@textilesdelfuturo.com.mx','sitio_propio','media','raspado-top'),
('19b0da46-a833-467e-9cce-4b44f78309eb','email','ventas@lacasadelrebozo.com.mx','sitio_propio','media','raspado-top'),
('b1817940-06cb-4fa2-bb57-38ae49a51942','email','info@bwigroup.com','sitio_propio','media','raspado-top'),
('16dd6a11-0748-4ef5-a46f-890c760282d7','email','ventas@hovers.com.mx','sitio_propio','media','raspado-top'),
('16dd6a11-0748-4ef5-a46f-890c760282d7','whatsapp','528181754857','sitio_propio','alta','raspado-top'),
('401d3296-2eb9-4171-9624-9463158e063e','email','ucmolegario@yahoo.com.mx','sitio_propio','media','raspado-top'),
('d1239268-f4f2-410a-bff5-a35825c6d798','email','mundoinfantil.dgo@gmail.com','sitio_propio','media','raspado-top'),
('d1239268-f4f2-410a-bff5-a35825c6d798','whatsapp','526181844220','sitio_propio','alta','raspado-top'),
('870fe4ef-10e8-491e-8219-68de23f676d7','whatsapp','525611720577','sitio_propio','alta','raspado-top'),
('6c26a25e-54cd-4d6e-9245-625058dd3c65','email','drchef.jacal@gmail.com','sitio_propio','media','raspado-top'),
('6c26a25e-54cd-4d6e-9245-625058dd3c65','whatsapp','524427482539','sitio_propio','alta','raspado-top'),
('5b58935c-c6a5-4697-a8d7-fbe77181897f','email','ventasweb@vertimania.com','sitio_propio','media','raspado-top'),
('5b58935c-c6a5-4697-a8d7-fbe77181897f','whatsapp','523313370590','sitio_propio','alta','raspado-top'),
('a87d856a-3b7b-4175-97d3-8e3919c24d8f','email','contacto@sterling.fashion','sitio_propio','media','raspado-top'),
('a87d856a-3b7b-4175-97d3-8e3919c24d8f','whatsapp','525519079298','sitio_propio','alta','raspado-top'),
('0197411b-f15b-4fea-9c00-922dd076e07d','email','bcbvictoria@hotmail.com','sitio_propio','media','raspado-top'),
('0197411b-f15b-4fea-9c00-922dd076e07d','whatsapp','528992051673','sitio_propio','alta','raspado-top'),
('01f4b2be-cfaf-49e5-814f-50e0b6ba7122','email','uniformes.donza@outlook.com','sitio_propio','media','raspado-top'),
('74bce925-ec2d-415b-932c-e91c8c09dafd','email','ventas@hefestosmoda.com','sitio_propio','media','raspado-top'),
('74bce925-ec2d-415b-932c-e91c8c09dafd','whatsapp','529513328160','sitio_propio','alta','raspado-top'),
('4f6eb524-632f-4c61-afc4-3af4ec72b02b','email','opticas@caryera.mx','sitio_propio','media','raspado-top'),
('4f6eb524-632f-4c61-afc4-3af4ec72b02b','whatsapp','526563110094','sitio_propio','alta','raspado-top'),
('c3b2176c-473b-4f66-b888-e50ad52c054c','email','contacto@zapatoguante.com','sitio_propio','media','raspado-top'),
('2dec9dfe-4215-4970-a6d6-09487cb68141','email','mexico@lazzarmexico.com','sitio_propio','media','raspado-top'),
('65c330fe-d064-4225-8929-4cdc80f61492','whatsapp','527717726424','sitio_propio','alta','raspado-top'),
('e71cb596-6af7-4abf-89a4-87de83c7a762','email','ayuda@dorothygaynor.com','sitio_propio','media','raspado-top'),
('e71cb596-6af7-4abf-89a4-87de83c7a762','whatsapp','525532488222','sitio_propio','alta','raspado-top'),
('d2e8eb4e-b1c8-4db5-be99-28136977afe4','email','contacto@tecnosocks.com','sitio_propio','media','raspado-top'),
('376e1986-d5b9-4880-95f9-912dba58897e','email','info@textilregiomontana.com.mx','sitio_propio','media','raspado-top'),
('376e1986-d5b9-4880-95f9-912dba58897e','whatsapp','528136202797','sitio_propio','alta','raspado-top'),
('6c161422-92e1-4415-b82e-0c5e8d000019','whatsapp','524425761518','sitio_propio','alta','raspado-top'),
('934bd69d-612b-41a1-aab4-2d728daf6aae','email','proviamiga@mundoprovidencia.com','sitio_propio','media','raspado-top'),
('5c7020ef-257e-4652-9515-61ab4ec6db04','email','info@excelenciaoptica.com.mx','sitio_propio','media','raspado-top'),
('5c7020ef-257e-4652-9515-61ab4ec6db04','whatsapp','529931354425','sitio_propio','alta','raspado-top'),
('11219b5e-fad7-4616-aec7-5409669632ad','whatsapp','524439345516','sitio_propio','alta','raspado-top'),
('3d026714-ebe2-4b8e-82af-34c7a5a2ae63','email','tienda@pirouette.mx','sitio_propio','media','raspado-top'),
('3ea9bb9f-b03c-403e-9ccc-5adb317b5194','email','ventas@vestidosnatbridal.com','sitio_propio','media','raspado-top'),
('3ea9bb9f-b03c-403e-9ccc-5adb317b5194','whatsapp','525578785378','sitio_propio','alta','raspado-top'),
('84524b22-9868-45a8-83a4-77858ebf577c','whatsapp','522721913486','sitio_propio','alta','raspado-top'),
('acba8fbb-7208-4e3b-bd1b-a8c0fd26c252','email','servicio@highlife.com.mx','sitio_propio','media','raspado-top'),
('acba8fbb-7208-4e3b-bd1b-a8c0fd26c252','whatsapp','525548036379','sitio_propio','alta','raspado-top'),
('088dd8e8-7a4d-4665-bd59-b3f771f595f1','email','mondepell@gmail.com','sitio_propio','media','raspado-top'),
('3e62a6a1-7fd1-4909-abf7-179b5d4c33ef','whatsapp','528120065308','sitio_propio','alta','raspado-top'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','email','info@elybride.com','sitio_propio','media','raspado-top'),
('3e2039ca-daf4-4d60-8d67-e7630a864978','whatsapp','529988977717','sitio_propio','alta','raspado-top'),
('d77932de-6c69-4230-8ced-1b1bfa148400','email','mercerias.net@gmail.com','sitio_propio','media','raspado-top'),
('3d3cea7b-fff9-4c6b-93d3-235d7eb06369','email','ventas@fravel.com.mx','sitio_propio','media','raspado-top'),
('3d3cea7b-fff9-4c6b-93d3-235d7eb06369','whatsapp','524499710924','sitio_propio','alta','raspado-top'),
('533b8982-1a98-485d-a510-2c2a91250533','email','opticostampico@hotmail.com','sitio_propio','media','raspado-top'),
('533b8982-1a98-485d-a510-2c2a91250533','whatsapp','528335260760','sitio_propio','alta','raspado-top'),
('337de5fd-27fb-49dc-9192-cb8dcb5053d1','email','help@help.desigual.com','sitio_propio','media','raspado-top'),
('1c85a9ab-f14f-4084-ab90-3fd8d095bbaa','whatsapp','523316972569','sitio_propio','alta','raspado-top'),
('129efa40-f59b-46d7-a408-12f66a8b04ad','whatsapp','525578343522','sitio_propio','alta','raspado-top'),
('252e0f85-8981-41b7-b38f-293db092a3ad','email','impresiones@gutink.mx','sitio_propio','media','raspado-top'),
('252e0f85-8981-41b7-b38f-293db092a3ad','whatsapp','523318669441','sitio_propio','alta','raspado-top'),
('1905828a-8f2d-438c-9014-a7a58020dde3','email','atenciononline@duo.com.mx','sitio_propio','media','raspado-top'),
('1905828a-8f2d-438c-9014-a7a58020dde3','whatsapp','526682360911','sitio_propio','alta','raspado-top'),
('b6f2075c-a357-48b3-90af-293f39d70493','email','yumuri@yumuri.com.mx','sitio_propio','media','raspado-top'),
('67da96fa-12e5-4d9d-97ca-13aa3aa414a7','email','opticamadero@opticahera.com','sitio_propio','media','raspado-top'),
('67da96fa-12e5-4d9d-97ca-13aa3aa414a7','whatsapp','525585734647','sitio_propio','alta','raspado-top'),
('711fde91-4965-45dd-800d-1c819b154f38','email','playeraspersonalizadasmx23@gmail.com','sitio_propio','media','raspado-top'),
('711fde91-4965-45dd-800d-1c819b154f38','whatsapp','525568803076','sitio_propio','alta','raspado-top'),
('66770fd9-18fb-4e77-b9ac-91241739156a','email','ventas@rematedebotas.com.mx','sitio_propio','media','raspado-top'),
('b2ea1aa9-c8f9-4345-8572-4d957ec99e86','email','opticavisualook@gmail.com','sitio_propio','media','raspado-top'),
('2fa0bf16-f9fc-49d6-97f4-00478853a8c3','email','oxanashekh@gmail.com','sitio_propio','media','raspado-top'),
('2fa0bf16-f9fc-49d6-97f4-00478853a8c3','whatsapp','528126440236','sitio_propio','alta','raspado-top'),
('95399faf-f37d-4de1-9327-75c2cddc8690','email','galeria.optica0@gmail.com','sitio_propio','media','raspado-top'),
('1f9fef63-6da4-42f6-8871-d125c5f3babf','email','ventas@latijera.mx','sitio_propio','media','raspado-top'),
('ee1868ea-126c-4205-b970-76c4d9bb15fd','whatsapp','525579475941','sitio_propio','alta','raspado-top'),
('e67fcf69-6fa7-4630-927b-98c2191c14a4','whatsapp','525565085710','sitio_propio','alta','raspado-top'),
('e2ada293-4e65-427b-8127-46b1417a2352','email','calicuse@yahoo.com.mx','sitio_propio','media','raspado-top'),
('d80d99d1-945d-4f84-88e6-effe5dec9cf5','email','info@canaive.mx','sitio_propio','media','raspado-top'),
('d80d99d1-945d-4f84-88e6-effe5dec9cf5','whatsapp','525555887822','sitio_propio','alta','raspado-top'),
('9862b719-b249-4ba0-8d54-b1afc60b42bc','email','joel.cruz@lamaria.com.mx','sitio_propio','media','raspado-top'),
('2867dc8f-1b8d-46e9-b5c2-761ab8409cd5','email','compras@grupovios.com','sitio_propio','media','raspado-top'),
('2867dc8f-1b8d-46e9-b5c2-761ab8409cd5','whatsapp','525590158827','sitio_propio','alta','raspado-top'),
('431e2b5e-fbba-41e9-bce9-4f78eb10c6ed','email','contacto@promoscreativos.com','sitio_propio','media','raspado-top'),
('dd97aede-59ad-4503-aa71-4a651a0aebb6','email','tienda@andycalderon.com','sitio_propio','media','raspado-top'),
('dd97aede-59ad-4503-aa71-4a651a0aebb6','whatsapp','523322588791','sitio_propio','alta','raspado-top'),
('b05bfa51-33a3-42f1-8746-e4c87cdaa271','email','merca@apimex.org','sitio_propio','media','raspado-top'),
('b05bfa51-33a3-42f1-8746-e4c87cdaa271','whatsapp','524773938095','sitio_propio','alta','raspado-top'),
('ae7ce5f7-7c2b-43c0-bb89-1eef89295050','email','ventas@dicuniformes.mx','sitio_propio','media','raspado-top'),
('ae7ce5f7-7c2b-43c0-bb89-1eef89295050','whatsapp','522461453516','sitio_propio','alta','raspado-top'),
('4b69fd17-f18b-4f8a-9d51-ff9a2b0160e7','email','ventas@blackkissmx.com','sitio_propio','media','raspado-top'),
('0d11aafb-1949-4cc2-8dac-0dee13e62f89','email','info@candyshop.com.mx','sitio_propio','media','raspado-top'),
('2103cbb1-f503-4b44-a0f2-1e3470457214','whatsapp','525554682563','sitio_propio','alta','raspado-top'),
('527bd42d-7414-4797-a7b3-4f4b3ac5fb02','email','contacto@sary.com.mx','sitio_propio','media','raspado-top'),
('bde30ac4-6ae8-4598-b285-599bde364ff2','whatsapp','524771794796','sitio_propio','alta','raspado-top'),
('ce81327a-4ae5-42da-8cdc-0d8e75249ffd','whatsapp','523318474081','sitio_propio','alta','raspado-top'),
('cbd1f859-9cda-48c4-bfce-b6aecdfcbbe5','email','canaivetehuacan@gmail.com','sitio_propio','media','raspado-top'),
('6adbdd4a-9ac7-41a1-abeb-497a7adbef6e','whatsapp','525572482687','sitio_propio','alta','raspado-top'),
('760cc90f-c55d-48cf-848d-dd5ad037f411','email','info@visualmerchandisinglab.com','sitio_propio','media','raspado-top'),
('98b409e0-f523-486a-a2fd-a7b0769f9d4f','email','contacto@central-store.com.mx','sitio_propio','media','raspado-top'),
('44f43319-b65d-40b8-96c0-50e3f4eb9662','whatsapp','525648967642','sitio_propio','alta','raspado-top'),
('dbcceb96-dea8-461f-b65c-e7ba89ceb603','email','sales@elcharro1.com','sitio_propio','media','raspado-top'),
('4bdd28ba-468e-42c5-9111-6b0d8f932343','whatsapp','528114642039','sitio_propio','alta','raspado-top');

-- Redes: solo donde no había nada. No se pisa lo que ya estaba.
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/mulzaoutlet'), facebook=coalesce(facebook,'https://facebook.com/Outlet.Mulza') where id='477d8c56-234c-4d87-aada-491a15b4414d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/priceshoesoficial'), facebook=coalesce(facebook,'https://facebook.com/PriceShoes') where id='f7cbdfbe-c730-41dd-8d4b-b77aba2f3e9b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sapicamexico'), facebook=coalesce(facebook,'https://facebook.com/SAPICAMexico') where id='68db6ac0-d319-4ca3-a1c9-2ebcb0c0ec06';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/GranChapur'), facebook=coalesce(facebook,'https://facebook.com/GranChapur') where id='c90d67de-f822-4326-b00f-57843d3f942f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dax_mexico') where id='c69cff03-2bff-4068-b1ce-40b6a875bfc2';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/sharer.php') where id='ef15b116-3d46-44b1-a5d0-d1e22a6d6ffa';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/centrojoyerozocalo'), facebook=coalesce(facebook,'https://facebook.com/CentroJoyeroZocalo') where id='5f231744-ec70-47d2-9fe7-85b3b7d05c43';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/promodaoutlet'), facebook=coalesce(facebook,'https://facebook.com/PromodaOutlet') where id='3a6db856-f6fa-49c4-8d0a-7368459af7d0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/innovasport'), facebook=coalesce(facebook,'https://facebook.com/innovasport') where id='c8118aa0-f41d-45bd-8cce-c44356d995c4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/windsor_smoking_trajes') where id='3e7de61b-3fb6-405a-939e-1b7bb652a07f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dgloriajoyeria'), facebook=coalesce(facebook,'https://facebook.com/dgloriajoyeria') where id='25b97676-317c-4a7d-9490-43f6feae8db3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/macariadress'), facebook=coalesce(facebook,'https://facebook.com/macaria.dress') where id='0d240ce8-fc89-4fb5-8a54-b4cc83043fa1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/yulygiraldoimagen') where id='df468897-890d-4274-959d-132a68ad5251';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/el_legadomx'), facebook=coalesce(facebook,'https://facebook.com/el.legadomx') where id='e343b721-599f-48bd-afee-64cdacc0727e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/la.nueva.perla'), facebook=coalesce(facebook,'https://facebook.com/lanuevaperlatextil') where id='3089a6c6-bb2a-41d9-9031-e4ab1e352011';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/windsor_smoking_trajes') where id='d745d74b-d0a3-4150-8e40-27b5a681be80';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/conde.cpz'), facebook=coalesce(facebook,'https://facebook.com/CentroPlaterodeZacatecas') where id='df139fbe-810e-4ff0-8c50-8ffe24fa1091';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/yazbek_oficial') where id='fa2ff457-5147-47c6-adae-fa7f3ff486ac';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/carlo.mx'), facebook=coalesce(facebook,'https://facebook.com/carlogiovannivestidos') where id='5df6073a-86b0-46ef-a09d-c661c2a57e2f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='f8ff78ea-9adf-4375-a5ce-646c6c1c70ba';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/valma.playa'), facebook=coalesce(facebook,'https://facebook.com/VALMAPlayadelCarmen') where id='bf28a55b-6d8f-49d1-8d48-9c463c9463cd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/almadelunamx') where id='e81eb2d9-296e-4bef-bdb2-b9d7ea81a76c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/moutyjoyeria'), facebook=coalesce(facebook,'https://facebook.com/Moutyjoyeria') where id='5ae9834f-c13c-4f0b-aeca-3919fa3bf127';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/moonrodbrides'), facebook=coalesce(facebook,'https://facebook.com/MoonrodRentadevestidos') where id='f333ad0e-b722-48c0-9d97-158f4dee0e64';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/somostennisexpress'), facebook=coalesce(facebook,'https://facebook.com/TennisExpressMX') where id='3b432454-fc80-4b5d-9e24-ca5545e1115a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/RAJALANGIT77'), facebook=coalesce(facebook,'https://facebook.com/RAJALANGIT77') where id='688e9155-51f0-4c57-9d74-d46fc87c6f73';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/ellasboutiquemx'), facebook=coalesce(facebook,'https://facebook.com/ELLASboutiqueGDL') where id='0e47ad7f-0183-4d55-904e-b4791c579b4b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/carlotinaclothing'), facebook=coalesce(facebook,'https://facebook.com/CarlotinaClothing1') where id='07a314c8-ffcd-416f-b229-54f76457d7a0';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticasjarmar'), facebook=coalesce(facebook,'https://facebook.com/opticasjarmarchiapas') where id='3069d25c-5e20-4ea0-930a-5c9623813791';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elglobooficial'), facebook=coalesce(facebook,'https://facebook.com/elglobooficial') where id='3554b6ee-2fc1-4e46-b74d-69edc71cdcf6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='bf26414d-ab3f-4bdd-bb88-c6db69885dfd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tuzomaniaoficial'), facebook=coalesce(facebook,'https://facebook.com/tuzomania.of') where id='74863e07-6d1a-44d7-a503-33fc377a4b16';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/teepublic'), facebook=coalesce(facebook,'https://facebook.com/TeePubliccom-865099700332025') where id='a4bb3275-e006-4b08-824a-8bae9ba8e5a4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticablink'), facebook=coalesce(facebook,'https://facebook.com/opticasblink') where id='00dc2a01-ab64-4f79-962a-821abdca6983';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eurocotton'), facebook=coalesce(facebook,'https://facebook.com/EuroCottonOficial') where id='ed15c57d-c395-4d3e-8c35-ee71ecd1b19e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/2008') where id='dc65e85f-224b-4568-a137-a2741f88eb29';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/stax_shop'), facebook=coalesce(facebook,'https://facebook.com/stax.shop.mx') where id='f3cc24ca-7c8e-4b21-a830-ec8daad7dadc';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/gema_optica'), facebook=coalesce(facebook,'https://facebook.com/optigema') where id='fe498d4e-deaf-4985-865a-8fde0c314344';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/petipamexico'), facebook=coalesce(facebook,'https://facebook.com/Petipamx') where id='78638245-e3d3-4519-bfed-a5b2d3d0d15f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/favitelas'), facebook=coalesce(facebook,'https://facebook.com/favitelas') where id='30801424-ca55-49f3-bc3b-ba135bcf612c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticavilook'), facebook=coalesce(facebook,'https://facebook.com/opticavilook') where id='be864c0b-2338-42cf-a78c-9e11927cd4b4';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/veanamx'), facebook=coalesce(facebook,'https://facebook.com/VeanaMX') where id='fd445e1b-f887-4311-9ff4-bc37405504a3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/corseterialaconchita'), facebook=coalesce(facebook,'https://facebook.com/corseterialaconchita') where id='a9ee1f64-615a-4169-ac1c-e7dafb49ff07';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='adcc96ae-637f-4ef6-bfc8-060daa50e471';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/holofdresses') where id='a0c37276-8a95-4dba-a53b-a194008e1096';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/moduss_shoes'), facebook=coalesce(facebook,'https://facebook.com/SafetyOffshore') where id='781323a6-7a1b-4a2b-85b2-f39346a6f2ed';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/skmed_uniforme_medico'), facebook=coalesce(facebook,'https://facebook.com/Sk-Med-Uniformes-M') where id='fd5873dc-513d-41c2-8ee4-790faaa34431';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lamarinatienda'), facebook=coalesce(facebook,'https://facebook.com/lamarinatienda') where id='1c0ad49a-2b27-4d01-b416-b9bbf706237e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='e24a97b3-347e-4c34-89f1-ef94b474a309';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticasdelmayab.mid'), facebook=coalesce(facebook,'https://facebook.com/217534515648') where id='40676076-064e-43e0-ad19-857ba0ea6fce';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/soybissu'), facebook=coalesce(facebook,'https://facebook.com/SoyBissu') where id='94690d47-7c4a-4d9f-8193-a040f65167a1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zapotlanejogob'), facebook=coalesce(facebook,'https://facebook.com/GobiernoZapotlanejo') where id='1c2c27bd-582b-490f-8d74-75ce72cf8d5a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tuxedosvictorstijuana'), facebook=coalesce(facebook,'https://facebook.com/tuxedosvictorstijuana') where id='b9e82edf-57bd-423c-905b-fd1429a1934f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/instagram.com'), facebook=coalesce(facebook,'https://facebook.com/facebook.com') where id='1a3d6037-413d-445a-9d5a-12a55dfb5c7d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bellenovia'), facebook=coalesce(facebook,'https://facebook.com/BelleNoviaHermosillo') where id='7566729e-9eb2-48dc-a51e-55f6dd112d9a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bellenovia'), facebook=coalesce(facebook,'https://facebook.com/BelleNoviaHermosillo') where id='8c736ae3-046c-4237-8f01-30c428d4046c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='996be82a-4308-4554-864f-bb34e318a16d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/niceoficialmx'), facebook=coalesce(facebook,'https://facebook.com/NICEoficialmx') where id='9f85670b-3f7b-4995-a8a6-b0304a744b76';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/goena.trajes') where id='d844243b-66b2-4d64-849c-4080dafe9a18';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/LorygilCSL') where id='635313dc-946d-47e3-bb81-bf3e661541ba';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/guayaberas_yucatecas_mayabki'), facebook=coalesce(facebook,'https://facebook.com/GuayaberasYucatecasMayabki') where id='6998f232-2cbb-48d8-b822-255a3d93ee60';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/textilessanantonio'), facebook=coalesce(facebook,'https://facebook.com/textilessanantoniogdl') where id='d38489cf-7d99-42e1-8c1c-ca06d69bd7ef';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/encantodress'), facebook=coalesce(facebook,'https://facebook.com/encantodressrental') where id='7f1b3a68-36ca-4ec4-89cf-15253aac7a30';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eraseunavez0110'), facebook=coalesce(facebook,'https://facebook.com/EraseUnaVez0110') where id='3a13c117-7516-4f4a-a183-ae00cd5f4a48';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sposa_bridal_bc'), facebook=coalesce(facebook,'https://facebook.com/sposabridaltj') where id='a80005a7-67ad-4005-9abe-180c54d7f625';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/la_gran_bodega_del_bebe'), facebook=coalesce(facebook,'https://facebook.com/La.Gran.Bodega.del.Bebe') where id='c03c432c-626a-4d7c-b968-1db28a7bdc96';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='7c8235de-6a1a-498f-bdd5-0bd29681eef1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/colorsublime'), facebook=coalesce(facebook,'https://facebook.com/colorsublime.mx') where id='812b651b-7b31-4599-8284-9a0b9ec48064';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/toursexpo') where id='ca8da1c2-861c-40b0-bf20-d895804967d3';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Tejidos-Gayt') where id='bea3c06c-2d31-471b-ae4b-5291ed87da8e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zapatoagiloficial'), facebook=coalesce(facebook,'https://facebook.com/zapato.agil.96') where id='dc4e71dd-81c0-4645-8de8-99b4227edddd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/allegrodancestore') where id='58e1f0cf-078b-4440-b4fd-9bef258d931c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/barbiboo1'), facebook=coalesce(facebook,'https://facebook.com/zazadancewearmonterrey') where id='3d1c7560-5bd0-4e4a-b303-06b4271faaab';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/mx.optix'), facebook=coalesce(facebook,'https://facebook.com/mx.optix') where id='cda5e406-daa5-436b-82d3-227586363084';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/guayaberasycamisasmare'), facebook=coalesce(facebook,'https://facebook.com/guayaberasycamisasmare') where id='e6fddaf6-829c-4a19-b40b-a4718057d309';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tuleblancbridalboutique'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='44b42f78-e0c0-47b3-b62b-2401fa539073';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticalia_okulux'), facebook=coalesce(facebook,'https://facebook.com/OKuluX') where id='14de0dac-640a-4be7-9d96-9e0bef574901';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='e4c65a28-a0d8-4f16-b894-21d229d901ef';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/deportextil'), facebook=coalesce(facebook,'https://facebook.com/vistiendoaldeporte') where id='50092d20-0a05-4a86-aad0-9f557c51aacb';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/luzoopticas'), facebook=coalesce(facebook,'https://facebook.com/luzoopticas') where id='70720b30-055f-41f1-8424-f568053051ce';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/telasylonasvaldesmx'), facebook=coalesce(facebook,'https://facebook.com/telasylonasvaldesmx') where id='98a0543a-97ea-43af-a976-3503f99ba60c';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/TiendasRodriguez') where id='5cfc7297-3a1c-4917-bbe1-e9854e7b99df';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hospitaldelentesmichoacan'), facebook=coalesce(facebook,'https://facebook.com/wix') where id='fb736788-7c68-42a9-8b80-a766e7eec3bf';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/textiles_del_futuro'), facebook=coalesce(facebook,'https://facebook.com/textilesdelfuturo') where id='1b08c9fe-7941-4899-83c7-43cc7acc128b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unitamoficial'), facebook=coalesce(facebook,'https://facebook.com/UnitamUniformesOficial') where id='549f1a1a-0d76-4cae-90f3-ebe9255b2dc8';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hovers.mx'), facebook=coalesce(facebook,'https://facebook.com/hovers.mx') where id='16dd6a11-0748-4ef5-a46f-890c760282d7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/mundoinfantildgo'), facebook=coalesce(facebook,'https://facebook.com/MundoInfantilDgo') where id='d1239268-f4f2-410a-bff5-a35825c6d798';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/providenciacobertores'), facebook=coalesce(facebook,'https://facebook.com/ProvidenciaCobertores') where id='8f0dd380-34f3-44b2-b452-81357b5901ec';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/maisonmetales') where id='870fe4ef-10e8-491e-8219-68de23f676d7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/doctor.chef_'), facebook=coalesce(facebook,'https://facebook.com/doctorchefqueretaro') where id='6c26a25e-54cd-4d6e-9245-625058dd3c65';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/vertimania'), facebook=coalesce(facebook,'https://facebook.com/vertimania') where id='5b58935c-c6a5-4697-a8d7-fbe77181897f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sterlingapparellc'), facebook=coalesce(facebook,'https://facebook.com/sterlingFashion') where id='a87d856a-3b7b-4175-97d3-8e3919c24d8f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lafestadisfraces'), facebook=coalesce(facebook,'https://facebook.com/lafestadisfraces') where id='401bceb1-d30e-427c-8bd8-3573ddb64261';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/hefestosmoda'), facebook=coalesce(facebook,'https://facebook.com/HefestosModa') where id='74bce925-ec2d-415b-932c-e91c8c09dafd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/casasofiabodas'), facebook=coalesce(facebook,'https://facebook.com/Casasofiabodas') where id='6296cbb6-c5a1-4239-b3f8-77886e74dc2a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticascar.yera'), facebook=coalesce(facebook,'https://facebook.com/opticascaryera') where id='4f6eb524-632f-4c61-afc4-3af4ec72b02b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lazzarmexico'), facebook=coalesce(facebook,'https://facebook.com/LazzarMexicoUniformes') where id='2dec9dfe-4215-4970-a6d6-09487cb68141';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bimbaylola'), facebook=coalesce(facebook,'https://facebook.com/BimbayLolaOfficial') where id='92069039-923f-453b-9172-9b9d018123e9';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dorothygaynor'), facebook=coalesce(facebook,'https://facebook.com/DorothyGaynorOficial') where id='e71cb596-6af7-4abf-89a4-87de83c7a762';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/DanielseHijos') where id='50ec116e-50fb-45df-b338-e12048df8194';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/TextilRegiomontana'), facebook=coalesce(facebook,'https://facebook.com/TextilRegiomontanaMty') where id='376e1986-d5b9-4880-95f9-912dba58897e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rentadevestidosunique'), facebook=coalesce(facebook,'https://facebook.com/uniqueqro') where id='6c161422-92e1-4415-b82e-0c5e8d000019';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Centronovias-1594891627416281') where id='3abf7b81-808c-419a-924b-4d9bf0fc935e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/providenciacobertores'), facebook=coalesce(facebook,'https://facebook.com/ProvidenciaCobertores') where id='934bd69d-612b-41a1-aab4-2d728daf6aae';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/excelenciaopticaoficial'), facebook=coalesce(facebook,'https://facebook.com/ExcelenciaOpticaOficial') where id='5c7020ef-257e-4652-9515-61ab4ec6db04';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/unimagdaoficial'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='11219b5e-fad7-4616-aec7-5409669632ad';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/pirouette.tiendadedanza'), facebook=coalesce(facebook,'https://facebook.com/pirouette.tiendadedanza') where id='3d026714-ebe2-4b8e-82af-34c7a5a2ae63';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dpstreet'), facebook=coalesce(facebook,'https://facebook.com/dpstreetmx') where id='527b262c-045d-47f9-8d04-484c225fd44f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/optica_espana'), facebook=coalesce(facebook,'https://facebook.com/opticaespana') where id='84524b22-9868-45a8-83a4-77858ebf577c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/highlife_mx'), facebook=coalesce(facebook,'https://facebook.com/highlifemexico') where id='acba8fbb-7208-4e3b-bd1b-a8c0fd26c252';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tostadasgallo') where id='4b4f9a69-c507-4af3-95af-52a647784f0b';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/truekids.com.mx'), facebook=coalesce(facebook,'https://facebook.com/truekids.com.mx') where id='7081b28e-c76f-4d7e-9f9f-c691196d064e';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/mondepell') where id='088dd8e8-7a4d-4665-bd59-b3f771f595f1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elybride_official'), facebook=coalesce(facebook,'https://facebook.com/elybridecdmx') where id='3e2039ca-daf4-4d60-8d67-e7630a864978';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/abastecedora.demercerias.1') where id='d77932de-6c69-4230-8ced-1b1bfa148400';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/tiscareno.mx'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='d16f7c5d-5048-4d07-98bd-420e575236ec';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/estacionopticamx'), facebook=coalesce(facebook,'https://facebook.com/estacionopticamx') where id='c0c99d46-8bd8-4f5b-80b0-9a77d3d91584';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticostampico') where id='533b8982-1a98-485d-a510-2c2a91250533';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/Desigual'), facebook=coalesce(facebook,'https://facebook.com/Desigual') where id='337de5fd-27fb-49dc-9192-cb8dcb5053d1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dm_cinturones') where id='1c85a9ab-f14f-4084-ab90-3fd8d095bbaa';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/scaparatoonline'), facebook=coalesce(facebook,'https://facebook.com/Scaparato') where id='129efa40-f59b-46d7-a408-12f66a8b04ad';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/sublimacionmonterreysadecv'), facebook=coalesce(facebook,'https://facebook.com/SublimacionMonterreySAdeCV') where id='9e6fe363-c417-45f2-a631-cf3ee31a2a0d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/duotiendas'), facebook=coalesce(facebook,'https://facebook.com/duotiendas') where id='1905828a-8f2d-438c-9014-a7a58020dde3';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/instagramforreplacement') where id='b6f2075c-a357-48b3-90af-293f39d70493';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/opticaheraoficial') where id='67da96fa-12e5-4d9d-97ca-13aa3aa414a7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/babycreysi'), facebook=coalesce(facebook,'https://facebook.com/babycreysi') where id='6c91870d-2f65-4312-8d53-8f2c823579a1';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/playeras_personalizadas.mx'), facebook=coalesce(facebook,'https://facebook.com/people') where id='711fde91-4965-45dd-800d-1c819b154f38';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/RemateDeBotas') where id='66770fd9-18fb-4e77-b9ac-91241739156a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/POPOTOGEL'), facebook=coalesce(facebook,'https://facebook.com/POPOTOGEL') where id='9d00f0a5-6d62-4178-b769-4b08be28eb5c';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/opticasvisuallook'), facebook=coalesce(facebook,'https://facebook.com/Opticasvisuallook') where id='b2ea1aa9-c8f9-4345-8572-4d957ec99e86';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/estradaboots'), facebook=coalesce(facebook,'https://facebook.com/estradaboots') where id='2fa0bf16-f9fc-49d6-97f4-00478853a8c3';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Galer') where id='95399faf-f37d-4de1-9327-75c2cddc8690';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/eva_brazzi'), facebook=coalesce(facebook,'https://facebook.com/EvaBrazziMx') where id='ee1868ea-126c-4205-b970-76c4d9bb15fd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rapsodiaoficial'), facebook=coalesce(facebook,'https://facebook.com/rapsodia.com.ar') where id='487a746f-fdff-4396-9c9a-db56105d4f1d';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/canaive'), facebook=coalesce(facebook,'https://facebook.com/464138890323687') where id='d80d99d1-945d-4f84-88e6-effe5dec9cf5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lamariapuebla'), facebook=coalesce(facebook,'https://facebook.com/fabricamariapuebla') where id='9862b719-b249-4ba0-8d54-b1afc60b42bc';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/vioscomer') where id='2867dc8f-1b8d-46e9-b5c2-761ab8409cd5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/promoscreativos'), facebook=coalesce(facebook,'https://facebook.com/promoscreativos') where id='431e2b5e-fbba-41e9-bce9-4f78eb10c6ed';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/doris_boutique'), facebook=coalesce(facebook,'https://facebook.com/dorisboutiqueonline') where id='63b61188-db0b-4337-a403-d124530f48bf';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/andycalderonsublimados') where id='dd97aede-59ad-4503-aa71-4a651a0aebb6';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/apimex_org'), facebook=coalesce(facebook,'https://facebook.com/apimexorg') where id='b05bfa51-33a3-42f1-8746-e4c87cdaa271';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/dic_uniformes') where id='ae7ce5f7-7c2b-43c0-bb89-1eef89295050';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/blackkissmx'), facebook=coalesce(facebook,'https://facebook.com/blackkissmx') where id='4b69fd17-f18b-4f8a-9d51-ff9a2b0160e7';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='d14a63c5-02ec-4100-9f92-dd03051ee2e5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/furor_products'), facebook=coalesce(facebook,'https://facebook.com/furorproductsmx') where id='7d0ff6bf-8334-4f48-b252-a6c3342acd51';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/candyshop.com.mx'), facebook=coalesce(facebook,'https://facebook.com/candyshop.com.mx') where id='0d11aafb-1949-4cc2-8dac-0dee13e62f89';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/musamaniquies'), facebook=coalesce(facebook,'https://facebook.com/musamaniquiesgdl') where id='3cd1f39e-cdf9-4e4d-b4fd-d48f9f2da69d';
update abm_cuentas set facebook=coalesce(facebook,'https://facebook.com/Juan-de-Dios-Alvarez-Ramos-Especialista-') where id='2103cbb1-f503-4b44-a0f2-1e3470457214';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/zapatossary'), facebook=coalesce(facebook,'https://facebook.com/ZapatosSary') where id='527bd42d-7414-4797-a7b3-4f4b3ac5fb02';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/lamorraleriaoficial'), facebook=coalesce(facebook,'https://facebook.com/lamorraleria') where id='bde30ac4-6ae8-4598-b285-599bde364ff2';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/puntoexpomoda'), facebook=coalesce(facebook,'https://facebook.com/puntoexpomoda') where id='ce81327a-4ae5-42da-8cdc-0d8e75249ffd';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/canaivetehuacan'), facebook=coalesce(facebook,'https://facebook.com/CAINVESTEH') where id='cbd1f859-9cda-48c4-bfce-b6aecdfcbbe5';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='6e968ab9-e7c4-45b8-afcd-3a946c31823a';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/rsrc.php') where id='91f8b308-3f7e-49f5-9f65-23fd8801c298';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/bonavimx'), facebook=coalesce(facebook,'https://facebook.com/Bonavimx') where id='6adbdd4a-9ac7-41a1-abeb-497a7adbef6e';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/visualmerchandisinglab'), facebook=coalesce(facebook,'https://facebook.com/2008') where id='760cc90f-c55d-48cf-848d-dd5ad037f411';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/centralstore.mx'), facebook=coalesce(facebook,'https://facebook.com/centralstoremx') where id='98b409e0-f523-486a-a2fd-a7b0769f9d4f';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/badvibes.mx'), facebook=coalesce(facebook,'https://facebook.com/666badvibes') where id='44f43319-b65d-40b8-96c0-50e3f4eb9662';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/soulsnkrstore'), facebook=coalesce(facebook,'https://facebook.com/SOULSNKRS') where id='48df5ffc-c2a4-46db-aaf8-d47d771de661';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/elcharro_de_elpaso'), facebook=coalesce(facebook,'https://facebook.com/Folkloricoshoes') where id='dbcceb96-dea8-461f-b65c-e7ba89ceb603';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/pompa_street_'), facebook=coalesce(facebook,'https://facebook.com/PompaStreet') where id='14382fea-02b3-4950-8c92-ed7eded9ec46';
update abm_cuentas set instagram=coalesce(instagram,'https://instagram.com/duncanista'), facebook=coalesce(facebook,'https://facebook.com/MajorSneakerStore') where id='71dead2c-c31b-46ce-ad98-3f27a80e6ecd';

-- Un sitio caído es señal de dolor, no un hueco de datos.
insert into abm_senales (cuenta_id, tipo, peso, origen, detalle, caduca_at) values
('842c3d90-6a3d-42f5-b951-108b49bcd911','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('de1036b0-98c2-4feb-905e-63db477957d4','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('59d5fd00-1114-461f-b3e8-03e4a36a3437','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('18d8fca7-582d-45a1-a172-9e6ea88dbc61','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('9565f8d9-cb2f-4c72-bbd1-bac36b87bf6c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('71521b01-1a41-4b7d-9c08-5f52f6891918','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c9f4546f-0a10-462b-a4e6-3be6d8a99ad7','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('8c0afe0d-bc47-4e41-b688-12616cbe0284','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f651369f-a566-452c-864f-8da84dbe1ce0','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('49bd9e48-981a-4ec8-a809-1d857cd0cdc5','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c2ca4d6a-5f44-485e-8255-d3c47e9ddf25','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('5e80293d-7560-4152-9d82-f13ef2f86170','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('3ba24426-6ff4-42bd-9ea5-1999fdc6f531','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('410f995b-89f4-464c-8e7d-e8b70ee6b02c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('2b0f01db-5a43-4e4f-a140-45991c9d110c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f0ce7235-5d6e-412b-b451-a0c378bb56ba','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('dcb8f389-220a-48ef-bfb6-88b400950880','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('56a58a13-8b46-4018-bf3c-bddc3190d37e','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('841bdfe2-0489-4bce-b9bf-a9958da31861','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('aa6e0f1a-b5f7-4ee1-b6f3-c11d2aa8a05c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('7cbee5c8-bfe6-4713-b966-0220d8a9a201','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('eec78eb3-cb02-4f52-87e1-2ed1320aeca2','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('13ddd0fe-1a2b-4b26-bbe8-3ace2b8272b7','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4be93951-48c9-4a07-ae44-d007fa2c27b3','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('c877589b-e0ee-4d65-b859-c9ef5d1f169e','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('b1dc4d93-3b0f-47e0-a9da-5d5d0a6ef059','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('cd49a2a6-6b53-4483-b753-727b324fc5bd','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('3e6c5055-32fb-4f05-af9b-468a84c66fab','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('00c8f390-b3ea-4573-8f88-9ea28a02dbe5','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('477b5f1f-9350-47bf-b5c0-66f95100edfb','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('886d97a7-814e-4adf-b0e1-6e697cc3195d','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('9d8c682a-28e3-42d7-8e41-2a8f008058be','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4928926e-3a3f-434b-86b0-a00f204ea125','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4039e712-42f0-4ba3-bb53-22756559ef28','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('280dbcd0-a190-4b38-8f55-dc9525b70700','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('afb5214c-df13-4a62-b045-ba70c8f36ff7','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('0efa31f3-fc79-4726-a327-0448fac9b2a0','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('5b06d807-eaa9-4234-b2d5-cdb3a51affbf','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('960360d3-fbea-46e2-b370-f0f5810d68cf','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('850ddb30-924b-4114-94b6-fe5c1c09ba74','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('1f0e68d7-0cbc-4e63-8dae-b016d1ad012c','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('952ddba7-3ebd-421a-bf9e-9123b022ede9','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('d8a3d637-f702-4f93-ac33-6d54beba44dd','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('4e59520d-a05a-4f75-8853-ee851d3a75bc','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('69ad1de6-de84-407c-a115-b910058c83b8','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('f6ddd2ae-f680-42bc-98f6-c3e20abb038e','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365),
('1a596a60-adf0-41a2-a779-e51294b84b62','sitio_caido',12,'raspado','Su sitio web ya no responde',current_date + 365)
on conflict do nothing;
