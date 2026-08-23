// WHATSAPP · El sidebar del inbox (portado de sacs_inbox/InboxSidebar):
// bandejas fijas con border-l activo, ciclo de vida, GRUPOS de vistas custom
// con acciones que se revelan en hover, colapso a 64px y footer discreto.
import { useEffect, useMemo, useState } from 'react';
import { C, L, label } from './estilo';
import { IcoRayo, IcoInbox, IcoUsuario, IcoUsuarioMas, IcoBurbuja, IcoChevronIzq, IcoChevronDer, IcoOjo, IcoCalendario } from './Iconos';
import EtapasModal from './EtapasModal';
import { useLifecycle, cargarLifecycle } from '../../../../lib/crm/lifecycle';
import { catalogoCampos, type CampoFiltro } from '../../../../lib/whatsapp/filtros';
import { CrearSeccionModal, CrearVistaModal } from './VistaModales';
import { useCatalogoEtiquetas } from '../Etiquetas';
import AjustesWA from './AjustesWA';
import type { Filtros } from './InboxPro';

const BANDEJAS = [
  { id: 'accion', label: 'Requiere mi acción', Ico: IcoRayo },
  { id: 'todas', label: 'Todas', Ico: IcoInbox },
  { id: 'mias', label: 'Míos', Ico: IcoUsuario },
  { id: 'sin_asignar', label: 'Sin asignar', Ico: IcoUsuarioMas },
  { id: 'no_leidas', label: 'Sin respuesta', Ico: IcoBurbuja },
  { id: 'pospuestas', label: 'Pospuestas', Ico: IcoCalendario },
];

const fila = (activo: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  padding: '6px 12px', fontSize: 13, fontWeight: activo ? 700 : 500,
  background: activo ? C.moradoSuave : 'transparent',
  color: activo ? C.moradoTinta : C.g700,
  borderLeft: activo ? `2px solid ${C.morado}` : '2px solid transparent',
});
const num: React.CSSProperties = { marginLeft: 'auto', fontSize: 11, color: C.g400, fontVariantNumeric: 'tabular-nums' };

export function useCamposFiltro(equipo: any[]): CampoFiltro[] {
  const { cat } = useCatalogoEtiquetas();
  const etapasCat = useLifecycle();
  const [giros, setGiros] = useState<{ v: string; l: string }[]>([]);
  const [cierres, setCierres] = useState<{ v: string; l: string }[]>([]);
  useEffect(() => { fetch('/api/crm/whatsapp/cierre-categorias').then(r => r.json()).then(j => setCierres((j.categorias || []).map((c: any) => ({ v: c.nombre, l: c.nombre })))).catch(() => {}); }, []);
  useEffect(() => {
    fetch('/api/crm/propiedades?entidad=company').then(r => r.json()).then(j => {
      const g = (j.data || j.propiedades || []).find?.((p: any) => p.key === 'giro_negocio');
      if (g?.opciones) setGiros(g.opciones.map((o: any) => ({ v: o.v ?? o, l: o.l ?? o })));
    }).catch(() => {});
  }, []);
  return useMemo(() => catalogoCampos({
    etiquetas: (cat || []).map((e: any) => ({ v: e.id, l: e.nombre })),
    etapas: etapasCat.map(e => ({ v: e.id, l: e.label })),
    equipo: equipo.map((m: any) => ({ v: m.id, l: m.nombre })),
    giros, cierres,
    fuentes: [
      { v: 'web', l: 'Sitio web' }, { v: 'tiktok', l: 'TikTok Ads' }, { v: 'agenda', l: 'Agendador' },
      { v: 'whatsapp', l: 'WhatsApp' }, { v: 'referido', l: 'Referido' }, { v: 'import', l: 'Importado' },
    ],
  }), [cat, equipo, giros, cierres]);
}

export default function SidebarInbox({ counts, filtros, setFiltros, vistaActiva, onVista, equipo, yo, tick = 0, onGuardarVistaExterna }: {
  counts: any; filtros: Filtros; setFiltros: (f: Filtros) => void;
  vistaActiva: any; onVista: (v: any | null) => void; equipo: any[]; yo?: any; tick?: number;
  onGuardarVistaExterna?: (abrir: (cfg: any) => void) => void;
}) {
  const [subio, setSubio] = useState<Record<string, boolean>>({});
  const [colapsado, setColapsado] = useState(false);
  const [secciones, setSecciones] = useState<any[]>([]);
  const [vistas, setVistas] = useState<any[]>([]);
  const [contadores, setContadores] = useState<Record<string, number>>({});
  const [modalSeccion, setModalSeccion] = useState<any | 'nueva' | null>(null);
  const [modalVista, setModalVista] = useState<{ vista?: any; seccionId?: string | null; prefill?: any } | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const [gestorEtapas, setGestorEtapas] = useState(false);
  const [tabVistas, setTabVistas] = useState<'todas' | 'mias' | 'equipo'>('todas');
  const [menuVista, setMenuVista] = useState<string | null>(null);
  const etapas = useLifecycle();
  useEffect(() => { if (!menuVista) return; const c = () => setMenuVista(null); window.addEventListener('click', c); return () => window.removeEventListener('click', c); }, [menuVista]);
  const campos = useCamposFiltro(equipo);

  const cargar = () => {
    fetch('/api/crm/whatsapp/secciones').then(r => r.json()).then(j => setSecciones(j.secciones || [])).catch(() => {});
    fetch('/api/crm/vistas?tabla=wa_inbox').then(r => r.json()).then(j => setVistas(j.data || [])).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (tick > 0 && tick % 4 === 0) cargarLifecycle(true); }, [tick]);   // conteos de etapas cada ~1 min

  // Contadores por vista: en fila, sin tumbar el server. Se recalculan con
  // cada `tick` del polling (22) y la vista que SUBE se resalta 4 s.
  useEffect(() => {
    let vivo = true;
    (async () => {
      for (const v of vistas) {
        // Vistas v3 (sin condiciones) guardan filtros planos: se cuentan con su propio formato.
        let qs: string;
        if (v.config?.condiciones) qs = `vista=${encodeURIComponent(JSON.stringify(v.config))}`;
        else {
          const p = new URLSearchParams();
          for (const k of ['filtro', 'etapa', 'plan', 'tipo', 'estado', 'asignado', 'etiqueta', 'sin_contacto', 'search']) if (v.config?.[k]) p.set(k, String(v.config[k]));
          qs = p.toString();
        }
        const j = await fetch(`/api/crm/whatsapp/inbox?${qs}&limit=1`)
          .then(r => r.json()).catch(() => null);
        if (!vivo) return;
        if (j) setContadores(prev => {
          const n = j.total_filtrado ?? 0;
          if (prev[v.id] != null && n > prev[v.id]) { setSubio(s => ({ ...s, [v.id]: true })); setTimeout(() => setSubio(s => ({ ...s, [v.id]: false })), 4000); }
          return { ...prev, [v.id]: n };
        });
      }
    })();
    return () => { vivo = false; };
  }, [JSON.stringify(vistas.map(v => v.id)), tick]);
  // 27) "Guardar como vista" desde el modal de filtros avanzados.
  useEffect(() => { onGuardarVistaExterna?.((cfg: any) => setModalVista({ seccionId: null, prefill: cfg })); }, []);

  const bandeja = (id: string) => { onVista(null); setFiltros({ ...filtros, filtro: id, etapa: '' }); };
  const guardarSeccion = async (s: any) => {
    await fetch('/api/crm/whatsapp/secciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(() => {});
    setModalSeccion(null); cargar();
  };
  const guardarVista = async (v: { id?: string; nombre: string; config: any; compartida?: boolean; compartida_con?: string[] }) => {
    await fetch('/api/crm/vistas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id, tabla: 'wa_inbox', nombre: v.nombre, config: v.config, compartida: v.compartida !== false, compartida_con: v.compartida_con || [] }),
    }).catch(() => {});
    setModalVista(null); cargar();
  };
  // 23) orden manual: intercambia `orden` con la vecina.
  const mover = async (v: any, dir: -1 | 1, lista: any[]) => {
    const i = lista.findIndex(x => x.id === v.id); const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const a = lista[i], b = lista[j];
    const oa = a.orden ?? i, ob = b.orden ?? j;
    await Promise.all([
      fetch('/api/crm/vistas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, tabla: 'wa_inbox', nombre: a.nombre, config: a.config, orden: oa === ob ? (dir < 0 ? ob - 1 : ob + 1) : ob }) }),
      fetch('/api/crm/vistas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, tabla: 'wa_inbox', nombre: b.nombre, config: b.config, orden: oa === ob ? ob : oa }) }),
    ]).catch(() => {});
    cargar();
  };
  const borrarVista = async (id: string) => {
    await fetch('/api/crm/vistas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    if (vistaActiva?.id === id) onVista(null);
    cargar();
  };

  // Vistas viejas (v3, sin condiciones) se agrupan como "sin grupo" igual.
  const visibles = vistas.filter(v => v.compartida !== false || !yo || !v.owner_id || v.owner_id === yo.id || (v.compartida_con || []).includes(yo.id));
  const vistasDe = (seccionId: string | null) => visibles.filter(v => (v.config?.seccion_id || null) === seccionId);
  const dueno = (v: any) => !v.owner_id ? null : (yo && v.owner_id === yo.id) ? 'yo' : (equipo.find((m: any) => m.id === v.owner_id)?.nombre?.split(' ')[0] || null);

  if (colapsado) {
    return (
      <div style={{ width: L.sidebarColapsado, borderRight: `1px solid ${C.g200}`, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 2 }}>
        <button onClick={() => setColapsado(false)} title="Expandir" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 10, color: C.g400 }}><IcoChevronDer size={16} /></button>
        <span style={{ width: 32, height: 1, background: C.g200, margin: '4px 0' }} />
        {BANDEJAS.map(b => (
          <button key={b.id} title={b.label} onClick={() => bandeja(b.id)}
            style={{ border: 'none', cursor: 'pointer', padding: 10, borderRadius: 10, background: (!vistaActiva && filtros.filtro === b.id) ? C.moradoSuave : 'none', color: (!vistaActiva && filtros.filtro === b.id) ? C.moradoTinta : C.g400 }}>
            <b.Ico size={18} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: L.sidebar, borderRight: `1px solid ${C.g200}`, background: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ height: L.header, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
        <b style={{ fontSize: 17, letterSpacing: '-0.02em' }}>Inbox</b>
        <button onClick={() => setColapsado(true)} title="Colapsar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 4 }}><IcoChevronIzq size={15} /></button>
      </div>

      {BANDEJAS.map(b => (
        <button key={b.id} style={fila(!vistaActiva && filtros.filtro === b.id && !filtros.etapa)} onClick={() => bandeja(b.id)}>
          <b.Ico size={16} style={{ color: 'currentColor' }} />
          {b.label}
          <span style={num}>{(counts as any)[b.id === 'no_leidas' ? 'no_leidas' : b.id] ?? ''}</span>
        </button>
      ))}

      <div className="wa-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 12px 5px' }}>
          <span style={label(10)}>Ciclo de vida</span>
          <span style={{ marginLeft: 6, fontSize: 10, color: C.g300 }}>{etapas.reduce((a, e) => a + (e.n || 0), 0)}</span>
          <button onClick={() => setGestorEtapas(true)} title="Configurar etapas del ciclo de vida" aria-label="Configurar etapas"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2, display: 'inline-flex' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
        </div>
        {etapas.map(e => {
          const activaEtapa = vistaActiva?.id === `etapa:${e.id}`;
          return (
            <button key={e.id} style={fila(activaEtapa)}
              onClick={() => activaEtapa ? onVista(null) : onVista({ id: `etapa:${e.id}`, nombre: e.label, _etapa: e.id, config: { modo: 'todas', logica: 'AND', condiciones: [{ campo: 'etapa', op: 'es', valor: e.id }] } })}
              title={`${e.label}: ${e.n ?? 0} contactos (con o sin conversación)`}>
              <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{e.emoji}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
              <span style={num}>{e.n ?? counts.por_etapa?.[e.id] ?? 0}</span>
            </button>
          );
        })}

        {/* ── VISTAS: header fijo con acciones visibles + tabs Todas/Mías/Equipo ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '16px 12px 4px' }}>
          <IcoOjo size={13} style={{ color: C.g400 }} />
          <span style={label(10)}>Vistas</span>
          <span style={{ fontSize: 10, color: C.g300 }}>{visibles.length}</span>
          <button onClick={() => setModalVista({ seccionId: null })} title="Nueva vista"
            style={{ marginLeft: 'auto', border: 'none', background: C.moradoAgua, color: C.moradoTinta, borderRadius: 6, width: 20, height: 20, cursor: 'pointer', fontSize: 13, fontWeight: 800, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
        <div style={{ display: 'flex', gap: 2, padding: '2px 12px 6px' }}>
          {([['todas', 'Todas'], ['mias', 'Mías'], ['equipo', 'Del equipo']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTabVistas(v)}
              style={{ border: 'none', background: tabVistas === v ? C.g900 : 'transparent', color: tabVistas === v ? '#fff' : C.g400, borderRadius: 999, padding: '2px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          ))}
        </div>
        {[{ id: null, emoji: null, nombre: null } as any, ...secciones].map(sec => {
          const base = vistasDe(sec.id).filter(v =>
            tabVistas === 'todas' ? true : tabVistas === 'mias' ? (!v.owner_id || v.owner_id === yo?.id) : (v.owner_id && v.owner_id !== yo?.id));
          if (!base.length && sec.id !== null) return null;
          return (
            <div key={sec.id || 'base'}>
              {sec.id !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 2px' }}>
                  <span style={{ fontSize: 12 }}>{sec.emoji}</span>
                  <span style={label(10)}>{sec.nombre}</span>
                  <button onClick={() => setModalSeccion(sec)} title="Editar grupo" style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.g300, fontSize: 10, fontFamily: 'inherit' }}>editar</button>
                </div>
              )}
              {sec.id === null && !base.length && <div style={{ padding: '2px 12px 4px', fontSize: 11, color: C.g400 }}>{tabVistas === 'equipo' ? 'El equipo no ha compartido vistas.' : 'Crea tu primera vista con el botón +.'}</div>}
              {base.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <button style={{ ...fila(vistaActiva?.id === v.id), flex: 1, minWidth: 0 }}
                    onClick={() => onVista(vistaActiva?.id === v.id ? null : v)}
                    title={`${v.nombre}${v.config?.descripcion ? ` — ${v.config.descripcion}` : ''}`}>
                    <span style={{ fontSize: 13 }}>{v.config?.emoji || '⭐'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre}</span>
                    {v.compartida === false && !(v.compartida_con || []).length && <span title="Privada: solo tú la ves" style={{ display: 'inline-flex', flexShrink: 0, color: C.g400 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span>}
                    {(v.compartida_con || []).length > 0 && <span title={`Compartida con ${(v.compartida_con || []).length} personas`} style={{ fontSize: 9, fontWeight: 700, color: C.azulTinta, flexShrink: 0 }}>{(v.compartida_con || []).length}p</span>}
                    {dueno(v) && dueno(v) !== 'yo' && <span title={`Creada por ${dueno(v)}`} style={{ width: 14, height: 14, borderRadius: 999, background: C.g100, color: C.g500, fontSize: 8, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{dueno(v)![0]}</span>}
                    <span style={{ ...num, ...(subio[v.id] ? { background: C.moradoAgua, color: C.moradoTinta, fontWeight: 800 } : {}) }}>{contadores[v.id] ?? ''}</span>
                  </button>
                  <button onClick={e => { e.stopPropagation(); setMenuVista(menuVista === v.id ? null : v.id); }} title="Opciones de la vista" aria-label={`Opciones de ${v.nombre}`}
                    style={{ border: 'none', background: menuVista === v.id ? C.g100 : 'none', borderRadius: 6, cursor: 'pointer', color: C.g400, fontSize: 13, padding: '2px 6px', marginRight: 4 }}>⋯</button>
                  {menuVista === v.id && (
                    <div role="menu" onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 6, top: '90%', zIndex: 60, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.15)', width: 190, padding: 4 }}>
                      {[
                        ['Editar', () => { setMenuVista(null); setModalVista({ vista: v, seccionId: v.config?.seccion_id || null }); }],
                        ['Duplicar', async () => { setMenuVista(null); await guardarVista({ nombre: `${v.nombre} (copia)`, config: v.config, compartida: false }); }],
                        ['Subir', () => { setMenuVista(null); mover(v, -1, base); }],
                        ['Bajar', () => { setMenuVista(null); mover(v, 1, base); }],
                      ].map(([l, fn]: any) => (
                        <button key={l} onClick={fn} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 10px', fontSize: 12, color: C.g700, borderRadius: 6 }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>{l}</button>
                      ))}
                      <div style={{ borderTop: `1px solid ${C.g100}`, margin: '4px 0' }} />
                      <button onClick={() => { setMenuVista(null); if (confirm(`¿Borrar la vista "${v.nombre}"?`)) borrarVista(v.id); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 10px', fontSize: 12, color: C.rojo700, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.rojo50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Borrar…</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: `1px solid ${C.g100}`, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button onClick={() => setModalSeccion('nueva')}
          style={{ border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 11, color: C.g400, fontFamily: 'inherit', padding: '3px 0' }}>
          + nuevo grupo de vistas
        </button>
        <button onClick={() => setAjustes(true)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 11, color: C.g400, fontFamily: 'inherit', padding: '3px 0' }}>
          ⚙ Automatización
        </button>
      </div>

      {modalSeccion && (
        <CrearSeccionModal seccion={modalSeccion === 'nueva' ? undefined : modalSeccion}
          onGuardar={guardarSeccion} onClose={() => setModalSeccion(null)} />
      )}
      {modalVista && (
        <CrearVistaModal vista={modalVista.vista || null} seccionId={modalVista.seccionId} campos={campos} prefill={modalVista.prefill || null}
          equipo={equipo} onGuardar={guardarVista} onClose={() => setModalVista(null)} />
      )}
      {ajustes && <AjustesWA onClose={() => setAjustes(false)} />}
      {gestorEtapas && <EtapasModal onCerrar={() => { setGestorEtapas(false); cargarLifecycle(true); }} />}
    </div>
  );
}
