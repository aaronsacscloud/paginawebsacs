/**
 * DECISIÓN SOBRE UNA SUGERENCIA DEL AGENTE (Seguimiento · paridad 9/10, decisión del dueño 2026-09-03).
 * La misma pieza vive en dos lugares: el panel Seguimiento (una tarjeta a la vez) y la compuerta del inbox
 * (encima del compositor, que no se puede usar hasta decidir). Tres salidas, nada más:
 *   Enviar (10) · Modificar → «Enviar con modificaciones» (según cuánto cambió) · Rechazar con razón (0).
 * Todo lo que el consultor hace aquí es calificación y lección para el redactor.
 */
import { useEffect, useState } from 'react';
import { SelectorAdjuntos, MiniRecurso, type AdjuntoSel, type Recurso } from '../../RecursosAgente';

export const CAMBIOS = ['Tono', 'Un dato estaba mal', 'No era el momento', 'Muy largo', 'El saludo', 'La pregunta', 'Agregué contexto suyo', 'Quité el pitch', 'Adjunto'];
export const MOTIVOS_RECHAZO = ['El tono no es el nuestro', 'Información incorrecta', 'No entendió lo que preguntó', 'No era el momento de mandar nada', 'Muy largo o muy vendedor', 'Este lead lo llevo yo', 'Otro'];
const ORIGEN_L: Record<string, string> = { respuesta: 'Respuesta a su mensaje', seguimiento: 'Seguimiento de 1 a 4 días', silencio: 'Toque por silencio', cotizacion: 'Seguimiento de cotización', preparacion: 'Preparación de la demo', cita: 'Seguimiento de la cita', reenganche: 'Reenganche', reactivacion: 'Reactivación' };
const partes = (t: string) => String(t || '').split(/\n[ \t]*-{3,}[ \t]*\n/).map(x => x.trim()).filter(Boolean);

export type Sugerencia = { id: string; contact_id?: string | null; mensaje: string; ventana_abierta?: boolean; plantilla?: any; plantillas?: any; nombre_lead?: string; adjuntos?: any[]; imagen_url?: string | null; origen?: string | null; ultimo_mensaje?: string | null; objetivo?: string | null; estado_guion?: string | null; created_at?: string };

export default function DecisionSugerencia({ sug, galeria, compacto, atajos, movil, onDecidido }: { sug: Sugerencia; galeria?: Recurso[]; compacto?: boolean; atajos?: boolean; movil?: boolean; onDecidido: (r: any) => void }) {
  const [modo, setModo] = useState<'ver' | 'modificar' | 'rechazar'>('ver');
  const [texto, setTexto] = useState(sug.mensaje);
  const [adj, setAdj] = useState<AdjuntoSel[]>(() => (Array.isArray(sug.adjuntos) ? sug.adjuntos : []).map((a: any) => ({ id: a.id, tipo: a.tipo || 'image', url: a.url, nombre: a.nombre || 'Adjunto' })));
  const [criterio, setCriterio] = useState('');
  const [siempre, setSiempre] = useState(false);
  const [cambios, setCambios] = useState<string[]>([]);
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [gal, setGal] = useState<Recurso[]>(galeria || []);
  const [familia, setFamilia] = useState<string>('');
  const [verPlantilla, setVerPlantilla] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setModo('ver'); setTexto(sug.mensaje); setAdj((Array.isArray(sug.adjuntos) ? sug.adjuntos : []).map((a: any) => ({ id: a.id, tipo: a.tipo || 'image', url: a.url, nombre: a.nombre || 'Adjunto' }))); setCriterio(''); setCambios([]); setMotivo(''); setDetalle(''); setErr(''); setFamilia(''); setVerPlantilla(false); }, [sug.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (galeria) setGal(galeria); }, [galeria]);
  useEffect(() => { if (modo === 'modificar' && !gal.length) fetch('/api/crm/ti/seguimiento').then(r => r.json()).then(d => setGal(d.galeria || [])).catch(() => {}); }, [modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const decidir = async (decision: 'enviar' | 'modificar' | 'rechazar') => {
    if (ocupado) return;
    if (decision === 'rechazar' && !motivo) { setErr('Elige por qué: eso es lo que aprende.'); return; }
    setOcupado(true); setErr('');
    const body: any = { accion: 'decidir', envio_id: sug.id, decision };
    if (decision === 'modificar') { body.mensaje = texto; body.adjuntos = adj; body.detalle = criterio; body.cambios = cambios; body.alcance = siempre && criterio.trim().length >= 12 ? 'siempre' : 'aqui'; }
    if (familia) body.familia = familia;
    if (decision === 'rechazar') { body.motivo = motivo; body.detalle = detalle; }
    const r = await fetch('/api/crm/ti/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false);
    if (r?.error) { setErr(r.error); return; }
    onDecidido(r);
  };
  useEffect(() => {
    if (!atajos) return;
    const h = (ev: KeyboardEvent) => { const tag = (ev.target as HTMLElement)?.tagName; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || ocupado || modo !== 'ver') return; if (ev.key === 'e') decidir('enviar'); if (ev.key === 'm') setModo('modificar'); if (ev.key === 'r') setModo('rechazar'); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // 46 px inline y no por CSS: la regla global del CRM móvil fija 36 px con !important y solo perdona a quien
  // declara su propio min-height en el atributo style (ver el comentario del «piso que funcionaba como techo»).
  const alto = movil ? { minHeight: 46 } : undefined;
  const cambiado = texto.trim() !== String(sug.mensaje || '').trim() || JSON.stringify(adj.map(a => a.url)) !== JSON.stringify((sug.adjuntos || []).map((a: any) => a.url));
  return (
    <div className={'ds' + (compacto ? ' compacto' : '')}>
      <style>{CSS}</style>
      <div className="ds-cab">
        <span className="ds-tag">{ORIGEN_L[sug.origen || ''] || 'Sugerencia del agente'}</span>
        {sug.estado_guion && <span className="ds-suave">· etapa {sug.estado_guion}</span>}
        {sug.objetivo && <span className="ds-suave" title={sug.objetivo}>· {sug.objetivo}</span>}
      </div>
      {sug.ultimo_mensaje && modo === 'ver' && compacto && <div className="ds-lead"><span>El lead:</span> «{sug.ultimo_mensaje}»</div>}
      {modo !== 'modificar' && (
        <div className="ds-burbujas">
          {partes(sug.mensaje).map((p, i) => <div key={i} className="ds-burbuja">{p}</div>)}
          {adj.length > 0 && <div className="ds-adj">{adj.map(a => <div key={a.id || a.url} className="ds-adj-i"><MiniRecurso r={a} size={44} /><span>{a.nombre}</span></div>)}</div>}
        </div>
      )}
      {sug.ventana_abierta === false && (() => {
        const pl = sug.plantillas;
        if (!pl?.recomendada) return <div className="ds-ventana">La ventana de 24 h está cerrada y no hay plantilla aprobada de Meta para este momento. No se puede enviar hasta que él escriba.</div>;
        const fam = familia || pl.familia;
        const grupo = (pl.opciones || []).find((x: any) => x.familia === fam) || null;
        const elegida = grupo?.marketing?.aprobada ? grupo.marketing : grupo?.utility?.aprobada ? grupo.utility : pl.recomendada;
        const resp = elegida?.categoria === 'MARKETING' && grupo?.utility?.aprobada ? grupo.utility : null;
        const previa = elegida?.cuerpo ? String(elegida.cuerpo).replace('{{1}}', String(sug.nombre_lead || 'Hola')).replace('{{2}}', elegida.categoria === 'MARKETING' ? (modo === 'modificar' ? texto : sug.mensaje) : String(elegida.vista_previa || '')) : '';
        return (
          <div className="ds-ventana">
            <div className="ds-v-cab">
              <b>La ventana de 24 h está cerrada</b>, así que WhatsApp solo acepta plantillas. Va a salir esta:
              <button className="ds-v-link" onClick={() => setVerPlantilla(v => !v)}>{verPlantilla ? 'ocultar' : 'ver cómo le llega'}</button>
            </div>
            <div className="ds-v-fila">
              <span className={'ds-v-tag ' + (elegida.categoria === 'MARKETING' ? 'mk' : 'ut')}>{elegida.categoria === 'MARKETING' ? 'Marketing · lleva tu texto completo' : 'Utilidad · línea neutra'}</span>
              <code>{elegida.nombre}</code>
              {(pl.opciones || []).length > 1 && (
                <select className="ds-v-sel" value={fam} onChange={e => setFamilia(e.target.value)}>
                  {(pl.opciones || []).map((x: any) => <option key={x.familia} value={x.familia}>{x.label}{x.marketing?.aprobada ? '' : ' (solo utilidad)'}</option>)}
                </select>
              )}
            </div>
            {verPlantilla && (
              <div className="ds-v-prev">
                <div className="ds-v-lbl">Así le llega</div>
                <div className="ds-v-burb">{elegida.categoria === 'MARKETING' ? previa : elegida.vista_previa}</div>
                {resp && <div className="ds-v-nota">Si Meta no la entrega en 10 minutos sale <code>{resp.nombre}</code> con una línea neutra, y tu mensaje completo le llega en cuanto conteste.</div>}
              </div>
            )}
            <div className="ds-v-esc">{elegida.categoria === 'MARKETING' ? `Sale con tu texto completo dentro de la plantilla.${resp ? ' Si Meta no la entrega en 10 min, cae a la de utilidad y el mensaje completo llega cuando conteste.' : ''}` : 'Sale una línea neutra para reabrir; tu mensaje completo le llega en cuanto conteste.'}</div>
          </div>
        );
      })()}
      {modo === 'ver' && (
        <div className="ds-acciones">
          <button className="ds-btn p" style={alto} disabled={ocupado} onClick={() => decidir('enviar')}>{ocupado ? 'Enviando…' : 'Enviar'}{atajos && <small>E</small>}</button>
          <button className="ds-btn" style={alto} disabled={ocupado} onClick={() => setModo('modificar')}>Modificar{atajos && <small>M</small>}</button>
          <button className="ds-btn" style={alto} disabled={ocupado} onClick={() => setModo('rechazar')}>Rechazar{atajos && <small>R</small>}</button>
        </div>
      )}
      {modo === 'modificar' && (
        <div className="ds-editor">
          <div className="ds-lbl">Tu versión: se manda tal cual y el agente aprende la diferencia</div>
          <textarea className="ds-ta" rows={compacto ? 5 : 6} value={texto} onChange={e => setTexto(e.target.value)} autoFocus />
          <div style={{ margin: '8px 0' }}><SelectorAdjuntos valor={adj} galeria={gal} onChange={setAdj} onNuevo={r => setGal(g => [r, ...g])} /></div>
          <div className="ds-lbl" style={{ marginTop: 8 }}>Qué cambiaste (para que aprenda por qué, no solo el texto)</div>
          <div className="ds-chips">{CAMBIOS.map(m => <button key={m} className={'ds-chip' + (cambios.includes(m) ? ' on' : '')} onClick={() => setCambios(x => x.includes(m) ? x.filter(y => y !== m) : [...x, m])}>{m}</button>)}</div>
          <input className="ds-in" placeholder="Qué debe considerar el agente la próxima vez (opcional, vale oro): «no repitas el precio si ya lo dio», «usa su nombre de tienda»…" value={criterio} onChange={e => setCriterio(e.target.value)} />
          {criterio.trim().length >= 12 && <label className="ds-lbl" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer' }}><input type="checkbox" checked={siempre} onChange={e => setSiempre(e.target.checked)} style={{ width: 18, height: 18, margin: 0 }} /> Aplica siempre: se vuelve regla, se prueba con y sin ella, y la apruebas en Reglas</label>}
          <div className="ds-acciones">
            <button className="ds-btn p" style={alto} disabled={ocupado || texto.trim().length < 2} onClick={() => decidir(cambiado ? 'modificar' : 'enviar')}>{ocupado ? 'Enviando…' : cambiado ? 'Enviar con modificaciones' : 'Enviar (sin cambios)'}</button>
            <button className="ds-btn ghost" style={alto} disabled={ocupado} onClick={() => { setModo('ver'); setTexto(sug.mensaje); }}>Volver</button>
          </div>
        </div>
      )}
      {modo === 'rechazar' && (
        <div className="ds-editor">
          <div className="ds-lbl">Por qué no: la razón es la lección (y luego contestas tú)</div>
          <div className="ds-chips">{MOTIVOS_RECHAZO.map(m => <button key={m} className={'ds-chip' + (motivo === m ? ' on' : '')} onClick={() => setMotivo(m)}>{m}</button>)}</div>
          <input className="ds-in" placeholder="Detalle (opcional): qué viste, qué faltó, qué sí hubiera funcionado" value={detalle} onChange={e => setDetalle(e.target.value)} />
          <div className="ds-acciones">
            <button className="ds-btn peligro" style={alto} disabled={ocupado || !motivo} onClick={() => decidir('rechazar')}>{ocupado ? 'Guardando…' : 'Rechazar y responder yo'}</button>
            <button className="ds-btn ghost" style={alto} disabled={ocupado} onClick={() => { setModo('ver'); setMotivo(''); setDetalle(''); }}>Volver</button>
          </div>
        </div>
      )}
      {err && <div className="ds-err">{err}</div>}
    </div>
  );
}

const CSS = `
.ds{font-family:inherit;color:#241d43}
.ds-cab{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;font-size:12px}
.ds-tag{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5B4BD6;background:#EEECFE;border-radius:999px;padding:3px 8px}
.ds-suave{color:#8e88a8;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-lead{font-size:12.5px;color:#4a4658;margin:0 0 8px;line-height:1.4}.ds-lead span{color:#8e88a8}
.ds-burbujas{display:grid;gap:6px}
.ds-burbuja{background:#e7f7ee;border-radius:12px 12px 12px 4px;padding:10px 12px;font-size:14px;line-height:1.5;white-space:pre-wrap;max-width:640px}
.ds.compacto .ds-burbuja{font-size:13.5px;padding:8px 10px}
.ds-adj{display:flex;gap:8px;flex-wrap:wrap}.ds-adj-i{display:flex;align-items:center;gap:6px;border:1px solid #e8e5f0;border-radius:10px;padding:4px 8px 4px 4px;font-size:12px;font-weight:700;background:#fff}
.ds-acciones{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.ds-btn{border:1px solid #e8e5f0;background:#fff;color:#241d43;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:10px}
.ds-btn.p{flex:1;justify-content:center;background:#5B4BD6;border-color:#5B4BD6;color:#fff;box-shadow:0 8px 20px rgba(91,75,214,.22)}
.ds-btn.peligro{background:#b3261e;border-color:#b3261e;color:#fff}.ds-btn.ghost{border-color:transparent;color:#8e88a8}
.ds-btn small{font-size:10px;font-weight:800;border:1px solid currentColor;border-radius:5px;padding:0 5px;opacity:.7}.ds-btn:disabled{opacity:.5;cursor:default}
.ds.compacto .ds-btn{padding:9px 12px;font-size:13px;border-radius:10px}
.ds-editor{margin-top:6px}.ds-lbl{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8e88a8;margin:6px 0}
.ds-ta,.ds-in{width:100%;box-sizing:border-box;border:1px solid #e8e5f0;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:14px;line-height:1.45;background:#fff;color:#241d43}
.ds-in{font-size:12.5px;padding:8px 10px;margin-top:4px}.ds-ta:focus,.ds-in:focus{outline:none;border-color:#5B4BD6;box-shadow:0 0 0 3px rgba(91,75,214,.12)}
.ds-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}.ds-chip{border:1px solid #e8e5f0;background:#fff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:#4a4658}.ds-chip.on{background:#241d43;border-color:#241d43;color:#fff}
.ds .ti-btn{border:1px solid #e8e5f0;background:#fff;color:#241d43;border-radius:10px;padding:7px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
.ds .ti-chip-btn{border:1px solid #e8e5f0;background:#fff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:#4a4658}.ds .ti-chip-btn.on{background:#241d43;border-color:#241d43;color:#fff}
.ds .ti-suave{color:#8e88a8;font-size:12px}.ds .ti-campo{border:1px solid #e8e5f0;border-radius:10px;padding:8px 10px;font-family:inherit;font-size:13px;width:100%;box-sizing:border-box}
.ds-ventana{margin-top:8px;font-size:12.5px;line-height:1.5;background:#fff4dc;color:#8a5a00;border-radius:10px;padding:10px 12px}
.ds-v-cab{margin-bottom:6px}.ds-v-link{border:none;background:none;color:#8a5a00;font-weight:800;text-decoration:underline;cursor:pointer;font-family:inherit;font-size:12px;margin-left:6px;padding:0}
.ds-v-fila{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ds-v-tag{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:3px 8px}.ds-v-tag.mk{background:#e7f7ee;color:#14532d}.ds-v-tag.ut{background:#ecebf2;color:#4a4658}
.ds-ventana code{font-size:11.5px;background:#fff;border-radius:5px;padding:1px 5px;color:#6b6580}
.ds-v-sel{border:1px solid #e6d5a8;border-radius:8px;padding:3px 6px;font-family:inherit;font-size:12px;font-weight:700;color:#8a5a00;background:#fff}
.ds-v-prev{margin-top:8px}.ds-v-lbl{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;opacity:.8;margin-bottom:4px}
.ds-v-burb{background:#fff;border-radius:10px 10px 10px 4px;padding:9px 11px;color:#241d43;font-size:13px;line-height:1.5;white-space:pre-wrap}
.ds-v-nota{margin-top:6px;font-size:11.5px;opacity:.9}
.ds-v-esc{margin-top:6px;font-size:11.5px;opacity:.9}
/* MÓVIL (4-sep): en el teléfono los tres botones no caben en una fila —«Rechazar» salía cortado— y 36 px de alto
   quedan por debajo del dedo. Se apilan: la acción principal ocupa el ancho y las otras dos se reparten abajo.
   Y la burbuja del mensaje se hace scrollable para que los botones nunca se pierdan fuera de la pantalla. */
@media (max-width:560px){
  .ds-acciones{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .ds-acciones .ds-btn{width:100%;justify-content:center;min-height:46px;font-size:14.5px;padding:12px 10px}
  .ds-acciones .ds-btn.p,.ds-acciones .ds-btn.peligro{grid-column:1 / -1}
  .ds-btn small{display:none}
  .ds-burbuja,.ds.compacto .ds-burbuja{max-height:34vh;overflow-y:auto;font-size:14px}
  .ds-ta{font-size:16px !important}      /* 16 px o iOS hace zoom al enfocar */
  .ds-in{font-size:15px}
  .ds-chip{padding:9px 12px;font-size:12.5px}
  .ds-cab{font-size:11.5px}
  .ds-v-fila{gap:6px}.ds-v-sel{flex:1 1 100%;min-height:38px}
  /* Al editar, la tarjeta crece y los botones se iban abajo del pliegue: se quedan pegados al fondo de la compuerta. */
  .ds.compacto .ds-editor .ds-acciones{position:sticky;bottom:0;background:#fbfaff;padding:8px 0 2px;margin-top:8px;box-shadow:0 -8px 12px -8px rgba(36,29,67,.18)}
  .ds.compacto .ds-ta{max-height:32vh}
  .ds-v-burb{max-height:26vh;overflow-y:auto}
}
.ds-err{margin-top:8px;font-size:12.5px;font-weight:700;color:#b3261e;background:#fde7e5;border-radius:8px;padding:6px 10px}
`;
