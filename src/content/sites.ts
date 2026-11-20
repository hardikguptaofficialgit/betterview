// Selectors are best guesses; if rendering doesn't trigger on a site, inspect a code block there and update only this file.

import { tryParse } from '../core/parse';
import { getCompactInstruction } from '../shared/systemInstruction';

export interface SiteAdapter {
  id: 'gemini' | 'grok';
  matches(loc: Location): boolean;
  chatRoot(): Element | null;
  findCodeBlocks(root: ParentNode): HTMLElement[]; // candidate code blocks
  languageOf(block: HTMLElement): string | null;
  wrapperOf(block: HTMLElement): HTMLElement; // element to hide and insert relative to
  codeElementOf?(block: HTMLElement): HTMLElement | null;
  composer(): HTMLElement | null; // textarea or contenteditable
  sendButton(): HTMLElement | null;
  isNewChat(loc: Location): boolean;
}

export const BETTERVIEW_STREAMING_TYPE_RE =
  /^\s*\{\s*"type"\s*:\s*"(flow|stepper|table|compare|quiz|chart|mermaid)"/;

export const BETTERVIEW_TYPES = [
  'flow',
  'stepper',
  'table',
  'compare',
  'quiz',
  'chart',
  'mermaid',
] as const;

export const GEMINI_ADAPTER: SiteAdapter = {
  id: 'gemini',
  matches(loc: Location): boolean {
    return loc.hostname === 'gemini.google.com' || loc.hostname.endsWith('.gemini.google.com');
  },
  chatRoot(): Element | null {
    return (
      document.querySelector('main') ??
      document.querySelector('model-response') ??
      document.querySelector('.markdown.markdown-main-panel') ??
      document.querySelector('chat-window') ??
      document.body
    );
  },
  findCodeBlocks(root: ParentNode): HTMLElement[] {
    const blocks = root.querySelectorAll<HTMLElement>(
      'model-response code-block, .markdown.markdown-main-panel code-block, code-block, .code-block',
    );
    const seen = new Set<HTMLElement>();
    const res: HTMLElement[] = [];
    blocks.forEach((el) => {
      const target =
        (el.tagName.toLowerCase() === 'code-block' ? el : (el.closest('code-block') as HTMLElement | null)) ?? el;
      if (!seen.has(target)) {
        seen.add(target);
        res.push(target);
      }
    });
    return res;
  },
  codeElementOf(block: HTMLElement): HTMLElement | null {
    return (
      block.querySelector<HTMLElement>('code[data-test-id="code-content"]') ??
      block.querySelector<HTMLElement>('pre code') ??
      block.querySelector<HTMLElement>('code') ??
      (block.tagName.toLowerCase() === 'code' ? block : null)
    );
  },
  languageOf(block: HTMLElement): string | null {
    // (1) a code child whose class matches /language-([\w-]+)/
    const codeChild = this.codeElementOf ? this.codeElementOf(block) : block.querySelector('code');
    if (codeChild && codeChild.className) {
      const m = codeChild.className.match(/language-([\w-]+)/);
      if (m) {
        return m[1].toLowerCase();
      }
    }

    // (2) the trimmed lowercase text of .code-block-decoration inside wrapper
    const wrapper = this.wrapperOf(block);
    if (wrapper) {
      const decor = wrapper.querySelector('.code-block-decoration');
      if (decor && decor.textContent) {
        const text = decor.textContent.trim().toLowerCase();
        if (text && text !== 'code snippet') return text;
      }

      const elements = wrapper.querySelectorAll('*');
      for (const el of Array.from(elements)) {
        if (el.tagName.toLowerCase() === 'button' || el.closest('button')) continue;
        if (el.contains(codeChild ?? block)) continue;
        const txt = (el.textContent ?? '').trim();
        if (txt.length >= 1 && txt.length <= 12 && el.children.length === 0 && txt.toLowerCase() !== 'code snippet') {
          return txt.toLowerCase();
        }
      }
    }

    return null;
  },
  wrapperOf(block: HTMLElement): HTMLElement {
    return (block.closest('code-block, .code-block') as HTMLElement) ?? block;
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
  codeElementOf(block: HTMLElement): HTMLElement | null {
    return block.querySelector<HTMLElement>('code') ?? (block.tagName.toLowerCase() === 'code' ? block : null);
  },
  languageOf(block: HTMLElement): string | null {
    const codeChild = this.codeElementOf ? this.codeElementOf(block) : block.querySelector('code');
    if (codeChild && codeChild.className) {
      const m = codeChild.className.match(/language-([\w-]+)/);
      if (m) {
        return m[1].toLowerCase();
      }
    }

    let curr: HTMLElement | null = block.parentElement;
    let depth = 0;
    while (curr && depth < 4) {
      depth++;
      const pres = curr.querySelectorAll('pre');
      if (pres.length === 1 && (pres[0] === block || pres[0].contains(block))) {
        const candidates = curr.querySelectorAll('*');
        for (const cand of Array.from(candidates)) {
          if (cand === block || cand.contains(block)) continue;
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

    return null;
  },
  wrapperOf(block: HTMLElement): HTMLElement {
    let curr: HTMLElement | null = block.parentElement;
    let depth = 0;
    while (curr && depth < 4) {
      depth++;
      const pres = curr.querySelectorAll('pre');
      if (pres.length === 1 && (pres[0] === block || pres[0].contains(block))) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return block;
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

export function getBlockCodeElement(adapter: SiteAdapter, block: HTMLElement): HTMLElement {
  if (adapter.codeElementOf) {
    const el = adapter.codeElementOf(block);
    if (el) return el;
  }
  return (
    block.querySelector<HTMLElement>('code[data-test-id="code-content"]') ??
    block.querySelector<HTMLElement>('pre code') ??
    block.querySelector<HTMLElement>('code') ??
    block.querySelector<HTMLElement>('pre') ??
    block
  );
}

export function getBlockCodeText(adapter: SiteAdapter, block: HTMLElement): string {
  const el = getBlockCodeElement(adapter, block);
  return el.textContent ?? '';
}

export function isUiBlock(adapter: SiteAdapter, block: HTMLElement): boolean {
  const lang = adapter.languageOf(block);
  if (lang === 'ui') return true;

  const codeText = getBlockCodeText(adapter, block);
  const trimmed = codeText.trim();
  if (!trimmed.startsWith('{')) {
    return false;
  }

  const head = trimmed.slice(0, 100).replace(/[“”]/g, '"');
  if (BETTERVIEW_STREAMING_TYPE_RE.test(head)) {
    return true;
  }

  const parsed = tryParse(codeText);
  if (parsed.ok && typeof parsed.value === 'object' && parsed.value !== null && !Array.isArray(parsed.value)) {
    const type = (parsed.value as { type?: unknown }).type;
    if (typeof type === 'string' && (BETTERVIEW_TYPES as readonly string[]).includes(type)) {
      return true;
    }
  }

  return false;
}

// -------------------------------------------------------------
// Auto-setup selectors and helpers
// -------------------------------------------------------------

export type SetupStatus = 'added' | 'already' | 'failed';
export interface SetupResult {
  status: SetupStatus;
  error?: string;
}

export const GEMINI_SETUP_SELECTORS = {
  heading: 'h2', // "Your instructions for Gemini"
  addButton: 'button', // contains span.mdc-button__label with text "Add"
  textarea: 'edit-memory-dialog textarea[aria-label="Enter new memory"], textarea.edit-memory-input, textarea[aria-label="Enter new memory"]',
  submitButton: 'edit-memory-dialog button[data-test-id="submit-button"], button[data-test-id="submit-button"]',
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
  if (/\[betterview\]/i.test(trimmed)) {
    return existing;
  }
  return trimmed ? `${trimmed}\n\n${instruction}` : instruction;
}

export function hasBetterViewMarker(text: string): boolean {
  return /\[betterview\]/i.test(text);
}

export async function fillGeminiMemoryDialog(
  root: ParentNode = document,
  options: { waitTimeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.waitTimeoutMs ?? 10000;
  const pollMs = options.pollIntervalMs ?? 200;

  // 1. Wait for textarea
  let textarea: HTMLTextAreaElement | null = null;
  const startTextarea = Date.now();
  while (Date.now() - startTextarea < timeoutMs) {
    textarea =
      root.querySelector<HTMLTextAreaElement>('edit-memory-dialog textarea[aria-label="Enter new memory"]') ??
      root.querySelector<HTMLTextAreaElement>('edit-memory-dialog textarea.edit-memory-input') ??
      root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Enter new memory"]') ??
      root.querySelector<HTMLTextAreaElement>('textarea.edit-memory-input');
    if (textarea) break;
    await new Promise((r) => setTimeout(r, pollMs));
  }

  if (!textarea) {
    const msg = "Couldn't find the text box";
    console.warn('[BetterView]', msg);
    throw new Error(msg);
  }

  // 2. Focus and fill
  textarea.focus();
  const instruction = getCompactInstruction();
  let inserted = false;
  try {
    if (typeof document.execCommand === 'function') {
      inserted = document.execCommand('insertText', false, instruction);
    }
  } catch {
    inserted = false;
  }
  if (!inserted || !textarea.value) {
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc?.set) {
      desc.set.call(textarea, instruction);
    } else {
      textarea.value = instruction;
    }
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // 3. Wait up to 5s for submit button to lose disabled
  let submitBtn: HTMLButtonElement | null = null;
  const startSubmit = Date.now();
  const submitTimeout = Math.min(timeoutMs, 5000);
  while (Date.now() - startSubmit < submitTimeout) {
    const btn =
      root.querySelector<HTMLButtonElement>('edit-memory-dialog button[data-test-id="submit-button"]') ??
      root.querySelector<HTMLButtonElement>('button[data-test-id="submit-button"]');
    if (btn) {
      submitBtn = btn;
      if (!btn.disabled && !btn.hasAttribute('disabled')) {
        break;
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  if (!submitBtn) {
    const msg = "Couldn't find submit button";
    console.warn('[BetterView]', msg);
    throw new Error(msg);
  }
  if (submitBtn.disabled || submitBtn.hasAttribute('disabled')) {
    const msg = "Submit button remained disabled";
    console.warn('[BetterView]', msg);
    throw new Error(msg);
  }

  submitBtn.click();
}

export async function runGeminiSetup(): Promise<SetupResult> {
  try {
    let headingFound = false;
    const startHeading = Date.now();
    while (Date.now() - startHeading < 10000) {
      const headings = document.querySelectorAll(GEMINI_SETUP_SELECTORS.heading);
      for (const h of Array.from(headings)) {
        if (h.textContent?.includes('Your instructions for Gemini')) {
          headingFound = true;
          break;
        }
      }
      if (headingFound) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!headingFound) {
      const msg = "Couldn't find instructions section";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
    }

    if (/\[betterview\]/i.test(document.body.textContent ?? '')) {
      return { status: 'already' };
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
    if (!addBtn) {
      const msg = "Couldn't find Add button";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
    }
    addBtn.click();

    try {
      await fillGeminiMemoryDialog(document, { waitTimeoutMs: 10000, pollIntervalMs: 200 });
    } catch (fillErr: unknown) {
      const msg = fillErr instanceof Error ? fillErr.message : String(fillErr);
      return { status: 'failed', error: msg };
    }

    // Confirm success: dialog closes AND entry containing [BetterView] appears within 10s
    let dialogClosed = false;
    let entryAppeared = false;
    const startConfirm = Date.now();
    while (Date.now() - startConfirm < 10000) {
      const dialog = document.querySelector<HTMLElement>('edit-memory-dialog');
      if (!dialog || dialog.style.display === 'none' || !document.contains(dialog)) {
        dialogClosed = true;
      }
      if (/\[betterview\]/i.test(document.body.textContent ?? '')) {
        entryAppeared = true;
      }
      if (dialogClosed && entryAppeared) {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!dialogClosed) {
      const msg = "Dialog didn't close";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
    }
    if (!entryAppeared) {
      const msg = "Saved entry didn't appear";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
    }

    return { status: 'added' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[BetterView]', 'Gemini setup error:', msg);
    return { status: 'failed', error: msg };
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

export async function runGrokSetup(): Promise<SetupResult> {
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
      const msg = "Couldn't find Customize settings";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
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
      const msg = "Couldn't find instructions textarea";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
    }

    if (textarea.value.includes('[BetterView]')) {
      return { status: 'already' };
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
      const msg = "Couldn't find Save button";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
    }

    for (let i = 0; i < 10; i++) {
      if (!saveBtn.disabled && !saveBtn.hasAttribute('disabled')) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (saveBtn.disabled) {
      showGrokFallbackToast();
      const msg = "Save button remained disabled";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
    }
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 800));
    return { status: 'added' };
  } catch (err: unknown) {
    showGrokFallbackToast();
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[BetterView]', 'Grok setup error:', msg);
    return { status: 'failed', error: msg };
  }
}

export function recordSetupResult(
  site: 'gemini' | 'grok',
  result: SetupResult | SetupStatus,
  error?: string,
): void {
  const status = typeof result === 'string' ? result : result.status;
  const err = typeof result === 'string' ? error : (result.error ?? error);
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set({
      [`${site}_setup_status`]: { status, error: err, timestamp: Date.now() },
    });
  }
}
