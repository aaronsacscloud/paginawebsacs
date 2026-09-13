/**
 * La tarjeta de indicador del CRM.
 *
 * Vivía duplicada: Cotizaciones y Cobranza tenían la suya —barra de color a la
 * izquierda, rótulo en versalitas, número grande y una línea que explica— y
 * Pagos usaba una caja lisa distinta. Tres pantallas del mismo módulo con tres
 * anchos de aire y tres tamaños de número se leen como tres productos.
 *
 * Un solo componente para todas. Si tiene `onClick`, la tarjeta es un filtro y
 * lo dice con el "ver" al final: un número que no se puede abrir es un reporte.
 */
import type { ReactNode } from 'react';
import { CHISPA } from './Chispas';

export const KPI_S = {
  card: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '14px 16px' } as const,
  kl: { fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '.08em' } as const,
  kv: { fontSize: '1.375rem', fontWeight: 700, marginTop: 4, letterSpacing: '-.01em', lineHeight: 1.15 } as const,
  ks: { fontSize: '0.6875rem', color: '#888', marginTop: 2, lineHeight: 1.45 } as const,
};

export default function KpiCard({ label, valor, color, sub, onClick, franja, activo, barra, faro }: {
  label: string;
  valor: ReactNode;
  color?: string;
  sub?: ReactNode;
  onClick?: () => void;
  franja?: string;
  /** La tarjeta está aplicada como filtro: se marca para saber qué se está viendo. */
  activo?: boolean;
  /** Reparto del total en tramos de color, como una barra fina al pie. Nació en
   *  Reuniones —cuántas se presentaron, cuántas faltaron, cuántas nadie marcó—.
   *  Vive AQUÍ y no allá: una tarjeta con barra propia en un solo módulo es
   *  justo la duplicación que este componente existe para evitar. */
  barra?: { pct: number; color: string }[];
  /** LA TARJETA FARO. Nació en Clientes y el dueño la volvió branding: una por
   *  pantalla se pinta con el degradado lila→rosa de la marca y le cruza una
   *  chispa grande cortada por la esquina, en vez de llevar franja a la
   *  izquierda. No es decoración repartida: es JERARQUÍA. Una fila de cuatro
   *  tarjetas iguales no tiene dueño y el ojo empieza por la de la izquierda,
   *  no por la que importa. Solo UNA por pantalla — dos faros no alumbran el
   *  doble, se anulan. */
  faro?: boolean;
}) {
  return (
    <div onClick={onClick} className="kpi-card"
      style={{
        ...KPI_S.card, marginBottom: 0,
        ...(faro
          ? { background: 'linear-gradient(135deg,#EEECFE,rgba(244,168,205,.16))', border: '1px solid #ddd6fb',
              position: 'relative' as const, overflow: 'hidden' as const }
          : { borderLeft: `3px solid ${franja || '#ddd'}` }),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .12s',
        ...(activo ? { boxShadow: '0 0 0 2px #9B8CFA55', borderColor: '#ddd6fb' } : {}),
      }}
      onMouseEnter={e => { if (onClick && !activo) (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 12px rgba(16,24,40,.08)'; }}
      onMouseLeave={e => { if (!activo) (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
      {/* La chispa al vuelo, cortada por la esquina. Es decoración de la marca,
          no un icono: no significa nada y por eso no lleva título ni color
          propio — va en el rosa de la casa a media opacidad. */}
      {faro && (
        <svg width="52" height="52" viewBox="0 0 24 24" aria-hidden="true"
          style={{ position: 'absolute', right: -6, top: -8, opacity: .5, pointerEvents: 'none' }}>
          <path d={CHISPA} fill="rgba(217,83,142,.18)" />
        </svg>
      )}
      <div style={{ ...KPI_S.kl, position: 'relative', color: faro ? '#8a6a9c' : KPI_S.kl.color }}>{label}</div>
      <div style={{ ...KPI_S.kv, position: 'relative', fontSize: faro ? '1.5rem' : KPI_S.kv.fontSize, fontWeight: 800, color: color || '#1a1a1a' }}>{valor}</div>
      <div style={{ ...KPI_S.ks, position: 'relative', color: faro ? '#6b6878' : KPI_S.ks.color }}>
        {sub}
        {onClick ? <span style={{ color: '#9B8CFA', fontWeight: 700 }}>{sub ? ' · ' : ''}{activo ? 'quitar' : 'ver'}</span> : null}
      </div>
      {barra && barra.length > 0 && (
        <div style={{ display: 'flex', height: 3, borderRadius: 99, overflow: 'hidden', marginTop: 9, background: '#f0eff4' }}>
          {barra.map((t, i) => <span key={i} style={{ width: `${t.pct}%`, background: t.color }} />)}
        </div>
      )}
    </div>
  );
}
