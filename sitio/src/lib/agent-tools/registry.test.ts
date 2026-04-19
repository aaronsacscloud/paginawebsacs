// CI test: ensures no FORBIDDEN endpoints leak into the tool registry.
// Run: node --experimental-strip-types src/lib/agent-tools/registry.test.ts

import { toolRegistry, isForbidden, FORBIDDEN_TOKENS } from './index.ts';

let passed = 0, failed = 0;
const failures: string[] = [];

// Test 1: No registered tool matches FORBIDDEN tokens
for (const toolName of Object.keys(toolRegistry)) {
  if (isForbidden(toolName)) {
    failed++;
    failures.push(`  ❌ Tool "${toolName}" matches a FORBIDDEN token`);
  } else {
    passed++;
  }
}

// Test 2: All FORBIDDEN_TOKENS are detected by isForbidden()
for (const token of FORBIDDEN_TOKENS) {
  if (isForbidden(`some-${token}-thing`)) {
    passed++;
  } else {
    failed++;
    failures.push(`  ❌ isForbidden("${token}") should be true`);
  }
}

// Test 3: Safe names not flagged
const safeNames = ['crm.get_contact', 'kb.search', 'quotes.draft_create', 'scheduling.available_slots'];
for (const name of safeNames) {
  if (isForbidden(name)) {
    failed++;
    failures.push(`  ❌ isForbidden("${name}") false positive`);
  } else {
    passed++;
  }
}

// Test 4: Registry must have at least one tool
if (Object.keys(toolRegistry).length === 0) {
  failed++;
  failures.push(`  ❌ Tool registry is empty`);
} else {
  passed++;
}

console.log(`\n━━━ Tool Registry Tests ━━━`);
console.log(`Registered tools: ${Object.keys(toolRegistry).join(', ')}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
  process.exit(1);
}
console.log('All tests passed ✓');
process.exit(0);
