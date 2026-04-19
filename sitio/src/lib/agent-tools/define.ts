// defineTool — single helper to define an agent tool with auto-registration.
// Tools are collected in a global registry and wired to the LLM tool-use API.

import { z } from 'zod';
import { isForbidden } from './FORBIDDEN';

export interface RunContext {
  run_id: string;
  agent_name: string;
  owner_id?: string | null;     // partner or founder owning the context
  approved?: boolean;            // true if human pre-approved this run
  deal_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  trigger_type?: string;
  trigger_ref?: string | null;
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;              // e.g. 'crm.get_contact'
  description: string;
  schema: z.ZodType<TInput>;
  handler: (input: TInput, ctx: RunContext) => Promise<TOutput>;
  // Optional metadata for LLM tool-use
  action_type?: string;      // matches agent_policies.action_type for middleware
  readonly?: boolean;        // pure read = no side effects
}

// Global registry populated by defineTool() calls
export const toolRegistry: Record<string, ToolDefinition> = {};

export function defineTool<TInput, TOutput>(def: ToolDefinition<TInput, TOutput>): ToolDefinition<TInput, TOutput> {
  if (isForbidden(def.name)) {
    throw new Error(`[defineTool] Tool "${def.name}" matches FORBIDDEN token. Refusing to register.`);
  }
  if (toolRegistry[def.name]) {
    throw new Error(`[defineTool] Tool "${def.name}" already registered.`);
  }
  toolRegistry[def.name] = def as ToolDefinition;
  return def;
}

/** Convert registry to LLM tool-use format (Anthropic Messages API). */
export function toAnthropicTools() {
  return Object.values(toolRegistry).map(t => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.schema),
  }));
}

/** Minimal Zod → JSON Schema converter (for LLM tool-use). */
function zodToJsonSchema(schema: z.ZodType<any>): any {
  // For real use, consider `zod-to-json-schema` package. This is a simple subset.
  if (schema instanceof z.ZodObject) {
    const shape = (schema as any)._def.shape();
    const properties: any = {};
    const required: string[] = [];
    for (const key of Object.keys(shape)) {
      const field = shape[key];
      properties[key] = zodToJsonSchema(field);
      if (!(field instanceof z.ZodOptional)) required.push(key);
    }
    return { type: 'object', properties, required };
  }
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodArray) return { type: 'array', items: zodToJsonSchema((schema as any)._def.type) };
  if (schema instanceof z.ZodOptional) return zodToJsonSchema((schema as any)._def.innerType);
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: (schema as any)._def.values };
  return { type: 'string' }; // fallback
}
