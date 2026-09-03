import { useMemo, useState } from 'react';
import MinutaLead from './crm/MinutaLead';

/* ═══ Datos faltantes, agrupados ═══ Antes salía UN dato a la vez (98 tarjetas seguidas). Ahora:
   subpestañas por tipo de dato (Facturación, Negocio, Cuenta Sacs, Reunión, Contacto) y, dentro, la ficha de
   cada cliente con TODOS sus datos pendientes juntos, cada uno etiquetado con a qué corresponde y por qué importa. */
type Tarea = { id: string; contact_id: string; payload: any; [k: string]: any };
const GRUPOS: { k: string; l: string; desc: string; claves: string[] }[] = [
  { k: 'facturacion', l: 'Facturación', desc: 'Lo que hace falta para facturar sin frenar el cobro.', claves: ['rfc', 'razon_social', 'regimen', 'cp', 'uso_cfdi', 'domicilio_fiscal'] },
  { k: 'negocio', l: 'Negocio', desc: 'Con esto el agente habla del ramo del cliente y con casos de su giro.', claves: ['giro', 'sucursales', 'empleados', 'ciudad', 'sistema_actual', 'productos', 'ticket_promedio'] },
  { k: 'cuenta', l: 'Cuenta Sacs', desc: 'Sin la cuenta ligada no hay señales de uso ni salud.', claves: ['sacs_account', 'plan', 'cuenta'] },
  { k: 'reunion', l: 'Reunión y cotización', desc: 'La cadena después de la demo: resultado el mismo día, minuta en 24 h, cotización o decisión en 48 h; y cotizaciones dormidas.', claves: ['reunion', 'cotizacion', 'resultado_demo', 'asistio', 'siguiente_paso'] },
  { k: 'contacto', l: 'Contacto', desc: 'Cómo localizarlo y con quién hablamos.', claves: ['email', 'telefono', 'nombre', 'puesto', 'whatsapp'] },
];
const grupoDe = (p: any) => { const c = String(p?.campo_clave || p?.campo || '').toLowerCase(); return GRUPOS.find(g => g.claves.some(k => c === k || c.includes(k)))?.k || 'otros'; };
const nombreDe = (p: any) => {
  if (p?.lead?.nombre) return String(p.lead.nombre);
  const ins = String(p?.instruccion || '');
  const con = ins.match(/\bcon ([^?(¿]+?)(?:\s*\(|\?|:|$)/); if (con) return con[1].trim();
  const antes = ins.split(/:| — /)[0].trim(); return antes.replace(/^¿/, '') || 'Sin nombre';
};

export default function TrabajoDatos({ datos, onGuardar, onPosponer, onRecargar, guardando, error }: { datos: Tarea[]; onGuardar: (x: Tarea, valor: any) => Promise<boolean>; onPosponer: (x: Tarea) => Promise<void>; onRecargar?: () => void; guardando: boolean; error: string }) {
  const [grupo, setGrupo] = useState<string>('todos');
  const [sel, setSel] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [ok, setOk] = useState('');
  const [minutaDe, setMinutaDe] = useState<any>(null);   // tarea de minuta abierta en el modal con IA
  const conGrupo = useMemo(() => datos.map(x => ({ ...x, _g: grupoDe(x.payload), _n: nombreDe(x.payload), _k: x.contact_id || x.payload?.sujeto })), [datos]);
  const conteo: Record<string, number> = {}; for (const x of conGrupo) conteo[x._g] = (conteo[x._g] || 0) + 1;
  const visibles = grupo === 'todos' ? conGrupo : conGrupo.filter(x => x._g === grupo);
  // Clientes con al menos un dato en la subpestaña; la ficha muestra TODOS sus pendientes (de cualquier grupo).
  const clientes = useMemo(() => { const m = new Map<string, any[]>(); for (const x of visibles) { if (!m.has(x._k)) m.set(x._k, []); } for (const x of conGrupo) if (m.has(x._k)) m.get(x._k)!.push(x); return [...m.entries()].map(([k, xs]) => ({ k, nombre: xs[0]._n, xs })); }, [visibles, conGrupo]);
  const actual = clientes.find(c => c.k === sel) || clientes[0];
  const grupos = [{ k: 'todos', l: 'Todos', desc: '' }, ...GRUPOS.filter(g => conteo[g.k]).sort((a, b) => (a.k === 'reunion' ? -1 : b.k === 'reunion' ? 1 : 0)), ...(conteo.otros ? [{ k: 'otros', l: 'Otros', desc: '' }] : [])];
  const gInfo = GRUPOS.find(g => g.k === grupo);
  const guardarTodo = async () => {
    if (!actual) return; setOk(''); let n = 0;
    for (const x of actual.xs) { const v = vals[x.id] ?? (x.payload?.fuente ? x.payload?.valor : ''); if (!v) continue; if (await onGuardar(x, v)) { n++; } }
    setOk(n ? `${n} dato${n > 1 ? 's' : ''} guardado${n > 1 ? 's' : ''}.` : 'No había nada que guardar.');
    setSel(null);
  };
  if (!datos.length) return <div className="ti-carta"><div className="ti-fin"><h2>Sin datos pendientes</h2><p>El detector corre con cada plan: cuando falte un dato que importe, aparece aquí, nunca en medio de tus llamadas.</p></div></div>;
  return (
    <div>
      <div className="ti-res-chips" style={{ marginBottom: 10 }}>
        {grupos.map(g => <button key={g.k} className={'ti-res-chip' + (grupo === g.k ? ' on' : '')} onClick={() => { setGrupo(g.k); setSel(null); }}>{g.l} · {g.k === 'todos' ? datos.length : conteo[g.k]}</button>)}
      </div>
      {gInfo && <div style={{ fontSize: 12.5, color: '#6b6580', margin: '0 2px 10px' }}>{gInfo.desc}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', gap: 12, alignItems: 'start' }} className="ti-datos-grid">
        <div className="ti-carta" style={{ padding: 8, maxHeight: 520, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', padding: '6px 8px' }}>{clientes.length} cliente{clientes.length === 1 ? '' : 's'}</div>
          {clientes.map(c => (
            <button key={c.k} onClick={() => { setSel(c.k); setOk(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 10, padding: '8px 10px', background: actual?.k === c.k ? '#EEECFE' : 'transparent', color: '#241d43', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
              <div style={{ fontSize: 11, color: '#8e88a8' }}>{c.xs.length === 1 ? c.xs[0].payload?.campo : `${c.xs.length} datos: ${c.xs.map((x: any) => x.payload?.campo).join(', ')}`}</div>
            </button>
          ))}
        </div>
        {actual && (
          <div className="ti-carta" key={actual.k} style={{ padding: 18 }}>
            <div className="ti-chips" style={{ marginBottom: 6 }}><span className="ti-chip chip-p2">Ficha del cliente</span><span className="ti-chip chip-tipo">{actual.xs.length} dato{actual.xs.length > 1 ? 's' : ''} pendiente{actual.xs.length > 1 ? 's' : ''}</span></div>
            <h2 style={{ margin: '4px 0 12px', fontSize: 20 }}>{actual.nombre}</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {actual.xs.map((x: any) => { const p = x.payload || {}; const g = GRUPOS.find(gg => gg.k === x._g); const v = vals[x.id] ?? (p.fuente ? String(p.valor || '') : ''); return (
                <div key={x.id} style={{ border: '1px solid #ecebf2', borderRadius: 12, padding: '12px 14px', background: '#fcfbfe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5B4BD6' }}>{g?.l || 'Otro'}</span> <b style={{ fontSize: 14, marginLeft: 6 }}>{p.campo}</b></div>
                    <button className="ti-pie-txt" disabled={guardando} onClick={() => onPosponer(x)} style={{ fontSize: 11.5 }}>Saltar</button>
                  </div>
                  {p.porque && <div style={{ fontSize: 12.5, color: '#6b6580', margin: '4px 0 8px' }}>{p.porque}</div>}
                  {p.fuente && <div className="ti-burbuja sug" style={{ marginBottom: 6 }}><div className="ti-b-eti">Sugerencia · {p.fuente}</div>{p.valor}</div>}
                  {p.minuta_ia ? (
                    <button className="ti-btn prim" onClick={() => setMinutaDe(x)} style={{ width: '100%' }}>Abrir la minuta con IA: pega la transcripción o tus notas</button>
                  ) : Array.isArray(p.opciones)
                    ? <div className="ti-res-chips">{p.opciones.map((o: string) => <button key={o} className={'ti-res-chip' + (v === o ? ' on' : '')} onClick={() => setVals(s => ({ ...s, [x.id]: o }))}>{(p.opciones_l || {})[o] || o}</button>)}</div>
                    : p.multilinea
                      ? <textarea className="ti-campo" rows={5} style={{ margin: 0, fontSize: 14 }} placeholder={p.input || p.campo} value={v} onChange={e => setVals(s => ({ ...s, [x.id]: e.target.value }))} />
                      : <input className="ti-campo" style={{ margin: 0 }} placeholder={p.input || p.campo} value={v} onChange={e => setVals(s => ({ ...s, [x.id]: e.target.value }))} />}
                </div>
              ); })}
            </div>
            {error && <div className="ti-error" style={{ marginTop: 12 }}>{error}</div>}
            {ok && <div style={{ marginTop: 10, fontSize: 12.5, color: '#14532d', fontWeight: 600 }}>{ok}</div>}
            <div className="ti-botones" style={{ marginTop: 14 }}>
              <button className="ti-btn prim" disabled={guardando || !actual.xs.some((x: any) => (vals[x.id] ?? (x.payload?.fuente ? x.payload?.valor : '')))} onClick={guardarTodo}>{actual.xs.length > 1 ? 'Guardar los que llené y seguir' : 'Guardar y seguir'}</button>
            </div>
          </div>
        )}
      </div>
      {minutaDe && (
        <MinutaLead reunion={{ id: minutaDe.payload?.reunion?.id || minutaDe.payload?.sujeto, fecha: minutaDe.payload?.reunion?.fecha, event_types: { nombre: 'Demo' } }} lead={minutaDe.payload?.lead || {}}
          onClose={() => setMinutaDe(null)}
          onGuardado={async () => { const x = minutaDe; setMinutaDe(null); await fetch('/api/crm/ti/tarea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x.id, accion: 'hecha', detalle: { campo: 'minuta', ya_escrito: true } }) }); setOk('Minuta guardada y aplicada.'); onRecargar?.(); }} />
      )}
      <style>{`@media (max-width: 760px) { .ti-datos-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
