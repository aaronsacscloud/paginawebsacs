// FICHA 360 · Tab Outbound: toda la actividad del canal para ESTE cliente —
// qué campañas vio, qué clicó botón por botón, su NPS histórico con
// comentarios, las citas nacidas de campañas y las conversiones con su monto.
// Misma gramática visual que el resto de la ficha (paleta M, tonos de email/ui).
import { useEffect, useState } from 'react';
import Cargando from '../ui/Cargando';
import { S, Tag, Aviso, Vacio, fmtFecha } from '../email/ui';

const FMT: Record<string, string> = {
  banner_superior: 'Banner superior', banner_cuadrado: 'Banner cuadrado', modal: 'Modal',
  chat: 'Chat', tarjeta_inicio: 'Tarjeta en inicio', badge_menu: 'Badge en menú',
  encuesta: 'Encuesta', coachmark: 'Coachmark', agenda: 'Agendar cita',
};

const npsTono = (v: number) => (v >= 9 ? 'ok' : v <= 6 ? 'malo' : 'gris');

export default function TabOutbound({ companyId }: { companyId: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let vivo = true;
    fetch(`/api/crm/outbound/por-cliente?company_id=${companyId}`)
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión — revisa tu internet'); });
    return () => { vivo = false; };
  }, [companyId]);

  if (err) return <Aviso tono="malo">{err}</Aviso>;
  if (!d) return <Cargando texto="Cargando actividad de Outbound…" alto={160} />;

  const intereses = Object.entries(d.intereses || {});
  const montoTotal = (d.campanas || []).reduce((a: number, c: any) => a + (c.monto || 0), 0);
  const vacia = !(d.campanas || []).length && !(d.nps || []).length && !(d.citas || []).length;

  if (vacia) {
    return <Vacio titulo="Este cliente aún no ha visto campañas"
      texto={d.cuentas?.length
        ? `Sus cuentas (${d.cuentas.join(', ')}) no registran mensajes del canal Outbound todavía.`
        : 'No tiene cuentas SACS ligadas, así que el canal in-app no puede alcanzarlo.'} />;
  }

  return (
    <div>
      {/* resumen ejecutivo del canal para este cliente */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <Tag tono="acento">{(d.campanas || []).length} campañas lo alcanzaron</Tag>
        {(d.citas || []).length > 0 && <Tag tono="info">{d.citas.length} citas desde campañas</Tag>}
        {(d.conversiones || []).filter((x: any) => x.brazo === 'expuesto').length > 0 &&
          <Tag tono="ok">{d.conversiones.filter((x: any) => x.brazo === 'expuesto').length} conversiones{montoTotal ? ` · $${Math.round(montoTotal).toLocaleString('es-MX')}` : ''}</Tag>}
        {(d.nps || []).length > 0 && <Tag tono={npsTono(Number(d.nps[0].valor))}>Último NPS: {d.nps[0].valor}</Tag>}
      </div>

      {/* campañas con la información clave de cada acción */}
      {(d.campanas || []).length > 0 && (
        <div style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 10 }}>Campañas</div>
          {(d.campanas || []).map((c: any) => (
            <div key={c.campana_id} style={{ padding: '10px 0', borderBottom: '1px solid #f7f6fa' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem', flex: 1 }}>{c.nombre}</span>
                {c.formato && <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 12, background: '#eef2fe', color: '#3764c4' }}>{FMT[c.formato] || c.formato}</span>}
                {c.convertida && <Tag tono="ok">Convirtió{c.monto ? ` · $${Math.round(c.monto).toLocaleString('es-MX')}` : ''}</Tag>}
                {c.descartes > 0 && <Tag tono="malo">La descartó</Tag>}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 4, lineHeight: 1.6 }}>
                Vio el mensaje <b>{c.impresiones}</b> {c.impresiones === 1 ? 'vez' : 'veces'}
                {c.clics.length > 0 && <> · clics: {c.clics.map((x: any, i: number) => <b key={i}>{x.boton || 'botón'}{i < c.clics.length - 1 ? ', ' : ''}</b>)}</>}
                {c.citas > 0 && <> · agendó <b>{c.citas}</b> {c.citas === 1 ? 'cita' : 'citas'}</>}
                {c.encuestas > 0 && <> · respondió la encuesta</>}
                {' '}· último: {fmtFecha(c.ultimo)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* NPS histórico con comentarios */}
        {(d.nps || []).length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 10 }}>NPS histórico</div>
            {(d.nps || []).map((n: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #f7f6fa', fontSize: '0.79rem', alignItems: 'flex-start' }}>
                <Tag tono={n.valor != null ? npsTono(Number(n.valor)) : 'gris'}>{n.valor != null ? n.valor : (n.respuesta || '—')}</Tag>
                <span style={{ flex: 1, color: n.comentario ? '#444' : '#9c99a6' }}>
                  {n.driver && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5B4BD6', background: '#EEECFE', borderRadius: 6, padding: '1px 7px', marginRight: 6 }}>{n.driver}</span>}
                  {n.comentario || (n.driver ? '' : 'Sin comentario')}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#9c99a6', flexShrink: 0 }}>{n.dia}</span>
              </div>
            ))}
          </div>
        )}

        {/* citas nacidas de campañas */}
        {(d.citas || []).length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 10 }}>Citas desde campañas</div>
            {(d.citas || []).map((b: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #f7f6fa', fontSize: '0.79rem', alignItems: 'center' }}>
                <span style={{ flex: 1 }}><b>{b.fecha}</b> {String(b.hora_inicio || '').slice(0, 5)}{b.campana ? <span style={{ color: '#9c99a6' }}> · {b.campana}</span> : null}</span>
                <Tag tono={b.estado === 'confirmada' ? 'info' : b.estado === 'realizada' ? 'ok' : b.estado === 'no_show' ? 'malo' : 'gris'}>{b.estado}</Tag>
              </div>
            ))}
          </div>
        )}

        {/* intereses por módulo (los que alimentan email) */}
        {intereses.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 10 }}>Intereses detectados</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {intereses.map(([mod, v]: any) => (
                <span key={mod} title={`score ${v?.score || 0}`} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 11px', borderRadius: 99, background: '#EEECFE', color: '#5B4BD6' }}>{mod}</span>
              ))}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#9c99a6', fontWeight: 600, marginTop: 8 }}>Disponibles como condición de audiencia («Mostró interés en…») aquí y en Email marketing.</div>
          </div>
        )}
      </div>
    </div>
  );
}
