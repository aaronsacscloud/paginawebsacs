// Agent run audit — writes to agent_runs, tracks tool calls, computes cost.
// Called from every agent execution.

import { supabase } from '../supabase';
import type { AgentRunUsage } from './client';

export interface CreateAgentRunArgs {
  agent_name: string;
  agent_version?: string;
  trigger_type: 'cron' | 'event' | 'webhook' | 'user' | 'manual';
  trigger_ref?: string;
  owner_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  deal_id?: string | null;
  input: Record<string, any>;
  assigned_to?: string | null;
  model: string;
  pii_fields?: string[];
  parent_run_id?: string;
}

export async function createAgentRun(args: CreateAgentRunArgs): Promise<string> {
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: args.agent_name,
      agent_version: args.agent_version || 'v1',
      trigger_type: args.trigger_type,
      trigger_ref: args.trigger_ref || null,
      owner_id: args.owner_id || null,
      contact_id: args.contact_id || null,
      company_id: args.company_id || null,
      deal_id: args.deal_id || null,
      input: args.input,
      assigned_to: args.assigned_to || null,
      model: args.model,
      pii_fields: args.pii_fields || [],
      parent_run_id: args.parent_run_id || null,
      status: 'running',
    })
    .select('id')
    .single();

  if (error) throw new Error(`[audit] createAgentRun failed: ${error.message}`);
  return data!.id as string;
}

export interface FinishAgentRunArgs {
  run_id: string;
  status: 'completed' | 'failed' | 'awaiting_approval' | 'timeout';
  output?: any;
  reasoning?: string;
  tool_calls?: any[];
  usage?: AgentRunUsage;
  latency_ms?: number;
  error?: any;
  langfuse_trace_id?: string;
}

export async function finishAgentRun(args: FinishAgentRunArgs): Promise<void> {
  const updates: any = {
    status: args.status,
  };
  if (args.output !== undefined) updates.output = args.output;
  if (args.reasoning !== undefined) updates.reasoning = args.reasoning;
  if (args.tool_calls !== undefined) updates.tool_calls = args.tool_calls;
  if (args.usage) {
    updates.input_tokens = args.usage.input_tokens;
    updates.output_tokens = args.usage.output_tokens;
    updates.cache_read_tokens = args.usage.cache_read_tokens;
    updates.cache_write_tokens = args.usage.cache_write_tokens;
    updates.cost_usd = args.usage.cost_usd;
  }
  if (args.latency_ms !== undefined) updates.latency_ms = args.latency_ms;
  if (args.error !== undefined) updates.error = args.error;
  if (args.langfuse_trace_id) updates.langfuse_trace_id = args.langfuse_trace_id;

  const { error } = await supabase.from('agent_runs').update(updates).eq('id', args.run_id);
  if (error) console.error(`[audit] finishAgentRun error:`, error);
}

export async function logToolCall(run_id: string, tool_name: string, args: any, result: any, latency_ms: number, error?: any): Promise<void> {
  await supabase.from('agent_tool_log').insert({
    run_id,
    tool_name,
    args,
    result: error ? null : result,
    latency_ms,
    error: error ? (typeof error === 'string' ? { message: error } : error) : null,
  });
}

export async function recordMetric(agent_name: string, run_id: string | null, metric_name: string, metric_value?: number, metric_payload?: any): Promise<void> {
  await supabase.from('agent_metrics').insert({
    agent_name,
    run_id: run_id || null,
    metric_name,
    metric_value: metric_value ?? null,
    metric_payload: metric_payload ?? null,
  });
}
