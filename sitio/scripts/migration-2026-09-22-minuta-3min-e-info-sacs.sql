-- ══ MEJORAS CRM #2 y #3 (22-sep-2026) ══════════════════════════════════════

-- #2 · Minuta sólo en llamadas de MÁS de 3:00.
-- La llamada se registra igual y la grabación se guarda; lo que se omite es la
-- transcripción y la minuta. Aquí queda escrito por qué no tiene minuta, para
-- que nadie la busque ni la tome por un fallo.
alter table wa_llamadas add column if not exists minuta_omitida text;

-- #3 · «¿Me pueden mandar más información?» → mensaje personalizado + liga + PDF.
-- `permitido()` falla cerrado: sin esta fila la automatización no saldría nunca
-- y sin un solo error en ningún log. Nace ENCENDIDA: es algo que el prospecto
-- pidió, y el interruptor está para apagarla si molesta.
insert into wa_automatizaciones (clave, activa, nombre, categoria, nota)
values ('info_sacs', true,
        'Más información de Sacs (PDF + liga)', 'agente',
        'Cuando un prospecto pide más información, el agente le contesta personalizado con la liga a www.sacscloud.com y el PDF de Sacs. Fuera de la ventana de 24 h sale la plantilla de marketing con el PDF y, si Meta no la entrega, la de utilidad.')
on conflict (clave) do nothing;

notify pgrst, 'reload schema';

select clave, activa from wa_automatizaciones where clave = 'info_sacs';
