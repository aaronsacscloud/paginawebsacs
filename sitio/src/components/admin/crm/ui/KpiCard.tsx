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

export const KPI_S = {
  card: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '14px 16px' } as const,
  kl: { fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '.08em' } as const,
  kv: { fontSize: '1.375rem', fontWeight: 700, marginTop: 4, letterSpacing: '-.01em', lineHeight: 1.15 } as const,
  ks: { fontSize: '0.6875rem', color: '#888', marginTop: 2, lineHeight: 1.45 } as const,
};

export default function KpiCard({ label, valor, color, sub, onClick, franja, activo, barra }: {
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
}) {
  return (
    <div onClick={onClick}
      style={{
        ...KPI_S.card, marginBottom: 0,
        borderLeft: `3px solid ${franja || '#ddd'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .12s',
        ...(activo ? { boxShadow: '0 0 0 2px #9B8CFA55', borderColor: '#ddd6fb' } : {}),
      }}
      onMouseEnter={e => { if (onClick && !activo) (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 12px rgba(16,24,40,.08)'; }}
      onMouseLeave={e => { if (!activo) (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
      <div style={KPI_S.kl}>{label}</div>
      <div style={{ ...KPI_S.kv, color: color || '#1a1a1a' }}>{valor}</div>
      <div style={KPI_S.ks}>
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
