import { useEffect, useState } from 'react';

/* ═══ Bandeja de sugerencias ═══
 *
 * Lo que el sistema propone solo: renovaciones que vienen y señales de uso de
 * clientes que ya te compran. NO son pipeline — nadie ha ido a buscar ese dinero
 * todavía— así que no cuentan en ningún KPI hasta que alguien las acepta. Es la
 * diferencia entre un pronóstico que se cree y uno que se infla solo.
 *
 * Aceptar → se vuelve una oportunidad normal. Descartar → desaparece de aquí
 * (con su motivo guardado: es lo único que después dice qué señal vale la pena).
 */

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';

const CAT: Record<string, { label: string; bg: string; color: string }> = {
  renovacion: { label: '🔄 Renovación', bg: 'rgba(42,181,160,0.14)', color: '#1A8F7A' },
  upsell:     { label: '⬆ Upsell',      bg: 'rgba(108,92,231,0.12)', color: '#6C5CE7' },
  retencion:  { label: '🛟 Retención',   bg: 'rgba(185,51,51,0.10)',  color: '#b93333' },
  nuevo:      { label: '✨ Nuevo',       bg: 'rgba(75,123,229,0.12)', color: '#3764c4' },
};

const btn: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 700, padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#333', cursor: 'pointer', fontFamily: 'inherit' };

export default function SugerenciasOportunidad({ onCambio }: { onCambio?: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [abierto, setAbierto] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = async () => {
    try {
      const j = await fetch('/api/crm/deals/sugerencias', { cache: 'no-store' }).then(r => r.json());
      setData(j.data || []); setResumen(j.resumen || null);
    } catch { /* la bandeja nunca rompe la pantalla */ }
  };
  useEffect(() => { cargar(); }, []);

  async function generar() {
    setGenerando(true);
    const j = await fetch('/api/crm/deals/sugerencias', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generar: true, dias: 60 }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo' }));
    setGenerando(false);
    setMsg(j.error ? j.error : `${j.renovaciones} renovación(es), ${j.upsells} upsell(s) y ${j.retencion || 0} de retención por revisar.`);
    setTimeout(() => setMsg(''), 5000);
    cargar();
  }

  async function accion(d: any, tipo: 'aceptar' | 'descartar') {
    let motivo: string | null = null;
    if (tipo === 'descartar') {
      // Se pregunta el porqué: sin eso no hay forma de saber después qué señal
      // vale y cuál es ruido. Vacío también se acepta — no se bloquea limpiar.
      motivo = prompt(`¿Por qué no aplica?\n\n${d.nombre}`, '') ?? null;
      if (motivo === null) return;
    }
    setBusy(d.id);
    await fetch('/api/crm/deals/sugerencias', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, [tipo]: true, ...(motivo ? { motivo } : {}) }),
    }).catch(() => {});
    setBusy(null);
    setData(prev => prev.filter(x => x.id !== d.id));
    cargar(); onCambio?.();
  }

  if (!data.length && !msg) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 24px 0', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: '#aaa' }}>Sin sugerencias pendientes.</span>
        <button onClick={generar} disabled={generando} style={{ ...btn, padding: '5px 10px', fontSize: '0.72rem' }}>
          {generando ? 'Buscando…' : 'Buscar renovaciones y upsells'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ margin: '10px 24px 0', border: '1px solid #e8e4f5', background: '#faf9ff', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.85rem' }}>💡 Sugerencias del sistema</b>
        {resumen && <span style={{ fontSize: '0.73rem', color: '#777' }}>
          {resumen.renovaciones} renovación(es) · {resumen.upsells} upsell(s)
          {resumen.retencion ? ` · ${resumen.retencion} retención` : ''} · {money(resumen.mrr_sugerido)} MRR potencial
          {resumen.mrr_en_riesgo ? <span style={{ color: '#b93333' }}> · {money(resumen.mrr_en_riesgo)} MRR en riesgo</span> : null}
        </span>}
        {/* Se dice explícito: si alguien cree que ya está en el pipeline, el
            pronóstico se lee doble. */}
        <span style={{ fontSize: '0.68rem', color: '#a06600', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 6, padding: '2px 7px' }}>
          no cuentan hasta aceptarlas
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={generar} disabled={generando} style={{ ...btn, padding: '5px 10px', fontSize: '0.72rem' }}>{generando ? 'Buscando…' : '↻ Buscar más'}</button>
        <button onClick={() => setAbierto(a => !a)} style={{ ...btn, padding: '5px 10px', fontSize: '0.72rem' }}>{abierto ? 'Ocultar' : `Ver ${data.length}`}</button>
      </div>
      {msg && <div style={{ padding: '0 14px 8px', fontSize: '0.75rem', color: '#4B7BE5' }}>{msg}</div>}

      {abierto && data.map((d: any) => {
        const c = CAT[d.categoria] || CAT.nuevo;
        return (
          <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderTop: '1px solid #efecfb', flexWrap: 'wrap', background: '#fff' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{c.label}</span>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{d.nombre}</div>
              {d.sugerencia_motivo && <div style={{ fontSize: '0.74rem', color: '#777', lineHeight: 1.45 }}>{d.sugerencia_motivo}</div>}
              <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 2 }}>
                {d.companies?.nombre || 'sin cliente'}{d.fecha_cierre_esperada ? ` · cierra ${fmtDate(d.fecha_cierre_esperada)}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 100 }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{money(d.valor_total)}</div>
              {Number(d.mrr) > 0 && <div style={{ fontSize: '0.68rem', color: '#999' }}>{money(d.mrr)}/mes</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={busy === d.id} onClick={() => accion(d, 'aceptar')} style={{ ...btn, background: '#1A8F7A', color: '#fff', borderColor: '#1A8F7A' }}>✓ Aceptar</button>
              <button disabled={busy === d.id} onClick={() => accion(d, 'descartar')} style={{ ...btn, color: '#b93333' }}>Descartar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
