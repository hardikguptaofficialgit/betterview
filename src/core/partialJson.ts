/**
 * Tolerant incremental JSON parser for streaming UI blocks.
 * Auto-closes open strings, arrays, and objects so a partial value
 * can be read on every mutation.
 */

export interface PartialJsonResult {
  ok: boolean;
  value?: any;
  error?: string;
}

/**
 * Strips code fences and markdown boilerplate from start and end.
 */
export function cleanJsonPrefix(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Remove leading ```ui or ```json or ui or json
  const newlineIdx = s.indexOf('\n');
  const firstLine = (newlineIdx !== -1 ? s.slice(0, newlineIdx) : s).trim();
  if (firstLine === 'ui' || firstLine === 'json' || firstLine.startsWith('```')) {
    s = newlineIdx !== -1 ? s.slice(newlineIdx + 1).trim() : '';
  }

  // Remove trailing ```
  if (s.endsWith('```')) {
    s = s.slice(0, -3).trim();
  }

  return s;
}

/**
 * Attempts to auto-close an incomplete JSON string into valid parseable JSON.
 */
function tryAutoClose(text: string): string | null {
  let s = text.trim();
  if (!s) return null;

  // Track state
  const stack: ('{' | '[')[] = [];
  let inString = false;
  let escapeNext = false;
  let lastNonWhitespaceChar = '';

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      escapeNext = false;
      lastNonWhitespaceChar = ch;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch);
      lastNonWhitespaceChar = ch;
    } else if (ch === '}') {
      if (stack.length > 0 && stack[stack.length - 1] === '{') {
        stack.pop();
      }
      lastNonWhitespaceChar = ch;
    } else if (ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === '[') {
        stack.pop();
      }
      lastNonWhitespaceChar = ch;
    } else if (!/\s/.test(ch)) {
      lastNonWhitespaceChar = ch;
    }
  }

  // If ended while escaping, drop the trailing backslash
  if (inString && escapeNext) {
    s = s.slice(0, -1);
  }

  // If inside a string, close it
  if (inString) {
    s += '"';
    lastNonWhitespaceChar = '"';
  }

  // Trim trailing whitespace
  s = s.trim();

  // Strip trailing comma if any
  s = s.replace(/,\s*$/, '');

  // If ended on a colon, append null or empty string
  if (/:\s*$/.test(s)) {
    s += '""';
  }

  // Strip any trailing comma again
  s = s.replace(/,\s*$/, '');

  // Auto-close any unclosed objects/arrays in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    const opener = stack[i];
    s = s.replace(/,\s*$/, '');
    if (opener === '{') {
      // If object ends with dangling key or colon, fix it
      if (/:\s*$/.test(s)) {
        s += '""';
      }
      s += '}';
    } else {
      s += ']';
    }
  }

  return s;
}

/**
 * Attempts to parse a partial/streaming JSON string.
 * Gracefully handles arbitrary cut-off points by repairing and backtracking
 * if needed to recover the maximum valid partial structure.
 */
export function parsePartialJson(raw: string): PartialJsonResult {
  const cleaned = cleanJsonPrefix(raw);
  if (!cleaned) {
    return { ok: false, error: 'Empty input' };
  }

  // First, quick check if complete valid JSON
  try {
    const val = JSON.parse(cleaned);
    return { ok: true, value: val };
  } catch {
    // Continue to partial recovery
  }

  // Strategy 1: standard auto-closing
  let candidate = tryAutoClose(cleaned);
  if (candidate) {
    try {
      const val = JSON.parse(candidate);
      return { ok: true, value: val };
    } catch {
      // Continue to backtracking
    }
  }

  // Strategy 2: If cut off in an incomplete key-value pair, backtrack to previous comma/bracket
  let current = cleaned;
  for (let attempt = 0; attempt < 8; attempt++) {
    // Find last comma or structural boundary outside of strings if possible
    const lastComma = current.lastIndexOf(',');
    const lastOpenBrace = current.lastIndexOf('{');
    const lastOpenBracket = current.lastIndexOf('[');
    const cutPos = Math.max(lastComma, lastOpenBrace, lastOpenBracket);

    if (cutPos <= 0) break;

    // Truncate before or at boundary
    if (cutPos === lastComma) {
      current = current.slice(0, cutPos).trim();
    } else {
      current = current.slice(0, cutPos + 1).trim();
    }

    const repaired = tryAutoClose(current);
    if (repaired) {
      try {
        const val = JSON.parse(repaired);
        return { ok: true, value: val };
      } catch {
        // keep backtracking
      }
    }
  }

  return { ok: false, error: 'Could not recover partial JSON' };
}
