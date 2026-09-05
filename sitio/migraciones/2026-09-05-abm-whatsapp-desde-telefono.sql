-- WhatsApp deducido del telefono
-- Fuente: Plan Nacional de Numeracion publico del IFT (SNS), archivo
--         pnn_Publico_04_09_2026.zip bajado de
--         https://sns.ift.org.mx/sns-frontend/planes-numeracion/descarga-publica.xhtml
-- Regla: modalidad CPP o MPP en el plan = numero movil; en Mexico un movil de
--        10 digitos ES una cuenta de WhatsApp. Los FIJO, los 800/900 y los
--        rangos que el plan no clasifica quedaron FUERA.
-- Alta: canal whatsapp_tienda, confianza 'media', es_de_la_tienda = true.
-- Candado: el INSERT solo entra si la cuenta no tiene HOY ningun canal
--          whatsapp_* (se revisa dentro del propio statement, no solo al
--          generarlo), asi que correrlo dos veces no duplica nada.
-- Filas propuestas: 995   (cuentas distintas: 907)
BEGIN;

-- (995 filas de datos omitidas: el SQL completo se generó desde el plan del IFT
-- con scratchpad/pagina/aplica.py y clasifica_tel.py; se puede reproducir)
