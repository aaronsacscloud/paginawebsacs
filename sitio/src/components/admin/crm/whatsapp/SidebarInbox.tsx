// WHATSAPP · El sidebar del inbox (portado de sacs_inbox/InboxSidebar):
// bandejas fijas con border-l activo, ciclo de vida, GRUPOS de vistas custom
// con acciones que se revelan en hover, colapso a 64px y footer discreto.
import { useEffect, useMemo, useRef, useState } from 'react';
import { C, L, label } from './estilo';
import { IcoRayo, IcoInbox, IcoUsuario, IcoUsuarioMas, IcoBurbuja, IcoChevronIzq, IcoChevronDer, IcoOjo, IcoCalendario } from './Iconos';
import EtapasModal from './EtapasModal';
import { useLifecycle, cargarLifecycle } from '../../../../lib/crm/lifecycle';
import { catalogoCampos, type CampoFiltro } from '../../../../lib/whatsapp/filtros';
import { CrearSeccionModal, CrearVistaModal } from './VistaModales';
import { useCatalogoEtiquetas } from '../Etiquetas';
import AjustesWA from './AjustesWA';
import type { Filtros } from './InboxPro';
import { confirmar } from '../../../../lib/ui/confirmar';

/* Al abrir el inbox se ven TRES bandejas, no ocho.
   Con las ocho —más diez etapas y dieciocho vistas— la primera pantalla eran
   treinta y seis renglones apretados, y treinta y seis opciones no son treinta
   y seis caminos: son ninguno. Estas tres son las que se usan a diario; el
   resto sigue a un clic de «Ver más», no escondido.
   Decisión del dueño (2-sep-2026). */
const BANDEJAS_SIEMPRE = ['todas', 'no_leidas', 'sin_respuesta'];

const BANDEJAS = [
  { id: 'accion', label: 'Requiere mi acción', Ico: IcoRayo },
  { id: 'todas', label: 'Todas', Ico: IcoInbox },
  { id: 'mias', label: 'Míos', Ico: IcoUsuario },
  { id: 'sin_asignar', label: 'Sin asignar', Ico: IcoUsuarioMas },
  // El nombre importa: «Sin respuesta» se leía como «no me contestaron», y
  // esta bandeja es la contraria — te escribieron y nadie respondió.
  { id: 'no_leidas', label: 'No contestadas', Ico: IcoBurbuja },
  { id: 'sin_respuesta', label: 'Sin respuesta de ellos', Ico: IcoBurbuja },
  { id: 'pospuestas', label: 'Pospuestas', Ico: IcoCalendario },
  // El filtro existía en el backend y NO había cómo llegar a él: sacabas una
  // conversación del inbox y no volvías a verla nunca, aunque el código sí
  // sabía devolverla. Esconder sin poder recuperar se siente como borrar.
  { id: 'internas', label: 'Fuera del inbox', Ico: IcoInbox },
];

const fila = (activo: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  /* Más aire: 6px hacía que doce renglones se leyeran como un bloque gris.
     Con 9px cada uno se distingue y la lista deja de parecer una tabla. */
  padding: '9px 12px', fontSize: 13.5, fontWeight: activo ? 700 : 500,
  background: activo ? C.moradoSuave : 'transparent',
  color: activo ? C.moradoTinta : C.g700,
  borderLeft: activo ? `2px solid ${C.morado}` : '2px solid transparent',
});
const num: React.CSSProperties = { marginLeft: 'auto', fontSize: 11, color: C.g400, fontVariantNumeric: 'tabular-nums' };

/** «Ver más (4)» / «Ver menos» — el mismo en las tres secciones. */
function VerMas({ abierto, n, onClick }: { abierto: boolean; n: number; onClick: () => void }) {
  if (!n) return null;
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', border: 'none', background: 'none',
        cursor: 'pointer', fontFamily: 'inherit', padding: '6px 12px 8px', fontSize: 11.5, fontWeight: 700, color: C.g400, textAlign: 'left' }}>
      <span style={{ display: 'inline-block', transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      {abierto ? 'Ver menos' : `Ver ${n} más`}
    </button>
  );
}

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
  /* Lo que llegó MIENTRAS mirabas. Los contadores de las bandejas ya estaban,
     pero en gris chiquito al final del renglón: un lead escribía y el número
     pasaba de 2 a 3 sin que nada lo dijera. Aquí se recuerda el valor anterior
     para poder marcar el que subió. */
  const previos = useRef<Record<string, number>>({});
  const [nuevos, setNuevos] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const sig: Record<string, boolean> = {};
    for (const b of BANDEJAS) {
      const n = Number((counts as any)[b.id] ?? 0);
      const antes = previos.current[b.id];
      if (antes != null && n > antes) sig[b.id] = true;
      previos.current[b.id] = n;
    }
    if (Object.keys(sig).length) {
      setNuevos(v => ({ ...v, ...sig }));
      /* Se apaga solo a los 12 s. No al abrir la bandeja: el aviso es «llegó
         algo», y eso sigue siendo cierto aunque no entres. Lo que sí lo baja
         es el propio contador, que llega a cero cuando ya contestaste. */
      const t = setTimeout(() => setNuevos(v => {
        const q = { ...v }; for (const k of Object.keys(sig)) delete q[k]; return q;
      }), 12000);
      return () => clearTimeout(t);
    }
  }, [counts]);
  /* Las tres secciones arrancan recogidas: la primera pantalla enseña lo que
     se usa, no todo lo que existe. */
  const [masBandejas, setMasBandejas] = useState(false);
  const [masEtapas, setMasEtapas] = useState(false);
  const [colapsado, setColapsado] = useState(false);
  const [secciones, setSecciones] = useState<any[]>([]);
  const [vistas, setVistas] = useState<any[]>([]);
  const [contadores, setContadores] = useState<Record<string, number>>({});
  const [modalSeccion, setModalSeccion] = useState<any | 'nueva' | null>(null);
  const [modalVista, setModalVista] = useState<{ vista?: any; seccionId?: string | null; prefill?: any } | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const [gestorEtapas, setGestorEtapas] = useState(false);
  const [tabVistas, setTabVistas] = useState<'todas' | 'mias' | 'equipo'>('todas');
  const [menuVista, setMenuVista] = useState<{ vista: any; lista: any[] } | null>(null);
  const etapas = useLifecycle();

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
      // Los contadores de TODAS las vistas van en UNA sola petición.
      // Antes era este mismo bucle pero con un fetch adentro: una llamada por
      // vista, en serie, cada una reconstruyendo el universo entero del inbox
      // (1000 conversaciones + 1000 correos + 600 contactos + 2000 visitas)
      // para devolver un entero. Medido al entrar: 25 peticiones, 7.7 s.
      if (!vistas.length) return;
      const defs = vistas.map(v => ({ id: v.id, config: v.config || {} }));
      const j = await fetch(`/api/crm/whatsapp/inbox?vistas=${encodeURIComponent(JSON.stringify(defs))}`)
        .then(r => r.json()).catch(() => null);
      if (!vivo || !j?.contadores) return;
      setContadores(prev => {
        const sig = { ...prev };
        for (const v of vistas) {
          const n = j.contadores[v.id] ?? 0;
          if (prev[v.id] != null && n > prev[v.id]) { setSubio(s => ({ ...s, [v.id]: true })); setTimeout(() => setSubio(s => ({ ...s, [v.id]: false })), 4000); }
          sig[v.id] = n;
        }
        return sig;
      });
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

      {BANDEJAS
        /* La bandeja ACTIVA se enseña siempre, aunque esté en las escondidas:
           si no, eliges «Pospuestas» y el renglón que estás usando desaparece. */
        .filter(b => masBandejas || BANDEJAS_SIEMPRE.includes(b.id) || (!vistaActiva && filtros.filtro === b.id))
        .map(b => {
        const n = Number((counts as any)[b.id] ?? 0);
        /* Estas dos son trabajo SIN ATENDER: alguien escribió y nadie
           contestó. Su número va en pastilla morada, como una notificación, no
           en el gris de un dato más. Las otras bandejas son formas de mirar la
           misma lista y su cuenta no pide nada. */
        const pendiente = ['no_leidas', 'accion'].includes(b.id) && n > 0;
        return (
        <button key={b.id} style={fila(!vistaActiva && filtros.filtro === b.id && !filtros.etapa)} onClick={() => bandeja(b.id)}>
          <b.Ico size={16} style={{ color: 'currentColor' }} />
          {b.label}
          {/* El punto que late: acaba de llegar algo, ahora, mientras mirabas. */}
          {nuevos[b.id] && <span className="wa-pulso" style={{ width: 7, height: 7, borderRadius: 999, background: C.morado, flexShrink: 0 }} />}
          <span style={pendiente
            ? { ...num, background: C.morado, color: '#fff', fontWeight: 800, borderRadius: 999, padding: '1px 8px', fontSize: 10.5 }
            : num}>{(counts as any)[b.id] ?? ''}</span>
        </button>
        );
      })}
      <VerMas abierto={masBandejas} n={BANDEJAS.filter(b => !BANDEJAS_SIEMPRE.includes(b.id)).length}
        onClick={() => setMasBandejas(v => !v)} />

      <div className="wa-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 12px 5px' }}>
          <span style={label(10)}>Ciclo de vida</span>
          <span style={{ marginLeft: 6, fontSize: 10, color: C.g300 }}>{etapas.reduce((a, e) => a + (e.n || 0), 0)}</span>
          <button onClick={() => setGestorEtapas(true)} title="Configurar etapas del ciclo de vida" aria-label="Configurar etapas"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2, display: 'inline-flex' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
        </div>
        {(() => {
          /* Hasta «Cliente» y ya: de ahí para abajo son etapas de salida
             —perdido, descalificado, rezagado— que se consultan, no se
             vigilan. La activa se enseña siempre aunque esté abajo. */
          const corte = etapas.findIndex(e => e.id === 'cliente');
          const visiblesN = corte >= 0 ? corte + 1 : etapas.length;
          return etapas.filter((e, i) => masEtapas || i < visiblesN || vistaActiva?.id === `etapa:${e.id}`);
        })().map(e => {
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

        {(() => {
          const corte = etapas.findIndex(e => e.id === 'cliente');
          const ocultas = corte >= 0 ? etapas.length - (corte + 1) : 0;
          return <VerMas abierto={masEtapas} n={ocultas} onClick={() => setMasEtapas(v => !v)} />;
        })()}

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
        {/* Las vistas viven en su PROPIA caja con scroll: son dieciocho y, en
            fila con las bandejas y las etapas, empujaban todo lo demás fuera de
            la pantalla. Se ven tres —y un pedazo de la cuarta, para que se note
            que hay más— y el resto se alcanza rodando aquí dentro. */}
        <div className="wa-scroll" style={{ maxHeight: 152, overflowY: 'auto' }}>
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
                  <button onClick={e => { e.stopPropagation(); setMenuVista({ vista: v, lista: base }); }} title="Opciones de la vista" aria-label={`Opciones de ${v.nombre}`}
                    style={{ border: 'none', background: 'none', borderRadius: 6, cursor: 'pointer', color: C.g400, fontSize: 13, padding: '2px 6px', marginRight: 4 }}>⋯</button>
                </div>
              ))}
            </div>
          );
        })}
        </div>
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
      {menuVista && (() => {
        const v = menuVista.vista; const cerrar = () => setMenuVista(null);
        const opcion = (titulo: string, sub: string, onClick: () => void, rojo = false) => (
          <button key={titulo} onClick={onClick}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 14px', borderRadius: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = rojo ? C.rojo50 : C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <b style={{ fontSize: 13, color: rojo ? C.rojo700 : C.g900 }}>{titulo}</b>
            <span style={{ fontSize: 11, color: C.g400 }}>{sub}</span>
          </button>
        );
        return (
          <div role="dialog" onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(400px, 94vw)', boxShadow: '0 24px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${C.g100}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{v.config?.emoji || '⭐'}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b style={{ fontSize: 14, display: 'block' }}>{v.nombre}</b>
                  <span style={{ fontSize: 11, color: C.g400, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.config?.descripcion || `${contadores[v.id] ?? '—'} contactos · ${v.compartida === false && !(v.compartida_con || []).length ? 'privada' : (v.compartida_con || []).length ? 'compartida con elegidos' : 'del equipo'}`}</span>
                </span>
                <button onClick={cerrar} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, fontSize: 15 }}>✕</button>
              </div>
              <div style={{ padding: 6 }}>
                {opcion('Editar', 'Nombre, filtros, con quién se comparte', () => { cerrar(); setModalVista({ vista: v, seccionId: v.config?.seccion_id || null }); })}
                {opcion('Duplicar', 'Crea una copia privada para ajustarla', async () => { cerrar(); await guardarVista({ nombre: `${v.nombre} (copia)`, config: v.config, compartida: false }); })}
                {opcion('Subir', 'Un lugar arriba en la lista', () => { cerrar(); mover(v, -1, menuVista.lista); })}
                {opcion('Bajar', 'Un lugar abajo en la lista', () => { cerrar(); mover(v, 1, menuVista.lista); })}
                <div style={{ borderTop: `1px solid ${C.g100}`, margin: '4px 8px' }} />
                {opcion('Borrar vista', 'No borra contactos ni conversaciones', async () => { cerrar(); if (await confirmar(`¿Borrar la vista "${v.nombre}"?`)) borrarVista(v.id); }, true)}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
