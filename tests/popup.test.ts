// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initPopup } from '../src/popup/popup';
import {
  SETUP_INSTRUCTION,
  SYSTEM_INSTRUCTION,
  CURRENT_INSTRUCTION_VERSION,
} from '../src/shared/systemInstruction';

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
        create: vi.fn(),
      },
      action: {
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn(),
      },
      runtime: {
        sendMessage: vi.fn(),
        getURL: vi.fn((path: string) => path),
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
            <span class="brand-title">BetterView AI</span>
          </div>
          <div id="status-line" class="status-pill status-muted">Open Gemini or Grok</div>
        </header>

        <section class="card setup-card" id="setup-card">
          <div class="card-title">Setup</div>
          <div class="setup-rows">
            <div class="setup-row" id="row-gemini">
              <div class="site-row-left">
                <div id="logo-gemini" class="site-row-logo">
                  <span class="btn-site-icon" id="icon-gemini"></span>
                </div>
                <div class="site-text-col">
                  <span class="site-row-name">Gemini</span>
                  <span id="setup-gemini-status" class="site-status-text">Not set up</span>
                  <div id="gemini-update-hint" class="gemini-update-hint hidden">Delete the old BetterView entry in Gemini Saved info</div>
                </div>
              </div>
              <div class="site-row-action">
                <button id="setup-gemini-btn" class="pill-btn action-pill-btn setup-btn" type="button" aria-label="Set up Gemini">
                  <span class="btn-spinner hidden" id="spinner-gemini"></span>
                  <span class="btn-label" id="label-gemini">Set up</span>
                  <span class="btn-check" id="check-gemini"></span>
                </button>
              </div>
            </div>
            <div class="setup-row" id="row-grok">
              <div class="site-row-left">
                <div id="logo-grok" class="site-row-logo">
                  <span class="btn-site-icon" id="icon-grok"></span>
                </div>
                <div class="site-text-col">
                  <span class="site-row-name">Grok</span>
                  <span id="setup-grok-status" class="site-status-text">Not set up</span>
                </div>
              </div>
              <div class="site-row-action">
                <button id="setup-grok-btn" class="pill-btn action-pill-btn setup-btn" type="button" aria-label="Set up Grok">
                  <span class="btn-spinner hidden" id="spinner-grok"></span>
                  <span class="btn-label" id="label-grok">Set up</span>
                  <span class="btn-check" id="check-grok"></span>
                </button>
              </div>
            </div>
          </div>
          <div id="setup-status" class="setup-status-line sr-only"></div>
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
          <a id="welcome-tour-link" class="footer-link" href="#" role="button">Welcome tour</a>
          <span class="footer-dot" aria-hidden="true">&middot;</span>
          <span class="version-tag">v0.1.0</span>
          <a id="whats-new-link" class="footer-link hidden" href="#" role="button">What's new</a>
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
      expect(document.documentElement.getAttribute('data-theme')).toMatch(/^(light|dark)$/);
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
      expect(instructionEl.textContent).toBe(SETUP_INSTRUCTION);
    });
  });

  describe('Copy Instruction Button', () => {
    it('copies instruction to clipboard and shows Copied ✓ for 1.5s', async () => {
      cleanupPopup = initPopup();

      const copyBtn = document.getElementById('copy-btn')!;
      const copyLabel = copyBtn.querySelector('.copy-label')!;

      copyBtn.click();
      await Promise.resolve(); // flush async clipboard promise

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SETUP_INSTRUCTION);
      expect(copyLabel.textContent).toContain('Copied');
      expect(copyBtn.classList.contains('is-copied')).toBe(true);

      // Advance by 1500ms
      vi.advanceTimersByTime(1500);

      expect(copyLabel.textContent).toBe('Copy');
      expect(copyBtn.classList.contains('is-copied')).toBe(false);
    });
  });

  describe('Auto Setup Buttons and Status', () => {
    it('sends START_AUTO_SETUP message and updates status text to Adding prompt…', () => {
      cleanupPopup = initPopup();

      const geminiBtn = document.getElementById('setup-gemini-btn')!;
      const statusEl = document.getElementById('setup-status')!;

      geminiBtn.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'START_AUTO_SETUP',
        site: 'gemini',
      });
      expect(statusEl.textContent).toBe('Adding prompt\u2026');
    });

    it('handles status updates from chrome.storage for Gemini and Grok and maps 4 states', () => {
      cleanupPopup = initPopup();

      const geminiBtn = document.getElementById('setup-gemini-btn')!;
      const grokBtn = document.getElementById('setup-grok-btn')!;
      const geminiStatus = document.getElementById('setup-gemini-status')!;
      const grokStatus = document.getElementById('setup-grok-status')!;
      const geminiLabel = document.getElementById('label-gemini')!;
      const grokLabel = document.getElementById('label-grok')!;
      const statusEl = document.getElementById('setup-status')!;

      // Default missing state: Not set up / Set up
      expect(geminiStatus.textContent).toBe('Not set up');
      expect(geminiLabel.textContent).toBe('Set up');
      expect(grokStatus.textContent).toBe('Not set up');
      expect(grokLabel.textContent).toBe('Set up');

      // State 1: Current version -> Prompt added / Refresh
      for (const listener of storageListeners) {
        listener(
          { gemini_setup_status: { newValue: { status: 'added', version: CURRENT_INSTRUCTION_VERSION } } },
          'local',
        );
      }
      expect(geminiStatus.textContent).toBe('Prompt added');
      expect(geminiLabel.textContent).toBe('Refresh');
      expect(geminiBtn.classList.contains('is-done')).toBe(true);

      // Grok is still Not set up, and the global #setup-status is visually hidden (.sr-only)
      expect(grokStatus.textContent).toBe('Not set up');
      expect(statusEl.classList.contains('sr-only')).toBe(true);

      // State 2: Older version -> Update available / Update
      for (const listener of storageListeners) {
        listener(
          { grok_setup_status: { newValue: { status: 'already', version: 2 } } },
          'local',
        );
      }
      expect(grokStatus.textContent).toBe('Update available');
      expect(grokLabel.textContent).toBe('Update');
      expect(grokBtn.classList.contains('is-done')).toBe(false);

      // State 3: Failed -> Error in visible text and title / Retry
      for (const listener of storageListeners) {
        listener(
          { gemini_setup_status: { newValue: { status: 'failed', error: 'Gemini rejected the entry' } } },
          'local',
        );
      }
      expect(geminiStatus.textContent).toBe('Gemini rejected the entry');
      expect(geminiStatus.getAttribute('title')).toBe('Gemini rejected the entry');
      expect(geminiLabel.textContent).toBe('Retry');
      expect(geminiBtn.classList.contains('is-done')).toBe(false);
    });

    it('shows Gemini update hint only when hasOldEntry is true', () => {
      cleanupPopup = initPopup();

      const geminiStatus = document.getElementById('setup-gemini-status')!;
      const geminiBtn = document.getElementById('setup-gemini-btn')!;
      const geminiUpdateHint = document.getElementById('gemini-update-hint')!;

      // Older version without old entry -> hint is hidden
      for (const listener of storageListeners) {
        listener(
          { gemini_setup_status: { newValue: { status: 'added', version: 1, hasOldEntry: false } } },
          'local',
        );
      }
      expect(geminiStatus.textContent).toBe('Update available');
      expect(geminiBtn.textContent).toContain('Update');
      expect(geminiUpdateHint.classList.contains('hidden')).toBe(true);

      // Older version with old entry -> hint is shown
      for (const listener of storageListeners) {
        listener(
          { gemini_setup_status: { newValue: { status: 'added', version: 2, hasOldEntry: true } } },
          'local',
        );
      }
      expect(geminiStatus.textContent).toBe('Update available');
      expect(geminiUpdateHint.classList.contains('hidden')).toBe(false);
    });

    it('has no version text in header and contains version in footer once', () => {
      cleanupPopup = initPopup();

      const header = document.querySelector('.header-row')!;
      expect(header.textContent).not.toContain('0.1.0');

      const footerVersions = document.querySelectorAll('.popup-footer .version-tag');
      expect(footerVersions.length).toBe(1);
      expect(footerVersions[0].textContent).toContain('0.1.0');
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

  describe('Footer Links', () => {
    it('opens welcome.html when Welcome tour is clicked', () => {
      cleanupPopup = initPopup();

      const tourLink = document.getElementById('welcome-tour-link')!;
      tourLink.click();

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'welcome.html' });
    });

    it('shows What is new link when update dot or lastSeenVersion is set', () => {
      localStore.hasUpdateDot = true;
      cleanupPopup = initPopup();

      const whatsNew = document.getElementById('whats-new-link')!;
      expect(whatsNew.classList.contains('hidden')).toBe(false);
    });

    it('opens welcome.html#whats-new and clears badge dot when What is new is clicked', () => {
      localStore.hasUpdateDot = true;
      cleanupPopup = initPopup();

      const whatsNew = document.getElementById('whats-new-link')!;
      whatsNew.click();

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'welcome.html#whats-new' });
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
      expect(whatsNew.classList.contains('hidden')).toBe(true);
    });
  });
});
