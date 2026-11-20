import { UIType, UI_TYPES } from './types';

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; typeHint?: UIType };

export function sniffType(text: string): UIType | undefined {
  const head = text.slice(0, 300).replace(/[“”]/g, '"');
  const match = head.match(/"type"\s*:\s*"([a-z]+)"/);
  if (match && (UI_TYPES as readonly string[]).includes(match[1])) {
    return match[1] as UIType;
  }
  return undefined;
}

export function looksLikeUiBlock(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') && sniffType(text) !== undefined;
}

export function tryParse(text: string): ParseResult {
  const typeHint = sniffType(text);

  if (text.length > 60000) {
    return { ok: false, error: 'Input exceeds 60,000 characters', typeHint };
  }

  let s = text.trim();
  if (!s) {
    return { ok: false, error: 'Empty input', typeHint };
  }

  const newlineIdx = s.indexOf('\n');
  const firstLine = (newlineIdx !== -1 ? s.slice(0, newlineIdx) : s).trim();
  if (firstLine === 'ui' || firstLine === 'json' || firstLine.startsWith('```')) {
    s = newlineIdx !== -1 ? s.slice(newlineIdx + 1).trim() : '';
  }

  if (s.endsWith('```')) {
    s = s.slice(0, -3).trim();
  }

  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/,\s*([}\]])/g, '$1');
  }

  const currentTypeHint = typeHint || sniffType(s);

  try {
    const value = JSON.parse(s);
    return { ok: true, value };
  } catch (err: unknown) {
    if (s.includes('“') || s.includes('”')) {
      const fixed = s.replace(/[“”]/g, '"');
      try {
        const value = JSON.parse(fixed);
        return { ok: true, value };
      } catch (retryErr: unknown) {
        const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        return { ok: false, error: msg, typeHint: currentTypeHint };
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, typeHint: currentTypeHint };
  }
}
