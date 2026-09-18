import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/* Ocultar = `privacyStatus: private`. NO se borra: borrar un video en YouTube es
   definitivo y se lleva sus vistas, sus comentarios y cualquier enlace que
   alguien haya puesto en otro lado. Privado consigue lo mismo que se pidió —que
   nadie lo vea— y se deshace con un clic si mañana resulta que sí servía. */
const RAIZ = '/opt/sacs/paginawebsacs/sitio';
const E = { ...process.env };
for (const l of readFileSync(`${RAIZ}/.env`, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) E[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const t = JSON.parse(readFileSync(`${RAIZ}/.yt-token.json`, 'utf8'));
const j = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    refresh_token: t.refresh_token, client_id: E.YT_OAUTH_CLIENT_ID,
    client_secret: E.YT_OAUTH_CLIENT_SECRET, grant_type: 'refresh_token',
  }),
})).json();
const TOK = j.access_token;

const ID = process.argv[2];
if (!ID) { console.log('  falta el id del video'); process.exit(1); }

const lect = await (await fetch(
  `https://www.googleapis.com/youtube/v3/videos?part=status,snippet,statistics&id=${ID}`,
  { headers: { Authorization: `Bearer ${TOK}` } })).json();
/* El error de la API se mira ANTES que `items`. Sin esto, una cuota agotada
   —que es un problema de hoy, se arregla solo mañana— se reportaba como «ese
   video no existe», que manda a buscar el problema donde no está. */
if (lect.error) { console.log(`  no se pudo leer: ${lect.error.message.replace(/<[^>]+>/g, '')}`); process.exit(1); }
const v = lect.items?.[0];
if (!v) { console.log('  ese video no existe o no es del canal'); process.exit(1); }

console.log(`  video : ${v.snippet.title}`);
console.log(`  vistas: ${(+v.statistics.viewCount).toLocaleString()} · visibilidad actual: ${v.status.privacyStatus}`);

// El estado anterior se guarda para poder devolverlo exactamente como estaba.
const F = '/tmp/yt-ocultados.json';
const reg = existsSync(F) ? JSON.parse(readFileSync(F, 'utf8')) : [];
reg.push({ id: ID, titulo: v.snippet.title, antes: v.status.privacyStatus, vistas: +v.statistics.viewCount, cuando: new Date().toISOString() });
writeFileSync(F, JSON.stringify(reg, null, 2));

const r = await (await fetch('https://www.googleapis.com/youtube/v3/videos?part=status', {
  method: 'PUT', headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: ID, status: { ...v.status, privacyStatus: 'private' } }),
})).json();

if (r.error) { console.log(`  NO se pudo ocultar: ${r.error.message}`); process.exit(1); }
console.log(`  ahora : ${r.status.privacyStatus}  ← ya no lo ve nadie`);
console.log(`  el estado anterior quedó anotado en ${F} por si hay que devolverlo`);
