import { pickAdapter, runGeminiSetup, runGrokSetup, recordSetupResult, SiteAdapter } from './sites';
import { loadSettings, onSettingsChange, Settings } from '../shared/settings';
import { detectHostTheme, watchHostTheme, ThemeMode } from '../core/theme';
import { startScanner } from './scanner';
import { startAutoInject } from './inject';
import { SYSTEM_INSTRUCTION_SHORT } from '../shared/systemInstruction';
import { showWelcomeTourModal, showWhatsNewModal } from '../welcome/tourModal';
import { shouldShowTour, shouldShowUpdateModal } from '../welcome/tourState';

async function init(): Promise<void> {
  const matched = pickAdapter(window.location);
  if (!matched) return;
  const adapter: SiteAdapter = matched;

  // Handle auto-setup if opened with #betterview-setup or pendingSetup storage
  let shouldRunSetup = window.location.hash.includes('betterview-setup');
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const items = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(['pendingSetup'], (res) => resolve(res || {}));
      });
      const pending = items.pendingSetup as { site?: string; ts?: number } | undefined;
      if (pending && pending.site === adapter.id && typeof pending.ts === 'number') {
        if (Date.now() - pending.ts < 90000) {
          shouldRunSetup = true;
        }
      }
    } catch {
      // storage get failed
    }
  }

  if (shouldRunSetup) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.remove('pendingSetup');
    }
    if (adapter.id === 'gemini') {
      runGeminiSetup()
        .then((res) => recordSetupResult('gemini', res))
        .catch(() => recordSetupResult('gemini', 'failed'));
    } else if (adapter.id === 'grok') {
      runGrokSetup()
        .then((res) => recordSetupResult('grok', res))
        .catch(() => recordSetupResult('grok', 'failed'));
    }
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
        if (shouldShowTour(items)) {
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
        showWelcomeTourModal({ site: adapter.id, theme: currentTheme });
        sendResponse?.({ ok: true });
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
