// LEADS · Las personas de un mismo negocio.
//   GET    ?lead_id=            → el principal y los que cuelgan de él
//   POST   { lead_id, nombre, whatsapp?, email?, puesto?, papel? }
//          → agrega a alguien. Si ese teléfono o correo YA existe como lead
//            suelto, no crea otro: lo TRAE a este negocio.
//   PUT    { id, papel?, nombre?, whatsapp?, email?, puesto? }
//   DELETE ?id=                 → lo suelta de este lead (no lo borra)
//
// Nació de un caso real: la dueña mandó por WhatsApp la tarjeta de su encargado
// de sucursales —"El es. Le puedes decir como opera"— y no había dónde ponerlo.
// O se perdía, o entraba como lead aparte y la lista decía 2 donde hay 1.
//
// El vínculo es DOBLE y cada mitad hace un trabajo distinto:
//   · company_id  — el patrón que ya usa la ficha del cliente. Cuando el lead
//                   firme, las dos personas pasan a Clientes juntas.
//   · contacto_de — lo que hace que la lista de Leads no crezca. Es explícito
//                   a propósito: `es_principal` viene sucio (101 leads en false
//                   sin significar nada) y apoyarse en él escondería 101 leads.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const tel10 = (s?: string | null) => String(s || '').replace(/\D/g, '').slice(-10);
const norm = (s?: string | null) => String(s || '').trim().toLowerCase();

export const PAPELES = [
  { v: 'decide', l: 'Quien decide' },
  { v: 'usuario', l: 'A quien se le enseña' },
  { v: 'paga', l: 'Quien paga' },
  { v: 'otro', l: 'Otro' },
];

const CAMPOS = 'id, nombre, apellido, email, whatsapp, telefono, puesto, rol, papel, contacto_de, company_id, created_at, lifecycle_stage';

/** El principal de un lead: si el que abrió la ficha ES un secundario, el
 *  principal es su padre. Así la tarjeta se ve igual desde cualquiera de los
 *  dos y no hay dos árboles distintos del mismo negocio. */
async function raiz(id: string) {
  const { data } = await supabase.from('contacts').select(CAMPOS).eq('id', id).maybeSingle();
  if (!data) return null;
  if (!data.contacto_de) return data;
  const { data: padre } = await supabase.from('contacts').select(CAMPOS).eq('id', data.contacto_de).maybeSingle();
  return padre || data;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  const id = url.searchParams.get('lead_id');
  if (!id) return json({ error: 'Falta lead_id' }, 400);

  const pri = await raiz(id);
  if (!pri) return json({ error: 'No existe' }, 404);
  const { data: hijos } = await supabase.from('contacts').select(CAMPOS)
    .eq('contacto_de', pri.id).is('archived_at', null).order('created_at', { ascending: true });

  return json({ principal: pri, personas: hijos || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  const b = await request.json().catch(() => ({}));
  const pri = b.lead_id ? await raiz(b.lead_id) : null;
  if (!pri) return json({ error: 'Falta el lead al que se agrega.' }, 400);
  if (!String(b.nombre || '').trim()) return json({ error: 'Ponle nombre.' }, 400);
  if (!String(b.whatsapp || '').trim() && !String(b.email || '').trim()) {
    return json({ error: 'Pon al menos un WhatsApp o un correo: sin eso no se le puede escribir.' }, 400);
  }

  // ── ¿Ya existía por su cuenta? ──
  // El mismo cruce del aviso de fichas repetidas: por correo en minúsculas y
  // por los últimos diez dígitos del teléfono. Si ya está, se TRAE en vez de
  // crear otro — que es justo el duplicado que se acaba de aprender a evitar.
  const t = tel10(b.whatsapp), e = norm(b.email);
  let existente: any = null;
  if (t.length === 10 || e) {
    const { data: cand } = await supabase.from('contacts').select(CAMPOS)
      .in('lifecycle_stage', ['lead', 'lead_calificado', 'oportunidad'])
      .is('archived_at', null).limit(4000);
    existente = (cand || []).find((c: any) => c.id !== pri.id && (
      (e && norm(c.email) === e) || (t.length === 10 && tel10(c.whatsapp || c.telefono) === t)
    )) || null;
  }

  const parche: any = {
    contacto_de: pri.id,
    company_id: pri.company_id || null,
    papel: b.papel || 'otro',
    // No se marca principal: el principal del negocio sigue siendo quien llegó.
    es_principal: false,
  };
  if (b.puesto) { parche.puesto = b.puesto; parche.rol = b.puesto; }

  if (existente) {
    if (existente.contacto_de && existente.contacto_de !== pri.id) {
      return json({ error: 'Esa persona ya está dentro de otro lead.' }, 400);
    }
    const { data, error } = await supabase.from('contacts').update(parche).eq('id', existente.id).select(CAMPOS).single();
    if (error) return json({ error: error.message }, 500);
    await supabase.from('activities').insert({
      contact_id: pri.id, company_id: pri.company_id,
      tipo: 'sistema', automatico: true,
      titulo: `Se trajo a ${data.nombre} a este negocio`,
      descripcion: 'Ya existía como lead por su cuenta; en vez de duplicarlo, se ligó aquí.',
      metadata: { persona: data.id, papel: parche.papel },
    });
    return json({ ok: true, persona: data, traido: true });
  }

  const { data, error } = await supabase.from('contacts').insert({
    nombre: String(b.nombre).trim(),
    apellido: b.apellido || null,
    email: b.email ? String(b.email).trim() : null,
    whatsapp: b.whatsapp ? String(b.whatsapp).trim() : null,
    // Hereda la etapa del principal: si el lead está en "oportunidad", su
    // encargado no es un lead frío recién llegado.
    lifecycle_stage: pri.lifecycle_stage || 'lead',
    fuente: 'agregado_en_lead',
    ...parche,
  }).select(CAMPOS).single();
  if (error) return json({ error: error.message }, 500);

  await supabase.from('activities').insert({
    contact_id: pri.id, company_id: pri.company_id,
    tipo: 'sistema', automatico: true,
    titulo: `Se agregó a ${data.nombre} al negocio`,
    descripcion: [b.puesto, PAPELES.find(p => p.v === parche.papel)?.l].filter(Boolean).join(' · ') || null,
    metadata: { persona: data.id, papel: parche.papel },
  });
  return json({ ok: true, persona: data });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const p: any = {};
  for (const k of ['nombre', 'apellido', 'email', 'whatsapp', 'telefono', 'papel']) {
    if (b[k] !== undefined) p[k] = b[k] === '' ? null : b[k];
  }
  if (b.puesto !== undefined) { p.puesto = b.puesto || null; p.rol = b.puesto || null; }
  const { data, error } = await supabase.from('contacts').update(p).eq('id', b.id).select(CAMPOS).single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, persona: data });
};

/** Soltarlo del lead. NO lo borra: vuelve a ser un lead por su cuenta y
 *  reaparece en la lista. Para borrarlo de verdad está "Eliminar lead". */
export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);
  const { error } = await supabase.from('contacts').update({ contacto_de: null, papel: null }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
