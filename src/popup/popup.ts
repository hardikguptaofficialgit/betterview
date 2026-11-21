import './popup.css';
import { loadSettings, saveSettings, onSettingsChange, Settings } from '../shared/settings';
import { SETUP_INSTRUCTION, CURRENT_INSTRUCTION_VERSION } from '../shared/systemInstruction';
import { h, clear } from '../core/dom';
import { iconEl } from '../core/icons';
import { geminiIconSvg, grokIconSvg } from '../core/brandIcons';

export function initPopup(): () => void {
  const statusLine = document.getElementById('status-line');
  const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement | null;
  const instructionEl = document.getElementById('system-instruction');
  const themeSegmented = document.getElementById('theme-segmented');
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
  const watermarkToggle = document.getElementById('watermark-toggle') as HTMLInputElement | null;
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

  // Backwards compatibility with tests looking inside icon-gemini / icon-grok / check / chevron
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

  // Populate system instruction preview with SETUP_INSTRUCTION
  if (instructionEl) {
    instructionEl.textContent = SETUP_INSTRUCTION;
    if ('value' in instructionEl) {
      (instructionEl as HTMLTextAreaElement).value = SETUP_INSTRUCTION;
    }
  }

  // Set version in footer
  const versionTag = document.querySelector<HTMLElement>('.version-tag');
  if (versionTag) {
    const version =
      (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '0.1.0';
    versionTag.textContent = `v${version}`;
  }

  // Hidden status text helper for screen reader / test compatibility
  function setStatusText(text: string, type: 'muted' | 'success' | 'error' = 'muted'): void {
    if (setupStatusEl) {
      setupStatusEl.textContent = text;
      setupStatusEl.className = `setup-status-line sr-only status-${type}`;
    }
  }

  type StatusKind = 'ready' | 'needs-update' | 'not-set-up' | 'failed';

  // Render per-site setup status
  function renderSetupStatus(
    site: 'gemini' | 'grok',
    data?: { status?: string; version?: number; error?: string; hasOldEntry?: boolean },
  ): void {
    const btn = site === 'gemini' ? setupGeminiBtn : setupGrokBtn;
    const label = site === 'gemini' ? labelGemini : labelGrok;
    const statusTextEl = site === 'gemini' ? setupGeminiStatus : setupGrokStatus;
    const spinner = site === 'gemini' ? spinnerGemini : spinnerGrok;
    const rowEl = document.getElementById(`row-${site}`);
    const dot = rowEl?.querySelector<HTMLElement>('.site-status-dot');

    spinner?.classList.add('hidden');
    label?.classList.remove('hidden');

    let kind: StatusKind = 'not-set-up';
    let statusText = 'Prompt not added';
    let btnLabel = 'Add prompt';
    let isGhost = false;
    let title = '';

    if (!data || !data.status) {
      kind = 'not-set-up';
      statusText = 'Prompt not added';
      btnLabel = 'Add prompt';
    } else if (data.status === 'added' || data.status === 'already') {
      const ver = data.version ?? 1;
      if (ver >= CURRENT_INSTRUCTION_VERSION) {
        kind = 'ready';
        statusText = 'Prompt added';
        btnLabel = 'Refresh';
        isGhost = true;
      } else {
        kind = 'needs-update';
        statusText = 'Update available';
        btnLabel = 'Update';
      }
    } else if (data.status === 'failed') {
      kind = 'failed';
      const rawError = data.error?.trim();
      statusText = rawError
        ? (rawError.length > 80 ? `${rawError.slice(0, 79)}…` : rawError)
        : "Setup didn't finish";
      btnLabel = 'Retry';
      title = data.error || "Setup didn't finish";
    }

    if (statusTextEl) {
      statusTextEl.textContent = statusText;
      statusTextEl.className = `site-status-text status-${kind}`;
      if (title) {
        statusTextEl.setAttribute('title', title);
      } else {
        statusTextEl.removeAttribute('title');
      }
    }

    if (dot) {
      dot.className = `site-status-dot dot-${kind}`;
    }

    if (label) {
      label.textContent = btnLabel;
    }

    if (btn) {
      if (isGhost) {
        btn.classList.add('btn-ghost');
        btn.classList.remove('btn-primary');
        btn.classList.add('is-done');
      } else {
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-primary');
        btn.classList.remove('is-done');
      }
    }

    if (site === 'gemini' && geminiUpdateHint) {
      if (data?.hasOldEntry) {
        geminiUpdateHint.classList.remove('hidden');
      } else {
        geminiUpdateHint.classList.add('hidden');
      }
    }
  }

  // Storage listener for setup status
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(
      ['gemini_setup_status', 'grok_setup_status', 'hasUpdateDot', 'lastSeenVersion'],
      (items) => {
        const gemini = items.gemini_setup_status as
          | { status: string; version?: number; error?: string; hasOldEntry?: boolean; timestamp?: number }
          | undefined;
        const grok = items.grok_setup_status as
          | { status: string; version?: number; error?: string; hasOldEntry?: boolean; timestamp?: number }
          | undefined;

        if (gemini) renderSetupStatus('gemini', gemini);
        if (grok) renderSetupStatus('grok', grok);

        // Keep setupStatusEl text updated for screen readers / tests
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
          const val = changes.gemini_setup_status.newValue as
            | { status: string; version?: number; error?: string; hasOldEntry?: boolean }
            | undefined;
          renderSetupStatus('gemini', val);
          if (val) {
            setStatusText(
              val.status === 'added'
                ? 'Added \u2713'
                : val.status === 'already'
                  ? 'Already set up \u2713'
                  : (val.error || 'Failed'),
              val.status === 'failed' ? 'error' : 'success',
            );
          }
        }
        if (changes.grok_setup_status) {
          const val = changes.grok_setup_status.newValue as
            | { status: string; version?: number; error?: string; hasOldEntry?: boolean }
            | undefined;
          renderSetupStatus('grok', val);
          if (val) {
            setStatusText(
              val.status === 'added'
                ? 'Added \u2713'
                : val.status === 'already'
                  ? 'Already set up \u2713'
                  : (val.error || 'Failed'),
              val.status === 'failed' ? 'error' : 'success',
            );
          }
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
      setStatusText('Adding prompt…', 'muted');
      spinnerGemini?.classList.remove('hidden');
      if (labelGemini) labelGemini.textContent = 'Adding…';
      if (setupGeminiStatus) setupGeminiStatus.textContent = 'Adding prompt…';
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'gemini' });
      }
    });
  }

  if (setupGrokBtn) {
    setupGrokBtn.addEventListener('click', () => {
      setStatusText('Adding prompt…', 'muted');
      spinnerGrok?.classList.remove('hidden');
      if (labelGrok) labelGrok.textContent = 'Adding…';
      if (setupGrokStatus) setupGrokStatus.textContent = 'Adding prompt…';
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
        const samplePrompt = 'Teach me how a web browser loads a webpage, starting from entering a URL to displaying the finished page. Break down every step in a beginner-friendly way, explain the underlying concepts, and use a clear flow diagram with practical examples to help me understand how everything works.';
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(samplePrompt);
        }
        if (tryItLabel) {
          tryItLabel.textContent = 'Copied \u2713';
        }
        tryItBtn.classList.add('is-copied');
        if (tryItTimeoutId !== null) window.clearTimeout(tryItTimeoutId);
        tryItTimeoutId = window.setTimeout(() => {
          if (tryItLabel) tryItLabel.textContent = 'Copy prompt';
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
      statusLine.className = 'status-line status-active';
      const dot = h('span', { class: 'status-dot' });
      statusLine.appendChild(dot);
      statusLine.appendChild(document.createTextNode('Active on Gemini'));
      enableTourLink(true);
    } else if (site === 'grok') {
      statusLine.className = 'status-line status-active';
      const dot = h('span', { class: 'status-dot' });
      statusLine.appendChild(dot);
      statusLine.appendChild(document.createTextNode('Active on Grok'));
      enableTourLink(true);
    } else {
      statusLine.className = 'status-line status-muted';
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
          await navigator.clipboard.writeText(SETUP_INSTRUCTION);
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
  let currentThemeSetting: Settings['theme'] = 'auto';

  const mql =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  function resolveTheme(setting: Settings['theme']): 'light' | 'dark' {
    if (setting === 'auto') {
      return mql && mql.matches ? 'dark' : 'light';
    }
    return setting;
  }

  function updateThemeUI(theme: Settings['theme']): void {
    currentThemeSetting = theme;
    const resolved = resolveTheme(theme);

    document.documentElement.setAttribute('data-theme', resolved);

    if (logoImg) {
      logoImg.src = resolved === 'dark' ? '/brand/mark-white.png' : '/brand/mark-black.png';
    }
    if (logoSource) {
      logoSource.srcset = resolved === 'dark' ? '/brand/mark-white.png' : '/brand/mark-black.png';
    }

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
  }

  if (mql && mql.addEventListener) {
    mql.addEventListener('change', () => {
      if (currentThemeSetting === 'auto') {
        updateThemeUI('auto');
      }
    });
  }

  function applySettingsToUI(s: Settings): void {
    updateThemeUI(s.theme);
    if (watermarkToggle) {
      watermarkToggle.checked = s.watermark !== false;
    }
  }

  loadSettings().then(applySettingsToUI).catch(console.error);
  const unsubscribeSettings = onSettingsChange(applySettingsToUI);

  if (watermarkToggle) {
    watermarkToggle.addEventListener('change', () => {
      saveSettings({ watermark: watermarkToggle.checked }).catch(console.error);
    });
  }

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
