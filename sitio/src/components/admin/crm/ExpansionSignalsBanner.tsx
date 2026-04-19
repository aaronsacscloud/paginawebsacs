import React, { useEffect, useState } from 'react';

interface Signal {
  id: string;
  signal_type: string;
  opportunity_value: number;
  metadata: any;
  detected_at: string;
}

interface Props {
  companyId: string;
}

const SIGNAL_LABELS: Record<string, { title: string; cta: string; icon: string; color: string }> = {
  mensual_largo: {
    title: 'Candidato para plan anual',
    cta: 'Ofrecer anual con 2 meses gratis',
    icon: '📅',
    color: '#2AB5A0',
  },
  plan_bajo_uso_alto: {
    title: 'Cliente listo para upgrade',
    cta: 'Proponer upgrade a Automatiza',
    icon: '⬆',
    color: '#4B7BE5',
  },
  sucursales_delta: {
    title: 'Creció en sucursales',
    cta: 'Actualizar plan a nuevo conteo',
    icon: '🏪',
    color: '#6C5CE7',
  },
  nps_promoter: {
    title: 'Promotor NPS — lista para referral',
    cta: 'Pedir caso de éxito / referral',
    icon: '⭐',
    color: '#E8A838',
  },
  high_engagement: {
    title: 'Alto engagement',
    cta: 'Agendar QBR (quarterly review)',
    icon: '🔥',
    color: '#E54B4B',
  },
};

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

export default function ExpansionSignalsBanner({ companyId }: Props) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    fetch(`/api/crm/expansion-signals?company_id=${companyId}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSignals(Array.isArray(d) ? d : []))
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, [companyId]);

  const dismiss = async (id: string) => {
    setDismissing(id);
    try {
      await fetch(`/api/crm/expansion-signals?id=${id}`, { method: 'DELETE' });
      setSignals(signals.filter(s => s.id !== id));
    } finally {
      setDismissing(null);
    }
  };

  if (loading || signals.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      {signals.map(s => {
        const meta = SIGNAL_LABELS[s.signal_type] || { title: s.signal_type, cta: 'Revisar', icon: '✦', color: '#666' };
        return (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 18px',
            background: '#fff',
            border: `1px solid ${meta.color}40`,
            borderLeft: `3px solid ${meta.color}`,
            borderRadius: 6,
          }}>
            <div style={{ fontSize: '1.25rem' }}>{meta.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{meta.title}</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                {meta.cta}
                {s.opportunity_value > 0 && (
                  <span style={{ color: meta.color, fontWeight: 700 }}> · Valor potencial: {fmt(s.opportunity_value)}</span>
                )}
              </div>
            </div>
            <button onClick={() => dismiss(s.id)} disabled={dismissing === s.id} style={{
              background: 'transparent', border: 'none', color: '#999',
              cursor: 'pointer', padding: 4, fontSize: '1rem',
            }} title="Descartar">✕</button>
          </div>
        );
      })}
    </div>
  );
}
