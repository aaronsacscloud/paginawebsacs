// Lo compartido de Cuentas objetivo: paleta del CRM, pastillas y formatos.
// No hay tonos nuevos aquí: todo sale de lib/crm/paleta.
import type { ReactNode } from 'react';
import { P } from '../../../../lib/crm/paleta';

/** Los máximos de cada componente del puntaje. Viven aquí y no en abm.lib.ts
 *  porque esa librería importa el cliente de Supabase del servidor: usarla
 *  desde React arrastra ese cliente al navegador y la pantalla no monta. */
export const TOPES = { encaje: 50, dolor: 50, accesibilidad: 25, puntaje: 100 } as const;

export const ETAPA_TONO: Record<string, { l: string; bg: string; fg: string }> = {
  sin_tocar:    { l: 'Sin tocar',    bg: '#F4F4F6',        fg: P.suave },
  en_cadencia:  { l: 'En cadencia',  bg: P.violetaAgua,    fg: P.violetaTinta },
  respondio:    { l: 'Respondió',    bg: P.verdeAgua,      fg: P.verdeTinta },
  reunion:      { l: 'Reunión',      bg: P.azulAgua,       fg: P.azulTinta },
  diagnostico:  { l: 'Diagnóstico',  bg: P.azulAgua,       fg: P.azulTinta },
  propuesta:    { l: 'Propuesta',    bg: P.ambarAgua,      fg: P.ambarTinta },
  ganada:       { l: 'Ganada',       bg: P.verdeAgua,      fg: P.verdeTinta },
  perdida:      { l: 'Perdida',      bg: P.rojoAgua,       fg: P.rojoTinta },
  no_contactar: { l: 'No contactar', bg: P.rojoAgua,       fg: P.rojoTinta },
};

export const CONFIANZA_TONO: Record<string, { l: string; fg: string; bg: string }> = {
  alta:       { l: 'confianza alta',  fg: P.verdeTinta, bg: P.verdeAgua },
  media:      { l: 'confianza media', fg: P.ambarTinta, bg: P.ambarAgua },
  baja:       { l: 'confianza baja',  fg: P.rojoTinta,  bg: P.rojoAgua },
  confirmada: { l: 'confirmada',      fg: P.verdeTinta, bg: P.verdeAgua },
};

export function Pastilla({ tono, children, titulo, max }: { tono: { bg: string; fg: string }; children: ReactNode; titulo?: string; max?: number }) {
  return (
    <span title={titulo} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.6875rem', fontWeight: 700,
      padding: '3px 9px', borderRadius: 999, background: tono.bg, color: tono.fg, whiteSpace: 'nowrap',
      // Sin tope, un valor largo (hay plataformas descritas en un párrafo) se
      // sale de su celda y se imprime encima de la columna de al lado.
      maxWidth: max ?? 200, overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{children}</span>
  );
}

/** Puntaje 0-100 con barra: la forma en pastel, la cifra en tinta. */
export function Puntaje({ v, ancho = 54 }: { v: number; ancho?: number }) {
  const color = v >= 60 ? P.violetaTinta : v >= 40 ? P.azulTinta : '#8F8C9C';
  const barra = v >= 60 ? P.violeta : v >= 40 ? P.azul : '#D6D3E0';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <b style={{ fontSize: '.8125rem', fontWeight: 800, color, minWidth: 22, textAlign: 'right' }}>{v}</b>
      <span style={{ width: ancho, height: 5, borderRadius: 3, background: '#EFEEF3', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.min(100, v)}%`, background: barra, borderRadius: 3 }} />
      </span>
    </span>
  );
}

export const fmt = (n: number) => new Intl.NumberFormat('es-MX').format(n);

export const fecha = (v: any) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return '—'; }
};
export const fechaHora = (v: any) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

/** Enlace de contacto: correo, WhatsApp o teléfono, listo para tocar.
 *
 *  Devuelve null cuando NO se puede abrir. Dos motivos, los dos aprendidos:
 *  el canal marcado como inválido en la base (33 WhatsApp que no eran números:
 *  dos teléfonos en un campo, listas de sucursales, hasta una frase), y el
 *  número demasiado largo — 24 dígitos son dos teléfonos pegados, y pasaban el
 *  filtro de "al menos 10". Un enlace que no abre nada no es una vía. */
export function enlaceDe(tipo: string, valor: string, estado?: string): string | null {
  if (estado === 'invalido' || estado === 'opt_out') return null;
  if (tipo.startsWith('email')) return `mailto:${valor}`;
  if (tipo.startsWith('whatsapp')) {
    let n = String(valor || '');
    if (n.startsWith('http')) { const m = n.match(/(\d{10,15})/); n = m ? m[1] : ''; }
    n = n.replace(/\D/g, '');
    if (n.length === 10) n = '52' + n;
    if (n.length === 11 && n.startsWith('1')) n = '52' + n.slice(1);
    return n.length >= 10 && n.length <= 13 ? `https://wa.me/${n}` : null;
  }
  if (tipo === 'telefono') {
    const n = valor.replace(/[^\d+]/g, '');
    return n.replace(/\D/g, '').length >= 8 && n.replace(/\D/g, '').length <= 13 ? `tel:${n}` : null;
  }
  if (valor.startsWith('http')) return valor;
  return null;
}
