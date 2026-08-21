// FICHA 360 · Tab Soporte: los tickets de Intercom del cliente. Al dar clic en
// uno se abre el HILO COMPLETO dentro del CRM (mensajes, fotos, adjuntos) — sin
// mandar a Intercom. Patrón de TabOutbound (fetch propio al abrir).
import { useEffect, useState } from 'react';
import Cargando from '../ui/Cargando';
import Sheet from '../ui/Sheet';
import { S, Tag, Aviso, Vacio, fmtFecha } from '../email/ui';

const ESTADO_TONO: Record<string, string> = {
  abierto: 'aviso', en_curso: 'info', pausado: 'gris', resuelto: 'ok', cerrado: 'gris',
};
const ESTADO_LABEL: Record<string, string> = {
  abierto: 'Abierto', en_curso: 'En curso', pausado: 'Pausado', resuelto: 'Resuelto', cerrado: 'Cerrado',
};

// ── Detalle: el hilo completo de una conversación ──────────────────────────
function Hilo({ conversationId, asunto, companyId, onClose }: { conversationId: string; asunto: string | null; companyId: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: string; msg: string } | null>(null);
  const [creando, setCreando] = useState('');
  useEffect(() => {
    let vivo = true;
    fetch(`/api/crm/soporte/conversacion?id=${conversationId}`)
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión'); });
    return () => { vivo = false; };
  }, [conversationId]);

  async function responder() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true); setAviso(null);
    try {
      const r = await fetch(`/api/crm/soporte/conversacion?id=${conversationId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: t }),
      });
      const j = await r.json();
      if (!r.ok || j.error) { setAviso({ tono: 'malo', msg: j.error || 'No se pudo enviar' }); }
      else {
        // Optimista: pinta el mensaje enviado al final del hilo.
        setD((prev: any) => prev ? { ...prev, mensajes: [...(prev.mensajes || []), { autor_tipo: 'admin', autor: 'Tú (soporte)', body: t.replace(/\n/g, '<br>'), adjuntos: [], fecha: new Date().toISOString() }] } : prev);
        setTexto(''); setAviso({ tono: 'ok', msg: 'Respuesta enviada a Intercom.' });
      }
    } catch { setAviso({ tono: 'malo', msg: 'Sin conexión — reintenta.' }); }
    finally { setEnviando(false); }
  }

  async function crear(tipo: 'deal' | 'mejora') {
    if (creando) return;
    setCreando(tipo); setAviso(null);
    const ctx = `Generado desde el ticket de soporte "${asunto || conversationId}" (Intercom).`;
    try {
      const url = tipo === 'deal' ? '/api/crm/deals' : '/api/crm/mejoras';
      const body: any = tipo === 'deal'
        ? { company_id: companyId, nombre: `Oportunidad: ${asunto || 'ticket de soporte'}`, descripcion: ctx, stage: 'calificacion', origen: 'intercom' }
        : { company_id: companyId, titulo: (asunto || 'Petición de soporte').slice(0, 200), descripcion: ctx, estado: 'idea', categoria: 'pendiente' };
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || j.error) { setAviso({ tono: 'malo', msg: j.error || 'No se pudo crear' }); }
      else {
        // Rastro en el timeline ligando el ticket.
        fetch('/api/crm/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, tipo: 'sistema', titulo: tipo === 'deal' ? 'Oportunidad creada desde soporte' : 'Consultoría creada desde soporte', descripcion: asunto || null, automatico: true, metadata: { conversation_id: conversationId, origen: 'soporte' } }) }).catch(() => {});
        setAviso({ tono: 'ok', msg: tipo === 'deal' ? 'Oportunidad creada en el pipeline.' : 'Item de consultoría creado.' });
      }
    } catch { setAviso({ tono: 'malo', msg: 'Sin conexión — reintenta.' }); }
    finally { setCreando(''); }
  }

  return (
    <Sheet open onClose={onClose} title={asunto || 'Conversación de soporte'} width={640}>
      {err && <Aviso tono="malo">{err}</Aviso>}
      {!err && !d && <Cargando texto="Cargando la conversación…" alto={200} />}
      {d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(d.mensajes || []).length === 0 && <div style={{ fontSize: '0.8rem', color: '#9c99a6' }}>Sin mensajes en el hilo.</div>}
          {(d.mensajes || []).map((m: any, i: number) => {
            const esCliente = m.autor_tipo === 'user' || m.autor_tipo === 'lead' || m.autor_tipo === 'contact';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: esCliente ? 'flex-start' : 'flex-end' }}>
                <div style={{ maxWidth: '82%', minWidth: 120 }}>
                  <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#9c99a6', marginBottom: 3, textAlign: esCliente ? 'left' : 'right' }}>
                    {m.autor}{m.nota ? ' · nota interna' : ''}{m.fecha ? ` · ${fmtFecha(m.fecha)}` : ''}
                  </div>
                  <div style={{
                    background: m.nota ? '#FFF6E3' : esCliente ? '#F1F5F9' : '#EEECFE',
                    color: '#0F172A', borderRadius: 12, padding: '10px 13px', fontSize: '0.82rem', lineHeight: 1.55,
                    borderTopLeftRadius: esCliente ? 3 : 12, borderTopRightRadius: esCliente ? 12 : 3,
                    wordBreak: 'break-word',
                  }}>
                    {m.body ? <div className="hilo-body" dangerouslySetInnerHTML={{ __html: m.body }} /> : null}
                    {(m.adjuntos || []).map((a: any, j: number) => (
                      a.es_imagen
                        ? <a key={j} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.nombre} style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8, display: 'block' }} /></a>
                        : <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.75rem', fontWeight: 700, color: '#2C5FC4', textDecoration: 'none', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 10px' }}>📎 {a.nombre}</a>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <style dangerouslySetInnerHTML={{ __html: '.hilo-body img{max-width:100%;border-radius:8px;margin:6px 0;display:block} .hilo-body p{margin:0 0 6px} .hilo-body a{color:#2C5FC4}' }} />

          {/* Acciones: convertir el ticket en trabajo de venta o de producto. */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #f1f0f6' }}>
            <button onClick={() => crear('deal')} disabled={!!creando}
              style={{ border: '1px solid #cfe0f7', background: '#fff', color: '#2C5FC4', borderRadius: 8, padding: '6px 12px', fontSize: '0.76rem', fontWeight: 700, cursor: creando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {creando === 'deal' ? 'Creando…' : '+ Oportunidad'}</button>
            <button onClick={() => crear('mejora')} disabled={!!creando}
              style={{ border: '1px solid #e4dffb', background: '#fff', color: '#5B4BD6', borderRadius: 8, padding: '6px 12px', fontSize: '0.76rem', fontWeight: 700, cursor: creando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {creando === 'mejora' ? 'Creando…' : '+ Consultoría'}</button>
          </div>

          {/* Responder al cliente sin salir del CRM (comentario público a Intercom). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} placeholder="Escribe una respuesta al cliente…"
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') responder(); }}
              style={{ border: '1.5px solid #e4dffb', borderRadius: 10, padding: '10px 12px', fontSize: '0.82rem', fontFamily: 'inherit', background: '#fdfcff', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#b3b1bb' }}>⌘/Ctrl + Enter para enviar</span>
              <button onClick={responder} disabled={enviando || !texto.trim()}
                style={{ border: 'none', borderRadius: 9, padding: '8px 16px', background: (enviando || !texto.trim()) ? '#c9c7d0' : '#5B4BD6', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: (enviando || !texto.trim()) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {enviando ? 'Enviando…' : 'Responder'}</button>
            </div>
          </div>
          {aviso && <Aviso tono={aviso.tono as any}>{aviso.msg}</Aviso>}
        </div>
      )}
    </Sheet>
  );
}

export default function TabSoporte({ companyId }: { companyId: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [abierto, setAbierto] = useState<{ id: string; asunto: string | null } | null>(null);
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
          <div key={t.conversation_id} onClick={() => setAbierto({ id: t.conversation_id, asunto: t.asunto })}
            style={{ padding: '11px 0', borderBottom: '1px solid #f7f6fa', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fafafc')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', flex: 1 }}>{t.asunto || 'Conversación de soporte'}</span>
              <Tag tono={ESTADO_TONO[t.estado] || 'gris'}>{ESTADO_LABEL[t.estado] || t.estado}</Tag>
              <span style={{ color: '#c9c7d0', fontWeight: 800 }}>›</span>
            </div>
            {t.vista_previa && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 3, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.vista_previa}</div>}
            <div style={{ fontSize: '0.68rem', color: '#9c99a6', marginTop: 4, fontWeight: 600 }}>
              {t.abierto_at && <>Abierto {fmtFecha(t.abierto_at)}</>}
              {t.asignado && <> · {t.asignado}</>}
              {t.estado === 'resuelto' && t.resuelto_at && <> · resuelto {fmtFecha(t.resuelto_at)}</>}
            </div>
          </div>
        ))}
      </div>

      {abierto && <Hilo conversationId={abierto.id} asunto={abierto.asunto} companyId={companyId} onClose={() => setAbierto(null)} />}
    </div>
  );
}
