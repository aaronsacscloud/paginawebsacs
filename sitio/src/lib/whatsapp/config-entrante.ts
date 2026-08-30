/**
 * La configuración del WhatsApp entrante — una sola fila, editable desde
 * Secuencias.
 *
 * Antes esto vivía en tres sitios a la vez: constantes en presion.ts (24 h, 5
 * días), textos y horario en wa_config, y decisiones sueltas dentro de
 * wa-intencion.ts. Para cambiar "cada cuánto se le puede escribir a un lead"
 * había que tocar código y desplegar. Ahora es una secuencia con disparador
 * 'wa_entrante' y todo vive en su `entrada`.
 *
 * Dos reglas de diseño:
 *
 * 1. Si la fila no existe o está apagada, TODO sigue funcionando con los
 *    valores de siempre. Una configuración ausente nunca debe abrir la puerta
 *    a mandarle veinte mensajes a alguien.
 * 2. El caché es de 60 s. Esto se consulta en cada mensaje entrante y saliente;
 *    ir a la base cada vez sería pagar un viaje por WhatsApp para leer algo que
 *    cambia una vez al mes.
 */
import { supabase } from '../supabase';

export interface Horario { dias?: number[]; desde?: string; hasta?: string }

export interface ConfigEntrante {
  /** La secuencia existe y está encendida. Con false rige lo de abajo igual,
   *  pero el acuse no sale: encender es una decisión explícita. */
  activa: boolean;
  acuse: { activo: boolean; en_horario: string; fuera: string; rearme_horas: number;
           /** Horas de silencio del acuse después de que un HUMANO escribió en
            *  esa conversación. Ver `alRecibirMensaje`. */
           silencio_humano_horas: number };
  horario: Horario | null;
  presion: { horas_entre_whatsapps: number; dias_pausa_por_manual: number; permitir_forzar_manual: boolean };
  intencion: { etiquetar: boolean; notificar: boolean; solo_desde_cta: boolean };
  cierre: { bloquear_con_no_leidos: boolean };
}

/** Lo que rige si la secuencia no existe: exactamente lo que hacía el código
 *  antes de que esto fuera configurable. Cambiarlos aquí cambia el default de
 *  toda cuenta nueva. */
export const POR_DEFECTO: ConfigEntrante = {
  activa: false,
  acuse: { activo: false, en_horario: '', fuera: '', rearme_horas: 20, silencio_humano_horas: 6 },
  horario: null,
  presion: { horas_entre_whatsapps: 24, dias_pausa_por_manual: 5, permitir_forzar_manual: true },
  intencion: { etiquetar: true, notificar: true, solo_desde_cta: true },
  cierre: { bloquear_con_no_leidos: true },
};

let cache: { v: ConfigEntrante; hasta: number } | null = null;

const num = (x: any, d: number) => (Number.isFinite(Number(x)) ? Number(x) : d);
const bool = (x: any, d: boolean) => (typeof x === 'boolean' ? x : d);
const txt = (x: any, d: string) => (typeof x === 'string' && x.trim() ? x : d);

export async function configEntrante(): Promise<ConfigEntrante> {
  if (cache && Date.now() < cache.hasta) return cache.v;
  let v = POR_DEFECTO;
  try {
    const { data } = await supabase.from('crm_secuencias')
      .select('activa, entrada').eq('disparador', 'wa_entrante').limit(1).maybeSingle();
    if (data) {
      const e: any = data.entrada || {};
      v = {
        activa: !!data.activa,
        acuse: {
          activo: bool(e.acuse?.activo, POR_DEFECTO.acuse.activo),
          en_horario: txt(e.acuse?.en_horario, POR_DEFECTO.acuse.en_horario),
          fuera: txt(e.acuse?.fuera, POR_DEFECTO.acuse.fuera),
          rearme_horas: num(e.acuse?.rearme_horas, POR_DEFECTO.acuse.rearme_horas),
          silencio_humano_horas: num(e.acuse?.silencio_humano_horas, POR_DEFECTO.acuse.silencio_humano_horas),
        },
        horario: e.horario?.desde && e.horario?.hasta ? e.horario as Horario : null,
        presion: {
          // Tope duro: por más que alguien escriba 0 en la pantalla, no se
          // permite escribirle a un lead cada minuto.
          horas_entre_whatsapps: Math.max(1, num(e.presion?.horas_entre_whatsapps, POR_DEFECTO.presion.horas_entre_whatsapps)),
          dias_pausa_por_manual: Math.max(0, num(e.presion?.dias_pausa_por_manual, POR_DEFECTO.presion.dias_pausa_por_manual)),
          permitir_forzar_manual: bool(e.presion?.permitir_forzar_manual, POR_DEFECTO.presion.permitir_forzar_manual),
        },
        intencion: {
          etiquetar: bool(e.intencion?.etiquetar, POR_DEFECTO.intencion.etiquetar),
          notificar: bool(e.intencion?.notificar, POR_DEFECTO.intencion.notificar),
          solo_desde_cta: bool(e.intencion?.solo_desde_cta, POR_DEFECTO.intencion.solo_desde_cta),
        },
        cierre: { bloquear_con_no_leidos: bool(e.cierre?.bloquear_con_no_leidos, POR_DEFECTO.cierre.bloquear_con_no_leidos) },
      };
    }
  } catch { /* la columna puede no existir todavía: rigen los defaults */ }
  cache = { v, hasta: Date.now() + 60_000 };
  return v;
}

/** Para las pruebas y para cuando la pantalla acaba de guardar. */
export function olvidarConfigEntrante() { cache = null; }

/** ¿Estamos dentro del horario de atención? (hora de Ciudad de México) */
export function dentroDeHorario(h?: Horario | null, ahora = new Date()): boolean {
  if (!h?.desde || !h?.hasta) return true;   // sin horario configurado = siempre abierto
  const mx = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const dia = mx.getDay() === 0 ? 7 : mx.getDay();          // 1=lun … 7=dom
  if (Array.isArray(h.dias) && h.dias.length && !h.dias.includes(dia)) return false;
  const hhmm = `${String(mx.getHours()).padStart(2, '0')}:${String(mx.getMinutes()).padStart(2, '0')}`;
  return hhmm >= h.desde && hhmm <= h.hasta;
}
