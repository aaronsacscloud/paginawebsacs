// WHATSAPP · Métricas del inbox: volumen, estados, primera respuesta y carga
// por agente. Sección propia del menú (wa-metricas).
import { useEffect, useState } from 'react';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { S, Aviso, chip } from '../email/ui';

const franjas: Record<string, [string, string]> = {
  nuevas: ['#9B8CFA', '#5B4BD6'], entrantes: ['#7DA6F5', '#2C5FC4'], salientes: ['#7DA6F5', '#2C5FC4'],
  abiertas: ['#E8A838', '#9a6a10'], resueltas: ['#4FBF95', '#1E8A63'], respuesta: ['#9B8CFA', '#5B4BD6'],
};

export default function MetricasWA() {
  const esMovilM = useIsMobile();
  const [dias, setDias] = useState(7);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setD(null);
    fetch(`/api/crm/whatsapp/metricas?dias=${dias}`).then(r => r.json())
      .then(j => j.error ? setErr(j.error) : setD(j))
      .catch(() => setErr('Sin conexión — revisa tu internet'));
  }, [dias]);

  if (err) return <div style={S.wrap}><Aviso tono="malo">{err}</Aviso></div>;
  if (!d) return <Cargando texto="Calculando métricas del inbox…" />;

  const t = d.totales;
  const maxDia = Math.max(1, ...d.por_dia.map((x: any) => x.entrantes + x.salientes));
  const kpi = (etiqueta: string, valor: any, key: string, sub?: string) => (
    <div className="kpi-card" style={{ ...S.card, padding: '13px 15px' }}>
      <div style={S.kl}>{etiqueta}</div>
      <div style={{ ...S.kv, fontSize: '1.45rem', color: '#1a1a1a' }}>{valor}</div>
      {sub && <div style={S.ks}>{sub}</div>}
    </div>
  );

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* El app bar ya dice «Métricas» */}
        {!esMovilM && <h3 style={{ margin: 0, fontSize: '1rem' }}>Métricas de WhatsApp</h3>}
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', gap: 6, whiteSpace: 'nowrap' }}>
          {[7, 30].map(n => (
            <button key={n} className={dias === n ? 'seg-on' : undefined} style={chip(dias === n)} onClick={() => setDias(n)}>{n} días</button>
          ))}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: esMovilM ? 'repeat(2, minmax(0,1fr))' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {kpi('Conversaciones nuevas', t.conversaciones_nuevas, 'nuevas')}
        {kpi('Mensajes recibidos', t.entrantes, 'entrantes')}
        {kpi('Mensajes enviados', t.salientes, 'salientes')}
        {kpi('Primera respuesta', d.primera_respuesta.promedio_min != null ? `${d.primera_respuesta.promedio_min} min` : '—', 'respuesta', `${d.primera_respuesta.con_respuesta} con ida y vuelta`)}
        {kpi('Abiertas hoy', t.abiertas, 'abiertas', `${t.pendientes} pendientes · ${t.sin_leer} sin leer`)}
        {kpi('Resueltas', t.resueltas, 'resueltas')}
      </div>

      {/* Mensajes por día */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.kl}>Mensajes por día (recibidos vs enviados)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: dias > 7 ? 3 : 10, height: 120, marginTop: 12 }}>
          {d.por_dia.map((x: any) => (
            <div key={x.dia} title={`${x.dia}: ${x.entrantes} recibidos, ${x.salientes} enviados`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1, height: '100%' }}>
              <div className="wam-out" style={{ height: `${(x.salientes / maxDia) * 100}%`, background: '#9B8CFA', borderRadius: '3px 3px 0 0', minHeight: x.salientes ? 3 : 0 }} />
              <div className="wam-in" style={{ height: `${(x.entrantes / maxDia) * 100}%`, background: 'rgba(155,140,250,.45)', borderRadius: x.salientes ? 0 : '3px 3px 0 0', minHeight: x.entrantes ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: dias > 7 ? 3 : 10, marginTop: 4 }}>
          {d.por_dia.map((x: any, i: number) => {
            const dd = String(x.dia || '').slice(8, 10);
            const ver = dias <= 7 || i % 5 === 0 || i === d.por_dia.length - 1;
            return <div key={'x' + x.dia} style={{ flex: 1, textAlign: 'center', fontSize: '0.6rem', color: '#a5a2af', fontVariantNumeric: 'tabular-nums' }}>{ver ? dd : ''}</div>;
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 9, fontSize: '0.68rem', color: '#8a8a92' }}>
          <span><span className="wam-in" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'rgba(155,140,250,.45)', marginRight: 5 }} />Recibidos</span>
          <span><span className="wam-out" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: '#9B8CFA', marginRight: 5 }} />Enviados</span>
        </div>
      </div>

      {/* Motivos de cierre */}
      <div style={S.card}>
        <div style={S.kl}>Motivos de cierre</div>
        {!(d.por_cierre || []).length && <div style={{ marginTop: 8, fontSize: '0.76rem', color: '#a5a2af' }}>Aún no hay conversaciones resueltas con categoría.</div>}
        {(d.por_cierre || []).map((c: any) => {
          const total = (d.por_cierre || []).reduce((a: number, x: any) => a + x.n, 0) || 1;
          const maxCierre = Math.max(...(d.por_cierre || []).map((x: any) => x.n), 1);
          return (
            <div key={c.categoria} style={{ marginTop: 10, fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontWeight: 600, minWidth: 0 }}>{c.categoria}</span>
                <b style={{ color: '#1a1a1a', flexShrink: 0 }}>{c.n}</b>
              </div>
              {/* Riel hairline y relleno en acento: en blanco y al 100% las
                  barras se leían como reglas divisorias, no como dato. */}
              <div className="wam-riel" style={{ height: 6, borderRadius: 99, background: '#eeeef1', overflow: 'hidden', marginTop: 5 }}>
                <div className="wam-out" style={{ width: `${Math.max(3, (c.n / Math.max(1, maxCierre)) * 100)}%`, height: '100%', background: '#9B8CFA' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Por agente */}
      <div style={S.card}>
        <div style={S.kl}>Carga por agente</div>
        {!d.por_agente.length && <div style={{ marginTop: 8, fontSize: '0.76rem', color: '#a5a2af' }}>Nadie tiene conversaciones asignadas todavía.</div>}
        {esMovilM ? (
          /* Cuatro columnas encogidas partían «Aaron / Herzberg» y «1 /
             asignadas»: un renglón por agente, con su barra al pie. */
          <div style={{ marginTop: 8 }}>
            {d.por_agente.map((a: any) => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #eeeef1' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</span>
                  <span style={{ fontSize: '0.78rem', color: '#8f8d98', flexShrink: 0 }}>
                    {a.asignadas} asignadas · <b style={{ color: a.resueltas > 0 ? '#1E8A63' : '#8f8d98' }}>{a.resueltas} resueltas</b>
                  </span>
                </div>
                <div className="wam-riel" style={{ height: 6, borderRadius: 99, background: '#eeeef1', overflow: 'hidden', marginTop: 7 }}>
                  <div style={{ width: `${a.asignadas ? (a.resueltas / a.asignadas) * 100 : 0}%`, height: '100%', background: '#4FBF95' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <tbody>
            {d.por_agente.map((a: any) => (
              <tr key={a.id}>
                <td style={{ ...S.td, fontWeight: 700 }}>{a.nombre}</td>
                <td style={S.td}>{a.asignadas} asignadas</td>
                <td style={{ ...S.td, color: a.resueltas > 0 ? '#1E8A63' : '#8f8d98', fontWeight: 700 }}>{a.resueltas} resueltas</td>
                <td style={{ ...S.td, width: '40%' }}>
                  <div style={{ height: 6, borderRadius: 99, background: '#eeeef1', overflow: 'hidden' }}>
                    <div style={{ width: `${a.asignadas ? (a.resueltas / a.asignadas) * 100 : 0}%`, height: '100%', background: '#4FBF95' }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
