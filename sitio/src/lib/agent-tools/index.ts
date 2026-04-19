// Agent tools registry — import all tools here (they self-register via defineTool).
// Used by agents + /api/agents/* endpoints.

export { toolRegistry, toAnthropicTools } from './define';
export { executeTool, PolicyViolation } from './middleware';
export { isForbidden, FORBIDDEN_TOKENS } from './FORBIDDEN';

// ─── CRM tools ───
import './crm/get-contact';
import './crm/get-contact-timeline';

// Import future tools here:
// import './quotes/draft-create';
// import './catalog/get-services';
// import './kb/search';
