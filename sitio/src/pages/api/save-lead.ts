import type { APIRoute } from 'astro';
import { google } from 'googleapis';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';
const SHEET_ID = (import.meta.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();

function getGoogleAuth() {
  const b64 = import.meta.env.GOOGLE_SERVICE_ACCOUNT_B64 || '';
  if (!b64) return null;
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function parseUserAgent(ua: string): { device: string; browser: string } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device = isTablet ? 'Tablet' : isMobile ? 'Móvil' : 'Computadora';

  let browser = 'Otro';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  return { device, browser };
}

async function appendToSheet(data: Record<string, string>, userAgent: string) {
  if (!SHEET_ID) return;
  const auth = getGoogleAuth();
  if (!auth) return;

  const sheets = google.sheets({ version: 'v4', auth });

  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
  const hora = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });

  const { device, browser } = parseUserAgent(userAgent);

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
    device,
    browser,
    data.score || '0',
    data.totalTime || '0',
    data.pageCount || '0',
    data.pagesVisited || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Leads!A:P',
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
      const userAgent = request.headers.get('user-agent') || '';
      await appendToSheet(data, userAgent);
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
