// Disparadores: qué hace alguien en el sitio para que le llegue un correo.
//
// La pantalla se apoya en dos cosas que evitan el error caro: las rutas se
// eligen de las que DE VERDAD se visitan (no se teclean), y antes de encender
// una regla se ve a cuánta gente habría alcanzado en 30 días.
import { useEffect, useState } from 'react';
import { S, Tag, Aviso, Vacio, Cargando, chip, fmtFecha, Modal, Confirmar } from './ui';

const ESTADO: Record<string, string> = { activa: 'ok', pausada: 'aviso', borrador: 'gris' };

export default function ReglasWeb({ onIrA }: { onIrA?: (s: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [listas, setListas] = useState<any[] | null>(null);
  const [editando, setEditando] = useState<any>(null);
  const [msg, setMsg] = useState<{ tipo: string; texto: string } | null>(null);
  const [borrar, setBorrar] = useState<any>(null);

  const cargar = () => {
    fetch('/api/crm/email/reglas-web').then(r => r.json()).then(setD).catch(() => setD({ reglas: [] }));
    fetch('/api/crm/email/reglas-web?listas=1').then(r => r.json()).then(j => setListas(j.listas || [])).catch(() => setListas([]));
  };
  useEffect(() => { cargar(); }, []);

  async function accion(id: string, estado: string) {
    const r = await fetch('/api/crm/email/reglas-web', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estado }),
    });
    const j = await r.json();
    if (j.error) { setMsg({ tipo: 'malo', texto: j.error }); return; }
    setMsg({ tipo: 'ok', texto: estado === 'activa'
      ? 'Activada. Solo cuenta lo que pase de ahora en adelante — nadie recibirá nada por lo que navegó antes.'
      : 'Pausada. Deja de disparar; quien ya va en camino sigue su embudo.' });
    cargar();
  }

  async function crearLista(l: any) {
    const r = await fetch('/api/crm/email/reglas-web?listo=' + l.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json();
    if (j.error) { setMsg({ tipo: 'malo', texto: j.error }); return; }
    setMsg({ tipo: j.aviso ? 'aviso' : 'ok', texto: j.aviso || `"${l.nombre}" creada en borrador. Revísala y actívala cuando quieras.` });
    cargar();
  }

  if (!d) return <Cargando que="los disparadores" />;
  const reglas = d.reglas || [];

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Disparadores</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>
            Qué hace alguien en el sitio para que le llegue un correo
          </div>
        </div>
        <button style={{ ...S.btnP, marginLeft: 'auto' }} onClick={() => setEditando({ nuevo: true, tipo: 'pagina', config: { rutas: [] }, retraso_minutos: 20, prioridad: 50, espera_dias: 30 })}>
          + Nuevo disparador
        </button>
      </div>

      {msg && <Aviso tono={msg.tipo}>{msg.texto}</Aviso>}

      <Aviso tono="info" titulo="Cómo funciona">
        El correo <b>nunca sale en el mismo minuto</b> de la visita — llegar mientras la persona sigue navegando delata que la estás mirando.
        Si alguien activa varios disparadores el mismo día recibe <b>uno solo</b>, el de mayor prioridad.
        Y solo se le escribe a quien ya está en tu CRM con su correo: navegar el sitio no autoriza a nadie a escribirte.
      </Aviso>

      {reglas.length === 0 && (
        <Vacio titulo="Todavía no hay disparadores"
          texto="Empieza por uno de los prearmados de abajo: están hechos sobre los recorridos que tus visitantes ya hacen." />
      )}

      {reglas.length > 0 && (
        <div style={{ display: 'grid', gap: 11, marginBottom: 20 }}>
          {reglas.map((r: any) => (
            <div key={r.id} style={{ ...S.card, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: '0.9rem' }}>{r.nombre}</b>
                  <Tag tono={ESTADO[r.estado]}>{r.estado}</Tag>
                  {!r.automation_id && <Tag tono="malo">sin embudo</Tag>}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#8a8a8a', marginTop: 4, lineHeight: 1.5 }}>
                  {d.tipos?.[r.tipo]?.etiqueta}
                  {r.config?.rutas?.length ? ` · ${r.config.rutas.join(' + ')}` : ''}
                  {r.config?.umbral ? ` · más de ${r.config.umbral} puntos` : ''}
                  {r.automations?.nombre ? ` → ${r.automations.nombre}` : ''}
                </div>
                <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginTop: 4 }}>
                  Espera {r.retraso_minutos} min antes de escribir · no repite en {r.espera_dias} días
                  {r.total_disparos > 0 && ` · ${r.total_disparos} ${r.total_disparos === 1 ? 'persona alcanzada' : 'personas alcanzadas'}`}
                </div>
                {/* Por qué NO disparó. Una regla activa que no manda nada es
                    indistinguible de una regla rota si no se dice el motivo. */}
                {d.descartes?.[r.id]?.length > 0 && (
                  <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.68rem', color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      No disparó, 7 días
                    </span>
                    {d.descartes[r.id].slice(0, 4).map((x: any) => (
                      <span key={x.motivo} style={{
                        fontSize: '0.7rem', color: '#6f6b7d', background: '#f4f3f7',
                        border: '1px solid #e6e4ec', borderRadius: 5, padding: '1px 7px',
                      }}>
                        {x.motivo} <b style={{ fontVariantNumeric: 'tabular-nums' }}>{x.veces}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button style={S.btnG} onClick={() => setEditando({ ...r })}>Editar</button>
                {r.estado === 'activa'
                  ? <button style={S.btnG} onClick={() => accion(r.id, 'pausada')}>Pausar</button>
                  : <button style={{ ...S.btnP, opacity: r.automation_id ? 1 : .5 }} disabled={!r.automation_id}
                      title={!r.automation_id ? 'Elige primero qué embudo dispara' : undefined}
                      onClick={() => accion(r.id, 'activa')}>Activar</button>}
                <button style={{ ...S.btnG, color: '#C0554E' }} onClick={() => setBorrar(r)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...S.kl, marginBottom: 9 }}>Prearmados · sobre los recorridos que tus visitantes ya hacen</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {(listas || []).map((l: any) => (
          <div key={l.id} style={{ ...S.card, opacity: l.ya_existe ? .55 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{l.alcance_30d}</span>
              <span style={{ fontSize: '0.71rem', color: '#a5a2af' }}>habrían entrado en 30 días</span>
              {l.ya_existe && <span style={{ marginLeft: 'auto' }}><Tag tono="ok">creado</Tag></span>}
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.86rem', marginTop: 8 }}>{l.nombre}</div>
            <div style={{ fontSize: '0.76rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.55 }}>{l.por_que}</div>
            {l.falta_embudo && (
              <div style={{ fontSize: '0.71rem', color: '#9A6B15', marginTop: 7 }}>
                Necesita el embudo «{l.falta_embudo}» — créalo en Embudos y vuelve.
              </div>
            )}
            {!l.ya_existe && (
              <button style={{ ...S.btnA, marginTop: 11 }} onClick={() => crearLista(l)}>Crear disparador</button>
            )}
          </div>
        ))}
      </div>

      {editando && <Editor regla={editando} d={d} onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); cargar(); }} />}
      {borrar && (
        <Confirmar titulo="Borrar disparador" peligro confirmar="Sí, borrar"
          mensaje={<>Se borra «<b>{borrar.nombre}</b>».</>}
          detalle="Quien ya va en camino sigue su embudo — esto solo deja de inscribir gente nueva."
          onSi={async () => { await fetch('/api/crm/email/reglas-web?id=' + borrar.id, { method: 'DELETE' }); setBorrar(null); cargar(); }}
          onNo={() => setBorrar(null)} />
      )}
    </div>
  );
}

function Editor({ regla, d, onCerrar, onListo }: any) {
  const [f, setF] = useState<any>({ ...regla, config: { rutas: [], ...(regla.config || {}) } });
  const [sim, setSim] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const tipo = d.tipos?.[f.tipo];
  const pide = (campo: string) => tipo?.campos?.includes(campo);

  // La simulación se recalcula sola: el número antes de encender es lo que
  // evita la regla que le dispara a todo el mundo.
  useEffect(() => {
    if (!f.tipo) return;
    const t = setTimeout(() => {
      fetch('/api/crm/email/reglas-web?simular=1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: f.tipo, config: f.config, dias: 30 }),
      }).then(r => r.json()).then(setSim).catch(() => {});
    }, 450);
    return () => clearTimeout(t);
  }, [f.tipo, JSON.stringify(f.config)]);

  const setCfg = (k: string, v: any) => setF((x: any) => ({ ...x, config: { ...x.config, [k]: v } }));
  const toggleRuta = (ruta: string) => {
    const rutas = f.config.rutas || [];
    setCfg('rutas', rutas.includes(ruta) ? rutas.filter((r: string) => r !== ruta) : [...rutas, ruta]);
  };

  async function guardar() {
    setGuardando(true); setErr(null);
    try {
      const cuerpo = {
        ...(f.nuevo ? {} : { id: f.id }),
        nombre: f.nombre, tipo: f.tipo, config: f.config,
        automation_id: f.automation_id || null,
        retraso_minutos: Number(f.retraso_minutos) || 20,
        prioridad: Number(f.prioridad) || 50,
        espera_dias: Number(f.espera_dias) || 30,
      };
      const r = await fetch('/api/crm/email/reglas-web', {
        method: f.nuevo ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      });
      const j = await r.json();
      if (j.error) { setErr(j.error); return; }
      onListo();
    } finally { setGuardando(false); }
  }

  return (
    <Modal titulo={f.nuevo ? 'Nuevo disparador' : f.nombre} ancho={560} onCerrar={onCerrar}
      pie={<>
        <button style={{ ...S.btnP, opacity: guardando ? .6 : 1 }} disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button style={S.btnG} onClick={onCerrar}>Cancelar</button>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: sim?.total ? '#5B4BD6' : '#a5a2af', fontWeight: 700 }}>
          {sim ? `${sim.total} habrían entrado en 30 días` : 'calculando…'}
        </span>
      </>}>
      <div style={{ marginBottom: 12 }}>
        <span style={S.lbl}>Nombre</span>
        <input value={f.nombre || ''} onChange={e => setF({ ...f, nombre: e.target.value })} style={S.inp} placeholder="Ej. Vio precios y no agendó" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={S.lbl}>¿Qué tiene que pasar?</span>
        <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} style={S.inp}>
          {Object.entries(d.tipos || {}).map(([k, v]: any) => <option key={k} value={k}>{v.etiqueta}</option>)}
        </select>
        {tipo?.explica && <div style={{ fontSize: '0.72rem', color: '#a5a2af', marginTop: 5, lineHeight: 1.5 }}>{tipo.explica}</div>}
      </div>

      {pide('rutas') && (
        <div style={{ marginBottom: 12 }}>
          <span style={S.lbl}>
            {f.tipo === 'secuencia' ? 'Páginas, EN ESTE ORDEN' : f.tipo === 'combinacion' ? 'Todas estas páginas' : 'Página(s)'}
          </span>
          {(f.config.rutas || []).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {(f.config.rutas || []).map((r: string, i: number) => (
                <span key={r} style={{ background: '#EEECFE', color: '#5B4BD6', borderRadius: 8, padding: '4px 9px', fontSize: '0.74rem', fontWeight: 700 }}>
                  {f.tipo === 'secuencia' && <span style={{ opacity: .6 }}>{i + 1}. </span>}{r}
                  <button onClick={() => toggleRuta(r)} style={{ border: 'none', background: 'none', color: '#5B4BD6', cursor: 'pointer', marginLeft: 4 }}>✕</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #f0eff3', borderRadius: 9, padding: 7 }}>
            {(d.rutas || []).length === 0 && <div style={{ fontSize: '0.75rem', color: '#a5a2af', padding: 6 }}>Todavía no hay visitas registradas.</div>}
            {(d.rutas || []).map((r: any) => (
              <button key={r.ruta} onClick={() => toggleRuta(r.ruta)}
                style={{ ...chip((f.config.rutas || []).includes(r.ruta)), margin: '3px', fontSize: '0.73rem', padding: '4px 9px' }}>
                {r.ruta} <span style={{ opacity: .6 }}>{r.visitas}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 5 }}>
            De las páginas que tus visitantes de verdad abren. El número es cuántas visitas tiene cada una.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {pide('veces') && <div><span style={S.lbl}>¿Cuántas veces?</span><input type="number" min={2} value={f.config.veces ?? 3} onChange={e => setCfg('veces', Number(e.target.value))} style={S.inp} /></div>}
        {pide('dias') && <div><span style={S.lbl}>{f.tipo === 'ausencia' ? 'Días sin volver' : 'Dentro de (días)'}</span><input type="number" min={1} value={f.config.dias ?? 7} onChange={e => setCfg('dias', Number(e.target.value))} style={S.inp} /></div>}
        {pide('segundos') && <div><span style={S.lbl}>Segundos mínimos</span><input type="number" min={5} value={f.config.segundos ?? 60} onChange={e => setCfg('segundos', Number(e.target.value))} style={S.inp} /></div>}
        {pide('umbral') && <div><span style={S.lbl}>Puntos de intención</span><input type="number" min={10} max={100} value={f.config.umbral ?? 40} onChange={e => setCfg('umbral', Number(e.target.value))} style={S.inp} /></div>}
      </div>

      <div style={{ borderTop: '1px solid #f5f4f8', paddingTop: 12, marginBottom: 12 }}>
        <span style={S.lbl}>¿Qué embudo se dispara?</span>
        <select value={f.automation_id || ''} onChange={e => setF({ ...f, automation_id: e.target.value || null })} style={S.inp}>
          <option value="">— elige uno —</option>
          {(d.embudos || []).map((a: any) => <option key={a.id} value={a.id}>{a.nombre}{a.estado !== 'activo' ? ` (${a.estado})` : ''}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <span style={S.lbl}>Esperar antes de escribir (min)</span>
          <input type="number" min={1} value={f.retraso_minutos ?? 20} onChange={e => setF({ ...f, retraso_minutos: Number(e.target.value) })} style={S.inp} />
          <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4 }}>Un correo inmediato se siente vigilancia.</div>
        </div>
        <div>
          <span style={S.lbl}>No repetir en (días)</span>
          <input type="number" min={1} value={f.espera_dias ?? 30} onChange={e => setF({ ...f, espera_dias: Number(e.target.value) })} style={S.inp} />
        </div>
      </div>

      {sim?.muestra?.length > 0 && (
        <div style={{ borderTop: '1px solid #f5f4f8', marginTop: 12, paddingTop: 10 }}>
          <div style={{ ...S.kl, marginBottom: 6 }}>Quiénes habrían entrado</div>
          {sim.muestra.slice(0, 5).map((m: any, i: number) => (
            <div key={i} style={{ fontSize: '0.76rem', padding: '3px 0' }}>
              {m.nombre}
              {m.detalle && <span style={{ color: '#a5a2af' }}> · {JSON.stringify(m.detalle).replace(/[{}"]/g, '').slice(0, 60)}</span>}
            </div>
          ))}
        </div>
      )}
      {err && <div style={{ fontSize: '0.78rem', color: '#C0554E', marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}
