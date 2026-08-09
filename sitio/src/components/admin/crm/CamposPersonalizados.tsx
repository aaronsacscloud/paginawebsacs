import { useEffect, useState } from 'react';

/* ═══ Campos personalizados ═══
 *
 * Dos piezas en un archivo, porque comparten el mismo catálogo:
 *   <CamposConfig/>    → Configuración: crear, editar y archivar los campos.
 *   <CamposFicha/>     → la ficha del cliente: capturarlos y verlos.
 *
 * Es información INTERNA de gestión: no se le pide al cliente en ningún
 * formulario público. Por eso el catálogo no tiene noción de "visible para el
 * cliente" — si algún día se expone algo, será una decisión explícita.
 */

export type Prop = {
  id: string; entidad: string; key: string; etiqueta: string; tipo: string;
  grupo: string | null; descripcion: string | null;
  opciones?: { v: string; l: string }[] | null;
  depende_de?: string | null; opciones_por_padre?: Record<string, { v: string; l: string }[]> | null;
  obligatorio: boolean; importante: boolean; orden: number; archivada_at?: string | null; uso?: number;
};

const TIPOS: { v: string; l: string; ayuda: string }[] = [
  { v: 'texto', l: 'Texto', ayuda: 'Una línea. Ojo: el texto libre no se puede agrupar en reportes.' },
  { v: 'texto_largo', l: 'Texto largo', ayuda: 'Varias líneas, para notas.' },
  { v: 'numero', l: 'Número', ayuda: 'Cantidades. Permite filtrar por mayor/menor que.' },
  { v: 'moneda', l: 'Moneda', ayuda: 'Importes en pesos.' },
  { v: 'porcentaje', l: 'Porcentaje', ayuda: 'De 0 a 100.' },
  { v: 'fecha', l: 'Fecha', ayuda: 'Permite filtrar por rango.' },
  { v: 'booleano', l: 'Sí / No', ayuda: 'Cuando solo hay dos respuestas posibles.' },
  { v: 'select', l: 'Lista (una opción)', ayuda: 'La mejor para clasificar: es lo único que después se puede agrupar y contar.' },
  { v: 'multiselect', l: 'Lista (varias opciones)', ayuda: 'Cuando aplica más de una a la vez.' },
  { v: 'email', l: 'Correo', ayuda: '' },
  { v: 'telefono', l: 'Teléfono', ayuda: '' },
  { v: 'url', l: 'Enlace', ayuda: '' },
];

const E = {
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 16, marginBottom: 12 } as const,
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fff' },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '8px 14px', border: 'none', borderRadius: 8, fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff' } as const,
  btnG: { padding: '7px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  badge: { fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap' as const } as const,
};

export function useCampos(entidad: 'company' | 'deal' | 'subscription' | 'contact' = 'company') {
  const [props, setProps] = useState<Prop[]>([]);
  const cargar = () => fetch(`/api/crm/propiedades?entidad=${entidad}`).then(r => r.json()).then(j => setProps(j.data || [])).catch(() => {});
  useEffect(() => { cargar(); }, [entidad]);
  return { props, recargar: cargar };
}

/* ─────────── Configuración ─────────── */
export default function CamposConfig({ entidad = 'company' }: { entidad?: 'company' | 'deal' | 'subscription' | 'contact' }) {
  const { props, recargar } = useCampos(entidad);
  const [nuevo, setNuevo] = useState<any>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);

  const vacio = { etiqueta: '', tipo: 'select', grupo: 'General', descripcion: '', opciones_txt: '', obligatorio: false, importante: false };

  async function crear() {
    if (!nuevo.etiqueta.trim()) { alert('Ponle nombre al campo.'); return; }
    if (!nuevo.descripcion.trim()) { alert('Escribe para qué sirve: en un año es lo único que dirá por qué existe.'); return; }
    const opciones = ['select', 'multiselect'].includes(nuevo.tipo)
      ? String(nuevo.opciones_txt || '').split('\n').map((l: string) => l.trim()).filter(Boolean)
        .map((l: string) => ({ v: l.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''), l }))
      : null;
    if (opciones && !opciones.length) { alert('Una lista sin opciones no se puede usar: escribe al menos una.'); return; }
    setBusy(true);
    const j = await fetch('/api/crm/propiedades', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuevo, entidad, opciones, orden: (props.length + 1) * 10 }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo crear' }));
    setBusy(false);
    if (j?.error) { alert(j.error); return; }
    setNuevo(null); recargar();
  }

  async function guardar(p: Prop) {
    setBusy(true);
    const body: any = { id: p.id, etiqueta: f.etiqueta, grupo: f.grupo, descripcion: f.descripcion, obligatorio: !!f.obligatorio, importante: !!f.importante, orden: Number(f.orden) || p.orden };
    if (['select', 'multiselect'].includes(p.tipo) && !p.depende_de) {
      body.opciones = String(f.opciones_txt || '').split('\n').map((l: string) => l.trim()).filter(Boolean)
        .map((l: string) => {
          // Se conserva la clave de las opciones que ya existían: cambiarla
          // dejaría huérfano lo capturado en los clientes.
          const ya = (p.opciones || []).find(o => o.l === l);
          return ya || { v: l.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''), l };
        });
    }
    const j = await fetch('/api/crm/propiedades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    setBusy(false);
    if (j?.error) { alert(j.error); return; }
    setEditando(null); recargar();
  }

  async function archivar(p: Prop) {
    if (!confirm(`¿Archivar "${p.etiqueta}"?\n\nDeja de aparecer en las fichas, pero lo capturado en ${p.uso || 0} cliente(s) NO se borra: si lo reactivas, sigue ahí.`)) return;
    await fetch('/api/crm/propiedades', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) });
    recargar();
  }

  const grupos = Array.from(new Set(props.map(p => p.grupo || 'General')));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Campos personalizados del cliente</h2>
        <div style={{ flex: 1 }} />
        <button style={E.btn} onClick={() => setNuevo({ ...vacio })}>+ Nuevo campo</button>
      </div>
      <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 14, lineHeight: 1.55 }}>
        Información <b>interna</b> de gestión: se captura en la ficha del cliente, no se le pide a nadie en un formulario.
        Aparecen en <b>Info general</b> agrupados, y cada cambio queda en su Actividad.
        Para clasificar, usa <b>listas</b>: el texto libre no se puede agrupar ni contar después — es lo que dejó "moda", "Moda" y "Ropa" como tres giros distintos.
      </div>

      {nuevo && (
        <div style={{ ...E.card, border: '1px dashed #bbb' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}><label style={E.lbl}>Nombre del campo *</label>
              <input value={nuevo.etiqueta} onChange={e => setNuevo({ ...nuevo, etiqueta: e.target.value })} placeholder="Número de colaboradores" style={E.input} /></div>
            <div style={{ flex: '1 1 180px' }}><label style={E.lbl}>Tipo *</label>
              <select value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })} style={E.input}>
                {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <div style={{ fontSize: '0.68rem', color: '#999', marginTop: 3 }}>{TIPOS.find(t => t.v === nuevo.tipo)?.ayuda}</div>
            </div>
            <div style={{ flex: '0 1 170px' }}><label style={E.lbl}>Grupo</label>
              <input list="grupos-campos" value={nuevo.grupo} onChange={e => setNuevo({ ...nuevo, grupo: e.target.value })} style={E.input} />
              <datalist id="grupos-campos">{grupos.map(g => <option key={g} value={g} />)}</datalist></div>
            <div style={{ flex: '1 1 100%' }}><label style={E.lbl}>¿Para qué sirve? *</label>
              <input value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Qué decisión ayuda a tomar este dato" style={E.input} /></div>
            {['select', 'multiselect'].includes(nuevo.tipo) && (
              <div style={{ flex: '1 1 100%' }}><label style={E.lbl}>Opciones (una por línea)</label>
                <textarea value={nuevo.opciones_txt} onChange={e => setNuevo({ ...nuevo, opciones_txt: e.target.value })} rows={4} placeholder={'Autogestión\nAcompañamiento básico\nPremium'} style={{ ...E.input, resize: 'vertical' as const }} /></div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
              <input type="checkbox" checked={nuevo.importante} onChange={e => setNuevo({ ...nuevo, importante: e.target.checked })} />
              Importante <span style={{ color: '#999' }}>— marca que falta, sin bloquear</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
              <input type="checkbox" checked={nuevo.obligatorio} onChange={e => setNuevo({ ...nuevo, obligatorio: e.target.checked })} />
              Obligatorio <span style={{ color: '#999' }}>— úsalo poco: demasiados hacen que se capture basura</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={E.btn} disabled={busy} onClick={crear}>Crear campo</button>
            <button style={E.btnG} onClick={() => setNuevo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {grupos.map(g => (
        <div key={g} style={E.card}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{g}</div>
          {props.filter(p => (p.grupo || 'General') === g).map(p => (
            <div key={p.id} style={{ borderTop: '1px solid #f4f4f4', padding: '10px 0' }}>
              {editando === p.id ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 180px' }}><label style={E.lbl}>Nombre</label><input value={f.etiqueta} onChange={e => setF({ ...f, etiqueta: e.target.value })} style={E.input} /></div>
                  <div style={{ flex: '0 1 150px' }}><label style={E.lbl}>Grupo</label><input value={f.grupo} onChange={e => setF({ ...f, grupo: e.target.value })} style={E.input} /></div>
                  <div style={{ flex: '0 1 90px' }}><label style={E.lbl}>Orden</label><input type="number" value={f.orden} onChange={e => setF({ ...f, orden: e.target.value })} style={E.input} /></div>
                  <div style={{ flex: '1 1 100%' }}><label style={E.lbl}>¿Para qué sirve?</label><input value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} style={E.input} /></div>
                  {['select', 'multiselect'].includes(p.tipo) && !p.depende_de && (
                    <div style={{ flex: '1 1 100%' }}><label style={E.lbl}>Opciones (una por línea)</label>
                      <textarea value={f.opciones_txt} onChange={e => setF({ ...f, opciones_txt: e.target.value })} rows={4} style={{ ...E.input, resize: 'vertical' as const }} /></div>
                  )}
                  {p.depende_de && <div style={{ flex: '1 1 100%', fontSize: '0.74rem', color: '#a06600' }}>Las opciones de este campo dependen de “{props.find(x => x.key === p.depende_de)?.etiqueta || p.depende_de}” y se editan por ahora desde la base.</div>}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: '1 1 100%' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}><input type="checkbox" checked={f.importante} onChange={e => setF({ ...f, importante: e.target.checked })} /> Importante</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}><input type="checkbox" checked={f.obligatorio} onChange={e => setF({ ...f, obligatorio: e.target.checked })} /> Obligatorio</label>
                    <div style={{ flex: 1 }} />
                    <button style={E.btn} disabled={busy} onClick={() => guardar(p)}>Guardar</button>
                    <button style={E.btnG} onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                      {p.etiqueta}
                      {p.obligatorio && <span style={{ ...E.badge, background: '#fde8e8', color: '#b93333', marginLeft: 6 }}>obligatorio</span>}
                      {p.importante && <span style={{ ...E.badge, background: '#fff3e0', color: '#a06600', marginLeft: 6 }}>importante</span>}
                      {p.depende_de && <span style={{ ...E.badge, background: '#eef2ff', color: '#3764c4', marginLeft: 6 }}>depende de {props.find(x => x.key === p.depende_de)?.etiqueta}</span>}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#888' }}>{p.descripcion}</div>
                    <div style={{ fontSize: '0.68rem', color: '#bbb' }}>
                      {TIPOS.find(t => t.v === p.tipo)?.l} · clave <code>{p.key}</code>
                      {['select', 'multiselect'].includes(p.tipo) && !p.depende_de ? ` · ${(p.opciones || []).length} opciones` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: p.uso ? '#1A8F7A' : '#bbb', minWidth: 90, textAlign: 'right' }}>
                    {p.uso ? `${p.uso} con dato` : 'nadie lo llena'}
                  </div>
                  <button style={E.btnG} onClick={() => { setEditando(p.id); setF({ etiqueta: p.etiqueta, grupo: p.grupo || 'General', descripcion: p.descripcion || '', orden: p.orden, obligatorio: p.obligatorio, importante: p.importante, opciones_txt: (p.opciones || []).map(o => o.l).join('\n') }); }}>Editar</button>
                  <button style={{ ...E.btnG, color: '#b93333' }} onClick={() => archivar(p)}>Archivar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {!props.length && !nuevo && (
        <div style={{ ...E.card, color: '#999', fontSize: '0.85rem' }}>Todavía no hay campos personalizados.</div>
      )}
    </div>
  );
}

/* ─────────── En la ficha del cliente ─────────── */
export function CamposFicha({ entidad = 'company', entidadId, valores, onGuardado }: {
  entidad?: 'company' | 'deal' | 'subscription' | 'contact';
  entidadId: string;
  valores?: Record<string, any> | null;
  onGuardado?: () => void;
}) {
  const { props } = useCampos(entidad);
  const [v, setV] = useState<Record<string, any>>(valores || {});
  const [sucio, setSucio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { setV(valores || {}); setSucio(false); }, [valores, entidadId]);

  const set = (k: string, val: any) => { setV(p => ({ ...p, [k]: val })); setSucio(true); };

  async function guardar() {
    setBusy(true);
    const j = await fetch('/api/crm/propiedades?valores=1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entidad, entidad_id: entidadId, valores: v }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setBusy(false);
    if (j?.error) { alert(j.error); return; }
    setSucio(false);
    setMsg(j.sin_cambios ? 'Sin cambios' : `Guardado (${j.cambios} cambio${j.cambios === 1 ? '' : 's'})`);
    setTimeout(() => setMsg(''), 3000);
    onGuardado?.();
  }

  if (!props.length) return null;
  const grupos = Array.from(new Set(props.map(p => p.grupo || 'General')));
  // Los "importantes" sin dato se señalan sin bloquear nada: es el aviso de
  // Pipedrive, que sirve justo porque no impide guardar.
  const faltan = props.filter(p => p.importante && (v[p.key] === undefined || v[p.key] === ''));

  const campo = (p: Prop) => {
    const val = v[p.key];
    const com = { ...E.input };
    switch (p.tipo) {
      case 'texto_largo': return <textarea value={val || ''} onChange={e => set(p.key, e.target.value)} rows={3} style={{ ...com, resize: 'vertical' as const }} />;
      case 'numero': case 'moneda': case 'porcentaje':
        return <input type="number" value={val ?? ''} onChange={e => set(p.key, e.target.value === '' ? '' : Number(e.target.value))} style={com} />;
      case 'fecha': return <input type="date" value={val || ''} onChange={e => set(p.key, e.target.value)} style={com} />;
      case 'booleano': return (
        <select value={val === true ? 'si' : val === false ? 'no' : ''} onChange={e => set(p.key, e.target.value === '' ? '' : e.target.value === 'si')} style={com}>
          <option value="">—</option><option value="si">Sí</option><option value="no">No</option>
        </select>
      );
      case 'select': {
        // Campo dependiente: sus opciones salen del valor del padre. Sin padre
        // elegido no hay nada que ofrecer, y decirlo es mejor que un select vacío.
        const opts = p.depende_de
          ? ((p.opciones_por_padre || {})[String(v[p.depende_de] || '')] || [])
          : (p.opciones || []);
        if (p.depende_de && !v[p.depende_de]) {
          return <div style={{ ...com, color: '#aaa', display: 'flex', alignItems: 'center' }}>Elige antes “{props.find(x => x.key === p.depende_de)?.etiqueta}”</div>;
        }
        return (
          <select value={val || ''} onChange={e => set(p.key, e.target.value)} style={com}>
            <option value="">—</option>
            {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        );
      }
      case 'multiselect': {
        const arr: string[] = Array.isArray(val) ? val : [];
        return (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {(p.opciones || []).map(o => {
              const on = arr.includes(o.v);
              return <button key={o.v} type="button" onClick={() => set(p.key, on ? arr.filter(x => x !== o.v) : [...arr, o.v])}
                style={{ ...E.badge, cursor: 'pointer', border: '1px solid ' + (on ? '#1a1a1a' : '#ddd'), background: on ? '#1a1a1a' : '#fff', color: on ? '#fff' : '#555', padding: '4px 10px' }}>{o.l}</button>;
            })}
          </div>
        );
      }
      default: return <input type={p.tipo === 'email' ? 'email' : 'text'} value={val || ''} onChange={e => set(p.key, e.target.value)} style={com} />;
    }
  };

  return (
    <div>
      {faltan.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: '#a06600', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 8, padding: '7px 10px', marginBottom: 10 }}>
          ⚑ Faltan datos importantes: {faltan.map(p => p.etiqueta).join(', ')}
        </div>
      )}
      {grupos.map(g => (
        <div key={g} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>{g}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {props.filter(p => (p.grupo || 'General') === g).map(p => (
              <div key={p.id} style={{ flex: p.tipo === 'texto_largo' || p.tipo === 'multiselect' ? '1 1 100%' : '1 1 200px' }}>
                <label style={E.lbl} title={p.descripcion || undefined}>
                  {p.etiqueta}
                  {p.obligatorio && <span style={{ color: '#b93333' }}> *</span>}
                  {p.importante && (v[p.key] === undefined || v[p.key] === '') && <span style={{ color: '#a06600' }}> ⚑</span>}
                </label>
                {campo(p)}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={{ ...E.btn, opacity: sucio ? 1 : 0.45 }} disabled={!sucio || busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar información'}</button>
        {msg && <span style={{ fontSize: '0.78rem', color: '#1A8F7A' }}>{msg}</span>}
      </div>
    </div>
  );
}
