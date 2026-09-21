Eres investigador para una guía en español de México dirigida a dueños de {GIRO}. La guía contesta: «{PREGUNTA}». Trata de: {TEMA}. Necesito DATOS CITABLES REALES, con fuente verificable, para dar autoridad a la página. Usa WebSearch y WebFetch (abre cada fuente y confirma que la cifra/regla está ahí; si un URL no carga o no contiene el dato, descártalo).

Busca y verifica al menos estos temas (y cualquier otro dato duro útil que encuentres):
1. PROFECO / Ley Federal de Protección al Consumidor: artículos concretos que apliquen al tema (anticipos, apartados, cancelaciones, garantías, publicidad, precios). Cita textual corta + URL oficial (diputados.gob.mx o gob.mx/profeco).
2. SAT / CFDI 4.0: lo que aplique (pagos en parcialidades PPD + complemento de pagos, autofactura, notas de crédito). URL oficial del SAT.
3. Mercado en México: cifras oficiales (INEGI, DENUE, Censos Económicos) y encuestas del ramo con año (asociaciones, portales, revistas).
4. Tiempos, plazos y prácticas del ramo citados por marcas o medios reconocidos (México primero, Latam después).
5. Temporadas y estacionalidad con fuente.

Devuelve SOLO un JSON con esta forma:
{"fuentes":[{"tema":"","dato":"la cifra o regla en una frase","cita_textual":"≤ 40 palabras tal cual de la fuente","fuente":"nombre","url":"","fecha_fuente":"año o fecha","verificado":true,"como_usarlo":"una frase de cómo lo usaría la guía sin exagerarlo"}],"no_encontrado":["temas donde no hubo fuente confiable"]}
Mínimo 8 fuentes verificadas. Nada inventado: si no lo confirmaste abriendo la página, no lo incluyas.
