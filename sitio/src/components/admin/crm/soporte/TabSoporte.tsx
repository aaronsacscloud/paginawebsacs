// FICHA 360 · Tab Soporte: los tickets de Intercom del cliente, centralizados.
// Patrón de TabOutbound (fetch propio al abrir). Misma gramática visual del CRM.
import { useEffect, useState } from 'react';
import Cargando from '../ui/Cargando';
import { S, Tag, Aviso, Vacio, fmtFecha } from '../email/ui';

const ESTADO_TONO: Record<string, string> = {
  abierto: 'aviso', en_curso: 'info', pausado: 'gris', resuelto: 'ok', cerrado: 'gris',
};
const ESTADO_LABEL: Record<string, string> = {
  abierto: 'Abierto', en_curso: 'En curso', pausado: 'Pausado', resuelto: 'Resuelto', cerrado: 'Cerrado',
};

export default function TabSoporte({ companyId }: { companyId: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let vivo = true;
    fetch(`/api/crm/soporte/por-cliente?company_id=${companyId}`)
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión — revisa tu internet'); });
    return () => { vivo = false; };
  }, [companyId]);

  if (err) return <Aviso tono="malo">{err}</Aviso>;
  if (!d) return <Cargando texto="Cargando tickets de soporte…" alto={160} />;

  const tickets = d.tickets || [];
  if (!tickets.length) {
    return <Vacio titulo="Sin tickets de soporte"
      texto="Este cliente no ha abierto conversaciones de soporte, o todavía no se han sincronizado desde Intercom." />;
  }

  const r = d.resumen || {};
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {r.abiertos > 0 ? <Tag tono="aviso">{r.abiertos} abiertos</Tag> : <Tag tono="ok">Sin tickets abiertos</Tag>}
        <Tag tono="gris">{r.total} en total</Tag>
        {r.resueltos > 0 && <Tag tono="ok">{r.resueltos} resueltos</Tag>}
        {r.promedio_horas != null && <Tag tono="info">Resolución promedio: {r.promedio_horas} h</Tag>}
      </div>

      <div style={S.card}>
        {tickets.map((t: any) => (
          <div key={t.conversation_id} style={{ padding: '10px 0', borderBottom: '1px solid #f7f6fa' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', flex: 1 }}>{t.asunto || 'Conversación de soporte'}</span>
              <Tag tono={ESTADO_TONO[t.estado] || 'gris'}>{ESTADO_LABEL[t.estado] || t.estado}</Tag>
              {t.intercom_url && <a href={t.intercom_url} target="_blank" rel="noreferrer" style={{ ...S.btnG, textDecoration: 'none', padding: '3px 10px', fontSize: '0.7rem' }}>Ver en Intercom</a>}
            </div>
            {t.vista_previa && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 3, lineHeight: 1.5 }}>{t.vista_previa}</div>}
            <div style={{ fontSize: '0.68rem', color: '#9c99a6', marginTop: 4, fontWeight: 600 }}>
              {t.abierto_at && <>Abierto {fmtFecha(t.abierto_at)}</>}
              {t.asignado && <> · {t.asignado}</>}
              {t.estado === 'resuelto' && t.resuelto_at && <> · resuelto {fmtFecha(t.resuelto_at)}</>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
