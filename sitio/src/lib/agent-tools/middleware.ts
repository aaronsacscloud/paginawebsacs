// Runtime policy enforcement + tool execution wrapper.
// Every tool call goes through this. Reads agent_policies from DB.

import { supabase } from '../supabase';
import { toolRegistry, type RunContext, type ToolDefinition } from './define';
import { isForbidden } from './FORBIDDEN';
import { logToolCall } from '../ai/audit';

export class PolicyViolation extends Error {
  constructor(public tool: string, public reason: string) {
    super(`Policy violation on ${tool}: ${reason}`);
    this.name = 'PolicyViolation';
  }
}

async function getPolicy(agent_name: string, action_type: string) {
  if (!action_type) return null;
  const { data } = await supabase
    .from('agent_policies')
    .select('*')
    .eq('agent_name', agent_name)
    .eq('action_type', action_type)
    .maybeSingle();
  return data;
}

async function countTodayExecutions(agent_name: string, tool_name: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('agent_tool_log')
    .select('id', { count: 'exact', head: true })
    .eq('tool_name', tool_name)
    .gte('called_at', today.toISOString());
  return count || 0;
}

export interface ExecuteToolResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  latency_ms: number;
}

/**
 * Execute a tool call with full middleware:
 * 1. FORBIDDEN check
 * 2. Registry lookup
 * 3. Zod schema validation
 * 4. Policy enforcement (agent_policies)
 * 5. Daily limit check
 * 6. Run handler
 * 7. Log to agent_tool_log
 */
export async function executeTool<T = any>(
  tool_name: string,
  args: any,
  ctx: RunContext,
): Promise<ExecuteToolResult<T>> {
  const t0 = Date.now();

  // 1. FORBIDDEN
  if (isForbidden(tool_name)) {
    const err = `Tool "${tool_name}" is forbidden`;
    await logToolCall(ctx.run_id, tool_name, args, null, Date.now() - t0, err);
    return { ok: false, error: err, latency_ms: Date.now() - t0 };
  }

  // 2. Registry
  const tool = toolRegistry[tool_name] as ToolDefinition | undefined;
  if (!tool) {
    const err = `Tool "${tool_name}" not found in registry`;
    await logToolCall(ctx.run_id, tool_name, args, null, Date.now() - t0, err);
    return { ok: false, error: err, latency_ms: Date.now() - t0 };
  }

  // 3. Zod validation
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    const err = {
      message: 'Schema validation failed',
      issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      argsReceived: args,
    };
    await logToolCall(ctx.run_id, tool_name, args, null, Date.now() - t0, err);
    return { ok: false, error: JSON.stringify(err), latency_ms: Date.now() - t0 };
  }

  // 4. Policy enforcement
  if (tool.action_type) {
    const policy = await getPolicy(ctx.agent_name, tool.action_type);
    if (policy?.requires_approval && !ctx.approved) {
      const err = `Action "${tool.action_type}" requires approval (policy)`;
      await logToolCall(ctx.run_id, tool_name, args, null, Date.now() - t0, err);
      return { ok: false, error: err, latency_ms: Date.now() - t0 };
    }
    if (policy?.daily_limit) {
      const count = await countTodayExecutions(ctx.agent_name, tool_name);
      if (count >= policy.daily_limit) {
        const err = `Daily limit (${policy.daily_limit}) reached for ${tool_name}`;
        await logToolCall(ctx.run_id, tool_name, args, null, Date.now() - t0, err);
        return { ok: false, error: err, latency_ms: Date.now() - t0 };
      }
    }
  }

  // 5-7. Run + log
  try {
    const result = await tool.handler(parsed.data, ctx);
    const latency = Date.now() - t0;
    await logToolCall(ctx.run_id, tool_name, args, result, latency);
    return { ok: true, data: result as T, latency_ms: latency };
  } catch (err: any) {
    const latency = Date.now() - t0;
    const errMsg = err?.message || String(err);
    await logToolCall(ctx.run_id, tool_name, args, null, latency, { message: errMsg });
    return { ok: false, error: errMsg, latency_ms: latency };
  }
}
