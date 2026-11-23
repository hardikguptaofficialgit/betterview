import {
  pickAdapter,
  runGeminiSetup,
  runGrokSetup,
  recordSetupResult,
  isGeminiSavedInfoPath,
  SiteAdapter,
} from './sites';
import { loadSettings, onSettingsChange, Settings } from '../shared/settings';
import { detectHostTheme, watchHostTheme, ThemeMode } from '../core/theme';
import { startScanner } from './scanner';
import { startAutoInject } from './inject';
import { SYSTEM_INSTRUCTION_SHORT } from '../shared/systemInstruction';
import { showWelcomeTourModal, showWhatsNewModal } from '../welcome/tourModal';
import { shouldShowTour, shouldShowUpdateModal } from '../welcome/tourState';

let setupStarted = false;

async function init(): Promise<void> {
  const matched = pickAdapter(window.location);
  if (!matched) return;
  const adapter: SiteAdapter = matched;

  // Handle auto-setup if opened with #betterview-setup or pendingSetup storage.
  // Keep the marker until the flow finishes: Gemini can perform a full page
  // navigation while opening Personal Intelligence / Instructions, which
  // destroys this content-script instance and its in-memory promise.
  let shouldRunSetup = window.location.hash.includes('betterview-setup');
  let pendingSetupTs: number | undefined;
  let redirects = 0;

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const items = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(['pendingSetup'], (res) => resolve(res || {}));
      });
      const pending = items.pendingSetup as
        | { site?: string; ts?: number; redirects?: number }
        | undefined;
      if (pending && pending.site === adapter.id && typeof pending.ts === 'number') {
        if (Date.now() - pending.ts < 5 * 60 * 1000) {
          shouldRunSetup = true;
          pendingSetupTs = pending.ts;
          redirects = typeof pending.redirects === 'number' ? pending.redirects : 0;
        } else {
          chrome.storage.local.remove('pendingSetup');
        }
      }
    } catch {
      // storage get failed
    }
  }

  if (shouldRunSetup && !setupStarted && (adapter.id === 'gemini' || adapter.id === 'grok')) {
    setupStarted = true;
    const setupSite = adapter.id === 'gemini' ? 'gemini' : 'grok';

    const clearPendingSetup = () => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.remove('pendingSetup');
      }
    };

    if (adapter.id === 'gemini' && !isGeminiSavedInfoPath(window.location.pathname)) {
      if (redirects < 1) {
        const nextPending = {
          site: 'gemini',
          ts: pendingSetupTs ?? Date.now(),
          redirects: redirects + 1,
        };
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ pendingSetup: nextPending }, () => {
            window.location.assign('https://gemini.google.com/saved-info');
          });
        } else {
          window.location.assign('https://gemini.google.com/saved-info');
        }
        return;
      }
      // If redirects >= 1 and we are still not on saved-info path, runGeminiSetup on current page anyway
    }

    const setup = setupSite === 'gemini' ? runGeminiSetup() : runGrokSetup();
    setup
      .then((res) => {
        recordSetupResult(setupSite, res);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        recordSetupResult(setupSite, { status: 'failed', error: msg });
      })
      .finally(() => {
        clearPendingSetup();
      });
  }

  let settings: Settings;
  try {
    settings = await loadSettings();
  } catch {
    return;
  }

  let currentTheme: ThemeMode =
    settings.theme === 'auto' ? detectHostTheme() : settings.theme;

  let scanner: ReturnType<typeof startScanner> | null = null;
  let stopInject: (() => void) | null = null;

  function applyScanner(): void {
    if (settings.renderEnabled) {
      if (!scanner) {
        scanner = startScanner(adapter, () => currentTheme);
      }
    } else {
      if (scanner) {
        scanner.stop();
        scanner = null;
      }
    }
  }

  function applyInject(): void {
    if (settings.autoInject) {
      if (!stopInject) {
        stopInject = startAutoInject(adapter, SYSTEM_INSTRUCTION_SHORT);
      }
    } else {
      if (stopInject) {
        stopInject();
        stopInject = null;
      }
    }
  }

  applyScanner();
  applyInject();

  // Welcome tour and Update modal check
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(
      ['pendingTour', 'tourSeen', 'pendingUpdateModal', 'updateModalSeen'],
      (items) => {
        if (shouldShowTour(items) && (adapter.id === 'gemini' || adapter.id === 'grok')) {
          showWelcomeTourModal({ site: adapter.id, theme: currentTheme });
        } else if (shouldShowUpdateModal(items)) {
          showWhatsNewModal({ theme: currentTheme });
        }
      },
    );
  }

  // Runtime message listener (from popup or background)
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'OPEN_TOUR') {
        if (adapter.id === 'gemini' || adapter.id === 'grok') {
          showWelcomeTourModal({ site: adapter.id, theme: currentTheme });
          sendResponse?.({ ok: true });
        } else {
          sendResponse?.({ ok: false });
        }
        return true;
      }
      if (msg?.type === 'OPEN_WHATS_NEW') {
        showWhatsNewModal({ theme: currentTheme });
        sendResponse?.({ ok: true });
        return true;
      }
    });
  }

  watchHostTheme((newTheme) => {
    if (settings.theme === 'auto') {
      currentTheme = newTheme;
      if (scanner) {
        scanner.setTheme(newTheme);
      }
    }
  });

  onSettingsChange((newSettings) => {
    settings = newSettings;
    currentTheme =
      settings.theme === 'auto' ? detectHostTheme() : settings.theme;
    if (scanner) {
      scanner.setTheme(currentTheme);
    }
    applyScanner();
    applyInject();
  });

  console.log(`[IUI] active on ${adapter.id}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
