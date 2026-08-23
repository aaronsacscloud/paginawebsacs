// WHATSAPP · El sidebar del inbox (portado de sacs_inbox/InboxSidebar):
// bandejas fijas con border-l activo, ciclo de vida, GRUPOS de vistas custom
// con acciones que se revelan en hover, colapso a 64px y footer discreto.
import { useEffect, useMemo, useState } from 'react';
import { C, L, label } from './estilo';
import { IcoRayo, IcoInbox, IcoUsuario, IcoUsuarioMas, IcoBurbuja, IcoChevronIzq, IcoChevronDer, IcoOjo, IcoCalendario } from './Iconos';
import { LIFECYCLE } from '../../../../lib/crm/lifecycle';
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
  const campos = useCamposFiltro(equipo);

  const cargar = () => {
    fetch('/api/crm/whatsapp/secciones').then(r => r.json()).then(j => setSecciones(j.secciones || [])).catch(() => {});
    fetch('/api/crm/vistas?tabla=wa_inbox').then(r => r.json()).then(j => setVistas(j.data || [])).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);

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
  const guardarVista = async (v: { id?: string; nombre: string; config: any; compartida?: boolean }) => {
    await fetch('/api/crm/vistas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id, tabla: 'wa_inbox', nombre: v.nombre, config: v.config, compartida: v.compartida !== false }),
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
  const visibles = vistas.filter(v => v.compartida !== false || !yo || !v.owner_id || v.owner_id === yo.id);
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
        <div style={{ ...label(10), padding: '14px 12px 5px' }}>Ciclo de vida</div>
        {LIFECYCLE.filter(e => (counts.por_etapa?.[e.id] || 0) > 0 || filtros.etapa === e.id).map(e => (
          <button key={e.id} style={fila(!vistaActiva && filtros.etapa === e.id)}
            onClick={() => { onVista(null); setFiltros({ ...filtros, etapa: filtros.etapa === e.id ? '' : e.id }); }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: e.fg, opacity: .55, flexShrink: 0 }} />
            {e.label}
            <span style={num}>{counts.por_etapa?.[e.id] || 0}</span>
          </button>
        ))}

        {/* Grupos de vistas custom con acciones en hover */}
        {[{ id: null, emoji: '👁️', nombre: 'Vistas' } as any, ...secciones].map(sec => {
          const lista = vistasDe(sec.id);
          if (sec.id === null && !lista.length && secciones.length) return null;
          return (
            <div key={sec.id || 'base'} className="wa-grupo">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 12px 3px' }}>
                {sec.id === null ? <IcoOjo size={13} style={{ color: C.g400 }} /> : <span style={{ fontSize: 12 }}>{sec.emoji}</span>}
                <span style={label(10)}>{sec.nombre}</span>
              </div>
              <div className="wa-hover-reveal" style={{ display: 'flex', gap: 5, padding: '0 12px 4px' }}>
                {sec.id !== null && (
                  <button onClick={() => setModalSeccion(sec)}
                    style={{ fontSize: 10, fontWeight: 700, border: 'none', background: C.g100, color: C.g500, borderRadius: 999, padding: '2px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>editar</button>
                )}
                <button onClick={() => setModalVista({ seccionId: sec.id })}
                  style={{ fontSize: 10, fontWeight: 700, border: 'none', background: C.moradoAgua, color: C.moradoTinta, borderRadius: 999, padding: '2px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>+ vista</button>
              </div>
              {!lista.length && <div style={{ padding: '2px 12px 4px', fontSize: 11, color: C.g400 }}>Sin vistas en este grupo.</div>}
              {lista.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center' }} className="wa-grupo">
                  <button style={{ ...fila(vistaActiva?.id === v.id), flex: 1, minWidth: 0 }}
                    onClick={() => onVista(vistaActiva?.id === v.id ? null : v)}
                    onDoubleClick={() => setModalVista({ vista: v, seccionId: sec.id })}
                    title={`${v.nombre} · doble clic para editar`}>
                    <span style={{ fontSize: 13 }}>{v.config?.emoji || '⭐'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre}</span>
                    {v.compartida === false && <span title="Vista personal (solo tú la ves)" style={{ fontSize: 9, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '0 5px' }}>privada</span>}
                    {v.compartida !== false && dueno(v) && dueno(v) !== 'yo' && <span title={`Creada por ${dueno(v)}`} style={{ fontSize: 9, color: C.g400 }}>{dueno(v)}</span>}
                    {v.config?.modo === 'solo_contactos' && <span title="Solo contactos sin conversación" style={{ fontSize: 10 }}>📋</span>}
                    {v.config?.modo === 'todas' && <span title="Incluye contactos sin conversación" style={{ fontSize: 10 }}>👥</span>}
                    <span style={{ ...num, ...(subio[v.id] ? { background: C.moradoAgua, color: C.moradoTinta, fontWeight: 800 } : {}) }}>{contadores[v.id] ?? ''}</span>
                  </button>
                  <span className="wa-hover-reveal" style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: .8 }}>
                    <button title="Subir" onClick={() => mover(v, -1, lista)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g300, fontSize: 9, padding: 0 }}>▲</button>
                    <button title="Bajar" onClick={() => mover(v, 1, lista)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g300, fontSize: 9, padding: 0 }}>▼</button>
                  </span>
                  <button className="wa-hover-reveal" title="Borrar vista" onClick={() => borrarVista(v.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g300, fontSize: 11, padding: '0 8px 0 0' }}>✕</button>
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
          onGuardar={guardarVista} onClose={() => setModalVista(null)} />
      )}
      {ajustes && <AjustesWA onClose={() => setAjustes(false)} />}
    </div>
  );
}
