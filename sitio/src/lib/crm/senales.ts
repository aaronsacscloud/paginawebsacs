// Motor de SEÑALES de venta/riesgo — deriva de la actividad REAL de SACS que el
// cron ya sincroniza en companies.actividad (sin pegarle a SACS). Lo usan el
// drawer 360 (panel "Qué venderle"), la sección Oportunidades y, después, el
// portal del partner. Función PURA → corre igual en server y cliente.

import { planBase, pluginsContratados, modulosFueraDePlan, planQueLoCubre, ARR_PLAN } from './plan-modulos';

export type Nivel = 'oportunidad' | 'riesgo';
export type Senal = {
  tipo: string;
  nivel: Nivel;
  titulo: string;      // qué está pasando (con datos)
  detalle: string;     // por qué importa
  accion: string;      // QUÉ ofrecerle / hacer
  peso: number;        // para ordenar (mayor = más urgente/valioso)
};

// Contexto extra que el llamador PUEDE dar. Va como objeto opcional para no
// romper a quien ya llama con dos argumentos (el drawer, el portal del partner).
export type SenalesOpts = {
  catalogo?: any;        // CatalogoPlanes de lib/crm/plan-modulos (lo carga el server)
  subsActivas?: any[];   // todas las subs activas, para derivar plan y plugins
};

const PLANES_BASICOS = ['vende', 'controla'];
const PLANES_CON_MODULOS = ['controla', 'fideliza', 'automatiza'];

// co: fila de companies con { plan, sucursales, mrr, arr, health_score,
//     dias_sin_venta, estado_cuenta, actividad{...}, uso_sacs{...} }.
// subActiva: suscripción ACTIVA. Sin suscripción activa NO hay análisis: un
// cliente ya cancelado no es candidato a upsell ni a alertas comerciales aquí
// (el caso "cancelada pero sigue usando" lo cubre el cron de alertas).
export function computarSenales(co: any, subActiva?: any, opts?: SenalesOpts): Senal[] {
  if (!subActiva) return [];
  const a = (co && co.actividad) || {};
  const uso = (co && co.uso_sacs) || null;
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

  // ── OPORTUNIDADES desde el USO PROFUNDO (uso_sacs, cron de madrugada) ──
  if (uso) {
    const clientes = Number(uso.clientes?.total || 0);
    if (uso.lealtad && !uso.lealtad.activo && clientes >= 50) {
      out.push({ tipo: 'lealtad', nivel: 'oportunidad', peso: 50,
        titulo: `Tiene ${clientes.toLocaleString()} clientes y no usa lealtad`,
        detalle: 'La base de clientes ya existe — el programa de lealtad la convierte en recompra.',
        accion: 'Ofrécele activar el programa de lealtad.' });
    }
    if (uso.lealtad && uso.lealtad.activo && uso.lealtad.tipo === 'basico' && Number(uso.lealtad.inscritos || 0) >= 100) {
      out.push({ tipo: 'lealtad_upgrade', nivel: 'oportunidad', peso: 48,
        titulo: `Lealtad básico con ${Number(uso.lealtad.inscritos).toLocaleString()} inscritos`,
        detalle: 'El programa ya prendió — el completo (niveles y puntos) multiplica la recompra.',
        accion: 'Súbelo a lealtad completo.' });
    }
    if (uso.facturacion && !uso.facturacion.configurada && Number(a.ventas_30d || 0) > 0) {
      out.push({ tipo: 'facturacion', nivel: 'oportunidad', peso: 42,
        titulo: 'Vende pero no tiene facturación electrónica configurada',
        detalle: 'Facturar desde SACS le ahorra el doble capturado y lo amarra al sistema.',
        accion: 'Ofrécele configurar la facturación electrónica.' });
    }
    // ── Usa módulos que su plan NO cubre → upsell con número ──
    // Se apoya en el catálogo (tabla crm_plan_modulos); si el llamador no lo
    // pasó, la señal no opina en vez de adivinar.
    if (opts?.catalogo) {
      try {
        const subs = opts.subsActivas && opts.subsActivas.length ? opts.subsActivas : [subActiva];
        const planReal = planBase(subs);
        const fuera = modulosFueraDePlan(planReal, uso.modulos, pluginsContratados(subs), opts.catalogo);
        if (planReal && fuera.length) {
          const nombres = fuera.map((f: any) => f.modulo);
          const destino = planQueLoCubre(fuera, opts.catalogo);
          const delta = destino && ARR_PLAN[destino] && ARR_PLAN[planReal]
            ? ARR_PLAN[destino] - ARR_PLAN[planReal] : 0;
          const dudoso = fuera.some((f: any) => f.por_confirmar);
          out.push({
            tipo: 'modulo_fuera_de_plan', nivel: 'oportunidad', peso: dudoso ? 58 : 75,
            titulo: `Usa ${nombres.length} módulo(s) que su plan ${planReal} no cubre: ${nombres.join(', ')}`,
            detalle: destino
              ? `Ya opera como cliente ${destino}: lo está usando este mes, solo que sin pagarlo.`
              : 'Está operando módulos fuera de lo que contrató.',
            accion: destino
              ? `Súbelo a ${destino}${delta > 0 ? ` (+$${delta.toLocaleString('es-MX')}/año)` : ''}.`
              : 'Revisa qué plan o plugin corresponde.',
          });
        }
      } catch { /* el catálogo nunca tumba el resto de las señales */ }
    }

    const adm = uso.administracion || {};
    if (Number(adm.gastos_30d || 0) === 0 && Number(adm.proveedores || 0) === 0 && !adm.bancos && Number(a.ventas_30d || 0) > 0) {
      out.push({ tipo: 'administracion', nivel: 'oportunidad', peso: 40,
        titulo: 'No usa los módulos de administración',
        detalle: 'Gastos, cuentas por pagar y proveedores viven fuera de SACS → menos valor percibido.',
        accion: 'Ofrécele el módulo de administración (gastos, CxP, proveedores).' });
    }
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
  lealtad: 'Ofrecer lealtad',
  lealtad_upgrade: 'Subir a lealtad completo',
  facturacion: 'Ofrecer facturación',
  administracion: 'Ofrecer administración',
};
