import { useEffect, useState } from 'react';
import Cargando from './ui/Cargando';
import { S } from './SubscriptionsTab';

/* ═══ Bandeja de oportunidades ═══
 * El detector genera ~70 señales cada dos días. Sin un lugar donde marcarlas
 * como atendidas se vuelven paisaje en dos semanas — y sin saber cuáles se
 * cerraron no hay forma de afinar un umbral: no se distingue la señal que vende
 * de la que es ruido. Esto es ese lugar. */

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const ETIQUETA: Record<string, { txt: string; bg: string; co: string }> = {
  cancelada_pero_usando: { txt: 'Usa sin pagar',     bg: '#fdecea', co: '#b93333' },
  entro_a_riesgo:        { txt: 'Entró a riesgo',    bg: '#fdecea', co: '#b93333' },
  caida_ventas:          { txt: 'Caída de ventas',   bg: '#fdecea', co: '#b93333' },
  salud_cayendo:         { txt: 'Salud cayendo',     bg: '#fdecea', co: '#b93333' },
  modulo_fuera_de_plan:  { txt: 'Usa fuera de plan', bg: '#e6f6f2', co: '#1A8F7A' },
  sucursales_excedidas:  { txt: 'Sucursales de más', bg: '#e6f6f2', co: '#1A8F7A' },
  plan_sin_uso:          { txt: 'Paga y no usa',     bg: '#fff5e6', co: '#a06600' },
};
const et = (t: string) => ETIQUETA[t] || { txt: String(t).replace(/_/g, ' '), bg: '#f3f4f6', co: '#475569' };
const TABS = [
  { k: 'abiertas', l: 'Por trabajar' }, { k: 'contactado', l: 'Contactadas' },
  { k: 'ganada', l: 'Ganadas' }, { k: 'descartada', l: 'Descartadas' },
];
const kpi = { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 14px', flex: 1, minWidth: 155 } as const;

export default function BandejaOportunidades({ onOpenCliente }: { onOpenCliente?: (id: string) => void }) {
  const [tab, setTab] = useState('abiertas');
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [moviendo, setMoviendo] = useState<string | null>(null);

  async function load(t: string) {
    setCargando(true);
    try { setD(await fetch('/api/crm/arr/bandeja?estado=' + t).then(r => r.json())); }
    catch { setD({ data: [] }); }
    setCargando(false);
  }
  useEffect(() => { load(tab); }, [tab]);

  async function mover(f: any, estado: string) {
    let motivo: string | null = null;
    if (estado === 'descartada') {
      // El motivo se pide aquí y el servidor también lo exige: sin él, en tres
      // meses nadie sabe qué umbral estaba mal.
      motivo = window.prompt(`¿Por qué no aplica?\n\n${f.titulo}\n\nEs lo único que después permite afinar la señal.`, '');
      if (!motivo || !motivo.trim()) return;
    }
    setMoviendo(f.id);
    const j = await fetch('/api/crm/arr/bandeja', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, estado, motivo_descarte: motivo }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setMoviendo(null);
    if (j?.error) alert(j.error); else load(tab);
  }

  const r = d?.resumen;
  return (
    <div style={{ padding: '4px 12px 28px' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={kpi}><div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>Por trabajar</div><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{r?.nuevas ?? '—'}</div></div>
        <div style={kpi}><div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>Contactadas</div><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{r?.contactadas ?? '—'}</div></div>
        <div style={kpi}><div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>ARR en juego</div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A8F7A' }}>{money(r?.valor_abierto)}</div><div style={{ fontSize: '0.64rem', color: '#a7abb3' }}>solo las abiertas</div></div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e8eaee', marginBottom: 12, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ flexShrink: 0, minHeight: 40, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t.k ? '2.5px solid #1a1a1a' : '2.5px solid transparent',
              fontWeight: tab === t.k ? 800 : 600, fontSize: '0.82rem', color: tab === t.k ? '#1a1a1a' : '#777' }}>{t.l}</button>
        ))}
      </div>

      {r?.por_tipo?.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {r.por_tipo.map((t: any) => { const e = et(t.tipo); return (
            <span key={t.tipo} style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, background: e.bg, color: e.co }}>{e.txt}: {t.n}</span>
          ); })}
        </div>
      ) : null}

      {cargando && <Cargando texto="Cargando…" />}
      {!cargando && !d?.data?.length && <div style={{ padding: 30, textAlign: 'center', color: '#999' }}>Nada por aquí.</div>}

      {!cargando && (d?.data || []).map((f: any) => {
        const e = et(f.signal_type);
        const co = Array.isArray(f.companies) ? f.companies[0] : f.companies;
        const abierta = f.estado === 'nueva' || f.estado === 'contactado';
        return (
          <div key={f.id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, background: e.bg, color: e.co }}>{e.txt}</span>
                  <button onClick={() => onOpenCliente?.(f.company_id)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontWeight: 800, fontSize: '0.88rem', color: '#1a1a1a' }}>
                    {co?.sacs_account || co?.nombre || 'Cliente'}
                  </button>
                  {f.opportunity_value > 0 && <span style={{ fontWeight: 800, color: '#1A8F7A', fontSize: '0.82rem' }}>+{money(f.opportunity_value)}/año</span>}
                  {f.estado === 'contactado' && <span style={{ fontSize: '0.7rem', color: '#a06600', fontWeight: 700 }}>· en seguimiento</span>}
                </div>
                <div style={{ fontSize: '0.83rem', color: '#333' }}>{f.titulo}</div>
                {f.detalle && <div style={{ fontSize: '0.76rem', color: '#777', marginTop: 3 }}>{f.detalle}</div>}
                {f.accion && <div style={{ fontSize: '0.78rem', color: '#1A8F7A', marginTop: 5, fontWeight: 600 }}>→ {f.accion}</div>}
                {f.motivo_descarte && <div style={{ fontSize: '0.74rem', color: '#b93333', marginTop: 5 }}>Descartada: {f.motivo_descarte}</div>}
              </div>
              {abierta && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {f.estado === 'nueva' && <button disabled={moviendo === f.id} onClick={() => mover(f, 'contactado')} style={{ ...S.btnSmall, minHeight: 36, padding: '0 12px' }}>Ya contacté</button>}
                  <button disabled={moviendo === f.id} onClick={() => mover(f, 'ganada')} style={{ ...S.btnSmall, minHeight: 36, padding: '0 12px', background: '#1A8F7A', color: '#fff', border: 'none', fontWeight: 700 }}>Ganada</button>
                  <button disabled={moviendo === f.id} onClick={() => mover(f, 'descartada')} style={{ ...S.btnSmall, minHeight: 36, padding: '0 12px', color: '#b93333', borderColor: '#f0c4bd' }}>No aplica</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
