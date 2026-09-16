// Cuentas objetivo · POR PAÍS: desde dónde se lanza y se frena cada país.
//
// La prospección dejó de ser «México y ya». Esta pantalla responde tres cosas
// de un vistazo: cuántas cuentas de ese país están esperando permiso, por
// dónde se les puede escribir, y si ahorita es hora hábil allá —porque el
// cartero solo suelta correo entre las 9 y las 6 de la hora LOCAL de cada
// país—. El botón de lanzar es la aprobación: suelta las cuentas a la fila y
// enciende su goteo con la firma de quien lo apretó.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import { GIROS } from '../../../../lib/crm/abm-giros';
import Cargando from '../ui/Cargando';
import { Pastilla, fmt } from './ui';

const REGION: Record<string, string> = { mexico: 'México', latam: 'Latinoamérica', espana: 'España' };

export default function Paises({ giro = 'novias' }: { giro?: string }) {
  const [paises, setPaises] = useState<any[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ t: string; mal?: boolean } | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const traer = () => {
    fetch(`/api/crm/abm/paises?giro=${encodeURIComponent(giro)}`).then(r => r.json())
      .then(r => { setPaises(r.paises || []); setCargando(false); })
      .catch(() => setCargando(false));
  };
  useEffect(traer, [giro]);

  const pedir = async (body: any, clave: string, ok: (j: any) => string) => {
    setTrabajando(clave); setAviso(null);
    try {
      const r = await fetch('/api/crm/abm/paises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giro, ...body }) });
      const j = await r.json();
      setAviso(r.ok ? { t: ok(j) } : { t: j?.error || 'No se pudo', mal: true });
      traer();
    } finally { setTrabajando(null); }
  };

  if (cargando && !paises) return <Cargando texto="Cargando los países…" />;
  const t = (k: string) => (paises || []).reduce((s, p) => s + Number(p[k] || 0), 0);
  const enviados = (paises || []).reduce((s, p) => s + Number(p.correo?.enviados || 0) + Number(p.whatsapp?.enviados || 0), 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <div style={{ fontSize: '.9375rem', fontWeight: 800 }}>La prospección de {GIROS[giro]?.toLowerCase() || giro}, país por país</div>
        <div style={{ fontSize: '.75rem', color: '#888', maxWidth: '78ch' }}>
          Cada país tiene su guion —uno por región, con las palabras de allá— y su goteo. Lanzar un país suelta sus cuentas
          a la fila y enciende el goteo con tu firma: desde ese momento el cartero les escribe, de a pocas por día y solo
          en su horario local.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 11 }}>
        {kpi('Cuentas', fmt(t('cuentas')), `${(paises || []).length} países`, P.violeta, P.violetaTinta)}
        {kpi('Esperando permiso', fmt(t('en_pausa')), 'no les escribe nadie todavía', P.ambar, P.ambarTinta)}
        {kpi('En la fila', fmt(t('sin_tocar')), 'listas para el goteo', P.azul, P.azulTinta)}
        {kpi('Con vía', fmt(t('contactables')), `${fmt(t('con_correo'))} correo · ${fmt(t('con_wa'))} WhatsApp`, P.verde, P.verdeTinta)}
        {kpi('Toques enviados', fmt(enviados), `${fmt(t('en_cadencia'))} cuentas en cadencia`, P.rosa, P.rosaTinta)}
      </div>

      {aviso && (
        <div style={{ fontSize: '.8125rem', color: aviso.mal ? P.rojoTinta : P.verdeTinta, background: aviso.mal ? P.rojoAgua : P.verdeAgua, borderRadius: 8, padding: '8px 12px' }}>{aviso.t}</div>
      )}

      {(paises || []).map((p: any) => {
        const ver = abierto === p.iso;
        const tono = p.lanzado ? { bg: P.verdeAgua, fg: P.verdeTinta } : p.esperando_permiso ? { bg: P.ambarAgua, fg: P.ambarTinta } : { bg: '#F4F4F6', fg: P.suave };
        const etiqueta = p.lanzado ? 'Lanzado' : p.esperando_permiso ? 'Esperando permiso' : 'Sin lanzar';
        const dias = Math.ceil(Number(p.contactables || 0) / Math.max(1, (p.goteos || []).reduce((s: number, g: any) => Math.max(s, g.cuentas_dia || 0), 0) || 10));
        return (
          <div key={p.iso} style={{ border: `1px solid ${P.linea}`, borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '14px 17px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '.9375rem', fontWeight: 800 }}>{p.pais}</div>
                <Pastilla tono={tono}>{etiqueta}</Pastilla>
                <Pastilla tono={p.en_ventana ? { bg: P.verdeAgua, fg: P.verdeTinta } : { bg: '#F4F4F6', fg: P.suave }}>
                  {String(p.hora_local).padStart(2, '0')}:00 allá · {p.en_ventana ? 'en horario' : 'fuera de horario'}
                </Pastilla>
                <span style={{ fontSize: '.75rem', color: '#888' }}>
                  Guion de {REGION[p.region] || p.region} · {fmt(p.ciudades)} ciudades · {fmt(p.cadenas)} cadenas
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {!p.lanzado && (
                    <button disabled={!!trabajando || !p.contactables} onClick={() => {
                      if (!window.confirm(`Lanzar ${p.pais}: ${fmt(p.esperando_permiso)} cuentas entran a la fila y su goteo empieza a escribirles, ${(p.goteos || [])[0]?.cuentas_dia || 10} al día. Los correos salen con tu firma. ¿Lanzar?`)) return;
                      pedir({ accion: 'lanzar', pais: p.iso }, p.iso, j => `${p.pais}: ${fmt(j.soltadas)} cuentas a la fila y ${j.goteos} goteo(s) encendido(s). El primer lote sale en la próxima corrida del cartero.`);
                    }} style={btn(true)}>{trabajando === p.iso ? 'Lanzando…' : 'Lanzar este país'}</button>
                  )}
                  {p.lanzado && (
                    <button disabled={!!trabajando} onClick={() => pedir({ accion: 'pausar', pais: p.iso }, p.iso, j => `${p.pais} en pausa: ${j.goteos} goteo(s). Lo que ya está programado no se cancela.`)} style={btn(false)}>Pausar el país</button>
                  )}
                  <button onClick={() => setAbierto(ver ? null : p.iso)} style={btn(false)}>{ver ? 'Cerrar' : 'Ver detalle'}</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))', gap: 10 }}>
                {kpi('Base', fmt(p.cuentas), `${fmt(p.con_sitio)} con sitio`, P.violeta, P.violetaTinta)}
                {kpi('Esperando', fmt(p.en_pausa), p.en_pausa ? 'permiso del dueño' : 'ninguna', P.ambar, P.ambarTinta)}
                {kpi('En la fila', fmt(p.sin_tocar), `${fmt(p.en_cadencia)} en cadencia`, P.azul, P.azulTinta)}
                {kpi('Con vía', fmt(p.contactables), `${fmt(p.con_correo)} correo · ${fmt(p.con_wa)} WhatsApp`, P.verde, P.verdeTinta)}
                {kpi('Enviados', `${fmt(p.correo?.enviados || 0)} / ${fmt(p.whatsapp?.enviados || 0)}`, 'correo / WhatsApp', P.rosa, P.rosaTinta)}
              </div>
            </div>

            {ver && (
              <div style={{ borderTop: `1px solid ${P.lineaSuave}`, padding: '14px 17px', display: 'grid', gap: 12, background: '#fbfbfd' }}>
                <div>
                  <div style={rotulo}>Su cadencia</div>
                  {(p.cadencias || []).length ? (p.cadencias || []).map((c: any) => (
                    <div key={c.id} style={{ fontSize: '.8125rem' }}>{c.nombre} <span style={{ color: '#888' }}>· ruta {c.ruta}{c.activa ? '' : ' · inactiva'}</span></div>
                  )) : <div style={{ fontSize: '.8125rem', color: P.rojoTinta }}>Todavía no hay cadencia escrita para {REGION[p.region] || p.region}: sin ella no se puede lanzar.</div>}
                </div>

                <div>
                  <div style={rotulo}>Su goteo</div>
                  {(p.goteos || []).length ? (p.goteos || []).map((g: any) => (
                    <div key={g.id} style={{ fontSize: '.8125rem', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700 }}>{g.nombre}</span>
                      <Pastilla tono={g.estado === 'activo' ? { bg: P.verdeAgua, fg: P.verdeTinta } : { bg: P.ambarAgua, fg: P.ambarTinta }}>{g.estado === 'activo' ? 'Activo' : 'En pausa'}</Pastilla>
                      <span style={{ color: '#888' }}>{g.cuentas_dia} cuentas al día · ~{dias} días hábiles para toda la base{g.con_ia ? ' · adaptado con IA' : ''}</span>
                      <span style={{ display: 'flex', gap: 5 }}>
                        {[5, 10, 20, 40].map(n => (
                          <button key={n} disabled={!!trabajando || g.cuentas_dia === n}
                            onClick={() => pedir({ accion: 'ritmo', pais: p.iso, cuentas_dia: n }, p.iso + n, j => `${p.pais}: ${j.cuentas_dia} cuentas al día.`)}
                            style={{ ...btn(g.cuentas_dia === n), padding: '3px 9px', opacity: g.cuentas_dia === n ? 1 : .85 }}>{n}</button>
                        ))}
                      </span>
                    </div>
                  )) : <div style={{ fontSize: '.8125rem', color: P.ambarTinta }}>Sin goteo para este país: créalo en «Envíos progresivos».</div>}
                </div>

                <div>
                  <div style={rotulo}>Lo que exige su ley</div>
                  <div style={{ fontSize: '.8125rem', color: '#666', lineHeight: 1.5, maxWidth: '80ch' }}>{p.legal}</div>
                </div>

                <div>
                  <div style={rotulo}>Su página</div>
                  <a href={p.landing} target="_blank" rel="noreferrer" style={{ fontSize: '.8125rem', color: P.violetaTinta, fontWeight: 700 }}>{p.landing}</a>
                  <span style={{ fontSize: '.75rem', color: '#888' }}> · precios en {String(p.moneda || '').toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const kpi = (etiqueta: string, valor: any, pie: string, color: string, tinta: string) => (
  <div style={tarjetaKpi(color)}>
    <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>{etiqueta}</div>
    <div style={{ fontSize: '1.375rem', fontWeight: 800, color: tinta, lineHeight: 1.15 }}>{valor}</div>
    <div style={{ fontSize: '.6875rem', color: '#888' }}>{pie}</div>
  </div>
);

const rotulo: any = { fontSize: '.6875rem', letterSpacing: '.06em', textTransform: 'uppercase', color: '#999', fontWeight: 700, marginBottom: 5 };
const btn = (primario: boolean) => ({
  font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
  border: primario ? 'none' : `1.5px solid ${P.violeta}`,
  background: primario ? P.violeta : '#fff', color: primario ? '#fff' : P.violetaTinta,
});
