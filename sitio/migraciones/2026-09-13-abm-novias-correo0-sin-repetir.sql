-- ⚠️ Se quita la línea de calificación del correo 0 de novias.
--
-- Con una sola tienda salía dos veces lo mismo, una debajo de la otra:
--   · Una sola tienda marcada como tal: 4.8★ con 106 reseñas sobre Paseo…
--   · 4.8 de calificación con 106 reseñas en Google.
-- Y eso en el correo que promete "no le escribo en automático": la repetición
-- delata exactamente lo contrario. Pasa porque las señales de novias YA traen
-- la calificación adentro (298 de 990 en toda la base, pero en novias casi
-- todas). Medido antes de quitarla: sin esa línea, CERO cuentas de novias se
-- quedan sin ningún hallazgo — la señal, la plataforma o las sucursales
-- siempre cubren. No se toca la variable {{rating}} en la librería porque la
-- usan otras 5 plantillas donde no hay señal que la repita.
update abm_plantillas
   set cuerpo = replace(cuerpo, '[[si rating]]
· {{rating}} de calificación con {{resenas}} reseñas en Google.[[/si]]', '')
 where giro='novias' and canal='email' and orden=0;
