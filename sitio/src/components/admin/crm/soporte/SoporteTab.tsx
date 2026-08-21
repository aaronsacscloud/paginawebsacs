// SOPORTE · Dashboard GLOBAL de soporte (tab del CRM). Vista de pájaro que hoy
// no existía: volumen por estado/tema, SLA (primera respuesta y resolución),
// CSAT, tickets sin ligar, carga por agente y tendencia. Founder-only (middleware).
import { useEffect, useState } from 'react';
import { S, Kpi, Tag, Aviso, Vacio, Cargando } from '../email/ui';
import { TEMA_LABEL } from '../../../../lib/soporte/clasificar';

const SENT_TONO: Record<string, string> = { urgente: 'malo', negativo: 'aviso', neutral: 'gris', positivo: 'ok' };

export default function SoporteTab() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [dias, setDias] = useState(30);
  useEffect(() => {
    let vivo = true; setD(null); setErr('');
    fetch(`/api/crm/soporte/dashboard?dias=${dias}`)
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión — revisa tu internet'); });
    return () => { vivo = false; };
  }, [dias]);

  if (err) return <Aviso tono="malo" titulo="No se pudo cargar el dashboard">{err}</Aviso>;
  if (!d) return <Cargando que="el panel de soporte" />;

  const T = d.totales || {}, sla = d.sla || {};
  if (!T.total) return <Vacio titulo="Sin tickets de soporte todavía" texto="Cuando entren conversaciones de Intercom aparecerán aquí, ligadas a cada cliente." />;

  const maxTema = Math.max(1, ...(d.por_tema || []).map((x: any) => x.n));
  const maxTend = Math.max(1, ...(d.tendencia || []).map((x: any) => Math.max(x.abiertos, x.resueltos)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Kpi etiqueta="Abiertos" valor={T.abiertos} tono={T.abiertos ? 'aviso' : 'ok'} sub={`${T.en_curso} en curso`} />
        <Kpi etiqueta="Estancados" valor={T.estancados} tono={T.estancados ? 'malo' : 'ok'} sub="+48 h sin movimiento" />
        <Kpi etiqueta="Resueltos" valor={T.resueltos} tono="ok" sub={T.reabiertos ? `${T.reabiertos} reabiertos` : undefined} />
        <Kpi etiqueta="1ª respuesta" valor={sla.frt_promedio_horas != null ? `${sla.frt_promedio_horas} h` : '—'} sub="promedio" />
        <Kpi etiqueta="Resolución" valor={sla.resolucion_promedio_horas != null ? `${sla.resolucion_promedio_horas} h` : '—'} sub="promedio" />
        <Kpi etiqueta="CSAT" valor={sla.csat_promedio != null ? `${sla.csat_promedio}/5` : '—'} tono={sla.csat_promedio != null ? (sla.csat_promedio >= 4 ? 'ok' : sla.csat_promedio >= 3 ? 'aviso' : 'malo') : undefined} sub={`${sla.csat_n} respuesta(s)`} />
      </div>

      {/* rango */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: '#888' }}>Tendencia:</span>
        {[14, 30, 90].map(n => (
          <button key={n} onClick={() => setDias(n)} style={{ border: '1px solid #e2e4e9', borderRadius: 8, padding: '4px 11px', fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'inherit', background: dias === n ? '#EEECFE' : '#fff', color: dias === n ? '#5B4BD6' : '#666', fontWeight: dias === n ? 800 : 500 }}>{n} días</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Tendencia abiertos vs resueltos */}
        <div style={S.card}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Entrada vs. resolución</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
            {(d.tendencia || []).map((x: any) => (
              <div key={x.dia} title={`${x.dia}: ${x.abiertos} abiertos, ${x.resueltos} resueltos`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1, height: '100%' }}>
                <div style={{ height: `${(x.abiertos / maxTend) * 50}%`, background: '#E9B949', borderRadius: '2px 2px 0 0', minHeight: x.abiertos ? 2 : 0 }} />
                <div style={{ height: `${(x.resueltos / maxTend) * 50}%`, background: '#4FBF95', borderRadius: '0 0 2px 2px', minHeight: x.resueltos ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.72rem', color: '#888' }}>
            <span><span style={{ color: '#E9B949' }}>■</span> Abiertos</span>
            <span><span style={{ color: '#4FBF95' }}>■</span> Resueltos</span>
          </div>
        </div>

        {/* Top temas */}
        <div style={S.card}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Temas más frecuentes</div>
          {(d.por_tema || []).slice(0, 8).map((x: any) => (
            <div key={x.tema} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 2 }}>
                <span>{x.label}</span><span style={{ fontWeight: 700 }}>{x.n}</span>
              </div>
              <div style={{ height: 6, background: '#f1f0f6', borderRadius: 3 }}><div style={{ width: `${(x.n / maxTema) * 100}%`, height: '100%', background: '#9B8CFA', borderRadius: 3 }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Sentimiento + sin ligar */}
        <div style={S.card}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Sentimiento de tickets</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(d.por_sentimiento || {}).sort((a: any, b: any) => b[1] - a[1]).map(([k, n]: any) => (
              <Tag key={k} tono={SENT_TONO[k] || 'gris'}>{k}: {n}</Tag>
            ))}
          </div>
          {T.sin_ligar > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f0f6' }}>
              <Tag tono="aviso">{T.sin_ligar} sin ligar a cliente</Tag>
              <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 6 }}>Conversaciones cuyo contacto no se pudo mapear a una cuenta SACS. El cron de backfill reintenta cada 30 min.</div>
            </div>
          )}
        </div>

        {/* Carga por agente */}
        <div style={S.card}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Carga por agente</div>
          <div className="crm-scroll-x"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Agente', 'Abiertos', 'Total'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{(d.por_agente || []).map((a: any) => (
              <tr key={a.agente}>
                <td style={{ ...S.td, fontWeight: 600 }}>{a.agente}</td>
                <td style={{ ...S.td, fontWeight: 800, color: a.abiertos ? '#a06600' : '#999' }}>{a.abiertos}</td>
                <td style={S.td}>{a.total}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
