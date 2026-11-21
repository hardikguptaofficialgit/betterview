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
  customizeRegion: '[role="region"][aria-label*="Customize" i], region[aria-label*="Customize" i], [data-testid*="customize" i]',
  accountMenu: 'button[aria-label*="account" i], button[aria-label*="profile" i], [data-testid*="account" i] button',
  menuItem: '[role="menuitem"]',
  dropdown: 'button[aria-label="Customize Grok\'s Response"]',
  menuitemRadio: '[role="menuitemradio"]',
  textarea: 'textarea[aria-label="Instructions"], textarea',
  saveButton: 'button',
};

function findGrokAction(pattern: RegExp): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    'button, a, [role="button"], [role="menuitem"], [role="tab"]',
  );
  for (const el of Array.from(candidates)) {
    const text = [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (pattern.test(text)) return el;
  }
  return null;
}

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

function hasCurrentInstruction(text: string): boolean {
  const version = extractInstructionVersion(text);
  return version !== null && version >= CURRENT_INSTRUCTION_VERSION;
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

type GeminiEditor = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

function geminiDeepQueryAll<T extends Element>(root: ParentNode, selector: string): T[] {
  const found = new Set<T>();
  const visit = (scope: ParentNode) => {
    scope.querySelectorAll<T>(selector).forEach((el) => found.add(el));
    scope.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (el.shadowRoot) visit(el.shadowRoot);
    });
  };
  visit(root);
  return Array.from(found);
}

function findGeminiDialog(root: ParentNode): HTMLElement | null {
  return geminiDeepQueryAll<HTMLElement>(
    root,
    'edit-memory-dialog, [role="dialog"], mat-dialog-container, dialog',
  ).find((el) => el.getAttribute('aria-hidden') !== 'true' && el.getAttribute('inert') === null) ?? null;
}

function findGeminiTextarea(root: ParentNode): GeminiEditor | null {
  const dialog = findGeminiDialog(root);
  // Never fall back to the whole page: Gemini's chat composer is also a
  // contenteditable textbox and must not receive the Saved Info instruction.
  if (!dialog) return null;
  return geminiDeepQueryAll<GeminiEditor>(
    dialog,
    'edit-memory-dialog textarea, textarea[aria-label*="memory" i], textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"], input[type="text"]',
  ).find((el) => el.getAttribute('aria-hidden') !== 'true') ?? null;
}

function findGeminiSubmitButton(root: ParentNode): HTMLButtonElement | null {
  const dialog = findGeminiDialog(root);
  // Only submit from the same Saved Info dialog that contains the editor.
  if (!dialog) return null;
  const buttons = geminiDeepQueryAll<HTMLButtonElement>(dialog, 'button, [role="button"]');
  for (const button of buttons) {
    const labels = [button.textContent, button.getAttribute('aria-label'), button.getAttribute('data-test-id')]
      .filter(Boolean).map((value) => (value ?? '').replace(/\s+/g, ' ').trim());
    if (labels.some((label) => /^(submit|save|add|done)(?:\s+(?:memory|info|instruction|changes))?$/i.test(label) || /submit-button/i.test(label))) {
      return button as HTMLButtonElement;
    }
  }
  return null;
}

export function isGeminiSavedInfoPath(pathname: string): boolean {
  return /^\/(u\/\d+\/)?saved-info\/?$/.test(pathname);
}

function getScopeElement(root: ParentNode): HTMLElement | null {
  return 'body' in root && (root as Document).body ? (root as Document).body : (root as HTMLElement);
}

function getGeminiOutsideText(root: ParentNode = document): string {
  const dialog = findGeminiDialog(root);
  const scope = getScopeElement(root);
  if (!scope) return '';

  if (!dialog) {
    return scope.innerText || scope.textContent || '';
  }

  let text = '';
  const walk = (node: Node) => {
    if (node === dialog || dialog.contains(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      text += ' ' + (node.textContent ?? '');
      return;
    }
    if (node instanceof HTMLElement && node.shadowRoot) {
      walk(node.shadowRoot);
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]);
    }
  };
  walk(scope);
  return text.trim();
}

function hasGeminiSavedInfoHeading(root: ParentNode = document): boolean {
  const headings = geminiDeepQueryAll<HTMLElement>(root, 'h1, h2, h3, h4, [role="heading"]');
  for (const h of headings) {
    const text = (h.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (
      text.includes('saved info') ||
      text.includes('instructions for gemini') ||
      text.includes('your instructions')
    ) {
      return true;
    }
  }
  return false;
}

export function findGeminiAddButton(root: ParentNode = document): HTMLElement | null {
  const isVisibleAndEnabled = (el: Element): boolean => {
    if (el.getAttribute('aria-hidden') === 'true' || el.getAttribute('inert') !== null) {
      return false;
    }
    if (
      el.hasAttribute('disabled') ||
      el.getAttribute('aria-disabled') === 'true' ||
      (el as HTMLButtonElement).disabled === true
    ) {
      return false;
    }
    if (el instanceof HTMLElement) {
      if (el.style.display === 'none' || el.style.visibility === 'hidden' || el.hidden) {
        return false;
      }
      if (el.closest('rich-textarea, .ql-editor, [contenteditable="true"], chat-window, model-response')) {
        return false;
      }
      if (el.closest('edit-memory-dialog, [role="dialog"], mat-dialog-container, dialog')) {
        return false;
      }
    }
    return true;
  };

  // 1. span.mdc-button__label text === "Add"
  const mdcLabels = geminiDeepQueryAll<HTMLElement>(root, 'span.mdc-button__label');
  for (const span of mdcLabels) {
    if (!isVisibleAndEnabled(span)) continue;
    if ((span.textContent ?? '').trim() === 'Add') {
      const btn = span.closest('button, [role="button"]') as HTMLElement | null;
      if (btn && isVisibleAndEnabled(btn)) return btn;
      return span;
    }
  }

  // 2. button/[role=button] whose normalized textContent or aria-label matches
  // /^(\+\s*)?add( new)?( info| memory| instruction)?$/i
  // or aria-label containing "add" and ("info"|"memory"|"instruction")
  const buttons = geminiDeepQueryAll<HTMLElement>(root, 'button, [role="button"]');
  const addPattern = /^(\+\s*)?add( new)?( info| memory| instruction)?$/i;
  for (const btn of buttons) {
    if (!isVisibleAndEnabled(btn)) continue;
    const text = (btn.textContent ?? '').replace(/\s+/g, ' ').trim();
    const aria = (btn.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
    if (addPattern.test(text) || addPattern.test(aria)) {
      return btn;
    }
    if (/add/i.test(aria) && /(info|memory|instruction)/i.test(aria)) {
      return btn;
    }
  }

  // 3. data-test-id containing "add"
  const testIdEls = geminiDeepQueryAll<HTMLElement>(root, '[data-test-id*="add" i]');
  for (const el of testIdEls) {
    if (!isVisibleAndEnabled(el)) continue;
    const btn =
      el.tagName.toLowerCase() === 'button' || el.getAttribute('role') === 'button'
        ? el
        : (el.closest('button, [role="button"]') as HTMLElement | null);
    if (btn && isVisibleAndEnabled(btn)) return btn;
    return el;
  }

  return null;
}

export async function fillGeminiMemoryDialog(
  root: ParentNode = document,
  options: { waitTimeoutMs?: number; pollIntervalMs?: number; waitForClose?: boolean } = {},
): Promise<void> {
  const timeoutMs = options.waitTimeoutMs ?? 10000;
  const pollMs = options.pollIntervalMs ?? 100;

  // 1. Wait for the editor inside the Add dialog. Gemini has changed this
  // dialog's custom element and accessibility markup more than once.
  let textarea: GeminiEditor | null = findGeminiTextarea(root);

  if (!textarea) {
    textarea = await new Promise<GeminiEditor | null>((resolve) => {
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

  // 2. Fill the editor through its native value setter (or contenteditable
  // text) and dispatch the events Angular/Material listens for.
  const instruction = getCompactInstruction();
  if (instruction.length > 1400) {
    const msg = `Instruction too long for Gemini (${instruction.length} chars)`;
    console.warn('[BetterView]', msg);
    throw new Error(msg);
  }

  const applyNativeFill = (el: GeminiEditor, val: string) => {
    el.focus();
    try {
      el.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: val,
        }),
      );
    } catch {
      // ignore if InputEvent construction fails
    }

    if (el instanceof HTMLTextAreaElement) {
      const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (desc?.set) desc.set.call(el, val);
      else el.value = val;
    } else if (el instanceof HTMLInputElement) {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc?.set) desc.set.call(el, val);
      else el.value = val;
    } else {
      let inserted = false;
      if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
        try {
          inserted = document.execCommand('insertText', false, val);
        } catch {
          inserted = false;
        }
      }
      if (!inserted || el.textContent !== val) {
        el.textContent = val;
      }
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
    const actual =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.value
        : (el.textContent ?? '');
    if (actual !== val) throw new Error('Gemini editor did not accept the complete BetterView instruction');
  };

  applyNativeFill(textarea, instruction);

  // 3. Wait until button[data-test-id="submit-button"] is enabled (poll up to 5s)
  const isEnabled = (btn: HTMLButtonElement | null) =>
    Boolean(btn && !btn.disabled && !btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true');

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
      if (!dialog || !dialog.isConnected || dialog.style.display === 'none') {
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

export interface GeminiSetupOptions {
  readyTimeoutMs?: number;
  addRetryMs?: number;
  verifyTimeoutMs?: number;
  pollMs?: number;
  root?: ParentNode;
}

export async function runGeminiSetup(options: GeminiSetupOptions = {}): Promise<SetupResult> {
  const readyTimeoutMs = options.readyTimeoutMs ?? 15000;
  const addRetryMs = options.addRetryMs ?? 4000;
  const verifyTimeoutMs = options.verifyTimeoutMs ?? 10000;
  const pollMs = options.pollMs ?? 200;
  const root = options.root ?? (typeof document !== 'undefined' ? document : ({} as ParentNode));

  let hasOldEntry = false;

  try {
    // 1a. Wait (poll 200ms, up to 15s) for the Saved info page to be ready
    console.info('[BetterView] gemini setup: waiting for saved info page');
    const isReady = (): boolean => {
      const dialog = findGeminiDialog(root);
      if (dialog && findGeminiTextarea(root)) return true;
      if (findGeminiAddButton(root)) return true;
      if (hasGeminiSavedInfoHeading(root)) return true;
      return false;
    };

    const startReady = Date.now();
    while (Date.now() - startReady < readyTimeoutMs) {
      if (isReady()) break;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    console.info('[BetterView] gemini setup: saved info page ready check completed');

    let dialog = findGeminiDialog(root);
    let editor = dialog ? findGeminiTextarea(root) : null;
    let isDialogOpen = Boolean(dialog && editor);

    const outsideText = getGeminiOutsideText(root);
    hasOldEntry = hasOlderInstruction(outsideText);

    // 1b. If no dialog is open: check existing instructions outside dialog
    if (!isDialogOpen) {
      console.info('[BetterView] gemini setup: checking existing instructions');
      const existingVer = extractInstructionVersion(outsideText);
      if (existingVer !== null && existingVer >= CURRENT_INSTRUCTION_VERSION) {
        console.info(`[BetterView] gemini setup: instruction already present (v${existingVer})`);
        const res: SetupResult = {
          status: 'already',
          version: existingVer,
          hasOldEntry,
        };
        recordSetupResult('gemini', res);
        return res;
      }

      // 1c. Find Add button and click it (up to 3 attempts)
      let dialogEditor: GeminiEditor | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.info(`[BetterView] gemini setup: looking for Add button (attempt ${attempt}/3)`);
        const addBtn = findGeminiAddButton(root);
        if (!addBtn) {
          break;
        }
        console.info(`[BetterView] gemini setup: clicking Add button (attempt ${attempt}/3)`);
        addBtn.click();

        const waitStart = Date.now();
        while (Date.now() - waitStart < addRetryMs) {
          dialogEditor = findGeminiTextarea(root);
          if (dialogEditor) break;
          await new Promise((r) => setTimeout(r, pollMs));
        }
        if (dialogEditor) break;
      }

      editor = dialogEditor ?? findGeminiTextarea(root);
      dialog = findGeminiDialog(root);
      isDialogOpen = Boolean(dialog && editor);

      if (!isDialogOpen || !editor) {
        const msg =
          "Couldn't find Gemini's Add button. Open gemini.google.com/saved-info, make sure you're signed in, then try again.";
        console.warn('[BetterView]', msg);
        const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
        recordSetupResult('gemini', res);
        return res;
      }
    }

    // 1d. If dialog IS already open: only use if empty or contains our text
    if (!editor) {
      editor = findGeminiTextarea(root);
    }
    const currentText =
      editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement
        ? editor.value
        : (editor?.textContent ?? '');
    const trimmedCurrent = currentText.trim();
    if (trimmedCurrent !== '' && !hasBetterViewMarker(trimmedCurrent)) {
      const msg = 'Gemini dialog contains existing text; aborting to avoid overwriting';
      console.warn('[BetterView]', msg);
      const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
      recordSetupResult('gemini', res);
      return res;
    }

    // 4. Guard: instruction length
    const instruction = getCompactInstruction();
    if (instruction.length > 1400) {
      const msg = `Instruction too long for Gemini (${instruction.length} chars)`;
      console.warn('[BetterView]', msg);
      const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
      recordSetupResult('gemini', res);
      return res;
    }

    // 1e. Fill memory dialog and submit
    console.info('[BetterView] gemini setup: filling memory dialog');
    await fillGeminiMemoryDialog(root, {
      waitTimeoutMs: Math.min(verifyTimeoutMs, 5000),
      pollIntervalMs: pollMs,
      waitForClose: false,
    });
    console.info('[BetterView] gemini setup: submitted memory dialog');

    // 1f. Verify success after submit: poll up to verifyTimeoutMs
    console.info('[BetterView] gemini setup: verifying saved entry');
    const startVerify = Date.now();
    const errorPattern = /wasn't saved|couldn't save|something went wrong|try again later|too long/i;
    const successMarker = `[BetterView v${CURRENT_INSTRUCTION_VERSION}`;

    while (Date.now() - startVerify < verifyTimeoutMs) {
      await new Promise((r) => setTimeout(r, pollMs));

      // Check for error text on whole page
      const fullText = getScopeElement(root)?.textContent ?? '';
      const errMatch = fullText.match(errorPattern);
      if (errMatch) {
        const msg = `Gemini rejected the entry: ${errMatch[0]}`;
        console.warn('[BetterView]', msg);
        const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
        recordSetupResult('gemini', res);
        return res;
      }

      // Check for success marker outside dialogs
      const liveOutside = getGeminiOutsideText(root);
      if (liveOutside.includes(successMarker)) {
        console.info(`[BetterView] gemini setup: verified entry on page (${successMarker})`);
        const res: SetupResult = {
          status: 'added',
          version: CURRENT_INSTRUCTION_VERSION,
          hasOldEntry,
        };
        recordSetupResult('gemini', res);
        return res;
      }

      // Check if dialog closed
      const currentDialog = findGeminiDialog(root);
      const isClosed =
        !currentDialog ||
        !currentDialog.isConnected ||
        (currentDialog instanceof HTMLElement &&
          (currentDialog.style.display === 'none' || currentDialog.hidden));

      if (isClosed) {
        await new Promise((r) => setTimeout(r, pollMs));
        const postText = getScopeElement(root)?.textContent ?? '';
        const postErr = postText.match(errorPattern);
        if (postErr) {
          const msg = `Gemini rejected the entry: ${postErr[0]}`;
          console.warn('[BetterView]', msg);
          const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
          recordSetupResult('gemini', res);
          return res;
        }
        console.info('[BetterView] gemini setup: dialog closed successfully');
        const res: SetupResult = {
          status: 'added',
          version: CURRENT_INSTRUCTION_VERSION,
          hasOldEntry,
        };
        recordSetupResult('gemini', res);
        return res;
      }
    }

    // After timeout
    const finalDialog = findGeminiDialog(root);
    const finalClosed =
      !finalDialog ||
      !finalDialog.isConnected ||
      (finalDialog instanceof HTMLElement &&
        (finalDialog.style.display === 'none' || finalDialog.hidden));

    const finalFullText = getScopeElement(root)?.textContent ?? '';
    const finalErr = finalFullText.match(errorPattern);
    if (finalErr) {
      const msg = `Gemini rejected the entry: ${finalErr[0]}`;
      console.warn('[BetterView]', msg);
      const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
      recordSetupResult('gemini', res);
      return res;
    }

    const finalOutside = getGeminiOutsideText(root);
    if (finalOutside.includes(successMarker) || finalClosed) {
      const res: SetupResult = {
        status: 'added',
        version: CURRENT_INSTRUCTION_VERSION,
        hasOldEntry,
      };
      recordSetupResult('gemini', res);
      return res;
    }

    const msg = "Gemini didn't accept the entry (dialog still open)";
    console.warn('[BetterView]', msg);
    const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
    recordSetupResult('gemini', res);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[BetterView]', 'Gemini setup error:', msg);
    const res: SetupResult = { status: 'failed', error: msg, hasOldEntry };
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
    const findCustomizeRegion = (): Element | null => {
      const direct = document.querySelector(GROK_SETUP_SELECTORS.customizeRegion);
      if (direct) return direct;
      const headings = document.querySelectorAll('h1, h2, h3, [role="heading"]');
      for (const heading of Array.from(headings)) {
        if (/^customize$/i.test((heading.textContent ?? '').trim())) {
          return heading.closest('[role="region"], section, form') ?? heading.parentElement?.parentElement ?? heading.parentElement;
        }
      }
      return null;
    };

    let customizeRegion: Element | null = null;
    for (let i = 0; i < 24; i++) {
      customizeRegion = findCustomizeRegion();
      const settingsReady = !!findGrokAction(/^settings$/i) || !!findGrokAction(/^customize(?: grok's response)?$/i)
        || !!document.querySelector(GROK_SETUP_SELECTORS.accountMenu)
        || !!findGrokAction(/^(open )?(account|profile|menu|navigation menu)$/i);
      if (customizeRegion || settingsReady) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!customizeRegion) {
      let settingsItem: HTMLElement | null = findGrokAction(/^settings$/i);
      let customizeAction: HTMLElement | null = findGrokAction(/^customize(?: grok's response)?$/i);
      const acctBtn = document.querySelector<HTMLButtonElement>(GROK_SETUP_SELECTORS.accountMenu)
        ?? findGrokAction(/^(open )?(account|profile|menu|navigation menu)$/i) as HTMLButtonElement | null;
      if (!settingsItem && !customizeAction && acctBtn) {
        acctBtn.click();
        const menuWaitStart = Date.now();
        while (!settingsItem && Date.now() - menuWaitStart < 5000) {
          settingsItem = findGrokAction(/^settings$/i);
          if (!settingsItem) await new Promise((r) => setTimeout(r, 200));
        }
      }
      if (settingsItem) settingsItem.click();

      if (settingsItem || acctBtn || customizeAction) {
        const customizeWaitStart = Date.now();
        while (!customizeAction && Date.now() - customizeWaitStart < 7000) {
          customizeAction = findGrokAction(/^customize(?: grok's response)?$/i);
          if (!customizeAction) await new Promise((r) => setTimeout(r, 250));
        }
        if (customizeAction) {
          customizeAction.click();
        }

        const startWait = Date.now();
        while (!customizeRegion && Date.now() - startWait < 8000) {
          await new Promise((r) => setTimeout(r, 250));
          customizeRegion = findCustomizeRegion();
        }
      }
    }

    if (!customizeRegion) {
      showGrokFallbackToast();
      const msg = "Couldn't find Customize settings";
      console.warn('[BetterView]', msg);
      return { status: 'failed', error: msg };
    }

    const dropdown = customizeRegion.querySelector<HTMLButtonElement>(GROK_SETUP_SELECTORS.dropdown)
      ?? customizeRegion.querySelector<HTMLButtonElement>('[role="combobox"]');
    if (dropdown && !/custom/i.test(dropdown.textContent ?? '')) {
      dropdown.click();
      await new Promise((r) => setTimeout(r, 300));
      const radios = document.querySelectorAll(GROK_SETUP_SELECTORS.menuitemRadio);
      for (const r of Array.from(radios)) {
        if (/^custom$/i.test(r.textContent?.trim() ?? '')) {
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

    if (textarea.maxLength > 0 && nextVal.length > textarea.maxLength) {
      showGrokFallbackToast();
      const msg = "Not enough room in Grok's custom instructions";
      console.warn('[BetterView]', msg);
      const res: SetupResult = { status: 'failed', error: msg };
      recordSetupResult('grok', res);
      return res;
    }

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
      if (/^save$/i.test(b.textContent?.trim() ?? '') || /save/i.test(b.getAttribute('aria-label') ?? '')) {
        saveBtn = b;
        break;
      }
    }
    if (!saveBtn) {
      showGrokFallbackToast();
      const msg = "Couldn't find Save button";
      console.warn('[BetterView]', msg);
      const res: SetupResult = { status: 'failed', error: msg };
      recordSetupResult('grok', res);
      return res;
    }

    for (let i = 0; i < 10; i++) {
      if (!saveBtn.disabled && !saveBtn.hasAttribute('disabled')) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (saveBtn.disabled) {
      showGrokFallbackToast();
      const msg = "Save button remained disabled";
      console.warn('[BetterView]', msg);
      const res: SetupResult = { status: 'failed', error: msg };
      recordSetupResult('grok', res);
      return res;
    }
    saveBtn.click();

    let saved = false;
    const startWait = Date.now();
    while (Date.now() - startWait < 2500) {
      await new Promise((r) => setTimeout(r, 200));
      const pageText = (customizeRegion.textContent ?? '').replace(/\s+/g, ' ');
      if (/couldn't save|failed to save|something went wrong/i.test(pageText)) {
        break;
      }
      const liveTextarea = customizeRegion.querySelector<HTMLTextAreaElement>(GROK_SETUP_SELECTORS.textarea);
      const currentValue = liveTextarea?.isConnected ? liveTextarea.value : '';
      const confirmedToast = /(?:instructions|changes|settings) (?:saved|updated)|saved successfully/i.test(pageText);
      if ((hasCurrentInstruction(currentValue) || confirmedToast) && Date.now() - startWait >= 1000) {
        saved = true;
        break;
      }
    }

    if (!saved) {
      showGrokFallbackToast();
      const msg = "Grok didn't save";
      console.warn('[BetterView]', msg);
      const res: SetupResult = { status: 'failed', error: msg };
      recordSetupResult('grok', res);
      return res;
    }

    const res: SetupResult = {
      status: 'added',
      version: CURRENT_INSTRUCTION_VERSION,
      hasOldEntry: hasOlderInstruction(textarea.value),
    };
    recordSetupResult('grok', res);
    return res;
  } catch (err: unknown) {
    showGrokFallbackToast();
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[BetterView]', 'Grok setup error:', msg);
    const res: SetupResult = { status: 'failed', error: msg };
    recordSetupResult('grok', res);
    return res;
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
