// La conversación de un canal (o de un hilo, con enHilo): cabecera, lista con
// separadores de día y línea de "nuevo", carga hacia atrás al subir, y la caja.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Canal as C, Mensaje as M, Persona, Adjunto } from './api';
import { api, diaEtiqueta, mismoDia } from './api';
import { useMensajes } from './useMensajes';
import type { Senal } from './useRealtime';
import Mensaje from './Mensaje';
import type { Acciones } from './Mensaje';
import Caja from './Caja';
import Cargando from '../ui/Cargando';
import ActionSheet from '../ui/ActionSheet';
import { Ic, RAPIDOS, textoPlano } from './ui';
import { ModalConfirmar } from './Gestion';

export type CanalProps = {
  canal: C;
  yo: { id: string; nombre: string; foto_url: string | null; role?: string };
  personas: Persona[];
  movil: boolean;
  hiloDe?: string | null;              // si viene, esta vista ES un hilo
  irAMensaje?: string | null;          // resaltar y hacer scroll a este id
  onAbrirHilo?: (m: M) => void;
  onAviso: (m: string) => void;
  onVerImagen: (url: string) => void;
  onLeido?: (canalId: string) => void;
  registrarSenal: (fn: ((s: Senal) => void) | null) => void;
  cabecera?: React.ReactNode;
  ultimoLeidoAt?: string | null;
  extraEnvio?: { sesion_id?: string | null; punto_id?: string | null };
  bloqueada?: string | null;
  salas?: C[];                         // para "Llevar a la agenda de…"
  onCambioSala?: (canalId: string) => void;
};

export default function Canal(p: CanalProps) {
  const hilo = p.hiloDe || null;
  const st = useMensajes(p.canal.id, hilo, p.yo);
  const [respondeA, setRespondeA] = useState<M | null>(null);
  const [editando, setEditando] = useState<M | null>(null);
  const [menu, setMenu] = useState<M | null>(null);
  const [agendar, setAgendar] = useState<M | null>(null);
  const [porBorrar, setPorBorrar] = useState<M | null>(null);
  const founder = p.yo.role === 'founder';
  const [resaltado, setResaltado] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const alFondo = useRef(true);
  const alturaPrev = useRef(0);
  const [nuevosAbajo, setNuevosAbajo] = useState(0);

  useEffect(() => { p.registrarSenal(st.alSenal); return () => p.registrarSenal(null); }, [st.alSenal]);
  useEffect(() => { setRespondeA(null); setEditando(null); }, [p.canal.id, hilo]);

  // Quedarse abajo cuando llega algo y ya estaba abajo; si no, avisar.
  const nRef = useRef(st.lista.length);
  useLayoutEffect(() => {
    const el = lista.current; if (!el) return;
    if (st.lista.length > nRef.current) {
      const ultimo = st.lista[st.lista.length - 1];
      if (alFondo.current || ultimo?.mio) { el.scrollTop = el.scrollHeight; setNuevosAbajo(0); }
      else setNuevosAbajo(n => n + (st.lista.length - nRef.current));
    }
    nRef.current = st.lista.length;
  }, [st.lista]);
  // Al cargar el canal, al fondo (o al mensaje pedido).
  useLayoutEffect(() => {
    const el = lista.current; if (!el || st.cargando) return;
    if (p.irAMensaje) {
      const n = document.getElementById('m-' + p.irAMensaje);
      if (n) { n.scrollIntoView({ block: 'center' }); setResaltado(p.irAMensaje); setTimeout(() => setResaltado(null), 2500); return; }
    }
    el.scrollTop = el.scrollHeight;
  }, [st.cargando, p.canal.id, hilo]);
  useEffect(() => {
    if (!p.irAMensaje || st.cargando) return;
    if (!st.lista.some(m => m.id === p.irAMensaje) && !hilo) st.cargar(p.irAMensaje);
  }, [p.irAMensaje, st.cargando]);

  // Marcar leído cuando estoy abajo y la pestaña visible.
  useEffect(() => {
    if (hilo || !st.lista.length || document.visibilityState !== 'visible' || !alFondo.current) return;
    p.onLeido?.(p.canal.id);
  }, [st.lista, p.canal.id]);

  const alScroll = useCallback(() => {
    const el = lista.current; if (!el) return;
    alFondo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (alFondo.current && nuevosAbajo) { setNuevosAbajo(0); p.onLeido?.(p.canal.id); }
    if (el.scrollTop < 80 && st.hayMas) {
      alturaPrev.current = el.scrollHeight;
      st.masAntiguos().then(() => {
        // Conservar la posición: lo nuevo entra arriba sin brincar la vista.
        requestAnimationFrame(() => { if (lista.current) lista.current.scrollTop += lista.current.scrollHeight - alturaPrev.current; });
      });
    }
  }, [st.hayMas, st.masAntiguos, nuevosAbajo]);

  const irA = (id: string) => {
    const n = document.getElementById('m-' + id);
    if (n) { n.scrollIntoView({ block: 'center', behavior: 'smooth' }); setResaltado(id); setTimeout(() => setResaltado(null), 2500); }
    else st.cargar(id);
  };

  const acc: Acciones = {
    reaccionar: st.reaccionar,
    responder: m => { setEditando(null); setRespondeA(m); },
    abrirHilo: m => p.onAbrirHilo?.(m),
    editar: m => { setRespondeA(null); setEditando(m); },
    borrar: m => setPorBorrar(m),
    copiarLiga: m => {
      const u = new URL(window.location.href); u.searchParams.set('tab', 'equipo'); u.searchParams.set('canal', p.canal.id); u.searchParams.set('msg', m.id);
      if (m.hilo_de) u.searchParams.set('hilo', m.hilo_de); else u.searchParams.delete('hilo');
      navigator.clipboard?.writeText(u.toString()).then(() => p.onAviso('Liga copiada')).catch(() => p.onAviso(u.toString()));
    },
    fijar: async m => {
      try { await st.fijar(m.id, !m.fijado); p.onAviso(m.fijado ? 'Mensaje desfijado' : 'Fijado en el canal'); } catch (e: any) { p.onAviso(e.message); }
    },
    agendar: m => {
      const salas = p.salas || [];
      if (!salas.length) { p.onAviso('No hay salas de reunión'); return; }
      if (salas.length === 1) llevarA(m, salas[0]); else setAgendar(m);
    },
    irA,
    irACrm: d => window.dispatchEvent(new CustomEvent('crm:ir', { detail: d })),
    verImagen: p.onVerImagen,
    menuMovil: m => setMenu(m),
  };
  const llevarA = async (m: M, sala: C) => {
    const titulo = (textoPlano(m.texto).split('\n')[0] || (m.adjuntos[0]?.transcripcion || '') || 'Ver este mensaje').slice(0, 120);
    try { await api.salaAccion({ accion: 'proponer', canal_id: sala.id, titulo, origen_mensaje_id: m.id }); p.onAviso(`En la agenda de #${sala.nombre}`); p.onCambioSala?.(sala.id); }
    catch (e: any) { p.onAviso(e.message); }
    setAgendar(null);
  };

  const enviar = async (texto: string, adjuntos: Adjunto[]) => {
    const r = respondeA; setRespondeA(null);
    alFondo.current = true;
    await st.enviar(texto, adjuntos, r, p.extraEnvio);
  };

  // Un mensaje borrado desaparece; solo se queda como "Mensaje eliminado" si ancla un hilo con respuestas.
  const visibles = st.lista.filter(m => !m.borrado || (m.hilo && m.hilo.n > 0));
  const titulo = p.canal.tipo === 'directo' ? (p.personas.find(x => p.canal.participantes.includes(x.id) && x.id !== p.yo.id)?.nombre || 'Directo') : p.canal.nombre;
  const marcaNuevo = p.ultimoLeidoAt || null;
  let nuevoPuesto = false;

  return (
    <>
      {p.cabecera}
      <div className="eq-lista" ref={lista} onScroll={alScroll}>
        {st.cargando && !st.lista.length ? <Cargando texto={hilo ? 'Abriendo el hilo…' : `Cargando #${titulo}…`} /> : null}
        {st.error && <div className="eq-vacio"><b>No se pudo cargar</b>{st.error}<button className="eq-btn" onClick={() => st.cargar()}>Reintentar</button></div>}
        {!st.cargando && !st.error && !visibles.length && !hilo && (
          <div className="eq-vacio"><b>{p.canal.tipo === 'directo' ? `Aquí empieza tu conversación con ${titulo}` : `Aquí empieza #${titulo}`}</b>{p.canal.descripcion || 'Todavía no hay mensajes. Escribe el primero.'}</div>
        )}
        {hilo && st.raiz && (
          <>
            <Mensaje m={st.raiz} yo={p.yo.id} seguido={false} enHilo acc={acc} movil={p.movil} admin={founder} />
            <div className="eq-dia">{st.lista.length ? `${st.lista.length} ${st.lista.length === 1 ? 'respuesta' : 'respuestas'}` : 'Sin respuestas todavía'}</div>
          </>
        )}
        {visibles.map((m, i) => {
          const prev = visibles[i - 1];
          const cambioDia = !prev || !mismoDia(prev.created_at, m.created_at);
          const seguido = !!prev && !cambioDia && prev.autor.id === m.autor.id && !m.responde_a && !prev.borrado
            && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60_000;
          let nuevo = false;
          if (!hilo && marcaNuevo && !nuevoPuesto && !m.mio && m.created_at > marcaNuevo) { nuevo = true; nuevoPuesto = true; }
          return (
            <div key={m.id}>
              {cambioDia && !hilo && <div className="eq-dia">{diaEtiqueta(m.created_at)}</div>}
              {nuevo && <div className="eq-nuevo">Nuevo</div>}
              <Mensaje m={m} yo={p.yo.id} seguido={seguido && !nuevo} enHilo={!!hilo} resaltado={resaltado === m.id} acc={acc} movil={p.movil} admin={founder} />
            </div>
          );
        })}
      </div>
      {nuevosAbajo > 0 && (
        <div style={{ position: 'relative' }}>
          <button className="eq-btn p" style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', boxShadow: '0 4px 14px rgba(60,30,140,.25)', zIndex: 3 }}
            onClick={() => { const el = lista.current; if (el) el.scrollTop = el.scrollHeight; setNuevosAbajo(0); }}>
            {nuevosAbajo} {nuevosAbajo === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} ↓
          </button>
        </div>
      )}
      <Caja
        canalId={p.canal.id + (hilo || '')}
        placeholder={hilo ? 'Responder en el hilo…' : p.canal.tipo === 'directo' ? `Escribe a ${titulo}` : `Escribe en #${titulo}`}
        personas={p.personas} yoId={p.yo.id}
        respondeA={respondeA} onQuitarResp={() => setRespondeA(null)}
        editando={editando} onCancelarEdicion={() => setEditando(null)}
        onEnviar={enviar} onEditar={async (id, t) => { await st.editar(id, t); setEditando(null); }}
        onAviso={p.onAviso} autoFoco={!p.movil}
        bloqueada={p.bloqueada || (p.canal.tipo === 'sistema' && !hilo ? 'Aquí escribe el sistema. Abre un hilo para comentar.' : null)}
      />
      <ActionSheet open={!!menu} onClose={() => setMenu(null)} title={menu ? textoPlano(menu.texto).slice(0, 60) || 'Mensaje' : ''} items={menu ? [
        { label: <span style={{ display: 'flex', gap: 10, fontSize: '1.25rem' }}>{RAPIDOS.slice(0, 6).map(e => <span key={e} onClick={(ev) => { ev.stopPropagation(); acc.reaccionar(menu, e); setMenu(null); }}>{e}</span>)}</span>, onClick: () => null },
        { label: 'Responder', icon: Ic.responder, onClick: () => { acc.responder(menu); setMenu(null); } },
        ...(!hilo ? [{ label: 'Abrir hilo', icon: Ic.hilo, onClick: () => { acc.abrirHilo(menu); setMenu(null); } }] : []),
        { label: 'Copiar liga', icon: Ic.liga, onClick: () => { acc.copiarLiga(menu); setMenu(null); } },
        { label: menu.fijado ? 'Desfijar' : 'Fijar en el canal', icon: Ic.pin, onClick: () => { acc.fijar(menu); setMenu(null); } },
        { label: 'Llevar a la agenda de…', icon: Ic.sala, onClick: () => { setMenu(null); acc.agendar(menu); } },
        ...(menu.mio ? [{ label: 'Editar', icon: Ic.editar, onClick: () => { acc.editar(menu); setMenu(null); } }] : []),
        ...(menu.mio || founder ? [{ label: 'Eliminar', icon: Ic.basura, danger: true, onClick: () => { acc.borrar(menu); setMenu(null); } }] : []),
      ] : []} />
      {porBorrar && (
        <ModalConfirmar titulo="Eliminar mensaje" boton="Eliminar" onClose={() => setPorBorrar(null)}
          cuerpo={<>
            {!porBorrar.mio && <div style={{ marginBottom: 6 }}>Es de <b>{porBorrar.autor.nombre}</b>; lo borras como founder.</div>}
            {porBorrar.hilo && porBorrar.hilo.n > 0 ? <div style={{ marginBottom: 6 }}>Tiene un hilo con {porBorrar.hilo.n} {porBorrar.hilo.n === 1 ? 'respuesta' : 'respuestas'}: el hilo se queda, el mensaje se ve como eliminado.</div> : null}
            <div style={{ padding: '8px 10px', borderLeft: '3px solid var(--eq-linea)', color: 'var(--eq-gris)', fontSize: '.8125rem', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>{textoPlano(porBorrar.texto).slice(0, 300) || (porBorrar.adjuntos.length ? `${porBorrar.adjuntos.length} ${porBorrar.adjuntos.length === 1 ? 'archivo' : 'archivos'}` : '')}</div>
            {porBorrar.adjuntos.length > 0 && <div style={{ marginTop: 6, color: 'var(--eq-gris)', fontSize: '.8125rem' }}>Sus archivos también se borran.</div>}
          </>}
          onConfirmar={async () => { await st.borrar(porBorrar.id); setPorBorrar(null); }} />
      )}
      <ActionSheet open={!!agendar} onClose={() => setAgendar(null)} title="Llevar a la agenda de…" items={agendar ? (p.salas || []).map(s => ({ label: `#${s.nombre}`, icon: Ic.sala, onClick: () => llevarA(agendar, s) })) : []} />
    </>
  );
}
