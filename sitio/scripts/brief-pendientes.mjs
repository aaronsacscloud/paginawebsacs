#!/usr/bin/env node
// Qué briefs están esperando revisión de Sacs.
//
// Lo usa la rutina de cada 12 horas: imprime, en JSON, cada etapa que el
// cliente ya envió y nadie ha revisado, con sus respuestas y sus hilos. Es
// solo lectura — quien decide qué contestar es el que lee esta salida.
//
//   node scripts/brief-pendientes.mjs            → todas
//   node scripts/brief-pendientes.mjs <token>    → una sola
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(raiz, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const SB = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
const filtro = process.argv[2];

async function sb(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

const briefs = await sb(
  'proyecto_brief?select=id,token,cliente,proyecto,firmado_por,firmado_at,avisos_email' +
    (filtro ? `&token=eq.${encodeURIComponent(filtro)}` : '') +
    '&firmado_at=not.is.null',
);

const salida = [];
for (const b of briefs) {
  const etapas = await sb(
    `proyecto_etapa?select=clave,orden,estado,respuestas,enviada_at&brief_id=eq.${b.id}&estado=eq.enviada&order=orden`,
  );
  if (!etapas.length) continue;
  const hilos = await sb(
    `proyecto_hilo?select=etapa_clave,campo_id,mensajes,estado&brief_id=eq.${b.id}`,
  );
  salida.push({
    token: b.token,
    cliente: b.cliente,
    proyecto: b.proyecto,
    firmado_por: b.firmado_por,
    avisa_a: b.avisos_email,
    etapas: etapas.map((e) => {
      const suyos = hilos.filter((h) => h.etapa_clave === e.clave);
      // Cuántas veces ya revisamos ESTA etapa. Es el dato que impide que la
      // rutina se quede repreguntando para siempre: en la primera ronda se
      // profundiza, en la segunda se acota, en la tercera se cierra.
      const ronda = suyos.reduce(
        (max, h) => Math.max(max, (h.mensajes || []).filter((m) => m.de === 'sacs').length),
        0,
      ) + 1;
      return {
        clave: e.clave,
        ronda,
        esperando_desde: e.enviada_at,
        horas_esperando: e.enviada_at
          ? Math.round((Date.now() - new Date(e.enviada_at).getTime()) / 3600000)
          : null,
        campos_sin_contestar: Object.keys(e.respuestas || {}).length,
        respuestas: e.respuestas,
        hilos: suyos,
      };
    }),
  });
}

console.log(JSON.stringify({ pendientes: salida.length, briefs: salida }, null, 1));
