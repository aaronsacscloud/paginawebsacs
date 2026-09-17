// Cuentas objetivo · HOY: la pantalla que contesta «¿qué salió, qué se atoró y
// quién contestó?» sin abrir una terminal.
//
// Nació de una semana en la que tres cosas se descubrieron con SQL a mano: 554
// correos esperando con 115 vencidos, la cadencia de novias escribiendo
// correos que nunca salían porque los goteos grandes se llevaban el cupo, y un
// tope real de veintitantos correos —el dominio calentando— contra los 320
// configurados. Nada de eso se veía en el CRM.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import { GIROS } from '../../../../lib/crm/abm-giros';
import Cargando from '../ui/Cargando';
import { Pastilla, fmt } from './ui';

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const cuando = (s?: string | null) => {
  if (!s) return '—';
  const h = Math.round((Date.now() - Date.parse(s)) / 36e5);
  if (h < 1) return 'hace un momento';
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
};

export default function Hoy({ giro }: { giro?: string }) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const traer = () => fetch(`/api/crm/abm/panel${giro ? `?giro=${encodeURIComponent(giro)}` : ''}`)
    .then(r => r.json()).then(r => { setD(r); setCargando(false); }).catch(() => setCargando(false));
  useEffect(() => { traer(); }, [giro]);

  const prioridad = async (id: string, valor: number) => {
    setTrabajando(id); setAviso(null);
    try {
      const r = await fetch('/api/crm/abm/goteo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'prioridad', id, prioridad: valor }),
      }).then(x => x.json());
      setAviso(r?.ok ? 'Listo: el reparto del cupo ya cambió para la próxima corrida.' : (r?.error || 'No se pudo'));
      await traer();
    } finally { setTrabajando(null); }
  };

  if (cargando && !d) return <Cargando texto="Leyendo cómo va la prospección…" />;
  const t = d?.totales || {};
  const rem = d?.remitentes || [];
  const cupoTotal = rem.reduce((a: number, r: any) => a + Number(r.cupo || 0), 0);
  const enviadosHoy = rem.reduce((a: number, r: any) => a + Number(r.enviados_hoy || 0), 0);
  const embudo = (d?.embudo || []).filter((e: any) => Number(e.numero) <= 8);
  const porNumero: any[] = [];
  for (const e of embudo) {
    const i = Number(e.numero) - 1;
    porNumero[i] = porNumero[i] || { numero: e.numero, asunto: e.asunto, toques: 0, enviados: 0, abiertos: 0, clics: 0, cancelados: 0 };
    for (const k of ['toques', 'enviados', 'abiertos', 'clics', 'cancelados']) porNumero[i][k] += Number(e[k] || 0);
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* ── Lo que hay que mirar hoy ─────────────────────────────────────── */}
      {(d?.alertas || []).length > 0 && (
        <div style={{ display: 'grid', gap: 7 }}>
          {d.alertas.map((a: any, i: number) => (
            <div key={i} style={{
              display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: '.875rem', lineHeight: 1.5,
              background: a.nivel === 'alto' ? P.rojoAgua : P.ambarAgua, color: a.nivel === 'alto' ? P.rojoTinta : P.ambarTinta,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <span style={{ fontWeight: 800, fontSize: '.6875rem', letterSpacing: '.06em', textTransform: 'uppercase', paddingTop: 2 }}>
                {a.nivel === 'alto' ? 'Atención' : 'Ojo'}
              </span>
              <span>{a.texto}</span>
            </div>
          ))}
        </div>
      )}
      {aviso && <div style={{ fontSize: '.8125rem', color: P.verdeTinta, background: P.verdeAgua, borderRadius: 8, padding: '8px 12px' }}>{aviso}</div>}

      {/* ── El semáforo del día ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 11 }}>
        {kpi('Cupo de hoy', fmt(cupoTotal), `${rem.length} remitente(s) · tope ${fmt(d?.motor?.tope_diario || 0)}`, P.violeta, P.violetaTinta)}
        {kpi('Salieron hoy', fmt(enviadosHoy), `${pct(enviadosHoy, cupoTotal)}% del cupo`, P.verde, P.verdeTinta)}
        {kpi('En la fila', fmt(t.en_fila || 0), `${fmt(t.borradores || 0)} sin aprobar`, P.azul, P.azulTinta)}
        {kpi('Vencidos', fmt(t.vencidos || 0), t.vencidos ? 'debían haber salido ya' : 'nada atrasado', t.vencidos ? P.rojo : P.verde, t.vencidos ? P.rojoTinta : P.verdeTinta)}
        {kpi('Últimas 24 h', fmt(t.enviados_24h || 0), `${fmt(t.enviados || 0)} enviados en total`, P.rosa, P.rosaTinta)}
      </div>

      {/* ── La rampa de cada remitente ───────────────────────────────────── */}
      <Bloque titulo="El calentamiento de cada dominio"
        pista="La rampa sube 30% cada tres días CON ENVÍOS. Un dominio nuevo empieza en quince correos aunque el otro lleve meses: son reputaciones separadas.">
        <div style={{ display: 'grid', gap: 10 }}>
          {rem.map((r: any) => (
            <div key={r.slug} style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '.8125rem' }}>
                <b>{r.from_email}</b>
                <span style={{ color: '#888' }}>día {r.dias_calentando} de rampa · hoy puede {fmt(r.cupo)}{r.dias_al_tope ? ` · llega al tope en ~${r.dias_al_tope} días de envío` : ' · ya está en el tope'}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: P.violetaTinta }}>{fmt(r.enviados_hoy)} / {fmt(r.cupo)}</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: P.violetaAgua, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, pct(r.enviados_hoy, r.cupo))}%`, height: '100%', background: P.violeta }} />
              </div>
            </div>
          ))}
        </div>
      </Bloque>

      {/* ── La fila por giro ─────────────────────────────────────────────── */}
      <Bloque titulo="Quién está esperando" pista="Lo que ya está escrito y aprobado, por giro y país. «Vencidos» es lo que tenía fecha de salir y no salió.">
        <Tabla cabeceras={['Giro', 'País', 'Canal', 'En fila', 'Vencidos', 'Enviados', '24 h', 'Último envío']}
          filas={(d?.fila || []).filter((f: any) => f.en_fila || f.enviados).sort((a: any, b: any) => b.vencidos - a.vencidos || b.en_fila - a.en_fila).map((f: any) => [
            GIROS[f.giro] || f.giro, f.pais, f.canal === 'email' ? 'Correo' : 'WhatsApp',
            fmt(f.en_fila), f.vencidos ? <b style={{ color: P.rojoTinta }}>{fmt(f.vencidos)}</b> : '—',
            fmt(f.enviados), fmt(f.enviados_24h), cuando(f.ultimo_envio),
          ])} />
      </Bloque>

      {/* ── Los goteos y el reparto del cupo ─────────────────────────────── */}
      <Bloque titulo="El reparto del cupo"
        pista="Cuando el cupo no alcanza para todos, entra antes el de prioridad más baja (1 primero, 9 al final). Es lo que hacía que novias llevara días escribiendo correos que nunca salían.">
        <div style={{ display: 'grid', gap: 9 }}>
          {(d?.goteos || []).map((g: any) => (
            <div key={g.id} style={{ border: `1px solid ${P.linea}`, borderRadius: 10, padding: '11px 14px', background: '#fff', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '.875rem' }}>{g.nombre}</b>
                <Pastilla tono={g.estado === 'activo' ? { bg: P.verdeAgua, fg: P.verdeTinta } : { bg: P.ambarAgua, fg: P.ambarTinta }}>
                  {g.estado === 'activo' ? 'Activo' : 'En pausa'}
                </Pastilla>
                <span style={{ fontSize: '.75rem', color: '#888' }}>{g.cuentas_dia} al día · {GIROS[g.cadencia?.giro] || g.cadencia?.giro}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: '.6875rem', color: '#999', marginRight: 4 }}>Prioridad</span>
                  {[1, 3, 5, 7, 9].map(n => (
                    <button key={n} disabled={!!trabajando} onClick={() => prioridad(g.id, n)}
                      style={{
                        font: 'inherit', fontSize: '.6875rem', fontWeight: 700, width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
                        border: Number(g.prioridad) === n ? 'none' : `1px solid ${P.linea}`,
                        background: Number(g.prioridad) === n ? P.violeta : '#fff',
                        color: Number(g.prioridad) === n ? '#fff' : '#777',
                      }}>{n}</button>
                  ))}
                </span>
              </div>
              <div style={{ fontSize: '.75rem', color: g.ultimo && !g.ultimo.cuentas ? P.ambarTinta : '#888' }}>
                {g.ultimo
                  ? (g.ultimo.cuentas
                    ? `Último lote ${g.ultimo.fecha}: entraron ${g.ultimo.cuentas} cuentas${g.ultimo.sin_ia ? ` (${g.ultimo.sin_ia} sin IA)` : ''}.`
                    : `Último lote ${g.ultimo.fecha}: no entró ninguna — ${g.ultimo.motivo || 'sin motivo apuntado'}.`)
                  : 'Todavía no ha corrido ningún día.'}
              </div>
            </div>
          ))}
        </div>
      </Bloque>

      {/* ── El embudo: qué correo funciona ───────────────────────────────── */}
      {porNumero.filter(Boolean).length > 0 && (
        <Bloque titulo="Correo por correo" pista="En cuál se cae la gente y cuál se abre. El número es el orden en que los recibe el negocio.">
          <Tabla cabeceras={['#', 'Asunto de ejemplo', 'Escritos', 'Enviados', 'Abiertos', 'Clics', 'Cancelados']}
            filas={porNumero.filter(Boolean).map((e: any) => [
              e.numero, e.asunto || '—', fmt(e.toques), fmt(e.enviados),
              e.enviados ? `${fmt(e.abiertos)} · ${pct(e.abiertos, e.enviados)}%` : '—',
              e.enviados ? `${fmt(e.clics)} · ${pct(e.clics, e.enviados)}%` : '—',
              fmt(e.cancelados),
            ])} />
        </Bloque>
      )}

      {/* ── Quién contestó ───────────────────────────────────────────────── */}
      <Bloque titulo="Contestaron" pista="Lo que llegó en los últimos siete días, por correo y por WhatsApp. Una respuesta frena su cadencia sola.">
        {(d?.respuestas || []).length ? (
          <div style={{ display: 'grid', gap: 9 }}>
            {d.respuestas.map((r: any, i: number) => (
              <div key={i} style={{ borderLeft: `3px solid ${P.verde}`, background: '#fbfbfd', borderRadius: '0 9px 9px 0', padding: '9px 13px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '.8125rem' }}>
                  <b>{r.nombre || 'cuenta borrada'}</b>
                  <span style={{ color: '#888', fontSize: '.75rem' }}>{r.pais} · {GIROS[r.giro] || r.giro} · {r.canal === 'whatsapp' ? 'WhatsApp' : 'correo'} · {cuando(r.cuando)}</span>
                  {r.etapa && <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{r.etapa}</Pastilla>}
                </div>
                <div style={{ fontSize: '.8125rem', color: '#555', marginTop: 4, lineHeight: 1.5 }}>{String(r.texto || '').slice(0, 300)}</div>
              </div>
            ))}
          </div>
        ) : <Vacio texto="Nadie ha contestado en los últimos siete días." />}
      </Bloque>

      {/* ── La salud de los datos y del envío ────────────────────────────── */}
      <Bloque titulo="Salud" pista="Lo del día en el dominio y lo que trae la base. Un correo roto es un rebote seguro.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 12 }}>
          {kpi('Rebotes hoy', fmt(d?.salud?.rebotes_hoy || 0), `de ${fmt(d?.salud?.salidos_hoy || 0)} correos del dominio`, d?.salud?.rebotes_hoy ? P.ambar : P.verde, d?.salud?.rebotes_hoy ? P.ambarTinta : P.verdeTinta)}
          {kpi('Quejas de spam', fmt(d?.salud?.quejas_hoy || 0), 'una sola apaga el motor', d?.salud?.quejas_hoy ? P.rojo : P.verde, d?.salud?.quejas_hoy ? P.rojoTinta : P.verdeTinta)}
          {kpi('Sin vía', fmt(d?.datos_totales?.sin_via || 0), 'cuentas sin correo ni WhatsApp', P.ambar, P.ambarTinta)}
          {kpi('Correos rotos', fmt(d?.datos_totales?.correo_roto || 0), 'no tienen forma de correo', d?.datos_totales?.correo_roto ? P.rojo : P.verde, d?.datos_totales?.correo_roto ? P.rojoTinta : P.verdeTinta)}
          {kpi('IA · 7 días', d?.costo_ia_7d == null ? '—' : `$${Number(d.costo_ia_7d).toFixed(2)}`, 'lo que costó escribir las cadencias', P.azul, P.azulTinta)}
        </div>
        <Tabla cabeceras={['Giro', 'País', 'Cuentas', 'Sin vía', 'Correo roto', 'WhatsApp de otro país', 'Ciudad rara', 'Sitio caído']}
          filas={(d?.datos || []).filter((x: any) => x.sin_via || x.correo_roto || x.wa_de_otro_pais || x.ciudad_rara)
            .sort((a: any, b: any) => b.cuentas - a.cuentas).slice(0, 12).map((x: any) => [
              GIROS[x.giro] || x.giro, x.pais, fmt(x.cuentas), fmt(x.sin_via),
              x.correo_roto ? <b style={{ color: P.rojoTinta }}>{fmt(x.correo_roto)}</b> : '—',
              x.wa_de_otro_pais ? <b style={{ color: P.ambarTinta }}>{fmt(x.wa_de_otro_pais)}</b> : '—',
              fmt(x.ciudad_rara), fmt(x.sitio_caido),
            ])} />
      </Bloque>
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────
const Bloque = ({ titulo, pista, children }: { titulo: string; pista?: string; children: any }) => (
  <section>
    <h3 style={{ fontSize: '.9375rem', fontWeight: 800, margin: '0 0 2px' }}>{titulo}</h3>
    {pista && <p style={{ fontSize: '.75rem', color: '#888', margin: '0 0 12px', maxWidth: '82ch', lineHeight: 1.5 }}>{pista}</p>}
    {children}
  </section>
);

const Vacio = ({ texto }: { texto: string }) => (
  <div style={{ fontSize: '.8125rem', color: '#888', background: '#fbfbfd', borderRadius: 9, padding: '14px 16px' }}>{texto}</div>
);

const Tabla = ({ cabeceras, filas }: { cabeceras: string[]; filas: any[][] }) => (
  <div className="crm-scroll-x" style={{ overflowX: 'auto', border: `1px solid ${P.linea}`, borderRadius: 10, background: '#fff' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
      <thead>
        <tr>{cabeceras.map(c => (
          <th key={c} style={{ textAlign: 'left', padding: '9px 13px', fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700, borderBottom: `1px solid ${P.linea}`, whiteSpace: 'nowrap' }}>{c}</th>
        ))}</tr>
      </thead>
      <tbody>
        {filas.length ? filas.map((f, i) => (
          <tr key={i}>{f.map((c, j) => (
            <td key={j} style={{ padding: '9px 13px', borderBottom: `1px solid ${P.lineaSuave}`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{c}</td>
          ))}</tr>
        )) : <tr><td colSpan={cabeceras.length} style={{ padding: '14px', color: '#888' }}>Nada que mostrar todavía.</td></tr>}
      </tbody>
    </table>
  </div>
);

const kpi = (etiqueta: string, valor: any, pie: string, color: string, tinta: string) => (
  <div style={tarjetaKpi(color)}>
    <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>{etiqueta}</div>
    <div style={{ fontSize: '1.375rem', fontWeight: 800, color: tinta, lineHeight: 1.15 }}>{valor}</div>
    <div style={{ fontSize: '.6875rem', color: '#888' }}>{pie}</div>
  </div>
);
