// WHATSAPP · El rail izquierdo: bandejas con contadores, etapas del ciclo de
// vida, FILTROS de cliente (los mismos catálogos que la sección Clientes) y
// vistas guardadas (crm_vistas, tabla 'wa_inbox'). En móvil este mismo
// componente vive dentro de un Sheet.
import { useEffect, useState } from 'react';
import { LIFECYCLE } from '../../../../lib/crm/lifecycle';
import { useCatalogoEtiquetas } from '../Etiquetas';
import AjustesWA from './AjustesWA';
import type { Filtros } from './InboxPro';
import { FILTROS_BASE } from './InboxPro';

const FILTROS_BANDEJA = [
  { id: 'todas', label: 'Todas' },
  { id: 'mias', label: 'Mías' },
  { id: 'sin_asignar', label: 'Sin asignar' },
  { id: 'no_leidas', label: 'No leídas' },
  { id: 'pospuestas', label: 'Pospuestas' },
];

// El catálogo de planes es el de Clientes (PLAN_BADGE); los ids son los del
// CHECK de companies.plan.
const PLANES = [
  { v: 'vende', l: 'Vende' }, { v: 'controla', l: 'Controla' }, { v: 'fideliza', l: 'Fideliza' },
  { v: 'automatiza', l: 'Automatiza' }, { v: 'personalizada', l: 'Personalizada' }, { v: 'soporte_premium', l: 'Soporte premium' },
];
const TIPOS = [
  { v: 'lead', l: 'Lead' }, { v: 'cliente', l: 'Cliente' }, { v: 'partner', l: 'Partner' }, { v: 'churned', l: 'Perdido' },
];

const fila = (activo: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 8,
  padding: '8px 11px', fontSize: '0.8rem',
  background: activo ? '#EEECFE' : 'transparent',
  color: activo ? '#5B4BD6' : '#555', fontWeight: activo ? 800 : 600,
});
const seccion: React.CSSProperties = {
  fontSize: '0.58rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase',
  letterSpacing: '.07em', padding: '14px 10px 5px',
};
const num: React.CSSProperties = { marginLeft: 'auto', fontSize: '0.68rem', color: '#a5a2af', fontVariantNumeric: 'tabular-nums' };
const sel = (activo: boolean): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box', border: '1.5px solid', borderColor: activo ? '#c9bcf7' : '#e8e7ee',
  borderRadius: 8, padding: '6px 8px', fontSize: '0.73rem', fontFamily: 'inherit',
  background: activo ? '#f7f4ff' : '#fff', color: activo ? '#5B4BD6' : '#555',
  fontWeight: activo ? 700 : 500, marginBottom: 6, cursor: 'pointer',
});

export default function RailInbox({ counts, filtros, setFiltros, equipo = [] }: {
  counts: any; filtros: Filtros; setFiltros: (f: Filtros) => void; equipo?: any[];
}) {
  const [vistas, setVistas] = useState<any[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const { cat } = useCatalogoEtiquetas();

  const cargarVistas = () => fetch('/api/crm/vistas?tabla=wa_inbox').then(r => r.json())
    .then(j => setVistas(j.data || [])).catch(() => {});
  useEffect(() => { cargarVistas(); }, []);

  const set = (k: keyof Filtros, v: string) => setFiltros({ ...filtros, [k]: v });
  const nFiltrosCliente = ['tipo', 'plan', 'etiqueta', 'asignado', 'estado', 'sin_contacto']
    .filter(k => (filtros as any)[k]).length;
  const hayFiltroActivo = filtros.filtro !== 'todas' || !!filtros.etapa || !!filtros.search || nFiltrosCliente > 0;

  const guardarVista = async () => {
    const nombre = window.prompt('Nombre de la vista (ej. "Clientes Controla sin responder"):');
    if (!nombre?.trim()) return;
    setGuardando(true);
    await fetch('/api/crm/vistas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla: 'wa_inbox', nombre: nombre.trim(), config: filtros }),
    }).catch(() => {});
    setGuardando(false); cargarVistas();
  };
  const borrarVista = async (id: string) => {
    await fetch('/api/crm/vistas', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    }).catch(() => {});
    cargarVistas();
  };

  // Una vista vieja (solo filtro/etapa/search) se aplica sobre la base: los
  // campos nuevos quedan vacíos y no rompe.
  const aplicarVista = (v: any) => setFiltros({ ...FILTROS_BASE, ...v.config });
  const vistaActiva = vistas.find(v => JSON.stringify({ ...FILTROS_BASE, ...v.config }) === JSON.stringify(filtros));

  return (
    <div style={{ borderRight: '1px solid #f0eff3', overflowY: 'auto', padding: '10px 8px', background: '#fdfcff' }}>
      {FILTROS_BANDEJA.map(f => (
        <button key={f.id} style={fila(filtros.filtro === f.id && !filtros.etapa)}
          onClick={() => setFiltros({ ...filtros, filtro: f.id, etapa: '' })}>
          {f.label}
          <span style={num}>{(counts as any)[f.id === 'no_leidas' ? 'no_leidas' : f.id] ?? ''}</span>
        </button>
      ))}

      <div style={seccion}>Ciclo de vida</div>
      {LIFECYCLE.filter(e => (counts.por_etapa?.[e.id] || 0) > 0 || filtros.etapa === e.id).map(e => (
        <button key={e.id} style={fila(filtros.etapa === e.id)}
          onClick={() => set('etapa', filtros.etapa === e.id ? '' : e.id)}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: e.fg, opacity: .55, flexShrink: 0 }} />
          {e.label}
          <span style={num}>{counts.por_etapa?.[e.id] || 0}</span>
        </button>
      ))}
      {!Object.keys(counts.por_etapa || {}).length && (
        <div style={{ padding: '4px 10px', fontSize: '0.68rem', color: '#b3b1bb' }}>Sin contactos ligados aún.</div>
      )}

      <div style={{ ...seccion, display: 'flex', alignItems: 'center', gap: 6 }}>
        Filtros
        {nFiltrosCliente > 0 && (
          <span style={{ background: '#9B8CFA', color: '#fff', borderRadius: 20, padding: '0 6px', fontSize: '0.58rem', fontWeight: 800 }}>{nFiltrosCliente}</span>
        )}
        {nFiltrosCliente > 0 && (
          <button onClick={() => setFiltros({ ...filtros, tipo: '', plan: '', etiqueta: '', asignado: '', estado: '', sin_contacto: '' })}
            style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#2C5FC4', fontSize: '0.62rem', fontWeight: 700, fontFamily: 'inherit', textTransform: 'none', letterSpacing: 0 }}>
            Limpiar
          </button>
        )}
      </div>
      <div style={{ padding: '2px 4px' }}>
        <select style={sel(!!filtros.tipo)} value={filtros.tipo} onChange={e => set('tipo', e.target.value)} aria-label="Tipo">
          <option value="">Tipo: todos</option>
          {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select style={sel(!!filtros.plan)} value={filtros.plan} onChange={e => set('plan', e.target.value)} aria-label="Plan">
          <option value="">Plan: todos</option>
          {PLANES.map(pl => <option key={pl.v} value={pl.v}>{pl.l}</option>)}
        </select>
        <select style={sel(!!filtros.etiqueta)} value={filtros.etiqueta} onChange={e => set('etiqueta', e.target.value)} aria-label="Etiqueta">
          <option value="">Etiqueta: todas</option>
          {(cat || []).map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select style={sel(!!filtros.asignado)} value={filtros.asignado} onChange={e => set('asignado', e.target.value)} aria-label="Asignado a">
          <option value="">Asignado: todos</option>
          <option value="nadie">Sin asignar</option>
          {equipo.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select style={sel(!!filtros.estado)} value={filtros.estado} onChange={e => set('estado', e.target.value)} aria-label="Estado">
          <option value="">Estado: todas</option>
          <option value="abierta">Abiertas</option>
          <option value="pendiente">Pendientes</option>
          <option value="resuelta">Resueltas</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 7px', fontSize: '0.73rem', color: filtros.sin_contacto ? '#5B4BD6' : '#555', fontWeight: filtros.sin_contacto ? 700 : 500, cursor: 'pointer' }}>
          <input type="checkbox" checked={filtros.sin_contacto === '1'}
            onChange={e => set('sin_contacto', e.target.checked ? '1' : '')} />
          Sin contacto en CRM
        </label>
      </div>

      <div style={seccion}>Vistas</div>
      {vistas.map(v => (
        <div key={v.id} style={{ display: 'flex', alignItems: 'center' }}>
          <button style={{ ...fila(vistaActiva?.id === v.id), flex: 1 }} onClick={() => aplicarVista(v)}>
            {v.nombre}
          </button>
          <button title="Borrar vista" onClick={() => borrarVista(v.id)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c9c7d1', fontSize: '0.72rem', padding: '0 6px' }}>✕</button>
        </div>
      ))}
      {hayFiltroActivo && !vistaActiva && (
        <button style={{ ...fila(false), color: '#2C5FC4', fontWeight: 700 }} disabled={guardando} onClick={guardarVista}>
          + Guardar esta vista
        </button>
      )}
      {!vistas.length && !hayFiltroActivo && (
        <div style={{ padding: '4px 10px', fontSize: '0.68rem', color: '#b3b1bb', lineHeight: 1.5 }}>
          Combina bandeja, etapa y filtros de cliente, y guárdalo como vista.
        </div>
      )}

      <button onClick={() => setAjustes(true)}
        style={{ ...fila(false), marginTop: 14, color: '#8a8a92' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2.8v3M12 18.2v3M21.2 12h-3M5.8 12h-3M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1M18.5 18.5l-2.1-2.1M7.6 7.6 5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        Automatización
      </button>
      {ajustes && <AjustesWA onClose={() => setAjustes(false)} />}
    </div>
  );
}
