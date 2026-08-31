// ══ El tablero de LEADS, ahora dentro de la sección Dashboard ══════════════
//
// Vivía como una segunda vista de Leads, detrás de un selector «Lista ·
// Dashboard». Eran dos cosas distintas en el mismo lugar: a Leads uno entra a
// TRABAJAR la lista, y a Dashboard a ver cómo va todo. Aquí convive con el
// resto de los tableros y allá la pantalla se quedó con un solo trabajo.
//
// Trae sus propios datos: montado desde Dashboard no hay un LeadsTab que se
// los pase, y depender de que otro los cargue lo haría parpadear en blanco.
import { useEffect, useState } from 'react';
import { S, money, ABIERTOS } from './LeadsTab';
import { COLOR_GRUPO, GRUPO_DE } from '../../../lib/crm/estatus-lead';
import { origenDe } from '../../../lib/crm/origenes';
import Cargando from './ui/Cargando';

export default function LeadsDashboard() {
  const [res, setRes] = useState<any>(null);
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    fetch('/api/crm/leads/resumen?dias=30').then(r => r.json()).then(setRes).catch(() => {});
    fetch('/api/crm/contacts?limit=1000').then(r => r.json())
      .then(j => setRows(j.data || j.contacts || [])).catch(() => setRows([]));
  }, []);

  const FUNNEL = [
    { g: 'pendiente', l: 'Sin tocar' },
    { g: 'activo', l: 'Respondieron' },
    { g: 'comprometido', l: 'Comprometidos' },
    { g: 'frio', l: 'No contestan' },
    { g: 'fuera', l: 'Descartados' },
  ] as const;
  const eDe = (c: any) => (c.estatus_lead || 'nuevo');
  const conteosFunnel: Record<string, number> = {};
  for (const c of rows || []) {
    if (!ABIERTOS.includes(c.lifecycle_stage)) continue;
    const g = GRUPO_DE[eDe(c) as keyof typeof GRUPO_DE] || 'pendiente';
    conteosFunnel[g] = (conteosFunnel[g] || 0) + 1;
  }
  const topOrigenes = (res?.origenes || []).filter((o: any) => o.v !== 'sin_definir').slice(0, 6);
  const maxOrigen = Math.max(1, ...topOrigenes.map((o: any) => o.n));

  if (!res && !rows) return <Cargando texto="Cargando el tablero de leads…" alto={280} />;

  return (
    <>
      {/* La reja de cuatro vivía en el <style> de LeadsTab; se muda con su
          bloque, porque montado aquí aquel <style> no existe. */}
      <style>{`
        .lead-4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; }
        @media (max-width: 1100px) { .lead-4 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 620px)  { .lead-4 { grid-template-columns:1fr; } }
      `}</style>
        <div className="lead-4" style={{ marginBottom: 14 }}>
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div style={S.kl}>Leads nuevos</div>
            <div style={S.kv}>{res?.nuevos ?? '—'}</div>
            <div style={S.ks}>en 30 días · <b style={{ color: '#3f3b4d' }}>{res?.abiertos ?? 0}</b> abiertos en total</div>
            <div style={S.ke}>Gente que dejó sus datos y todavía no es cliente.</div>
          </div>
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div style={S.kl}>Convertidos</div>
            <div style={{ ...S.kv, color: '#1E8A63' }}>{res?.convertidos ?? '—'}</div>
            <div style={S.ks}>a cliente en 30 días{res?.arr_convertido ? <> · <b style={{ color: '#1E8A63' }}>{money(res.arr_convertido)}</b> de ARR</> : ''}</div>
            <div style={S.ke}>Cuenta cuando nace su primera suscripción, no cuando se marca a mano.</div>
          </div>
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div style={S.kl}>Conversión</div>
            <div style={{ ...S.kv, color: '#5B4BD6' }}>{res?.conversion != null ? `${res.conversion}%` : '—'}</div>
            <div style={S.ks}>de {res?.cohorte ?? 0} leads que llegaron hace 60 días o más</div>
            <div style={S.ke}>Los de esta semana no entran: todavía no tuvieron tiempo de decidir.</div>
          </div>
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div style={S.kl}>Sin seguimiento</div>
            <div style={{ ...S.kv, color: (res?.sin_seguimiento || 0) > 0 ? '#C0554E' : '#1a1a1a' }}>{res?.sin_seguimiento ?? '—'}</div>
            <div style={S.ks}>sin contacto en más de 7 días</div>
            <div style={S.ke}>Es la fuga más cara: ya pagaste por traerlos.</div>
          </div>
        </div>

        {/* El funnel operativo: en qué está el pool abierto. Los números
            cliqueables llevan a la Lista ya filtrada — aquí vive el desglose
            que en la Lista sería una fila más de pastillas. */}
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={S.kl}>Funnel operativo</div>
          <div style={{ display: 'flex', gap: 0, marginTop: 10, borderRadius: 9, overflow: 'hidden', border: '1px solid #ececec' }}>
            {FUNNEL.filter(f => f.g !== 'fuera').map((f, i) => {
              const n = conteosFunnel[f.g] || 0;
              const col = COLOR_GRUPO[f.g];
              return (
                <button key={f.g} onClick={() => { window.location.href = `/admin/crm?tab=pipeline&etapa=abiertos&estatus=g:${f.g}`; }}
                  title={`Ver los ${n} en la lista`}
                  style={{ flex: `${Math.max(n, 1)} 1 0`, minWidth: 128, border: 'none', borderLeft: i ? '1px solid #ececec' : 'none',
                    background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '10px 12px 12px' }}>
                  <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#8a8a92', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: col.tinta, opacity: .8 }} />{f.l}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: col.tinta, marginTop: 2 }}>{n}</div>
                  <div style={{ height: 4, borderRadius: 4, background: col.fondo, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '100%', background: col.tinta, opacity: .55 }} />
                  </div>
                </button>
              );
            })}
          </div>
          {(() => {
            const conR = (rows || []).filter((c: any) => ABIERTOS.includes(c.lifecycle_stage) && c.reunion);
            if (!conR.length) return null;
            const asis = conR.filter((c: any) => c.reunion.ultima_estado === 'asistio').length;
            const noAsis = conR.filter((c: any) => c.reunion.ultima_estado === 'no_asistio').length;
            const prox = conR.filter((c: any) => c.reunion.proxima).length;
            const tasa = asis + noAsis > 0 ? Math.round((asis / (asis + noAsis)) * 100) : null;
            return (
              <div style={{ fontSize: '0.72rem', color: '#5c5966', marginTop: 10 }}>
                Reuniones del pool: <b style={{ color: '#1E8A63' }}>{asis} completadas</b> · <b style={{ color: '#C0554E' }}>{noAsis} no asistieron</b> · {prox} próximas{tasa != null && <> · asistencia <b>{tasa}%</b></>}
              </div>
            );
          })()}
          <div style={{ ...S.ke, marginTop: 8 }}>Se calcula solo, de los hechos: mensajes, llamadas, reuniones y cotizaciones. Click en un número para ver quiénes son.</div>
        </div>

        {topOrigenes.length > 0 && (
          <div style={S.card}>
            <div style={S.h}>De dónde están llegando
              <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#a5a2af' }}>leads y clientes · mismo catálogo</span>
            </div>
            {topOrigenes.map((o: any) => {
              const info = origenDe(o.v);
              return (
                <div key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f5f4f8', fontSize: '0.79rem' }}>
                  <span style={{ fontWeight: 700, width: 170, flexShrink: 0 }}>{info.l}</span>
                  <span style={{ flex: 1, height: 8, background: '#f4f3f7', borderRadius: 9, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', borderRadius: 9, background: info.color, width: `${Math.max(3, (o.n / maxOrigen) * 100)}%` }} />
                  </span>
                  <span style={{ width: 36, textAlign: 'right', fontWeight: 800 }}>{o.n}</span>
                  <span style={{ width: 104, textAlign: 'right', fontSize: '0.68rem', color: o.pct >= 40 ? '#1E8A63' : '#a5a2af', fontWeight: o.pct >= 40 ? 700 : 400 }}>
                    convierte {o.pct}%
                  </span>
                </div>
              );
            })}
            <div style={{ fontSize: '0.72rem', color: '#8a8a8a', marginTop: 11, paddingTop: 10, borderTop: '1px solid #f5f4f8' }}>
              Volumen y cierre juntos: el canal que más trae no siempre es el que mejor cierra, y ahí está la decisión de dónde poner el dinero.
            </div>
          </div>
        )}
    </>
  );
}
