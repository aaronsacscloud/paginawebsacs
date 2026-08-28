// SECUENCIAS · La sección que reemplaza al modal de "cadencia": aquí se crean
// secuencias multi-canal (WhatsApp + correo EN UNA SOLA), se definen sus
// reglas y se mide su rendimiento. Las reglas de SALIDA son del sistema y se
// enseñan siempre — es lo que hace confiable prender una secuencia.
import { useEffect, useState } from 'react';
import { useIsMobile } from '../../../lib/ui/mobile';
import type React from 'react';
import Cargando from './ui/Cargando';
import { P, tarjetaKpi } from '../../../lib/crm/paleta';

const inp: React.CSSProperties = { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fdfcff', outline: 'none', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.62rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em', margin: '12px 0 4px' };
const btnP: React.CSSProperties = { border: 'none', background: P.violeta, color: '#fff', borderRadius: 9, padding: '9px 16px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' };
const btnG: React.CSSProperties = { border: '1px solid #ddd', background: '#fff', borderRadius: 9, padding: '8px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#444' };

const MOTIVO_L: Record<string, [string, string]> = {
  respondio: ['Respondieron', P.violetaTinta], agendo: ['Agendaron', P.verdeTinta],
  convertido: ['Se hicieron clientes', P.verdeTinta], descartado: ['Descartados', P.rojoTinta],
  corte: ['Llegaron al corte', '#888'], optout: ['Baja de WhatsApp', P.rojoTinta], archivado: ['Archivados', '#888'],
  pausado_manual: ['Pausados a mano', '#888'], demo_hecha: ['Asistieron a la demo', P.verdeTinta], cancelo: ['Cancelaron la sesión', P.rojoTinta],
};

export default function SecuenciasTab() {
  const esMovilSec = useIsMobile();
  const [lista, setLista] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [plantillasEmail, setPlantillasEmail] = useState<any[]>([]);
  const [plantillasWa, setPlantillasWa] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [simul, setSimul] = useState<any>(null);
  const [simulando, setSimulando] = useState(false);
  const cargar = () => fetch('/api/crm/secuencias').then(r => r.json()).then(j => setLista(j.secuencias || [])).catch(() => setLista([]));
  useEffect(() => {
    cargar();
    fetch('/api/crm/email/templates').then(r => r.json()).then(j => setPlantillasEmail(j.plantillas || [])).catch(() => {});
    fetch('/api/crm/whatsapp/plantillas').then(r => r.json()).then(j => {
      const t = j.plantillas || [];
      setPlantillasWa(t.map((x: any) => ({ nombre: x.name || x.nombre, aprobada: (x.status || x.estado) === 'APPROVED' })));
    }).catch(() => {});
  }, []);

  const guardar = async () => {
    setMsg('');
    const r = await fetch('/api/crm/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setMsg(r.error); return; }
    setEdit(null); cargar();
  };

  if (lista === null) return <Cargando texto="Cargando secuencias…" />;

  if (edit) {
    const pasos: any[] = edit.pasos || [];
    return (
      <div style={{ maxWidth: 860 }}>
        <button style={btnG} onClick={() => setEdit(null)}>← Secuencias</button>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '14px 0 2px' }}>{edit.id ? 'Editar secuencia' : 'Nueva secuencia'}</h2>

        <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '15px 17px', marginTop: 12 }}>
          <span style={lbl}>Nombre</span>
          <input style={{ ...inp, width: '100%' }} value={edit.nombre || ''} onChange={e => setEdit({ ...edit, nombre: e.target.value })} placeholder="Seguimiento a leads sin respuesta" />
          <span style={lbl}>Qué busca esta secuencia</span>
          <input style={{ ...inp, width: '100%' }} value={edit.descripcion || ''} onChange={e => setEdit({ ...edit, descripcion: e.target.value })} placeholder="Construir confianza y agendar la sesión consultiva" />
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
            <div><span style={lbl}>Corte (días)</span>
              <input type="number" min={1} max={60} style={{ ...inp, width: 80 }} value={edit.corte_dias ?? 14} onChange={e => setEdit({ ...edit, corte_dias: Number(e.target.value) })} /></div>
            <div><span style={lbl}>Horario CDMX (L-V)</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input type="number" min={0} max={23} style={{ ...inp, width: 64 }} value={edit.hora_inicio ?? 10} onChange={e => setEdit({ ...edit, hora_inicio: Number(e.target.value) })} />
                <span style={{ fontSize: '0.75rem', color: '#888' }}>a</span>
                <input type="number" min={1} max={24} style={{ ...inp, width: 64 }} value={edit.hora_fin ?? 18} onChange={e => setEdit({ ...edit, hora_fin: Number(e.target.value) })} />
              </span></div>
          </div>
          <span style={lbl}>Días en que envía</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['L', 1], ['M', 2], ['M', 3], ['J', 4], ['V', 5], ['S', 6], ['D', 7]].map(([l, d], i) => {
              const ds: number[] = Array.isArray(edit.dias_envio) && edit.dias_envio.length ? edit.dias_envio : [1, 2, 3, 4, 5];
              const on = ds.includes(d as number);
              return (
                <button key={i} onClick={() => setEdit({ ...edit, dias_envio: on ? ds.filter(x => x !== d) : [...ds, d as number].sort() })}
                  style={{ width: 32, height: 32, borderRadius: 99, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 800,
                    borderColor: on ? '#c9bcf7' : '#e2e4e9', background: on ? P.violetaAgua : '#fff', color: on ? P.violetaTinta : '#a5a2af' }}>{l}</button>
              );
            })}
          </div>
          <span style={lbl}>Quién entra (estatus del lead)</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['Sin tocar', 'nuevo'], ['Contactado', 'contactado'], ['No contesta', 'sin_respuesta'], ['Respondió', 'respondio'], ['Descubrimiento', 'descubrimiento'], ['Agendó demo', 'agendado']].map(([l, v]) => {
              const est: string[] = edit.entrada?.estatus?.length ? edit.entrada.estatus : ['contactado', 'sin_respuesta'];
              const on = est.includes(v as string);
              return (
                <button key={v as string} onClick={() => setEdit({ ...edit, entrada: { ...(edit.entrada || {}), estatus: on ? est.filter(x => x !== v) : [...est, v as string] } })}
                  style={{ borderRadius: 999, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, padding: '5px 12px',
                    borderColor: on ? '#c9bcf7' : '#e2e4e9', background: on ? P.violetaAgua : '#fff', color: on ? P.violetaTinta : '#a5a2af' }}>{l}</button>
              );
            })}
          </div>
          <p style={{ fontSize: '0.68rem', color: '#a5a2af', margin: '7px 0 0' }}>Solo entran leads (nunca clientes ni oportunidades) que llegaron dentro del corte — los viejos no reciben ráfagas.</p>
          <span style={lbl}>Objetivo de la secuencia</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['Que responda', 'respondio'], ['Que agende demo', 'agendo'], ['Que asista a la demo', 'demo_hecha'], ['Que se haga cliente', 'convertido']].map(([l, v]) => {
              const on = (edit.objetivo || 'agendo') === v;
              return (
                <button key={v as string} onClick={() => setEdit({ ...edit, objetivo: v })}
                  style={{ borderRadius: 999, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, padding: '5px 12px',
                    borderColor: on ? '#b5e3d1' : '#e2e4e9', background: on ? P.verdeAgua : '#fff', color: on ? P.verdeTinta : '#a5a2af' }}>{l}</button>
              );
            })}
          </div>
          <p style={{ fontSize: '0.68rem', color: '#a5a2af', margin: '7px 0 0' }}>
            Al cumplir el objetivo, la secuencia ENTERA termina para ese lead (correos y WhatsApps). Con «Que agende demo» o «Que se haga cliente», responder solo detiene el canal por el que respondió — el otro sigue nutriendo hacia el objetivo.
          </p>
        </div>

        {/* Las reglas: quién entra, quién sale. Fijas y a la vista. */}
        <div style={{ background: '#fff', border: '1.5px solid #cfe0fa', borderRadius: 12, padding: '15px 17px', marginTop: 12 }}>
          <div style={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Las reglas (las aplica el sistema, siempre)</div>
          <div style={{ fontSize: '0.78rem', color: '#4a4a52', lineHeight: 1.7 }}>
            <b>Si responde, se ajusta el canal (no sale):</b> respondió por WhatsApp → se detienen los WhatsApps automáticos y los correos SIGUEN; respondió por correo → al revés. Si respondió por ambos, ahí sí sale.<br />
            <b>Sale al instante cuando:</b> agenda una reunión · se convierte en cliente · se descarta («no le interesa») · empieza a negociar (cotizado) · se cumple el corte de {edit.corte_dias ?? 14} días. La baja de WhatsApp detiene ese canal para siempre.<br />
            <b>Pausa («pidió tiempo»):</b> suspende los envíos, NO lo saca — al vencer la pausa, continúa donde iba.<br />
            <b>Techo global:</b> máximo un correo y un WhatsApp AL DÍA por lead, contando TODAS las secuencias; y cada corrida manda a lo más 60 por canal — una campaña grande sale en olas, no en ráfaga.<br />
            <b>Re-entrada:</b> quien salió solo vuelve a entrar si levanta la mano otra vez, o si su salida tiene más de 90 días y hoy vuelve a cumplir la entrada.<br />
            <b>El vendedor siempre se entera:</b> cada correo enviado, cada canal detenido y cada salida dejan una nota en el hilo del inbox, y desde el detalle de la conversación puede pausar o reanudar la secuencia de ese lead.
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '15px 17px', marginTop: 12 }}>
          <div style={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Los pasos (WhatsApp y correo, una sola secuencia)</div>
          {pasos.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: '#999' }}>Día</span>
              <input type="number" min={1} value={p.dia} onChange={e => setEdit({ ...edit, pasos: pasos.map((x, j) => j === i ? { ...x, dia: Number(e.target.value) } : x) })} style={{ ...inp, width: 58 }} />
              <select value={p.canal} onChange={e => setEdit({ ...edit, pasos: pasos.map((x, j) => j === i ? { ...x, canal: e.target.value } : x) })} style={{ ...inp, width: 104 }}>
                <option value="correo">Correo</option><option value="wa">WhatsApp</option>
              </select>
              {p.canal === 'correo' ? (<>
                <select value={p.email_template_id || ''} onChange={e => setEdit({ ...edit, pasos: pasos.map((x, j) => j === i ? { ...x, email_template_id: e.target.value } : x) })} style={{ ...inp, flex: 1, minWidth: 180 }}>
                  <option value="">— plantilla de correo —</option>
                  {plantillasEmail.map((x: any) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
                {p.email_template_id_b === undefined || p.email_template_id_b === null ? (
                  <button title="Prueba A/B: mitad de los leads recibe la variante B" onClick={() => setEdit({ ...edit, pasos: pasos.map((x, j) => j === i ? { ...x, email_template_id_b: '' } : x) })}
                    style={{ border: '1px dashed #c9bcf7', background: '#fff', borderRadius: 8, padding: '5px 9px', fontSize: '0.66rem', fontWeight: 800, color: P.violetaTinta, cursor: 'pointer', fontFamily: 'inherit' }}>A/B</button>
                ) : (
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flex: 1, minWidth: 180 }}>
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, color: P.violetaTinta }}>B:</span>
                    <select value={p.email_template_id_b || ''} onChange={e => setEdit({ ...edit, pasos: pasos.map((x, j) => j === i ? { ...x, email_template_id_b: e.target.value } : x) })} style={{ ...inp, flex: 1 }}>
                      <option value="">— variante B —</option>
                      {plantillasEmail.map((x: any) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                    <button title="Quitar la variante B" onClick={() => setEdit({ ...edit, pasos: pasos.map((x, j) => j === i ? { ...x, email_template_id_b: null } : x) })}
                      style={{ border: 'none', background: 'none', color: '#a5a2af', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </span>
                )}
              </>) : (
                <select value={p.wa_plantilla || ''} onChange={e => setEdit({ ...edit, pasos: pasos.map((x, j) => j === i ? { ...x, wa_plantilla: e.target.value } : x) })} style={{ ...inp, flex: 1, minWidth: 180 }}>
                  <option value="">— plantilla de WhatsApp —</option>
                  {plantillasWa.map((x: any) => <option key={x.nombre} value={x.nombre}>{x.nombre}{x.aprobada ? '' : ' (en revisión de Meta)'}</option>)}
                  {p.wa_plantilla && !plantillasWa.some((x: any) => x.nombre === p.wa_plantilla) && <option value={p.wa_plantilla}>{p.wa_plantilla}</option>}
                </select>
              )}
              <label title="Un paso apagado se salta sin borrar su lugar" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: '0.68rem', color: p.activo === false ? '#a5a2af' : P.verdeTinta, fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={p.activo !== false} onChange={e => setEdit({ ...edit, pasos: pasos.map((x, j) => j === i ? { ...x, activo: e.target.checked } : x) })} />
                {p.activo === false ? 'apagado' : 'activo'}
              </label>
              <button onClick={() => setEdit({ ...edit, pasos: pasos.filter((_, j) => j !== i) })} style={{ border: 'none', background: 'none', color: '#a5a2af', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
              {p.canal === 'correo' && (() => {
                const st = (edit.stats_correo || []).filter((x: any) => [p.email_template_id, p.email_template_id_b].includes(x.template_id));
                if (!st.length) return null;
                return (
                  <span style={{ flexBasis: '100%', fontSize: '0.65rem', color: '#a5a2af', paddingLeft: 66 }}>
                    {st.map((x: any) => `${st.length > 1 || x.variante === 'B' ? x.variante + ': ' : ''}${x.enviados} enviados · ${x.abiertos} abiertos · ${x.clics} clics`).join('  ·  ')}
                  </span>
                );
              })()}
            </div>
          ))}
          <button style={{ ...btnG, marginTop: 4 }} onClick={() => setEdit({ ...edit, pasos: [...pasos, { dia: (pasos[pasos.length - 1]?.dia || 0) + 1, canal: 'correo', activo: true }] })}>+ Agregar paso</button>
          <p style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 8 }}>Los correos se editan por bloques en Email ▸ Plantillas; los WhatsApps son plantillas aprobadas por Meta. Máximo un correo y un WhatsApp por corrida por lead.</p>
        </div>

        {simul && (
          <div style={{ background: P.violetaAgua, border: '1px solid #ddd6fb', borderRadius: 10, padding: '11px 14px', marginTop: 12, fontSize: '0.78rem', color: '#4a4a52' }}>
            <b>Simulacro (no envió nada):</b> entrarían <b>{simul.enrolados ?? 0}</b> leads hoy · saldrían {simul.graduados ?? 0} · canales que se detendrían: {simul.canales_detenidos ?? 0} · envíos que tocarían hoy: {simul.envios ?? 0}.
            <button onClick={() => setSimul(null)} style={{ border: 'none', background: 'none', color: P.violetaTinta, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 8 }}>cerrar</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <button style={btnP} onClick={guardar}>Guardar secuencia</button>
          <button style={btnG} disabled={simulando} onClick={async () => {
            setSimulando(true); setSimul(null);
            const r = await fetch('/api/cron/leads-cadencia?dry=1').then(x => x.json()).catch(e => ({ error: String(e) }));
            setSimulando(false); setSimul(r);
          }}>{simulando ? 'Simulando…' : 'Simular (sin enviar)'}</button>
          <label style={{ display: 'inline-flex', gap: 7, alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!edit.activa} onChange={e => setEdit({ ...edit, activa: e.target.checked })} /> Activa
          </label>
          {msg && <span style={{ fontSize: '0.75rem', color: P.rojoTinta, fontWeight: 700 }}>{msg}</span>}
        </div>
      </div>
    );
  }

  // En el teléfono: margen propio (el contenido arrancaba pegado al borde),
  // sin el H1 que ya dice la barra, y el botón a ancho completo — se salía de
  // la pantalla por la derecha. El párrafo largo se guarda para escritorio:
  // aquí estorba antes de llegar a la primera secuencia.
  return (
    <div style={{ maxWidth: 980, padding: esMovilSec ? '4px 18px 0' : 0 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: esMovilSec ? 12 : 4, flexDirection: esMovilSec ? 'column' : 'row', alignItems: esMovilSec ? 'stretch' : 'center' }}>
        {!esMovilSec && <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-.015em' }}>Secuencias</h1>}
        <button style={{ ...btnP, marginLeft: esMovilSec ? 0 : 'auto', height: 44, minHeight: 44, padding: '0 16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...(esMovilSec ? { width: '100%' } : {}) }} onClick={() => setEdit({ nombre: '', corte_dias: 14, hora_inicio: 10, hora_fin: 18, activa: false, pasos: [] })}>+ Nueva secuencia</button>
      </div>
      {!esMovilSec && (
        <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 16px' }}>
          WhatsApp y correo en un solo flujo: el lead entra por reglas, recibe los pasos en orden, y si responde por un canal ese canal se detiene solo (el otro sigue). Aquí se mide qué tan bien funciona cada secuencia.
        </p>
      )}
      {lista.length === 0 && <div style={{ color: '#a5a2af', fontSize: '0.85rem' }}>Sin secuencias todavía — crea la primera.</div>}
      {lista.map(s => {
        const m = s.metricas || {};
        const salidas = m.salidas || {};
        return (
          <div key={s.id} style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${s.activa ? P.verde : '#d8d6e4'}`, borderRadius: 12, padding: '15px 17px', marginBottom: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <b style={{ fontSize: '0.95rem' }}>{s.nombre}</b>
              <span style={{ fontSize: '0.64rem', fontWeight: 800, borderRadius: 999, padding: '3px 10px', background: s.activa ? P.verdeAgua : '#f4f3f6', color: s.activa ? P.verdeTinta : '#6b6b74', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.activa ? 'Activa' : 'Apagada'}</span>
              <span style={{ fontSize: '0.72rem', color: '#a5a2af' }}>{(s.pasos || []).length} pasos · corte {s.corte_dias} d · {s.hora_inicio}-{s.hora_fin} h · {(Array.isArray(s.dias_envio) && s.dias_envio.length ? s.dias_envio : [1,2,3,4,5]).map((d: number) => 'LMMJVSD'[d-1]).join('')}</span>
              {!esMovilSec && <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexBasis: esMovilSec ? '100%' : undefined, marginTop: esMovilSec ? 4 : 0 }}>
                <button style={{ ...btnG, minHeight: 44, ...(esMovilSec ? { flex: 1 } : {}) }} onClick={() => setEdit({ ...s })}>Editar</button>
                <button style={{ ...btnG, minHeight: 44, ...(esMovilSec ? { flex: 1 } : {}), color: s.activa ? P.rojoTinta : P.verdeTinta, fontWeight: 700 }}
                  onClick={async () => { await fetch('/api/crm/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...s, activa: !s.activa }) }); cargar(); }}>
                  {s.activa ? 'Apagar' : 'Prender'}
                </button>
              </span>}
            </div>
            {s.descripcion && <div style={{ fontSize: '0.76rem', color: '#8a8a92', marginTop: 4 }}>{s.descripcion}</div>}
            {esMovilSec ? (
              /* Una métrica por renglón: tarjeta dentro de tarjeta partía
                 «0 correos · 0 / WA» y estiraba cada secuencia a 550 px. */
              <div style={{ marginTop: 10, borderTop: '1px solid #f0eff3', paddingTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: '0.82rem' }}>
                  <span style={{ color: '#8f8d98' }}>En secuencia</span><b>{m.en_secuencia ?? 0}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: '0.82rem' }}>
                  <span style={{ color: '#8f8d98' }}>Entraron</span><b>{m.entraron ?? 0}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: '0.82rem' }}>
                  <span style={{ color: '#8f8d98' }}>Envíos</span>
                  <b style={{ textAlign: 'right' }}>{m.correos ?? 0} correos · {m.whatsapps ?? 0} WA</b>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#8f8d98', textAlign: 'right', marginTop: -2 }}>
                  {m.correos_abiertos ?? 0} abiertos · {m.correos_clic ?? 0} con clic
                </div>
                {/* El objetivo se queda: es la métrica que mide si la secuencia
                    sirvió, no un adorno. */}
                {(() => {
                  const orden = ['respondio', 'agendo', 'demo_hecha', 'convertido'];
                  const desde = orden.indexOf(s.objetivo || 'agendo');
                  const logrados = orden.slice(desde).reduce((a, k) => a + (Number(salidas[k]) || 0), 0);
                  const entraron = Number(m.entraron) || 0;
                  const meta = ({ respondio: 'que responda', agendo: 'que agende demo', demo_hecha: 'que asista a la demo', convertido: 'que se haga cliente' } as any)[s.objetivo || 'agendo'];
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0 0', marginTop: 5, borderTop: '1px solid #f0eff3', fontSize: '0.82rem' }}>
                      <span style={{ color: '#8f8d98', minWidth: 0 }}>Objetivo: {meta}</span>
                      <b style={{ color: logrados > 0 ? P.verdeTinta : '#8f8d98', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {logrados} de {entraron}{entraron ? ` · ${Math.round(logrados / entraron * 100)}%` : ''}
                        {m.tiempo_a_objetivo != null ? ` · ~${m.tiempo_a_objetivo} d` : ''}
                      </b>
                    </div>
                  );
                })()}
              </div>
            ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <div style={{ ...tarjetaKpi(P.violeta), minWidth: 120, flex: 1 }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>En secuencia</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: P.violetaTinta }}>{m.en_secuencia ?? 0}</div>
              </div>
              <div style={{ ...tarjetaKpi(P.azul), minWidth: 120, flex: 1 }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Entraron</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: P.azulTinta }}>{m.entraron ?? 0}</div>
              </div>
              <div style={{ ...tarjetaKpi(P.azul), minWidth: 140, flex: 1 }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>Envíos</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: P.azulTinta }}>{m.correos ?? 0} correos · {m.whatsapps ?? 0} WA</div>
                <div style={{ fontSize: '0.68rem', color: '#888', marginTop: 2 }}>{m.correos_abiertos ?? 0} abiertos · {m.correos_clic ?? 0} con clic</div>
              </div>
              <div style={{ ...tarjetaKpi(P.verde), minWidth: 150, flex: 1.4 }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>
                  Objetivo: {({ respondio: 'que responda', agendo: 'que agende demo', demo_hecha: 'que asista a la demo', convertido: 'que se haga cliente' } as any)[s.objetivo || 'agendo']}
                </div>
                {(() => {
                  const orden = ['respondio', 'agendo', 'demo_hecha', 'convertido'];
                  const desde = orden.indexOf(s.objetivo || 'agendo');
                  const logrados = orden.slice(desde).reduce((a, k) => a + (Number(salidas[k]) || 0), 0);
                  const entraron = Number(m.entraron) || 0;
                  return (
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: logrados > 0 ? P.verdeTinta : '#8f8d98' }}>
                      {logrados} de {entraron}{entraron ? ` · ${Math.round(logrados / entraron * 100)}%` : ''}
                      {m.tiempo_a_objetivo != null && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888' }}> · ~{m.tiempo_a_objetivo} días</span>}
                    </div>
                  );
                })()}
                <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 3, display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {Object.keys(salidas).length === 0 && <span style={{ color: '#c4c4cc' }}>aún sin salidas</span>}
                  {Object.entries(salidas).map(([k, v]: any) => {
                    const [l, col] = MOTIVO_L[k] || [k, '#888'];
                    return <span key={k} style={{ color: col }}>{l}: {v}</span>;
                  })}
                </div>
              </div>
            </div>
            )}
            {/* Las acciones al PIE: entre la meta y la descripción cortaban la
                lectura de la tarjeta. */}
            {esMovilSec && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button style={{ ...btnG, minHeight: 44, flex: 1 }} onClick={() => setEdit({ ...s })}>Editar</button>
                <button style={{ ...btnG, minHeight: 44, flex: 1, color: s.activa ? P.rojoTinta : P.verdeTinta, fontWeight: 700 }}
                  onClick={async () => { await fetch('/api/crm/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...s, activa: !s.activa }) }); cargar(); }}>
                  {s.activa ? 'Apagar' : 'Prender'}
                </button>
              </div>
            )}
          </div>
        );
      })}
      <p style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 6 }}>
        Reglas (todas las secuencias): responder detiene SOLO ese canal — respondió por WhatsApp y los correos siguen (y al revés). Sale al agendar, hacerse cliente, descartarse o llegar al corte. La pausa «pidió tiempo» solo suspende. Cada envío, canal detenido y salida deja nota en el hilo del inbox y queda firmado en la actividad.
      </p>
    </div>
  );
}
