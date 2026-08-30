// LEADS · Filtros condicionales de la tabla de Leads: catálogo + evaluador.
// Mismo patrón que el del inbox (filtros.ts) pero sobre la fila de
// /api/crm/contacts?con_etapa=1 (contacto + companies + reunion + esfuerzo).
// Puro: sin React, sin supabase — lo comparten el builder y el filtrado.
import { ESTATUS_VALORES } from './estatus-lead';

export type CondLead = { campo: string; op: string; valor: string };

// Por qué se descartó: categorías FIJAS para poder medir en 3 meses por qué
// se pierden los leads. El texto libre acompaña, no sustituye.
export const CATS_DESCARTE = [
  { v: 'ya_usa_otro', l: 'Ya usa otro sistema' },
  { v: 'precio', l: 'Precio' },
  { v: 'no_perfil', l: 'No es el perfil' },
  { v: 'datos_falsos', l: 'Datos falsos / ilocalizable' },
  { v: 'sin_respuesta', l: 'Nunca respondió' },
  { v: 'otro', l: 'Otro' },
];

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
    // El filtro «Reunión» de arriba responde QUÉ pasó con la última. Estos dos
    // responden CUÁNTAS, que es otra pregunta: quién insiste y a quién se le
    // cae la cita. Salen de las columnas materializadas de contacts, así que
    // valen para toda la base y no solo para la página cargada.
    { id: 'reuniones_n', label: 'Reuniones totales', ops: OPS.num, valores: [] },
    { id: 'no_shows', label: 'No-shows', ops: OPS.num, valores: [] },
    { id: 'prueba', label: 'Prueba', ops: OPS.esSolo, valores: [
      { v: 'activa', l: 'Activa' }, { v: 'vencida', l: 'Vencida sin cerrar' }, { v: 'sin', l: 'Sin prueba' }] },
    { id: 'pausa', label: 'Pausa (pidió tiempo)', ops: OPS.esSolo, valores: [
      { v: 'activa', l: 'En pausa' }, { v: 'vencida', l: 'Pausa vencida' }, { v: 'sin', l: 'Sin pausa' }] },
    { id: 'descarte', label: 'Motivo de descarte', ops: OPS.es, valores: CATS_DESCARTE },
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
    case 'pausa': {
      const f = c.retenido_hasta ? Date.parse(c.retenido_hasta) : null;
      ok = k.valor === 'sin' ? !f : k.valor === 'activa' ? (f != null && f > Date.now()) : (f != null && f <= Date.now());
      break;
    }
    case 'descarte': ok = (c.descarte_categoria || '') === k.valor; break;
    case 'telefono': ok = (k.valor === 'si') === !!(c.whatsapp || c.telefono); break;
    case 'giro': ok = (c.giro || c.companies?.giro || '') === k.valor; break;
    case 'sucursales': {
      const n = parseFloat(k.valor); if (isNaN(n)) return true;
      const v = Number(c.sucursales_interes ?? c.companies?.sucursales ?? 0);
      return k.op === 'mayor' ? v > n : v < n;
    }
    case 'reuniones_n': {
      const n = parseFloat(k.valor); if (isNaN(n)) return true;
      // Se descuentan las reagendadas: una cita movida dos veces deja tres
      // bookings y contarlas como tres reuniones es mentir sobre el interés.
      const v = Math.max(0, Number(c.reuniones_total || 0) - Number(c.reuniones_reagendadas || 0));
      return k.op === 'mayor' ? v > n : v < n;
    }
    case 'no_shows': {
      const n = parseFloat(k.valor); if (isNaN(n)) return true;
      const v = Number(c.reuniones_no_asistio || 0);
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
    // ── Señal de vida ──
    // La union de correo, WhatsApp, visitas, cotizaciones, reuniones y toques.
    // Es la condicion de los rezagados: "30 dias sin nada". A proposito NO
    // incluye el cambio de estatus — si lo incluyera, un lead reviviria porque
    // alguien movio un chip en el CRM sin que el lead hiciera nada.
    case 'sin_actividad': {
      const n2 = parseFloat(k.valor); if (isNaN(n2)) return true;
      const d = dias(c.ultima_actividad_venta_at);
      if (d == null) return k.op === 'hace_mas';   // nunca dio senal = hace infinito
      return k.op === 'hace_menos' ? d < n2 : d > n2;
    }
    // ── Interes en el sitio ──
    // visitas_n cuenta paginas vistas; visito_ruta pregunta por una en concreto
    // (/planes es la de mayor intencion que existe). Las dos miran una ventana
    // reciente: haber visitado precios hace un ano no dice nada de hoy.
    case 'visitas_n': {
      const n3 = parseFloat(k.valor); if (isNaN(n3)) return true;
      const v2 = Number(c.visitas_recientes || 0);
      return k.op === 'mayor' ? v2 > n3 : v2 < n3;
    }
    case 'visito_ruta': {
      const rutas: string[] = Array.isArray(c.rutas_recientes) ? c.rutas_recientes : [];
      const buscada = String(k.valor || '').toLowerCase();
      if (!buscada) return true;
      ok = rutas.some(r => String(r).toLowerCase().includes(buscada));
      break;
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
