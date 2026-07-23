// Configuración → Pipelines. Edita las etapas de cada pipeline (lead /
// oportunidad / cliente): agregar, renombrar, recolorear, reordenar, quitar.
// Guarda a /api/crm/pipelines (PUT upsert por tipo). Las vistas Kanban de
// Contactos, Oportunidades y Clientes leen estas etapas.
import { useEffect, useState } from 'react';

type Stage = { key: string; label: string; color: string };
type Pipeline = { id?: string; tipo: string; nombre: string; stages: Stage[] };

const TIPO_LABEL: Record<string, string> = { lead: 'Leads (contactos)', oportunidad: 'Oportunidades', cliente: 'Clientes' };
const TIPO_DESC: Record<string, string> = {
  lead: 'Etapas por las que pasa un contacto antes de volverse oportunidad.',
  oportunidad: 'Tu embudo de ventas: de calificar a ganar o perder.',
  cliente: 'Ciclo de vida del cliente ya activo (onboarding, expansión, riesgo…).',
};
const PALETA = ['#64748B', '#4B7BE5', '#6C5CE7', '#7c3aed', '#0891b2', '#1A8F7A', '#E8A838', '#E54B4B', '#94a3b8', '#db2777'];

const S = {
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 18, marginBottom: 16 } as const,
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none' } as const,
  btn: { padding: '8px 14px', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' } as const,
  btnSmall: { padding: '4px 9px', border: '1px solid #ddd', background: '#fff', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' } as const,
};

export default function PipelinesConfig({ initialTipo }: { initialTipo?: string } = {}) {
  const [pipes, setPipes] = useState<Record<string, Pipeline>>({});
  const [tipo, setTipo] = useState(initialTipo && ['lead', 'oportunidad', 'cliente'].includes(initialTipo) ? initialTipo : 'lead');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    setLoading(true);
    try {
      const j = await fetch('/api/crm/pipelines').then(r => r.json());
      const m: Record<string, Pipeline> = {};
      (j.data || []).forEach((p: Pipeline) => { m[p.tipo] = { ...p, stages: [...(p.stages || [])] }; });
      setPipes(m);
    } catch { setToast('No se pudo cargar.'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const pipe = pipes[tipo];
  const setPipe = (p: Pipeline) => setPipes({ ...pipes, [tipo]: p });
  const setStages = (stages: Stage[]) => setPipe({ ...pipe, stages });

  function addStage() {
    const n = (pipe.stages?.length || 0);
    setStages([...(pipe.stages || []), { key: 'etapa_' + (n + 1), label: 'Nueva etapa', color: PALETA[n % PALETA.length] }]);
  }
  function updateStage(i: number, patch: Partial<Stage>) { const s = [...pipe.stages]; s[i] = { ...s[i], ...patch }; setStages(s); }
  function delStage(i: number) { setStages(pipe.stages.filter((_, j) => j !== i)); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= pipe.stages.length) return;
    const s = [...pipe.stages]; [s[i], s[j]] = [s[j], s[i]]; setStages(s);
  }

  async function guardar() {
    if (!pipe.stages.length) { setToast('Agrega al menos una etapa.'); return; }
    setSaving(true); setToast('');
    try {
      const r = await fetch('/api/crm/pipelines', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, nombre: pipe.nombre, stages: pipe.stages }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'No se pudo guardar');
      setToast('Pipeline guardado ✓'); load();
    } catch (e: any) { setToast(e?.message || 'Error al guardar'); }
    setSaving(false);
    setTimeout(() => setToast(''), 4000);
  }

  if (loading) return <div style={{ padding: 40, color: '#999' }}>Cargando pipelines…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>Pipelines</h2>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>Define las etapas de cada tipo. Se usan en las vistas Kanban de Contactos, Oportunidades y Clientes.</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['lead', 'oportunidad', 'cliente'].map(t => (
          <button key={t} onClick={() => setTipo(t)} style={{ ...S.btn, background: tipo === t ? '#1a1a1a' : '#f2f2f2', color: tipo === t ? '#fff' : '#555' }}>{TIPO_LABEL[t]}</button>
        ))}
      </div>

      {pipe && (
        <div style={S.card}>
          <div style={{ marginBottom: 6, fontSize: 12.5, color: '#888' }}>{TIPO_DESC[tipo]}</div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#777', display: 'block', marginBottom: 3 }}>Nombre del pipeline</label>
          <input value={pipe.nombre} onChange={e => setPipe({ ...pipe, nombre: e.target.value })} style={{ ...S.input, width: '100%', maxWidth: 320, marginBottom: 16 }} />

          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>Etapas ({pipe.stages.length})</div>
          {pipe.stages.map((st, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...S.btnSmall, padding: '0 6px', lineHeight: 1.2, opacity: i === 0 ? 0.3 : 1 }} title="Subir">▲</button>
                <button onClick={() => move(i, 1)} disabled={i === pipe.stages.length - 1} style={{ ...S.btnSmall, padding: '0 6px', lineHeight: 1.2, opacity: i === pipe.stages.length - 1 ? 0.3 : 1 }} title="Bajar">▼</button>
              </div>
              <input value={st.label} onChange={e => updateStage(i, { label: e.target.value })} style={{ ...S.input, flex: 1, minWidth: 160 }} placeholder="Nombre de la etapa" />
              <div style={{ display: 'flex', gap: 3 }}>
                {PALETA.map(c => (
                  <button key={c} onClick={() => updateStage(i, { color: c })} title={c}
                    style={{ width: 20, height: 20, borderRadius: 5, background: c, border: st.color === c ? '2px solid #1a1a1a' : '1px solid #ddd', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
              <span style={{ ...S.btnSmall, background: (st.color || '#64748B') + '22', color: st.color, borderColor: 'transparent', fontWeight: 700 }}>{st.label || '—'}</span>
              <button onClick={() => delStage(i)} style={{ ...S.btnSmall, color: '#b93333' }} title="Quitar etapa">✕</button>
            </div>
          ))}
          <button onClick={addStage} style={{ ...S.btnSmall, marginTop: 4 }}>+ Agregar etapa</button>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={guardar} disabled={saving} style={{ ...S.btn, background: '#1A8F7A', color: '#fff', opacity: saving ? 0.6 : 1 }}>{saving ? 'Guardando…' : 'Guardar pipeline'}</button>
            {toast && <span style={{ fontSize: 13, color: toast.includes('✓') ? '#1A8F7A' : '#b93333' }}>{toast}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: '#aaa', marginTop: 10 }}>Si al guardar dice que falta la tabla, corre <code>scripts/migration-2026-07-pipelines.sql</code> en Supabase.</div>
        </div>
      )}
    </div>
  );
}
