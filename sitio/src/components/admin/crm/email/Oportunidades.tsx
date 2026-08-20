// Oportunidades: el dinero que ya está sobre la mesa.
//
// No es un tablero más. Es la lista de audiencias que corresponden a plata
// concreta —renovaciones, cobranza, expansión, cotizaciones abiertas— con su
// conteo real, para que crear el segmento sea un clic en vez de un rato.
import { useEffect, useState } from 'react';
import { S, Kpi, Aviso, Cargando, Tag, Vacio, money } from './ui';

export default function Oportunidades({ onIrA }: { onIrA?: (s: string) => void }) {
  const [segs, setSegs] = useState<any[] | null>(null);
  const [alcance, setAlcance] = useState<any>(null);
  const [creando, setCreando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: string; texto: string } | null>(null);

  const cargar = () => {
    fetch('/api/crm/email/segmentos-listos').then(r => r.json()).then(j => setSegs(j.segmentos || [])).catch(() => setSegs([]));
    fetch('/api/crm/email/alcance').then(r => r.json()).then(setAlcance).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);

  async function crear(id: string, nombre: string) {
    setCreando(id); setMsg(null);
    try {
      const r = await fetch('/api/crm/email/segmentos-listos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (j.error) { setMsg({ tipo: 'malo', texto: j.error }); return; }
      setMsg({ tipo: 'ok', texto: j.ya_existia ? `"${nombre}" ya existía en Audiencias.` : `"${nombre}" creado con ${j.total} personas. Ya puedes usarlo en una campaña.` });
      cargar();
    } finally { setCreando(null); }
  }

  if (!segs) return <Cargando que="las oportunidades" />;

  return (
    <div style={S.wrap}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Dinero en la mesa</h2>
        <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>
          Audiencias que ya corresponden a dinero. Un clic las crea y quedan listas para una campaña.
        </div>
      </div>

      {msg && <Aviso tono={msg.tipo}>{msg.texto}</Aviso>}

      {alcance && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
          <Kpi etiqueta="Puedes alcanzar" valor={alcance.alcanzables} sub={`${alcance.pct_alcanzable}% de tu base con correo`} tono="ok" />
          <Kpi etiqueta="Suprimidos" valor={alcance.suprimidos} sub="bajas, rebotes y quejas" />
          <Kpi etiqueta="Sin correo" valor={alcance.sin_correo} sub="no hay a dónde escribirles" />
          <Kpi etiqueta="Recuperables" valor={alcance.recuperables} sub="quedaron fuera por límites, no por rechazo" tono="acento" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {/* Las de más gente primero, y las vacías al final: la pantalla debe
            leerse de arriba abajo por lo que vale, no por el orden en que se
            escribió el catálogo. */}
        {[...segs].sort((a, b) => (b.total || 0) - (a.total || 0)).map(s => (
          <div key={s.id} style={{ ...S.card, display: 'flex', flexDirection: 'column', opacity: s.total ? 1 : .6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1, color: s.total ? '#1a1a1a' : '#c9c7d0', fontVariantNumeric: 'tabular-nums' }}>{s.total}</span>
              <span style={{ fontSize: '0.72rem', color: '#a5a2af' }}>{s.total === 1 ? 'persona' : 'personas'}</span>
              {s.ya_existe && <span style={{ marginLeft: 'auto' }}><Tag tono="ok">creado</Tag></span>}
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.87rem', marginTop: 8 }}>{s.nombre}</div>
            <div style={{ fontSize: '0.76rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.55, flex: 1 }}>{s.para_que}</div>
            <div style={{ marginTop: 12 }}>
              {s.ya_existe ? (
                <button style={S.btnG} onClick={() => onIrA?.('audiencias')}>Ver en Audiencias</button>
              ) : (
                <button style={{ ...S.btnP, opacity: (creando === s.id || !s.total) ? .5 : 1 }}
                  disabled={creando === s.id || !s.total}
                  title={!s.total ? 'Hoy no hay nadie en este grupo — se llenará solo cuando lo haya' : undefined}
                  onClick={() => crear(s.id, s.nombre)}>
                  {creando === s.id ? 'Creando…' : 'Crear audiencia'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {alcance?.motivos?.length > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>Por qué hay gente que no recibe</div>
          <div style={{ fontSize: '0.74rem', color: '#8a8a8a', marginTop: 2, marginBottom: 10 }}>
            De los envíos de los últimos {alcance.periodo_dias} días. Los de arriba se pueden recuperar; los de abajo, no.
          </div>
          {alcance.motivos.map((m: any) => (
            <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderTop: '1px solid #f5f4f8', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 800, width: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.personas}</span>
              <span style={{ flex: 1 }}>{m.texto}</span>
              <Tag tono={['presion', 'presion_empresa', 'limite_diario'].includes(m.id) ? 'acento' : 'gris'}>
                {['presion', 'presion_empresa', 'limite_diario'].includes(m.id) ? 'otro día sí' : 'no alcanzable'}
              </Tag>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
