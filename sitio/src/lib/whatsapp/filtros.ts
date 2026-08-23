// WHATSAPP · Filtros de vistas del inbox: catálogo de campos del CRM +
// evaluador. Compartido entre el API (server) y el front (builder/preview) —
// sin React, sin supabase: puro.
//
// Estructura portada de sacs_inbox (grupo → campo → operadores → valores
// dinámicos), con los grupos del CONTEXTO CRM: Bandeja / Lead / Cliente.

export type Condicion = {
  _yo?: string | null; campo: string; op: string; valor: string };
export type ConfigVista = {
  seccion_id?: string | null;
  emoji?: string;
  modo?: 'todas' | 'con_conversacion' | 'solo_contactos';
  logica?: 'AND' | 'OR';
  condiciones?: Condicion[];
  // compat con vistas v3 (filtro/etapa/search/tipo/plan/...)
  [k: string]: any;
};

export type CampoFiltro = {
  id: string;
  label: string;
  grupo: string;
  ops: { id: string; label: string }[];
  /** vacío = input libre; si no, select. Se puede inyectar dinámico. */
  valores?: { v: string; l: string }[];
};

const OPS = {
  es: [{ id: 'es', label: 'es' }, { id: 'no_es', label: 'no es' }],
  esSolo: [{ id: 'es', label: 'es' }],
  num: [{ id: 'mayor', label: 'mayor a' }, { id: 'menor', label: 'menor a' }],
  hace: [{ id: 'hace_menos', label: 'hace menos de' }, { id: 'hace_mas', label: 'hace más de' }],
};

export const GRUPOS = ['Bandeja', 'Lead', 'Cliente'];

export function catalogoCampos(din: {
  etiquetas?: { v: string; l: string }[];
  equipo?: { v: string; l: string }[];
  giros?: { v: string; l: string }[];
  fuentes?: { v: string; l: string }[];
  cierres?: { v: string; l: string }[];
  etapas?: { v: string; l: string }[];
} = {}): CampoFiltro[] {
  return [
    // ── Bandeja ──
    { id: 'estado_crm', label: 'Estado', grupo: 'Bandeja', ops: OPS.es, valores: [{ v: 'abierta', l: 'Abierta' }, { v: 'pendiente', l: 'Pendiente' }, { v: 'resuelta', l: 'Resuelta' }] },
    { id: 'asignado', label: 'Asignado a', grupo: 'Bandeja', ops: OPS.es, valores: [{ v: 'nadie', l: 'Sin asignar' }, ...(din.equipo || [])] },
    { id: 'sin_respuesta', label: 'Sin respuesta desde', grupo: 'Bandeja', ops: [{ id: 'hace_mas', label: 'hace más de' }], valores: [] },
    { id: 'canal', label: 'Canal', grupo: 'Bandeja', ops: OPS.esSolo, valores: [{ v: 'wa', l: 'WhatsApp' }, { v: 'email', l: 'Correo' }] },
    { id: 'no_leidos', label: 'No leídos', grupo: 'Bandeja', ops: OPS.esSolo, valores: [{ v: 'si', l: 'Con pendientes' }, { v: 'no', l: 'Al día' }] },
    // ── Lead ──
    { id: 'etapa', label: 'Etapa del ciclo', grupo: 'Lead', ops: OPS.es, valores: din.etapas || [
      { v: 'lead', l: 'Nuevo lead' }, { v: 'cliente', l: 'Cliente' }, { v: 'churned', l: 'Perdido' }] },
    { id: 'tipo', label: 'Tipo de contacto', grupo: 'Lead', ops: OPS.es, valores: [{ v: 'lead', l: 'Lead' }, { v: 'cliente', l: 'Cliente' }, { v: 'partner', l: 'Partner' }, { v: 'churned', l: 'Perdido' }] },
    { id: 'fuente', label: 'Origen / fuente', grupo: 'Lead', ops: OPS.es, valores: din.fuentes || [] },
    { id: 'etiqueta', label: 'Etiqueta', grupo: 'Lead', ops: [{ id: 'tiene', label: 'tiene' }, { id: 'no_tiene', label: 'no tiene' }], valores: din.etiquetas || [] },
    { id: 'creado', label: 'Contacto creado', grupo: 'Lead', ops: OPS.hace, valores: [] },
    { id: 'ultima_actividad', label: 'Último mensaje', grupo: 'Lead', ops: OPS.hace, valores: [] },
    { id: 'ultima_respuesta', label: 'Nuestra última respuesta', grupo: 'Bandeja', ops: OPS.hace, valores: [] },
    { id: 'ventana', label: 'Ventana de 24 h', grupo: 'Bandeja', ops: OPS.esSolo, valores: [{ v: 'abierta', l: 'Abierta' }, { v: 'por_cerrar', l: 'Cierra en menos de 4 h' }, { v: 'cerrada', l: 'Cerrada' }] },
    { id: 'cierre_categoria', label: 'Motivo de cierre', grupo: 'Bandeja', ops: OPS.es, valores: din.cierres || [] },
    { id: 'etiqueta_conv', label: 'Etiqueta de la conversación', grupo: 'Bandeja', ops: [{ id: 'tiene', label: 'tiene' }, { id: 'no_tiene', label: 'no tiene' }], valores: din.etiquetas || [] },
    { id: 'renovacion', label: 'Próxima renovación', grupo: 'Cliente', ops: [{ id: 'en_menos', label: 'en menos de' }, { id: 'en_mas', label: 'en más de' }, { id: 'vencida', label: 'ya venció' }], valores: [] },
    // ── Cliente ──
    { id: 'plan', label: 'Plan', grupo: 'Cliente', ops: OPS.es, valores: [
      { v: 'vende', l: 'Vende' }, { v: 'controla', l: 'Controla' }, { v: 'fideliza', l: 'Fideliza' },
      { v: 'automatiza', l: 'Automatiza' }, { v: 'personalizada', l: 'Personalizada' }, { v: 'soporte_premium', l: 'Soporte premium' }] },
    { id: 'estado_cuenta', label: 'Estado de la cuenta', grupo: 'Cliente', ops: OPS.es, valores: [
      { v: 'prospecto', l: 'Prospecto' }, { v: 'activo', l: 'Activo' }, { v: 'vencido', l: 'Vencido' }, { v: 'cancelado', l: 'Cancelado' }] },
    // TODO el CRM se mide en ARR. El id 'arr' compara mrr×12; 'mrr' sigue
    // existiendo (oculto) para no romper las vistas guardadas con ese campo.
    { id: 'arr', label: 'ARR (MXN/año)', grupo: 'Cliente', ops: OPS.num, valores: [] },
    { id: 'sucursales', label: 'Sucursales', grupo: 'Cliente', ops: [...OPS.num, { id: 'igual', label: 'igual a' }], valores: [] },
    { id: 'giro', label: 'Giro', grupo: 'Cliente', ops: OPS.es, valores: din.giros || [] },
    { id: 'con_cuenta', label: 'Cuenta SACS ligada', grupo: 'Cliente', ops: OPS.esSolo, valores: [{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }] },
    { id: 'dueno', label: 'Dueño del contacto', grupo: 'Lead', ops: OPS.es, valores: [{ v: 'yo', l: 'Yo' }, { v: 'nadie', l: 'Sin dueño' }, ...(din.equipo || [])] },
    { id: 'dias_sin_venta', label: 'Días sin vender (SACS)', grupo: 'Actividad SACS', ops: [{ id: 'mayor', label: 'más de' }, { id: 'menor', label: 'menos de' }], valores: [] },
    { id: 'ultima_venta', label: 'Última venta en SACS', grupo: 'Actividad SACS', ops: OPS.hace, valores: [] },
    { id: 'ultimo_pago', label: 'Último pago a Sacscloud', grupo: 'Actividad SACS', ops: OPS.hace, valores: [] },
    { id: 'salud', label: 'Salud de la cuenta (0-100)', grupo: 'Actividad SACS', ops: [{ id: 'menor', label: 'menor a' }, { id: 'mayor', label: 'mayor a' }], valores: [] },
  ];
}

/** "3h", "2 días", "1 mes", "1 año", "45" (horas) → horas. Portado de filterUtils. */
export function parseHoras(v: string): number | null {
  const m = String(v || '').toLowerCase().match(/([\d.]+)\s*(h|hora|d[ií]a|dia|semana|mes|a[ñn]o)?/);
  if (!m || !m[1]) return null;
  const n = parseFloat(m[1]);
  const u = m[2] || 'h';
  if (u.startsWith('h')) return n;
  if (u.startsWith('d')) return n * 24;
  if (u.startsWith('s')) return n * 24 * 7;
  if (u.startsWith('m')) return n * 24 * 30;
  return n * 24 * 365;
}

/**
 * Evalúa UNA condición sobre la fila unificada del inbox
 * ({...conv, contacto, empresa, _extra:{fuente, creado, etiquetas:[]}}).
 */
export function cumpleCondicion(fila: any, c: Condicion): boolean {
  const neg = c.op === 'no_es' || c.op === 'no_tiene';
  const ahora = Date.now();
  let ok: boolean;
  switch (c.campo) {
    case 'estado_crm': ok = (fila.estado_crm || 'abierta') === c.valor; break;
    case 'asignado': ok = c.valor === 'nadie' ? !fila.asignado_a : fila.asignado_a === c.valor; break;
    case 'sin_respuesta': {
      const h = parseHoras(c.valor); if (h == null) return true;
      ok = fila.ultima_direccion === 'entrante' && (ahora - new Date(fila.ultimo_mensaje_at).getTime()) > h * 3600e3;
      break;
    }
    case 'canal': ok = (fila.canales || ['wa']).includes(c.valor); break;
    case 'no_leidos': ok = (c.valor === 'si') === ((fila.no_leidos || 0) > 0); break;
    case 'etapa': ok = fila.contacto?.lifecycle_stage === c.valor; break;
    case 'tipo': ok = fila.contacto?.tipo === c.valor; break;
    case 'fuente': ok = (fila._extra?.fuente || '') === c.valor; break;
    case 'etiqueta': ok = (fila._extra?.etiquetas || []).includes(c.valor); break;
    case 'creado': {
      const h = parseHoras(c.valor); if (h == null || !fila._extra?.creado) return true;
      const edad = (ahora - new Date(fila._extra.creado).getTime()) / 3600e3;
      ok = c.op === 'hace_menos' ? edad < h : edad > h;
      return ok;   // hace_* no usa neg
    }
    case 'ultima_actividad': {
      const h = parseHoras(c.valor); if (h == null) return true;
      const edad = (ahora - new Date(fila.ultimo_mensaje_at).getTime()) / 3600e3;
      return c.op === 'hace_menos' ? edad < h : edad > h;
    }
    case 'ultima_respuesta': {
      const h = parseHoras(c.valor); if (h == null) return true;
      if (!fila._extra?.ultimo_saliente_at) return c.op === 'hace_mas';   // nunca respondimos = hace infinito
      const edad = (ahora - new Date(fila._extra.ultimo_saliente_at).getTime()) / 3600e3;
      return c.op === 'hace_menos' ? edad < h : edad > h;
    }
    case 'ventana': {
      const exp = fila.ventana_expira_at ? new Date(fila.ventana_expira_at).getTime() : 0;
      const restante = exp - ahora;
      ok = c.valor === 'abierta' ? restante > 0 : c.valor === 'por_cerrar' ? (restante > 0 && restante < 4 * 3600e3) : restante <= 0;
      break;
    }
    case 'cierre_categoria': ok = (fila._extra?.cierre_categoria || '') === c.valor; break;
    case 'etiqueta_conv': ok = (fila._extra?.etiquetas_conv || []).includes(c.valor); break;
    case 'renovacion': {
      const f = fila._extra?.fecha_renovacion; if (!f) return false;
      const dias = (new Date(f).getTime() - ahora) / 86400e3;
      if (c.op === 'vencida') return dias < 0;
      const h = parseHoras(c.valor); if (h == null) return true;
      const lim = h / 24;
      return c.op === 'en_menos' ? (dias >= 0 && dias < lim) : dias > lim;
    }
    case 'dueno': {
      const d = fila._extra?.owner_id || null;
      ok = c.valor === 'nadie' ? !d : c.valor === 'yo' ? (!!c._yo && d === c._yo) : d === c.valor;
      break;
    }
    case 'dias_sin_venta': {
      const n = parseFloat(c.valor); const v = fila._extra?.dias_sin_venta;
      if (isNaN(n) || v == null) return false;
      return c.op === 'mayor' ? v > n : v < n;
    }
    case 'ultima_venta': case 'ultimo_pago': {
      const f = c.campo === 'ultima_venta' ? fila._extra?.ultima_venta_at : fila._extra?.last_payment_at;
      const h = parseHoras(c.valor); if (h == null) return true;
      if (!f) return c.op === 'hace_mas';   // nunca = hace infinito
      const edad = (ahora - new Date(f).getTime()) / 3600e3;
      return c.op === 'hace_menos' ? edad < h : edad > h;
    }
    case 'salud': {
      const n = parseFloat(c.valor); const v = fila._extra?.health_score;
      if (isNaN(n) || v == null) return false;
      return c.op === 'mayor' ? v > n : v < n;
    }
    case 'plan': ok = fila.empresa?.plan === c.valor; break;
    case 'estado_cuenta': ok = (fila._extra?.estado_cuenta || fila.empresa?.estado_cuenta) === c.valor; break;
    case 'mrr': {   // legado: vistas guardadas antes del cambio a ARR
      const n = parseFloat(c.valor); if (isNaN(n)) return true;
      const v = Number(fila.empresa?.mrr || 0);
      return c.op === 'mayor' ? v > n : v < n;
    }
    case 'arr': {   // la medida oficial: mrr anualizado (o arr directo si existe)
      const n = parseFloat(c.valor); if (isNaN(n)) return true;
      const v = Number(fila.empresa?.arr ?? (Number(fila.empresa?.mrr || 0) * 12));
      return c.op === 'mayor' ? v > n : v < n;
    }
    case 'sucursales': {
      const n = parseFloat(c.valor); if (isNaN(n)) return true;
      const v = Number(fila._extra?.sucursales ?? 0);
      return c.op === 'mayor' ? v > n : c.op === 'menor' ? v < n : v === n;
    }
    case 'giro': ok = (fila._extra?.giro || '') === c.valor; break;
    case 'con_cuenta': ok = (c.valor === 'si') === !!fila._extra?.sacs_account; break;
    default: return true;
  }
  return neg ? !ok : ok;
}

export function cumpleVista(fila: any, cfg: ConfigVista, yoId?: string | null): boolean {
  const conds = (cfg.condiciones || []).filter(c => c.campo && c.op);
  if (!conds.length) return true;
  return (cfg.logica === 'OR')
    ? conds.some(c => cumpleCondicion(fila, { ...c, _yo: yoId }))
    : conds.every(c => cumpleCondicion(fila, { ...c, _yo: yoId }));
}
