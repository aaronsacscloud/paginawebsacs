-- Un campo con dos correos no es un correo inválido: son DOS correos. Se
-- parte el campo, el primero se queda en su canal y el resto entra aparte.
update abm_canales set valor='jvromo1@gmail.com' where id='15030ea8-f8dd-4d74-a63c-ba84baf2cb88';
update abm_canales set valor='gus_srm04@hotmail.com' where id='8961e718-3545-4a14-b0e6-a1c475bdedff';
update abm_canales set valor='ch957409822@gmail.com' where id='a87a9bd7-468e-404a-be74-7690c65de5a3';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','dingyanana@gmail.com','media',true,'sin_probar' from abm_canales where id='a87a9bd7-468e-404a-be74-7690c65de5a3'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='a87a9bd7-468e-404a-be74-7690c65de5a3') and lower(y.valor)=lower('dingyanana@gmail.com'));
update abm_canales set valor='artemiom@aspik.mx' where id='fcd63fc1-2e7c-4c5f-a107-8f066ba99985';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','marcos@dems.mx','media',true,'sin_probar' from abm_canales where id='fcd63fc1-2e7c-4c5f-a107-8f066ba99985'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='fcd63fc1-2e7c-4c5f-a107-8f066ba99985') and lower(y.valor)=lower('marcos@dems.mx'));
update abm_canales set valor='1242234910@qq.com' where id='ff119eb5-2530-4766-8cdb-cecb18c99d43';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','wjianjun00@gmail.com','media',true,'sin_probar' from abm_canales where id='ff119eb5-2530-4766-8cdb-cecb18c99d43'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='ff119eb5-2530-4766-8cdb-cecb18c99d43') and lower(y.valor)=lower('wjianjun00@gmail.com'));
update abm_canales set valor='isratex52@gmail.com' where id='7fe6d4dc-3dd0-4088-91c1-13561e6a0b91';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','dmannb123@gmail.com','media',true,'sin_probar' from abm_canales where id='7fe6d4dc-3dd0-4088-91c1-13561e6a0b91'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='7fe6d4dc-3dd0-4088-91c1-13561e6a0b91') and lower(y.valor)=lower('dmannb123@gmail.com'));
update abm_canales set valor='lovepointproveedores@gmail.com' where id='e9f9a58e-d8fc-47e5-a561-a14893d6df90';
update abm_canales set valor='rsalazar@lidermaq.net' where id='2a2d3607-9a0d-45e2-96ce-18acddb5c76e';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','fsantiago@lidermaq.net','media',true,'sin_probar' from abm_canales where id='2a2d3607-9a0d-45e2-96ce-18acddb5c76e'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='2a2d3607-9a0d-45e2-96ce-18acddb5c76e') and lower(y.valor)=lower('fsantiago@lidermaq.net'));
update abm_canales set valor='asami_ofic@outlook.com' where id='eb9f43cf-e488-4de9-860a-cd5956e3c43f';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','jorge.islas.salgado@icloud.com','media',true,'sin_probar' from abm_canales where id='eb9f43cf-e488-4de9-860a-cd5956e3c43f'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='eb9f43cf-e488-4de9-860a-cd5956e3c43f') and lower(y.valor)=lower('jorge.islas.salgado@icloud.com'));
update abm_canales set valor='textilesludemy@yahoo.com.mx' where id='e923e8fe-313d-4adc-b0db-e2c3fe0d5d4f';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','ferhanan@hotmail.com','media',true,'sin_probar' from abm_canales where id='e923e8fe-313d-4adc-b0db-e2c3fe0d5d4f'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='e923e8fe-313d-4adc-b0db-e2c3fe0d5d4f') and lower(y.valor)=lower('ferhanan@hotmail.com'));
update abm_canales set valor='lizperezrubio@gmail.com' where id='2f3d52ab-0fe0-4a74-ac6d-5c7ed5456110';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','printprint.textile@gmail.com','media',true,'sin_probar' from abm_canales where id='2f3d52ab-0fe0-4a74-ac6d-5c7ed5456110'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='2f3d52ab-0fe0-4a74-ac6d-5c7ed5456110') and lower(y.valor)=lower('printprint.textile@gmail.com'));
update abm_canales set valor='textilesravemy@gmail.com' where id='de942324-1df7-46a7-a752-5d661f45dfc8';
insert into abm_canales (cuenta_id,tipo,valor,confianza,es_de_la_tienda,estado)
select cuenta_id,'email_generico','textilesravemy1@gmail.com','media',true,'sin_probar' from abm_canales where id='de942324-1df7-46a7-a752-5d661f45dfc8'
  and not exists (select 1 from abm_canales y where y.cuenta_id=(select cuenta_id from abm_canales where id='de942324-1df7-46a7-a752-5d661f45dfc8') and lower(y.valor)=lower('textilesravemy1@gmail.com'));
update abm_canales set valor='hilda.gomez@telaslua.com.mx' where id='ce2c5bb9-e3fd-44fc-86c2-f5af3ed20595';
update abm_canales set valor='g.garcia670808@gmail.com' where id='206e30c5-5359-4bab-98b9-06906618a768';
-- Sin rescate posible:
update abm_canales set estado='invalido', confianza='baja' where id in ('b865c99b-97a0-4b48-ad7b-355b21ca1511','03c8e002-b87b-4fe9-83cd-7ef54e4f6fe5');
