// Thin wrapper over Anthropic SDK + Vercel AI SDK.
// Centralizes: model selection, prompt caching, cost tracking, retry.

import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_KEY = (import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim();

export const anthropic = new Anthropic({
  apiKey: ANTHROPIC_KEY,
});

// Model constants (centralized for easy version bump via canary)
export const MODELS = {
  sonnet: 'claude-sonnet-4-7' as const,
  haiku: 'claude-haiku-4-5' as const,
  sonnet_fallback: 'claude-sonnet-4-5' as const,
} as const;

// Pricing per 1M tokens (input/output) in USD — for cost tracking
export const PRICING: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  'claude-sonnet-4-7': { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },
  'claude-haiku-4-5': { input: 1.00, output: 5.00, cache_read: 0.10, cache_write: 1.25 },
};

export interface AgentRunUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
  model: string;
}

export function calculateCost(model: string, usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}): AgentRunUsage {
  const p = PRICING[model] || PRICING['claude-sonnet-4-7'];
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cw = usage.cache_creation_input_tokens || 0;
  const cr = usage.cache_read_input_tokens || 0;

  // Standard pricing per 1M tokens
  const cost = (input * p.input + output * p.output + cr * p.cache_read + cw * p.cache_write) / 1_000_000;

  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens: cr,
    cache_write_tokens: cw,
    cost_usd: Math.round(cost * 1_000_000) / 1_000_000, // 6 decimals
    model,
  };
}

export function hasApiKey(): boolean {
  return ANTHROPIC_KEY.length > 0;
}
