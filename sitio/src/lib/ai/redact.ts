// PII redactor for SACS agents.
// Applies to BOTH prompts (pre-LLM) AND ingest (pre-embed).
// Never loses data: returns redacted text + fields detected for audit.

export interface RedactResult {
  text: string;
  piiFields: string[];   // what types of PII were found
  count: number;
}

// Regex patterns for Mexican + international PII
const PATTERNS: Array<{ name: string; regex: RegExp; replace: string }> = [
  // Mexican RFC (tax ID): 4 letters + 6 digits + 3 alphanumeric
  { name: 'rfc', regex: /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi, replace: '[RFC]' },

  // CURP (Mexican personal ID): 18 characters specific format
  { name: 'curp', regex: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}\b/gi, replace: '[CURP]' },

  // Email (generic)
  { name: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replace: '[EMAIL]' },

  // Mexican phone: +52 followed by 10 digits, OR 10 digits with optional separators
  { name: 'phone_mx', regex: /\+52\s?\d{2,3}[\s-]?\d{3,4}[\s-]?\d{4}/g, replace: '[PHONE]' },
  { name: 'phone_10d', regex: /\b\d{2,3}[\s-]\d{3,4}[\s-]\d{4}\b/g, replace: '[PHONE]' },
  { name: 'phone_e164', regex: /\+\d{10,15}/g, replace: '[PHONE]' },

  // CLABE (Mexican bank): exactly 18 digits (order matters — must match before CC)
  { name: 'clabe', regex: /\b\d{18}\b/g, replace: '[CLABE]' },

  // Credit cards (Visa/MC/Amex basic): 13-19 digits with optional spaces/dashes
  { name: 'cc', regex: /\b(?:\d[ -]*?){13,19}\b/g, replace: '[CC]' },

  // Bank account (generic 10-16 digits surrounded by context words)
  { name: 'bank_account', regex: /cuenta[:\s]+\d{10,16}\b/gi, replace: 'cuenta: [ACCOUNT]' },
];

export function redactPII(input: string | null | undefined): RedactResult {
  if (!input) return { text: '', piiFields: [], count: 0 };
  let text = input;
  const piiFields = new Set<string>();
  let count = 0;

  for (const { name, regex, replace } of PATTERNS) {
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      piiFields.add(name);
      count += matches.length;
      text = text.replace(regex, replace);
    }
  }

  return {
    text,
    piiFields: Array.from(piiFields),
    count,
  };
}

/**
 * Redact recursively through a JSON object. Preserves structure.
 * Use for prompts that pass structured data to LLM.
 */
export function redactObject<T extends Record<string, any>>(obj: T): { obj: T; piiFields: string[] } {
  const allFields = new Set<string>();

  const walk = (value: any): any => {
    if (typeof value === 'string') {
      const { text, piiFields } = redactPII(value);
      piiFields.forEach(f => allFields.add(f));
      return text;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: any = {};
      for (const key of Object.keys(value)) {
        out[key] = walk(value[key]);
      }
      return out;
    }
    return value;
  };

  const redacted = walk(obj) as T;
  return { obj: redacted, piiFields: Array.from(allFields) };
}

/**
 * Wrap untrusted user content (transcripts, client inputs) for prompt safety.
 * Prevents prompt injection by clearly marking boundaries.
 */
export function wrapUntrusted(content: string): string {
  return `<untrusted_user_content>\n${content}\n</untrusted_user_content>`;
}
