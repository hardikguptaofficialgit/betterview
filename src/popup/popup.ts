import './popup.css';
import { loadSettings, saveSettings, onSettingsChange, Settings } from '../shared/settings';
import { SYSTEM_INSTRUCTION, CURRENT_INSTRUCTION_VERSION } from '../shared/systemInstruction';
import { h, clear } from '../core/dom';
import { iconEl } from '../core/icons';
import { geminiIconSvg, grokIconSvg } from '../core/brandIcons';

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
  const labelGemini = document.getElementById('label-gemini');
  const labelGrok = document.getElementById('label-grok');
  const spinnerGemini = document.getElementById('spinner-gemini');
  const spinnerGrok = document.getElementById('spinner-grok');
  const setupStatusEl = document.getElementById('setup-status');
  const setupGeminiStatus = document.getElementById('setup-gemini-status');
  const setupGrokStatus = document.getElementById('setup-grok-status');
  const geminiUpdateHint = document.getElementById('gemini-update-hint');

  const manualToggle = document.getElementById('manual-setup-toggle') as HTMLButtonElement | null;
  const manualContent = document.getElementById('manual-setup-content');
  const manualChevron = document.getElementById('manual-setup-chevron');

  const logoGemini = document.getElementById('logo-gemini');
  const logoGrok = document.getElementById('logo-grok');
  const iconGemini = document.getElementById('icon-gemini');
  const iconGrok = document.getElementById('icon-grok');
  const checkGemini = document.getElementById('check-gemini');
  const checkGrok = document.getElementById('check-grok');

  const tryItBtn = document.getElementById('try-it-btn') as HTMLButtonElement | null;
  const tryItLabel = document.getElementById('try-it-label');

  const welcomeTourLink = document.getElementById('welcome-tour-link') as HTMLAnchorElement | null;
  const whatsNewLink = document.getElementById('whats-new-link') as HTMLAnchorElement | null;

  // Render real brand marks into 28px logo containers
  if (logoGemini && !logoGemini.querySelector('svg.bvi-gemini-logo')) {
    const gSvg = geminiIconSvg(28);
    gSvg.classList.add('bvi-gemini-logo');
    logoGemini.prepend(gSvg);
  }
  if (logoGrok && !logoGrok.querySelector('svg.bvi-grok-logo')) {
    const grkSvg = grokIconSvg(28);
    grkSvg.classList.add('bvi-grok-logo');
    logoGrok.prepend(grkSvg);
  }

  // Backwards compatibility with tests looking inside icon-gemini / icon-grok
  if (iconGemini && !iconGemini.hasChildNodes()) {
    iconGemini.appendChild(geminiIconSvg(14));
  }
  if (iconGrok && !iconGrok.hasChildNodes()) {
    iconGrok.appendChild(grokIconSvg(14));
  }
  if (checkGemini && !checkGemini.hasChildNodes()) {
    checkGemini.appendChild(iconEl('check', 13));
  }
  if (checkGrok && !checkGrok.hasChildNodes()) {
    checkGrok.appendChild(iconEl('check', 13));
  }
  if (manualChevron && !manualChevron.hasChildNodes()) {
    manualChevron.appendChild(iconEl('caret-down', 14));
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
      void setupStatusEl.offsetWidth;
      setupStatusEl.classList.add('crossfade');
    }
  }

  // Render setup status for a site
  function renderSetupStatus(
    site: 'gemini' | 'grok',
    data?: { status: string; version?: number; error?: string },
  ): void {
    const btn = site === 'gemini' ? setupGeminiBtn : setupGrokBtn;
    const label = site === 'gemini' ? labelGemini : labelGrok;
    const statusLine = site === 'gemini' ? setupGeminiStatus : setupGrokStatus;
    const spinner = site === 'gemini' ? spinnerGemini : spinnerGrok;

    if (!data) {
      if (statusLine) statusLine.textContent = 'Not set up';
      if (label) label.textContent = 'Set up';
      btn?.classList.remove('is-done');
      return;
    }

    spinner?.classList.add('hidden');
    label?.classList.remove('hidden');

    if (data.status === 'added' || data.status === 'already') {
      const isOlder = (data.version || 1) < CURRENT_INSTRUCTION_VERSION;
      if (isOlder) {
        if (statusLine) {
          statusLine.textContent = 'Update available';
          statusLine.className = 'site-status-text status-warning';
        }
        if (label) label.textContent = 'Update';
        btn?.classList.remove('is-done');
        if (site === 'gemini' && geminiUpdateHint) {
          geminiUpdateHint.classList.remove('hidden');
        }
        setStatusText(data.status === 'added' ? 'Added \u2713' : 'Already set up \u2713', 'success');
      } else {
        btn?.classList.add('is-done');
        if (statusLine) {
          statusLine.textContent = 'Set up \u2713';
          statusLine.className = 'site-status-text status-success';
        }
        if (label) label.textContent = 'Redo';
        if (site === 'gemini' && geminiUpdateHint) {
          geminiUpdateHint.classList.add('hidden');
        }
        setStatusText(data.status === 'added' ? 'Added \u2713' : 'Already set up \u2713', 'success');
      }
    } else if (data.status === 'failed') {
      btn?.classList.remove('is-done');
      if (statusLine) {
        statusLine.textContent = 'Failed';
        statusLine.className = 'site-status-text status-error';
      }
      if (label) label.textContent = 'Set up';
      setStatusText(data.error || "Couldn't do it, use Copy", 'error');
    }
  }

  // Storage listener for setup status
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(
      ['gemini_setup_status', 'grok_setup_status', 'hasUpdateDot', 'lastSeenVersion'],
      (items) => {
        const gemini = items.gemini_setup_status as
          | { status: string; version?: number; error?: string; timestamp?: number }
          | undefined;
        const grok = items.grok_setup_status as
          | { status: string; version?: number; error?: string; timestamp?: number }
          | undefined;

        if (gemini) renderSetupStatus('gemini', gemini);
        if (grok) renderSetupStatus('grok', grok);

        if (gemini && grok) {
          const geminiTime = gemini.timestamp || 0;
          const grokTime = grok.timestamp || 0;
          const recent = geminiTime >= grokTime ? gemini : grok;
          setStatusText(
            recent.status === 'added'
              ? 'Added \u2713'
              : recent.status === 'already'
                ? 'Already set up \u2713'
                : (recent.error || 'Failed'),
            recent.status === 'failed' ? 'error' : 'success',
          );
        } else if (gemini) {
          setStatusText(gemini.status === 'added' ? 'Added \u2713' : 'Already set up \u2713', 'success');
        } else if (grok) {
          setStatusText(grok.status === 'added' ? 'Added \u2713' : 'Already set up \u2713', 'success');
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
            changes.gemini_setup_status.newValue as
              | { status: string; version?: number; error?: string }
              | undefined,
          );
        }
        if (changes.grok_setup_status) {
          renderSetupStatus(
            'grok',
            changes.grok_setup_status.newValue as
              | { status: string; version?: number; error?: string }
              | undefined,
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

  // Setup buttons click handlers
  if (setupGeminiBtn) {
    setupGeminiBtn.addEventListener('click', () => {
      setStatusText('Setting up\u2026', 'muted');
      spinnerGemini?.classList.remove('hidden');
      if (setupGeminiStatus) setupGeminiStatus.textContent = 'Setting up...';
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'gemini' });
      }
    });
  }

  if (setupGrokBtn) {
    setupGrokBtn.addEventListener('click', () => {
      setStatusText('Setting up\u2026', 'muted');
      spinnerGrok?.classList.remove('hidden');
      if (setupGrokStatus) setupGrokStatus.textContent = 'Setting up...';
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'grok' });
      }
    });
  }

  // Try it prompt button handler
  let tryItTimeoutId: number | null = null;
  if (tryItBtn) {
    tryItBtn.addEventListener('click', async () => {
      try {
        const samplePrompt = 'Create a flow diagram of OAuth 2.0 authorization code grant with token refresh';
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(samplePrompt);
        }
        if (tryItLabel) {
          tryItLabel.textContent = 'Copied \u2713';
        }
        tryItBtn.classList.add('is-copied');
        if (tryItTimeoutId !== null) window.clearTimeout(tryItTimeoutId);
        tryItTimeoutId = window.setTimeout(() => {
          if (tryItLabel) tryItLabel.textContent = 'Copy sample';
          tryItBtn.classList.remove('is-copied');
          tryItTimeoutId = null;
        }, 1500);
      } catch (err) {
        console.error('Failed to copy sample prompt:', err);
      }
    });
  }

  // Active tab detection & Welcome tour enablement
  let activeTabSite: 'gemini' | 'grok' | null = null;
  let activeTabId: number | undefined;

  function renderTabStatus(site: 'gemini' | 'grok' | null): void {
    if (!statusLine) return;
    clear(statusLine);
    if (site === 'gemini') {
      statusLine.className = 'status-pill status-active';
      const miniLogo = geminiIconSvg(13);
      statusLine.appendChild(miniLogo);
      statusLine.appendChild(document.createTextNode('Active on Gemini'));
      const dot = h('span', { class: 'status-dot' });
      statusLine.appendChild(dot);
      enableTourLink(true);
    } else if (site === 'grok') {
      statusLine.className = 'status-pill status-active';
      const miniLogo = grokIconSvg(13);
      statusLine.appendChild(miniLogo);
      statusLine.appendChild(document.createTextNode('Active on Grok'));
      const dot = h('span', { class: 'status-dot' });
      statusLine.appendChild(dot);
      enableTourLink(true);
    } else {
      statusLine.className = 'status-pill status-muted';
      statusLine.appendChild(document.createTextNode('Open Gemini or Grok'));
      enableTourLink(false);
    }
  }

  function enableTourLink(enabled: boolean): void {
    if (!welcomeTourLink) return;
    if (enabled) {
      welcomeTourLink.classList.remove('is-disabled');
      welcomeTourLink.removeAttribute('aria-disabled');
      welcomeTourLink.removeAttribute('title');
    } else {
      welcomeTourLink.classList.add('is-disabled');
      welcomeTourLink.setAttribute('aria-disabled', 'true');
      welcomeTourLink.setAttribute('title', 'Open on a Gemini or Grok tab');
    }
  }

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        activeTabId = tab?.id;
        const url = tab?.url || '';
        if (url.includes('gemini.google.com')) {
          activeTabSite = 'gemini';
          renderTabStatus('gemini');
        } else if (url.includes('grok.com')) {
          activeTabSite = 'grok';
          renderTabStatus('grok');
        } else {
          activeTabSite = null;
          renderTabStatus(null);
        }
      });
    } catch {
      renderTabStatus(null);
    }
  } else {
    renderTabStatus(null);
  }

  // Welcome tour and What's new links
  if (welcomeTourLink) {
    welcomeTourLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (!activeTabSite) {
        // Disabled on other sites with tooltip
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage && activeTabId !== undefined) {
        chrome.tabs.sendMessage(activeTabId, { type: 'OPEN_TOUR' });
      } else if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: 'welcome.html' });
      }
    });
  }

  if (whatsNewLink) {
    whatsNewLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeTabSite && typeof chrome !== 'undefined' && chrome.tabs?.sendMessage && activeTabId !== undefined) {
        chrome.tabs.sendMessage(activeTabId, { type: 'OPEN_WHATS_NEW' });
      } else if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: 'welcome.html#whats-new' });
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

  // Copy instruction button handler
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
    if (copyTimeoutId !== null) window.clearTimeout(copyTimeoutId);
    if (tryItTimeoutId !== null) window.clearTimeout(tryItTimeoutId);
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
