// Agent tools registry — import all tools here (they self-register via defineTool).
// Used by agents + /api/agents/* endpoints.

export { toolRegistry, toAnthropicTools } from './define';
export { executeTool, PolicyViolation } from './middleware';
export { isForbidden, FORBIDDEN_TOKENS } from './FORBIDDEN';

// ─── CRM tools ───
import './crm/get-contact';
import './crm/get-contact-timeline';

// ─── Catalog tools (read-only, for quote_drafter + service_recommender) ───
import './catalog/get-catalog';

// Import future tools here:
// import './quotes/draft-create';
// import './kb/search';
