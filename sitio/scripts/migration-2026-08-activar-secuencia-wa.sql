-- Se enciende la secuencia por evento y se apagan los flags que quedaron
-- muertos en wa_config: el acuse ya no se lee de ahí, y dejarlos en true
-- diría en la pantalla de Automatización algo que el código ya no obedece.
-- Los textos y el horario se quedan como respaldo histórico, no se borran.
update crm_secuencias set activa = true where disparador = 'wa_entrante';

update wa_config set bienvenida_activa = false, fuera_activa = false where id = 1;
