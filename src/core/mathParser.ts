import { clear, h } from './dom';

export type MathToken =
  | { type: 'text'; text: string }
  | { type: 'inline-math'; latex: string; raw: string }
  | { type: 'display-math'; latex: string; raw: string };

let katexPromise: Promise<any> | null = null;

export async function getKaTeX(): Promise<any> {
  if (!katexPromise) {
    katexPromise = import('katex').then((m) => m.default || m);
  }
  return katexPromise;
}

/**
 * Parses a string for LaTeX delimiters:
 * - $$...$$ for display math
 * - $...$ for inline math (cannot be empty, cannot start/end with whitespace)
 * - Escaped \$ is treated as literal $
 */
export function parseMathDelimiters(text: string): MathToken[] {
  const tokens: MathToken[] = [];
  if (!text) return tokens;

  let i = 0;
  let textStart = 0;

  while (i < text.length) {
    // Escaped dollar: skip over both chars
    if (text[i] === '\\' && i + 1 < text.length && text[i + 1] === '$') {
      i += 2;
      continue;
    }

    if (text[i] === '$') {
      // Check for display math $$...$$
      if (i + 1 < text.length && text[i + 1] === '$') {
        const closeIdx = text.indexOf('$$', i + 2);
        if (closeIdx !== -1) {
          if (i > textStart) {
            tokens.push({ type: 'text', text: text.slice(textStart, i) });
          }
          const latex = text.slice(i + 2, closeIdx);
          tokens.push({
            type: 'display-math',
            latex,
            raw: text.slice(i, closeIdx + 2),
          });
          i = closeIdx + 2;
          textStart = i;
          continue;
        }
      } else {
        // Inline math $...$
        // Opening $ must not be immediately followed by whitespace or another $
        if (
          i + 1 < text.length &&
          text[i + 1] !== ' ' &&
          text[i + 1] !== '\t' &&
          text[i + 1] !== '\n' &&
          text[i + 1] !== '$'
        ) {
          let closeIdx = -1;
          for (let j = i + 1; j < text.length; j++) {
            if (text[j] === '\n') break; // inline math cannot span newlines
            if (text[j] === '\\' && j + 1 < text.length) {
              j++; // skip escaped char
              continue;
            }
            if (text[j] === '$') {
              // Closing $ must not be preceded by whitespace
              if (text[j - 1] !== ' ' && text[j - 1] !== '\t') {
                closeIdx = j;
                break;
              }
            }
          }

          if (closeIdx !== -1 && closeIdx > i + 1) {
            if (i > textStart) {
              tokens.push({ type: 'text', text: text.slice(textStart, i) });
            }
            const latex = text.slice(i + 1, closeIdx);
            tokens.push({
              type: 'inline-math',
              latex,
              raw: text.slice(i, closeIdx + 1),
            });
            i = closeIdx + 1;
            textStart = i;
            continue;
          }
        }
      }
    }
    i++;
  }

  if (textStart < text.length) {
    tokens.push({ type: 'text', text: text.slice(textStart) });
  }

  // Normalize escaped dollars \$ to $ in plain text tokens
  for (const t of tokens) {
    if (t.type === 'text') {
      t.text = t.text.replace(/\\\$/g, '$');
    }
  }

  return tokens;
}

/**
 * Checks if a string contains any LaTeX math delimiters.
 */
export function hasMathDelimiters(text: string): boolean {
  if (!text || !text.includes('$')) return false;
  const tokens = parseMathDelimiters(text);
  return tokens.some((t) => t.type !== 'text');
}

/**
 * Renders LaTeX into an element using KaTeX, lazy-loaded.
 */
export function renderLatexInto(container: HTMLElement, latex: string, displayMode = false): void {
  getKaTeX()
    .then((katex) => {
      try {
        katex.render(latex, container, {
          displayMode,
          throwOnError: false,
        });
      } catch {
        container.textContent = latex;
      }
    })
    .catch(() => {
      container.textContent = latex;
    });
}

/**
 * Renders text with optional $...$ and $$...$$ math delimiters into a container.
 * If no math delimiters are present, sets textContent directly.
 */
export function renderMathText(container: HTMLElement, text: string): void {
  if (!text) {
    container.textContent = '';
    return;
  }

  if (!text.includes('$')) {
    container.textContent = text;
    return;
  }

  const tokens = parseMathDelimiters(text);
  const hasMath = tokens.some((t) => t.type !== 'text');
  if (!hasMath) {
    container.textContent = text;
    return;
  }

  clear(container);
  for (const token of tokens) {
    if (token.type === 'text') {
      container.appendChild(document.createTextNode(token.text));
    } else {
      const isDisplay = token.type === 'display-math';
      const el = h(isDisplay ? 'div' : 'span', {
        class: isDisplay ? 'iui-math-display' : 'iui-math-inline',
      });
      el.textContent = token.latex; // placeholder
      container.appendChild(el);
      renderLatexInto(el, token.latex, isDisplay);
    }
  }
}
