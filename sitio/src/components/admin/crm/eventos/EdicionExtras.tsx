// LAS VISTAS QUE LLEGARON CON LOS 10 PUNTOS · seguimiento, turnos, citas y ruta.
//
// Viven aparte de Edicion.tsx para que esa pantalla siga leyéndose de corrido.
// Todas reciben lo que ya trae GET /api/crm/eventos/edicion y devuelven acciones
// por `accion({accion:…})`; ninguna consulta por su cuenta salvo los huecos del
// stand y la audiencia de la invitación, que dependen de lo que se elige.
import { useEffect, useMemo, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import Sheet from '../ui/Sheet';
import FormRegistro from './FormRegistro';
import { TEMP_TONO, GIROS, Pastilla, Btn, Campo, INPUT, Seccion, fmt, fechaHora, diaMX } from './ui';

type Accion = (body: any) => Promise<any>;
const HORAS = Array.from({ length: 4 * 14 }, (_, i) => `${String(8 + Math.floor(i / 4)).padStart(2, '0')}:${['00', '15', '30', '45'][i % 4]}`);
const diasEntre = (a: string, b?: string | null) => { const out: string[] = []; for (let d = new Date(a + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= (b || a) && out.length < 14; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; };
const diaLargo = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
const horaDe = (t?: string | null) => String(t || '').slice(0, 5);

// ─────────────────────────────────────────────────────────────────────────────
// Punto 1 · Seguimiento: la bandeja de después de la feria.
// Cada persona por temperatura, y en un toque: le escribí · respondió · demo.
// ─────────────────────────────────────────────────────────────────────────────
export function Seguimiento({ registros, edicion, equipo, isMobile, accion }: { registros: any[]; edicion: any; equipo: any[]; isMobile: boolean; accion: Accion }) {
  const [solo, setSolo] = useState<'pendientes' | 'todos'>('pendientes');
  const [demoDe, setDemoDe] = useState<any>(null);
  const hoy = diaMX();
  const conPermiso = registros.filter(r => r.consentimiento);
  const grupos: [string, any[]][] = (['caliente', 'tibio', 'frio'] as const).map(t => [t, conPermiso.filter(r => (r.temperatura || 'tibio') === t && (solo === 'todos' || !r.demo_at))]);
  const sinContacto = conPermiso.filter(r => !r.contactado_at && !r.demo_at);
  const horas48 = (r: any) => !r.contactado_at && !r.demo_at && (r.temperatura === 'caliente' || r.quiere_demo) && Date.now() - Date.parse(r.capturado_at) > 48 * 3600e3;
  const urgentes = conPermiso.filter(horas48).length;

  if (!conPermiso.length) return <div style={{ ...tarjetaKpi(P.violeta), fontSize: '.8125rem', color: '#555', lineHeight: 1.5 }}>Aquí aparecen, por temperatura, las personas que dijeron que sí. Con un toque marcas que le escribiste, que respondió o que ya tiene demo, y el embudo del resumen se mueve solo.</div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '.8125rem', color: '#555', flex: 1, minWidth: 220 }}>
          <b style={{ color: urgentes ? P.rojoTinta : '#333' }}>{fmt(sinContacto.length)}</b> sin que nadie les escriba{urgentes ? <> · <b style={{ color: P.rojoTinta }}>{fmt(urgentes)}</b> calientes con más de 2 días</> : null}. Un caliente de feria se enfría en tres días.
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['pendientes', 'todos'] as const).map(v => <button key={v} onClick={() => setSolo(v)} style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '5px 11px', borderRadius: 99, cursor: 'pointer', border: `1.5px solid ${solo === v ? P.violeta : '#e4e4e4'}`, background: solo === v ? P.violeta : '#fff', color: solo === v ? '#fff' : '#555' }}>{v === 'pendientes' ? 'Sin demo todavía' : 'Todos'}</button>)}
        </div>
      </div>
      {grupos.map(([t, l]) => l.length > 0 && (
        <Seccion key={t} titulo={`${TEMP_TONO[t].l} · ${fmt(l.length)}`}>
          <div style={{ display: 'grid', gap: 6 }}>
            {l.map(r => {
              const tarde = horas48(r);
              const paso = r.demo_at ? 3 : r.respondio_at ? 2 : r.contactado_at ? 1 : 0;
              const wa = String(r.whatsapp || '').replace(/\D/g, '');
              return (
                <div key={r.id} style={{ ...tarjetaKpi(tarde ? P.rojo : paso === 3 ? P.verde : paso ? P.azul : TEMP_TONO[t].bg === P.rojoAgua ? P.rojo : t === 'tibio' ? P.ambar : P.azul), padding: '10px 14px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 8, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <a href={r.contact_id ? `/admin/crm?tab=pipeline&contact=${r.contact_id}` : undefined} style={{ fontWeight: 700, fontSize: '.9375rem', color: '#222', textDecoration: 'none' }}>{r.nombre || r.empresa || 'Sin nombre'}</a>
                      {r.empresa && r.nombre && <span style={{ fontSize: '.8125rem', color: '#666' }}>{r.empresa}</span>}
                      {r.quiere_demo && <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>Pidió demo</Pastilla>}
                      {r.capturado_via === 'cita' && <Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }}>Vino a su cita</Pastilla>}
                      {tarde && <Pastilla tono={{ bg: P.rojoAgua, fg: P.rojoTinta }}>2+ días sin contacto</Pastilla>}
                    </div>
                    <div style={{ fontSize: '.75rem', color: '#888', marginTop: 3 }}>
                      {[r.whatsapp, r.email].filter(Boolean).join(' · ')} · capturado {fechaHora(r.capturado_at)}
                      {r.contactado_at ? ` · le escribimos ${fechaHora(r.contactado_at)}` : ''}{r.respondio_at ? ` · respondió ${fechaHora(r.respondio_at)}` : ''}{r.demo_at ? ` · demo ${fechaHora(r.demo_at)}` : ''}
                    </div>
                    {r.nota && <div style={{ fontSize: '.8125rem', color: '#444', marginTop: 4 }}>{r.nota}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                    {wa && paso === 0 && <Btn chico nivel="terciario" onClick={() => window.open(`https://wa.me/${wa.length === 10 ? '52' + wa : wa}?text=${encodeURIComponent(`Hola ${String(r.nombre || '').split(' ')[0]}, soy de Sacscloud. Nos conocimos en ${edicion.ev_eventos?.nombre || 'la feria'}.`)}`, '_blank')}>Abrir WhatsApp</Btn>}
                    <Btn chico nivel={paso === 0 ? 'primario' : 'terciario'} disabled={paso >= 1} onClick={() => accion({ accion: 'contactado', registro_id: r.id })}>Le escribí</Btn>
                    <Btn chico nivel={paso === 1 ? 'primario' : 'terciario'} disabled={paso >= 2} onClick={() => accion({ accion: 'respondio', registro_id: r.id })}>Respondió</Btn>
                    <Btn chico nivel={paso === 2 ? 'primario' : paso === 3 ? 'terciario' : 'secundario'} disabled={paso === 3} onClick={() => setDemoDe(r)}>{paso === 3 ? 'Demo agendada' : 'Agendar demo'}</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Seccion>
      ))}
      <Sheet open={!!demoDe} onClose={() => setDemoDe(null)} width={520} zIndex={960} title={demoDe ? `Demo con ${demoDe.nombre || demoDe.empresa}` : ''}>
        {demoDe && <AgendarDemo r={demoDe} edicion={edicion} equipo={equipo} hoy={hoy} onListo={async (b) => { const x = await accion({ accion: 'agendar_demo', registro_id: demoDe.id, ...b }); if (x?.ok) setDemoDe(null); }} onCancelar={() => setDemoDe(null)} />}
      </Sheet>
    </div>
  );
}

/** Punto 2 · la demo se agenda desde el stand: fecha, hora, quién la da y si es aquí mismo. */
function AgendarDemo({ r, edicion, equipo, hoy, onListo, onCancelar }: { r: any; edicion: any; equipo: any[]; hoy: string; onListo: (b: any) => Promise<void>; onCancelar: () => void }) {
  const enFeria = edicion.inicio <= hoy && (edicion.fin || edicion.inicio) >= hoy;
  const [f, setF] = useState<any>({ fecha: enFeria ? hoy : '', hora: '', duracion: 30, en_stand: enFeria, host_id: '', nota: '' });
  const [enviando, setEnviando] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const wa = r.whatsapp || r.contacts?.whatsapp;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ fontSize: '.8125rem', color: '#666', margin: 0, lineHeight: 1.5 }}>Queda en Reuniones con su recordatorio{wa ? ' y la confirmación le llega por WhatsApp al instante' : ''}. La persona pasa a oportunidad.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Campo label="Fecha"><input style={INPUT} type="date" min={hoy} value={f.fecha} onChange={x => set('fecha', x.target.value)} /></Campo>
        <Campo label="Hora"><select style={INPUT} value={f.hora} onChange={x => set('hora', x.target.value)}><option value="">—</option>{HORAS.map(h => <option key={h} value={h}>{h}</option>)}</select></Campo>
        <Campo label="Dura"><select style={INPUT} value={f.duracion} onChange={x => set('duracion', Number(x.target.value))}>{[15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}</select></Campo>
        <Campo label="La da"><select style={INPUT} value={f.host_id} onChange={x => set('host_id', x.target.value)}><option value="">Yo</option>{equipo.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Campo>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.8125rem', color: '#444', cursor: 'pointer' }}><input type="checkbox" checked={f.en_stand} onChange={x => set('en_stand', x.target.checked)} /> Aquí en el stand{edicion.stand_numero ? ` (${edicion.stand_numero})` : ''}</label>
      <Campo label="Nota para la demo"><input style={INPUT} value={f.nota} onChange={x => set('nota', x.target.value)} placeholder="Qué quiere ver" /></Campo>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn nivel="terciario" onClick={onCancelar}>Cancelar</Btn>
        <Btn nivel="primario" disabled={!f.fecha || !f.hora || enviando} onClick={async () => { setEnviando(true); try { await onListo(f); } finally { setEnviando(false); } }}>{enviando ? 'Agendando…' : 'Agendar y confirmar'}</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Punto 7 · Turnos: quién está en el stand cada día y a qué hora.
// El registro capturado en ese rato se le asigna a quien tiene el turno.
// ─────────────────────────────────────────────────────────────────────────────
export function Turnos({ turnos, equipo, edicion, isMobile, accion }: { turnos: any[]; equipo: any[]; edicion: any; isMobile: boolean; accion: Accion }) {
  const dias = diasEntre(edicion.inicio, edicion.fin);
  const [f, setF] = useState<any>({ usuario_id: '', dia: dias[0] || '', desde: horaDe(edicion.horario_stand?.desde) || '10:00', hasta: horaDe(edicion.horario_stand?.hasta) || '18:00' });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const porDia = useMemo(() => { const m: Record<string, any[]> = {}; for (const t of turnos) (m[t.dia] ||= []).push(t); return m; }, [turnos]);
  const hoy = diaMX();
  const ahora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour12: false }).slice(0, 5);
  const activo = (t: any) => t.dia === hoy && horaDe(t.desde) <= ahora && ahora <= horaDe(t.hasta);
  return (
    <div>
      <div style={{ ...tarjetaKpi(P.violeta), fontSize: '.8125rem', color: '#444', lineHeight: 1.5, marginBottom: 14 }}>
        Quien tiene el turno se queda con los registros que se capturen en ese rato (si el formulario no dice otra cosa). Sin turno, el registro es de quien lo captura.
      </div>
      <Seccion titulo="Agregar turno">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <Campo label="Quién"><select style={INPUT} value={f.usuario_id} onChange={x => set('usuario_id', x.target.value)}><option value="">—</option>{equipo.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Campo>
          <Campo label="Día"><select style={INPUT} value={f.dia} onChange={x => set('dia', x.target.value)}>{dias.map(d => <option key={d} value={d}>{diaLargo(d)}</option>)}</select></Campo>
          <Campo label="De"><input style={INPUT} type="time" value={f.desde} onChange={x => set('desde', x.target.value)} /></Campo>
          <Campo label="A"><input style={INPUT} type="time" value={f.hasta} onChange={x => set('hasta', x.target.value)} /></Campo>
          <Btn nivel="primario" disabled={!f.usuario_id || !f.dia} onClick={() => accion({ accion: 'turno', usuario_id: f.usuario_id, dia: f.dia, desde: f.desde, hasta: f.hasta })} style={isMobile ? { gridColumn: '1 / -1' } : undefined}>Agregar</Btn>
        </div>
      </Seccion>
      {dias.map(d => (
        <Seccion key={d} titulo={`${diaLargo(d)}${d === hoy ? ' · hoy' : ''}`}>
          {!(porDia[d] || []).length ? <div style={{ fontSize: '.8125rem', color: '#999' }}>Nadie asignado.</div> : (
            <div style={{ display: 'grid', gap: 5 }}>
              {porDia[d].map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 9, border: `1px solid ${activo(t) ? P.violeta : P.linea}`, background: activo(t) ? P.violetaAgua : '#fff' }}>
                  <span style={{ fontWeight: 800, fontSize: '.8125rem', color: P.violetaTinta, fontVariantNumeric: 'tabular-nums', minWidth: 96 }}>{horaDe(t.desde)}–{horaDe(t.hasta)}</span>
                  <span style={{ fontWeight: 700, fontSize: '.875rem', color: '#222', flex: 1 }}>{t.nombre || equipo.find(m => m.id === t.usuario_id)?.nombre || 'Alguien'}</span>
                  {activo(t) && <Pastilla tono={{ bg: '#fff', fg: P.violetaTinta }}>En el stand ahora</Pastilla>}
                  <button onClick={() => accion({ accion: 'borrar_turno', id: t.id })} title="Quitar turno" style={{ font: 'inherit', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Punto 3 · Citas en el stand antes de la feria.
// La invitación masiva con liga para agendar, los huecos por hora, «Llegó», y
// cuántos de la base vinieron de verdad.
// ─────────────────────────────────────────────────────────────────────────────
export function Citas({ citas, invitacion, edicion, registros, urlCita, isMobile, accion, onCambiarEdicion, onListo }: {
  citas: any[]; invitacion: any; edicion: any; registros: any[]; urlCita: string; isMobile: boolean; accion: Accion; onCambiarEdicion: (c: any) => Promise<void>; onListo: () => void;
}) {
  const dias = diasEntre(edicion.inicio, edicion.fin);
  const hoy = diaMX();
  const [dia, setDia] = useState(dias.includes(hoy) ? hoy : dias[0] || '');
  const [huecos, setHuecos] = useState<{ hora: string; libre: boolean }[] | null>(null);
  const [nueva, setNueva] = useState<string | null>(null); // hora elegida para una cita desde el CRM
  const [llego, setLlego] = useState<any>(null);
  const [invitar, setInvitar] = useState(false);
  const [horario, setHorario] = useState(false);
  const h = edicion.horario_stand || {};
  const [hf, setHf] = useState<any>({ desde: horaDe(h.desde) || '10:00', hasta: horaDe(h.hasta) || '18:00', duracion: h.duracion || 15, cupo: h.cupo || 1 });

  const traerHuecos = () => { if (!dia) return; setHuecos(null); fetch(`/api/crm/eventos/edicion?id=${edicion.id}&huecos=${dia}`).then(r => r.json()).then(j => setHuecos(j.huecos || [])).catch(() => setHuecos([])); };
  useEffect(traerHuecos, [dia, citas.length, edicion.updated_at]);

  const delDia = citas.filter(c => c.dia === dia);
  const vivas = citas.filter(c => c.estado !== 'cancelada');
  const llegaron = citas.filter(c => c.estado === 'llego').length;
  const tono = (c: any) => c.estado === 'llego' ? { bg: P.verdeAgua, fg: P.verdeTinta, l: 'Llegó' } : c.estado === 'no_llego' ? { bg: P.rojoAgua, fg: P.rojoTinta, l: 'No llegó' } : c.estado === 'cancelada' ? { bg: '#f1f1f1', fg: '#777', l: 'Cancelada' } : { bg: P.azulAgua, fg: P.azulTinta, l: 'Agendada' };
  const kpi = (label: string, valor: string, sub: string, franja: string, tinta: string) => (
    <div style={tarjetaKpi(franja)}>
      <div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 800, color: tinta, lineHeight: 1.15, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      <div style={{ fontSize: '.6875rem', color: '#888', marginTop: 3 }}>{sub}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {kpi('Invitados', invitacion ? fmt(invitacion.total || 0) : '–', invitacion ? `${fmt(invitacion.entregados || 0)} entregados · ${fmt(invitacion.respondidos || 0)} respondieron` : 'sin invitación enviada', P.violeta, P.violetaTinta)}
        {kpi('Citas', fmt(vivas.length), `${fmt(citas.filter(c => c.origen === 'liga' || c.origen === 'invitacion').length)} desde la liga · ${fmt(citas.filter(c => c.origen === 'crm').length)} desde el CRM`, P.azul, P.azulTinta)}
        {kpi('Llegaron', fmt(llegaron), vivas.length ? `${Math.round(llegaron / vivas.length * 100)}% de las citas` : 'todavía nadie', P.verde, P.verdeTinta)}
        {kpi('De la base vinieron', invitacion ? fmt(invitacion.llegaron || 0) : '–', invitacion?.total ? `${(100 * (invitacion.llegaron || 0) / invitacion.total).toFixed(1)}% de los invitados se registró` : 'se mide contra los invitados', P.verde, P.verdeTinta)}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '.8125rem', color: '#555', flex: 1, minWidth: 200 }}>
          {urlCita ? <>Liga para apartar cita: <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.75rem', color: P.violetaTinta, wordBreak: 'break-all' }}>{urlCita}</span></> : 'La edición no tiene liga pública todavía.'}
        </span>
        {urlCita && <Btn chico nivel="terciario" onClick={() => { navigator.clipboard?.writeText(urlCita); }}>Copiar liga</Btn>}
        <Btn chico nivel="terciario" onClick={() => setHorario(v => !v)}>Horario del stand</Btn>
        <Btn chico nivel={invitacion ? 'secundario' : 'primario'} onClick={() => setInvitar(true)}>{invitacion ? 'Ver invitación' : 'Invitar a la base'}</Btn>
      </div>

      {horario && (
        <div style={{ ...tarjetaKpi(P.violeta), marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr) auto', gap: 10, alignItems: 'end' }}>
            <Campo label="Abre"><input style={INPUT} type="time" value={hf.desde} onChange={x => setHf({ ...hf, desde: x.target.value })} /></Campo>
            <Campo label="Cierra"><input style={INPUT} type="time" value={hf.hasta} onChange={x => setHf({ ...hf, hasta: x.target.value })} /></Campo>
            <Campo label="Cada"><select style={INPUT} value={hf.duracion} onChange={x => setHf({ ...hf, duracion: Number(x.target.value) })}>{[10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}</select></Campo>
            <Campo label="Citas a la vez" ayuda="cuántas personas del equipo atienden"><select style={INPUT} value={hf.cupo} onChange={x => setHf({ ...hf, cupo: Number(x.target.value) })}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></Campo>
            <Btn nivel="primario" onClick={async () => { await onCambiarEdicion({ horario_stand: hf }); setHorario(false); }} style={isMobile ? { gridColumn: '1 / -1' } : undefined}>Guardar</Btn>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}>
        {dias.map(d => { const n = citas.filter(c => c.dia === d && c.estado !== 'cancelada').length; const on = d === dia; return <button key={d} onClick={() => setDia(d)} style={{ font: 'inherit', fontSize: '.8125rem', fontWeight: 700, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap', border: `1.5px solid ${on ? P.violeta : '#e4e4e4'}`, background: on ? P.violeta : '#fff', color: on ? '#fff' : '#555' }}>{diaLargo(d)}{n ? ` · ${n}` : ''}</button>; })}
      </div>

      {!huecos ? <div style={{ fontSize: '.8125rem', color: '#999' }}>Cargando horas…</div> : !huecos.length ? <div style={{ fontSize: '.8125rem', color: '#999' }}>Ese día no está en el horario del stand.</div> : (
        <div style={{ display: 'grid', gap: 5 }}>
          {huecos.map(hh => {
            const cs = delDia.filter(c => horaDe(c.hora) === hh.hora && c.estado !== 'cancelada');
            const pasada = dia < hoy || (dia === hoy && hh.hora < new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour12: false }).slice(0, 5));
            return (
              <div key={hh.hora} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start', padding: '7px 12px', borderRadius: 9, border: `1px solid ${P.linea}`, background: cs.length ? '#fff' : '#fafafa' }}>
                <span style={{ fontWeight: 800, fontSize: '.8125rem', color: cs.length ? P.violetaTinta : '#aaa', fontVariantNumeric: 'tabular-nums', minWidth: 44, paddingTop: 4 }}>{hh.hora}</span>
                <div style={{ display: 'grid', gap: 6 }}>
                  {cs.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <a href={c.contact_id ? `/admin/crm?tab=pipeline&contact=${c.contact_id}` : undefined} style={{ fontWeight: 700, fontSize: '.875rem', color: '#222', textDecoration: 'none' }}>{c.nombre}</a>
                      {c.empresa && <span style={{ fontSize: '.8125rem', color: '#666' }}>{c.empresa}</span>}
                      {c.giro && <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{GIROS[c.giro] || c.giro}</Pastilla>}
                      <Pastilla tono={tono(c)}>{tono(c).l}</Pastilla>
                      {c.nota && <span style={{ fontSize: '.75rem', color: '#777' }}>{c.nota}</span>}
                      <span style={{ flex: 1 }} />
                      {c.estado === 'agendada' && <>
                        <Btn chico nivel="primario" onClick={() => setLlego(c)}>Llegó</Btn>
                        <Btn chico nivel="terciario" onClick={() => accion({ accion: 'cita_estado', cita_id: c.id, estado: 'no_llego' })}>No llegó</Btn>
                        <Btn chico nivel="destructivo" onClick={() => confirm('¿Cancelar esta cita?') && accion({ accion: 'cita_estado', cita_id: c.id, estado: 'cancelada' })}>Cancelar</Btn>
                      </>}
                      {c.estado === 'no_llego' && <Btn chico nivel="terciario" onClick={() => setLlego(c)}>Sí llegó</Btn>}
                    </div>
                  ))}
                  {hh.libre && !pasada && (nueva === hh.hora ? null : <button onClick={() => setNueva(hh.hora)} style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 600, color: P.violetaTinta, background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', textAlign: 'left' }}>+ apartar aquí</button>)}
                  {nueva === hh.hora && <NuevaCita dia={dia} hora={hh.hora} onListo={async (b) => { const x = await accion({ accion: 'cita', dia, hora: hh.hora, ...b }); if (x?.ok) { setNueva(null); traerHuecos(); } }} onCancelar={() => setNueva(null)} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!llego} onClose={() => setLlego(null)} width={640} zIndex={960} title={llego ? `Llegó ${llego.nombre}` : ''}>
        {llego && (
          <div>
            <p style={{ fontSize: '.8125rem', color: '#666', margin: '0 0 12px' }}>Se registra como visita del stand con lo que dejó al apartar; corrige lo que haga falta y marca si dijo que sí.</p>
            <FormRegistro edicionId={edicion.id} modo="stand" citaId={llego.id} precargado={{ nombre: llego.nombre || '', empresa: llego.empresa || '', whatsapp: llego.whatsapp || '', email: llego.email || '', giro: llego.giro || '', nota: llego.nota || '', temperatura: 'caliente' }}
              onListo={() => { setLlego(null); onListo(); }} onCancelar={() => setLlego(null)} />
          </div>
        )}
      </Sheet>

      <Sheet open={invitar} onClose={() => setInvitar(false)} width={720} zIndex={960} title={invitacion ? 'La invitación al stand' : 'Invitar a la base a una cita en el stand'}>
        {invitar && <Invitar edicion={edicion} invitacion={invitacion} registros={registros} urlCita={urlCita} accion={accion} onListo={() => { setInvitar(false); onListo(); }} />}
      </Sheet>
    </div>
  );
}

function NuevaCita({ dia, hora, onListo, onCancelar }: { dia: string; hora: string; onListo: (b: any) => Promise<void>; onCancelar: () => void }) {
  const [f, setF] = useState<any>({ nombre: '', empresa: '', whatsapp: '', email: '', giro: '', nota: '' });
  const [enviando, setEnviando] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: 'grid', gap: 8, padding: '8px 0 4px' }}>
      <div style={{ fontSize: '.75rem', color: '#777' }}>Cita el {diaLargo(dia)} a las {hora}. Se le confirma por WhatsApp.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input style={INPUT} value={f.nombre} onChange={x => set('nombre', x.target.value)} placeholder="Nombre" autoFocus />
        <input style={INPUT} value={f.empresa} onChange={x => set('empresa', x.target.value)} placeholder="Negocio" />
        <input style={INPUT} value={f.whatsapp} onChange={x => set('whatsapp', x.target.value)} placeholder="WhatsApp (10 dígitos)" inputMode="tel" />
        <input style={INPUT} value={f.email} onChange={x => set('email', x.target.value)} placeholder="Correo (opcional)" inputMode="email" />
        <select style={INPUT} value={f.giro} onChange={x => set('giro', x.target.value)}><option value="">Giro…</option>{Object.entries(GIROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input style={INPUT} value={f.nota} onChange={x => set('nota', x.target.value)} placeholder="Qué quiere ver" />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Btn chico nivel="terciario" onClick={onCancelar}>Cancelar</Btn>
        <Btn chico nivel="primario" disabled={enviando || !f.nombre.trim() || (!f.whatsapp.trim() && !f.email.trim())} onClick={async () => { setEnviando(true); try { await onListo(f); } finally { setEnviando(false); } }}>{enviando ? 'Apartando…' : 'Apartar'}</Btn>
      </div>
    </div>
  );
}

/** La invitación masiva: plantilla aprobada + giro/estado → a quién le llega, y luego cómo va. */
function Invitar({ edicion, invitacion, registros, urlCita, accion, onListo }: { edicion: any; invitacion: any; registros: any[]; urlCita: string; accion: Accion; onListo: () => void }) {
  const [plantillas, setPlantillas] = useState<any[] | null>(null);
  const [plantilla, setPlantilla] = useState('');
  const [giro, setGiro] = useState('');
  const [estado, setEstado] = useState('');
  const [audiencia, setAudiencia] = useState<any[] | null>(null);
  const [fuera, setFuera] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [otra, setOtra] = useState(false);
  useEffect(() => { fetch('/api/crm/whatsapp/plantillas?aprobadas=1').then(r => r.json()).then(j => setPlantillas((j.plantillas || []).filter((p: any) => Number(p.variables || 0) <= 4))).catch(() => setPlantillas([])); }, []);
  useEffect(() => {
    if (invitacion && !otra) return;
    setAudiencia(null);
    const t = setTimeout(() => fetch(`/api/crm/eventos/edicion?id=${edicion.id}&audiencia=1&giro=${encodeURIComponent(giro)}&estado=${encodeURIComponent(estado)}`).then(r => r.json()).then(j => setAudiencia(j.audiencia || [])).catch(() => setAudiencia([])), 250);
    return () => clearTimeout(t);
  }, [giro, estado, otra]);
  const p = plantillas?.find(x => x.id === plantilla);
  const vista = p ? String(p.cuerpo || '').replace('{{1}}', 'Mariana').replace('{{2}}', edicion.ev_eventos?.nombre || 'la feria').replace('{{3}}', edicion.stand_numero || 'Sacscloud').replace('{{4}}', urlCita || 'https://www.sacscloud.com/e/…/cita') : '';
  const elegidos = (audiencia || []).filter(c => !fuera.has(c.contact_id));

  if (invitacion && !otra) {
    const pct = (n: number) => invitacion.total ? `${Math.round(100 * n / invitacion.total)}%` : '–';
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: '.8125rem', color: '#555', lineHeight: 1.5 }}><b>{invitacion.nombre}</b> · {fechaHora(invitacion.created_at)} · estado <b>{invitacion.status}</b></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[['Enviados', invitacion.enviados, P.violeta, P.violetaTinta], ['Entregados', invitacion.entregados, P.azul, P.azulTinta], ['Leídos', invitacion.leidos, P.azul, P.azulTinta], ['Respondieron', invitacion.respondidos, P.verde, P.verdeTinta], ['Fallaron', invitacion.fallidos, P.rojo, P.rojoTinta], ['Vinieron al stand', invitacion.llegaron, P.verde, P.verdeTinta]].map(([l, n, fr, ti]: any) => (
            <div key={l} style={tarjetaKpi(fr)}><div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div><div style={{ fontSize: '1.25rem', fontWeight: 800, color: ti, fontVariantNumeric: 'tabular-nums' }}>{fmt(n || 0)}</div><div style={{ fontSize: '.6875rem', color: '#888' }}>{pct(n || 0)} de {fmt(invitacion.total || 0)}</div></div>
          ))}
        </div>
        <div style={{ fontSize: '.75rem', color: '#777', lineHeight: 1.5 }}>Si quedó en borrador, se manda desde WhatsApp → Masivos (ahí se revisa y se programa). «Vinieron al stand» cuenta a los invitados que aparecen en los registros de esta edición: {fmt(registros.length)} registros hasta ahora.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn nivel="terciario" onClick={() => window.dispatchEvent(new CustomEvent('crm:destino', { detail: 'whatsapp' }))}>Ir a Masivos</Btn>
          <Btn nivel="secundario" onClick={() => setOtra(true)}>Mandar otra invitación</Btn>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: '.8125rem', color: '#555', lineHeight: 1.5 }}>Sale por WhatsApp con una plantilla aprobada. Variables: <b>{'{{1}}'}</b> nombre · <b>{'{{2}}'}</b> feria · <b>{'{{3}}'}</b> stand · <b>{'{{4}}'}</b> liga para apartar cita. Se crea como masivo en borrador: se revisa y se manda desde WhatsApp → Masivos.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Campo label="Plantilla" ancho={3}>
          <select style={INPUT} value={plantilla} onChange={x => setPlantilla(x.target.value)}><option value="">—</option>{(plantillas || []).map(x => <option key={x.id} value={x.id}>{x.nombre} · {x.variables || 0} var.</option>)}</select>
          {plantillas && !plantillas.length && <span style={{ fontSize: '.6875rem', color: P.ambarTinta }}>No hay plantillas aprobadas de hasta 4 variables. Créala en WhatsApp → Plantillas.</span>}
        </Campo>
        <Campo label="Giro (contiene)"><input style={INPUT} value={giro} onChange={x => setGiro(x.target.value)} placeholder="boutique, zapat…" /></Campo>
        <Campo label="Estado (contiene)"><input style={INPUT} value={estado} onChange={x => setEstado(x.target.value)} placeholder="Jalisco, CDMX…" /></Campo>
        <Campo label="A quién"><div style={{ ...INPUT, background: '#f7f7fb', fontWeight: 700, color: P.violetaTinta }}>{audiencia ? `${fmt(elegidos.length)} contactos` : 'contando…'}</div></Campo>
      </div>
      {vista && <div style={{ fontSize: '.75rem', color: '#555', background: '#f7f7fb', border: `1px solid ${P.linea}`, borderRadius: 8, padding: '8px 10px', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{vista}</div>}
      {audiencia && audiencia.length > 0 && (
        <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${P.linea}`, borderRadius: 9 }}>
          {audiencia.slice(0, 400).map(c => (
            <label key={c.contact_id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', fontSize: '.8125rem', borderBottom: `1px solid ${P.linea}`, cursor: 'pointer', opacity: fuera.has(c.contact_id) ? .5 : 1 }}>
              <input type="checkbox" checked={!fuera.has(c.contact_id)} onChange={x => { const s = new Set(fuera); x.target.checked ? s.delete(c.contact_id) : s.add(c.contact_id); setFuera(s); }} />
              <b style={{ color: '#222' }}>{c.nombre}</b><span style={{ color: '#666' }}>{c.empresa}</span><span style={{ color: '#999', fontSize: '.75rem' }}>{[c.giro, c.ciudad || c.estado, c.etapa].filter(Boolean).join(' · ')}</span>
            </label>
          ))}
          {audiencia.length > 400 && <div style={{ padding: '6px 10px', fontSize: '.75rem', color: '#999' }}>y {fmt(audiencia.length - 400)} más (se incluyen).</div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn nivel="primario" disabled={!plantilla || !elegidos.length || enviando} onClick={async () => {
          setEnviando(true);
          try { const r = await accion({ accion: 'invitar', plantilla_id: plantilla, giro, estado, contact_ids: fuera.size ? elegidos.map(c => c.contact_id) : undefined, otra }); if (r?.ok) { alert(`Invitación creada en borrador para ${fmt(elegidos.length)} contactos. Revísala y mándala desde WhatsApp → Masivos.`); onListo(); } }
          finally { setEnviando(false); }
        }}>{enviando ? 'Creando…' : `Crear invitación para ${fmt(elegidos.length)}`}</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Punto 8 · Ruta del recorrido: por pabellón y pasillo, con cobertura.
// ─────────────────────────────────────────────────────────────────────────────
const numStand = (s: any) => { const m = String(s || '').match(/\d+/); return m ? Number(m[0]) : 1e9; };
export function Ruta({ expositores, isMobile, accion, onRegistrar }: { expositores: any[]; isMobile: boolean; accion: Accion; onRegistrar: (x: any) => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const grupos = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const x of expositores) (m[x.pabellon || 'Sin pabellón'] ||= []).push(x);
    return Object.entries(m).map(([k, l]) => [k, l.sort((a, b) => numStand(a.stand) - numStand(b.stand) || String(a.stand || '').localeCompare(String(b.stand || '')))] as [string, any[]]).sort((a, b) => a[0] === 'Sin pabellón' ? 1 : b[0] === 'Sin pabellón' ? -1 : a[0].localeCompare(b[0]));
  }, [expositores]);
  const visitados = expositores.filter(x => x.visitado).length;
  if (!expositores.length) return null;
  return (
    <div>
      <div style={{ ...tarjetaKpi(visitados === expositores.length ? P.verde : P.violeta), marginBottom: 12, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>Cobertura</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 800, color: visitados === expositores.length ? P.verdeTinta : P.violetaTinta, fontVariantNumeric: 'tabular-nums' }}>{fmt(visitados)} de {fmt(expositores.length)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ height: 8, borderRadius: 4, background: '#eee', overflow: 'hidden' }}><div style={{ width: `${expositores.length ? 100 * visitados / expositores.length : 0}%`, height: '100%', background: visitados === expositores.length ? P.verde : P.violeta }} /></div>
          <div style={{ fontSize: '.6875rem', color: '#888', marginTop: 4 }}>{grupos.length} {grupos.length === 1 ? 'pabellón' : 'pabellones'} · en orden de stand para recorrer sin regresar</div>
        </div>
      </div>
      {grupos.map(([pab, l]) => (
        <Seccion key={pab} titulo={`${pab} · ${l.filter(x => x.visitado).length} de ${l.length}`}>
          <div style={{ display: 'grid', gap: 5 }}>
            {l.map(x => (
              <div key={x.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'auto 1fr' : 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 9, border: `1px solid ${P.linea}`, background: x.visitado ? '#fafafa' : '#fff', opacity: x.visitado ? .7 : 1 }}>
                <div style={{ minWidth: 58, textAlign: 'center', fontWeight: 800, fontSize: '.9375rem', color: P.violetaTinta, fontVariantNumeric: 'tabular-nums' }}>{x.stand || '—'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.875rem', color: '#222', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {x.nombre}
                    {x.asignado_nombre && <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{x.asignado_nombre}</Pastilla>}
                    {x.registro_id && <Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }}>Registrado</Pastilla>}
                  </div>
                  {editando === x.id ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input style={{ ...INPUT, padding: '5px 9px', fontSize: '.8125rem' }} value={nota} onChange={e => setNota(e.target.value)} placeholder="Qué preguntar, qué vimos" autoFocus onKeyDown={e => { if (e.key === 'Enter') { accion({ accion: 'expositor', expositor_id: x.id, nota }); setEditando(null); } if (e.key === 'Escape') setEditando(null); }} />
                      <Btn chico nivel="primario" onClick={() => { accion({ accion: 'expositor', expositor_id: x.id, nota }); setEditando(null); }}>Guardar</Btn>
                    </div>
                  ) : (
                    <div style={{ fontSize: '.75rem', color: x.nota ? '#444' : '#aaa', marginTop: 2, cursor: 'pointer' }} onClick={() => { setEditando(x.id); setNota(x.nota || ''); }}>{x.nota || '+ nota'}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <Btn chico nivel={x.registro_id ? 'terciario' : 'primario'} onClick={() => onRegistrar(x)}>{x.registro_id ? 'Otro' : 'Registrar'}</Btn>
                  <Btn chico nivel="terciario" onClick={() => accion({ accion: 'visitado', expositor_id: x.id, visitado: !x.visitado })}>{x.visitado ? 'No visitado' : 'Visitado'}</Btn>
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      ))}
    </div>
  );
}

/** Repartir la ruta: cada expositor sin asignar se le da a alguien del equipo (turnos o equipo de la edición). */
export function AsignarRuta({ expositores, equipo, accion }: { expositores: any[]; equipo: any[]; accion: Accion }) {
  const [quien, setQuien] = useState('');
  const sin = expositores.filter(x => !x.asignado_a && !x.visitado);
  if (!expositores.length || !equipo.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select style={{ ...INPUT, width: 'auto', padding: '5px 9px', fontSize: '.8125rem' }} value={quien} onChange={x => setQuien(x.target.value)}><option value="">Asignar los {fmt(sin.length)} sin dueño a…</option>{equipo.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
      <Btn chico nivel="secundario" disabled={!quien || !sin.length} onClick={async () => { for (const x of sin) await accion({ accion: 'expositor', expositor_id: x.id, asignado_a: quien }); setQuien(''); }}>Asignar</Btn>
    </div>
  );
}
