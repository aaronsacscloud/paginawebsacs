// Las publicaciones de un canal: notas, checklists y proyectos que se trabajan
// entre los dos sin salir del canal. La lista, la publicación abierta (con sus
// renglones palomeables, responsable y fecha por renglón) y el editor.
// Cada publicación deja una tarjeta en la conversación; su hilo son los comentarios.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Canal as C, Persona, Publicacion, PubItem, PubTipo } from './api';
import { api, hace } from './api';
import type { Senal } from './useRealtime';
import { Ic, Avatar, Texto } from './ui';
import Cargando from '../ui/Cargando';

const TIPOS: { v: PubTipo; t: string; d: string }[] = [
  { v: 'nota', t: 'Nota', d: 'Texto que se consulta: acuerdos, contexto, referencias' },
  { v: 'checklist', t: 'Checklist', d: 'Renglones que se palomean entre los dos' },
  { v: 'proyecto', t: 'Proyecto', d: 'Renglones por fase, con responsable y fecha' },
];
const ETIQ: Record<PubTipo, string> = { nota: 'Nota', checklist: 'Checklist', proyecto: 'Proyecto' };
const TZ = 'America/Mexico_City';
const hoyYmd = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
const fFecha = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short' }).replace(/\./g, ''); };
const primero = (n?: string | null) => (n || '').split(' ')[0];
/** Cómo va una fecha: vencida, hoy, o por venir. */
const estadoFecha = (ymd: string | null, hecho: boolean) => !ymd || hecho ? '' : ymd < hoyYmd() ? ' vencido' : ymd === hoyYmd() ? ' hoy' : '';

export type PublicacionesProps = {
  canal: C; yo: string; role: string; personas: Persona[]; movil: boolean;
  abrirId: string | null;                    // la tarjeta del chat pide abrir una en concreto
  onCerrar: () => void; onAviso: (m: string) => void;
  onIr: (canalId: string, msgId: string, hiloDe?: string | null) => void;
  onComentarios: (msgId: string) => void;
  registrarSenal: (fn: ((s: Senal) => void) | null) => void;
};

type Vista = { modo: 'lista' } | { modo: 'ver'; id: string } | { modo: 'nueva'; tipo: PubTipo } | { modo: 'editar'; id: string };

export default function Publicaciones(p: PublicacionesProps) {
  const [lista, setLista] = useState<Publicacion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>(p.abrirId ? { modo: 'ver', id: p.abrirId } : { modo: 'lista' });
  const [filtro, setFiltro] = useState<'abiertas' | 'cerradas'>('abiertas');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const t = useRef<any>(null);

  const cargar = useCallback(async () => {
    try { const r = await api.publicaciones(p.canal.id); setLista(r.publicaciones); setErr(null); } catch (e: any) { setErr(e.message); }
  }, [p.canal.id]);
  useEffect(() => { setLista(null); cargar(); }, [cargar]);
  useEffect(() => { if (p.abrirId) setVista({ modo: 'ver', id: p.abrirId }); }, [p.abrirId]);
  useEffect(() => {
    p.registrarSenal(s => {
      if (s.tipo === 'pub' && s.canal_id === p.canal.id) { clearTimeout(t.current); t.current = setTimeout(cargar, 200); }
    });
    return () => p.registrarSenal(null);
  }, [cargar, p.canal.id]);

  const accion = async (b: any, ok?: string): Promise<Publicacion | null | false> => {
    const k = b.item_id || b.id || b.accion; setOcupado(k);
    try {
      const r = await api.pubAccion(b);
      if (ok) p.onAviso(ok);
      // La respuesta ya trae la publicación al día: se pinta sin esperar la señal.
      if (r.publicacion) setLista(l => l ? (l.some(x => x.id === r.publicacion!.id) ? l.map(x => x.id === r.publicacion!.id ? r.publicacion! : x) : [r.publicacion!, ...l]) : l);
      else if (b.accion === 'borrar') setLista(l => l ? l.filter(x => x.id !== b.id) : l);
      return r.publicacion ?? null;
    } catch (e: any) { p.onAviso(e.message); return false; }
    finally { setOcupado(null); }
  };

  const gente = p.personas.filter(x => x.rol !== 'soporte');
  const abierta = vista.modo === 'ver' || vista.modo === 'editar' ? lista?.find(x => x.id === vista.id) || null : null;
  const abiertas = (lista || []).filter(x => x.estado === 'abierta');
  const cerradas = (lista || []).filter(x => x.estado === 'cerrada');
  const volver = () => setVista({ modo: 'lista' });

  // ── Cabecera ──
  const cab = (titulo: string, sub: string | null, extra?: any) => (
    <div className="eq-cab">
      {vista.modo !== 'lista' ? <button className="eq-ib" onClick={volver} aria-label="Volver">{Ic.atras}</button> : p.movil && <button className="eq-ib" onClick={p.onCerrar} aria-label="Volver">{Ic.atras}</button>}
      <h2 style={{ minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</span></h2>
      {sub && <span className="desc">{sub}</span>}
      <span style={{ flex: 1 }} />
      {extra}
      {!p.movil && <button className="eq-ib" onClick={p.onCerrar} aria-label="Cerrar">{Ic.cerrar}</button>}
    </div>
  );

  if (vista.modo === 'nueva' || (vista.modo === 'editar' && abierta)) {
    const base = vista.modo === 'editar' ? abierta! : null;
    return (
      <>
        {cab(base ? 'Editar publicación' : 'Nueva publicación', null)}
        <Editor base={base} tipo={vista.modo === 'nueva' ? vista.tipo : abierta!.tipo} gente={gente} yo={p.yo} ocupado={ocupado === 'crear' || ocupado === base?.id}
          onCancelar={() => base ? setVista({ modo: 'ver', id: base.id }) : volver()}
          onGuardar={async (b) => {
            const r = base ? await accion({ accion: 'editar', id: base.id, ...b }, 'Guardado') : await accion({ accion: 'crear', canal_id: p.canal.id, ...b }, 'Publicado en el canal');
            if (r) setVista({ modo: 'ver', id: r.id });
          }} />
      </>
    );
  }

  if (vista.modo === 'ver') {
    if (!lista) return <>{cab('Publicación', null)}<Cargando texto="Abriendo la publicación…" /></>;
    if (!abierta) return <>{cab('Publicación', null)}<div className="eq-vacio"><b>Ya no está</b>La borraron o es de otro canal.<button className="eq-btn" onClick={volver}>Ver la lista</button></div></>;
    return (
      <>
        {cab(ETIQ[abierta.tipo], abierta.fijada ? 'Fijada' : null, (
          <>
            <button className={'eq-ib' + (abierta.fijada ? ' on' : '')} title={abierta.fijada ? 'Quitar de fijadas' : 'Fijar arriba'} onClick={() => accion({ accion: 'fijar', id: abierta.id, fijada: !abierta.fijada })}>{Ic.pin}</button>
            <button className="eq-ib" title="Editar" onClick={() => setVista({ modo: 'editar', id: abierta.id })}>{Ic.editar}</button>
          </>
        ))}
        <Detalle pub={abierta} gente={gente} yo={p.yo} role={p.role} ocupado={ocupado} accion={accion} movil={p.movil}
          onComentarios={() => abierta.mensaje_id && p.onComentarios(abierta.mensaje_id)}
          onVerEnCanal={() => abierta.mensaje_id && p.onIr(abierta.canal_id, abierta.mensaje_id)}
          onBorrada={volver} />
      </>
    );
  }

  return (
    <>
      {cab('Publicaciones', lista ? `${abiertas.length} ${abiertas.length === 1 ? 'abierta' : 'abiertas'}` : null)}
      <div className="eq-pub-nueva">
        {TIPOS.map(x => <button key={x.v} className="eq-btn t" title={x.d} onClick={() => setVista({ modo: 'nueva', tipo: x.v })}>{Ic.mas} {x.t}</button>)}
      </div>
      <div className="eq-tabs">
        <button className={filtro === 'abiertas' ? 'on' : ''} onClick={() => setFiltro('abiertas')}>Abiertas{abiertas.length ? ` · ${abiertas.length}` : ''}</button>
        <button className={filtro === 'cerradas' ? 'on' : ''} onClick={() => setFiltro('cerradas')}>Cerradas{cerradas.length ? ` · ${cerradas.length}` : ''}</button>
      </div>
      {!lista && !err && <Cargando texto="Trayendo las publicaciones…" />}
      {err && <div className="eq-vacio"><b>No se pudieron traer</b>{err}<button className="eq-btn" onClick={cargar}>Reintentar</button></div>}
      {lista && (
        <div className="eq-pubs">
          {(filtro === 'abiertas' ? abiertas : cerradas).map(x => <Tarjeta key={x.id} pub={x} onAbrir={() => setVista({ modo: 'ver', id: x.id })} />)}
          {filtro === 'abiertas' && !abiertas.length && <div className="eq-vacio"><b>Nada publicado aún</b>Una nota para no perder el contexto, un checklist para repartir el trabajo o un proyecto con sus fases.</div>}
          {filtro === 'cerradas' && !cerradas.length && <div className="eq-vacio"><b>Nada cerrado</b>Lo que se termine o ya no aplique se cierra y se queda aquí.</div>}
        </div>
      )}
    </>
  );
}

/** Una publicación en la lista (y la misma forma que la tarjeta del chat). */
function Tarjeta({ pub, onAbrir }: { pub: Publicacion; onAbrir: () => void }) {
  const pct = pub.n ? Math.round(pub.hechos / pub.n * 100) : 0;
  return (
    <button className={'eq-pub' + (pub.estado === 'cerrada' ? ' cerrada' : '')} onClick={onAbrir}>
      <div className="fila">
        <span className={'eq-pub-tipo ' + pub.tipo}>{ETIQ[pub.tipo]}</span>
        {pub.fijada && <span className="eq-pub-pin" title="Fijada">{Ic.pin}</span>}
        <b>{pub.titulo}</b>
      </div>
      {pub.n > 0 && <div className="eq-pub-barra"><i style={{ width: pct + '%' }} /></div>}
      <div className="meta">
        {pub.n > 0 && <span className={pub.hechos === pub.n ? 'ok' : ''}>{pub.hechos}/{pub.n}</span>}
        {pub.responsable && <span className="quien"><Avatar p={pub.responsable} size={16} />{primero(pub.responsable.nombre)}</span>}
        {pub.vence_at && <span className={'fecha' + estadoFecha(pub.vence_at, pub.estado === 'cerrada')}>{Ic.reloj}{fFecha(pub.vence_at)}</span>}
        <span className="t">{hace(pub.updated_at)}</span>
      </div>
    </button>
  );
}

// ── La publicación abierta ──
type DetalleProps = {
  pub: Publicacion; gente: Persona[]; yo: string; role: string; ocupado: string | null; movil: boolean;
  accion: (b: any, ok?: string) => Promise<Publicacion | null | false>;
  onComentarios: () => void; onVerEnCanal: () => void; onBorrada: () => void;
};
function Detalle({ pub, gente, yo, role, ocupado, accion, onComentarios, onVerEnCanal, onBorrada }: DetalleProps) {
  const [nuevo, setNuevo] = useState<Record<string, string>>({});
  const [nuevoGrupo, setNuevoGrupo] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const orden: (string | null)[] = []; const por: Record<string, PubItem[]> = {};
    for (const it of pub.items) { const g = it.grupo || ''; if (!(g in por)) { por[g] = []; orden.push(it.grupo); } por[g].push(it); }
    if (!orden.length) orden.push(null);
    return orden.map(g => ({ nombre: g, items: por[g || ''] || [] }));
  }, [pub.items]);
  const pct = pub.n ? Math.round(pub.hechos / pub.n * 100) : 0;
  const cerrada = pub.estado === 'cerrada';
  const puedeBorrar = pub.autor_id === yo || role === 'founder';

  const agregar = async (grupo: string | null) => {
    const k = grupo || ''; const texto = (nuevo[k] || '').trim(); if (!texto) return;
    const r = await accion({ accion: 'item_agregar', id: pub.id, texto, grupo });
    if (r) setNuevo(n => ({ ...n, [k]: '' }));
  };
  const agregarGrupo = async () => {
    const g = (nuevoGrupo || '').trim(); if (!g) { setNuevoGrupo(null); return; }
    const r = await accion({ accion: 'item_agregar', id: pub.id, texto: 'Primer paso', grupo: g });
    if (r) setNuevoGrupo(null);
  };
  const mover = (it: PubItem, dir: -1 | 1) => {
    const ids = pub.items.map(x => x.id); const i = ids.indexOf(it.id); const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    accion({ accion: 'item_orden', id: pub.id, orden: ids });
  };

  return (
    <div className="eq-pub-ver">
      <h3>{pub.titulo}</h3>
      <div className="eq-pub-meta">
        <Quien etiqueta="Responsable" valor={pub.responsable_id} gente={gente} onCambio={id => accion({ accion: 'editar', id: pub.id, responsable_id: id })} />
        <Fecha etiqueta="Para el" valor={pub.vence_at} hecho={cerrada} onCambio={f => accion({ accion: 'editar', id: pub.id, vence_at: f })} />
        <span className="dato"><small>Creó</small>{primero(pub.autor?.nombre)} · {hace(pub.created_at)}</span>
        {cerrada && <span className="dato cerr"><small>Cerrada</small>{pub.cerrada_at ? hace(pub.cerrada_at) : ''}</span>}
      </div>
      {pub.n > 0 && (
        <div className="eq-pub-avance">
          <div className="eq-pub-barra"><i style={{ width: pct + '%' }} /></div>
          <b className={pub.hechos === pub.n ? 'ok' : ''}>{pub.hechos}/{pub.n}</b>
        </div>
      )}
      {pub.cuerpo && <div className="eq-pub-cuerpo"><Texto t={pub.cuerpo} yo={yo} /></div>}

      {grupos.map(g => (
        <div key={g.nombre || ''} className="eq-bloque">
          {(g.nombre || pub.tipo === 'proyecto') && <div className="cab"><b>{g.nombre || 'Sin fase'}</b><span className="n">{g.items.filter(i => i.hecho_at).length}/{g.items.length}</span></div>}
          {g.items.map(it => (
            <Renglon key={it.id} it={it} gente={gente} ocupado={ocupado === it.id} editando={editando === it.id} cerrada={cerrada}
              onEditar={on => setEditando(on ? it.id : null)}
              onHecho={h => accion({ accion: 'item_hecho', item_id: it.id, hecho: h })}
              onTexto={texto => accion({ accion: 'item_editar', item_id: it.id, texto })}
              onQuien={id => accion({ accion: 'item_editar', item_id: it.id, responsable_id: id })}
              onFecha={f => accion({ accion: 'item_editar', item_id: it.id, vence_at: f })}
              onBorrar={() => accion({ accion: 'item_borrar', item_id: it.id })}
              onMover={d => mover(it, d)} />
          ))}
          {!cerrada && (
            <div className="eq-pub-agregar">
              <span className="caja" />
              <input placeholder={g.items.length ? 'Otro renglón…' : 'Primer renglón…'} value={nuevo[g.nombre || ''] || ''}
                onChange={e => setNuevo(n => ({ ...n, [g.nombre || '']: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(g.nombre); } }} />
              {(nuevo[g.nombre || ''] || '').trim() && <button className="eq-btn p" disabled={ocupado === pub.id} onClick={() => agregar(g.nombre)}>Agregar</button>}
            </div>
          )}
        </div>
      ))}
      {!cerrada && pub.tipo === 'proyecto' && (
        nuevoGrupo === null ? <button className="eq-btn t" style={{ alignSelf: 'flex-start' }} onClick={() => setNuevoGrupo('')}>{Ic.mas} Fase</button>
          : <div className="eq-pub-agregar solo"><input autoFocus placeholder="Nombre de la fase" value={nuevoGrupo} onChange={e => setNuevoGrupo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarGrupo(); if (e.key === 'Escape') setNuevoGrupo(null); }} /><button className="eq-btn p" onClick={agregarGrupo}>Crear</button></div>
      )}

      <div className="eq-pub-acciones">
        {pub.mensaje_id && <button className="eq-btn" onClick={onComentarios}>{Ic.hilo} Comentarios</button>}
        {pub.mensaje_id && <button className="eq-btn t" onClick={onVerEnCanal}>Ver en el canal</button>}
        <span style={{ flex: 1 }} />
        <button className="eq-btn t" disabled={ocupado === pub.id} onClick={() => accion({ accion: 'estado', id: pub.id, estado: cerrada ? 'abierta' : 'cerrada' }, cerrada ? 'Reabierta' : 'Cerrada')}>{cerrada ? 'Reabrir' : 'Cerrar'}</button>
        {puedeBorrar && <button className="eq-btn d" disabled={ocupado === pub.id} onClick={async () => { if (!confirm(`¿Borrar "${pub.titulo}" con sus renglones y comentarios?`)) return; const r = await accion({ accion: 'borrar', id: pub.id }, 'Borrada'); if (r !== false) onBorrada(); }}>{Ic.basura}</button>}
      </div>
    </div>
  );
}

type RenglonProps = {
  it: PubItem; gente: Persona[]; ocupado: boolean; editando: boolean; cerrada: boolean;
  onEditar: (on: boolean) => void; onHecho: (h: boolean) => void; onTexto: (t: string) => void;
  onQuien: (id: string | null) => void; onFecha: (f: string | null) => void; onBorrar: () => void; onMover: (d: -1 | 1) => void;
};
function Renglon({ it, gente, ocupado, editando, cerrada, onEditar, onHecho, onTexto, onQuien, onFecha, onBorrar, onMover }: RenglonProps) {
  const [txt, setTxt] = useState(it.texto);
  useEffect(() => { if (editando) setTxt(it.texto); }, [editando, it.texto]);
  const hecho = !!it.hecho_at;
  const guardar = () => { const v = txt.trim(); if (v && v !== it.texto) onTexto(v); onEditar(false); };
  return (
    <div className={'eq-renglon' + (hecho ? ' hecho' : '') + estadoFecha(it.vence_at, hecho)}>
      <button className={'caja' + (hecho ? ' on' : '')} disabled={ocupado || cerrada} onClick={() => onHecho(!hecho)} aria-label={hecho ? 'Desmarcar' : 'Marcar hecho'}>{hecho && Ic.check}</button>
      <div className="tt">
        {editando ? (
          <input autoFocus value={txt} onChange={e => setTxt(e.target.value)} onBlur={guardar}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } if (e.key === 'Escape') { setTxt(it.texto); onEditar(false); } }} />
        ) : <span className="texto" onClick={() => !cerrada && onEditar(true)} title={cerrada ? undefined : 'Editar'}>{it.texto}</span>}
        <div className="sub">
          {hecho && it.hecho_por_p && <span className="ok">{primero(it.hecho_por_p.nombre)} · {hace(it.hecho_at!)}</span>}
          <Quien etiqueta={null} valor={it.responsable_id} gente={gente} chico onCambio={onQuien} />
          <Fecha etiqueta={null} valor={it.vence_at} hecho={hecho} chico onCambio={onFecha} />
        </div>
      </div>
      {!cerrada && (
        <div className="acc">
          <button className="eq-ib" onClick={() => onMover(-1)} title="Subir">{Ic.arriba}</button>
          <button className="eq-ib" onClick={() => onMover(1)} title="Bajar">{Ic.abajo}</button>
          <button className="eq-ib" onClick={onBorrar} title="Quitar">{Ic.basura}</button>
        </div>
      )}
    </div>
  );
}

/** Responsable: la persona o "sin asignar"; se cambia con un select disfrazado. */
function Quien({ etiqueta, valor, gente, chico, onCambio }: { etiqueta: string | null; valor: string | null; gente: Persona[]; chico?: boolean; onCambio: (id: string | null) => void }) {
  const per = gente.find(g => g.id === valor) || null;
  return (
    <label className={'eq-pub-sel' + (chico ? ' chico' : '') + (per ? '' : ' vacio')} title="Responsable">
      {etiqueta && <small>{etiqueta}</small>}
      {per ? <><Avatar p={per} size={chico ? 14 : 18} />{primero(per.nombre)}</> : <>{Ic.gente}{chico ? '' : 'Sin asignar'}</>}
      <select value={valor || ''} onChange={e => onCambio(e.target.value || null)}>
        <option value="">Sin asignar</option>
        {gente.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
      </select>
    </label>
  );
}

/** Fecha límite: se muestra corta y se cambia con el date nativo. */
function Fecha({ etiqueta, valor, hecho, chico, onCambio }: { etiqueta: string | null; valor: string | null; hecho: boolean; chico?: boolean; onCambio: (f: string | null) => void }) {
  return (
    <label className={'eq-pub-sel' + (chico ? ' chico' : '') + (valor ? '' : ' vacio') + estadoFecha(valor, hecho)} title="Fecha límite">
      {etiqueta && <small>{etiqueta}</small>}
      {Ic.reloj}{valor ? fFecha(valor) : (chico ? '' : 'Sin fecha')}
      <input type="date" value={valor || ''} onChange={e => onCambio(e.target.value || null)} />
    </label>
  );
}

// ── Editor (nueva / editar) ──
type EditorProps = { base: Publicacion | null; tipo: PubTipo; gente: Persona[]; yo: string; ocupado: boolean; onCancelar: () => void; onGuardar: (b: any) => void };
function Editor({ base, tipo: tipo0, gente, ocupado, onCancelar, onGuardar }: EditorProps) {
  const [tipo, setTipo] = useState<PubTipo>(tipo0);
  const [titulo, setTitulo] = useState(base?.titulo || '');
  const [cuerpo, setCuerpo] = useState(base?.cuerpo || '');
  const [responsable, setResponsable] = useState<string>(base?.responsable_id || '');
  const [vence, setVence] = useState<string>(base?.vence_at || '');
  const [renglones, setRenglones] = useState('');
  const [etiquetando, setEtiquetando] = useState(false);
  const cuerpoRef = useRef<HTMLTextAreaElement>(null);

  const insertar = (chip: string) => {
    const el = cuerpoRef.current; const a = el?.selectionStart ?? cuerpo.length; const b = el?.selectionEnd ?? cuerpo.length;
    const v = cuerpo.slice(0, a) + chip + ' ' + cuerpo.slice(b); setCuerpo(v); setEtiquetando(false);
    setTimeout(() => { el?.focus(); el?.setSelectionRange(a + chip.length + 1, a + chip.length + 1); }, 0);
  };
  const guardar = () => {
    if (!titulo.trim()) return;
    const b: any = { tipo, titulo: titulo.trim(), cuerpo, responsable_id: responsable || null, vence_at: vence || null };
    if (!base) {
      // Un renglón por línea; "## Fase" abre una fase (proyecto).
      let grupo: string | null = null; const items: any[] = [];
      for (const ln of renglones.split('\n')) {
        const s = ln.trim(); if (!s) continue;
        if (/^#{1,3}\s+/.test(s)) { grupo = s.replace(/^#{1,3}\s+/, '').slice(0, 80); continue; }
        items.push({ texto: s.replace(/^(\[[ x]\]|[-*•])\s*/i, ''), grupo });
      }
      b.items = items;
    }
    onGuardar(b);
  };

  return (
    <div className="eq-form eq-pub-editor">
      <div className="eq-pub-tipos">
        {TIPOS.map(x => <button key={x.v} type="button" className={'eq-btn' + (tipo === x.v ? ' p' : ' t')} onClick={() => setTipo(x.v)}>{x.t}</button>)}
      </div>
      <small className="pista">{TIPOS.find(x => x.v === tipo)?.d}</small>
      <label>Título<input autoFocus value={titulo} maxLength={160} onChange={e => setTitulo(e.target.value)} placeholder={tipo === 'proyecto' ? 'Lanzamiento de la app' : tipo === 'checklist' ? 'Pendientes de la semana' : 'Cómo se cotiza a un joyero'} /></label>
      <div className="fila">
        <label style={{ flex: 1 }}>Responsable<select value={responsable} onChange={e => setResponsable(e.target.value)}><option value="">Sin asignar</option>{gente.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select></label>
        <label style={{ flex: 1 }}>Para el<input type="date" value={vence} onChange={e => setVence(e.target.value)} /></label>
      </div>
      <label>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{tipo === 'nota' ? 'Texto' : 'Contexto (opcional)'}<span style={{ flex: 1 }} /><button type="button" className="eq-btn t" style={{ padding: '2px 8px', fontSize: '.6875rem' }} onClick={() => setEtiquetando(v => !v)}>@ Etiquetar</button></span>
        {etiquetando && <Etiquetar onElegir={insertar} onCerrar={() => setEtiquetando(false)} />}
        <textarea ref={cuerpoRef} rows={tipo === 'nota' ? 10 : 4} value={cuerpo} maxLength={8000} onChange={e => setCuerpo(e.target.value)} placeholder="Escribe aquí. Con @ Etiquetar metes una cotización, cliente, lead, pago o cobranza." />
      </label>
      {!base && tipo !== 'nota' && (
        <label>Renglones (uno por línea{tipo === 'proyecto' ? '; "## Fase" abre una fase' : ''})
          <textarea rows={8} value={renglones} onChange={e => setRenglones(e.target.value)} placeholder={tipo === 'proyecto' ? '## Diseño\nMaqueta de la pantalla\nRevisar con Andrea\n## Desarrollo\nEndpoint\nPantalla' : 'Llamar a los 3 leads de ayer\nMandar cotización a Joyería Luna\nRevisar la cobranza de la semana'} />
        </label>
      )}
      {!base && tipo === 'nota' && <small className="pista">Después puedes agregarle renglones palomeables desde la misma nota.</small>}
      <div className="fila" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="eq-btn t" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="eq-btn p" disabled={ocupado || !titulo.trim()} onClick={guardar}>{base ? 'Guardar' : 'Publicar'}</button>
      </div>
    </div>
  );
}

/** Buscador de @citas para meterlas en el texto: el mismo formato que la caja del chat. */
function Etiquetar({ onElegir, onCerrar }: { onElegir: (chip: string) => void; onCerrar: () => void }) {
  const [q, setQ] = useState('');
  const [grupos, setGrupos] = useState<any[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setGrupos([]); return; }
    let vivo = true;
    const t = setTimeout(() => api.menciones(q.trim()).then(r => { if (vivo) setGrupos(r.grupos); }).catch(() => null), 180);
    return () => { vivo = false; clearTimeout(t); };
  }, [q]);
  return (
    <div className="eq-pub-etiq">
      <input autoFocus placeholder="Busca cotización, cliente, lead, pago o cobranza…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onCerrar(); }} />
      {grupos.map(g => (
        <div key={g.tipo} className="grupo">
          <small>{g.etiqueta}</small>
          {g.items.map((it: any) => <button key={it.id} type="button" onClick={() => onElegir(`@[${it.nombre.replace(/[\[\]]/g, '')}](${it.tipo}:${it.id})`)}><b>{it.nombre}</b>{it.sub && <span>{it.sub}</span>}</button>)}
        </div>
      ))}
      {q.trim().length >= 2 && !grupos.length && <small className="vacio">Nada con "{q.trim()}"</small>}
    </div>
  );
}
