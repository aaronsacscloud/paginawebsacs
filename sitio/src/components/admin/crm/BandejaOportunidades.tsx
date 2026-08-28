import { useEffect, useState } from 'react';
import { useIsMobile } from '../../../lib/ui/mobile';
import { WRAP } from '../../../lib/crm/layout';
import Cargando from './ui/Cargando';
import { S } from './SubscriptionsTab';

/* ═══ Bandeja de oportunidades ═══
 * El detector genera ~70 señales cada dos días. Sin un lugar donde marcarlas
 * como atendidas se vuelven paisaje en dos semanas — y sin saber cuáles se
 * cerraron no hay forma de afinar un umbral: no se distingue la señal que vende
 * de la que es ruido. Esto es ese lugar. */

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const ETIQUETA: Record<string, { txt: string; bg: string; co: string }> = {
  cancelada_pero_usando: { txt: 'Usa sin pagar',     bg: '#fdecea', co: '#b93333' },
  entro_a_riesgo:        { txt: 'Entró a riesgo',    bg: '#fdecea', co: '#b93333' },
  caida_ventas:          { txt: 'Caída de ventas',   bg: '#fdecea', co: '#b93333' },
  salud_cayendo:         { txt: 'Salud cayendo',     bg: '#fdecea', co: '#b93333' },
  modulo_fuera_de_plan:  { txt: 'Usa fuera de plan', bg: '#e6f6f2', co: '#1A8F7A' },
  sucursales_excedidas:  { txt: 'Sucursales de más', bg: '#e6f6f2', co: '#1A8F7A' },
  plan_sin_uso:          { txt: 'Paga y no usa',     bg: '#fff5e6', co: '#a06600' },
};
const et = (t: string) => ETIQUETA[t] || { txt: String(t).replace(/_/g, ' '), bg: '#f3f4f6', co: '#475569' };
const TABS = [
  { k: 'abiertas', l: 'Por trabajar' }, { k: 'contactado', l: 'Contactadas' },
  { k: 'ganada', l: 'Ganadas' }, { k: 'descartada', l: 'Descartadas' },
];
const kpi = { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 14px', flex: 1, minWidth: 155 } as const;


/** ══ El hecho, dicho UNA vez ═══════════════════════════════════════════════
 *  El texto viene del detector y trae de todo: el slug de la cuenta al inicio
 *  —que ya está en el encabezado—, la cifra al final en tres formatos
 *  distintos —que ya está arriba en verde— y a veces la propia acción pegada
 *  con una flecha. Decir lo mismo dos veces hace dudar de si son dos cosas.
 */
function limpiarHecho(titulo: string, cuenta: string, tieneCifra: boolean) {
  let t = String(titulo || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/gu, '').trim();
  if (cuenta) {
    const esc = cuenta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // «cuenta (cuenta):» o «cuenta (cuenta)» al inicio, con o sin dos puntos
    t = t.replace(new RegExp('^\\s*' + esc + '\\s*(\\([^)]*\\))?\\s*[:—-]?\\s*', 'i'), '');
  }
  if (tieneCifra) {
    t = t.replace(/\(\s*\+?\$[\d,]+\s*\/?\s*(año|anio|mes)?\s*\)/gi, '');        // (+$3,000/año)
    t = t.replace(/[—–-]?\s*\$[\d,]+\s*ARR\s*(en\s*(riesgo|juego))?\.?/gi, '');     // $6,900 ARR en riesgo
  }
  t = t.replace(/\s*\$0\s*ARR[^.]*\.?/gi, '');   // «$0 ARR en riesgo» no es un hecho
  // Al quitar la cifra queda la puntuación colgando («… churn probable,»):
  // se recorta cualquier signo huérfano del final.
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/[\s,;:.—–-]+$/, '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** El hecho no debe cerrar repitiendo la categoría que ya dice el chip. Ojo:
 *  la coletilla viene FLEXIONADA («— uso sin pagar» contra el chip «Usa sin
 *  pagar»), así que la comparación es por raíz: se recorta la terminación de
 *  cada palabra antes de comparar. */
// Umbral de 2, no de 3: con 3, «uso» y «usa» —tres letras— nunca empataban,
// que es justo el caso de «Usa sin pagar» contra «— uso sin pagar».
const raiz = (p: string) => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().slice(0, Math.max(2, p.length - 2));
const mismaFrase = (a: string, b: string) => {
  const pal = (x: string) => String(x || '').toLowerCase().replace(/[^\wáéíóúñ ]+/gi, ' ').split(/\s+/).filter(Boolean).map(raiz);
  const A = pal(a), B = pal(b);
  return A.length === B.length && A.length > 0 && A.every((w, i) => w === B[i]);
};
function sinEcoDeCategoria(hecho: string, categoria: string) {
  const cat = String(categoria || '').trim();
  if (!cat) return hecho;
  const n = cat.split(/\s+/).length;
  const palabras = hecho.split(/\s+/);
  const cola = palabras.slice(-n).join(' ').replace(/^[\s,;:—–-]+/, '');
  if (mismaFrase(cola, cat)) {
    return palabras.slice(0, -n).join(' ').replace(/[\s,;:.—–-]+$/, '');
  }
  return hecho;
}

/** ¿La acción repite el final del hecho? Se compara SIN el paréntesis final,
 *  que es justo lo que derrotaba la comparación literal. */
function accionRepetida(hecho: string, accion: string) {
  const norm = (x: string) => String(x || '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ').replace(/[^\wáéíóúñ ]+/gi, ' ').replace(/\s+/g, ' ').trim();
  const h = norm(hecho), a = norm(accion);
  return !!a && (h.endsWith(a) || h.includes(a));
}

export default function BandejaOportunidades({ onOpenCliente }: { onOpenCliente?: (id: string) => void }) {
  const esMovilB = useIsMobile();
  const [tab, setTab] = useState('abiertas');
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [moviendo, setMoviendo] = useState<string | null>(null);

  async function load(t: string) {
    setCargando(true);
    try { setD(await fetch('/api/crm/arr/bandeja?estado=' + t).then(r => r.json())); }
    catch { setD({ data: [] }); }
    setCargando(false);
  }
  useEffect(() => { load(tab); }, [tab]);

  async function mover(f: any, estado: string) {
    let motivo: string | null = null;
    if (estado === 'descartada') {
      // El motivo se pide aquí y el servidor también lo exige: sin él, en tres
      // meses nadie sabe qué umbral estaba mal.
      motivo = window.prompt(`¿Por qué no aplica?\n\n${f.titulo}\n\nEs lo único que después permite afinar la señal.`, '');
      if (!motivo || !motivo.trim()) return;
    }
    setMoviendo(f.id);
    const j = await fetch('/api/crm/arr/bandeja', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, estado, motivo_descarte: motivo }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setMoviendo(null);
    if (j?.error) alert(j.error); else load(tab);
  }

  const r = d?.resumen;
  return (
    <div style={WRAP}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={kpi}><div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>Por trabajar</div><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{r?.nuevas ?? '—'}</div></div>
        <div style={kpi}><div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>Contactadas</div><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{r?.contactadas ?? '—'}</div></div>
        <div style={kpi}><div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>ARR en juego</div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E8A63' }}>{money(r?.valor_abierto)}</div><div style={{ fontSize: '0.64rem', color: '#a7abb3' }}>solo las abiertas</div></div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e8eaee', marginBottom: 12, overflowX: 'auto', WebkitMaskImage: 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)', maskImage: 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ flexShrink: 0, minHeight: 40, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t.k ? '2.5px solid #5B4BD6' : '2.5px solid transparent',
              fontWeight: tab === t.k ? 800 : 600, fontSize: '0.82rem', color: tab === t.k ? '#5B4BD6' : '#777' }}>{t.l}</button>
        ))}
      </div>

      {r?.por_tipo?.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {r.por_tipo.map((t: any) => { const e = et(t.tipo); return (
            <span key={t.tipo} style={{ padding: '4px 11px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, background: '#f4f3f6', color: '#6b6b74' }}>
              {/* Un tipo sin etiqueta traducida salía crudo («reactivacion»):
                  se capitaliza y se le pone el acento que le falta. */}
              {(e.txt || String(t.tipo).replace(/_/g, ' ')).replace(/^\w/, (c: string) => c.toUpperCase()).replace(/reactivacion/i, 'Reactivación')}: {t.n}
            </span>
          ); })}
        </div>
      ) : null}

      {cargando && <Cargando texto="Cargando…" />}
      {!cargando && !d?.data?.length && <div style={{ padding: 30, textAlign: 'center', color: '#999' }}>Nada por aquí.</div>}

      {!cargando && (d?.data || []).map((f: any) => {
        const e = et(f.signal_type);
        const co = Array.isArray(f.companies) ? f.companies[0] : f.companies;
        const abierta = f.estado === 'nueva' || f.estado === 'contactado';
        return (
          <div key={f.id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                {/* El nombre queda anclado a la derecha: centrado en el espacio
                    sobrante terminaba en una x distinta en cada tarjeta y no se
                    leía como columna al bajar. */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
                  {/* El tipo de señal es taxonomía, no gravedad: pintarlo de
                      verde o rojo hacía que «usa fuera de plan» se leyera como
                      un estado. El color de esta tarjeta lo lleva el dinero. */}
                  <span className="opo-tipo" style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.74rem', fontWeight: 700, background: '#f4f3f6', color: '#6b6b74' }}>
                    {(e.txt || String(f.signal_type).replace(/_/g, ' ')).replace(/^\w/, (c: string) => c.toUpperCase()).replace(/reactivacion/i, 'Reactivación')}
                  </span>
                  <button onClick={() => onOpenCliente?.(f.company_id)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontWeight: 800, fontSize: '0.88rem', color: '#1a1a1a', marginLeft: 'auto', textAlign: 'right' }}>
                    {co?.sacs_account || co?.nombre || 'Cliente'}
                  </button>
                  {f.opportunity_value > 0 && <span style={{ fontWeight: 800, color: '#1E8A63', fontSize: '0.82rem' }}>+{money(f.opportunity_value)}/año</span>}
                  {f.estado === 'contactado' && <span style={{ fontSize: '0.7rem', color: '#a06600', fontWeight: 700 }}>· en seguimiento</span>}
                </div>
                {/* El título venía con el eco del slug al inicio («cultomar
                    (cultomar): …») cuando la cuenta ya está en el encabezado, y
                    debajo un resumen que decía lo mismo con otras palabras. */}
                <div style={{ fontSize: '0.86rem', color: '#333', lineHeight: 1.45 }}>
                  {sinEcoDeCategoria(limpiarHecho(f.titulo, co?.sacs_account || co?.nombre || '', f.opportunity_value > 0), e.txt)}
                </div>
                {f.detalle && !esMovilB && <div style={{ fontSize: '0.76rem', color: '#777', marginTop: 3 }}>{f.detalle}</div>}
                {/* Lo que hay que hacer es instrucción, no dinero: en verde
                    competía con el ARR, que es el único dato que sí lo es. */}
                {/* Si la acción repite la cola del hecho («… → súbelo a
                    controla» y luego «→ Súbelo a controla»), se pinta una vez:
                    decir dos veces lo mismo hace dudar de si son dos cosas. */}
                {f.accion && !accionRepetida(f.titulo, f.accion) && (
                  <div style={{ fontSize: '0.86rem', color: '#1a1a1a', marginTop: 6, fontWeight: 600 }}>→ {f.accion}</div>
                )}
                {f.motivo_descarte && <div style={{ fontSize: '0.74rem', color: '#b93333', marginTop: 5 }}>Descartada: {f.motivo_descarte}</div>}
              </div>
              {abierta && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: esMovilB ? '100%' : undefined }}>
                  {/* «Ganada» iba en verde sólido: un segundo botón lleno en la
                      misma tarjeta compite con la acción de todos los días, que
                      es marcar que ya contactaste. Los tres pesan igual ahora. */}
                  {f.estado === 'nueva' && <button disabled={moviendo === f.id} onClick={() => mover(f, 'contactado')} style={{ ...S.btnSmall, height: 44, minHeight: 44, padding: '0 10px', flex: esMovilB ? '1 1 0' : undefined, borderRadius: 10, fontWeight: 700 }}>Ya contacté</button>}
                  <button disabled={moviendo === f.id} onClick={() => mover(f, 'ganada')} style={{ ...S.btnSmall, height: 44, minHeight: 44, padding: '0 10px', flex: esMovilB ? '1 1 0' : undefined, borderRadius: 10, color: '#1A8F7A', borderColor: '#bfe3da', fontWeight: 700 }}>Ganada</button>
                  <button disabled={moviendo === f.id} onClick={() => mover(f, 'descartada')} style={{ ...S.btnSmall, height: 44, minHeight: 44, padding: '0 10px', flex: esMovilB ? '1 1 0' : undefined, borderRadius: 10, color: '#b93333', borderColor: '#f0c4bd' }}>No aplica</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
