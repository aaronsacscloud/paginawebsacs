// ══ Onboarding de clientes nuevos: las reglas y el caso ════════════════════
//
// Espejo de churn.lib: un caso por empresa, etapas que avanzan por HECHOS.
// Los hitos se miden en `companies.uso_sacs` — al cliente no se le pregunta
// si ya configuró: se ve en sus datos. Solo se GUARDA la fecha en que cada
// hito se cumplió; el estado se recalcula del uso vivo (la lección de
// `ultima_actividad_venta_at`, la columna que nadie refresca).
//
// TODO el módulo respeta el interruptor `onboarding_config.activo`: apagado,
// no se abren casos ni se manda nada. Al encenderlo, solo entran clientes
// NUEVOS (primera suscripción viva posterior al encendido).
import { supabase } from '../supabase';
export * from './onboarding.reglas';

export async function configOnboarding(): Promise<{ activo: boolean; activado_at: string | null; reglas: any }> {
  const { data } = await supabase.from('onboarding_config').select('*').eq('id', 'main').maybeSingle();
  return { activo: !!data?.activo, activado_at: data?.activado_at || null, reglas: data?.reglas || {} };
}

/**
 * Abre el caso si aplica. Idempotente por el índice único de caso abierto.
 * SOLO abre si: el interruptor está encendido, la empresa tiene cuenta
 * ligada, y no es un cliente de antes del encendido.
 */
export async function abrirOnboardingSiAplica(companyId: string, o?: { quien?: string }): Promise<{ creado: boolean; motivo?: string }> {
  const cfg = await configOnboarding();
  if (!cfg.activo) return { creado: false, motivo: 'onboarding pausado' };

  const { data: co } = await supabase.from('companies')
    .select('id, nombre, sacs_account, uso_sacs, owner_id').eq('id', companyId).maybeSingle();
  if (!co) return { creado: false, motivo: 'no existe la empresa' };

  const { data: liga } = await supabase.from('company_sacs_accounts').select('cuenta').eq('company_id', companyId).limit(1);
  const cuenta = liga?.[0]?.cuenta || co.sacs_account;
  if (!cuenta) return { creado: false, motivo: 'sin cuenta ligada' };

  /* Cliente NUEVO = su primera suscripción viva es posterior al encendido.
     Es lo que evita que los 81 existentes entren en masa. */
  if (cfg.activado_at) {
    /* Por cuándo EMPEZÓ a pagar, no por cuándo se creó la fila. La licencia
       se crea al cerrar la cotización y se activa al cobrar: mirando
       `created_at`, un cliente cuya licencia nació la semana pasada y paga
       hoy —después del encendido— se descartaba como «de antes» y su
       onboarding no abría nunca. */
    const { data: subs } = await supabase.from('subscriptions')
      .select('fecha_inicio, created_at').eq('company_id', companyId).eq('estado', 'activa');
    const arranque = (s: any) => Date.parse(s.fecha_inicio || s.created_at || 0) || 0;
    const corte = Date.parse(cfg.activado_at);
    if ((subs || []).some(s => arranque(s) < corte)) {
      return { creado: false, motivo: 'cliente de antes del encendido' };
    }
  }

  const { data: abierto } = await supabase.from('onboarding_casos')
    .select('id').eq('company_id', companyId).is('cerrado_at', null).limit(1);
  if (abierto?.length) return { creado: false, motivo: 'ya tiene caso abierto' };

  const { error } = await supabase.from('onboarding_casos').insert({
    company_id: companyId,
    consultor_id: co.owner_id || null,
    uso_al_abrir: co.uso_sacs || null,
  });
  if (error) return { creado: false, motivo: error.message };

  await supabase.from('activities').insert({
    company_id: companyId, tipo: 'sistema', automatico: true,
    titulo: `Onboarding abierto: ${co.nombre || cuenta} arranca sus 30 días`,
    metadata: { onboarding: true, quien: o?.quien || null },
  });
  return { creado: true };
}
