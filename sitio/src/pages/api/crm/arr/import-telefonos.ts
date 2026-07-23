// POST /api/crm/arr/import-telefonos?key=sacs-arr-2026
// Reimporta el CSV de clientes (el que baja export-clientes) para ENRIQUECER
// teléfono/WhatsApp de cada contacto. Empareja por llave estable:
//   contact_id → email → company_id (si la empresa no tiene contacto, lo crea).
// Solo escribe columnas NO vacías (no borra datos existentes con celdas en blanco).
//
// Body JSON: { csv: string, dry_run?: boolean }
//   dry_run = true (DEFAULT, seguro): NO escribe, devuelve qué cambiaría + muestra.
//   dry_run = false: aplica los cambios.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const KEY = 'sacs-arr-2026';

// Parser CSV que respeta comillas: comas y comillas escapadas ("") dentro de un
// campo, y saltos de línea fuera de comillas. Reemplaza al split(',') naíf.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* ignora CR */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  // descarta filas totalmente vacías
  return rows.filter((r) => r.some((c) => (c || '').trim() !== ''));
}

const norm = (s: any) => String(s == null ? '' : s).trim();

async function findOne(col: string, val: string) {
  const { data } = await supabase
    .from('contacts')
    .select('id, telefono, whatsapp, company_id')
    .eq(col, val)
    .limit(1);
  return (data && data[0]) || null;
}

export const POST: APIRoute = async ({ request, url }) => {
  if (url.searchParams.get('key') !== KEY) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  const body = await request.json().catch(() => ({} as any));
  const csv: string = body.csv || '';
  const dryRun: boolean = body.dry_run !== false; // por defecto TRUE (seguro)
  if (!csv) return new Response(JSON.stringify({ error: 'csv required' }), { status: 400 });

  const rows = parseCSV(csv);
  if (rows.length < 2) {
    return new Response(JSON.stringify({ error: 'CSV vacío o sin filas de datos.' }), { status: 400 });
  }

  const header = rows[0].map((h) => norm(h).toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const cCompany = col('company_id');
  const cContact = col('contact_id');
  const cEmail = col('email');
  const cTel = col('telefono');
  const cWa = col('whatsapp');
  const cNombre = col('contacto_nombre');
  if (cTel < 0 && cWa < 0) {
    return new Response(JSON.stringify({ error: 'El CSV debe incluir una columna "telefono" y/o "whatsapp".' }), { status: 400 });
  }

  let actualizados = 0, creados = 0, sinCambio = 0, saltados = 0;
  const errores: string[] = [];
  const muestra: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const tel = cTel >= 0 ? norm(r[cTel]) : '';
    const wa = cWa >= 0 ? norm(r[cWa]) : '';
    const email = cEmail >= 0 ? norm(r[cEmail]) : '';
    const contactId = cContact >= 0 ? norm(r[cContact]) : '';
    const companyId = cCompany >= 0 ? norm(r[cCompany]) : '';
    const nombre = cNombre >= 0 ? norm(r[cNombre]) : '';

    // Sin nada que llenar → no cuenta como error, solo se salta.
    if (!tel && !wa) { saltados++; continue; }

    // Localizar el contacto destino por llave estable.
    let contact: any = null;
    if (contactId) contact = await findOne('id', contactId);
    if (!contact && email) contact = await findOne('email', email);
    let willCreate = false;
    if (!contact && companyId) {
      const { data } = await supabase
        .from('contacts')
        .select('id, telefono, whatsapp, company_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (data && data[0]) contact = data[0];
      else willCreate = true;
    }

    if (!contact && !willCreate) {
      saltados++;
      if (errores.length < 50) errores.push(`Fila ${i + 1}: no se encontró contacto (falta contact_id/email/company_id válido).`);
      continue;
    }

    const upd: any = {};
    if (tel) upd.telefono = tel;
    if (wa) upd.whatsapp = wa;

    // Empresa sin contacto → crear uno con los datos.
    if (willCreate) {
      if (dryRun) {
        creados++;
        if (muestra.length < 10) muestra.push({ accion: 'crear contacto', empresa: companyId, ...upd });
        continue;
      }
      const { error } = await supabase.from('contacts').insert({
        nombre: nombre || 'Contacto',
        company_id: companyId,
        tipo: 'cliente',
        lifecycle_stage: 'cliente',
        fuente: 'enriquecimiento-csv',
        ...upd,
      });
      if (error) errores.push(`Fila ${i + 1}: ${error.message}`);
      else creados++;
      continue;
    }

    // ¿Realmente cambia algo? (no reescribir lo idéntico)
    const cambia = (tel && contact.telefono !== tel) || (wa && contact.whatsapp !== wa);
    if (!cambia) { sinCambio++; continue; }

    if (dryRun) {
      actualizados++;
      if (muestra.length < 10) muestra.push({
        accion: 'actualizar', contact_id: contact.id,
        antes: { telefono: contact.telefono || '', whatsapp: contact.whatsapp || '' },
        despues: upd,
      });
      continue;
    }
    const { error } = await supabase.from('contacts').update(upd).eq('id', contact.id);
    if (error) errores.push(`Fila ${i + 1}: ${error.message}`);
    else actualizados++;
  }

  return new Response(JSON.stringify({
    dry_run: dryRun,
    total: rows.length - 1,
    actualizados, creados, sin_cambio: sinCambio, saltados,
    errores, muestra,
  }), { headers: { 'Content-Type': 'application/json' } });
};
