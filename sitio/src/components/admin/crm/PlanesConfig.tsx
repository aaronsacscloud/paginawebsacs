// Configuración → Facturación → Planes y plugins.
//
// El catálogo de lo único que se puede vender. De aquí salen las opciones de la
// cotización, de la oportunidad y de la suscripción, así que el nombre y el
// precio se escriben UNA vez y se leen igual en todos lados.
//
// Antes los plugins vivían hardcodeados en /api/crm/arr/plans y el nombre se
// tecleaba a mano en cada venta: 175 suscripciones acabaron con 64 nombres
// distintos para 15 conceptos ("PLUGIN PREMIUM ", "plugin premium", "licencia
// PLUGIN VIP"). Por eso la pantalla insiste en dos cosas:
//
//  · Renombrar aquí NO reescribe lo ya vendido —cada suscripción conserva el
//    texto con el que se cerró, que es el que dice su contrato—. Emparejar lo
//    viejo es una casilla aparte, con el conteo por delante.
//  · Un concepto en uso se DESACTIVA, no se borra: deja de ofrecerse y sigue
//    explicando las suscripciones que lo traen.
import { useEffect, useState } from 'react';
import { P } from '../../../lib/crm/paleta';
import Cargando, { Corazones } from './ui/Cargando';

type Plan = {
  id: string; slug: string; nombre: string; descripcion: string | null;
  categoria: 'plan' | 'plugin'; modalidades: string[];
  precio_mensual: number | null; precio_anual: number | null; precio_vitalicio: number | null;
  a_la_medida: boolean; activo: boolean; orden: number | null; usos?: number;
};

const MODALIDADES: { v: 'mensual' | 'anual' | 'vitalicio'; l: string; ayuda: string; campo: keyof Plan }[] = [
  { v: 'mensual', l: 'Mensual', ayuda: 'Se cobra cada mes. Suma al MRR.', campo: 'precio_mensual' },
  { v: 'anual', l: 'Anual', ayuda: 'Se cobra una vez al año y se renueva. Suma al ARR.', campo: 'precio_anual' },
  { v: 'vitalicio', l: 'Vitalicio', ayuda: 'Pago único, sin renovación. Es ingreso único: nunca se proyecta como recurrente.', campo: 'precio_vitalicio' },
];

const E = {
  card: { background: '#fff', border: `1px solid ${P.linea}`, borderRadius: 12, padding: 16, marginBottom: 12 } as const,
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fff' },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: P.violeta, color: '#fff' } as const,
  btnG: { padding: '7px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  chip: { fontSize: '0.62rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const },
};

const pesos = (n: number | null) => (n == null ? null : '$' + Math.round(n).toLocaleString('es-MX'));

/** El color de cada modalidad: morado el recurrente propio, azul el mensual,
 *  verde el pago único que ya entró completo. */
const TONO: Record<string, { bg: string; fg: string }> = {
  mensual: { bg: P.azulAgua, fg: P.azulTinta },
  anual: { bg: P.violetaAgua, fg: P.violetaTinta },
  vitalicio: { bg: P.verdeAgua, fg: P.verdeTinta },
};

const vacio = (categoria: 'plan' | 'plugin'): Partial<Plan> => ({
  nombre: '', descripcion: '', categoria, modalidades: ['anual'],
  precio_mensual: null, precio_anual: null, precio_vitalicio: null, activo: true,
});

export default function PlanesConfig({ sinTitulo }: { sinTitulo?: boolean } = {}) {
  const [filas, setFilas] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cat, setCat] = useState<'plan' | 'plugin'>('plugin');
  const [edita, setEdita] = useState<string | null>(null);   // id, o 'nuevo'
  const [f, setF] = useState<any>({});
  const [homologar, setHomologar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function cargar() {
    setCargando(true);
    try {
      const j = await fetch('/api/crm/arr/plans?todos=1&usos=1').then(r => r.json());
      setFilas(j.data || []);
      if (j.sin_migrar) setError('La base todavía no tiene las columnas del catálogo (categoría, modalidades). Aplica la migración para poder editar.');
    } catch { setError('No se pudo cargar el catálogo.'); }
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  const lista = filas.filter(p => (p.categoria || 'plan') === cat);
  const cuantos = (c: string) => filas.filter(p => (p.categoria || 'plan') === c).length;
  const esPlugin = cat === 'plugin';

  function abrir(p: Plan) {
    setEdita(p.id);
    setF({ ...p, descripcion: p.descripcion || '', modalidades: [...(p.modalidades || ['anual'])] });
    setHomologar(false);
    setError(''); setAviso('');
  }
  function abrirNuevo() {
    setEdita('nuevo');
    setF(vacio(cat));
    setHomologar(false);
    setError(''); setAviso('');
  }
  function cerrar() { setEdita(null); setF({}); setHomologar(false); }

  function toggleModalidad(v: string) {
    const act: string[] = f.modalidades || [];
    const next = act.includes(v) ? act.filter(m => m !== v) : [...act, v];
    setF({ ...f, modalidades: next.length ? next : act });
  }

  async function guardar() {
    if (!String(f.nombre || '').trim()) { setError('Ponle nombre: es lo que ve el cliente en la cotización.'); return; }
    if (!String(f.descripcion || '').trim()) { setError('Escribe a qué se refiere. Esa frase sale tal cual en la cotización y es lo único que explica qué compró.'); return; }
    setBusy(true); setError('');
    const nuevo = edita === 'nuevo';
    const body: any = {
      nombre: f.nombre, descripcion: f.descripcion, categoria: f.categoria || cat,
      modalidades: f.modalidades, activo: f.activo !== false,
      precio_mensual: f.precio_mensual, precio_anual: f.precio_anual, precio_vitalicio: f.precio_vitalicio,
    };
    if (!nuevo) { body.id = f.id; body.homologar = homologar; }
    try {
      const r = await fetch('/api/crm/arr/plans', {
        method: nuevo ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'No se pudo guardar.'); setBusy(false); return; }
      setAviso(j.homologadas ? `Guardado. Se emparejaron ${j.homologadas} suscripciones con el nombre nuevo.` : 'Guardado.');
      cerrar();
      await cargar();
    } catch { setError('No se pudo guardar.'); }
    setBusy(false);
  }

  async function borrar(p: Plan) {
    if (!confirm(`¿Borrar «${p.nombre}» del catálogo? Nadie lo está usando, así que no afecta nada vendido.`)) return;
    setBusy(true);
    const r = await fetch(`/api/crm/arr/plans?id=${p.id}`, { method: 'DELETE' });
    const j = await r.json();
    if (!r.ok) setError(j.error || 'No se pudo borrar.');
    setBusy(false);
    cargar();
  }

  async function alternarActivo(p: Plan) {
    setBusy(true);
    await fetch('/api/crm/arr/plans', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id, nombre: p.nombre, descripcion: p.descripcion, categoria: p.categoria,
        modalidades: p.modalidades, activo: !p.activo,
        precio_mensual: p.precio_mensual, precio_anual: p.precio_anual, precio_vitalicio: p.precio_vitalicio,
      }),
    });
    setBusy(false);
    cargar();
  }

  if (cargando) return <Cargando texto="Cargando el catálogo…" />;

  return (
    <div>
      {!sinTitulo && (
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: P.tinta, margin: 0 }}>Planes y plugins</h2>
          <div style={{ fontSize: '0.78rem', color: P.suave, marginTop: 3 }}>
            Lo único que se puede vender. Se escribe una vez aquí y se lee igual en la cotización, en la oportunidad y en la suscripción.
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${P.linea}`, marginBottom: 14 }}>
        {([['plan', 'Licencias'], ['plugin', 'Plugins']] as const).map(([v, l]) => {
          const on = cat === v;
          return (
            <button key={v} onClick={() => { setCat(v); cerrar(); }} style={{
              padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: '0.82rem',
              fontWeight: on ? 800 : 500, color: on ? P.violetaTinta : '#666',
              background: on ? P.violetaAgua : 'transparent',
              borderRadius: '9px 9px 0 0', borderBottom: `2px solid ${on ? P.violeta : 'transparent'}`,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {l}
              <span style={{ ...E.chip, background: on ? '#fff' : P.lineaSuave, color: on ? P.violetaTinta : P.gris }}>{cuantos(v)}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button onClick={abrirNuevo} style={{ ...E.btn, marginBottom: 6 }}>
          {esPlugin ? 'Agregar plugin' : 'Agregar licencia'}
        </button>
      </div>

      {error && <div style={{ ...E.card, background: P.rojoAgua, borderColor: P.rojo, color: P.rojoTinta, fontSize: '0.8rem', fontWeight: 600 }}>{error}</div>}
      {aviso && <div style={{ ...E.card, background: P.verdeAgua, borderColor: P.verde, color: P.verdeTinta, fontSize: '0.8rem', fontWeight: 600 }}>{aviso}</div>}

      {edita === 'nuevo' && (
        <Editor f={f} setF={setF} toggleModalidad={toggleModalidad} guardar={guardar} cerrar={cerrar}
          busy={busy} nuevo homologar={false} setHomologar={setHomologar} />
      )}

      {lista.map(p => {
        const abierto = edita === p.id;
        const enUso = (p.usos || 0) > 0;
        return (
          <div key={p.id} style={{ ...E.card, opacity: p.activo === false && !abierto ? 0.62 : 1 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: P.tinta }}>{p.nombre}</span>
                  {p.activo === false && <span style={{ ...E.chip, background: P.lineaSuave, color: P.gris }}>Retirado</span>}
                  {!p.descripcion && <span style={{ ...E.chip, background: P.ambarAgua, color: P.ambarTinta }}>Falta describirlo</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: P.gris, fontFamily: 'ui-monospace, Menlo, monospace', marginTop: 1 }}>{p.slug}</div>
                {p.descripcion && <div style={{ fontSize: '0.78rem', color: P.texto, marginTop: 5, maxWidth: '62ch' }}>{p.descripcion}</div>}
              </div>

              <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {MODALIDADES.filter(m => (p.modalidades || []).includes(m.v)).map(m => {
                  const precio = pesos(p[m.campo] as number | null);
                  const t = TONO[m.v];
                  return (
                    <span key={m.v} style={{ ...E.chip, background: t.bg, color: t.fg, padding: '4px 8px' }}>
                      {m.l}{precio ? ` · ${precio}` : ' · a la medida'}
                    </span>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: P.gris, whiteSpace: 'nowrap' }}>
                  {enUso ? <><b style={{ color: P.texto }}>{p.usos}</b> en uso</> : 'sin usar'}
                </span>
                <button onClick={() => (abierto ? cerrar() : abrir(p))} style={E.btnG}>{abierto ? 'Cerrar' : 'Editar'}</button>
              </div>
            </div>

            {abierto && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${P.lineaSuave}` }}>
                <Editor f={f} setF={setF} toggleModalidad={toggleModalidad} guardar={guardar} cerrar={cerrar}
                  busy={busy} usos={p.usos || 0} nombreOriginal={p.nombre}
                  homologar={homologar} setHomologar={setHomologar}
                  onBorrar={enUso ? undefined : () => borrar(p)}
                  onAlternar={() => alternarActivo(p)} />
              </div>
            )}
          </div>
        );
      })}

      {!lista.length && (
        <div style={{ ...E.card, textAlign: 'center', color: P.gris, fontSize: '0.82rem' }}>
          Todavía no hay {esPlugin ? 'plugins' : 'licencias'} en el catálogo.
        </div>
      )}
    </div>
  );
}

/* ─────────── El formulario, uno solo para alta y edición ─────────── */
function Editor({ f, setF, toggleModalidad, guardar, cerrar, busy, usos = 0, nombreOriginal, homologar, setHomologar, nuevo, onBorrar, onAlternar }: {
  f: any; setF: (v: any) => void; toggleModalidad: (v: string) => void;
  guardar: () => void; cerrar: () => void; busy: boolean;
  usos?: number; nombreOriginal?: string; homologar: boolean; setHomologar: (v: boolean) => void;
  nuevo?: boolean; onBorrar?: () => void; onAlternar?: () => void;
}) {
  const cambioNombre = !nuevo && nombreOriginal !== undefined && String(f.nombre || '').trim() !== nombreOriginal;
  const mods: string[] = f.modalidades || [];

  return (
    <div style={nuevo ? { background: '#fff', border: `1px solid ${P.violetaBorde}`, borderRadius: 12, padding: 16, marginBottom: 12 } : undefined}>
      {nuevo && <div style={{ fontSize: '0.85rem', fontWeight: 800, color: P.violetaTinta, marginBottom: 12 }}>
        {f.categoria === 'plugin' ? 'Nuevo plugin' : 'Nueva licencia'}
      </div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        <div>
          <label style={E.lbl}>Nombre como lo ve el cliente</label>
          <input value={f.nombre || ''} onChange={e => setF({ ...f, nombre: e.target.value })}
            placeholder="Ej. Plugin Administración" style={E.input} />
          <div style={{ fontSize: '0.7rem', color: P.gris, marginTop: 4 }}>
            Así aparece en la cotización, en el estado de cuenta y en el recibo.
          </div>
        </div>
        <div>
          <label style={E.lbl}>¿A qué se refiere?</label>
          <textarea value={f.descripcion || ''} onChange={e => setF({ ...f, descripcion: e.target.value })}
            rows={3} placeholder="Una o dos frases en el idioma del cliente."
            style={{ ...E.input, resize: 'vertical', lineHeight: 1.45 }} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={E.lbl}>Cómo se cobra y a qué precio</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10, marginTop: 4 }}>
          {MODALIDADES.map(m => {
            const on = mods.includes(m.v);
            const t = TONO[m.v];
            return (
              <div key={m.v} style={{
                border: `1px solid ${on ? t.fg : '#e6e6e6'}`, borderRadius: 10, padding: '10px 12px',
                background: on ? t.bg : '#fbfbfc',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => toggleModalidad(m.v)} style={{ accentColor: t.fg, margin: 0 }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: on ? t.fg : '#666' }}>{m.l}</span>
                </label>
                <div style={{ fontSize: '0.69rem', color: on ? t.fg : P.gris, opacity: on ? 0.85 : 1, marginTop: 4, lineHeight: 1.4 }}>{m.ayuda}</div>
                {on && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: t.fg }}>$</span>
                    <input type="number" min="0" value={f[m.campo] ?? ''}
                      onChange={e => setF({ ...f, [m.campo]: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="A la medida" style={{ ...E.input, padding: '6px 9px' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: '0.7rem', color: P.gris, marginTop: 6 }}>
          Al cotizar solo se ofrecen las modalidades marcadas. Sin precio, el concepto sale como <b>a la medida</b> y se captura en cada venta.
        </div>
      </div>

      {cambioNombre && (
        <div style={{ marginTop: 14, background: usos ? P.ambarAgua : P.lineaSuave, border: `1px solid ${usos ? P.ambar : P.linea}`, borderRadius: 10, padding: '11px 13px' }}>
          <div style={{ fontSize: '0.78rem', color: usos ? P.ambarTinta : P.texto, lineHeight: 1.5 }}>
            {usos > 0 ? (
              <>
                <b>{usos} {usos === 1 ? 'suscripción' : 'suscripciones'}</b> usa{usos === 1 ? '' : 'n'} este concepto. Cambiar el nombre aquí
                no reescribe lo ya cobrado: cada movimiento conserva el texto con el que se vendió, que es el que dice su contrato.
              </>
            ) : (
              <>Nadie lo ha comprado todavía. Renombrarlo no afecta ningún movimiento.</>
            )}
          </div>
          {usos > 0 && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 9, cursor: 'pointer', fontSize: '0.78rem', color: P.ambarTinta, fontWeight: 600 }}>
              <input type="checkbox" checked={homologar} onChange={e => setHomologar(e.target.checked)} style={{ accentColor: P.ambarTinta, marginTop: 2 }} />
              <span>Emparejar también las {usos} suscripciones viejas con el nombre nuevo</span>
            </label>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={guardar} disabled={busy} style={{ ...E.btn, opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {busy && <Corazones size={9} color="#fff" />}Guardar
        </button>
        <button onClick={cerrar} style={E.btnG}>Cancelar</button>
        <div style={{ flex: 1 }} />
        {onAlternar && (
          <button onClick={onAlternar} style={E.btnG} title="Deja de ofrecerse en los selectores, pero sigue explicando lo ya vendido.">
            {f.activo === false ? 'Volver a ofrecer' : 'Retirar del catálogo'}
          </button>
        )}
        {onBorrar && (
          <button onClick={onBorrar} style={{ ...E.btnG, color: P.rojoTinta, borderColor: P.rojo }}>Borrar</button>
        )}
      </div>
    </div>
  );
}
