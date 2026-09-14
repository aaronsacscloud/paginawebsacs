-- Tope diario del cartero en frío: 120 → 320.
--
-- Por qué: el 14-sep-2026 quedaron encendidos tres goteos a la vez
-- (Villa Hidalgo 10/día, SAPICA 40/día, Intermoda 40/día) = 90 cuentas nuevas
-- al día, y cada una trae 8 correos repartidos en 33 días. Con el techo en 120
-- la fila crecía más rápido de lo que salía. El dueño decidió subirlo a 320.
--
-- Lo que NO cambia: la rampa de calentamiento (cupo_inicial 15, ×1.3 cada 3
-- días con envíos) sigue mandando; el tope solo es hasta dónde puede llegar.
-- Y el disyuntor de rebotes/quejas sigue igual: ese mismo día se abrió con 3
-- rebotes de 15 envíos, así que el techo no es lo que hoy limita.
update abm_config
   set valor = '320',
       nota = 'Techo operativo de correos en frío por día, ya calentado el dominio. 120 → 320 el 14-sep-2026 por decisión del dueño (tres goteos a la vez).',
       updated_at = now()
 where clave = 'tope_diario';
