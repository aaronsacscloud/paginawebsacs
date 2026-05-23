import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

// Webhooks de scheduling son integraciones internas SACS (Zapier, n8n, etc.).
// Reciben TODOS los bookings del sistema. Solo founder/cs pueden gestionarlos.
// Si en el futuro queremos webhooks por partner, requiere refactor de schema
// (agregar owner_id a cada webhook entry y filtrar en fireSchedulingWebhooks).
async function assertFounder(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || (user.role !== 'founder' && user.role !== 'cs')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }
  return null;
}

const CONFIG_SLUG = '_branding';

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'wh_';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function loadConfig(): Promise<any> {
  const { data } = await supabase
    .from('event_types')
    .select('id, descripcion')
    .eq('slug', CONFIG_SLUG)
    .single();
  if (!data?.descripcion) return { row: data, config: {} };
  return { row: data, config: JSON.parse(data.descripcion) };
}

async function saveConfig(rowId: string, config: any): Promise<void> {
  await supabase
    .from('event_types')
    .update({ descripcion: JSON.stringify(config) })
    .eq('id', rowId);
}

// GET: List webhooks
export const GET: APIRoute = async ({ request }) => {
  const denied = await assertFounder(request);
  if (denied) return denied;
  try {
    const { config } = await loadConfig();
    const webhooks = config.webhooks || [];
    return new Response(JSON.stringify(webhooks));
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to load webhooks' }),
      { status: 500 },
    );
  }
};

// POST: Register a webhook
export const POST: APIRoute = async ({ request }) => {
  const denied = await assertFounder(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { url, events, secret } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'url is required' }),
        { status: 400 },
      );
    }

    const { row, config } = await loadConfig();
    if (!row) {
      return new Response(
        JSON.stringify({ error: 'Scheduling config not found. Save branding config first.' }),
        { status: 404 },
      );
    }

    const webhooks = config.webhooks || [];
    const newWebhook = {
      id: generateId(),
      url,
      events: events || [
        'booking.created',
        'booking.cancelled',
        'booking.rescheduled',
        'booking.completed',
      ],
      secret: secret || '',
      activo: true,
    };

    webhooks.push(newWebhook);
    config.webhooks = webhooks;
    await saveConfig(row.id, config);

    return new Response(JSON.stringify(newWebhook), { status: 201 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to register webhook' }),
      { status: 500 },
    );
  }
};

// DELETE: Remove a webhook
export const DELETE: APIRoute = async ({ request }) => {
  const denied = await assertFounder(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'id is required' }),
        { status: 400 },
      );
    }

    const { row, config } = await loadConfig();
    if (!row) {
      return new Response(
        JSON.stringify({ error: 'Scheduling config not found' }),
        { status: 404 },
      );
    }

    const webhooks = config.webhooks || [];
    const idx = webhooks.findIndex((w: any) => w.id === id);
    if (idx === -1) {
      return new Response(
        JSON.stringify({ error: 'Webhook not found' }),
        { status: 404 },
      );
    }

    webhooks.splice(idx, 1);
    config.webhooks = webhooks;
    await saveConfig(row.id, config);

    return new Response(JSON.stringify({ ok: true }));
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to delete webhook' }),
      { status: 500 },
    );
  }
};
