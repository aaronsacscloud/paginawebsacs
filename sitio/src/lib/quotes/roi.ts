// ─── Calculadora de ROI por plan ────────────────────────────────────────────
//
// Antes esto eran cuatro campos de texto: se escribía "ahorro mensual: 15000" a
// mano y lo único automático era multiplicarlo por 12. Nadie lo usaba, porque
// inventar el número es más difícil que capturarlo.
//
// Ahora se capturan TRES datos que el cliente ya dijo en la llamada —cuánto
// vende, cuántas sucursales, cuántas horas gasta— y el ahorro sale de una
// plantilla ligada al plan que se está cotizando.
//
// Los porcentajes son conservadores a propósito: vale más prometer de menos y
// que el cliente lo compruebe, que prometer 5% de merma y que se lo tumben en
// la junta. Todos son editables por cotización.
//
// Lo que este cálculo NO hace, porque es lo que le quita credibilidad a un ROI:
// no promete más ventas por "vender mejor", no cuenta personal despedido, y no
// mete el costo de la implementación del lado del ahorro.

export type TipoDriver = 'pct_ventas' | 'horas' | 'pct_stock' | 'pct_compras' | 'clientes_dormidos';

export interface Driver {
  key: string;
  label: string;
  detalle: string;
  tipo: TipoDriver;
  valor: number;   // % o número de horas, según el tipo
  on: boolean;     // se puede apagar por cotización sin perder el renglón
}

export interface EntradasRoi {
  ventas_mes?: number;
  sucursales?: number;
  costo_hora?: number;
  stock_valor?: number;
  compras_mes?: number;
  clientes_activos?: number;
  ticket_promedio?: number;
}

// El costo de la hora escala con el plan a propósito: quien opera una tienda no
// cuesta lo mismo que quien administra cuatro.
export const COSTO_HORA_POR_PLAN: Record<string, number> = {
  vende: 120, controla: 150, fideliza: 150, automatiza: 200,
};

export const PLANTILLAS_ROI: Record<string, { titulo: string; nota: string; drivers: Driver[] }> = {
  vende: {
    titulo: 'Vende · primera tienda',
    nota: 'El dolor está en el mostrador, no en el inventario.',
    drivers: [
      { key: 'ventas_no_registradas', label: 'Ventas no registradas y errores de cobro', detalle: 'Ticket manual y cuadre a ojo', tipo: 'pct_ventas', valor: 0.5, on: true },
      { key: 'horas_corte', label: 'Horas en corte de caja y captura', detalle: '2 horas por semana', tipo: 'horas', valor: 8, on: true },
      { key: 'venta_online', label: 'Venta nueva por tienda en línea y redes', detalle: 'Solo si todavía no vende en línea', tipo: 'pct_ventas', valor: 2, on: true },
    ],
  },
  controla: {
    titulo: 'Controla · multi-sucursal',
    nota: 'Aquí el dinero está parado en el inventario.',
    drivers: [
      { key: 'merma', label: 'Merma y descuadres de inventario', detalle: 'Conteo cíclico y kardex', tipo: 'pct_ventas', valor: 1.5, on: true },
      { key: 'quiebre', label: 'Venta perdida por quiebre de stock', detalle: 'Reabasto sugerido y alertas', tipo: 'pct_ventas', valor: 1.0, on: true },
      { key: 'horas_inventario', label: 'Horas de conteo, traspasos y órdenes', detalle: '12 horas al mes', tipo: 'horas', valor: 12, on: true },
      // Apagado de fábrica: explicar costo de oportunidad en una junta de ventas
      // cuesta más de lo que suma, y un renglón que no se sabe defender resta.
      { key: 'sobrestock', label: 'Capital detenido en sobrestock', detalle: 'Costo de oportunidad del inventario parado', tipo: 'pct_stock', valor: 2, on: false },
    ],
  },
  fideliza: {
    titulo: 'Fideliza · clientes que regresan',
    nota: 'El ROI aquí es ingreso extra, no ahorro.',
    drivers: [
      { key: 'recompra', label: 'Recompra por monedero y niveles', detalle: 'Sobre la base de clientes identificados', tipo: 'pct_ventas', valor: 6, on: true },
      { key: 'dormidos', label: 'Clientes dormidos recuperados', detalle: 'Campañas de WhatsApp y correo', tipo: 'clientes_dormidos', valor: 3, on: true },
      { key: 'ticket', label: 'Ticket promedio por recompensas', detalle: 'Niveles y beneficios por compra', tipo: 'pct_ventas', valor: 4, on: true },
    ],
  },
  automatiza: {
    titulo: 'Automatiza · piloto automático',
    nota: 'Se justifica en horas de gente, no en pesos de inventario.',
    drivers: [
      { key: 'horas_admin', label: 'Horas administrativas automatizadas', detalle: 'Reabasto, facturación y reportes', tipo: 'horas', valor: 40, on: true },
      { key: 'prediccion', label: 'Quiebres evitados por predicción de demanda', detalle: 'Pronóstico con IA', tipo: 'pct_ventas', valor: 1.5, on: true },
      { key: 'compras', label: 'Compras mejor programadas', detalle: 'Órdenes automáticas por punto de reorden', tipo: 'pct_compras', valor: 0.8, on: true },
    ],
  },
};

// 'personalizada' y 'soporte_premium' se venden por alcance: forzarles una
// plantilla produciría un número sin sustento. Se quedan sin ROI automático.
export const PLANES_SIN_PLANTILLA = ['personalizada', 'soporte_premium'];

// Cotizar Controla + Fideliza junto es lo común. Las plantillas se suman, pero
// un renglón repetido se cuenta UNA vez: sumar dos veces "venta perdida por
// quiebre" duplicaría el ahorro y el ROI dejaría de ser defendible.
export function driversParaPlanes(planes: string[]): Driver[] {
  const vistos = new Set<string>();
  const out: Driver[] = [];
  for (const p of planes) {
    for (const d of PLANTILLAS_ROI[p]?.drivers || []) {
      if (vistos.has(d.key)) continue;
      vistos.add(d.key);
      out.push({ ...d });
    }
  }
  return out;
}

export function costoHoraParaPlanes(planes: string[]): number {
  return Math.max(120, ...planes.map(p => COSTO_HORA_POR_PLAN[p] || 0));
}

export interface RenglonRoi { key: string; label: string; monto: number; formula: string }

export function calcularRoi(entradas: EntradasRoi, drivers: Driver[]) {
  const v = Number(entradas.ventas_mes || 0);
  const hora = Number(entradas.costo_hora || 150);
  const stock = Number(entradas.stock_valor || 0);
  const compras = Number(entradas.compras_mes || 0);
  const clientes = Number(entradas.clientes_activos || 0);
  const ticket = Number(entradas.ticket_promedio || 0);
  const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

  const renglones: RenglonRoi[] = [];
  for (const d of drivers) {
    if (!d.on) continue;
    let monto = 0, formula = '';
    switch (d.tipo) {
      case 'pct_ventas': monto = v * (d.valor / 100); formula = `${d.valor}% de ${pesos(v)} en ventas`; break;
      case 'horas': monto = d.valor * hora; formula = `${d.valor} h al mes a ${pesos(hora)}`; break;
      case 'pct_stock': monto = stock * (d.valor / 100); formula = `${d.valor}% de ${pesos(stock)} en inventario`; break;
      case 'pct_compras': monto = compras * (d.valor / 100); formula = `${d.valor}% de ${pesos(compras)} en compras`; break;
      case 'clientes_dormidos': monto = clientes * (d.valor / 100) * ticket; formula = `${d.valor}% de ${clientes} clientes a ${pesos(ticket)} de ticket`; break;
    }
    // Un renglón en cero no aporta y sí ensucia: si falta el dato de entrada,
    // simplemente no aparece en la cotización del cliente.
    if (monto <= 0) continue;
    renglones.push({ key: d.key, label: d.label, monto: Math.round(monto), formula });
  }
  const mensual = renglones.reduce((a, r) => a + r.monto, 0);
  return { renglones, mensual, anual: mensual * 12 };
}

// "Se paga solo en X" — el número que de verdad cierra. Se calcula contra el
// costo RECURRENTE, no contra el total: la implementación es un pago único y
// mezclarla infla los días.
export function payback(ahorroMensual: number, costoMensual: number): string | null {
  if (ahorroMensual <= 0 || costoMensual <= 0) return null;
  const dias = Math.round((costoMensual / ahorroMensual) * 30);
  if (dias <= 0) return 'menos de un día';
  if (dias === 1) return '1 día';
  if (dias < 45) return `${dias} días`;
  const meses = Math.round(dias / 30);
  return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

// El supuesto se imprime junto al número. Un "$201,600 de ahorro" sin decir de
// dónde sale es lo primero que el cliente pone en duda, y ahí se cae la
// cotización; con el desglose, el número se discute — que es lo que se busca.
export function textoSupuestos(renglones: RenglonRoi[]): string {
  return renglones.map(r => `${r.label.toLowerCase()}: ${r.formula}`).join(' · ');
}
