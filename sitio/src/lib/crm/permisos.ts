// Permisos por SECCIÓN del sistema — las mismas zonas del menú.
//
// Un permiso no es una casilla sino un nivel: 'edit' (entra y cambia), 'ver'
// (entra pero no cambia) y 'no' (ni siquiera aparece en el menú). "Ver sin
// editar" es lo que se necesita para quien consulta cuentas pero no mueve
// precios; con una casilla sí/no ese caso no existe.
//
// El founder no se toca: tiene todo, siempre. Si un día se le quita una
// sección a la única persona que puede devolvérsela, nadie puede entrar.
//
// ── Reacomodo del 12-sep-2026 ──────────────────────────────────────────────
// Las llaves dejaron de empatar con el menú y eso abría dos agujeros:
//
//  · `trabajo` y `finanzas` estaban en el menú y NO existían aquí. El guardia
//    preguntaba por una llave inexistente, `undefined !== 'no'`, y la respuesta
//    era «pasa»: Trabajo inteligente y Finanzas se le veían a todo el mundo.
//    Un consultor podía abrir los Gastos, las Comisiones y el Cierre anual.
//  · `automatizacion` existía aquí y ya no en el menú —esas pantallas se
//    habían movido a Ventas—, así que era una llave que no abría nada.
//
// Ahora hay OCHO y son exactamente las zonas del menú. `facturacion` se parte
// en dos porque cotizar y cobrar no son el mismo trabajo ni los hace la misma
// persona, y `automatizacion` pasa a llamarse `marketing`, que es lo que hay
// adentro. Lo guardado sigue sirviendo: se traduce al leer (ver `ALIAS`).

export type Nivel = 'edit' | 'ver' | 'no';
export type Seccion =
  | 'cuentas' | 'acompanamiento' | 'ventas' | 'marketing'
  | 'demanda' | 'finanzas' | 'trabajo' | 'colaboradores' | 'config';

export const SECCIONES: { id: Seccion; label: string; desc: string }[] = [
  { id: 'cuentas', label: 'Cuentas', desc: 'Clientes, Onboarding y Churn' },
  { id: 'ventas', label: 'Ventas', desc: 'Leads, Reuniones y Cotizaciones' },
  { id: 'acompanamiento', label: 'Acompañamiento', desc: 'Consultoría, Taller, Soporte y Radar de ventas' },
  { id: 'marketing', label: 'Marketing', desc: 'Campañas, Email, Masivos, Secuencias, Outbound, Cuentas objetivo y Ferias' },
  { id: 'demanda', label: 'Motor de demanda', desc: 'El motor que busca demanda, la puntúa, publica y mide (SEO, IA y herramientas)' },
  { id: 'finanzas', label: 'Finanzas', desc: 'Suscripciones, Pagos y cobranza, Ingresos, Gastos, Comisiones y Cierre' },
  { id: 'trabajo', label: 'Trabajo inteligente', desc: 'El agente y sus bandejas' },
  { id: 'colaboradores', label: 'Partners', desc: 'Partners, sus comisiones y revisión de contenido' },
  { id: 'config', label: 'Configuración', desc: 'Ajustes del sistema, usuarios y permisos' },
];

export type Permisos = Record<Seccion, Nivel>;

const lleno = (n: Nivel): Permisos => ({
  cuentas: n, ventas: n, acompanamiento: n, marketing: n, demanda: n,
  finanzas: n, trabajo: n, colaboradores: n, config: n,
});
const TODO = lleno('edit');
const NADA = lleno('no');

/**
 * Llaves viejas → nuevas. Lo que ya está guardado en `team_members.permisos`
 * no se migra a la fuerza: se traduce al leer, así que un permiso puesto en
 * agosto sigue queriendo decir lo mismo hoy.
 *
 * `facturacion` abría cotizar Y cobrar, así que se hereda a las dos: quitarle
 * una a alguien que ya la tenía sería un permiso que se pierde solo.
 */
const ALIAS: Record<string, Seccion[]> = {
  facturacion: ['ventas', 'finanzas'],
  automatizacion: ['marketing'],
};

/** Lo que trae un rol cuando nadie le ha puesto permisos propios. */
export const PRESETS: Record<string, { label: string; desc: string; permisos: Permisos }> = {
  founder: { label: 'Founder', desc: 'Todo, incluida esta pantalla', permisos: { ...TODO } },
  /* Consultor: su día son las cuentas y lo que se les entrega. Leads y
     reuniones viven en Ventas desde el reacomodo, así que ahí también edita
     —son suyas—. Ve el dinero para saber cómo va su cliente, pero no lo mueve,
     y no entra a marketing ni a partners. */
  cs: {
    label: 'Consultor',
    desc: 'Cuentas, leads, reuniones y acompañamiento; ve el dinero sin moverlo',
    permisos: { ...NADA, cuentas: 'edit', ventas: 'edit', acompanamiento: 'edit', trabajo: 'edit', finanzas: 'ver' },
  },
  /* Vendedor: prospecta y cierra. Ve el acompañamiento para saber qué se le
     prometió al cliente, y el dinero para no vender sobre una cuenta que debe. */
  ventas: {
    label: 'Ventas',
    desc: 'Leads, cotizaciones y marketing; ve cuentas y dinero',
    permisos: { ...NADA, ventas: 'edit', marketing: 'edit', trabajo: 'edit', cuentas: 'ver', acompanamiento: 'ver', finanzas: 'ver', demanda: 'ver' },
  },
  /* Administración: cobra, paga y cierra. No toca cuentas ni promesas. */
  finanzas: {
    label: 'Finanzas',
    desc: 'Cobranza, pagos, gastos y cierre; ve cuentas sin moverlas',
    permisos: { ...NADA, finanzas: 'edit', colaboradores: 'edit', cuentas: 'ver', ventas: 'ver' },
  },
  lectura: {
    label: 'Solo lectura',
    desc: 'Consulta, no modifica',
    permisos: { ...lleno('ver'), colaboradores: 'no', config: 'no' },
  },
  // El partner no entra al CRM: tiene su propio portal.
  partner: { label: 'Partner', desc: 'No entra al CRM: usa su portal', permisos: { ...NADA } },
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
  // Primero lo viejo, para que lo nuevo pueda corregirlo si ya se guardó.
  for (const [viejo, nuevas] of Object.entries(ALIAS)) {
    const v = propios[viejo];
    if (v === 'edit' || v === 'ver' || v === 'no') for (const n of nuevas) out[n] = v;
  }
  for (const s of SECCIONES) {
    const v = propios[s.id];
    if (v === 'edit' || v === 'ver' || v === 'no') out[s.id] = v;
  }
  return out;
}

export const puedeVer = (p: Permisos, s: Seccion) => p[s] !== 'no';
export const puedeEditar = (p: Permisos, s: Seccion) => p[s] === 'edit';
