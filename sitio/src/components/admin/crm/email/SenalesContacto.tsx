// Señales de una persona: qué tan caliente está y por qué.
//
// Tenía además "Todo lo que ha hecho", una línea de tiempo de correos, visitas
// y clics. Esa se mudó a Seguimiento, mezclada con lo que registra una persona
// —llamadas y notas—: eran DOS historias del mismo lead en dos pestañas, y la
// pregunta de antes de llamar («¿quién movió la última ficha, él o yo?») no la
// contestaba ninguna de las dos por separado.
//
// Aquí queda lo que no cabe allá: el termómetro y su desglose.
import { useEffect, useState } from 'react';
import { S, Cargando, fmtFecha } from './ui';

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

    </div>
  );
}
