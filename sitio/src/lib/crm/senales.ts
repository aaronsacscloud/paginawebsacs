// Motor de SEÑALES de venta/riesgo — deriva de la actividad REAL de SACS que el
// cron ya sincroniza en companies.actividad (sin pegarle a SACS). Lo usan el
// drawer 360 (panel "Qué venderle"), la sección Oportunidades y, después, el
// portal del partner. Función PURA → corre igual en server y cliente.

export type Nivel = 'oportunidad' | 'riesgo';
export type Senal = {
  tipo: string;
  nivel: Nivel;
  titulo: string;      // qué está pasando (con datos)
  detalle: string;     // por qué importa
  accion: string;      // QUÉ ofrecerle / hacer
  peso: number;        // para ordenar (mayor = más urgente/valioso)
};

const PLANES_BASICOS = ['vende', 'controla'];
const PLANES_CON_MODULOS = ['controla', 'fideliza', 'automatiza'];

// co: fila de companies con { plan, sucursales, mrr, arr, health_score,
//     dias_sin_venta, estado_cuenta, actividad{...} }. subActiva: suscripción activa (opcional).
export function computarSenales(co: any, subActiva?: any): Senal[] {
  const a = (co && co.actividad) || {};
  const out: Senal[] = [];
  const dias = co.dias_sin_venta;
  const sucReales = Number(a.sucursales || 0);
  const sucPlan = Number(co.sucursales || 0);
  const tend = a.tendencia_pct;
  const opsUsuarios = Number(a.usuarios_operando || 0);
  const nMod = Array.isArray(a.modulos) ? a.modulos.length : 0;
  const plan = String(co.plan || '').toLowerCase();

  // ── RIESGOS ──
  if (dias != null && dias > 15) {
    out.push({ tipo: 'riesgo_churn', nivel: 'riesgo', peso: 100,
      titulo: `Lleva ${dias} días sin vender`,
      detalle: 'Dejar de vender es el predictor #1 de cancelación.',
      accion: 'Contáctalo esta semana: ofrécele ayuda/capacitación para reactivar el uso.' });
  } else if (co.health_score != null && co.health_score < 40) {
    out.push({ tipo: 'salud_baja', nivel: 'riesgo', peso: 80,
      titulo: `Salud baja (${co.health_score}/100)`,
      detalle: 'Está usando poco el sistema — riesgo de abandono.',
      accion: 'Llamada de seguimiento + revisar qué le falta activar.' });
  }
  const vencida = co.estado_cuenta === 'vencido' || (subActiva && subActiva.proxima_factura && subActiva.proxima_factura < new Date().toISOString().slice(0, 10));
  if (vencida) {
    out.push({ tipo: 'pago_vencido', nivel: 'riesgo', peso: 90,
      titulo: 'Pago/renovación vencida',
      detalle: 'Su factura ya pasó de fecha.',
      accion: 'Gestiona el cobro antes de que se corte el servicio.' });
  }

  // ── OPORTUNIDADES (qué venderle) ──
  if (sucReales > 0 && sucPlan > 0 && sucReales > sucPlan) {
    out.push({ tipo: 'sucursales', nivel: 'oportunidad', peso: 70,
      titulo: `Opera ${sucReales} sucursales y su plan cubre ${sucPlan}`,
      detalle: 'Ya está usando más sucursales de las que paga.',
      accion: `Ofrécele ampliar a ${sucReales} sucursales en su plan.` });
  }
  if (tend != null && tend >= 20) {
    out.push({ tipo: 'creciendo', nivel: 'oportunidad', peso: 60,
      titulo: `Sus ventas subieron ${tend}% vs. el mes anterior`,
      detalle: 'Negocio en crecimiento = buen momento para vender más.',
      accion: 'Propón un plan superior o módulos nuevos aprovechando el impulso.' });
  }
  if (opsUsuarios >= 4 && PLANES_BASICOS.indexOf(plan) >= 0) {
    out.push({ tipo: 'equipo', nivel: 'oportunidad', peso: 55,
      titulo: `${opsUsuarios} personas operando el sistema`,
      detalle: 'Equipo grande en un plan básico.',
      accion: 'Candidato a Fideliza/Automatiza (más control, permisos y automatización).' });
  }
  if (nMod > 0 && nMod <= 2 && PLANES_CON_MODULOS.indexOf(plan) >= 0) {
    out.push({ tipo: 'modulos', nivel: 'oportunidad', peso: 45,
      titulo: `Solo usa ${nMod} módulo(s) de su plan`,
      detalle: 'Está desaprovechando lo que paga → menos valor percibido.',
      accion: 'Capacitación para activar más módulos (más valor = menos churn).' });
  }

  return out.sort((x, y) => y.peso - x.peso);
}

// Etiqueta corta por tipo (para chips/filtros).
export const SENAL_LABEL: Record<string, string> = {
  riesgo_churn: 'Dejó de vender',
  salud_baja: 'Salud baja',
  pago_vencido: 'Pago vencido',
  sucursales: 'Ampliar sucursales',
  creciendo: 'Creciendo',
  equipo: 'Equipo grande',
  modulos: 'Activar módulos',
};
