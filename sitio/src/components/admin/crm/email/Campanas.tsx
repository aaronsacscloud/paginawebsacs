// Campañas: lista y el armado por pasos.
//
// Los pasos son CHIPS clicables en cualquier orden, no un túnel: en la vida
// real primero se escribe el correo y al final se decide a quién. Revisión se
// desbloquea sola cuando lo demás está en verde.
//
// "Enviar" no manda en el acto: programa para dentro de 5 minutos y deja un
// banner para cancelar. Esa ventana es el único deshacer que existe cuando
// alguien le da a enviar a 200 personas por error.
import { useEffect, useState } from 'react';
import { S, Tag, Aviso, Vacio, Cargando, chip, fmtFecha, MOTIVO, PedirTexto, Modal } from './ui';

const ESTADO_TONO: Record<string, string> = {
  borrador: 'gris', programada: 'info', enviando: 'acento',
  pausada: 'aviso', completada: 'ok', cancelada: 'malo',
};

export default function Campanas({ onIrA }: { onIrA?: (s: string) => void }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pidiendoNombre, setPidiendoNombre] = useState(false);

  const cargar = () => fetch('/api/crm/email/campaigns').then(r => r.json()).then(j => setLista(j.campanas || [])).catch(() => setLista([]));
  useEffect(() => { cargar(); }, []);

  async function nueva(nombre: string) {
    setPidiendoNombre(false);
    const r = await fetch('/api/crm/email/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }),
    });
    const j = await r.json();
    if (j.campana) { await cargar(); setAbierta(j.campana.id); }
  }

  if (abierta) return <Detalle id={abierta} onCerrar={() => { setAbierta(null); cargar(); }} onIrA={onIrA} />;
  if (!lista) return <Cargando que="las campañas" />;

  return (
    <div style={S.wrap}>
      {pidiendoNombre && (
        <PedirTexto titulo="Nueva campaña" sub="Este nombre es solo para ti — no lo ve nadie que reciba el correo."
          etiqueta="Nombre de la campaña" marcador="Ej. Lanzamiento de Mín/Máx automáticos"
          boton="Crear" onOk={nueva} onCancelar={() => setPidiendoNombre(false)} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Campañas</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>Un correo, una audiencia, una vez</div>
        </div>
        <button style={{ ...S.btnP, marginLeft: 'auto' }} onClick={() => setPidiendoNombre(true)}>+ Nueva campaña</button>
      </div>

      {lista.length === 0 ? (
        <Vacio titulo="Todavía no has creado ninguna campaña"
          texto="Una campaña es un correo que sale una vez a un grupo de personas. Para secuencias automáticas, usa Embudos."
          accion={<button style={S.btnP} onClick={() => setPidiendoNombre(true)}>Crear la primera</button>} />
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Campaña</th><th style={S.th}>Estado</th><th style={S.th}>Enviados</th>
                <th style={S.th}>Clics</th><th style={S.th}>Cuándo</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {lista.map(c => {
                  const r = c.resumen || {};
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setAbierta(c.id)}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                        <div style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{c.asunto || 'sin asunto'}</div>
                      </td>
                      <td style={S.td}><Tag tono={ESTADO_TONO[c.estado]}>{c.estado}</Tag></td>
                      <td style={S.td}>{r.enviados ?? '—'}{r.rechazados ? <span style={{ color: '#a5a2af', fontSize: '0.7rem' }}> · {r.rechazados} fuera</span> : ''}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: r.clics ? '#5B4BD6' : '#c9c7d0' }}>{r.clics ?? 0}</td>
                      <td style={{ ...S.td, fontSize: '0.72rem', color: '#8a8a8a' }}>
                        {c.estado === 'programada' ? fmtFecha(c.programada_para) : fmtFecha(c.completada_at || c.created_at)}
                      </td>
                      <td style={S.td}><button style={{ ...S.btnG, padding: '4px 10px', fontSize: '0.7rem' }}>Abrir</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Detalle({ id, onCerrar, onIrA }: { id: string; onCerrar: () => void; onIrA?: (s: string) => void }) {
  const [c, setC] = useState<any>(null);
  const [dest, setDest] = useState<any[]>([]);
  const [paso, setPaso] = useState<'audiencia' | 'contenido' | 'revision'>('contenido');
  const [rev, setRev] = useState<any>(null);
  const [audiencias, setAudiencias] = useState<any>({ segmentos: [], listas: [] });
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ tipo: string; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pidiendoPrueba, setPidiendoPrueba] = useState(false);

  const cargar = () => fetch(`/api/crm/email/campaigns?id=${id}`).then(r => r.json()).then(j => { setC(j.campana); setDest(j.destinatarios || []); });
  useEffect(() => { cargar(); }, [id]);
  useEffect(() => {
    fetch('/api/crm/email/segments').then(r => r.json()).then(j => setAudiencias((a: any) => ({ ...a, segmentos: j.segmentos || [] })));
    fetch('/api/crm/email/lists').then(r => r.json()).then(j => setAudiencias((a: any) => ({ ...a, listas: j.listas || [] })));
    fetch('/api/crm/email/templates').then(r => r.json()).then(j => setPlantillas(j.plantillas || []));
  }, []);

  const editable = c && ['borrador', 'programada', 'pausada'].includes(c.estado);

  async function guardar(campos: any) {
    const r = await fetch('/api/crm/email/campaigns', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...campos }),
    });
    const j = await r.json();
    if (j.error) { setMsg({ tipo: 'malo', texto: j.error }); return; }
    setC(j.campana); setRev(null);
  }

  async function accion(a: string, extra: any = {}) {
    setOcupado(true); setMsg(null);
    try {
      const r = await fetch(`/api/crm/email/campaigns?accion=${a}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...extra }),
      });
      const j = await r.json();
      if (a === 'revisar') { setRev(j); return j; }
      if (j.error) { setMsg({ tipo: 'malo', texto: j.error }); return j; }
      if (a === 'prueba') { setMsg({ tipo: j.enviado ? 'ok' : 'malo', texto: j.enviado ? 'Prueba enviada. Revisa tu bandeja.' : ('No salió: ' + (MOTIVO[j.motivo] || j.detalle || j.motivo)) }); return j; }
      await cargar();
      if (a === 'enviar') setMsg({ tipo: 'ok', texto: `Sale a las ${new Date(j.sale_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}. Tienes ${j.gracia_min} minutos para cancelar.` });
      return j;
    } finally { setOcupado(false); }
  }

  useEffect(() => { if (paso === 'revision' && c && !rev) accion('revisar'); }, [paso, c]);

  if (!c) return <Cargando que="la campaña" />;
  const r = c.resumen || {};
  const listoAudiencia = !!c.origen_tipo && !!(c.origen_id || c.contact_ids?.length);
  const listoContenido = !!c.asunto?.trim() && !!c.template_id;

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button style={S.btnG} onClick={onCerrar}>← Campañas</button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{c.nombre}</h2>
          <div style={{ fontSize: '0.72rem', color: '#8a8a8a' }}>
            <Tag tono={ESTADO_TONO[c.estado]}>{c.estado}</Tag>{' '}
            {c.estado === 'programada' && <>sale {fmtFecha(c.programada_para)}</>}
          </div>
        </div>
        {editable && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['audiencia', 'contenido', 'revision'] as const).map(p => {
              const ok = p === 'audiencia' ? listoAudiencia : p === 'contenido' ? listoContenido : (rev?.listo ?? false);
              return <button key={p} style={chip(paso === p)} onClick={() => setPaso(p)}>
                {ok ? '✓ ' : ''}{p === 'audiencia' ? 'Audiencia' : p === 'contenido' ? 'Contenido' : 'Revisión'}
              </button>;
            })}
          </div>
        )}
      </div>

      {msg && <Aviso tono={msg.tipo}>{msg.texto}</Aviso>}
      {c.pausa_motivo && <Aviso tono="malo" titulo="Campaña pausada">{c.pausa_motivo}</Aviso>}

      {c.estado === 'programada' && (
        <Aviso tono="info" titulo={`Programada para ${fmtFecha(c.programada_para)}`}
          accion={<button style={S.btnG} onClick={() => accion('cancelar')} disabled={ocupado}>Cancelar envío</button>}>
          Todavía no ha salido. Puedes cancelarla o seguir editándola.
        </Aviso>
      )}

      {!editable ? (
        <Resultados c={c} r={r} dest={dest} onAccion={accion} ocupado={ocupado} />
      ) : (<>
        {paso === 'audiencia' && (
          <div style={S.card}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 4 }}>¿A quién le llega?</div>
            <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginBottom: 14 }}>
              Un segmento se recalcula al momento de enviar; una lista es fija.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
              <div>
                <span style={S.lbl}>Segmentos</span>
                {audiencias.segmentos.length === 0 && <div style={{ fontSize: '0.75rem', color: '#a5a2af' }}>Ninguno todavía · <a href="#" onClick={e => { e.preventDefault(); onIrA?.('audiencias'); }}>crear uno</a></div>}
                {audiencias.segmentos.map((s: any) => (
                  <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', cursor: 'pointer', fontSize: '0.81rem' }}>
                    <input type="radio" name="aud" checked={c.origen_tipo === 'segmento' && c.origen_id === s.id}
                      onChange={() => guardar({ origen_tipo: 'segmento', origen_id: s.id })} />
                    {s.nombre} {s.ultimo_conteo != null && <span style={{ color: '#a5a2af', fontSize: '0.72rem' }}>~{s.ultimo_conteo}</span>}
                  </label>
                ))}
              </div>
              <div>
                <span style={S.lbl}>Listas</span>
                {audiencias.listas.length === 0 && <div style={{ fontSize: '0.75rem', color: '#a5a2af' }}>Ninguna todavía</div>}
                {audiencias.listas.map((l: any) => (
                  <label key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', cursor: 'pointer', fontSize: '0.81rem' }}>
                    <input type="radio" name="aud" checked={c.origen_tipo === 'lista' && c.origen_id === l.id}
                      onChange={() => guardar({ origen_tipo: 'lista', origen_id: l.id })} />
                    {l.nombre} <span style={{ color: '#a5a2af', fontSize: '0.72rem' }}>{l.total}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {paso === 'contenido' && (
          <div style={S.card}>
            <div style={{ marginBottom: 13 }}>
              <span style={S.lbl}>Asunto</span>
              <input defaultValue={c.asunto ?? ''} onBlur={e => guardar({ asunto: e.target.value })} style={S.inp} />
            </div>
            <div style={{ marginBottom: 13 }}>
              <span style={S.lbl}>Texto de vista previa</span>
              <input defaultValue={c.preview_text ?? ''} onBlur={e => guardar({ preview_text: e.target.value })} style={S.inp} />
              <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 4 }}>La línea que se ve debajo del asunto en la bandeja. Si la dejas vacía, el cliente de correo inventa una con las primeras palabras.</div>
            </div>
            <div style={{ marginBottom: 13 }}>
              <span style={S.lbl}>Plantilla</span>
              <select value={c.template_id ?? ''} onChange={e => guardar({ template_id: e.target.value || null })} style={S.inp}>
                <option value="">— elige una —</option>
                {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 13 }}>
              <span style={S.lbl}>Tipo de correo</span>
              <select value={c.categoria} onChange={e => guardar({ categoria: e.target.value })} style={S.inp}>
                <option value="marketing">Marketing — cuenta para el límite semanal</option>
                <option value="relacion">Relación (renovación, cobranza) — exento del límite</option>
              </select>
            </div>
            <button style={S.btnA} disabled={ocupado || !c.template_id}
              onClick={() => setPidiendoPrueba(true)}>
              Enviar prueba
            </button>
            {pidiendoPrueba && (
              <PedirTexto titulo="Enviar una prueba"
                sub="Sale con datos de ejemplo y no cuenta para los límites de envío."
                etiqueta="¿A qué correo?" tipo="email" marcador="tu@correo.com" boton="Enviar prueba"
                validar={v => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v) ? null : 'Ese correo no se ve válido.'}
                onOk={to => { setPidiendoPrueba(false); accion('prueba', { para: to }); }}
                onCancelar={() => setPidiendoPrueba(false)} />
            )}
          </div>
        )}

        {paso === 'revision' && <Revision c={c} rev={rev} accion={accion} ocupado={ocupado} />}
      </>)}
    </div>
  );
}

function Revision({ c, rev, accion, ocupado }: any) {
  const [cuando, setCuando] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  if (!rev) return <Cargando que="la revisión" />;
  const total = rev.revision?.alcanzables ?? 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
      <div style={S.card}>
        <div style={{ ...S.kl, marginBottom: 10 }}>Todo esto debe estar bien antes de enviar</div>
        {(rev.checks || []).map((k: any) => (
          <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f7f6fa' }}>
            <span style={{
              width: 17, height: 17, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff',
              background: k.ok ? '#2FA47C' : k.aviso ? '#E0A93E' : '#C0554E',
            }}>{k.ok ? '✓' : '!'}</span>
            <span style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>{k.texto}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={S.card}>
          <div style={S.kl}>Le llegará a</div>
          <div style={{ ...S.kv, marginTop: 6 }}>{total}</div>
          <div style={S.ks}>de {rev.revision?.total ?? 0} en la audiencia</div>
          {Object.keys(rev.revision?.fuera || {}).length > 0 && (
            <div style={{ borderTop: '1px solid #f5f4f8', marginTop: 10, paddingTop: 10, fontSize: '0.74rem', lineHeight: 1.9 }}>
              {Object.entries(rev.revision.fuera).map(([m, n]: any) => (
                <div key={m}><Tag tono="gris">−{n}</Tag> <span style={{ color: '#8a8a8a' }}>{MOTIVO[m] || m}</span></div>
              ))}
            </div>
          )}
        </div>

        <div style={S.card}>
          <button style={{ ...S.btnP, width: '100%', padding: '11px', fontSize: '0.85rem', opacity: (!rev.listo || ocupado) ? .45 : 1 }}
            disabled={!rev.listo || ocupado}
            onClick={() => setConfirmando(true)}>
            Enviar a {total} {total === 1 ? 'contacto' : 'contactos'}
          </button>
          {confirmando && (
            <ConfirmarEnvio total={total} nombre={c.nombre}
              onSi={() => { setConfirmando(false); accion('enviar'); }}
              onNo={() => setConfirmando(false)} />
          )}
          <div style={{ fontSize: '0.7rem', color: '#8a8a8a', textAlign: 'center', marginTop: 7, lineHeight: 1.5 }}>
            Sale en 5 minutos — con un botón para cancelar mientras tanto.
          </div>
          <div style={{ borderTop: '1px solid #f5f4f8', marginTop: 12, paddingTop: 12 }}>
            <span style={S.lbl}>O programarla</span>
            <input type="datetime-local" value={cuando} onChange={e => setCuando(e.target.value)} style={S.inp} />
            <button style={{ ...S.btnA, width: '100%', marginTop: 8, opacity: (!rev.listo || !cuando) ? .45 : 1 }}
              disabled={!rev.listo || !cuando || ocupado}
              onClick={() => accion('programar', { programada_para: new Date(cuando).toISOString() })}>Programar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmar el envío. La fricción es proporcional: mandarle a 8 personas no
 * merece lo mismo que mandarle a 800. Arriba de 50 hay que teclear el número
 * — es el patrón de "escribe el nombre del repositorio para borrarlo", y aquí
 * aplica porque un envío tampoco se deshace.
 */
function ConfirmarEnvio({ total, nombre, onSi, onNo }: { total: number; nombre: string; onSi: () => void; onNo: () => void }) {
  const exigeTeclear = total > 50;
  const [tecleado, setTecleado] = useState('');
  const puede = !exigeTeclear || tecleado.trim() === String(total);

  return (
    <Modal titulo={`Enviar «${nombre}»`} onCerrar={onNo} ancho={440}
      pie={<>
        <button onClick={onSi} disabled={!puede} style={{ ...S.btnP, opacity: puede ? 1 : .45 }}>
          Sí, enviar a {total}
        </button>
        <button onClick={onNo} style={S.btnG}>Cancelar</button>
      </>}>
      <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
        Este correo le llegará a <b>{total} {total === 1 ? 'persona' : 'personas'}</b>.
      </div>
      <div style={{ background: '#EAF8F2', color: '#1E8A63', borderRadius: 10, padding: '10px 12px', fontSize: '0.79rem', marginTop: 12, lineHeight: 1.55 }}>
        <b>Tienes 5 minutos para arrepentirte.</b> No sale de inmediato: queda programado y podrás cancelarlo desde esta misma pantalla.
      </div>
      {exigeTeclear && (
        <div style={{ marginTop: 14 }}>
          <span style={S.lbl}>Para confirmar, escribe el número de destinatarios</span>
          <input value={tecleado} onChange={e => setTecleado(e.target.value)} placeholder={String(total)}
            style={{ ...S.inp, maxWidth: 130 }} autoFocus inputMode="numeric" />
        </div>
      )}
    </Modal>
  );
}

function Resultados({ c, r, dest, onAccion, ocupado }: any) {
  const fuera = dest.filter((d: any) => d.estado === 'rechazado');
  return (<>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
      {[['Enviados', r.enviados, null], ['Entregados', r.entregados, null], ['Clics', r.clics, 'acento'],
        ['Rebotes', r.rebotes, r.rebotes ? 'malo' : null], ['Bajas', r.bajas, null], ['Fuera', r.rechazados, null]].map(([l, v, t]: any) => (
        <div key={l} style={S.card}><div style={S.kl}>{l}</div><div style={{ ...S.kv, color: t === 'acento' ? '#5B4BD6' : t === 'malo' ? '#C0554E' : undefined }}>{v ?? 0}</div></div>
      ))}
    </div>
    {c.estado === 'enviando' && (
      <Aviso tono="acento" accion={<button style={S.btnG} onClick={() => onAccion('pausar')} disabled={ocupado}>Pausar</button>}>
        Enviando… quedan {r.pendientes ?? 0} por salir. Se actualiza solo cada pocos minutos.
      </Aviso>
    )}
    {c.estado === 'pausada' && (
      <Aviso tono="aviso" accion={<button style={S.btnP} onClick={() => onAccion('reanudar')} disabled={ocupado}>Reanudar</button>}>
        Pausada con {r.pendientes ?? 0} pendientes. Reanudar continúa donde quedó, sin repetir a nadie.
      </Aviso>
    )}
    {fuera.length > 0 && (
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px 8px', fontSize: '0.87rem', fontWeight: 800 }}>Quiénes no lo recibieron y por qué</div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {fuera.slice(0, 100).map((d: any, i: number) => (
                <tr key={i}><td style={S.td}>{d.email}</td><td style={S.td}><Tag tono="gris">{MOTIVO[d.motivo] || d.motivo}</Tag></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </>);
}
