// Inngest webhook endpoint — serves all agent functions.
// Local dev: Inngest dev server connects here.
// Prod: Inngest cloud sends events here.

import { serve } from 'inngest/astro';
import { inngest } from '../../inngest/client';
import { helloAgent } from '../../inngest/agents/hello';
import { meetingPrepAgent } from '../../inngest/agents/meeting-prep';

export const prerender = false;

const handler = serve({
  client: inngest,
  functions: [
    helloAgent,
    meetingPrepAgent,
    // Add more agents here:
    // quoteDrafterAgent,
    // serviceRecommenderAgent,
  ],
});

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
