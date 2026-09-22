// Preparar el reporte de RECOMENDACIONES de una cuenta: «Lo que vemos en tu
// cuenta». Se abre desde el correo ejecutivo de la ficha.
//
// Tres pasos: lo que tú ves (opcional) → Analizar (los flujos salen del uso
// real y la IA los redacta) → revisas y corriges → Generar. El estado de cada
// flujo lo puso el dato; aquí se puede cambiar, porque quien conoce la cuenta
// sabe cosas que el dato no.
import { useEffect, useState } from 'react';

const EST: Record<string, { l: string; bg: string; fg: string }> = {
  medio: { l: 'se queda a medias', bg: 'rgba(244,168,205,.3)', fg: '#9c3d70' },
  sin_usar: { l: 'sin usar', bg: '#FFF4E5', fg: '#9a6a10' },
  completo: { l: 'se cierra completo', bg: '#EAF8F2', fg: '#1E8A63' },
};
const S = {
  in: { width: '100%', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '7px 10px', fontSize: '0.8rem', background: '#fdfcff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as const,
  btnP: { border: 'none', borderRadius: 10, padding: '9px 16px', background: '#9B8CFA', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnG: { border: '1px solid #dcd8ea', borderRadius: 9, padding: '7px 12px', background: '#fff', color: '#3d3752', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  lb: { fontSize: '0.62rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#9c99a6', marginBottom: 6 } as const,
};

export default function ReporteRecomendaciones({ companyId, cliente, onCerrar, onGenerado }: any) {
  const [notas, setNotas] = useState('');
  const [intro, setIntro] = useState('');
  const [flujos, setFlujos] = useState<any[] | null>(null);
  const [biblio, setBiblio] = useState<any[]>([]);
  const [programa, setPrograma] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    fetch('/api/crm/documentos?activos=1').then(r => r.json()).then(j => {
      const ds = j?.documentos || [];
      setBiblio(ds);
      // Si hay una presentación de programa activa, se propone como cierre.
      const p = ds.find((d: any) => d.tipo === 'presentacion');
      if (p) setPrograma(p.id);
    }).catch(() => {});
  }, []);

  async function analizar() {
    setBusy('analizar'); setError(''); setAviso('');
    const r = await fetch('/api/crm/recomendaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'analizar', company_id: companyId, notas }) })
      .then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setError(r?.error || 'No se pudo analizar la cuenta.'); return; }
    // Primero lo que no se cierra: es lo que el documento viene a decir.
    const orden: Record<string, number> = { medio: 0, sin_usar: 1, completo: 2 };
    setFlujos([...(r.flujos || [])].sort((a, b) => orden[a.estado] - orden[b.estado]));
    setIntro(r.intro || ''); if (r.aviso) setAviso(r.aviso);
  }

  async function generar() {
    setBusy('generar'); setError('');
    const r = await fetch('/api/crm/recomendaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'generar', company_id: companyId, intro, flujos, programa_doc_id: programa || null }) })
      .then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setError(r?.error || 'No se pudo generar.'); return; }
    onGenerado?.(r);
  }

  const set = (i: number, o: any) => setFlujos(v => (v || []).map((f, k) => k === i ? { ...f, ...o } : f));

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Recomendaciones de la cuenta" style={{ background: '#fff', borderRadius: 16, width: 'min(860px,100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(20,15,50,.3)' }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,#F4A8CD)', flex: 'none' }} />
        <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #f1eff7', flex: 'none' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Recomendaciones · {cliente}</div>
          <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 2 }}>Qué flujos se cierran completos dentro de SACS y cuáles se quedan a medias. Sale del uso real de la cuenta; tú lo revisas antes de que salga.</div>
        </div>

        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
          <div style={S.lb}>Lo que tú ves (opcional)</div>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} style={{ ...S.in, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Ej.: el reporte de consumo lo siguen sacando en Excel; en tienda no registran los cambios…" />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button style={{ ...S.btnP, opacity: busy ? .6 : 1 }} disabled={!!busy} onClick={analizar}>
              {busy === 'analizar' ? 'Revisando la cuenta…' : flujos ? 'Volver a analizar' : '✦ Analizar la cuenta'}
            </button>
            <span style={{ fontSize: '0.72rem', color: '#8a8596' }}>Se revisa el uso de los últimos 30 días, soporte y taller.</span>
          </div>
          {aviso && <div style={{ fontSize: '0.76rem', color: '#9a6a10', marginTop: 8 }}>{aviso}</div>}

          {flujos && (<>
            <div style={{ ...S.lb, marginTop: 18 }}>Entrada del documento</div>
            <textarea value={intro} onChange={e => setIntro(e.target.value)} rows={2} style={{ ...S.in, resize: 'vertical', lineHeight: 1.5 }} />

            <div style={{ ...S.lb, marginTop: 16 }}>Flujos · {flujos.length}</div>
            {flujos.map((f, i) => {
              const e = EST[f.estado] || EST.medio;
              return (
                <div key={i} style={{ border: '1px solid #eeecf4', borderRadius: 13, padding: '11px 13px', marginBottom: 9 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={f.estado} onChange={ev => set(i, { estado: ev.target.value })}
                      style={{ border: 'none', borderRadius: 20, padding: '3px 8px', fontSize: '0.68rem', fontWeight: 800, background: e.bg, color: e.fg, fontFamily: 'inherit', cursor: 'pointer' }}>
                      <option value="medio">se queda a medias</option><option value="sin_usar">sin usar</option><option value="completo">se cierra completo</option>
                    </select>
                    <input value={f.nombre} onChange={ev => set(i, { nombre: ev.target.value })} style={{ ...S.in, border: 'none', background: 'transparent', fontWeight: 800, fontSize: '0.9rem', padding: 2 }} />
                    <button title="Quitar este flujo" onClick={() => setFlujos(v => (v || []).filter((_, k) => k !== i))} style={{ border: 'none', background: 'none', color: '#b5b2bf', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                  </div>
                  {/* La cadena: clic en un eslabón lo marca como roto o como que sí se cierra. */}
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
                    {(f.cadena || []).map((c: any, j: number) => (
                      <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {j > 0 && <span style={{ color: '#c5c1d3' }}>→</span>}
                        <button title="Clic para marcar si este paso se cumple" onClick={() => set(i, { cadena: f.cadena.map((x: any, k: number) => k === j ? { ...x, ok: !x.ok } : x) })}
                          style={{ fontSize: '0.7rem', fontWeight: 700, borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit',
                            border: c.ok ? '1px solid transparent' : '1px dashed #EFA6CA', background: c.ok ? '#f4f2fb' : '#fff4f8', color: c.ok ? '#5b5670' : '#9c3d70' }}>
                          {c.paso}{c.dato ? <span style={{ fontWeight: 500, opacity: .7 }}> · {c.dato}</span> : null}
                        </button>
                      </span>
                    ))}
                  </div>
                  <textarea value={f.evidencia || ''} onChange={ev => set(i, { evidencia: ev.target.value })} rows={2} placeholder="Lo que se ve en los datos" style={{ ...S.in, resize: 'vertical', fontSize: '0.78rem' }} />
                  <textarea value={f.recomendacion || ''} onChange={ev => set(i, { recomendacion: ev.target.value })} rows={2} placeholder="Recomendamos…"
                    style={{ ...S.in, resize: 'vertical', fontSize: '0.78rem', marginTop: 6, background: '#f3fbf7', borderColor: '#cdeedd' }} />
                </div>
              );
            })}
            <button style={S.btnG} onClick={() => setFlujos(v => [...(v || []), { nombre: 'Nuevo flujo', estado: 'medio', cadena: [{ paso: 'Paso 1', ok: true }, { paso: 'Paso 2', ok: false }], evidencia: '', recomendacion: '' }])}>+ Agregar un flujo</button>

            <div style={{ ...S.lb, marginTop: 16 }}>Cierre del documento</div>
            <select value={programa} onChange={e => setPrograma(e.target.value)} style={S.in}>
              <option value="">Sin invitación al final</option>
              {biblio.map(d => <option key={d.id} value={d.id}>«¿Quieres cerrarlos juntos?» → {d.titulo}</option>)}
            </select>
          </>)}
          {error && <div style={{ marginTop: 10, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '9px 11px', fontSize: '0.78rem', color: '#C0554E' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8, justifyContent: 'flex-end', flex: 'none' }}>
          <button style={S.btnG} onClick={onCerrar}>Cancelar</button>
          <button style={{ ...S.btnP, opacity: !flujos?.length || busy ? .5 : 1 }} disabled={!flujos?.length || !!busy} onClick={generar}>
            {busy === 'generar' ? 'Generando…' : 'Generar y adjuntar al correo'}
          </button>
        </div>
      </div>
    </div>
  );
}
