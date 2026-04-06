import type { APIRoute } from 'astro';
import { list } from '@vercel/blob';

export const prerender = false;

const ADMIN_PASSWORD = 'Javaescutia22!';

export const GET: APIRoute = async ({ request }) => {
  // Auth disabled for now

  try {
    const { blobs } = await list({ prefix: 'leads/' });

    const leads = await Promise.all(
      blobs.map(async (blob) => {
        const res = await fetch(blob.url);
        return res.json();
      })
    );

    // Sort by timestamp descending (newest first)
    leads.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return new Response(JSON.stringify({ leads, total: leads.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
