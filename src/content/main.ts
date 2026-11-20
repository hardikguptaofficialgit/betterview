import { pickAdapter, runGeminiSetup, runGrokSetup, recordSetupResult, SiteAdapter } from './sites';
import { loadSettings, onSettingsChange, Settings } from '../shared/settings';
import { detectHostTheme, watchHostTheme, ThemeMode } from '../core/theme';
import { startScanner } from './scanner';
import { startAutoInject } from './inject';
import { SYSTEM_INSTRUCTION_SHORT } from '../shared/systemInstruction';

async function init(): Promise<void> {
  const matched = pickAdapter(window.location);
  if (!matched) return;
  const adapter: SiteAdapter = matched;

  // Handle auto-setup hash if opened with #betterview-setup
  if (window.location.hash.includes('betterview-setup')) {
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
