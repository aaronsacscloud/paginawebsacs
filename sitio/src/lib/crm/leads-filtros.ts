// LEADS · Filtros condicionales de la tabla de Leads: catálogo + evaluador.
// Mismo patrón que el del inbox (filtros.ts) pero sobre la fila de
// /api/crm/contacts?con_etapa=1 (contacto + companies + reunion + esfuerzo).
// Puro: sin React, sin supabase — lo comparten el builder y el filtrado.
import { ESTATUS_VALORES } from './estatus-lead';

export type CondLead = { campo: string; op: string; valor: string };

const OPS = {
  es: [{ id: 'es', label: 'es' }, { id: 'no_es', label: 'no es' }],
  esSolo: [{ id: 'es', label: 'es' }],
  num: [{ id: 'mayor', label: 'más de' }, { id: 'menor', label: 'menos de' }],
  hace: [{ id: 'hace_menos', label: 'hace menos de (días)' }, { id: 'hace_mas', label: 'hace más de (días)' }],
};

export function camposLeads(din: { campanas?: string[]; giros?: string[] } = {}) {
  const lista = (xs?: string[]) => (xs || []).map(v => ({ v, l: v }));
  return [
    { id: 'estatus', label: 'Estatus del lead', ops: OPS.es, valores: ESTATUS_VALORES },
    { id: 'campana', label: 'Campaña', ops: OPS.es, valores: lista(din.campanas) },
    { id: 'reunion', label: 'Reunión', ops: OPS.esSolo, valores: [
      { v: 'agendada', l: 'Tiene agendada' }, { v: 'asistio', l: 'Asistió a la última' },
      { v: 'no_asistio', l: 'No asistió' }, { v: 'sin_reagendar', l: 'No asistió y sin reagendar' },
      { v: 'cancelada', l: 'Tuvo cancelada' }, { v: 'nunca', l: 'Nunca ha tenido' }] },
    { id: 'prueba', label: 'Prueba', ops: OPS.esSolo, valores: [
      { v: 'activa', l: 'Activa' }, { v: 'vencida', l: 'Vencida sin cerrar' }, { v: 'sin', l: 'Sin prueba' }] },
    { id: 'telefono', label: 'Teléfono', ops: OPS.esSolo, valores: [{ v: 'si', l: 'Tiene' }, { v: 'no', l: 'No tiene' }] },
    { id: 'giro', label: 'Giro', ops: OPS.es, valores: lista(din.giros) },
    { id: 'sucursales', label: 'Sucursales', ops: OPS.num, valores: [] },
    { id: 'toques', label: 'Toques nuestros', ops: OPS.num, valores: [] },
    { id: 'llego', label: 'Llegó', ops: OPS.hace, valores: [] },
    { id: 'ultimo_contacto', label: 'Último contacto', ops: OPS.hace, valores: [] },
    { id: 'dueno', label: 'Dueño', ops: OPS.esSolo, valores: [{ v: 'nadie', l: 'Sin dueño' }, { v: 'alguien', l: 'Con dueño' }] },
  ];
}

const dias = (d?: string | null) => d ? Math.floor((Date.now() - Date.parse(d)) / 86400000) : null;

export function cumpleCondLead(c: any, k: CondLead): boolean {
  const neg = k.op === 'no_es';
  const p = c.propiedades || {};
  let ok: boolean;
  switch (k.campo) {
    case 'estatus': ok = (c.estatus_lead || 'nuevo') === k.valor; break;
    case 'campana': ok = (c.campana || '') === k.valor; break;
    case 'reunion': {
      const r = c.reunion;
      ok = k.valor === 'nunca' ? !r
        : k.valor === 'agendada' ? !!r?.proxima
        : k.valor === 'sin_reagendar' ? !!r?.sin_reagendar
        : k.valor === 'cancelada' ? (r?.canceladas || 0) > 0
        : r?.ultima_estado === k.valor;
      break;
    }
    case 'prueba': {
      const fin = p.prueba_fin ? Date.parse(p.prueba_fin + 'T12:00:00') : null;
      const activa = !!p.prueba_inicio;
      ok = k.valor === 'sin' ? !activa
        : k.valor === 'vencida' ? (activa && fin != null && fin < Date.now())
        : (activa && (fin == null || fin >= Date.now()));
      break;
    }
    case 'telefono': ok = (k.valor === 'si') === !!(c.whatsapp || c.telefono); break;
    case 'giro': ok = (c.giro || c.companies?.giro || '') === k.valor; break;
    case 'sucursales': {
      const n = parseFloat(k.valor); if (isNaN(n)) return true;
      const v = Number(c.sucursales_interes ?? c.companies?.sucursales ?? 0);
      return k.op === 'mayor' ? v > n : v < n;
    }
    case 'toques': {
      const n = parseFloat(k.valor); if (isNaN(n)) return true;
      const v = c.esfuerzo?.total || 0;
      return k.op === 'mayor' ? v > n : v < n;
    }
    case 'llego': case 'ultimo_contacto': {
      const n = parseFloat(k.valor); if (isNaN(n)) return true;
      const d = dias(k.campo === 'llego' ? (p.tiktok?.creado || c.created_at) : c.last_contact_at);
      if (d == null) return k.op === 'hace_mas';   // nunca = hace infinito
      return k.op === 'hace_menos' ? d < n : d > n;
    }
    case 'dueno': ok = (k.valor === 'nadie') === !c.owner_id; break;
    default: return true;
  }
  return neg ? !ok : ok;
}

export function cumpleCondsLead(c: any, conds: CondLead[], logica: 'AND' | 'OR' = 'AND'): boolean {
  const vivas = (conds || []).filter(x => x.campo && x.op);
  if (!vivas.length) return true;
  return logica === 'OR' ? vivas.some(x => cumpleCondLead(c, x)) : vivas.every(x => cumpleCondLead(c, x));
}
