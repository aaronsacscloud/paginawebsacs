// Audiencias: segmentos (se recalculan) y listas (fijas).
//
// El constructor no enseña AND/OR. Enseña frases: "que cumplan TODO esto…" y,
// entre grupos, "o bien, TODO esto". Excluir es una zona aparte, en rojo,
// porque un NOT anidado no lo entiende nadie que no programe.
import { useEffect, useState } from 'react';
import { S, Tag, Vacio, Cargando, Aviso, chip } from './ui';

export default function Audiencias() {
  const [segs, setSegs] = useState<any[] | null>(null);
  const [listas, setListas] = useState<any[]>([]);
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null);
  const [vista, setVista] = useState<'segmentos' | 'listas'>('segmentos');

  const cargar = () => {
    fetch('/api/crm/email/segments').then(r => r.json()).then(j => setSegs(j.segmentos || []));
    fetch('/api/crm/email/lists').then(r => r.json()).then(j => setListas(j.listas || []));
  };
  useEffect(() => { cargar(); }, []);

  if (editando) return <Editor id={editando} onCerrar={() => { setEditando(null); cargar(); }} />;
  if (!segs) return <Cargando que="las audiencias" />;

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Audiencias</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>A quién le puedes escribir, y con qué criterio</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={chip(vista === 'segmentos')} onClick={() => setVista('segmentos')}>Segmentos</button>
          <button style={chip(vista === 'listas')} onClick={() => setVista('listas')}>Listas</button>
          {vista === 'segmentos' && <button style={S.btnP} onClick={() => setEditando('nuevo')}>+ Nuevo segmento</button>}
          {vista === 'listas' && <button style={S.btnP} onClick={async () => {
            const nombre = prompt('¿Cómo se llama la lista?'); if (!nombre?.trim()) return;
            await fetch('/api/crm/email/lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) });
            cargar();
          }}>+ Nueva lista</button>}
        </div>
      </div>

      {vista === 'segmentos' && (segs.length === 0 ? (
        <Vacio titulo="Sin segmentos todavía"
          texto="Un segmento es una pregunta guardada: “clientes con plan anual”, “leads de TikTok sin reunión”. Se recalcula solo cada vez que envías."
          accion={<button style={S.btnP} onClick={() => setEditando('nuevo')}>Crear el primero</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {segs.map(s => (
            <div key={s.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => setEditando(s.id)}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{s.nombre}</div>
              {s.descripcion && <div style={{ fontSize: '0.74rem', color: '#8a8a8a', marginTop: 3 }}>{s.descripcion}</div>}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{s.ultimo_conteo ?? '—'}</span>
                <span style={{ fontSize: '0.7rem', color: '#a5a2af' }}>contactos al último cálculo</span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {vista === 'listas' && (listas.length === 0 ? (
        <Vacio titulo="Sin listas todavía" texto="Una lista es un grupo fijo que tú armas a mano o importas de un CSV. No cambia sola." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {listas.map(l => (
            <div key={l.id} style={S.card}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{l.nombre}</div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{l.total}</span>
                <span style={{ fontSize: '0.7rem', color: '#a5a2af' }}>miembros</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Editor({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const nuevo = id === 'nuevo';
  const [cat, setCat] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [grupos, setGrupos] = useState<any[]>([{ condiciones: [] }]);
  const [excluir, setExcluir] = useState<any[]>([]);
  const [prev, setPrev] = useState<any>(null);
  const [listas, setListas] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/crm/email/segments?catalogo=1').then(r => r.json()).then(j => setCat(j.catalogo));
    fetch('/api/crm/email/lists').then(r => r.json()).then(j => setListas(j.listas || []));
    if (!nuevo) fetch(`/api/crm/email/segments?id=${id}`).then(r => r.json()).then(j => {
      setNombre(j.segmento?.nombre || '');
      setGrupos(j.segmento?.definicion?.grupos?.length ? j.segmento.definicion.grupos : [{ condiciones: [] }]);
      setExcluir(j.segmento?.definicion?.excluir || []);
    });
  }, [id]);

  // Vista previa en vivo: el número que importa mientras se arma.
  useEffect(() => {
    const def = { grupos, excluir };
    if (!grupos.some(g => g.condiciones.length)) { setPrev(null); return; }
    const t = setTimeout(() => {
      fetch('/api/crm/email/segments?preview=1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definicion: def }),
      }).then(r => r.json()).then(setPrev).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [grupos, excluir]);

  if (!cat) return <Cargando que="el constructor" />;

  const setCond = (gi: number, ci: number, campos: any) =>
    setGrupos(gs => gs.map((g, i) => i !== gi ? g : { ...g, condiciones: g.condiciones.map((c: any, j: number) => j !== ci ? c : { ...c, ...campos }) }));
  const addCond = (gi: number) =>
    setGrupos(gs => gs.map((g, i) => i !== gi ? g : { ...g, condiciones: [...g.condiciones, { sujeto: 'contacto', campo: 'lifecycle_stage', operador: 'es', valor: '' }] }));
  const delCond = (gi: number, ci: number) =>
    setGrupos(gs => gs.map((g, i) => i !== gi ? g : { ...g, condiciones: g.condiciones.filter((_: any, j: number) => j !== ci) }));

  async function guardar() {
    const def = { grupos: grupos.filter(g => g.condiciones.length), excluir };
    if (!nombre.trim()) { setMsg('Ponle nombre al segmento.'); return; }
    if (!def.grupos.length) { setMsg('Agrega al menos una condición.'); return; }
    const r = nuevo
      ? await fetch('/api/crm/email/segments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, definicion: def }) })
      : await fetch('/api/crm/email/segments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nombre, definicion: def }) });
    const j = await r.json();
    if (j.error) { setMsg(j.error); return; }
    onCerrar();
  }

  const selEstilo = { border: '1px solid #e2e4e9', borderRadius: 8, padding: '6px 9px', fontSize: '0.76rem', fontFamily: 'inherit', background: '#fff', maxWidth: 200 };

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <button style={S.btnG} onClick={onCerrar}>← Audiencias</button>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del segmento"
          style={{ ...S.inp, maxWidth: 320, fontWeight: 700 }} />
        <button style={{ ...S.btnP, marginLeft: 'auto' }} onClick={guardar}>Guardar segmento</button>
      </div>
      {msg && <Aviso tono="malo">{msg}</Aviso>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div>
          {grupos.map((g, gi) => (
            <div key={gi}>
              {gi > 0 && <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#a5a2af', fontWeight: 700, margin: '8px 0' }}>— o bien, TODO esto —</div>}
              <div style={{ ...S.card, marginBottom: 10 }}>
                <div style={S.kl}>{gi === 0 ? 'Que cumplan TODO esto…' : 'Que cumplan TODO esto…'}</div>
                {g.condiciones.map((c: any, ci: number) => {
                  const campos = cat[c.sujeto]?.campos || [];
                  const campo = campos.find((f: any) => f.id === c.campo);
                  return (
                    <div key={ci} style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 9, flexWrap: 'wrap' }}>
                      <select value={c.sujeto} style={selEstilo}
                        onChange={e => { const s = e.target.value; const f = cat[s].campos[0]; setCond(gi, ci, { sujeto: s, campo: f.id, operador: f.operadores[0], valor: '' }); }}>
                        {Object.entries(cat).map(([k, v]: any) => <option key={k} value={k}>{v.etiqueta}</option>)}
                      </select>
                      <select value={c.campo} style={selEstilo}
                        onChange={e => { const f = campos.find((x: any) => x.id === e.target.value); setCond(gi, ci, { campo: e.target.value, operador: f.operadores[0], valor: '' }); }}>
                        {campos.map((f: any) => <option key={f.id} value={f.id}>{f.etiqueta}</option>)}
                      </select>
                      <select value={c.operador} style={selEstilo} onChange={e => setCond(gi, ci, { operador: e.target.value })}>
                        {(campo?.operadores || []).map((o: string) => <option key={o} value={o}>{ETIQ[o] || o}</option>)}
                      </select>
                      {!['existe', 'no_existe'].includes(c.operador) && (
                        campo?.opciones
                          ? <select value={c.valor ?? ''} style={selEstilo} onChange={e => setCond(gi, ci, { valor: e.target.value })}>
                              <option value="">— elige —</option>
                              {campo.opciones.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          : <input value={c.valor ?? ''} onChange={e => setCond(gi, ci, { valor: e.target.value })}
                              placeholder={['en_los_ultimos_dias', 'hace_mas_de_dias', 'en_los_proximos_dias'].includes(c.operador) ? 'días' : 'valor'}
                              style={{ ...selEstilo, width: 130 }} />
                      )}
                      <button style={{ border: 'none', background: 'none', color: '#c0554e', cursor: 'pointer', fontSize: '0.9rem' }}
                        onClick={() => delCond(gi, ci)} title="Quitar">✕</button>
                    </div>
                  );
                })}
                <button style={{ ...S.btnG, marginTop: 11, fontSize: '0.74rem' }} onClick={() => addCond(gi)}>+ Agregar condición</button>
              </div>
            </div>
          ))}
          <button style={{ ...S.btnG, marginBottom: 12 }} onClick={() => setGrupos(g => [...g, { condiciones: [] }])}>+ Agregar otro grupo (O)</button>

          <div style={{ ...S.card, borderColor: '#f7c9c5', background: '#FFFAF9' }}>
            <div style={{ ...S.kl, color: '#C0554E' }}>Excluir siempre</div>
            <div style={{ fontSize: '0.74rem', color: '#8a8a8a', margin: '6px 0 9px' }}>Estas personas quedan fuera aunque cumplan lo de arriba.</div>
            {excluir.map((e: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 7 }}>
                <Tag tono="malo">{e.tipo === 'lista' ? 'Lista' : 'Segmento'}</Tag>
                <span style={{ fontSize: '0.78rem' }}>{listas.find((l: any) => l.id === e.id)?.nombre || e.id}</span>
                <button style={{ border: 'none', background: 'none', color: '#c0554e', cursor: 'pointer' }} onClick={() => setExcluir(x => x.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <select value="" style={selEstilo} onChange={e => { if (e.target.value) setExcluir(x => [...x, { tipo: 'lista', id: e.target.value }]); }}>
              <option value="">+ Excluir una lista…</option>
              {listas.map((l: any) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.kl}>Vista previa</div>
          <div style={{ ...S.kv, marginTop: 6 }}>{prev?.total ?? '—'}</div>
          <div style={S.ks}>Se recalcula al momento de enviar — hoy serían {prev?.total ?? 0}.</div>
          {prev?.muestra?.length > 0 && (
            <div style={{ borderTop: '1px solid #f5f4f8', marginTop: 11, paddingTop: 10, maxHeight: 300, overflowY: 'auto' }}>
              {prev.muestra.map((m: any) => (
                <div key={m.id} style={{ fontSize: '0.77rem', padding: '4px 0' }}>
                  {m.nombre}{m.empresa && <span style={{ color: '#a5a2af' }}> · {m.empresa}</span>}
                </div>
              ))}
              {prev.total > prev.muestra.length && <div style={{ fontSize: '0.72rem', color: '#a5a2af', marginTop: 6 }}>… y {prev.total - prev.muestra.length} más</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ETIQ: Record<string, string> = {
  es: 'es', no_es: 'no es', contiene: 'contiene', existe: 'tiene dato', no_existe: 'está vacío',
  mayor_que: 'es mayor que', menor_que: 'es menor que',
  en_los_ultimos_dias: 'fue en los últimos', hace_mas_de_dias: 'fue hace más de', en_los_proximos_dias: 'será en los próximos',
};
