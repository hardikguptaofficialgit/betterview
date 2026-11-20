import { SiteAdapter } from './sites';

export function startAutoInject(adapter: SiteAdapter, text: string): () => void {
  let lastInjectedHref = '';

  const handleTrigger = (e: Event): void => {
    try {
      if (typeof window === 'undefined' || !adapter.isNewChat(window.location)) {
        return;
      }
      if (window.location.href === lastInjectedHref) {
        return;
      }

      const composer = adapter.composer();
      if (!composer) return;

      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) {
          return;
        }
        const target = e.target as Node | null;
        if (!target || (!composer.contains(target) && target !== composer)) {
          return;
        }
      } else if (e instanceof MouseEvent) {
        const sendBtn = adapter.sendButton();
        if (!sendBtn) return;
        const target = e.target as Node | null;
        if (!target || (!sendBtn.contains(target) && target !== sendBtn)) {
          return;
        }
      } else {
        return;
      }

      const checkPrefix = text.slice(0, 40);

      if (composer instanceof HTMLTextAreaElement) {
        if (composer.value.startsWith(checkPrefix)) {
          return;
        }
        const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
        if (desc && desc.set) {
          desc.set.call(composer, text + '\n\n' + composer.value);
        } else {
          composer.value = text + '\n\n' + composer.value;
        }
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        lastInjectedHref = window.location.href;
      } else {
        const currentText = (composer.textContent || '').trim();
        if (currentText.startsWith(checkPrefix)) {
          return;
        }
        composer.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.setStart(composer, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        document.execCommand('insertText', false, text + '\n\n');
        lastInjectedHref = window.location.href;
      }
    } catch {
      // ignore
    }
  };

  document.addEventListener('keydown', handleTrigger, true);
  document.addEventListener('click', handleTrigger, true);

  return () => {
    document.removeEventListener('keydown', handleTrigger, true);
    document.removeEventListener('click', handleTrigger, true);
  };
}
