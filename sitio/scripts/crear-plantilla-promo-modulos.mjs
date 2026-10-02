// PLANTILLA DE PROMOCIÓN · MÓDULOS STAFF + ADMINISTRACIÓN (2-oct-2026).
//
// Oferta para clientes: los dos módulos tienen precio real de $18,550 en pago único y hoy
// se ofrecen completos en $5,389, pago único. Las descripciones de cada módulo son las del
// catálogo de la app (sacs3 · sacs-plugins: Staff y Administración).
//
// MARKETING (es una oferta) · grupo `promocion` («Promociones» en el selector) · el nombre
// de quien escribe sale del CRM (campo `agente`). Se crea en Meta vía Kapso y se registra
// en `wa_plantillas`, igual que scripts/crear-plantillas-seguimiento.mjs.
//
//   KAPSO_API_KEY=… KAPSO_BUSINESS_ACCOUNT_ID=… SUPABASE_URL=… SUPABASE_SERVICE_KEY=… \
//     node scripts/crear-plantilla-promo-modulos.mjs [--dry]
const DRY = process.argv.includes('--dry');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, KAPSO_API_KEY, KAPSO_BUSINESS_ACCOUNT_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !KAPSO_API_KEY || !KAPSO_BUSINESS_ACCOUNT_ID) {
  console.error('Faltan KAPSO_API_KEY, KAPSO_BUSINESS_ACCOUNT_ID, SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const META = 'https://api.kapso.ai/meta/whatsapp/v24.0';

const P = {
  nombre: 'promo_staff_admin_v1', categoria: 'MARKETING',
  cuerpo: 'Hola {{1}}, ¿cómo estás? Soy {{2}}, de Sacscloud. Te escribo porque tenemos una oferta especial para tu sistema.\n\n'
    + 'Los módulos de Staff (asistencia, turnos, permisos y desempeño de tu equipo) y Administración (gastos, bancos, pagos a proveedores y flujo de efectivo) tienen un precio real de $18,550 en pago único.\n\n'
    + 'Hoy te los dejamos completos en $5,389, también en pago único.\n\n'
    + '¿Te los activo? Respóndeme por aquí y te paso los detalles.',
  variables_map: ['primer_nombre', 'agente'],
  ejemplos: ['Ana', 'Fernanda'],
};

const sb = async (ruta, init = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...init,
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.status === 204 || r.status === 201 ? null : r.json();
};

const ya = await sb(`wa_plantillas?select=status&nombre=eq.${P.nombre}&idioma=eq.es_MX`);
if (ya.length) { console.log(`= ${P.nombre}: ya existe (${ya[0].status})`); process.exit(0); }
if (DRY) { console.log(P.cuerpo); process.exit(0); }
const r = await fetch(`${META}/${KAPSO_BUSINESS_ACCOUNT_ID}/message_templates`, {
  method: 'POST', headers: { 'X-API-Key': KAPSO_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: P.nombre, language: 'es_MX', category: P.categoria,
    components: [{ type: 'BODY', text: P.cuerpo, example: { body_text: [P.ejemplos] } }] }),
});
const creada = await r.json().catch(() => ({}));
if (!r.ok) { console.error(`✗ ${P.nombre}: Meta ${r.status} ${JSON.stringify(creada).slice(0, 400)}`); process.exit(1); }
await sb('wa_plantillas', {
  method: 'POST',
  body: JSON.stringify({
    meta_template_id: creada.id ? String(creada.id) : null,
    nombre: P.nombre, idioma: 'es_MX', categoria: creada.category || P.categoria, cuerpo: P.cuerpo,
    header_tipo: 'TEXT', variables: P.ejemplos.length, status: creada.status || 'PENDING',
    status_at: new Date().toISOString(), ejemplos: P.ejemplos, variables_map: P.variables_map, grupo: 'promocion',
  }),
});
console.log(`✓ ${P.nombre}: ${creada.status || 'PENDING'}`);
