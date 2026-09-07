// Piezas compartidas del módulo de eventos: botones con jerarquía, campos,
// etiquetas de los catálogos y formato de fechas. Todo el color sale de paleta.
import type { CSSProperties, ReactNode } from 'react';
import { P } from '../../../../lib/crm/paleta';

export const TIPO_ETIQ: Record<string, string> = {
  feria_comercial: 'Feria comercial (B2B)', expo_consumidor: 'Expo al público', zona_mayoreo: 'Zona de mayoreo',
  semana_moda: 'Semana de la moda', congreso: 'Congreso', feria_retail_tech: 'Feria de retail y tecnología',
};
export const ROL_ETIQ: Record<string, string> = { stand: 'Con stand', recorrido: 'Recorrido (sin stand)', visitante: 'Visitante', patrocinio: 'Patrocinio', ninguno: 'No ir' };
export const DECISION_TONO: Record<string, { l: string; bg: string; fg: string }> = {
  ir: { l: 'Vamos', bg: P.verdeAgua, fg: P.verdeTinta },
  evaluar: { l: 'Por evaluar', bg: P.ambarAgua, fg: P.ambarTinta },
  no_ir: { l: 'No vamos', bg: '#f1f1f1', fg: '#777' },
};
export const PARTICIPACION_TONO: Record<string, { l: string; bg: string; fg: string }> = {
  sin_decidir: { l: 'Sin decidir', bg: '#f1f1f1', fg: '#777' },
  vamos: { l: 'Vamos', bg: P.verdeAgua, fg: P.verdeTinta },
  no_vamos: { l: 'No vamos', bg: '#f1f1f1', fg: '#777' },
  fuimos: { l: 'Fuimos', bg: P.violetaAgua, fg: P.violetaTinta },
};
export const TEMP_TONO: Record<string, { l: string; bg: string; fg: string }> = {
  caliente: { l: 'Caliente', bg: P.rojoAgua, fg: P.rojoTinta },
  tibio: { l: 'Tibio', bg: P.ambarAgua, fg: P.ambarTinta },
  frio: { l: 'Frío', bg: P.azulAgua, fg: P.azulTinta },
};
// Giros de las PERSONAS (los mismos de Cuentas objetivo, para que el contacto
// que se registra en el stand quede clasificado igual que uno investigado).
export const GIROS: Record<string, string> = {
  cadenas: 'Cadenas de moda', boutiques: 'Boutiques', renta: 'Renta de vestidos y trajes', novias: 'Novias y XV',
  zapaterias: 'Zapaterías', western: 'Botas western', vintage: 'Vintage y segunda mano', joyeria: 'Joyería',
  relojerias: 'Relojerías', opticas: 'Ópticas', charro: 'Charro y danza', scrubs: 'Uniformes', telas: 'Telas y mercería',
  tallas: 'Tallas extra, maternidad y bebé', fabricantes: 'Fabricantes de ropa', distribuidores: 'Distribuidores',
  canal: 'Canal mayorista', deportiva: 'Ropa deportiva', infantil: 'Ropa infantil', operadores: 'Operadores y concept stores', otro: 'Otro',
};
// Giros a los que SIRVE un evento (vocabulario de la investigación).
export const GIROS_EVENTO: Record<string, string> = {
  boutiques: 'Boutiques', fabricantes: 'Fabricantes', distribuidores: 'Distribuidores', marcas: 'Marcas', zapaterias: 'Zapaterías',
  western: 'Western', novias: 'Novias y XV', renta_vestidos: 'Renta de vestidos', joyerias: 'Joyerías', relojerias: 'Relojerías',
  opticas: 'Ópticas', deportiva: 'Deportiva', ninos: 'Infantil', tallas: 'Tallas extra y maternidad', vintage: 'Vintage',
  lenceria: 'Lencería', uniformes: 'Uniformes', mayoreo_textil: 'Textil y mayoreo', consultoras: 'Consultoras', departamental: 'Departamentales',
  concept_store: 'Concept stores', consignacion: 'Consignación', cadenas: 'Cadenas', canal: 'Canal mayorista',
};

export const fmt = (n: number) => new Intl.NumberFormat('es-MX').format(n);
export const dinero = (n: number) => '$' + new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const d = (s: string) => { const [y, m, dd] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, dd); };
export const mesLargo = (y: number, m: number) => `${MESES_L[m]} ${y}`;
/** «14–17 ene 2027» o «30 nov – 2 dic 2026». Un rango de fechas se lee de una. */
export const rango = (inicio?: string | null, fin?: string | null) => {
  if (!inicio) return 'fecha por confirmar';
  const a = d(inicio), b = fin ? d(fin) : a;
  if (a.getTime() === b.getTime()) return `${a.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()}`;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()}`;
  return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
};
export const fechaCorta = (s?: string | null) => s ? `${d(s).getDate()} ${MESES[d(s).getMonth()]}` : '';
export const fechaHora = (v: any) => {
  if (!v) return ''; const x = new Date(v);
  return `${x.getDate()} ${MESES[x.getMonth()]} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
};
export const diasHasta = (s: string) => Math.round((d(s).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
/** «en 3 semanas», «en 4 meses», «hace 12 días», «hoy». Se lee sin calcular. */
export const relativo = (s: string) => {
  const n = diasHasta(s);
  if (n === 0) return 'hoy';
  const abs = Math.abs(n), pre = n > 0 ? 'en' : 'hace';
  if (abs < 14) return `${pre} ${abs} día${abs === 1 ? '' : 's'}`;
  if (abs < 60) return `${pre} ${Math.round(abs / 7)} semanas`;
  return `${pre} ${Math.round(abs / 30)} meses`;
};

export function Pastilla({ tono, children, titulo }: { tono: { bg: string; fg: string }; children: ReactNode; titulo?: string }) {
  return <span title={titulo} style={{ display: 'inline-block', fontSize: '.6875rem', fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: tono.bg, color: tono.fg, whiteSpace: 'nowrap' }}>{children}</span>;
}

export function Fit({ v }: { v: number | null | undefined }) {
  const n = Number(v || 0);
  const color = n >= 8 ? P.verde : n >= 5 ? P.ambar : P.rojo;
  const tinta = n >= 8 ? P.verdeTinta : n >= 5 ? P.ambarTinta : P.rojoTinta;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Qué tanto encaja el evento con el cliente que buscamos, del 1 al 10">
      <span style={{ width: 44, height: 5, borderRadius: 3, background: '#eee', overflow: 'hidden' }}><span style={{ display: 'block', width: `${n * 10}%`, height: '100%', background: color }} /></span>
      <b style={{ fontSize: '.8125rem', color: tinta, fontVariantNumeric: 'tabular-nums' }}>{n || '–'}</b>
    </span>
  );
}

type Nivel = 'primario' | 'secundario' | 'terciario' | 'destructivo';
const BTN: Record<Nivel, CSSProperties> = {
  primario: { background: P.violeta, color: '#fff', border: `1.5px solid ${P.violeta}` },
  secundario: { background: '#fff', color: P.violetaTinta, border: `1.5px solid ${P.violeta}` },
  terciario: { background: '#fff', color: '#555', border: '1.5px solid #ddd' },
  destructivo: { background: '#fff', color: P.rojoTinta, border: '1.5px solid #f0c4bd' },
};
export function Btn({ nivel = 'secundario', children, onClick, disabled, chico, style, type = 'button', title }: {
  nivel?: Nivel; children: ReactNode; onClick?: () => void; disabled?: boolean; chico?: boolean; style?: CSSProperties; type?: 'button' | 'submit'; title?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} style={{
      font: 'inherit', fontSize: chico ? '.75rem' : '.8125rem', fontWeight: 700, padding: chico ? '5px 11px' : '8px 14px', borderRadius: 8,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .55 : 1, whiteSpace: 'nowrap', ...BTN[nivel], ...style,
    }}>{children}</button>
  );
}

export const INPUT: CSSProperties = { font: 'inherit', fontSize: '.875rem', padding: '8px 11px', borderRadius: 8, border: `1px solid ${P.linea}`, width: '100%', boxSizing: 'border-box', background: '#fff', color: '#222' };
export function Campo({ label, children, ancho, ayuda }: { label: string; children: ReactNode; ancho?: number | string; ayuda?: string }) {
  return (
    <label style={{ display: 'grid', gap: 4, minWidth: 0, gridColumn: ancho ? `span ${ancho}` : undefined }}>
      <span style={{ fontSize: '.6875rem', fontWeight: 700, color: '#777', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      {children}
      {ayuda && <span style={{ fontSize: '.6875rem', color: '#999' }}>{ayuda}</span>}
    </label>
  );
}

export function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <h3 style={{ fontSize: '.75rem', fontWeight: 800, color: '#777', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

export async function post(url: string, body: any) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || j.motivo || `Error ${r.status}`);
  return j;
}
