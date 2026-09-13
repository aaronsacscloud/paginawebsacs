-- 13-sep-2026 · El botón de la cadencia de leads va DIRECTO al agendador.
--
-- Los ocho correos cerraban con «Agendar mi sesión consultiva» apuntando a /contacto:
-- un formulario intermedio, dos clics de más justo en el momento de la conversión.
-- Ahora van a /agendar/demo, donde el lead elige horario y ya. Cada correo lleva su
-- utm_content (dia1…dia8) para saber CUÁL de los ocho es el que agenda — que es lo que
-- permite recortar la cadencia más adelante en vez de adivinar.

update email_templates set
  bloques = replace(bloques::text, 'https://www.sacscloud.com/contacto', 'https://www.sacscloud.com/agendar/demo?utm_source=cadencia_leads&utm_medium=email&utm_campaign=seguimiento&utm_content=dia1')::jsonb,
  html_compilado = null, texto_plano = null, updated_at = now()
where id = '085c5aee-cdf8-44b3-adff-610b246d5077';

update email_templates set
  bloques = replace(bloques::text, 'https://www.sacscloud.com/contacto', 'https://www.sacscloud.com/agendar/demo?utm_source=cadencia_leads&utm_medium=email&utm_campaign=seguimiento&utm_content=dia2')::jsonb,
  html_compilado = null, texto_plano = null, updated_at = now()
where id = '96c99772-d718-4623-8ed9-2bb10e792f55';

update email_templates set
  bloques = replace(bloques::text, 'https://www.sacscloud.com/contacto', 'https://www.sacscloud.com/agendar/demo?utm_source=cadencia_leads&utm_medium=email&utm_campaign=seguimiento&utm_content=dia3')::jsonb,
  html_compilado = null, texto_plano = null, updated_at = now()
where id = '81a3ea9d-b642-446c-b12e-44965e23cd97';

update email_templates set
  bloques = replace(bloques::text, 'https://www.sacscloud.com/contacto', 'https://www.sacscloud.com/agendar/demo?utm_source=cadencia_leads&utm_medium=email&utm_campaign=seguimiento&utm_content=dia4')::jsonb,
  html_compilado = null, texto_plano = null, updated_at = now()
where id = '041f45ee-fb54-43d1-8177-6583bb148a50';

update email_templates set
  bloques = replace(bloques::text, 'https://www.sacscloud.com/contacto', 'https://www.sacscloud.com/agendar/demo?utm_source=cadencia_leads&utm_medium=email&utm_campaign=seguimiento&utm_content=dia5')::jsonb,
  html_compilado = null, texto_plano = null, updated_at = now()
where id = '0a5e5a09-1122-447e-acc7-750eca29d769';

update email_templates set
  bloques = replace(bloques::text, 'https://www.sacscloud.com/contacto', 'https://www.sacscloud.com/agendar/demo?utm_source=cadencia_leads&utm_medium=email&utm_campaign=seguimiento&utm_content=dia6')::jsonb,
  html_compilado = null, texto_plano = null, updated_at = now()
where id = 'f32679f2-a98a-4c49-a004-bd7f25dbe5ce';

update email_templates set
  bloques = replace(bloques::text, 'https://www.sacscloud.com/contacto', 'https://www.sacscloud.com/agendar/demo?utm_source=cadencia_leads&utm_medium=email&utm_campaign=seguimiento&utm_content=dia7')::jsonb,
  html_compilado = null, texto_plano = null, updated_at = now()
where id = '55d84858-2358-4d66-b40f-4e95523d3e4d';

update email_templates set
  bloques = replace(bloques::text, 'https://www.sacscloud.com/contacto', 'https://www.sacscloud.com/agendar/demo?utm_source=cadencia_leads&utm_medium=email&utm_campaign=seguimiento&utm_content=dia8')::jsonb,
  html_compilado = null, texto_plano = null, updated_at = now()
where id = '8bfeaaa3-a21c-4f92-8561-c437ec98d314';
