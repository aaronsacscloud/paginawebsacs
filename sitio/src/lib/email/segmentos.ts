// MOTOR DE AUDIENCIAS — el DSL de segmentos y su resolución a contactos.
//
// ── Por qué el DSL se ve así ──
// El usuario no escribe AND/OR. Escribe frases: "que cumplan TODO esto…", y
// entre grupos, "o bien, TODO esto". Dentro de un grupo las condiciones se
// suman (Y); entre grupos se alternan (O). La exclusión es una zona aparte,
// nunca un NOT anidado — un no-técnico entiende "excluir siempre a esta
// lista" y no entiende "NOT (A AND B)".
//
// ── Por qué se resuelve en JS y no en un SQL generado ──
// Compilar un DSL a texto SQL abre una superficie de inyección que no vale la
// pena por una audiencia de cientos de contactos. Cada grupo se consulta con
// el constructor de consultas (parametrizado, imposible de inyectar) y los
// conjuntos de ids se unen/restan en memoria. Si algún día la audiencia crece
// a cientos de miles, esto se cambia por una función de Postgres — y el DSL
// guardado seguirá sirviendo igual.
//
// ── Alcance por inquilino ──
// TODA consulta arranca del filtro del inquilino (ver tenant.ts): un partner
// solo puede alcanzar a los contactos que él refirió. No es una condición más
// del DSL, es el suelo — no se puede desactivar desde la UI.
import { supabase } from '../supabase';
import type { Tenant } from './tenant';

export type Operador =
  | 'es' | 'no_es' | 'contiene' | 'existe' | 'no_existe'
  | 'mayor_que' | 'menor_que' | 'en_los_ultimos_dias' | 'hace_mas_de_dias'
  | 'en_los_proximos_dias';

export interface Condicion {
  sujeto: 'contacto' | 'empresa' | 'suscripcion' | 'email' | 'reunion';
  campo: string;
  operador: Operador;
  valor?: string | number | null;
}
export interface Grupo { condiciones: Condicion[] }
export interface Exclusion { tipo: 'lista' | 'segmento' | 'contacto'; id: string }
export interface Definicion { grupos: Grupo[]; excluir?: Exclusion[] }

/**
 * CATÁLOGO — la fuente única de qué se puede preguntar.
 * La UI pinta sus menús desde aquí, así que agregar un campo es agregarlo
 * en un solo lugar. `operadores` acota lo que tiene sentido por campo: no se
 * ofrece "mayor que" sobre una etapa de texto.
 */
export const CATALOGO: Record<string, { etiqueta: string; campos: Array<{ id: string; etiqueta: string; tipo: 'texto' | 'numero' | 'fecha' | 'opciones' | 'bool'; operadores: Operador[]; opciones?: Array<{ v: string; l: string }> }> }> = {
  contacto: {
    etiqueta: 'Contacto',
    campos: [
      { id: 'lifecycle_stage', etiqueta: 'Etapa', tipo: 'opciones', operadores: ['es', 'no_es'], opciones: [
        { v: 'lead', l: 'Lead' }, { v: 'lead_calificado', l: 'Lead calificado' },
        { v: 'oportunidad', l: 'Oportunidad' }, { v: 'cliente', l: 'Cliente' }, { v: 'churned', l: 'Perdido' }] },
      { id: 'pipeline_stage', etiqueta: 'Etapa del pipeline', tipo: 'texto', operadores: ['es', 'no_es', 'existe'] },
      { id: 'utm_source', etiqueta: 'Canal de origen', tipo: 'opciones', operadores: ['es', 'no_es', 'existe', 'no_existe'], opciones: [
        { v: 'tiktok', l: 'TikTok' }, { v: 'google', l: 'Google' }, { v: 'facebook', l: 'Facebook' }, { v: 'instagram', l: 'Instagram' }] },
      { id: 'utm_campaign', etiqueta: 'Campaña de origen', tipo: 'texto', operadores: ['es', 'contiene', 'existe'] },
      { id: 'fuente', etiqueta: 'Cómo entró', tipo: 'texto', operadores: ['es', 'no_es', 'contiene'] },
      { id: 'giro', etiqueta: 'Giro', tipo: 'texto', operadores: ['es', 'contiene', 'existe'] },
      { id: 'lead_score', etiqueta: 'Puntaje', tipo: 'numero', operadores: ['mayor_que', 'menor_que', 'es'] },
      { id: 'sucursales_interes', etiqueta: 'Sucursales', tipo: 'numero', operadores: ['mayor_que', 'menor_que', 'es'] },
      { id: 'plan_interes', etiqueta: 'Plan de interés', tipo: 'texto', operadores: ['es', 'contiene', 'existe'] },
      { id: 'whatsapp', etiqueta: 'WhatsApp', tipo: 'texto', operadores: ['existe', 'no_existe'] },
      { id: 'created_at', etiqueta: 'Fecha de alta', tipo: 'fecha', operadores: ['en_los_ultimos_dias', 'hace_mas_de_dias'] },
      { id: 'last_contact_at', etiqueta: 'Último contacto', tipo: 'fecha', operadores: ['en_los_ultimos_dias', 'hace_mas_de_dias', 'no_existe'] },
    ],
  },
  empresa: {
    etiqueta: 'Empresa',
    campos: [
      // OJO: los valores son los que la base USA de verdad ('activo' en
      // masculino, 'vencido'), no los que uno supondría. Un valor inventado
      // aquí no da error: da CERO resultados en silencio, que es peor.
      { id: 'estado_cuenta', etiqueta: 'Estado de la cuenta', tipo: 'opciones', operadores: ['es', 'no_es'], opciones: [
        { v: 'prospecto', l: 'Prospecto' }, { v: 'activo', l: 'Activo' }, { v: 'vencido', l: 'Vencido' }, { v: 'cancelado', l: 'Cancelado' }] },
      { id: 'giro', etiqueta: 'Giro de la empresa', tipo: 'texto', operadores: ['es', 'contiene'] },
      { id: 'sucursales', etiqueta: 'Sucursales', tipo: 'numero', operadores: ['mayor_que', 'menor_que', 'es'] },
      { id: 'sacs_account', etiqueta: 'Cuenta SACS ligada', tipo: 'texto', operadores: ['existe', 'no_existe'] },
    ],
  },
  suscripcion: {
    etiqueta: 'Suscripción',
    campos: [
      { id: 'estado', etiqueta: 'Estado', tipo: 'opciones', operadores: ['es', 'no_es'], opciones: [
        { v: 'activa', l: 'Activa' }, { v: 'programada', l: 'Programada' }, { v: 'pendiente_pago', l: 'Pendiente de pago' },
        { v: 'pausada', l: 'Pausada' }, { v: 'cancelada', l: 'Cancelada' }] },
      { id: 'nombre_plan', etiqueta: 'Plan', tipo: 'texto', operadores: ['es', 'contiene'] },
      { id: 'arr', etiqueta: 'ARR', tipo: 'numero', operadores: ['mayor_que', 'menor_que'] },
      { id: 'ciclo', etiqueta: 'Ciclo', tipo: 'opciones', operadores: ['es'], opciones: [{ v: 'mensual', l: 'Mensual' }, { v: 'anual', l: 'Anual' }] },
      { id: 'proxima_factura', etiqueta: 'Próxima factura', tipo: 'fecha', operadores: ['en_los_proximos_dias', 'en_los_ultimos_dias'] },
      { id: 'existe', etiqueta: 'Tiene suscripción', tipo: 'bool', operadores: ['existe', 'no_existe'] },
    ],
  },
  email: {
    etiqueta: 'Actividad de correo',
    campos: [
      { id: 'clico', etiqueta: 'Hizo clic (cualquier correo)', tipo: 'fecha', operadores: ['en_los_ultimos_dias', 'no_existe'] },
      { id: 'abrio', etiqueta: 'Abrió (señal poco fiable)', tipo: 'fecha', operadores: ['en_los_ultimos_dias', 'no_existe'] },
      { id: 'recibio', etiqueta: 'Recibió algún correo', tipo: 'fecha', operadores: ['en_los_ultimos_dias', 'no_existe'] },
      { id: 'campana_clico', etiqueta: 'Hizo clic en la campaña…', tipo: 'texto', operadores: ['es'] },
      { id: 'campana_recibio', etiqueta: 'Recibió la campaña…', tipo: 'texto', operadores: ['es', 'no_es'] },
    ],
  },
  reunion: {
    etiqueta: 'Reuniones',
    campos: [
      { id: 'tiene', etiqueta: 'Ha agendado reunión', tipo: 'bool', operadores: ['existe', 'no_existe'] },
      { id: 'ultima', etiqueta: 'Última reunión', tipo: 'fecha', operadores: ['en_los_ultimos_dias', 'hace_mas_de_dias'] },
    ],
  },
};

export const ETIQUETA_OPERADOR: Record<Operador, string> = {
  es: 'es', no_es: 'no es', contiene: 'contiene', existe: 'tiene dato', no_existe: 'está vacío',
  mayor_que: 'es mayor que', menor_que: 'es menor que',
  en_los_ultimos_dias: 'fue en los últimos',
  hace_mas_de_dias: 'fue hace más de',
  en_los_proximos_dias: 'será en los próximos',
};

/** Operadores cuyo valor son días — la frase los cierra con la palabra. */
const OPERADOR_EN_DIAS: Operador[] = ['en_los_ultimos_dias', 'hace_mas_de_dias', 'en_los_proximos_dias'];
/** Operadores que no llevan valor: "está vacío" no admite un "= x". */
const OPERADOR_SIN_VALOR: Operador[] = ['existe', 'no_existe'];

const diasAtras = (d: number) => new Date(Date.now() - Number(d || 0) * 86400000).toISOString();
const diasAdelante = (d: number) => new Date(Date.now() + Number(d || 0) * 86400000).toISOString();

/** Ids de contactos que cumplen UNA condición. null = la condición no acota. */
/** ¿Este par sujeto/campo está en el catálogo? Lo que no se ofrece, no se filtra. */
function campoValido(c: Condicion): boolean {
  return !!CATALOGO[c.sujeto]?.campos.some(f => f.id === c.campo);
}

async function idsDeCondicion(t: Tenant, c: Condicion): Promise<Set<string> | null> {
  if (!campoValido(c)) return null;
  const base = () => {
    let q = supabase.from('contacts').select('id').is('archived_at', null);
    if (t.owner_team_member_id) q = q.eq('referrer_partner_id', t.owner_team_member_id);
    return q;
  };
  const recolecta = async (q: any): Promise<Set<string>> => {
    const { data } = await q.limit(20000);
    return new Set((data || []).map((r: any) => r.id));
  };

  if (c.sujeto === 'contacto') {
    let q = base();
    const v = c.valor as any;
    switch (c.operador) {
      case 'es': q = q.eq(c.campo, v); break;
      // `neq` en PostgREST NO devuelve las filas con NULL (nada es distinto de
      // NULL en SQL). "Etapa no es Cliente" dejaba fuera a todo contacto sin
      // etapa, que suele ser justo el que se quiere alcanzar.
      case 'no_es': q = q.or(`${c.campo}.neq.${v},${c.campo}.is.null`); break;
      case 'contiene': q = q.ilike(c.campo, `%${v}%`); break;
      case 'existe': q = q.not(c.campo, 'is', null); break;
      case 'no_existe': q = q.is(c.campo, null); break;
      case 'mayor_que': q = q.gt(c.campo, Number(v)); break;
      case 'menor_que': q = q.lt(c.campo, Number(v)); break;
      case 'en_los_ultimos_dias': q = q.gte(c.campo, diasAtras(Number(v))); break;
      case 'hace_mas_de_dias': q = q.lt(c.campo, diasAtras(Number(v))); break;
      default: return null;
    }
    return recolecta(q);
  }

  if (c.sujeto === 'empresa') {
    // Se resuelve al revés: qué empresas cumplen, y luego sus contactos.
    let qe = supabase.from('companies').select('id');
    const v = c.valor as any;
    switch (c.operador) {
      case 'es': qe = qe.eq(c.campo, v); break;
      case 'no_es': qe = qe.neq(c.campo, v); break;
      case 'contiene': qe = qe.ilike(c.campo, `%${v}%`); break;
      case 'existe': qe = qe.not(c.campo, 'is', null); break;
      case 'no_existe': qe = qe.is(c.campo, null); break;
      case 'mayor_que': qe = qe.gt(c.campo, Number(v)); break;
      case 'menor_que': qe = qe.lt(c.campo, Number(v)); break;
      default: return null;
    }
    const { data: emp } = await qe.limit(20000);
    const ids = (emp || []).map((r: any) => r.id);
    if (!ids.length) return new Set();
    return recolecta(base().in('company_id', ids));
  }

  if (c.sujeto === 'suscripcion') {
    let qs = supabase.from('subscriptions').select('company_id');
    const v = c.valor as any;
    if (c.campo === 'existe') {
      if (c.operador === 'no_existe') {
        const { data: subs } = await qs.limit(20000);
        const conSub = new Set((subs || []).map((r: any) => r.company_id).filter(Boolean));
        const todos = await recolecta(base().not('company_id', 'is', null));
        const { data: cs } = await supabase.from('contacts').select('id, company_id').in('id', Array.from(todos)).limit(20000);
        return new Set((cs || []).filter((r: any) => !conSub.has(r.company_id)).map((r: any) => r.id));
      }
    } else {
      switch (c.operador) {
        case 'es': qs = qs.eq(c.campo, v); break;
        case 'no_es': qs = qs.neq(c.campo, v); break;
        case 'contiene': qs = qs.ilike(c.campo, `%${v}%`); break;
        case 'mayor_que': qs = qs.gt(c.campo, Number(v)); break;
        case 'menor_que': qs = qs.lt(c.campo, Number(v)); break;
        case 'en_los_proximos_dias': qs = qs.gte(c.campo, new Date().toISOString().slice(0, 10)).lte(c.campo, diasAdelante(Number(v)).slice(0, 10)); break;
        case 'en_los_ultimos_dias': qs = qs.gte(c.campo, diasAtras(Number(v)).slice(0, 10)).lte(c.campo, new Date().toISOString().slice(0, 10)); break;
        default: return null;
      }
    }
    const { data: subs } = await qs.limit(20000);
    const companies = [...new Set((subs || []).map((r: any) => r.company_id).filter(Boolean))];
    if (!companies.length) return new Set();
    return recolecta(base().in('company_id', companies));
  }

  if (c.sujeto === 'email') {
    const v = c.valor as any;
    let qs = supabase.from('email_sends').select('contact_id').eq('tenant_id', t.id).not('contact_id', 'is', null);
    if (c.campo === 'clico') qs = qs.not('clicked_at', 'is', null);
    if (c.campo === 'abrio') qs = qs.not('first_opened_at', 'is', null);
    if (c.campo === 'campana_clico') qs = qs.eq('campaign_id', v).not('clicked_at', 'is', null);
    if (c.campo === 'campana_recibio') qs = qs.eq('campaign_id', v);
    if (c.operador === 'en_los_ultimos_dias' && c.campo !== 'campana_clico' && c.campo !== 'campana_recibio') {
      qs = qs.gte('created_at', diasAtras(Number(v)));
    }
    const { data } = await qs.limit(50000);
    const conActividad = new Set((data || []).map((r: any) => r.contact_id));
    const alcance = await recolecta(base());
    // "no_existe" / "no_es" invierte: todos los del alcance menos estos.
    if (c.operador === 'no_existe' || c.operador === 'no_es') {
      return new Set(Array.from(alcance).filter(id => !conActividad.has(id)));
    }
    return new Set(Array.from(alcance).filter(id => conActividad.has(id)));
  }

  if (c.sujeto === 'reunion') {
    let qb = supabase.from('bookings').select('contact_id').not('contact_id', 'is', null);
    if (c.operador === 'en_los_ultimos_dias') qb = qb.gte('created_at', diasAtras(Number(c.valor)));
    if (c.operador === 'hace_mas_de_dias') qb = qb.lt('created_at', diasAtras(Number(c.valor)));
    const { data } = await qb.limit(50000);
    const conReunion = new Set((data || []).map((r: any) => r.contact_id));
    // El alcance NO es negociable: `bookings` no sabe de inquilinos, así que
    // el resultado se cruza SIEMPRE contra los contactos que este inquilino
    // puede ver. Sin esto, un partner alcanzaba contactos ajenos con una sola
    // condición de "ha agendado reunión".
    const alcance = await recolecta(base());
    if (c.operador === 'no_existe') {
      return new Set(Array.from(alcance).filter(id => !conReunion.has(id)));
    }
    return new Set(Array.from(alcance).filter(id => conReunion.has(id)));
  }

  return null;
}

/** Ids de un grupo: la INTERSECCIÓN de sus condiciones (todas se cumplen). */
async function idsDeGrupo(t: Tenant, g: Grupo): Promise<Set<string>> {
  const cs = (g.condiciones || []).filter(c => c && c.sujeto && c.campo);
  if (!cs.length) return new Set();
  let acc: Set<string> | null = null;
  for (const c of cs) {
    const ids = await idsDeCondicion(t, c);
    if (ids === null) continue;
    const previos: string[] = Array.from(acc ?? []);
    acc = acc === null ? ids : new Set(previos.filter(id => ids.has(id)));
    if (acc.size === 0) break;
  }
  return acc || new Set();
}

async function idsDeExclusiones(t: Tenant, ex: Exclusion[]): Promise<Set<string>> {
  const fuera = new Set<string>();
  for (const e of ex || []) {
    if (e.tipo === 'contacto') { fuera.add(e.id); continue; }
    if (e.tipo === 'lista') {
      const { data } = await supabase.from('email_list_members').select('contact_id').eq('list_id', e.id).limit(20000);
      for (const r of data || []) if (r.contact_id) fuera.add(r.contact_id);
    }
    if (e.tipo === 'segmento') {
      const { data: seg } = await supabase.from('email_segments').select('definicion').eq('id', e.id).eq('tenant_id', t.id).maybeSingle();
      if (seg) (await resolverIds(t, seg.definicion as Definicion, false)).forEach(id => fuera.add(id));
    }
  }
  return fuera;
}

/** Los ids del segmento: unión de grupos, menos exclusiones. */
export async function resolverIds(t: Tenant, def: Definicion, aplicarExclusiones = true): Promise<string[]> {
  const grupos = (def?.grupos || []).filter(g => (g.condiciones || []).length);
  if (!grupos.length) return [];
  const union = new Set<string>();
  for (const g of grupos) { const ids = await idsDeGrupo(t, g); ids.forEach(id => union.add(id)); }
  if (aplicarExclusiones && def?.excluir?.length) {
    const fuera = await idsDeExclusiones(t, def.excluir);
    fuera.forEach(id => union.delete(id));
  }
  return Array.from(union);
}

export interface Miembro {
  /** Identificador para pintar la fila (contacto o correo si no hay contacto). */
  id: string;
  /** El contacto REAL, o null si el correo no está en el CRM. Nunca se deduce
   *  de `id`: un miembro de lista sin contacto tenía un texto libre ahí, y
   *  mandarlo como uuid tumbaba el insert de toda la audiencia. */
  contact_id: string | null;
  nombre: string;
  email: string | null;
  empresa: string | null;
  company_id: string | null;
}

/** Los contactos del segmento, con lo mínimo para pintarlos y para enviarles. */
export async function resolverMiembros(t: Tenant, def: Definicion, limite = 5000): Promise<Miembro[]> {
  const ids = await resolverIds(t, def);
  if (!ids.length) return [];
  const out: Miembro[] = [];
  // PostgREST se atraganta con un `in` de miles: se pide por tandas.
  for (let i = 0; i < ids.length && out.length < limite; i += 500) {
    const { data } = await supabase
      .from('contacts')
      .select('id, nombre, apellido, email, company_id, companies(nombre)')
      .in('id', ids.slice(i, i + 500));
    for (const c of (data || []) as any[]) {
      out.push({
        id: c.id,
        contact_id: c.id,
        nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre',
        email: c.email,
        empresa: c.companies?.nombre || null,
        company_id: c.company_id || null,
      });
    }
  }
  // Sin correo no hay a quién escribirle: no cuenta como miembro alcanzable.
  return out.filter(m => !!m.email);
}

/** Los miembros de una lista estática. Misma forma que un segmento. */
export async function miembrosDeLista(listId: string, tenantId?: string): Promise<Miembro[]> {
  // Una lista tiene dueño. Sin esta verificación, una campaña podía apuntar a
  // la lista de otro inquilino con solo poner su id.
  if (tenantId) {
    const { data: l } = await supabase.from('email_lists').select('id').eq('id', listId).eq('tenant_id', tenantId).maybeSingle();
    if (!l) return [];
  }
  const { data } = await supabase
    .from('email_list_members')
    .select('contact_id, email, nombre, contacts(nombre, apellido, company_id, companies(nombre))')
    .eq('list_id', listId).limit(20000);
  return (data || []).map((r: any) => ({
    id: r.contact_id || r.email,
    contact_id: r.contact_id || null,
    nombre: r.contacts ? [r.contacts.nombre, r.contacts.apellido].filter(Boolean).join(' ') : (r.nombre || 'Sin nombre'),
    email: r.email,
    empresa: r.contacts?.companies?.nombre || null,
    company_id: r.contacts?.company_id || null,
  })).filter((m: Miembro) => !!m.email);
}

/** Frase legible de una condición: "Etapa es Cliente". Para la UI y el resumen. */
export function frase(c: Condicion): string {
  const campo = CATALOGO[c.sujeto]?.campos.find(f => f.id === c.campo);
  const nombre = campo?.etiqueta || c.campo;
  const op = ETIQUETA_OPERADOR[c.operador] || c.operador;
  if (OPERADOR_SIN_VALOR.includes(c.operador)) return `${nombre} ${op}`;
  const valor = campo?.opciones?.find(o => o.v === String(c.valor))?.l ?? c.valor ?? '';
  const cola = OPERADOR_EN_DIAS.includes(c.operador) ? ' días' : '';
  return `${nombre} ${op} ${valor}${cola}`.trim();
}
