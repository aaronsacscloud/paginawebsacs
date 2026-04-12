import type { APIRoute } from 'astro';
import { google } from 'googleapis';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';
const SHEET_ID = import.meta.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const CLIENT_EMAIL = import.meta.env.GOOGLE_SHEETS_CLIENT_EMAIL || '';

function getPrivateKey(): string {
  const b64 = import.meta.env.GOOGLE_SHEETS_PRIVATE_KEY_B64 || '';
  if (b64) return Buffer.from(b64, 'base64').toString('utf-8');
  return (import.meta.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}
const PRIVATE_KEY = getPrivateKey();

async function appendToSheet(data: Record<string, string>) {
  if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return;

  const auth = new google.auth.JWT(CLIENT_EMAIL, undefined, PRIVATE_KEY, [
    'https://www.googleapis.com/auth/spreadsheets',
  ]);

  const sheets = google.sheets({ version: 'v4', auth });

  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
  const hora = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });

  const row = [
    fecha,
    hora,
    data.nombre || '',
    data.empresa || '',
    data.email || '',
    data.whatsapp || '',
    data.giro || '',
    data.sucursales || '',
    data.plan || '',
    data.paso || '',
    data.score || '0',
    data.totalTime || '0',
    data.pageCount || '0',
    data.pagesVisited || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Leads!A:N',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Save to Stripe
    const params = new URLSearchParams();
    params.append('email', data.email || `lead-${Date.now()}@noemail.com`);
    params.append('name', data.nombre || '');
    params.append('phone', data.whatsapp || '');
    params.append('metadata[empresa]', data.empresa || '');
    params.append('metadata[giro]', data.giro || '');
    params.append('metadata[sucursales]', data.sucursales || '');
    params.append('metadata[paso]', data.paso || '');
    params.append('metadata[plan]', data.plan || '');
    params.append('metadata[source]', 'website-lead');
    params.append('metadata[fecha]', new Date().toISOString());
    params.append('metadata[score]', data.score || '0');
    params.append('metadata[totalTime]', data.totalTime || '0');
    params.append('metadata[pagesVisited]', (data.pagesVisited || '').substring(0, 500));
    params.append('metadata[pageCount]', data.pageCount || '0');
    params.append('metadata[visitorId]', data.visitorId || '');

    const res = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await res.json();

    // Save to Google Sheets
    try {
      await appendToSheet(data);
    } catch (sheetErr) {
      console.error('Google Sheets error:', sheetErr);
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
