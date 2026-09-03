// Los modales de administrar el espacio: crear/editar sección, crear/editar
// canal (con archivar y eliminar) y la confirmación de borrado. Los usa el
// árbol (menú ⋯ de cada fila) y la cabecera del canal (engrane).
import { useState } from 'react';
import type { Canal, Seccion } from './api';
import { api } from './api';
import { Ic } from './ui';

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const aSlug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

type Base = { onClose: () => void; onAviso: (m: string) => void };

/* ── Confirmar algo que no se deshace ─────────────────────────────────── */
export function ModalConfirmar({ titulo, cuerpo, palabra, boton, onConfirmar, onClose }: {
  titulo: string; cuerpo: React.ReactNode;
  /** Si viene, hay que escribirla tal cual para habilitar el botón (canales y secciones). */
  palabra?: string;
  boton: string; onConfirmar: () => Promise<void> | void; onClose: () => void;
}) {
  const [escrito, setEscrito] = useState(''); const [ocupado, setOcupado] = useState(false); const [err, setErr] = useState<string | null>(null);
  const listo = !palabra || escrito.trim() === palabra;
  const ir = async (e: React.FormEvent) => {
    e.preventDefault(); if (!listo || ocupado) return; setOcupado(true); setErr(null);
    try { await onConfirmar(); } catch (x: any) { setErr(x.message); setOcupado(false); }
  };
  return (
    <div className="eq-modal-f" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="eq-modal" onSubmit={ir}>
        <h3>{titulo}</h3>
        <div className="eq-form">
          <div style={{ fontSize: '.875rem', color: 'var(--eq-tinta)', lineHeight: 1.45 }}>{cuerpo}</div>
          {palabra && (
            <label>Escribe <b style={{ color: 'var(--eq-tinta)' }}>{palabra}</b> para confirmar
              <input autoFocus value={escrito} onChange={e => setEscrito(e.target.value)} placeholder={palabra} autoComplete="off" />
            </label>
          )}
          {err && <div className="err">{err}</div>}
          <div className="fila" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="eq-btn t" onClick={onClose}>Cancelar</button>
            <button type="submit" className="eq-btn d" disabled={!listo || ocupado} autoFocus={!palabra}>{ocupado ? 'Un momento…' : boton}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ── Sección: nueva o renombrar ───────────────────────────────────────── */
export function ModalSeccion({ seccion, onClose, onHecho, onAviso }: Base & { seccion?: Seccion; onHecho: () => void }) {
  const [nombre, setNombre] = useState(seccion?.nombre || ''); const [err, setErr] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setOcupado(true);
    try {
      if (seccion) { await api.editarSeccion({ id: seccion.id, nombre: nombre.trim() }); onAviso('Sección renombrada'); }
      else { await api.crearSeccion(nombre.trim()); onAviso('Sección creada'); }
      onHecho();
    } catch (x: any) { setErr(x.message); } finally { setOcupado(false); }
  };
  return (
    <div className="eq-modal-f" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="eq-modal" onSubmit={guardar}>
        <h3>{seccion ? `Renombrar ${seccion.nombre}` : 'Nueva sección'}</h3>
        <div className="eq-form">
          <label>Nombre<input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} maxLength={30} placeholder="Marketing" /></label>
          {err && <div className="err">{err}</div>}
          <div className="fila" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="eq-btn t" onClick={onClose}>Cancelar</button>
            <button type="submit" className="eq-btn p" disabled={ocupado || nombre.trim().length < 2 || (!!seccion && nombre.trim() === seccion.nombre)}>{seccion ? 'Guardar' : 'Crear'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ── Canal: nuevo o editar (con archivar / eliminar) ──────────────────── */
export function ModalCanal({ seccion, canal, secciones, founder, onClose, onHecho, onAviso, onArchivado, onBorrado }: Base & {
  seccion?: Seccion;                    // crear: dónde nace
  canal?: Canal;                        // editar: cuál
  secciones: Seccion[];
  founder: boolean;
  onHecho: (id: string) => void;
  onArchivado?: (id: string) => void;
  onBorrado?: (id: string) => void;
}) {
  const editando = !!canal;
  const sistema = canal?.tipo === 'sistema';
  const secInicial = canal ? (canal.seccion_id || '') : (seccion?.id || '');
  const [nombre, setNombre] = useState(canal?.nombre || ''); const [desc, setDesc] = useState(canal?.descripcion || '');
  const [tipo, setTipo] = useState<'charla' | 'sala'>(canal ? (canal.tipo === 'sala' ? 'sala' : 'charla') : (seccion?.nombre === 'Reuniones' ? 'sala' : 'charla'));
  const [importante, setImportante] = useState(!!canal?.importante);
  const [dia, setDia] = useState(canal?.regla_reunion?.dia_iso || 1); const [hora, setHora] = useState(canal?.regla_reunion?.hora || '09:00');
  const [secId, setSecId] = useState(secInicial);
  const [err, setErr] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<null | 'borrar'>(null);
  const slug = aSlug(nombre);
  const seccionesVivas = secciones.filter(s => s.nombre !== 'Sistema' || sistema);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setOcupado(true);
    try {
      if (canal) {
        const b: Parameters<typeof api.editarCanal>[0] = { id: canal.id, descripcion: desc.trim(), importante };
        if (!sistema) {
          if (slug !== canal.nombre) b.nombre = slug;
          b.tipo = tipo;
          b.regla_reunion = tipo === 'sala' ? { dia_iso: dia, hora } : null;
        }
        if (secId && secId !== (canal.seccion_id || '')) b.seccion_id = secId;
        await api.editarCanal(b);
        onAviso(`#${b.nombre || canal.nombre} guardado`); onHecho(canal.id);
      } else if (seccion) {
        const r = await api.crearCanal({ seccion_id: secId || seccion.id, nombre: slug, descripcion: desc.trim() || undefined, tipo, importante, regla_reunion: tipo === 'sala' ? { dia_iso: dia, hora } : undefined });
        onAviso(`#${r.canal.nombre} creado`); onHecho(r.canal.id);
      }
    } catch (x: any) { setErr(x.message); } finally { setOcupado(false); }
  };
  const archivar = async () => {
    if (!canal) return; setErr(null); setOcupado(true);
    try { await api.editarCanal({ id: canal.id, archivar: true }); onAviso(`#${canal.nombre} archivado`); (onArchivado || onHecho)(canal.id); }
    catch (x: any) { setErr(x.message); setOcupado(false); }
  };
  const borrar = async () => {
    if (!canal) return;
    const r = await api.borrarCanal(canal.id);
    onAviso(`#${canal.nombre} eliminado${r.mensajes ? ` con ${r.mensajes} ${r.mensajes === 1 ? 'mensaje' : 'mensajes'}` : ''}`);
    (onBorrado || onHecho)(canal.id);
  };

  if (confirmar === 'borrar' && canal) {
    return <ModalConfirmar titulo={`Eliminar #${canal.nombre}`} palabra={canal.nombre} boton="Eliminar para siempre" onClose={() => setConfirmar(null)} onConfirmar={borrar}
      cuerpo={<>Se borra el canal con <b>todos</b> sus mensajes, hilos, reacciones, archivos y reuniones. No se puede deshacer.<br /><span style={{ color: 'var(--eq-gris)' }}>Si solo quieres sacarlo del árbol sin perder nada, mejor archívalo.</span></>} />;
  }

  return (
    <div className="eq-modal-f" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="eq-modal" onSubmit={guardar}>
        <h3>{canal ? `Editar #${canal.nombre}` : `Nuevo canal en ${seccion?.nombre}`}</h3>
        <div className="eq-form">
          {sistema
            ? <div style={{ fontSize: '.8125rem', color: 'var(--eq-gris)' }}>Canal de Sistema: aquí escribe el CRM. Se puede describir, marcar importante o cambiar de sección, pero no renombrar ni borrar.</div>
            : <label>Nombre<input autoFocus={!editando} value={nombre} onChange={e => setNombre(e.target.value)} maxLength={40} placeholder="campañas" />{slug && slug !== nombre && <small style={{ fontWeight: 500 }}>Se llamará #{slug}</small>}</label>}
          <label>Para qué es<input autoFocus={editando} value={desc} onChange={e => setDesc(e.target.value)} maxLength={140} placeholder="Una línea que diga qué va aquí" /></label>
          {!sistema && (
            <label>Tipo
              <select value={tipo} onChange={e => setTipo(e.target.value as any)}>
                <option value="charla">Charla: conversación normal</option>
                <option value="sala">Sala de reunión: con agenda, acuerdos y actas</option>
              </select>
            </label>
          )}
          {tipo === 'sala' && !sistema && (
            <div className="fila">
              <label style={{ flex: 1 }}>Día<select value={dia} onChange={e => setDia(+e.target.value)}>{DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
              <label style={{ flex: 1 }}>Hora<input type="time" value={hora} onChange={e => setHora(e.target.value)} /></label>
            </div>
          )}
          {editando && seccionesVivas.length > 1 && (
            <label>Sección
              <select value={secId} onChange={e => setSecId(e.target.value)}>
                {!secId && <option value="">Sin sección</option>}
                {seccionesVivas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
          )}
          <label className="fila" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, fontWeight: 500, color: 'var(--eq-tinta)' }}>
            <input type="checkbox" checked={importante} onChange={e => setImportante(e.target.checked)} style={{ width: 'auto' }} />
            Importante: cada mensaje avisa a todo el equipo
          </label>
          {err && <div className="err">{err}</div>}
          <div className="fila" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="eq-btn t" onClick={onClose}>Cancelar</button>
            <button type="submit" className="eq-btn p" disabled={ocupado || (!sistema && slug.length < 2)}>{canal ? 'Guardar' : 'Crear canal'}</button>
          </div>
          {canal && !sistema && (
            <div className="eq-peligro">
              <button type="button" className="eq-btn t" onClick={archivar} disabled={ocupado} title="Sale del árbol; se restaura desde Archivados">{Ic.caja} Archivar</button>
              {founder && <button type="button" className="eq-btn d" onClick={() => setConfirmar('borrar')} disabled={ocupado}>{Ic.basura} Eliminar canal…</button>}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
