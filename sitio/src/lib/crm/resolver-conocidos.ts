// LEADS · Sacar de la lista lo que ya no es un lead.
//
// Si el sistema ya sabe que esta persona paga —o que pagó— dejarla en la lista
// de leads le cuesta tiempo a alguien todos los días. Esto lo resuelve solo.
//
// Se descubrió con un cruce a mano: TRES leads con suscripción activa, $46,226
// de ARR, uno de ellos 131 días en "sin contactar".
//
// A DÓNDE VA CADA UNO, y por qué no todos al mismo lado:
//   · empresa con suscripción ACTIVA, o mismo correo/teléfono que un cliente
//     activo  →  `cliente`. Paga: no hay nada que calificar.
//   · empresa CANCELADA o vencida, o mismo correo que un cancelado  →  `churned`.
//     Mandarlo a `cliente` diría que paga y no paga; mandarlo a Perdidos es la
//     verdad. Pero para que la reactivación no se entierre ahí, se levanta
//     además una oportunidad en la bandeja que ya existe.
//   · solo coincide el NOMBRE de la empresa  →  se resuelve igual, pero se
//     anota que el correo era distinto: puede ser otra persona del mismo
//     negocio. Es la llave más débil y por eso queda escrita para poder
//     deshacerla.
import { supabase } from '../supabase';
import { detectaHistorial, norm as normTxt, tel10, claveEmpresa, type Indices, type Historial } from './lead-historial';
import { registrarOportunidad } from './oportunidades';

const LEADS = ['lead', 'lead_calificado', 'oportunidad'];

export type Resuelto = {
  contact_id: string; nombre: string; de: string; a: string;
  motivo: string; por: string; company_id: string | null; oportunidad?: boolean;
};

async function cargarIndices(): Promise<Indices> {
  const ix: Indices = { porCorreo: new Map(), porTelefono: new Map(), empresas: new Map(), porNombreEmpresa: new Map() };
  const [viejos, emps, subs] = await Promise.all([
    supabase.from('contacts').select('id, email, whatsapp, telefono, company_id, lifecycle_stage')
      .in('lifecycle_stage', ['cliente', 'churned']).is('archived_at', null).limit(5000),
    supabase.from('companies').select('id, nombre, nombre_comercial, estado_cuenta, arr').is('archived_at', null).limit(5000),
    supabase.from('subscriptions').select('company_id').eq('estado', 'activa').limit(5000),
  ]);
  const conSub = new Set((subs.data || []).map((s: any) => s.company_id));
  for (const e of (emps.data || [])) {
    const activa = conSub.has(e.id);
    ix.empresas.set(e.id, { nombre: e.nombre_comercial || e.nombre, estado_cuenta: e.estado_cuenta, arr: e.arr, activa });
    if (activa || ['activo', 'vencido', 'cancelado'].includes(String(e.estado_cuenta))) {
      const k = claveEmpresa(e.nombre_comercial || e.nombre);
      if (k.length >= 4 && !ix.porNombreEmpresa.has(k)) ix.porNombreEmpresa.set(k, { company_id: e.id, nombre: e.nombre_comercial || e.nombre, estado_cuenta: e.estado_cuenta, activa });
    }
  }
  for (const v of (viejos.data || [])) {
    const reg = { lifecycle: v.lifecycle_stage, company_id: v.company_id, contact_id: v.id };
    const em = normTxt(v.email); if (em && !ix.porCorreo.has(em)) ix.porCorreo.set(em, reg);
    const tl = tel10(v.whatsapp || v.telefono); if (tl.length === 10 && !ix.porTelefono.has(tl)) ix.porTelefono.set(tl, reg);
  }
  return ix;
}

/** Aplica el hallazgo a UN lead. Devuelve qué hizo, o null si no había nada. */
async function aplicar(c: any, h: Historial, dryRun: boolean): Promise<Resuelto | null> {
  const destino = h.tipo === 'ya_paga' ? 'cliente' : 'churned';
  if (c.lifecycle_stage === destino) return null;

  const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || c.email || c.id;
  const r: Resuelto = {
    contact_id: c.id, nombre, de: c.lifecycle_stage, a: destino,
    motivo: h.titulo, por: h.por, company_id: h.company_id || c.company_id || null,
  };
  if (dryRun) return r;

  const patch: any = { lifecycle_stage: destino, tipo: destino, updated_at: new Date().toISOString() };
  // Si se encontró por la empresa que sí paga y el lead no está ligado a
  // ninguna, se le cuelga de esa: si no, queda de cliente sin cuenta.
  if (!c.company_id && h.company_id) patch.company_id = h.company_id;
  const { error } = await supabase.from('contacts').update(patch).eq('id', c.id);
  if (error) { console.error('[conocidos] no se pudo mover', nombre, error.message); return null; }

  await supabase.from('activities').insert({
    tipo: 'stage_change', company_id: patch.company_id || c.company_id || null, contact_id: c.id, automatico: true,
    titulo: `Lifecycle: ${c.lifecycle_stage} → ${destino} · ${h.titulo}`,
    descripcion: h.por === 'nombre_empresa'
      ? 'Se detectó solo por el NOMBRE de la empresa y el correo es distinto: puede ser otra persona del mismo negocio. Si no lo es, regrésalo a lead.'
      : h.detalle || null,
    metadata: { audit: 'leads-conocidos', por: h.por, tipo: h.tipo, desde: c.lifecycle_stage },
  }).select().maybeSingle();

  // El que vuelve tras cancelar no puede quedar enterrado en Perdidos: es lo
  // más caliente que hay en la lista. Se levanta en la bandeja que ya existe.
  if (destino === 'churned' && r.company_id) {
    const q = await registrarOportunidad({
      company_id: r.company_id, tipo: 'reactivacion',
      titulo: `${nombre} volvió por su cuenta después de cancelar`,
      detalle: `${h.titulo}. Entró de nuevo por el formulario el ${String(c.created_at || '').slice(0, 10)}.`,
      accion: 'Revisa por qué canceló ANTES de llamarle. Llamar sin saberlo es perderlo por segunda vez.',
      peso: 90,
      metadata: { origen: 'leads-conocidos', contact_id: c.id, por: h.por },
    });
    r.oportunidad = q === 'creada' || q === 'reconfirmada';
  }
  return r;
}

/** Barre todos los leads y resuelve los que ya no lo son. */
export async function resolverLeadsConocidos(opts: { dryRun?: boolean; limit?: number } = {}) {
  const { dryRun = false, limit = 1000 } = opts;
  const ix = await cargarIndices();
  const { data: leads, error } = await supabase
    .from('contacts').select('id, nombre, apellido, email, whatsapp, telefono, company_id, lifecycle_stage, created_at, companies(nombre, nombre_comercial)')
    .in('lifecycle_stage', LEADS).is('archived_at', null).limit(limit);
  if (error) throw new Error(error.message);

  const hechos: Resuelto[] = [];
  for (const c of (leads || [])) {
    const emp: any = Array.isArray(c.companies) ? c.companies[0] : c.companies;
    const h = detectaHistorial({
      id: c.id, email: c.email, whatsapp: c.whatsapp, telefono: c.telefono,
      company_id: c.company_id, empresa_nombre: emp?.nombre_comercial || emp?.nombre || null,
    }, ix);
    if (!h) continue;
    const r = await aplicar(c, h, dryRun);
    if (r) hechos.push(r);
  }
  return { revisados: (leads || []).length, resueltos: hechos.length, dryRun, hechos };
}

/** Resuelve UN lead recién creado. Best-effort: nunca tumba el alta. */
export async function resolverUnLead(contactId: string): Promise<Resuelto | null> {
  try {
    const { data: c } = await supabase.from('contacts')
      .select('id, nombre, apellido, email, whatsapp, telefono, company_id, lifecycle_stage, created_at, companies(nombre, nombre_comercial)')
      .eq('id', contactId).maybeSingle();
    if (!c || !LEADS.includes(String(c.lifecycle_stage))) return null;
    const ix = await cargarIndices();
    const emp: any = Array.isArray(c.companies) ? c.companies[0] : c.companies;
    const h = detectaHistorial({
      id: c.id, email: c.email, whatsapp: c.whatsapp, telefono: c.telefono,
      company_id: c.company_id, empresa_nombre: emp?.nombre_comercial || emp?.nombre || null,
    }, ix);
    return h ? await aplicar(c, h, false) : null;
  } catch (e: any) { console.error('[conocidos] resolverUnLead', e?.message || e); return null; }
}
