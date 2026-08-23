// WHATSAPP · Masivos: mandar una plantilla a muchos y VER a quién le llegó.
//
// La lista enseña el embudo (enviados → entregados → leídos) y el detalle la
// tabla por destinatario con su status de Kapso/Meta (pending, sent, failed,
// suppressed) — suppressed = ese número pidió no recibir marketing.
// El botón Actualizar re-sincroniza con throttle de 60 s del lado del server.
import { useEffect, useState } from 'react';
import Cargando, { Corazones } from '../ui/Cargando';
import { S, Tag, Aviso, Vacio, chip, fmtFecha } from '../email/ui';
import { telefonoLegible } from '../../../../lib/telefono';

const TONO: Record<string, string> = {
  borrador: 'gris', programado: 'info', enviando: 'aviso', enviado: 'ok', fallido: 'malo', detenido: 'gris',
  pending: 'gris', sent: 'info', failed: 'malo', suppressed: 'aviso',
};
const NOMBRE_DEST: Record<string, string> = {
  pending: 'pendiente', sent: 'enviado', failed: 'falló', suppressed: 'no quiere marketing',
};

export default function Masivos() {
  const [d, setD] = useState<any>(null);
  const [detalle, setDetalle] = useState<any>(null);       // { broadcast, destinatarios }
  const [filtro, setFiltro] = useState('');
  const [wizard, setWizard] = useState<any>(null);          // { paso, nombre, plantilla, seleccion:Set, params[] }
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tono: string; texto: string } | null>(null);

  const cargar = () => fetch('/api/crm/whatsapp/broadcasts').then(r => r.json()).then(setD).catch(() => setD({ broadcasts: [] }));
  useEffect(() => { cargar(); }, []);

  const abrirDetalle = (id: string, st = '') => {
    setDetalle(null); setFiltro(st);
    fetch(`/api/crm/whatsapp/broadcasts?id=${id}${st ? `&status=${st}` : ''}`)
      .then(r => r.json()).then(setDetalle).catch(() => setDetalle({ error: 'Sin conexión' }));
  };

  // ── Wizard ──
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [audiencia, setAudiencia] = useState<any[] | null>(null);
  const abrirWizard = () => {
    setWizard({ paso: 1, nombre: '', plantilla: null, seleccion: new Set<string>(), params: [], busca: '' });
    fetch('/api/crm/whatsapp/plantillas').then(r => r.json())
      .then(j => setPlantillas((j.plantillas || []).filter((p: any) => p.status === 'APPROVED')));
    fetch('/api/crm/whatsapp/broadcasts?audiencia=1').then(r => r.json())
      .then(j => setAudiencia(j.audiencia || []));
  };

  const crearYEnviar = async (programa?: string) => {
    setOcupado(true); setMsg(null);
    const elegidos = (audiencia || []).filter(a => wizard.seleccion.has(a.telefono));
    const destinatarios = elegidos.map(a => ({
      telefono: a.telefono, contact_id: a.contact_id, company_id: a.company_id,
      // [nombre] se sustituye por el nombre de cada contacto.
      params: wizard.params.map((p: string) => p === '[nombre]' ? (a.nombre.split(' ')[0] || a.nombre) : p),
    }));
    const creado = await fetch('/api/crm/whatsapp/broadcasts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: wizard.nombre, plantilla_id: wizard.plantilla.id, destinatarios }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    if (creado.error) { setOcupado(false); setMsg({ tono: 'malo', texto: creado.error }); return; }

    const accion = await fetch('/api/crm/whatsapp/broadcasts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(programa
        ? { accion: 'programar', id: creado.id, scheduled_at: programa }
        : { accion: 'enviar', id: creado.id }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setOcupado(false);
    if (accion.error) { setMsg({ tono: 'malo', texto: `El masivo se creó pero no salió: ${accion.error}` }); }
    else setMsg({ tono: 'ok', texto: programa ? 'Masivo programado.' : `Masivo en camino a ${creado.total} números.` });
    setWizard(null); cargar();
  };

  if (!d) return <Cargando texto="Cargando masivos…" />;

  // ═══ Detalle ═══
  if (detalle) {
    if (detalle.error) return <div style={S.wrap}><Aviso tono="malo">{detalle.error}</Aviso></div>;
    const b = detalle.broadcast;
    const filtros = ['', 'pending', 'sent', 'failed', 'suppressed'];
    return (
      <div style={S.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <button style={S.btnG} onClick={() => { setDetalle(null); cargar(); }}>← Masivos</button>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{b.nombre}</h3>
          <Tag tono={TONO[b.status] || 'gris'}>{b.status}</Tag>
          <span style={{ flex: 1 }} />
          <button style={S.btnA} onClick={() => abrirDetalle(b.id, filtro)}>Actualizar</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[['Destinatarios', b.total, '#9B8CFA', '#5B4BD6'], ['Enviados', b.enviados, '#7DA6F5', '#2C5FC4'],
            ['Entregados', b.entregados, '#7DA6F5', '#2C5FC4'], ['Leídos', b.leidos, '#4FBF95', '#1E8A63'],
            ['Respondieron', b.respondidos, '#4FBF95', '#1E8A63'], ['Fallidos', b.fallidos, '#EF7A72', '#C0554E']].map(([et, v, franja, tinta]: any) => (
            <div key={et} style={{ ...S.card, borderLeft: `3px solid ${franja}`, padding: '12px 14px' }}>
              <div style={S.kl}>{et}</div>
              <div style={{ ...S.kv, fontSize: '1.4rem', color: tinta }}>{v ?? 0}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
          {filtros.map(f => (
            <button key={f || 'todos'} style={chip(filtro === f)} onClick={() => abrirDetalle(b.id, f)}>
              {f ? (NOMBRE_DEST[f] || f) : 'Todos'}
            </button>
          ))}
        </div>

        <div className="crm-scroll-x" style={{ ...S.card, padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead><tr>
              <th style={S.th}>Contacto</th><th style={S.th}>Teléfono</th><th style={S.th}>Estado</th>
              <th style={S.th}>Entregado</th><th style={S.th}>Leído</th><th style={S.th}>Error</th>
            </tr></thead>
            <tbody>
              {detalle.destinatarios.map((r: any) => (
                <tr key={r.id}>
                  <td style={S.td}>
                    {r.contacts ? `${r.contacts.nombre || ''} ${r.contacts.apellido || ''}`.trim() : <span style={{ color: '#a5a2af' }}>—</span>}
                    {r.companies?.nombre && <div style={{ fontSize: '0.68rem', color: '#8a8a92' }}>{r.companies.nombre}</div>}
                  </td>
                  <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{telefonoLegible(r.telefono)}</td>
                  <td style={S.td}><Tag tono={TONO[r.status] || 'gris'}>{NOMBRE_DEST[r.status] || r.status}</Tag></td>
                  <td style={S.td}>{r.delivered_at ? fmtFecha(r.delivered_at) : '—'}</td>
                  <td style={S.td}>{r.read_at ? fmtFecha(r.read_at) : '—'}</td>
                  <td style={{ ...S.td, fontSize: '0.7rem', color: '#C0554E', maxWidth: 220 }}>{r.error_message || ''}</td>
                </tr>
              ))}
              {!detalle.destinatarios.length && (
                <tr><td style={{ ...S.td, textAlign: 'center', color: '#a5a2af' }} colSpan={6}>Nada con ese filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ═══ Wizard ═══
  if (wizard) {
    const filtrada = (audiencia || []).filter(a =>
      !wizard.busca || `${a.nombre} ${a.empresa || ''} ${a.telefono}`.toLowerCase().includes(wizard.busca.toLowerCase()));
    const todosFiltrados = filtrada.length > 0 && filtrada.every(a => wizard.seleccion.has(a.telefono));
    return (
      <div style={S.wrap}>
        {msg && <div style={{ marginBottom: 12 }}><Aviso tono={msg.tono as any}>{msg.texto}</Aviso></div>}
        <div style={{ ...S.card, maxWidth: 760 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Nuevo masivo</h3>
            {[1, 2, 3].map(n => (
              <span key={n} style={{
                width: 22, height: 22, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.68rem', fontWeight: 800,
                background: wizard.paso >= n ? '#9B8CFA' : '#eeeef1', color: wizard.paso >= n ? '#fff' : '#8a8a92',
              }}>{n}</span>
            ))}
            <span style={{ flex: 1 }} />
            <button style={S.btnG} onClick={() => setWizard(null)}>Cancelar</button>
          </div>

          {wizard.paso === 1 && (<>
            <label style={S.lbl}>Nombre del masivo (interno)</label>
            <input style={S.inp} value={wizard.nombre} onChange={e => setWizard({ ...wizard, nombre: e.target.value })}
              placeholder="Aviso de renovación agosto" />
            <label style={{ ...S.lbl, marginTop: 12 }}>Plantilla (solo aprobadas por Meta)</label>
            {!plantillas.length && <Aviso tono="aviso">No hay plantillas APPROVED. Crea una en el tab Plantillas y espera la aprobación de Meta.</Aviso>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plantillas.map(p => (
                <button key={p.id} onClick={() => setWizard({ ...wizard, plantilla: p, params: Array(p.variables || 0).fill('') })}
                  style={{
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 10, padding: '10px 13px',
                    border: wizard.plantilla?.id === p.id ? '2px solid #9B8CFA' : '1px solid #e2e4e9',
                    background: wizard.plantilla?.id === p.id ? '#f7f4ff' : '#fff',
                  }}>
                  <b style={{ fontSize: '0.8rem' }}>{p.nombre}</b> <Tag tono={p.categoria === 'MARKETING' ? 'acento' : 'info'}>{p.categoria}</Tag>
                  <div style={{ fontSize: '0.74rem', color: '#666', marginTop: 4 }}>{p.cuerpo}</div>
                </button>
              ))}
            </div>
            {wizard.plantilla && (wizard.plantilla.variables || 0) > 0 && (<>
              <label style={{ ...S.lbl, marginTop: 12 }}>Variables — escribe [nombre] para usar el nombre de cada contacto</label>
              {wizard.params.map((v: string, i: number) => (
                <input key={i} style={{ ...S.inp, marginTop: i ? 8 : 0 }} value={v} placeholder={`{{${i + 1}}}`}
                  onChange={e => { const params = [...wizard.params]; params[i] = e.target.value; setWizard({ ...wizard, params }); }} />
              ))}
            </>)}
            <div style={{ marginTop: 14 }}>
              <button style={S.btnP} disabled={!wizard.nombre.trim() || !wizard.plantilla}
                onClick={() => setWizard({ ...wizard, paso: 2 })}>Elegir destinatarios</button>
            </div>
          </>)}

          {wizard.paso === 2 && (<>
            {audiencia === null ? <Cargando texto="Cargando contactos con WhatsApp…" alto={120} /> : (<>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <input style={{ ...S.inp, width: 260 }} placeholder="Buscar contacto o empresa…" value={wizard.busca}
                  onChange={e => setWizard({ ...wizard, busca: e.target.value })} />
                <button style={S.btnG} onClick={() => {
                  const sel = new Set(wizard.seleccion);
                  filtrada.forEach(a => todosFiltrados ? sel.delete(a.telefono) : sel.add(a.telefono));
                  setWizard({ ...wizard, seleccion: sel });
                }}>{todosFiltrados ? 'Quitar los visibles' : 'Marcar los visibles'}</button>
                <Tag tono="acento">{wizard.seleccion.size} elegidos</Tag>
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #eeeef1', borderRadius: 10 }}>
                {filtrada.map(a => (
                  <label key={a.telefono} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f7f6fa', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input type="checkbox" checked={wizard.seleccion.has(a.telefono)} onChange={() => {
                      const sel = new Set(wizard.seleccion);
                      sel.has(a.telefono) ? sel.delete(a.telefono) : sel.add(a.telefono);
                      setWizard({ ...wizard, seleccion: sel });
                    }} />
                    <span style={{ fontWeight: 600 }}>{a.nombre}</span>
                    {a.empresa && <span style={{ color: '#8a8a92', fontSize: '0.72rem' }}>{a.empresa}</span>}
                    <span style={{ flex: 1 }} />
                    <span style={{ color: '#8a8a92', fontVariantNumeric: 'tabular-nums' }}>{telefonoLegible(a.telefono)}</span>
                  </label>
                ))}
                {!filtrada.length && <div style={{ padding: 16, fontSize: '0.78rem', color: '#a5a2af' }}>Nadie coincide con la búsqueda.</div>}
              </div>
              <p style={{ fontSize: '0.7rem', color: '#8a8a92', marginTop: 8 }}>
                Solo aparecen contactos con teléfono utilizable para WhatsApp; los repetidos se cuentan una vez.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button style={S.btnG} onClick={() => setWizard({ ...wizard, paso: 1 })}>← Atrás</button>
                <button style={S.btnP} disabled={!wizard.seleccion.size} onClick={() => setWizard({ ...wizard, paso: 3 })}>
                  Revisar y enviar
                </button>
              </div>
            </>)}
          </>)}

          {wizard.paso === 3 && (<>
            <div style={{ background: '#f7f6fb', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <div style={S.kl}>Resumen</div>
              <div style={{ fontSize: '0.82rem', marginTop: 6, lineHeight: 1.6 }}>
                <b>{wizard.nombre}</b> · plantilla <b>{wizard.plantilla.nombre}</b> ·{' '}
                <b>{wizard.seleccion.size}</b> destinatarios
                {wizard.params.some((p: string) => p === '[nombre]') && <> · con nombre personalizado</>}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#555', marginTop: 6, whiteSpace: 'pre-wrap' }}>{wizard.plantilla.cuerpo}</div>
            </div>
            {wizard.plantilla.categoria === 'MARKETING' && (
              <Aviso tono="aviso">Es plantilla de marketing: quien haya pedido no recibir promos saldrá como «suppressed» y no se le cobra.</Aviso>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button style={S.btnG} onClick={() => setWizard({ ...wizard, paso: 2 })}>← Atrás</button>
              <button style={S.btnP} disabled={ocupado} onClick={() => crearYEnviar()}>
                {ocupado ? <Corazones size={9} color="#fff" /> : `Enviar ahora a ${wizard.seleccion.size}`}
              </button>
              <input type="datetime-local" style={{ ...S.inp, width: 'auto' }} value={wizard.cuando || ''}
                onChange={e => setWizard({ ...wizard, cuando: e.target.value })} />
              <button style={S.btnA} disabled={ocupado || !wizard.cuando}
                onClick={() => crearYEnviar(new Date(wizard.cuando).toISOString())}>Programar</button>
            </div>
          </>)}
        </div>
      </div>
    );
  }

  // ═══ Lista ═══
  const lista: any[] = d.broadcasts || [];
  return (
    <div style={S.wrap}>
      {msg && <div style={{ marginBottom: 12 }}><Aviso tono={msg.tono as any}>{msg.texto}</Aviso></div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Masivos de WhatsApp</h3>
        <span style={{ flex: 1 }} />
        <button style={S.btnG} onClick={cargar}>Actualizar</button>
        <button style={S.btnP} onClick={abrirWizard}>Nuevo masivo</button>
      </div>

      {!lista.length && <Vacio titulo="Sin masivos todavía"
        texto="Un masivo manda una plantilla aprobada a los contactos que elijas y aquí se ve, número por número, a quién le llegó." />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map(b => {
          const pct = (n: number) => b.total ? Math.round((n / b.total) * 100) : 0;
          return (
            <button key={b.id} onClick={() => abrirDetalle(b.id)}
              style={{ ...S.card, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.85rem' }}>{b.nombre}</b>
                <Tag tono={TONO[b.status] || 'gris'}>{b.status}</Tag>
                <span style={{ fontSize: '0.7rem', color: '#8a8a92' }}>{b.plantilla_nombre}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: '0.7rem', color: '#8a8a92' }}>{fmtFecha(b.sent_at || b.scheduled_at || b.created_at)}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 9, flexWrap: 'wrap', fontSize: '0.74rem' }}>
                <span><b style={{ color: '#5B4BD6' }}>{b.total}</b> destinatarios</span>
                <span><b style={{ color: '#2C5FC4' }}>{b.enviados}</b> enviados ({pct(b.enviados)}%)</span>
                <span><b style={{ color: '#2C5FC4' }}>{b.entregados}</b> entregados ({pct(b.entregados)}%)</span>
                <span><b style={{ color: '#1E8A63' }}>{b.leidos}</b> leídos ({pct(b.leidos)}%)</span>
                {b.fallidos > 0 && <span><b style={{ color: '#C0554E' }}>{b.fallidos}</b> fallidos</span>}
              </div>
              <div style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', background: '#eeeef1', marginTop: 8 }}>
                <span style={{ width: `${pct(b.leidos)}%`, background: '#4FBF95' }} />
                <span style={{ width: `${Math.max(0, pct(b.entregados) - pct(b.leidos))}%`, background: '#7DA6F5' }} />
                <span style={{ width: `${Math.max(0, pct(b.fallidos))}%`, background: '#EF7A72' }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
