/**
 * TRABAJO INTELIGENTE · F1 — el panel una-tarea-a-la-vez.
 *
 * El spec es la maqueta v5 (artifact fb49f924) + PLAN-TRABAJO-INTELIGENTE.md.
 * Jerarquía fija de la tarjeta: la DECISIÓN → los 2-3 HECHOS que la deciden →
 * la ACCIÓN → el expediente PLEGADO. El vendedor nunca escanea una ficha.
 *
 * Vive en su propia página (/admin/trabajo), no como tab del CRM: la
 * experiencia ES pantalla completa, y así el dashboard (con trabajo activo de
 * otra sesión) no se toca. El enlace desde el CRM llega después.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import TrabajoEnvios from './TrabajoEnvios';
import TrabajoAprendizaje from './TrabajoAprendizaje';
import TrabajoCalificacion from './TrabajoCalificacion';
import TrabajoConsumo from './TrabajoConsumo';
import TrabajoRevision from './TrabajoRevision';
import TrabajoReactivacion from './TrabajoReactivacion';
import TorreControl from './TorreControl';
import TrabajoDatos from './TrabajoDatos';

type Tarea = {
  id: string; contact_id: string; familia: string; tipo: string; paso: string | null;
  prioridad: number; vence_at: string; atrasada: boolean; origen: string;
  lote_tipo: string | null; payload: any;
};

const MOTIVOS: [string, string, string][] = [
  ['ya_contactado', 'Ya lo contacté por otro lado', 'Se registra el toque y la cadencia avanza — no se repite lo que ya hiciste.'],
  ['mal_momento', 'No es buen momento para el lead', 'La cadencia descansa 3 días para este lead.'],
  ['dato_malo', 'El dato está equivocado (teléfono/correo)', 'Queda registrado; corrige el dato en la ficha del lead.'],
  ['duplicado', 'Es un duplicado', 'Únelo desde Contactos; esta tarea sale de la fila.'],
  ['no_aplica', 'Esta tarea no aplica a este tipo de lead', 'Esto entrena el plan: si se repite, el sistema propondrá cambiar la regla — y el dueño aprueba.'],
  ['otro', 'Otro motivo', 'Cuéntame abajo qué pasó.'],
];

const P_CHIP: Record<number, [string, string]> = {
  1: ['Respondió · urgente', 'p1'], 2: ['Lead con señal', 'p2'],
  3: ['Compromiso', 'p3'], 4: ['Cadencia del día', 'p4'], 5: ['Higiene', 'p4'],
};
const TIPO_L: Record<string, string> = {
  llamada: 'Llamada', wa_plantilla: 'WhatsApp · 1 clic', wa_libre: 'WhatsApp',
  correo: 'Correo', responder: 'WhatsApp', estafeta: 'Estafeta de la IA',
  veredicto: 'Veredicto propuesto', briefing: 'Briefing de la IA',
  compromiso: 'Llamada pactada', dato: 'Dato', acuerdo: 'Acuerdo de reunión',
};

function hechosDe(t: Tarea): any[] {
  const p = t.payload || {};
  if (Array.isArray(p.hechos) && p.hechos.length) return p.hechos;
  const h: any[] = [];
  if (p.reciclado) {
    h.push(['Por qué revive', 'Hubo señal', String(p.razon || '').slice(0, 80) || 'la auditoría la encontró', 'verde']);
    h.push(['Si no responde', 'Llamada en 2 días', 'la cadencia lo sigue sola']);
  } else if (t.paso) {
    if (p.dia_cadencia) h.push(['Día de cadencia', `${p.dia_cadencia} de 21`, t.paso]);
    if (p.llamada_n) h.push(['Intento', `${p.llamada_n} de 4`, p.tipo_llamada || 'llamada', p.llamada_n >= 3 ? 'ambar' : '']);
    if (t.tipo !== 'llamada') h.push(['Canal', TIPO_L[t.tipo] || t.tipo, t.tipo === 'correo' ? 'cambio de canal' : 'plantilla lista']);
  }
  if (t.atrasada) h.push(['Estado', 'Atrasada', 'se deslizó de un día anterior', 'ambar']);
  return h.slice(0, 3);
}

function porqueDe(t: Tarea): string {
  const p = t.payload || {};
  if (p.porque) return p.porque;
  if (p.reciclado) return p.razon || 'La auditoría encontró señal en su historial.';
  if (t.paso === 'T1') return 'Acaba de entrar y el WhatsApp automático ya salió. Llamar en los primeros 30 minutos multiplica el contacto.';
  if (t.tipo === 'wa_plantilla') return 'Las llamadas no lograron contacto — toca retomar por texto, sin presionar.';
  if (t.tipo === 'correo') return 'Varios toques sin respuesta: el correo cambia de canal antes del último intento.';
  if (t.origen === 'reparacion') return 'Se pactó con hora y no pasó. Reconocerlo convierte más que fingir que no pasó.';
  return '';
}

export default function TrabajoPanel() {
  const [plan, setPlan] = useState<{ tareas: Tarea[]; resumen: any } | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [resultadoSel, setResultadoSel] = useState('');
  const [nota, setNota] = useState('');
  const [texto, setTexto] = useState('');
  const [asunto, setAsunto] = useState('');
  const [valorDato, setValorDato] = useState('');
  const [errEnvio, setErrEnvio] = useState('');
  const [hojaOmitir, setHojaOmitir] = useState(false);
  const [hojaFila, setHojaFila] = useState(false);
  const [motivoSel, setMotivoSel] = useState('');
  const [motivoTexto, setMotivoTexto] = useState('');
  const [actualId, setActualId] = useState<string | null>(null);
  const [vistaTab, setVistaTab] = useState<'torre' | 'dia' | 'datos' | 'envios' | 'aprendizaje' | 'calificacion' | 'consumo' | 'revision' | 'reactivacion'>('torre');
  /* Tras un deploy, la página vieja pide chunks con hash nuevo y los botones dejan de responder en silencio
     (el dueño lo vivió: editó, adjuntó, aprobó… y nada). Si un chunk falla, la página se recarga sola. */
  useEffect(() => {
    const onErr = () => { try { location.reload(); } catch { /* nada */ } };
    window.addEventListener('vite:preloadError', onErr);
    return () => window.removeEventListener('vite:preloadError', onErr);
  }, []);
  const [motivoLead, setMotivoLead] = useState(''); const [textoLead, setTextoLead] = useState(''); const [fechaPausa, setFechaPausa] = useState('');
  const [avisoP1, setAvisoP1] = useState('');
  const tareaRef = useRef<string | null>(null);
  const p1Vistos = useRef<Set<string>>(new Set());

  const cargar = () => fetch('/api/crm/ti/plan').then(r => r.json())
    .then(j => {
      if (j.error) { setError(j.error); return; }
      // El aviso P1: si llegó una urgencia NUEVA mientras trabajas, se anuncia
      // sin robarte la tarjeta — será la siguiente.
      const p1s = (j.tareas || []).filter((x: Tarea) => x.prioridad === 1);
      for (const x of p1s) {
        if (!p1Vistos.current.has(x.id) && p1Vistos.current.size > 0) {
          setAvisoP1(`${x.payload?.nombre || 'Un lead'} necesita respuesta — es tu siguiente tarea`);
          setTimeout(() => setAvisoP1(''), 6000);
        }
      }
      p1Vistos.current = new Set(p1s.map((x: Tarea) => x.id));
      setPlan(j);
    })
    .catch(() => setError('No se pudo cargar el plan'));
  useEffect(() => { cargar(); }, []);
  // El observador del lado del panel: refresco cada 45 s y al volver a la
  // pestaña — con el panel abierto, un P1 aparece en segundos.
  useEffect(() => {
    const int = setInterval(cargar, 45_000);
    const foco = () => cargar();
    window.addEventListener('focus', foco);
    return () => { clearInterval(int); window.removeEventListener('focus', foco); };
  }, []);

  /* La tarjeta que estás viendo NUNCA se te quita de las manos: el reorden es
     ENTRE tareas. La actual queda fijada hasta que TÚ la termines. */
  const todas = plan?.tareas || [];
  /* El lote de datos (higiene P5) vive en su pestaña — el valle del día.
     Las deudas bloqueantes/comerciales (P3/P4) siguen en la fila normal. */
  // Datos = TODA tarea de dato (incluida la cadena de la reunión, que va agrupada en «Reunión y cotización»).
  const datos = todas.filter(x => x.tipo === 'dato');
  // El plan del día: llamadas, veredictos y la cadena de la reunión (datos de prioridad ≤ 3, salvo la minuta con IA,
  // que se captura en Datos). El WhatsApp libre ya no compite con el agente (decisión 2026-09-03).
  const tareas = todas.filter(x => x.tipo !== 'wa_libre' && (x.tipo !== 'dato' || (x.prioridad <= 3 && !x.payload?.minuta_ia)));
  const t = (actualId && tareas.find(x => x.id === actualId)) || tareas[0] || null;
  useEffect(() => { if (t && t.id !== actualId) setActualId(t.id); }, [t?.id]);
  // Al cambiar de tarjeta, los campos arrancan con lo suyo.
  useEffect(() => {
    if (!t || tareaRef.current === t.id) return;
    tareaRef.current = t.id;
    setResultadoSel(''); setNota(''); setErrEnvio(''); setValorDato('');
    setTexto(t.payload?.mensaje || '');
    setAsunto(t.payload?.asunto || '');
  }, [t?.id]);

  async function accion(cuerpo: any) {
    if (!t || guardando) return;
    setGuardando(true); setErrEnvio('');
    const r = await fetch('/api/crm/ti/tarea', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, ...cuerpo }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setGuardando(false);
    if (r?.error) { setErrEnvio(r.error); return false; }
    setActualId(null);
    await cargar();
    return true;
  }

  /** Enviar por el canal real y, si salió, marcar hecha. Si el canal falla
   *  (ventana de 24 h cerrada, número demo), se dice la verdad y se ofrece
   *  el inbox o marcarla hecha de todos modos. */
  async function enviarWa() {
    if (!t || guardando) return;
    setGuardando(true); setErrEnvio('');
    const r = await fetch('/api/crm/whatsapp/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: t.payload?.whatsapp, texto }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo enviar' }));
    setGuardando(false);
    if (r?.error) { setErrEnvio(`No salió por WhatsApp: ${r.error}`); return; }
    await accion({ accion: 'hecha', detalle: { canal: 'whatsapp', enviado: texto } });
  }
  async function enviarCorreo() {
    if (!t || guardando) return;
    setGuardando(true); setErrEnvio('');
    const r = await fetch('/api/crm/whatsapp/enviar-correo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: t.contact_id, para: t.payload?.email, asunto, texto }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo enviar' }));
    setGuardando(false);
    if (r?.error) { setErrEnvio(`No salió el correo: ${r.error}`); return; }
    await accion({ accion: 'hecha', detalle: { canal: 'correo', asunto, enviado: texto } });
  }

  const linkInbox = t ? `/admin/crm?tab=whatsapp&wa_search=${encodeURIComponent(String(t.payload?.whatsapp || '').replace(/\D/g, ''))}` : '#';

  /** El lote de datos: confirmar escribe al CRM (allow-list del registro). */
  async function datoListo(x: Tarea, valor: any) {
    if (guardando) return;
    setGuardando(true); setErrEnvio('');
    const r = await fetch('/api/crm/ti/tarea', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: x.id, accion: 'hecha', detalle: { campo: x.payload?.campo || x.payload?.campo_clave, valor } }),
    }).then(y => y.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setGuardando(false);
    if (r?.error) { setErrEnvio(r.error); return; }
    setValorDato('');
    await cargar();
  }

  function zonaAccion() {
    if (!t) return null;
    const p = t.payload || {};
    const RES: Record<string, string> = p.resultados || {};

    if (t.tipo === 'llamada' || t.tipo === 'compromiso') return (<>
      {p.tipo_llamada && <div className="ti-tipollamada">
        <span className="ti-chip chip-p2" style={{ textTransform: 'none', letterSpacing: 0 }}>{p.tipo_llamada}</span>
      </div>}
      <div className="ti-botones">
        <a className="ti-btn prim" href={`tel:${String(p.whatsapp || '').replace(/[^\d+]/g, '')}`}>{icoTel} Llamar</a>
        <a className="ti-btn sec" href={linkInbox}>{icoChat} Ver WhatsApp</a>
      </div>
      <div className="ti-notita">La llamada sale de tu teléfono por ahora — el click-to-call de Twilio llega en F4. El resultado sí es obligatorio: de eso depende la siguiente tarea.</div>
      <div className="ti-resultado">
        <div className="ti-res-tt">¿Cómo salió?</div>
        <div className="ti-res-chips">
          {Object.entries(RES).map(([k, l]) => (
            <button key={k} className={'ti-res-chip' + (resultadoSel === k ? ' on' : '')} onClick={() => setResultadoSel(k)}>{l}</button>
          ))}
        </div>
        <input className="ti-campo" placeholder="Nota rápida (opcional)" value={nota} onChange={e => setNota(e.target.value)} />
        <div className="ti-botones">
          <button className="ti-btn prim" disabled={guardando} onClick={() => {
            if (!resultadoSel) { setErrEnvio('Elige cómo salió la llamada — de eso depende qué sigue.'); return; }
            accion({ accion: 'hecha', resultado: resultadoSel, detalle: nota ? { nota } : null });
          }}>Guardar resultado y seguir</button>
        </div>
      </div>
    </>);

    if (['wa_libre', 'wa_plantilla', 'responder', 'estafeta'].includes(t.tipo)) return (<>
      {Array.isArray(p.charla) && p.charla.map(([quien, msj, hora]: any, i: number) => quien === 'ia'
        ? <div key={i} className="ti-burbuja ia"><div className="ti-b-quien">Respondió la IA por ti</div>{msj}<div className="ti-b-hora">{hora}</div></div>
        : <div key={i} className="ti-burbuja in">{msj}<div className="ti-b-hora">{hora}</div></div>)}
      {p.entrante && <div className="ti-burbuja in">{p.entrante}<div className="ti-b-hora">mensaje del lead</div></div>}
      <div className="ti-campo-l">{t.tipo === 'wa_plantilla' ? 'Plantilla lista — envía tal cual o edítala' : 'Tu mensaje — la IA dejó el borrador'}</div>
      <textarea className="ti-editor" value={texto} onChange={e => setTexto(e.target.value)} />
      <div className="ti-botones">
        <button className="ti-btn prim" disabled={guardando || !texto.trim()} onClick={enviarWa}>{icoEnviar} Enviar por WhatsApp</button>
        <a className="ti-btn sec" href={linkInbox}>{icoChat} Abrir el inbox</a>
      </div>
      {errEnvio && <div className="ti-botones" style={{ marginTop: 8 }}>
        <button className="ti-pie-txt" onClick={() => accion({ accion: 'hecha', detalle: { canal: 'otro', nota: 'marcada hecha tras fallo de envío' } })}>Lo mandé por otro lado — marcar hecha</button>
      </div>}
      {p.falta && <div className="ti-falta">{p.falta}</div>}
    </>);

    if (t.tipo === 'correo') return (<>
      <div className="ti-campo-l">Asunto</div>
      <input className="ti-campo" value={asunto} onChange={e => setAsunto(e.target.value)} />
      <div className="ti-campo-l">Cuerpo — hazlo tuyo antes de enviar</div>
      <textarea className="ti-editor" style={{ minHeight: 170 }} value={texto} onChange={e => setTexto(e.target.value)} />
      <div className="ti-botones">
        <button className="ti-btn prim" disabled={guardando || !texto.trim() || !asunto.trim()} onClick={enviarCorreo}>{icoEnviar} Enviar correo</button>
      </div>
    </>);

    if (t.tipo === 'veredicto') return (<>
      <div className="ti-burbuja sug">
        <div className="ti-b-eti">La propuesta de la IA, con su evidencia</div>
        {(p.evidencia || []).map((e: string, i: number) => <div key={i} className="ti-evid">· {e}</div>)}
      </div>
      {p.reloj === 'silencio_agente' && (
        <div className="ti-veredicto-extra">
          <label className="ti-lbl">Si no era lead, ¿por qué? (el agente aprende de esto)</label>
          <select className="ti-input" value={motivoLead} onChange={e => setMotivoLead(e.target.value)}>
            <option value="">— motivo —</option>
            {Object.entries(p.motivos_no_era_lead || {}).map(([k, l]: any) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="ti-input" placeholder="Detalle (opcional): qué lo delató, para que no vuelva a pasar" value={textoLead} onChange={e => setTextoLead(e.target.value)} />
          <label className="ti-lbl">Si lo pausas, ¿hasta cuándo?</label>
          <input className="ti-input" type="date" value={fechaPausa} onChange={e => setFechaPausa(e.target.value)} />
        </div>
      )}
      <div className="ti-botones" style={{ flexDirection: 'column' }}>
        {Object.entries(RES).map(([k, l], i) => (
          <button key={k} className={'ti-btn ' + (i === 0 ? 'prim' : 'sec')} disabled={guardando || (k === 'no_era_lead' && !motivoLead) || (k === 'pausar' && !fechaPausa)}
            onClick={() => accion({ accion: 'hecha', resultado: k, detalle: k === 'no_era_lead' ? { motivo: motivoLead, texto: textoLead } : k === 'pausar' ? { hasta: fechaPausa } : undefined })}>{l}</button>
        ))}
      </div>
      <div className="ti-notita">Decidas lo que decidas, queda con tu firma y alimenta el aprendizaje.</div>
    </>);

    if (t.tipo === 'briefing') return (<>
      {(p.brief || []).map(([tt, cu]: any, i: number) => (
        <div key={i} style={{ marginBottom: 13 }}>
          <div className="ti-campo-l" style={{ margin: '0 0 3px' }}>{tt}</div>
          <div className="ti-brief-txt">{cu}</div>
        </div>
      ))}
      <div className="ti-botones">
        <button className="ti-btn prim" disabled={guardando} onClick={() => accion({ accion: 'hecha' })}>Listo — a la demo</button>
      </div>
    </>);

    if (t.tipo === 'dato') return (<>
      {p.fuente && <div className="ti-burbuja sug"><div className="ti-b-eti">Sugerencia de la IA · {p.fuente}</div><b>{p.campo}:</b> {p.valor}</div>}
      {Array.isArray(p.opciones)
        ? <div className="ti-res-chips" style={{ marginTop: 10 }}>
            {p.opciones.map((o: string) => (
              <button key={o} className={'ti-res-chip' + (valorDato === o ? ' on' : '')} onClick={() => setValorDato(o)}>{o}</button>
            ))}
          </div>
        : !p.fuente && <input className="ti-campo" style={{ marginTop: 10 }} placeholder={p.input || p.campo} value={valorDato} onChange={e => setValorDato(e.target.value)} />}
      <div className="ti-botones">
        <button className="ti-btn prim" disabled={guardando} onClick={() =>
          accion({ accion: 'hecha', detalle: { campo: p.campo, valor: valorDato || p.valor || null } })
        }>{p.fuente ? 'Confirmar y guardar' : 'Guardar'}</button>
      </div>
    </>);

    // Cualquier tipo que no conozco todavía: se puede cerrar sin romperse.
    return <div className="ti-botones"><button className="ti-btn prim" disabled={guardando} onClick={() => accion({ accion: 'hecha' })}>Hecha</button></div>;
  }

  const hechos = t ? hechosDe(t) : [];
  const porque = t ? porqueDe(t) : '';

  return (
    <div className="ti-raiz">
      <style>{CSS}</style>
      {avisoP1 && (
        <div className="ti-p1aviso" role="status"><i />{avisoP1}. Termina esta con calma.</div>
      )}
      <div className="ti-barra">
        <div className="ti-barra-fila">
          <span className="ti-tt">Trabajo inteligente</span>
          <span className="ti-num">{plan ? (tareas.length ? `Tarea 1 de ${tareas.length}` : 'Día terminado') : 'Cargando…'}</span>
          {!!plan?.resumen?.hechas_hoy && <span className="ti-badge verde">{plan.resumen.hechas_hoy} hechas hoy</span>}
          {!!plan?.resumen?.atrasadas && <span className="ti-badge ambar">{plan.resumen.atrasadas} atrasadas</span>}
          <button className="ti-verfila" onClick={() => setHojaFila(true)}>Ver fila</button>
          {t?.contact_id && <button className="ti-verfila" title="El agente deja de escribirle a este lead; lo que iba a salir se detiene" onClick={async () => { if (!confirm('¿Silenciar la IA con este lead? Lo que iba a salir se detiene y el agente ya no le escribe.')) return; await fetch('/api/crm/ti/silenciar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: t.contact_id, silenciar: true }) }); setAvisoP1('IA silenciada para este lead'); setTimeout(() => setAvisoP1(''), 4000); }}>Silenciar IA</button>}
        </div>
        <div className="ti-prog"><div style={{ width: plan && (plan.resumen.hechas_hoy + tareas.length) > 0 ? `${Math.round(100 * plan.resumen.hechas_hoy / (plan.resumen.hechas_hoy + tareas.length))}%` : '2%' }} /></div>
        <div className="ti-tabs">
          <button className={'ti-tab' + (vistaTab === 'torre' ? ' on' : '')} onClick={() => setVistaTab('torre')}>Torre</button>
          <button className={'ti-tab' + (vistaTab === 'dia' ? ' on' : '')} onClick={() => setVistaTab('dia')}>El día</button>
          <button className={'ti-tab' + (vistaTab === 'datos' ? ' on' : '')} onClick={() => setVistaTab('datos')}>
            Datos {datos.length > 0 && <span className="ti-tab-n">{datos.length}</span>}
          </button>
          <button className={'ti-tab' + (vistaTab === 'envios' ? ' on' : '')} onClick={() => setVistaTab('envios')}>Próximos envíos</button>
          <button className={'ti-tab' + (vistaTab === 'aprendizaje' ? ' on' : '')} onClick={() => setVistaTab('aprendizaje')}>Aprendizaje</button>
          <button className={'ti-tab' + (vistaTab === 'calificacion' ? ' on' : '')} onClick={() => setVistaTab('calificacion')}>Calificación</button>
          <button className={'ti-tab' + (vistaTab === 'revision' ? ' on' : '')} onClick={() => setVistaTab('revision')}>Revisión diaria</button>
          <button className={'ti-tab' + (vistaTab === 'reactivacion' ? ' on' : '')} onClick={() => setVistaTab('reactivacion')}>Reactivación</button>
          <button className={'ti-tab' + (vistaTab === 'consumo' ? ' on' : '')} onClick={() => setVistaTab('consumo')}>Consumo</button>
        </div>
      </div>

      {vistaTab === 'envios' && <TrabajoEnvios onIrAprendizaje={() => setVistaTab('aprendizaje')} />}
      {vistaTab === 'aprendizaje' && <TrabajoAprendizaje />}
      {vistaTab === 'calificacion' && <TrabajoCalificacion />}
      {vistaTab === 'consumo' && <TrabajoConsumo />}
      {vistaTab === 'revision' && <TrabajoRevision />}
      {vistaTab === 'reactivacion' && <TrabajoReactivacion />}
      {vistaTab === 'torre' && <div className="ti-lienzo" style={{ maxWidth: 1400 }}><TorreControl irA={(t) => setVistaTab(t as any)} /></div>}

      {vistaTab === 'datos' && (
        <div className="ti-lienzo" style={{ maxWidth: 980 }}>
          <TrabajoDatos datos={datos} guardando={guardando} error={errEnvio} onRecargar={cargar}
            onGuardar={async (x, valor) => { await datoListo(x as any, valor); return true; }}
            onPosponer={async (x) => { await fetch('/api/crm/ti/tarea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x.id, accion: 'posponer', horas: 24 }) }); cargar(); }} />
        </div>
      )}

      <div className="ti-lienzo" style={vistaTab !== 'dia' ? { display: 'none' } : undefined}>
        {error && <div className="ti-error">{error}</div>}
        {!plan && !error && <div className="ti-cargando">Cargando tu plan…</div>}

        {plan && !t && (
          <div className="ti-carta"><div className="ti-fin">
            <h2>Terminaste el plan de hoy</h2>
            <p>{plan.resumen.hechas_hoy ? `${plan.resumen.hechas_hoy} tareas hechas.` : 'No había nada pendiente.'} Mañana el plan se arma solo — y si alguien responde antes, aquí aparece.</p>
          </div></div>
        )}

        {t && (
          <div className="ti-carta" key={t.id}>
            <div className="ti-cab">
              <div className="ti-chips">
                <span className={`ti-chip chip-${P_CHIP[t.prioridad]?.[1] || 'p4'}`}>{t.prioridad === 1 && <i />}{P_CHIP[t.prioridad]?.[0]}</span>
                <span className="ti-chip chip-tipo">{TIPO_L[t.tipo] || t.tipo}</span>
                {t.atrasada && <span className="ti-chip chip-sla">atrasada</span>}
              </div>
              <div className="ti-inst">{t.payload?.instruccion || 'Tarea'}</div>
              {porque && <div className="ti-porque">{porque}</div>}
            </div>
            {hechos.length > 0 && (
              <div className="ti-hechos">
                {hechos.map(([l, v, s, tono]: any, i: number) => (
                  <div className="ti-hecho" key={i}>
                    <div className="hl">{l}</div>
                    <div className={`hv ${tono || ''}`}>{v}</div>
                    {s && <div className="hs">{s}</div>}
                  </div>
                ))}
              </div>
            )}
            <div className="ti-accion">
              {zonaAccion()}
              {errEnvio && <div className="ti-error" style={{ marginTop: 12 }}>{errEnvio}</div>}
            </div>
            <details className="ti-mas">
              <summary>{icoFlecha} Historial y contexto</summary>
              <div className="ti-mas-cuerpo">
                <div className="ti-ctx">
                  {t.payload?.nombre && <div><div className="cl">Contacto</div><div className="cv">{t.payload.nombre}</div></div>}
                  {t.payload?.whatsapp && <div><div className="cl">WhatsApp</div><div className="cv">{t.payload.whatsapp}</div></div>}
                  {t.payload?.email && <div><div className="cl">Correo</div><div className="cv">{t.payload.email}</div></div>}
                  <div><div className="cl">Origen</div><div className="cv">{t.origen}{t.paso ? ` · ${t.paso}` : ''}</div></div>
                </div>
                {t.payload?.razon && <div className="ti-toques"><b>Lo que sabe el sistema:</b> {t.payload.razon}</div>}
                <a className="ti-pie-txt" style={{ display: 'inline-block', marginTop: 8 }} href={linkInbox}>Ver toda la conversación en el inbox ›</a>
              </div>
            </details>
            <div className="ti-pie">
              <button className="ti-pie-txt" onClick={() => { setMotivoSel(''); setMotivoTexto(''); setHojaOmitir(true); }}>Omitir…</button>
              <button className="ti-pie-txt" disabled={guardando} onClick={() => accion({ accion: 'posponer', horas: 2 })}>Posponer 2 h</button>
            </div>
          </div>
        )}

        {t && (() => { const sig = tareas.find(x => x.id !== t.id); return sig
          ? <div className="ti-sigue">Sigue: <b>{sig.payload?.instruccion}</b></div> : null; })()}
      </div>

      {/* ── La fila, solo lectura ── */}
      {hojaFila && <>
        <div className="ti-velo" onClick={() => setHojaFila(false)} />
        <div className="ti-hoja" role="dialog" aria-modal="true">
          <div className="ti-agarra" />
          <div className="ti-hoja-tt">La fila de hoy</div>
          <div className="ti-hoja-sub">Solo lectura: el orden lo defiende el sistema — si algo cambia allá afuera, se reacomoda sola.</div>
          <div style={{ marginTop: 12, maxHeight: '52dvh', overflowY: 'auto' }}>
            {tareas.map((x) => (
              <div key={x.id} className="ti-fila-item" style={x.id === t?.id ? { fontWeight: 700 } : undefined}>
                <span className={`ti-chip chico chip-${P_CHIP[x.prioridad]?.[1] || 'p4'}`}>{x.prioridad === 1 && <i />}P{x.prioridad}</span>
                <span className="ti-fila-txt">{x.payload?.instruccion}</span>
                {x.id === t?.id && <span className="ti-ahora">AHORA</span>}
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* ── Omitir ── */}
      {hojaOmitir && <>
        <div className="ti-velo" onClick={() => setHojaOmitir(false)} />
        <div className="ti-hoja" role="dialog" aria-modal="true">
          <div className="ti-agarra" />
          <div className="ti-hoja-tt">¿Por qué la omites?</div>
          <div className="ti-hoja-sub">El motivo ajusta este lead de inmediato y entrena el plan.</div>
          <div className="ti-motivos">
            {MOTIVOS.map(([k, l]) => (
              <button key={k} className={'ti-motivo' + (motivoSel === k ? ' on' : '')} onClick={() => setMotivoSel(k)}><i />{l}</button>
            ))}
          </div>
          {motivoSel && <div className="ti-hoja-nota">{MOTIVOS.find(m => m[0] === motivoSel)?.[2]}</div>}
          <input className="ti-campo" style={{ marginTop: 10 }} placeholder="Algo más que deba saber (opcional)" value={motivoTexto} onChange={e => setMotivoTexto(e.target.value)} />
          <div className="ti-botones" style={{ marginTop: 14 }}>
            <button className="ti-btn sec" style={{ flex: 1 }} onClick={() => setHojaOmitir(false)}>Cancelar</button>
            <button className="ti-btn prim" style={{ flex: 1.4 }} disabled={guardando} onClick={async () => {
              if (!motivoSel) return;
              const ok = await accion({ accion: 'omitir', motivo: motivoSel, texto: motivoTexto || null });
              if (ok) setHojaOmitir(false);
            }}>Omitir la tarea</button>
          </div>
        </div>
      </>}
    </div>
  );
}

/* ── Iconos (trazo, sin emoji: estándar del CRM) ── */
const icoTel = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const icoChat = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
const icoEnviar = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const icoFlecha = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>;

/* ── El CSS de la maqueta v5, con tokens y ambos temas ── */
const CSS = `
.ti-raiz { --fondo:#f6f5f9; --carta:#fff; --tinta:#241d43; --texto:#4a4756; --suave:#71707C;
  --tenue:#a5a2af; --linea:#ececec; --linea2:#f0eef7; --morado:#9B8CFA; --morado-tinta:#5B4BD6;
  --morado-hondo:#4536BE; --morado-agua:#EEECFE; --verde-t:#1E8A63; --verde-a:#EAF8F2;
  --rojo-t:#C0554E; --rojo-a:#FEF0EF; --ambar-t:#9a6a10; --ambar-a:#FFF4E5;
  --azul-t:#2C5FC4; --azul-a:#E3EDFD; --neutro:#f2f2f5; --burbuja-in:#f2f2f5;
  --sombra:0 1px 3px rgba(16,24,40,.08),0 8px 28px rgba(16,24,40,.07);
  min-height:100dvh; background:var(--fondo); color:var(--texto); overflow-x:clip;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; }
@media (prefers-color-scheme: dark) { .ti-raiz { --fondo:#131318; --carta:#1d1d24; --tinta:#F2F1F7;
  --texto:#d7d5de; --suave:#9b98a6; --tenue:#7e7b89; --linea:#26262e; --linea2:#232329;
  --morado-tinta:#A78BFA; --morado-hondo:#8E7DEF; --morado-agua:#2a2440; --verde-t:#4FBF95;
  --verde-a:#14312a; --rojo-t:#EF7A72; --rojo-a:#3a201e; --ambar-t:#E8B04B; --ambar-a:#33280f;
  --azul-t:#7DA6F5; --azul-a:#1b2740; --neutro:#232329; --burbuja-in:#26262e;
  --sombra:0 1px 3px rgba(0,0,0,.4),0 8px 28px rgba(0,0,0,.35); } }
.ti-raiz button, .ti-raiz input, .ti-raiz textarea { font-family:inherit; }
.ti-barra { position:sticky; top:0; z-index:50; background:var(--carta); border-bottom:1px solid var(--linea); padding:12px 18px 10px; }
.ti-barra-fila { display:flex; align-items:baseline; gap:9px; max-width:760px; margin:0 auto; }
.ti-tt { font-size:.95rem; font-weight:800; color:var(--tinta); letter-spacing:-.01em; white-space:nowrap; }
.ti-num { font-size:.8rem; color:var(--suave); font-variant-numeric:tabular-nums; white-space:nowrap; }
.ti-badge { font-size:.7rem; font-weight:800; border-radius:20px; padding:3px 9px; white-space:nowrap; margin-left:auto; }
.ti-badge.verde { color:var(--verde-t); background:var(--verde-a); }
.ti-badge.ambar { color:var(--ambar-t); background:var(--ambar-a); margin-left:0; }
.ti-badge.verde + .ti-badge.ambar { margin-left:0; }
.ti-verfila { border:none; background:none; font-size:.78rem; font-weight:700; color:var(--morado-tinta); cursor:pointer; white-space:nowrap; padding:2px 0; }
.ti-barra-fila:not(:has(.ti-badge)) .ti-verfila { margin-left:auto; }
.ti-tabs { display:flex; gap:4px; max-width:760px; margin:9px auto -10px; }
.ti-veredicto-extra { display:grid; gap:6px; margin:10px 0; }
.ti-lbl { font-size:.74rem; font-weight:700; color:var(--suave); text-transform:uppercase; letter-spacing:.04em; }
.ti-input { width:100%; padding:8px 10px; border:1px solid var(--linea, #e5e7eb); border-radius:9px; font:inherit; font-size:.88rem; background:var(--carta, #fff); color:inherit; }
.ti-tab { border:none; background:none; padding:8px 13px; border-radius:9px 9px 0 0; font-size:.8rem; font-weight:700;
  color:var(--suave); border-bottom:2px solid transparent; cursor:pointer; display:inline-flex; gap:6px; align-items:center; }
.ti-tab.on { background:var(--morado-agua); color:var(--morado-tinta); font-weight:800; border-bottom-color:var(--morado); }
.ti-tab-n { background:var(--neutro); color:var(--suave); border-radius:20px; font-size:.68rem; padding:1px 7px; font-weight:800; }
.ti-tab.on .ti-tab-n { background:var(--carta); color:var(--morado-tinta); }
.ti-prog { max-width:760px; margin:9px auto 0; height:5px; border-radius:99px; background:var(--neutro); overflow:hidden; }
.ti-prog > div { height:100%; border-radius:99px; background:var(--morado); transition:width .5s ease; }
.ti-lienzo { max-width:760px; margin:0 auto; padding:18px 14px 90px; }
.ti-carta { background:var(--carta); border:1px solid var(--linea); border-radius:18px; box-shadow:var(--sombra); overflow:hidden; animation:tientra .28s ease; }
@keyframes tientra { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .ti-carta { animation:none; } }
.ti-cab { padding:20px 22px 0; }
.ti-chips { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ti-chip { font-size:.68rem; font-weight:800; letter-spacing:.05em; text-transform:uppercase; border-radius:20px; padding:4px 11px; display:inline-flex; align-items:center; gap:6px; }
.ti-chip.chico { font-size:.62rem; padding:2px 8px; flex:none; }
.ti-chip i { width:7px; height:7px; border-radius:50%; background:var(--morado); display:inline-block; animation:tilate 1.2s ease-in-out infinite; }
@keyframes tilate { 0%,100% { box-shadow:0 0 0 0 rgba(155,140,250,.55); } 50% { box-shadow:0 0 0 6px rgba(155,140,250,0); } }
.chip-p1 { background:var(--tinta); color:var(--fondo); }
.chip-p2 { background:var(--morado-agua); color:var(--morado-tinta); }
.chip-p3 { background:var(--azul-a); color:var(--azul-t); }
.chip-p4 { background:var(--neutro); color:var(--suave); }
.chip-tipo { background:none; border:1px solid var(--linea); color:var(--suave); }
.chip-sla { background:var(--ambar-a); color:var(--ambar-t); }
.ti-inst { font-size:1.35rem; font-weight:800; color:var(--tinta); letter-spacing:-.02em; line-height:1.25; margin:13px 0 6px; text-wrap:balance; }
.ti-porque { font-size:.85rem; color:var(--suave); line-height:1.5; }
.ti-hechos { display:flex; align-items:stretch; margin:15px 22px 0; }
.ti-hecho { flex:1; min-width:0; padding:2px 16px 2px 0; }
.ti-hecho + .ti-hecho { border-left:1px solid var(--linea2); padding-left:16px; }
.ti-hecho .hl { font-size:.62rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--tenue); }
.ti-hecho .hv { font-size:1.3rem; font-weight:800; letter-spacing:-.02em; color:var(--tinta); font-variant-numeric:tabular-nums; margin-top:3px; line-height:1.15; }
.ti-hecho .hv.rojo { color:var(--rojo-t); } .ti-hecho .hv.ambar { color:var(--ambar-t); }
.ti-hecho .hv.verde { color:var(--verde-t); } .ti-hecho .hv.morado { color:var(--morado-tinta); }
.ti-hecho .hs { font-size:.72rem; color:var(--suave); margin-top:2px; line-height:1.35; }
.ti-accion { padding:18px 22px 6px; }
.ti-burbuja { border-radius:14px; padding:13px 16px; font-size:.88rem; line-height:1.55; color:var(--tinta); }
.ti-burbuja.in { background:var(--burbuja-in); border-radius:14px 14px 14px 4px; margin-bottom:10px; }
.ti-burbuja.ia { background:var(--morado-agua); border-radius:14px 14px 4px 14px; margin:0 0 10px 26px; }
.ti-burbuja.sug { background:var(--morado-agua); }
.ti-b-quien, .ti-b-eti { font-size:.62rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--morado-tinta); margin-bottom:5px; }
.ti-b-hora { font-size:.68rem; color:var(--tenue); margin-top:5px; }
.ti-evid { display:flex; gap:8px; margin-top:6px; }
.ti-editor { width:100%; box-sizing:border-box; border:1.5px solid var(--morado); border-radius:13px; background:var(--carta); color:var(--tinta); padding:12px 15px; font-size:16px; line-height:1.55; resize:vertical; min-height:96px; outline:none; }
.ti-campo { width:100%; box-sizing:border-box; border:1px solid var(--linea); border-radius:11px; background:var(--carta); color:var(--tinta); padding:11px 13px; font-size:16px; outline:none; margin-top:8px; min-height:44px; }
.ti-campo-l { font-size:.62rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--tenue); margin:12px 0 5px; }
.ti-botones { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
.ti-btn { border:none; border-radius:12px; min-height:48px; padding:0 22px; font-size:.92rem; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:9px; cursor:pointer; text-decoration:none; box-sizing:border-box; }
.ti-btn.prim { background:var(--morado); color:#fff; flex:1 1 220px; }
.ti-btn.prim:hover { background:var(--morado-hondo); }
.ti-btn.prim:disabled { opacity:.55; cursor:default; }
.ti-btn.sec { background:var(--carta); color:var(--morado-tinta); border:1.5px solid var(--morado); flex:0 1 auto; }
.ti-tipollamada { margin-bottom:12px; }
.ti-notita { font-size:.72rem; color:var(--tenue); margin-top:9px; line-height:1.45; }
.ti-resultado { margin-top:16px; border-top:1px solid var(--linea2); padding-top:15px; }
.ti-res-tt { font-size:.8rem; font-weight:800; color:var(--tinta); margin-bottom:10px; }
.ti-res-chips { display:flex; gap:8px; flex-wrap:wrap; }
.ti-res-chip { border:1px solid var(--linea); background:var(--carta); color:var(--texto); border-radius:20px; min-height:40px; padding:0 16px; font-size:.82rem; font-weight:600; cursor:pointer; }
.ti-res-chip.on { background:var(--morado-agua); border-color:var(--morado); color:var(--morado-tinta); font-weight:800; }
.ti-falta { margin-top:14px; background:var(--ambar-a); border-radius:11px; padding:11px 14px; font-size:.78rem; color:var(--ambar-t); line-height:1.5; }
.ti-brief-txt { font-size:.87rem; color:var(--texto); line-height:1.55; }
.ti-mas { margin:4px 22px 0; border-top:1px solid var(--linea2); }
.ti-mas summary { list-style:none; padding:12px 0; font-size:.78rem; font-weight:700; color:var(--morado-tinta); cursor:pointer; display:flex; align-items:center; gap:7px; }
.ti-mas summary::-webkit-details-marker { display:none; }
.ti-mas summary svg { transition:transform .2s; }
.ti-mas[open] summary svg { transform:rotate(90deg); }
.ti-mas-cuerpo { padding-bottom:14px; }
.ti-ctx { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:11px 16px; }
.ti-ctx .cl { font-size:.62rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--tenue); }
.ti-ctx .cv { font-size:.84rem; font-weight:600; color:var(--tinta); margin-top:2px; }
.ti-toques { margin-top:10px; font-size:.78rem; color:var(--suave); line-height:1.55; }
.ti-toques b { color:var(--texto); }
.ti-pie { display:flex; gap:20px; padding:4px 22px 20px; }
.ti-pie-txt { border:none; background:none; padding:8px 2px; font-size:.82rem; font-weight:700; color:var(--suave); cursor:pointer; }
.ti-pie-txt:hover { color:var(--texto); }
.ti-sigue { margin:14px auto 0; padding:0 8px; font-size:.78rem; color:var(--tenue); }
.ti-sigue b { color:var(--suave); }
.ti-error { background:var(--rojo-a); color:var(--rojo-t); border-radius:11px; padding:11px 14px; font-size:.82rem; line-height:1.5; }
.ti-cargando { text-align:center; color:var(--suave); padding:60px 0; }
.ti-fin { text-align:center; padding:44px 24px 36px; }
.ti-fin h2 { font-size:1.4rem; font-weight:800; color:var(--tinta); letter-spacing:-.02em; margin:0 0 8px; }
.ti-fin p { font-size:.87rem; color:var(--suave); line-height:1.6; max-width:400px; margin:0 auto; }
.ti-p1aviso { position:fixed; left:50%; top:70px; transform:translateX(-50%); z-index:95;
  background:var(--tinta); color:var(--fondo); border-radius:14px; box-shadow:var(--sombra);
  padding:12px 18px; display:flex; align-items:center; gap:11px; width:min(560px, calc(100vw - 28px));
  font-size:.83rem; font-weight:700; line-height:1.4; animation:tientra .3s ease; }
.ti-p1aviso i { width:9px; height:9px; border-radius:50%; background:var(--morado); flex:none;
  animation:tilate 1.2s ease-in-out infinite; }
.ti-velo { position:fixed; inset:0; background:rgba(12,11,18,.5); z-index:90; }
.ti-hoja { position:fixed; left:0; right:0; bottom:0; z-index:91; background:var(--carta); border-radius:22px 22px 0 0; box-shadow:0 -12px 40px rgba(0,0,0,.25); padding:10px 20px 26px; max-width:640px; margin:0 auto; max-height:86dvh; overflow-y:auto; }
.ti-agarra { width:44px; height:5px; border-radius:99px; background:var(--linea); margin:4px auto 14px; }
.ti-hoja-tt { font-size:1.05rem; font-weight:800; color:var(--tinta); letter-spacing:-.01em; }
.ti-hoja-sub { font-size:.8rem; color:var(--suave); margin-top:4px; line-height:1.5; }
.ti-hoja-nota { font-size:.75rem; color:var(--suave); margin-top:10px; line-height:1.5; }
.ti-motivos { margin-top:14px; display:flex; flex-direction:column; gap:8px; max-height:44dvh; overflow-y:auto; }
.ti-motivo { display:flex; align-items:center; gap:11px; border:1px solid var(--linea); border-radius:12px; padding:12px 14px; font-size:.87rem; color:var(--texto); background:var(--carta); text-align:left; cursor:pointer; }
.ti-motivo.on { border-color:var(--morado); background:var(--morado-agua); color:var(--morado-tinta); font-weight:700; }
.ti-motivo i { width:16px; height:16px; border-radius:50%; border:2px solid var(--tenue); flex:none; }
.ti-motivo.on i { border-color:var(--morado-tinta); background:var(--morado-tinta); box-shadow:inset 0 0 0 3px var(--morado-agua); }
.ti-fila-item { display:flex; gap:10px; align-items:baseline; padding:9px 0; border-bottom:1px solid var(--linea2); }
.ti-fila-txt { font-size:.85rem; color:var(--tinta); min-width:0; }
.ti-ahora { margin-left:auto; flex:none; font-size:.7rem; font-weight:800; color:var(--morado-tinta); }
@media (max-width:480px) {
  /* La barra debe caber en 390px: todo se encoge y NADA desborda la página. */
  .ti-barra { padding:10px 12px 9px; }
  .ti-barra-fila { gap:6px; flex-wrap:wrap; }
  .ti-tt { font-size:.82rem; }
  .ti-num { font-size:.7rem; }
  .ti-badge { font-size:.6rem; padding:2px 7px; }
  .ti-verfila { font-size:.72rem; }
  .ti-lienzo { padding:12px 10px 80px; }
  .ti-inst { font-size:1.18rem; }
  .ti-cab, .ti-accion { padding-left:17px; padding-right:17px; }
  .ti-hechos, .ti-mas { margin-left:17px; margin-right:17px; }
  .ti-pie { padding-left:17px; padding-right:17px; }
  .ti-hecho .hv { font-size:1.1rem; }
  .ti-hecho { padding-right:10px; } .ti-hecho + .ti-hecho { padding-left:12px; }
  .ti-btn.prim, .ti-btn.sec { flex:1 1 100%; }
}
`;
