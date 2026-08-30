/**
 * El contexto de renovación de un cliente: fechas, montos y sus descuentos.
 *
 * POR QUÉ EXISTE
 * La cadencia de renovación ofrece 10% por renovar con 30 días de anticipación
 * y 5% con 15. Eso solo sirve si cada cliente ve SU fecha límite y SU monto —
 * un correo que dice «renueva antes de tiempo y te damos 10%» sin decir antes
 * de cuándo ni sobre cuánto no mueve a nadie, porque hacer la cuenta le toca
 * al que lo recibe.
 *
 * `plantillas.ts` ya declaraba `monto_renovacion`, `plan`, `empresa` y
 * `sucursales` como variables, pero el cron solo pasaba `nombre` y `campana`:
 * el vocabulario existía y nadie lo alimentaba. Esto lo alimenta.
 *
 * TODO se calcula aquí y en un solo lugar. Si el 10% y el 5% se calcularan en
 * la plantilla del correo, el del WhatsApp y el mensaje in-app dirían números
 * distintos en cuanto alguien tocara uno.
 */
import { supabase } from '../supabase';

/** Los dos tramos, de más generoso a menos. El orden importa: se toma el primero que aplique. */
export const TRAMOS = [
  { dias: 30, pct: 10 },
  { dias: 15, pct: 5 },
] as const;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
const fechaLarga = (d: Date) => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;

export interface CtxRenovacion {
  plan: string;
  sucursales: string;
  fecha_renovacion: string;
  dias_para_renovar: string;
  monto_renovacion: string;
  /** Lo que pagaría hoy, con el tramo que le aplica AHORA. */
  monto_con_descuento: string;
  descuento_pct: string;
  ahorro: string;
  /** Hasta cuándo alcanza cada tramo. */
  limite_10: string;
  limite_5: string;
  monto_10: string;
  monto_5: string;
  ahorro_10: string;
  ahorro_5: string;
}

/** Qué porcentaje le toca a alguien que renueva a `dias` de su fecha. */
export function tramoPara(dias: number): number {
  for (const t of TRAMOS) if (dias >= t.dias) return t.pct;
  return 0;
}

/**
 * Arma el contexto de una empresa. Devuelve null si no hay con qué:
 * sin suscripción anual activa, sin fecha o sin monto, un correo de renovación
 * mentiría — y es preferible no mandarlo a mandarlo con ceros.
 */
export async function ctxRenovacion(companyId: string | null): Promise<CtxRenovacion | null> {
  if (!companyId) return null;
  const { data: sub } = await supabase.from('subscriptions')
    .select('nombre_plan, ciclo, estado, monto_proximo, proxima_factura, sucursales')
    .eq('company_id', companyId).eq('estado', 'activa').in('ciclo', ['anual', 'vitalicia'])
    .order('proxima_factura', { ascending: true }).limit(1).maybeSingle();
  if (!sub?.proxima_factura) return null;

  const monto = Number(sub.monto_proximo) || 0;
  if (!(monto > 0)) return null;

  const fin = new Date(String(sub.proxima_factura).slice(0, 10) + 'T12:00:00Z');
  const dias = Math.ceil((fin.getTime() - Date.now()) / 86400000);
  const pct = tramoPara(dias);

  /* Las fechas límite se calculan restando a la renovación, no sumando a hoy:
     así el correo del día 60 y el del día 40 dicen la MISMA fecha límite. Si se
     calcularan desde hoy, cada correo daría una distinta y el cliente pensaría
     que se la estamos moviendo. */
  const limite = (d: number) => fechaLarga(new Date(fin.getTime() - d * 86400000));
  const con = (p: number) => dinero(monto * (1 - p / 100));
  const menos = (p: number) => dinero(monto * (p / 100));

  return {
    plan: String(sub.nombre_plan || '').replace(/\s*(Anual|Mensual)\s*$/i, '').trim(),
    sucursales: sub.sucursales != null ? String(sub.sucursales) : '',
    fecha_renovacion: fechaLarga(fin),
    dias_para_renovar: String(Math.max(0, dias)),
    monto_renovacion: dinero(monto),
    monto_con_descuento: pct ? con(pct) : dinero(monto),
    descuento_pct: String(pct),
    ahorro: pct ? menos(pct) : '',
    limite_10: limite(30), limite_5: limite(15),
    monto_10: con(10), monto_5: con(5),
    ahorro_10: menos(10), ahorro_5: menos(5),
  };
}
