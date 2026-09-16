// DEMAND ENGINE · Search Console.
//
// La fuente de demanda OBSERVADA por excelencia: no es lo que creemos que la
// gente busca, es lo que escribió de verdad y lo que vio de nosotros al
// hacerlo. Todo lo demás del motor —las oportunidades, los movimientos, el
// decaimiento— se apoya en esto.
//
// Tres decisiones que vienen de cómo funciona la API y no de gusto:
//
//  1. SE PIDE EL DÍA -3, no el de ayer. Google tarda en consolidar y un día
//     pedido demasiado pronto vuelve incompleto; guardarlo así congelaría un
//     dato parcial como si fuera definitivo.
//  2. SE GUARDA CRUDO, por consulta × página × país × dispositivo. Reprocesar
//     una regla nueva no puede obligar a volver a pedir dieciséis meses.
//  3. SE PAGINA hasta 25,000 filas por día. La API devuelve de 25,000 en
//     25,000 y sin paginar se pierde la cola larga, que es justo donde vive la
//     demanda que nadie más está atendiendo.
import { supabase } from '../../supabase';
import { token, SCOPE_GSC, propiedadesGsc } from '../google';
import { marcarOk, marcarFallo } from '../conectores';
import { registrar } from '../handlers';
import type { ResultadoHandler } from '../tipos';

const API = 'https://www.googleapis.com/webmasters/v3/sites';

/** La propiedad a consultar: la guardada, o la mejor de las accesibles.
 *  Se prefiere la de dominio (`sc-domain:`) porque junta http, https, www y
 *  subdominios; una propiedad de prefijo deja fuera la mitad del tráfico. */
export async function propiedad(): Promise<string | null> {
  const { data } = await supabase.from('de_conectores').select('config').eq('id', 'gsc').maybeSingle();
  const guardada = data?.config?.GSC_PROPIEDAD || data?.config?.gsc_propiedad;
  if (guardada) return guardada;

  const props = await propiedadesGsc();
  if (!props.length) return null;
  const elegida = props.find(p => p.url.startsWith('sc-domain:')) || props[0];
  await supabase.from('de_conectores')
    .update({ config: { ...(data?.config || {}), GSC_PROPIEDAD: elegida.url } })
    .eq('id', 'gsc');
  return elegida.url;
}

export type Fila = { fecha: string; query: string; pagina: string; pais: string; dispositivo: string; clics: number; impresiones: number; ctr: number; posicion: number };

async function pedirDia(prop: string, fecha: string): Promise<Fila[]> {
  const t = await token(SCOPE_GSC);
  const filas: Fila[] = [];
  const TAM = 25000;

  for (let inicio = 0; inicio < 100000; inicio += TAM) {
    const r = await fetch(`${API}/${encodeURIComponent(prop)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: fecha, endDate: fecha,
        dimensions: ['query', 'page', 'country', 'device'],
        rowLimit: TAM, startRow: inicio,
        // `dataState: 'all'` traería datos aún no consolidados; se prefiere
        // esperar un día más y guardar el número definitivo.
        dataState: 'final',
      }),
    });
    const j: any = await r.json();
    if (j.error) throw new Error(`Search Console: ${j.error.message}`);
    const lote = j.rows || [];
    for (const f of lote) {
      filas.push({
        fecha,
        query: String(f.keys[0] || '').slice(0, 500),
        pagina: String(f.keys[1] || '').slice(0, 900),
        pais: String(f.keys[2] || 'zzz'),
        dispositivo: String(f.keys[3] || 'DESKTOP').toLowerCase(),
        clics: f.clicks || 0, impresiones: f.impressions || 0,
        ctr: f.ctr || 0, posicion: f.position || 0,
      });
    }
    if (lote.length < TAM) break;
  }
  return filas;
}

const diaISO = (atras: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - atras);
  return d.toISOString().slice(0, 10);
};

/** Qué días faltan por traer, del más reciente al más viejo. El histórico se
 *  rellena solo, un poco por corrida, sin bloquear el día a día. */
async function diasPendientes(cuantos: number, maxAtras: number): Promise<string[]> {
  const { data } = await supabase.rpc('de_gsc_dias_con_datos');
  const tengo = new Set((data || []).map((r: any) => r.fecha));
  const faltan: string[] = [];
  for (let i = 3; i <= maxAtras && faltan.length < cuantos; i++) {
    const d = diaISO(i);
    if (!tengo.has(d)) faltan.push(d);
  }
  return faltan;
}

export async function ingerirGsc(dias = 4, maxAtras = 480): Promise<{ propiedad: string | null; dias: string[]; filas: number }> {
  const prop = await propiedad();
  if (!prop) return { propiedad: null, dias: [], filas: 0 };

  const pendientes = await diasPendientes(dias, maxAtras);
  let total = 0;

  for (const fecha of pendientes) {
    const filas = await pedirDia(prop, fecha);
    for (let i = 0; i < filas.length; i += 500) {
      const { error } = await supabase.from('de_gsc_diario')
        .upsert(filas.slice(i, i + 500), { onConflict: 'fecha,query,pagina,pais,dispositivo' });
      if (error) throw new Error(`no se pudo guardar el día ${fecha}: ${error.message}`);
    }
    total += filas.length;
    // Un día sin filas también cuenta como traído: si no, se volvería a pedir
    // cada corrida para siempre.
    if (!filas.length) {
      await supabase.from('de_gsc_diario').upsert([{
        fecha, query: '', pagina: '', pais: 'zzz', dispositivo: 'ninguno',
        clics: 0, impresiones: 0, ctr: 0, posicion: 0,
      }], { onConflict: 'fecha,query,pagina,pais,dispositivo' });
    }
  }

  return { propiedad: prop, dias: pendientes, filas: total };
}

registrar('ingerir.gsc', async (a, ctx): Promise<ResultadoHandler> => {
  try {
    const props = await propiedadesGsc();
    if (!props.length) {
      await marcarFallo('gsc', 'la cuenta de servicio todavía no es usuario de ninguna propiedad');
      return {
        ok: false, definitivo: true,
        resumen: 'Falta dar de alta la cuenta de servicio como usuario en Search Console (Configuración → Usuarios y permisos).',
      };
    }

    // El primer día trae mucho; después son pocos días y va rápido.
    const r = await ingerirGsc(Number(a.payload?.dias) || (Date.now() < ctx.limite - 120_000 ? 6 : 2));
    await marcarOk('gsc', r.filas);

    return {
      ok: true,
      resumen: r.dias.length
        ? `${r.filas.toLocaleString('es-MX')} filas de ${r.dias.length} día(s): ${r.dias[r.dias.length - 1]} a ${r.dias[0]}`
        : 'al día, no faltaba ninguna fecha',
      datos: r,
      // Mientras queden días por rellenar, se encola la siguiente tanda: el
      // histórico completo son 16 meses y no cabe en una corrida.
      siguientes: r.dias.length >= 6 ? [{
        tipo: 'ingerir.gsc',
        clave_idem: `ingerir.gsc:relleno:${Date.now()}`,
        prioridad: 40,
        payload: { dias: 8, relleno: true },
        programada_at: new Date(Date.now() + 60_000),
      }] : [],
    };
  } catch (e: any) {
    await marcarFallo('gsc', e?.message || String(e));
    throw e;
  }
});
