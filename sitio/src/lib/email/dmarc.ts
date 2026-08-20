/**
 * Diagnóstico de DMARC y la rampa para endurecerlo.
 *
 * DMARC no protege nada en `p=none`: le pide al mundo que te avise, no que
 * actúe. Solo empieza a servir en `quarantine` y, de verdad, en `reject`.
 * Pero saltar directo a reject sin verificar que TODOS los que mandan a tu
 * nombre firman con DKIM alineado tira correo real —facturas incluidas— y el
 * remitente no se entera: el rebote lo ve el destinatario.
 *
 * Por eso esto no propone un cambio, propone el SIGUIENTE paso, y solo cuando
 * el anterior ya está probado.
 */

interface Resuelto { spf: string | null; dmarc: string | null; dkim: string[] }

/** DNS sobre HTTPS: no hay `dig` en un entorno serverless. */
async function txt(nombre: string): Promise<string[]> {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(nombre)}&type=TXT`, {
      headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(6000),
    });
    const j: any = await r.json();
    // Google devuelve las cadenas con comillas y, si el registro venía
    // partido en varios trozos, los entrega concatenables tal cual.
    return (j.Answer || []).map((a: any) => String(a.data || '').replace(/^"|"$/g, '').replace(/" "/g, ''));
  } catch { return []; }
}

async function cname(nombre: string): Promise<string | null> {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(nombre)}&type=CNAME`, {
      headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(6000),
    });
    const j: any = await r.json();
    return (j.Answer || [])[0]?.data || null;
  } catch { return null; }
}

export interface Diagnostico {
  dominio: string;
  spf: string | null;
  spf_ok: boolean;
  spf_multiple: boolean;
  dmarc: string | null;
  politica: 'ninguna' | 'none' | 'quarantine' | 'reject';
  pct: number;
  rua: string | null;
  dkim_sendgrid: boolean;
  otros_remitentes: string[];
  siguiente: { titulo: string; porque: string; registro?: { host: string; valor: string } } | null;
  listo: boolean;
}

export async function diagnosticar(dominio: string): Promise<Diagnostico> {
  const d = String(dominio || '').replace(/^.*@/, '').toLowerCase();
  const [raiz, dm, s1] = await Promise.all([txt(d), txt(`_dmarc.${d}`), cname(`s1._domainkey.${d}`)]);

  const spfs = raiz.filter(x => /^v=spf1/i.test(x));
  const spf = spfs[0] || null;
  // Dos registros SPF no es "doble seguridad": es PermError, y con PermError
  // el dominio queda igual que sin SPF. Ya pasó una vez aquí.
  const spfMultiple = spfs.length > 1;

  const dmarc = dm.find(x => /^v=DMARC1/i.test(x)) || null;
  const leer = (k: string) => dmarc?.match(new RegExp(`${k}\\s*=\\s*([^;\\s]+)`, 'i'))?.[1] || null;
  const p = (leer('p') || '').toLowerCase();
  const politica = (['none', 'quarantine', 'reject'].includes(p) ? p : 'ninguna') as Diagnostico['politica'];
  const pct = Number(leer('pct') || 100);
  const rua = leer('rua');

  // Quién más manda a nombre de este dominio: cada `include:` es un remitente
  // que tiene que estar firmando con DKIM antes de endurecer la política.
  const otros = (spf?.match(/include:([^\s]+)/gi) || [])
    .map(x => x.replace(/^include:/i, ''))
    .filter(x => !/sendgrid\.net$/i.test(x));

  const dkimSendgrid = !!s1;

  let siguiente: Diagnostico['siguiente'] = null;
  if (spfMultiple) {
    siguiente = {
      titulo: 'Junta los registros SPF en uno solo',
      porque: `Hay ${spfs.length} registros v=spf1. Más de uno es PermError: los servidores lo tratan como si no tuvieras SPF. Esto se arregla antes que nada.`,
    };
  } else if (!dkimSendgrid) {
    siguiente = {
      titulo: 'Falta el DKIM de SendGrid',
      porque: 'Sin DKIM firmado y alineado, endurecer DMARC tira tus propios correos.',
    };
  } else if (politica === 'ninguna') {
    siguiente = {
      titulo: 'Publica DMARC en modo observación',
      porque: 'Sin DMARC cualquiera puede mandar a tu nombre y nadie te avisa. Empieza en p=none para juntar dos semanas de reportes antes de endurecer.',
      registro: { host: `_dmarc.${d}`, valor: `v=DMARC1; p=none; rua=mailto:dmarc@${d}; adkim=r; aspf=r; fo=1` },
    };
  } else if (politica === 'none') {
    siguiente = {
      titulo: 'Sube a cuarentena, pero al 25%',
      porque: `DMARC en p=none mide y no protege. El salto se hace por partes: con pct=25 solo una de cada cuatro fallas se manda a spam, así que si algún remitente legítimo ${otros.length ? `—${otros.join(', ')}— ` : ''}no está firmando, te enteras sin tirar el correo de todos.`,
      registro: { host: `_dmarc.${d}`, valor: `v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@${d}; adkim=r; aspf=r; fo=1` },
    };
  } else if (politica === 'quarantine' && pct < 100) {
    siguiente = {
      titulo: 'Sube la cuarentena al 100%',
      porque: `Vas al ${pct}%. Si dos semanas de reportes no muestran fallas de remitentes tuyos, sube a 100 antes de pasar a rechazo.`,
      registro: { host: `_dmarc.${d}`, valor: `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@${d}; adkim=r; aspf=r; fo=1` },
    };
  } else if (politica === 'quarantine') {
    siguiente = {
      titulo: 'Último paso: rechazo',
      porque: 'Cuarentena manda las falsificaciones a spam; rechazo hace que ni se entreguen. Solo si los reportes llevan dos semanas limpios.',
      registro: { host: `_dmarc.${d}`, valor: `v=DMARC1; p=reject; rua=mailto:dmarc@${d}; adkim=r; aspf=r; fo=1` },
    };
  }

  return {
    dominio: d, spf, spf_ok: !!spf && !spfMultiple, spf_multiple: spfMultiple,
    dmarc, politica, pct, rua, dkim_sendgrid: dkimSendgrid,
    otros_remitentes: otros, siguiente, listo: politica === 'reject' && !!spf && !spfMultiple && dkimSendgrid,
  };
}
