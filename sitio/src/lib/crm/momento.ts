// ═══ Señales de MOMENTO: qué EMPEZÓ a pasar, no qué está pasando ═══
//
// El resto de las señales son fotos ("tiene 200 clientes"). Una foto no dice
// cuándo llamar, y una que lleva seis meses igual se vuelve paisaje y deja de
// leerse. La derivada sí: un cliente que EMPIEZA a hacer algo está resolviendo
// un problema esta semana, y ese es el día en que compra.
//
// La materia prima ya existe: uso_snapshots guarda una foto diaria por cuenta
// (140 empresas). Aquí se compara la de hoy contra la más vieja dentro de la
// ventana y se traduce el delta a una acción comercial.
//
// PURO: sin acceso a BD, para poder correr igual en servidor y navegador.
import type { Senal } from './senales';

export type Snap = {
  fecha: string;
  health_score?: number | null;
  ventas_30d?: number | null; total_30d?: number | null;
  usuarios_operando?: number | null; clientes_total?: number | null;
  lealtad_inscritos?: number | null; conteos_7d?: number | null;
  transferencias_7d?: number | null; facturas_7d?: number | null;
};

const n = (v: any) => Number(v ?? 0);
const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Módulos cuya "primera vez" es una señal de venta clara. */
const ARRANQUES: { campo: keyof Snap; que: string; accion: string }[] = [
  { campo: 'facturas_7d',        que: 'empezó a facturar electrónicamente',
    accion: 'Acompáñalo ahora: la configuración fiscal es donde se atoran, y facturando desde SACS ya no se va.' },
  { campo: 'conteos_7d',         que: 'empezó a hacer conteos físicos',
    accion: 'Momento exacto para Nivelación de inventario: está sufriendo el descuadre justo ahora.' },
  { campo: 'transferencias_7d',  que: 'empezó a mover mercancía entre sucursales',
    accion: 'Ofrécele Controla (traspasos y reabasto) o Nivelación si ya lo tiene.' },
  { campo: 'lealtad_inscritos',  que: 'empezó a inscribir clientes a lealtad',
    accion: 'El programa acaba de prender: es el momento de Fideliza completo.' },
];

/**
 * Compara la foto de hoy contra una anterior y devuelve lo que CAMBIÓ.
 * `antes` debe ser la más vieja dentro de la ventana (7-30 días atrás); si no
 * hay historia suficiente no se inventa nada: devuelve vacío.
 */
export function senalesDeMomento(hoy?: Snap | null, antes?: Snap | null): Senal[] {
  if (!hoy || !antes) return [];
  const d = dias(antes.fecha, hoy.fecha);
  if (d < 5) return [];            // muy poco tiempo: sería ruido diario
  const out: Senal[] = [];

  // ── Arrancó a usar algo ──
  for (const a of ARRANQUES) {
    const ant = n(antes[a.campo]), act = n(hoy[a.campo]);
    if (ant === 0 && act > 0) {
      out.push({ tipo: 'arranque_' + String(a.campo), nivel: 'oportunidad', peso: 85,
        titulo: `Esta semana ${a.que} (${act} en los últimos días)`,
        detalle: `Hace ${d} días no lo tocaba. Está resolviendo ese problema AHORA — es cuando compra.`,
        accion: a.accion });
    }
    // ── Y lo contrario: lo dejó de usar ──
    if (ant > 0 && act === 0) {
      out.push({ tipo: 'abandono_' + String(a.campo), nivel: 'riesgo', peso: 72,
        titulo: `Dejó de usar ${a.que.replace(/^empezó a /, '')}`,
        detalle: `Hace ${d} días lo usaba y hoy está en cero. Algo se rompió o se fue a otro lado.`,
        accion: 'Llámale antes de que el abandono se vuelva cancelación.' });
    }
  }

  // ── Base de clientes creciendo: el insumo de lealtad ──
  const cAnt = n(antes.clientes_total), cAct = n(hoy.clientes_total);
  if (cAnt >= 20 && cAct > cAnt * 1.15) {
    const pct = Math.round(((cAct - cAnt) / cAnt) * 100);
    out.push({ tipo: 'base_clientes_crece', nivel: 'oportunidad', peso: 68,
      titulo: `Su base de clientes creció ${pct}% en ${d} días (${cAnt.toLocaleString()} → ${cAct.toLocaleString()})`,
      detalle: 'Está capturando clientes activamente: es exactamente el insumo que hace rentable el programa de lealtad.',
      accion: 'Ofrécele Fideliza mientras la base está fresca.' });
  }

  // ── El equipo creció: más gente = más necesidad de permisos y control ──
  const uAnt = n(antes.usuarios_operando), uAct = n(hoy.usuarios_operando);
  if (uAnt > 0 && uAct >= uAnt + 3) {
    out.push({ tipo: 'equipo_crece', nivel: 'oportunidad', peso: 62,
      titulo: `Su equipo pasó de ${uAnt} a ${uAct} personas operando en ${d} días`,
      detalle: 'Está contratando: más manos en el sistema es cuando duelen los permisos, las metas y la auditoría.',
      accion: 'Propón el plan con permisos por usuario y comisiones por vendedor.' });
  }

  // ── DEFENSA: la salud cayendo ──
  // El ARR que ya se tiene vale más que el que se puede agregar: perder tres
  // clientes medianos borra todo el upsell detectado. Un cliente que va de 89 a
  // 60 en un mes se está yendo aunque hoy siga pagando, y es la señal más
  // temprana que existe — mucho antes de que deje de pagar o de vender.
  const hAnt = n(antes.health_score), hAct = n(hoy.health_score);
  if (hAnt >= 50 && hAct <= hAnt - 15) {
    out.push({ tipo: 'salud_cayendo', nivel: 'riesgo', peso: 92,
      titulo: `Su salud cayó de ${hAnt} a ${hAct} en ${d} días`,
      detalle: 'Sigue pagando, pero está usando el sistema cada vez menos. Es el aviso más temprano de una cancelación.',
      accion: 'Llámale ahora: a esta altura todavía se recupera; cuando deje de pagar, ya no.' });
  }

  // ── Salto de volumen: creció el negocio, no solo el mes ──
  const vAnt = n(antes.ventas_30d), vAct = n(hoy.ventas_30d);
  if (vAnt >= 100 && vAct > vAnt * 1.3) {
    const pct = Math.round(((vAct - vAnt) / vAnt) * 100);
    out.push({ tipo: 'volumen_salta', nivel: 'oportunidad', peso: 66,
      titulo: `Sus ventas mensuales saltaron ${pct}% en ${d} días`,
      detalle: 'No es estacionalidad de un día: el nivel de operación subió de escalón.',
      accion: 'Revisa si su plan y sus sucursales siguen correspondiendo a lo que mueve.' });
  }

  return out;
}
