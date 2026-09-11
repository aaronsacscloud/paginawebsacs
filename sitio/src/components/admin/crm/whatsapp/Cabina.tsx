// LLAMADAS INTELIGENTES · La cabina.
//
// Vive dentro del inbox, en el lugar de la lista + el hilo. El vendedor arma
// la lista con los filtros que ya tiene puestos, escribe cómo se presenta,
// se pone los audífonos y la central marca por él. Él solo habla cuando del
// otro lado hay una persona.
//
// El servidor manda (src/lib/telefonia/marcador.ts). Esta pantalla:
//   1. arma la lista paginando el inbox con el MISMO query string de la lista,
//   2. pide al Telefonia.tsx que entre a la sala (evento `tel-sala`),
//   3. pregunta cada segundo cómo va (`GET ?id=`) y pinta el item actual,
//   4. cuando el item pasa a `en_linea`, suena un aviso y abre el micrófono
//      (`tel-mute {mute:false}`); al cerrarse, lo vuelve a cerrar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from './estilo';
import { S } from '../email/ui';
import Cargando from '../ui/Cargando';
import { IcoTelefono, IcoMic, IcoReloj, IcoUsuario, IcoX } from './Iconos';
import { telefonoLegible } from '../../../../lib/telefono';

type Props = {
  /** El query string de la lista tal como la ve el vendedor (armarQS). */
  qs: string;
  /** Cómo se llama lo que tiene filtrado: «Vista Leads calientes», «Míos · etapa lead»… */
  descripcion: string;
  /** Cuántas filas tiene la lista según el inbox (para avisar antes de armar). */
  total: number;
  yo?: any;
  onAbrirConversacion?: (conversationId: string) => void;
  onCerrar: () => void;
  movil?: boolean;
};

const post = (body: any) => fetch('/api/crm/telefonia/marcador', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json()).catch(() => ({ error: 'Sin conexión' }));

const ETIQUETA_ITEM: Record<string, string> = {
  pendiente: 'En espera', marcando: 'Marcando', timbrando: 'Timbrando', escuchando: 'Escuchando quién contesta',
  portero: 'Pasando la contestadora', en_linea: 'En línea', cierre: 'Cierre', hecho: 'Hecha', saltado: 'Saltada', excluido: 'Fuera de la lista',
};
const ETIQUETA_RESULTADO: Record<string, string> = {
  contesto: 'Contestó', buzon: 'Buzón de voz', portero: 'Contestadora', no_contesto: 'No contestó', ocupado: 'Ocupado', invalido: 'Número inválido',
  volver_llamar: 'Volver a llamar', no_interesa: 'No le interesa', dieron_datos: 'Dio datos', saltado: 'Saltada', cancelado: 'Cancelada',
};
const TONO_RESULTADO: Record<string, { bg: string; fg: string }> = {
  contesto: { bg: '#EAF8F2', fg: '#1E8A63' }, dieron_datos: { bg: '#EAF8F2', fg: '#1E8A63' }, volver_llamar: { bg: '#FFF4E5', fg: '#9a6a10' },
  no_interesa: { bg: '#FEF0EF', fg: '#C0554E' }, invalido: { bg: '#FEF0EF', fg: '#C0554E' },
};
const tono = (r?: string | null) => TONO_RESULTADO[r || ''] || { bg: C.g100, fg: '#4B5563' };

const btnS: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: `1.5px solid #9B8CFA`, borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' };
const btnT: React.CSSProperties = { ...S.btnG, display: 'inline-flex', alignItems: 'center', gap: 5 };
const btnD: React.CSSProperties = { border: '1px solid #f0c4bd', borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 700, color: '#C0554E', cursor: 'pointer', fontFamily: 'inherit' };
const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 9, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: C.g900 };
const etiqueta: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: C.g500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 };
const tarjeta = (franja: string): React.CSSProperties => ({ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${franja}`, borderRadius: 10, padding: '13px 15px' });

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Un timbre corto, dos veces: «ya hay una persona, habla». Sin archivos. */
function avisar() {
  try {
    const A = (window as any).AudioContext || (window as any).webkitAudioContext; if (!A) return;
    const ctx = new A();
    [0, 0.22].forEach(t => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* sin audio */ }
}

const guardarLocal = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privado */ } };
const leerLocal = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

export default function Cabina({ qs, descripcion, total, yo, onAbrirConversacion, onCerrar, movil }: Props) {
  const [sesionId, setSesionId] = useState<string | null>(() => leerLocal('cabina.sesion', null));
  const [est, setEst] = useState<any>(null);           // { sesion, actual, pendientes, ahora }
  const [items, setItems] = useState<any[]>([]);
  const [previas, setPrevias] = useState<any[]>([]);
  const [telefonia, setTelefonia] = useState<{ ok: boolean; faltantes: string[] } | null>(null);
  const [enSala, setEnSala] = useState(false);
  const [micAbierto, setMicAbierto] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [armando, setArmando] = useState<{ leidas: number; total: number } | null>(null);
  // La presentación se recuerda entre sesiones: es la misma casi siempre.
  const [pres, setPres] = useState(() => leerLocal('cabina.presentacion', {
    nombre: yo?.nombre ? `${String(yo.nombre).split(' ')[0]} de Sacscloud` : '', motivo: 'le llamo para dar seguimiento a su solicitud de información', buzon: false, auto: true, wrapup: 8,
  }));
  const [nota, setNota] = useState('');
  const [noLlamar, setNoLlamar] = useState(false);
  const notaItem = useRef<string | null>(null);
  const [tab, setTab] = useState<'lista' | 'hechas'>('lista');

  const sesion = est?.sesion;
  const actual = est?.actual;
  const fase: 'armar' | 'lista' | 'viva' | 'fin' = !sesionId || !sesion ? 'armar'
    : ['borrador', 'lista'].includes(sesion.estado) ? 'lista'
    : ['activa', 'pausada'].includes(sesion.estado) ? 'viva' : 'fin';

  useEffect(() => { guardarLocal('cabina.presentacion', pres); }, [pres]);
  useEffect(() => { guardarLocal('cabina.sesion', sesionId); }, [sesionId]);

  const cargarPrevias = useCallback(() => {
    fetch('/api/crm/telefonia/marcador?lista=1', { cache: 'no-store' }).then(r => r.json()).then(j => {
      setPrevias(j.sesiones || []);
      setTelefonia({ ok: !!j.telefonia, faltantes: j.faltantes || [] });
    }).catch(() => {});
  }, []);
  useEffect(() => { cargarPrevias(); }, [cargarPrevias]);

  const latir = useCallback(async () => {
    if (!sesionId) return;
    const j = await fetch(`/api/crm/telefonia/marcador?id=${sesionId}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (!j) return;
    if (j.error) { setSesionId(null); setEst(null); return; }
    setEst(j);
  }, [sesionId]);
  const cargarItems = useCallback(async () => {
    if (!sesionId) return;
    const j = await fetch(`/api/crm/telefonia/marcador?id=${sesionId}&items=1`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (j?.items) setItems(j.items);
  }, [sesionId]);

  // El pulso: cada segundo mientras la sesión vive, cada 6 s si está parada.
  useEffect(() => {
    if (!sesionId) return;
    let vivo = true;
    latir(); cargarItems();
    const t = setInterval(() => { if (vivo && document.visibilityState === 'visible') latir(); }, fase === 'viva' ? 1000 : 6000);
    const t2 = setInterval(() => { if (vivo && document.visibilityState === 'visible') cargarItems(); }, fase === 'viva' ? 5000 : 15000);
    return () => { vivo = false; clearInterval(t); clearInterval(t2); };
  }, [sesionId, fase, latir, cargarItems]);

  // Lo que dice el teléfono (Telefonia.tsx): si estoy en la sala y con el mic abierto.
  useEffect(() => {
    const h = (ev: any) => {
      const d = ev.detail || {};
      if (d.sesion_id && sesionId && d.sesion_id !== sesionId) return;
      setEnSala(!!d.en_sala);
      if (d.mute !== undefined) setMicAbierto(!d.mute);
      if (d.error) setError(d.error);
    };
    document.addEventListener('tel-sala-estado', h);
    document.dispatchEvent(new CustomEvent('tel-sala-consulta'));
    return () => document.removeEventListener('tel-sala-estado', h);
  }, [sesionId]);

  // EL MOMENTO: el item pasa a en_linea → timbre + micrófono abierto. Al
  // salir de en_linea → micrófono cerrado. Se decide por el id del item para
  // no abrir dos veces si el polling repite el estado.
  const abiertoPara = useRef<string | null>(null);
  useEffect(() => {
    const id = actual?.estado === 'en_linea' ? actual.id : null;
    if (id && abiertoPara.current !== id) {
      abiertoPara.current = id;
      avisar();
      document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: false } }));
      setMicAbierto(true);
    } else if (!id && abiertoPara.current) {
      abiertoPara.current = null;
      document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: true } }));
      setMicAbierto(false);
    }
  }, [actual?.id, actual?.estado]);

  // El apunte sigue al item: cambia de item, se guarda lo escrito y se limpia.
  useEffect(() => {
    const id = actual?.id || null;
    if (notaItem.current && notaItem.current !== id) {
      const texto = nota.trim();
      if (texto) post({ accion: 'nota', id: sesionId, item: notaItem.current, nota: texto });
      setNota(''); setNoLlamar(false);
    }
    notaItem.current = id;
    if (id && actual?.nota && !nota) setNota(actual.nota);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual?.id]);

  // ── Armar la lista con los filtros del inbox ──────────────────────────
  const armar = async () => {
    setError(''); setOcupado('armar');
    try {
      const filas: any[] = [];
      let offset = 0; let hayMas = true; let tot = total;
      while (hayMas && filas.length < 500) {
        const j = await fetch(`/api/crm/whatsapp/inbox?${qs}&limit=200&offset=${offset}`, { cache: 'no-store' }).then(r => r.json());
        const lote: any[] = j?.conversaciones || [];
        filas.push(...lote); offset += lote.length; hayMas = !!j?.hay_mas && lote.length > 0;
        tot = Number(j?.total_filtrado ?? tot);
        setArmando({ leidas: filas.length, total: tot });
      }
      const items = filas.map(c => ({
        contact_id: c.contact_id || null, company_id: c.company_id || null,
        conversation_id: c.virtual ? null : (c.wa_id || null),
        nombre: c.contacto?.nombre || null, empresa: c.empresa?.nombre || null,
        telefono: c.telefono || '',
      })).filter(i => i.telefono && !/@/.test(i.telefono));
      if (!items.length) { setError('Ninguna fila de esta lista tiene teléfono.'); return; }
      const r = await post({
        accion: 'crear', items, nombre: descripcion.slice(0, 120),
        origen: { qs, descripcion, filas: filas.length, total: tot },
        presentacion_nombre: pres.nombre, presentacion_motivo: pres.motivo, buzon_dejar_mensaje: pres.buzon,
        config: { auto_continuar: pres.auto, wrapup_seg: Number(pres.wrapup) || 8 },
      });
      if (r?.error) { setError(r.error); return; }
      setSesionId(r.id); setTab('lista');
      cargarPrevias();
    } catch (e: any) { setError(e?.message || 'No se pudo armar la lista'); }
    finally { setOcupado(''); setArmando(null); }
  };

  const accion = async (a: string, extra: any = {}) => {
    if (!sesionId) return;
    setError(''); setOcupado(a);
    const r = await post({ accion: a, id: sesionId, ...extra });
    setOcupado('');
    if (r?.error) { setError(r.error + (r.faltantes?.length ? ` (faltan: ${r.faltantes.join(', ')})` : '')); return null; }
    latir(); cargarItems();
    return r;
  };

  const empezar = async () => {
    // Guardar la presentación por si la editó, luego arrancar y entrar a la sala.
    const ok1 = await accion('presentacion', { presentacion_nombre: pres.nombre, presentacion_motivo: pres.motivo, buzon_dejar_mensaje: pres.buzon, config: { auto_continuar: pres.auto, wrapup_seg: Number(pres.wrapup) || 8 } });
    if (!ok1) return;
    const r = await accion(sesion?.estado === 'pausada' ? 'reanudar' : 'iniciar');
    if (r) document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sesionId } }));
  };
  const entrarSala = () => { setError(''); document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sesionId } })); };
  const terminar = async () => {
    await accion('terminar');
    document.dispatchEvent(new CustomEvent('tel-colgar-sala'));
  };
  const guardarResultado = async (resultado: string) => {
    if (!actual) return;
    await accion('resultado', { item: actual.id, resultado, no_llamar: resultado === 'no_interesa' && noLlamar });
  };
  const guardarNota = async () => {
    if (!actual || !nota.trim()) return;
    await accion('nota', { item: actual.id, nota: nota.trim() });
  };
  const relanzar = async (id: string) => {
    setError(''); setOcupado('relanzar');
    const r = await post({ accion: 'relanzar', id });
    setOcupado('');
    if (r?.error) { setError(r.error); return; }
    if (!r?.total) { setError('No quedó nadie a quien volver a llamar.'); return; }
    setSesionId(r.id); setTab('lista'); cargarPrevias();
  };
  const salirDeSesion = () => { setSesionId(null); setEst(null); setItems([]); cargarPrevias(); };

  // ── Cálculos de pantalla ──────────────────────────────────────────────
  const hechos = useMemo(() => items.filter(i => ['hecho', 'saltado'].includes(i.estado)), [items]);
  const pendientes = useMemo(() => items.filter(i => i.estado === 'pendiente'), [items]);
  const excluidos = useMemo(() => items.filter(i => i.estado === 'excluido'), [items]);
  const segCierre = actual?.estado === 'cierre' && actual.terminado_at && est?.ahora
    ? Math.max(0, Number(sesion?.config?.wrapup_seg ?? 8) - Math.round((new Date(est.ahora).getTime() - new Date(actual.terminado_at).getTime()) / 1000)) : null;

  const cab = (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: `1px solid ${C.g200}`, flexShrink: 0, background: '#fff' }}>
      <IcoTelefono size={16} style={{ color: C.moradoTinta }} />
      <b style={{ fontSize: 14, letterSpacing: '-0.01em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Llamadas inteligentes{sesion?.nombre ? <span style={{ fontWeight: 500, color: C.g500 }}> · {sesion.nombre}</span> : null}
      </b>
      {fase === 'viva' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: enSala ? (micAbierto ? '#1E8A63' : C.moradoTinta) : '#9a6a10', background: enSala ? (micAbierto ? '#EAF8F2' : C.moradoAgua) : '#FFF4E5', borderRadius: 999, padding: '3px 9px' }}>
          <IcoMic size={12} />{enSala ? (micAbierto ? 'Te oyen' : 'En la sala, mudo') : 'Fuera de la sala'}
        </span>
      )}
      {sesionId && fase !== 'viva' && <button onClick={salirDeSesion} style={{ ...btnT, padding: '5px 10px' }}>Otra lista</button>}
      <button onClick={onCerrar} title="Volver al inbox" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 4 }}><IcoX size={16} /></button>
    </div>
  );

  const errorBox = error ? (
    <div role="alert" style={{ margin: '0 0 12px', background: '#FEF0EF', border: '1px solid #f0c4bd', color: '#C0554E', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, display: 'flex', gap: 8 }}>
      <span style={{ flex: 1 }}>{error}</span>
      <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C0554E', fontFamily: 'inherit', fontWeight: 700 }}>x</button>
    </div>
  ) : null;

  const formPresentacion = (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <label style={etiqueta}>Quién llama (lo que oye la contestadora)</label>
        <input value={pres.nombre} onChange={e => setPres((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="Aarón de Sacscloud" style={campo} />
      </div>
      <div>
        <label style={etiqueta}>Motivo de la llamada</label>
        <input value={pres.motivo} onChange={e => setPres((p: any) => ({ ...p, motivo: e.target.value }))} placeholder="le llamo para dar seguimiento a su solicitud" style={campo} />
        <span style={{ fontSize: 11, color: C.g400, display: 'block', marginTop: 4 }}>Se dice así: «Soy {pres.nombre || '…'}, {pres.motivo || '…'}. Busco a {'{nombre}'}. Gracias.»</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 12.5, color: C.g700 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={!!pres.buzon} onChange={e => setPres((p: any) => ({ ...p, buzon: e.target.checked }))} /> Dejar recado en el buzón de voz</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={!!pres.auto} onChange={e => setPres((p: any) => ({ ...p, auto: e.target.checked }))} /> Seguir solo con el siguiente</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Pausa entre llamadas <input type="number" min={3} max={60} value={pres.wrapup} onChange={e => setPres((p: any) => ({ ...p, wrapup: e.target.value }))} style={{ ...campo, width: 62, padding: '4px 6px' }} /> s</label>
      </div>
    </div>
  );

  // ── 1 · ARMAR ─────────────────────────────────────────────────────────
  if (fase === 'armar') {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
        {cab}
        <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22 }}>
          <div style={{ maxWidth: 680, margin: '0 auto', display: 'grid', gap: 14 }}>
            {errorBox}
            {telefonia && !telefonia.ok && (
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '8px 12px', fontSize: 12.5 }}>
                La telefonía no está configurada (faltan {telefonia.faltantes.length} datos). Puedes armar la lista, pero no marcar.
              </div>
            )}
            <div style={tarjeta('#9B8CFA')}>
              <span style={etiqueta}>La lista</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.g900 }}>{descripcion}</div>
              <div style={{ fontSize: 12.5, color: C.g500, marginTop: 2 }}>
                {total > 0 ? `${total} ${total === 1 ? 'contacto' : 'contactos'} con los filtros de ahora` : 'Sin filas con los filtros de ahora'}{total > 500 ? ' · se toman los primeros 500' : ''}.
                Se quitan solos los que no tienen teléfono, los marcados «no llamar» y los que ya se intentaron 3 veces esta semana.
              </div>
              {armando && <div style={{ marginTop: 8, fontSize: 12, color: C.moradoTinta, fontWeight: 600 }}>Leyendo la lista… {armando.leidas}{armando.total ? ` de ${armando.total}` : ''}</div>}
            </div>
            <div style={tarjeta('#7DA6F5')}>
              <span style={etiqueta}>Cómo te presentas</span>
              {formPresentacion}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={armar} disabled={!!ocupado || total === 0} style={{ ...S.btnP, opacity: !!ocupado || total === 0 ? 0.6 : 1 }}>
                {ocupado === 'armar' ? 'Armando…' : 'Armar la lista con los filtros actuales'}
              </button>
              <span style={{ fontSize: 11.5, color: C.g400 }}>Después la revisas antes de marcar.</span>
            </div>

            {previas.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={etiqueta}>Sesiones anteriores</span>
                <div style={{ display: 'grid', gap: 6 }}>
                  {previas.map(p => (
                    <div key={p.id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.g900 }}>{p.nombre || 'Sesión'}</div>
                        <div style={{ fontSize: 11.5, color: C.g500 }}>
                          {String(p.created_at).slice(0, 10)} · {p.total} en lista · {p.contestadas} contestaron · {p.buzon} buzón · {p.sin_contestar} sin contestar{p.porteros ? ` · ${p.porteros} contestadora` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: ['activa', 'pausada'].includes(p.estado) ? '#EAF8F2' : C.g100, color: ['activa', 'pausada'].includes(p.estado) ? '#1E8A63' : '#4B5563' }}>{p.estado}</span>
                      <button onClick={() => { setSesionId(p.id); setTab(p.estado === 'terminada' ? 'hechas' : 'lista'); }} style={btnS}>{['terminada', 'cancelada'].includes(p.estado) ? 'Ver' : 'Abrir'}</button>
                      {['terminada', 'cancelada'].includes(p.estado) && (p.sin_contestar + p.buzon + p.porteros) > 0 && (
                        <button onClick={() => relanzar(p.id)} disabled={ocupado === 'relanzar'} style={btnT}>Relanzar</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const filaItem = (i: any, conAcciones: boolean, compacto = false) => (
    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.g100}`, background: i.id === actual?.id ? C.moradoSuave : '#fff', opacity: i.estado === 'excluido' ? 0.55 : 1 }}>
      <span style={{ width: 22, fontSize: 11, color: C.g400, textAlign: 'right', flexShrink: 0 }}>{i.orden + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.g900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.nombre || telefonoLegible(i.telefono)}{i.empresa ? <span style={{ fontWeight: 400, color: C.g500 }}> · {i.empresa}</span> : null}</div>
        <div style={{ fontSize: 11.5, color: C.g500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{telefonoLegible(i.telefono)}{i.intentos ? ` · ${i.intentos} ${i.intentos === 1 ? 'intento' : 'intentos'}` : ''}{i.duracion_seg ? ` · ${fmt(i.duracion_seg)}` : ''}{i.motivo_exclusion ? ` · ${i.motivo_exclusion}` : ''}</div>
        {i.nota && <div style={{ fontSize: 11.5, color: '#4B5563', marginTop: 2, fontStyle: 'italic' }}>{i.nota}</div>}
      </div>
      {i.estado === 'hecho' || i.estado === 'saltado'
        ? <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', ...tono(i.resultado), background: tono(i.resultado).bg, color: tono(i.resultado).fg }}>{ETIQUETA_RESULTADO[i.resultado] || ETIQUETA_ITEM[i.estado]}</span>
        : <span style={{ fontSize: 11, color: C.g500 }}>{i.estado === 'pendiente' && fase === 'fin' ? 'Sin marcar' : (ETIQUETA_ITEM[i.estado] || i.estado)}</span>}
      {!compacto && i.conversation_id && onAbrirConversacion && <button onClick={() => onAbrirConversacion(i.conversation_id)} title="Ver la conversación" style={{ ...btnT, padding: '3px 8px', fontSize: 11 }}>Chat</button>}
      {conAcciones && i.estado === 'pendiente' && <button onClick={() => accion('excluir', { item: i.id })} title="Quitar de la lista" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2 }}><IcoX size={14} /></button>}
      {conAcciones && !compacto && i.estado === 'excluido' && <button onClick={() => accion('incluir', { item: i.id })} style={{ ...btnT, padding: '3px 8px', fontSize: 11 }}>Volver a meter</button>}
    </div>
  );

  // ── 2 · LA LISTA, ANTES DE MARCAR ─────────────────────────────────────
  if (fase === 'lista') {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
        {cab}
        <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22 }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 14 }}>
            {errorBox}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ ...tarjeta('#9B8CFA'), flex: 1, minWidth: 140 }}><span style={etiqueta}>En la lista</span><div style={{ fontSize: 22, fontWeight: 800, color: C.moradoTinta }}>{pendientes.length}</div></div>
              <div style={{ ...tarjeta('#E8A838'), flex: 1, minWidth: 140 }}><span style={etiqueta}>Fuera</span><div style={{ fontSize: 22, fontWeight: 800, color: '#9a6a10' }}>{excluidos.length}</div><div style={{ fontSize: 11, color: C.g500 }}>sin teléfono, no llamar o repetidos</div></div>
            </div>
            <div style={tarjeta('#7DA6F5')}>
              <span style={etiqueta}>Cómo te presentas</span>
              {formPresentacion}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={empezar} disabled={!!ocupado || pendientes.length === 0 || (telefonia ? !telefonia.ok : false)} style={{ ...S.btnP, opacity: !!ocupado || pendientes.length === 0 ? 0.6 : 1 }}>
                {ocupado ? 'Abriendo la sala…' : 'Empezar a marcar'}
              </button>
              <span style={{ fontSize: 11.5, color: C.g400 }}>Ponte los audífonos: entras mudo y solo hablas cuando conteste una persona.</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => accion('terminar')} style={btnD}>Descartar lista</button>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden' }}>
              {items.length === 0 ? <Cargando texto="Leyendo la lista…" alto={120} /> : items.map(i => filaItem(i, true))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 4 · TERMINADA ─────────────────────────────────────────────────────
  if (fase === 'fin') {
    const s = sesion;
    const kpi = (franja: string, et: string, v: any, color: string, sub?: string) => (
      <div style={{ ...tarjeta(franja), flex: 1, minWidth: 120 }}><span style={etiqueta}>{et}</span><div style={{ fontSize: 22, fontWeight: 800, color }}>{v}</div>{sub && <div style={{ fontSize: 11, color: C.g500 }}>{sub}</div>}</div>
    );
    const relanzables = items.filter(i => ['no_contesto', 'ocupado', 'buzon', 'portero', 'volver_llamar'].includes(i.resultado) || i.estado === 'pendiente').length;
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
        {cab}
        <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22 }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 14 }}>
            {errorBox}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {kpi('#4FBF95', 'Contestaron', s.contestadas, '#1E8A63', `${fmt(s.segundos_hablados || 0)} hablados`)}
              {kpi('#E8A838', 'Buzón', s.buzon, '#9a6a10')}
              {kpi('#9B8CFA', 'Sin contestar', s.sin_contestar, C.moradoTinta)}
              {kpi('#7DA6F5', 'Contestadora', s.porteros, '#2C5FC4')}
              {kpi('#EF7A72', 'Inválidos', s.invalidos, '#C0554E')}
              {kpi('#D1D5DB', 'Sin marcar', items.filter(i => i.estado === 'pendiente').length, '#4B5563')}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => relanzar(s.id)} disabled={!relanzables || ocupado === 'relanzar'} style={{ ...S.btnP, opacity: relanzables ? 1 : 0.6 }}>Volver a llamar a los {relanzables} que faltan</button>
              <button onClick={salirDeSesion} style={btnS}>Armar otra lista</button>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden' }}>
              {items.map(i => filaItem(i, false))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 3 · LA CABINA VIVA ────────────────────────────────────────────────
  const pausada = sesion.estado === 'pausada';
  const aviso = sesion.config?.aviso;
  const estadoActual = actual?.estado;
  const colorEstado = estadoActual === 'en_linea' ? '#4FBF95' : estadoActual === 'cierre' ? '#7DA6F5' : estadoActual === 'portero' ? '#E8A838' : '#9B8CFA';
  const chipRes = (r: string, texto: string) => (
    <button key={r} onClick={() => guardarResultado(r)} style={{
      border: `1.5px solid ${actual?.resultado === r ? '#9B8CFA' : C.g200}`, background: actual?.resultado === r ? C.moradoAgua : '#fff',
      color: actual?.resultado === r ? C.moradoTinta : C.g700, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    }}>{texto}</button>
  );

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
      {cab}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: movil ? 'column' : 'row' }}>
        {/* Izquierda: el item actual */}
        <div className="wa-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22 }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 12 }}>
            {errorBox}
            {!enSala && (
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '10px 12px', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1 }}>{aviso || 'No estás en la sala: la central no marca hasta que entres.'}</span>
                <button onClick={pausada ? empezar : entrarSala} disabled={!!ocupado} style={S.btnP}>{pausada ? 'Reanudar y entrar a la sala' : 'Entrar a la sala'}</button>
              </div>
            )}
            {enSala && pausada && (
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '10px 12px', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1 }}>{aviso || 'Sesión en pausa.'}</span>
                <button onClick={() => accion('reanudar')} disabled={!!ocupado} style={S.btnP}>Reanudar</button>
              </div>
            )}

            {actual ? (
              <div style={{ ...tarjeta(colorEstado), padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span className={['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) ? 'wa-pulso' : undefined} style={{ width: 10, height: 10, borderRadius: 999, background: colorEstado, flexShrink: 0 }} />
                  <b style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: estadoActual === 'en_linea' ? '#1E8A63' : '#4B5563' }}>
                    {ETIQUETA_ITEM[estadoActual] || estadoActual}
                    {estadoActual === 'en_linea' && actual.segundos_en_linea > 0 ? ` · ${fmt(actual.segundos_en_linea)}` : ''}
                    {estadoActual === 'cierre' && segCierre !== null && sesion.config?.auto_continuar !== false ? ` · siguiente en ${segCierre} s` : ''}
                  </b>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: C.g400 }}>{actual.orden + 1} de {sesion.total}{est?.pendientes ? ` · ${est.pendientes} por marcar` : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 999, background: C.moradoAgua, color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IcoUsuario size={22} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: C.g900 }}>{actual.nombre || 'Sin nombre'}</div>
                    <div style={{ fontSize: 12.5, color: C.g500 }}>{[actual.empresa, telefonoLegible(actual.telefono)].filter(Boolean).join(' · ')}</div>
                  </div>
                  {actual.conversation_id && onAbrirConversacion && <button onClick={() => onAbrirConversacion(actual.conversation_id)} style={btnT}>Ver chat</button>}
                </div>

                {actual.apertura && ['en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 12, background: C.moradoSuave, borderRadius: 9, padding: '9px 12px', fontSize: 13.5, color: C.moradoTinta, fontWeight: 600 }}>{actual.apertura}</div>
                )}
                {actual.resumen && (
                  <div style={{ marginTop: 10 }}>
                    <span style={etiqueta}>Lo que hay que saber</span>
                    <div style={{ fontSize: 12.5, color: C.g700, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{actual.resumen}</div>
                  </div>
                )}
                {actual.oido_texto && !['en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: C.g500, fontStyle: 'italic' }}>Se oye: «{String(actual.oido_texto).slice(-160)}»</div>
                )}
                {actual.veredicto && ['en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: C.g400 }}>Contestó {actual.veredicto === 'persona' ? 'una persona' : actual.veredicto} · lo dijo {actual.veredicto_fuente === 'reglas' ? 'la voz' : actual.veredicto_fuente}{actual.veredicto_ms ? ` a los ${(actual.veredicto_ms / 1000).toFixed(1)} s` : ''}</div>
                )}

                {/* Acciones del item según su momento */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) && (
                    <>
                      <button onClick={() => accion('tomar')} disabled={!!ocupado} style={btnS}><IcoMic size={13} />Hablar yo</button>
                      <button onClick={() => accion('saltar')} disabled={!!ocupado} style={btnT}>Saltar</button>
                    </>
                  )}
                  {estadoActual === 'en_linea' && (
                    <>
                      <button onClick={() => accion('colgar')} disabled={!!ocupado} style={{ ...btnD, background: '#C0554E', color: '#fff', border: 'none' }}>Colgar</button>
                      <button onClick={() => document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: micAbierto } }))} style={btnT}>{micAbierto ? 'Silenciarme' : 'Abrir micrófono'}</button>
                    </>
                  )}
                  {estadoActual === 'cierre' && (
                    <button onClick={() => accion('siguiente')} disabled={!!ocupado} style={btnS}>Siguiente ahora</button>
                  )}
                </div>

                {['en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                    <span style={etiqueta}>Cómo quedó</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {chipRes('contesto', 'Hablamos')}
                      {chipRes('volver_llamar', 'Volver a llamar')}
                      {chipRes('dieron_datos', 'Dio datos')}
                      {chipRes('no_interesa', 'No le interesa')}
                      {chipRes('buzon', 'Era buzón')}
                    </div>
                    {actual.resultado === 'no_interesa' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.g700, cursor: 'pointer' }}>
                        <input type="checkbox" checked={noLlamar} onChange={e => { setNoLlamar(e.target.checked); if (e.target.checked) post({ accion: 'resultado', id: sesionId, item: actual.id, resultado: 'no_interesa', no_llamar: true }); }} /> No volver a llamarle nunca
                      </label>
                    )}
                    <textarea value={nota} onChange={e => setNota(e.target.value)} onBlur={guardarNota} placeholder="Apunte de la llamada (se guarda en la conversación)" rows={3} style={{ ...campo, resize: 'vertical' }} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ ...tarjeta('#9B8CFA'), textAlign: 'center', padding: '28px 18px' }}>
                {pausada ? <div style={{ fontSize: 14, color: '#4B5563' }}>En pausa. {est?.pendientes || 0} por marcar.</div>
                  : enSala ? <><Cargando texto={est?.pendientes ? 'Marcando al siguiente…' : 'Cerrando la lista…'} alto={80} /></>
                  : <div style={{ fontSize: 14, color: '#4B5563' }}>Entra a la sala para que la central empiece a marcar.</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {!pausada
                ? <button onClick={() => accion('pausar')} disabled={!!ocupado} style={btnT}><IcoReloj size={13} />Pausar</button>
                : null}
              <span style={{ flex: 1 }} />
              <button onClick={terminar} disabled={!!ocupado} style={btnD}>Terminar la sesión</button>
            </div>
          </div>
        </div>

        {/* Derecha: la lista con su estado */}
        <div className="wa-scroll" style={{ width: movil ? '100%' : 340, flexShrink: 0, borderLeft: movil ? 'none' : `1px solid ${C.g200}`, borderTop: movil ? `1px solid ${C.g200}` : 'none', background: '#fff', overflowY: 'auto', maxHeight: movil ? 260 : 'none' }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.g200}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            {(['lista', 'hechas'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 10px', fontSize: 12.5,
                background: tab === t ? C.moradoAgua : 'transparent', color: tab === t ? C.moradoTinta : '#4B5563', fontWeight: tab === t ? 800 : 500,
                borderBottom: tab === t ? '2px solid #9B8CFA' : '2px solid transparent',
              }}>{t === 'lista' ? `Por marcar (${pendientes.length})` : `Hechas (${hechos.length})`}</button>
            ))}
          </div>
          {(tab === 'lista' ? items.filter(i => !['hecho', 'saltado', 'excluido'].includes(i.estado)) : hechos).map(i => filaItem(i, tab === 'lista', true))}
          {tab === 'hechas' && hechos.length === 0 && <div style={{ padding: 18, fontSize: 12, color: C.g400 }}>Aún no hay llamadas hechas.</div>}
        </div>
      </div>
    </div>
  );
}
