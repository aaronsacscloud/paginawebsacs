// PLANTILLAS DE SEGUIMIENTO DE CONSULTORÍA (29-sep-2026).
//
// Tres plantillas para reabrir una conversación con la ventana de 24 h cerrada, sin
// que suenen a plantilla:
//  - seguimiento_apertura_v1: el «Hola, ¿cómo estás?» con un hueco LIBRE para lo que
//    toque (la cotización pendiente, confirmar la reunión, «¿tuviste problema de
//    conexión?»…). Una sola plantilla sirve para todo porque el motivo lo escribe
//    quien la manda.
//  - prueba_datos_acceso_v1: pedir nombre y correo para crear la prueba gratis.
//  - prueba_accesos_listos_v1: la prueba ya quedó dada de alta: link, usuario y contraseña.
//
// Todas llevan grupo `seguimiento` («Seguimiento de consultoría» en el selector) y el
// nombre de quien escribe sale del CRM (campo `agente`), así sirve para Fernanda,
// Andrea o quien sea. Se crean en Meta vía Kapso y se registran en `wa_plantillas`.
//
//   KAPSO_API_KEY=… KAPSO_BUSINESS_ACCOUNT_ID=… SUPABASE_URL=… SUPABASE_SERVICE_KEY=… \
//     node scripts/crear-plantillas-seguimiento.mjs [--dry]
const DRY = process.argv.includes('--dry');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, KAPSO_API_KEY, KAPSO_BUSINESS_ACCOUNT_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !KAPSO_API_KEY || !KAPSO_BUSINESS_ACCOUNT_ID) {
  console.error('Faltan KAPSO_API_KEY, KAPSO_BUSINESS_ACCOUNT_ID, SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const META = 'https://api.kapso.ai/meta/whatsapp/v24.0';

const PLANTILLAS = [
  {
    nombre: 'seguimiento_apertura_v1', categoria: 'MARKETING',
    cuerpo: 'Hola {{1}}, ¿cómo estás? Soy {{2}}, de Sacscloud. Te escribo para dar seguimiento a lo que teníamos pendiente.\n\n{{3}}\n\nQuedo al pendiente por aquí, cualquier duda me dices.',
    variables_map: ['primer_nombre', 'agente', 'libre:Lo que le quieres decir'],
    ejemplos: ['Ana', 'Fernanda', 'Te comparto la cotización que nos quedó pendiente para que la revises con calma.'],
  },
  {
    nombre: 'prueba_datos_acceso_v1', categoria: 'UTILITY',
    cuerpo: 'Hola {{1}}, ¿cómo estás? Soy {{2}}, de Sacscloud. Ya estamos listos para crear tu acceso a la prueba gratis de Sacs.\n\n¿Me confirmas por aquí tu nombre completo y el correo con el que quieres que quede registrado? En cuanto me los pases, te genero tu usuario.',
    variables_map: ['primer_nombre', 'agente'],
    ejemplos: ['Ana', 'Fernanda'],
  },
  {
    nombre: 'prueba_accesos_listos_v1', categoria: 'UTILITY',
    cuerpo: 'Hola {{1}}, ¿cómo estás? Soy {{2}}, de Sacscloud. Tus accesos a la prueba gratis de Sacs ya quedaron registrados.\n\nEntra aquí: {{3}}\nUsuario: {{4}}\nContraseña: {{5}}\n\nSi algo no te deja entrar, respóndeme por aquí y lo resolvemos.',
    variables_map: ['primer_nombre', 'agente', 'libre:Link para entrar', 'email', 'libre:Contraseña'],
    ejemplos: ['Ana', 'Fernanda', 'https://app.sacscloud.com', 'ana@boutiqueana.com', 'Prueba2026'],
  },
];

const sb = async (ruta, init = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...init,
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.status === 204 || r.status === 201 ? null : r.json();
};

for (const p of PLANTILLAS) {
  const ya = await sb(`wa_plantillas?select=status&nombre=eq.${p.nombre}&idioma=eq.es_MX`);
  if (ya.length) { console.log(`= ${p.nombre}: ya existe (${ya[0].status}), se salta`); continue; }
  const components = [{ type: 'BODY', text: p.cuerpo, example: { body_text: [p.ejemplos] } }];
  if (DRY) { console.log(`· ${p.nombre} (${p.categoria})\n${p.cuerpo}\n`); continue; }
  const r = await fetch(`${META}/${KAPSO_BUSINESS_ACCOUNT_ID}/message_templates`, {
    method: 'POST', headers: { 'X-API-Key': KAPSO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: p.nombre, language: 'es_MX', category: p.categoria, components }),
  });
  const creada = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(`✗ ${p.nombre}: Meta ${r.status} ${JSON.stringify(creada).slice(0, 400)}`); continue; }
  await sb('wa_plantillas', {
    method: 'POST',
    body: JSON.stringify({
      meta_template_id: creada.id ? String(creada.id) : null,
      nombre: p.nombre, idioma: 'es_MX', categoria: creada.category || p.categoria, cuerpo: p.cuerpo,
      header_tipo: 'TEXT', variables: p.ejemplos.length, status: creada.status || 'PENDING',
      status_at: new Date().toISOString(), ejemplos: p.ejemplos, variables_map: p.variables_map, grupo: 'seguimiento',
    }),
  });
  console.log(`✓ ${p.nombre}: ${creada.status || 'PENDING'}`);
}
