// Inngest webhook endpoint — serves all agent functions.
// Local dev: Inngest dev server connects here.
// Prod: Inngest cloud sends events here.

import { serve } from 'inngest/astro';
import { inngest } from '../../inngest/client';
import { helloAgent } from '../../inngest/agents/hello';
import { meetingPrepAgent } from '../../inngest/agents/meeting-prep';
import { quoteDrafterAgent } from '../../inngest/agents/quote-drafter';
import { serviceRecommenderAgent } from '../../inngest/agents/service-recommender';
import { churnWatchdogAgent } from '../../inngest/agents/churn-watchdog';
import { leadDistributorAgent } from '../../inngest/agents/lead-distributor';

export const prerender = false;

const handler = serve({
  client: inngest,
  functions: [
    helloAgent,
    meetingPrepAgent,
    quoteDrafterAgent,
    serviceRecommenderAgent,
    churnWatchdogAgent,
    leadDistributorAgent,
  ],
});

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
