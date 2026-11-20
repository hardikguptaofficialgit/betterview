import './popup.css';
import { loadSettings, saveSettings, onSettingsChange, Settings } from '../shared/settings';
import { SYSTEM_INSTRUCTION } from '../shared/systemInstruction';
import { h, clear } from '../core/dom';
import { iconEl } from '../core/icons';

export function initPopup(): () => void {
  const statusLine = document.getElementById('status-line');
  const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement | null;
  const instructionEl = document.getElementById('system-instruction');
  const themeSegmented = document.getElementById('theme-segmented');
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
  const logoImg = document.getElementById('logo-img') as HTMLImageElement | null;
  const logoSource = document.getElementById('logo-source') as HTMLSourceElement | null;

  const setupGeminiBtn = document.getElementById('setup-gemini-btn') as HTMLButtonElement | null;
  const setupGrokBtn = document.getElementById('setup-grok-btn') as HTMLButtonElement | null;
  const setupStatusEl = document.getElementById('setup-status');
  const setupGeminiStatus = document.getElementById('setup-gemini-status');
  const setupGrokStatus = document.getElementById('setup-grok-status');

  const manualToggle = document.getElementById('manual-setup-toggle') as HTMLButtonElement | null;
  const manualContent = document.getElementById('manual-setup-content');
  const manualChevron = document.getElementById('manual-setup-chevron');

  const iconGemini = document.getElementById('icon-gemini');
  const iconGrok = document.getElementById('icon-grok');
  const checkGemini = document.getElementById('check-gemini');
  const checkGrok = document.getElementById('check-grok');

  const welcomeTourLink = document.getElementById('welcome-tour-link') as HTMLAnchorElement | null;
  const whatsNewLink = document.getElementById('whats-new-link') as HTMLAnchorElement | null;

  // Insert Lucide icons
  if (iconGemini && !iconGemini.hasChildNodes()) {
    iconGemini.appendChild(iconEl('sparkles', 14));
  }
  if (iconGrok && !iconGrok.hasChildNodes()) {
    iconGrok.appendChild(iconEl('bot', 14));
  }
  if (checkGemini && !checkGemini.hasChildNodes()) {
    checkGemini.appendChild(iconEl('check', 13));
  }
  if (checkGrok && !checkGrok.hasChildNodes()) {
    checkGrok.appendChild(iconEl('check', 13));
  }
  if (manualChevron && !manualChevron.hasChildNodes()) {
    manualChevron.appendChild(iconEl('chevron-down', 14));
  }

  // Populate system instruction preview
  if (instructionEl) {
    instructionEl.textContent = SYSTEM_INSTRUCTION;
    if ('value' in instructionEl) {
      (instructionEl as HTMLTextAreaElement).value = SYSTEM_INSTRUCTION;
    }
  }

  // Status text helper with crossfade animation
  function setStatusText(text: string, type: 'muted' | 'success' | 'error' = 'muted'): void {
    if (setupStatusEl) {
      setupStatusEl.textContent = text;
      setupStatusEl.className = `setup-status-line status-${type}`;
      setupStatusEl.classList.remove('crossfade');
      // Trigger reflow to restart CSS crossfade animation
      void setupStatusEl.offsetWidth;
      setupStatusEl.classList.add('crossfade');
    }
    if (setupGeminiStatus) setupGeminiStatus.textContent = text;
    if (setupGrokStatus) setupGrokStatus.textContent = text;
  }

  // Render setup status for a site
  function renderSetupStatus(site: 'gemini' | 'grok', data?: { status: string; error?: string }): void {
    const btn = site === 'gemini' ? setupGeminiBtn : setupGrokBtn;
    if (!data) return;

    if (data.status === 'added') {
      btn?.classList.add('is-done');
      setStatusText('Added \u2713', 'success');
    } else if (data.status === 'already') {
      btn?.classList.add('is-done');
      setStatusText('Already set up \u2713', 'success');
    } else if (data.status === 'failed') {
      btn?.classList.remove('is-done');
      setStatusText(data.error || "Couldn't do it, use Copy", 'error');
    }
  }

  // Storage listener for setup status
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(
      ['gemini_setup_status', 'grok_setup_status', 'hasUpdateDot', 'lastSeenVersion'],
      (items) => {
        const gemini = items.gemini_setup_status as { status: string; error?: string; timestamp?: number } | undefined;
        const grok = items.grok_setup_status as { status: string; error?: string; timestamp?: number } | undefined;

        if (gemini?.status === 'added' || gemini?.status === 'already') {
          setupGeminiBtn?.classList.add('is-done');
        }
        if (grok?.status === 'added' || grok?.status === 'already') {
          setupGrokBtn?.classList.add('is-done');
        }

        if (gemini && grok) {
          const geminiTime = gemini.timestamp || 0;
          const grokTime = grok.timestamp || 0;
          const recent = geminiTime >= grokTime ? gemini : grok;
          renderSetupStatus(geminiTime >= grokTime ? 'gemini' : 'grok', recent);
        } else if (gemini) {
          renderSetupStatus('gemini', gemini);
        } else if (grok) {
          renderSetupStatus('grok', grok);
        }

        if (items.hasUpdateDot || items.lastSeenVersion) {
          whatsNewLink?.classList.remove('hidden');
        }
      },
    );

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.gemini_setup_status) {
          renderSetupStatus(
            'gemini',
            changes.gemini_setup_status.newValue as { status: string; error?: string } | undefined,
          );
        }
        if (changes.grok_setup_status) {
          renderSetupStatus(
            'grok',
            changes.grok_setup_status.newValue as { status: string; error?: string } | undefined,
          );
        }
        if (changes.hasUpdateDot) {
          if (changes.hasUpdateDot.newValue) {
            whatsNewLink?.classList.remove('hidden');
          } else {
            whatsNewLink?.classList.add('hidden');
          }
        }
      }
    });
  }

  // Welcome tour and What's new links
  if (welcomeTourLink) {
    welcomeTourLink.addEventListener('click', (e) => {
      e.preventDefault();
      const url =
        typeof chrome !== 'undefined' && chrome.runtime?.getURL
          ? chrome.runtime.getURL('welcome.html')
          : 'welcome.html';
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url });
      } else if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    });
  }

  if (whatsNewLink) {
    whatsNewLink.addEventListener('click', (e) => {
      e.preventDefault();
      const url =
        typeof chrome !== 'undefined' && chrome.runtime?.getURL
          ? chrome.runtime.getURL('welcome.html#whats-new')
          : 'welcome.html#whats-new';
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url });
      } else if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }

      if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
        chrome.action.setBadgeText({ text: '' });
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ hasUpdateDot: false });
      }
      whatsNewLink.classList.add('hidden');
    });
  }

  // Setup buttons click handlers
  if (setupGeminiBtn) {
    setupGeminiBtn.addEventListener('click', () => {
      setStatusText('Setting up\u2026', 'muted');
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'gemini' });
      }
    });
  }

  if (setupGrokBtn) {
    setupGrokBtn.addEventListener('click', () => {
      setStatusText('Setting up\u2026', 'muted');
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'grok' });
      }
    });
  }

  // Copy button handler
  let copyTimeoutId: number | null = null;
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(SYSTEM_INSTRUCTION);
        }
        copyBtn.classList.add('is-copied');
        const copyLabel = copyBtn.querySelector('.copy-label') as HTMLElement | null;
        if (copyLabel) {
          copyLabel.textContent = 'Copied \u2713';
          copyLabel.classList.remove('fade-in');
          void copyLabel.offsetWidth;
          copyLabel.classList.add('fade-in');
        } else {
          copyBtn.textContent = 'Copied \u2713';
        }

        if (copyTimeoutId !== null) {
          window.clearTimeout(copyTimeoutId);
        }
        copyTimeoutId = window.setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          if (copyLabel) {
            copyLabel.textContent = 'Copy';
            copyLabel.classList.remove('fade-in');
            void copyLabel.offsetWidth;
            copyLabel.classList.add('fade-in');
          } else {
            copyBtn.textContent = 'Copy';
          }
          copyTimeoutId = null;
        }, 1500);
      } catch (err) {
        console.error('Failed to copy system instruction:', err);
      }
    });
  }

  // Active tab detection
  function renderTabStatus(isActive: boolean): void {
    if (!statusLine) return;
    clear(statusLine);
    if (isActive) {
      statusLine.className = 'status-pill status-active';
      const dot = h('span', { class: 'status-dot' });
      statusLine.appendChild(dot);
      statusLine.appendChild(document.createTextNode('Active'));
    } else {
      statusLine.className = 'status-pill status-muted';
      statusLine.appendChild(document.createTextNode('Open Gemini or Grok'));
    }
  }

  if (statusLine) {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs && tabs[0];
          const url = tab?.url || '';
          if (url.includes('gemini.google.com') || url.includes('grok.com')) {
            renderTabStatus(true);
          } else {
            renderTabStatus(false);
          }
        });
      } catch {
        renderTabStatus(false);
      }
    } else {
      renderTabStatus(false);
    }
  }

  // Manual setup expand/collapse
  if (manualToggle && manualContent) {
    manualToggle.addEventListener('click', () => {
      const isExpanded = manualToggle.getAttribute('aria-expanded') === 'true';
      const nextExpanded = !isExpanded;
      manualToggle.setAttribute('aria-expanded', String(nextExpanded));
      if (nextExpanded) {
        manualContent.classList.add('is-expanded');
      } else {
        manualContent.classList.remove('is-expanded');
      }
    });
  }

  // Appearance & Theme settings
  function updateThemeUI(theme: Settings['theme']): void {
    if (themeSegmented) {
      themeSegmented.setAttribute('data-value', theme);
      const buttons = themeSegmented.querySelectorAll<HTMLButtonElement>('.segmented-btn');
      buttons.forEach((btn) => {
        const val = btn.getAttribute('data-value');
        const isActive = val === theme;
        btn.setAttribute('aria-checked', String(isActive));
        if (isActive) {
          btn.classList.add('is-active');
        } else {
          btn.classList.remove('is-active');
        }
      });
    }

    if (themeSelect) {
      themeSelect.value = theme;
    }

    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (logoImg) logoImg.src = '/brand/mark-black.png';
      if (logoSource) logoSource.srcset = '/brand/mark-black.png';
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (logoImg) logoImg.src = '/brand/mark-white.png';
      if (logoSource) logoSource.srcset = '/brand/mark-white.png';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (logoImg) logoImg.src = '/brand/mark-black.png';
      if (logoSource) logoSource.srcset = '/brand/mark-white.png';
    }
  }

  function applySettingsToUI(s: Settings): void {
    updateThemeUI(s.theme);
  }

  loadSettings().then(applySettingsToUI).catch(console.error);
  const unsubscribeSettings = onSettingsChange(applySettingsToUI);

  if (themeSegmented) {
    const buttons = themeSegmented.querySelectorAll<HTMLButtonElement>('.segmented-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-value') as Settings['theme'];
        if (val === 'auto' || val === 'light' || val === 'dark') {
          saveSettings({ theme: val }).catch(console.error);
          updateThemeUI(val);
        }
      });
    });
  }

  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const theme = themeSelect.value as Settings['theme'];
      saveSettings({ theme }).catch(console.error);
      updateThemeUI(theme);
    });
  }

  return () => {
    unsubscribeSettings();
    if (copyTimeoutId !== null) {
      window.clearTimeout(copyTimeoutId);
    }
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initPopup();
    });
  } else {
    initPopup();
  }
}
