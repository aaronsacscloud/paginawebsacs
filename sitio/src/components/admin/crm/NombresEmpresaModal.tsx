// Completar el nombre de las empresas de un jalón.
//
// El nombre se sugirió partiendo la cuenta SACS, pero la mitad de las cuentas no
// son palabras que se puedan partir y quedaron como el slug con la inicial en
// mayúscula. Arreglarlas de una en una son cuarenta visitas a la ficha; aquí se
// escriben de corrido y se guarda todo al final.
import { useEffect, useRef, useState } from 'react';
import Cargando from './ui/Cargando';

const money = (n: any) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });

export default function NombresEmpresaModal({ onCerrar, onGuardado }: { onCerrar: () => void; onGuardado?: () => void }) {
  const [filas, setFilas] = useState<any[]>([]);
  const [tot, setTot] = useState<any>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [soloPend, setSoloPend] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch('/api/crm/clientes/nombres').then(r => r.json()).then(j => {
      setFilas(j.filas || []); setTot(j); setCargando(false);
    }).catch(() => setCargando(false));
  }, []);

  const visibles = filas.filter(f => !soloPend || f.pendiente);
  const sucios = Object.entries(edit).filter(([id, v]) => {
    const f = filas.find(x => x.id === id);
    return f && v.trim() !== String(f.nombre_comercial || '').trim();
  });

  const guardar = async () => {
    if (!sucios.length) { onCerrar(); return; }
    setGuardando(true);
    const r = await fetch('/api/crm/clientes/nombres', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cambios: sucios.map(([id, v]) => ({ id, nombre_comercial: v })) }),
    }).then(x => x.json()).catch(() => null);
    setGuardando(false);
    if (!r?.ok) { alert('No se pudieron guardar los nombres.'); return; }
    onGuardado?.();
    onCerrar();
  };

  // Enter salta al siguiente: se capturan cuarenta seguidos sin tocar el mouse.
  const siguiente = (i: number) => {
    const sig = visibles[i + 1];
    if (sig) refs.current[sig.id]?.focus();
  };

  return (
    <div onClick={() => !guardando && onCerrar()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.38)', zIndex: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 780, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f1f5' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, flex: 1 }}>Nombre de las empresas</h3>
            <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 3, lineHeight: 1.55 }}>
            Así se llama el cliente en la lista. Las cuentas que se pudieron partir en palabras ya vienen escritas;
            las que no —<b>Meraki</b>, <b>Kbiu</b>— quedaron con la cuenta tal cual y conviene escribirlas.
          </div>
          {tot && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <button onClick={() => setSoloPend(true)}
                style={{ border: '1px solid', borderColor: soloPend ? '#1a1a1a' : '#e2e2e8', background: soloPend ? '#1a1a1a' : '#fff', color: soloPend ? '#fff' : '#555', borderRadius: 20, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                Por escribir <span style={{ opacity: .6 }}>{tot.pendientes}</span>
              </button>
              <button onClick={() => setSoloPend(false)}
                style={{ border: '1px solid', borderColor: !soloPend ? '#1a1a1a' : '#e2e2e8', background: !soloPend ? '#1a1a1a' : '#fff', color: !soloPend ? '#fff' : '#555', borderRadius: 20, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                Todas <span style={{ opacity: .6 }}>{tot.total}</span>
              </button>
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#b3afbd' }}>Enter salta al siguiente</span>
            </div>
          )}
        </div>

        <div style={{ overflowY: 'auto', padding: '10px 20px 4px', flex: 1 }}>
          {cargando && <Cargando texto="Cargando…" />}
          {!cargando && visibles.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: '#9c99a6', fontSize: '0.85rem' }}>Todas las cuentas tienen su nombre escrito.</div>
          )}
          {visibles.map((f, i) => {
            const val = edit[f.id] !== undefined ? edit[f.id] : String(f.nombre_comercial || '');
            return (
              <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f7f6f9' }}>
                <span style={{ flex: '0 0 190px', fontSize: '0.7rem', color: '#8a8a8a', fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.cuenta}>
                  {f.cuenta}
                </span>
                <input
                  ref={el => { refs.current[f.id] = el; }}
                  value={val}
                  onChange={e => setEdit({ ...edit, [f.id]: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); siguiente(i); } }}
                  placeholder="Nombre de la empresa"
                  style={{
                    flex: 1, borderRadius: 7, padding: '6px 9px', fontSize: '0.78rem', fontFamily: 'inherit',
                    border: '1px solid', borderColor: f.separado ? '#c9bcf7' : '#dcdce2',
                    background: f.separado ? '#faf8ff' : '#fff',
                    color: f.separado ? '#4536BE' : '#1a1a1a', fontWeight: f.separado ? 700 : 500,
                  }} />
                <span style={{ flex: '0 0 86px', textAlign: 'right', fontSize: '0.7rem', color: '#b3afbd' }}>
                  {f.arr > 0 ? money(f.arr) : ''}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #f1f1f5', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={guardar} disabled={guardando}
            style={{ background: '#9B8CFA', color: '#fff', border: 0, borderRadius: 8, padding: '9px 18px', fontSize: '0.8rem', fontWeight: 800, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? .6 : 1 }}>
            {guardando ? 'Guardando…' : sucios.length ? `Guardar ${sucios.length} nombre${sucios.length === 1 ? '' : 's'}` : 'Cerrar'}
          </button>
          <button onClick={onCerrar} disabled={guardando}
            style={{ background: '#fff', border: '1px solid #dcdce2', borderRadius: 8, padding: '9px 15px', fontSize: '0.8rem', fontWeight: 600, color: '#555', cursor: 'pointer' }}>
            Cancelar
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#b3afbd' }}>
            Dejar uno vacío devuelve la sugerencia automática.
          </span>
        </div>
      </div>
    </div>
  );
}
