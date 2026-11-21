// Selectors are best guesses; if rendering doesn't trigger on a site, inspect a code block there and update only this file.

import { tryParse } from '../core/parse';
import { getCompactInstruction, CURRENT_INSTRUCTION_VERSION } from '../shared/systemInstruction';

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
  /^\s*\{\s*"type"\s*:\s*"(flow|stepper|table|compare|quiz|chart|mermaid|callout|stats|tabs|timeline|followups|math|code)"/;

export const BETTERVIEW_TYPES = [
  'flow',
  'stepper',
  'table',
  'compare',
  'quiz',
  'chart',
  'mermaid',
  'callout',
  'stats',
  'tabs',
  'timeline',
  'followups',
  'math',
  'code',
] as const;

export function isCodeOnlyWrapper(wrapper: HTMLElement, block: HTMLElement): boolean {
  if (wrapper === block) return true;
  if (!wrapper.contains(block)) return false;

  const forbiddenSelector = 'p, li, ul, ol, h1, h2, h3, h4, h5, h6, table, blockquote, hr';
  if (wrapper.matches(forbiddenSelector)) return false;
  const forbidden = wrapper.querySelectorAll(forbiddenSelector);
  for (const el of Array.from(forbidden)) {
    if (!block.contains(el)) {
      return false;
    }
  }

  let outsideText = '';
  function walk(node: Node): void {
    if (node === block || block.contains(node)) return;
    if (node instanceof HTMLElement && (node.tagName.toLowerCase() === 'button' || node.closest('button'))) {
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      outsideText += node.textContent ?? '';
      return;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]);
    }
  }

  for (let i = 0; i < wrapper.childNodes.length; i++) {
    walk(wrapper.childNodes[i]);
  }

  return outsideText.trim().length <= 40;
}

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

    const wrapper = this.wrapperOf(block);
    if (wrapper && wrapper !== block) {
      const candidates = wrapper.querySelectorAll('*');
      for (const cand of Array.from(candidates)) {
        if (cand === block || cand.contains(block) || block.contains(cand)) continue;
        if (cand.tagName.toLowerCase() === 'button' || cand.closest('button')) continue;
        if (cand.children.length > 0) continue;
        const txt = (cand.textContent ?? '').trim();
        if (txt.length >= 1 && txt.length <= 12) {
          return txt.toLowerCase();
        }
      }
    }

    return null;
  },
  wrapperOf(block: HTMLElement): HTMLElement {
    let curr: HTMLElement | null = block.parentElement;
    let lastAccepted: HTMLElement = block;
    let depth = 0;
    while (curr && depth < 4) {
      depth++;
      const pres = curr.querySelectorAll('pre');
      if (pres.length === 1 && (pres[0] === block || pres[0].contains(block))) {
        if (isCodeOnlyWrapper(curr, block)) {
          lastAccepted = curr;
        } else {
          break;
        }
      } else {
        break;
      }
      curr = curr.parentElement;
    }
    return lastAccepted;
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

  const head = trimmed.slice(0, 120).replace(/[“”]/g, '"');
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
  version?: number;
  error?: string;
  hasOldEntry?: boolean;
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

export function extractInstructionVersion(text: string): number | null {
  const matches = text.matchAll(/\[betterview(?:\s+v(\d+))?\]/gi);
  let highest: number | null = null;
  for (const match of matches) {
    const version = match[1] ? parseInt(match[1], 10) : 1;
    if (highest === null || version > highest) {
      highest = version;
    }
  }
  return highest;
}

export function hasOlderInstruction(text: string): boolean {
  const matches = text.matchAll(/\[betterview(?:\s+v(\d+))?\]/gi);
  for (const match of matches) {
    const version = match[1] ? parseInt(match[1], 10) : 1;
    if (version < CURRENT_INSTRUCTION_VERSION) {
      return true;
    }
  }
  return false;
}

export function appendInstruction(existing: string, instruction: string): string {
  const trimmed = existing.trim();
  const existingVer = extractInstructionVersion(trimmed);
  const newVer = extractInstructionVersion(instruction);

  if (existingVer !== null) {
    if (newVer !== null && newVer > existingVer) {
      return trimmed.replace(/\[betterview[\s\S]*$/i, instruction);
    }
    return existing;
  }
  return trimmed ? `${trimmed}\n\n${instruction}` : instruction;
}

export function hasBetterViewMarker(text: string): boolean {
  return /\[betterview(?:\s+v\d+)?\]/i.test(text);
}

function findGeminiTextarea(root: ParentNode): HTMLTextAreaElement | null {
  return (
    root.querySelector<HTMLTextAreaElement>('edit-memory-dialog textarea') ??
    root.querySelector<HTMLTextAreaElement>('.cdk-overlay-container edit-memory-dialog textarea') ??
    root.querySelector<HTMLTextAreaElement>('.cdk-overlay-container textarea[aria-label]') ??
    root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Enter new memory"]') ??
    root.querySelector<HTMLTextAreaElement>('textarea.edit-memory-input') ??
    root.querySelector<HTMLTextAreaElement>('textarea[aria-label]')
  );
}

function findGeminiSubmitButton(root: ParentNode): HTMLButtonElement | null {
  return (
    root.querySelector<HTMLButtonElement>('button[data-test-id="submit-button"]') ??
    root.querySelector<HTMLButtonElement>('edit-memory-dialog button[data-test-id="submit-button"]')
  );
}

function findGeminiDialog(root: ParentNode): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>('edit-memory-dialog') ??
    root.querySelector<HTMLElement>('.cdk-overlay-container edit-memory-dialog') ??
    root.querySelector<HTMLElement>('mat-dialog-container')
  );
}

export async function fillGeminiMemoryDialog(
  root: ParentNode = document,
  options: { waitTimeoutMs?: number; pollIntervalMs?: number; waitForClose?: boolean } = {},
): Promise<void> {
  const timeoutMs = options.waitTimeoutMs ?? 10000;
  const pollMs = options.pollIntervalMs ?? 100;

  // 1. Wait (up to 10s, MutationObserver) for edit-memory-dialog textarea
  let textarea: HTMLTextAreaElement | null = findGeminiTextarea(root);

  if (!textarea) {
    textarea = await new Promise<HTMLTextAreaElement | null>((resolve) => {
      let resolved = false;
      let observer: MutationObserver | null = null;
      let timer: number | null = null;
      let interval: number | null = null;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          if (observer) observer.disconnect();
          if (timer !== null) window.clearTimeout(timer);
          if (interval !== null) window.clearInterval(interval);
        }
      };

      if (typeof MutationObserver !== 'undefined') {
        const obsTarget =
          root instanceof Element || root instanceof Document ? root : document.body;
        observer = new MutationObserver(() => {
          const el = findGeminiTextarea(root);
          if (el && !resolved) {
            cleanup();
            resolve(el);
          }
        });
        observer.observe(obsTarget, { childList: true, subtree: true });
      }

      interval = window.setInterval(() => {
        const el = findGeminiTextarea(root);
        if (el && !resolved) {
          cleanup();
          resolve(el);
        }
      }, pollMs);

      timer = window.setTimeout(() => {
        cleanup();
        resolve(findGeminiTextarea(root));
      }, timeoutMs);
    });
  }

  if (!textarea) {
    const msg = "Couldn't find the text box";
    console.warn('[BetterView]', msg);
    throw new Error(msg);
  }

  // 2. Focus it, set value via native setter, dispatch input, change, and keyup (Angular needs these)
  const instruction = getCompactInstruction();

  const applyNativeFill = (el: HTMLTextAreaElement, val: string) => {
    el.focus();
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc?.set) {
      desc.set.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
  };

  applyNativeFill(textarea, instruction);

  // 3. Wait until button[data-test-id="submit-button"] is enabled (poll up to 5s)
  const isEnabled = (btn: HTMLButtonElement | null) =>
    Boolean(btn && !btn.disabled && !btn.hasAttribute('disabled'));

  const waitForSubmitButton = async (maxMs: number): Promise<HTMLButtonElement | null> => {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const btn = findGeminiSubmitButton(root);
      if (isEnabled(btn)) return btn;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return null;
  };

  let submitBtn = await waitForSubmitButton(Math.min(timeoutMs, 5000));

  // Retry the fill once if the button is still disabled
  if (!submitBtn) {
    applyNativeFill(textarea, instruction);
    submitBtn = await waitForSubmitButton(Math.min(timeoutMs, 5000));
  }

  if (!submitBtn) {
    const msg = "Submit button remained disabled";
    console.warn('[BetterView]', msg);
    throw new Error(msg);
  }

  submitBtn.click();

  // Wait for the dialog to close (up to 8s) if requested or by default if close is observed
  if (options.waitForClose) {
    const startCloseWait = Date.now();
    const maxCloseWait = Math.min(timeoutMs, 8000);
    let dialogClosed = false;
    while (Date.now() - startCloseWait < maxCloseWait) {
      const dialog = findGeminiDialog(root);
      if (!dialog || dialog.style.display === 'none' || !(root as any).contains(dialog)) {
        dialogClosed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }

    if (!dialogClosed) {
      const msg = "Dialog didn't close";
      console.warn('[BetterView]', msg);
      throw new Error(msg);
    }
  }
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

    const bodyText = document.body.textContent ?? '';
    const existingVer = extractInstructionVersion(bodyText);
    const hasOldEntry = hasOlderInstruction(bodyText);

    if (existingVer !== null && existingVer >= CURRENT_INSTRUCTION_VERSION) {
      const res: SetupResult = { status: 'already', version: existingVer, hasOldEntry };
      recordSetupResult('gemini', res);
      return res;
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
      await fillGeminiMemoryDialog(document, { waitTimeoutMs: 10000, pollIntervalMs: 200, waitForClose: true });
    } catch (fillErr: unknown) {
      const msg = fillErr instanceof Error ? fillErr.message : String(fillErr);
      const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
      recordSetupResult('gemini', res);
      return res;
    }

    // Confirm success: entry containing [BetterView v3] appears within 10s
    let entryAppeared = false;
    const startConfirm = Date.now();
    while (Date.now() - startConfirm < 10000) {
      const ver = extractInstructionVersion(document.body.textContent ?? '');
      if (ver !== null && ver >= CURRENT_INSTRUCTION_VERSION) {
        entryAppeared = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!entryAppeared) {
      const msg = "Saved entry didn't appear";
      console.warn('[BetterView]', msg);
      const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
      recordSetupResult('gemini', res);
      return res;
    }

    const res: SetupResult = { status: 'added', version: CURRENT_INSTRUCTION_VERSION, hasOldEntry };
    recordSetupResult('gemini', res);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[BetterView]', 'Gemini setup error:', msg);
    const res: SetupResult = { status: 'failed', error: msg };
    recordSetupResult('gemini', res);
    return res;
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

    const existingVer = extractInstructionVersion(textarea.value);
    const hasOldEntry = hasOlderInstruction(textarea.value);
    if (existingVer !== null && existingVer >= CURRENT_INSTRUCTION_VERSION) {
      return { status: 'already', version: existingVer, hasOldEntry };
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
    return { status: 'added', version: CURRENT_INSTRUCTION_VERSION, hasOldEntry: hasOlderInstruction(textarea.value) };
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
  const version =
    typeof result === 'object' && result.version !== undefined
      ? result.version
      : CURRENT_INSTRUCTION_VERSION;
  const hasOldEntry = typeof result === 'object' ? result.hasOldEntry : undefined;
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set({
      [`${site}_setup_status`]: { status, version, error: err, hasOldEntry, timestamp: Date.now() },
    });
  }
}
