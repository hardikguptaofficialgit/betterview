// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initWelcomePage } from '../src/welcome/welcome';
import { FEATURE_CARDS, DEMO_ITEMS } from '../src/welcome/demoData';

describe('Welcome page UI', () => {
  let localStore: Record<string, unknown> = {};
  let syncStore: Record<string, unknown> = {};
  let cleanupWelcome: (() => void) | null = null;

  beforeEach(() => {
    localStore = {};
    syncStore = { theme: 'auto' };

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
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        create: vi.fn(),
      },
      runtime: {
        sendMessage: vi.fn(),
        getManifest: vi.fn(() => ({ version: '0.1.0' })),
        getURL: vi.fn((p: string) => p),
      },
    };

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });

    document.body.innerHTML = '<div id="welcome-app"></div>';
  });

  afterEach(() => {
    cleanupWelcome?.();
    cleanupWelcome = null;
  });

  it('renders Hero section with logo, title, version pill, tagline and CTA', () => {
    cleanupWelcome = initWelcomePage();

    const title = document.querySelector('.hero-title');
    expect(title?.textContent).toBe('BetterView');

    const versionPill = document.querySelector('.version-pill');
    expect(versionPill?.textContent).toBe('v0.1.0');

    const tagline = document.querySelector('.hero-tagline');
    expect(tagline?.textContent).toBe('Intelligent UI for Gemini and Grok');

    const cta = document.getElementById('hero-setup-cta');
    expect(cta?.textContent).toBe('Set up in 2 clicks');
  });

  it('renders Live demo card with chat bubble and component switcher dots', () => {
    cleanupWelcome = initWelcomePage();

    const chatBubble = document.querySelector('.demo-chat-bubble');
    expect(chatBubble).not.toBeNull();

    const dots = document.querySelectorAll('.demo-dot');
    expect(dots.length).toBe(DEMO_ITEMS.length);
    expect(dots[0].getAttribute('aria-selected')).toBe('true');
  });

  it('renders exactly 7 feature cards with distinct pastels', () => {
    cleanupWelcome = initWelcomePage();

    const cards = document.querySelectorAll('.feature-card');
    expect(cards.length).toBe(7);
    expect(FEATURE_CARDS.length).toBe(7);

    const pastels = FEATURE_CARDS.map((c) => c.pastel);
    const uniquePastels = new Set(pastels);
    expect(uniquePastels.size).toBe(7);
  });

  it('renders guided setup steps and disclosure', () => {
    cleanupWelcome = initWelcomePage();

    const geminiBtn = document.getElementById('welcome-setup-gemini-btn');
    const grokBtn = document.getElementById('welcome-setup-grok-btn');
    expect(geminiBtn).not.toBeNull();
    expect(grokBtn).not.toBeNull();

    geminiBtn?.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'START_AUTO_SETUP',
      site: 'gemini',
    });

    const manualToggle = document.getElementById('welcome-manual-toggle');
    const manualContent = document.getElementById('welcome-manual-content');
    expect(manualToggle?.getAttribute('aria-expanded')).toBe('false');

    manualToggle?.click();
    expect(manualToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(manualContent?.classList.contains('is-open')).toBe(true);
  });

  it('copies sample prompt and updates label in Step 2', async () => {
    cleanupWelcome = initWelcomePage();

    const copyBtn = document.getElementById('welcome-copy-prompt-btn')!;
    copyBtn.click();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Design a URL shortener like bit.ly'),
    );

    const label = document.getElementById('welcome-copy-prompt-label');
    expect(label?.textContent).toBe('Copied \u2713');
  });

  it('renders privacy strip and footer with GitHub link', () => {
    cleanupWelcome = initWelcomePage();

    const privacyItems = document.querySelectorAll('.privacy-item');
    expect(privacyItems.length).toBe(3);

    const ghLink = document.querySelector<HTMLAnchorElement>('.footer-link');
    expect(ghLink?.href).toBe('https://github.com/hardikguptaofficialgit/betterview');

    const author = document.querySelector('.footer-author');
    expect(author?.textContent).toBe('Made by Hardik Gupta');
  });
});
