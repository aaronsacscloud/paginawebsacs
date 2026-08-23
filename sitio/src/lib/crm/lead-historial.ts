// LEADS · ¿Este lead ya lo conocíamos?
//
// PURO: sin BD y sin red. El que carga los índices es quien lo llama.
//
// Nació de un cruce manual sobre producción: había TRES leads con suscripción
// ACTIVA —$46,226 de ARR— sentados en la lista de "sin contactar", uno de ellos
// cuatro meses; y DOS personas que habían cancelado y volvieron a entrar por el
// formulario sin que nada lo dijera. Nadie iba a notarlo a mano: por eso el
// aviso tiene que salir el día que el lead entra.
//
// Se cruza por tres llaves independientes y se toma la de mayor peso. El correo
// es la más confiable; el teléfono se normaliza a los últimos 10 dígitos porque
// la lada y el +52 vienen de mil formas; el nombre de empresa es la más débil y
// por eso su hallazgo se presenta como "hay que confirmarlo", no como un hecho.

export type TipoHistorial = 'ya_paga' | 'fue_cliente' | 'empresa_duplicada';

export type Historial = {
  tipo: TipoHistorial;
  /** Qué se enseña en una línea. */
  titulo: string;
  detalle?: string | null;
  /** A dónde llevar al que dé clic. */
  company_id?: string | null;
  contact_id?: string | null;
  /** Por qué llave se encontró: sirve para saber cuánto confiar. */
  por: 'correo' | 'telefono' | 'empresa_ligada' | 'nombre_empresa';
};

export const norm = (s?: string | null) => String(s || '').trim().toLowerCase();
/** Últimos 10 dígitos: +52 1 55…, 55…, 0155… son el mismo número. */
export const tel10 = (s?: string | null) => String(s || '').replace(/\D/g, '').slice(-10);
/** Nombre de empresa comparable: sin acentos, sin espacios, sin puntuación. */
export const claveEmpresa = (s?: string | null) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

export type Indices = {
  /** correo normalizado → { lifecycle, company_id, contact_id } de clientes y cancelados */
  porCorreo: Map<string, { lifecycle: string; company_id: string | null; contact_id: string }>;
  porTelefono: Map<string, { lifecycle: string; company_id: string | null; contact_id: string }>;
  /** company_id → datos de la empresa */
  empresas: Map<string, { nombre: string; estado_cuenta: string | null; arr: number | null; activa: boolean }>;
  /** clave de nombre → company_id de empresas que son o fueron clientes */
  porNombreEmpresa: Map<string, { company_id: string; nombre: string; estado_cuenta: string | null; activa: boolean }>;
};

export type LeadMin = {
  id: string;
  email?: string | null;
  whatsapp?: string | null;
  telefono?: string | null;
  company_id?: string | null;
  empresa_nombre?: string | null;
};

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

/**
 * Devuelve el hallazgo de MAYOR peso, o null. El orden importa: que ya esté
 * pagando manda sobre todo lo demás, porque es el único caso donde el lead
 * simplemente no debería estar en la lista.
 */
export function detectaHistorial(lead: LeadMin, ix: Indices): Historial | null {
  // 1) Su propia empresa ya tiene suscripción activa: el que paga está
  //    etiquetado como lead.
  if (lead.company_id) {
    const e = ix.empresas.get(lead.company_id);
    if (e?.activa) {
      return { tipo: 'ya_paga', por: 'empresa_ligada', company_id: lead.company_id,
        titulo: `Ya es cliente: ${e.nombre} tiene suscripción activa`,
        detalle: e.arr ? `${money(e.arr)} de ARR. Debería estar en Clientes, no aquí.` : 'Debería estar en Clientes, no aquí.' };
    }
  }

  // 1b) Su propia empresa YA canceló o está vencida. Se descubrió con un caso
  //     real: una lead calificada colgada de la empresa que había cancelado
  //     hacía un año. Mirar solo los registros AJENOS la dejaba invisible — el
  //     historial también puede estar en su propia ficha.
  if (lead.company_id) {
    const e = ix.empresas.get(lead.company_id);
    if (e && !e.activa && (e.estado_cuenta === 'cancelado' || e.estado_cuenta === 'vencido')) {
      return { tipo: 'fue_cliente', por: 'empresa_ligada', company_id: lead.company_id,
        titulo: `Ya fue cliente: ${e.nombre} ${e.estado_cuenta === 'cancelado' ? 'canceló' : 'está vencida'}`,
        detalle: 'Está ligado a una cuenta con historial de pago — es una reactivación, no un lead frío.' };
    }
  }

  // 2) Mismo correo o mismo teléfono que un cliente o un cancelado.
  const porLlave: Array<['correo' | 'telefono', { lifecycle: string; company_id: string | null; contact_id: string } | undefined]> = [
    ['correo', norm(lead.email) ? ix.porCorreo.get(norm(lead.email)) : undefined],
    ['telefono', tel10(lead.whatsapp || lead.telefono).length === 10 ? ix.porTelefono.get(tel10(lead.whatsapp || lead.telefono)) : undefined],
  ];
  for (const [por, m] of porLlave) {
    if (!m || m.contact_id === lead.id) continue;
    const e = m.company_id ? ix.empresas.get(m.company_id) : null;
    if (m.lifecycle === 'cliente' && e?.activa) {
      return { tipo: 'ya_paga', por, company_id: m.company_id, contact_id: m.contact_id,
        titulo: `Ya es cliente: mismo ${por} que ${e.nombre}`,
        detalle: 'Hay dos fichas de la misma persona. Conviene fusionarlas.' };
    }
    return { tipo: 'fue_cliente', por, company_id: m.company_id, contact_id: m.contact_id,
      titulo: `Ya fue cliente${e ? `: ${e.nombre}` : ''}`,
      detalle: `Mismo ${por}. ${e?.estado_cuenta === 'cancelado' ? 'Canceló y volvió por su cuenta' : 'Tiene historial con nosotros'} — es una reactivación, no un lead frío.` };
  }

  // 3) El nombre de su empresa coincide con el de una empresa cliente. Es la
  //    llave más débil: se presenta como algo por confirmar.
  const k = claveEmpresa(lead.empresa_nombre);
  if (k.length >= 4) {
    const m = ix.porNombreEmpresa.get(k);
    if (m && m.company_id !== lead.company_id) {
      return { tipo: m.activa ? 'ya_paga' : 'fue_cliente', por: 'nombre_empresa', company_id: m.company_id,
        titulo: `Su empresa se llama igual que ${m.nombre}${m.activa ? ', que sí paga' : ', que canceló'}`,
        detalle: 'El correo es distinto: puede ser otra persona del mismo negocio. Hay que confirmarlo por teléfono, no darlo por hecho.' };
    }
  }
  return null;
}

export const HISTORIAL_ETIQUETA: Record<TipoHistorial, { label: string; bg: string; fg: string }> = {
  ya_paga: { label: 'Ya es cliente', bg: '#FBECEA', fg: '#C0554E' },
  fue_cliente: { label: 'Reactivación', bg: '#FFF6E3', fg: '#9A6B15' },
  empresa_duplicada: { label: 'Empresa duplicada', bg: '#f4f4f6', fg: '#6B7280' },
};
