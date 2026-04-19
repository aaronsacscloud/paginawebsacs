import React, { useState } from 'react';

interface Props {
  score: number | null | undefined;
  factors?: any;
  computed_at?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const FACTOR_LABELS: Record<string, string> = {
  pagos: 'Pagos al día',
  actividad: 'Actividad reciente (30d)',
  email_engagement: 'Engagement email (90d)',
  respuesta: 'Respuesta canales (60d)',
  nps: 'NPS',
  antiguedad: 'Antigüedad',
};

const FACTOR_MAX: Record<string, number> = {
  pagos: 30,
  actividad: 25,
  email_engagement: 15,
  respuesta: 10,
  nps: 10,
  antiguedad: 10,
};

export default function HealthScoreBadge({ score, factors, computed_at, size = 'md' }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const s = typeof score === 'number' ? score : null;
  const dim = size === 'lg' ? 56 : size === 'sm' ? 32 : 44;
  const fontSize = size === 'lg' ? '1.125rem' : size === 'sm' ? '0.75rem' : '0.9375rem';

  if (s === null) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: dim, height: dim, borderRadius: '50%', background: '#f5f5f5', border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize, fontWeight: 700 }}>—</div>
        <span style={{ fontSize: '0.6875rem', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sin calcular</span>
      </div>
    );
  }

  const color = s >= 70 ? '#2e7d32' : s >= 40 ? '#e65100' : '#c62828';
  const bg = s >= 70 ? '#e8f5e9' : s >= 40 ? '#fff3e0' : '#ffebee';
  const label = s >= 70 ? 'Saludable' : s >= 40 ? 'Atención' : 'En riesgo';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }} onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <div style={{
        width: dim, height: dim, borderRadius: '50%',
        background: bg,
        border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize, fontWeight: 800,
        cursor: 'help',
      }}>
        {s}
      </div>
      <div>
        <div style={{ fontSize: '0.6875rem', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Health</div>
        <div style={{ fontSize: '0.8125rem', color, fontWeight: 700 }}>{label}</div>
      </div>

      {showTooltip && factors && (
        <div style={{
          position: 'absolute', top: dim + 8, left: 0,
          background: '#1a1a1a', color: '#fff',
          borderRadius: 8, padding: 12, minWidth: 260,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 100,
          fontSize: '0.75rem',
        }}>
          <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>Desglose</div>
          {Object.keys(FACTOR_LABELS).map(key => {
            const v = factors[key] || 0;
            const max = FACTOR_MAX[key] || 10;
            const pct = Math.min(100, (v / max) * 100);
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>{FACTOR_LABELS[key]}</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{v}/{max}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#2AB5A0', borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
          {computed_at && (
            <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              Calculado: {new Date(computed_at).toLocaleDateString('es-MX')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
