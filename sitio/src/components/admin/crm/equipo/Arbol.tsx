// La columna izquierda: secciones plegables con sus canales, los directos y
// la gente con su presencia. Cada sección y cada canal tienen su menú ⋯ para
// administrarlos (editar, mover, archivar, eliminar); los modales viven en Gestion.tsx.
import { useEffect, useMemo, useState } from 'react';
import type { Arbol as A, Canal, CanalArchivado, Persona, Seccion } from './api';
import { api, hace } from './api';
import ActionSheet, { type ActionItem } from '../ui/ActionSheet';
import { ModalCanal, ModalConfirmar, ModalSeccion } from './Gestion';
import { Avatar, Ic, ROLES, rolDe } from './ui';

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
  onCerrado?: (canalId: string) => void; // el canal abierto se archivó o se borró
  cerrar?: () => void;                  // la X del widget flotante (móvil)
};

type Modal =
  | { tipo: 'seccion'; seccion?: Seccion }
  | { tipo: 'canal'; seccion?: Seccion; canal?: Canal }
  | { tipo: 'borrar-seccion'; seccion: Seccion }
  | { tipo: 'borrar-archivado'; canal: CanalArchivado };
type Menu = { tipo: 'seccion'; seccion: Seccion } | { tipo: 'canal'; canal: Canal } | { tipo: 'archivado'; canal: CanalArchivado };

const CERRADAS_KEY = 'eq_sec_cerradas';
function leerCerradas(): Record<string, boolean> { try { return JSON.parse(localStorage.getItem(CERRADAS_KEY) || '{}'); } catch { return {}; } }

export default function Arbol(p: ArbolProps) {
  const [cerradas, setCerradas] = useState<Record<string, boolean>>(leerCerradas);
  const [modal, setModal] = useState<Modal | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  useEffect(() => { try { localStorage.setItem(CERRADAS_KEY, JSON.stringify(cerradas)); } catch { /* sin storage */ } }, [cerradas]);

  const { secciones, canales, personas, yo } = p.arbol;
  const archivados = p.arbol.archivados || [];
  const seccionesArchivadas = p.arbol.secciones_archivadas || [];
  const founder = yo.role === 'founder';
  const falla = (e: any) => p.onAviso(e?.message || 'No se pudo');

  // ── Acciones rápidas (sin modal) ──
  // Subir/bajar: se intercambia con el vecino y se renumera toda la lista 1..n,
  // porque los órdenes viejos pueden venir empatados en 0 y un simple swap no movería nada.
  const mover = async (c: Canal, dir: -1 | 1) => {
    const lista = [...(porSeccion.get(c.seccion_id || '_') || [])];
    const i = lista.findIndex(x => x.id === c.id); const j = i + dir;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    try { await Promise.all(lista.map((x, k) => x.orden === k + 1 ? null : api.editarCanal({ id: x.id, orden: k + 1 }))); p.onCambio(); } catch (e) { falla(e); }
  };
  const moverSeccion = async (s: Seccion, dir: -1 | 1) => {
    const lista = [...secciones];
    const i = lista.findIndex(x => x.id === s.id); const j = i + dir;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    try { await Promise.all(lista.map((x, k) => x.orden === k + 1 ? null : api.editarSeccion({ id: x.id, orden: k + 1 }))); p.onCambio(); } catch (e) { falla(e); }
  };
  const silenciar = async (c: Canal) => { try { await api.silenciar(c.id, !c.silenciado); p.onAviso(c.silenciado ? 'Avisos activados' : `#${c.nombre} silenciado`); p.onCambio(); } catch (e) { falla(e); } };
  const archivarCanal = async (c: Canal) => { try { await api.editarCanal({ id: c.id, archivar: true }); p.onAviso(`#${c.nombre} archivado`); p.onCambio(); p.onCerrado?.(c.id); } catch (e) { falla(e); } };
  const restaurarCanal = async (c: CanalArchivado) => { try { await api.editarCanal({ id: c.id, archivar: false }); p.onAviso(`#${c.nombre} restaurado`); p.onCambio(); } catch (e) { falla(e); } };
  const archivarSeccion = async (s: Seccion) => { try { await api.editarSeccion({ id: s.id, archivar: true }); p.onAviso(`${s.nombre} archivada`); p.onCambio(); } catch (e) { falla(e); } };
  const restaurarSeccion = async (id: string, nombre: string) => { try { await api.editarSeccion({ id, archivar: false }); p.onAviso(`${nombre} restaurada`); p.onCambio(); } catch (e) { falla(e); } };

  const itemsMenu = (): ActionItem[] => {
    if (!menu) return [];
    if (menu.tipo === 'canal') {
      const c = menu.canal; const lista = porSeccion.get(c.seccion_id || '_') || []; const i = lista.findIndex(x => x.id === c.id);
      return [
        { label: c.tipo === 'sistema' ? 'Ver ajustes' : 'Editar canal', icon: Ic.editar, onClick: () => setModal({ tipo: 'canal', canal: c }) },
        { label: c.silenciado ? 'Activar avisos' : 'Silenciar', icon: c.silenciado ? Ic.campana : Ic.campanaOff, onClick: () => silenciar(c) },
        { label: 'Subir', icon: Ic.arriba, disabled: i <= 0, onClick: () => mover(c, -1) },
        { label: 'Bajar', icon: Ic.abajo, disabled: i < 0 || i >= lista.length - 1, onClick: () => mover(c, 1) },
        ...(c.tipo !== 'sistema' ? [
          { label: 'Archivar', icon: Ic.caja, onClick: () => archivarCanal(c) },
          ...(founder ? [{ label: 'Eliminar canal…', icon: Ic.basura, danger: true, onClick: () => setModal({ tipo: 'canal', canal: c }) }] : []),
        ] : []),
      ];
    }
    if (menu.tipo === 'archivado') {
      const c = menu.canal;
      return [
        { label: 'Restaurar', icon: Ic.restaurar, onClick: () => restaurarCanal(c) },
        ...(founder ? [{ label: 'Eliminar para siempre…', icon: Ic.basura, danger: true, onClick: () => setModal({ tipo: 'borrar-archivado', canal: c }) }] : []),
      ];
    }
    const s = menu.seccion; const i = secciones.findIndex(x => x.id === s.id); const vacia = !(porSeccion.get(s.id) || []).length;
    const sistema = s.nombre === 'Sistema';
    return [
      ...(!sistema ? [{ label: 'Nuevo canal', icon: Ic.mas, onClick: () => setModal({ tipo: 'canal', seccion: s }) }] : []),
      ...(!sistema ? [{ label: 'Renombrar', icon: Ic.editar, onClick: () => setModal({ tipo: 'seccion', seccion: s }) }] : []),
      { label: 'Subir', icon: Ic.arriba, disabled: i <= 0, onClick: () => moverSeccion(s, -1) },
      { label: 'Bajar', icon: Ic.abajo, disabled: i >= secciones.length - 1, onClick: () => moverSeccion(s, 1) },
      ...(!sistema ? [
        { label: vacia ? 'Archivar sección' : 'Archivar (vacíala primero)', icon: Ic.caja, disabled: !vacia, onClick: () => archivarSeccion(s) },
        ...(founder ? [{ label: vacia ? 'Eliminar sección…' : 'Eliminar (vacíala primero)', icon: Ic.basura, danger: true, disabled: !vacia, onClick: () => setModal({ tipo: 'borrar-seccion', seccion: s }) }] : []),
      ] : []),
    ];
  };
  const porSeccion = useMemo(() => {
    const m = new Map<string, Canal[]>();
    for (const c of canales) if (c.tipo !== 'directo') { const k = c.seccion_id || '_'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); }
    for (const l of m.values()) l.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
    return m;
  }, [canales]);
  const directos = useMemo(() => canales.filter(c => c.tipo === 'directo').sort((a, b) => (b.ultimo_at || '').localeCompare(a.ultimo_at || '')), [canales]);
  const otros = personas.filter(x => x.id !== yo.id);
  const estadoDe = (x: Persona) => p.enLinea.includes(x.id) ? 'activo' : (x.estado === 'ausente' && x.visto_at && Date.now() - new Date(x.visto_at).getTime() < 15 * 60_000 ? 'ausente' : 'fuera');

  // La lista de gente, agrupada como Discord: primero quien ESTÁ, partido por
  // rol y con su conteo, y hasta el final los desconectados en un solo bloque.
  // El porqué: una lista plana de veinte nombres grises no dice nada; lo que
  // uno busca es "¿hay alguien de dirección conectado ahora?".
  // El orden de los roles es el de ROLES (no alfabético) — es jerarquía, y
  // ordenarlo por nombre la borraría. Quien traiga un rol desconocido cae en
  // "Equipo", nunca se pierde de la lista.
  const gruposDeGente = useMemo(() => {
    const conectados = otros.filter(x => estadoDe(x) !== 'fuera');
    const fuera = otros.filter(x => estadoDe(x) === 'fuera');
    const grupos: { clave: string; etiqueta: string; gente: Persona[] }[] = [];
    for (const clave of [...Object.keys(ROLES), '_otros']) {
      const gente = conectados.filter(x => (rolDe(x.rol)?.clave || '_otros') === clave);
      if (gente.length) grupos.push({ clave, etiqueta: ROLES[clave]?.etiqueta || 'Equipo', gente });
    }
    if (fuera.length) grupos.push({ clave: '_fuera', etiqueta: 'Sin conexión', gente: fuera });
    return grupos;
  }, [otros, p.enLinea]);

  const filaCanal = (c: Canal) => {
    const activo = c.id === p.canalId;
    const nuevo = c.no_leidos > 0 && !c.silenciado;
    return (
      <div key={c.id} className={'eq-can-fila' + (activo ? ' activo' : '')}>
        <button className={'eq-can' + (activo ? ' activo' : '') + (nuevo ? ' nuevo' : '')} onClick={() => p.onAbrir(c.id)} title={c.descripcion || c.nombre}>
          <span className="n" style={{ display: 'inline-flex' }}>{c.tipo === 'sala' ? Ic.sala : c.tipo === 'sistema' ? Ic.sistema : Ic.hash}</span>
          <span className="nombre">{c.nombre}</span>
          {c.importante && <span className="eq-imp" title="Canal importante: avisa a todos" />}
          {c.menciones > 0 ? <span className="eq-badge men">{c.menciones}</span> : nuevo ? <span className="eq-badge">{c.no_leidos > 99 ? '99+' : c.no_leidos}</span> : null}
        </button>
        <button className="eq-can-mas" title={`Administrar #${c.nombre}`} aria-label={`Administrar #${c.nombre}`} onClick={e => { e.stopPropagation(); setMenu({ tipo: 'canal', canal: c }); }}>{Ic.puntos}</button>
      </div>
    );
  };

  return (
    <aside className="eq-arbol">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 12px 6px' }}>
        <b style={{ flex: 1, fontSize: '1rem' }}>Equipo</b>
        <button className="eq-ib" title="Buscar mensajes" onClick={p.onBuscar}>{Ic.lupa}</button>
        <button className="eq-ib" title="Nueva sección" onClick={() => setModal({ tipo: 'seccion' })}>{Ic.mas}</button>
        {p.cerrar && <button className="eq-ib" title="Cerrar Equipo" aria-label="Cerrar Equipo" onClick={p.cerrar} style={{ background: 'var(--eq-lila)', color: 'var(--eq-morado-tinta)' }}>{Ic.cerrar}</button>}
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
                <span className="eq-sec-acc">
                  {s.nombre !== 'Sistema' && <button className="eq-sec-mas" title={`Nuevo canal en ${s.nombre}`} aria-label={`Nuevo canal en ${s.nombre}`} onClick={() => setModal({ tipo: 'canal', seccion: s })}>{Ic.mas}</button>}
                  <button className="eq-sec-mas" title={`Administrar ${s.nombre}`} aria-label={`Administrar ${s.nombre}`} onClick={() => setMenu({ tipo: 'seccion', seccion: s })}>{Ic.puntos}</button>
                </span>
              </div>
              {!cerrada && lista.map(filaCanal)}
              {!cerrada && !lista.length && <div style={{ padding: '4px 18px', fontSize: '.75rem', color: 'var(--eq-gris)' }}>Sin canales</div>}
            </div>
          );
        })}
        {porSeccion.has('_') && <div><div className="eq-sec"><span className="eq-sec-t">Sin sección</span></div>{porSeccion.get('_')!.map(filaCanal)}</div>}
        {(archivados.length > 0 || seccionesArchivadas.length > 0) && (
          <div className="eq-arch">
            <div className="eq-sec">
              <button className={'eq-sec-t' + (cerradas._arch !== false ? ' cerrada' : '')} onClick={() => setCerradas(x => ({ ...x, _arch: x._arch === false ? true : false }))}>
                {Ic.chev}Archivados<span style={{ fontWeight: 600, marginLeft: 2 }}>{archivados.length + seccionesArchivadas.length}</span>
              </button>
            </div>
            {cerradas._arch === false && archivados.map(c => (
              <div key={c.id} className="eq-can-fila">
                <button className="eq-can" title={`Archivado ${hace(c.archivado_at)}. Toca ⋯ para restaurarlo`} onClick={() => setMenu({ tipo: 'archivado', canal: c })}>
                  <span className="n" style={{ display: 'inline-flex' }}>{c.tipo === 'sala' ? Ic.sala : Ic.hash}</span>
                  <span className="nombre">{c.nombre}</span>
                </button>
                <button className="eq-can-mas" title={`Restaurar o eliminar #${c.nombre}`} aria-label={`Restaurar o eliminar #${c.nombre}`} onClick={() => setMenu({ tipo: 'archivado', canal: c })}>{Ic.puntos}</button>
              </div>
            ))}
            {cerradas._arch === false && seccionesArchivadas.map(s => (
              <div key={s.id} className="eq-can-fila">
                <button className="eq-can" title="Sección archivada: toca para restaurarla" onClick={() => restaurarSeccion(s.id, s.nombre)}>
                  <span className="n" style={{ display: 'inline-flex' }}>{Ic.caja}</span>
                  <span className="nombre">{s.nombre} <small style={{ fontWeight: 500 }}>(sección)</small></span>
                </button>
                <button className="eq-can-mas" title={`Restaurar ${s.nombre}`} aria-label={`Restaurar ${s.nombre}`} onClick={() => restaurarSeccion(s.id, s.nombre)}>{Ic.restaurar}</button>
              </div>
            ))}
          </div>
        )}
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
        {gruposDeGente.map(g => (
          <div key={g.clave}>
            <div className="eq-gente-grupo">{g.etiqueta}<span className="n">— {g.gente.length}</span></div>
            {g.gente.map(x => {
              const est = estadoDe(x);
              const r = rolDe(x.rol);
              return (
                <button key={x.id} className="eq-per" onClick={() => p.onDirecto(x.id)} title={`Escribir a ${x.nombre}`}>
                  <Avatar p={x} size={22} estado={est} />
                  <span className="nom">
                    <b className={r ? 'eq-rol ' + r.clave : undefined}>{x.nombre}</b>
                    <span className="est">{est === 'activo' ? 'En línea' : est === 'ausente' ? 'Ausente' : x.visto_at ? `Visto ${hace(x.visto_at)}` : 'Sin conectar'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <div className="eq-conex" style={{ padding: '4px 4px 0' }}><i className={p.conectado ? 'on' : ''} />{p.conectado ? 'En vivo' : 'Actualizando cada 30 s'}</div>
      </div>
      <ActionSheet open={!!menu} onClose={() => setMenu(null)} items={itemsMenu()}
        title={menu?.tipo === 'seccion' ? menu.seccion.nombre : menu ? `#${menu.canal.nombre}${menu.tipo === 'archivado' ? ' (archivado)' : ''}` : ''} />
      {modal?.tipo === 'seccion' && <ModalSeccion seccion={modal.seccion} onClose={() => setModal(null)} onHecho={() => { setModal(null); p.onCambio(); }} onAviso={p.onAviso} />}
      {modal?.tipo === 'canal' && (
        <ModalCanal seccion={modal.seccion} canal={modal.canal} secciones={secciones} founder={founder} onClose={() => setModal(null)} onAviso={p.onAviso}
          onHecho={id => { setModal(null); p.onCambio(); if (!modal.canal) p.onAbrir(id); }}
          onArchivado={id => { setModal(null); p.onCambio(); p.onCerrado?.(id); }}
          onBorrado={id => { setModal(null); p.onCambio(); p.onCerrado?.(id); }} />
      )}
      {modal?.tipo === 'borrar-seccion' && (
        <ModalConfirmar titulo={`Eliminar ${modal.seccion.nombre}`} palabra={modal.seccion.nombre} boton="Eliminar sección" onClose={() => setModal(null)}
          cuerpo={<>La sección desaparece del árbol. Está vacía, así que no se pierde ningún mensaje.</>}
          onConfirmar={async () => { await api.borrarSeccion(modal.seccion.id); p.onAviso(`${modal.seccion.nombre} eliminada`); setModal(null); p.onCambio(); }} />
      )}
      {modal?.tipo === 'borrar-archivado' && (
        <ModalConfirmar titulo={`Eliminar #${modal.canal.nombre}`} palabra={modal.canal.nombre} boton="Eliminar para siempre" onClose={() => setModal(null)}
          cuerpo={<>Se borra el canal archivado con <b>todos</b> sus mensajes, hilos, archivos y reuniones. No se puede deshacer.</>}
          onConfirmar={async () => { const r = await api.borrarCanal(modal.canal.id); p.onAviso(`#${modal.canal.nombre} eliminado${r.mensajes ? ` con ${r.mensajes} mensajes` : ''}`); setModal(null); p.onCambio(); }} />
      )}
    </aside>
  );
}
