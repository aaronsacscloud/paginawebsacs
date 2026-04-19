// Inngest client — durable function runtime for long-running agents.
// v4: events are untyped at client level; enforce shapes in agent handlers.

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'sacs-crm',
});
