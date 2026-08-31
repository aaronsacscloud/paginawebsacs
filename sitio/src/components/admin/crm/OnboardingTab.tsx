// ══ Onboarding · los primeros 30 días de cada cliente nuevo ════════════════
//
// La pantalla del consultor: qué caso va en qué etapa, quién está atorado y
// con qué prueba. Arriba, el INTERRUPTOR maestro — el módulo entero nace
// apagado y solo el dueño lo enciende; encendido, solo entran clientes
// nuevos (primera suscripción posterior al encendido).
import { useEffect, useMemo, useState } from 'react';
import { WRAP } from '../../../lib/crm/layout';
import Cargando from './ui/Cargando';
import { ETAPAS_ONB, ETAPA_ONB } from '../../../lib/crm/onboarding.reglas';
import { CSS_TABLA, T } from '../../../lib/crm/tabla.estilo';

const dias = (d?: string | null) => d ? Math.floor((Date.now() - Date.parse(d + 'T06:00:00Z')) / 86400000) : 0;

export default function OnboardingTab() {
  const [datos, setDatos] = useState<any>(null);
  const [tab, setTab] = useState('vivos');
  const [ocupado, setOcupado] = useState(false);

  const cargar = () => fetch('/api/crm/onboarding').then(r => r.json()).then(setDatos).catch(() => setDatos({ error: true }));
  useEffect(() => { cargar(); }, []);

  const casos = useMemo(() => {
    const todos = datos?.casos || [];
    if (tab === 'vivos') return todos.filter((c: any) => !c.cerrado_at);
    if (tab === 'atorados') return todos.filter((c: any) => !c.cerrado_at && c.atorado_desde);
    if (tab === 'graduados') return todos.filter((c: any) => c.cierre_motivo === 'graduado');
    return todos;
  }, [datos, tab]);

  if (!datos) return <Cargando texto="Cargando onboarding…" alto={280} />;
  const activo = !!datos?.config?.activo;

  const prender = async (encender: boolean) => {
    if (encender && !window.confirm('¿Encender el onboarding? Desde este momento, todo cliente NUEVO con cuenta ligada entra a sus 30 días acompañados (correos, avisos al consultor y barrido nocturno). Los clientes existentes NO entran.')) return;
    setOcupado(true);
    await fetch('/api/crm/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: encender ? 'encender' : 'apagar' }) });
    setOcupado(false); cargar();
  };

  return (
    <div style={WRAP}>
      <style>{CSS_TABLA}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Onboarding</h1>
          <div style={{ fontSize: '0.75rem', color: '#9c99a6', marginTop: 2 }}>Los primeros 30 días de cada cliente nuevo · {casos.length} en vista</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* El interruptor DICE su estado, no solo lo es: un módulo pausado
              que se ve igual que uno encendido es una trampa. */}
          <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase',
            color: activo ? '#1E8A63' : '#9a6a10', background: activo ? '#EAF8F2' : '#FFF4E5',
            borderRadius: 99, padding: '4px 12px' }}>{activo ? 'Encendido' : 'Pausado'}</span>
          <button disabled={ocupado} onClick={() => prender(!activo)}
            style={{ border: '1px solid', borderColor: activo ? '#e2c9c5' : '#bfe8df',
              background: '#fff', color: activo ? '#C0554E' : '#1E8A63', borderRadius: 9,
              padding: '7px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {activo ? 'Pausar' : 'Encender'}
          </button>
        </div>
      </div>

      {!activo && (
        <div style={{ background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 11, padding: '11px 16px', fontSize: '0.8rem', color: '#7a5a10', margin: '12px 0' }}>
          <b>El motor está listo y pausado.</b> Al encenderlo, cada cliente nuevo con cuenta ligada entra solo; los existentes no. Nada se manda mientras esté pausado.
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 18, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #eeeef1', marginBottom: 12 }}>
          {[['vivos', 'En curso'], ['atorados', 'Atorados'], ['graduados', 'Graduados'], ['todos', 'Todos']].map(([v, l]) => {
            const on = tab === v;
            const n = v === 'vivos' ? (datos.casos || []).filter((c: any) => !c.cerrado_at).length
              : v === 'atorados' ? (datos.casos || []).filter((c: any) => !c.cerrado_at && c.atorado_desde).length
              : v === 'graduados' ? (datos.casos || []).filter((c: any) => c.cierre_motivo === 'graduado').length
              : (datos.casos || []).length;
            return (
              <button key={v} onClick={() => setTab(v)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                padding: '8px 13px 9px', fontSize: '0.85rem', fontWeight: on ? 800 : 650, color: on ? '#5B4BD6' : '#6d6a7a',
                borderBottom: on ? '2px solid #5B4BD6' : '2px solid transparent' }}>
                {l} <span style={{ fontSize: '0.7rem', fontWeight: 700, color: on ? '#5B4BD6' : '#9a97a5', background: on ? '#EEECFE' : '#f2f1f6', borderRadius: 99, padding: '1px 7px', marginLeft: 4 }}>{n}</span>
              </button>
            );
          })}
        </div>

        {casos.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#9a97a5', fontSize: '0.85rem' }}>
            {activo ? 'Todavía no entra ningún cliente: el próximo que pague con cuenta ligada aparece aquí solo.' : 'Sin casos. El motor está pausado.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="crm-tabla" style={{ minWidth: 860 }}>
              <thead><tr>
                <th style={{ ...T.th }}>Cliente</th>
                <th style={{ ...T.th }}>Etapa</th>
                <th style={{ ...T.th, textAlign: 'right' }}>Día</th>
                <th style={{ ...T.th }}>Hitos</th>
                <th style={{ ...T.th }}>Estado</th>
                <th style={{ ...T.th }}>Consultor</th>
              </tr></thead>
              <tbody>
                {casos.map((c: any) => {
                  const co = c.companies || {};
                  const d = dias(c.inicio);
                  const et = ETAPA_ONB(c.etapa);
                  const at = c.atorado_desde && !c.cerrado_at;
                  return (
                    <tr key={c.id}>
                      <td style={T.td}>
                        <div style={T.nombre as any}>{co.nombre_comercial || co.nombre || '—'}</div>
                        <div style={{ fontSize: '0.68rem', color: '#9a97a5' }}>{co.sacs_account || 'sin cuenta'}</div>
                      </td>
                      <td style={T.td} title={et.ayuda}>{et.l}</td>
                      <td style={{ ...T.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.cerrado_at ? '—' : `${Math.min(d, 99)} / 30`}</td>
                      <td style={T.td}>
                        {(['configurado', 'primer_uso', 'uso_constante'] as const).map(h => (
                          <span key={h} title={`${h}${c.hitos?.[h] ? ` · ${c.hitos[h]}` : ' · pendiente'}`}
                            style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 99, marginRight: 5,
                              background: c.hitos?.[h] ? '#1E8A63' : '#e4e2ec' }} />
                        ))}
                      </td>
                      <td style={T.td}>
                        {c.cierre_motivo === 'graduado' ? <span style={{ color: '#1E8A63', fontWeight: 700 }}>Graduado</span>
                          : c.cierre_motivo === 'perdido_temprano' ? <span style={{ color: '#C0554E', fontWeight: 700 }}>Pasó a Churn</span>
                          : at ? <span style={{ color: '#C0554E', fontWeight: 700 }}>Atorado {dias(String(c.atorado_desde).slice(0, 10))} d</span>
                          : <span style={{ color: '#5a5a63' }}>Avanzando</span>}
                      </td>
                      <td style={T.td}>
                        <select value={c.consultor_id || ''} onChange={async e => {
                          await fetch('/api/crm/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ accion: 'consultor', caso_id: c.id, consultor_id: e.target.value || null }) });
                          cargar();
                        }} style={{ border: '1px solid #e2e4e9', borderRadius: 8, padding: '4px 8px', fontSize: '0.74rem', background: '#fff', fontFamily: 'inherit', maxWidth: 150 }}>
                          <option value="">Sin asignar</option>
                          {(datos.equipo || []).map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
