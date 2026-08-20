// OUTBOUND · Campañas in-app dentro de SACS3.
//
// Misma gramática visual que el resto del CRM (paleta M de RevenueHub,
// semántica de estados de email/Campanas, lista sobre TablaEnterprise, editor
// split-view con preview en vivo como el drawer de cotizaciones). El diseño
// pasó por auditoría de UI contra el código real — no inventar tonos nuevos:
// verde/rojo SOLO para dinero o estados consumados/malos.
import { useEffect, useMemo, useRef, useState } from 'react';
import TablaEnterprise, { type ColDef, type VistaDef } from '../TablaEnterprise';
import Sheet from '../ui/Sheet';
import ActionSheet from '../ui/ActionSheet';
import Cargando from '../ui/Cargando';
import { useToast, Toast } from '../crmHelpers';
import { useIsMobile } from '../../../../lib/ui/mobile';
import { S, chip, Tag, Aviso, Vacio, fmtFecha } from '../email/ui';

// ── Estados: MISMA semántica que Email marketing (ESTADO_TONO) ──────────────
const ESTADO_BADGE: Record<string, { l: string; bg: string; fg: string; dot: string }> = {
  borrador: { l: 'Borrador', bg: '#F4F4F6', fg: '#6B7280', dot: '#C9C7D0' },
  programada: { l: 'Programada', bg: '#E3EDFD', fg: '#2C5FC4', dot: '#7DA6F5' },
  activa: { l: 'Activa', bg: '#EEECFE', fg: '#5B4BD6', dot: '#9B8CFA' },
  pausada: { l: 'Pausada', bg: '#FFF6E3', fg: '#9A6B15', dot: '#E9B949' },
  terminada: { l: 'Terminada', bg: '#EAF8F2', fg: '#1E8A63', dot: '#4FBF95' },
  archivada: { l: 'Archivada', bg: '#F4F4F6', fg: '#6B7280', dot: '#C9C7D0' },
};

/** Estado VISUAL: una activa cuya vigencia aún no llega se lee "Programada"
 *  (mismo truco que estadoVisual() de cotizaciones — derivado, no persistido). */
function estadoVisual(c: any): string {
  if (c.estado === 'activa' && c.vigencia_desde && new Date(c.vigencia_desde) > new Date()) return 'programada';
  return c.estado;
}

function BadgeEstado({ c }: { c: any }) {
  const e = ESTADO_BADGE[estadoVisual(c)] || ESTADO_BADGE.borrador;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: e.bg, color: e.fg, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.dot }} />{e.l}
    </span>
  );
}

// KPI con franja lateral de 3px — calcado de ClientesTab.KpiCard.
function KpiCard({ titulo, valor, sub, franja = '#9B8CFA', color }: { titulo: string; valor: any; sub?: string; franja?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${franja}`, padding: '14px 16px', borderRadius: 10 }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{titulo}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums', color: color || '#1a1a1a' }}>{valor}</div>
      {sub && <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

const FMT_CORTO: Record<string, string> = {
  banner_superior: 'Banner superior', banner_cuadrado: 'Banner cuadrado', modal: 'Modal',
  chat: 'Abrir chat', tarjeta_inicio: 'Tarjeta en inicio', badge_menu: 'Badge en menú',
  encuesta: 'Encuesta 1 clic', coachmark: 'Coachmark', agenda: 'Agendar cita',
};

function resumenAudiencia(c: any): string {
  const g = c.audiencia?.grupos || [];
  const conds = g.flatMap((x: any) => x.condiciones || []);
  const partes: string[] = [];
  if (!conds.length) partes.push('Todas las cuentas');
  else partes.push(conds.slice(0, 2).map((x: any) => `${x.campo.replace(/_/g, ' ')} ${x.operador.replace(/_/g, ' ')} ${x.valor ?? ''}`).join(' · '));
  const nivel = c.nivel || {};
  if (nivel.tipo === 'grupos') partes.push('solo ciertos roles');
  if (nivel.tipo === 'uids') partes.push(`${(nivel.uids || []).length} usuarios`);
  return partes.join(' · ');
}

// ═══════════════════════ PREVIEW (simulador de SACS3) ═══════════════════════

function PreviewSacs3({ c }: { c: any }) {
  const [dev, setDev] = useState<'desktop' | 'movil'>('desktop');
  const ct = c.contenido || {};
  const botones = (ct.botones || []).filter((b: any) => b.texto);
  const movil = dev === 'movil';

  const cuerpoModal = (
    <div style={{ background: '#fff', borderRadius: 14, maxWidth: movil ? 230 : 320, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
      {ct.imagen && <div style={{ height: movil ? 70 : 110, background: 'linear-gradient(135deg,#4536BE,#7DA6F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.7rem' }}>[ imagen ]</div>}
      <div style={{ padding: movil ? '12px 14px' : '16px 18px' }}>
        <div style={{ fontWeight: 800, fontSize: movil ? '0.8rem' : '0.95rem', marginBottom: 6 }}>{ct.titulo || 'Título del mensaje'}</div>
        <div style={{ fontSize: movil ? '0.66rem' : '0.75rem', color: '#666', lineHeight: 1.5, marginBottom: 12 }}>{ct.mensaje || 'El mensaje que verá el cliente.'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {botones.map((b: any, i: number) => i === 0
            ? <span key={i} style={{ background: '#9B8CFA', color: '#fff', borderRadius: 99, padding: '7px 14px', fontSize: '0.68rem', fontWeight: 800 }}>{b.texto}</span>
            : <span key={i} style={{ background: '#fff', color: '#2C5FC4', border: '1.5px solid #7DA6F5', borderRadius: 99, padding: '7px 12px', fontSize: '0.68rem', fontWeight: 700 }}>{b.texto}</span>)}
        </div>
      </div>
      {c.comportamiento?.cerrable !== false && <div style={{ textAlign: 'center', fontSize: '0.64rem', color: '#9c99a6', fontWeight: 600, paddingBottom: 10 }}>Ahora no · No me interesa</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.1em' }}>Vista previa · así se verá en SACS</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={chip(dev === 'desktop')} onClick={() => setDev('desktop')}>Escritorio</button>
          <button style={chip(movil)} onClick={() => setDev('movil')}>Móvil</button>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #dfe1e7', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,.06)', maxWidth: movil ? 300 : '100%', margin: movil ? '0 auto' : undefined }}>
        <div style={{ height: 30, background: '#1A1A2E', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#3a3a55' }} />)}
        </div>
        <div style={{ display: 'flex', minHeight: 280, position: 'relative' }}>
          {!movil && <div style={{ width: 80, background: '#20203a', padding: '10px 8px' }}>
            {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ height: 7, borderRadius: 4, background: '#34345277', margin: '9px 4px', position: 'relative' }}>
              {c.formato === 'badge_menu' && i === 2 && <span style={{ position: 'absolute', right: -4, top: -4, fontSize: '0.42rem', fontWeight: 800, background: '#9B8CFA', color: '#fff', borderRadius: 6, padding: '1px 4px' }}>NUEVO</span>}
            </div>)}
          </div>}
          <div style={{ flex: 1, background: '#f5f6f8', padding: 12, position: 'relative' }}>
            {c.formato === 'banner_superior' && (
              <div style={{ margin: '-12px -12px 10px', background: '#4536BE', color: '#fff', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.68rem', fontWeight: 700 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ct.titulo || 'Aviso'}{ct.mensaje ? ` — ${ct.mensaje}` : ''}</span>
                {botones[0] && <span style={{ background: '#fff', color: '#4536BE', borderRadius: 99, padding: '3px 10px', fontSize: '0.6rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{botones[0].texto}</span>}
                {c.comportamiento?.cerrable !== false && <span style={{ opacity: .75 }}>✕</span>}
              </div>
            )}
            <div style={{ height: 10, width: '40%', borderRadius: 5, background: '#e3e4ea', margin: '6px 0 12px' }} />
            {c.formato === 'tarjeta_inicio' && (
              <div style={{ background: '#fff', border: '1.5px solid #d9d2fb', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800 }}>{ct.titulo || 'Título'}</div>
                <div style={{ fontSize: '0.64rem', color: '#666', margin: '3px 0 8px' }}>{ct.mensaje || 'Mensaje'}</div>
                {botones[0] && <span style={{ background: '#9B8CFA', color: '#fff', borderRadius: 99, padding: '4px 10px', fontSize: '0.6rem', fontWeight: 800 }}>{botones[0].texto}</span>}
              </div>
            )}
            <div style={{ height: 46, borderRadius: 9, background: '#fff', border: '1px solid #ececec', marginBottom: 8 }} />
            <div style={{ height: 46, borderRadius: 9, background: '#fff', border: '1px solid #ececec', width: '70%' }} />
            {c.formato === 'agenda' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,25,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
                <div style={{ background: '#fff', borderRadius: 14, width: 300, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ flex: 1, fontSize: '0.72rem', fontWeight: 800 }}>{ct.titulo || 'Agenda tu sesión'}</span>
                    <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>✕</span>
                  </div>
                  <div style={{ padding: 12, background: '#FAFBFF' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                      {Array.from({ length: 21 }, (_, i) => (
                        <span key={i} style={{ height: 20, borderRadius: 5, background: [4, 9, 12, 16].includes(i) ? '#9B8CFA' : '#fff', border: '1px solid #edeaf9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 700, color: [4, 9, 12, 16].includes(i) ? '#fff' : '#9c99a6' }}>{i + 1}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: '#9c99a6', fontWeight: 700, marginTop: 8, textAlign: 'center' }}>{ct.agenda_slug ? 'Tipo de reunión: ' + ct.agenda_slug : 'Calendario interactivo del agendador'}</div>
                  </div>
                </div>
              </div>
            )}
            {(c.formato === 'modal' || c.formato === 'encuesta') && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,25,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
                {c.formato === 'modal' ? cuerpoModal : (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: 10 }}>{ct.titulo || '¿Qué tan probable es que nos recomiendes?'}</div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {(c.contenido?.encuesta?.escala === 'nps'
                        ? Array.from({ length: 11 }, (_, i) => i)
                        : Array.from({ length: 5 }, (_, i) => i + 1)
                      ).map(n => <span key={n} style={{ width: c.contenido?.encuesta?.escala === 'nps' ? 20 : 26, height: 24, borderRadius: 6, border: '1.5px solid #d9d2fb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#5B4BD6' }}>{n}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
            {(c.formato === 'banner_cuadrado' || c.formato === 'coachmark') && (
              <div style={{ position: 'absolute', right: 10, bottom: 10, width: 168, background: '#fff', borderRadius: 12, boxShadow: '0 14px 40px rgba(0,0,0,.18)', overflow: 'hidden' }}>
                {ct.imagen && <div style={{ height: 54, background: 'linear-gradient(135deg,#4536BE,#7DA6F5)' }} />}
                <div style={{ padding: '9px 11px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800 }}>{ct.titulo || 'Título'}</div>
                  <div style={{ fontSize: '0.6rem', color: '#666', margin: '2px 0 7px' }}>{(ct.mensaje || 'Mensaje').slice(0, 60)}</div>
                  {botones[0] && <span style={{ background: '#9B8CFA', color: '#fff', borderRadius: 99, padding: '3px 9px', fontSize: '0.56rem', fontWeight: 800 }}>{botones[0].texto}</span>}
                </div>
              </div>
            )}
            {c.formato === 'chat' && (
              <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ background: '#fff', borderRadius: '12px 12px 2px 12px', boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: '8px 11px', fontSize: '0.62rem', color: '#333', maxWidth: 150 }}>{ct.mensaje || 'Hola 👋 ¿te ayudo a…?'}</div>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#9B8CFA', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>S</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.66rem', color: '#9c99a6', marginTop: 8, fontWeight: 600 }}>El preview simula. Antes de activar, «Enviar prueba» renderiza la campaña real en la cuenta interna.</div>
    </div>
  );
}

// ═══════════════════════ EDITOR (wizard con preview) ════════════════════════

const PASOS = ['Audiencia', 'Formato y diseño', 'Comportamiento', 'Revisión'] as const;

function Editor({ inicial, catalogo, onClose, onSaved, show }: { inicial: any; catalogo: any; onClose: () => void; onSaved: () => void; show: (m: string, k?: any) => void }) {
  const isMobile = useIsMobile();
  const [c, setC] = useState<any>(inicial);
  const [paso, setPaso] = useState(0);
  const [rev, setRev] = useState<any>(null);
  const [cargandoRev, setCargandoRev] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmaActivar, setConfirmaActivar] = useState(false);
  const [iaOcupada, setIaOcupada] = useState(false);
  const [iaOpciones, setIaOpciones] = useState<any[] | null>(null);
  const [iaIndice, setIaIndice] = useState(0);
  const [pasos, setPasos] = useState<any[]>([]);
  const [audGuardadas, setAudGuardadas] = useState<any[]>([]);
  const [audNombre, setAudNombre] = useState('');
  const [emailCamps, setEmailCamps] = useState<any[]>([]);
  useEffect(() => {
    let vivoE = true;
    if (inicial.id) {
      fetch(`/api/crm/outbound/campanas?id=${inicial.id}`).then(r => r.json())
        .then(j => { if (vivoE && Array.isArray(j.pasos)) setPasos(j.pasos); }).catch(() => { /* sin pasos */ });
    }
    fetch('/api/crm/outbound/audiencias').then(r => r.json())
      .then(j => { if (vivoE) setAudGuardadas(j.data || []); }).catch(() => { /* opcional */ });
    fetch('/api/crm/email/campaigns').then(r => r.json())
      .then(j => { if (vivoE) setEmailCamps((j.campanas || []).filter((x: any) => x.estado === 'borrador')); })
      .catch(() => { /* sin email configurado: el select queda vacío */ });
    return () => { vivoE = false; };
  }, [inicial.id]);
  // Cerrar el editor con un fetch en vuelo no debe disparar setState sobre un
  // componente desmontado (ni perder de vista una creación que resolvió tarde).
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);
  const set = (patch: any) => setC((prev: any) => ({ ...prev, ...patch }));
  const setCt = (patch: any) => set({ contenido: { ...(c.contenido || {}), ...patch } });
  const setComp = (patch: any) => set({ comportamiento: { ...(c.comportamiento || {}), ...patch } });

  async function guardar(): Promise<{ campana: any; aviso?: string } | null> {
    if (guardando) return null; // dos clics rápidos creaban DOS campañas
    setGuardando(true);
    try {
      const esNueva = !c.id;
      const r = await fetch(esNueva ? '/api/crm/outbound/campanas' : `/api/crm/outbound/campanas?id=${c.id}`, {
        method: esNueva ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esNueva ? c : { ...c, pasos }),
      });
      const j = await r.json();
      if (!vivo.current) return null;
      if (!r.ok || j.error) {
        show(j.error || 'No se pudo guardar', 'error');
        if (j.errores) setRev((prev: any) => ({ ...(prev || {}), errores: j.errores }));
        return null;
      }
      if (j.aviso) show(j.aviso, 'info');
      set({ id: j.campana.id, estado: j.campana.estado });
      return { campana: j.campana, aviso: j.aviso };
    } catch { if (vivo.current) show('Sin conexión — revisa tu internet', 'error'); return null; }
    finally { if (vivo.current) setGuardando(false); }
  }

  async function revisar() {
    if (guardando || cargandoRev) return; // anti doble disparo (chips + botones)
    const g = await guardar(); if (!g) return;
    setCargandoRev(true); setRev(null);
    try {
      const r = await fetch(`/api/crm/outbound/campanas?id=${g.campana.id}&accion=revisar`, { method: 'POST' });
      const j = await r.json();
      if (vivo.current) setRev(j);
    } catch { if (vivo.current) show('No se pudo revisar', 'error'); }
    finally { if (vivo.current) setCargandoRev(false); }
  }

  async function accion(a: string, body?: any) {
    const idCampana = c.id || (await guardar())?.campana?.id;
    if (!idCampana) return;
    try {
      const r = await fetch(`/api/crm/outbound/campanas?id=${idCampana}&accion=${a}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!vivo.current) return;
      if (!r.ok || j.error) { show(j.error || 'No se pudo', 'error'); if (j.errores) setRev((prev: any) => ({ ...(prev || {}), errores: j.errores })); return; }
      if (a === 'activar') { show(`Campaña activa para ${j.cuentas} cuentas`); onSaved(); onClose(); }
      if (a === 'prueba') show(`Prueba publicada en ${j.cuenta} — entra a SACS con esa cuenta para verla`, 'info');
    } catch { if (vivo.current) show('Sin conexión', 'error'); }
  }

  const cond0 = (c.audiencia?.grupos?.[0]?.condiciones) || [];
  const setConds = (conds: any[]) => set({ audiencia: { ...(c.audiencia || {}), grupos: [{ condiciones: conds }] } });
  const nivel = c.nivel || { tipo: 'todos' };

  const inputS = { ...S.inp } as any;
  const lblS = { display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '16px 0 5px' };

  const campoCat = (id: string) => (catalogo?.audiencia || []).find((x: any) => x.id === id);

  const form = (
    <div style={{ width: isMobile ? '100%' : 640, flexShrink: 0, background: '#fff', borderRight: isMobile ? 'none' : '1px solid #eee', padding: 24, overflowY: 'auto' }}>
      {paso === 0 && (<>
        <span style={{ ...lblS as any, marginTop: 0 }}>Audiencias guardadas</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 8 }}>
          <select style={inputS} value="" onChange={e => {
            const a = audGuardadas.find((x: any) => x.id === e.target.value);
            if (a) { set({ audiencia: a.definicion || { grupos: [] }, ...(a.nivel ? { nivel: a.nivel } : {}) }); show(`Audiencia "${a.nombre}" cargada`, 'info'); }
          }}>
            <option value="">{audGuardadas.length ? 'Cargar una audiencia guardada…' : 'Sin audiencias guardadas aún'}</option>
            {audGuardadas.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <input style={inputS} placeholder="Nombre para guardar la actual" value={audNombre} onChange={e => setAudNombre(e.target.value)} />
          <button style={S.btnG} disabled={!audNombre.trim()} onClick={async () => {
            try {
              const r = await fetch('/api/crm/outbound/audiencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: audNombre.trim(), definicion: c.audiencia || {}, nivel: c.nivel || null }) });
              const j = await r.json();
              if (j.error) { show(j.error, 'error'); return; }
              setAudGuardadas([...audGuardadas, j.audiencia]); setAudNombre('');
              show('Audiencia guardada — reutilizable en cualquier campaña');
            } catch { show('Sin conexión', 'error'); }
          }}>Guardar</button>
        </div>
        <span style={lblS as any}>Condiciones (las cumplen TODAS las cuentas alcanzadas; sin condiciones = todas)</span>
        {cond0.map((cd: any, i: number) => {
          const cat = campoCat(cd.campo);
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.2fr auto', gap: 8, marginBottom: 8 }}>
              <select style={inputS} value={cd.campo} onChange={e => { const n = [...cond0]; n[i] = { campo: e.target.value, operador: 'es', valor: '' }; setConds(n); }}>
                {(catalogo?.audiencia || []).map((f: any) => <option key={f.id} value={f.id}>{f.etiqueta}</option>)}
              </select>
              <select style={inputS} value={cd.operador} onChange={e => { const n = [...cond0]; n[i] = { ...cd, operador: e.target.value }; setConds(n); }}>
                {(cat?.operadores || ['es']).map((o: string) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
              {cat?.tipo === 'opciones' ? (
                <select style={inputS} value={cd.valor ?? ''} onChange={e => { const n = [...cond0]; n[i] = { ...cd, valor: e.target.value }; setConds(n); }}>
                  <option value="">—</option>
                  {(cat.opciones || []).map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ) : cat?.tipo === 'modulo' ? (
                <select style={inputS} value={cd.valor ?? ''} onChange={e => { const n = [...cond0]; n[i] = { ...cd, valor: e.target.value }; setConds(n); }}>
                  <option value="">—</option>
                  {(catalogo?.modulos_puente || []).map((m: string) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input style={inputS} type={cat?.tipo === 'numero' ? 'number' : 'text'} value={cd.valor ?? ''} onChange={e => { const n = [...cond0]; n[i] = { ...cd, valor: cat?.tipo === 'numero' ? Number(e.target.value) : e.target.value }; setConds(n); }} />
              )}
              <button style={{ ...S.btnG, padding: '7px 10px' }} onClick={() => setConds(cond0.filter((_: any, j: number) => j !== i))}>✕</button>
            </div>
          );
        })}
        <button style={S.btnG} onClick={() => setConds([...cond0, { campo: 'plan', operador: 'es', valor: '' }])}>+ Agregar condición</button>

        <span style={lblS as any}>A quién dentro de cada cuenta</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={chip(nivel.tipo === 'todos')} onClick={() => set({ nivel: { tipo: 'todos' } })}>Todos los usuarios</button>
          <button style={chip(nivel.tipo === 'grupos')} onClick={() => set({ nivel: { tipo: 'grupos', grupos: [catalogo?.grupo_super_admin] } })}>Solo Super Admin (dueños)</button>
          <button style={chip(nivel.tipo === 'uids')} onClick={() => set({ nivel: { tipo: 'uids', uids: [] } })}>Usuarios específicos</button>
        </div>
        {nivel.tipo === 'uids' && (<>
          <span style={lblS as any}>UIDs (uno por línea — de la ficha del cliente → Usuarios SACS)</span>
          <textarea style={{ ...inputS, minHeight: 70 }} value={(nivel.uids || []).join('\n')}
            onChange={e => set({ nivel: { tipo: 'uids', uids: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) } })} />
        </>)}
        <span style={lblS as any}>Incluir cuentas a mano (opcional, separadas por coma — pilotos/beta)</span>
        <input style={inputS} value={(c.audiencia?.incluir_cuentas || []).join(', ')}
          onChange={e => set({ audiencia: { ...(c.audiencia || {}), incluir_cuentas: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) } })} />
        <span style={lblS as any}>Excluir cuentas (opcional)</span>
        <input style={inputS} value={(c.audiencia?.excluir_cuentas || []).join(', ')}
          onChange={e => set({ audiencia: { ...(c.audiencia || {}), excluir_cuentas: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) } })} />
      </>)}

      {paso === 1 && (<>
        <span style={{ ...lblS as any, marginTop: 0 }}>Formato</span>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
          {(catalogo?.formatos || []).map((f: any) => (
            <div key={f.id} onClick={() => set(f.id === 'encuesta' && !c.contenido?.encuesta ? { formato: f.id, contenido: { ...(c.contenido || {}), encuesta: { escala: 'nps' } } } : { formato: f.id })}
              style={{ border: `1.5px solid ${c.formato === f.id ? '#9B8CFA' : '#e2e4e9'}`, borderRadius: 12, padding: 12, background: c.formato === f.id ? '#fdfcff' : '#fff', cursor: 'pointer', boxShadow: c.formato === f.id ? '0 0 0 3px rgba(155,140,250,.14)' : 'none' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>{f.etiqueta}</div>
              <div style={{ fontSize: '0.66rem', color: '#9c99a6', fontWeight: 600, marginTop: 2 }}>{f.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
          <span style={{ ...lblS as any, margin: 0, flex: 1 }}>Título</span>
          <button style={{ ...S.btnA, opacity: iaOcupada ? 0.6 : 1 }} disabled={iaOcupada}
            onClick={async () => {
              if (iaOcupada) return;
              if (iaOpciones && iaOpciones.length > 1) {
                const sig = (iaIndice + 1) % iaOpciones.length;
                setIaIndice(sig); setCt({ titulo: iaOpciones[sig].titulo, mensaje: iaOpciones[sig].mensaje, botones: iaOpciones[sig].botones });
                return;
              }
              setIaOcupada(true);
              try {
                const r = await fetch('/api/crm/outbound/redactar', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ objetivo: c.objetivo_texto || c.nombre || '', formato: c.formato, modulo: c.meta?.valor || c.comportamiento?.modulo_ancla || null }),
                });
                const j = await r.json();
                if (!r.ok || j.error) { show(j.error || 'No se pudo redactar', 'error'); return; }
                setIaOpciones(j.opciones); setIaIndice(0);
                setCt({ titulo: j.opciones[0].titulo, mensaje: j.opciones[0].mensaje, botones: j.opciones[0].botones });
                show('Borrador generado — edítalo a tu gusto. Toca de nuevo para otra versión.', 'info');
              } catch { show('Sin conexión', 'error'); }
              finally { setIaOcupada(false); }
            }}>
            {iaOcupada ? 'Redactando…' : iaOpciones ? 'Otra versión' : 'Redactar con IA'}
          </button>
        </div>
        <input style={inputS} value={c.contenido?.titulo || ''} onChange={e => setCt({ titulo: e.target.value })} />
        <span style={lblS as any}>Mensaje</span>
        <textarea style={{ ...inputS, minHeight: 64 }} value={c.contenido?.mensaje || ''} onChange={e => setCt({ mensaje: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={lblS as any}>Imagen (URL de sacscloud.com)</span>
            <input style={inputS} placeholder="https://code.sacscloud.com/…" value={c.contenido?.imagen || ''} onChange={e => setCt({ imagen: e.target.value })} /></div>
          <div><span style={lblS as any}>Video (URL de sacscloud.com)</span>
            <input style={inputS} value={c.contenido?.video || ''} onChange={e => setCt({ video: e.target.value })} /></div>
        </div>
        {c.formato === 'encuesta' ? (<>
          <span style={lblS as any}>Tipo de pregunta (estándares de encuesta)</span>
          <select style={inputS} value={c.contenido?.encuesta?.escala || 'nps'} onChange={e => {
            const esc = e.target.value;
            const soportaDrivers = ['nps', 'ces', '1_5', 'csat_emoji', 'estrellas', 'pulgar'].includes(esc);
            setCt({ encuesta: {
              escala: esc,
              drivers: soportaDrivers ? (c.contenido?.encuesta?.drivers || []) : [],
              opciones: esc === 'opcion' ? (c.contenido?.encuesta?.opciones || []) : [],
            } });
          }}>
            {(catalogo?.escalas_encuesta || []).map((es: any) => <option key={es.id} value={es.id}>{es.etiqueta} — {es.desc}</option>)}
          </select>
          {c.contenido?.encuesta?.escala === 'opcion' && (<>
            <span style={lblS as any}>Opciones (una por línea)</span>
            <textarea style={{ ...inputS, minHeight: 70 }} placeholder={'Punto de venta\nInventario\nReportes'}
              value={(c.contenido?.encuesta?.opciones || []).join('\n')}
              onChange={e => setCt({ encuesta: { ...(c.contenido?.encuesta || {}), opciones: e.target.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8) } })} />
          </>)}
          {['nps', 'ces', '1_5', 'csat_emoji', 'estrellas', 'pulgar'].includes(c.contenido?.encuesta?.escala || 'nps') && (<>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: '0.75rem', fontWeight: 700, color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!(c.contenido?.encuesta?.drivers || []).length}
                onChange={e => setCt({ encuesta: { ...(c.contenido?.encuesta || {}), drivers: e.target.checked ? (catalogo?.drivers_default || []) : [] } })} />
              Pedir el motivo con chips (drivers) — convierte el "¿por qué?" en dato medible
            </label>
            {(c.contenido?.encuesta?.drivers || []).length > 0 && (
              <input style={{ ...inputS, marginTop: 6 }} value={(c.contenido?.encuesta?.drivers || []).join(', ')}
                onChange={e => setCt({ encuesta: { ...(c.contenido?.encuesta || {}), drivers: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 8) } })} />
            )}
            <div style={{ fontSize: '0.68rem', color: '#9c99a6', marginTop: 6, fontWeight: 600 }}>La pregunta de seguimiento cambia sola por sentimiento: al detractor "¿qué salió mal?", al promotor "¿qué valoras?".</div>
          </>)}
          <span style={lblS as any}>Repetir cada (días) — vacío = una sola vez</span>
          <input style={inputS} type="number" min={7} placeholder="ej. 90 para NPS trimestral" value={c.recurrencia_dias ?? ''}
            onChange={e => set({ recurrencia_dias: e.target.value ? Math.max(7, Number(e.target.value)) : null })} />
          <div style={{ fontSize: '0.68rem', color: '#9c99a6', marginTop: 6, fontWeight: 600 }}>Quien responde vuelve a ver la encuesta cuando pasa el periodo; quien la descarta con "No me interesa" no vuelve a verla nunca. Una respuesta ≤6 avisa a la campana del CRM el mismo día.</div>
        </>) : null}
        {c.formato === 'agenda' ? (<>
          <span style={lblS as any}>Tipo de reunión (del agendador)</span>
          <select style={inputS} value={c.contenido?.agenda_slug || ''} onChange={e => setCt({ agenda_slug: e.target.value })}>
            <option value="">Elige el tipo de reunión…</option>
            {(catalogo?.event_types || []).map((t: any) => <option key={t.slug} value={t.slug}>{t.nombre} · {t.duracion_minutos} min</option>)}
          </select>
          <div style={{ fontSize: '0.68rem', color: '#9c99a6', marginTop: 6, fontWeight: 600 }}>El modal abre el calendario real con los datos del usuario precargados; la cita cae en Reuniones ligada a su empresa y cuenta como conversión de esta campaña.</div>
        </>) : null}
        {c.formato === 'badge_menu' || c.formato === 'coachmark' ? (<>
          <span style={lblS as any}>Módulo ancla (dónde aparece)</span>
          <select style={inputS} value={c.comportamiento?.modulo_ancla || ''} onChange={e => setComp({ modulo_ancla: e.target.value })}>
            <option value="">—</option>
            {(catalogo?.destinos_modulo || []).map((d: any) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
          </select>
        </>) : null}
        <span style={lblS as any}>Botones (hasta 2 — acciones de catálogo, nunca URLs libres)</span>
        {[0, 1].map(i => {
          const b = (c.contenido?.botones || [])[i] || {};
          const setB = (patch: any) => {
            const bs = [...(c.contenido?.botones || [])];
            bs[i] = { ...b, ...patch };
            setCt({ botones: bs.filter(x => x && (x.texto || x.accion)) });
          };
          return (
            <div key={i} style={{ border: '1px solid #eef0f3', borderRadius: 10, padding: '10px 12px', marginBottom: 8, background: '#fafafc' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Botón {i + 1} · {i === 0 ? 'Primario' : 'Secundario'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr', gap: 8 }}>
                <input style={inputS} placeholder="Texto" value={b.texto || ''} onChange={e => setB({ texto: e.target.value })} />
                <select style={inputS} value={b.accion || ''} onChange={e => setB({ accion: e.target.value, destino: '' })}>
                  <option value="">—</option>
                  {(catalogo?.acciones_boton || []).map((a: any) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
                </select>
                {b.accion === 'modulo' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: 6 }}>
                    <select style={inputS} value={b.destino || ''} onChange={e => setB({ destino: e.target.value })}>
                      <option value="">Destino…</option>
                      {(catalogo?.destinos_modulo || []).map((d: any) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
                    </select>
                    <input style={inputS} placeholder="ruta interna (opc.)" title="Aterriza DENTRO del módulo: hasta 3 segmentos a-z0-9-" value={b.sub || ''}
                      onChange={e => setB({ sub: e.target.value.trim().toLowerCase() })} />
                  </div>
                ) : b.accion === 'url_sacs' || b.accion === 'chat' ? (
                  <input style={inputS} placeholder={b.accion === 'chat' ? 'Mensaje precargado (opcional)' : 'https://…sacscloud.com/…'} value={b.destino || ''} onChange={e => setB({ destino: e.target.value })} />
                ) : <span style={{ fontSize: '0.7rem', color: '#c9c7d0', alignSelf: 'center' }}>—</span>}
              </div>
            </div>
          );
        })}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '0.72rem', fontWeight: 700, color: '#555', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!c.guardar_campana} onChange={e => set({ guardar_campana: e.target.checked })} />
          Guardar también en la campana de notificaciones (el usuario lo reencuentra aunque cierre el mensaje)
        </label>
      </>)}

      {paso === 2 && (<>
        <span style={{ ...lblS as any, marginTop: 0 }}>Tipo de audiencia</span>
        {[{ v: 'unica', t: 'Una sola vez', s: 'La audiencia se congela al activar. Para anuncios y avisos.' },
          { v: 'continua', t: 'Continua', s: 'Se re-evalúa a diario: quien empiece a calificar va entrando. Para ciclo de vida (ej. "15 días sin ventas").' }].map(o => (
          <div key={o.v} onClick={() => set({ modo: o.v })}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: `1.5px solid ${c.modo === o.v ? '#9B8CFA' : '#e4dffb'}`, borderRadius: 9, padding: '10px 12px', background: '#fdfcff', marginTop: 8, cursor: 'pointer', boxShadow: c.modo === o.v ? '0 0 0 3px rgba(155,140,250,.14)' : 'none' }}>
            <span style={{ width: 15, height: 15, borderRadius: '50%', border: `1.5px solid ${c.modo === o.v ? '#9B8CFA' : '#c9c7d0'}`, marginTop: 2, position: 'relative', flexShrink: 0 }}>
              {c.modo === o.v && <span style={{ position: 'absolute', inset: 2.5, borderRadius: '50%', background: '#9B8CFA' }} />}
            </span>
            <span><span style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block' }}>{o.t}</span>
              <span style={{ fontSize: '0.68rem', color: '#9c99a6', fontWeight: 600 }}>{o.s}</span></span>
          </div>
        ))}
        <span style={lblS as any}>Meta de la campaña (mide resultado, no solo clics)</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select style={inputS} value={c.meta?.tipo || ''} onChange={e => set({ meta: e.target.value ? { tipo: e.target.value, valor: '' } : null })}>
            <option value="">Sin meta</option>
            {(catalogo?.metas || []).map((m: any) => <option key={m.id} value={m.id}>{m.etiqueta}</option>)}
          </select>
          {c.meta?.tipo === 'uso_modulo' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 8 }}>
              <select style={inputS} value={c.meta?.valor || ''} onChange={e => set({ meta: { ...c.meta, valor: e.target.value } })}>
                <option value="">Módulo…</option>
                {(catalogo?.modulos_puente || []).map((m: string) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input style={inputS} type="number" min={1} title="Al menos N documentos en 30 días (retención, no un toque)" placeholder="veces (mín.)"
                value={c.meta?.veces ?? ''} onChange={e => set({ meta: { ...c.meta, veces: e.target.value ? Math.max(1, Number(e.target.value)) : undefined } })} />
            </div>
          ) : c.meta && c.meta.tipo !== 'clic' && c.meta.tipo !== 'cita_agendada' ? (
            <input style={inputS} placeholder="valor (slug)" value={c.meta?.valor || ''} onChange={e => set({ meta: { ...c.meta, valor: e.target.value } })} />
          ) : <span />}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
          <div><span style={{ ...lblS as any, marginTop: 0 }}>Ventana de atribución (días)</span>
            <input style={inputS} type="number" value={c.ventana_atribucion_dias ?? 14} onChange={e => set({ ventana_atribucion_dias: Number(e.target.value) || 14 })} /></div>
          <div><span style={{ ...lblS as any, marginTop: 0 }}>Grupo de control (%)</span>
            <input style={inputS} type="number" value={c.holdout_pct ?? 10} onChange={e => set({ holdout_pct: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} /></div>
        </div>
        <span style={lblS as any}>Cuándo aparece</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(catalogo?.triggers || []).map((t: any) => (
            <button key={t.id} style={chip((c.comportamiento?.trigger || 'al_iniciar') === t.id)} onClick={() => setComp({ trigger: t.id })}>{t.etiqueta}</button>
          ))}
        </div>
        {c.comportamiento?.trigger === 'al_entrar_modulo' && (<>
          <span style={lblS as any}>Módulo</span>
          <select style={inputS} value={c.comportamiento?.modulo_ancla || ''} onChange={e => setComp({ modulo_ancla: e.target.value })}>
            <option value="">—</option>
            {(catalogo?.destinos_modulo || []).map((d: any) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
          </select>
        </>)}
        <span style={lblS as any}>Vigencia</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input style={inputS} type="date" value={(c.vigencia_desde || '').slice(0, 10)} onChange={e => set({ vigencia_desde: e.target.value ? e.target.value + 'T06:00:00.000Z' : null })} />
          <input style={inputS} type="date" value={(c.vigencia_hasta || '').slice(0, 10)} onChange={e => set({ vigencia_hasta: e.target.value ? e.target.value + 'T23:59:59.000Z' : null })} />
        </div>
        <span style={lblS as any}>Frecuencia por usuario</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(catalogo?.frecuencias || []).map((f: any) => (
            <button key={f.id} style={chip((c.comportamiento?.frecuencia?.tipo || 'hasta_interactuar') === f.id)} onClick={() => setComp({ frecuencia: { ...(c.comportamiento?.frecuencia || {}), tipo: f.id } })}>{f.etiqueta}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
          <div><span style={{ ...lblS as any, marginTop: 0 }}>Tope de impresiones</span>
            <input style={inputS} type="number" value={c.comportamiento?.frecuencia?.tope ?? 5} onChange={e => setComp({ frecuencia: { ...(c.comportamiento?.frecuencia || {}), tope: Number(e.target.value) || 0 } })} /></div>
          <div><span style={{ ...lblS as any, marginTop: 0 }}>Descanso entre impresiones (días)</span>
            <input style={inputS} type="number" value={c.comportamiento?.frecuencia?.descanso_dias ?? 1} onChange={e => setComp({ frecuencia: { ...(c.comportamiento?.frecuencia || {}), descanso_dias: Number(e.target.value) || 0 } })} /></div>
        </div>
        {c.formato === 'modal' && (<>
          <span style={lblS as any}>¿El usuario puede cerrarla?</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={chip(c.comportamiento?.bloqueante !== true)} onClick={() => setComp({ bloqueante: false, cerrable: true })}>Sí, cerrable</button>
            <button style={chip(c.comportamiento?.bloqueante === true)} onClick={() => setComp({ bloqueante: true, cerrable: false })}>No (bloqueante)</button>
          </div>
          {c.comportamiento?.bloqueante && (
            <div style={{ marginTop: 10 }}>
              <Aviso tono="aviso" titulo="Bloqueante solo para avisos críticos (pago, mantenimiento)">
                Requiere aprobación aparte antes de activarse y queda en la bitácora.
                {!c.bloqueante_aprobada_por && c.id && (
                  <button style={{ ...S.btnG, marginLeft: 10 }} onClick={() => accion('aprobar_bloqueante')}>Aprobar como founder</button>
                )}
              </Aviso>
            </div>
          )}
        </>)}
        <span style={lblS as any}>Prioridad</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(catalogo?.prioridades || []).map((p: string) => (
            <button key={p} style={chip((c.prioridad || 'normal') === p)} onClick={() => set({ prioridad: p })}>{p[0].toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
        <span style={lblS as any}>Pasos siguientes del embudo (cross-canal)</span>
        {pasos.map((pp: any, i: number) => (
          <div key={i} style={{ border: '1px solid #eef0f3', borderRadius: 10, padding: '10px 12px', marginBottom: 8, background: '#fafafc' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em', flex: 1 }}>Paso {i + 2}</span>
              <button style={{ ...S.btnG, padding: '3px 9px' }} onClick={() => setPasos(pasos.filter((_, j) => j !== i))}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1fr', gap: 8 }}>
              <div><span style={{ ...lblS as any, margin: '0 0 4px' }}>Tras (días)</span>
                <input style={inputS} type="number" min={1} value={pp.espera_dias ?? 5} onChange={e => { const n = [...pasos]; n[i] = { ...pp, espera_dias: Number(e.target.value) || 0 }; setPasos(n); }} /></div>
              <div><span style={{ ...lblS as any, margin: '0 0 4px' }}>Si el usuario…</span>
                <select style={inputS} value={pp.condicion || 'sin_interaccion'} onChange={e => { const n = [...pasos]; n[i] = { ...pp, condicion: e.target.value }; setPasos(n); }}>
                  <option value="no_visto">No lo vio (nunca entró)</option>
                  <option value="sin_interaccion">Lo vio pero no interactuó</option>
                  <option value="sin_clic">No dio clic</option>
                  <option value="siempre">Siempre (todos los pendientes)</option>
                </select></div>
              <div><span style={{ ...lblS as any, margin: '0 0 4px' }}>Canal</span>
                <select style={inputS} value={pp.canal_paso || 'email'} onChange={e => { const n = [...pasos]; n[i] = { ...pp, canal_paso: e.target.value }; setPasos(n); }}>
                  <option value="email">Email (campaña del módulo)</option>
                  <option value="tarea_whatsapp">Tarea: WhatsApp humano</option>
                </select></div>
            </div>
            {pp.canal_paso !== 'tarea_whatsapp' ? (
              <div style={{ marginTop: 8 }}>
                <select style={inputS} value={pp.email_campaign_id || ''} onChange={e => { const n = [...pasos]; n[i] = { ...pp, email_campaign_id: e.target.value }; setPasos(n); }}>
                  <option value="">Elige la campaña de email (en borrador)…</option>
                  {emailCamps.map((ec: any) => <option key={ec.id} value={ec.id}>{ec.nombre}</option>)}
                </select>
                <div style={{ fontSize: '0.66rem', color: '#9c99a6', fontWeight: 600, marginTop: 4 }}>Se programa sola con la cohorte que cumpla la condición, respetando las supresiones y presión del módulo de Email. Quien ya cumplió la meta sale del embudo.</div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <input style={inputS} placeholder="Nota para la tarea (qué decirle al cliente)" value={pp.contenido?.mensaje || ''} onChange={e => { const n = [...pasos]; n[i] = { ...pp, contenido: { mensaje: e.target.value } }; setPasos(n); }} />
                <div style={{ fontSize: '0.66rem', color: '#9c99a6', fontWeight: 600, marginTop: 4 }}>Crea una tarea humana por empresa en su ficha (nunca un WhatsApp automatizado) y avisa en la campana del CRM.</div>
              </div>
            )}
          </div>
        ))}
        {c.id ? (
          <button style={S.btnG} onClick={() => setPasos([...pasos, { espera_dias: 5, condicion: 'sin_interaccion', canal_paso: 'email', contenido: {} }])}>+ Agregar paso</button>
        ) : (
          <div style={{ fontSize: '0.68rem', color: '#9c99a6', fontWeight: 600 }}>Guarda la campaña primero para poder encadenar pasos.</div>
        )}

        <div style={{ fontSize: '0.68rem', color: '#9c99a6', marginTop: 12, fontWeight: 600, lineHeight: 1.6 }}>
          Reglas de plataforma (no configurables por campaña): máx. 1 mensaje interruptivo por sesión · nunca durante una venta o cobro en el POS · «No me interesa» suprime la campaña para ese usuario permanentemente · tope global de 3 campañas/usuario/semana · auto-pausa si el descarte supera 60% en las primeras 200 impresiones.
        </div>
      </>)}

      {paso === 3 && (<>
        {cargandoRev && <Cargando texto="Revisando la campaña…" alto={160} />}
        {!cargandoRev && !rev && <button style={S.btnA} onClick={revisar}>Correr revisión</button>}
        {rev && (<>
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 10 }}>Revisión antes de activar</div>
            {(rev.errores || []).map((e: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 9, padding: '7px 0', fontSize: '0.78rem', color: '#444', borderBottom: '1px solid #f7f6fa' }}>
                <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#C0554E', color: '#fff', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</span>{e}
              </div>
            ))}
            {(rev.avisos || []).map((e: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 9, padding: '7px 0', fontSize: '0.78rem', color: '#444', borderBottom: '1px solid #f7f6fa' }}>
                <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#E0A93E', color: '#fff', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>!</span>{e}
              </div>
            ))}
            {!(rev.errores || []).length && (
              <div style={{ display: 'flex', gap: 9, padding: '7px 0', fontSize: '0.78rem', color: '#444' }}>
                <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#2FA47C', color: '#fff', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</span>
                Contenido, botones y audiencia validados contra los catálogos.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button style={S.btnG} onClick={() => accion('prueba', { cuenta: 'pruebasmongo' })}>Enviar prueba a la cuenta interna</button>
              <button style={S.btnG} onClick={revisar}>Re-revisar</button>
            </div>
          </div>
          {rev.alcance && (
            <div style={S.card}>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 8 }}>Alcance real</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-.02em' }}>{rev.alcance.cuentas} <span style={{ fontSize: '0.8rem', color: '#9c99a6', fontWeight: 700 }}>cuentas</span></div>
              <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600 }}>{rev.alcance.companies} clientes cumplen las condiciones</div>
              <div style={{ fontSize: '0.7rem', color: '#888', lineHeight: 1.7, marginTop: 8 }}>
                – {rev.alcance.exclusiones?.sin_cuenta ?? 0} clientes sin cuenta SACS ligada<br />
                – {rev.alcance.exclusiones?.excluidas_manual ?? 0} cuentas excluidas a mano<br />
                – ~{rev.alcance.holdout_estimado ?? 0} usuarios quedarán como grupo de control ({c.holdout_pct}%)
                {rev.alcance.saturadas ? <><br />⚠️ {rev.alcance.saturadas} de estos clientes ya llevan 3+ mensajes esta semana (in-app + email)</> : null}
              </div>
              {!(rev.errores || []).length && rev.alcance.cuentas > 0 && (
                <button
                  style={{ width: '100%', border: 'none', borderRadius: 9, padding: 11, background: confirmaActivar ? '#4536BE' : '#9B8CFA', color: '#fff', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginTop: 14 }}
                  onClick={() => { if (!confirmaActivar) { setConfirmaActivar(true); setTimeout(() => setConfirmaActivar(false), 4000); return; } accion('activar'); }}>
                  {confirmaActivar ? `¿Seguro? Toca otra vez para activar a ${rev.alcance.cuentas} cuentas` : `Activar para ${rev.alcance.cuentas} cuentas`}
                </button>
              )}
            </div>
          )}
        </>)}
      </>)}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#f5f6f8', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <input
          style={{ fontSize: '1rem', fontWeight: 800, border: 'none', outline: 'none', fontFamily: 'inherit', minWidth: 0, width: isMobile ? 130 : 240 }}
          value={c.nombre || ''} placeholder="Nombre de la campaña"
          onChange={e => set({ nombre: e.target.value })} />
        {!isMobile && (
          <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {PASOS.map((p, i) => (
              <button key={p} style={chip(paso === i)} onClick={() => { setPaso(i); if (i === 3) revisar(); }}>{i < paso ? '✓ ' : ''}{p}</button>
            ))}
          </div>
        )}
        <button style={S.btnP} disabled={guardando} onClick={async () => { const g = await guardar(); if (g) { if (!g.aviso) show('Campaña guardada'); onSaved(); } }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#999', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
      </div>
      {isMobile && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #f0eff3' }}>
          {PASOS.map((p, i) => (
            <button key={p} style={{ ...chip(paso === i), whiteSpace: 'nowrap' }} onClick={() => { setPaso(i); if (i === 3) revisar(); }}>{i < paso ? '✓ ' : ''}{p}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>
        {isMobile ? <div style={{ overflowY: 'auto' }}>{form}<div style={{ padding: '0 14px 24px' }}><PreviewSacs3 c={c} /></div></div> : (<>
          {form}
          <div style={{ flex: 1, padding: 26, overflowY: 'auto' }}><PreviewSacs3 c={c} /></div>
        </>)}
      </div>
    </div>
  );
}

// ═══════════════════════ RESULTADOS (Sheet) ═════════════════════════════════

function Resultados({ id, onClose, onAccion }: { id: string; onClose: () => void; onAccion: (a: string, id: string) => void }) {
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let vivo = true;
    fetch(`/api/crm/outbound/resultados?id=${id}`).then(x => x.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setR(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión'); });
    return () => { vivo = false; };
  }, [id]);
  const fu = (t: string, v: any, sub?: string, hito?: boolean) => (
    <div style={{ flex: 1, background: '#fff', border: '1px solid #ececec', borderLeft: hito ? '3px solid #9B8CFA' : '1px solid #ececec', borderRadius: 10, padding: '12px 14px', minWidth: 100 }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.07em' }}>{t}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, color: hito ? '#4536BE' : '#1a1a1a' }}>{v}</div>
      {sub && <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5B4BD6', marginTop: 3 }}>{sub}</div>}
    </div>
  );
  return (
    <Sheet open onClose={onClose} title={r?.campana?.nombre || 'Resultados'} width={860}
      headerActions={<>
        <a href={`/api/crm/outbound/export?id=${id}`} style={{ ...S.btnG, textDecoration: 'none' }}>CSV eventos</a>
        <a href={`/api/crm/outbound/export?id=${id}&que=conversiones`} style={{ ...S.btnG, textDecoration: 'none' }}>CSV conversiones</a>
        {r?.campana?.estado === 'activa' ? <button style={S.btnA} onClick={() => onAccion('pausar', id)}>Pausar</button> : null}
      </>}>
      {err && <Aviso tono="malo">{err}</Aviso>}
      {!r && !err && <Cargando texto="Cargando resultados…" alto={200} />}
      {r && (<>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <BadgeEstado c={r.campana} />
          <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>{FMT_CORTO[r.campana.formato] || r.campana.formato}</span>
          {r.campana.pausa_motivo === 'circuit_breaker' && <Tag tono="malo">Auto-pausada: demasiados descartes</Tag>}
        </div>
        <div className="crm-scroll-x" style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          {fu('Cuentas objetivo', r.resumen.cuentas_objetivo)}
          <span style={{ alignSelf: 'center', color: '#c9c7d0', fontWeight: 800 }}>→</span>
          {fu('Vieron', r.resumen.usuarios_vieron, `${r.resumen.impresiones} impresiones · ${r.resumen.cuentas_vieron} cuentas`)}
          <span style={{ alignSelf: 'center', color: '#c9c7d0', fontWeight: 800 }}>→</span>
          {fu('Clic', r.resumen.usuarios_clic, `${r.resumen.ctr}% CTR`)}
          <span style={{ alignSelf: 'center', color: '#c9c7d0', fontWeight: 800 }}>→</span>
          {fu('Cumplieron la meta', r.resumen.conversiones.expuestas,
            r.resumen.conversiones.lift ? `control ${r.resumen.conversiones.tasa_control_pct}% → lift ×${r.resumen.conversiones.lift}` : undefined, true)}
        </div>
        <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginTop: 16 }}>
          <div style={S.card}>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 10 }}>Clics por botón</div>
            {Object.keys(r.resumen.clics_por_boton || {}).length === 0 && <div style={{ fontSize: '0.78rem', color: '#9c99a6' }}>Aún sin clics.</div>}
            {Object.entries(r.resumen.clics_por_boton || {}).map(([b, n]: any) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f7f6fa', fontSize: '0.79rem' }}>
                <span style={{ flex: 1, fontWeight: 700 }}>{b}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                <span style={{ width: 90, height: 6, borderRadius: 99, background: '#f0eefb', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Number(n) / Math.max(...Object.values(r.resumen.clics_por_boton).map(Number)) * 100)}%`, background: '#9B8CFA', borderRadius: 99 }} />
                </span>
              </div>
            ))}
            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 10 }}>
              Cierres: <b>{r.resumen.cierres}</b> · «No me interesa»: <b>{r.resumen.descartes}</b> · Chats: <b>{r.resumen.chats_abiertos}</b>
              {r.resumen.citas ? <> · Citas agendadas: <b>{r.resumen.citas}</b></> : null}
            </div>
          </div>
          {r.resumen.encuesta && (
            <div style={{ ...S.card, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 8 }}>Encuesta</div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline' }}>
                {typeof r.resumen.encuesta.score === 'number' && <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4536BE' }}>NPS {r.resumen.encuesta.score}</span>}
                <span style={{ fontSize: '0.78rem', color: '#555', fontWeight: 600 }}>{r.resumen.encuesta.opciones} respuestas · promedio {r.resumen.encuesta.promedio}</span>
                {typeof r.resumen.encuesta.score === 'number' && <><Tag tono="ok">{r.resumen.encuesta.promotores} promotores</Tag>
                <Tag tono="gris">{r.resumen.encuesta.pasivos} pasivos</Tag>
                <Tag tono="malo">{r.resumen.encuesta.detractores} detractores</Tag></>}
              </div>
              {Object.keys(r.resumen.encuesta.drivers || {}).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888', marginBottom: 6 }}>¿Qué influyó (drivers)</div>
                  {Object.entries(r.resumen.encuesta.drivers).sort((a: any, b: any) => b[1] - a[1]).map(([d, n]: any) => {
                    const max = Math.max(...Object.values(r.resumen.encuesta.drivers).map(Number));
                    return (
                      <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: '0.78rem' }}>
                        <span style={{ flex: 1, fontWeight: 700 }}>{d}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                        <span style={{ width: 90, height: 6, borderRadius: 99, background: '#f0eefb', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.round(Number(n) / max * 100)}%`, background: '#9B8CFA', borderRadius: 99 }} /></span>
                      </div>
                    );
                  })}
                </div>
              )}
              {Object.keys(r.resumen.encuesta.opciones || {}).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888', marginBottom: 6 }}>Respuestas</div>
                  {Object.entries(r.resumen.encuesta.opciones).sort((a: any, b: any) => b[1] - a[1]).map(([resp, n]: any) => (
                    <div key={resp} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: '0.78rem' }}>
                      <span style={{ flex: 1, fontWeight: 700 }}>{resp}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                    </div>
                  ))}
                </div>
              )}
              {(r.resumen.encuesta.comentarios || []).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {(r.resumen.encuesta.comentarios || []).map((cm: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f7f6fa', fontSize: '0.79rem' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: cm.valor >= 9 ? '#EAF8F2' : cm.valor <= 6 ? '#FEF0EF' : '#F4F4F6', color: cm.valor >= 9 ? '#1E8A63' : cm.valor <= 6 ? '#C0554E' : '#6B7280', flexShrink: 0, height: 'fit-content' }}>{cm.valor}</span>
                      <span style={{ flex: 1, color: '#444' }}>{cm.comentario}</span>
                      <span style={{ fontSize: '0.68rem', color: '#9c99a6', flexShrink: 0 }}>{cm.cuenta} · {cm.dia}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={S.card}>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 8 }}>Interés generado</div>
            <div style={{ fontSize: '0.78rem', color: '#444', lineHeight: 1.7 }}>
              <b>{r.resumen.interes} usuarios</b> mostraron interés (clic, chat, encuesta o ≥2 vistas).
              {r.campana.meta?.tipo === 'uso_modulo' && <> Quedan marcados con interés en <b>{r.campana.meta.valor}</b> — ya disponibles como condición de audiencia («Mostró interés en…») aquí y en Email marketing.</>}
            </div>
          </div>
        </div>
        {(r.historial || []).length > 0 && (
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 8 }}>Historial de cambios</div>
            {(r.historial || []).map((h: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #f7f6fa', fontSize: '0.75rem', alignItems: 'baseline' }}>
                <Tag tono={h.accion === 'activo' ? 'acento' : h.accion === 'pauso' ? 'aviso' : 'gris'}>{h.accion}</Tag>
                <span style={{ flex: 1, color: '#555' }}>{(h.detalle?.campos || []).join(', ') || '—'}</span>
                <span style={{ color: '#9c99a6', flexShrink: 0 }}>{fmtFecha(h.created_at)}</span>
              </div>
            ))}
            <div style={{ fontSize: '0.66rem', color: '#9c99a6', fontWeight: 600, marginTop: 8 }}>Cada edición guarda el antes y el después completos en la bitácora.</div>
          </div>
        )}
      </>)}
    </Sheet>
  );
}

// ═══════════════════════ TAB PRINCIPAL ══════════════════════════════════════

export default function OutboundTab() {
  const isMobile = useIsMobile();
  const { toast, show } = useToast();
  const [data, setData] = useState<any[] | null>(null);
  const [catalogo, setCatalogo] = useState<any>(null);
  const [editando, setEditando] = useState<any | null>(null);
  const [resultadosId, setResultadosId] = useState<string | null>(null);
  const [menuRow, setMenuRow] = useState<any | null>(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [vista, setVista] = useState<'campanas' | 'convivencia' | 'vercomo'>('campanas');
  const [conv, setConv] = useState<any>(null);
  const [vcCuenta, setVcCuenta] = useState('');
  const [vcUid, setVcUid] = useState('');
  const [vcUsuarios, setVcUsuarios] = useState<any[]>([]);
  const [vcRes, setVcRes] = useState<any>(null);
  const [vcOcupado, setVcOcupado] = useState(false);

  async function load() {
    try {
      const [a, b] = await Promise.all([
        fetch('/api/crm/outbound/campanas').then(r => r.json()),
        catalogo ? Promise.resolve({ catalogo }) : fetch('/api/crm/outbound/campanas?catalogo=1').then(r => r.json()),
      ]);
      if (a.error) { show(a.error, 'error'); return; }
      if (b.error) { show('No se pudo cargar el catálogo: ' + b.error, 'error'); }
      setData(a.data || []);
      if (b.catalogo) setCatalogo(b.catalogo);
    } catch { show('No se pudieron cargar las campañas — revisa tu internet', 'error'); setData([]); }
  }
  useEffect(() => { load(); }, []);

  async function accionRapida(a: string, id: string) {
    try {
      const r = await fetch(`/api/crm/outbound/campanas?id=${id}&accion=${a}`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok || j.error) { show(j.error || 'No se pudo', 'error'); return; }
      show(a === 'pausar' ? 'Campaña pausada' : a === 'reanudar' ? 'Campaña reanudada' : a === 'terminar' ? 'Campaña terminada' : 'Listo');
      setResultadosId(null);
      load();
    } catch { show('Sin conexión', 'error'); }
  }

  const BASE_NUEVA = {
    nombre: '', formato: 'modal', canal: 'web', prioridad: 'normal', modo: 'unica',
    holdout_pct: 10, ventana_atribucion_dias: 14,
    contenido: { botones: [] }, comportamiento: { trigger: 'al_iniciar', frecuencia: { tipo: 'hasta_interactuar', tope: 5, descanso_dias: 1 }, cerrable: true },
    audiencia: { grupos: [] }, nivel: { tipo: 'todos' },
  };
  const nueva = () => setPickerAbierto(true);
  const nuevaDesde = (plantilla: any | null) => {
    setPickerAbierto(false);
    if (!plantilla) { setEditando({ ...BASE_NUEVA }); return; }
    setEditando({
      ...BASE_NUEVA,
      ...plantilla.valores,
      nombre: plantilla.nombre,
      contenido: { botones: [], ...(plantilla.valores.contenido || {}) },
      comportamiento: { ...BASE_NUEVA.comportamiento, ...(plantilla.valores.comportamiento || {}) },
    });
  };

  const activas = (data || []).filter(c => c.estado === 'activa');
  const kpis = useMemo(() => {
    const imp = (data || []).reduce((a, c) => a + (c.resumen?.impresiones || 0), 0);
    const usuarios = (data || []).reduce((a, c) => a + (c.resumen?.usuarios || 0), 0);
    const clics = (data || []).reduce((a, c) => a + (c.resumen?.clics || 0), 0);
    const conv = (data || []).reduce((a, c) => a + (c.resumen?.conversiones || 0), 0);
    const ingreso = (data || []).reduce((a, c) => a + (Number(c.resumen?.ingreso) || 0), 0);
    const alcance = activas.reduce((a, c) => a + (c.materializada?.cuentas || 0), 0);
    return { imp, usuarios, clics, conv, ingreso, alcance, ctr: usuarios ? +(clics / usuarios * 100).toFixed(1) : 0 };
  }, [data]);

  const cols: ColDef[] = [
    {
      key: 'nombre', label: 'Campaña', fija: true, width: 220, ftype: 'text', val: r => r.nombre,
      render: r => (<span style={{ fontWeight: 700 }}>{r.nombre}<span style={{ display: 'block', fontSize: '0.68rem', color: '#9c99a6', fontWeight: 600, marginTop: 1 }}>{r.objetivo_texto || (r.meta?.tipo === 'uso_modulo' ? `Meta: usar ${r.meta.valor}` : '')}</span></span>),
    },
    {
      key: 'formato', label: 'Formato', width: 130, ftype: 'select', val: r => r.formato,
      options: Object.entries(FMT_CORTO).map(([v, l]) => ({ v, l })),
      render: r => <span style={{ display: 'inline-flex', fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#eef2fe', color: '#3764c4', whiteSpace: 'nowrap' }}>{FMT_CORTO[r.formato] || r.formato}</span>,
    },
    { key: 'audiencia', label: 'Audiencia', width: 230, render: r => <span style={{ fontSize: '0.72rem', color: '#555', fontWeight: 600 }}>{resumenAudiencia(r)}</span> },
    {
      key: 'estado', label: 'Estado', width: 110, ftype: 'select', val: r => estadoVisual(r),
      options: Object.entries(ESTADO_BADGE).map(([v, e]) => ({ v, l: e.l })),
      render: r => <BadgeEstado c={r} />,
    },
    {
      key: 'vigencia', label: 'Vigencia', width: 130, ftype: 'date', val: r => (r.vigencia_desde || '').slice(0, 10),
      render: r => <span style={{ fontSize: '0.72rem', color: '#666' }}>{r.vigencia_desde ? fmtFecha(r.vigencia_desde).split(',')[0] : '—'}{r.vigencia_hasta ? ` → ${fmtFecha(r.vigencia_hasta).split(',')[0]}` : ''}</span>,
    },
    { key: 'impresiones', label: 'Impresiones', width: 100, num: true, ftype: 'number', val: r => r.resumen?.impresiones || 0, render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.resumen?.impresiones ? r.resumen.impresiones.toLocaleString('es-MX') : '—'}</span> },
    { key: 'ctr', label: 'CTR', width: 70, num: true, ftype: 'number', val: r => r.resumen?.ctr || 0, render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.resumen?.impresiones ? `${r.resumen.ctr}%` : '—'}</span> },
    { key: 'interes', label: 'Interés', width: 80, num: true, ftype: 'number', val: r => r.resumen?.interes || 0, render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.resumen?.interes || '—'}</span> },
    {
      key: 'acciones', label: '', width: 44,
      render: r => <button style={{ background: 'none', border: 'none', color: '#9c99a6', fontWeight: 800, cursor: 'pointer', fontSize: '1rem', padding: '2px 8px' }} onClick={e => { e.stopPropagation(); setMenuRow(r); }}>⋮</button>,
    },
  ];

  const vistasBase: VistaDef[] = [
    { key: 'todas', nombre: 'Todas', config: { sort: { key: 'vigencia', dir: -1 } } },
    { key: 'activas', nombre: 'Activas', config: { conds: [{ campo: 'estado', op: 'es', v1: 'activa' }] } },
    { key: 'programadas', nombre: 'Programadas', config: { conds: [{ campo: 'estado', op: 'es', v1: 'programada' }] } },
    { key: 'pausadas', nombre: 'Pausadas', config: { conds: [{ campo: 'estado', op: 'es', v1: 'pausada' }] } },
    { key: 'borradores', nombre: 'Borradores', config: { conds: [{ campo: 'estado', op: 'es', v1: 'borrador' }] } },
    { key: 'terminadas', nombre: 'Terminadas', config: { conds: [{ campo: 'estado', op: 'es', v1: 'terminada' }] } },
  ];

  const abrir = (r: any) => {
    if (r.estado === 'borrador') setEditando(r);
    else setResultadosId(r.id);
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>Outbound</h1>
          <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: 2 }}>
            Mensajes dentro de SACS · {activas.length} campañas activas{kpis.alcance ? ` · ${kpis.alcance.toLocaleString('es-MX')} cuentas alcanzadas` : ''}
          </div>
        </div>
        <button style={S.btnP} onClick={nueva}>+ Nueva campaña</button>
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '14px 0 4px' }}>
        <button style={chip(vista === 'campanas')} onClick={() => setVista('campanas')}>Campañas</button>
        <button style={chip(vista === 'convivencia')} onClick={() => {
          setVista('convivencia');
          if (!conv) fetch('/api/crm/outbound/convivencia').then(r => r.json()).then(setConv).catch(() => setConv({ error: true }));
        }}>Convivencia</button>
        <button style={chip(vista === 'vercomo')} onClick={() => setVista('vercomo')}>Ver como…</button>
      </div>

      {vista === 'vercomo' ? (
        <div style={{ marginTop: 14, maxWidth: 860 }}>
          <div style={S.card}>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 4 }}>Ver como un usuario</div>
            <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 12 }}>La MISMA decisión de entrega que corre en producción, con la razón exacta de cada filtro. Escribe la cuenta, carga sus usuarios y elige uno.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1.4fr auto', gap: 8, alignItems: 'end' }}>
              <div><span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Cuenta SACS</span>
                <input style={S.inp} placeholder="ej. dibujotecnico" value={vcCuenta} onChange={e => setVcCuenta(e.target.value.trim().toLowerCase())} /></div>
              <button style={S.btnG} disabled={!vcCuenta || vcOcupado} onClick={async () => {
                setVcOcupado(true); setVcUsuarios([]); setVcUid('');
                try {
                  const r = await fetch(`/api/crm/sacs-usuarios?account=${encodeURIComponent(vcCuenta)}`);
                  const j = await r.json();
                  const us = j.usuarios || j.data || [];
                  if (!us.length) show('Esa cuenta no tiene usuarios legibles', 'info');
                  setVcUsuarios(us);
                } catch { show('No se pudieron cargar los usuarios', 'error'); }
                finally { setVcOcupado(false); }
              }}>Cargar usuarios</button>
              <div><span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Usuario</span>
                <select style={S.inp} value={vcUid} onChange={e => setVcUid(e.target.value)}>
                  <option value="">{vcUsuarios.length ? 'Elige…' : 'Carga la cuenta primero'}</option>
                  {vcUsuarios.map((u: any) => <option key={u.uid || u.fid} value={u.uid || u.fid}>{u.name || u.nombre || u.email || u.uid}</option>)}
                </select></div>
              <button style={S.btnP} disabled={!vcCuenta || !vcUid || vcOcupado} onClick={async () => {
                setVcOcupado(true); setVcRes(null);
                try {
                  const r = await fetch(`/api/crm/outbound/simular?account=${encodeURIComponent(vcCuenta)}&uid=${encodeURIComponent(vcUid)}`);
                  const j = await r.json();
                  if (j.error) { show(j.error, 'error'); return; }
                  setVcRes(j);
                } catch { show('Sin conexión', 'error'); }
                finally { setVcOcupado(false); }
              }}>{vcOcupado ? 'Simulando…' : 'Simular'}</button>
            </div>
          </div>
          {vcRes && (
            <div style={{ ...S.card, marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, flex: 1 }}>Resultado</span>
                <Tag tono="acento">{vcRes.se_muestran} se mostrarían</Tag>
                {vcRes.en_hora_pico && <Tag tono="aviso">El negocio está en su hora pico: interruptivos en espera</Tag>}
                {vcRes.killswitch && <Tag tono="malo">Kill switch global encendido</Tag>}
              </div>
              {(vcRes.trazas || []).length === 0 && <div style={{ fontSize: '0.78rem', color: '#9c99a6' }}>Ninguna campaña activa apunta a esta cuenta.</div>}
              {(vcRes.trazas || []).map((t: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid #f7f6fa', fontSize: '0.79rem', alignItems: 'flex-start' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, flexShrink: 0, background: t.veredicto === 'se_muestra' ? '#EEECFE' : '#F4F4F6', color: t.veredicto === 'se_muestra' ? '#5B4BD6' : '#6B7280' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.veredicto === 'se_muestra' ? '#9B8CFA' : '#C9C7D0' }} />
                    {t.veredicto === 'se_muestra' ? 'Se muestra' : 'Filtrada'}
                  </span>
                  <span style={{ flex: 1 }}><b>{t.nombre}</b> <span style={{ color: '#9c99a6' }}>({FMT_CORTO[t.formato] || t.formato})</span><br /><span style={{ fontSize: '0.74rem', color: '#666' }}>{t.razon}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : vista === 'convivencia' ? (
        <div style={{ marginTop: 14 }}>
          {!conv && <Cargando texto="Calculando traslapes…" alto={160} />}
          {conv?.error && <Aviso tono="malo">No se pudo cargar la convivencia.</Aviso>}
          {conv && !conv.error && (
            <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
              <div style={S.card}>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 4 }}>Campañas que comparten audiencia</div>
                <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 10 }}>Semana del {conv.semana}. Si dos campañas apuntan a las mismas cuentas, gana la de mayor prioridad y la otra espera su turno.</div>
                {(conv.traslapes || []).length === 0 && <div style={{ fontSize: '0.78rem', color: '#9c99a6' }}>Sin traslapes entre las campañas activas.</div>}
                {(conv.traslapes || []).map((t: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f7f6fa', fontSize: '0.79rem' }}>
                    <span style={{ flex: 1, fontWeight: 700 }}>{t.a} <span style={{ color: '#9c99a6', fontWeight: 600 }}>×</span> {t.b}</span>
                    <Tag tono="acento">{t.cuentas} cuentas en común</Tag>
                  </div>
                ))}
                <div style={{ marginTop: 12 }}>
                  {(conv.campanas || []).map((cc: any) => (
                    <div key={cc.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: '0.75rem', color: '#555' }}>
                      <span style={{ flex: 1 }}>{cc.nombre}</span>
                      <span style={{ color: '#9c99a6' }}>{FMT_CORTO[cc.formato] || cc.formato}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{cc.cuentas} cuentas</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.card}>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: 4 }}>Clientes saturados esta semana</div>
                <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 10 }}>3+ toques entre mensajes in-app y correos. Piénsalo dos veces antes de sumarles otra campaña.</div>
                {(conv.saturados || []).length === 0 && <div style={{ fontSize: '0.78rem', color: '#9c99a6' }}>Nadie saturado. Buen ritmo.</div>}
                {(conv.saturados || []).map((sx: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f7f6fa', fontSize: '0.79rem' }}>
                    <span style={{ flex: 1, fontWeight: 700 }}>{sx.nombre}</span>
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>{sx.inapp} in-app · {sx.emails} correos</span>
                    <Tag tono={sx.total >= 5 ? 'malo' : 'aviso'}>{sx.total}</Tag>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : data === null ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5,1fr)', gap: 10, margin: '18px 0' }}>
          {[0, 1, 2, 3, 4].slice(0, isMobile ? 2 : 5).map(i => (
            <div key={i} style={{ background: '#fff', border: '1px solid #ececec', borderLeft: '3px solid #eee', padding: '14px 16px', borderRadius: 10 }}>
              <div style={{ height: 9, width: '70%', borderRadius: 5, background: '#f0f0f3' }} />
              <div style={{ height: 20, width: '45%', borderRadius: 5, background: '#f0f0f3', marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="crm-scroll-x" style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, margin: '18px 0', ...(isMobile ? { overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 4 } : {}) }}>
          {[
            <KpiCard key="a" titulo="Campañas activas" valor={activas.length} sub={`${(data || []).filter(c => estadoVisual(c) === 'programada').length} programadas`} />,
            <KpiCard key="b" titulo="Alcance actual" valor={kpis.alcance.toLocaleString('es-MX')} sub="cuentas en campañas activas" franja="#7DA6F5" />,
            <KpiCard key="c" titulo="Impresiones" valor={kpis.imp.toLocaleString('es-MX')} sub={`${kpis.usuarios.toLocaleString('es-MX')} usuarios únicos`} />,
            <KpiCard key="d" titulo="CTR promedio" valor={`${kpis.ctr}%`} sub="usuarios con clic / que vieron" franja="#7DA6F5" />,
            kpis.ingreso > 0
              ? <KpiCard key="e" titulo="Ingreso atribuido" valor={'$' + Math.round(kpis.ingreso).toLocaleString('es-MX')} sub={`${kpis.conv} conversiones (expuestos)`} franja="#4FBF95" color="#1E8A63" />
              : <KpiCard key="e" titulo="Cumplieron su meta" valor={kpis.conv} sub="cuentas convertidas" franja="#9B8CFA" color="#4536BE" />,
          ].map((k, i) => isMobile ? <div key={i} style={{ minWidth: '82%', scrollSnapAlign: 'start', flex: 'none' }}>{k}</div> : k)}
        </div>
      )}

      {vista === 'campanas' && data !== null && data.length === 0 ? (
        <Vacio titulo="Todavía no has creado ninguna campaña"
          texto="Crea la primera para mostrar un mensaje dentro de SACS a las cuentas que elijas: un banner, un modal o una tarjeta en su inicio."
          accion={<button style={S.btnP} onClick={nueva}>+ Nueva campaña</button>} />
      ) : vista === 'campanas' && data !== null && (
        <div style={{ background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)', padding: '20px 22px' }}>
          <TablaEnterprise
            tabla="campanas_app"
            data={data}
            cols={cols}
            vistasBase={vistasBase}
            searchText={r => `${r.nombre} ${r.objetivo_texto || ''} ${r.formato}`}
            searchPlaceholder="Buscar campaña…"
            onRowClick={abrir}
            minWidth={1080}
            headerTint
            emptyMsg="Ninguna campaña con esos filtros."
            mobileCard={r => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, flex: 1 }}>{r.nombre}</span>
                  <BadgeEstado c={r} />
                  <span style={{ color: '#c9c7d0', fontWeight: 800 }}>›</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#eef2fe', color: '#3764c4' }}>{FMT_CORTO[r.formato] || r.formato}</span>
                  <span style={{ fontSize: '0.68rem', color: '#888', fontWeight: 600 }}>{resumenAudiencia(r)}</span>
                </div>
                {r.resumen?.impresiones ? <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 600 }}>{r.resumen.impresiones.toLocaleString('es-MX')} impresiones · {r.resumen.ctr}% CTR · {r.resumen.interes} con interés</div> : null}
              </div>
            )}
          />
        </div>
      )}

      {editando && catalogo && (
        <Editor inicial={editando} catalogo={catalogo} show={show}
          onClose={() => setEditando(null)} onSaved={load} />
      )}
      {resultadosId && <Resultados id={resultadosId} onClose={() => setResultadosId(null)} onAccion={accionRapida} />}

      {pickerAbierto && (
        <Sheet open onClose={() => setPickerAbierto(false)} title="Nueva campaña" width={760}>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 14 }}>Empieza desde una receta probada — la audiencia, el formato, la meta y la frecuencia ya vienen puestos — o desde cero.</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <div onClick={() => nuevaDesde(null)}
              style={{ border: '1.5px dashed #c9bcf7', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', background: '#fdfcff' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#5B4BD6' }}>Empezar en blanco</div>
              <div style={{ fontSize: '0.7rem', color: '#9c99a6', fontWeight: 600, marginTop: 3 }}>Todo desde cero, sin precargas.</div>
            </div>
            {(catalogo?.plantillas || []).map((pl: any) => (
              <div key={pl.id} onClick={() => nuevaDesde(pl)}
                style={{ border: '1.5px solid #e2e4e9', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', background: '#fff' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, flex: 1 }}>{pl.nombre}</span>
                  <Tag tono="acento">{pl.fam}</Tag>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9c99a6', fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>{pl.desc}</div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
      <ActionSheet
        open={!!menuRow}
        onClose={() => setMenuRow(null)}
        title={menuRow?.nombre}
        items={menuRow ? [
          { label: 'Ver resultados', onClick: () => { setResultadosId(menuRow.id); setMenuRow(null); } },
          { label: 'Editar', onClick: () => { setEditando(menuRow); setMenuRow(null); } },
          ...(menuRow.estado === 'activa' ? [{ label: 'Pausar campaña', onClick: () => { accionRapida('pausar', menuRow.id); setMenuRow(null); } }] : []),
          ...(menuRow.estado === 'pausada' ? [{ label: 'Reanudar', onClick: () => { accionRapida('reanudar', menuRow.id); setMenuRow(null); } }] : []),
          ...(menuRow.estado === 'activa' ? [{ label: 'Terminar', onClick: () => { accionRapida('terminar', menuRow.id); setMenuRow(null); } }] : []),
          { label: 'Enviar prueba a la cuenta interna', onClick: () => { accionRapida('prueba', menuRow.id); setMenuRow(null); } },
          { label: 'Archivar', danger: true, onClick: () => { accionRapida('archivar', menuRow.id); setMenuRow(null); } },
        ] : []}
      />
      <Toast toast={toast} />
    </div>
  );
}
