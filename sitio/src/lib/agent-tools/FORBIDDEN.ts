// Endpoints/operations that must NEVER be exposed as agent tools.
// Any tool name matching these tokens will fail CI test.
// Keeps agents from executing irreversible or destructive operations.

export const FORBIDDEN_TOKENS = [
  'stripe-webhook',       // inbound webhook endpoint, not for agents
  'cancel-subscription',  // churn is human decision
  'mark-paid',            // accounting truth, not AI-decided
  'mark-accepted',        // legal signature, not AI-decided
  'mark-rejected',        // customer intent, not AI-decided
  'delete',               // destructive
  'drop',                 // destructive
  'purge',                // destructive
  'create-payment-link',  // Stripe charges go through controlled flow
  'webhook',              // generic webhooks not suitable for agent invocation
] as const;

export function isForbidden(toolName: string): boolean {
  const t = toolName.toLowerCase();
  return FORBIDDEN_TOKENS.some(token => t.includes(token));
}
