// Señales de una persona: su puntaje de intención y su historia completa.
//
// Se monta dentro de la ficha del contacto. Antes había que cruzar cinco
// pestañas para armar la misma historia antes de una llamada.
import { useEffect, useState } from 'react';
import { S, Tag, Cargando, fmtFecha } from './ui';

const TEMP: Record<string, { l: string; bg: string; fg: string }> = {
  caliente: { l: 'CALIENTE', bg: '#FEF0EF', fg: '#C0554E' },
  tibio: { l: 'TIBIO', bg: '#FFF6E3', fg: '#9A6B15' },
  'frío': { l: 'FRÍO', bg: '#f4f4f6', fg: '#6B7280' },
};

export default function SenalesContacto({ contactId }: { contactId: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    setD(null);
    fetch(`/api/crm/contacto-senales?id=${contactId}`).then(r => r.json()).then(setD).catch(() => setD({ error: 1 }));
  }, [contactId]);

  if (!d) return <Cargando que="las señales" />;
  if (d.error) return <div style={{ fontSize: '0.8rem', color: '#a5a2af', padding: 16 }}>No se pudieron cargar las señales.</div>;

  const t = TEMP[d.temperatura] || TEMP['frío'];
  const p = d.intencion?.puntaje ?? 0;

  return (
    <div>
      <div style={{ ...S.card, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={S.kl}>Intención de compra</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 4 }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{p}</span>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, background: t.bg, color: t.fg, borderRadius: 20, padding: '3px 10px' }}>{t.l}</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ height: 7, background: '#f0eff3', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(2, p)}%`, borderRadius: 9,
                            background: p >= 60 ? '#C0554E' : p >= 25 ? '#E0A93E' : '#c9c7d0' }} />
            </div>
            <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 6 }}>
              Se mueve solo: sube con visitas, clics y cotizaciones vistas; baja con el silencio.
            </div>
          </div>
        </div>

        {d.intencion?.motivos?.length > 0 && (
          <div style={{ borderTop: '1px solid #f5f4f8', marginTop: 12, paddingTop: 10 }}>
            <div style={{ ...S.kl, marginBottom: 6 }}>Por qué</div>
            {d.intencion.motivos.slice(0, 5).map((m: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: '0.78rem', padding: '3px 0' }}>
                <span style={{ fontWeight: 800, color: '#5B4BD6', width: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>+{m.puntos}</span>
                <span style={{ flex: 1 }}>{m.senal}</span>
                <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{fmtFecha(m.cuando)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...S.card, padding: 0 }}>
        <div style={{ padding: '13px 16px 8px' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>Todo lo que ha hecho</div>
          <div style={{ fontSize: '0.72rem', color: '#8a8a8a', marginTop: 2 }}>
            Correos, visitas, reuniones, pagos y respuestas — en una sola línea
          </div>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: '0 16px 14px' }}>
          {(d.timeline || []).length === 0 && (
            <div style={{ fontSize: '0.8rem', color: '#a5a2af', padding: '10px 0' }}>Todavía no hay actividad registrada.</div>
          )}
          {(d.timeline || []).map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 11, padding: '8px 0', borderTop: i ? '1px solid #f7f6fa' : 'none' }}>
              <span style={{ width: 18, textAlign: 'center', color: e.tipo === 'clic' ? '#5B4BD6' : e.tipo === 'visita' ? '#2C5FC4' : '#c9c7d0', fontWeight: 700, flexShrink: 0 }}>{e.icono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: e.tipo === 'clic' || e.tipo === 'reunion' ? 700 : 500 }}>{e.titulo}</div>
                {e.detalle && <div style={{ fontSize: '0.71rem', color: '#8a8a8a', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.detalle}</div>}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#a5a2af', whiteSpace: 'nowrap' }}>{fmtFecha(e.cuando)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
