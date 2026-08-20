// Permisos por SECCIÓN del sistema — las mismas seis del menú.
//
// Un permiso no es una casilla sino un nivel: 'edit' (entra y cambia), 'ver'
// (entra pero no cambia) y 'no' (ni siquiera aparece en el menú). "Ver sin
// editar" es lo que se necesita para quien consulta cuentas pero no mueve
// precios; con una casilla sí/no ese caso no existe.
//
// El founder no se toca: tiene todo, siempre. Si un día se le quita una
// sección a la única persona que puede devolvérsela, nadie puede entrar.

export type Nivel = 'edit' | 'ver' | 'no';
export type Seccion =
  | 'cuentas' | 'facturacion' | 'acompanamiento'
  | 'automatizacion' | 'colaboradores' | 'config';

export const SECCIONES: { id: Seccion; label: string; desc: string }[] = [
  { id: 'cuentas', label: 'Cuentas', desc: 'Leads, Clientes, Oportunidades y Reuniones' },
  { id: 'facturacion', label: 'Facturación', desc: 'Cotizaciones, Pagos, Cobranza y Suscripciones' },
  { id: 'acompanamiento', label: 'Acompañamiento', desc: 'Consultoría y Radar de ventas' },
  { id: 'automatizacion', label: 'Automatización', desc: 'Email, Outbound, Automatizaciones y Agentes IA' },
  { id: 'colaboradores', label: 'Colaboradores', desc: 'Partners, Comisiones y revisión de contenido' },
  { id: 'config', label: 'Configuración', desc: 'Ajustes del sistema, usuarios y permisos' },
];

export type Permisos = Record<Seccion, Nivel>;

const TODO: Permisos = {
  cuentas: 'edit', facturacion: 'edit', acompanamiento: 'edit',
  automatizacion: 'edit', colaboradores: 'edit', config: 'edit',
};
const NADA: Permisos = {
  cuentas: 'no', facturacion: 'no', acompanamiento: 'no',
  automatizacion: 'no', colaboradores: 'no', config: 'no',
};

/** Lo que trae un rol cuando nadie le ha puesto permisos propios. */
export const PRESETS: Record<string, { label: string; permisos: Permisos }> = {
  founder: { label: 'Founder', permisos: { ...TODO } },
  // Consultor: opera cuentas y acompañamiento, ve la facturación para saber
  // cómo va su cliente, pero no toca precios ni configura el sistema.
  cs: {
    label: 'Consultor',
    permisos: { ...NADA, cuentas: 'edit', acompanamiento: 'edit', facturacion: 'ver' },
  },
  lectura: {
    label: 'Solo lectura',
    permisos: { ...NADA, cuentas: 'ver', facturacion: 'ver', acompanamiento: 'ver' },
  },
  // El partner no entra al CRM: tiene su propio portal.
  partner: { label: 'Partner', permisos: { ...NADA } },
};

/**
 * Los permisos efectivos de una persona: los suyos si los tiene, y si no los
 * de su rol. El founder siempre tiene todo, escriba lo que escriba la columna.
 */
export function permisosDe(m: { rol?: string | null; permisos?: any } | null | undefined): Permisos {
  const rol = String(m?.rol || 'partner');
  if (rol === 'founder' || rol === 'admin') return { ...TODO };
  const base = PRESETS[rol]?.permisos || PRESETS.partner.permisos;
  const propios = m?.permisos && typeof m.permisos === 'object' ? m.permisos : null;
  if (!propios) return { ...base };
  const out = { ...base } as Permisos;
  for (const s of SECCIONES) {
    const v = propios[s.id];
    if (v === 'edit' || v === 'ver' || v === 'no') out[s.id] = v;
  }
  return out;
}

export const puedeVer = (p: Permisos, s: Seccion) => p[s] !== 'no';
export const puedeEditar = (p: Permisos, s: Seccion) => p[s] === 'edit';
