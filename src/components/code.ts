import { CodeSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';
import { iconEl } from '../core/icons';
import { tokenizeLines, normalizeLanguage } from './codeTokenizer';

export function renderCode(spec: CodeSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-code-card' });

  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const rawCode = spec.code ?? '';
  const lang = spec.language || 'text';
  const normLang = normalizeLanguage(lang);

  // Inner header with language pill, filename, soft-wrap, and copy button
  const innerHeader = h('div', { class: 'iui-code-inner-header' });

  const metaLeft = h('div', { class: 'iui-code-meta-left' });
  const langPill = h('span', { class: 'iui-code-lang-pill' }, normLang.toUpperCase());
  metaLeft.appendChild(langPill);

  if (spec.filename) {
    const fnEl = h('span', { class: 'iui-code-filename', title: spec.filename }, spec.filename);
    metaLeft.appendChild(fnEl);
  }
  innerHeader.appendChild(metaLeft);

  const controls = h('div', { class: 'iui-code-controls' });

  // Soft-wrap toggle
  let isWrapped = false;
  const wrapBtn = h(
    'button',
    {
      class: 'iui-code-btn',
      type: 'button',
      title: 'Toggle word wrap',
      'aria-label': 'Toggle word wrap',
      'aria-pressed': 'false',
      onClick: () => {
        isWrapped = !isWrapped;
        wrapBtn.setAttribute('aria-pressed', String(isWrapped));
        if (isWrapped) {
          wrapBtn.classList.add('is-active');
          pre.classList.add('is-wrapped');
        } else {
          wrapBtn.classList.remove('is-active');
          pre.classList.remove('is-wrapped');
        }
      },
    },
    'Wrap',
  );
  controls.appendChild(wrapBtn);

  // Copy code button with check animation
  let copyTimeoutId: number | null = null;
  const copyBtn = h(
    'button',
    {
      class: 'iui-code-btn',
      type: 'button',
      title: 'Copy code',
      'aria-label': 'Copy code',
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(rawCode);
          clear(copyBtn);
          copyBtn.classList.add('is-copied');
          copyBtn.appendChild(iconEl('check', 13));
          copyBtn.appendChild(document.createTextNode(' Copied'));

          if (copyTimeoutId !== null) window.clearTimeout(copyTimeoutId);
          copyTimeoutId = window.setTimeout(() => {
            clear(copyBtn);
            copyBtn.classList.remove('is-copied');
            copyBtn.appendChild(iconEl('copy', 13));
            copyBtn.appendChild(document.createTextNode(' Copy'));
            copyTimeoutId = null;
          }, 1500);
        } catch {
          // ignore clipboard errors
        }
      },
    },
    iconEl('copy', 13),
    document.createTextNode(' Copy'),
  );
  controls.appendChild(copyBtn);
  innerHeader.appendChild(controls);
  card.appendChild(innerHeader);

  // Tokenize code into lines of tokens
  const tokenLines = tokenizeLines(rawCode, normLang);

  // Code body with line numbers
  const codeWrap = h('div', { class: 'iui-code-wrap' });
  const pre = h('pre', { class: 'iui-code-pre' });

  for (let lineIdx = 0; lineIdx < tokenLines.length; lineIdx++) {
    const lineTokens = tokenLines[lineIdx];
    const lineRow = h('div', { class: 'iui-code-line' });

    // Line number (unselectable)
    const numSpan = h('span', { class: 'iui-code-line-num', 'aria-hidden': 'true' }, String(lineIdx + 1));
    lineRow.appendChild(numSpan);

    // Code content (spans built with h() helper, no innerHTML)
    const contentSpan = h('span', { class: 'iui-code-line-content' });
    if (lineTokens.length === 0) {
      // Empty line preserved
      contentSpan.appendChild(document.createTextNode(' '));
    } else {
      for (const token of lineTokens) {
        if (token.type === 'plain') {
          contentSpan.appendChild(document.createTextNode(token.value));
        } else {
          contentSpan.appendChild(h('span', { class: `token token-${token.type}` }, token.value));
        }
      }
    }
    lineRow.appendChild(contentSpan);
    pre.appendChild(lineRow);
  }

  codeWrap.appendChild(pre);
  card.appendChild(codeWrap);

  return card;
}
