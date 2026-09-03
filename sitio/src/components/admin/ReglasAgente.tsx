/**
 * REGLAS DEL AGENTE · desde la pantalla (decisión del dueño, 2026-09-03).
 * El consultor escribe la regla en español («no ofrezcas la demo hasta conocer el negocio y una o dos necesidades»),
 * la PRUEBA contra casos reales (el agente responde con y sin la regla; un juez califica y cuenta en cuántos casos la
 * respuesta viola la regla) y la ACTIVA: entra al bloque «Reglas vigentes» del prompt con fecha. Se puede retirar.
 * Con soloGuion, es el editor con versiones del guion, la wiki y los límites (Configuración; solo el dueño guarda).
 */
import { useEffect, useState } from 'react';

const ETAPAS = [['', 'Todas las etapas'], ['nuevo', 'Nuevo'], ['descubriendo', 'Descubriendo'], ['proponiendo', 'Proponiendo'], ['confirmando', 'Confirmando'], ['agendada', 'Agendada'], ['no_show', 'No show'], ['reunion_hecha', 'Reunión hecha'], ['silencio', 'Silencio'], ['humano', 'Con consultor']];
const fecha = (s?: string | null) => s ? new Date(s).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }) : '—';
const postJ = (url: string, body: any) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(e => ({ error: String(e) }));

export default function ReglasAgente({ soloGuion }: { soloGuion?: boolean } = {}) {
  if (soloGuion) return <EditorGuion />;
  return <Reglas />;
}

function Prueba({ pr }: { pr: any }) {
  if (!pr) return <div className="rg-suave">Sin probar. La prueba regenera hasta 24 casos reales con y sin la regla y un juez los califica (≈1 min).</div>;
  const mal = pr.delta !== null && pr.delta < 0;
  return (
    <div className={'rg-prueba' + (mal ? ' mal' : pr.delta > 0 ? ' bien' : '')}>
      <b>{pr.con}</b> con la regla vs <b>{pr.sin}</b> sin ella · {pr.n} casos · mejora en {pr.mejora_en}, empeora en {pr.empeora_en}
      <div>La respuesta <b>viola</b> la regla en {pr.viola_con} de {pr.n} casos con ella (sin ella: {pr.viola_sin}){mal ? ' · EMPEORA: no se activa sin confirmar' : ''}</div>
      <details><summary>Ver casos</summary>{(pr.casos || []).filter((c: any) => !c.error).slice(0, 12).map((c: any) => <div key={c.id} className="rg-caso"><div><i>Lead:</i> {c.lead}</div><div><i>Sin ({c.sin}{c.viola_sin ? ' · viola' : ''}):</i> {c.resp_sin}</div><div><i>Con ({c.con}{c.viola_con ? ' · viola' : ''}):</i> {c.resp_con}</div></div>)}</details>
    </div>
  );
}

function Reglas() {
  const [d, setD] = useState<any>(null);
  const [texto, setTexto] = useState(''); const [etapa, setEtapa] = useState('');
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const cargar = () => fetch('/api/crm/ti/reglas').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  const aviso = (t: string, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 5000); };
  const act = async (accion: string, id: string | null, extra: any = {}) => {
    setOcupado(id || accion);
    const r = await postJ('/api/crm/ti/reglas', { accion, id, ...extra });
    setOcupado(null);
    if (r.error) { if (r.empeora && window.confirm(r.error)) return act(accion, id, { ...extra, forzar: true }); aviso(r.error, false); return; }
    setD(r);
    aviso(accion === 'proponer' ? 'Propuesta guardada. Pruébala y actívala aquí mismo.' : accion === 'probar' ? `Probada en ${r.prueba?.n} casos: ${r.prueba?.con} con la regla vs ${r.prueba?.sin} sin.` : accion === 'aprobar' ? 'Regla activa: el agente la lee desde su siguiente respuesta.' : accion === 'retirar' ? 'Regla retirada.' : 'Listo.');
    if (accion === 'proponer') { setTexto(''); setEtapa(''); }
  };
  if (!d) return <div className="ti-suave">Cargando…</div>;
  if (d.error) return <div className="ti-card">{d.error}</div>;
  return (
    <div className="rg">
      <style>{CSS}</style>
      {msg && <div className={'rg-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}
      <div className="ti-card rg-nueva">
        <div className="rg-lbl">Nueva regla · escríbela como se la dirías a una persona nueva del equipo</div>
        <textarea className="ti-campo rg-ta" rows={3} placeholder="Ejemplo: No ofrezcas agendar la demo hasta saber qué vende y cuántas tiendas tiene, y que él haya contado una o dos necesidades. Primero demuestra que lo entendiste en una línea; hasta entonces propones la demo." value={texto} onChange={e => setTexto(e.target.value)} />
        <div className="rg-fila">
          <select className="ti-campo" value={etapa} onChange={e => setEtapa(e.target.value)} style={{ maxWidth: 240 }}>{ETAPAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button className="ti-btn primario" disabled={!!ocupado || texto.trim().length < 12} onClick={() => act('proponer', null, { texto, etapa: etapa || null })}>{ocupado === 'proponer' ? 'Guardando…' : 'Proponer'}</button>
          <span className="rg-suave">Después: Probar → Aprobar y activar. Nada entra al agente sin pasar por aquí.</span>
        </div>
      </div>

      <div className="rg-sec">Propuestas por decidir · {d.propuestas.length}{d.sin_texto ? <span className="rg-suave"> · {d.sin_texto} del ciclo nocturno esperan redacción (se escriben solas en la noche)</span> : null}</div>
      {d.propuestas.length === 0 && <div className="ti-suave">Ninguna.</div>}
      {d.propuestas.map((r: any) => {
        const txt = edit[r.id] ?? r.texto;
        return (
          <div key={r.id} className="ti-card rg-item">
            <div className="rg-meta"><span className="rg-chip">{r.etapa || 'global'}</span><span className="rg-suave">{r.origen === 'patron' ? `${r.correcciones || 'varias'} correcciones o rechazos en 14 días` : 'escrita por una persona'} · {fecha(r.created_at)}</span></div>
            <textarea className="ti-campo rg-ta" rows={2} value={txt} onChange={e => setEdit({ ...edit, [r.id]: e.target.value })} onBlur={() => { if (txt !== r.texto) act('editar', r.id, { texto: txt }); }} />
            {r.evidencias?.length > 0 && <ul className="rg-ev">{r.evidencias.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>}
            <Prueba pr={r.prueba} />
            <div className="rg-fila">
              <button className="ti-btn" disabled={!!ocupado} onClick={() => act('probar', r.id)}>{ocupado === r.id ? 'Trabajando…' : r.prueba ? 'Volver a probar' : 'Probar'}</button>
              <button className="ti-btn primario" disabled={!!ocupado || txt.trim().length < 12} onClick={() => act('aprobar', r.id, { texto: txt })}>Aprobar y activar</button>
              <button className="ti-btn" disabled={!!ocupado} onClick={() => act('rechazar', r.id)}>Rechazar</button>
            </div>
          </div>
        );
      })}

      <div className="rg-sec">Vigentes · {d.activas.length} · entran al prompt en este orden</div>
      {d.activas.length === 0 && <div className="ti-suave">Todavía ninguna. El guion base sigue mandando.</div>}
      {d.activas.map((r: any) => (
        <div key={r.id} className="ti-card rg-item viva">
          <div className="rg-meta"><span className="rg-chip">{r.etapa || 'global'}</span><span className="rg-suave">desde {fecha(r.activa_desde)}{r.decidida_por_nombre ? ` · ${r.decidida_por_nombre}` : ''} · v{r.version}{r.prueba ? ` · prueba ${r.prueba.con} vs ${r.prueba.sin}` : ' · sin prueba'}</span></div>
          <div className="rg-texto">{r.texto}</div>
          <div className="rg-fila"><button className="ti-btn" disabled={!!ocupado} onClick={() => { if (window.confirm('¿Retirar esta regla? El agente deja de leerla desde su siguiente respuesta.')) act('retirar', r.id); }}>Retirar</button></div>
        </div>
      ))}
      {d.retiradas.length > 0 && <details className="rg-ret"><summary>Retiradas o rechazadas · {d.retiradas.length}</summary>{d.retiradas.map((r: any) => <div key={r.id} className="rg-suave" style={{ margin: '6px 0' }}>{r.texto || r.etapa} · {fecha(r.retirada_at)}</div>)}</details>}
    </div>
  );
}

function EditorGuion() {
  const [d, setD] = useState<any>(null);
  const [clave, setClave] = useState<'guion' | 'wiki' | 'limites'>('guion');
  const [texto, setTexto] = useState(''); const [nota, setNota] = useState(''); const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/ti/guion').then(r => r.json()).then(x => { setD(x); setTexto(x.textos?.[clave] || ''); }).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (d?.textos) setTexto(d.textos[clave] || ''); }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <div className="ti-suave">Cargando…</div>;
  if (d.error) return <div className="ti-card">{d.error}</div>;
  const cambiado = texto !== (d.textos?.[clave] || '');
  const guardar = async () => { const r = await postJ('/api/crm/ti/guion', { clave, texto, nota }); setMsg(r.error || `Guardado como versión ${r.version}. El agente lo lee en menos de un minuto.`); if (!r.error) { setNota(''); cargar(); } setTimeout(() => setMsg(''), 5000); };
  const restaurar = async (id: string) => { const r = await postJ('/api/crm/ti/guion', { accion: 'ver_version', id }); if (r.texto) setTexto(r.texto); };
  return (
    <div className="rg">
      <style>{CSS}</style>
      <div className="rg-fila" style={{ marginBottom: 10 }}>{(['guion', 'wiki', 'limites'] as const).map(k => <button key={k} className={'rg-tab' + (clave === k ? ' on' : '')} onClick={() => setClave(k)}>{k === 'guion' ? 'Guion' : k === 'wiki' ? 'Wiki comercial' : 'Límites'} <span>v{d.versiones_vigentes?.[k] || 0}</span></button>)}</div>
      <div className="rg-suave" style={{ marginBottom: 8 }}>Versión 0 = la que vive en el código. Cada guardado crea una versión nueva; la más reciente es la que lee el agente. Las reglas puntuales van mejor en Seguimiento → Reglas (se prueban solas); esto es para cambios de fondo.</div>
      <textarea className="ti-campo rg-ta mono" rows={26} value={texto} onChange={e => setTexto(e.target.value)} />
      <div className="rg-fila" style={{ marginTop: 8 }}>
        <input className="ti-campo" placeholder="Nota de la versión: qué cambiaste y por qué" value={nota} onChange={e => setNota(e.target.value)} style={{ flex: 1 }} />
        <button className="ti-btn primario" disabled={!cambiado || texto.trim().length < 200} onClick={guardar}>Guardar como nueva versión</button>
      </div>
      {msg && <div className="rg-msg ok" style={{ marginTop: 8 }}>{msg}</div>}
      <div className="rg-sec">Historial</div>
      {(d.historial || []).filter((h: any) => h.clave === clave).map((h: any) => <div key={h.id} className="rg-fila rg-suave" style={{ margin: '4px 0' }}><b>v{h.version}</b> · {fecha(h.created_at)}{h.por ? ` · ${h.por}` : ''} · {h.largo} caracteres{h.nota ? ` · ${h.nota}` : ''} <button className="rg-link" onClick={() => restaurar(h.id)}>cargar en el editor</button></div>)}
      {(d.historial || []).filter((h: any) => h.clave === clave).length === 0 && <div className="rg-suave">Solo la versión del código.</div>}
    </div>
  );
}

const CSS = `
.rg{display:grid;gap:12px;max-width:980px}
.rg-lbl{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8e88a8;margin-bottom:6px}
.rg-ta{width:100%;box-sizing:border-box;font-size:14px !important;line-height:1.5}.rg-ta.mono{font-family:ui-monospace,Menlo,monospace;font-size:12.5px !important}
.rg-fila{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
.rg-suave{font-size:12px;color:#8e88a8}
.rg-sec{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#6b6580;margin-top:6px}
.rg-item{padding:14px 16px}.rg-item.viva{border-left:4px solid #16a34a}
.rg-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.rg-chip{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5B4BD6;background:#EEECFE;border-radius:999px;padding:3px 8px}
.rg-texto{font-size:14px;line-height:1.5}
.rg-ev{margin:6px 0 0 18px;padding:0;font-size:12.5px;color:#4a4658}.rg-ev li{margin-bottom:3px}
.rg-prueba{margin-top:8px;font-size:12.5px;line-height:1.5;background:#faf9fc;border:1px solid #ecebf2;border-radius:10px;padding:8px 10px}.rg-prueba.bien{background:#e7f7ee;border-color:#bfe5cc}.rg-prueba.mal{background:#fde7e5;border-color:#f5c2be}
.rg-prueba details{margin-top:4px}.rg-prueba summary{cursor:pointer;font-weight:700}.rg-caso{margin-top:6px;padding-top:6px;border-top:1px dashed #e8e5f0}.rg-caso i{font-style:normal;color:#8e88a8}
.rg-msg{font-size:12.5px;font-weight:700;padding:6px 10px;border-radius:8px}.rg-msg.ok{background:#e7f7ee;color:#14532d}.rg-msg.err{background:#fde7e5;color:#b3261e}
.rg-tab{border:1px solid #e8e5f0;background:#fff;border-radius:999px;padding:6px 12px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit;color:#4a4658}.rg-tab.on{background:#241d43;border-color:#241d43;color:#fff}.rg-tab span{font-weight:600;opacity:.7;margin-left:4px}
.rg-link{border:none;background:none;color:#5B4BD6;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;padding:0}
.rg-ret summary{cursor:pointer;font-size:12px;color:#8e88a8}
`;
