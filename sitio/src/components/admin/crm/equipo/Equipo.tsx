// "Equipo": el chat del CRM. Árbol a la izquierda, canal al centro, hilo o
// búsqueda a la derecha. Ligas profundas: ?canal=&msg=&hilo= (las pone
// irADestino desde una notificación y también sirven pegadas en el navegador).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Canal as C, Mensaje as M } from './api';
import { api, type Arbol as A, hace } from './api';
import { useRealtime, type Senal } from './useRealtime';
import { useCss, Avatar, Ic, useToast, textoPlano } from './ui';
import Arbol from './Arbol';
import Canal from './Canal';
import Sala from './Sala';
import Cargando from '../ui/Cargando';
import { useIsMobile } from '../../../../lib/ui/mobile';

const ULTIMO_KEY = 'eq_ultimo_canal';

export default function Equipo() {
  useCss();
  const movil = useIsMobile();
  const { toast, nodo: toastNodo } = useToast();
  const [arbol, setArbol] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canalId, setCanalId] = useState<string | null>(null);
  const [irA, setIrA] = useState<string | null>(null);
  const [hilo, setHilo] = useState<M | null>(null);
  const [lado, setLado] = useState<'hilo' | 'buscar' | 'sala' | 'fijados' | null>(null);
  const [nFijados, setNFijados] = useState(0);
  const [luz, setLuz] = useState<string | null>(null);
  const [leidoAl, setLeidoAl] = useState<Record<string, string>>({});   // ultimo_leido por canal al abrirlo (para la línea "Nuevo")
  const senalCanal = useRef<((s: Senal) => void) | null>(null);
  const senalHilo = useRef<((s: Senal) => void) | null>(null);
  const senalSala = useRef<((s: Senal) => void) | null>(null);
  const yo = arbol?.yo || null;

  const cargarArbol = useCallback(async () => {
    try { const a = await api.arbol(); setArbol(a); setError(null); return a; }
    catch (e: any) { setError(e.message); return null; }
  }, []);

  // Arranque: árbol + canal pedido por la URL, o el último abierto, o #general.
  useEffect(() => {
    cargarArbol().then(a => {
      if (!a) return;
      const q = new URLSearchParams(window.location.search);
      const pedido = q.get('canal');
      let id = pedido && a.canales.some(c => c.id === pedido) ? pedido : null;
      if (!id && !movil) { try { const u = localStorage.getItem(ULTIMO_KEY); if (u && a.canales.some(c => c.id === u)) id = u; } catch { /* nada */ } }
      if (!id && !movil) id = a.canales.find(c => c.nombre === 'general')?.id || a.canales[0]?.id || null;
      if (id) abrir(id, q.get('msg'), q.get('hilo'), a);
    });
  }, []);

  // Cambios de URL mientras el panel está montado (irADestino desde la campana).
  useEffect(() => {
    const f = () => {
      const q = new URLSearchParams(window.location.search);
      const c = q.get('canal'); if (c && arbol) abrir(c, q.get('msg'), q.get('hilo'), arbol);
    };
    window.addEventListener('popstate', f); window.addEventListener('crm:destino', f as any);
    return () => { window.removeEventListener('popstate', f); window.removeEventListener('crm:destino', f as any); };
  }, [arbol]);

  const canal: C | null = useMemo(() => arbol?.canales.find(c => c.id === canalId) || null, [arbol, canalId]);

  function abrir(id: string, msg?: string | null, hiloId?: string | null, a?: A | null) {
    const arb = a || arbol; if (!arb) return;
    const c = arb.canales.find(x => x.id === id); if (!c) return;
    setLeidoAl(l => l[id] ? l : { ...l, [id]: c.ultimo_leido_at || '' });
    setCanalId(id); setIrA(hiloId ? null : (msg || null));
    try { localStorage.setItem(ULTIMO_KEY, id); } catch { /* nada */ }
    if (hiloId) { api.uno(hiloId).then(r => { setHilo(r.mensaje); setLado('hilo'); setIrA(msg || null); }).catch(() => null); }
    else {
      setHilo(null);
      // En escritorio, una sala abre con su agenda a la vista; al salir de la sala, el panel se cierra.
      setLado(l => c.tipo === 'sala' ? (!movil && (l === null || l === 'hilo' || l === 'sala' || l === 'fijados') ? 'sala' : l === 'hilo' ? null : l) : (l === 'hilo' || l === 'sala' || l === 'fijados') ? null : l);
    }
    const u = new URL(window.location.href); u.searchParams.set('tab', 'equipo'); u.searchParams.set('canal', id);
    if (msg) u.searchParams.set('msg', msg); else u.searchParams.delete('msg');
    if (hiloId) u.searchParams.set('hilo', hiloId); else u.searchParams.delete('hilo');
    history.replaceState(null, '', u.toString());
  }

  const marcarLeido = useCallback((id: string) => {
    api.leido(id).catch(() => null);
    setArbol(a => a ? { ...a, canales: a.canales.map(c => c.id === id ? { ...c, no_leidos: 0, menciones: 0 } : c) } : a);
  }, []);

  // Señales: al canal abierto, al hilo abierto, y al árbol (contadores).
  const alSenal = useCallback((s: Senal) => {
    if (s.tipo === 'poll' || s.tipo === 'presencia' || s.tipo === 'canal' || s.tipo === 'reunion') { cargarArbol(); }
    if (s.tipo === 'msg') {
      senalCanal.current?.(s); senalHilo.current?.(s);
      if (s.autor_id !== yo?.id && !(s.canal_id === canalId && document.visibilityState === 'visible' && !s.hilo_de)) {
        setArbol(a => a ? { ...a, canales: a.canales.map(c => c.id === s.canal_id ? { ...c, no_leidos: c.no_leidos + 1, ultimo_at: new Date().toISOString() } : c) } : a);
      }
      if (s.canal_id !== canalId || s.hilo_de) cargarArbol();
    }
    if (s.tipo === 'msg_upd' || s.tipo === 'reaccion') { senalCanal.current?.(s); senalHilo.current?.(s); }
    if (s.tipo === 'msg_upd' && s.canal_id === canalId) contarFijados(s.canal_id);
    if (s.tipo === 'reunion' || s.tipo === 'msg') senalSala.current?.(s);
  }, [canalId, yo?.id, cargarArbol]);
  const contarFijados = useCallback((id: string) => { api.fijados(id).then(r => setNFijados(r.mensajes.length)).catch(() => null); }, []);
  useEffect(() => { setNFijados(0); if (canalId) contarFijados(canalId); }, [canalId, contarFijados]);
  const { conectado, enLinea } = useRealtime(yo?.id || null, alSenal);
  useEffect(() => { const t = setInterval(cargarArbol, 120_000); return () => clearInterval(t); }, [cargarArbol]);

  const abrirDirecto = async (personaId: string) => {
    try { const r = await api.abrirDirecto(personaId); const a = await cargarArbol(); abrir(r.canal.id, null, null, a); } catch (e: any) { toast(e.message); }
  };
  const abrirHilo = (m: M) => { setHilo(m); setLado('hilo'); };
  const silenciar = async () => { if (!canal) return; try { await api.silenciar(canal.id, !canal.silenciado); toast(canal.silenciado ? 'Avisos activados' : 'Canal silenciado'); cargarArbol(); } catch (e: any) { toast(e.message); } };

  if (error && !arbol) return <div className="eq"><div className="eq-vacio"><b>No se pudo abrir Equipo</b>{error}<button className="eq-btn" onClick={cargarArbol}>Reintentar</button></div></div>;
  if (!arbol || !yo) return <div className="eq"><Cargando texto="Abriendo Equipo…" /></div>;

  const otro = canal?.tipo === 'directo' ? arbol.personas.find(x => canal.participantes.includes(x.id) && x.id !== yo.id) : null;
  const cabecera = canal ? (
    <div className="eq-cab">
      {movil && <button className="eq-ib" onClick={() => { setCanalId(null); setLado(null); }} aria-label="Volver">{Ic.atras}</button>}
      {otro ? <Avatar p={otro} size={28} estado={enLinea.includes(otro.id) ? 'activo' : 'fuera'} /> : null}
      <h2>{otro ? otro.nombre : <><span className="n" style={{ display: 'inline-flex' }}>{canal.tipo === 'sala' ? Ic.sala : canal.tipo === 'sistema' ? Ic.sistema : Ic.hash}</span>{canal.nombre}</>}{canal.importante && <span className="eq-imp" title="Importante" />}</h2>
      <span className="desc">{otro ? (enLinea.includes(otro.id) ? 'En línea' : otro.visto_at ? `Visto ${hace(otro.visto_at)}` : '') : canal.descripcion}</span>
      {canal.tipo === 'sala' && canal.regla_reunion && !movil && <span style={{ fontSize: '.75rem', color: 'var(--eq-gris)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>{Ic.reloj}{['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][canal.regla_reunion.dia_iso]} {canal.regla_reunion.hora}</span>}
      {canal.tipo === 'sala' && <button className={'eq-ib' + (lado === 'sala' ? ' on' : '')} title="Agenda y actas" onClick={() => setLado(lado === 'sala' ? null : 'sala')} style={movil ? { width: 'auto', padding: '0 10px', gap: 5, fontSize: '.8125rem', fontWeight: 700 } : undefined}>{Ic.sala}{movil ? 'Agenda' : null}</button>}
      {nFijados > 0 && <button className={'eq-ib' + (lado === 'fijados' ? ' on' : '')} title={`${nFijados} ${nFijados === 1 ? 'mensaje fijado' : 'mensajes fijados'}`} onClick={() => setLado(lado === 'fijados' ? null : 'fijados')} style={{ width: 'auto', padding: '0 8px', gap: 3, fontSize: '.75rem', fontWeight: 800 }}>{Ic.pin}{nFijados}</button>}
      <button className={'eq-ib' + (lado === 'buscar' ? ' on' : '')} title="Buscar en este canal" onClick={() => setLado(lado === 'buscar' ? null : 'buscar')}>{Ic.lupa}</button>
      {canal.tipo !== 'directo' && <button className="eq-ib" title={canal.silenciado ? 'Silenciado: activar avisos' : 'Silenciar canal'} onClick={silenciar}>{canal.silenciado ? Ic.campanaOff : Ic.campana}</button>}
      {arbol.yo.role === 'founder' && !movil && <a className="eq-ib" title="Exportar el canal a Markdown" href={`/api/crm/espacio/exportar?canal_id=${canal.id}`} download>{Ic.descargar}</a>}
    </div>
  ) : null;

  return (
    <div className={'eq' + (canalId ? ' en-canal' : '')}>
      <Arbol arbol={arbol} canalId={canalId} enLinea={enLinea} conectado={conectado}
        onAbrir={id => abrir(id)} onDirecto={abrirDirecto} onCambio={cargarArbol} onAviso={toast} onBuscar={() => { setLado('buscar'); if (movil && !canalId) { const g = arbol.canales.find(c => c.nombre === 'general'); if (g) abrir(g.id); } }} />
      <section className="eq-canal">
        {canal ? (
          <Canal key={canal.id} canal={canal} yo={yo} personas={arbol.personas} movil={movil}
            irAMensaje={irA} onAbrirHilo={abrirHilo} onAviso={toast} onVerImagen={setLuz} onLeido={marcarLeido}
            registrarSenal={f => { senalCanal.current = f; }} cabecera={cabecera} ultimoLeidoAt={leidoAl[canal.id] ?? null}
            salas={arbol.canales.filter(c => c.tipo === 'sala')} onCambioSala={() => senalSala.current?.({ tipo: 'reunion', canal_id: canal.id })} />
        ) : (
          <div className="eq-vacio"><b>Elige un canal</b>O escríbele a alguien del equipo desde la lista.</div>
        )}
      </section>
      {lado === 'hilo' && hilo && canal && (
        <aside className="eq-lado">
          <div className="eq-cab">
            <h2>Hilo</h2>
            <span className="desc">en #{canal.nombre}</span>
            <button className="eq-ib" onClick={() => { setLado(null); setHilo(null); const u = new URL(window.location.href); u.searchParams.delete('hilo'); history.replaceState(null, '', u.toString()); }} aria-label="Cerrar hilo">{Ic.cerrar}</button>
          </div>
          <Canal key={'h' + hilo.id} canal={canal} yo={yo} personas={arbol.personas} movil={movil} hiloDe={hilo.id}
            irAMensaje={irA} onAviso={toast} onVerImagen={setLuz} registrarSenal={f => { senalHilo.current = f; }} />
        </aside>
      )}
      {lado === 'sala' && canal && canal.tipo === 'sala' && (
        <aside className="eq-lado">
          <Sala key={'s' + canal.id} canal={canal} yo={yo.id} role={yo.role} personas={arbol.personas} movil={movil}
            onCerrar={() => setLado(null)} onAviso={toast} registrarSenal={f => { senalSala.current = f; }}
            onIr={(c, m, h) => { abrir(c, m, h); if (movil) setLado(null); }} />
        </aside>
      )}
      {lado === 'fijados' && canal && (
        <aside className="eq-lado">
          <Fijados canal={canal} movil={movil} onCerrar={() => setLado(null)} onIr={(m) => { abrir(m.canal_id, m.id, m.hilo_de); if (movil) setLado(null); }} />
        </aside>
      )}
      {lado === 'buscar' && (
        <aside className="eq-lado">
          <Buscar canal={canal} yo={yo.id} onCerrar={() => setLado(null)} onIr={(m) => { abrir(m.canal_id, m.id, m.hilo_de); if (movil) setLado(null); }} />
        </aside>
      )}
      {luz && <div className="eq-luz" onClick={() => setLuz(null)}><img src={luz} alt="" /></div>}
      {toastNodo}
    </div>
  );
}

function Fijados({ canal, movil, onCerrar, onIr }: { canal: C; movil: boolean; onCerrar: () => void; onIr: (m: M) => void }) {
  const [res, setRes] = useState<M[] | null>(null);
  useEffect(() => { api.fijados(canal.id).then(r => setRes(r.mensajes)).catch(() => setRes([])); }, [canal.id]);
  return (
    <>
      <div className="eq-cab">
        {movil && <button className="eq-ib" onClick={onCerrar} aria-label="Volver">{Ic.atras}</button>}
        <h2>{Ic.pin} Fijados</h2>
        <span className="desc">en #{canal.nombre}{res ? ` · ${res.length} de 15` : ''}</span>
        {!movil && <button className="eq-ib" onClick={onCerrar} aria-label="Cerrar">{Ic.cerrar}</button>}
      </div>
      <div className="eq-lista">
        {!res && <Cargando texto="Cargando fijados…" alto={120} />}
        {res && !res.length && <div className="eq-vacio"><b>Nada fijado</b>Fija lo que el equipo debe tener a la mano: acuerdos, ligas, reglas. Hasta 15 por canal.</div>}
        {res && res.length > 0 && (
          <div className="eq-res">{res.map(m => (
            <button key={m.id} onClick={() => onIr(m)}>
              <div className="m"><b>{m.autor.nombre}</b><span>{hace(m.created_at)}</span>{m.hilo_de && <span>· en hilo</span>}</div>
              <div className="t" style={{ whiteSpace: 'pre-wrap', maxHeight: 64, overflow: 'hidden' }}>{textoPlano(m.texto).replace(/\*\*/g, '') || (m.adjuntos.length ? `[${m.adjuntos[0].tipo}]` : '')}</div>
            </button>
          ))}</div>
        )}
      </div>
    </>
  );
}

function Buscar({ canal, yo, onCerrar, onIr }: { canal: C | null; yo: string; onCerrar: () => void; onIr: (m: M) => void }) {
  const [q, setQ] = useState(''); const [todo, setTodo] = useState(!canal);
  const [res, setRes] = useState<M[] | null>(null); const [ocupado, setOcupado] = useState(false);
  const t = useRef<any>(null);
  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 2) { setRes(null); return; }
    t.current = setTimeout(async () => {
      setOcupado(true);
      try { const r = await api.buscar(q.trim(), todo ? undefined : canal?.id); setRes(r.resultados); } catch { setRes([]); } finally { setOcupado(false); }
    }, 300);
  }, [q, todo, canal?.id]);
  return (
    <>
      <div className="eq-cab">
        <div className="eq-busca" style={{ maxWidth: 'none' }}>{Ic.lupa}<input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={todo || !canal ? 'Buscar en todo Equipo' : `Buscar en #${canal.nombre}`} /></div>
        <button className="eq-ib" onClick={onCerrar} aria-label="Cerrar búsqueda">{Ic.cerrar}</button>
      </div>
      {canal && <div style={{ padding: '8px 14px 0', fontSize: '.75rem', color: 'var(--eq-gris)', display: 'flex', gap: 8 }}>
        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={todo} onChange={e => setTodo(e.target.checked)} /> En todos los canales</label>
      </div>}
      <div className="eq-lista">
        {ocupado && <Cargando texto="Buscando…" alto={120} />}
        {!ocupado && res && !res.length && <div className="eq-vacio"><b>Nada con «{q}»</b>Prueba con otra palabra.</div>}
        {!ocupado && !res && <div className="eq-vacio">Escribe al menos dos letras.<br />Busca en texto y en transcripciones de audio.</div>}
        {!ocupado && res && res.length > 0 && (
          <div className="eq-res">{res.map(m => (
            <button key={m.id} onClick={() => onIr(m)}>
              <div className="m"><b>{m.autor.nombre}</b><span>{hace(m.created_at)}</span>{(m as any).canal_nombre && <span>· #{(m as any).canal_nombre}</span>}{m.hilo_de && <span>· en hilo</span>}</div>
              <div className="t">{textoPlano(m.texto) || (m.adjuntos.length ? `[${m.adjuntos[0].tipo}]` : '')}</div>
            </button>
          ))}</div>
        )}
      </div>
    </>
  );
}
