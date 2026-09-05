// OUTBOUND · Variables del mensaje, resueltas POR CUENTA.
//
// Un aviso de cobro no puede ser una campaña por cliente escrita a mano: el
// monto y los días cambian por cuenta y cambian solos cada día. Con esto, UNA
// campaña sirve para todas: el texto lleva `{{monto}}` y en la publicación se
// resuelve el valor de cada cuenta.
//
// Se resuelve en el CRM y viaja YA RESUELTO al servidor de entrega. Es a
// propósito: la deuda vive en el CRM (Supabase) y la entrega vive en Mongo;
// hacer que el segundo consulte al primero por cada usuario que abre SACS sería
// una consulta por sesión para un dato que cambia una vez al día.
import { supabase } from '../supabase';

export const VARIABLES = [
  { id: 'monto', etiqueta: 'Monto vencido', ejemplo: '$9,900' },
  { id: 'concepto', etiqueta: 'Qué se debe', ejemplo: 'tu Plugin Premium anual' },
  { id: 'dias_vencido', etiqueta: 'Días de vencido', ejemplo: '4' },
  { id: 'dias_para_vencer', etiqueta: 'Días para vencer', ejemplo: '15' },
  { id: 'fecha_pago', etiqueta: 'Fecha de pago', ejemplo: '1 de septiembre' },
  { id: 'empresa', etiqueta: 'Nombre del negocio', ejemplo: 'Sativa 4 you' },
] as const;

const RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** ¿El contenido usa alguna variable? Si no, no se paga el costo de resolver. */
export function usaVariables(contenido: any): boolean {
  const t = `${contenido?.titulo || ''} ${contenido?.mensaje || ''}`;
  RE.lastIndex = 0;
  return RE.test(t);
}

const fmtMonto = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
const dias = (fecha: string) => Math.round((Date.parse(fecha + 'T12:00:00') - Date.now()) / 86400000);

/**
 * Para cada cuenta, los valores de sus variables. Se calcula de la suscripción
 * MÁS urgente: la vencida hace más tiempo, o si no hay ninguna vencida, la que
 * vence primero. Es la que motiva el aviso.
 */
export async function valoresPorCuenta(cuentas: string[]): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  if (!cuentas.length) return out;

  const { data: empresas } = await supabase.from('companies')
    .select('id, sacs_account, nombre_comercial, nombre')
    .in('sacs_account', cuentas);
  if (!empresas?.length) return out;

  const { data: subs } = await supabase.from('subscriptions')
    .select('company_id, nombre_plan, ciclo, precio, estado, proxima_factura')
    .in('company_id', empresas.map((e: any) => e.id));

  for (const e of empresas) {
    const mias = (subs || []).filter((s: any) => s.company_id === e.id && s.proxima_factura);
    if (!mias.length) continue;
    const vencidas = mias.filter((s: any) => s.estado === 'pendiente_pago' && dias(s.proxima_factura) < 0);
    // La vencida hace más tiempo; si ninguna lo está, la que vence primero.
    const s = vencidas.length
      ? vencidas.sort((a: any, b: any) => String(a.proxima_factura).localeCompare(String(b.proxima_factura)))[0]
      : mias.sort((a: any, b: any) => String(a.proxima_factura).localeCompare(String(b.proxima_factura)))[0];
    const d = dias(s.proxima_factura);
    out[e.sacs_account] = {
      monto: fmtMonto(Number(s.precio) || 0),
      concepto: `tu ${s.nombre_plan}`,
      dias_vencido: String(Math.max(0, -d)),
      dias_para_vencer: String(Math.max(0, d)),
      fecha_pago: new Date(s.proxima_factura + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }),
      empresa: e.nombre_comercial || e.nombre || '',
    };
  }
  return out;
}

/** Sustituye en un texto. Una variable sin valor se queda VACÍA, no con el
 *  `{{monto}}` crudo: es preferible una frase corta a enseñarle la plantilla al
 *  cliente. */
export function sustituir(texto: string, vals: Record<string, string>): string {
  return String(texto || '').replace(RE, (_, k) => vals?.[k] ?? '');
}

/** De una lista de cuentas, las que TODAVÍA tienen algo vencido. Es lo que
 *  apaga solo un aviso de cobro: el día que pagan, dejan de estar aquí.
 *  Se mira `proxima_factura` en el pasado con la suscripción en pendiente_pago;
 *  cuando el pago entra, el ciclo mueve la fecha o el estado y la cuenta sale. */
export async function cuentasConSaldoVencido(cuentas: string[]): Promise<string[]> {
  if (!cuentas.length) return [];
  const { data: empresas } = await supabase.from('companies')
    .select('id, sacs_account').in('sacs_account', cuentas);
  if (!empresas?.length) return [];
  const { data: subs } = await supabase.from('subscriptions')
    .select('company_id, estado, proxima_factura')
    .in('company_id', empresas.map((e: any) => e.id))
    .eq('estado', 'pendiente_pago');
  const hoy = new Date().toISOString().slice(0, 10);
  const deben = new Set((subs || [])
    .filter((s: any) => s.proxima_factura && String(s.proxima_factura).slice(0, 10) < hoy)
    .map((s: any) => s.company_id));
  return empresas.filter((e: any) => deben.has(e.id)).map((e: any) => e.sacs_account);
}

export function contenidoResuelto(contenido: any, vals: Record<string, string>) {
  return { ...contenido, titulo: sustituir(contenido?.titulo, vals), mensaje: sustituir(contenido?.mensaje, vals) };
}
