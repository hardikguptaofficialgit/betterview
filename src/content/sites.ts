// Selectors are best guesses; if rendering doesn't trigger on a site, inspect a code block there and update only this file.

import { looksLikeUiBlock } from '../core/parse';
import { getCompactInstruction } from '../shared/systemInstruction';

export interface SiteAdapter {
  id: 'gemini' | 'grok';
  matches(loc: Location): boolean;
  chatRoot(): Element | null;
  findCodeBlocks(root: ParentNode): HTMLElement[]; // <pre> elements
  languageOf(pre: HTMLElement): string | null;
  wrapperOf(pre: HTMLElement): HTMLElement; // element to hide and insert after
  composer(): HTMLElement | null; // textarea or contenteditable
  sendButton(): HTMLElement | null;
  isNewChat(loc: Location): boolean;
}

export const GEMINI_ADAPTER: SiteAdapter = {
  id: 'gemini',
  matches(loc: Location): boolean {
    return loc.hostname === 'gemini.google.com' || loc.hostname.endsWith('.gemini.google.com');
  },
  chatRoot(): Element | null {
    return document.querySelector('main') ?? document.querySelector('chat-window') ?? document.body;
  },
  findCodeBlocks(root: ParentNode): HTMLElement[] {
    const pres = root.querySelectorAll<HTMLElement>(
      'code-block pre, .code-block pre, message-content pre, model-response pre',
    );
    const seen = new Set<HTMLElement>();
    const res: HTMLElement[] = [];
    pres.forEach((el) => {
      if (!seen.has(el)) {
        seen.add(el);
        res.push(el);
      }
    });
    return res;
  },
  languageOf(pre: HTMLElement): string | null {
    // (1) a code child whose class matches /language-([\w-]+)/
    const codeChild = pre.querySelector('code');
    if (codeChild && codeChild.className) {
      const m = codeChild.className.match(/language-([\w-]+)/);
      if (m) {
        return m[1].toLowerCase();
      }
    }

    // (2) the trimmed lowercase text of .code-block-decoration (or the first element whose text is <= 12 chars that is NOT a button) inside pre.closest('code-block, .code-block')
    const wrapper = pre.closest('code-block, .code-block');
    if (wrapper) {
      const decor = wrapper.querySelector('.code-block-decoration');
      if (decor && decor.textContent) {
        const text = decor.textContent.trim().toLowerCase();
        if (text) return text;
      }

      const elements = wrapper.querySelectorAll('*');
      for (const el of Array.from(elements)) {
        if (el.tagName.toLowerCase() === 'button' || el.closest('button')) continue;
        if (el.contains(pre)) continue;
        const txt = (el.textContent ?? '').trim();
        if (txt.length >= 1 && txt.length <= 12 && el.children.length === 0) {
          return txt.toLowerCase();
        }
      }
    }

    // (3) null
    return null;
  },
  wrapperOf(pre: HTMLElement): HTMLElement {
    return (pre.closest('code-block, .code-block') as HTMLElement) ?? pre;
  },
  composer(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      'rich-textarea [contenteditable="true"], .ql-editor[contenteditable="true"], div[contenteditable="true"][role="textbox"]',
    );
  },
  sendButton(): HTMLElement | null {
    return document.querySelector<HTMLElement>('button[aria-label*="Send" i], button.send-button');
  },
  isNewChat(loc: Location): boolean {
    return /^\/(u\/\d+\/)?(app|gem\/[^/]+)\/?$/.test(loc.pathname);
  },
};

export const GROK_ADAPTER: SiteAdapter = {
  id: 'grok',
  matches(loc: Location): boolean {
    return loc.hostname === 'grok.com' || loc.hostname.endsWith('.grok.com');
  },
  chatRoot(): Element | null {
    return document.querySelector('main') ?? document.body;
  },
  findCodeBlocks(root: ParentNode): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('pre'));
  },
  languageOf(pre: HTMLElement): string | null {
    // (1) code class language-*
    const codeChild = pre.querySelector('code');
    if (codeChild && codeChild.className) {
      const m = codeChild.className.match(/language-([\w-]+)/);
      if (m) {
        return m[1].toLowerCase();
      }
    }

    // (2) walk up from the pre at most 4 ancestors to the first one containing exactly one pre; inside it, take the first element (not the pre, not a button, no element children) whose trimmed text is 1-12 chars -> lowercase
    let curr: HTMLElement | null = pre.parentElement;
    let depth = 0;
    while (curr && depth < 4) {
      depth++;
      const pres = curr.querySelectorAll('pre');
      if (pres.length === 1 && pres[0] === pre) {
        const candidates = curr.querySelectorAll('*');
        for (const cand of Array.from(candidates)) {
          if (cand === pre || cand.contains(pre)) continue;
          if (cand.tagName.toLowerCase() === 'button' || cand.closest('button')) continue;
          if (cand.children.length > 0) continue;
          const txt = (cand.textContent ?? '').trim();
          if (txt.length >= 1 && txt.length <= 12) {
            return txt.toLowerCase();
          }
        }
        break;
      }
      curr = curr.parentElement;
    }

    // (3) null
    return null;
  },
  wrapperOf(pre: HTMLElement): HTMLElement {
    let curr: HTMLElement | null = pre.parentElement;
    let depth = 0;
    while (curr && depth < 4) {
      depth++;
      const pres = curr.querySelectorAll('pre');
      if (pres.length === 1 && pres[0] === pre) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return pre;
  },
  composer(): HTMLElement | null {
    return document.querySelector<HTMLElement>('form textarea, textarea, form [contenteditable="true"]');
  },
  sendButton(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      'form button[type="submit"], button[aria-label*="Submit" i], button[aria-label*="Send" i]',
    );
  },
  isNewChat(loc: Location): boolean {
    return loc.pathname === '/' || !loc.pathname.includes('/c/');
  },
};

export const ADAPTERS: SiteAdapter[] = [GEMINI_ADAPTER, GROK_ADAPTER];

export function pickAdapter(loc: Location): SiteAdapter | null {
  for (const adapter of ADAPTERS) {
    if (adapter.matches(loc)) {
      return adapter;
    }
  }
  return null;
}

export function isUiBlock(adapter: SiteAdapter, pre: HTMLElement): boolean {
  const lang = adapter.languageOf(pre);
  if (lang === 'ui') return true;
  if (
    (lang === null || lang === 'json' || lang === 'text' || lang === 'plaintext') &&
    looksLikeUiBlock(pre.textContent ?? '')
  ) {
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// Auto-setup selectors and helpers
// -------------------------------------------------------------

export const GEMINI_SETUP_SELECTORS = {
  heading: 'h2', // "Your instructions for Gemini"
  addButton: 'button', // contains span.mdc-button__label with text "Add"
  textarea: 'textarea[aria-label="Enter new memory"], .edit-memory-input',
  submitButton: '[data-test-id="submit-button"]',
};

export const GROK_SETUP_SELECTORS = {
  customizeRegion: '[role="region"][aria-label="Customize"], region[aria-label="Customize"]',
  accountMenu: 'button[aria-label^="Account menu for"]',
  menuItem: '[role="menuitem"]',
  customizeButton: 'button',
  dropdown: 'button[aria-label="Customize Grok\'s Response"]',
  menuitemRadio: '[role="menuitemradio"]',
  textarea: 'textarea[aria-label="Instructions"]',
  saveButton: 'button',
};

export function appendInstruction(existing: string, instruction: string): string {
  const trimmed = existing.trim();
  if (trimmed.includes('[BetterView]')) {
    return existing;
  }
  return trimmed ? `${trimmed}\n\n${instruction}` : instruction;
}

export function hasBetterViewMarker(text: string): boolean {
  return text.includes('[BetterView]');
}

export async function runGeminiSetup(): Promise<'added' | 'already' | 'failed'> {
  try {
    let headingFound = false;
    for (let i = 0; i < 40; i++) {
      const headings = document.querySelectorAll(GEMINI_SETUP_SELECTORS.heading);
      for (const h of Array.from(headings)) {
        if (h.textContent?.includes('Your instructions for Gemini')) {
          headingFound = true;
          break;
        }
      }
      if (headingFound) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!headingFound) return 'failed';

    if (document.body.textContent?.includes('[BetterView]')) {
      return 'already';
    }

    const buttons = document.querySelectorAll(GEMINI_SETUP_SELECTORS.addButton);
    let addBtn: HTMLButtonElement | null = null;
    for (const b of Array.from(buttons)) {
      const label = b.querySelector('span.mdc-button__label');
      if (label?.textContent?.trim() === 'Add' || b.textContent?.trim() === 'Add') {
        addBtn = b as HTMLButtonElement;
        break;
      }
    }
    if (!addBtn) return 'failed';
    addBtn.click();

    let textarea: HTMLTextAreaElement | null = null;
    for (let i = 0; i < 20; i++) {
      textarea = document.querySelector<HTMLTextAreaElement>(GEMINI_SETUP_SELECTORS.textarea);
      if (textarea) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!textarea) return 'failed';

    const instruction = getCompactInstruction();
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc?.set) {
      desc.set.call(textarea, instruction);
    } else {
      textarea.value = instruction;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    let submitBtn: HTMLButtonElement | null = null;
    for (let i = 0; i < 20; i++) {
      submitBtn = document.querySelector<HTMLButtonElement>(GEMINI_SETUP_SELECTORS.submitButton);
      if (submitBtn && !submitBtn.disabled && !submitBtn.hasAttribute('disabled')) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!submitBtn || submitBtn.disabled) return 'failed';
    submitBtn.click();

    let confirmed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (document.body.textContent?.includes('[BetterView]')) {
        confirmed = true;
        break;
      }
    }
    return confirmed ? 'added' : 'failed';
  } catch {
    return 'failed';
  }
}

function showGrokFallbackToast(): void {
  try {
    navigator.clipboard?.writeText(getCompactInstruction()).catch(() => {});
    const toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:999999;background:#0A0A0A;color:#FAFAFA;padding:12px 18px;border-radius:12px;border:1px solid #262626;font-family:sans-serif;font-size:13px;box-shadow:none;';
    toast.textContent = 'BetterView: open Settings > Customize > Custom and paste (copied)';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  } catch {}
}

export async function runGrokSetup(): Promise<'added' | 'already' | 'failed'> {
  try {
    let customizeRegion: Element | null = null;
    for (let i = 0; i < 30; i++) {
      const regions = document.querySelectorAll(GROK_SETUP_SELECTORS.customizeRegion);
      if (regions.length > 0) {
        customizeRegion = regions[0];
        break;
      }
      const headings = document.querySelectorAll('h1, h2, h3, [role="heading"]');
      for (const h of Array.from(headings)) {
        if (h.textContent?.trim() === 'Customize') {
          customizeRegion = h.closest('[role="region"], div') || h.parentElement;
          break;
        }
      }
      if (customizeRegion) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!customizeRegion) {
      const acctBtn = document.querySelector<HTMLButtonElement>(GROK_SETUP_SELECTORS.accountMenu);
      if (acctBtn) {
        acctBtn.click();
        await new Promise((r) => setTimeout(r, 500));
        const menuItems = document.querySelectorAll(GROK_SETUP_SELECTORS.menuItem);
        for (const item of Array.from(menuItems)) {
          if (item.textContent?.trim() === 'Settings') {
            (item as HTMLElement).click();
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 500));
        const buttons = document.querySelectorAll(GROK_SETUP_SELECTORS.customizeButton);
        for (const b of Array.from(buttons)) {
          if (b.textContent?.trim() === 'Customize') {
            (b as HTMLElement).click();
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 500));
        customizeRegion = document.querySelector(GROK_SETUP_SELECTORS.customizeRegion);
      }
    }

    if (!customizeRegion) {
      showGrokFallbackToast();
      return 'failed';
    }

    const dropdown = customizeRegion.querySelector<HTMLButtonElement>(GROK_SETUP_SELECTORS.dropdown);
    if (dropdown && !dropdown.textContent?.includes('Custom')) {
      dropdown.click();
      await new Promise((r) => setTimeout(r, 300));
      const radios = document.querySelectorAll(GROK_SETUP_SELECTORS.menuitemRadio);
      for (const r of Array.from(radios)) {
        if (r.textContent?.trim() === 'Custom') {
          (r as HTMLElement).click();
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    const textarea = customizeRegion.querySelector<HTMLTextAreaElement>(GROK_SETUP_SELECTORS.textarea);
    if (!textarea) {
      showGrokFallbackToast();
      return 'failed';
    }

    if (textarea.value.includes('[BetterView]')) {
      return 'already';
    }

    const nextVal = appendInstruction(textarea.value, getCompactInstruction());
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc?.set) {
      desc.set.call(textarea, nextVal);
    } else {
      textarea.value = nextVal;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    let saveBtn: HTMLButtonElement | null = null;
    const buttons = customizeRegion.querySelectorAll<HTMLButtonElement>(GROK_SETUP_SELECTORS.saveButton);
    for (const b of Array.from(buttons)) {
      if (b.textContent?.trim() === 'Save') {
        saveBtn = b;
        break;
      }
    }
    if (!saveBtn) {
      showGrokFallbackToast();
      return 'failed';
    }

    for (let i = 0; i < 10; i++) {
      if (!saveBtn.disabled && !saveBtn.hasAttribute('disabled')) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (saveBtn.disabled) {
      showGrokFallbackToast();
      return 'failed';
    }
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 800));
    return 'added';
  } catch {
    showGrokFallbackToast();
    return 'failed';
  }
}

export function recordSetupResult(site: 'gemini' | 'grok', status: 'added' | 'already' | 'failed'): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set({
      [`${site}_setup_status`]: { status, timestamp: Date.now() },
    });
  }
}
