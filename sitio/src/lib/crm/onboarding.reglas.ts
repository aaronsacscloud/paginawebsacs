// ══ Onboarding: las reglas PURAS (sin Supabase) ════════════════════════════
//
// Separadas de onboarding.lib a propósito: la pestaña del navegador importa
// de AQUÍ. Si esto trajera el cliente de Supabase, el bundle del CRM se caería
// con «supabaseUrl is required» — exactamente lo que pasó con churn.lib y lo
// que acaba de volver a pasar con este módulo antes de este split.

export type EtapaOnboarding = 'cuenta_lista' | 'configurado' | 'primer_uso' | 'uso_constante' | 'graduado' | 'perdido_temprano';

export const ETAPAS_ONB: { id: EtapaOnboarding; l: string; ayuda: string }[] = [
  { id: 'cuenta_lista', l: 'Cuenta lista', ayuda: 'Tiene acceso; falta que la haga suya' },
  { id: 'configurado', l: 'Configurado', ayuda: 'Catálogo cargado y equipo invitado' },
  { id: 'primer_uso', l: 'Primer uso', ayuda: 'Ya hizo su primera venta real' },
  { id: 'uso_constante', l: 'Uso constante', ayuda: 'Vende varios días por semana' },
  { id: 'graduado', l: 'Graduado', ayuda: 'Llegó al día 30 usando el sistema' },
  { id: 'perdido_temprano', l: 'Perdido temprano', ayuda: 'Canceló durante el arranque; pasó a Churn' },
];
export const ETAPA_ONB = (id?: string | null) => ETAPAS_ONB.find(e => e.id === id) || { id, l: String(id || '—'), ayuda: '' } as any;

/** Qué hitos cumple HOY este uso. Puro: sin red, para poder probarse. */
export function hitosDeUso(uso: any, reglas: any): { configurado: boolean; primer_uso: boolean; uso_constante: boolean } {
  const r = reglas || {};
  const mods: any[] = Array.isArray(uso?.modulos) ? uso.modulos : [];
  const pos = mods.find(m => /punto de venta/i.test(String(m?.modulo || '')));
  const ventasTotal = mods.filter(m => m?.familia === 'Ventas').reduce((s, m) => s + (Number(m?.total) || 0), 0);
  /* «Configurado» = catálogo cargado y equipo invitado. Lo mide
     `uso_sacs.catalogo` (pieza nueva del sync, commit 0f585672 de sacs_api).
     Si el dato no viene —sync viejo, cuenta sin medir—, el hito NO se da por
     bueno: un hito regalado gradúa a alguien que nunca arrancó. */
  const cat = uso?.catalogo || {};
  const configurado = (Number(cat.productos) || 0) >= (Number(r?.configurado?.productos_min) || 10)
    && (Number(cat.usuarios) || 0) >= (Number(r?.configurado?.usuarios_min) || 2);
  const primer_uso = ventasTotal >= (Number(r?.primer_uso?.ventas_min) || 1);
  /* «Constante» con la señal que el sync SÍ trae por módulo: docs_7d del punto
     de venta como aproximación de días vendiendo. El umbral vive en reglas. */
  const uso_constante = primer_uso && (Number(pos?.docs_7d) || 0) >= ((Number(r?.uso_constante?.dias_con_venta) || 3));
  return { configurado, primer_uso, uso_constante };
}

/** La etapa que le corresponde a un caso según sus hitos y su edad. */
export function etapaDeCaso(hitos: Record<string, string>, inicio: string, reglas: any, hoy = new Date()): EtapaOnboarding {
  const dias = Math.floor((hoy.getTime() - Date.parse(inicio + 'T06:00:00Z')) / 86400000);
  const grad = Number(reglas?.graduacion_dia) || 30;
  if (hitos.uso_constante && dias >= grad) return 'graduado';
  if (hitos.uso_constante) return 'uso_constante';
  if (hitos.primer_uso) return 'primer_uso';
  if (hitos.configurado) return 'configurado';
  return 'cuenta_lista';
}

/** Cuántos días lleva sin avanzar es "atorado" en su etapa actual. */
export function umbralAtorado(etapa: EtapaOnboarding, reglas: any): number {
  const a = reglas?.atorado_dias || {};
  return Number(a[etapa]) || (etapa === 'primer_uso' ? 7 : 5);
}

