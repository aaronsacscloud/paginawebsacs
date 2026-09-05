import { useEffect, useState, type ReactNode } from 'react';
import Sheet from '../ui/Sheet';

/* ═══ Contexto del lead ═══ Antes de decidir sobre una propuesta (Revisión diaria, Próximos envíos, Aprendizaje,
   Reactivación) el dueño quería ver la conversación real: los últimos 20 mensajes con quién los dijo (lead /
   agente / equipo), llamadas, notas, citas, cotizaciones y lo que el agente ya sabe. Las acciones de la tarjeta
   se pasan por `acciones` para decidir sin cerrar el drawer. */
export type AccionContexto = { label: string; onClick: () => void | Promise<void>; primario?: boolean; disabled?: boolean };
const fecha = (iso?: string) => iso ? new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const ETAPA: Record<string, string> = { lead: 'Lead', lead_calificado: 'Lead calificado', oportunidad: 'Oportunidad', cliente: 'Cliente', descalificado: 'Descalificado', rezagado: 'Rezagado', churned: 'Churn', suscriptor: 'Suscriptor' };
const CITA: Record<string, string> = { agendada: 'Agendada', confirmada: 'Confirmada', asistio: 'Asistió', no_asistio: 'No asistió', cancelada: 'Cancelada', reagendada: 'Reagendada' };
const COTI: Record<string, string> = { sent: 'Enviada', accepted: 'Aceptada', paid: 'Pagada', expired: 'Vencida', rejected: 'Rechazada', deleted: 'Borrada' };

export function BotonContexto({ onClick, compacto }: { onClick: () => void; compacto?: boolean }) {
  return (
    <button type="button" onClick={onClick} title="Ver la conversación completa de este lead"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #d9d4ea', background: '#fff', color: '#4c1d95', borderRadius: 999, padding: compacto ? '3px 9px' : '5px 11px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12c0 4-4 7-9 7-1.3 0-2.5-.2-3.6-.6L3 20l1.6-4.2C3.6 14.7 3 13.4 3 12c0-4 4-7 9-7s9 3 9 7z"/></svg>
      {compacto ? 'Conversación' : 'Ver conversación'}
    </button>
  );
}

export default function ContextoLead({ contactId, open, onClose, acciones = [], titulo, inline }: { contactId: string | null; open: boolean; onClose: () => void; acciones?: AccionContexto[]; titulo?: ReactNode; inline?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [n, setN] = useState(20);
  useEffect(() => { if ((!open && !inline) || !contactId) return; setD(null); fetch(`/api/crm/ti/contexto?contact_id=${contactId}&n=${n}`).then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' })); }, [open, contactId, n, inline]);
  const k = d?.contacto; const emp = k?.companies?.nombre_comercial || k?.companies?.nombre;
  const lab = { fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: '#8e88a8', margin: '14px 0 6px' };
  const cuerpo = (
    <>
      <div style={{ padding: '4px 18px 90px', fontSize: 13.5, color: '#241d43' }}>
        {!d && <p style={{ color: '#8e88a8' }}>Cargando…</p>}
        {d?.error && <p style={{ color: '#b91c1c' }}>{d.error}</p>}
        {d && !d.error && (<>
          {/* Quién es, en una tira */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12.5, color: '#6b6580', marginTop: 6 }}>
            {k?.fuente && <span>Canal: <b style={{ color: '#241d43' }}>{k.fuente}</b></span>}
            {(k?.giro || k?.companies?.giro) && <span>Giro: <b style={{ color: '#241d43' }}>{k.giro || k.companies?.giro}</b></span>}
            {(k?.sucursales_interes || k?.companies?.sucursales) && <span>Sucursales: <b style={{ color: '#241d43' }}>{k.sucursales_interes || k.companies?.sucursales}</b></span>}
            {k?.estatus_lead && <span>Estatus: <b style={{ color: '#241d43' }}>{k.estatus_lead}</b></span>}
            {k?.created_at && <span>Llegó: <b style={{ color: '#241d43' }}>{fecha(k.created_at)}</b></span>}
          </div>
          {d.perfil?.resumen && <div style={{ marginTop: 10, background: '#faf9fc', border: '1px solid #ecebf2', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.45 }}>{d.perfil.resumen}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: 11, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '3px 9px', fontWeight: 700 }}>Agente: ciclo {d.agente.ciclo} · {d.agente.validos}/{d.agente.intentos} intentos válidos{d.agente.fase ? ` · ${d.agente.fase}` : ''}{d.agente.modo === 'sugerir' ? ' · sugiere' : ''}{d.perfil?.silenciar_ia ? ' · apagado' : ''}</span>
            {(d.citas || []).slice(0, 2).map((c: any) => <span key={c.id} style={{ fontSize: 11, background: c.estado === 'asistio' ? '#dcfce7' : '#e0e7ff', color: c.estado === 'asistio' ? '#14532d' : '#1e3a8a', borderRadius: 999, padding: '3px 9px', fontWeight: 700 }}>Cita {CITA[c.estado] || c.estado} · {c.fecha} {String(c.hora_inicio || '').slice(0, 5)}</span>)}
            {(d.cotizaciones || []).slice(0, 2).map((q: any) => <span key={q.id} style={{ fontSize: 11, background: '#fef3c7', color: '#78350f', borderRadius: 999, padding: '3px 9px', fontWeight: 700 }}>Cotización {COTI[q.estado] || q.estado}{q.total ? ` · $${Number(q.total).toLocaleString('es-MX')}` : ''}</span>)}
          </div>

          {(d.senales || []).length > 0 && (<><div style={lab}>Señales</div><div style={{ display: 'grid', gap: 3, fontSize: 12 }}>{d.senales.slice(0, 5).map((s: any, i: number) => <div key={i} style={{ color: '#4a4658' }}><span style={{ color: '#8e88a8' }}>{new Date(s.ocurrio_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span> · {s.tipo === 'cotizacion_vista' ? `abrió la cotización${s.detalle?.numero ? ` #${s.detalle.numero}` : ''}${s.detalle?.aperturas_24h > 1 ? ` (${s.detalle.aperturas_24h} veces hoy)` : ''}` : s.tipo.replace(/_/g, ' ')}{s.accion === 'mensaje_unico' ? <span style={{ color: '#14532d' }}> · el agente le escribió</span> : null}</div>)}</div></>)}
          <div style={lab}>Últimos {d.mensajes.length} mensajes {d.mensajes.length >= n && <button onClick={() => setN(n + 20)} style={{ marginLeft: 8, border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, letterSpacing: 0, textTransform: 'none' }}>ver 20 más</button>}</div>
          {!d.mensajes.length && <p style={{ color: '#8e88a8', fontSize: 12.5 }}>Sin mensajes de WhatsApp con este lead.</p>}
          <div style={{ display: 'grid', gap: 6 }}>
            {d.mensajes.map((m: any) => {
              const lead = m.quien === 'lead'; const agente = m.quien === 'agente';
              const texto = m.cuerpo || m.transcript || (m.tipo && m.tipo !== 'text' ? `[${m.tipo}${m.filename ? `: ${m.filename}` : ''}]` : '');
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: lead ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '84%', background: lead ? '#fff' : agente ? '#EEECFE' : '#e7f7ee', border: `1px solid ${lead ? '#e8e5f0' : agente ? '#d9d4ea' : '#c9ead6'}`, borderRadius: 12, padding: '7px 11px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: lead ? '#8e88a8' : agente ? '#4c1d95' : '#14532d', marginBottom: 2 }}>{lead ? (k?.nombre || 'Lead') : agente ? 'Agente IA' : (m.quien === 'equipo' ? 'Equipo' : m.quien)} · {fecha(m.created_at)}{m.status === 'failed' ? ' · falló' : ''}</div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, fontSize: 13 }}>{texto}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {!!(d.llamadas || []).length && (<><div style={lab}>Llamadas</div>
            {d.llamadas.map((l: any) => <div key={l.id} style={{ fontSize: 12.5, padding: '6px 0', borderTop: '1px solid #f0eef6' }}><b>{l.direccion === 'entrante' ? 'Entrante' : 'Saliente'}</b> · {fecha(l.started_at)} · {l.duracion_seg ? `${Math.round(l.duracion_seg / 60)} min` : l.estado}{l.atendida_por_nombre ? ` · ${l.atendida_por_nombre}` : ''}{l.minuta && <div style={{ color: '#6b6580', marginTop: 3 }}>{String(l.minuta).slice(0, 400)}</div>}</div>)}</>)}
          {!!(d.notas || []).length && (<><div style={lab}>Notas del equipo</div>
            {d.notas.map((x: any) => <div key={x.id} style={{ fontSize: 12.5, padding: '6px 0', borderTop: '1px solid #f0eef6' }}><b>{x.autor || 'Equipo'}</b> · {fecha(x.created_at)}<div style={{ color: '#6b6580', marginTop: 2 }}>{x.texto}</div></div>)}</>)}
          {d.perfil && Object.keys(d.perfil.datos || {}).length > 0 && (<><div style={lab}>Lo que el agente ya sabe</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{Object.entries(d.perfil.datos).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object').slice(0, 14).map(([kk, v]) => <span key={kk} style={{ fontSize: 11.5, background: '#faf9fc', border: '1px solid #ecebf2', borderRadius: 8, padding: '3px 8px' }}><span style={{ color: '#8e88a8' }}>{kk}:</span> {String(v)}</span>)}</div></>)}
        </>)}
      </div>
      {!!acciones.length && (
        <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e8e5f0', padding: '10px 18px', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {acciones.map((a, i) => <button key={i} disabled={a.disabled} onClick={async () => { await a.onClick(); }} style={{ border: a.primario ? 'none' : '1px solid #e8e5f0', background: a.primario ? '#5B4BD6' : '#fff', color: a.primario ? '#fff' : '#241d43', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: a.disabled ? .5 : 1 }}>{a.label}</button>)}
        </div>
      )}
    </>
  );
  if (inline) return <div style={{ height: '100%', overflowY: 'auto' }}>{cuerpo}</div>;
  return (
    <Sheet open={open} onClose={onClose} width={640} zIndex={1200}
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo || (k ? `${k.nombre || 'Sin nombre'}${emp ? ` · ${emp}` : ''}` : 'Conversación')}</span>{k && <span style={{ fontSize: 11, fontWeight: 800, background: '#EEECFE', color: '#4c1d95', borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>{ETAPA[k.lifecycle_stage] || k.lifecycle_stage}</span>}</span>}>
      {cuerpo}
    </Sheet>
  );
}


/* ═══ MiniHilo ═══ Los últimos N mensajes del lead DENTRO de la tarjeta, sin abrir nada: para decidir rápido.
   «Ver más» trae 15 más; «Abrir completa» abre el drawer. */
export function MiniHilo({ contactId, n = 12, onAbrir, abiertoInicial = true }: { contactId: string; n?: number; onAbrir?: () => void; abiertoInicial?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [cuantos, setCuantos] = useState(n);
  const [abierto, setAbierto] = useState(abiertoInicial);
  useEffect(() => { setD(null); fetch(`/api/crm/ti/contexto?contact_id=${contactId}&n=${cuantos}`).then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' })); }, [contactId, cuantos]);
  const k = d?.contacto;
  return (
    <div style={{ margin: '10px 0 4px', border: '1px solid #ecebf2', borderRadius: 12, background: '#faf9fc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <button type="button" onClick={() => setAbierto(a => !a)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', padding: 0 }}>{abierto ? '▾' : '▸'} Últimos mensajes{d?.mensajes ? ` (${d.mensajes.length})` : ''}</button>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {abierto && d?.mensajes?.length >= cuantos && <button type="button" onClick={() => setCuantos(c => c + 15)} style={{ border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5 }}>ver 15 más</button>}
          {onAbrir && <button type="button" onClick={onAbrir} style={{ border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5 }}>abrir completa</button>}
        </span>
      </div>
      {abierto && (
        <div style={{ padding: '0 12px 10px', maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 5 }}>
          {!d && <span style={{ color: '#8e88a8', fontSize: 12 }}>Cargando…</span>}
          {d?.error && <span style={{ color: '#b91c1c', fontSize: 12 }}>{d.error}</span>}
          {d && !d.error && !d.mensajes.length && <span style={{ color: '#8e88a8', fontSize: 12 }}>Sin mensajes de WhatsApp con este lead.</span>}
          {(d?.mensajes || []).map((m: any) => {
            const lead = m.quien === 'lead'; const agente = m.quien === 'agente';
            const texto = m.cuerpo || m.transcript || (m.tipo && m.tipo !== 'text' ? `[${m.tipo}]` : '');
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: lead ? 'flex-start' : 'flex-end' }}>
                <div style={{ maxWidth: '86%', background: lead ? '#fff' : agente ? '#EEECFE' : '#e7f7ee', border: `1px solid ${lead ? '#e8e5f0' : agente ? '#d9d4ea' : '#c9ead6'}`, borderRadius: 10, padding: '5px 9px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: lead ? '#8e88a8' : agente ? '#4c1d95' : '#14532d' }}>{lead ? (k?.nombre || 'Lead') : agente ? 'Agente IA' : (m.quien === 'equipo' ? 'Equipo' : m.quien)} · {fecha(m.created_at)}</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4, fontSize: 12.5 }}>{String(texto).slice(0, 600)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
