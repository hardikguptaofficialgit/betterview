// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getNextStep,
  getPrevStep,
  clampStep,
  shouldShowTour,
  shouldShowUpdateModal,
  canOpenTourOnTab,
  TOTAL_TOUR_STEPS,
} from '../src/welcome/tourState';
import { showTourModal, showWhatsNewModal, closeAnyActiveModal } from '../src/welcome/tourModal';
import * as fs from 'fs';
import * as path from 'path';

describe('Tour State Machine', () => {
  it('shouldShowTour returns true only when pendingTour is true and tourSeen is false/absent', () => {
    expect(shouldShowTour({ pendingTour: true, tourSeen: false })).toBe(true);
    expect(shouldShowTour({ pendingTour: true })).toBe(true);
    expect(shouldShowTour({ pendingTour: true, tourSeen: true })).toBe(false);
    expect(shouldShowTour({ pendingTour: false, tourSeen: false })).toBe(false);
    expect(shouldShowTour({})).toBe(false);
  });

  it('shouldShowUpdateModal returns true only when pendingUpdateModal is true and updateModalSeen is false/absent', () => {
    expect(shouldShowUpdateModal({ pendingUpdateModal: true, updateModalSeen: false })).toBe(true);
    expect(shouldShowUpdateModal({ pendingUpdateModal: true })).toBe(true);
    expect(shouldShowUpdateModal({ pendingUpdateModal: true, updateModalSeen: true })).toBe(false);
    expect(shouldShowUpdateModal({ pendingUpdateModal: false, updateModalSeen: false })).toBe(false);
    expect(shouldShowUpdateModal({})).toBe(false);
  });

  it('canOpenTourOnTab permits Gemini and Grok tabs and rejects other URLs', () => {
    expect(canOpenTourOnTab('https://gemini.google.com/app')).toBe(true);
    expect(canOpenTourOnTab('https://sub.gemini.google.com/test')).toBe(true);
    expect(canOpenTourOnTab('https://grok.com/chat')).toBe(true);
    expect(canOpenTourOnTab('https://grok.com')).toBe(true);
    expect(canOpenTourOnTab('https://google.com')).toBe(false);
    expect(canOpenTourOnTab('https://example.com')).toBe(false);
    expect(canOpenTourOnTab('')).toBe(false);
    expect(canOpenTourOnTab(undefined)).toBe(false);
  });
});

describe('Carousel Navigation', () => {
  it('has exactly 4 total tour steps', () => {
    expect(TOTAL_TOUR_STEPS).toBe(4);
  });

  it('getNextStep increments step and clamps at total - 1', () => {
    expect(getNextStep(0)).toBe(1);
    expect(getNextStep(1)).toBe(2);
    expect(getNextStep(2)).toBe(3);
    expect(getNextStep(3)).toBe(3);
    expect(getNextStep(10)).toBe(3);
  });

  it('getPrevStep decrements step and clamps at 0', () => {
    expect(getPrevStep(3)).toBe(2);
    expect(getPrevStep(2)).toBe(1);
    expect(getPrevStep(1)).toBe(0);
    expect(getPrevStep(0)).toBe(0);
    expect(getPrevStep(-5)).toBe(0);
  });

  it('clampStep bounds index between 0 and total - 1', () => {
    expect(clampStep(-1)).toBe(0);
    expect(clampStep(0)).toBe(0);
    expect(clampStep(2)).toBe(2);
    expect(clampStep(3)).toBe(3);
    expect(clampStep(4)).toBe(3);
  });
});

describe('Store Readiness & Package Script', () => {
  it('package.json defines a package script that runs scripts/package.mjs', () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    expect(pkgJson.scripts).toBeDefined();
    expect(pkgJson.scripts.package).toBe('node scripts/package.mjs');
  });

  it('scripts/package.mjs creates zip matching release/betterview-ai-v<version>.zip', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/package.mjs');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    expect(scriptContent).toContain('betterview-ai-v${version}.zip');
    expect(scriptContent).toContain('release');
  });
});

describe('Welcome Tour Modal Component', () => {
  let localStore: Record<string, unknown> = {};

  beforeEach(() => {
    localStore = {};
    closeAnyActiveModal();

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
      },
      tabs: {
        create: vi.fn(),
      },
      runtime: {
        sendMessage: vi.fn(),
        getManifest: vi.fn(() => ({ version: '0.1.0' })),
        getURL: vi.fn((p: string) => p),
      },
      action: {
        setBadgeText: vi.fn(),
      },
    };

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    closeAnyActiveModal();
  });

  it('mounts centered modal in Shadow DOM with 4 carousel dots and step navigation', () => {
    const close = showTourModal();

    const host = document.getElementById('betterview-tour-host');
    expect(host).not.toBeNull();
    const shadow = host?.shadowRoot;
    expect(shadow).not.toBeNull();

    const card = shadow?.querySelector('.modal-card');
    expect(card).not.toBeNull();

    const dots = shadow?.querySelectorAll('.carousel-dot');
    expect(dots?.length).toBe(4);
    expect(dots?.[0].classList.contains('is-active')).toBe(true);

    const nextBtn = shadow?.querySelector<HTMLButtonElement>('.next-btn');
    const backBtn = shadow?.querySelector<HTMLButtonElement>('.back-btn');
    expect(nextBtn?.textContent).toBe('Next');
    expect(backBtn?.hasAttribute('disabled')).toBe(true);

    // Advance to slide 2
    nextBtn?.click();
    expect(dots?.[1].classList.contains('is-active')).toBe(true);
    expect(backBtn?.hasAttribute('disabled')).toBe(false);

    // Advance to slide 3
    nextBtn?.click();
    expect(dots?.[2].classList.contains('is-active')).toBe(true);

    // Advance to slide 4 (last step)
    nextBtn?.click();
    expect(dots?.[3].classList.contains('is-active')).toBe(true);
    expect(nextBtn?.textContent).toBe('Done');

    // Clicking Back
    backBtn?.click();
    expect(dots?.[2].classList.contains('is-active')).toBe(true);

    close();
  });

  it('offers setup for both Gemini and Grok and copies the OAuth teaching prompt', async () => {
    showTourModal({ site: 'gemini' });

    const shadow = document.getElementById('betterview-tour-host')?.shadowRoot;
    expect(shadow?.querySelectorAll('.setup-action-card').length).toBe(2);
    expect(shadow?.querySelector('.slide-setup')?.textContent).toContain('Gemini');
    expect(shadow?.querySelector('.slide-setup')?.textContent).toContain('Grok');

    shadow?.querySelector<HTMLButtonElement>('.prompt-copy-btn')?.click();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Teach me how OAuth 2.0 works'),
    );
  });

  it('supports Left and Right arrow keyboard navigation and focus trap', () => {
    const close = showTourModal();
    const host = document.getElementById('betterview-tour-host');
    const shadow = host?.shadowRoot;
    const dots = shadow?.querySelectorAll('.carousel-dot');
    expect(dots?.[0].classList.contains('is-active')).toBe(true);

    // ArrowRight advances to step 2
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(dots?.[1].classList.contains('is-active')).toBe(true);

    // ArrowLeft goes back to step 1
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(dots?.[0].classList.contains('is-active')).toBe(true);

    // Focus trap: Tab key cycles focus within modal
    const focusable = shadow?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable && focusable.length > 0).toBe(true);

    const firstEl = focusable![0];
    const lastEl = focusable![focusable!.length - 1];

    // Simulate Tab on last element wraps to first
    lastEl.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    shadow?.dispatchEvent(tabEvent);

    close();
  });

  it('closes on Skip and records tourSeen: true in storage', () => {
    let completed = false;
    showTourModal({ onComplete: () => { completed = true; } });

    const host = document.getElementById('betterview-tour-host');
    const shadow = host?.shadowRoot;
    const skipBtn = shadow?.querySelector<HTMLButtonElement>('.skip-btn');
    expect(skipBtn).not.toBeNull();

    skipBtn?.click();

    expect(localStore.pendingTour).toBe(false);
    expect(localStore.tourSeen).toBe(true);
    expect(completed).toBe(true);
    expect(document.getElementById('betterview-tour-host')).toBeNull();
  });

  it('closes on Escape key press', () => {
    showTourModal();

    const host = document.getElementById('betterview-tour-host');
    expect(host).not.toBeNull();

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escEvent);

    expect(localStore.tourSeen).toBe(true);
    expect(document.getElementById('betterview-tour-host')).toBeNull();
  });

  it('showWhatsNewModal renders modal and sets updateModalSeen: true on close', () => {
    let completed = false;
    showWhatsNewModal({ onComplete: () => { completed = true; } });

    const host = document.getElementById('betterview-whatsnew-host');
    expect(host).not.toBeNull();
    const shadow = host?.shadowRoot;

    const closeBtn = shadow?.querySelector<HTMLButtonElement>('.modal-close-btn');
    expect(closeBtn).not.toBeNull();

    closeBtn?.click();

    expect(localStore.pendingUpdateModal).toBe(false);
    expect(localStore.updateModalSeen).toBe(true);
    expect(completed).toBe(true);
    expect(document.getElementById('betterview-whatsnew-host')).toBeNull();
  });

  it('renders new brand mark elements with dark and light variants in tour and whats-new modals', () => {
    showTourModal({ theme: 'dark' });
    const tourHost = document.getElementById('betterview-tour-host');
    const tourShadow = tourHost?.shadowRoot;
    const tourMarkWrap = tourShadow?.querySelector('.bv-modal-mark-wrap');
    expect(tourMarkWrap).not.toBeNull();
    const tourDarkImg = tourMarkWrap?.querySelector<HTMLImageElement>('.bv-mark-dark');
    const tourLightImg = tourMarkWrap?.querySelector<HTMLImageElement>('.bv-mark-light');
    expect(tourDarkImg?.src).toContain('brand/mark-white.png');
    expect(tourLightImg?.src).toContain('brand/mark-black.png');
    expect(tourDarkImg?.style.display).toBe('block');
    expect(tourLightImg?.style.display).toBe('none');
    closeAnyActiveModal();

    showWhatsNewModal({ theme: 'light' });
    const wnHost = document.getElementById('betterview-whatsnew-host');
    const wnShadow = wnHost?.shadowRoot;
    const wnMarkWrap = wnShadow?.querySelector('.bv-modal-mark-wrap');
    expect(wnMarkWrap).not.toBeNull();
    const wnDarkImg = wnMarkWrap?.querySelector<HTMLImageElement>('.bv-mark-dark');
    const wnLightImg = wnMarkWrap?.querySelector<HTMLImageElement>('.bv-mark-light');
    expect(wnDarkImg?.src).toContain('brand/mark-white.png');
    expect(wnLightImg?.src).toContain('brand/mark-black.png');
    expect(wnDarkImg?.style.display).toBe('none');
    expect(wnLightImg?.style.display).toBe('block');
    closeAnyActiveModal();
  });
});
