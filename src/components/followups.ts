import { FollowupsSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';

export function insertSuggestionIntoHost(text: string): boolean {
  if (typeof document === 'undefined') return false;

  // 1. Try Gemini contenteditable in rich-textarea
  const geminiInput = document.querySelector<HTMLElement>(
    'rich-textarea div[contenteditable="true"], .ql-editor[contenteditable="true"], div[contenteditable="true"][role="textbox"]',
  );

  if (geminiInput) {
    geminiInput.focus();
    // Insert text safely using DOM text node / Selection API
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        geminiInput.textContent = text;
      }
    } catch {
      geminiInput.textContent = text;
    }
    geminiInput.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // 2. Try Grok main textarea or contenteditable
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[placeholder*="Ask" i], textarea[placeholder*="Grok" i], textarea',
  );

  if (textarea) {
    textarea.focus();
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // 3. Fallback: any contenteditable
  const fallbackEditable = document.querySelector<HTMLElement>('div[contenteditable="true"]');
  if (fallbackEditable) {
    fallbackEditable.focus();
    fallbackEditable.textContent = text;
    fallbackEditable.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
}

export function renderFollowups(spec: FollowupsSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-followups-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const suggestions = spec.suggestions || [];
  const container = h('div', { class: 'iui-followups-container' });

  for (const suggestion of suggestions) {
    const iconSpan = h('span', { class: 'iui-followup-icon' }, iconEl('sparkles', 13));
    const textSpan = h('span', { class: 'iui-followup-text' }, suggestion);

    const chip = h(
      'button',
      {
        type: 'button',
        class: 'iui-btn secondary iui-followup-chip c-lavender',
        onClick: () => {
          insertSuggestionIntoHost(suggestion);
          // Visual click feedback
          chip.classList.add('is-clicked');
          setTimeout(() => {
            chip.classList.remove('is-clicked');
          }, 1200);
        },
      },
      iconSpan,
      textSpan,
    ) as HTMLButtonElement;

    container.appendChild(chip);
  }

  card.appendChild(container);
  return card;
}
