// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initPopup } from '../src/popup/popup';
import { SYSTEM_INSTRUCTION } from '../src/shared/systemInstruction';

describe('BetterView Popup', () => {
  let storageListeners: Array<(changes: Record<string, { newValue?: unknown }>, area: string) => void> = [];
  let syncStore: Record<string, unknown> = {};
  let localStore: Record<string, unknown> = {};
  let activeTabUrl = 'https://gemini.google.com/app';
  let cleanupPopup: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    storageListeners = [];
    syncStore = { theme: 'auto', renderEnabled: true, autoInject: false };
    localStore = {};
    activeTabUrl = 'https://gemini.google.com/app';

    // Mock chrome APIs
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: Record<string, unknown>) => void) => {
            const res: Record<string, unknown> = {};
            for (const k of keys) {
              if (k in localStore) res[k] = localStore[k];
            }
            cb(res);
          }),
          set: vi.fn((data: Record<string, unknown>, cb?: () => void) => {
            Object.assign(localStore, data);
            cb?.();
          }),
        },
        sync: {
          get: vi.fn((defaults: Record<string, unknown>, cb: (res: Record<string, unknown>) => void) => {
            cb({ ...defaults, ...syncStore });
          }),
          set: vi.fn((data: Record<string, unknown>, cb?: () => void) => {
            Object.assign(syncStore, data);
            for (const listener of storageListeners) {
              const changes: Record<string, { newValue?: unknown }> = {};
              for (const [k, v] of Object.entries(data)) {
                changes[k] = { newValue: v };
              }
              listener(changes, 'sync');
            }
            cb?.();
          }),
        },
        onChanged: {
          addListener: vi.fn((fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
            storageListeners.push(fn);
          }),
          removeListener: vi.fn((fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
            storageListeners = storageListeners.filter((l) => l !== fn);
          }),
        },
      },
      tabs: {
        query: vi.fn((_query: unknown, cb: (tabs: Array<{ url: string }>) => void) => {
          cb([{ url: activeTabUrl }]);
        }),
      },
      runtime: {
        sendMessage: vi.fn(),
        lastError: null,
      },
    };

    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });

    // Populate DOM structure
    document.body.innerHTML = `
      <div class="popup-container">
        <header class="header-row">
          <div class="header-brand">
            <picture id="header-logo" class="logo-picture">
              <source id="logo-source" media="(prefers-color-scheme: dark)" srcset="/brand/mark-white.png" />
              <img id="logo-img" src="/brand/mark-black.png" alt="BetterView" width="20" height="20" />
            </picture>
            <span class="brand-title">BetterView</span>
          </div>
          <div id="status-line" class="status-pill status-muted">Open Gemini or Grok</div>
        </header>

        <section class="card setup-card" id="setup-card">
          <div class="card-title">Setup</div>
          <div class="setup-buttons">
            <button id="setup-gemini-btn" class="pill-btn setup-btn" type="button" aria-label="Set up Gemini">
              <span class="btn-site-icon" id="icon-gemini"></span>
              <span class="btn-label">Gemini</span>
              <span class="btn-check" id="check-gemini"></span>
            </button>
            <button id="setup-grok-btn" class="pill-btn setup-btn" type="button" aria-label="Set up Grok">
              <span class="btn-site-icon" id="icon-grok"></span>
              <span class="btn-label">Grok</span>
              <span class="btn-check" id="check-grok"></span>
            </button>
          </div>
          <div id="setup-status" class="setup-status-line"></div>
          <span id="setup-gemini-status" class="visually-hidden"></span>
          <span id="setup-grok-status" class="visually-hidden"></span>
        </section>

        <section class="card appearance-card" id="appearance-card">
          <div class="card-title">Appearance</div>
          <div class="segmented-control" id="theme-segmented" role="radiogroup" aria-label="Appearance theme" data-value="auto">
            <div class="segmented-thumb" aria-hidden="true"></div>
            <button type="button" class="segmented-btn is-active" data-value="auto" role="radio" aria-checked="true">Auto</button>
            <button type="button" class="segmented-btn" data-value="light" role="radio" aria-checked="false">Light</button>
            <button type="button" class="segmented-btn" data-value="dark" role="radio" aria-checked="false">Dark</button>
          </div>
          <select id="theme-select" class="visually-hidden" aria-hidden="true" tabindex="-1">
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </section>

        <section class="manual-setup-section" id="manual-setup-section">
          <button id="manual-setup-toggle" class="manual-setup-toggle" type="button" aria-expanded="false" aria-controls="manual-setup-content">
            <span class="manual-setup-title">Manual setup</span>
            <span class="manual-setup-chevron" id="manual-setup-chevron"></span>
          </button>
          <div id="manual-setup-content" class="manual-setup-content">
            <div class="manual-setup-inner">
              <div id="system-instruction" class="instruction-preview" role="region" aria-label="System instruction preview" tabindex="0"></div>
              <div class="manual-setup-action">
                <button id="copy-btn" class="pill-btn copy-btn" type="button">
                  <span class="copy-label">Copy</span>
                </button>
              </div>
              <p class="manual-setup-hint">Paste into Gemini &rsaquo; Saved info, or Grok &rsaquo; Settings &rsaquo; Customize &rsaquo; Custom.</p>
            </div>
          </div>
        </section>

        <footer class="popup-footer">
          <span class="version-tag">v0.1.0</span>
        </footer>
      </div>
    `;
  });

  afterEach(() => {
    cleanupPopup?.();
    cleanupPopup = null;
    vi.useRealTimers();
  });

  describe('Appearance: Segmented Control', () => {
    it('initializes to auto by default', async () => {
      cleanupPopup = initPopup();
      await vi.runAllTimersAsync();

      const segmented = document.getElementById('theme-segmented')!;
      expect(segmented.getAttribute('data-value')).toBe('auto');

      const autoBtn = segmented.querySelector('button[data-value="auto"]')!;
      const lightBtn = segmented.querySelector('button[data-value="light"]')!;
      const darkBtn = segmented.querySelector('button[data-value="dark"]')!;

      expect(autoBtn.getAttribute('aria-checked')).toBe('true');
      expect(autoBtn.classList.contains('is-active')).toBe(true);
      expect(lightBtn.getAttribute('aria-checked')).toBe('false');
      expect(darkBtn.getAttribute('aria-checked')).toBe('false');
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('updates state and settings when Light is clicked', async () => {
      cleanupPopup = initPopup();
      await vi.runAllTimersAsync();

      const segmented = document.getElementById('theme-segmented')!;
      const lightBtn = segmented.querySelector<HTMLButtonElement>('button[data-value="light"]')!;
      lightBtn.click();
      await vi.runAllTimersAsync();

      expect(segmented.getAttribute('data-value')).toBe('light');
      expect(lightBtn.getAttribute('aria-checked')).toBe('true');
      expect(lightBtn.classList.contains('is-active')).toBe(true);

      const autoBtn = segmented.querySelector('button[data-value="auto"]')!;
      expect(autoBtn.getAttribute('aria-checked')).toBe('false');
      expect(autoBtn.classList.contains('is-active')).toBe(false);

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'light' }),
        expect.any(Function),
      );
    });

    it('updates state and settings when Dark is clicked', async () => {
      cleanupPopup = initPopup();
      await vi.runAllTimersAsync();

      const segmented = document.getElementById('theme-segmented')!;
      const darkBtn = segmented.querySelector<HTMLButtonElement>('button[data-value="dark"]')!;
      darkBtn.click();
      await vi.runAllTimersAsync();

      expect(segmented.getAttribute('data-value')).toBe('dark');
      expect(darkBtn.getAttribute('aria-checked')).toBe('true');
      expect(darkBtn.classList.contains('is-active')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      const logoImg = document.getElementById('logo-img') as HTMLImageElement;
      expect(logoImg.src).toContain('/brand/mark-white.png');
    });

    it('responds to external settings changes', async () => {
      cleanupPopup = initPopup();
      await vi.runAllTimersAsync();

      // Update sync store first so loadSettings gets the new value
      syncStore.theme = 'dark';
      for (const listener of storageListeners) {
        listener({ theme: { newValue: 'dark' } }, 'sync');
      }
      await vi.runAllTimersAsync();

      const segmented = document.getElementById('theme-segmented')!;
      expect(segmented.getAttribute('data-value')).toBe('dark');
      const darkBtn = segmented.querySelector('button[data-value="dark"]')!;
      expect(darkBtn.getAttribute('aria-checked')).toBe('true');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('Manual Setup Toggle', () => {
    it('is collapsed by default with aria-expanded false', () => {
      cleanupPopup = initPopup();

      const toggle = document.getElementById('manual-setup-toggle')!;
      const content = document.getElementById('manual-setup-content')!;

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(content.classList.contains('is-expanded')).toBe(false);
    });

    it('toggles expand on click and collapses on next click', () => {
      cleanupPopup = initPopup();

      const toggle = document.getElementById('manual-setup-toggle')!;
      const content = document.getElementById('manual-setup-content')!;

      toggle.click();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(content.classList.contains('is-expanded')).toBe(true);

      toggle.click();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(content.classList.contains('is-expanded')).toBe(false);
    });

    it('displays the system instruction preview', () => {
      cleanupPopup = initPopup();

      const instructionEl = document.getElementById('system-instruction')!;
      expect(instructionEl.textContent).toBe(SYSTEM_INSTRUCTION);
    });
  });

  describe('Copy Instruction Button', () => {
    it('copies instruction to clipboard and shows Copied ✓ for 1.5s', async () => {
      cleanupPopup = initPopup();

      const copyBtn = document.getElementById('copy-btn')!;
      const copyLabel = copyBtn.querySelector('.copy-label')!;

      copyBtn.click();
      await Promise.resolve(); // flush async clipboard promise

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SYSTEM_INSTRUCTION);
      expect(copyLabel.textContent).toContain('Copied');
      expect(copyBtn.classList.contains('is-copied')).toBe(true);

      // Advance by 1500ms
      vi.advanceTimersByTime(1500);

      expect(copyLabel.textContent).toBe('Copy');
      expect(copyBtn.classList.contains('is-copied')).toBe(false);
    });
  });

  describe('Auto Setup Buttons and Status', () => {
    it('sends START_AUTO_SETUP message and updates status text to Setting up…', () => {
      cleanupPopup = initPopup();

      const geminiBtn = document.getElementById('setup-gemini-btn')!;
      const statusEl = document.getElementById('setup-status')!;

      geminiBtn.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'START_AUTO_SETUP',
        site: 'gemini',
      });
      expect(statusEl.textContent).toBe('Setting up\u2026');
    });

    it('handles status updates from chrome.storage for Gemini and Grok', () => {
      cleanupPopup = initPopup();

      const geminiBtn = document.getElementById('setup-gemini-btn')!;
      const grokBtn = document.getElementById('setup-grok-btn')!;
      const statusEl = document.getElementById('setup-status')!;

      // Simulate Gemini setup success
      for (const listener of storageListeners) {
        listener({ gemini_setup_status: { newValue: { status: 'added' } } }, 'local');
      }

      expect(statusEl.textContent).toBe('Added \u2713');
      expect(geminiBtn.classList.contains('is-done')).toBe(true);
      expect(grokBtn.classList.contains('is-done')).toBe(false);

      // Simulate Grok setup already
      for (const listener of storageListeners) {
        listener({ grok_setup_status: { newValue: { status: 'already' } } }, 'local');
      }

      expect(statusEl.textContent).toBe('Already set up \u2713');
      expect(grokBtn.classList.contains('is-done')).toBe(true);

      // Simulate failure
      for (const listener of storageListeners) {
        listener(
          { gemini_setup_status: { newValue: { status: 'failed', error: 'Network error' } } },
          'local',
        );
      }
      expect(statusEl.textContent).toBe('Network error');
      expect(geminiBtn.classList.contains('is-done')).toBe(false);
    });
  });

  describe('Active Tab Detection', () => {
    it('shows Active with dot when current tab is Gemini', () => {
      activeTabUrl = 'https://gemini.google.com/app';
      cleanupPopup = initPopup();

      const statusLine = document.getElementById('status-line')!;
      expect(statusLine.className).toContain('status-active');
      expect(statusLine.textContent).toContain('Active');
      expect(statusLine.querySelector('.status-dot')).not.toBeNull();
    });

    it('shows Active with dot when current tab is Grok', () => {
      activeTabUrl = 'https://grok.com/chat';
      cleanupPopup = initPopup();

      const statusLine = document.getElementById('status-line')!;
      expect(statusLine.className).toContain('status-active');
      expect(statusLine.textContent).toContain('Active');
      expect(statusLine.querySelector('.status-dot')).not.toBeNull();
    });

    it('shows Open Gemini or Grok when current tab is other site', () => {
      activeTabUrl = 'https://example.com';
      cleanupPopup = initPopup();

      const statusLine = document.getElementById('status-line')!;
      expect(statusLine.className).toContain('status-muted');
      expect(statusLine.textContent).toBe('Open Gemini or Grok');
      expect(statusLine.querySelector('.status-dot')).toBeNull();
    });
  });

  describe('Lucide Icons Rendering', () => {
    it('mounts SVG icons into respective containers without innerHTML', () => {
      cleanupPopup = initPopup();

      const iconGemini = document.getElementById('icon-gemini')!;
      const iconGrok = document.getElementById('icon-grok')!;
      const checkGemini = document.getElementById('check-gemini')!;
      const checkGrok = document.getElementById('check-grok')!;
      const chevron = document.getElementById('manual-setup-chevron')!;

      expect(iconGemini.querySelector('svg')).not.toBeNull();
      expect(iconGrok.querySelector('svg')).not.toBeNull();
      expect(checkGemini.querySelector('svg')).not.toBeNull();
      expect(checkGrok.querySelector('svg')).not.toBeNull();
      expect(chevron.querySelector('svg')).not.toBeNull();
    });
  });
});
