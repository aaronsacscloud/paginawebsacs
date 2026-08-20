// Bandeja: las respuestas de los clientes, con el contexto del CRM al lado.
//
// Un buzón de Gmail no sabe que quien escribe paga $9,000 de ARR ni en qué
// plan está. Esa es la única razón para contestar desde aquí y no desde Gmail.
import { useEffect, useState } from 'react';
import { S, Tag, Vacio, Cargando, Aviso, chip, fmtFecha } from './ui';

export default function Bandeja() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [filtro, setFiltro] = useState('abiertas');
  const [sel, setSel] = useState<string | null>(null);
  const [hilo, setHilo] = useState<any>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  const cargar = () => fetch(`/api/crm/email/conversaciones?filtro=${filtro}`).then(r => r.json())
    .then(j => setLista(j.conversaciones || [])).catch(() => setLista([]));
  useEffect(() => { setLista(null); cargar(); }, [filtro]);
  useEffect(() => {
    if (!sel) { setHilo(null); return; }
    fetch(`/api/crm/email/conversaciones?id=${sel}`).then(r => r.json()).then(j => {
      setHilo(j);
      if (j.conversacion && !j.conversacion.leida) {
        fetch('/api/crm/email/conversaciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel, leida: true }) }).then(cargar);
      }
    });
  }, [sel]);

  async function responder() {
    if (!texto.trim()) return;
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch('/api/crm/email/conversaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel, texto }),
      });
      const j = await r.json();
      if (j.error) { setMsg({ tipo: 'malo', texto: j.error }); return; }
      setTexto(''); setMsg({ tipo: 'ok', texto: 'Respuesta enviada — llega en el mismo hilo.' });
      const h = await fetch(`/api/crm/email/conversaciones?id=${sel}`).then(x => x.json()); setHilo(h);
    } finally { setEnviando(false); }
  }

  async function darDeBaja() {
    if (!confirm('¿Sacarlo de todos los correos de marketing?')) return;
    await fetch('/api/crm/email/conversaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel, accion: 'dar_de_baja' }) });
    setSel(null); cargar();
  }

  if (!lista) return <Cargando que="la bandeja" />;
  const conv = hilo?.conversacion;
  const c = conv?.contacts;

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Bandeja</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>Quien contesta tus correos, con su ficha al lado</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['abiertas', 'Abiertas'], ['no_leidos', 'Sin leer'], ['sin_asignar', 'Sin asignar'], ['cerradas', 'Cerradas']].map(([id, l]) => (
            <button key={id} style={chip(filtro === id)} onClick={() => { setFiltro(id); setSel(null); }}>{l}</button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <Vacio titulo="No hay respuestas todavía"
          texto="Cuando alguien conteste uno de tus correos, la conversación aparecerá aquí con su historial del CRM. Requiere el subdominio de respuestas configurado." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: 14, alignItems: 'start' }}>
          <div style={{ ...S.card, padding: 8, maxHeight: 560, overflowY: 'auto' }}>
            {lista.map(x => (
              <div key={x.id} onClick={() => setSel(x.id)}
                style={{
                  padding: '10px 11px', borderRadius: 9, cursor: 'pointer', marginBottom: 3,
                  background: sel === x.id ? '#f7f4ff' : 'transparent',
                  border: '1px solid ' + (sel === x.id ? '#e4dffb' : 'transparent'),
                  opacity: x.estado === 'cerrada' ? .6 : 1,
                }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <b style={{ fontSize: '0.79rem', fontWeight: x.leida ? 600 : 800 }}>
                    {x.contacts ? [x.contacts.nombre, x.contacts.apellido].filter(Boolean).join(' ') : x.email}
                  </b>
                  {!x.leida && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#9B8CFA' }} />}
                  <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: '#a5a2af' }}>{fmtFecha(x.ultimo_mensaje_at)}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#8a8a8a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {x.asunto}
                </div>
                {x.contacts?.companies?.nombre && <div style={{ fontSize: '0.66rem', color: '#a5a2af' }}>{x.contacts.companies.nombre}</div>}
              </div>
            ))}
          </div>

          <div style={S.card}>
            {!conv ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#a5a2af', fontSize: '0.85rem' }}>Elige una conversación</div>
            ) : (<>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: '1px solid #f5f4f8', paddingBottom: 11, flexWrap: 'wrap' }}>
                <div>
                  <b style={{ fontSize: '0.87rem' }}>{c ? [c.nombre, c.apellido].filter(Boolean).join(' ') : conv.email}</b>
                  <div style={{ fontSize: '0.72rem', color: '#8a8a8a' }}>
                    {conv.email}{c?.companies?.nombre ? ' · ' + c.companies.nombre : ''}
                    {c?.lifecycle_stage && <> · <Tag tono={c.lifecycle_stage === 'cliente' ? 'ok' : 'gris'}>{c.lifecycle_stage}</Tag></>}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                  <button style={S.btnG} onClick={darDeBaja}>Dar de baja</button>
                  <button style={S.btnG} onClick={async () => {
                    await fetch('/api/crm/email/conversaciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel, estado: conv.estado === 'cerrada' ? 'abierta' : 'cerrada' }) });
                    setSel(null); cargar();
                  }}>{conv.estado === 'cerrada' ? 'Reabrir' : 'Cerrar'}</button>
                </div>
              </div>

              {String(conv.asunto || '').startsWith('[PIDE BAJA]') && (
                <Aviso tono="aviso" titulo="Pidió que dejaran de escribirle"
                  accion={<button style={S.btnG} onClick={darDeBaja}>Darlo de baja</button>}>
                  El texto de su respuesta suena a baja. Atenderlo ahora evita que te marque como spam.
                </Aviso>
              )}

              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 0' }}>
                {(hilo.mensajes || []).map((m: any) => (
                  <div key={m.id} style={{
                    marginBottom: 12, padding: '10px 12px', borderRadius: 10,
                    background: m.direccion === 'entrante' ? '#f7f6fb' : '#f4f8ff',
                    borderLeft: '3px solid ' + (m.direccion === 'entrante' ? '#c9c7d0' : '#7DA6F5'),
                  }}>
                    <div style={{ fontSize: '0.68rem', color: '#8a8a8a', marginBottom: 4 }}>
                      {m.direccion === 'entrante' ? m.de_email : 'Tú'} · {fmtFecha(m.created_at)}
                    </div>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{m.cuerpo_texto}</div>
                    {(m.adjuntos || []).length > 0 && (
                      <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {m.adjuntos.map((a: any, i: number) => <Tag key={i} tono="gris">{a.nombre}</Tag>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {msg && <Aviso tono={msg.tipo}>{msg.texto}</Aviso>}
              <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe tu respuesta…"
                style={{ ...S.inp, minHeight: 92, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 9 }}>
                <button style={{ ...S.btnP, opacity: (!texto.trim() || enviando) ? .5 : 1 }} disabled={!texto.trim() || enviando} onClick={responder}>
                  {enviando ? 'Enviando…' : 'Responder'}
                </button>
                <span style={{ fontSize: '0.72rem', color: '#8a8a8a' }}>Llega en el mismo hilo de su correo y actualiza su “último contacto”.</span>
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
