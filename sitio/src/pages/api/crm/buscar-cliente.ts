// GET /api/crm/buscar-cliente?q=…   → empresas y contactos, leads y clientes juntos
// GET /api/crm/buscar-cliente?duplicado=nombre&email=…  → ¿ya existe algo parecido?
// POST { empresa, contacto, email, whatsapp }           → alta mínima, ligada
//
// Un solo buscador para las dos tablas a propósito: quien está cotizando no sabe
// —ni tiene por qué saber— si esa persona vive en contactos o su empresa en
// clientes. Separarlos obliga a adivinar dónde buscar y termina en que se
// escribe el nombre a mano y la cotización nace desligada, que es exactamente el
// problema: HOY las 32 cotizaciones activas no apuntan a ningún cliente.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const norm = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') || '').trim();
  const email = (url.searchParams.get('email') || '').trim();

  // ── Aviso de duplicado antes de crear ──
  // Detectar el parecido ANTES cuesta un query; fusionarlos después cuesta una
  // tarde. Así nacieron "Ruben's", "Ruben's Bridal" y "Rubens".
  if (url.searchParams.get('duplicado')) {
    const nombre = url.searchParams.get('duplicado') || '';
    const n = norm(nombre);
    const [{ data: porNombre }, { data: porCorreo }] = await Promise.all([
      supabase.from('companies').select('id, nombre, estado_cuenta').is('archived_at', null).limit(400),
      email ? supabase.from('contacts').select('id, nombre, email, company_id, companies(id, nombre)').ilike('email', email).limit(5) : Promise.resolve({ data: [] as any[] }),
    ]);
    // Coincidencia por contención, no exacta: "Rubens" y "Ruben's" solo se
    // parecen después de quitar acentos, signos y espacios.
    const parecidas = (porNombre || []).filter((c: any) => {
      const cn = norm(c.nombre);
      return cn && n && (cn === n || cn.includes(n) || n.includes(cn));
    }).slice(0, 5);
    return json({ empresas_parecidas: parecidas, contactos_mismo_correo: porCorreo || [] });
  }

  if (q.length < 2) return json({ resultados: [] });
  const like = `%${q}%`;

  const [{ data: empresas }, { data: contactos }] = await Promise.all([
    supabase.from('companies')
      .select('id, nombre, sacs_account, estado_cuenta, contacts(id, nombre, email, whatsapp, telefono, es_principal)')
      .is('archived_at', null).ilike('nombre', like).limit(8),
    supabase.from('contacts')
      .select('id, nombre, apellido, email, whatsapp, telefono, lifecycle_stage, tipo, company_id, companies(id, nombre, sacs_account, estado_cuenta)')
      .is('archived_at', null).or(`nombre.ilike.${like},email.ilike.${like},whatsapp.ilike.${like}`).limit(8),
  ]);

  // Contexto: cuántas cotizaciones tiene y cómo le fue a la última. Es lo que
  // evita el error más caro — recotizar sin saber que ya hay una viva.
  const companyIds = [
    ...(empresas || []).map((e: any) => e.id),
    ...(contactos || []).map((c: any) => c.company_id).filter(Boolean),
  ];
  const { data: cots } = companyIds.length
    ? await supabase.from('quotes').select('company_id, numero, total, estado, created_at')
        .in('company_id', companyIds).not('estado', 'in', '(deleted,plantilla)')
        .order('created_at', { ascending: false }).limit(200)
    : { data: [] as any[] };
  const ctx = new Map<string, { n: number; ultima: any }>();
  for (const c of cots || []) {
    const cur = ctx.get(c.company_id) || { n: 0, ultima: null };
    cur.n++;
    if (!cur.ultima) cur.ultima = c;
    ctx.set(c.company_id, cur);
  }

  const resultados: any[] = [];
  for (const e of empresas || []) {
    const cs: any[] = Array.isArray(e.contacts) ? e.contacts : [];
    const principal = cs.find((c: any) => c.es_principal) || cs.find((c: any) => c.email) || cs[0] || null;
    resultados.push({
      tipo: 'empresa', company_id: e.id, empresa: e.nombre, sacs_account: e.sacs_account,
      es_cliente: e.estado_cuenta === 'activo',
      contact_id: principal?.id || null, contacto: principal?.nombre || '',
      email: principal?.email || '', whatsapp: principal?.whatsapp || principal?.telefono || '',
      contactos: cs.map((c: any) => ({ id: c.id, nombre: c.nombre, email: c.email, whatsapp: c.whatsapp || c.telefono })),
      ...ctx.get(e.id),
    });
  }
  for (const c of contactos || []) {
    const co: any = Array.isArray(c.companies) ? c.companies[0] : c.companies;
    // Si su empresa ya salió arriba no se repite: sería la misma fila dos veces.
    if (co && resultados.some(r => r.company_id === co.id)) continue;
    resultados.push({
      tipo: 'contacto', company_id: co?.id || null, empresa: co?.nombre || '',
      sacs_account: co?.sacs_account || null,
      es_cliente: (co?.estado_cuenta === 'activo') || c.tipo === 'cliente',
      contact_id: c.id, contacto: [c.nombre, c.apellido].filter(Boolean).join(' '),
      email: c.email || '', whatsapp: c.whatsapp || c.telefono || '',
      lifecycle: c.lifecycle_stage,
      ...(co ? ctx.get(co.id) : {}),
    });
  }
  return json({ resultados: resultados.slice(0, 12) });
};

// Alta mínima desde el editor de la cotización: empresa + contacto, ligados.
// Pedir menos datos aquí es intencional — el alta completa vive en Clientes; lo
// que importa en este momento es que la cotización NAZCA ligada.
export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const empresa = String(b?.empresa || '').trim();
  if (!empresa) return json({ error: 'El nombre de la empresa es obligatorio: el cliente es la empresa.' }, 400);

  const { data: co, error } = await supabase.from('companies')
    .insert({ nombre: empresa, estado_cuenta: 'prospecto' }).select('id, nombre').maybeSingle();
  if (error || !co) return json({ error: error?.message || 'No se pudo crear el cliente.' }, 500);

  let contactId: string | null = null;
  const contacto = String(b?.contacto || '').trim();
  if (contacto || b?.email) {
    const { data: ct } = await supabase.from('contacts').insert({
      nombre: contacto || empresa, email: b.email || null, whatsapp: b.whatsapp || null,
      company_id: co.id, tipo: 'prospecto', lifecycle_stage: 'oportunidad',
    }).select('id').maybeSingle();
    contactId = ct?.id || null;
    // Primer contacto = principal. La columna puede no existir en instalaciones
    // viejas, así que el fallo se ignora: perder la marca no vale romper el alta.
    if (contactId) await supabase.from('contacts').update({ es_principal: true }).eq('id', contactId).then(() => {}, () => {});
  }
  return json({ ok: true, company_id: co.id, empresa: co.nombre, contact_id: contactId });
};
