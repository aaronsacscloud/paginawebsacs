// La columna izquierda: secciones plegables con sus canales, los directos y
// la gente con su presencia. Crear sección/canal vive aquí como modal chico.
import { useEffect, useMemo, useState } from 'react';
import type { Arbol as A, Canal, Persona, Seccion } from './api';
import { api, hace } from './api';
import { Avatar, Ic } from './ui';

export type ArbolProps = {
  arbol: A;
  canalId: string | null;
  enLinea: string[];
  conectado: boolean;
  onAbrir: (canalId: string) => void;
  onDirecto: (personaId: string) => void;
  onCambio: () => void;                 // recargar el árbol
  onAviso: (m: string) => void;
  onBuscar: () => void;
};

const CERRADAS_KEY = 'eq_sec_cerradas';
function leerCerradas(): Record<string, boolean> { try { return JSON.parse(localStorage.getItem(CERRADAS_KEY) || '{}'); } catch { return {}; } }

export default function Arbol(p: ArbolProps) {
  const [cerradas, setCerradas] = useState<Record<string, boolean>>(leerCerradas);
  const [modal, setModal] = useState<null | { tipo: 'seccion' } | { tipo: 'canal'; seccion: Seccion }>(null);
  useEffect(() => { try { localStorage.setItem(CERRADAS_KEY, JSON.stringify(cerradas)); } catch { /* sin storage */ } }, [cerradas]);

  const { secciones, canales, personas, yo } = p.arbol;
  const porSeccion = useMemo(() => {
    const m = new Map<string, Canal[]>();
    for (const c of canales) if (c.tipo !== 'directo') { const k = c.seccion_id || '_'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); }
    for (const l of m.values()) l.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
    return m;
  }, [canales]);
  const directos = useMemo(() => canales.filter(c => c.tipo === 'directo').sort((a, b) => (b.ultimo_at || '').localeCompare(a.ultimo_at || '')), [canales]);
  const otros = personas.filter(x => x.id !== yo.id);
  const estadoDe = (x: Persona) => p.enLinea.includes(x.id) ? 'activo' : (x.estado === 'ausente' && x.visto_at && Date.now() - new Date(x.visto_at).getTime() < 15 * 60_000 ? 'ausente' : 'fuera');

  const filaCanal = (c: Canal) => {
    const activo = c.id === p.canalId;
    const nuevo = c.no_leidos > 0 && !c.silenciado;
    return (
      <button key={c.id} className={'eq-can' + (activo ? ' activo' : '') + (nuevo ? ' nuevo' : '')} onClick={() => p.onAbrir(c.id)} title={c.descripcion || c.nombre}>
        <span className="n" style={{ display: 'inline-flex' }}>{c.tipo === 'sala' ? Ic.sala : c.tipo === 'sistema' ? Ic.sistema : Ic.hash}</span>
        <span className="nombre">{c.nombre}</span>
        {c.importante && <span className="eq-imp" title="Canal importante: avisa a todos" />}
        {c.menciones > 0 ? <span className="eq-badge men">{c.menciones}</span> : nuevo ? <span className="eq-badge">{c.no_leidos > 99 ? '99+' : c.no_leidos}</span> : null}
      </button>
    );
  };

  return (
    <aside className="eq-arbol">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 12px 6px' }}>
        <b style={{ flex: 1, fontSize: '1rem' }}>Equipo</b>
        <button className="eq-ib" title="Buscar mensajes" onClick={p.onBuscar}>{Ic.lupa}</button>
        <button className="eq-ib" title="Nueva sección" onClick={() => setModal({ tipo: 'seccion' })}>{Ic.mas}</button>
      </div>
      <div className="eq-arbol-scroll">
        {secciones.map(s => {
          const lista = porSeccion.get(s.id) || [];
          const cerrada = !!cerradas[s.id];
          const pend = lista.reduce((n, c) => n + (c.silenciado ? 0 : c.no_leidos), 0);
          return (
            <div key={s.id}>
              <div className="eq-sec">
                <button className={'eq-sec-t' + (cerrada ? ' cerrada' : '')} onClick={() => setCerradas(x => ({ ...x, [s.id]: !cerrada }))}>
                  {Ic.chev}{s.nombre}{cerrada && pend > 0 && <span className="eq-badge" style={{ marginLeft: 4 }}>{pend}</span>}
                </button>
                {s.nombre !== 'Sistema' && <button className="eq-sec-mas" title={`Nuevo canal en ${s.nombre}`} onClick={() => setModal({ tipo: 'canal', seccion: s })}>{Ic.mas}</button>}
              </div>
              {!cerrada && lista.map(filaCanal)}
              {!cerrada && !lista.length && <div style={{ padding: '4px 18px', fontSize: '.75rem', color: 'var(--eq-gris)' }}>Sin canales</div>}
            </div>
          );
        })}
        {porSeccion.has('_') && <div><div className="eq-sec"><span className="eq-sec-t">Sin sección</span></div>{porSeccion.get('_')!.map(filaCanal)}</div>}
        <div className="eq-sec"><span className="eq-sec-t">Directos</span></div>
        {directos.map(c => {
          const otro = personas.find(x => c.participantes.includes(x.id) && x.id !== yo.id) || otros[0];
          if (!otro) return null;
          const activo = c.id === p.canalId; const nuevo = c.no_leidos > 0;
          return (
            <button key={c.id} className={'eq-can' + (activo ? ' activo' : '') + (nuevo ? ' nuevo' : '')} onClick={() => p.onAbrir(c.id)}>
              <Avatar p={otro} size={20} estado={estadoDe(otro)} />
              <span className="nombre">{otro.nombre}</span>
              {nuevo && <span className="eq-badge">{c.no_leidos}</span>}
            </button>
          );
        })}
        {!directos.length && <div style={{ padding: '4px 18px', fontSize: '.75rem', color: 'var(--eq-gris)' }}>Toca a alguien abajo para escribirle</div>}
      </div>
      <div className="eq-gente">
        {otros.map(x => {
          const est = estadoDe(x);
          return (
            <button key={x.id} className="eq-per" onClick={() => p.onDirecto(x.id)} title={`Escribir a ${x.nombre}`}>
              <Avatar p={x} size={28} estado={est} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nombre}</span>
                <span className="est">{est === 'activo' ? 'En línea' : est === 'ausente' ? 'Ausente' : x.visto_at ? `Visto ${hace(x.visto_at)}` : 'Sin conectar'}</span>
              </span>
            </button>
          );
        })}
        <div className="eq-conex" style={{ padding: '8px 4px 0' }}><i className={p.conectado ? 'on' : ''} />{p.conectado ? 'En vivo' : 'Actualizando cada 30 s'}</div>
      </div>
      {modal?.tipo === 'seccion' && <ModalSeccion onClose={() => setModal(null)} onHecho={() => { setModal(null); p.onCambio(); }} onAviso={p.onAviso} />}
      {modal?.tipo === 'canal' && <ModalCanal seccion={modal.seccion} onClose={() => setModal(null)} onHecho={id => { setModal(null); p.onCambio(); p.onAbrir(id); }} onAviso={p.onAviso} />}
    </aside>
  );
}

function ModalSeccion({ onClose, onHecho, onAviso }: { onClose: () => void; onHecho: () => void; onAviso: (m: string) => void }) {
  const [nombre, setNombre] = useState(''); const [err, setErr] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const crear = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setOcupado(true);
    try { await api.crearSeccion(nombre.trim()); onAviso('Sección creada'); onHecho(); } catch (x: any) { setErr(x.message); } finally { setOcupado(false); }
  };
  return (
    <div className="eq-modal-f" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="eq-modal" onSubmit={crear}>
        <h3>Nueva sección</h3>
        <div className="eq-form">
          <label>Nombre<input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} maxLength={30} placeholder="Marketing" /></label>
          {err && <div className="err">{err}</div>}
          <div className="fila" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="eq-btn t" onClick={onClose}>Cancelar</button>
            <button type="submit" className="eq-btn p" disabled={ocupado || nombre.trim().length < 2}>Crear</button>
          </div>
        </div>
      </form>
    </div>
  );
}

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function ModalCanal({ seccion, onClose, onHecho, onAviso }: { seccion: Seccion; onClose: () => void; onHecho: (id: string) => void; onAviso: (m: string) => void }) {
  const [nombre, setNombre] = useState(''); const [desc, setDesc] = useState(''); const [tipo, setTipo] = useState<'charla' | 'sala'>(seccion.nombre === 'Reuniones' ? 'sala' : 'charla');
  const [importante, setImportante] = useState(false); const [dia, setDia] = useState(1); const [hora, setHora] = useState('09:00');
  const [err, setErr] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const slug = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const crear = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setOcupado(true);
    try {
      const r = await api.crearCanal({ seccion_id: seccion.id, nombre: slug, descripcion: desc.trim() || undefined, tipo, importante, regla_reunion: tipo === 'sala' ? { dia_iso: dia, hora } : undefined });
      onAviso(`#${r.canal.nombre} creado`); onHecho(r.canal.id);
    } catch (x: any) { setErr(x.message); } finally { setOcupado(false); }
  };
  return (
    <div className="eq-modal-f" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="eq-modal" onSubmit={crear}>
        <h3>Nuevo canal en {seccion.nombre}</h3>
        <div className="eq-form">
          <label>Nombre<input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} maxLength={40} placeholder="campañas" />{slug && slug !== nombre && <small style={{ fontWeight: 500 }}>Se llamará #{slug}</small>}</label>
          <label>Para qué es<input value={desc} onChange={e => setDesc(e.target.value)} maxLength={140} placeholder="Una línea que diga qué va aquí" /></label>
          <label>Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="charla">Charla: conversación normal</option>
              <option value="sala">Sala de reunión: con agenda, acuerdos y actas</option>
            </select>
          </label>
          {tipo === 'sala' && (
            <div className="fila">
              <label style={{ flex: 1 }}>Día<select value={dia} onChange={e => setDia(+e.target.value)}>{DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
              <label style={{ flex: 1 }}>Hora<input type="time" value={hora} onChange={e => setHora(e.target.value)} /></label>
            </div>
          )}
          <label className="fila" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, fontWeight: 500, color: 'var(--eq-tinta)' }}>
            <input type="checkbox" checked={importante} onChange={e => setImportante(e.target.checked)} style={{ width: 'auto' }} />
            Importante: cada mensaje avisa a todo el equipo
          </label>
          {err && <div className="err">{err}</div>}
          <div className="fila" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="eq-btn t" onClick={onClose}>Cancelar</button>
            <button type="submit" className="eq-btn p" disabled={ocupado || slug.length < 2}>Crear canal</button>
          </div>
        </div>
      </form>
    </div>
  );
}
