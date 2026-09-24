// LA LISTA COMO TABLERO (22-sep-2026) · resumen de la lista a través de sus
// rondas, «Ejecutar ronda N+1» y acciones masivas. Vive en la pantalla final
// de la jornada (Cabina, fase `fin`). Todo sale de `lista_resumen` y cada
// acción vuelve a pedirlo: una sola fuente de verdad.
import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { C } from './estilo';
import { IcoX } from './Iconos';
import { telefonoLegible } from '../../../../lib/telefono';

type Props = {
  sesionId: string;
  post: (b: any) => Promise<any>;
  movil?: boolean;
  onRondaCreada: (id: string) => void;
  confirmar: (msg: string) => Promise<boolean>;
  /** En el teléfono: la barra del pulgar que se pone si el tablero no carga. */
  respaldo?: React.ReactNode;
};

// Qué pasó en cada ronda, dicho en un símbolo que se lee de un vistazo.
const MARCA: Record<string, { s: string; c: string; t: string }> = {
  contesto: { s: '●', c: '#1E8A63', t: 'contestó' }, dieron_datos: { s: '●', c: '#1E8A63', t: 'dio datos' },
  volver_llamar: { s: '●', c: '#9a6a10', t: 'pidió que le volvieran a llamar' }, no_interesa: { s: '●', c: '#C0554E', t: 'no le interesa' },
  interesado: { s: '●', c: '#1E8A63', t: 'le interesa' },
  buzon: { s: '▣', c: '#9a6a10', t: 'buzón' }, portero: { s: '▣', c: '#2C5FC4', t: 'contestadora' },
  no_contesto: { s: '○', c: '#9B8CFA', t: 'timbró, no contestó' }, ocupado: { s: '○', c: '#9B8CFA', t: 'ocupado' },
  colgo_rapido: { s: '◐', c: '#C0554E', t: 'descolgó y colgó' }, invalido: { s: '×', c: '#C0554E', t: 'número inválido' },
  pendiente: { s: '·', c: '#9CA3AF', t: 'sin marcar' }, fuera: { s: '–', c: '#9CA3AF', t: 'fuera de la lista' },
  cancelado: { s: '–', c: '#9CA3AF', t: 'cancelada' }, saltado: { s: '–', c: '#9CA3AF', t: 'saltada' },
};
/* En el teléfono, la pastilla por ronda dicha corta (ronda 6): «R1 timbró,
   no contestó» se partía en dos renglones a 360 y cada tarjeta crecía a
   ~150 px. Lo que no está aquí usa el texto largo. */
const CORTO: Record<string, string> = {
  no_contesto: 'sin contestar', volver_llamar: 'pidió otra llamada', colgo_rapido: 'colgó rápido',
  invalido: 'número malo', fuera: 'fuera', cancelado: 'cancelada', saltado: 'saltada', no_interesa: 'no le interesa',
};
const COLOR: Record<string, string> = { accion: '#1E8A63', contesto: '#5B4BD6', descalificado: '#C0554E', buzon: '#9a6a10', contestadora: '#2C5FC4', nunca: '#7C3AED', sin_marcar: '#6B7280', fuera: '#9CA3AF' };
/* En el teléfono la contestadora deja el azul (fuera de la paleta del flujo,
   guía de continuidad §0) y se dice en ámbar, como la cabina en vivo. */
const COLOR_M: Record<string, string> = { ...COLOR, contestadora: '#E8A838' };
/* El color como TEXTO en el teléfono (ronda 3): el gris #9CA3AF de «Fuera de
   la lista» daba 2.54:1 y el verde #1E8A63 4.31:1; van al gris y al verde de
   texto que sí pasan. Las franjas y los puntos siguen con COLOR / COLOR_M. */
const NUM_M: Record<string, string> = { ...COLOR, accion: '#17775A', contestadora: '#9a6a10', fuera: '#6B7280' };
const RELLAMABLES = ['nunca', 'buzon', 'contestadora', 'sin_marcar'];

export default function ResumenLista({ sesionId, post, movil, onRondaCreada, confirmar, respaldo }: Props) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [filtro, setFiltro] = useState<string>('nunca');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [gruposRonda, setGruposRonda] = useState<Set<string>>(new Set(['nunca']));
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');
  const [plantilla, setPlantilla] = useState('');
  // En el teléfono las acciones sobre lo seleccionado viven en una hoja de abajo.
  const [hoja, setHoja] = useState(false);
  // El error de una acción hecha desde la hoja: se dice dentro de ella.
  const [errHoja, setErrHoja] = useState('');
  useEffect(() => { if (!hoja) setErrHoja(''); }, [hoja]);
  /* Al tocar un grupo en el teléfono, «Personas del grupo» sale ~700 px más
     abajo, después de la rejilla (ronda 6): se trae a la vista sola, para
     que el toque se vea hacer algo. Sólo tras un toque, no al cargar. */
  const personasRef = useRef<HTMLElement>(null);
  const irAPersonas = useRef(false);
  useEffect(() => {
    if (!movil || !irAPersonas.current) return;
    irAPersonas.current = false;
    const t = setTimeout(() => personasRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
    return () => clearTimeout(t);
  }, [filtro, movil]);

  const cargar = async () => {
    const r = await post({ accion: 'lista_resumen', id: sesionId });
    if (r?.error) { setErr(r.error); return; }
    setD(r); setErr('');
    // Arranca en el grupo que más importa decidir: los que nunca contestaron (si hay).
    if (r?.conteo && !r.conteo[filtro]) setFiltro(RELLAMABLES.find(g => r.conteo[g]) || 'accion');
  };
  useEffect(() => { cargar(); }, [sesionId]);

  const personas: any[] = d?.personas || [];
  const visibles = useMemo(() => personas.filter(p => !filtro || p.grupo === filtro), [personas, filtro]);
  const aLlamar = personas.filter(p => gruposRonda.has(p.grupo)).length;
  const seleccion = personas.filter(p => sel.has(p.clave));
  const siguiente = (d?.rondas?.length || 1) + 1;

  const ronda = async (claves?: string[]) => {
    const n = claves?.length || aLlamar;
    if (!n) return;
    if (!(await confirmar(`Se arma la ronda ${siguiente} con ${n} ${n === 1 ? 'persona' : 'personas'}. Quien ya tenga cita, seguimiento o esté descalificado se queda fuera solo. ¿La armo?`))) return;
    setOcupado('ronda'); setAviso('');
    const r = await post({ accion: 'lista_ronda', id: sesionId, grupos: [...gruposRonda], claves });
    setOcupado('');
    if (r?.error) { setAviso(r.error); return; }
    onRondaCreada(r.id);
  };
  const masivo = async (que: 'descalificar' | 'no_llamar' | 'plantilla') => {
    if (!seleccion.length) return;
    const txt = que === 'descalificar' ? `¿Descalificar a ${seleccion.length}? Salen de cadencias y secuencias y ya no se les vuelve a llamar en automático.`
      : que === 'no_llamar' ? `¿Marcar a ${seleccion.length} como «no volver a llamar»?`
      : `¿Mandarle la plantilla «${plantilla}» por WhatsApp a ${seleccion.length}?`;
    if (!(await confirmar(txt))) return;
    setOcupado(que); setAviso(''); setErrHoja('');
    const r = await post({ accion: 'lista_masivo', id: sesionId, que, plantilla: plantilla || undefined,
      motivo: `descalificado desde la lista «${d?.raiz?.nombre || ''}» (${d?.rondas?.length || 1} rondas)`,
      personas: seleccion.map(p => ({ contact_id: p.contact_id, telefono: p.telefono, nombre: p.nombre })) });
    setOcupado('');
    if (r?.error) { setAviso(r.error); setErrHoja(r.error); return; }
    setAviso(`${r.hechos} listos${r.fallas?.length ? ` · ${r.fallas.length} no: ${r.fallas.slice(0, 3).join(' · ')}${r.fallas.length > 3 ? '…' : ''}` : ''}.`);
    setSel(new Set()); setHoja(false);
    cargar();
  };

  const caja: any = { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 15px' };
  const btn: any = { border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: C.g700 };
  const btnP: any = { ...btn, border: 'none', background: C.moradoTinta, color: '#fff' };
  if (err) return <><div style={{ ...caja, color: '#C0554E', fontSize: movil ? 14 : 12.5 }}>No se pudo armar el resumen de la lista: {err}</div>{respaldo}</>;
  if (!d) return <div style={{ ...caja, fontSize: movil ? 14 : 12.5, color: C.g500 }}>Armando el resumen de la lista…</div>;

  /* ══ EN EL TELÉFONO, UNA SOLA ACCIÓN PRINCIPAL, ABAJO (23-sep-2026) ══════
     Había dos con números distintos —«Volver a llamar a los 12 que faltan» en
     la barra y «Llamar a estos 10» aquí dentro— y no se sabía cuál usar. La
     barra ahora ES la ronda N+1 con los grupos marcados; y en cuanto
     seleccionas gente, se vuelve la barra de la selección: llamarles, o abrir
     sus acciones (descalificar, no volver a llamar, plantilla). */
  /* Mismo alto, letra y peso que la barra de las otras fases de la cabina
     (52 px, 16 px, 800). Y el morado se arma aparte: `btnP` trae la letra de
     12.5 del botón de escritorio y, esparcido encima, encogía el CTA. */
  const btnM: any = { ...btn, minHeight: 52, borderRadius: 12, fontSize: 16, fontWeight: 800, padding: '0 14px' };
  const btnPM: any = { ...btnM, border: 'none', background: C.moradoTinta, color: '#fff' };
  const barra = movil ? (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 390, background: '#fff', boxShadow: '0 -4px 14px rgba(12,11,18,.06)', borderTop: `1px solid ${C.g200}`, padding: '10px 16px max(12px, calc(10px + env(safe-area-inset-bottom)))', display: 'flex', gap: 8, alignItems: 'center' }}>
      {/* La franja de encima se come el toque: ninguna casilla queda pegada a la barra. */}
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: -45, height: 44, background: 'linear-gradient(to bottom, rgba(249,250,251,0), rgba(249,250,251,.92))' }} />
      {seleccion.length > 0 ? (<>
        {/* Con gente seleccionada la barra dice cuántos y qué se puede hacer
            con ellos: llamarles, o el resto de acciones (quitar, descalificar,
            plantilla) en una hoja. */}
        <button onClick={() => setHoja(true)} disabled={!!ocupado} style={{ ...btnM, flexShrink: 0, fontSize: 15, color: '#374151' }}>
          Acciones ({seleccion.length})
        </button>
        <button onClick={() => ronda(seleccion.map(p => p.clave))} disabled={!!ocupado} style={{ ...btnPM, flex: 1, minWidth: 0 }}>
          {ocupado === 'ronda' ? 'Armando…' : `Llamar a ${seleccion.length} · ronda ${siguiente}`}
        </button>
      </>) : (
        <button onClick={() => ronda()} disabled={!aLlamar || !!ocupado} style={{ ...btnPM, flex: 1, ...(aLlamar ? null : { background: '#E0DFE6', color: '#6B7280', cursor: 'default' }), opacity: ocupado ? .85 : 1 }}>
          {ocupado === 'ronda' ? 'Armando…' : aLlamar ? `Llamar a ${aLlamar} · ronda ${siguiente}` : `Marca a quién llamar en la ronda ${siguiente}`}
        </button>
      )}
    </div>
  ) : null;
  /* La hoja va DENTRO de su velo: como hermanos, el velo quedaba encima en el
     mismo nivel y lo de la hoja no se podía medir ni se sabía cuál capa mandaba. */
  const hojaAcciones = movil && hoja && seleccion.length > 0 ? (
    <div onClick={e => { if (e.target === e.currentTarget) setHoja(false); }} style={{ position: 'fixed', inset: 0, zIndex: 395, background: 'rgba(12,11,18,.45)' }}>
    <div role="dialog" aria-label="Acciones sobre los seleccionados" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 396, background: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, boxShadow: '0 -10px 40px rgba(12,11,18,.22)', padding: '6px 16px calc(16px + env(safe-area-inset-bottom))', display: 'grid', gap: 10, maxHeight: '80vh', overflowY: 'auto' }}>
      <span aria-hidden style={{ width: 36, height: 4, borderRadius: 999, background: C.g200, justifySelf: 'center', marginTop: 4 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ flex: 1, fontSize: 16, color: C.g900 }}>{seleccion.length} {seleccion.length === 1 ? 'seleccionado' : 'seleccionados'}</b>
        <button onClick={() => setHoja(false)} aria-label="Cerrar" style={{ width: 44, height: 44, flexShrink: 0, border: 'none', background: 'none', color: C.g500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoX size={20} /></button>
      </div>
      {/* Si la acción falla la hoja sigue abierta: el error se dice AQUÍ,
          no debajo del velo donde no se ve. */}
      {errHoja && <div role="alert" style={{ fontSize: 14, color: '#C0554E', background: '#FDF0EE', border: '1px solid #f0c4bd', borderRadius: 10, padding: '9px 12px', lineHeight: 1.45 }}>No se pudo: {errHoja}</div>}
      <button onClick={() => masivo('descalificar')} disabled={!!ocupado} style={{ ...btnM, color: '#C0554E', border: '1px solid #f0c4bd' }}>{ocupado === 'descalificar' ? 'Descalificando…' : 'Descalificar'}</button>
      <button onClick={() => masivo('no_llamar')} disabled={!!ocupado} style={btnM}>No volver a llamar</button>
      <select value={plantilla} onChange={e => setPlantilla(e.target.value)} style={{ ...btn, minHeight: 50, borderRadius: 12, fontSize: 16, fontWeight: 600, width: '100%' }}>
        <option value="">Mandar plantilla de WhatsApp…</option>
        {(d.plantillas || []).map((t: any) => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
      </select>
      {plantilla && (
        <div style={{ fontSize: 14, color: C.g700, background: '#E7F6EE', borderRadius: 10, padding: '9px 12px', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
          {String((d.plantillas || []).find((t: any) => t.nombre === plantilla)?.cuerpo || '').replace(/\{\{1\}\}/g, '{nombre}')}
        </div>
      )}
      {plantilla && <button onClick={() => masivo('plantilla')} disabled={!!ocupado} style={btnPM}>{ocupado === 'plantilla' ? 'Mandando…' : `Mandarla a ${seleccion.length}`}</button>}
      <button onClick={() => { setSel(new Set()); setHoja(false); }} style={{ ...btnM, fontWeight: 700, color: C.g500 }}>Quitar la selección</button>
    </div>
    </div>
  ) : null;

  /* Ronda N+1: a quién se le vuelve a llamar. En el teléfono va ARRIBA,
     antes de los grupos: es lo que decide qué hace el botón fijo de abajo
     («Llamar a 10 · ronda 3») y quedaba a una pantalla entera de scroll. */
  const rondaEl = (
    <div style={{ border: '1px solid #ddd6fb', background: '#F6F4FF', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 8 }}>
      <b style={{ fontSize: movil ? 15 : 13, color: C.moradoTinta }}>{movil ? `A quién llamar en la ronda ${siguiente}` : `Ejecutar ronda ${siguiente}`}</b>
      {/* 8 px entre renglones: de 44 en 44 y pegados, se picaba el de al lado. */}
      <div style={movil ? { display: 'grid', gap: 8 } : { display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {RELLAMABLES.map(g => (
          <label key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: movil ? 10 : 6, fontSize: movil ? 14 : 12.5, color: C.g700, cursor: 'pointer' }}>
            <input type="checkbox" checked={gruposRonda.has(g)} onChange={e => setGruposRonda(v => { const n = new Set(v); e.target.checked ? n.add(g) : n.delete(g); return n; })} />
            {d.grupos.find((x: any) => x.id === g)?.label} <span style={{ color: movil ? C.g700 : C.g400, fontWeight: movil ? 700 : undefined }}>({d.conteo[g] || 0})</span>
          </label>
        ))}
      </div>
      {movil ? (
        <span style={{ fontSize: 14, color: C.g500, lineHeight: 1.45 }}>Quien ya tenga cita, seguimiento o esté descalificado se queda fuera solo. La ronda se arma con el botón de abajo.</span>
      ) : (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => ronda()} disabled={!aLlamar || !!ocupado} style={{ ...btnP, opacity: aLlamar && !ocupado ? 1 : .5 }}>
          {ocupado === 'ronda' ? 'Armando…' : `Llamar a estos ${aLlamar}`}
        </button>
        <span style={{ fontSize: 11, color: C.g500 }}>Quien ya tenga cita, seguimiento o esté descalificado se queda fuera solo.</span>
      </div>
      )}
    </div>
  );

  return (
    <div style={{ ...caja, display: 'grid', gap: 12 }}>
      {/* Encabezado: qué lista es y cuántas rondas lleva. */}
      {/* En el teléfono título y cuántas rondas en texto corrido (ronda 5):
          la pastilla bajaba sola a su renglón a 360. El nombre de la lista ya
          está en el encabezado de la cabina. */}
      {movil ? (
        <div style={{ display: 'grid', gap: 2 }}>
          <b style={{ fontSize: 16, color: C.g900, lineHeight: 1.3 }}>Cómo quedó la lista</b>
          <span style={{ fontSize: 14, color: C.g500, lineHeight: 1.4 }}>{d.rondas.length} {d.rondas.length === 1 ? 'ronda' : 'rondas'} · {d.total} personas · toca un grupo para verlo; marca a quién llamar en la ronda {siguiente}</span>
        </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: C.g500 }}>Resumen de la lista</span>
        <b style={{ fontSize: 14, color: C.g900, flex: 1, minWidth: 0, lineHeight: 1.3 }}>{d.raiz?.nombre}</b>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.moradoTinta, background: C.moradoAgua, borderRadius: 999, padding: '3px 10px' }}>
          {d.rondas.length} {d.rondas.length === 1 ? 'ronda' : 'rondas'} · {d.total} personas
        </span>
      </div>
      )}

      {/* Los grupos, con su número: cada uno filtra la tabla de abajo. En el
          teléfono se dice que son PERSONAS: arriba, el resumen de la jornada
          cuenta llamadas, y 5 en buzón contra «14 buzón» parecía un error. */}
      {/* EN EL TELÉFONO, EL PANORAMA Y LA RONDA SON UNA SOLA REJILLA (ronda 5).
          Antes «Nunca contestaron (10)» salía dos veces seguidas —en «A quién
          llamar» y en los grupos— y la rejilla quedaba bajo el pliegue. Ahora
          cada grupo que se puede volver a llamar trae su casilla «Ronda N»
          debajo: arriba se toca para ver a la gente, abajo se marca para la
          ronda. Mismo estado (`gruposRonda`) y mismo botón de la barra. */}
      {movil ? (
      /* UNA COLUMNA (guía de continuidad §7, 24-sep-2026). En la rejilla de
         dos, «Descalificados» sin casilla quedaba junto a «Buzón» con
         casilla: alturas desiguales y un hueco. Ahora cada grupo es un
         renglón —franja, número, nombre— y a la derecha la casilla de la
         ronda SÓLO si se le puede volver a llamar. */
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
        {d.grupos.map((g: any) => {
          const activo = filtro === g.id; const rellamable = RELLAMABLES.includes(g.id);
          const n = d.conteo[g.id] || 0;
          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'stretch', gap: 8, minHeight: 56, background: activo ? '#EEECFE' : '#fff', borderTop: `1px solid ${activo ? '#9B8CFA' : C.g200}`, borderRight: `1px solid ${activo ? '#9B8CFA' : C.g200}`, borderBottom: `1px solid ${activo ? '#9B8CFA' : C.g200}`, borderLeft: `3px solid ${COLOR_M[g.id]}`, borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => { setFiltro(activo ? '' : g.id); setSel(new Set()); if (!activo) irAPersonas.current = true; }} title={g.que} aria-pressed={activo}
                style={{ flex: 1, minWidth: 0, minHeight: 56, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: 'none', border: 'none', padding: '6px 10px 6px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Columna de 36 px con el número centrado (ronda 1 cabina):
                    alineado a la izquierda, un «4» dejaba ~30 px de aire antes
                    del rótulo y el renglón se veía cojo. */}
                <span style={{ width: 36, flexShrink: 0, textAlign: 'center', fontSize: 22, fontWeight: 800, color: n ? NUM_M[g.id] : C.g500, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: n ? C.g900 : C.g500, lineHeight: 1.3 }}>{g.label}</span>
              </button>
              {rellamable && (
                <label style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, minWidth: 44, padding: '0 12px 0 10px', borderLeft: `1px solid ${C.g100}`, fontSize: 13, fontWeight: 700, color: gruposRonda.has(g.id) ? C.moradoTinta : C.g500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={gruposRonda.has(g.id)} aria-label={`Llamar a «${g.label}» en la ronda ${siguiente}`}
                    onChange={e => setGruposRonda(v => { const n = new Set(v); e.target.checked ? n.add(g.id) : n.delete(g.id); return n; })} />
                  Ronda {siguiente}
                </label>
              )}
            </div>
          );
        })}
      </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {d.grupos.map((g: any) => (
          <button key={g.id} onClick={() => { setFiltro(filtro === g.id ? '' : g.id); setSel(new Set()); }} title={g.que}
            style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: filtro === g.id ? '#F6F4FF' : '#fff',
              /* Los cuatro lados por separado: `border` + `borderLeft` en el mismo
                 objeto hace que React avise al cambiar el filtro (y que el borde
                 de color se pierda en el repintado). */
              borderTop: `1.5px solid ${filtro === g.id ? '#c9bcf7' : '#ececec'}`, borderRight: `1.5px solid ${filtro === g.id ? '#c9bcf7' : '#ececec'}`, borderBottom: `1.5px solid ${filtro === g.id ? '#c9bcf7' : '#ececec'}`, borderLeft: `4px solid ${COLOR[g.id]}`, borderRadius: 10, padding: '8px 10px', opacity: d.conteo[g.id] ? 1 : .5 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLOR[g.id], lineHeight: 1.1 }}>{d.conteo[g.id] || 0}</div>
            <div style={{ fontSize: movil ? 13 : 11.5, fontWeight: 700, color: C.g900, lineHeight: 1.3 }}>{g.label}</div>
          </button>
        ))}
      </div>
      )}
      {movil && <span style={{ fontSize: 13, color: C.g500, lineHeight: 1.45 }}>Quien ya tenga cita, seguimiento o esté descalificado se queda fuera de la ronda solo.</span>}

      {!movil && rondaEl}

      {/* En el teléfono la ronda se lanza desde la barra de abajo: su aviso se trae a la vista para que un error no quede escondido a media tarjeta. */}
      {aviso && <div ref={el => { if (el && movil) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }} role={movil ? 'status' : undefined} style={{ fontSize: movil ? 14 : 12, color: C.g700, background: C.g50, borderRadius: 8, padding: '7px 10px', scrollMarginBottom: movil ? 96 : undefined }}>{aviso}</div>}

      {/* Acciones masivas sobre los seleccionados. En el teléfono se dice
          para qué son estas casillas: convivían con las de la ronda sin
          explicar que éstas son para actuar sobre personas sueltas. */}
      {movil && <b ref={personasRef} style={{ fontSize: 15, color: C.g900, marginBottom: -6, scrollMarginTop: 12 }}>Personas del grupo{filtro ? ` · ${d.grupos.find((g: any) => g.id === filtro)?.label || ''}` : ''}</b>}
      {movil && <span style={{ fontSize: 14, color: C.g500, lineHeight: 1.45, marginBottom: -4 }}>Márcalas para llamarles solo a ellas, o para descalificarlas, no volver a llamarles o mandarles una plantilla juntas. Las acciones salen en la barra de abajo.</span>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: movil ? 10 : 6, fontSize: movil ? 14 : 12, color: C.g700, cursor: 'pointer' }}>
          <input type="checkbox" aria-label="Seleccionar a todos los de este grupo" checked={!!visibles.length && visibles.every(p => sel.has(p.clave))}
            onChange={e => setSel(e.target.checked ? new Set(visibles.map(p => p.clave)) : new Set())} />
          Todos los de este grupo ({visibles.length})
        </label>
        <span style={{ flex: 1 }} />
        {seleccion.length > 0 && !movil && <>
          <b style={{ fontSize: 12, color: C.moradoTinta }}>{seleccion.length} seleccionados:</b>
          <button onClick={() => ronda(seleccion.map(p => p.clave))} disabled={!!ocupado} style={btn}>Llamarles en ronda {siguiente}</button>
          <button onClick={() => masivo('descalificar')} disabled={!!ocupado} style={{ ...btn, color: '#C0554E' }}>{ocupado === 'descalificar' ? 'Descalificando…' : 'Descalificar'}</button>
          <button onClick={() => masivo('no_llamar')} disabled={!!ocupado} style={btn}>No volver a llamar</button>
          <select value={plantilla} onChange={e => setPlantilla(e.target.value)} style={{ ...btn, fontWeight: 600, maxWidth: movil ? '100%' : 230 }}>
            <option value="">Mandar plantilla de WhatsApp…</option>
            {(d.plantillas || []).map((t: any) => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
          </select>
          {plantilla && <button onClick={() => masivo('plantilla')} disabled={!!ocupado} style={btnP}>{ocupado === 'plantilla' ? 'Mandando…' : 'Mandar'}</button>}
        </>}
      </div>
      {plantilla && !movil && (
        <div style={{ fontSize: 11.5, color: C.g700, background: '#E7F6EE', borderRadius: 10, padding: '7px 10px', whiteSpace: 'pre-wrap' }}>
          {String((d.plantillas || []).find((t: any) => t.nombre === plantilla)?.cuerpo || '').replace(/\{\{1\}\}/g, '{nombre}')}
        </div>
      )}

      {/* Una fila por persona: qué pasó en cada ronda y en qué quedó. */}
      {/* En el teléfono cada persona es su propia tarjeta con 8 px de aire:
          pegadas borde con borde, se marcaba la casilla del de al lado. */}
      <div style={movil ? { display: 'grid', gap: 8 } : { display: 'grid', gap: 0, border: '1px solid #f0f0f2', borderRadius: 10, overflow: 'hidden' }}>
        {!visibles.length && <div style={{ padding: 14, fontSize: movil ? 14 : 12, color: movil ? C.g500 : C.g400, ...(movil ? { background: '#fff', border: '1px solid #ececec', borderRadius: 10 } : null) }}>Nadie en este grupo.</div>}
        {visibles.slice(0, 300).map(p => (
          <label key={p.clave} style={{ display: 'flex', alignItems: movil ? 'flex-start' : 'center', gap: movil ? '6px 12px' : 10, padding: movil ? '11px 12px' : '8px 11px', ...(movil ? { border: `1px solid ${sel.has(p.clave) ? '#c9bcf7' : '#ececec'}`, borderRadius: 10 } : { borderTop: '1px solid #f3f3f5' }), cursor: 'pointer', background: sel.has(p.clave) ? '#F6F4FF' : '#fff', flexWrap: movil ? 'wrap' : 'nowrap' }}>
            <input type="checkbox" checked={sel.has(p.clave)} onChange={e => setSel(v => { const n = new Set(v); e.target.checked ? n.add(p.clave) : n.delete(p.clave); return n; })} />
            <span style={{ flex: '1 1 160px', minWidth: 0 }}>
              {/* En el teléfono el nombre y el teléfono van enteros: son lo que
                  se viene a leer antes de marcar a alguien otra vez. */}
              {/* En el teléfono la empresa va en su propio renglón gris: pegada
                  al nombre se partía («Tiendas / Domínguez») y cada fila medía
                  ~124 px. */}
              <b style={{ display: 'block', fontSize: movil ? 15 : 12.5, color: C.g900, ...(movil ? { overflowWrap: 'anywhere', lineHeight: 1.3 } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>{p.nombre || telefonoLegible(p.telefono)}{p.empresa && !movil ? <span style={{ fontWeight: 400, color: C.g500 }}> · {p.empresa}</span> : null}</b>
              {movil && p.empresa && <span style={{ display: 'block', fontSize: 14, color: C.g500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{p.empresa}</span>}
              <span style={{ fontSize: movil ? 14 : 11, color: movil ? C.g700 : C.g500 }}>{telefonoLegible(p.telefono)}{!p.contact_id ? ' · prospección' : ''}</span>
            </span>
            {/* En el teléfono, las rondas dichas con palabras en pastillas de 13
                px: los círculos de 6 px con «R1» debajo no se leían y pedían
                una leyenda de glifos. */}
            {movil ? (
            <span style={{ flex: '1 1 100%', display: 'flex', gap: '2px 14px', flexWrap: 'wrap', paddingLeft: 34 }}>
              {p.rondas.map((r: any, i: number) => { const m = MARCA[r.r] || { s: '?', c: C.g500, t: r.r }; const c = m.c === '#2C5FC4' ? '#9a6a10' : m.c; return (
                /* Son estados, no botones (guía §6): punto de 8 px y texto de
                   13 px, sin fondo ni borde — en pastilla gris parecían chips
                   para tocar. Los grises y el lila claro no llegan a 4.5:1:
                   el texto va en gris oscuro y morado tinta. */
                <span key={i} title={`Ronda ${r.ronda}: ${m.t}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: c === '#9CA3AF' ? '#4B5563' : c === '#9B8CFA' ? C.moradoTinta : c, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: c }} />
                  R{r.ronda} {CORTO[r.r] || m.t}
                </span>); })}
            </span>
            ) : (
            <span style={{ display: 'flex', gap: 5, flexShrink: 0 }} title="Ronda por ronda">
              {p.rondas.map((r: any, i: number) => { const m = MARCA[r.r] || { s: '?', c: C.g400, t: r.r }; return (
                <span key={i} title={`Ronda ${r.ronda}: ${m.t}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: movil ? 12 : 9.5, color: movil ? C.g500 : C.g400, lineHeight: 1.1 }}>
                  <span style={{ fontSize: movil ? 16 : 14, color: m.c }}>{m.s}</span>R{r.ronda}
                </span>); })}
            </span>
            )}
            {/* En el teléfono no se repite el grupo que ya está filtrado arriba:
                cada fila bajaba a ~80 px y caben siete por pantalla, no cinco. */}
            {!(movil && !p.accion && p.grupo === filtro) && (
            <span style={{ flex: movil ? '1 1 100%' : '0 0 190px', fontSize: movil ? 13 : 11.5, paddingLeft: movil ? 34 : 0, color: movil ? NUM_M[p.grupo] : COLOR[p.grupo], fontWeight: 700, textAlign: movil ? 'left' : 'right' }}>
              {p.accion || d.grupos.find((g: any) => g.id === p.grupo)?.label}
            </span>
            )}
          </label>
        ))}
      </div>
      {!movil && <div style={{ fontSize: 10.5, color: C.g400, lineHeight: 1.5 }}>● contestó · ▣ buzón o contestadora · ○ timbró sin contestar · ◐ descolgó y colgó · · sin marcar · – fuera</div>}
      {barra}
      {hojaAcciones}
    </div>
  );
}
