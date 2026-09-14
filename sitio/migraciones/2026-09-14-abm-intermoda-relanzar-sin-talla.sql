-- Intermoda, primer lote (14-sep-2026): diez cuentas de joyería, bolsas,
-- cintos, gorras y velos se escribieron con el código viejo.
--
-- Qué pasó: el goteo corrió a las 10:00 CDMX y el arreglo de «tallas vs.
-- modelo y color» (sinTalla en abm-generar.ts) se desplegó a las 13:45. Los
-- 8 correos de estas diez cuentas hablan de «curva de tallas» a marcas que
-- venden aretes, carteras o velos. Ninguno salió: el disyuntor pausó el
-- cartero el mismo día por 3 rebotes, así que se borran sin consecuencia.
--
-- Cómo se arregla: se borran sus toques y vuelven a sin_tocar. Con cero
-- toques vuelven a ser elegibles y el goteo «Intermoda · cuarenta al día» las
-- toma mañana con el código ya desplegado, con su firma y su fecha, como a
-- cualquier otra —no se les inventa una cadencia a mano—. Quedan en el lote
-- de hoy (abm_goteo_lotes.detalle) como constancia de lo que pasó.
--
-- Las otras 30 (ropa, jeans, calzado, trajes con accesorios) hablan de tallas
-- y eso es correcto: se quedan como están.
create temp table _relanzar (id uuid) on commit drop;
insert into _relanzar values
  ('14ef0a84-238c-4f1c-a351-1982d9ded272'), -- TENDENCIAS ALTA COSTURA · accesorios de ceremonia
  ('1541d45d-7bec-4eec-90a8-9bc84e885ab5'), -- MARITZA BRIDAL VEILS · velos
  ('03f1bfbd-15f3-4a57-b661-c109ffccfa0b'), -- BUBBABAGS · carteras y mochilas
  ('02e83696-b3df-4166-bffb-d12db634791f'), -- CINTOS LUCY · cintos y bisutería
  ('1261c868-7c13-4bca-9c58-644cd99565ac'), -- FEELGO · cinturones
  ('0c31bda6-844a-4d94-83ff-528564965814'), -- VIDAL´S · billeteras y monederos
  ('146324ce-535a-4747-bc0b-3a74153ad8e7'), -- POLO CLUB / ZESTINI · gorras y carteras
  ('0ac5d8f5-3f00-4eb1-b9e4-f9acc4247d8d'), -- BRYANDA RIVAS COLLECTION · joyería
  ('0b67266b-f5bf-4da7-842b-7a92ee805557'), -- ELRA · joyería
  ('00c34915-6038-411f-8d5b-d72affd0f1f0'); -- FERRETINA · marroquinería

-- Seguro: nada de estas diez salió ya.
do $$ begin
  if exists (select 1 from abm_toques where cuenta_id in (select id from _relanzar) and estado not in ('borrador','aprobado')) then
    raise exception 'hay toques enviados o en curso: no se relanza';
  end if;
end $$;

delete from abm_toques where cuenta_id in (select id from _relanzar) and estado in ('borrador','aprobado');

update abm_cuentas set etapa = 'sin_tocar', updated_at = now()
 where id in (select id from _relanzar) and etapa = 'en_cadencia';

insert into abm_actividad (cuenta_id, canal, tipo, texto)
select id, 'sistema', 'nota',
  'Salió del lote del 14-sep-2026 del goteo «Intermoda · cuarenta al día»: sus correos se escribieron antes del arreglo de tallas vs. modelo y color y hablaban de curva de tallas. Ninguno se envió. Vuelve a sin_tocar para que el goteo la tome de nuevo con el guion correcto.'
from _relanzar;

update abm_goteo set enroladas = greatest(0, coalesce(enroladas, 0) - 10), updated_at = now()
 where id = 'd0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b12';
