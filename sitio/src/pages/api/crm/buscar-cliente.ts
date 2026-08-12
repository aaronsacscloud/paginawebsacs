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
const sinAcentos = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Un excliente NO es un lead: es una recuperación y se cotiza distinto. Hoy
// todo lo que no era cliente activo se pintaba igual.
const clasificar = (estadoCuenta?: string | null, lifecycle?: string | null): 'cliente' | 'lead' | 'excliente' => {
  if (estadoCuenta === 'activo') return 'cliente';
  if (estadoCuenta === 'cancelado' || estadoCuenta === 'vencido') return 'excliente';
  if (!estadoCuenta) {
    if (lifecycle === 'cliente') return 'cliente';
    if (lifecycle === 'churned') return 'excliente';
  }
  return 'lead';
};
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

  if (q.length < 2) return json({ resultados: [], conteos: { todos: 0, cliente: 0, lead: 0, excliente: 0 } });
  const like = `%${q}%`;
  // Sin acentos ni mayúsculas: "rubén", "RUBEN" y "ruben" tienen que traer lo
  // mismo. Las columnas *_norm ya vienen normalizadas desde la base.
  const likeN = `%${sinAcentos(q)}%`;
  // Solo dígitos: así "55 1234 5678", "5512345678" y "+52 55 1234 5678"
  // encuentran al mismo contacto.
  const soloNum = q.replace(/\D/g, '');

  const [{ data: empresas }, { data: contactos }, { data: porFolio }] = await Promise.all([
    supabase.from('companies')
      .select('id, nombre, sacs_account, rfc, estado_cuenta, contacts(id, nombre, email, whatsapp, telefono, es_principal)')
      .is('archived_at', null)
      .or(`nombre_norm.ilike.${likeN},razon_social.ilike.${like},sacs_account.ilike.${like},rfc.ilike.${like}`)
      .limit(10),
    supabase.from('contacts')
      .select('id, nombre, apellido, email, whatsapp, telefono, lifecycle_stage, tipo, company_id, companies(id, nombre, sacs_account, estado_cuenta)')
      .is('archived_at', null)
      .or([
        `nombre_norm.ilike.${likeN}`,
        `email.ilike.${like}`,
        ...(soloNum.length >= 6 ? [`whatsapp.ilike.%${soloNum}%`, `telefono.ilike.%${soloNum}%`] : []),
      ].join(','))
      .limit(10),
    // Por folio: se pega "COT-78905" y sale su cuenta. Es como se busca cuando
    // lo que tienes enfrente es la cotización, no el nombre.
    /cot|^\d{4,}/i.test(q)
      ? supabase.from('quotes').select('company_id, empresa, numero').ilike('numero', like).not('company_id', 'is', null).limit(5)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Contexto: cuántas cotizaciones tiene y cómo le fue a la última. Es lo que
  // evita el error más caro — recotizar sin saber que ya hay una viva.
  const companyIds = [
    ...(empresas || []).map((e: any) => e.id),
    ...(contactos || []).map((c: any) => c.company_id).filter(Boolean),
    ...(porFolio || []).map((f: any) => f.company_id),
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
      clase: clasificar(e.estado_cuenta, null),
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
      clase: clasificar(co?.estado_cuenta, c.lifecycle_stage || c.tipo),
      es_cliente: (co?.estado_cuenta === 'activo') || c.tipo === 'cliente',
      contact_id: c.id, contacto: [c.nombre, c.apellido].filter(Boolean).join(' '),
      email: c.email || '', whatsapp: c.whatsapp || c.telefono || '',
      lifecycle: c.lifecycle_stage,
      ...(co ? ctx.get(co.id) : {}),
    });
  }
  // Las que entraron por folio: la cuenta puede no parecerse al texto tecleado.
  for (const f of porFolio || []) {
    if (resultados.some(r => r.company_id === f.company_id)) continue;
    const { data: co } = await supabase.from('companies')
      .select('id, nombre, sacs_account, estado_cuenta, contacts(id, nombre, email, whatsapp, telefono, es_principal)')
      .eq('id', f.company_id).maybeSingle();
    if (!co) continue;
    const cs: any[] = Array.isArray(co.contacts) ? co.contacts : [];
    const principal = cs.find((x: any) => x.es_principal) || cs[0] || null;
    resultados.push({
      tipo: 'empresa', company_id: co.id, empresa: co.nombre, sacs_account: co.sacs_account,
      clase: clasificar(co.estado_cuenta, null), es_cliente: co.estado_cuenta === 'activo',
      contact_id: principal?.id || null, contacto: principal?.nombre || '',
      email: principal?.email || '', whatsapp: principal?.whatsapp || principal?.telefono || '',
      via_folio: f.numero, ...ctx.get(co.id),
    });
  }

  // ── Duplicados marcados en la misma lista ──
  // El aviso llegaba hasta el alta, cuando ya ibas a crear. Aquí sale antes: si
  // dos resultados comparten correo o un nombre contenido en el otro, los dos
  // salen marcados y eliges cuál es, o los fusionas.
  const lista = resultados.slice(0, 12);
  for (const a of lista) {
    for (const b of lista) {
      if (a === b || a.dup) continue;
      const na = norm(a.empresa || a.contacto), nb = norm(b.empresa || b.contacto);
      const mismoCorreo = !!a.email && a.email.toLowerCase() === String(b.email || '').toLowerCase();
      const nombreParecido = !!na && !!nb && na !== nb && (na.includes(nb) || nb.includes(na));
      if (mismoCorreo || nombreParecido) { a.dup = true; b.dup = true; }
    }
  }

  const conteos = {
    todos: lista.length,
    cliente: lista.filter(r => r.clase === 'cliente').length,
    lead: lista.filter(r => r.clase === 'lead').length,
    excliente: lista.filter(r => r.clase === 'excliente').length,
  };
  return json({ resultados: lista, conteos });
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
