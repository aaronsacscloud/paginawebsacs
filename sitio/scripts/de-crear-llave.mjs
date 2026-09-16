// Crea la llave de API del motor de demanda, restringida a lo que necesita.
//
// Se hace por API y no a mano por una razón que importa: la llave queda
// restringida EXACTAMENTE a PageSpeed y YouTube. Una llave sin restringir que
// se filtre da acceso a todo lo que el proyecto tenga habilitado —Maps incluido,
// que se cobra por consulta—. Y la de Maps que ya existe no se toca: sigue
// protegida con su propia lista.
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url),'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { token } = await import('../src/lib/demanda/google.ts');
const t = await token('https://www.googleapis.com/auth/cloud-platform');
const PROY = 'projects/sacs3-da4a6/locations/global';
const h = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };

// Si ya existe, no se duplica: 189 llaves en el proyecto son suficientes.
const lista = await (await fetch(`https://apikeys.googleapis.com/v2/${PROY}/keys?pageSize=300`, { headers: h })).json();
const ya = (lista.keys || []).find(k => k.displayName === 'Motor de demanda (PageSpeed + YouTube)');
let nombre = ya?.name;

if (!nombre) {
  const r = await fetch(`https://apikeys.googleapis.com/v2/${PROY}/keys`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      displayName: 'Motor de demanda (PageSpeed + YouTube)',
      restrictions: {
        apiTargets: [
          { service: 'pagespeedonline.googleapis.com' },
          { service: 'youtube.googleapis.com' },
        ],
      },
    }),
  });
  const op = await r.json();
  if (op.error) { console.error('no se pudo crear:', op.error.message); process.exit(1); }

  // La creación es una operación asíncrona: hay que esperar a que termine.
  let estado = op;
  for (let i = 0; i < 30 && !estado.done; i++) {
    await new Promise(r => setTimeout(r, 2000));
    estado = await (await fetch(`https://apikeys.googleapis.com/v2/${op.name}`, { headers: h })).json();
  }
  if (!estado.done) { console.error('la creación no terminó a tiempo'); process.exit(1); }
  nombre = estado.response?.name;
  console.log('llave creada:', estado.response?.displayName);
} else {
  console.log('la llave ya existía, se reutiliza');
}

const cadena = await (await fetch(`https://apikeys.googleapis.com/v2/${nombre}/keyString`, { headers: h })).json();
if (!cadena.keyString) { console.error('no se pudo leer la llave'); process.exit(1); }
console.log('LLAVE:' + cadena.keyString);
