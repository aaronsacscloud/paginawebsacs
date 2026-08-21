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

/** Devuelve la campaña CSAT singleton; la crea (activa) si no existe. */
export async function asegurarCampanaCSAT(): Promise<any | null> {
  try {
    const { data: ya } = await supabase.from('inapp_campanas')
      .select('*').contains('meta', META_FLAG).limit(1).maybeSingle();
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
      recurrencia_dias: null,
      holdout_pct: 0,
      contenido: { titulo: '¿Cómo estuvo la atención de tu solicitud de soporte?', encuesta: { escala: 'csat_emoji' }, botones: [] },
      comportamiento: { trigger: 'al_iniciar', frecuencia: { tipo: '1_vez', tope: 1, descanso_dias: 0 }, cerrable: true },
      audiencia: { ...COND_IMPOSIBLE, incluir_cuentas: [], excluir_con_ticket_abierto: false },
      nivel: { tipo: 'todos' },
      meta: META_FLAG,
      creada_por: 'sistema:soporte',
    };
    const { data, error } = await supabase.from('inapp_campanas').insert(fila).select('*').single();
    if (error) { console.error('asegurarCampanaCSAT insert', error.message); return null; }
    return data;
  } catch (e) { console.error('asegurarCampanaCSAT', (e as any)?.message || e); return null; }
}

/** Agrega la cuenta a la campaña CSAT y la re-publica al ERP. Devuelve el id de
 *  la campaña (para guardarlo en el ticket) o null si no se pudo. No lanza. */
export async function dispararCSAT(cuenta: string | null): Promise<string | null> {
  const c = normCuenta(cuenta);
  if (!c) return null;
  try {
    const campana = await asegurarCampanaCSAT();
    if (!campana) return null;
    const aud = campana.audiencia || { ...COND_IMPOSIBLE, incluir_cuentas: [] };
    const lista: string[] = Array.isArray(aud.incluir_cuentas) ? aud.incluir_cuentas.slice() : [];
    if (!lista.includes(c)) {
      lista.push(c);
      const nuevaAud = { ...aud, incluir_cuentas: lista, excluir_con_ticket_abierto: false };
      await supabase.from('inapp_campanas').update({ audiencia: nuevaAud, updated_at: new Date().toISOString() }).eq('id', campana.id);
      campana.audiencia = nuevaAud;
      // Publicar al ERP (best-effort). Si falla el sync, el cron continua la
      // re-materializa igual (modo continua).
      try { await publicarCampana(campana, {}); } catch (e) { console.error('dispararCSAT publicar', (e as any)?.message || e); }
    }
    return campana.id;
  } catch (e) { console.error('dispararCSAT', (e as any)?.message || e); return null; }
}
