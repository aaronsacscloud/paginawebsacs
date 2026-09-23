// LA LISTA COMO TABLERO (22-sep-2026) · resumen de la lista a través de sus
// rondas, «Ejecutar ronda N+1» y acciones masivas. Vive en la pantalla final
// de la jornada (Cabina, fase `fin`). Todo sale de `lista_resumen` y cada
// acción vuelve a pedirlo: una sola fuente de verdad.
import { useEffect, useMemo, useState } from 'react';
import { C } from './estilo';
import { telefonoLegible } from '../../../../lib/telefono';

type Props = {
  sesionId: string;
  post: (b: any) => Promise<any>;
  movil?: boolean;
  onRondaCreada: (id: string) => void;
  confirmar: (msg: string) => Promise<boolean>;
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
const COLOR: Record<string, string> = { accion: '#1E8A63', contesto: '#5B4BD6', descalificado: '#C0554E', buzon: '#9a6a10', contestadora: '#2C5FC4', nunca: '#7C3AED', sin_marcar: '#6B7280', fuera: '#9CA3AF' };
const RELLAMABLES = ['nunca', 'buzon', 'contestadora', 'sin_marcar'];

export default function ResumenLista({ sesionId, post, movil, onRondaCreada, confirmar }: Props) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [filtro, setFiltro] = useState<string>('nunca');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [gruposRonda, setGruposRonda] = useState<Set<string>>(new Set(['nunca']));
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');
  const [plantilla, setPlantilla] = useState('');

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
    setOcupado(que); setAviso('');
    const r = await post({ accion: 'lista_masivo', id: sesionId, que, plantilla: plantilla || undefined,
      motivo: `descalificado desde la lista «${d?.raiz?.nombre || ''}» (${d?.rondas?.length || 1} rondas)`,
      personas: seleccion.map(p => ({ contact_id: p.contact_id, telefono: p.telefono, nombre: p.nombre })) });
    setOcupado('');
    if (r?.error) { setAviso(r.error); return; }
    setAviso(`${r.hechos} listos${r.fallas?.length ? ` · ${r.fallas.length} no: ${r.fallas.slice(0, 3).join(' · ')}${r.fallas.length > 3 ? '…' : ''}` : ''}.`);
    setSel(new Set());
    cargar();
  };

  const caja: any = { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 15px' };
  const btn: any = { border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: C.g700 };
  const btnP: any = { ...btn, border: 'none', background: C.moradoTinta, color: '#fff' };
  if (err) return <div style={{ ...caja, color: '#C0554E', fontSize: 12.5 }}>No se pudo armar el resumen de la lista: {err}</div>;
  if (!d) return <div style={{ ...caja, fontSize: 12.5, color: C.g500 }}>Armando el resumen de la lista…</div>;

  return (
    <div style={{ ...caja, display: 'grid', gap: 12 }}>
      {/* Encabezado: qué lista es y cuántas rondas lleva. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: C.g500 }}>Resumen de la lista</span>
        <b style={{ fontSize: 14, color: C.g900, flex: 1, minWidth: 0 }}>{d.raiz?.nombre}</b>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.moradoTinta, background: C.moradoAgua, borderRadius: 999, padding: '3px 10px' }}>
          {d.rondas.length} {d.rondas.length === 1 ? 'ronda' : 'rondas'} · {d.total} personas
        </span>
      </div>

      {/* Los grupos, con su número: cada uno filtra la tabla de abajo. */}
      <div style={{ display: 'grid', gridTemplateColumns: movil ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {d.grupos.map((g: any) => (
          <button key={g.id} onClick={() => { setFiltro(filtro === g.id ? '' : g.id); setSel(new Set()); }} title={g.que}
            style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: filtro === g.id ? '#F6F4FF' : '#fff', border: `1.5px solid ${filtro === g.id ? '#c9bcf7' : '#ececec'}`, borderLeft: `4px solid ${COLOR[g.id]}`, borderRadius: 10, padding: '8px 10px', opacity: d.conteo[g.id] ? 1 : .5 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLOR[g.id], lineHeight: 1.1 }}>{d.conteo[g.id] || 0}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.g900 }}>{g.label}</div>
          </button>
        ))}
      </div>

      {/* Ronda N+1: a quién se le vuelve a llamar. */}
      <div style={{ border: '1px solid #ddd6fb', background: '#F6F4FF', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 8 }}>
        <b style={{ fontSize: 13, color: C.moradoTinta }}>Ejecutar ronda {siguiente}</b>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {RELLAMABLES.map(g => (
            <label key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.g700, cursor: 'pointer' }}>
              <input type="checkbox" checked={gruposRonda.has(g)} onChange={e => setGruposRonda(v => { const n = new Set(v); e.target.checked ? n.add(g) : n.delete(g); return n; })} />
              {d.grupos.find((x: any) => x.id === g)?.label} <span style={{ color: C.g400 }}>({d.conteo[g] || 0})</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => ronda()} disabled={!aLlamar || !!ocupado} style={{ ...btnP, opacity: aLlamar && !ocupado ? 1 : .5 }}>
            {ocupado === 'ronda' ? 'Armando…' : `Llamar a estos ${aLlamar}`}
          </button>
          <span style={{ fontSize: 11, color: C.g500 }}>Quien ya tenga cita, seguimiento o esté descalificado se queda fuera solo.</span>
        </div>
      </div>

      {aviso && <div style={{ fontSize: 12, color: C.g700, background: C.g50, borderRadius: 8, padding: '7px 10px' }}>{aviso}</div>}

      {/* Acciones masivas sobre los seleccionados. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.g700, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!visibles.length && visibles.every(p => sel.has(p.clave))}
            onChange={e => setSel(e.target.checked ? new Set(visibles.map(p => p.clave)) : new Set())} />
          Todos los de este grupo ({visibles.length})
        </label>
        <span style={{ flex: 1 }} />
        {seleccion.length > 0 && <>
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
      {plantilla && (
        <div style={{ fontSize: 11.5, color: C.g700, background: '#E7F6EE', borderRadius: 10, padding: '7px 10px', whiteSpace: 'pre-wrap' }}>
          {String((d.plantillas || []).find((t: any) => t.nombre === plantilla)?.cuerpo || '').replace(/\{\{1\}\}/g, '{nombre}')}
        </div>
      )}

      {/* Una fila por persona: qué pasó en cada ronda y en qué quedó. */}
      <div style={{ display: 'grid', gap: 0, border: '1px solid #f0f0f2', borderRadius: 10, overflow: 'hidden' }}>
        {!visibles.length && <div style={{ padding: 14, fontSize: 12, color: C.g400 }}>Nadie en este grupo.</div>}
        {visibles.slice(0, 300).map(p => (
          <label key={p.clave} style={{ display: 'flex', alignItems: movil ? 'flex-start' : 'center', gap: 10, padding: '8px 11px', borderTop: '1px solid #f3f3f5', cursor: 'pointer', background: sel.has(p.clave) ? '#F6F4FF' : '#fff', flexWrap: movil ? 'wrap' : 'nowrap' }}>
            <input type="checkbox" checked={sel.has(p.clave)} onChange={e => setSel(v => { const n = new Set(v); e.target.checked ? n.add(p.clave) : n.delete(p.clave); return n; })} />
            <span style={{ flex: '1 1 160px', minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 12.5, color: C.g900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre || telefonoLegible(p.telefono)}{p.empresa ? <span style={{ fontWeight: 400, color: C.g500 }}> · {p.empresa}</span> : null}</b>
              <span style={{ fontSize: 11, color: C.g500 }}>{telefonoLegible(p.telefono)}{!p.contact_id ? ' · prospección' : ''}</span>
            </span>
            <span style={{ display: 'flex', gap: 5, flexShrink: 0 }} title="Ronda por ronda">
              {p.rondas.map((r: any, i: number) => { const m = MARCA[r.r] || { s: '?', c: C.g400, t: r.r }; return (
                <span key={i} title={`Ronda ${r.ronda}: ${m.t}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: 9.5, color: C.g400, lineHeight: 1.1 }}>
                  <span style={{ fontSize: 14, color: m.c }}>{m.s}</span>R{r.ronda}
                </span>); })}
            </span>
            <span style={{ flex: movil ? '1 1 100%' : '0 0 190px', fontSize: 11.5, color: COLOR[p.grupo], fontWeight: 700, textAlign: movil ? 'left' : 'right' }}>
              {p.accion || d.grupos.find((g: any) => g.id === p.grupo)?.label}
            </span>
          </label>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: C.g400 }}>● contestó · ▣ buzón o contestadora · ○ timbró sin contestar · ◐ descolgó y colgó · · sin marcar · – fuera</div>
    </div>
  );
}
