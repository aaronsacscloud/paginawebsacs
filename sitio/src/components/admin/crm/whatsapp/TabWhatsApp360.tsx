// FICHA 360 · Tab WhatsApp: el espejo de las conversaciones de ESTE cliente.
//
// Solo lectura a propósito: el chat en vivo (responder, media, realtime) es
// del inbox embebido de Kapso — el botón "Responder en el Inbox" abre el tab
// WhatsApp del CRM ya filtrado a este teléfono. Aquí lo que importa es leer
// la historia junto al ARR, los deals y el resto de la ficha.
import { useEffect, useState } from 'react';
import VisorMedia, { MediaEnLinea } from './VisorMedia';
import Cargando from '../ui/Cargando';
import { S, Tag, Aviso, Vacio, fmtFecha } from '../email/ui';
import { telefonoLegible } from '../../../../lib/telefono';

const TONO_STATUS: Record<string, string> = {
  received: 'info', sent: 'gris', delivered: 'info', read: 'ok', failed: 'malo',
};
const NOMBRE_STATUS: Record<string, string> = {
  received: 'recibido', sent: 'enviado', delivered: 'entregado', read: 'leído', failed: 'falló',
};

const ETIQUETA: Record<string, string> = {
  image: 'Imagen', video: 'Video', audio: 'Audio', document: 'Documento', sticker: 'Sticker',
  location: 'Ubicación', contacts: 'Contacto', template: 'Plantilla',
};

export default function TabWhatsApp360({ companyId }: { companyId: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [visor, setVisor] = useState<any>(null);   // media abierta a pantalla completa
  useEffect(() => {
    let vivo = true;
    fetch(`/api/crm/whatsapp/por-cliente?company_id=${companyId}`)
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión — revisa tu internet'); });
    return () => { vivo = false; };
  }, [companyId]);

  if (err) return <Aviso tono="malo">{err}</Aviso>;
  if (!d) return <Cargando texto="Cargando conversaciones de WhatsApp…" alto={160} />;

  const convs: any[] = d.conversaciones || [];
  if (!convs.length) {
    return <Vacio titulo="Sin conversaciones de WhatsApp"
      texto="Cuando este cliente escriba al WhatsApp de SACS —o reciba un mensaje— la conversación aparecerá aquí." />;
  }

  return (
    <div>
      {visor && <VisorMedia m={visor} onCerrar={() => setVisor(null)} />}
      {convs.map(conv => (
        <div key={conv.id} style={{ ...S.card, marginBottom: 12, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '11px 15px', borderBottom: '1px solid #f0eff3', background: '#fdfcff' }}>
            <b style={{ fontSize: '0.82rem' }}>{conv.contacto || telefonoLegible(conv.telefono)}</b>
            {conv.contacto && <span style={{ fontSize: '0.72rem', color: '#8a8a92' }}>{telefonoLegible(conv.telefono)}</span>}
            <Tag tono={conv.estado === 'active' ? 'ok' : 'gris'}>{conv.estado === 'active' ? 'activa' : 'terminada'}</Tag>
            <span style={{ flex: 1 }} />
            <a href={`/admin/crm?tab=whatsapp&wa_conv=${conv.id}`}
              style={{ ...S.btnA, textDecoration: 'none', display: 'inline-block' }}>
              Responder en el Inbox
            </a>
          </div>
          <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 420, overflowY: 'auto' }}>
            {conv.mensajes.map((m: any) => (
              <div key={m.id} style={{
                alignSelf: m.direccion === 'entrante' ? 'flex-start' : 'flex-end',
                maxWidth: '82%', borderRadius: 11, padding: '8px 11px', fontSize: '0.8rem', lineHeight: 1.45,
                background: m.direccion === 'entrante' ? '#f7f6fb' : '#EEECFE',
                borderLeft: m.direccion === 'entrante' ? '3px solid #d9d6e8' : undefined,
                borderRight: m.direccion === 'saliente' ? '3px solid #9B8CFA' : undefined,
              }}>
                {m.media_url && <MediaEnLinea m={m} onAbrir={setVisor} max={200} />}
                {m.transcript ? (
                  <><span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#5B4BD6' }}>NOTA DE VOZ · transcripción</span>
                    <div>{m.transcript}</div></>
                ) : m.cuerpo ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.cuerpo}</div>
                ) : !m.media_url ? (
                  <div style={{ color: '#8a8a92' }}>{ETIQUETA[m.tipo] || 'Mensaje'}</div>
                ) : null}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: '0.6rem', color: '#a5a2af' }}>{fmtFecha(m.enviado_at || m.created_at)}</span>
                  {m.direccion === 'saliente' && (
                    <Tag tono={TONO_STATUS[m.status] || 'gris'}>{NOMBRE_STATUS[m.status] || m.status}</Tag>
                  )}
                </div>
                {m.error && <div style={{ fontSize: '0.68rem', color: '#C0554E', marginTop: 3 }}>{m.error}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
