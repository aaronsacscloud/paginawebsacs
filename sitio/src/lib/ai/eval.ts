// Simple eval runner for agents.
// Usage: bun src/lib/ai/eval.ts <agent_name>
// Reads eval-golden/<agent_name>.jsonl, applies runner, compares vs expected.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface EvalCase {
  id: string;
  input: any;
  expected: any;
  notes?: string;
  critical?: boolean;
}

export interface EvalResult {
  case_id: string;
  passed: boolean;
  failures: string[];
  actual?: any;
}

/** Partial match: every key in expected must be present in actual with same value.
 *  Supports `_gte`, `_lte`, `_contains` suffixes for flexible comparisons.
 */
export function partialMatch(expected: any, actual: any, path = ''): string[] {
  const failures: string[] = [];
  for (const key of Object.keys(expected || {})) {
    const fullPath = path ? `${path}.${key}` : key;

    if (key.endsWith('_gte')) {
      const real = key.replace('_gte', '');
      const actualVal = Number(actual?.[real]);
      const expectedVal = Number(expected[key]);
      if (isNaN(actualVal) || actualVal < expectedVal) {
        failures.push(`${fullPath}: actual=${actualVal} < expected_gte=${expectedVal}`);
      }
      continue;
    }
    if (key.endsWith('_lte')) {
      const real = key.replace('_lte', '');
      const actualVal = Number(actual?.[real]);
      const expectedVal = Number(expected[key]);
      if (isNaN(actualVal) || actualVal > expectedVal) {
        failures.push(`${fullPath}: actual=${actualVal} > expected_lte=${expectedVal}`);
      }
      continue;
    }
    if (key.endsWith('_contiene') || key.endsWith('_contains')) {
      const real = key.replace(/_contiene|_contains/, '');
      const arr = Array.isArray(actual?.[real]) ? actual[real] : [];
      const must = Array.isArray(expected[key]) ? expected[key] : [expected[key]];
      for (const m of must) {
        if (!arr.includes(m)) failures.push(`${fullPath}: missing item "${m}" in ${real}`);
      }
      continue;
    }

    // Exact match for primitives
    const expectedVal = expected[key];
    const actualVal = actual?.[key];

    if (typeof expectedVal === 'object' && expectedVal !== null && !Array.isArray(expectedVal)) {
      failures.push(...partialMatch(expectedVal, actualVal, fullPath));
    } else if (expectedVal !== actualVal) {
      failures.push(`${fullPath}: expected=${JSON.stringify(expectedVal)}, actual=${JSON.stringify(actualVal)}`);
    }
  }
  return failures;
}

/** Load cases from JSONL file. */
export function loadCases(agentName: string): EvalCase[] {
  const path = join(process.cwd(), 'src/lib/ai/eval-golden', `${agentName}.jsonl`);
  if (!existsSync(path)) {
    console.warn(`[eval] No golden file found: ${path}`);
    return [];
  }
  const content = readFileSync(path, 'utf-8');
  return content.split('\n')
    .filter(l => l.trim())
    .map((l, i) => {
      try { return JSON.parse(l) as EvalCase; }
      catch { console.warn(`[eval] Invalid JSONL line ${i + 1}`); return null; }
    })
    .filter(Boolean) as EvalCase[];
}

/** Runner that applies a function to each case + checks output. */
export async function runEvals<T>(
  agentName: string,
  runner: (input: any) => Promise<T>,
): Promise<{ cases: EvalResult[]; summary: { total: number; passed: number; pass_rate: number; critical_failures: number } }> {
  const cases = loadCases(agentName);
  const results: EvalResult[] = [];
  for (const c of cases) {
    try {
      const actual = await runner(c.input);
      const failures = partialMatch(c.expected, actual);
      results.push({
        case_id: c.id,
        passed: failures.length === 0,
        failures,
        actual,
      });
    } catch (err: any) {
      results.push({
        case_id: c.id,
        passed: false,
        failures: [`runner threw: ${err?.message || String(err)}`],
      });
    }
  }
  const passed = results.filter(r => r.passed).length;
  const criticalFailures = cases
    .filter((c, i) => c.critical && !results[i]?.passed)
    .length;
  return {
    cases: results,
    summary: {
      total: cases.length,
      passed,
      pass_rate: cases.length ? Math.round((passed / cases.length) * 100) : 0,
      critical_failures: criticalFailures,
    },
  };
}

// CLI mode
if (import.meta.main || process.argv[1]?.endsWith('eval.ts')) {
  const agentName = process.argv[2];
  if (!agentName) {
    console.error('Usage: bun src/lib/ai/eval.ts <agent_name>');
    process.exit(1);
  }
  const cases = loadCases(agentName);
  console.log(`━━━ Loaded ${cases.length} eval cases for ${agentName} ━━━`);
  if (cases.length === 0) {
    console.log('No cases found. Add JSONL at src/lib/ai/eval-golden/' + agentName + '.jsonl');
    process.exit(0);
  }
  for (const c of cases) {
    console.log(`  ${c.critical ? '⭐' : ' '} ${c.id}${c.notes ? ` — ${c.notes}` : ''}`);
  }
  console.log(`\nRun with actual agent via importing runEvals() in a test file.`);
}
