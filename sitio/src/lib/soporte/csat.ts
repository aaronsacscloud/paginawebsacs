// SOPORTE · CSAT post-resolución. Al resolverse un ticket, la cuenta se agrega a
// UNA campaña Outbound singleton (encuesta con caras) que el ERP muestra la
// próxima vez que el cliente entra. Cierra el círculo: soporte medido con dato,
// no solo volumen. La respuesta vuelve por inapp_eventos y se mapea al ticket en
// el cron outbound-sync (ver cerrarLoopCSAT).
import { supabase } from '../supabase';
import { publicarCampana } from '../outbound/motor';
import { normCuenta } from '../crm/sacs-cuentas';

const META_FLAG = { csat_soporte: true };

// Condición IMPOSIBLE: con grupos así, ninguna empresa entra por segmentación y
// la campaña resuelve SOLO a incluir_cuentas (las de tickets resueltos).
const COND_IMPOSIBLE = { grupos: [{ condiciones: [{ campo: 'estado_cuenta', operador: 'es', valor: '__ninguno__' }] }] };

async function leerSingleton(): Promise<any | null> {
  const { data } = await supabase.from('inapp_campanas').select('*').contains('meta', META_FLAG).limit(1).maybeSingle();
  return data || null;
}

/** Devuelve la campaña CSAT singleton; la crea (activa) si no existe. El índice
 *  único parcial (meta->>'csat_soporte') evita duplicados en carrera: si dos
 *  webhooks la insertan a la vez, el 2º choca (23505) y re-lee la existente. */
export async function asegurarCampanaCSAT(): Promise<any | null> {
  try {
    const ya = await leerSingleton();
    if (ya) return ya;

    const fila: any = {
      estado: 'activa',
      nombre: 'CSAT post-soporte',
      objetivo_texto: 'Satisfacción tras resolver un ticket',
      formato: 'encuesta',
      canal: 'inapp',
      prioridad: 'baja',
      modo: 'continua',
      reentrada_dias: null,
      // NO recurrencia por tiempo: la cuenta se quita al responder (csat_quitar_cuenta
      // en outbound-sync) y un ticket resuelto nuevo la re-agrega. Así es "por
      // ticket" sin encuestar por siempre a la base histórica.
      recurrencia_dias: null,
      holdout_pct: 0,
      contenido: { titulo: '¿Cómo estuvo la atención de tu solicitud de soporte?', encuesta: { escala: 'csat_emoji' }, botones: [] },
      comportamiento: { trigger: 'al_iniciar', frecuencia: { tipo: 'hasta_interactuar', tope: 3, descanso_dias: 1 }, cerrable: true },
      audiencia: { ...COND_IMPOSIBLE, incluir_cuentas: [], excluir_con_ticket_abierto: false },
      nivel: { tipo: 'todos' },
      meta: META_FLAG,
      creada_por: 'sistema:soporte',
    };
    const { data, error } = await supabase.from('inapp_campanas').insert(fila).select('*').single();
    if (error) {
      // 23505 = otra invocación la creó primero: re-leer la existente.
      if ((error as any).code === '23505') return await leerSingleton();
      console.error('asegurarCampanaCSAT insert', error.message); return null;
    }
    return data;
  } catch (e) { console.error('asegurarCampanaCSAT', (e as any)?.message || e); return null; }
}

/** Encola la cuenta en la campaña CSAT (ATÓMICO vía RPC, sin carrera de
 *  lost-update) y re-publica al ERP solo si se agregó. Devuelve el id de la
 *  campaña (para el ticket) o null. No lanza. */
export async function dispararCSAT(cuenta: string | null): Promise<string | null> {
  const c = normCuenta(cuenta);
  if (!c) return null;
  try {
    const campana = await asegurarCampanaCSAT();
    if (!campana) return null;
    const { data: agregada, error } = await supabase.rpc('csat_encolar_cuenta', { p_campana: campana.id, p_cuenta: c });
    if (error) { console.error('csat_encolar_cuenta', error.message); return campana.id; }
    if (agregada) {
      // Re-leer FRESCO (incluye lo que otros ticks concurrentes hayan encolado)
      // y publicar la lista completa. El último publish gana con todo.
      const fresca = await leerSingleton();
      if (fresca) {
        // Candado: si alguien editó la campaña y perdió la condición imposible,
        // `grupos:[]` haría que resuelva a TODA la base. Re-afirmarla antes de publicar.
        if (!fresca.audiencia?.grupos?.length) {
          fresca.audiencia = { ...(fresca.audiencia || {}), grupos: COND_IMPOSIBLE.grupos };
          await supabase.from('inapp_campanas').update({ audiencia: fresca.audiencia }).eq('id', fresca.id);
        }
        try { await publicarCampana(fresca, {}); } catch (e) { console.error('dispararCSAT publicar', (e as any)?.message || e); }
      }
    }
    return campana.id;
  } catch (e) { console.error('dispararCSAT', (e as any)?.message || e); return null; }
}

/** Quita la cuenta de la CSAT (al responder). Best-effort. */
export async function quitarCuentaCSAT(campanaId: string, cuenta: string | null): Promise<void> {
  const c = normCuenta(cuenta);
  if (!c || !campanaId) return;
  try { await supabase.rpc('csat_quitar_cuenta', { p_campana: campanaId, p_cuenta: c }); }
  catch (e) { console.error('quitarCuentaCSAT', (e as any)?.message || e); }
}
