// ─── RACHA FILANTRÓPICA del partner DE COBRO (costo_unico > 0) ───
// Fuente ÚNICA de los umbrales y extras. La consumen:
//   · la invitación (tab Filantropía, cláusula 5.4, ejemplo con pesos)
//   · el portal del partner (LevelTab: barra de racha · MoneyTab: línea del extra)
//   · el CRM (rachas del mes por partner, mensaje de invitación)
// ⚠️ Si cambias umbrales/extras aquí, revisa también las MENCIONES NARRATIVAS
// en [id].astro (busca "filantrop"): TL;DR, bw.b2, FAQs y glosario citan los
// números en texto corrido en 5 idiomas.
export const FIL_TIERS = [
  { pts: 100, extra: 2.5 },
  { pts: 300, extra: 5 },
  { pts: 500, extra: 10 },
] as const;

/** Extra (puntos porcentuales de comisión) según los puntos filantrópicos del
 *  mes. Aplica el nivel MÁS ALTO alcanzado; sin arrastre entre meses. */
export function extraPorPuntos(pts: number): number {
  let extra = 0;
  for (const t of FIL_TIERS) if (pts >= t.pts) extra = t.extra;
  return extra;
}

/** Siguiente umbral por alcanzar (o null si ya está en el tope). */
export function siguienteTier(pts: number): { pts: number; extra: number } | null {
  for (const t of FIL_TIERS) if (pts < t.pts) return t;
  return null;
}
