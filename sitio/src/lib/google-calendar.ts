import { google } from 'googleapis';
import { supabase } from './supabase';
import { encryptToken, decryptToken } from './crypto/oauth-tokens';

const CLIENT_ID = (import.meta.env.GOOGLE_CALENDAR_CLIENT_ID || '').trim();
const CLIENT_SECRET = (import.meta.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
const REDIRECT_URI = (import.meta.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://www.sacscloud.com/api/scheduling/google/callback').trim();

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'openid',
  'email',
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(state?: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: state || '',
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

/**
 * Get an authenticated Google API client for a team member.
 * Auto-refreshes expired tokens.
 */
export async function getAuthenticatedClient(teamMemberId: string) {
  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('team_member_id', teamMemberId)
    .eq('provider', 'google')
    .eq('activo', true)
    .limit(1)
    .single();

  if (!conn) return null;

  const client = getOAuth2Client();
  // Tokens en DB pueden estar encrypted (prefix `enc:v1:`) o plaintext legacy.
  // decryptToken maneja ambos casos transparentemente.
  client.setCredentials({
    access_token: decryptToken(conn.access_token),
    refresh_token: decryptToken(conn.refresh_token),
    expiry_date: new Date(conn.token_expires_at).getTime(),
  });

  // Check if token is expired and refresh
  const now = Date.now();
  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (now >= expiresAt - 60000) { // Refresh 1 min before expiry
    try {
      const { credentials } = await client.refreshAccessToken();
      // Al guardar el nuevo access_token, re-encryptamos. Si el connection
      // tenía tokens legacy plaintext, este refresh los migra a encrypted.
      const update: Record<string, any> = {
        access_token: encryptToken(credentials.access_token || ''),
        token_expires_at: new Date(credentials.expiry_date || now + 3600000).toISOString(),
      };
      // Google a veces devuelve refresh_token nuevo en refresh — si viene, encrypt y persist.
      if (credentials.refresh_token) {
        update.refresh_token = encryptToken(credentials.refresh_token);
      }
      await supabase.from('calendar_connections').update(update).eq('id', conn.id);
      client.setCredentials(credentials);
    } catch (err: any) {
      console.error('Token refresh failed:', err?.message || 'unknown', err?.response?.status);
      return null;
    }
  }

  return { client, calendarId: conn.calendar_id || 'primary', connectionId: conn.id };
}

/**
 * Query Google Calendar for busy times in a date range.
 * Returns array of { start: ISO string, end: ISO string }
 */
export async function getFreeBusy(
  teamMemberId: string,
  timeMin: string,
  timeMax: string
): Promise<Array<{ start: string; end: string }>> {
  const auth = await getAuthenticatedClient(teamMemberId);
  if (!auth) return [];

  try {
    const calendar = google.calendar({ version: 'v3', auth: auth.client });
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: 'America/Mexico_City',
        items: [{ id: auth.calendarId }],
      },
    });

    const busy = res.data.calendars?.[auth.calendarId]?.busy || [];
    return busy.map(b => ({ start: b.start || '', end: b.end || '' }));
  } catch (err: any) {
    console.error('Freebusy query failed:', err?.message || 'unknown');
    return [];
  }
}

/**
 * Create a Google Calendar event with Google Meet link.
 * Returns { eventId, meetLink }
 */
export async function createCalendarEvent(
  teamMemberId: string,
  params: {
    summary: string;
    description: string;
    startDateTime: string; // ISO
    endDateTime: string; // ISO
    timezone: string;
    attendeeEmail?: string;
    hostEmail?: string;
  }
): Promise<{ eventId: string; meetLink: string } | null> {
  const auth = await getAuthenticatedClient(teamMemberId);
  if (!auth) return null;

  try {
    const calendar = google.calendar({ version: 'v3', auth: auth.client });

    const attendees: Array<{ email: string }> = [];
    if (params.attendeeEmail) attendees.push({ email: params.attendeeEmail });
    if (params.hostEmail) attendees.push({ email: params.hostEmail });

    const res = await calendar.events.insert({
      calendarId: auth.calendarId,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: { dateTime: params.startDateTime, timeZone: params.timezone },
        end: { dateTime: params.endDateTime, timeZone: params.timezone },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `sacs-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 1440 }, // 24h
            { method: 'popup', minutes: 30 },
          ],
        },
      },
    });

    return {
      eventId: res.data.id || '',
      meetLink: res.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || '',
    };
  } catch (err: any) {
    console.error('Calendar event creation failed:', err?.message || 'unknown');
    return null;
  }
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent(teamMemberId: string, eventId: string): Promise<boolean> {
  const auth = await getAuthenticatedClient(teamMemberId);
  if (!auth) return false;

  try {
    const calendar = google.calendar({ version: 'v3', auth: auth.client });
    await calendar.events.delete({ calendarId: auth.calendarId, eventId, sendUpdates: 'all' });
    return true;
  } catch (err: any) {
    console.error('Calendar event deletion failed:', err?.message || 'unknown');
    return false;
  }
}
